"""ito_fetch: the layout engine of `ito-fastfetch show` (boot-screens-v2 section A). Pure functions plus the logo preparation.

fastfetch cannot centre, so Ito prints the fetch itself: it takes Omarchy's module lines as fastfetch printed them (values, keys
and colours untouched), puts them with a logo inside an optional frame, and places the whole block at coordinates computed in
the REAL cell grid, so that the margins differ by at most one cell on each axis.

Colours: SGR only (the terminal's palette is the theme), except the image logo, which is tinted with the `bone` token and
cached as a PNG. Nothing here reads the screen; the grid comes from TIOCGWINSZ or from COLUMNS/LINES.
"""
from __future__ import annotations

import base64
import fcntl
import hashlib
import os
import re
import struct
import sys
import termios
import unicodedata
from pathlib import Path

HOME = Path(os.environ.get("HOME", "~")).expanduser()
CACHE = HOME / ".cache" / "ito" / "fetch"
GEN = 4                                      # bump when the image bake changes
DEFAULT_CELL = (7.0, 16.5)                   # the measurement of F3: JetBrainsMono 9 in Ghostty at scale 1
GAP = 6                                      # cells between the logo and the modules (Omarchy's padding.right)
GAP_ENGRAVING = 4                            # a transparent picture needs less air than an opaque slab
MAX_LOGO_W, MAX_LOGO_H = 56, 24

ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[a-zA-Z]|\x1b_.*?\x1b\\|\x1b\].*?(?:\x07|\x1b\\)", re.S)
PRIVATE_RE = re.compile(r"\x1b\[\?[0-9;]*[a-zA-Z]")


# ---- widths ---------------------------------------------------------------------------------------------------------

def wide(ch):
    return 0 if unicodedata.combining(ch) else (2 if unicodedata.east_asian_width(ch) in "WF" else 1)


def columns(text):
    return sum(wide(c) for c in text)


def strip_ansi(text):
    return ANSI_RE.sub("", text)


def fit_ansi(line, maxw):
    """`line` cut to maxw display columns with an ellipsis, SGR kept, never wrapped. Unchanged when it fits."""
    if columns(strip_ansi(line)) <= maxw:
        return line
    out, w, i = [], 0, 0
    limit = max(0, maxw - 1)
    while i < len(line):
        m = ANSI_RE.match(line, i)
        if m:
            out.append(m.group(0))
            i = m.end()
            continue
        cw = wide(line[i])
        if w + cw > limit:
            break
        out.append(line[i])
        w += cw
        i += 1
    return "".join(out) + "\x1b[0m" + ("…" if maxw > 0 else "")


# ---- the frame ------------------------------------------------------------------------------------------------------

TITLE_DEFAULT = "ikai"


def valid_title(t):
    """Printable, no control characters, at most 24 columns; anything else is the default."""
    if not isinstance(t, str) or not t.strip() or columns(t) > 24:
        return TITLE_DEFAULT
    if any(unicodedata.category(c).startswith("C") for c in t):
        return TITLE_DEFAULT
    return t.strip()


def frame_top(W, name):
    n = W - 10 - columns(name)
    assert n >= 1, (W, name)
    plain = "┏━━ 端  " + name + " " + "━" * n + "┓"
    assert columns(plain) == W, (columns(plain), W)
    return "\x1b[0;90m┏━━ \x1b[37m端\x1b[90m  \x1b[1;39m" + name + "\x1b[0;90m " + "━" * n + "┓\x1b[0m"


def frame_bottom(W):
    plain = "┗" + "━" * (W - 9) + " 眼 " + "━━━" + "┛"
    assert columns(plain) == W, (columns(plain), W)
    return "\x1b[0;90m┗" + "━" * (W - 9) + " \x1b[0;2m眼\x1b[0;90m ━━━┛\x1b[0m"


SIDE = "\x1b[0;90m┃\x1b[0m"


# ---- the terminal grid ----------------------------------------------------------------------------------------------

def cell_px_default(style):
    raw = os.environ.get("ITO_CELL_PX") or str((style or {}).get("fetchCellPx") or "")
    m = re.fullmatch(r"\s*([0-9.]+)\s*[x,]\s*([0-9.]+)\s*", raw)
    if m and float(m.group(1)) > 1 and float(m.group(2)) > 1:
        return float(m.group(1)), float(m.group(2))
    return DEFAULT_CELL


def term_grid(style=None):
    """(cols, rows, cw, ch, source). TIOCGWINSZ on stdout when it is a terminal; else COLUMNS/LINES; else stderr/stdin; else 80x24.
    cw/ch = pixels / cells when the terminal reports pixels (Ghostty does), else ITO_CELL_PX / `fetchCellPx` / 7 x 16.5.
    ITO_CELL_PX always wins (tests)."""
    def ioctl(fd):
        try:
            rows, cols, xp, yp = struct.unpack("HHHH", fcntl.ioctl(fd, termios.TIOCGWINSZ, b"\0" * 8))
            return (cols, rows, xp, yp) if cols > 0 and rows > 0 else None
        except OSError:
            return None
    got, src = None, ""
    if sys.stdout.isatty():
        got, src = ioctl(1), "ioctl"
    if got is None:
        try:
            c, r = int(os.environ.get("COLUMNS", 0)), int(os.environ.get("LINES", 0))
        except ValueError:
            c = r = 0
        if c > 0 and r > 0:
            got, src = (c, r, 0, 0), "env"
    if got is None:
        for fd in (2, 0):
            got = ioctl(fd)
            if got:
                src = "ioctl"
                break
    if got is None:
        got, src = (80, 24, 0, 0), "default"
    cols, rows, xp, yp = got
    dcw, dch = cell_px_default(style)
    if xp > 0 and yp > 0 and not os.environ.get("ITO_CELL_PX"):
        return cols, rows, xp / cols, yp / rows, src
    return cols, rows, dcw, dch, src + "+default-cell"


def kitty_here():
    e = os.environ
    return (e.get("TERM_PROGRAM") in ("ghostty", "kitty", "WezTerm") or "kitty" in e.get("TERM", "") or "ghostty" in e.get("TERM", "")
            or "KITTY_WINDOW_ID" in e) and "SSH_CONNECTION" not in e


# ---- logos ----------------------------------------------------------------------------------------------------------

SGR_NAMES = {"black": 30, "red": 31, "green": 32, "yellow": 33, "blue": 34, "magenta": 35, "cyan": 36, "white": 37, "default": 39}


def sgr_code(value):
    v = str(value).strip().lower()
    if v in SGR_NAMES:
        return str(SGR_NAMES[v])
    if v.startswith("light_") and v[6:] in SGR_NAMES:
        return str(SGR_NAMES[v[6:]] + 60)
    return v if re.fullmatch(r"[0-9;]+", v) else "39"


class TextLogo:
    """Rows of a text logo cropped to their ink (blank rows and columns removed; U+2800 counts as blank): `rows` are ANSI strings,
    every row `lw` columns wide when drawn."""
    kind = "text"

    def __init__(self, text, colours=None, name="text"):
        colours = {k: sgr_code(v) for k, v in (colours or {}).items()}
        raw = [l for l in text.replace("\r", "").split("\n")]
        parsed = []                           # per row: [(char, sgr-or-None)]
        for line in raw:
            cur, cells = None, []
            for part in re.split(r"(\$[1-9])", line):
                if re.fullmatch(r"\$[1-9]", part):
                    cur = colours.get(part[1])
                else:
                    cells += [(c, cur) for c in part]
            parsed.append(cells)
        blank = lambda c: c in (" ", "⠀", "\t")
        ink_rows = [i for i, r in enumerate(parsed) if any(not blank(c) for c, _s in r)]
        self.name = name
        if not ink_rows:
            self.rows, self.lw, self.lh = [], 0, 0
            return
        parsed = parsed[ink_rows[0]:ink_rows[-1] + 1]
        cols_of = lambda r: [sum(wide(c) for c, _s in r[:k]) for k in range(len(r) + 1)]
        left = min(next(sum(wide(c) for c, _s in r[:k]) for k in range(len(r) + 1) if k == len(r) or not blank(r[k][0])) for r in parsed
                   if any(not blank(c) for c, _s in r))
        rows = []
        for r in parsed:
            x, out, cur = 0, [], None
            for c, s in r:
                w = wide(c)
                if x + w <= left:
                    x += w
                    continue
                if blank(c):
                    c = " "
                if s != cur:
                    out.append("\x1b[0;" + s + "m" if s else "\x1b[0m")
                    cur = s
                out.append(c)
                x += w
            rows.append(("".join(out)).rstrip(" ") + "\x1b[0m")
        widths = [columns(strip_ansi(r)) for r in rows]
        self.rows, self.lw, self.lh = rows, max(widths), len(rows)

    def size(self, mh, cw, ch):
        return self.lw, self.lh

    def lines(self):
        return self.rows


def alpha_bbox(alpha, thr=8):
    import numpy as np
    ys, xs = np.nonzero(alpha > thr)
    if len(ys) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def _gblur(m, sig):
    """Separable gaussian (no scipy) of a float map; reflect edges."""
    import numpy as np
    if sig <= 0.05:
        return m.astype(np.float32)
    r = max(1, int(3 * sig + 0.5))
    x = np.arange(-r, r + 1)
    k = np.exp(-x * x / (2 * sig * sig))
    k /= k.sum()
    p = np.pad(m.astype(np.float32), r, mode="reflect")
    h = sum(k[i] * p[:, i:i + p.shape[1] - 2 * r] for i in range(2 * r + 1))
    return sum(k[i] * h[i:i + h.shape[0] - 2 * r, :] for i in range(2 * r + 1))


def _smooth(x, lo, hi):
    import numpy as np
    t = np.clip((x - lo) / max(1e-3, hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def _figure_mask(L, seal=3, thr=0.6):
    """The inside of a black-on-white drawing: everything not reachable from the border through paper."""
    import numpy as np
    from PIL import Image, ImageDraw, ImageFilter
    dark = (L < thr).astype(np.uint8) * 255
    sealed = np.asarray(Image.fromarray(dark).filter(ImageFilter.MaxFilter(2 * seal + 1)))
    paper = np.where(sealed > 0, 0, 255).astype(np.uint8)
    img = Image.fromarray(np.pad(paper, 2, constant_values=255)).copy()
    ImageDraw.floodfill(img, (0, 0), 128, thresh=0)
    outside = np.asarray(img)[2:-2, 2:-2] == 128
    o = np.asarray(Image.fromarray((outside * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * seal - 1))) > 0
    return ~o


POLARITIES = ("auto", "lum", "print", "ink", "engrave")


def engraving_mode(L, polarity, light_theme):
    """The recipe that polarity names for this picture. auto: white-on-black art -> lum; black-on-white art -> print on dark themes,
    ink on light themes (the terminal colour shows through every gap, so the ink side must be the light side)."""
    import numpy as np
    if polarity in ("lum", "print", "ink", "engrave"):
        return polarity
    border = np.concatenate([L[0], L[-1], L[:, 0], L[:, -1]])
    if float(np.median(border)) < 0.5:
        return "lum"
    return "ink" if light_theme else "print"


def bake_engraving(src, polarity="auto", light_theme=False):
    """The picture as a white RGBA whose ALPHA is the drawing (luminance -> alpha), cropped to its alpha bbox + 2 %. Baked once into
    CACHE/engr-<sha12>.png. Returns (path, mode); mode 'engrave' is applied at the placed size by ImageLogo.png (a line screen)."""
    import numpy as np
    from PIL import Image
    src = Path(src)
    st = src.stat()
    with Image.open(src) as im:
        im.load()
        rgba = im.convert("RGBA")
    import numpy as _np
    clear = float((_np.asarray(rgba)[..., 3] < 128).mean())
    # a drawing on a transparent ground (a sprite) has nothing where it is clear; an opaque picture's clear pixels, if any, are paper
    bg = Image.new("RGBA", rgba.size, (0, 0, 0, 255) if clear > 0.02 else (255, 255, 255, 255))
    rgb = Image.alpha_composite(bg, rgba).convert("RGB")
    k = min(1.0, 1400.0 / max(rgb.size))
    if k < 1.0:
        rgb = rgb.resize((max(1, round(rgb.width * k)), max(1, round(rgb.height * k))), Image.LANCZOS)
    L = np.asarray(rgb.convert("L"), np.float32) / 255.0
    mode = engraving_mode(L, polarity, light_theme)
    sig = f"{src}|{st.st_mtime_ns}|{st.st_size}|{mode}|{GEN}"
    out = CACHE / f"engr-{hashlib.sha1(sig.encode()).hexdigest()[:12]}.png"
    if out.is_file():
        return out, mode
    if mode in ("lum", "engrave"):
        b = np.concatenate([L[0], L[-1], L[:, 0], L[:, -1]])
        lo = min(0.45, float(np.median(b)) + 0.06)
        hi = max(lo + 0.2, float(np.percentile(L, 99.5)) - 0.02)
        a = _smooth(L, lo, hi) ** 0.9
    elif mode == "print":
        a = _smooth(L, 0.30, 0.85) * _figure_mask(L, 3, 0.6)
    else:
        a = _smooth(1 - L, 0.22, 0.80) * _figure_mask(L, 3, 0.6)
    box = alpha_bbox((a * 255).astype(np.uint8), 20)
    if box is None:
        raise ValueError("the picture has no visible ink")
    x0, y0, x1, y1 = box
    px_, py_ = int((x1 - x0) * 0.02) + 1, int((y1 - y0) * 0.02) + 1
    a = a[max(0, y0 - py_):y1 + py_, max(0, x0 - px_):x1 + px_]
    h, w = a.shape
    res = np.full((h, w, 4), 255, np.uint8)
    res[..., 3] = np.clip(np.round(a * 255), 0, 255).astype(np.uint8)
    CACHE.mkdir(parents=True, exist_ok=True)
    tmp = out.with_name(out.name + f".{os.getpid()}.tmp")
    Image.fromarray(res, "RGBA").save(tmp, format="PNG")
    os.replace(tmp, out)
    return out, mode


class ImageLogo:
    """A PNG logo cropped to its alpha bbox (+ 2 % pad) so that the visible ink is the box. `kind` 'image' is tinted with the
    bone token; 'picture' (an opaque photograph: the _fastfetch slot) is only cropped to its frame, never tinted; 'engraving' is
    a baked luminance -> alpha picture (bake_engraving), tinted with the bone token like 'image' and sharpened at the placed size."""

    def __init__(self, path, light_path=None, kind="image", name="image", engrave=False):
        from PIL import Image
        import numpy as np
        self.kind, self.path, self.light_path, self.name = kind, Path(path), (Path(light_path) if light_path else None), name
        self.engrave = engrave
        with Image.open(self.path) as im:
            im.load()
            rgba = im.convert("RGBA")
        a = np.asarray(rgba)[..., 3]
        if kind == "picture" and a.min() >= 250:
            box = (0, 0, rgba.width, rgba.height)
        else:
            box = alpha_bbox(a)
        if box is None:
            raise ValueError("the picture has no visible ink")
        x0, y0, x1, y1 = box
        padx, pady = max(1, round(0.02 * (x1 - x0))), max(1, round(0.02 * (y1 - y0)))
        self.box = (max(0, x0 - padx), max(0, y0 - pady), min(rgba.width, x1 + padx), min(rgba.height, y1 + pady))
        self.iw, self.ih = self.box[2] - self.box[0], self.box[3] - self.box[1]
        self.sig = f"{self.path}|{self.path.stat().st_mtime_ns}|{self.path.stat().st_size}"
        self.lw = self.lh = 0

    def size(self, mh, cw, ch):
        if self.kind == "engraving":
            # the pair: the box is centred on the stats with no half-row bias, so (mh - lh) is even
            lh = max(1, min(MAX_LOGO_H, mh - 3))
            lh = max(1, lh - (mh - lh) % 2)
        else:
            lh = max(1, min(mh, MAX_LOGO_H))
        lw = max(1, round(lh * ch * (self.iw / self.ih) / cw))
        if lw > MAX_LOGO_W:
            lw = MAX_LOGO_W
            lh = max(1, round(lw * cw / (ch * (self.iw / self.ih))))
            if self.kind == "engraving":
                lh = max(1, lh - (mh - lh) % 2)
        self.lw, self.lh = lw, lh
        return lw, lh

    def png(self, lw, lh, cw, ch, colours, light_theme):
        """The tinted, cropped PNG for a box of lw x lh cells; cached. Corner pixels are transparent for tinted logos."""
        import numpy as np
        from PIL import Image
        bone, ink = colours["bone"], colours["ink"]
        variant = self.light_path if (light_theme and self.light_path and self.light_path.is_file()) else None
        sig = "|".join([self.sig, self.kind] + ([str(self.engrave)] if self.kind == "engraving" else []) + [str(variant.stat().st_mtime_ns) if variant else "-", bone, ink, f"{cw:.2f}x{ch:.2f}",
                        f"{lw}x{lh}", "light" if light_theme else "dark", str(GEN)])
        out = CACHE / f"logo-{hashlib.sha1(sig.encode()).hexdigest()[:12]}.png"
        if out.is_file():
            return out
        # The PNG is a canvas with the exact aspect of the cell box (lw*cw : lh*ch px); the picture is scaled to fit inside it
        # (aspect kept, never larger than the box, never upscaled past its source) and centred on transparent pixels, so the
        # terminal's scaling of the canvas to c x r cells cannot stretch it.
        bw, bh = max(1.0, lw * cw), max(1.0, lh * ch)
        fit = min(bw / self.iw, bh / self.ih)
        k = min(2.0, 1.0 / fit) if fit > 0 else 1.0
        canvas_w, canvas_h = max(8, round(bw * k)), max(8, round(bh * k))
        tw, th = max(1, min(canvas_w, round(self.iw * fit * k))), max(1, min(canvas_h, round(self.ih * fit * k)))

        def load(p):
            with Image.open(p) as im:
                return im.convert("RGBA").crop(self.box).resize((tw, th), Image.LANCZOS)

        def rgb(h):
            return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float64)
        if self.kind == "picture":
            res = load(self.path)
        elif self.kind == "engraving":
            src = load(self.path)
            alpha = np.asarray(src, np.float64)[..., 3] / 255.0
            alpha = np.clip(alpha + 0.6 * (alpha - _gblur(alpha, 1.0)), 0, 1)       # local contrast at the placed size
            if self.engrave:                                                           # a horizontal line screen: pitch 3 px, no greys
                pitch = 3.0
                yy = np.mgrid[0:th, 0:tw][0].astype(np.float64)
                dd = np.abs(((yy + 0.5) % pitch) - pitch / 2)
                alpha = np.clip((0.5 * pitch * np.clip(alpha * 1.15, 0, 1) - dd) / 0.6 + 0.5, 0, 1) * (alpha > 0.04)
            col = np.zeros((th, tw, 4), np.float64)
            col[..., :3] = rgb(bone)
            col[..., 3] = alpha * 255.0
            res = Image.fromarray(np.clip(np.round(col), 0, 255).astype(np.uint8), "RGBA")
        else:
            src = load(variant or self.path)
            alpha = np.asarray(src, np.float64)[..., 3] / 255.0
            if variant or not light_theme:
                col = np.zeros((th, tw, 4), np.float64)
                col[..., :3] = rgb(bone)
                col[..., 3] = alpha * 255.0
            else:
                col = pool_tint(alpha, bone, ink)
            col[0, :, 3] = col[-1, :, 3] = col[:, 0, 3] = col[:, -1, 3] = 0
            assert col[0, 0, 3] == 0 and col[-1, -1, 3] == 0
            res = Image.fromarray(np.clip(np.round(col), 0, 255).astype(np.uint8), "RGBA")
        canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
        canvas.paste(res, ((canvas_w - tw) // 2, (canvas_h - th) // 2))
        res = canvas
        CACHE.mkdir(parents=True, exist_ok=True)
        tmp = out.with_name(out.name + f".{os.getpid()}.tmp")
        res.save(tmp, format="PNG")
        os.replace(tmp, out)
        return out

    def braille(self, lw, lh, light_theme):
        """The same logo as braille text in the default foreground colour (any terminal), from the alpha at lw*2 x lh*4 dots."""
        import numpy as np
        from PIL import Image
        with Image.open(self.light_path if (light_theme and self.light_path and self.light_path.is_file()) else self.path) as im:
            a = im.convert("RGBA").crop(self.box).getchannel("A").resize((lw * 2, lh * 4), Image.LANCZOS)
        d = np.asarray(a) > 90
        bits = ((0, 0, 0x01), (0, 1, 0x02), (0, 2, 0x04), (1, 0, 0x08), (1, 1, 0x10), (1, 2, 0x20), (0, 3, 0x40), (1, 3, 0x80))
        rows = []
        for r in range(lh):
            cells = []
            for c in range(lw):
                v = 0
                for dx, dy, b in bits:
                    if d[r * 4 + dy, c * 2 + dx]:
                        v |= b
                cells.append(chr(0x2800 + v) if v else " ")
            rows.append("".join(cells).rstrip(" "))
        return rows


def pool_tint(alpha, bone, ink):
    """Light themes without a `.light.png`: the light ink sits in a dark pool (decisions-b9 4.1). Pool in `shade` (the darker of
    ink and bone), semi-axes 0.56 w x 0.58 h of the logo, t = 1 - smoothstep(0.70, 1.06, d), solid from 0.97, hatched A 45 deg
    spacing 5 px width 1 px below; the drawing in the lighter token. RGBA float 0..255."""
    import numpy as np
    sys.path.insert(0, os.environ.get("ITO_BIN_DIR", str(Path(__file__).resolve().parent)))
    import ito_ink as INK
    h, w = alpha.shape
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float64)
    d = np.sqrt(((xs - w / 2) / (0.56 * w)) ** 2 + ((ys - h / 2) / (0.58 * h)) ** 2)
    t = 1.0 - INK.smoothstep(0.70, 1.06, d)
    pool = np.where(t >= 0.97, 1.0, INK.hatch(xs, ys, 45, 5.0, 1.0, t, 0.05) * np.clip(t * 1.6, 0, 1))
    lum = lambda hx: 0.2126 * int(hx[1:3], 16) + 0.7152 * int(hx[3:5], 16) + 0.0722 * int(hx[5:7], 16)
    shade, lighter = (bone, ink) if lum(bone) < lum(ink) else (ink, bone)
    sh = np.array([int(shade[i:i + 2], 16) for i in (1, 3, 5)], np.float64)
    li = np.array([int(lighter[i:i + 2], 16) for i in (1, 3, 5)], np.float64)
    ra = alpha + pool * (1 - alpha)
    rgb = (li * alpha[..., None] + sh * (pool * (1 - alpha))[..., None]) / np.maximum(ra, 1e-6)[..., None]
    return np.dstack([rgb, ra * 255.0])


# ---- the plan -------------------------------------------------------------------------------------------------------

def block(mw, mh, logo, frame, cw, ch):
    """(W, H, lw, lh) of one step."""
    lw, lh = (logo.size(mh, cw, ch) if logo else (0, 0))
    gap = (GAP_ENGRAVING if (logo is not None and logo.kind == "engraving") else GAP) if lw else 0
    body_h = max(lh, mh)
    if frame:
        return 2 + (2 + lw + gap + mw + 2), body_h + 4, lw, lh
    return lw + gap + mw, body_h, lw, lh


def plan(cols, rows, cw, ch, full, compact, logo, frame, centre):
    """The placement, in cells of the real grid. full/compact are (mw, mh). Ladder (A.3.6): full, no logo, no frame, compact modules,
    cut. Returns a dict with the rule, W, H, x0, y0, the margins L R T B and what to draw."""
    steps = []
    if logo is not None:
        steps.append(("full", full, logo, frame))
        steps.append(("nologo", full, None, frame))
    else:
        steps.append(("full", full, None, frame))
    if frame:
        steps.append(("noframe", full, None, False))
    steps.append(("compact", compact, None, False))
    chosen = None
    for rule, dim, lg, fr in steps:
        mw, mh = dim() if callable(dim) else dim
        W, H, lw, lh = block(mw, mh, lg, fr, cw, ch)
        if cols >= W and (rows >= H or not centre):
            chosen = (rule, mw, mh, lg, fr, W, H, lw, lh, False)
            break
    if chosen is None:
        rule, dim, lg, fr = steps[-1]
        mw, mh = dim() if callable(dim) else dim
        W, H, lw, lh = block(mw, mh, lg, fr, cw, ch)
        chosen = ("cut", mw, mh, lg, fr, W, H, lw, lh, True)
    rule, mw, mh, lg, fr, W, H, lw, lh, cut = chosen
    Wd, Hd = min(W, cols), (min(H, rows) if centre else H)
    x0 = max(0, (cols - Wd) // 2)
    y0 = max(0, (rows - Hd) // 2) if centre else 0
    body_h = max(lh, mh)
    return {"rule": rule, "mw": mw, "mh": mh, "logo": lg, "frame": fr, "W": Wd, "H": H, "lw": lw, "lh": lh, "cut": cut,
            "x0": x0, "y0": y0, "L": x0, "R": cols - (x0 + Wd), "T": y0 if centre else None,
            "B": (rows - (y0 + Hd)) if centre else None, "body_h": body_h,
            "kind": (lg.kind if lg else "none")}


def compose(p, lines, cols, rows, title, kitty, png=None, light_theme=False, centre=False):
    """The output for a plan: a dict {y: [(x, text)]} of rows relative to the block (y = 0 is the top rule or the first body row),
    plus the kitty placement (y, x, lw, lh, path) when there is one."""
    x0, W, H, fr = p["x0"], p["W"], p["H"], p["frame"]
    lg, lw, lh, mh, body_h = p["logo"], p["lw"], p["lh"], p["mh"], p["body_h"]
    segs = {y: [] for y in range(H)}
    off_y = 2 if fr else 0
    off_x = 3 if fr else 0                          # the frame side + 2 cells of padding
    if fr:
        segs[0].append((0, frame_top(W, title)))
        segs[H - 1].append((0, frame_bottom(W)))
        for y in range(1, H - 1):
            segs[y].append((0, SIDE))
            segs[y].append((W - 1, SIDE))
    place = None
    if lg is not None:
        ly = off_y + (body_h - lh) // 2
        if kitty and lg.kind in ("image", "picture", "engraving") and png is not None:
            place = (ly, off_x, lw, lh, str(png))
        else:
            rows_ = lg.braille(lw, lh, light_theme) if lg.kind in ("image", "picture", "engraving") else lg.lines()
            for i, r in enumerate(rows_):
                if r.strip():
                    segs[ly + i].append((off_x, r))
    gap = GAP_ENGRAVING if (lg is not None and lg.kind == "engraving") else GAP
    mx = off_x + (lw + gap if lw else 0)
    my = off_y + (body_h - mh) // 2
    room = max(0, cols - x0 - mx - (3 if fr else 0)) if p["cut"] else None
    for i, line in enumerate(lines[:mh]):
        segs[my + i].append((mx, fit_ansi(line, room) if room is not None else line))
    return segs, place


def render(p, segs, place, centre, rows, kitty, alt=False, reserve=False):
    """The bytes to write. centre: absolute rows with CUP after a clear of the VISIBLE screen (no scrollback wipe: no ESC[3J); else relative
    rows with CHA from the cursor, after reserving the block's rows so that an image never hangs below the screen. alt: the caller is on the
    alternate screen (About), where the cursor is parked out of the way and nothing is left behind."""
    x0, y0, H = p["x0"], p["y0"], p["H"]
    out = []
    apc = ""
    if place:
        ly, lx, lw, lh, path = place
        apc = "\x1b_Ga=T,f=100,t=f,c=%d,r=%d,C=1,q=2;%s\x1b\\" % (lw, lh, base64.b64encode(path.encode()).decode())
    if centre:
        out.append(("\x1b_Ga=d,d=A,q=2\x1b\\" if kitty else "") + "\x1b[0m\x1b[2J\x1b[H")
    elif H > 1 and reserve:
        out.append("\n" * (H - 1) + "\x1b[%dA" % (H - 1))          # scroll first, then draw: an image placed lower than the screen would be cut
    for y in range(H):
        if centre and y0 + y >= rows:
            break
        items = sorted(segs[y], key=lambda s: s[0])
        row = []
        for x, text in items:
            row.append("\x1b[%d;%dH" % (y0 + y + 1, x0 + x + 1) if centre else "\x1b[%dG" % (x0 + x + 1))
            row.append(text)
        if apc and place and y == place[0]:
            row.insert(0, ("\x1b[%d;%dH" % (y0 + y + 1, x0 + place[1] + 1)) if centre else ("\x1b[%dG" % (x0 + place[1] + 1)))
            row.insert(1, apc)
        if centre:
            out.append("".join(row))
        else:
            out.append("\r" + "".join(row) + "\x1b[0m\n")
    if centre:
        # the cursor goes just below the block (the prompt follows it); on the alternate screen, to the last row
        end = rows if alt else min(rows, y0 + H + 1)
        out.append("\x1b[0m\x1b[%d;1H" % end)
        if not alt and y0 + H >= rows:
            out.append("\n")                                          # the block touches the bottom: leave a row for the prompt
    return "".join(out)

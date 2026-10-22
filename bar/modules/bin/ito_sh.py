#!/usr/bin/env python3
"""ito_sh -- the Silent Hill asset pack and the character / eye / beetle / symbol corrections of master-plan-v4 S17 (ports of lab/v12 sh12.py + chars.py).

Pure functions on numpy / Pillow: no file is read or written here (bin/ito-assets and scripts/gen-sh-pack.py do that). The user's pictures arrive through
`set_sources(sheet=, hp=, eye=, beetle=)`; nothing of theirs is ever stored in this module or in the repo. Every procedural piece is distressed by a grain
mask: the user's own (the high-pass of the sheet's street tile) when a sheet is given or `set_grain` was called, else a neutral seeded grain.
Layers are coverage maps {plate, mid, rust, dim, ink, glow, blood}; `to_rgba` encodes them as neutral grey tones (the shell's shader maps grey to the
bg..fg line, so `mid` is a real mid tone) and the one red of `blood` / `rust`. No hex anywhere: only grey levels and the recipe red (200,16,20).
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SERIF = "/usr/share/fonts/noto/NotoSerif-Bold.ttf"
MONO = "/usr/share/fonts/noto/NotoSansMono-CondensedBold.ttf"
MONOR = "/usr/share/fonts/noto/NotoSansMono-Regular.ttf"
CJK = "/usr/share/fonts/noto-cjk/NotoSerifCJK-Bold.ttc"
SS = 4
TIERS = (24, 26, 28, 30, 32, 36, 40, 44, 48, 56, 60, 64, 72, 80, 88, 96, 112, 120, 128)
PACK_PX = (24, 26, 28, 30, 32, 36, 40, 44, 48, 56, 64)
STATES = ("empty", "occupied", "active", "urgent")
SH_ALTS = ("flauros", "nurse", "torii", "fox", "lamp")      # the picker's replacements for a symbol (S17d)

# ---- sources (the user's pictures, set per call) -----------------------------------------------------------------------------------------
_SRC = {}
_CACHE = {}


def set_sources(sheet=None, hp=None, eye=None, beetle=None):
    """sheet = silenthillworspaces (1536x1024), hp = Heather pyramid (1536x1024), eye = bleeding-eye (105x103), beetle = (920x920). PIL images."""
    for k, v in (("S", sheet), ("HP", hp), ("BE", eye), ("BT", beetle)):
        if v is not None:
            _SRC[k] = v.convert("RGB")
    _CACHE.clear()


def _need(k, what):
    if k not in _SRC:
        raise ValueError(f"needs {what}")
    return _SRC[k]


def _SHEET(): return _need("S", "your Silent Hill sheet (silenthillworspaces, 1536x1024)")
def _HP(): return _need("HP", "your Heather / Pyramid sheet (Heather pyramid.png, 1536x1024)")


# ---- primitives (verbatim: lab def10.gblur / usm / disc, common.area / curve / figure_mask, s15c.lumf / redf) -----------------------------
def gblur(m, sig):
    if sig <= 0.05: return m.astype(np.float32)
    r = max(1, int(3 * sig + 0.5)); x = np.arange(-r, r + 1); k = np.exp(-x * x / (2 * sig * sig)); k /= k.sum()
    p = np.pad(m.astype(np.float32), r, mode="reflect")
    h = sum(k[i] * p[:, i:i + p.shape[1] - 2 * r] for i in range(2 * r + 1))
    return sum(k[i] * h[i:i + h.shape[0] - 2 * r, :] for i in range(2 * r + 1))


def usm(m, sig, amt): return m + amt * (m - gblur(m, sig))


def area(m, W, H=None):
    H = H or W
    return np.asarray(Image.fromarray((np.clip(m, 0, 1) * 65535).astype(np.uint16).astype(np.int32), "I").resize((W, H), Image.BOX), np.float32) / 65535


def curve(a, lo, hi):
    t = np.clip((a - lo) / max(1e-3, hi - lo), 0, 1); return t * t * (3 - 2 * t)


def rgbf(im): return np.asarray(im.convert("RGB"), np.float32) / 255
def lumf(a): return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
def redf(a): return np.clip((a[..., 0] - (a[..., 1] + a[..., 2]) / 2 - 0.16) / 0.30, 0, 1)


def figure_mask(L, seal=4, thr=0.6):
    dark = (L < thr).astype(np.uint8) * 255
    sealed = np.asarray(Image.fromarray(dark).filter(ImageFilter.MaxFilter(2 * seal + 1)))
    paper = np.where(sealed > 0, 0, 255).astype(np.uint8)
    img = Image.fromarray(np.pad(paper, 2, constant_values=255)).copy()
    ImageDraw.floodfill(img, (0, 0), 128, thresh=0)
    outside = np.asarray(img)[2:-2, 2:-2] == 128
    o = np.asarray(Image.fromarray((outside * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * seal - 1))) > 0
    return ~o


# ---- the grain: the user's (sheet street tile high-pass), else the baked one (set_grain), else a neutral seeded one -------------------------
def _mirror(hp):
    hp = np.concatenate([hp, hp[:, ::-1]], 1)
    return np.clip(np.concatenate([hp, hp[::-1, :]], 1), 0, 1)        # 240 x 480 (verbatim: the second join is on axis 1)


def grunge_from_sheet(sheet):
    t = rgbf(sheet.convert("RGB").crop((1096, 681, 1216, 921))); L = lumf(t)
    hp = np.abs(L - gblur(L, 3.0)); hp = hp / np.percentile(hp, 99.0)
    return _mirror(hp)


def grunge_neutral():
    L = gblur(np.random.default_rng(1729).random((240, 120)).astype(np.float32), 0.8)
    hp = np.abs(L - gblur(L, 3.0)); hp = hp / np.percentile(hp, 99.0)
    return _mirror(hp)


def set_grain(arr): _SRC["GRAIN"] = np.asarray(arr, np.float32); _CACHE.pop("GR", None)


def GR():
    if "GR" not in _CACHE:
        if "S" in _SRC: g = grunge_from_sheet(_SRC["S"])
        elif "GRAIN" in _SRC: g = _SRC["GRAIN"]
        else: g = grunge_neutral()
        _CACHE["GR"] = g
    return _CACHE["GR"]


def grain(W, H, seed=0, scale=1.0):
    GRn = GR()
    g = GRn if scale == 1.0 else area(GRn, max(8, int(GRn.shape[1] * scale)), max(8, int(GRn.shape[0] * scale)))
    reps = (H // g.shape[0] + 2, W // g.shape[1] + 2)
    big = np.block([[g if (i + j) % 2 == 0 else g[::-1, ::-1] for j in range(reps[1])] for i in range(reps[0])])
    oy, ox = (seed * 37) % g.shape[0], (seed * 91) % g.shape[1]
    return big[oy:oy + H, ox:ox + W]


# ---- encoding: layer coverage -> RGBA (straight alpha) ----------------------------------------------------------------------------------
ORDER = ("plate", "mid", "rust", "dim", "ink", "glow", "blood")
# (r, g, b, alpha factor). Grey = the token's place on the bg..fg line (plate .10 = grey 40 at half alpha so it is never an opaque black).
TONES = {"plate": (40, 40, 40, 0.5), "mid": (60, 60, 60, 1.0), "rust": (120, 14, 18, 1.0), "dim": (84, 84, 84, 1.0),
         "ink": (200, 200, 200, 1.0), "glow": (200, 200, 200, 1.0), "blood": (200, 16, 20, 1.0)}


def to_rgba(L):
    """layers -> PIL RGBA: the layers composited in ORDER (premultiplied 'over'), exactly what the lab's `paint` does onto the theme's ground."""
    k0 = next(iter(L)); h, w = L[k0].shape; acc = np.zeros((h, w, 3), np.float32); al = np.zeros((h, w), np.float32)
    for k in ORDER:
        if k not in L: continue
        r, g, b, f = TONES[k]; a = np.clip(L[k], 0, 1) * f; col = np.array([r, g, b], np.float32) / 255
        acc = col * a[..., None] + acc * (1 - a[..., None]); al = a + al * (1 - a)
    rgb = np.where(al[..., None] > 1e-4, acc / np.maximum(al[..., None], 1e-4), 0)
    return Image.fromarray((np.clip(np.dstack([rgb, al]), 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")


def square(L, px):
    """a W x H layer set centred on a px x px tile (bar files are exactly square)."""
    o = {}
    for k, v in L.items():
        z = np.zeros((px, px), np.float32); h, w = v.shape; sy, sx = max(0, (h - px) // 2), max(0, (w - px) // 2)      # a wider piece is cut at its centre
        v = v[sy:sy + px, sx:sx + px]; h, w = v.shape; y0, x0 = (px - h) // 2, (px - w) // 2; z[y0:y0 + h, x0:x0 + w] = v; o[k] = z
    return o


class Pad:
    """supersampled drawing pad: layers drawn at SS x, returned area-resampled to W x H device px."""
    def __init__(s, W, H, ss=SS):
        s.W, s.H, s.s = W, H, ss; s.im = {}; s.d = {}

    def D(s, k):
        if k not in s.im: s.im[k] = Image.new("L", (s.W * s.s, s.H * s.s), 0); s.d[k] = ImageDraw.Draw(s.im[k])
        return s.d[k]

    def p(s, *xy): return [v * s.s for v in xy]

    def out(s):
        return {k: np.asarray(v.resize((s.W, s.H), Image.BOX), np.float32) / 255 for k, v in s.im.items()}


def font(path, size, ss=SS): return ImageFont.truetype(path, max(4, int(size * ss)))


def mx(a, b):
    o = dict(a)
    for k, v in b.items(): o[k] = np.maximum(o[k], v) if k in o else v
    return o


def distress(m, seed=0, k=0.55, scale=1.0):
    """erode a mask with the user's grain: worn print, not a vector edge."""
    g = grain(m.shape[1], m.shape[0], seed, scale)
    return np.clip(m * (1 - k * curve(g, 0.25, 0.9)), 0, 1)


def edge_band(W, H, r, w):
    yy, xx = np.mgrid[0:H, 0:W] + 0.5
    dx = np.maximum(np.maximum(r - xx, xx - (W - r)), 0); dy = np.maximum(np.maximum(r - yy, yy - (H - r)), 0)
    d = r - np.hypot(dx, dy) + np.minimum(np.minimum(xx, W - xx), np.minimum(yy, H - yy)) * 0  # inside distance (rounded)
    inside = np.minimum(np.minimum(xx, W - xx), np.minimum(yy, H - yy))
    return np.clip(1 - inside / w, 0, 1)


def rrect(W, H, r):
    p = Pad(W, H); p.D("m").rounded_rectangle(p.p(0, 0, W, H), radius=r * p.s, fill=255); return p.out()["m"]


def screw(p, x, y, r, ang=30, layer="ink"):
    d = p.D(layer); d.ellipse(p.p(x - r, y - r, x + r, y + r), outline=255, width=max(1, int(0.45 * p.s)))
    a = math.radians(ang); d.line(p.p(x - r * 0.7 * math.cos(a), y - r * 0.7 * math.sin(a), x + r * 0.7 * math.cos(a), y + r * 0.7 * math.sin(a)), fill=255, width=max(1, int(0.8 * p.s)))


def rust_plate(W, H, seed=1, screws=True, r=4, seep=True, plate_a=0.92):
    """P1 rusted metal plate: theme plate ground, corroded rim (rust), screws, seepage stains running down from the screws."""
    base = rrect(W, H, r)
    rim = edge_band(W, H, r, 3.0) * base
    g = grain(W, H, seed, 1.0)
    rust = np.clip(rim * (0.35 + 0.9 * g), 0, 1) * 0.85
    p = Pad(W, H)
    pts = [(5, 5), (W - 5, 5), (5, H - 5), (W - 5, H - 5)] if screws else []
    for i, (x, y) in enumerate(pts): screw(p, x, y, 2.1, 20 + 50 * i)
    o = p.out(); scr = o.get("ink", np.zeros((H, W), np.float32))
    if seep and screws:
        st = np.zeros((H, W), np.float32)
        for (x, y) in pts[:2]:
            xi = int(x); ln = int(H * (0.45 + 0.3 * ((seed + x) % 3) / 3))
            st[int(y) + 2:int(y) + 2 + ln, max(0, xi - 1):xi + 2] = np.linspace(0.9, 0, ln)[:, None][:len(st[int(y) + 2:int(y) + 2 + ln])]
        st = gblur(st, 0.9); rust = np.maximum(rust, distress(st, seed + 3, 0.4))
    speck = curve(grain(W, H, seed + 7, 0.8), 0.55, 1.0) * 0.10 * base
    return {"plate": base * plate_a, "rust": rust * base, "ink": np.maximum(scr * 0.75, speck)}


def room_plate(W, H, num="302", seed=2):
    """P1b stencilled room plate (S9 'room numbers'): the rust plate + stencil digits in ink, a struck digit in blood."""
    L = rust_plate(W, H, seed, screws=True, r=3, seep=False)
    p = Pad(W, H); f = font(MONO, H * 0.62); d = p.D("ink")
    bb = d.textbbox((0, 0), num, font=f); tw = bb[2] - bb[0]; th = bb[3] - bb[1]
    d.text(((W * p.s - tw) / 2 - bb[0], (H * p.s - th) / 2 - bb[1]), num, font=f, fill=255)
    # stencil bridges: cut a 1px horizontal gap through the middle
    o = p.out(); ink = o["ink"]; ink[int(H * 0.5):int(H * 0.5) + 1, :] *= 0.15
    L["ink"] = np.maximum(L["ink"], distress(ink, seed, 0.45)); return L


def grate(W, H, pitch=5, seed=3, w=0.9):
    """P2 rusted mesh / grate (Otherworld plate): diagonal lattice, rivet-free, distressed, rust blooms."""
    p = Pad(W, H); d = p.D("ink")
    for k in range(-H, W + H, pitch):
        d.line(p.p(k, 0, k + H, H), fill=255, width=max(1, int(w * p.s)))
        d.line(p.p(k + H, 0, k, H), fill=255, width=max(1, int(w * p.s)))
    m = p.out()["ink"]; g = grain(W, H, seed, 0.6)
    rust = curve(gblur(g, 2.5), 0.25, 0.55) * m
    return {"ink": distress(m, seed, 0.6) * 0.55, "rust": rust * 0.9}


def rivets(W, H, step=22, inset=3.5, r=1.1):
    p = Pad(W, H); d = p.D("ink")
    for x in np.arange(inset, W - inset + 0.1, step):
        for y in (inset, H - inset): d.ellipse(p.p(x - r, y - r, x + r, y + r), fill=255)
    return p.out()["ink"]


def crt(px, bars=3, nbars=4, seed=4, ch="3"):
    """P3 portable CRT (network): convex screen in a rounded box, two knobs, V antenna; signal bars inside, unlit bars hiss."""
    W = H = px; p = Pad(W, H); s = px / 28.0
    d = p.D("ink"); lw = max(1, int(max(1.0, 1.3 * s) * p.s))
    bx0, by0, bx1, by1 = 1.5 * s, 8 * s, W - 1.5 * s, H - 2.5 * s
    d.rounded_rectangle(p.p(bx0, by0, bx1, by1), radius=4 * s * p.s, outline=255, width=lw)
    sx0, sy0, sx1, sy1 = bx0 + 2.6 * s, by0 + 2.6 * s, bx1 - 7.5 * s, by1 - 2.6 * s
    d.rounded_rectangle(p.p(sx0, sy0, sx1, sy1), radius=3.2 * s * p.s, outline=255, width=max(1, int(0.9 * s * p.s)))
    for ky in (by0 + 5 * s, by0 + 11 * s):
        r = 1.5 * s; d.ellipse(p.p(bx1 - 4 * s - r, ky - r, bx1 - 4 * s + r, ky + r), outline=255, width=max(1, int(0.8 * s * p.s)))
    d.line(p.p(W / 2, by0, W / 2 - 6 * s, 1.0 * s), fill=255, width=lw); d.line(p.p(W / 2, by0, W / 2 + 5 * s, 1.5 * s), fill=255, width=lw)
    o = p.out(); ink = o["ink"]
    # bars inside the screen
    q = Pad(W, H); bw = (sx1 - sx0 - 2.4 * s) / nbars
    lit = np.zeros((H, W), np.float32); dead = np.zeros((H, W), np.float32)
    for i in range(nbars):
        x0 = sx0 + 1.2 * s + i * bw + 0.35 * bw * 0.5; x1 = x0 + bw * 0.62; y1 = sy1 - 1.4 * s; y0 = y1 - (sy1 - sy0 - 2.8 * s) * (i + 1) / nbars
        q.D("lit" if i < bars else "dead").rectangle(q.p(x0, y0, x1, y1), fill=255)
    qo = q.out(); lit = qo.get("lit", lit); dead = qo.get("dead", dead)
    rng = np.random.default_rng(seed); hiss = (rng.random((H, W)) < 0.45).astype(np.float32) * dead * 0.7
    screen = np.zeros((H, W), np.float32); screen[int(sy0):int(sy1), int(sx0):int(sx1)] = 1
    scan = np.ones((H, W), np.float32); scan[1::2] = 0.84                       # 16 % scanlines on the CRT screen only
    return {"plate": screen * 0.10 * rrect(W, H, 3), "ink": distress(ink, seed, 0.35) * 0.9 + 0 * lit,
            "glow": (lit * scan) * 0.95 + hiss}


def crt_drop(px, seed=5):
    L = crt(px, bars=0, seed=seed); p = Pad(px, px); s = px / 28.0
    p.D("blood").line(p.p(5 * s, px - 6 * s, px - 11 * s, 12 * s), fill=255, width=max(1, int(1.4 * s * p.s)))
    L["blood"] = p.out()["blood"]; return L


def wristband(W, H, code="PT 0302", sub="WARD 3 · 23:47", seed=6, drip=True):
    """P4 hospital wristband / patient tag (notification popup header): band with a punched snap, barcode ticks, printed code,
    the last digit running (ink drip)."""
    p = Pad(W, H); d = p.D("plate"); r = H / 2
    d.rounded_rectangle(p.p(0, 0, W, H), radius=r * p.s, fill=255)
    di = p.D("ink"); lw = max(1, int(0.8 * p.s))
    di.rounded_rectangle(p.p(0.5, 0.5, W - 0.5, H - 0.5), radius=r * p.s, outline=255, width=lw)
    cx = r + 1; di.ellipse(p.p(cx - H * 0.22, H / 2 - H * 0.22, cx + H * 0.22, H / 2 + H * 0.22), outline=255, width=lw)
    f = font(MONO, H * 0.50); fs = font(MONOR, H * 0.36)
    x = cx + H * 0.6; bb = di.textbbox((0, 0), code, font=f); di.text((x * p.s, (H * p.s - (bb[3] - bb[1])) / 2 - bb[1]), code, font=f, fill=255)
    tx = x + (bb[2] - bb[0]) / p.s + H * 0.5
    sb = di.textbbox((0, 0), sub, font=fs); p.D("dim").text((tx * p.s, (H * p.s - (sb[3] - sb[1])) / 2 - sb[1]), sub, font=fs, fill=255)
    bx = W - H * 2.6; rng = np.random.default_rng(seed)
    for i in range(14):
        ww = 0.5 + rng.random() * 1.1; di.rectangle(p.p(bx, H * 0.24, bx + ww, H * 0.76), fill=255); bx += ww + 0.6 + rng.random() * 0.9
    o = p.out(); ink = distress(o["ink"], seed, 0.35)
    blood = np.zeros_like(ink)
    if drip:                                                         # the code's last digit runs: a 1-px blood drip below the band
        xd = int(x + (bb[2] - bb[0]) / p.s - 2)
        blood[int(H * 0.72):H, xd:xd + 1] = np.linspace(0.9, 0.3, H - int(H * 0.72))[:, None]
    return {"plate": o["plate"] * 0.55, "ink": ink, "dim": o.get("dim", 0 * ink) * 0.9, "blood": blood}


def tag_glyph(px, count=None, seed=7, hot=False):
    """P4b paper tag glyph (notifications bar): a luggage/toe tag tied with string, count stamped on it."""
    W = H = px; s = px / 28.0; p = Pad(W, H); d = p.D("ink"); lw = max(1, int(max(1.0, 1.25 * s) * p.s))
    pts = [(7 * s, 9 * s), (14 * s, 4 * s), (24 * s, 4 * s), (24 * s, 24 * s), (7 * s, 24 * s)]
    p.D("plate").polygon([tuple(p.p(*q)) for q in pts], fill=255)
    d.polygon([tuple(p.p(*q)) for q in pts], outline=255, width=lw)
    r = 1.8 * s; d.ellipse(p.p(13 * s - r, 9 * s - r, 13 * s + r, 9 * s + r), outline=255, width=max(1, int(0.9 * s * p.s)))
    d.line(p.p(13 * s, 9 * s, 3 * s, 2 * s), fill=255, width=max(1, int(0.8 * s * p.s)))          # the string
    if count is not None:
        f = font(MONO, 11 * s); lay = p.D("blood" if hot else "ink2"); t = str(count)
        bb = lay.textbbox((0, 0), t, font=f); lay.text(((16 * s * p.s) - (bb[2] - bb[0]) / 2 - bb[0], (17 * s * p.s) - (bb[3] - bb[1]) / 2 - bb[1]), t, font=f, fill=255)
    else:
        for yy in (14, 18): d.line(p.p(11 * s, yy * s, 21 * s, yy * s), fill=255, width=max(1, int(0.9 * s * p.s)))
    o = p.out(); ink = distress(o["ink"], seed, 0.30)
    if "ink2" in o: ink = np.maximum(ink * (1 - o["ink2"]), o["ink2"])
    return {"plate": o["plate"] * 0.45, "ink": ink, "blood": o.get("blood", 0 * ink)}


def iv_bag(px, level=0.6, charging=False, seed=8):
    """P5 IV / blood bag (power, mem): bag outline, fluid in blood = level, drip tube; <= 15 % the bag wrinkles; charging = a drop."""
    W = H = px; s = px / 28.0; p = Pad(W, H); d = p.D("ink"); lw = max(1, int(max(1.0, 1.25 * s) * p.s))
    x0, x1, y0, y1 = 7 * s, 21 * s, 3 * s, 20 * s
    bag = [(x0, y0 + 2 * s), (x0 + 2 * s, y0), (x1 - 2 * s, y0), (x1, y0 + 2 * s), (x1, y1 - 3 * s), (14 * s + 2.5 * s, y1), (14 * s - 2.5 * s, y1), (x0, y1 - 3 * s)]
    if level <= 0.15: bag = [(x + (0.8 * s if i % 2 else -0.6 * s), y) for i, (x, y) in enumerate(bag)]
    d.polygon([tuple(p.p(*q)) for q in bag], outline=255, width=lw)
    d.line(p.p(14 * s, y1, 14 * s, 26 * s), fill=255, width=max(1, int(0.9 * s * p.s)))
    r = 1.3 * s; d.ellipse(p.p(14 * s - r, y0 - 1.6 * s - r, 14 * s + r, y0 - 1.6 * s + r), outline=255, width=max(1, int(0.8 * s * p.s)))
    for k in range(3): d.line(p.p(x1 - 3.2 * s, y0 + (4 + 3 * k) * s, x1 - 1.4 * s, y0 + (4 + 3 * k) * s), fill=255, width=max(1, int(0.7 * s * p.s)))
    fl = p.D("blood"); top = y1 - 1.0 * s - (y1 - y0 - 2.5 * s) * level
    fl.polygon([tuple(p.p(*q)) for q in bag], fill=255)
    o = p.out(); m = np.zeros((H, W), np.float32); m[int(top * 1):, :] = 1
    yy = np.arange(H)[:, None] + 0.5; m = np.clip(yy - top, 0, 1) * np.ones((1, W))
    blood = o["blood"] * m
    inner = rrect(W, H, 1) * 0
    if charging:
        q = Pad(W, H); q.D("b").ellipse(q.p(14 * s - 1.2 * s, 22.5 * s, 14 * s + 1.2 * s, 25 * s), fill=255); blood = np.maximum(blood, q.out()["b"])
    return {"ink": distress(o["ink"], seed, 0.3), "blood": blood * (0.95 if level > 0.15 else 0.75), "rust": o["blood"] * (1 - m) * 0.12}


def spiral_dial(px, frac=0.78, seed=9, ticks=12, hot=False):
    """P6 closing spiral (clock / date / loading): broken outer ring with 12 ticks (the roundel's tick language), a 2.25-turn arm
    winding inward whose drawn length = frac (minute/60), ghost for the rest; centre eye. Blood when hot (>= .85 or the hour)."""
    W = H = px; p = Pad(W, H); c = px / 2; R = px * 0.44
    d = p.D("ink"); lw = max(1, int(max(1.0, px * 0.045) * p.s))
    for a0 in range(0, 360, 90): d.arc(p.p(c - R, c - R, c + R, c + R), a0 + 8, a0 + 82, fill=255, width=max(1, int(max(0.8, px * 0.03) * p.s)))
    for k in range(ticks):
        a = math.radians(k * 360 / ticks - 90); r0, r1 = R * (0.86 if k % 3 else 0.78), R * 1.0
        d.line(p.p(c + r0 * math.cos(a), c + r0 * math.sin(a), c + r1 * math.cos(a), c + r1 * math.sin(a)), fill=255, width=max(1, int(max(0.8, px * 0.03) * p.s)))
    turns = 2.25; n = 260; pts = []
    for i in range(n + 1):
        t = i / n; th = -math.pi / 2 + t * turns * 2 * math.pi; rr = R * 0.74 * (1 - t) + R * 0.08 * t
        pts.append((c + rr * math.cos(th), c + rr * math.sin(th)))
    cut = int(n * frac)
    p.D("ghost").line([tuple(p.p(*q)) for q in pts], fill=255, width=max(1, int(max(0.8, px * 0.03) * p.s)))
    p.D("blood" if hot else "arm").line([tuple(p.p(*q)) for q in pts[:max(2, cut)]], fill=255, width=lw, joint="curve")
    r = max(1.2, px * 0.06); p.D("blood").ellipse(p.p(c - r, c - r, c + r, c + r), fill=255)
    o = p.out(); ink = distress(np.maximum(o["ink"] * 0.8, o.get("arm", 0 * o["ink"])), seed, 0.3)
    return {"ink": np.maximum(ink, o["ghost"] * 0.18), "blood": o.get("blood", 0 * ink)}


def lily(W, H, cx, cy, r, seed=10, ang=0.0):
    """P7 red spider lily (higanbana), side view: a head of 6 petals curling BACK (down) and ~12 long stamens arcing UP and out
    like a firework; never a radial pinwheel. Returns the blood map."""
    p = Pad(W, H); d = p.D("b"); rng = np.random.default_rng(seed)
    for k in range(12):                                            # stamens: up and out, tips curl outward
        a = math.radians(-165 + k * (150 / 11) + rng.normal(0, 3)); L_ = r * (0.85 + 0.25 * rng.random()); pts = []
        for i in range(18):
            t = i / 17; rr = L_ * t; aa = a + (0.35 if math.cos(a) > 0 else -0.35) * t * t
            pts.append((cx + rr * math.cos(aa), cy + rr * math.sin(aa) * 0.85))
        d.line([tuple(p.p(*q)) for q in pts], fill=255, width=max(1, int(max(0.55, r * 0.03) * p.s)), joint="curve")
        q = pts[-1]; e = max(0.5, r * 0.035); d.ellipse(p.p(q[0] - e, q[1] - e, q[0] + e, q[1] + e), fill=255)
    for k in range(6):                                             # petals: narrow, out then curling down/back
        a = math.radians(-180 + k * 36 + rng.normal(0, 4)); pts = []
        for i in range(12):
            t = i / 11; rr = r * 0.42 * t; aa = a
            pts.append((cx + rr * math.cos(aa), cy + rr * math.sin(aa) * 0.6 + r * 0.30 * t * t))
        d.line([tuple(p.p(*q)) for q in pts], fill=255, width=max(1, int(r * 0.09 * p.s)), joint="curve")
    d.ellipse(p.p(cx - r * 0.08, cy - r * 0.06, cx + r * 0.08, cy + r * 0.1), fill=255)
    d.line(p.p(cx, cy + r * 0.1, cx + r * 0.05, cy + r * 1.2), fill=255, width=max(1, int(max(0.8, r * 0.05) * p.s)))   # stem
    return p.out()["b"]


def chain(W, H, link=9, seed=12, wire=False):
    """P8 chain (tray) along a horizontal line; wire=True -> barbed wire (two twisted strands + barbs every 14 px)."""
    p = Pad(W, H); d = p.D("ink"); cy = H / 2; lw = max(1, int(1.1 * p.s))
    if not wire:
        x = 1.0; i = 0
        while x < W:
            if i % 2 == 0: d.ellipse(p.p(x, cy - link * 0.34, x + link, cy + link * 0.34), outline=255, width=lw)
            else: d.line(p.p(x - link * 0.15, cy, x + link * 1.15, cy), fill=255, width=max(1, int(1.6 * p.s)))
            x += link * 0.78; i += 1
    else:
        for ph in (0, math.pi):
            pts = [(x, cy + 1.2 * math.sin(x / 3.0 + ph)) for x in np.arange(0, W + 1, 0.5)]
            d.line([tuple(p.p(*q)) for q in pts], fill=255, width=max(1, int(0.8 * p.s)))
        for x in np.arange(6, W, 14):
            d.line(p.p(x - 2.5, cy - 3, x + 2.5, cy + 3), fill=255, width=max(1, int(0.8 * p.s)))
            d.line(p.p(x + 2.5, cy - 3, x - 2.5, cy + 3), fill=255, width=max(1, int(0.8 * p.s)))
    return distress(p.out()["ink"], seed, 0.35)


def chain_glyph(px, seed=13):
    """tray toggle glyph: three links hanging diagonally + a shackle."""
    W = H = px; s = px / 28.0; p = Pad(W, H); d = p.D("ink"); lw = max(1, int(max(1.0, 1.3 * s) * p.s))
    for i in range(3):
        cx, cy = (7 + i * 6.5) * s, (7 + i * 6.5) * s
        if i % 2 == 0: d.ellipse(p.p(cx - 4.2 * s, cy - 2.4 * s, cx + 4.2 * s, cy + 2.4 * s), outline=255, width=lw)
        else: d.ellipse(p.p(cx - 2.4 * s, cy - 4.2 * s, cx + 2.4 * s, cy + 4.2 * s), outline=255, width=lw)
    r = 3 * s; p.D("blood").arc(p.p(22 * s - r, 22 * s - r, 22 * s + r, 22 * s + r), 200, 520, fill=255, width=lw)
    o = p.out(); return {"ink": distress(o["ink"], seed, 0.3), "blood": o["blood"]}


def paper_seal(W, H, text="封", sub="No. 0302", seed=14):
    """P9 worn paper label / seal: torn edges, a stamped blood ring with a kanji, mono text whose ink runs downward."""
    rng = np.random.default_rng(seed); p = Pad(W, H)
    top = [(x, 1.5 + rng.random() * 1.6) for x in np.arange(0, W + 1, 3)]; bot = [(x, H - 1.5 - rng.random() * 2.2) for x in np.arange(W, -1, -3)]
    p.D("plate").polygon([tuple(p.p(*q)) for q in top + bot], fill=255)
    r = H * 0.34; cx = H * 0.55; cy = H / 2
    p.D("blood").ellipse(p.p(cx - r, cy - r, cx + r, cy + r), outline=255, width=max(1, int(1.2 * p.s)))
    f = font(CJK, r * 1.25); bb = p.D("blood").textbbox((0, 0), text, font=f)
    p.D("blood").text((cx * p.s - (bb[2] - bb[0]) / 2 - bb[0], cy * p.s - (bb[3] - bb[1]) / 2 - bb[1]), text, font=f, fill=255)
    fs = font(MONO, H * 0.30); di = p.D("ink2"); sb = di.textbbox((0, 0), sub, font=fs)
    di.text(((cx + r + 4) * p.s, cy * p.s - (sb[3] - sb[1]) / 2 - sb[1]), sub, font=fs, fill=255)
    o = p.out(); txt = o["ink2"]
    run = np.zeros_like(txt)                                          # running ink: the text smeared downward, fading
    for k in range(1, 6): run[k:] = np.maximum(run[k:], txt[:-k] * (0.55 - 0.09 * k))
    run = run * curve(grain(W, H, seed, 1.0), 0.3, 0.7)
    edge = edge_band(W, H, 1, 2.5) * o["plate"]
    return {"plate": o["plate"] * 0.75, "rust": edge * 0.6 * curve(grain(W, H, seed + 2), 0.2, 0.8),
            "ink": np.maximum(distress(txt, seed, 0.25), run), "blood": distress(o["blood"], seed + 1, 0.55) * 0.9}


def torii(px, seed=15):
    """P10a torii pictogram (shrine silhouette, pattern / small mark only)."""
    W = H = px; s = px / 28.0; p = Pad(W, H); d = p.D("ink")
    d.polygon([tuple(p.p(*q)) for q in [(2 * s, 6 * s), (26 * s, 6 * s), (24 * s, 9 * s), (4 * s, 9 * s)]], fill=255)
    d.rectangle(p.p(5 * s, 12 * s, 23 * s, 14 * s), fill=255)
    for x in (8 * s, 20 * s): d.polygon([tuple(p.p(*q)) for q in [(x - 1.3 * s, 9 * s), (x + 1.3 * s, 9 * s), (x + 1.7 * s, 26 * s), (x - 1.7 * s, 26 * s)]], fill=255)
    return {"ink": distress(p.out()["ink"], seed, 0.35)}


def fox_mask(px, seed=16):
    """P10b kitsune mask silhouette: ears, narrow eyes, blood markings."""
    W = H = px; s = px / 28.0; p = Pad(W, H); d = p.D("ink"); lw = max(1, int(max(1.0, 1.2 * s) * p.s))
    out = [(14 * s, 25 * s), (8 * s, 18 * s), (5 * s, 10 * s), (6 * s, 2.5 * s), (11 * s, 7 * s), (17 * s, 7 * s), (22 * s, 2.5 * s), (23 * s, 10 * s), (20 * s, 18 * s)]
    d.polygon([tuple(p.p(*q)) for q in out], outline=255, width=lw)
    for sx in (-1, 1):
        d.line(p.p(14 * s + sx * 2.5 * s, 13 * s, 14 * s + sx * 6.5 * s, 11 * s), fill=255, width=lw)
    b = p.D("blood")
    for sx in (-1, 1): b.line(p.p(14 * s + sx * 3 * s, 16 * s, 14 * s + sx * 6 * s, 18 * s), fill=255, width=lw)
    b.line(p.p(14 * s, 8.5 * s, 14 * s, 11 * s), fill=255, width=lw)
    o = p.out(); return {"ink": distress(o["ink"], seed, 0.3), "blood": o["blood"]}


def street_map(W, H, seed=17):
    """P11 schematic map (CC / lock header ground): street grid, struck street names, arrows, coordinates that do not quite fit."""
    rng = np.random.default_rng(seed); p = Pad(W, H); d = p.D("ink"); lw = max(1, int(0.8 * p.s))
    xs = np.cumsum(rng.integers(38, 70, 12)); ys = np.cumsum(rng.integers(26, 44, 8))
    for x in xs:
        if x < W: d.line(p.p(x + rng.integers(-6, 6), 0, x, H), fill=255, width=lw)
    for y in ys:
        if y < H: d.line(p.p(0, y, W, y + rng.integers(-5, 5)), fill=255, width=lw)
    f = font(MONO, 7); names = ["LAKE RD", "BRIDGE ST", "SCHOOL", "HOSPITAL", "N. CHURCH", "RIVER AVE"]
    st = p.D("blood")
    for i, nm in enumerate(names):
        x, y = int(xs[i % len(xs)] % (W - 60)) + 4, int(ys[i % len(ys)] % (H - 12)) + 2
        bb = d.textbbox((0, 0), nm, font=f); d.text((x * p.s, y * p.s), nm, font=f, fill=255)
        if i % 2 == 0: st.line(((x - 1) * p.s, y * p.s + (bb[3]) * 0.55, x * p.s + bb[2] + p.s, y * p.s + bb[3] * 0.55), fill=255, width=max(1, int(0.9 * p.s)))
    d.text(((W - 120) * p.s, (H - 11) * p.s), "34°12'N 117°03'W ?", font=f, fill=255)
    o = p.out(); return {"ink": distress(o["ink"], seed, 0.4) * 0.5, "blood": o["blood"] * 0.8}


RADIO_POLY = [(650, 718), (700, 708), (884, 766), (890, 906), (800, 914), (652, 866)]


def _poly_src(box, pts, f=3.0):
    m = Image.new("L", (box[2] - box[0], box[3] - box[1]), 0); ImageDraw.Draw(m).polygon([(x - box[0], y - box[1]) for x, y in pts], fill=255)
    return gblur(np.asarray(m, np.float32) / 255, f)


def _crop_layers(box, W, H, lv=(0.12, 0.75), red=True, k_usm=0.8, mask=None, light=False, poly=None):
    t = rgbf(_SHEET().crop(box)); L = lumf(t); R = redf(t) if red else 0 * L
    if poly is not None: P = _poly_src(box, poly); L = L * P; R = R * P
    L = np.clip(usm(L, 0.8 * t.shape[1] / W, k_usm), 0, 1)
    a = np.clip((L - lv[0]) / (lv[1] - lv[0]), 0, 1)
    i, b = area(a * (1 - R), W, H), area(R, W, H)
    if W < 48: i = curve(i, 0.18, 0.75)
    if mask is not None: i, b = i * mask, b * mask
    return {"ink": i, "blood": curve(b, 0.1, 0.5)}


RADIO = (652, 700, 890, 905)


def radio(px, vol=None, muted=False):
    """U1 radio (audio): the user's radio crop; >= 40 the art + the volume needle over its dial strip; < 40 the S15c radio
    pictogram (honest: the crop is noise below 40) with the needle on a half-moon scale."""
    W = int(px * (RADIO[2] - RADIO[0]) / (RADIO[3] - RADIO[1])) if px >= 40 else px; H = px
    if px >= 40:
        L = _crop_layers(RADIO, W, H, lv=(0.12, 0.66), k_usm=0.45, poly=RADIO_POLY)
        if vol is not None:                                               # needle on the dial strip (S 692..818 x, 757..825 y)
            p = Pad(W, H); sx = W / (RADIO[2] - RADIO[0]); sy = H / (RADIO[3] - RADIO[1])
            x0, x1 = (700 - RADIO[0]) * sx, (812 - RADIO[0]) * sx; xn = x0 + (x1 - x0) * vol
            yb = (800 - RADIO[1]) * sy; yt = (770 - RADIO[1]) * sy
            p.D("blood").line(p.p(xn - (yb - yt) * 0.32, yb, xn, yt), fill=255, width=max(1, int(max(1.0, px * 0.018) * p.s)))
            L["blood"] = np.maximum(L["blood"] * 0.6, p.out()["blood"])
        return L
    s = px / 28.0; p = Pad(px, px); d = p.D("ink"); lw = max(1, int(max(1.0, 1.25 * s) * p.s))
    d.rounded_rectangle(p.p(2 * s, 9 * s, 26 * s, 25 * s), radius=2.5 * s * p.s, outline=255, width=lw)
    d.line(p.p(7 * s, 9 * s, 13 * s, 2 * s), fill=255, width=lw)
    for k in range(5): d.line(p.p((5 + 2.2 * k) * s, 12.5 * s, (5 + 2.2 * k) * s, 14.5 * s), fill=255, width=max(1, int(0.8 * s * p.s)))
    r = 4 * s; d.ellipse(p.p(19 * s - r, 19 * s - r, 19 * s + r, 19 * s + r), outline=255, width=lw)
    for yy in (18, 21): d.line(p.p(5 * s, yy * s, 12 * s, yy * s), fill=255, width=max(1, int(0.8 * s * p.s)))
    if vol is not None:
        xn = (5 + 9 * vol) * s; p.D("blood").line(p.p(xn, 11.5 * s, xn, 15.5 * s), fill=255, width=lw)
    if muted:
        p.D("blood").line(p.p(15 * s, 23 * s, 23 * s, 15 * s), fill=255, width=lw)
    o = p.out(); return {"ink": distress(o["ink"], 21, 0.3), "blood": o.get("blood", 0 * o["ink"])}


SIGN = (222, 722, 426, 892)


def sign_plate(W, light=False):
    """U2 'Welcome to Silent Hill' plate with its two lamps (lock / boot header, CC Presets card)."""
    H = int(W * (SIGN[3] - SIGN[1]) / (SIGN[2] - SIGN[0])); return _crop_layers(SIGN, W, H, lv=(0.14, 0.80), red=False)


def street_lamp(h, on=True, drawn=False):
    """U3 the street lamp + post (S 1180,728-1214,872) (nightlight / awake): on = the lamp's own glow kept (glow token), off = dim."""
    box = (1178, 728, 1216, 872); W = max(6, int(h * (box[2] - box[0]) / (box[3] - box[1])))
    if h < 40 or drawn:                                                   # honest: the crop is 8 px wide at 28; a drawn lamp post
        s = h / 28.0; W = h; p = Pad(W, h); d = p.D("ink"); lw = max(1, int(max(1.0, 1.4 * s) * p.s))
        d.line(p.p(12 * s, 27 * s, 12 * s, 5 * s), fill=255, width=lw); d.arc(p.p(12 * s, 3 * s, 20 * s, 11 * s), 180, 270, fill=255, width=lw)
        d.polygon([tuple(p.p(*q)) for q in [(17 * s, 6.5 * s), (22 * s, 6.5 * s), (20.5 * s, 9 * s), (18.5 * s, 9 * s)]], fill=255)
        o = p.out(); g = np.zeros((h, W), np.float32)
        if on:
            yy, xx = np.mgrid[0:h, 0:W]; g = np.clip(1 - np.hypot(xx - 19.5 * s, (yy - 12 * s) * 0.7) / (8 * s), 0, 1) ** 1.6 * 0.75
        return {"ink": distress(o["ink"], 22, 0.25) * (1 if on else 0.55), "glow": g * (1 - o["ink"])}
    L = _crop_layers(box, W, h, lv=(0.10, 0.65), red=False)
    if not on: L["ink"] *= 0.45
    return L


FOG_TILE = (1096, 681, 1336, 921)


def fog_field(W, H, seed=0):
    """U4 fog: the street tile's low-frequency luminance (the figure and the lamp removed by a strong blur), lifted, as alpha.
    Used: weather (fog density), the bar fog band (Silent Hill), the popup's bottom fog + 'breath'."""
    t = rgbf(_SHEET().crop(FOG_TILE)); L = gblur(lumf(t), 7.0); L = np.clip((L - 0.05) / 0.30, 0, 1)
    if W > H * 2:                                                   # a band: the tile's lower half stretched (fog lies low), mirrored once
        L = L[L.shape[0] // 3:]; L = np.concatenate([L, L[:, ::-1]], 1)
    return area(L, W, H)


def red_streaks(W, H, seed=0):
    """U5 the sheet's red streaks (occupied tiles, red channel): vertical rain of blood (Otherworld edges, ws urgent)."""
    t1 = rgbf(_SHEET().crop((1096, 21, 1336, 263))); t2 = rgbf(_SHEET().crop((1096, 354, 1336, 591)))
    R = np.concatenate([redf(t1)[:237], redf(t2)[:237]], 1)
    R = R * (gblur(R, 6.0) * 0 + 1)
    out = area(np.tile(R, (max(1, H // 237 + 1), max(1, W // 480 + 1)))[: max(H, 237), : max(W, 480)], W, H)
    return curve(out, 0.05, 0.45)


def roundel_ring(px, ticks=True):
    """U6 the roundel's red broken ring + crosshair ticks (Heather pyramid.png, heather roundel annulus 0.90-1.10 r) as a frame
    ornament: popup corner seal, CC header emblem, lock clock ring. The face inside is cut: only the ring language."""
    cx, cy, R = 395, 470, 278; R2 = int(R * 1.65)
    t = rgbf(_HP().crop((cx - R2, cy - R2, cx + R2, cy + R2))); Rd = redf(t); L = lumf(t)
    yy, xx = np.mgrid[0:t.shape[0], 0:t.shape[1]]; rr = np.hypot(xx - R2, yy - R2) / R
    ann = ((rr > 0.93) & (rr < 1.10)).astype(np.float32)
    tick = ((np.abs(xx - R2) < 10) & (rr > 0.93)).astype(np.float32) if ticks else 0 * ann
    ink = np.clip((L - 0.15) / 0.6, 0, 1) * ann * (1 - Rd)
    lo = 0.02 if px <= 48 else 0.05; hi = 0.18 if px <= 48 else 0.4               # small tiers: the thin red ring is lifted, not lost
    return {"ink": curve(area(ink, px, px), 0.0, 0.5 if px <= 48 else 1.0) * 0.8, "blood": curve(area(Rd * np.maximum(ann, tick), px, px), lo, hi)}


def fog_weather(px, density=0.7):
    """weather glyph: a cloud pictogram half under the user's fog field; density = humidity/visibility."""
    s = px / 28.0; p = Pad(px, px); d = p.D("ink"); lw = max(1, int(max(1.0, 1.3 * s) * p.s))
    d.arc(p.p(5 * s, 8 * s, 15 * s, 18 * s), 160, 300, fill=255, width=lw); d.arc(p.p(11 * s, 5 * s, 23 * s, 17 * s), 200, 360, fill=255, width=lw)
    d.line(p.p(5 * s, 15.5 * s, 23 * s, 15.5 * s), fill=255, width=lw)
    for k, yy in enumerate((19.5, 23)): d.line(p.p((4 + 2 * k) * s, yy * s, (24 - 3 * k) * s, yy * s), fill=255, width=max(1, int(0.9 * s * p.s)))
    o = p.out(); fog = fog_field(px, px) * density
    yy = (np.arange(px)[:, None] / px); fog = fog * np.clip((yy - 0.35) / 0.4, 0, 1)
    return {"ink": distress(o["ink"], 23, 0.3) * (1 - 0.6 * fog), "glow": fog * 0.55}


def _er(m, r): return np.asarray(Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(2 * r + 1)), np.float32) / 255


def _dl(m, r): return np.asarray(Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * r + 1)), np.float32) / 255


def poly_mask(shape, pts, ox, oy, feather=3.0):
    m = Image.new("L", (shape[1], shape[0]), 0); ImageDraw.Draw(m).polygon([(x - ox, y - oy) for x, y in pts], fill=255)
    return gblur(np.asarray(m, np.float32) / 255, feather)


def ell_mask(shape, cx, cy, rx, ry, ox, oy, feather=6.0):
    m = Image.new("L", (shape[1], shape[0]), 0); ImageDraw.Draw(m).ellipse((cx - rx - ox, cy - ry - oy, cx + rx - ox, cy + ry - oy), fill=255)
    return gblur(np.asarray(m, np.float32) / 255, feather)


def dered(t):
    """remove the art's red decoration (streaks, ring): red px take the grey of their non-red neighbourhood."""
    L = lumf(t); R = np.clip(redf(t) * 2.5, 0, 1); w = 1 - R
    fill = gblur(L * w, 4.0) / np.maximum(gblur(w, 4.0), 1e-3)
    return L * (1 - R) + fill * R


def rim_of(M):
    """1-px silhouette rim (device px) from a device-res mask."""
    hard = (M > 0.5).astype(np.float32); return np.clip(hard - _er(hard, 1), 0, 1)


HEATHER = dict(box=(186, 196, 646, 656), ell=(415, 430, 228, 236), lips=(532, 560, 26, 10))


PYR_HELM = [(1112, 126), (1182, 300), (1302, 438), (1292, 476), (1232, 482), (906, 684), (878, 656)]


PYR_SHOULDER = [(1150, 482), (1302, 470), (1334, 560), (1326, 706), (1150, 706)]


PYR = dict(micro=(808, 126, 1374, 692), full=(820, 120, 1380, 710))


def character(name, px, light=False, src="hp"):
    """the character itself: returns layers {ink, blood} at px x px."""
    if name == "heather":
        x0, y0, x1, y1 = HEATHER["box"]; t = rgbf(_HP().crop((x0, y0, x1, y1))); L = dered(t)
        cx, cy, rx, ry = HEATHER["ell"]; M = ell_mask(L.shape, cx, cy, rx, ry, x0, y0, 8.0)
        lx, ly, lrx, lry = HEATHER["lips"]; acc = ell_mask(L.shape, lx, ly, lrx, lry, x0, y0, 4.0) * np.clip((0.55 - L) / 0.3, 0, 1)
        lo, hi = (0.16, 0.78)
    else:
        x0, y0, x1, y1 = PYR["micro"] if px < 40 else PYR["full"]; t = rgbf(_HP().crop((x0, y0, x1, y1))); L = dered(t)
        M = poly_mask(L.shape, PYR_HELM, x0, y0, 2.0)
        if px >= 40: M = np.maximum(M, poly_mask(L.shape, PYR_SHOULDER, x0, y0, 4.0))
        acc = poly_mask(L.shape, PYR_HELM, x0, y0, 2.0) * curve(gblur(np.clip((0.28 - L) / 0.2, 0, 1), 3.0), 0.55, 0.9) * 0
        lo, hi = (0.06, 0.48)
    if light: M = M * curve(gblur(L, 6.0), 0.07, 0.18)        # positive print: the dark ground behind the figure stays clear
    k = L.shape[0] / px
    Ls = np.clip(usm(L, 0.7 * k, 0.9), 0, 1)
    if not light: a = np.clip((Ls - lo) / (hi - lo), 0, 1) ** 0.9
    else:         a = np.clip((hi + 0.12 - Ls) / (hi + 0.12 - lo), 0, 1) ** 1.1
    i = area(a * M, px); m = area(M, px); b = area(acc, px)
    i = np.clip(usm(i, 0.6, 0.55 if px < 40 else 0.35), 0, 1)
    if px < 40: i = curve(i, 0.14, 0.80)
    if name == "pyramid" and not light:                 # the helmet's silhouette: a 1-px rim + a mid-tone body
        i = np.maximum(i, np.maximum(rim_of(m) * 0.95, m * 0.22))
    if name == "pyramid" and light: i = np.maximum(i, np.maximum(rim_of(m) * 0.9, m * 0.30))
    b = curve(b, 0.15, 0.55) * (0.8 if px >= 32 else 0.0)
    return {"ink": i * (1 - b), "blood": b}


NUMERAL_OFF = [False]          # True while a recipe draws a picker preview (ws-<fam>-preview-<state>): no digit, no moat


class no_numeral:
    """`with no_numeral(): ...` -- every workspace numeral drawn inside is empty (the picker previews; the bar tiles keep theirs)."""
    def __enter__(self): NUMERAL_OFF[0] = True
    def __exit__(self, *a): NUMERAL_OFF[0] = False


PREVIEW_N, PREVIEW_STATE = 3, "active"


def previews(fam, fn, tiers=TIERS, light=True, conv=None, suffix=""):
    """the Control Centre picker's numeral-free card art of a workspace family: fn(n, state, px, light) drawn under no_numeral() for
    workspace 3, active, at every tier -> [(workspaces/bar/<px>/ws-<fam>-preview-active<suffix>[.light].png, image)]."""
    out = []
    with no_numeral():
        for px in tiers:
            for lt in ((False, True) if light else (False,)):
                im = fn(PREVIEW_N, PREVIEW_STATE, px, lt)
                out.append((f"workspaces/bar/{px}/ws-{fam}-preview-{PREVIEW_STATE}{suffix}{'.light' if lt else ''}.png", conv(im) if conv else im))
    return out


def numeral(n, px, h=None):
    """the numeral top-left (Noto Serif Bold, h = round(.30 px)), with a 1-px moat."""
    if NUMERAL_OFF[0]:
        z = np.zeros((px, px), np.float32)
        return z, z.copy()
    h = h or max(7, int(round(0.30 * px))); SS = 8
    m = Image.new("L", (px * SS, px * SS), 0); f = ImageFont.truetype(SERIF, int(h * SS * 1.36)); t = str(n)
    dr = ImageDraw.Draw(m); bb = dr.textbbox((0, 0), t, font=f)
    tmp = Image.new("L", (bb[2] - bb[0] + 4, bb[3] - bb[1] + 4), 0); ImageDraw.Draw(tmp).text((2 - bb[0], 2 - bb[1]), t, font=f, fill=255)
    tmp = tmp.resize((max(1, int(tmp.width * h * SS / tmp.height * (0.86 if n == 10 else 1))), int(h * SS)), Image.LANCZOS)
    m.paste(tmp, (0, 0)); d = curve(np.asarray(m.resize((px, px), Image.BOX), np.float32) / 255, 0.18, 0.62)
    return d, _dl(d, 1)


def state_dot(px, st):
    """the sheet's ○ ● ◐, bottom-right, r = clamp(0.08 px, 2, 3.2) (S15c's 0.10 px grew to a blob at 44-48)."""
    SS = 8; r = min(3.2, max(2.0, 0.08 * px)) * SS; cx = cy = px * SS - r - SS; st = "active" if st == "urgent" else st
    o = Image.new("L", (px * SS, px * SS), 0); f = Image.new("L", (px * SS, px * SS), 0)
    ImageDraw.Draw(o).ellipse((cx - r, cy - r, cx + r, cy + r), outline=255, width=SS)
    if st == "active": ImageDraw.Draw(f).ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
    if st == "occupied": ImageDraw.Draw(f).pieslice((cx - r, cy - r, cx + r, cy + r), 90, 270, fill=255)
    g = lambda im: np.asarray(im.resize((px, px), Image.BOX), np.float32) / 255
    return g(o), g(f)


def ws(layers, n, st, px, dot=True):
    """the sheet's state language without the ring: empty = 40 %, occupied = full + ◐, active = the blood accent + ●, urgent = blood."""
    z = np.zeros((px, px), np.float32); i, b = layers.get("ink", z), layers.get("blood", z)
    N, moat = numeral(n, px)
    o, f = state_dot(px, st) if dot else (0 * i, 0 * i)
    hole = _dl(np.maximum(o, f), 1) if dot else 0 * i
    i, b = i * (1 - moat) * (1 - hole), b * (1 - moat) * (1 - hole)
    if st == "empty":      ink, bl = np.maximum(np.maximum(i, b) * 0.42, np.maximum(N * 0.7, o * 0.6)), 0 * i
    elif st == "occupied": ink, bl = np.maximum(np.maximum(i, b), np.maximum(N, o)), f * 0.9
    elif st == "active":   ink, bl = np.maximum(i, o * 0), np.maximum(b, np.maximum(np.maximum(o, f), N))
    else:                  ink, bl = 0 * i, np.maximum(np.maximum(i, b), np.maximum(N, np.maximum(o, f)))
    return {"ink": ink * (1 - bl), "blood": bl}


def mayan(n, px, col="ink"):
    """the beetle family's Mayan numeral (dot = 1, bar = 5) under the beetle, whole px."""
    p = Pad(px, px); s = px / 28.0; d = p.D("m"); y = px - 2.2 * s; bars, dots = divmod(n, 5)
    if n == 0: d.ellipse(p.p(px / 2 - 2 * s, y - 1.2 * s, px / 2 + 2 * s, y + 1.2 * s), outline=255, width=max(1, int(s * p.s)))
    for b in range(bars): d.rectangle(p.p(px / 2 - 5 * s, y - 0.8 * s - b * 2.6 * s, px / 2 + 5 * s, y + 0.8 * s - b * 2.6 * s), fill=255)
    yd = y - bars * 2.6 * s; r = max(0.9, 1.05 * s)
    for i in range(dots): cx = px / 2 + (i - (dots - 1) / 2) * 3 * s; d.ellipse(p.p(cx - r, yd - r, cx + r, yd + r), fill=255)
    return p.out()["m"]


def G(px):
    s = px / 28.0; p = Pad(px, px); w = max(1.0, 1.35 * s); return s, p, w


def _ln(p, layer, pts, w, s): p.D(layer).line([tuple(p.p(x * s, y * s)) for x, y in pts], fill=255, width=max(1, int(w * p.s)), joint="curve")


def _pg(p, layer, pts, s, fill=255, outline=None, w=1): p.D(layer).polygon([tuple(p.p(x * s, y * s)) for x, y in pts], fill=fill, outline=outline, width=max(1, int(w * p.s)) if outline else 0)


def _el(p, layer, cx, cy, r, s, w=None, fill=False):
    box = p.p((cx - r) * s, (cy - r) * s, (cx + r) * s, (cy + r) * s)
    if fill: p.D(layer).ellipse(box, fill=255)
    else: p.D(layer).ellipse(box, outline=255, width=max(1, int(w * p.s)))


def sym(name, px):
    """micro glyph per symbol on a 28-unit grid (whole-px strokes at 24-32); blood = the symbol's own red, if it has one."""
    s, p, w = G(px)
    if name == "pyramid":            # SH2: the helmet + the Great Knife
        _pg(p, "ink", [(13, 2), (21, 15), (19, 17), (6, 22), (4.5, 20.5)], s)
        _ln(p, "blood", [(16, 18), (24, 27)], w * 1.5, s); _ln(p, "ink", [(14.5, 16.5), (16.5, 19)], w * 2.0, s)
    elif name == "flashlight":       # SH1-3: the pocket light pinned to the chest; the beam cone
        _pg(p, "ink", [(3, 11), (10, 11), (10, 17), (3, 17)], s); _pg(p, "ink", [(10, 10), (13, 8.5), (13, 19.5), (10, 18)], s)
        _ln(p, "ink", [(15, 9), (26, 4)], w * 0.8, s); _ln(p, "ink", [(15, 19), (26, 24)], w * 0.8, s); _ln(p, "ink", [(16, 14), (26, 14)], w * 0.6, s)
    elif name == "radio":            # SH1/SH2: the pocket radio (static = something near)
        _pg(p, "ink", [(4, 9), (20, 9), (20, 25), (4, 25)], s, fill=0, outline=255, w=w)
        for yy in (13, 16, 19, 22): _ln(p, "ink", [(7, yy), (13, yy)], w * 0.7, s)
        _el(p, "ink", 16.5, 19, 2, s, w * 0.8); _ln(p, "ink", [(18, 9), (22, 2)], w, s)
        for r in (4, 7): p.D("blood").arc(p.p((20 - r) * s, (13 - r) * s, (20 + r) * s, (13 + r) * s), 300, 360, fill=255, width=max(1, int(w * 0.8 * p.s)))
    elif name == "sign":             # 'Welcome to Silent Hill': the plate on two posts + its two lamps
        _pg(p, "ink", [(3, 9), (25, 9), (25, 19), (3, 19)], s, fill=0, outline=255, w=w)
        for x in (8, 20): _ln(p, "ink", [(x, 19), (x, 27)], w, s)
        for x in (8, 20): _ln(p, "ink", [(x, 9), (x, 5), (x + 2.5, 4)], w * 0.8, s); _el(p, "ink", x + 3, 5.2, 1.1, s, fill=True)
        for yy in (12.5, 15.5): _ln(p, "ink", [(6, yy), (22, yy)], w * 0.6, s)
    elif name == "halo":             # the Order's 'Halo of the Sun' (SH1/SH3): outer + inner circle, three small circles in the band
        _el(p, "blood", 14, 14, 12, s, w); _el(p, "blood", 14, 14, 5.2, s, w * 0.9)
        for a in (-90, 30, 150):
            r = 8.6; cx, cy = 14 + r * math.cos(math.radians(a)), 14 + r * math.sin(math.radians(a)); _el(p, "blood", cx, cy, 2.0, s, w * 0.8)
        _el(p, "blood", 14, 14, 1.4, s, fill=True)
    elif name == "redsquare":        # SH2/SH3 save point: the red square, drawn as a blood smear
        _pg(p, "blood", [(6, 6), (22, 6.5), (21.5, 22), (6.5, 21.5)], s)
        _ln(p, "blood", [(9, 22), (9, 26)], w * 0.8, s); _ln(p, "blood", [(17, 22), (17, 25)], w * 0.7, s)
    elif name == "siren":            # the air-raid siren that announces the Otherworld: horn on a pole + sound arcs
        _pg(p, "ink", [(6, 6), (14, 9), (14, 14), (6, 17)], s); _ln(p, "ink", [(10, 17), (10, 27)], w, s); _ln(p, "ink", [(6, 27), (14, 27)], w, s)
        for r in (4, 7.5): p.D("ink").arc(p.p((14 - r) * s, (11.5 - r) * s, (14 + r) * s, (11.5 + r) * s), 300, 420, fill=255, width=max(1, int(w * 0.8 * p.s)))
    elif name == "lily":             # Silent Hill f: the red spider lily
        L = lily(px, px, px * 0.5, px * 0.52, px * 0.46, 3); p.D("blood"); o = p.out(); o["blood"] = np.maximum(o.get("blood", 0), L)
        _ = o; o["ink"] = np.zeros((px, px), np.float32); return o
    elif name == "crtv":             # Townfall: the portable CRTV
        return crt(px, 2)
    elif name == "heather":          # SH3: her bob + fringe over one eye (micro pictogram; the real crop is the default)
        _pg(p, "ink", [(7, 22), (6, 11), (9, 5), (15, 3), (21, 6), (23, 13), (22, 22), (19, 20), (19, 12), (15, 8), (11, 12), (10, 21)], s)
        _ln(p, "ink", [(11, 14), (14, 13)], w * 0.8, s); _el(p, "ink", 16.5, 16, 0.9, s, fill=True); _ln(p, "ink", [(14, 20.5), (17, 20.5)], w * 0.7, s)
        _ln(p, "ink", [(12, 23), (12, 27)], w, s); _ln(p, "ink", [(18, 23), (18, 27)], w, s)
    elif name == "lamp":             # the foggy street lamp
        _ln(p, "ink", [(11, 27), (11, 6), (13, 3.5), (18, 3.5)], w, s); _pg(p, "ink", [(16, 4), (21, 4), (20, 7), (17, 7)], s)
        for yy, x0 in ((20, 3), (23, 6), (26, 2)): _ln(p, "ink", [(x0, yy), (x0 + 20, yy)], w * 0.6, s)
    elif name == "flauros":          # SH1: Flauros, the pyramid that seals the god
        _pg(p, "ink", [(14, 3), (25, 22), (14, 26), (3, 22)], s, fill=0, outline=255, w=w); _ln(p, "ink", [(14, 3), (14, 26)], w * 0.8, s)
    elif name == "nurse":            # the faceless nurse: cap with a cross over a bandaged blank face
        _pg(p, "ink", [(8, 7), (20, 7), (19, 11), (9, 11)], s); _ln(p, "blood", [(14, 7.5), (14, 10.5)], w * 0.8, s); _ln(p, "blood", [(12.5, 9), (15.5, 9)], w * 0.8, s)
        _el(p, "ink", 14, 17, 6.5, s, w); _ln(p, "ink", [(9, 15), (19, 19)], w * 0.6, s); _ln(p, "ink", [(9, 19), (19, 15)], w * 0.6, s)
    elif name == "torii":
        return torii(px)
    elif name == "fox":
        return fox_mask(px)
    o = p.out(); return {k: distress(v, 31, 0.18) if k == "ink" else v for k, v in o.items()}


SYMBOLS10 = ["pyramid", "heather", "radio", "flashlight", "sign", "halo", "redsquare", "siren", "lily", "crtv"]


ART = {"pyramid": "char", "heather": "char"}      # the characters are the user's crops at EVERY tier; radio/sign crops failed at <= 48 (glyph instead)


def symbol_ws(n, st, px, art=True, light=False):
    name = SYMBOLS10[(n - 1) % 10]
    if art and px >= 36 and name in ART:
        if ART[name] == "char": L = character(name, px, light)
        elif name == "radio": L = _crop_layers((662, 692, 882, 912), px, px, lv=(0.12, 0.66), k_usm=0.5)
        else: L = _crop_layers((216, 700, 432, 916), px, px, lv=(0.14, 0.80), red=False)
    elif name in ("pyramid", "heather") and px < 36: L = character(name, px, light)
    else: L = sym(name, px)
    if "glow" in L: L = dict(L); L["ink"] = np.maximum(L["ink"], L.pop("glow"))
    L.pop("plate", None)
    return ws(L, n, st, px)


PICTO5 = ["pyramid", "heather", "sign", "radio", "lamp"]          # the S15c `silenthill` family's 5 motifs, iconic pictograms


# ---- patches the lab functions need to be pure of globals --------------------------------------------------------------------------------
def street_lamp_drawn(h, on=True):
    """the drawn lamp post at any height (the h < 40 branch of the lab's street_lamp)."""
    return street_lamp(h, on, drawn=True)


# ---- (2) Uzumaki Eye, tight (lab chars.uz_eye) ---------------------------------------------------------------------------------------------
EYE_BOX = (12, 14, 92, 94); EYE_K = 8


def _eye():
    if "EYE" not in _CACHE:
        be = _need("BE", "your bleeding-eye picture (105x103)")
        if be.size != (105, 103): raise ValueError(f"the eye recipe takes the 105x103 bleeding eye; this is {be.size[0]}x{be.size[1]}")
        BEC = rgbf(be.crop(EYE_BOX).resize((80 * EYE_K, 80 * EYE_K), Image.BICUBIC)); K = EYE_K
        L = lumf(BEC); R = redf(BEC)
        lv = np.clip((L - 0.05) / 0.50, 0, 1) ** 0.8
        scl = curve(gblur(L, 0.6 * K), 0.42, 0.55)
        ink = np.maximum(lv * (1 - R) * 0.85, scl * (1 - R))
        yy = np.mgrid[0:L.shape[0], 0:L.shape[1]][0]; drips = (yy > (63 - EYE_BOX[1]) * K).astype(np.float32)
        _CACHE["EYE"] = (ink, np.clip(R * 1.15, 0, 1), drips)
    return _CACHE["EYE"]


def uz_eye(n, st, px):
    ink, bl, dr = _eye(); i, b, d = area(ink, px), area(bl, px), area(dr, px)
    i = np.clip(usm(i, 0.6, 0.5), 0, 1)
    if px < 40: i = curve(i, 0.16, 0.78); b = curve(b, 0.12, 0.55)
    eye_only = 1 - curve(d, 0.3, 0.7)
    N, moat = numeral(n, px, max(7, int(round(0.28 * px))))
    if st == "empty":      ink_, bl_ = np.maximum(i * eye_only * 0.45, N * 0.7), 0 * i
    elif st == "occupied": ink_, bl_ = np.maximum(np.maximum(i, b * 0.8) * eye_only, N), 0 * i
    elif st == "active":   ink_, bl_ = np.maximum(i, N), b
    else:                  ink_, bl_ = N, np.maximum(i, b)
    return {"ink": (ink_ * (1 - moat) + N * moat) * (1 - bl_), "blood": bl_ * (1 - moat)}


# ---- (3) Beetle, faithful (lab chars.beetle / beetle_ws) ---------------------------------------------------------------------------------
BT_BOX = (18, 30, 898, 910); BT_EYE = (460, 546, 24)


def _bt():
    if "BT" not in _CACHE:
        bt = _need("BT", "your beetle (920x920)")
        if bt.size != (920, 920): raise ValueError(f"the beetle recipe takes the 920x920 beetle; this is {bt.size[0]}x{bt.size[1]}")
        L = lumf(rgbf(bt.crop(BT_BOX))); L[180:265, 690:760] = 1.0           # the signature seal erased
        fig = figure_mask(L, 4, 0.6).astype(np.float32)
        light = np.clip((L - 0.45) / 0.4, 0, 1) * fig
        ex, ey, er = BT_EYE; yy, xx = np.mgrid[0:L.shape[0], 0:L.shape[1]]
        pupil = (np.hypot(xx - (ex - BT_BOX[0]), yy - (ey - BT_BOX[1])) < er).astype(np.float32)
        _CACHE["BT"] = (fig, light, gblur(pupil, 2.0))
    return _CACHE["BT"]


def beetle(px, light=False, h_frac=1.0):
    """dark themes: the drawing's light parts bone, ALL its blacks the mid token, a 1-px bone rim around the silhouette, the pupil blood.
    light themes: positive print (blacks = ink, paper = clear) + a blood pupil."""
    fig, lt, pupil = _bt(); k = fig.shape[0] / px
    dk = np.clip(fig - lt, 0, 1)
    F, Dk, Lt, P = area(fig, px), area(dk, px), area(np.clip(usm(lt, 0.6 * k, 0.8), 0, 1), px), curve(area(pupil, px), 0.15, 0.5)
    if not light:
        ink = np.maximum(curve(Lt, 0.25, 0.75), rim_of(curve(F, 0.3, 0.6)) * 0.9)
        return {"mid": curve(Dk, 0.15, 0.55) * (1 - ink), "ink": ink * (1 - P), "blood": P}
    return {"ink": curve(np.clip(usm(Dk, 0.6, 0.5), 0, 1), 0.18, 0.62) * (1 - P), "blood": P}


def beetle_mayan(n, px, col="ink"):
    p = Pad(px, px); s = px / 28.0; d = p.D("m"); y = px - 2.2 * s; bars, dots = divmod(n, 5)
    if n == 0: d.ellipse(p.p(px / 2 - 2 * s, y - 1.2 * s, px / 2 + 2 * s, y + 1.2 * s), outline=255, width=max(1, int(s * p.s)))
    for b in range(bars): d.rectangle(p.p(px / 2 - 5 * s, y - 0.8 * s - b * 2.6 * s, px / 2 + 5 * s, y + 0.8 * s - b * 2.6 * s), fill=255)
    yd = y - bars * 2.6 * s; r = max(0.9, 1.05 * s)
    for i in range(dots): cx = px / 2 + (i - (dots - 1) / 2) * 3 * s; d.ellipse(p.p(cx - r, yd - r, cx + r, yd + r), fill=255)
    return p.out()["m"]


def beetle_ws(n, st, px, light=False):
    L = beetle(int(round(px * 0.86)), light); q = px - int(round(px * 0.86)); o = {}
    for k_, v in L.items(): z = np.zeros((px, px), np.float32); z[0:v.shape[0], q // 2:q // 2 + v.shape[1]] = v; o[k_] = z
    m = beetle_mayan(n, px); hole = _dl(m, 1)
    for k_ in o: o[k_] = o[k_] * (1 - hole)
    if st == "empty": o = {k_: v * 0.42 for k_, v in o.items()}; o["ink"] = np.maximum(o["ink"], m * 0.6)
    elif st == "occupied": o["ink"] = np.maximum(o["ink"], m)
    elif st == "active": o["blood"] = np.maximum(o["blood"], m)
    else: o["blood"] = np.maximum(np.maximum(o["blood"], m), o.pop("ink")); o["ink"] = 0 * m
    return o


# ---- the products: [(path relative to the assets folder, PIL RGBA)] ------------------------------------------------------------------------
def _d(px): return "marks" if px == 512 else f"marks/bar/{px}"


def mark_character(name, tiers=TIERS):
    """S17b: the character itself (no ring, ticks, glyph) at every tier + the 512 master; the light twin is the positive print."""
    out = []
    for px in tuple(tiers) + (512,):
        out += [(f"{_d(px)}/{name}.png", to_rgba(character(name, px, False))), (f"{_d(px)}/{name}.light.png", to_rgba(character(name, px, True)))]
    return out


def ws_eye_tight(tiers=TIERS):
    """S17c: `ws-uzumaki-eye-<n>-<state>.v12.png` (the tight crop; the light twin is the same file)."""
    return [(f"workspaces/bar/{px}/ws-uzumaki-eye-{n}-{st}.v12.png", to_rgba(uz_eye(n, st, px))) for px in tiers for n in range(1, 11) for st in STATES]


# ---- the pack (S17a) --------------------------------------------------------------------------------------------------------------------
def _wrap(x): return x if isinstance(x, dict) else {"ink": x}


def pack_procedural(tiers=PACK_PX):
    """the procedural pieces of 17.1 (no user pixels; distressed by the current grain). `hollow/bar/<px>/<name>.png` glyphs, `hollow/<name>.png` plates (S24: was sh/)."""
    out = []
    for px in tiers:
        g = {}
        for b in range(5): g[f"crt-{b}"] = crt(px, bars=b)
        g["crt-drop"] = crt_drop(px); g["tag"] = tag_glyph(px)
        for lv in (10, 30, 55, 80, 100): g[f"iv-{lv}"] = iv_bag(px, lv / 100.0)
        g["iv-charge"] = iv_bag(px, 0.6, charging=True)
        for fr in (0, 25, 50, 75, 100): g[f"spiral-{fr}"] = spiral_dial(px, max(0.02, fr / 100.0))
        g["spiral-hot"] = spiral_dial(px, 0.9, hot=True)
        g["chain-glyph"] = chain_glyph(px); g["torii"] = torii(px); g["fox"] = fox_mask(px); g["lily"] = sym("lily", px)
        g["lamp-on"] = street_lamp_drawn(px, True); g["lamp-off"] = street_lamp_drawn(px, False)
        for nm, L in g.items(): out.append((f"hollow/bar/{px}/{nm}.png", to_rgba(_wrap(L))))
    plates = {"plate": rust_plate(160, 28), "room-302": room_plate(64, 24), "wristband": wristband(240, 18), "seal": paper_seal(120, 28),
              "chain-strip": chain(240, 12), "wire-strip": chain(240, 12, wire=True), "grate": grate(192, 48), "map": street_map(480, 120)}
    for nm, L in plates.items(): out.append((f"hollow/{nm}.png", to_rgba(_wrap(L))))
    return out


def pack_user(tiers=PACK_PX):
    """the pieces cut from the user's two sheets (`sh/...` of the assets folder only): grain, radio >= 64, welcome sign, street lamp >= 40,
    fog band + weather glyph, red streaks, roundel ring >= 96."""
    _SHEET(); out = []
    g = GR(); out.append(("hollow/grain.png", to_rgba({"ink": g})))
    for px in (64, 72, 80, 88, 96, 112, 120, 128): out.append((f"hollow/bar/{px}/radio.png", to_rgba(square(radio(int(px * 0.86), vol=0.5), px))))
    out.append(("hollow/sign.png", to_rgba(sign_plate(320))))
    for px in tuple(t for t in tiers if t >= 40) + (72, 80, 96):
        out += [(f"hollow/bar/{px}/lamp-on.png", to_rgba(square(street_lamp(px, True), px))), (f"hollow/bar/{px}/lamp-off.png", to_rgba(square(street_lamp(px, False), px)))]
    out.append(("hollow/fog-band.png", to_rgba({"glow": fog_field(480, 48) * 0.4})))
    for px in tuple(t for t in tiers if t <= 48): out.append((f"hollow/bar/{px}/weather-fog.png", to_rgba(fog_weather(px, 0.7))))
    out.append(("hollow/red-streaks.png", to_rgba({"blood": red_streaks(480, 240)})))
    for px in (96, 112, 120, 128): out.append((f"hollow/bar/{px}/roundel.png", to_rgba(roundel_ring(px))))
    return out

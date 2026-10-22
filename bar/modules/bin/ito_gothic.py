"""ito_gothic: the S18 recipes of `ito-assets` (master-plan-v4 S18a), a port of the lab generators ~/.cache/ito/lab/v13/{tiles,v13}.py.

The source is the user's SHELL ASSET SHEET (exactly 1536x1024; any other size is refused by ito-assets). Four product groups, one crop recipe:
  relic-sys       relic/sys/bar/<px>/<icon>[-<state>][.light].png          bar widget icons, iconStyle Relic (id `gothic`)
  ws-symbols      workspaces/bar/<px>/ws-symbols-<n>-<state>[.light].png   workspace family Symbols (style `symbols`, old id `gothic`; ws 3/5/9 =
                                                                           engraved marks in place of the sheet's faces; ws 10 = the vinyl)
  gothic-apps     <icons>/Ito-verse-icons-v2/<size>x<size>/apps/<name>.png app icon theme (colours baked at recipe time)
Recipe convention (as every ito-assets recipe): neutral ink (200 grey) + alpha, blood 200/16/20; the theme shader tints them. The sheet's black
ground becomes TRANSPARENT (no opaque black, ever). No colour literal of a theme is used: ink and blood are the recipe constants.
Exact device px per tier: area resample when shrinking, Lanczos (marked soft) when the tier is an upscale; < 36 px firmed by curve(.16, .78).
Pure: every function returns PIL images; nothing here touches the disk.
"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SHEET_SIZE = (1536, 1024)
SERIF = "/usr/share/fonts/noto/NotoSerif-Bold.ttf"
INK, BLOOD = (200, 200, 200), (200, 16, 20)
SYS_TIERS = (24, 26, 28, 30, 32, 36, 40, 44, 48, 56, 64)
WS_TIERS = SYS_TIERS + (72, 80)                    # + the Workspaces page card tiers (the card preview snaps to 48..80)
APP_SIZES = (16, 22, 24, 32, 48, 64, 96, 128)
STATES = ("empty", "occupied", "active", "urgent")
SYS = ("network", "cpu", "gpu", "battery", "audio", "bluetooth", "night", "ai", "display", "tray")
APPS = ("browser", "terminal", "files", "editor", "image", "music", "video", "settings", "power")
# per-icon floors (the smallest tier the glyph survives at): below it ito-assets writes nothing and the map falls back to `current`
FLOOR = {"gpu": 32, "ai": 30}
# the file names of the states of each icon (the bar's ItoIconMap.gothic builds the same names)
SYS_STATES = {
    "network": ["network-0", "network-1", "network-2", "network-3", "network-off"],
    "cpu": ["cpu"], "gpu": ["gpu"], "ai": ["ai"], "tray": ["tray"],
    "battery": ["battery-0", "battery-1", "battery-2", "battery-3", "battery-4"],
    "audio": ["audio-0", "audio-1", "audio-2", "audio-3", "audio-mute"],
    "bluetooth": ["bluetooth-on", "bluetooth-off", "bluetooth-linked"],
    "night": ["night-on", "night-off"],
    "display": ["display-0", "display-1", "display-2", "display-3"],
}
# the name map of the app theme (plan 18b)
APP_NAMES = {
    "browser": ["web-browser", "zen-browser", "firefox", "chromium"], "terminal": ["utilities-terminal", "com.mitchellh.ghostty", "Alacritty", "org.gnome.Terminal"],
    "files": ["system-file-manager", "org.gnome.Nautilus"], "editor": ["accessories-text-editor", "nvim", "org.gnome.TextEditor"],
    "image": ["image-viewer", "imv", "org.gnome.Loupe"], "music": ["multimedia-audio-player", "spotify"], "video": ["multimedia-video-player", "mpv"],
    "settings": ["preferences-system", "org.gnome.Settings"], "power": ["system-shutdown", "system-log-out"],
}

# ---- tile frames of the sheet (tiles.py): approximate boxes refined to the drawn frame lines
APPROX = {
    "browser": (49, 40, 170, 152), "terminal": (212, 40, 332, 152), "files": (377, 40, 496, 152), "editor": (542, 40, 661, 152),
    "image": (706, 40, 827, 152), "music": (872, 40, 991, 152), "video": (1036, 40, 1155, 152), "settings": (1199, 40, 1319, 152),
    "power": (1365, 40, 1486, 152),
    "network": (55, 208, 165, 305), "cpu": (215, 208, 325, 305), "gpu": (381, 208, 490, 305), "battery": (540, 208, 649, 305),
    "audio": (694, 208, 803, 305), "bluetooth": (850, 208, 957, 305), "night": (1004, 208, 1110, 305), "ai": (1152, 208, 1258, 305),
    "display": (1293, 208, 1381, 305), "tray": (1411, 208, 1482, 305),
    "ws1": (49, 364, 170, 477), "ws2": (218, 364, 333, 477), "ws3": (384, 364, 500, 477), "ws4": (553, 364, 669, 477),
    "ws5": (711, 364, 831, 477), "ws6": (886, 364, 1013, 477), "ws7": (1055, 364, 1172, 477), "ws8": (1211, 364, 1333, 477),
    "ws9": (1371, 364, 1485, 477),
}
BANNERS = [(29, 546, 511, 679), (528, 545, 1010, 679), (1026, 545, 1509, 678), (29, 694, 511, 831), (528, 693, 1009, 830),
           (1025, 693, 1508, 830), (30, 846, 510, 978), (528, 846, 1008, 978), (1026, 845, 1507, 978)]
# full-bleed ws tiles: a tighter focus box for the bar tiers (< 36 px), so a face reads as a face
FOCUS = {"ws3": (430, 372, 498, 440), "ws5": (735, 380, 810, 455), "ws9": (1392, 378, 1468, 454), "ws4": (574, 372, 648, 446),
         "ws2": (224, 380, 326, 466)}
WS10 = "music"


# ---- float-map helpers (the lab's sh12 / common / def10 helpers, same numbers)
def rgbf(im):
    return np.asarray(im.convert("RGB"), np.float32) / 255


def lumf(a):
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


def redf(a):
    return np.clip((a[..., 0] - (a[..., 1] + a[..., 2]) / 2 - 0.16) / 0.30, 0, 1)


def redlo(t):
    """a low-threshold red key for art whose red is DARK (ws 4's cross)."""
    return np.clip((t[..., 0] - (t[..., 1] + t[..., 2]) / 2 - 0.05) / 0.16, 0, 1)


def gblur(m, sig):
    if sig <= 0.05:
        return m.astype(np.float32)
    r = max(1, int(3 * sig + 0.5)); x = np.arange(-r, r + 1); k = np.exp(-x * x / (2 * sig * sig)); k /= k.sum()
    p = np.pad(m.astype(np.float32), r, mode="reflect")
    h = sum(k[i] * p[:, i:i + p.shape[1] - 2 * r] for i in range(2 * r + 1))
    return sum(k[i] * h[i:i + h.shape[0] - 2 * r, :] for i in range(2 * r + 1))


def usm(m, sig, amt):
    return m + amt * (m - gblur(m, sig))


def area(m, W, H=None):
    H = H or W
    return np.asarray(Image.fromarray((np.clip(m, 0, 1) * 65535).astype(np.uint16).astype(np.int32), "I").resize((W, H), Image.BOX), np.float32) / 65535


def curve(a, lo, hi):
    t = np.clip((a - lo) / max(1e-3, hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def _dl(m, r):
    return np.asarray(Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * r + 1)), np.float32) / 255


def rs(m, W, H):
    """exact-px tier: area resample when shrinking; Lanczos when the tier is an UPSCALE (soft)."""
    if W <= m.shape[1] and H <= m.shape[0]:
        return area(m, W, H)
    return np.clip(np.asarray(Image.fromarray(m.astype(np.float32), "F").resize((W, H), Image.LANCZOS), np.float32), 0, 1)


def rgba(ink, blood):
    """layers -> RGBA with a TRANSPARENT ground (ink 200 grey, blood 200/16/20): the recipe convention."""
    i, b = np.clip(ink, 0, 1), np.clip(blood, 0, 1)
    a = np.clip(np.maximum(i, b), 0, 1)
    col = (np.array(INK, np.float32) * (i * (1 - b))[..., None] + np.array(BLOOD, np.float32) * b[..., None]) / np.maximum(a, 1e-4)[..., None]
    return Image.fromarray(np.dstack([np.clip(col, 0, 255), a * 255]).astype(np.uint8), "RGBA")


class Sheet:
    """the sheet and every crop of it."""

    def __init__(self, im):
        if im.size != SHEET_SIZE:
            raise ValueError(f"the gothic recipes take the 1536x1024 shell asset sheet; this is {im.size[0]}x{im.size[1]}")
        self.im = im.convert("RGB")
        self.L = np.asarray(self.im.convert("L"), np.float32)
        self.tiles = {k: self._refine(v) for k, v in APPROX.items()}
        self._memo = {}

    # ---- tiles.py
    def _best(self, axis, lo, hi, a, b):
        best, bx = -1, lo
        for v in range(lo, hi + 1):
            line = self.L[a:b, v] if axis == "x" else self.L[v, a:b]
            s = float(np.median(line))
            if s > best:
                best, bx = s, v
        return bx

    def _refine(self, box, r=9):
        x0, y0, x1, y1 = box; m = 14
        x0 = self._best("x", x0 - r, x0 + r, y0 + m, y1 - m); x1 = self._best("x", x1 - r, x1 + r, y0 + m, y1 - m)
        y0 = self._best("y", y0 - r, y0 + r, x0 + m, x1 - m); y1 = self._best("y", y1 - r, y1 + r, x0 + m, x1 - m)
        return (x0, y0, x1, y1)

    def inner(self, k, inset=3):
        x0, y0, x1, y1 = self.tiles[k]
        return (x0 + inset, y0 + inset, x1 - inset + 1, y1 - inset + 1)

    def src(self, box, img=None):
        return rgbf((img or self.im).crop(box))

    def tight(self, box, thr=0.22, pad=0.07):
        t = self.src(box); L = lumf(t); m = np.maximum(L, redf(t) * 0.6) > thr
        ys, xs = np.where(m)
        if len(xs) == 0:
            return box
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        s = max(x1 - x0, y1 - y0) * (1 + 2 * pad); cx, cy = box[0] + (x0 + x1) / 2, box[1] + (y0 + y1) / 2
        return (int(round(cx - s / 2)), int(round(cy - s / 2)), int(round(cx + s / 2)), int(round(cy + s / 2)))

    def red_box(self, box, pad=0.3):
        t = self.src(box); ys, xs = np.where(redf(t) > 0.3)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        s = max(x1 - x0, y1 - y0) * (1 + 2 * pad); cx, cy = box[0] + (x0 + x1) / 2, box[1] + (y0 + y1) / 2
        return (int(round(cx - s / 2)), int(round(cy - s / 2)), int(round(cx + s / 2)), int(round(cy + s / 2)))

    # ---- the one crop recipe (v13.layers); `mask` (sys states) = f(H, W) -> dict of crop-res maps: i (ink factor), b (blood factor), addi, addb
    def layers(self, box, W, H=None, light=False, lv=(0.10, 0.72), firm=True, red=None, mask=None, img=None):
        H = H or W; t = self.src(box, img); L = lumf(t); R = (red or redf)(t); k = t.shape[1] / W
        Ls = np.clip(usm(L, 0.8 * k, 0.8), 0, 1)
        if not light:
            a = np.clip((Ls - lv[0]) / (lv[1] - lv[0]), 0, 1) * (1 - R)
        else:
            M = curve(gblur(L, 3.0 * max(1, k / 2)), 0.07, 0.18)
            a = np.clip((lv[1] + 0.1 - Ls) / (lv[1] + 0.1 - lv[0]), 0, 1) * M * (1 - R)
        addi = None
        if mask is not None:
            m = mask(*L.shape)
            a = a * m.get("i", 1.0); R = R * m.get("b", 1.0)
            addi = m.get("addi")
            if "addb" in m:
                R = np.maximum(R, m["addb"]); a = a * (1 - m["addb"])
        i, b = rs(a, W, H), rs(R, W, H)
        if firm and min(W, H) < 36:
            i = curve(i, 0.16, 0.78)
        if addi is not None:
            i = np.maximum(i, rs(addi, W, H))                  # a tone fill (the display's brightness) is added AFTER the firming
        return {"ink": i, "blood": curve(b, 0.08, 0.5)}

    # ================================================================= (a) system icons + their states
    def _sys_box(self, name):
        return self.tight(self.inner(name, 4))

    def _geom(self, name):
        """measured geometry of one tight crop (source px), cached."""
        key = ("g", name)
        if key not in self._memo:
            t = self.src(self._sys_box(name)); R = redf(t)
            g = {"shape": R.shape}
            if name == "network":
                ys, xs = np.where(R > 0.4); g["dot"] = (float(xs.mean()), float(ys.mean()))
            self._memo[key] = g
        return self._memo[key]

    def sys_mask(self, name, state):
        """crop-res masks of one state, or None for the full art."""
        if state in ("cpu", "gpu", "ai", "tray", "network-3", "battery-4", "audio-2", "audio-3", "bluetooth-on", "night-on", "display-0"):
            return None                                             # the full art
        g = self._geom(name); H, W = g["shape"]; s = W / 71.0       # every measured number below is in 71-px crop units

        def circle(cx, cy, r):
            m = Image.new("L", (W * 4, H * 4), 0); ImageDraw.Draw(m).ellipse(((cx - r) * 4 * s, (cy - r) * 4 * s, (cx + r) * 4 * s, (cy + r) * 4 * s), fill=255)
            return np.asarray(m.resize((W, H), Image.BOX), np.float32) / 255

        def rect(x0, y0, x1, y1):
            m = np.zeros((H, W), np.float32); m[int(round(y0 * s)):int(round(y1 * s)), int(round(x0 * s)):int(round(x1 * s))] = 1
            return m
        if name == "network":
            cx, cy = g["dot"]; yy, xx = np.mgrid[0:H, 0:W]; d = np.hypot(xx - cx, yy - cy) / s
            if state == "network-off":
                return lambda h, w: {"i": np.where(d <= 8, 1.0, 0.4).astype(np.float32)}
            lim = {"network-0": 9, "network-1": 22, "network-2": 36}[state]
            return lambda h, w: {"i": (d <= lim).astype(np.float32), "b": 1.0}
        if name == "battery":
            lvl = int(state[-1]); cells = [(9, 19), (22, 32), (35, 45), (47, 59)]; blank = np.zeros((H, W), np.float32)
            for x0, x1 in cells[lvl:]:
                blank = np.maximum(blank, rect(x0 - 1, 21, x1 + 1, 51))
            return lambda h, w: {"i": 1 - blank, "b": 1 - blank}
        if name == "audio":
            cut = np.zeros((H, W), np.float32)
            if state in ("audio-0", "audio-mute"):
                cut = rect(43, 0, 71, 71)
            elif state == "audio-1":
                cut = rect(55, 0, 71, 71)
            out = lambda h, w: {"i": 1 - cut, "b": 1 - cut}
            if state == "audio-mute":
                m = Image.new("L", (W * 4, H * 4), 0); ImageDraw.Draw(m).line((10 * 4 * s, 62 * 4 * s, 62 * 4 * s, 10 * 4 * s), fill=255, width=int(round(4.6 * 4 * s)))
                sl = np.asarray(m.resize((W, H), Image.BOX), np.float32) / 255
                return lambda h, w: {"i": 1 - cut, "b": 1 - cut, "addb": sl}
            return out
        if name == "bluetooth":
            if state == "bluetooth-off":
                return lambda h, w: {"i": 0.4, "b": 0.4}
            dot = circle(60, 59, 4.6); hole = np.asarray(Image.fromarray((dot * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)), np.float32) / 255
            return lambda h, w: {"i": 1 - hole, "b": 1 - hole, "addb": dot}
        if name == "night":
            return lambda h, w: {"i": 0.4, "b": 0.4}
        if name == "display":
            lvl = int(state[-1])
            return lambda h, w: {"addi": rect(9, 13, 65, 52) * (0.20 * lvl)} if lvl else {}
        return None

    def sys_icon(self, name, state, px, pal_light=False):
        mask = self.sys_mask(name, state)
        return rgba_of(self.layers(self._sys_box(name), px, mask=mask))

    # ================================================================= (b) app icons
    def app_icon(self, name, px, light=False):
        box = self.inner(name, 4)
        if name == "terminal" and px <= 32:
            box = self.red_box(box, 0.22)                      # micro: the prompt itself, the frame drops
        elif name in ("terminal", "power", "settings", "music", "files", "image"):
            box = self.tight(box, pad=0.05)
        photo = light and name in ("editor", "video")          # photo-like tiles print positive on light themes
        return rgba_of(self.layers(box, px, light=photo, firm=px < 36))

    # ================================================================= (c) workspace family
    def ws_art(self, n, px, light=False):
        key = "ws%d" % n if n <= 9 else WS10
        if n in SYMBOLS:                                   # Symbols family: the sheet's faces (3, 5, 9) are replaced by engraved marks
            if ("sym", n) not in self._memo:
                self._memo[("sym", n)] = symbol_art(SYMBOLS[n])
            im = self._memo[("sym", n)]
            return self.layers((0, 0) + im.size, px, img=im)
        pos = light and key == "ws7"
        if n == 10:
            box = self.tight(self.inner(WS10, 4), pad=0.04)
        elif px < 36 and key in FOCUS:
            box = FOCUS[key]
        else:
            box = self.inner(key, 4)
        return self.layers(box, px, light=pos, red=redlo if key == "ws4" else None)

    def ws_tile(self, n, st, px, light=False):
        Ly = self.ws_art(n, px, light); i, b = Ly["ink"], Ly["blood"]
        N, moat = numeral(n, px)
        o, f = state_dot(px, st)
        hole = _dl(np.maximum(o, f), 1)
        i, b = i * (1 - moat) * (1 - hole), b * (1 - moat) * (1 - hole)
        z = 0 * i
        if st == "empty":
            ink, bl = np.maximum(np.maximum(i, b) * 0.40, np.maximum(N * 0.7, o * 0.6)), z
        elif st == "occupied":
            ink, bl = np.maximum(i, np.maximum(N, o)), np.maximum(b * 0.55, f * 0.9)
        elif st == "active":
            ink, bl = i, np.maximum(b, np.maximum(np.maximum(o, f), N))
        else:
            ink, bl = z, np.maximum(np.maximum(i, b), np.maximum(N, np.maximum(o, f)))
        return rgba(ink * (1 - bl), bl)

    # ================================================================= (d) banner crops (the recipe was removed; the source rectangles stay for other designs)
    def banner_art(self, n, W, H):
        x0, y0, x1, y1 = BANNERS[n - 1]; art = (x0 + 3, y0 + 42, x1 - 2, y1 - 3)     # the baked header text is cut away
        aw, ah = art[2] - art[0], art[3] - art[1]; tr = W / H
        if aw / ah > tr:
            cw = ah * tr; art = (int(art[0] + (aw - cw) / 2), art[1], int(art[0] + (aw + cw) / 2), art[3])
        else:
            ch = aw / tr; art = (art[0], int(art[1] + (ah - ch) / 2), art[2], int(art[1] + (ah + ch) / 2))
        return self.layers(art, W, H, light=False, firm=False)


def rgba_of(Ly):
    return rgba(Ly["ink"], Ly["blood"])


def numeral(n, px, h=None):
    """the numeral top-left (Noto Serif Bold, h = round(.30 px)), with a 1-px moat. Empty under ito_sh.no_numeral() (the picker preview)."""
    sh = sys.modules.get("ito_sh")
    if sh is not None and sh.NUMERAL_OFF[0]:
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
    """the sheet's hollow / half / full dot, bottom-right, r = clamp(0.08 px, 2, 3.2)."""
    SS = 8; r = min(3.2, max(2.0, 0.08 * px)) * SS; cx = cy = px * SS - r - SS; st = "active" if st == "urgent" else st
    o = Image.new("L", (px * SS, px * SS), 0); f = Image.new("L", (px * SS, px * SS), 0)
    ImageDraw.Draw(o).ellipse((cx - r, cy - r, cx + r, cy + r), outline=255, width=SS)
    if st == "active":
        ImageDraw.Draw(f).ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
    if st == "occupied":
        ImageDraw.Draw(f).pieslice((cx - r, cy - r, cx + r, cy + r), 90, 270, fill=255)
    g = lambda im: np.asarray(im.resize((px, px), Image.BOX), np.float32) / 255
    return g(o), g(f)


# ---- the Symbols family (visible name of `gothic`): the sheet's three faces (ws 3, 5, 9) are replaced by occult marks engraved in the
# sheet's own hand: every line is several jittered, broken scratches; solid parts are scratchy hatching; blood is the sheet's red.
# The result is a sheet-like RGB tile on black that goes through the same crop recipe (layers) as the sheet's own tiles. Deterministic.
SYMBOLS = {3: "hourglass", 5: "pentagram", 9: "key"}
SYM_PX = 464


def _chaikin(pts, it=3):
    p = np.asarray(pts, np.float64)
    for _ in range(it):
        q = np.empty((2 * len(p) - 2, 2)); q[0::2] = 0.75 * p[:-1] + 0.25 * p[1:]; q[1::2] = 0.25 * p[:-1] + 0.75 * p[1:]
        p = np.vstack([p[:1], q, p[-1:]])
    return p


def _resample(P, step):
    seg = np.hypot(*np.diff(P, axis=0).T); L = np.concatenate([[0], np.cumsum(seg)])
    s = np.linspace(0, L[-1], max(2, int(L[-1] / step) + 1))
    return np.stack([np.interp(s, L, P[:, 0]), np.interp(s, L, P[:, 1])], 1), max(float(L[-1]), 1.0)


class _Engraver:
    def __init__(self, seed, C=SYM_PX, ss=2):
        self.C, self.N = C, C * ss; self.ss = ss
        self.rng = np.random.default_rng(seed)
        self.lay = {"ink": np.zeros((self.N, self.N), np.float32), "red": np.zeros((self.N, self.N), np.float32)}

    def _put(self, layer, im):
        np.maximum(self.lay[layer], np.asarray(im, np.float32) / 255, out=self.lay[layer])

    def stroke(self, pts, w=0.022, passes=6, jit=0.0055, val=(0.35, 0.95), layer="ink", gap=0.4, closed=False):
        """one engraved line: `passes` jittered scratches, each broken into dashes."""
        P = np.asarray(pts, np.float64) * self.N
        if closed:
            P = np.vstack([P, P[:1]])
        P, length = _resample(P, 2.0); n = len(P)
        tg = np.gradient(P, axis=0); nr = np.stack([-tg[:, 1], tg[:, 0]], 1); nr /= np.maximum(np.hypot(*nr.T), 1e-6)[:, None]
        for k in range(passes):
            knots = max(2, int(length / (36 * self.ss)) + 2)
            off = np.interp(np.linspace(0, 1, n), np.linspace(0, 1, knots), self.rng.normal(0, jit * self.N, knots))
            Q = P + nr * off[:, None]
            v = self.rng.uniform(*val) if k else val[1] * 0.88; wd = max(1, int(round(w * self.N * (self.rng.uniform(0.3, 0.75) if k else 0.8))))
            im = Image.new("L", (self.N, self.N), 0); dr = ImageDraw.Draw(im); i = 0
            while i < n - 1:
                j = min(n - 1, i + int(self.rng.uniform(14, 48) * self.ss))
                dr.line([tuple(q) for q in Q[i:j + 1]], fill=int(255 * v), width=wd, joint="curve")
                i = j + (int(self.rng.uniform(2, 6) * self.ss) if k and self.rng.random() < gap else 0)
            self._put(layer, im)

    def ring(self, c, r, **kw):
        a = np.linspace(0, 2 * np.pi, max(24, int(r * 220)), endpoint=False)
        self.stroke(np.stack([c[0] + r * np.cos(a), c[1] + r * np.sin(a)], 1), closed=True, **kw)

    def fill(self, shape, angle=62, spacing=0.016, val=(0.35, 0.8), layer="ink", grain=0.25):
        """scratchy hatching clipped to `shape(draw, N)` (drawn in 255 on an L mask), plus a little grain."""
        m = Image.new("L", (self.N, self.N), 0); shape(ImageDraw.Draw(m), self.N); M = np.asarray(m, np.float32) / 255
        im = Image.new("L", (self.N, self.N), 0); dr = ImageDraw.Draw(im)
        th = np.radians(angle); d = np.array([np.cos(th), np.sin(th)]); nv = np.array([-d[1], d[0]]); c = self.N / 2; R = self.N * 0.75
        t = -R
        while t < R:
            o = c + nv * t; s = -R
            while s < R:
                ln = self.rng.uniform(0.05, 0.3) * self.N
                a, b = o + d * s, o + d * (s + ln); jj = self.rng.normal(0, 0.6 * self.ss, 2)
                dr.line([tuple(a + nv * jj[0]), tuple(b + nv * jj[1])], fill=int(255 * self.rng.uniform(*val)), width=max(1, int(self.rng.uniform(0.6, 1.4) * self.ss * 1.5)))
                s += ln + self.rng.uniform(0, 0.03) * self.N
            t += spacing * self.N * self.rng.uniform(0.7, 1.3)
        H = np.asarray(im, np.float32) / 255
        if grain:
            H = np.maximum(H, (self.rng.random(H.shape) > 1 - grain * 0.08).astype(np.float32) * self.rng.uniform(0.3, 0.7))
        self.lay[layer] = np.maximum(self.lay[layer], H * M)

    def drip(self, x, y0, y1, w=0.016):
        self.stroke([(x, y0), (x + 0.002, (y0 + y1) / 2), (x, y1)], w=w * 0.8, passes=4, jit=0.002, layer="red", gap=0)
        im = Image.new("L", (self.N, self.N), 0); r = w * 0.95 * self.N; cx, cy = x * self.N, y1 * self.N
        ImageDraw.Draw(im).polygon([(cx, cy - 2.2 * r), (cx + r, cy + 0.2 * r), (cx, cy + 1.2 * r), (cx - r, cy + 0.2 * r)], fill=255)
        ImageDraw.Draw(im).ellipse((cx - r, cy - 0.6 * r, cx + r, cy + 1.25 * r), fill=255)
        self._put("red", im)

    def splat(self, pts, n=40, reach=0.05):
        """fine blood hairs and specks around a red line (the sheet's cross)."""
        P = np.asarray(pts, np.float64)
        im = Image.new("L", (self.N, self.N), 0); dr = ImageDraw.Draw(im)
        for _ in range(n):
            a, b = P[self.rng.integers(len(P) - 1)], P[self.rng.integers(len(P))]
            o = (a + (b - a) * self.rng.random()) * self.N; t = self.rng.uniform(0, 2 * np.pi); L = self.rng.uniform(0.2, 1) * reach * self.N
            if self.rng.random() < 0.5:
                dr.line([tuple(o), tuple(o + L * np.array([np.cos(t), np.sin(t)]))], fill=int(255 * self.rng.uniform(0.4, 0.9)), width=self.ss)
            else:
                q = o + L * np.array([np.cos(t), np.sin(t)]); r = self.rng.uniform(0.6, 2.2) * self.ss
                dr.ellipse((q[0] - r, q[1] - r, q[0] + r, q[1] + r), fill=int(255 * self.rng.uniform(0.5, 1)))
        self._put("red", im)

    def image(self):
        """sheet-like RGB on black: ink near-white, blood the sheet's red, scaled down from the supersample; worn by a fine grain."""
        g = lambda a: np.asarray(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).resize((self.C, self.C), Image.BOX), np.float32) / 255
        i, r = g(self.lay["ink"]), g(self.lay["red"])
        wear = lambda lo: np.clip(lo + (1 - lo) * 1.4 * gblur(self.rng.random(i.shape).astype(np.float32), 0.7) ** 0.8, 0, 1)
        i, r = i * wear(0.35), r * wear(0.35)
        col = i[..., None] * np.array([0.93, 0.92, 0.90]) * (1 - r[..., None]) + r[..., None] * np.array([0.82, 0.07, 0.10])
        return Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8), "RGB")


def _poly(pts):
    return lambda dr, N: dr.polygon([(x * N, y * N) for x, y in pts], fill=255)


def symbol_art(name):
    """the engraved mark `name` (SYMBOLS) as a SYM_PX sheet-like RGB tile. Pure, deterministic."""
    E = _Engraver({"hourglass": 3, "pentagram": 5, "key": 9}[name])
    if name == "hourglass":
        # the hour runs out in blood: frame, glass, blood sand above, its stream, the pile, and it seeps through the base
        for y0, y1 in ((0.10, 0.17), (0.83, 0.90)):
            plate = [(0.21, y0), (0.79, y0), (0.79, y1), (0.21, y1)]
            E.fill(_poly(plate), angle=8, spacing=0.012, val=(0.45, 0.85))
            E.stroke(plate, closed=True, w=0.016)
        for x in (0.26, 0.74):
            E.stroke([(x, 0.17), (x, 0.83)], w=0.02, passes=7)
            for y in (0.30, 0.50, 0.70):
                E.ring((x, y), 0.018, w=0.012, passes=3)
        L = _chaikin([(0.355, 0.17), (0.325, 0.25), (0.34, 0.36), (0.43, 0.45), (0.485, 0.50), (0.43, 0.55), (0.34, 0.64), (0.325, 0.75), (0.355, 0.83)])
        Rt = L * [-1, 1] + [1, 0]
        E.stroke(L, w=0.017, passes=6); E.stroke(Rt, w=0.017, passes=6)
        top = [p for p in L if 0.34 <= p[1] <= 0.495]; sand = top + [(1 - x, y) for x, y in reversed(top)]
        E.fill(_poly(sand), layer="red", angle=-30, spacing=0.008, val=(0.6, 1.0))
        E.stroke(_chaikin([(top[0][0] + 0.01, 0.35), (0.5, 0.335), (1 - top[0][0] - 0.01, 0.35)]), w=0.012, passes=3, layer="red")
        E.splat(sand, n=30, reach=0.03)
        E.stroke([(0.5, 0.50), (0.5, 0.76)], w=0.009, passes=3, jit=0.002, layer="red", gap=0.4)
        pile = _chaikin([(0.345, 0.83), (0.40, 0.775), (0.5, 0.715), (0.60, 0.775), (0.655, 0.83)], 2).tolist()
        E.fill(_poly(pile), layer="red", angle=30, spacing=0.008, val=(0.6, 1.0))
        E.stroke(pile, w=0.012, passes=3, layer="red"); E.splat(pile, n=24, reach=0.03)
        E.stroke(_chaikin([(0.37, 0.24), (0.355, 0.30)], 1), w=0.008, passes=2, val=(0.4, 0.7))
        E.stroke(_chaikin([(0.37, 0.70), (0.36, 0.77)], 1), w=0.008, passes=2, val=(0.4, 0.7))
        E.drip(0.42, 0.90, 0.955); E.drip(0.57, 0.90, 0.935, w=0.013)
    elif name == "pentagram":
        # an inverted pentagram drawn in blood inside a double engraved ring; the lower point bleeds over the ring
        c = (0.5, 0.5)
        E.fill(lambda dr, N: (dr.ellipse(((c[0] - .43) * N, (c[1] - .43) * N, (c[0] + .43) * N, (c[1] + .43) * N), fill=255),
                              dr.ellipse(((c[0] - .36) * N, (c[1] - .36) * N, (c[0] + .36) * N, (c[1] + .36) * N), fill=0)),
               angle=50, spacing=0.014, val=(0.3, 0.6))
        E.ring(c, 0.43, w=0.02, passes=7); E.ring(c, 0.36, w=0.015, passes=6)
        th = np.radians(90 + 72 * np.arange(5)); P = [(c[0] + 0.36 * np.cos(t), c[1] + 0.36 * np.sin(t)) for t in th]
        for t in np.radians(90 + 36 + 72 * np.arange(5)):
            E.ring((c[0] + 0.395 * np.cos(t), c[1] + 0.395 * np.sin(t)), 0.016, w=0.011, passes=3)
        for t in th:
            E.stroke([(c[0] + 0.36 * np.cos(t), c[1] + 0.36 * np.sin(t)), (c[0] + 0.43 * np.cos(t), c[1] + 0.43 * np.sin(t))], w=0.012, passes=3)
        E.fill(_poly([P[i] for i in (0, 2, 4, 1, 3)]), layer="red", angle=-20, spacing=0.03, val=(0.25, 0.5), grain=0)
        for a, b in ((0, 2), (2, 4), (4, 1), (1, 3), (3, 0)):
            E.stroke([P[a], P[b]], w=0.024, passes=7, layer="red", jit=0.004); E.splat([P[a], P[b]], n=22, reach=0.04)
        E.drip(0.5, 0.86, 0.965, w=0.017)
    elif name == "key":
        # an old iron key, bow down-left, bit up-right; a blood stone in the bow, the bit wet with blood that drips
        B = np.array([0.26, 0.74]); u = np.array([0.7071, -0.7071]); v = np.array([0.7071, 0.7071]); hw = 0.034
        E.fill(lambda dr, N: (dr.ellipse(((B[0] - .16) * N, (B[1] - .16) * N, (B[0] + .16) * N, (B[1] + .16) * N), fill=255),
                              dr.ellipse(((B[0] - .085) * N, (B[1] - .085) * N, (B[0] + .085) * N, (B[1] + .085) * N), fill=0)),
               angle=20, spacing=0.012, val=(0.4, 0.85))
        E.ring(B, 0.16, w=0.02, passes=7); E.ring(B, 0.085, w=0.015, passes=5)
        for t in np.radians(45 + 90 * np.arange(4)):
            E.stroke([B + 0.10 * np.array([np.cos(t), np.sin(t)]), B + 0.145 * np.array([np.cos(t), np.sin(t)])], w=0.012, passes=3)
        E.fill(lambda dr, N: dr.ellipse(((B[0] - .045) * N, (B[1] - .045) * N, (B[0] + .045) * N, (B[1] + .045) * N), fill=255), layer="red", spacing=0.006, val=(0.75, 1), grain=0)
        E.ring(tuple(B), 0.045, w=0.01, passes=3, layer="red")
        at = lambda s, o: tuple(B + u * s + v * o)
        shaft = [at(0.16, -hw), at(0.80, -hw), at(0.80, hw), at(0.16, hw)]
        E.fill(_poly(shaft), angle=-45, spacing=0.012, val=(0.45, 0.9))
        E.stroke([at(0.16, -hw), at(0.80, -hw)], w=0.018); E.stroke([at(0.16, hw), at(0.80, hw)], w=0.018); E.stroke([at(0.80, -hw), at(0.80, hw)], w=0.018)
        for s in (0.21, 0.25):
            E.stroke([at(s, -0.055), at(s, 0.055)], w=0.018, passes=5)
        bit = [at(0.58, hw), at(0.58, 0.125), at(0.625, 0.125), at(0.625, 0.075), at(0.655, 0.075), at(0.655, 0.105), at(0.695, 0.105),
               at(0.695, 0.075), at(0.725, 0.075), at(0.725, 0.125), at(0.77, 0.125), at(0.77, hw)]
        E.fill(_poly(bit), angle=45, spacing=0.011, val=(0.45, 0.9))
        E.fill(_poly([at(0.58, 0.06), at(0.58, 0.125), at(0.625, 0.125), at(0.625, 0.075), at(0.725, 0.075), at(0.725, 0.125), at(0.77, 0.125), at(0.77, 0.06)]),
               layer="red", angle=-10, spacing=0.008, val=(0.55, 1.0), grain=0)
        E.stroke(bit, w=0.014, passes=4); E.splat([at(0.58, 0.125), at(0.77, 0.125)], n=24, reach=0.04)
        for s, y1 in ((0.60, 0.09), (0.745, 0.065)):
            x, y = at(s, 0.125); E.drip(x, y, y + y1, w=0.014)
    return E.image()


# ---- the products
def products(kind, src, ink=None, blood=None, light=False):
    """[(rel, PIL RGBA)] of one recipe. `rel` is relative to the assets folder (gothic-apps: to the icon themes folder). Pure."""
    S = Sheet(src); out = []
    if kind in ("relic-sys", "gothic-sys"):     # S24: relic-sys (old name gothic-sys)
        for name in SYS:
            for px in SYS_TIERS:
                if px < FLOOR.get(name, 0):
                    continue
                for state in SYS_STATES[name]:
                    im = S.sys_icon(name, state, px)
                    out += [(f"relic/sys/bar/{px}/{state}{suf}.png", im) for suf in ("", ".light")]
    elif kind in ("ws-symbols", "ws-gothic"):     # S24: ws-symbols (old name ws-gothic)
        for px in WS_TIERS:
            for n in range(1, 11):
                for st in STATES:
                    dark, lite = S.ws_tile(n, st, px), S.ws_tile(n, st, px, light=True)
                    out += [(f"workspaces/bar/{px}/ws-symbols-{n}-{st}.png", dark), (f"workspaces/bar/{px}/ws-symbols-{n}-{st}.light.png", lite)]
        import ito_sh                                           # the picker's numeral-free card art (ws-symbols-preview-active)
        out += ito_sh.previews("symbols", lambda n, st, px, lt: S.ws_tile(n, st, px, light=lt), WS_TIERS)
    elif kind in ("relic-apps", "gothic-apps"):     # S24: relic-apps (old name gothic-apps)
        ink = ink or INK; blood = blood or BLOOD
        for name in APPS:
            for px in APP_SIZES:
                im = recolour(S.app_icon(name, px, light), ink, blood)
                out += [(f"Ito-verse-icons-v2/{px}x{px}/apps/{nm}.png", im) for nm in APP_NAMES[name]]
    else:
        raise ValueError(f"unknown gothic recipe {kind}")
    return out


def recolour(im, ink, blood):
    """bake the recipe's neutral ink and blood into the theme's own tokens (apps are drawn by GTK, there is no shader)."""
    a = np.asarray(im, np.float32).copy()
    isblood = (a[..., 0] - a[..., 1]) > 60
    a[..., :3] = np.where(isblood[..., None], np.array(blood, np.float32), np.array(ink, np.float32))
    return Image.fromarray(a.astype(np.uint8), "RGBA")


def index_theme():
    return ("[Icon Theme]\nName=IKAI icons v2\nComment=IKAI app icons from your shell asset sheet\nInherits=Ito-verse-icons,Adwaita,hicolor\n"
            "Directories=" + ",".join(f"{s}x{s}/apps" for s in APP_SIZES) + "\n\n" +
            "".join(f"[{s}x{s}/apps]\nSize={s}\nContext=Applications\nType=Fixed\n\n" for s in APP_SIZES))

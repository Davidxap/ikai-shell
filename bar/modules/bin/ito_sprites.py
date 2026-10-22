#!/usr/bin/env python3
"""ito_sprites -- menu marks, a workspace family and indicator versions cut from the user's sprite sheet (SHASSETS.png, 1920x1080).

Pure functions on numpy / Pillow: nothing is read or written here (bin/ito-assets `recipe sprites` does that, into the user's assets folder only).
The sheet arrives through `set_source(img)`; every piece is cut at the sheet's own resolution and only ever area-reduced to a tier (the 512 master
of a mark is the one exception: it is the native cut enlarged, used only above 147 px). Output follows the recipe convention of ito_sh: coverage
layers {ink, blood, mid} encoded by `ito_sh.to_rgba` as neutral grey + the recipe red, which the shell's theme shader moves onto the theme's
foreground / accent. A `.light` twin is the positive print for light grounds. No opaque black ground anywhere.

Products (paths relative to the assets folder):
  marks/{pyramid-roundel,moth,eye-roundel,key}[.light].png + marks/bar/<px>/...  menu marks (picker keys pyramid-roundel, moth, eye-roundel, key)
  (the workspace family `pyramid` moved to ito_pyramid: the user's HD side view, recipe pyramid-head; ws_pyramid here is the kept front view)
  hollow/bar/<px>/{cassette-on,cassette-off,cup-on,cup-off,key}[.light].png          indicator versions (record: cassette; awake: cup) and the key
  hollow/bar/<px>/<skin>[.light].png                                              S17e `shPack` widget skins (clock spiral, notification eye x4,
                                                                                 night moth on/off, low-battery pyramid, Welcome sign x2)
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import ito_sh as S

SRC_SIZE = (1920, 1080)
TIERS = S.TIERS
STATES = S.STATES
_SRC = {}
_CACHE = {}


def set_source(img):
    """img: the sprite sheet (PIL, 1920x1080, RGBA: the sprites are cut out on a transparent ground)."""
    if img.size != SRC_SIZE:
        raise ValueError(f"the sprites recipe takes the {SRC_SIZE[0]}x{SRC_SIZE[1]} sprite sheet; this is {img.size[0]}x{img.size[1]}")
    _SRC["S"] = img.convert("RGBA")
    _CACHE.clear()


def _sheet():
    if "S" not in _SRC:
        raise ValueError("needs your sprite sheet (SHASSETS.png, 1920x1080)")
    return _SRC["S"]


# ---- geometry measured on the sheet (sheet px). Rings fitted by least squares on the red ring / the alpha edge. ----------------------------
ROUNDEL = dict(c=(250.06, 792.08), R=126.6, H=152)        # Pyramid roundel: disc centre, radius; H = half side of the square cut (tip and tick fit)
MOTH = dict(c=(266.97, 227.98), R=135.9, H=190)           # Moth: the red ring's centre and radius; the wings reach 188 px out
EYE = dict(c=(1725.5, 181.5), H=75)                       # Eye roundel: the stitched ring's box centre
PYRAMID = (190, 430, 336, 606)                             # the pyramid (outer triangle, inner window, ticks)
TAPE = (948, 332, 1127, 450)                               # the cassette
KEY = (993, 68, 1067, 252)                                 # the key


def _cut(box):
    """(L, red, alpha) of a sheet box at native resolution, float 0..1 (L and red of the straight colour)."""
    a = np.asarray(_sheet().crop(tuple(int(round(v)) for v in box)), np.float32) / 255
    rgb, al = a[..., :3], a[..., 3]
    return S.lumf(rgb), S.redf(rgb), al


def _square(c, H):
    return (c[0] - H, c[1] - H, c[0] + H, c[1] + H)


def _levels(L, al, lo_p=3, hi_p=99.5):
    m = al > 0.5
    lo, hi = np.percentile(L[m], [lo_p, hi_p]) if m.any() else (0.0, 1.0)
    return np.clip((L - lo) / max(hi - lo, 1e-3), 0, 1)


def _disc(n, cx, cy, r, ss=8):
    """anti-aliased disc coverage on an n x n grid (centre and radius in grid px)."""
    m = Image.new("L", (n * ss, n * ss), 0)
    ImageDraw.Draw(m).ellipse(((cx - r) * ss, (cy - r) * ss, (cx + r) * ss, (cy + r) * ss), fill=255)
    return np.asarray(m.resize((n, n), Image.BOX), np.float32) / 255


def _ring(px, cx, cy, r, w, ss=8):
    m = Image.new("L", (px * ss, px * ss), 0)
    ImageDraw.Draw(m).ellipse(((cx - r) * ss, (cy - r) * ss, (cx + r) * ss, (cy + r) * ss), outline=255, width=max(1, int(round(w * ss))))
    return np.asarray(m.resize((px, px), Image.BOX), np.float32) / 255


def _finish(i, px, micro_lo=0.12, micro_hi=0.80):
    i = np.clip(S.usm(i, 0.6, 0.55 if px < 40 else 0.30), 0, 1)
    return S.curve(i, micro_lo, micro_hi) if px < 40 else i


# ---- (1) Pyramid roundel: the disc centred on the tile, a clean blood ring drawn on the tier's own grid, the helmet's tip breaking out above ---
def pyramid_roundel(px, light=False):
    c, R, H = ROUNDEL["c"], ROUNDEL["R"], ROUNDEL["H"]
    L, red, al = _cut(_square(c, H))
    n = L.shape[0]
    disc = _disc(n, H, H, R - 1.5)
    tone = _levels(L, al * disc, 4, 99.5) ** 0.85
    # outside the disc only the narrow band of the helmet's tip (above) and the tick (below) stays
    yy, xx = np.mgrid[0:n, 0:n] + 0.5
    band = np.clip(1 - (np.abs(xx - H) - 0.06 * n) / 4.0, 0, 1) * (np.hypot(xx - H, yy - H) > R - 2)
    keep = np.clip(disc + band, 0, 1) * al
    if not light:
        ink_n = tone * keep * (1 - red)
    else:
        ink_n = ((1 - tone) ** 1.6) * 0.90 * keep * (1 - red)
    blood_n = S.curve(red, 0.15, 0.6) * keep * band               # the tick's red; the ring itself is redrawn below
    k = n / px
    ink = S.area(np.clip(S.usm(ink_n, 0.8 * k, 0.8), 0, 1), px)
    bl = S.area(blood_n, px)
    ink = _finish(ink, px, 0.10, 0.85)
    # the ring: centred exactly on the tile (px / 2), radius from the measured disc, never thinner than 1 device px
    rr = R / (2 * H) * px
    w = max(1.0, 0.030 * px)
    ring = _ring(px, px / 2, px / 2, rr, w)
    bl = np.maximum(bl * (0.9 if px >= 36 else 0.0), ring)
    if px < 36:                                                    # micro: the tick below as a whole-px line, the helmet's tip as a whole-px apex above the ring
        tk = np.zeros((px, px), np.float32)
        x = int(px // 2) - (1 if px % 2 == 0 else 0)
        wd = 2 if px % 2 == 0 and px >= 30 else 1
        y0, y1 = int(round(px / 2 + rr)), min(px, int(round(px / 2 + rr + max(1.5, 0.06 * px))) + 1)
        tk[y0:y1, x:x + wd] = 1.0
        bl = np.maximum(bl, tk)
        ap = np.zeros((px, px), np.float32)
        yt = int(round(px / 2 - rr))
        for j, y in enumerate(range(max(0, yt - 2), yt + 1)):          # two rows above the ring: 1 px, then 2 px wide (the helmet's point)
            ap[y, x:x + (wd if j == 0 else wd + 1)] = 1.0 if j else 0.85
        ink = np.maximum(ink, ap * (1 - tk))
    return {"ink": ink * (1 - bl), "blood": bl}


# ---- (2) Moth: centred on its own red ring; the ring and the wing eyes are the blood ---------------------------------------------------
def moth(px, light=False):
    c, H = MOTH["c"], MOTH["H"]
    L, red, al = _cut(_square(c, H))
    tone = _levels(L, al * (1 - red), 3, 99.6)
    k = L.shape[0] / px
    bl = S.area(S.curve(red, 0.10, 0.55) * al, px)
    bl = S.curve(bl, 0.06, 0.45) if px < 48 else np.clip(bl * 1.15, 0, 1)
    fig = S.curve(al * (1 - S.curve(red, 0.1, 0.5)), 0.55, 0.9)        # the moth's own body and wings (the ring is blood, not figure)
    if not light:                                                    # as the beetle: light parts bone, the dark wing a mid tone, a 1-px bone rim
        lt = tone ** 0.9 * fig
        ink = _finish(S.area(np.clip(S.usm(lt, 0.8 * k, 0.7), 0, 1), px), px, 0.10, 0.82)
        F = S.area(fig, px)
        ink = np.maximum(ink, S.rim_of(S.curve(F, 0.3, 0.6)) * (0.70 if px < 48 else 0.5))
        mid = S.curve(F, 0.2, 0.6) * (1 - ink) * 0.55
        return {"mid": mid * (1 - bl), "ink": ink * (1 - bl), "blood": bl}
    ink_n = ((1 - tone) ** 1.5) * 0.92 * al * (1 - red) * S.curve(S.gblur(al, 2.0), 0.5, 0.9)
    ink = _finish(S.area(np.clip(S.usm(ink_n, 0.8 * k, 0.7), 0, 1), px), px, 0.10, 0.82)
    return {"ink": ink * (1 - bl), "blood": bl}


# ---- (3) Eye roundel: the stitched ring and the eye; the iris is the blood ------------------------------------------------------------
def eye_roundel(px, light=False):
    c, H = EYE["c"], EYE["H"]
    L, red, al = _cut(_square(c, H))
    tone = _levels(L, al * (1 - red), 3, 99.6)
    if not light:
        ink_n = tone ** 0.85 * al * (1 - red)
    else:
        ink_n = ((1 - tone) ** 1.9) * 0.85 * al * (1 - red) * S.curve(S.gblur(al, 1.5), 0.5, 0.9)
    k = L.shape[0] / px
    ink = S.area(np.clip(S.usm(ink_n, 0.7 * k, 0.6), 0, 1), px)
    bl = S.area(S.curve(red, 0.08, 0.5) * al, px)
    ink = _finish(ink, px, 0.10, 0.82)
    bl = S.curve(bl, 0.05, 0.42) if px < 48 else np.clip(bl * 1.1, 0, 1)
    return {"ink": ink * (1 - bl), "blood": bl}


# ---- (3b) Key mark: the key upright on a square tile, bow up; under 40 px the shaft is held at 2 px and the bow's three holes read as one ------
def _key_native():
    """(tone, red, alpha, holes) of the key cropped to its own box, at native resolution; holes = the transparent eyes inside the bow."""
    if "KEY" not in _CACHE:
        L, red, al = _cut(KEY)
        ys, xs = np.nonzero(al > 0.5)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        L, red, al = L[y0:y1, x0:x1], red[y0:y1, x0:x1], al[y0:y1, x0:x1]
        solid = Image.fromarray(((al > 0.5) * 255).astype(np.uint8)).convert("L")
        pad = Image.new("L", (solid.width + 2, solid.height + 2), 0)
        pad.paste(solid, (1, 1))
        ImageDraw.floodfill(pad, (0, 0), 128)
        holes = (np.asarray(pad, np.uint8)[1:-1, 1:-1] == 0).astype(np.float32)
        _CACHE["KEY"] = (_levels(L, al, 3, 99.5), red, al, holes)
    return _CACHE["KEY"]


def key_mark(px, light=False):
    tone, red, al, holes = _key_native()
    h, w = al.shape
    th = max(8, int(round((0.90 if px < 40 else 0.86) * px)))
    tw = max(4, int(round(w * th / h)))
    k = h / th
    x0, y0 = (px - tw) // 2, (px - th) // 2

    def put(m):
        z = np.zeros((px, px), np.float32)
        z[y0:y0 + th, x0:x0 + tw] = S.area(m, tw, th)
        return z

    if px < 40:                                                        # micro: the silhouette thickened so the shaft is >= 2 device px
        r = max(0.0, (2.1 * k - 15.0) / 2)
        if r > 0.5:
            al = np.asarray(Image.fromarray((al * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * int(round(r)) + 1)), np.float32) / 255
    if not light:
        ink_n = (0.55 + 0.45 * tone) * al * (1 - red * 0.4)
    else:
        ink_n = (0.50 + 0.45 * (1 - tone)) * al
    I = _finish(put(np.clip(S.usm(ink_n, 0.6 * k, 0.6), 0, 1)), px, 0.10, 0.80)
    F = put(al)
    I = np.maximum(I, S.rim_of(S.curve(F, 0.3, 0.6)) * (0.9 if px < 48 else 0.6))
    if px < 40:                                                        # the bow's eye: the three holes as one hollow, at least 2 x 1.5 device px
        ys, xs = np.nonzero(holes > 0.5)
        cy, cx = (ys.min() + ys.max() + 1) / 2 / k + y0, (xs.min() + xs.max() + 1) / 2 / k + x0
        ry, rx = max(0.8, (ys.max() + 1 - ys.min()) / 2 / k), max(1.1, (xs.max() + 1 - xs.min()) / 2 / k)
        ss = 8
        m = Image.new("L", (px * ss, px * ss), 0)
        ImageDraw.Draw(m).ellipse(((cx - rx) * ss, (cy - ry) * ss, (cx + rx) * ss, (cy + ry) * ss), fill=255)
        I = I * (1 - np.asarray(m.resize((px, px), Image.BOX), np.float32) / 255)
    else:
        I = I * (1 - S.curve(put(holes), 0.3, 0.7))
    bl = S.curve(put(S.curve(red, 0.12, 0.5) * al), 0.10, 0.5) * (0.85 if px >= 40 else 0.0)
    return {"ink": I * (1 - bl), "blood": bl}


MARKS = {"pyramid-roundel": pyramid_roundel, "moth": moth, "eye-roundel": eye_roundel, "key": key_mark}


def _master(fn, light):
    """the 512 master: the native cut drawn at the largest size it has (its own pixels), enlarged with Lanczos to 512 (shown only above 147 px)."""
    nat = {"pyramid-roundel": 2 * ROUNDEL["H"], "moth": 2 * MOTH["H"], "eye-roundel": 2 * EYE["H"], "key-mark": KEY[3] - KEY[1]}[fn.__name__.replace("_", "-")]
    im = S.to_rgba(fn(int(nat), light))
    return im.resize((512, 512), Image.LANCZOS)


# ---- (4) Workspace family `pyramid`: Pyramid Head himself (the sheet's front view: the rusted helmet on his shoulders), the numeral top-left ---
# Sheet px, measured on an overlay of SHASSETS.png. The figure is cut at the sheet's own resolution and only area-reduced to a tier.
PH_BOX = (1296, 20, 1528, 346)                                   # helmet tip to the upper arms: the helmet on his hulking shoulders
PH_HELM = [(1412, 22), (1333, 228), (1358, 301), (1464, 299), (1502, 208)]     # the helmet: tip, left side face, the front frame's base, right side face
PH_FRONT = [(1412, 22), (1358, 301), (1464, 299)]                # the front plate (the frame around the window)
PH_WIN = [(1412, 60), (1378, 274), (1443, 274)]                  # the inner window (the dark slit with the red veins)
PH_DRIPS = ((1391, 0.86, 0.97), (1411, 0.95, 1.00), (1430, 0.82, 0.95), (1366, None, 0.90), (1456, None, 0.93))   # drips out of the window's base (and, urgent, the frame's corners): sheet x, where they end (share of the tile) active / urgent
PH_H = 0.94                                                       # the figure's share of the tile's height: the rest is where the blood falls


def _poly(shape, pts, ox=0.0, oy=0.0, ss=4):
    h, w = shape
    m = Image.new("L", (w * ss, h * ss), 0)
    ImageDraw.Draw(m).polygon([((x - ox) * ss, (y - oy) * ss) for x, y in pts], fill=255)
    return np.asarray(m.resize((w, h), Image.BOX), np.float32) / 255


def _ph_native():
    """the front view at native resolution: (fig, light, dark, helm, front, win, veins, rust) coverage maps of the PH_BOX cut.
    light / dark = the drawing's bright metal and skin / its shadows (inside the figure); veins = the red inside the window; rust = the red
    streaks on the helmet's iron (outside the window)."""
    if "PH" not in _CACHE:
        L, red, al = _cut(PH_BOX)
        ox, oy = PH_BOX[0], PH_BOX[1]
        fig = S.curve(al, 0.35, 0.85)
        helm = _poly(L.shape, PH_HELM, ox, oy) * fig
        front = _poly(L.shape, PH_FRONT, ox, oy)
        win = _poly(L.shape, PH_WIN, ox, oy)
        tone = _levels(L, fig * (1 - win), 3, 99.5)
        rd = S.curve(red, 0.10, 0.50) * fig
        light = np.clip(tone, 0, 1) ** 0.75 * fig * (1 - win)             # continuous: the metal's whole tonal range, not only its highlights
        dark = np.clip(fig * (1 - win) - light, 0, 1)
        veins = S.curve(S.gblur(rd * win, 0.8), 0.05, 0.45) * win
        rust = rd * helm * (1 - win)
        _CACHE["PH"] = tuple(np.asarray(m, np.float32) for m in (fig, light, dark, helm, front, win, veins, rust))
    return _CACHE["PH"]


def _ph_geom(px):
    """the figure's tile placement: (scale k = sheet px per tile px, x0, y0, tw, th). The figure hangs from the tile's top, nudged right of the numeral."""
    w, h = PH_BOX[2] - PH_BOX[0], PH_BOX[3] - PH_BOX[1]
    th = int(round(PH_H * px))
    tw = int(round(w * th / h))
    x0 = int(round((px - tw) / 2 + 0.07 * px))
    return h / th, x0, 0, tw, th


def _ph_put(m, px):
    k, x0, y0, tw, th = _ph_geom(px)
    z = np.zeros((px, px), np.float32)
    s = S.area(m, tw, th)
    xs, xe = max(0, x0), min(px, x0 + tw)
    z[y0:y0 + th, xs:xe] = s[:, xs - x0:xe - x0]
    return z


def _ph_drips(px, urgent):
    """blood running out of the window's base, over the frame and down into the free space under him: whole-px wide runs, a bead at each end,
    drawn on the tier's own grid. Active: three runs (one under 32 px); urgent: five, from the frame's corners too, to the tile's foot."""
    k, x0, y0, tw, th = _ph_geom(px)
    T = lambda x, y: ((x - PH_BOX[0]) / k + x0, (y - PH_BOX[1]) / k + y0)
    ss = 8
    m = Image.new("L", (px * ss, px * ss), 0); d = ImageDraw.Draw(m)
    w = 1 if px < 40 else max(2, int(round(0.036 * px)))
    for i, (sx, la, lu) in enumerate(PH_DRIPS):
        end = lu if urgent else la
        if end is None or (px < 32 and not urgent and i != 1):
            continue                                                   # micro: one run, centred, so it stays a line and not a smear
        x, ytop = T(sx, PH_WIN[1][1] - 3 if i < 3 else PH_FRONT[1][1] - 3)
        x = round(x - w / 2)                                           # whole device px
        y1 = min(px - 1.2, end * px - 1.0)
        wi = w + (1 if (i == 1 and px >= 28) else 0)                   # the centre run is the heaviest
        if px < 40:
            d.rectangle((x * ss, ytop * ss, (x + wi) * ss - 1, y1 * ss), fill=255)
            r = (wi * 0.5 + 0.45) * ss
        else:                                                          # a run that thins as it falls, then gathers into a tear-shaped bead
            cx0 = (x + wi / 2) * ss
            wt, wb = wi * 1.35 * ss / 2, wi * 0.62 * ss / 2
            d.polygon([(cx0 - wt, ytop * ss), (cx0 + wt, ytop * ss), (cx0 + wb, y1 * ss), (cx0 - wb, y1 * ss)], fill=255)
            r = wi * 0.50 * ss
        cx = (x + wi / 2) * ss
        d.ellipse((cx - r, y1 * ss - r * 1.8, cx + r, y1 * ss + r), fill=255)
    return np.asarray(m.resize((px, px), Image.BOX), np.float32) / 255


def _ph_ticks(px, F):
    """the sheet's red crosshair ticks (from 40 px): two short horizontal ticks aimed at the helmet from both sides at the window's middle,
    whole device px, clear of the silhouette (F) by a 2-px gap."""
    z = np.zeros((px, px), np.float32)
    if px < 40:
        return z
    k, x0, y0, tw, th = _ph_geom(px)
    t = 1 if px < 72 else 2
    y = int(round(((PH_WIN[0][1] + PH_WIN[1][1]) / 2 - PH_BOX[1]) / k + y0)) - t // 2
    xs = np.nonzero(F[y] > 0.3)[0]
    if not len(xs):
        return z
    ln = max(3, int(round(0.06 * px)))
    l, r = xs.min() - 2, xs.max() + 3
    z[y:y + t, max(0, l - ln):max(0, l)] = 1.0
    z[y:y + t, min(px, r):min(px, r + ln)] = 1.0
    return z


def ws_pyramid_flat(n, st, px, light=False):
    """[kept, not shipped: the 2026-10-17 flat version, replaced by ws_pyramid below; backup 2026-10-17-pyramid-ws]
    Pyramid Head, front view, with the numeral top-left. The window carries the state:
    empty    = a cold dead ghost: his silhouette as a thin outline, the window's outline, nothing filled;
    occupied = the solid rusted helmet on his shoulders (bone metal, iron shadows, rust streaks), the window a dark iron slit;
    active   = the window burns blood-red with its veins, the frame's streaks turn to blood and the window bleeds down his chest;
    urgent   = the whole helmet is blood, the window black-red, and it pours: long drips to the tile's foot."""
    fig, lt, dk, helm, front, win, veins, rust = _ph_native()
    k = (PH_BOX[3] - PH_BOX[1]) / px
    F, H, W = _ph_put(fig, px), _ph_put(helm, px), _ph_put(win, px)
    Lt = _ph_put(np.clip(S.usm(S.usm(lt, 0.7 * k, 0.9), 2.5 * k, 0.6), 0, 1), px)
    Dk = _ph_put(dk, px)
    V = _ph_put(veins, px)
    Ru = _ph_put(rust, px)
    micro = px < 40
    Fh = S.curve(F, 0.3, 0.6)
    rim = S.rim_of(Fh)
    if px >= 64:                                                        # a heavier outline at the big tiers: the silhouette stays the strongest line
        rim = np.clip(np.maximum(rim, S.rim_of(np.clip(Fh - rim, 0, 1)) * 0.8), 0, 1)
    tk = _ph_ticks(px, F)
    Wh = S.curve(W, 0.3, 0.7)
    wrim = S.rim_of(Wh) * (1 - rim)
    N, moat = S.numeral(n, px, max(7, int(round(0.28 * px))))
    keep = 1 - moat
    z = 0 * F
    if not light:
        hm0 = S.curve(H, 0.3, 0.6)
        bone = (S.curve(Lt, 0.05, 0.55) if micro else np.clip(Lt * 1.25, 0, 1) ** 0.85) * (0.55 + 0.45 * hm0)              # the helmet's iron is the brightest thing; his body stays in shadow
        bone = np.maximum(bone, rim * 0.95)
        bone = _finish(bone, px, 0.10, 0.80) if micro else bone
        mid = S.curve(Fh * (1 - Wh), 0.2, 0.6) * (1 - bone)
    else:                                                               # the positive print: his shadows are the ink, the bright metal is the ground
        bone = np.maximum(S.curve(Dk, 0.15, 0.75) * 0.95, rim * 0.9)
        bone = _finish(bone, px, 0.10, 0.80) if micro else bone
        mid = S.curve(Fh * (1 - Wh), 0.2, 0.6) * (1 - bone) * 0.55
    if st == "empty":
        ghost = np.maximum(rim * 0.62, wrim * 0.40)
        ghost = np.maximum(ghost, tk * 0.35)
        return {"mid": mid * 0.20 * (1 - ghost) * keep, "ink": ghost * keep + N * moat * 0.7}
    if st == "occupied":
        slit = Wh * (1 - rim)                                            # the window: dark iron, a faint rust in its veins
        ru = np.clip(S.curve(Ru, 0.15, 0.55) * (0 if micro else 0.9) + S.curve(V, 0.2, 0.7) * slit * (0 if micro else 0.6) + tk, 0, 1)
        ink = np.maximum(bone * (1 - slit), N)
        md = mid * (1 - slit)                                            # the slit is hollow: the bar's own ground shows through
        return {"mid": md * keep * (1 - ru), "rust": ru * keep, "ink": ink * keep * (1 - ru) + N * moat}
    drip = _ph_drips(px, st == "urgent") * (1 - Wh) * keep
    if st == "active":
        bf = 0.78 if not light else 0.90                               # a light ground washes a thin blood out to pink
        burn = Wh * (bf + (1 - bf) * S.curve(V, 0.1, 0.6)) if not micro else Wh
        streak = S.curve(Ru, 0.15, 0.50) * (0.95 if not micro else 0.0)
        bl = np.clip(np.maximum(np.maximum(burn, streak), np.maximum(drip, tk)), 0, 1) * keep
        ink = np.maximum(bone * (1 - Wh), N)
        md = mid * (1 - Wh) * 0.9
        return {"mid": md * keep * (1 - bl), "ink": (ink * keep) * (1 - bl) + N * moat, "blood": bl}
    # urgent: the helmet is blood (its own metal texture kept as the blood's strength), the window a black-red core, the body dimmed
    hm = S.curve(H, 0.3, 0.6)
    lo = 0.62 if not light else 0.84                                    # on a light ground a thin blood washes out to pink: the print is denser
    metal = hm * (1 - Wh) * (lo + (1 - lo) * np.clip((Lt if not light else Dk) + rim, 0, 1)) if not micro else hm * (1 - Wh) * np.maximum(0.80 if not light else 0.92, rim)
    cf = 0.45 if not light else 0.78
    core = Wh * (cf + (1 - cf) * S.curve(V, 0.1, 0.6)) if not micro else Wh * (0.55 if not light else 0.85)
    bl = np.clip(np.maximum(np.maximum(metal, core), np.maximum(drip, tk)), 0, 1) * keep
    body = (1 - hm)
    ink = np.maximum(bone * body * 0.85, N)
    md = mid * body * 0.8
    return {"mid": md * keep * (1 - bl), "ink": (ink * keep) * (1 - bl) + N * moat, "blood": bl}


# ---- (4b) Workspace family `pyramid`, textured: the sprite's OWN pixels (the rusted iron, the veined window, the scarred shoulders),
# tone-mapped onto the theme tokens. Grey = its place on the bg..fg line (shadows held at the mid ground, never black), red = the accent.
# The crop follows the tier: the helmet on the shoulder tops under 40 px, down to the shoulders under 72, the whole bust from 72.
PS_FULL = (1290, 15, 1535, 380)                                   # the front view with a margin (sheet px)
PS_CROPS = ((40, (1300, 22, 1524, 318)), (72, (1298, 22, 1526, 346)), (10 ** 6, (1296, 22, 1528, 374)))
PS_WIN = [(1412, 58), (1376, 276), (1446, 276)]                   # the inner window (veined dark red)
PS_RUNS = ((1396, 0.80, 0.97), (1411, 0.92, 1.0), (1427, 0.76, 0.94), (1368, None, 0.88), (1455, None, 0.92))   # drips: sheet x, end (share of the tile) active / urgent
PS_H = 0.94                                                       # the figure's share of the tile's height
_BONE, _BLOOD = 200 / 255, (200 / 255, 16 / 255, 20 / 255)        # ito_sh.TONES ink / blood: what the theme shader moves onto fg / accent


def _ps_native():
    """(alpha, tone, red, vein, window) of the front view at native resolution. tone = the sprite's luminance levelled over the figure
    (shadows lifted: the sprite is dark); red = how much redder than grey a pixel is; vein = the red's own strength."""
    if "PS" not in _CACHE:
        a = np.asarray(_sheet().crop(PS_FULL), np.float32) / 255
        rgb, al = a[..., :3], S.curve(a[..., 3], 0.25, 0.85)
        L = S.lumf(rgb)
        red = S.curve(rgb[..., 0] - np.maximum(rgb[..., 1], rgb[..., 2]), 0.035, 0.20) * al
        lo, hi = np.percentile(L[al > 0.5], [2, 99.6])
        T = np.clip((L - lo) / (hi - lo), 0, 1) ** 0.80
        rlo, rhi = np.percentile(rgb[..., 0][red > 0.5], [5, 99.5])
        V = np.clip((rgb[..., 0] - rlo) / (rhi - rlo), 0, 1)
        win = _poly(L.shape, PS_WIN, PS_FULL[0], PS_FULL[1])
        _CACHE["PS"] = (al, T, red, V, win)
    return _CACHE["PS"]


def _ps_geom(px):
    box = next(b for lim, b in PS_CROPS if px < lim)
    w, h = box[2] - box[0], box[3] - box[1]
    th = int(round(PS_H * px)); tw = int(round(w * th / h))
    return box, h / th, int(round((px - tw) / 2 + 0.07 * px)), 0, tw, th          # nudged right of the numeral, as before


def _ps_put(m, px):
    box, k, x0, y0, tw, th = _ps_geom(px)
    c = m[box[1] - PS_FULL[1]:box[3] - PS_FULL[1], box[0] - PS_FULL[0]:box[2] - PS_FULL[0]]
    z = np.zeros((px, px), np.float32)
    s = S.area(c, tw, th)
    xs, xe = max(0, x0), min(px, x0 + tw)
    z[y0:y0 + th, xs:xe] = s[:, xs - x0:xe - x0]
    return z


def _ps_drips(px, urgent):
    """blood out of the window's base (urgent: the frame's corners too), whole-px runs with a bead, on the tier's own grid."""
    box, k, x0, y0, tw, th = _ps_geom(px)
    T = lambda x, y: ((x - box[0]) / k + x0, (y - box[1]) / k + y0)
    ss = 8
    m = Image.new("L", (px * ss, px * ss), 0); d = ImageDraw.Draw(m)
    w = 1 if px < 40 else max(2, int(round(0.034 * px)))
    for i, (sx, la, lu) in enumerate(PS_RUNS):
        end = lu if urgent else la
        if end is None or (px < 32 and i != 1 and not (urgent and i in (0, 2))):
            continue
        x, ytop = T(sx, 268 if i < 3 else 290)
        x = round(x - w / 2)
        y1 = min(px - 1.2, max(end * px - 1.0, ytop + max(2.5, 0.10 * px)))
        wi = w + (1 if (i == 1 and px >= 28) else 0)
        if px < 40:
            d.rectangle((x * ss, ytop * ss, (x + wi) * ss - 1, y1 * ss), fill=255); r = (wi * 0.5 + 0.45) * ss
        else:
            cx0 = (x + wi / 2) * ss; wt, wb = wi * 1.3 * ss / 2, wi * 0.6 * ss / 2
            d.polygon([(cx0 - wt, ytop * ss), (cx0 + wt, ytop * ss), (cx0 + wb, y1 * ss), (cx0 - wb, y1 * ss)], fill=255); r = wi * 0.5 * ss
        cx = (x + wi / 2) * ss
        d.ellipse((cx - r, y1 * ss - r * 1.8, cx + r, y1 * ss + r), fill=255)
    return np.asarray(m.resize((px, px), Image.BOX), np.float32) / 255


def ws_pyramid(n, st, px, light=False):
    """Pyramid Head from the sprite's own pixels, the numeral top-left. Returns the RGBA tile.
    empty    = a cold ghost of the sprite (grey, low alpha, no red);
    occupied = the full textured sprite: iron and flesh on the bone ramp, the window dark crimson with its veins (light: the window is ink);
    active   = the window burns blood-red, its veins brightest, and bleeds down his chest;
    urgent   = the whole sprite flooded in blood (its texture kept as the blood's strength), long drips to the tile's foot."""
    al, T, red, V, win = _ps_native()
    micro = px < 40
    A = np.clip(_ps_put(al, px), 0, 1)
    Rs = _ps_put(red, px)
    Tt = _ps_put(T * al, px) / np.maximum(A, 1e-4)
    Rt = np.clip(Rs / np.maximum(A, 1e-4), 0, 1)
    Vt = np.clip(_ps_put(V * red, px) / np.maximum(Rs, 1e-4), 0, 1)
    Wt = _ps_put(win, px)
    Tt = np.clip(S.usm(S.usm(Tt, 0.6, 0.9 if micro else 0.8), 1.6 if micro else 2.4, 0.45), 0, 1)      # the texture survives the reduction
    N, moat = S.numeral(n, px, max(7, int(round(0.28 * px))))
    keep = 1 - moat
    tone = (0.27 + 0.73 * Tt) if not light else (0.28 + 0.72 * (1 - Tt) ** 0.9)      # light: the print (his shadows are the ink)
    a, g = A, tone
    if st == "empty":
        g = (0.42 + 0.30 * Tt) if not light else (0.30 + 0.35 * (1 - Tt))
        a, w, rv = A * (0.42 if not light else 0.40), 0 * A, 0 * A
    elif st == "occupied":
        Wn = S.curve(Wt, 0.25, 0.75)
        if not light:
            w = np.clip(np.maximum(Rt * 0.75, Wn * 0.72), 0, 1); rv = 0.55 + 0.35 * Vt * Rt
        else:
            w = np.clip(Rt * 0.7 * (1 - Wn) + Wn * S.curve(Vt * Rt, 0.25, 0.7) * 0.9, 0, 1); rv = 0.92 + 0.08 * Vt
    elif st == "active":
        burn = S.curve(Wt, 0.3, 0.7)
        w = np.clip(np.maximum(Rt, burn * 0.92), 0, 1)
        rv = (0.68 + 0.32 * np.clip(Vt * Rt + burn * 0.25, 0, 1) ** 0.7) if not light else np.ones_like(A)
        D = _ps_drips(px, False) * keep
        a = np.maximum(a, D); w = np.maximum(w, D); rv = np.maximum(rv, D)
    else:
        Wn = S.curve(Wt, 0.25, 0.75)
        w = np.ones_like(A)
        rv = ((0.56 + 0.30 * Tt) * (1 - Wn) + Wn * (0.55 + 0.25 * Vt * Rt)) if not light else ((0.66 + 0.30 * (1 - Tt)) * (1 - Wn) + Wn * (0.95 + 0.05 * Vt))
        D = _ps_drips(px, True) * keep
        if px >= 40:                                                    # a dark lip on each run so it reads over the flooded chest
            lip = np.clip(S._dl(D, 1) - D, 0, 1) * A
            rv = rv * (1 - lip) + lip * 0.55
        a = np.maximum(a, D); rv = rv * (1 - D) + D
    a = a * keep + N * moat * (0.7 if st == "empty" else 1.0)
    g = g * (1 - moat) + moat; w = w * (1 - moat)
    a, g, w, rv = (np.clip(x, 0, 1) for x in (a, g, w, rv))
    gr = g * _BONE
    out = np.dstack([gr * (1 - w) + rv * c * w for c in _BLOOD] + [a])
    return Image.fromarray((out * 255 + 0.5).astype(np.uint8), "RGBA")


# ---- (5) Indicators: the cassette (recording) and the cup in the cassette's weathered style (stay awake) ---------------------------------
def _fit_wide(m, px, wfrac=0.96):
    """a wide native map fitted to the tile's width, centred."""
    h, w = m.shape
    tw = max(4, int(round(wfrac * px)))
    th = max(2, int(round(h * tw / w)))
    if th > px:
        th = px; tw = int(round(w * th / h))
    z = np.zeros((px, px), np.float32)
    x0, y0 = (px - tw) // 2, (px - th) // 2
    z[y0:y0 + th, x0:x0 + tw] = S.area(m, tw, th)
    return z, (x0, y0, tw, th)


TAPE_REELS = [(47.0, 51.0), (127.0, 51.0)]                        # the two reel windows in the TAPE box (sheet px), radius 11.5


def cassette(on, px, light=False):
    """the cassette as one solid weathered shell (texture floor, as the pyramid), the two reel windows hollow; on = the reels fill with blood,
    the shell's own spatter bleeds (from 40 px) and a red light burns at the top right corner."""
    L, red, al = _cut(TAPE)
    h, w = L.shape
    yy, xx = np.mgrid[0:h, 0:w] + 0.5
    reels = np.zeros((h, w), np.float32)
    for cx, cy in TAPE_REELS:
        reels = np.maximum(reels, np.clip(11.5 - np.hypot(xx - cx, yy - cy) + 0.5, 0, 1))
    shell = S.curve(al, 0.5, 0.9) * (1 - reels)
    tone = _levels(L, shell, 3, 99.5)
    tex = tone if not light else 1 - tone
    I, box = _fit_wide(shell * ((0.45 + 0.55 * tex) if not light else (0.28 + 0.52 * tex)), px)
    F, _ = _fit_wide(shell, px)
    I = np.maximum(_finish(I, px, 0.08, 0.85), S.rim_of(S.curve(F, 0.3, 0.6)) * 0.9)
    Rl, _ = _fit_wide(reels, px)
    I = I * (1 - S.curve(Rl, 0.3, 0.7))
    if not on:
        return {"ink": I}
    Bm, _ = _fit_wide(S.curve(red, 0.15, 0.55) * shell, px)
    bl = np.maximum(S.curve(Bm, 0.15, 0.5) * (0.85 if px >= 40 else 0.0), S.curve(Rl, 0.2, 0.6))
    x0, y0, tw, th = box
    r = max(1.2, 0.065 * px)
    bl = np.maximum(bl, _disc(px, x0 + tw - r - 0.06 * tw, y0 + r + 0.10 * th, r))
    return {"ink": I * (1 - bl), "blood": bl}


def _tape_skin():
    """the cassette shell's weathered surface (grey wear + its blood spatter), from the label band: (tone, red) at native resolution."""
    if "SKIN" not in _CACHE:
        L, red, al = _cut((TAPE[0] + 18, TAPE[1] + 12, TAPE[2] - 18, TAPE[1] + 42))
        tone = _levels(L, al, 3, 99.5)
        _CACHE["SKIN"] = (np.tile(tone, (4, 2)), np.tile(red, (4, 2)))
    return _CACHE["SKIN"]


def cup(on, px, light=False):
    """a mug drawn on a 64-unit grid in the cassette's skin: worn grey shell, its blood spatter, a bone rim; on = blood coffee to the brim,
    one drip down the side and two wisps of steam; off = empty (the rim shows the dark inside), no steam."""
    U = 64.0
    ss = 6
    G = int(round(px * ss))
    s = G / U
    m_body = Image.new("L", (G, G), 0); m_rim = Image.new("L", (G, G), 0); m_in = Image.new("L", (G, G), 0)
    m_hand = Image.new("L", (G, G), 0); m_sau = Image.new("L", (G, G), 0); m_drip = Image.new("L", (G, G), 0); m_steam = Image.new("L", (G, G), 0)
    db, dr, di, dh, dsa, dd, dst = (ImageDraw.Draw(x) for x in (m_body, m_rim, m_in, m_hand, m_sau, m_drip, m_steam))
    top, bot, xl, xr = 22, 54, 10, 46                              # the body: slightly tapered to the foot
    db.polygon([(xl * s, top * s), (xr * s, top * s), ((xr - 3) * s, (bot - 2) * s), ((xr - 6) * s, bot * s), ((xl + 6) * s, bot * s), ((xl + 3) * s, (bot - 2) * s)], fill=255)
    db.ellipse((xl * s, (top - 4) * s, xr * s, (top + 4) * s), fill=255)
    dr.ellipse((xl * s, (top - 4) * s, xr * s, (top + 4) * s), outline=255, width=max(1, int(2.2 * s)))
    di.ellipse(((xl + 2.2) * s, (top - 2.2) * s, (xr - 2.2) * s, (top + 2.2) * s), fill=255)
    dh.ellipse(((xr - 4) * s, 27 * s, (xr + 12) * s, 45 * s), outline=255, width=max(1, int(4.2 * s)))
    dsa.ellipse((4 * s, (bot - 2) * s, 52 * s, (bot + 5) * s), outline=255, width=max(1, int(2.6 * s)))
    if on:
        dd.line(((xl + 8) * s, (top + 2) * s, (xl + 8) * s, (top + 15) * s), fill=255, width=max(1, int(2.6 * s)))
        dd.ellipse(((xl + 6.5) * s, (top + 13.5) * s, (xl + 9.5) * s, (top + 17.5) * s), fill=255)
        for x0 in (21, 33):
            pts = [((x0 + 2.6 * math.sin(t / 2.2)) * s, (15 - t) * s) for t in np.linspace(0, 12, 16)]
            dst.line(pts, fill=255, width=max(1, int(2.0 * s)), joint="curve")
    g = lambda im: np.asarray(im.resize((px, px), Image.BOX), np.float32) / 255
    body, rim, inner, hand, sau, drip, steam = (g(x) for x in (m_body, m_rim, m_in, m_hand, m_sau, m_drip, m_steam))
    tone, red = _tape_skin()
    T = S.area(tone, px, px) if tone.shape[0] >= px else np.asarray(Image.fromarray((tone * 255).astype(np.uint8)).resize((px, px), Image.BOX), np.float32) / 255
    Rd = S.area(red, px, px) if red.shape[0] >= px else np.asarray(Image.fromarray((red * 255).astype(np.uint8)).resize((px, px), Image.BOX), np.float32) / 255
    skin = 0.38 + 0.62 * T                                           # the worn shell never drops below a mid tone: the cup stays a solid object
    shell = np.clip(body - inner, 0, 1)
    if not light:
        ink = np.maximum(np.maximum(shell * skin * (1 - Rd * 0.7), rim), np.maximum(hand * 0.95, sau * 0.85))
        ink = np.maximum(ink, steam * 0.85)
    else:
        ink = np.maximum(np.maximum(shell * (0.38 + 0.62 * (1 - T)), rim), np.maximum(hand * 0.95, sau * 0.85))
        ink = np.maximum(ink, steam * 0.85)
    spat = S.curve(Rd, 0.15, 0.6) * shell * (0.85 if px >= 32 else 0.0)
    bl = spat
    if on:
        bl = np.maximum(bl, np.maximum(inner, drip))
    else:
        ink = ink * (1 - inner) + inner * 0.0                          # empty: the inside is the bar's own ground
    return {"ink": np.clip(ink, 0, 1) * (1 - bl), "blood": np.clip(bl, 0, 1)}


def key(px, light=False):
    L, red, al = _cut(KEY)
    tone = _levels(L, al, 3, 99.5)
    if not light:
        ink_n = (0.35 + 0.65 * tone) * al * (1 - red * 0.5)
    else:
        ink_n = (0.45 + 0.5 * (1 - tone)) * al
    h, w = L.shape
    th = max(4, int(round(0.96 * px))); tw = max(2, int(round(w * th / h)))
    z = np.zeros((px, px), np.float32)
    x0, y0 = (px - tw) // 2, (px - th) // 2
    z[y0:y0 + th, x0:x0 + tw] = S.area(np.clip(S.usm(ink_n, 0.6 * h / th, 0.6), 0, 1), tw, th)
    I = _finish(z, px, 0.10, 0.75)
    Bz = np.zeros((px, px), np.float32)
    Bz[y0:y0 + th, x0:x0 + tw] = S.area(S.curve(red, 0.12, 0.5) * al, tw, th)
    bl = S.curve(Bz, 0.10, 0.5) * (0.85 if px >= 40 else 0.0)
    return {"ink": I * (1 - bl), "blood": bl}


# ---- (6) S17e `shPack` widget skins (hollow/bar/<px>/<skin>.png; S24: was sh/bar/<px>/sp-<skin>.png): extra pictures the widgets show only while shPack is on -------------------
# clock = the red spiral; notifications = the eye roundel in four states; night light = the moth; low battery = the small pyramid badge;
# the Welcome sign (plain / bleeding) is a picture for the Control Centre's pack buttons only (its letters read from 64 px, never in the bar).
SP_SPIRAL = dict(c=(677.5, 513.0), H=76)                  # the red spiral (sheet px, alpha box 603-752 x 439-587)
SP_PYR = (190, 432, 336, 604)                              # the small pyramid sigil
SP_SIGN = (1356, 425, 1548, 615)                           # "Welcome to Silent Hill" on its two posts
SP_SIGN_BLEEDING = (1314, 680, 1531, 1009)                 # the same sign, bleeding


def _fit_box(box, px, frac=0.94):
    """(L, red, alpha, put, k) of a sheet box; `put` drops a native map centred on the px tile at `frac` of its longer side."""
    L, red, al = _cut(box)
    h, w = L.shape
    s = frac * px / max(h, w)
    tw, th = max(2, int(round(w * s))), max(2, int(round(h * s)))
    x0, y0 = (px - tw) // 2, (px - th) // 2

    def put(m):
        z = np.zeros((px, px), np.float32)
        z[y0:y0 + th, x0:x0 + tw] = S.area(m, tw, th)
        return z
    return L, red, al, put, h / th


def sp_spiral(px, light=False):
    """the clock's dial: the spiral's arm is the blood, its highlights ink (dark themes), a faint 1-px ink rim keeps the coil apart from the ground."""
    L, red, al, put, k = _fit_box(_square(SP_SPIRAL["c"], SP_SPIRAL["H"]), px, 0.98)
    tone = _levels(L, al, 3, 99.5)
    arm = S.curve(al, 0.35, 0.9)
    bl = np.clip(S.usm(put(S.curve(red, 0.10, 0.5) * arm), 0.7, 0.8 if px < 40 else 0.5), 0, 1)
    bl = S.curve(bl, 0.12, 0.70) if px < 40 else bl
    hi = put(S.curve(tone, 0.55, 0.95) * arm * (1 - S.curve(red, 0.3, 0.8)))
    ink = np.clip(hi * (0.9 if not light else 0.0), 0, 1)
    rim = S.rim_of(S.curve(put(arm), 0.3, 0.6)) * (0.35 if not light else 0.55)
    return {"ink": np.maximum(ink, rim) * (1 - bl), "blood": bl}


def sp_eye(state, px, light=False):
    """notifications: idle = the iris in ink (nothing waiting); open = the iris bleeds (something waiting); alert = iris and ring in blood
    (critical / error); shut = do not disturb / muted: a ghost of the eye with the lid drawn shut (one ink line, lashes hanging off it)."""
    base = eye_roundel(px, light)
    ink, bl = base["ink"], base["blood"]
    if state == "idle":
        return {"ink": np.clip(ink + bl * (0.75 if not light else 0.85), 0, 1)}
    if state == "open":
        return {"ink": ink, "blood": bl}
    if state == "alert":
        n = 2 * EYE["H"]
        yy, xx = np.mgrid[0:n, 0:n] + 0.5
        al = _cut(_square(EYE["c"], EYE["H"]))[2]
        r = np.hypot(xx - n / 2, yy - n / 2) / (n / 2)
        ring = S.area(np.clip((r - 0.70) / 0.08, 0, 1) * al, px)
        b2 = np.clip(np.maximum(bl, ring * 0.95), 0, 1)
        return {"ink": ink * (1 - b2), "blood": b2}
    g = np.clip(ink + bl, 0, 1) * (0.42 if not light else 0.42)
    lid = np.zeros((px, px), np.float32)
    t = 1 if px < 36 else 2
    y = px // 2 - t // 2
    x0, x1 = int(round(px * 0.24)), int(round(px * 0.76))
    lid[y:y + t, x0:x1] = 1.0
    for x in range(x0 + max(2, px // 10), x1 - 1, max(3, px // 6)):
        lid[y + t:y + t + max(1, px // 14), x] = 0.85
    return {"ink": np.maximum(g * (1 - lid), lid)}


def sp_moth(on, px, light=False):
    """night light: on = the moth with its blood ring and wing eyes; off = a grey ghost of it (no blood)."""
    m = moth(px, light)
    if on:
        return m
    out = {"ink": np.clip(m.get("ink", 0) + m.get("blood", 0) * 0.6, 0, 1) * (0.58 if not light else 0.45)}
    if "mid" in m:
        out["mid"] = m["mid"] * 0.30
    return out


def sp_pyramid(px, light=False):
    """the low-battery badge: the small pyramid sigil, window and edges in blood."""
    L, red, al, put, k = _fit_box(SP_PYR, px, 0.96)
    tone = _levels(L, al * (1 - red), 3, 99.5)
    ink_n = ((0.35 + 0.65 * tone) if not light else (0.45 + 0.5 * (1 - tone))) * al * (1 - red)
    ink = _finish(put(np.clip(S.usm(ink_n, 0.6 * k, 0.6), 0, 1)), px, 0.10, 0.80)
    ink = np.maximum(ink, S.rim_of(S.curve(put(al), 0.3, 0.6)) * 0.85)
    bl = put(S.curve(red, 0.10, 0.5) * al)
    bl = S.curve(bl, 0.06, 0.45) if px < 48 else np.clip(bl * 1.15, 0, 1)
    return {"ink": ink * (1 - bl), "blood": bl}


def sp_sign(bleeding, px, light=False):
    """the Welcome sign (Control Centre pack buttons, >= 64 px)."""
    L, red, al, put, k = _fit_box(SP_SIGN_BLEEDING if bleeding else SP_SIGN, px, 0.98)
    tone = _levels(L, al * (1 - red), 3, 99.6)
    ink_n = ((0.25 + 0.75 * tone) if not light else (0.40 + 0.55 * (1 - tone))) * al * (1 - red)
    ink = put(np.clip(S.usm(ink_n, 0.6 * k, 0.6), 0, 1))
    bl = put(S.curve(red, 0.10, 0.5) * al)
    return {"ink": ink * (1 - bl), "blood": bl}


SP_SKINS = {
    "spiral": sp_spiral,
    "eye-idle": lambda px, light=False: sp_eye("idle", px, light),
    "eye-open": lambda px, light=False: sp_eye("open", px, light),
    "eye-alert": lambda px, light=False: sp_eye("alert", px, light),
    "eye-shut": lambda px, light=False: sp_eye("shut", px, light),
    "moth-on": lambda px, light=False: sp_moth(True, px, light),
    "moth-off": lambda px, light=False: sp_moth(False, px, light),
    "pyramid": sp_pyramid,
    "sign": lambda px, light=False: sp_sign(False, px, light),
    "sign-bleeding": lambda px, light=False: sp_sign(True, px, light),
}


# ---- the products ---------------------------------------------------------------------------------------------------------------------
def _d(px): return "marks" if px == 512 else f"marks/bar/{px}"


def products(tiers=TIERS):
    out = []
    for name, fn in MARKS.items():
        for px in tiers:
            out += [(f"{_d(px)}/{name}.png", S.to_rgba(fn(px, False))), (f"{_d(px)}/{name}.light.png", S.to_rgba(fn(px, True)))]
        out += [(f"marks/{name}.png", _master(fn, False)), (f"marks/{name}.light.png", _master(fn, True))]
    for px in tiers:                                    # the workspace family `pyramid` now comes from the side view (ito_pyramid, recipe pyramid-head);
        for on in (True, False):                        # the front view (ws_pyramid above) is kept, not shipped (backup 2026-10-20-pyramid-hd)
            sfx = "on" if on else "off"
            out += [(f"hollow/bar/{px}/cassette-{sfx}.png", S.to_rgba(cassette(on, px, False))), (f"hollow/bar/{px}/cassette-{sfx}.light.png", S.to_rgba(cassette(on, px, True))),
                    (f"hollow/bar/{px}/cup-{sfx}.png", S.to_rgba(cup(on, px, False))), (f"hollow/bar/{px}/cup-{sfx}.light.png", S.to_rgba(cup(on, px, True)))]
        out += [(f"hollow/bar/{px}/key.png", S.to_rgba(key(px, False))), (f"hollow/bar/{px}/key.light.png", S.to_rgba(key(px, True)))]
        for name, fn in SP_SKINS.items():
            out += [(f"hollow/bar/{px}/{name}.png", S.to_rgba(fn(px, False))), (f"hollow/bar/{px}/{name}.light.png", S.to_rgba(fn(px, True)))]
    return out

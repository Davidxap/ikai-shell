#!/usr/bin/env python3
"""ito_ringws -- the ringed workspace language of the user's workspace sheet (silenthillworspaces, cards WS1 and WS2), for any figure.

Pure functions on numpy / Pillow: nothing is read or written here. A figure arrives as tile-resolution maps (alpha, tone, red share, red
strength) made by its own recipe from the user's pixels (ito_pyramid: the HD side view; heather() below: the Heather / Pyramid roundel sheet);
this module only adds the sheet's state language around it, drawn on the tier's own device-px grid (supersampled, then area-reduced):

  empty    = the sheet's INACTIVE card: a cold grey ghost of the figure inside a thin grey ring with crosshair ticks;
  occupied = the sheet's OCCUPIED card: the figure at full strength, the grey ring, and old red scratch bars run down the tile;
  active   = the sheet's ACTIVE card: the ring and its ticks turn to blood and the blood runs off the ring's lower arc (and off the figure);
  urgent   = the whole figure is washed in blood (its texture kept as the blood's strength), the ring bleeds, longer runs to the tile's foot.
  A figure with `iron` in its maps (Pyramid, S14) is never washed: it stays neutral iron, its own blood map `B` and its inner face carry
  the blood (urgent = more of it and a brighter glow), the ring and the runs as above.

Colour (as ito_pyramid): grey = the token's place on the bg..fg line, red = the accent; the theme shader moves both onto the theme. A
`.light` twin is the positive print (the figure's shadows are the ink). No opaque black anywhere (`_no_black`). The numeral is top-left
(ito_sh.numeral) with its moat; the ring sits right of and below it.

Products of the Heather recipe (paths relative to the assets folder):
  workspaces/bar/<px>/ws-heather-<n>-<state>[.light].png      workspace family `heather` (Heather, SH3, from the roundel sheet)
"""
import math
import numpy as np
from PIL import Image, ImageDraw

import ito_sh as S

TIERS = S.TIERS
STATES = S.STATES
SS = 8
BONE, BLOOD = 200 / 255, (200 / 255, 16 / 255, 20 / 255)            # ito_sh.TONES ink / blood


def geom(px):
    """(cx, cy, r): the ring in tile px, right of and below the numeral's corner."""
    return px * 0.545, px * 0.535, px * 0.405


def ring_w(px):
    return 1.0 if px < 40 else max(1.25, 0.022 * px)


def _pad(px):
    m = Image.new("L", (px * SS, px * SS), 0)
    return m, ImageDraw.Draw(m)


def _out(m, px):
    return np.asarray(m.resize((px, px), Image.BOX), np.float32) / 255


def ring(px, seed=0):
    """(ring, ticks) coverage. The ring is broken in a few places like worn paint (from 40 px); the ticks are the sheet's crosshair: left,
    right and bottom, each crossing the ring (the top is the figure's). Under 40 px the ring is one whole device px and the ticks are short."""
    cx, cy, r = geom(px)
    w = ring_w(px)
    m, d = _pad(px)
    box = ((cx - r) * SS, (cy - r) * SS, (cx + r) * SS, (cy + r) * SS)
    gaps = [] if px < 40 else sorted(((a + 37 * seed) % 360, (a + 37 * seed) % 360 + g) for a, g in ((24, 7), (151, 5), (298, 9)))
    a0 = 0
    for g0, g1 in gaps:
        if g0 > a0:
            d.arc(box, a0, g0, fill=255, width=max(1, int(round(w * SS))))
        a0 = g1
    if a0 < 360:
        d.arc(box, a0, 360, fill=255, width=max(1, int(round(w * SS))))
    t, dt = _pad(px)
    tw = max(1, int(round((1.0 if px < 40 else max(1.0, 0.016 * px)) * SS)))
    o, i = (2.2, 1.6) if px < 40 else (0.13 * px, 0.08 * px)          # how far a tick reaches outside / inside the ring
    for ang in ((0, 180, 90) if px >= 40 else ()):                # micro: the ring alone (ticks were clutter at 24-36 px)
        ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
        p0 = (cx + (r - i) * ca, cy + (r - i) * sa)
        p1 = (cx + (r + o) * ca, cy + (r + o) * sa)
        dt.line([(p0[0] * SS, p0[1] * SS), (p1[0] * SS, p1[1] * SS)], fill=255, width=tw)
    R, T = _out(m, px), _out(t, px)
    if px >= 56:                                                   # worn print: the user's grain eats into the ring, never a vector edge
        R = S.distress(R, 11 + seed, 0.35)
    return R, T


def scratches(px, seed, urgent=False):
    """the sheet's occupied card: thin vertical red scratch bars of different lengths and strengths, broken by the grain. Coverage 0..1."""
    rng = np.random.default_rng(1000 + seed)
    k = 2 if px < 40 else 4 if px < 72 else 6
    m, d = _pad(px)
    w = 1.0 if px < 40 else max(1.0, 0.012 * px)
    xs = np.sort(rng.uniform(0.70, 0.97, k)) if px < 40 else np.sort(rng.uniform(0.24, 0.96, k))      # micro: by the ring's right edge, off the face
    for j, x in enumerate(xs):
        y0 = rng.uniform(0.02, 0.45); y1 = min(0.99, y0 + rng.uniform(0.35, 0.70))
        ww = w * rng.uniform(0.8, 1.6)
        v = int(255 * rng.uniform(0.55, 1.0) * (0.6 if px < 40 else 1.0))
        xx = round(x * px) + 0.5 if px < 40 else x * px                 # micro: on the device px grid, a 1-px bar stays sharp
        d.rectangle(((xx - ww / 2) * SS, y0 * px * SS, (xx + ww / 2) * SS, y1 * px * SS), fill=v)
    M = _out(m, px)
    return S.distress(M, 23 + seed, 0.30 if px < 40 else 0.55)


# ---- blood (2026-10-20 redo: the round-headed drips read as mucus). Blood on iron: thin irregular runs that hug the surface they leave and
# fall at different lengths, thinning and breaking as they go (a small tapered tip, never a round head); a spray of fine droplets where it
# struck; dark coagulated edges and a wet core, a pin-point glint on the wide parts. Drawn on the tier's own grid (SS), then area-reduced.
def _noise1(rng, n, knots):
    """smooth 1-D noise, n samples in -1..1 through `knots` random knots (smoothstep between them)."""
    k = rng.uniform(-1, 1, knots + 1)
    t = np.linspace(0, knots, n)
    i = np.minimum(t.astype(int), knots - 1)
    f = t - i
    f = f * f * (3 - 2 * f)
    return k[i] * (1 - f) + k[i + 1] * f


def _ellipse(d, x, y, a, b, ang=90.0):
    """a filled ellipse (tile px, semi-axes a along `ang` degrees, b across) at SS."""
    ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    pts = []
    for i in range(16):
        t = 2 * math.pi * i / 16
        u, v = a * math.cos(t), b * math.sin(t)
        pts.append(((x + u * ca - v * sa) * SS, (y + u * sa + v * ca) * SS))
    d.polygon(pts, fill=255)


def run(d, rng, x, y0, y1, w, px):
    """one run of blood from (x, y0) down to y1 (tile px): it leaves a small smear along the edge it comes off, falls with a slow sway,
    thins irregularly and may break into a trail of beads, and ends in a tapered tip. Under 40 px a straight 1-px line on the device grid."""
    L = y1 - y0
    if L <= 0.5:
        return
    if px < 40:                                                    # micro: a crisp 1-px run (the reduction keeps it whole), no tip
        xx = round(x - 0.5) + 0.5
        d.rectangle(((xx - 0.5 * w) * SS, y0 * SS, (xx + 0.5 * w) * SS - 1, y1 * SS), fill=255)
        return
    n = max(12, int(L * 3))
    t = np.linspace(0, 1, n + 1)
    sway = _noise1(rng, n + 1, max(2, int(L / (0.10 * px)))) * (0.25 * w + 0.008 * px) * (0.2 + t)
    xs = x + sway
    hw = 0.5 * w * (1.05 - 0.55 * t) * (1 + 0.28 * _noise1(rng, n + 1, max(3, int(L / (0.05 * px)))))
    hw = np.maximum(hw, 0.32 * w)
    cut = n + 1
    if L > 0.28 * px and rng.random() < 0.55:                      # the stream breaks: the rest falls as a trail of small beads
        cut = int(n * rng.uniform(0.55, 0.85))
    left = [((xs[i] - hw[i]) * SS, (y0 + t[i] * L) * SS) for i in range(cut)]
    right = [((xs[i] + hw[i]) * SS, (y0 + t[i] * L) * SS) for i in range(cut)]
    d.polygon(left + right[::-1], fill=255)
    _ellipse(d, x, y0 - 0.1 * w, 0.6 * w * rng.uniform(1.0, 1.5), 0.32 * w, rng.uniform(-12, 12))      # the small smear on the edge it leaves
    i_end = cut - 1
    if cut <= n:
        yb = y0 + t[i_end] * L + 1.2 * w
        while yb < y1 - 0.5 * w:                                   # beads: shrinking, uneven gaps
            rb = hw[min(n, int((yb - y0) / L * n))] * rng.uniform(0.7, 1.1)
            _ellipse(d, x + sway[min(n, int((yb - y0) / L * n))], yb, rb * 1.7, rb)
            yb += rng.uniform(1.6, 3.2) * w
    else:                                                          # the tip: a short taper, barely wider than the stream, longer than wide
        rt = hw[-1] * rng.uniform(1.05, 1.35)
        _ellipse(d, xs[-1], y1 - 1.6 * rt, 1.6 * rt, rt)


def spray(d, rng, cx, cy, spread, count, rmax, ang=90.0, px=64):
    """fine droplets where blood struck (around cx, cy, `spread` px): many specks, few drops, the far ones drawn out along `ang`."""
    if px < 40:
        return
    for _ in range(count):
        rr = abs(rng.normal(0, 1)) * spread
        th = math.radians(ang + rng.normal(0, 55))
        x, y = cx + rr * math.cos(th), cy + rr * math.sin(th)
        r = max(0.30, rmax * rng.random() ** 2.4)                   # most are specks; one in a few is a real drop
        e = 1.0 + 1.4 * min(1.0, rr / max(spread, 1e-3)) * rng.random()
        _ellipse(d, x, y, r * e, r, math.degrees(th))


def blood_maps(M, px):
    """coverage M -> (value, glint): value 0..1 = how fresh the blood is (the thin edges coagulate dark, the core stays wet), glint = a
    pin-point highlight on the lit (left) side of the wide parts, from 48 px."""
    if px < 40:
        return np.ones_like(M), 0 * M
    core = np.clip(S.gblur(M, max(0.6, 0.011 * px)) * 1.7 - 0.55, 0, 1)
    edge = np.clip(M - S.gblur(M, 0.7), 0, 1) * S.curve(core, 0.2, 0.6)      # the rim of a wide run or drop: coagulated
    val = np.clip(0.72 + 0.28 * core - 0.55 * edge, 0.35, 1)
    if px < 48:
        return val, 0 * M
    lit = np.clip(core - np.roll(core, 1, 1), 0, 1) * S.curve(core, 0.55, 0.95)
    return val, np.clip(lit * 1.6, 0, 1) * M


def ring_blood(px, urgent, seed=0, extra=()):
    """blood off the ring's lower arc: each run first follows the ring a little way toward its foot, then falls; a spray where the ring was
    struck; plus `extra` runs [(x, y)] the figure hands in. Coverage 0..1 at tile res."""
    cx, cy, r = geom(px)
    m, d = _pad(px)
    rng = np.random.default_rng(4100 + 31 * seed + (7 if urgent else 0))
    w = 1.0 if px < 40 else max(1.3, 0.024 * px)
    angs = ((140,) if not urgent else (40, 140)) if px < 40 else ((38, 142) if not urgent else (22, 50, 128, 156, 104))
    rw = ring_w(px)
    for j, a in enumerate(angs):
        a = a + 4 * rng.uniform(-1, 1)
        if px >= 40:                                               # it hugs the ring toward the foot before it lets go
            hug = rng.uniform(5, 14) * (1 if a < 90 else -1)
            box = ((cx - r) * SS, (cy - r) * SS, (cx + r) * SS, (cy + r) * SS)
            a0, a1 = (a, a + hug) if hug > 0 else (a + hug, a)
            d.arc(box, a0, a1, fill=255, width=max(1, int(round((rw + 0.5 * w) * SS))))
            a = a + hug
        x, y = cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))
        lo, hi = (0.75, 1.0) if urgent else (0.45, 0.95)           # a share of the room left under it: never a comb of equal runs
        y1 = min(px - 0.6, max(y + (px - 0.6 - y) * rng.uniform(lo, hi), y + 2.5))
        run(d, rng, x, y, y1, w * rng.uniform(0.75, 1.25), px)
        if px >= 40 and (urgent or j == 0):
            spray(d, rng, x, y, 0.09 * px, 10 if urgent else 6, max(0.6, 0.016 * px), 90, px)
    for j, (x, y) in enumerate(extra):
        lo, hi = (0.80, 1.0) if urgent else (0.40, 0.92)
        y1 = min(px - 0.6, max(y + (px - 0.6 - y) * rng.uniform(lo, hi), y + 2.5))
        run(d, rng, x, y, y1, w * rng.uniform(0.7, 1.15), px)
        if px >= 40 and (urgent or j == 1):
            spray(d, rng, x, y + 0.04 * px, 0.08 * px, 12 if urgent else 7, max(0.6, 0.015 * px), 90, px)
    return _out(m, px)


def _over(layers):
    """[(alpha, rgb HxWx3)] composited 'over' in order -> straight RGBA float."""
    acc = None
    for a, c in layers:
        a = np.clip(a, 0, 1)
        if acc is None:
            acc, al = c * a[..., None], a.copy()
            continue
        acc = c * a[..., None] + acc * (1 - a[..., None]); al = a + al * (1 - a)
    rgb = np.where(al[..., None] > 1e-4, acc / np.maximum(al[..., None], 1e-4), 0)
    return np.dstack([rgb, al])


def _col(g, w, rv):
    return np.dstack([g * BONE * (1 - w) + rv * c * w for c in BLOOD])


def _no_black(out, floor=0.165):
    lu = 0.3 * out[..., 0] + 0.59 * out[..., 1] + 0.11 * out[..., 2]
    k = np.where(lu < floor, floor / np.maximum(lu, 1e-3), 1.0)
    rgb = np.clip(out[..., :3] * k[..., None], 0, 1)
    rgb = np.where((lu < 1e-3)[..., None], floor, rgb)
    return np.dstack([rgb, out[..., 3]])


def _blood_layers(D, px, light):
    """[(alpha, rgb)] of fresh blood with coverage D: on a dark ground the coagulated edges sink toward the ground and the wet core is full
    blood; on the positive print the edges darken into the ink (the theme shader mixes ink and blood); the glint is the ground's own light."""
    z = 0 * D
    val, gl = blood_maps(D, px)
    if not light:
        lay = [(D, _col(z, 1 + z, val))]
        if gl.any():
            lay.append((gl * 0.75, _col(0.98 + z, z, z)))
        return lay
    return [(D * (1 - 0.70 * gl), _col(1 + z, np.clip(0.30 + 0.70 * val ** 2, 0, 1), 1 + z))]


def compose(F, n, st, px, light=False, behind=True, extra_runs=()):
    """F = dict(A alpha, T tone 0..1, R red share, V red strength) at tile res. behind = the ring passes behind the figure (Pyramid: the
    helmet's tip pierces it, as on the sheet); otherwise it lies over the figure's edge (a clipped portrait). Returns the RGBA tile."""
    A, T = F["A"], F["T"]
    R, V = F.get("R", 0 * A), F.get("V", 0 * A)
    micro = px < 40
    N, moat = S.numeral(n, px, max(7, int(round(0.28 * px))))
    keep = 1 - moat
    RG, TK = ring(px, n)
    RG = np.maximum(RG, TK)
    rim = S.rim_of(S.curve(A, 0.3, 0.6)) if micro and F.get("rim", True) else 0 * A
    if not light:
        tone = np.maximum(0.26 + 0.74 * T ** 0.8, rim * 0.92)
    else:
        tone = np.maximum(0.30 + 0.70 * (1 - T) ** 0.85, rim * 0.95)
    z = 0 * A
    if F.get("iron") and st != "empty":                            # Pyramid (S14): the mark's treatment. The figure stays neutral iron; blood
        B = (F["B"] if st != "urgent" else np.clip(np.maximum(F["B"], 1.8 * S.gblur(F["B"], 0.9)), 0, 1)) * (1 - rim)    # only where it bleeds (its vivid
        Fn = F["coremask"]                                         # spatter), the inner face glows from within (dark blood, veins brighter)
        rv = (0.55 + 0.30 * V) if st == "occupied" else (0.72 + 0.28 * V)
        w = B * (0.80 if st == "occupied" else 1.0)
        if st != "occupied":
            vein = np.clip((F["burnv"] - 0.55) / 0.45, 0, 1) if not micro else 0.35 + 0.55 * S.curve(T, 0.15, 0.85)    # its scratches burn; between
            if st == "urgent":                                     # them the hollow stays dark iron: never a flat fill of the whole face
                vein = np.clip(vein * 1.4 + 0.15, 0, 1)
            w = np.where(Fn > 0.05, np.maximum(w, Fn * ((0.30 + 0.70 * vein) if not light else vein ** 1.5)), w)
            rv = np.where(Fn > 0.05, (0.55 + 0.45 * vein) if not light else 1.0, rv)
        if light:
            rv = np.where(Fn > 0.05, rv, np.maximum(rv, 0.85))
        fig = (A, _col(tone, w, rv))
        if st == "occupied":
            rng_ = (RG * 0.9, _col(0.85 + z, z, z))
            extra = [(scratches(px, n) * keep * (0.85 if not light else 0.80), _col(z, 1 + z, (0.62 if not light else 0.90) + z))]
        else:
            rng_ = (RG, _col(z, 1 + z, 1 + z))
            extra = _blood_layers(ring_blood(px, st == "urgent", n, extra_runs) * keep, px, light)
    elif st == "empty":
        g = np.maximum((0.40 + 0.32 * T) if not light else (0.30 + 0.38 * (1 - T)), rim * 0.75)
        fig = (A * (0.42 if not light else 0.40), _col(g, z, z))
        rng_ = (RG * 0.55, _col(0.62 + z, z, z))
        extra = []
    elif st == "occupied":
        w = np.clip(R * (0.62 if not light else 0.55), 0, 1) * (1 - rim)
        rv = (0.40 + 0.35 * V) if not light else (0.80 + 0.20 * V)
        fig = (A, _col(tone, w, rv))
        rng_ = (RG * 0.9, _col(0.85 + z, z, z))
        SC = scratches(px, n) * keep
        extra = [(SC * (0.85 if not light else 0.80), _col(z, 1 + z, (0.62 if not light else 0.90) + z))]
    elif st == "active":
        w = np.clip(R * 0.9, 0, 1) * (1 - rim)
        rv = (0.62 + 0.38 * V) if not light else (0.88 + 0.12 * V)
        if "burn" in F:                                            # the figure's own burning part (Pyramid: the helmet's inner face)
            B = F["burn"]
            if not light:
                w = np.maximum(w, B)
                rv = np.where(B > 0.05, F["burnv"], rv)
            else:                                                  # the positive print: the veins burn in clean blood, the rest is blood over his ink
                vein = np.clip((F["burnv"] - 0.55) / 0.45, 0, 1)
                w = np.where(B > 0.05, np.maximum(w, B * (0.34 + 0.66 * vein)), w)
                rv = np.where(B > 0.05, 1.0, rv)
        fig = (A, _col(tone, w, rv))
        rng_ = (RG, _col(z, 1 + z, 1 + z))
        D = ring_blood(px, False, n, extra_runs) * keep
        extra = _blood_layers(D, px, light)
    else:
        if not light:                                              # a wash over the iron, not a fill: its tone is the blood's strength and
            wash = 0.24 + 0.76 * T ** 0.85                         # its brightest scratches show through, pale and wet
            wf = 1 - 0.28 * S.curve(T, 0.72, 1.0)
        else:                                                      # the positive print: pale blood over the paper, dark blood-ink in the shadows
            wash = 0.40 + 0.60 * (1 - T) ** 0.8
            wf = 1 - 0.55 * S.curve(1 - T, 0.60, 1.0)
        if "core" in F:                                            # Pyramid: the inner face is a black-red hollow, veined
            Fn = F["coremask"]
            if not light:
                wash = wash * (1 - Fn) + F["core"] * Fn
            else:
                wash = wash * (1 - Fn) + Fn
                wf = wf * (1 - Fn) + (0.40 + 0.25 * F["core"]) * Fn
        if micro:
            wash = np.maximum(wash, rim)
            wf = np.maximum(wf, rim)
        fig = (A, _col(tone, wf, wash))
        rng_ = (RG, _col(z, 1 + z, 1 + z))
        D = ring_blood(px, True, n, extra_runs) * keep
        extra = _blood_layers(D, px, light)
    if behind:
        layers = [(rng_[0] * keep, rng_[1]), (fig[0] * keep, fig[1])]
    else:
        layers = [(fig[0] * keep, fig[1]), (rng_[0] * keep, rng_[1])]
    layers += [(a * keep, c) for a, c in extra]
    layers.append((N * moat * (0.7 if st == "empty" else 1.0), _col(1 + z, z, z)))
    out = _over(layers)
    return Image.fromarray((_no_black(np.clip(out, 0, 1)) * 255 + 0.5).astype(np.uint8), "RGBA")


# ---- Heather (SH3), from the user's Heather / Pyramid roundel sheet (`Heather pyramid.png`, 1536x1024: her roundel is the left one) ------
HP_SIZE = (1536, 1024)
H_RING = (395, 470, 278)                     # the art's own ring (ito-assets HP_ROUND): centre x, y and radius in sheet px
H_PORTRAIT = 262                             # the portrait inside it (the red ring and its ticks stay outside)
H_MICRO = (430, 455, 175)                    # under 40 px: closer on her face (eye, fringe, mouth), the ring language does the rest
_SRC = {}
_CACHE = {}


def set_source(img):
    """img: the Heather / Pyramid roundel sheet (PIL, 1536x1024)."""
    if img.size != HP_SIZE:
        raise ValueError(f"the ws-heather recipe takes the {HP_SIZE[0]}x{HP_SIZE[1]} Heather / Pyramid roundel sheet; this is {img.size[0]}x{img.size[1]}")
    _SRC["HP"] = img.convert("RGB")
    _CACHE.clear()


def _heather_native(micro):
    key = ("HN", micro)
    if key not in _CACHE:
        if "HP" not in _SRC:
            raise ValueError("needs your Heather / Pyramid roundel sheet (Heather pyramid.png, 1536x1024)")
        cx, cy, r = H_MICRO if micro else (H_RING[0], H_RING[1], H_PORTRAIT)
        t = S.rgbf(_SRC["HP"].crop((cx - r, cy - r, cx + r, cy + r)))
        L = S.dered(t)                                             # the art's red streaks and ring pieces take their neighbours' grey
        yy, xx = np.mgrid[0:L.shape[0], 0:L.shape[1]] + 0.5
        rr = np.hypot(xx - r, yy - r) / r
        if micro:                                                  # the close crop: only the part of it inside the original portrait
            rr = np.maximum(rr, np.hypot(xx + cx - r - H_RING[0], yy + cy - r - H_RING[1]) / H_PORTRAIT)
        lo, hi = np.percentile(L[rr < 0.95], [2, 99.5])
        T = np.clip((L - lo) / max(hi - lo, 1e-3), 0, 1) ** 0.85
        T = np.clip(T + 0.6 * (T - S.gblur(T, 4.0)), 0, 1)               # the engraving's grain, kept through the reduction
        _CACHE[key] = T
    return _CACHE[key]


def heather_layers(px):
    """tile-res maps: her portrait clipped to a disc just inside the ring."""
    key = ("HL", px)
    if key not in _CACHE:
        micro = px < 40
        T = _heather_native(micro)
        cx, cy, r = geom(px)
        rp = r - (1.5 if micro else max(2.0, 0.045 * px))
        d = int(round(2 * rp))
        Ts = S.area(T, d, d)
        Ts = np.clip(S.usm(S.usm(Ts, 0.6, 0.9 if micro else 0.6), 1.6 if micro else 2.4, 0.40), 0, 1)
        lo, hi = np.percentile(Ts, [3, 99])
        Ts = np.clip((Ts - lo) / max(hi - lo, 1e-3), 0, 1)
        m = Image.new("L", (d * SS, d * SS), 0)
        ImageDraw.Draw(m).ellipse((0, 0, d * SS - 1, d * SS - 1), fill=255)
        Ad = np.asarray(m.resize((d, d), Image.BOX), np.float32) / 255
        Ad = Ad * S.curve(S.gblur(Ts, 0.7 if micro else 1.0), 0.05, 0.28)      # her dark ground is the bar's own: only the drawing is opaque
        if not micro:                                              # the portrait's rim fades into the ring as the sheet's vignette does
            yy, xx = np.mgrid[0:d, 0:d] + 0.5
            Ad = Ad * (1 - 0.35 * S.curve(np.hypot(xx - d / 2, yy - d / 2) / (d / 2), 0.80, 1.0))
        A = np.zeros((px, px), np.float32); Tt = np.zeros((px, px), np.float32)
        x0, y0 = int(round(cx - d / 2)), int(round(cy - d / 2))
        xs, ys = max(0, x0), max(0, y0)
        xe, ye = min(px, x0 + d), min(px, y0 + d)
        A[ys:ye, xs:xe] = Ad[ys - y0:ye - y0, xs - x0:xe - x0]
        Tt[ys:ye, xs:xe] = Ts[ys - y0:ye - y0, xs - x0:xe - x0]
        _CACHE[key] = dict(A=A, T=Tt, rim=False)
    return _CACHE[key]


def ws_heather(n, st, px, light=False):
    return compose(heather_layers(px), n, st, px, light, behind=False)


def products_heather(tiers=TIERS):
    out = []
    for px in tiers:
        for n in range(1, 11):
            for st in STATES:
                out += [(f"workspaces/bar/{px}/ws-heather-{n}-{st}.png", ws_heather(n, st, px, False)),
                        (f"workspaces/bar/{px}/ws-heather-{n}-{st}.light.png", ws_heather(n, st, px, True))]
    return out + S.previews("heather", ws_heather, tiers)

#!/usr/bin/env python3
"""ito_pyramid -- Pyramid Head from the user's HD side view (pyramid-head-hd-side.png, 1254x1254, RGBA on a transparent ground).

Pure functions on numpy / Pillow: nothing is read or written here (bin/ito-assets `recipe pyramid-head` does that, into the user's assets folder
only; the repo holds crop coordinates and code, never the pixels). The picture arrives through `set_source(img)`; every piece is cut at the
picture's own resolution and only ever area-reduced to a tier (the 512 master of the mark is a plain area reduction too).

Colour (2026-10-22, S22/S23 + "los colores ... deben de sincronizarse con los del tema actual"): the picture's own lighting and true
blacks, written in the theme shader's language (shaders/ito-theme.frag) so both products follow the current theme: its luminance is the
bone grey (black stays 0 = the theme's darkest token, never lifted), its red is the blood (the accent; the rust a warm share of it). The
`.light` twin inverts the luminance (the shadows become the theme's ink on a light ground). These two products are the documented
exception to the no-opaque-black file gate (scripts/qa/test-hd-tiers.py DEEP): the shader, not the file, decides the black.

Products (paths relative to the assets folder):
  workspaces/bar/<px>/ws-pyramid-<n>-<state>[.light].png      workspace family `pyramid` (replaces the sprite sheet's front view)
  marks/pyramid-head[.light].png + marks/bar/<px>/...          menu mark `pyramid-head`: helmet + shoulder, the sprite's lighting in theme tokens, die-cut
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import ito_sh as S

SRC_SIZE = (1254, 1254)
TIERS = S.TIERS
STATES = S.STATES
_SRC = {}
_CACHE = {}


def set_source(img):
    """img: the side view (PIL, 1254x1254, RGBA: the figure cut out on a transparent ground)."""
    if img.size != SRC_SIZE:
        raise ValueError(f"the pyramid-head recipe takes the {SRC_SIZE[0]}x{SRC_SIZE[1]} side view; this is {img.size[0]}x{img.size[1]}")
    _SRC["P"] = img.convert("RGBA")
    _CACHE.clear()


def _pic():
    if "P" not in _SRC:
        raise ValueError("needs your Pyramid Head side view (pyramid-head-hd-side.png, 1254x1254)")
    return _SRC["P"]


# ---- geometry measured on the picture (picture px), on a 50-px grid overlay -------------------------------------------------------------
FULL = (236, 28, 1004, 1240)                                    # the whole figure with a margin
HELM = [(400, 30), (802, 476), (872, 518), (828, 550), (642, 782), (612, 804), (244, 1102), (236, 1102)]    # the helmet: tip, the right face's
#                                                                 edge to the riveted strap's end, the lower edge of the frame down to the bottom-left corner
FACE = [(399, 70), (418, 92), (556, 712), (566, 748), (318, 932), (306, 928)]   # the dark inner face (between the outer edge, the riveted strip, the frame bar)


def _poly(shape, pts, ox=0.0, oy=0.0, ss=4):
    h, w = shape
    m = Image.new("L", (w * ss, h * ss), 0)
    ImageDraw.Draw(m).polygon([((x - ox) * ss, (y - oy) * ss) for x, y in pts], fill=255)
    return np.asarray(m.resize((w, h), Image.BOX), np.float32) / 255


def _native():
    """(alpha, tone, red, vein, face, helm) at native resolution over FULL. tone = the luminance levelled over the figure with its deep
    shadows lifted (the picture is dark: half its pixels are near black); red = how much redder than grey a pixel is; vein = the face's own
    scratches and streaks (a local high-pass of its luminance), what burns when the workspace is active."""
    if "N" not in _CACHE:
        a = np.asarray(_pic().crop(FULL), np.float32) / 255
        rgb, al = a[..., :3], S.curve(a[..., 3], 0.20, 0.80)
        L = S.lumf(rgb)
        red = S.curve(rgb[..., 0] - np.maximum(rgb[..., 1], rgb[..., 2]), 0.035, 0.22) * al
        m = al > 0.5
        lo, hi = np.percentile(L[m], [1, 99.7])
        T = np.clip((L - lo) / (hi - lo), 0, 1) ** 0.62                  # gamma < 1: the iron's mid tones open up, the rust texture shows
        T = np.clip(T + 0.9 * (T - S.gblur(T, 6.0)), 0, 1)                # the engraving's grain, kept through the reduction
        rlo, rhi = np.percentile(rgb[..., 0][red > 0.5], [5, 99.5]) if (red > 0.5).any() else (0.1, 0.9)
        V = np.clip((rgb[..., 0] - rlo) / max(rhi - rlo, 1e-3), 0, 1)
        face = _poly(L.shape, FACE, FULL[0], FULL[1])
        helm = _poly(L.shape, HELM, FULL[0], FULL[1]) * al
        hp = np.clip((L - S.gblur(L, 5.0)) * 9 + (rgb[..., 0] - S.gblur(rgb[..., 0], 5.0)) * 5, 0, 1)
        vein = S.curve(S.gblur(hp, 1.2), 0.04, 0.40) * face
        _CACHE["N"] = (al, T, red, V, vein, face, helm)
    return _CACHE["N"]


def _face_y(x):
    """the inner face's lower edge (the frame bar's upper edge) under picture x."""
    (xa, ya), (xb, yb) = FACE[5], FACE[3]
    return ya + (x - xa) * (yb - ya) / (xb - xa)


# ---- the ringed family (2026-10-20, the workspace sheet's WS1 card): the figure stands in a targeting ring (ito_ringws), the helmet's tip
# piercing it; the ring is grey when empty / occupied (+ red scratch bars), blood when active, and the whole figure floods when urgent.
# (The earlier unringed look, family `pyramid-classic`, was removed 2026-10-20.) ----------------------------------------------------------
RING_CROPS = ((72, (240, 30, 1000, 1150), False), (10 ** 6, (240, 30, 1000, 1236), False))    # in the ring the helmet never stands alone:
#                                                                 without his shoulder the side view's wedge reads as a play button at 24-36 px


def _ring_geom(px):
    """(box, helm_only, k, x0, y0, tw, th): the figure on the tile's foot, centred on the ring."""
    import ito_ringws as R
    lim, box, ho = next(c for c in RING_CROPS if px < c[0])
    w, h = box[2] - box[0], box[3] - box[1]
    th = px if px < 40 else int(round(0.97 * px))
    tw = int(round(w * th / h))
    x0 = int(round(R.geom(px)[0] - 0.5 * tw))
    return box, ho, h / th, x0, px - th, tw, th


def _rput(m, px):
    box, ho, k, x0, y0, tw, th = _ring_geom(px)
    c = m[box[1] - FULL[1]:box[3] - FULL[1], box[0] - FULL[0]:box[2] - FULL[0]]
    z = np.zeros((px, px), np.float32)
    s = S.area(c, tw, th)
    xs, xe = max(0, x0), min(px, x0 + tw)
    z[y0:y0 + th, xs:xe] = s[:, xs - x0:xe - x0]
    return z


def _ring_layers(px):
    key = ("R", px)
    if key not in _CACHE:
        al, T, red, V, vein, face, helm = _native()
        box, ho, *_ = _ring_geom(px)
        if ho:
            hm = _poly(al.shape, HELM, FULL[0], FULL[1])
            al, red = al * hm, red * hm
        A = np.clip(_rput(al, px), 0, 1)
        Rs = _rput(red, px)
        Tt = _rput(T * al, px) / np.maximum(A, 1e-4)
        Rt = np.clip(Rs / np.maximum(A, 1e-4), 0, 1)
        Vt = np.clip(_rput(V * red, px) / np.maximum(Rs, 1e-4), 0, 1)
        Ft = _rput(face, px) * (A > 0.02)
        Gt = _rput(vein, px)
        micro = px < 40
        Tt = np.clip(S.usm(S.usm(Tt, 0.6, 0.9 if micro else 0.7), 1.6 if micro else 2.4, 0.45), 0, 1)
        m = A > 0.5
        if m.any():
            lo, hi = np.percentile(Tt[m], [4, 98])
            Tt = np.clip((Tt - lo) / max(hi - lo, 1e-3), 0, 1) ** (0.85 if px < 72 else 0.95)
        Fn = S.curve(Ft, 0.25, 0.75)
        burn = Fn * (0.55 + 0.45 * np.clip(Gt * 1.4, 0, 1)) if not micro else Fn
        burnv = (0.55 + 0.45 * np.clip(Gt * 1.6 + 0.25 * Vt, 0, 1)) if not micro else 0.92 + 0 * Gt
        core = 0.40 + 0.35 * np.clip(Gt * 1.6, 0, 1)
        runs = []
        if not micro:                                              # blood off the frame's lower edge, under the inner face
            box, ho, k, x0, y0, tw, th = _ring_geom(px)
            for sx in (330, 440, 520):
                runs.append(((sx - box[0]) / k + x0, (_face_y(sx) - box[1]) / k + y0))
        _CACHE[key] = (dict(A=A, T=Tt, R=Rt, V=Vt, B=S.curve(Rt, 0.25, 0.70), iron=True, rim=False, burn=burn, burnv=burnv, core=core, coremask=Fn), tuple(runs))
    return _CACHE[key]


def _theme_maps(rgb, al):
    """the sprite's pixels in the theme shader's language (shaders/ito-theme.frag), keeping its lighting: t = its luminance over the
    figure's own highlight (a true black stays 0: the shader makes it the theme's darkest token, never a lifted grey), w = how much of the
    pixel is blood (its vivid red full, the rust a warm share, the iron none), rv = the blood's own strength."""
    L = S.lumf(rgb)
    m = al > 0.5
    hi = np.percentile(L[m], 99.5) if m.any() else 1.0
    t = np.clip(L / max(hi, 1e-3), 0, 1)
    red = rgb[..., 0] - np.maximum(rgb[..., 1], rgb[..., 2])
    w = S.curve(red, 0.04, 0.26)
    rhi = np.percentile(rgb[..., 0][m], 99.5) if m.any() else 1.0
    rv = np.clip(rgb[..., 0] / max(rhi, 1e-3), 0.25, 1)
    return t, w, rv


def _enc(t, w, rv, light):
    """(t, w, rv) -> the RGB the shader reads: bone grey = t (on the `.light` twin 1 - t: the picture's shadows become the theme's ink on a
    light ground), blood = the accent at strength rv."""
    import ito_ringws as R
    return R._col(1 - t if light else t, w, rv)


def _nat_fig(px):
    """(A, t, w, rv): the figure in the ring at tile res, from the sprite's own pixels (premultiplied area reduction, no tone curve)."""
    key = ("NF", px)
    if key not in _CACHE:
        a = np.asarray(_pic().crop(FULL), np.float32) / 255
        al = S.curve(a[..., 3], 0.20, 0.80)
        A = np.clip(_rput(al, px), 0, 1)
        rgb = np.clip(np.dstack([_rput(a[..., c] * al, px) for c in range(3)]) / np.maximum(A, 1e-4)[..., None], 0, 1)
        t, w, rv = _theme_maps(rgb, A)
        if px < 72:                                                  # a light unsharp so the rust's scratches survive the reduction
            t = np.clip(S.usm(t, 0.7, 0.45), 0, 1)
        _CACHE[key] = (A, t, w, rv)
    return _CACHE[key]


def ws_pyramid_ring(n, st, px, light=False):
    """the workspace tile (S22/S23, theme-synced 2026-10-22): the sprite's own lighting and true blacks, written in the theme shader's
    language so it follows the current theme (shadows = the theme's darkest token, the iron's light = its foreground, the blood = its accent).
    States: empty = the figure dimmed, no blood, in a faint ring; occupied = the full figure, ring, dried scratch bars; active = a blood ring
    with a glow and runs off it; urgent = a stronger glow, a blood rim round the figure, longer runs."""
    import ito_ringws as R
    A, t, w, rv = _nat_fig(px)
    z = 0 * A
    N, moat = S.numeral(n, px, max(7, int(round(0.28 * px))))
    keep = 1 - moat
    RG, TK = R.ring(px, n)
    RG = np.maximum(RG, TK)
    blood = R._col(z, 1 + z, 1 + z)
    layers = []
    if st == "empty":
        layers.append((RG * 0.5, R._col(0.62 + z, z, z)))
        fig = (A * 0.55, _enc(t * 0.85, z, rv, light))
    else:
        if st == "occupied":
            layers.append((RG * 0.85, R._col(0.85 + z, z, z)))
        else:
            glow = np.clip(S.gblur(RG, max(0.8, 0.035 * px)) * (1.6 if st == "active" else 2.4), 0, 1) * (0.45 if st == "active" else 0.65)
            layers += [(glow, blood), (RG, blood)]
        if st == "urgent":
            layers.append((np.clip(S.gblur(A, max(0.8, 0.03 * px)) * 1.5 - A, 0, 1) * 0.55, blood))
        fig = (A, _enc(t, w, rv, light))
    layers.append(fig)
    if st == "occupied":
        layers.append((R.scratches(px, n) * 0.8, R._col(z, 1 + z, 0.62 + z)))
    elif st in ("active", "urgent"):
        _, runs = _ring_layers(px)
        layers += R._blood_layers(R.ring_blood(px, st == "urgent", n, runs), px, light)
    layers = [(a_ * keep, c) for a_, c in layers]
    layers.append((N * moat * (0.7 if st == "empty" else 1.0), R._col(1 + z, z, z)))
    out = R._over(layers)
    return Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")


def _no_black(out, floor=0.165):
    """never an opaque black: a pixel darker than `floor` (the gate's luma) is lifted along its own hue, so the black-red hollows stay red."""
    lu = 0.3 * out[..., 0] + 0.59 * out[..., 1] + 0.11 * out[..., 2]
    k = np.where(lu < floor, floor / np.maximum(lu, 1e-3), 1.0)
    rgb = np.clip(out[..., :3] * k[..., None], 0, 1)
    rgb = np.where((lu < 1e-3)[..., None], floor, rgb)
    return np.dstack([rgb, out[..., 3]])


# ---- the menu mark `pyramid-head` (redone 2026-10-22, S22/S23): the sprite's own lighting, die-cut, in theme tokens (see the header): the
# rusty iron's light, its true deep shadows and its blood follow the current theme through the shader like every other mark. The silhouette is
# opened by 1 px so the tip ends on a clean point, the alpha is 1-bit below 72 px, and a faint 1-px edge in the theme's foreground keeps the
# dark figure readable on any bar. Drawn at least 32 px.
MARK_BOX = (240, 28, 1000, 1060)


def _mn(m, r): return np.asarray(Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(2 * r + 1)), np.float32) / 255


def mark(px, light=False):
    box = MARK_BOX
    a = np.asarray(_pic().crop(box), np.float32) / 255
    al = S.curve(a[..., 3], 0.20, 0.80)
    w_, h_ = box[2] - box[0], box[3] - box[1]
    pad = 1 if px < 64 else max(2, int(round(0.03 * px)))
    k = (px - 2 * pad) / max(w_, h_)
    tw, th = max(1, int(round(w_ * k))), max(1, int(round(h_ * k)))
    x0, y0 = (px - tw) // 2, (px - th) // 2
    put = lambda m: _place(S.area(m, tw, th), px, x0, y0)
    A = np.clip(put(al), 0, 1)
    rgb = np.clip(np.dstack([put(a[..., c] * al) for c in range(3)]) / np.maximum(A, 1e-4)[..., None], 0, 1)
    t, w, rv = _theme_maps(rgb, A)
    if px < 72:                                                     # a light unsharp so the rust's scratches survive
        t = np.clip(S.usm(t, 0.7, 0.45), 0, 1)
    hard = (A > 0.5).astype(np.float32)
    body = _di(_mn(hard, 1), 1) * hard                              # opened by 1 px: the tip's needle goes
    alpha = body if px < 72 else np.minimum(A, _di(body, 1))
    b4 = np.maximum.reduce([body, np.roll(body, 1, 0), np.roll(body, -1, 0), np.roll(body, 1, 1), np.roll(body, -1, 1)])
    ring = np.clip(b4 - body, 0, 1)                                 # the faint 1-px edge outside the cut (4-neighbour: the tip stays a point)
    out_a = np.clip(alpha + ring * 0.45 * (1 - alpha), 0, 1)
    import ito_ringws as R
    col = np.where(alpha[..., None] > 1e-4, _enc(t, w, rv, light), R._col(0.75 + 0 * t, 0 * t, 0 * t))
    return Image.fromarray((np.dstack([np.clip(col, 0, 1), out_a]) * 255 + 0.5).astype(np.uint8), "RGBA")


def _di(m, r): return np.asarray(Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * r + 1)), np.float32) / 255


def _place(s, px, x0, y0):
    z = np.zeros((px, px), np.float32)
    h, w = s.shape
    xs, xe = max(0, x0), min(px, x0 + w)
    z[y0:y0 + h, xs:xe] = s[:, xs - x0:xe - x0]
    return z


def _d(px): return "marks" if px == 512 else f"marks/bar/{px}"


def products(tiers=TIERS):
    out = []
    for px in tuple(tiers) + (512,):
        out += [(f"{_d(px)}/pyramid-head.png", mark(px, False)), (f"{_d(px)}/pyramid-head.light.png", mark(px, True))]
    for px in tiers:
        for n in range(1, 11):
            for st in STATES:
                out += [(f"workspaces/bar/{px}/ws-pyramid-{n}-{st}.png", ws_pyramid_ring(n, st, px, False)),
                        (f"workspaces/bar/{px}/ws-pyramid-{n}-{st}.light.png", ws_pyramid_ring(n, st, px, True))]
    return out + S.previews("pyramid", ws_pyramid_ring, tiers)

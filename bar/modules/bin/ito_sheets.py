#!/usr/bin/env python3
"""ito_sheets -- the lock scenes of the user's Boot & Lock sheets, recomposed in high resolution.

The sheets (`boot-landscape-sheet.png` / `boot-portrait-sheet.png`, 1536x1024) are composition guides only: their cards are ~480x230 px
and carry baked text (a product name, a clock, a date, kanji, quotes, a progress bar) that the lock never shows (the shell draws the
real clock, date, status and quote). So nothing is cut from a card: each scene is rebuilt from the user's high-resolution sources
plus drawn fog, ink, rain and grain, at the lock's own sizes (2560x1440 and 1920x1080):

  tomie     the HD Tomie panel (tomie-hd-1500x2000.png): the drawing inside its brushed frame (the signature under the frame is left out)
  pyramid   the HD Pyramid Head side view (pyramid-head-hd-side.png, 1254x1254, transparent ground)
  road      a drawn wet road at night in rain and fog (poles, a barbed-wire fence, a parked car, a streetlamp), the "Welcome to Silent
            Hill" sign of the sprite sheet (SHASSETS.png, 1920x1080) redrawn crisp and large on the right verge under its two lamps
  moth      the moth of the sprite sheet pinned to a stained wall, a red crosshair through it

Each scene also gives a boot picture (`cards/<key>.png`, BOOT_BOX): its subject cut from the 2560x1440 render, the edges dissolving into
transparency, for ito-plymouth's `card-<key>` compositions.

Pure functions on numpy / Pillow: nothing is read or written here (bin/ito-assets `recipe sheets` does that, into the user's assets
folder only, `lock/<key>-<w>x<h>.png` and `cards/<key>.png`; the repo holds crop coordinates and code, never the pixels).

Colour: every scene is painted with two fields, tone (0 = ink, 1 = bone) and blood (0..1), and saved in a fixed reference palette so the
file reads as itself. The lock recolours it onto the theme (ito_ink.scene: tone onto the ink..bone line, blood onto the accent), so a
scene follows the theme like every other lock layer. The right side of every scene is the calm column where the shell draws the clock,
date, field and quote: tone there stays low and even (SAFE, checked by `safe_report`).
"""
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

INK_REF = np.array([13, 11, 11], np.float32)        # the reference palette the files are saved in (ito_ink.scene inverts it)
BONE_REF = np.array([222, 214, 200], np.float32)
BLOOD_REF = np.array([150, 16, 22], np.float32)
REF = (2560, 1440)
SIZES = ((2560, 1440), (1920, 1080))
SAFE = (1500, 220, 2420, 1300)                       # the text column in reference px: the clock, date, mark, name, field and quote
SAFE_TONE = 0.16                                     # mean tone the column may have (bone text on it keeps its contrast)

TOMIE_SRC = (1500, 2000)
PYRAMID_SRC = (1254, 1254)
SPRITES_SRC = (1920, 1080)
TOMIE_CROP = (132, 252, 1384, 1684)                  # inside the brushed frame; the signature (y > 1690) stays out
PYRAMID_CROP = (236, 30, 1004, 1240)                 # the whole figure with a margin (as ito_pyramid.FULL)
SPRITE_SIGN = (1353, 422, 1549, 617)                 # SHASSETS.png: the lit sign "Welcome to Silent Hill" on its two posts
SPRITE_MOTH = (74, 44, 461, 411)                     # SHASSETS.png: the moth in its red crosshair roundel

# The sheet cards each scene follows (boot-landscape-sheet.png, art only, the baked text excluded): composition guides, never cut
GUIDES = {"tomie": (40, 590, 330, 800), "pyramid": (1024, 590, 1290, 800), "road": (534, 60, 800, 285),
          "moth": (1024, 303, 1310, 518), "cassette": (534, 818, 860, 988)}

KEYS = ("tomie", "pyramid", "road", "moth")
_SRC = {}


def set_sources(tomie=None, pyramid=None, sprites=None):
    """The user's pictures (PIL). Each is checked for its size; a scene whose picture is missing is not produced."""
    for key, im, size in (("tomie", tomie, TOMIE_SRC), ("pyramid", pyramid, PYRAMID_SRC), ("sprites", sprites, SPRITES_SRC)):
        if im is None:
            _SRC.pop(key, None)
            continue
        if im.size != size:
            raise ValueError(f"the sheets recipe takes the {key} picture at {size[0]}x{size[1]}; this is {im.size[0]}x{im.size[1]}")
        _SRC[key] = im.convert("RGBA")


def available():
    need = {"tomie": "tomie", "pyramid": "pyramid", "road": "sprites", "moth": "sprites"}
    return [k for k in KEYS if need[k] in _SRC]


# ---- fields ---------------------------------------------------------------------------------------------------------------------------

def smooth(e0, e1, x):
    t = np.clip((np.asarray(x, np.float32) - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def noise(w, h, seed, cell, octaves=4, sx=1.0):
    """Value noise in 0..1 (bicubic grids, `cell` px for the coarsest octave, stretched sideways by sx)."""
    rng = np.random.default_rng(seed)
    out, amp, tot = np.zeros((h, w), np.float32), 1.0, 0.0
    for o in range(octaves):
        c = max(2.0, cell / 2 ** o)
        gw, gh = int(w / (c * sx)) + 3, int(h / c) + 3
        g = Image.fromarray((rng.random((gh, gw)) * 255).astype(np.uint8))
        out += np.asarray(g.resize((int(gw * c * sx), int(gh * c)), Image.BICUBIC), np.float32)[:h, :w] / 255 * amp
        tot += amp
        amp *= 0.5
    out /= tot
    lo, hi = np.percentile(out, 2), np.percentile(out, 98)
    return np.clip((out - lo) / max(1e-6, hi - lo), 0, 1)


def grid(w, h):
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    return xs, ys


def grain(w, h, seed, amp):
    return np.random.default_rng(seed).normal(0, amp, (h, w)).astype(np.float32)


def rain(w, h, k, seed, n, alpha, slant=0.10, length=(40, 160)):
    """Fine falling streaks (rain, or scratches on the print): a coverage field 0..1."""
    rng = np.random.default_rng(seed)
    im = Image.new("L", (w, h), 0)
    from PIL import ImageDraw
    d = ImageDraw.Draw(im)
    for _ in range(n):
        x, y = rng.uniform(0, w), rng.uniform(-50, h)
        ln = rng.uniform(*length) * k
        d.line([(x, y), (x + slant * ln, y + ln)], fill=int(255 * rng.uniform(0.3, 1.0) * alpha), width=max(1, round(k)))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(0.6 * k)), np.float32) / 255


def scratches(w, h, k, seed, n):
    """Long vertical scratches on the print, broken, some of them dried blood: (light, red) coverage."""
    rng = np.random.default_rng(seed)
    lt, rd = Image.new("L", (w, h), 0), Image.new("L", (w, h), 0)
    from PIL import ImageDraw
    dl, dr = ImageDraw.Draw(lt), ImageDraw.Draw(rd)
    for i in range(n):
        x = rng.uniform(0, w)
        y = rng.uniform(-0.2, 0.7) * h
        ln = rng.uniform(0.15, 0.9) * h
        tgt = dr if rng.random() < 0.35 else dl
        segs = rng.integers(2, 6)
        for s in range(segs):
            y0 = y + ln * s / segs
            y1 = y0 + ln / segs * rng.uniform(0.4, 0.95)
            tgt.line([(x + rng.normal(0, 1.5 * k), y0), (x + rng.normal(0, 1.5 * k), y1)],
                     fill=int(255 * rng.uniform(0.25, 0.8)), width=max(1, round(rng.uniform(0.8, 2.2) * k)))
    blur = ImageFilter.GaussianBlur(0.5 * k)
    return np.asarray(lt.filter(blur), np.float32) / 255, np.asarray(rd.filter(blur), np.float32) / 255


def vignette(w, h, cx=0.42, cy=0.48, rx=0.75, ry=0.80):
    xs, ys = grid(w, h)
    d = np.sqrt(((xs / w - cx) / rx) ** 2 + ((ys / h - cy) / ry) ** 2)
    return smooth(0.55, 1.15, d)


def calm_column(w, h, k, tone, strength=1.0, keep=(0.05, 0.35)):
    """Hold the text column down: inside SAFE (with a soft 160 px edge) the field is pulled to min(v, keep0 + keep1 v)."""
    xs, ys = grid(w, h)
    x0, y0, x1, y1 = (v * k for v in SAFE)
    x0 += (w - REF[0] * k) / 2
    x1 += (w - REF[0] * k) / 2
    e = 160 * k
    m = smooth(x0 - e, x0 + e * 0.5, xs) * (1 - smooth(x1, x1 + e, xs)) * smooth(y0 - e, y0 + e * 0.5, ys) * (1 - smooth(y1, y1 + e, ys))
    m *= strength
    held = np.minimum(tone, keep[0] + keep[1] * tone)
    return tone * (1 - m) + held * m


def paste(field, src, x0, y0, alpha=None):
    """Composite `src` (h, w) into `field` at (x0, y0) through `alpha` (0..1, same shape), clipped to the field."""
    H, W = field.shape
    h, w = src.shape
    xa, ya, xb, yb = max(0, x0), max(0, y0), min(W, x0 + w), min(H, y0 + h)
    if xa >= xb or ya >= yb:
        return field
    s = src[ya - y0:yb - y0, xa - x0:xb - x0]
    a = 1.0 if alpha is None else alpha[ya - y0:yb - y0, xa - x0:xb - x0]
    field[ya:yb, xa:xb] = field[ya:yb, xa:xb] * (1 - a) + s * a
    return field


def resize(im, w, h):
    """Lanczos for a reduction, Lanczos + a light unsharp for an enlargement (the user's pictures are never enlarged above 1.9x)."""
    out = im.resize((max(1, round(w)), max(1, round(h))), Image.LANCZOS)
    if w > im.width * 1.05:
        out = out.filter(ImageFilter.UnsharpMask(radius=1.6, percent=60, threshold=2))
    return out


def tone_of(rgb):
    """The picture's own pixels -> (tone, blood): tone = luminance, blood = how much redder than grey a pixel is."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    red = np.clip((r - np.maximum(g, b)) / 110, 0, 1) * smooth(0.04, 0.20, r / 255)
    return lum.astype(np.float32), red.astype(np.float32)


def to_rgb(tone, blood):
    t = np.clip(tone, 0, 1)[..., None]
    b = np.clip(blood, 0, 1)[..., None]
    col = INK_REF * (1 - t) + BONE_REF * t
    col = col * (1 - b) + BLOOD_REF * b
    return Image.fromarray(np.clip(col + 0.5, 0, 255).astype(np.uint8), "RGB")


def ground(w, h, k, seed):
    """The shared ground: ink, a slow mottle of fog, the print's grain."""
    fog = noise(w, h, seed, 300 * k, 4, sx=2.2)
    t = 0.035 + 0.05 * fog
    return t


def finish(tone, blood, w, h, k, seed, grain_amp=0.022, red_scratches=0.55):
    tone = tone + grain(w, h, seed + 99, grain_amp) * (0.4 + tone)
    lt, rd = scratches(w, h, k, seed + 7, 26)
    on_ground = 1 - smooth(0.10, 0.25, tone)          # a scratch shows on the dark print, never across the figure
    tone = tone + 0.10 * lt * on_ground
    blood = np.maximum(blood, red_scratches * rd * on_ground)
    tone = calm_column(w, h, k, tone)
    blood = calm_column(w, h, k, blood, 1.0, (0.0, 0.15))      # no red in the column: the accent there is the shell's
    return to_rgb(tone, blood)


# ---- the scenes -----------------------------------------------------------------------------------------------------------------------

def scene_tomie(w, h):
    """Her drawing at full height on the left, the brushed frame melting into the ink, a thread of blood from her eye."""
    k = h / REF[1]
    ox = (w - REF[0] * k) / 2
    tone = ground(w, h, k, 11)
    blood = np.zeros_like(tone)
    src = _SRC["tomie"].crop(TOMIE_CROP).convert("RGB")
    s = 1440 * k / src.height
    im = resize(src, src.width * s, src.height * s)
    g = np.asarray(im.convert("L"), np.float32) / 255
    lo, hi = np.percentile(g, 1), np.percentile(g, 99.5)
    g = np.clip((g - lo) / max(1e-6, hi - lo), 0, 1)
    t = 0.035 + 0.72 * g ** 1.25                       # the paper is bone, held under full white; the brush black is the ground
    x0, y0 = round(ox + 150 * k), round((h - im.height) / 2)
    hh, ww = t.shape
    xs, ys = grid(ww, hh)
    edge = 70 * s
    a = smooth(0, edge, xs) * smooth(0, edge, ww - 1 - xs) * smooth(0, edge, ys) * smooth(0, edge, hh - 1 - ys)
    tone = paste(tone, t, x0, y0, a)
    # her right eye (the one that is still hers): a tear of blood down the cheek (picture px of the HD panel, then placed)
    lid = (846 - TOMIE_CROP[0], 818 - TOMIE_CROP[1])  # the lower lid of her own eye (HD panel px)
    tear = np.zeros_like(blood)
    tear = paste(tear, _drips(ww, hh, s, [(lid[0], lid[1], 230, 4.6), (lid[0] + 14, lid[1] + 1, 120, 3.2)], 5), x0, y0)
    blood = np.maximum(blood, tear)
    return finish(tone, blood, w, h, k, 11)


def _drips(w, h, s, drips, seed):
    """Blood running down from points: (x, y, length, width) in picture px; returns a coverage field (h, w)."""
    rng = np.random.default_rng(seed)
    im = Image.new("L", (w * 2, h * 2), 0)
    from PIL import ImageDraw
    d = ImageDraw.Draw(im)
    for x, y, ln, wd in drips:
        pts = []
        n = 40
        for i in range(n + 1):
            f = i / n
            pts.append((x * s + rng.normal(0, 0.35) * s + math.sin(f * 5.3 + seed) * 2.0 * s, (y + f * ln) * s))
        for i in range(n):
            f = i / n
            wd_i = wd * s * (1.0 - 0.55 * f) * (1 + 0.25 * math.sin(f * 17))
            d.line([(pts[i][0] * 2, pts[i][1] * 2), (pts[i + 1][0] * 2, pts[i + 1][1] * 2)], fill=int(255 * (0.95 - 0.25 * f)), width=max(1, round(wd_i * 2)))
        ex, ey = pts[-1]
        r = wd * s * 0.95
        d.ellipse([(ex - r) * 2, (ey - r * 0.6) * 2, (ex + r) * 2, (ey + r * 1.5) * 2], fill=200)
    im = im.resize((w, h), Image.BOX).filter(ImageFilter.GaussianBlur(0.4 * s))
    return np.asarray(im, np.float32) / 255


def scene_pyramid(w, h):
    """He stands on the left, turned toward the clock; behind him a wall weeping rust, fog at his feet."""
    k = h / REF[1]
    ox = (w - REF[0] * k) / 2
    tone = ground(w, h, k, 21)
    blood = np.zeros_like(tone)
    xs, ys = grid(w, h)
    # the wall: rust running down in vertical bands, strongest behind him
    streak = noise(w, h, 22, 900 * k, 3, sx=0.04)
    band = smooth(0.62, 0.95, streak) * (1 - smooth(0.45, 0.70, (xs - ox) / (REF[0] * k)))
    blood = np.maximum(blood, 0.20 * band * smooth(0.0, 0.5, ys / h))
    tone = tone + 0.035 * band
    src = _SRC["pyramid"].crop(PYRAMID_CROP)
    s = 1.16 * k
    im = resize(src, src.width * s, src.height * s)
    a = np.asarray(im, np.float32) / 255
    t, r = tone_of(a[..., :3] * 255)
    lo, hi = np.percentile(t[a[..., 3] > 0.5], 1), np.percentile(t[a[..., 3] > 0.5], 99.5)
    t = 0.03 + 0.80 * np.clip((t - lo) / max(1e-6, hi - lo), 0, 1) ** 1.05
    al = smooth(0.15, 0.85, a[..., 3])
    x0, y0 = round(ox + 230 * k), round(h - im.height + 60 * k)
    tone = paste(tone, t, x0, y0, al)
    blood = paste(blood, np.clip(r * 1.15, 0, 1), x0, y0, al)
    # fog rolling over the floor, over his feet
    fog = noise(w, h, 23, 260 * k, 4, sx=3.0)
    lowf = smooth(0.62, 1.0, ys / h) * (0.55 + 0.45 * fog) * (1 - smooth(0.50, 0.75, (xs - ox) / (REF[0] * k)))
    tone = tone * (1 - 0.55 * lowf) + 0.30 * 0.55 * lowf
    tone = tone * (1 - 0.55 * vignette(w, h, 0.30, 0.45, 0.70, 0.85))
    return finish(tone, blood, w, h, k, 21)


def _sprite(box, scale):
    """A sprite of the sheet: cut, its white fringe eaten (the sheet's matte), enlarged. Returns (tone, blood, alpha)."""
    im = _SRC["sprites"].crop(box)
    a = np.asarray(im, np.float32) / 255
    al = Image.fromarray((a[..., 3] * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(1.0))
    rgb = (a[..., :3] * 255).astype(np.uint8)
    im = Image.fromarray(np.dstack([rgb, np.asarray(al)]), "RGBA")
    im = resize(im, im.width * scale, im.height * scale)
    a = np.asarray(im, np.float32) / 255
    t, r = tone_of(a[..., :3] * 255)
    al = a[..., 3]
    t = np.where(al > 0.02, t, 0)
    # fringe: a light pixel at the edge of the matte is the sheet's white halo, not the art
    edge = (al < 0.9) & (t > 0.55)
    al = np.where(edge, al * 0.25, al)
    return t, r, al


SIGN_PLATE = (8, 48, 189, 152)          # inside SPRITE_SIGN: the plate (sprite px)
SIGN_POSTS = (62.5, 137.5)              # the two posts' centres (sprite px)


def wnoise(u, v, seed, octaves=3):
    """Value noise at arbitrary coordinates (u, v in lattice cells; a 256-cell tile), smooth bilinear, 0..1."""
    lat = np.random.default_rng(seed).random((256, 256)).astype(np.float32)
    out, amp, tot = np.zeros(np.shape(u), np.float32), 1.0, 0.0
    for o in range(octaves):
        uu, vv = u * 2 ** o + 17.3 * o, v * 2 ** o + 9.1 * o
        i0, j0 = np.floor(uu), np.floor(vv)
        fu, fv = uu - i0, vv - j0
        fu, fv = fu * fu * (3 - 2 * fu), fv * fv * (3 - 2 * fv)
        i0, j0 = i0.astype(np.int64) % 256, j0.astype(np.int64) % 256
        i1, j1 = (i0 + 1) % 256, (j0 + 1) % 256
        a = lat[j0, i0] * (1 - fu) + lat[j0, i1] * fu
        b = lat[j1, i0] * (1 - fu) + lat[j1, i1] * fu
        out += (a * (1 - fv) + b * fv) * amp
        tot += amp
        amp *= 0.5
    return out / tot


class _Ink:
    """Line art at 2x for anti-aliasing: each stroke carries its own tone (val / cov after the reduction)."""

    def __init__(self, w, h, ox, k):
        self.w, self.h, self.ox, self.k = w, h, ox, k
        self.cov, self.val = Image.new("L", (w * 2, h * 2), 0), Image.new("L", (w * 2, h * 2), 0)
        self.dc, self.dv = ImageDraw.Draw(self.cov), ImageDraw.Draw(self.val)

    def P(self, x, y):
        return ((x * self.k + self.ox) * 2, y * self.k * 2)

    def line(self, pts, width, tone):
        q = [self.P(x, y) for x, y in pts]
        wd = max(1, round(width * self.k * 2))
        self.dc.line(q, fill=255, width=wd, joint="curve")
        self.dv.line(q, fill=int(255 * np.clip(tone, 0, 1)), width=wd, joint="curve")

    def poly(self, pts, tone):
        q = [self.P(x, y) for x, y in pts]
        self.dc.polygon(q, fill=255)
        self.dv.polygon(q, fill=int(255 * np.clip(tone, 0, 1)))

    def ellipse(self, box, tone):
        x0, y0 = self.P(box[0], box[1])
        x1, y1 = self.P(box[2], box[3])
        self.dc.ellipse([x0, y0, x1, y1], fill=255)
        self.dv.ellipse([x0, y0, x1, y1], fill=int(255 * np.clip(tone, 0, 1)))

    def over(self, tone, blur=0.0):
        cov = self.cov.resize((self.w, self.h), Image.BOX)
        val = self.val.resize((self.w, self.h), Image.BOX)
        if blur:
            cov, val = cov.filter(ImageFilter.GaussianBlur(blur * self.k)), val.filter(ImageFilter.GaussianBlur(blur * self.k))
        c = np.asarray(cov, np.float32) / 255
        v = np.asarray(val, np.float32) / 255
        t = np.where(c > 1e-3, v / np.maximum(c, 1e-3), 0)
        return tone * (1 - c) + t * c


def _sign_plate(k):
    """The town's sign, redrawn crisp at ~2.2x from the sprite: the plate and its rim drawn, the lettering re-cut from the sprite's own
    letters (enlarged at 4x, thresholded, reduced), the grime of the sprite kept as texture. Returns (tone, blood, alpha) at scale."""
    spr = _SRC["sprites"].crop(SPRITE_SIGN)
    a = np.asarray(spr, np.float32) / 255
    lum = (a[..., :3] @ np.array([0.2126, 0.7152, 0.0722], np.float32))
    px0, py0, px1, py1 = SIGN_PLATE
    sc = 2.2 * k
    W, H = round((px1 - px0) * sc), round((py1 - py0) * sc)
    sub = lum[py0:py1, px0:px1]
    big = np.asarray(Image.fromarray((sub * 255).astype(np.uint8)).resize((W * 4, H * 4), Image.BICUBIC), np.float32) / 255
    letters = smooth(0.30, 0.40, big)
    letters = np.asarray(Image.fromarray((letters * 255).astype(np.uint8)).resize((W, H), Image.BOX), np.float32) / 255
    soft = np.asarray(Image.fromarray((sub * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC), np.float32) / 255
    red = np.clip((a[py0:py1, px0:px1, 0] - np.maximum(a[py0:py1, px0:px1, 1], a[py0:py1, px0:px1, 2])) * 4, 0, 1)
    red = np.asarray(Image.fromarray((red * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC), np.float32) / 255
    xs, ys = grid(W, H)
    u, v = xs / W, ys / H
    grime = np.clip(soft * (1 - letters) * 1.6, 0, 0.5)                     # the sprite's own dirt, without the letters
    rust = noise(W, H, 61, 18 * k, 3) * noise(W, H, 62, 90 * k, 2)
    scr = rain(W, H, k, 63, 70, 0.7, slant=0.9, length=(8, 40))             # fine scratches across the paint
    lit = 1.15 - 0.45 * v                                                    # the two lamps light it from above
    lit *= 0.85 + 0.15 * (np.exp(-((u - 0.30) / 0.22) ** 2) + np.exp(-((u - 0.70) / 0.22) ** 2))
    plate = (0.07 + 0.10 * grime + 0.05 * rust + 0.07 * scr) * lit
    lt = (0.80 - 0.10 * v) * (0.88 + 0.12 * noise(W, H, 64, 6 * k, 2))      # the painted letters, worn
    t = plate * (1 - letters) + lt * lit * letters
    # the rim: a raised edge catching the lamp light, dark outside it
    e = np.minimum(np.minimum(xs, W - 1 - xs), np.minimum(ys, H - 1 - ys)) / k
    rim = smooth(2.0, 3.5, e) * (1 - smooth(5.5, 7.5, e))
    t = t * (1 - rim) + (0.30 * lit) * rim
    t = np.where(e < 2.0, 0.04, t)
    blood = np.clip(red * 0.55 + 0.25 * smooth(0.72, 0.95, rust) * (1 - letters), 0, 0.6) * (1 - rim)
    al = smooth(0.0, 1.2, e)
    return t.astype(np.float32), blood.astype(np.float32), al.astype(np.float32)


def scene_road(w, h):
    """The road into town at night in the rain: wet asphalt running to a vanishing point, power poles and a barbed-wire fence receding
    into the fog, a parked car with its tail lights on, a streetlamp diffused in the haze, and the town's sign large on the right verge
    under its two lamps. Depth by atmospheric perspective: everything fades toward the fog tone with distance."""
    k = h / REF[1]
    ox = (w - REF[0] * k) / 2
    xs, ys = grid(w, h)
    X = (xs - ox) / k
    Y = ys / k
    VX, VY, F, CAM = 560.0, 735.0, 1400.0, 1.5        # vanishing point, focal (ref px), camera height (m)
    ZF = 48.0                                          # fog distance (m): an object at z keeps exp(-z / ZF) of itself

    def fogged(t, z, fogt):
        a = 1 - np.exp(-np.asarray(z, np.float32) / ZF)
        return t * (1 - a) + fogt * a

    def at(z, xw, hm=0.0):
        """World (lateral m, depth m, height m) -> reference px."""
        return VX + xw * F / z, VY + (CAM - hm) * F / z

    # 1. the sky: fog lit from below by the town, the streetlamp's glow, a slow drift of fog clouds
    LX, LY = 365.0, 342.0
    r = np.hypot(X - LX, (Y - LY) * 1.15)
    clouds = noise(w, h, 71, 420 * k, 4, sx=2.8)
    sky = 0.075 + 0.07 * smooth(0, 1, 1 - np.abs(Y - VY) / 700) + 0.035 * clouds
    glow = 0.80 * np.exp(-(r / 26) ** 2) + 0.30 * np.exp(-r / 120) + 0.15 * np.exp(-r / 520)
    sky = sky + glow * (0.8 + 0.2 * clouds)
    sky = sky * (1 - 0.35 * smooth(0.55, 1.0, (X - 900) / 1400))      # darker toward the right
    fogt = 0.075 + 0.08 * smooth(0, 1, 1 - np.abs(Y - VY) / 500) + 0.04 * clouds + 0.10 * np.exp(-r / 420)
    tone = sky.copy()

    # 2. the far shore: the town's roofs and dead trees on the horizon, nearly gone in the fog
    col = X[0]
    t1 = wnoise(col / 90, np.zeros_like(col), 72, 4)
    t2 = wnoise(col / 14, np.ones_like(col) * 3, 73, 3)
    ridge = VY - 10 - 70 * t1 ** 1.6 - 34 * smooth(0.55, 0.9, t2) * t1
    tone = np.where((Y > ridge[None, :]) & (Y <= VY + 2), fogged(0.05, 130, fogt), tone)
    # a nearer tree line on the left: dead crowns, darker
    t3 = wnoise(col / 40, np.ones_like(col) * 7, 74, 4)
    t4 = wnoise(col / 6, np.ones_like(col) * 9, 75, 2)
    left = 1 - smooth(VX - 120, VX + 40, col)
    ridge2 = VY - left * (40 + 170 * t3 ** 1.3 + 50 * (t4 - 0.5))
    tone = np.where((Y > ridge2[None, :]) & (Y <= VY + 2) & (left[None, :] > 0.02), fogged(0.04, 75, fogt), tone)
    # dead trees behind the sign on the right, paler still
    t5 = wnoise(col / 55, np.ones_like(col) * 11, 90, 4)
    t6 = wnoise(col / 5, np.ones_like(col) * 13, 91, 2)
    right = smooth(VX + 160, VX + 420, col) * (1 - smooth(1500, 1800, col))
    ridge3 = VY - right * (20 + 120 * t5 ** 1.5 + 40 * (t6 - 0.5))
    tone = np.where((Y > ridge3[None, :]) & (Y <= VY + 2) & (right[None, :] > 0.02), fogged(0.04, 95, fogt), tone)
    # 3. the ground: wet asphalt in perspective, its lane lines, the gravel shoulder and the dead verge
    below = np.maximum(Y - VY, 0.5)
    z = CAM * F / below                                # depth of each ground pixel (m)
    xw = (X - VX) * z / F                              # lateral position (m)
    pix = z / F                                        # one ref px in metres at that depth
    detail = np.exp(-z / 30)                           # texture fades out with depth (no aliasing far off)
    HALF = 3.1
    road = 1 - smooth(HALF - 0.02 - 2 * pix, HALF + 0.02 + 2 * pix, np.abs(xw))
    shoulder = (1 - smooth(HALF + 0.6, HALF + 0.9, np.abs(xw))) * (1 - road)
    tex = wnoise(xw * 3.0, z * 3.0, 77, 3)
    patch = smooth(0.55, 0.75, wnoise(xw * 0.35, z * 0.18, 78, 3))
    asphalt = 0.045 + detail * (0.03 * tex + 0.02 * patch)
    cracks = wnoise(xw * 1.3, z * 0.5, 79, 4)
    asphalt -= 0.03 * detail * smooth(0.04, 0.0, np.abs(cracks - 0.5)) * (pix < 0.03)

    def paint(c, half_w):
        return np.clip((half_w - np.abs(xw - c)) / np.maximum(pix, 1e-4) + 0.5, 0, 1)
    dash = (np.mod(z + 1.5, 9.0) < 3.2).astype(np.float32)
    lines = 0.20 * paint(0.0, 0.07) * dash + 0.16 * paint(HALF - 0.15, 0.06) + 0.16 * paint(-HALF + 0.15, 0.06)
    lines *= 0.6 + 0.4 * wnoise(xw * 6, z * 2, 80, 2)                   # worn paint
    verge = 0.035 + detail * 0.05 * wnoise(xw * 4, z * 4, 81, 3) * wnoise(xw * 0.5, z * 0.5, 82, 2)
    gravel = 0.06 + detail * 0.04 * wnoise(xw * 12, z * 12, 83, 2)
    gnd = verge * (1 - road - shoulder) + gravel * shoulder + (asphalt + lines) * road
    # the wet: puddles, and a sheen everywhere on the road; the sky and the lights mirrored in it
    puddle = smooth(0.50, 0.62, wnoise(xw * 0.45, z * 0.22, 84, 3))
    wet = road * (0.35 + 0.65 * puddle) + shoulder * 0.15
    mir = np.clip(np.round((2 * VY - Y) * k).astype(np.int64), 0, h - 1)
    refl = np.take_along_axis(sky, mir, axis=0)
    ripple = 0.65 + 0.35 * wnoise(xw * 8, z * 1.2, 85, 2)
    fres = 0.35 + 0.5 * np.exp(-below / 260)          # grazing angles mirror more
    gnd = gnd * (1 - 0.6 * wet * fres) + refl * 0.6 * wet * fres * ripple
    hrow = tone[min(h - 1, round(VY * k) - 1):min(h, round(VY * k)), :]          # the fog at the horizon: the ground melts into it
    gnd = fogged(gnd, np.minimum(z, 400), 0.5 * fogt + 0.5 * hrow)
    tone = np.where(Y > VY, gnd, tone)
    # the fog bank lying on the horizon, over the far shore and the far road alike
    bank = np.exp(-((Y - VY + 4) / 60) ** 2) * (0.6 + 0.4 * noise(w, h, 76, 180 * k, 3, sx=5.0))
    tone = tone + 0.09 * bank

    # light streaks on the wet road under each light: (x, y of the light, its ground y, strength, width ref px, tone, blood)
    blood = np.zeros_like(tone)
    streaks = []
    ink = _Ink(w, h, ox, k)

    # 4. power poles on both verges, receding, with crossarms, insulators and sagging wires
    def pole_row(xw0, zs, height, arms):
        tops = []
        for zz in zs:
            bx, by = at(zz, xw0)
            tx, ty = at(zz, xw0, height)
            s = F / zz
            ft = float(fogged(0.025, zz, 0.16 - 0.06 * min(1, zz / 120)))
            ink.line([(bx, by), (tx, ty)], max(0.7, 0.30 * s), ft)
            for i, (span, dy) in enumerate(arms):
                ax0, ax1 = tx - span * s, tx + span * s
                ay = ty + dy * s
                ink.line([(ax0, ay), (ax1, ay)], max(0.6, 0.16 * s), ft)
                for q in np.linspace(-span * 0.85, span * 0.85, 3):
                    ink.line([(tx + q * s, ay), (tx + q * s, ay - 0.25 * s)], max(0.5, 0.07 * s), ft)
            tops.append((zz, tx, ty, s, ft))
        for (z1, x1, y1, s1, f1), (z2, x2, y2, s2, f2) in zip(tops, tops[1:]):
            for span, dy in arms:
                for q in (-span * 0.85, 0.0, span * 0.85):
                    pts = []
                    for u in np.linspace(0, 1, 40):
                        zz = z1 + (z2 - z1) * u
                        xa = x1 + q * s1 + ((x2 + q * s2) - (x1 + q * s1)) * u
                        ya = (y1 - 0.25 * s1 + dy * s1) + ((y2 - 0.25 * s2 + dy * s2) - (y1 - 0.25 * s1 + dy * s1)) * u
                        pts.append((xa, ya + 0.9 * math.sin(math.pi * u) * F / zz))
                    ink.line(pts, max(0.5, 0.035 * s1), (f1 + f2) / 2)
    pole_row(-6.2, [16, 34, 52, 70, 88, 106, 124, 142], 10.5, [(1.3, 0.6), (0.9, 1.5)])
    pole_row(7.0, [25, 43, 61, 79, 97, 115], 10.0, [(1.2, 0.6)])
    # the streetlamp the glow belongs to: a curved arm off a tall pole, far up the left verge
    bx, by = at(30, -4.8)
    tx, ty = at(30, -4.8, 9.6)
    ft = float(fogged(0.03, 30, 0.2))
    ink.line([(bx, by), (tx, ty)], 0.32 * F / 30, ft)
    ink.line([(tx, ty), (tx + 8, ty - 8), (LX - 6, LY - 6), (LX + 10, LY - 2)], 0.20 * F / 30, ft)
    streaks.append((LX, LY, VY + 6, 0.55, 26, 1.0, 0.0))

    # 5. the barbed-wire fence along the left verge: posts receding, three strands, barbs
    fz = np.arange(8.5, 90, 3.4)
    posts = []
    for zz in fz:
        bx, by = at(zz, -3.95)
        tx, ty = at(zz, -3.95, 1.35 + 0.05 * math.sin(zz * 1.7))
        s = F / zz
        ft = float(fogged(0.03, zz, 0.15))
        lean = 0.05 * math.sin(zz * 2.3) * s
        ink.line([(bx, by), (tx + lean, ty)], max(0.6, 0.11 * s), ft)
        posts.append((zz, bx, by, tx + lean, ty, s, ft))
    for (z1, bx1, by1, tx1, ty1, s1, f1), (z2, bx2, by2, tx2, ty2, s2, f2) in zip(posts, posts[1:]):
        for hm in (0.45, 0.85, 1.22):
            pts = []
            for u in np.linspace(0, 1, 12):
                zz = z1 + (z2 - z1) * u
                xa, ya = at(zz, -3.95, hm - 0.05 * math.sin(math.pi * u))
                pts.append((xa, ya))
            ink.line(pts, max(0.45, 0.018 * s1), (f1 + f2) / 2)
            for u in np.linspace(0.12, 0.88, 4):
                zz = z1 + (z2 - z1) * u
                xa, ya = at(zz, -3.95, hm)
                b = 0.06 * F / zz
                if b > 1.2:
                    ink.line([(xa - b, ya - b), (xa + b, ya + b)], max(0.45, 0.015 * F / zz), (f1 + f2) / 2)
                    ink.line([(xa - b, ya + b), (xa + b, ya - b)], max(0.45, 0.015 * F / zz), (f1 + f2) / 2)
    tone = ink.over(tone, 0.5)

    # 6. the parked car: a hatchback seen from behind on the left lane, its tail lights on
    cz, cxw = 13.0, -1.0
    s = F / cz
    cx, cy = at(cz, cxw)
    car = _Ink(w, h, ox, k)
    cw, chh = 1.78 * s, 1.45 * s
    body = 0.028
    car.ellipse((cx - cw * 0.50, cy - 0.02 * s, cx + cw * 0.50, cy + 0.10 * s), 0.02)     # its shadow on the wet road
    for sx_ in (-1, 1):                                                                       # tyres
        car.poly([(cx + sx_ * cw * 0.30, cy - 0.40 * s), (cx + sx_ * cw * 0.43, cy - 0.40 * s),
                  (cx + sx_ * cw * 0.43, cy + 0.01 * s), (cx + sx_ * cw * 0.30, cy + 0.01 * s)], 0.012)
    car.poly([(cx - cw / 2, cy - 0.32 * s), (cx - cw / 2, cy - 0.86 * s), (cx - cw * 0.46, cy - 0.95 * s),
              (cx - cw * 0.40, cy - chh * 0.97), (cx - cw * 0.30, cy - chh), (cx + cw * 0.30, cy - chh), (cx + cw * 0.40, cy - chh * 0.97),
              (cx + cw * 0.46, cy - 0.95 * s), (cx + cw / 2, cy - 0.86 * s), (cx + cw / 2, cy - 0.32 * s)], body)
    car.poly([(cx - cw * 0.36, cy - 0.97 * s), (cx - cw * 0.30, cy - chh * 0.93), (cx + cw * 0.30, cy - chh * 0.93),
              (cx + cw * 0.36, cy - 0.97 * s)], 0.085)                                   # the rear window, the fog behind seen through
    car.poly([(cx - cw * 0.44, cy - 0.46 * s), (cx + cw * 0.44, cy - 0.46 * s), (cx + cw * 0.44, cy - 0.40 * s),
              (cx - cw * 0.44, cy - 0.40 * s)], 0.05)                                    # the bumper's edge
    car.poly([(cx - cw * 0.12, cy - 0.66 * s), (cx + cw * 0.12, cy - 0.66 * s), (cx + cw * 0.12, cy - 0.56 * s),
              (cx - cw * 0.12, cy - 0.56 * s)], 0.06)                                    # the plate
    carf = float(1 - math.exp(-cz / ZF))
    before = tone.copy()
    tone = car.over(tone, 0.8)
    cov = np.abs(tone - before) > 1e-6
    tone = np.where(cov, tone * (1 - carf) + 0.13 * carf, tone)
    occl = np.asarray(Image.fromarray((cov * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5 * k)), np.float32) / 255
    # its dark double in the wet road, broken by the ripples
    dbl = (1 - smooth(cw * 0.36, cw * 0.48, np.abs(X - cx))) * smooth(cy, cy + 0.08 * s, Y) * np.exp(-np.maximum(Y - cy, 0) / (0.55 * s))
    tone = tone * (1 - 0.55 * dbl * (0.55 + 0.45 * wnoise(X / 40, Y / 5, 92, 2)))
    # the roof and shoulders catch the haze behind it (a thin rim)
    rim = np.exp(-(((Y - (cy - chh)) / 2.0) ** 2)) * (np.abs(X - cx) < cw * 0.29)
    tone = tone + 0.06 * rim
    # its tail lights: blood, with a hot core, a halo in the rain and long streaks on the road
    tail = np.zeros_like(tone)
    for sx in (-1, 1):
        lx, ly = cx + sx * cw * 0.40, cy - 0.80 * s
        d = np.hypot((X - lx) / (cw * 0.07), (Y - ly) / (0.07 * s))
        tail = np.maximum(tail, smooth(1.0, 0.6, d))
        halo = np.exp(-np.hypot(X - lx, Y - ly) / (0.35 * s))
        blood = np.maximum(blood, 0.95 * smooth(1.2, 0.4, d) + 0.0 * halo)
        blood = np.maximum(blood, 0.45 * halo)
        tone = tone + 0.25 * smooth(1.0, 0.3, d)
        streaks.append((lx, ly, cy + 2, 0.0, 0.06 * s, 0.0, 0.70))

    # 7. the sign: large on the right verge, on two posts, two lamps over it
    t, rb, al = _sign_plate(k)
    sw, sh = t.shape[1] / k, t.shape[0] / k                     # its size in ref px
    PX0, PY0 = 975.0, 512.0                                      # the plate's top-left (ref px)
    sz = 9.6
    gy = VY + CAM * F / sz                                       # where its posts meet the ground
    sp = _Ink(w, h, ox, k)
    sc = sw / (SIGN_PLATE[2] - SIGN_PLATE[0])
    for pc in SIGN_POSTS:
        x_ = PX0 + (pc - SIGN_PLATE[0]) * sc
        sp.line([(x_, PY0 + sh - 4), (x_ + 1, gy)], 13, 0.03)
        sp.line([(x_ - 4, PY0 + sh - 4), (x_ - 3, gy)], 2.2, 0.10)            # the lit edge of the post
        # the lamp: a hood on a gooseneck, the bulb under it
        hx, hy = x_ - 2, PY0 - 70
        sp.line([(x_, PY0 + 6), (x_, PY0 - 22), (x_ - 2, hy + 18)], 6, 0.035)
        sp.poly([(hx - 9, hy - 14), (hx + 9, hy - 14), (hx + 30, hy + 16), (hx - 30, hy + 16)], 0.04)
        sp.ellipse((hx - 30, hy + 10, hx + 30, hy + 24), 0.06)
        sp.ellipse((hx - 18, hy + 13, hx + 18, hy + 23), 0.95)                 # the bulb's glare under the hood
        sp.ellipse((hx - 4, hy - 22, hx + 4, hy - 12), 0.04)
        streaks.append((hx, hy + 20, gy + 4, 0.30, 16, 1.0, 0.0))
        rng = np.random.default_rng(int(pc))
        for _ in range(28):                                                  # dead grass round its foot
            gx = x_ + rng.normal(0, 26)
            ln = rng.uniform(14, 46)
            sp.line([(gx, gy + rng.uniform(-2, 6)), (gx + rng.normal(0, 8), gy - ln)], 1.6, 0.02)
    tone = sp.over(tone, 0.4)
    sfog = float(1 - math.exp(-sz / ZF))
    t = t * (1 - sfog) + 0.12 * sfog
    X0, Y0 = round(ox + PX0 * k), round(PY0 * k)
    tone = paste(tone, t, X0, Y0, al)
    blood = paste(blood, rb, X0, Y0, al)

    # 8. light: the lamps' glare in the rain, their cones falling through the fog onto the plate and the verge
    light = np.zeros_like(tone)
    for pc in SIGN_POSTS:
        x_ = PX0 + (pc - SIGN_PLATE[0]) * sc - 2
        hy = PY0 - 70 + 20
        rr = np.hypot(X - x_, Y - hy)
        light += 0.55 * np.exp(-(rr / 14) ** 2) + 0.20 * np.exp(-rr / 60) + 0.08 * np.exp(-rr / 260)
        dy = Y - hy
        ang = np.abs(X - x_) / np.maximum(dy, 1)
        cone = (dy > 0) * smooth(1.25, 0.30, ang) * np.exp(-np.maximum(dy, 0) / 460) * smooth(0, 40, dy)
        light += 0.12 * cone
    dy = Y - LY
    ang = np.abs(X - LX) / np.maximum(dy, 1)
    light += 0.06 * (dy > 0) * smooth(1.1, 0.3, ang) * np.exp(-np.maximum(dy, 0) / 700) * smooth(0, 60, dy)
    shafts = noise(w, h, 86, 70 * k, 2, sx=0.10)                # the fog is uneven: the cones are streaky
    tone = tone + light * (0.75 + 0.5 * shafts)

    # 9. the streaks the lights lay on the wet road
    wetmask = (Y > VY) * (0.3 + 0.7 * wet)
    for lx, ly, gy0, st, wd, tt, bb in streaks:
        dy = Y - gy0
        ok = dy > 0
        spread = wd * (1 + dy / 300)
        band = np.exp(-((X - lx) / np.maximum(spread, 0.5)) ** 2) * ok * np.exp(-np.maximum(dy, 0) / 520)
        brk = smooth(0.35, 0.75, wnoise(X / 30, Y / 7, 87, 3))  # broken by ripples
        v = band * brk * wetmask * (1 - occl)
        if tt:
            tone = tone + st * v
        if bb:
            blood = np.maximum(blood, bb * v)

    # 10. rain: a fine far veil and heavy near streaks, brightest where the light catches them
    fine = rain(w, h, k, 88, 2600, 0.6, slant=0.12, length=(18, 60))
    heavy = rain(w, h, k, 89, 420, 0.9, slant=0.12, length=(120, 320))
    heavy = np.asarray(Image.fromarray((heavy * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2 * k)), np.float32) / 255
    tone = tone + (0.025 + 0.9 * light) * fine + (0.04 + 0.6 * light) * heavy

    # 11. the dark closing in from the right where the clock lives, a vignette, then the print
    tone = tone * (1 - 0.80 * smooth(0.555, 0.80, X / 2560))
    tone = tone * (1 - 0.45 * vignette(w, h, 0.30, 0.50, 0.78, 0.80))
    return finish(np.clip(tone, 0, 1.2), np.clip(blood, 0, 1), w, h, k, 31, 0.030, red_scratches=0.15)


def scene_moth(w, h):
    """The moth pinned to a stained plaster wall, the red sight through its body, cracks running off."""
    from PIL import ImageDraw
    k = h / REF[1]
    ox = (w - REF[0] * k) / 2
    xs, ys = grid(w, h)
    X = (xs - ox) / k
    Y = ys / k
    plaster = noise(w, h, 41, 120 * k, 5)
    pores = noise(w, h, 45, 6 * k, 2)
    seep = noise(w, h, 42, 700 * k, 3, sx=0.06)          # water stains running down the wall
    tone = 0.05 + 0.05 * plaster + 0.03 * pores - 0.035 * smooth(0.55, 0.95, seep)
    # cracks: random walks from the moth outward
    cr = Image.new("L", (w, h), 0)
    cd = ImageDraw.Draw(cr)
    rng = np.random.default_rng(43)
    cx, cy = 720.0, 700.0
    for i in range(16):
        ang = rng.uniform(0, 2 * math.pi)
        x, y = cx + math.cos(ang) * 280, cy + math.sin(ang) * 250
        pts = [((x + ox / k) * k, y * k)]
        for j in range(int(rng.integers(10, 30))):
            ang += rng.normal(0, 0.40)
            st = rng.uniform(10, 26)
            x, y = x + math.cos(ang) * st, y + math.sin(ang) * st
            pts.append(((x + ox / k) * k, y * k))
        cd.line(pts, fill=int(rng.uniform(150, 255)), width=max(1, round(rng.uniform(1.0, 2.2) * k)))
    crack = np.asarray(cr.filter(ImageFilter.GaussianBlur(0.5 * k)), np.float32) / 255
    tone = tone * (1 - 0.85 * crack)
    # the sight: two thin red lines through the moth, broken near its body
    blood = np.zeros_like(tone)
    gap = 270
    vline = (np.abs(X - cx) < 1.0) & (np.abs(Y - cy) > gap) & (np.abs(Y - cy) < 620)
    hline = (np.abs(Y - cy) < 1.0) & (np.abs(X - cx) > gap) & (np.abs(X - cx) < 660)
    sight = np.asarray(Image.fromarray(((vline | hline) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6 * k)), np.float32) / 255
    fade = 1 - smooth(gap, 660, np.hypot(X - cx, Y - cy))
    blood = np.maximum(blood, 0.9 * sight * (0.25 + 0.75 * fade))
    t, r, al = _sprite(SPRITE_MOTH, 1.45 * k)
    mx0, my0 = round(ox + cx * k - t.shape[1] / 2), round(cy * k - t.shape[0] / 2)
    tl = np.clip((t - 0.03) / 0.85, 0, 1) * 0.86
    tone = paste(tone, tl, mx0, my0, al)
    blood = paste(blood, np.clip(r * 1.25, 0, 1), mx0, my0, al)
    # a few old drops of blood under it, run down the wall
    blood = np.maximum(blood, _drips(w, h, k, [(cx - 70 + ox / k, cy + 150, 260, 3.0), (cx + 95 + ox / k, cy + 170, 170, 2.4)], 9))
    tone = tone * (1 - 0.5 * vignette(w, h, 0.30, 0.48, 0.62, 0.78))
    return finish(tone, blood, w, h, k, 41)


SCENES = {"tomie": scene_tomie, "pyramid": scene_pyramid, "road": scene_road, "moth": scene_moth}

# The boot pictures (bootComposition card-<key>, ito-plymouth): each scene's subject cut from its 2560x1440 render, reference px.
# Plymouth centres one picture over a flat colour, so the edges dissolve into transparency; no text is ever baked in.
BOOT_BOX = {"tomie": (100, 0, 1460, 1440), "pyramid": (110, 70, 1390, 1440), "road": (0, 170, 1520, 1310), "moth": (330, 330, 1110, 1070)}


def boot_card(img, key):
    """The boot picture of a scene rendered at REF: BOOT_BOX cut, edges eaten by a ragged soft fade. RGBA in the reference palette."""
    im = img.convert("RGB").crop(BOOT_BOX[key])
    w, h = im.size
    xs, ys = grid(w, h)
    d = np.minimum(np.minimum(xs, w - 1 - xs), np.minimum(ys, h - 1 - ys))
    e = 0.11 * min(w, h)
    rag = noise(w, h, 51, 0.03 * min(w, h), 4)
    a = smooth(0.0, e, d - (rag - 0.5) * 0.5 * e) * smooth(0.0, 0.3 * e, d)
    out = im.convert("RGBA")
    out.putalpha(Image.fromarray((a * 255 + 0.5).astype(np.uint8)))
    return out


def safe_report(img, w, h):
    """Mean and spread of the tone inside the text column (the reference palette inverted): the calm-column check."""
    a = np.asarray(img.convert("RGB"), np.float32)
    lum = (a @ np.array([0.2126, 0.7152, 0.0722], np.float32))
    li, lb = float(INK_REF @ [0.2126, 0.7152, 0.0722]), float(BONE_REF @ [0.2126, 0.7152, 0.0722])
    t = (lum - li) / (lb - li)
    k = h / REF[1]
    ox = (w - REF[0] * k) / 2
    x0, y0, x1, y1 = (round(ox + SAFE[0] * k), round(SAFE[1] * k), round(ox + SAFE[2] * k), round(SAFE[3] * k))
    col = t[y0:y1, x0:x1]
    return {"mean": round(float(col.mean()), 4), "p95": round(float(np.percentile(col, 95)), 4)}


def products(keys=None, sizes=SIZES):
    """[(rel, PIL)] for every scene whose source is set: the lock scene at every size (RGB) and its boot picture (RGBA); raises ValueError when a scene's text column is not calm."""
    out = []
    for key in (keys or available()):
        if key not in available():
            raise ValueError(f"the {key} scene needs its picture")
        for w, h in sizes:
            im = SCENES[key](w, h)
            rep = safe_report(im, w, h)
            if rep["mean"] > SAFE_TONE:
                raise ValueError(f"{key} {w}x{h}: the text column is not calm (mean tone {rep['mean']} > {SAFE_TONE})")
            out.append((f"lock/{key}-{w}x{h}.png", im))
            if (w, h) == REF:
                out.append((f"cards/{key}.png", boot_card(im, key)))
    return out

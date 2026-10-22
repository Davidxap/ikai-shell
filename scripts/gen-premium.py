#!/usr/bin/env python3
"""Draw the two icons the design sheet does not have, in the sheet's own engraved manner.

The bar's instruments are drawn glyphs (clean thin lines), and the sheet's icons are engravings: heavy
outline that swells and thins, hatching for shade, worn edges, a little red where something bleeds. A brain
and a specimen jar drawn as clean lines sit between the two and look cheap next to both. So these are made
the way the sheet's are: variable-width ink, hatched shading, a wear mask that nicks the edges, and a
final unsharp - at 4x, then brought down.

    gen-premium.py     writes bar/modules/ito-art/system/{brain,jar}.png and their -fill silhouettes
"""

from __future__ import annotations

import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "bar" / "modules" / "ito-art" / "system"

S = 640                       # working size; brought down at the end
BONE = (199, 204, 209)
BONE_DIM = (150, 156, 162)
BLOOD = (196, 22, 42)
RNG = random.Random(20260920)


# ------------------------------------------------------------------ ink
def ink(layer: Image.Image, pts, w0, w1, color, wobble=1.4, pressure=True):
    """A stroke that swells in the middle and thins at both ends, the way a pen does."""
    d = ImageDraw.Draw(layer)
    n = len(pts)
    for i in range(n - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        steps = max(1, int(math.hypot(x1 - x0, y1 - y0) / 1.2))
        for k in range(steps):
            t = (i + k / steps) / max(1, n - 1)
            swell = math.sin(math.pi * t) if pressure else 1.0
            r = (w0 + (w1 - w0) * swell) / 2 + RNG.uniform(-0.25, 0.25)
            x = x0 + (x1 - x0) * k / steps + RNG.uniform(-wobble, wobble) * 0.3
            y = y0 + (y1 - y0) * k / steps + RNG.uniform(-wobble, wobble) * 0.3
            d.ellipse((x - r, y - r, x + r, y + r), fill=color)


def arc(cx, cy, rx, ry, a0, a1, n=120, bump=0.0, lobes=0, phase=0.0):
    out = []
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        k = 1 + bump * math.sin(lobes * a + phase)
        out.append((cx + math.cos(a) * rx * k, cy + math.sin(a) * ry * k))
    return out


def wave(x0, y0, x1, y1, amp, waves, n=80, phase=0.0):
    dx, dy = x1 - x0, y1 - y0
    ln = math.hypot(dx, dy)
    out = []
    for i in range(n + 1):
        t = i / n
        off = math.sin(t * waves * math.tau + phase) * amp * (0.6 + 0.4 * math.sin(math.pi * t))
        out.append((x0 + dx * t - dy / ln * off, y0 + dy * t + dx / ln * off))
    return out


def spiral(cx, cy, r, turns, n=260, start=0.06):
    return [(cx + math.cos(t * turns * math.tau) * r * t, cy + math.sin(t * turns * math.tau) * r * t)
            for t in (start + (1 - start) * i / n for i in range(n + 1))]


def hatch(mask: Image.Image, color, angle, gap, width, strength=1.0, region=None):
    """Parallel lines clipped to `mask`, fading through `region` (an L image) so shade builds up."""
    layer = Image.new("RGBA", mask.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    ca, sa = math.cos(angle), math.sin(angle)
    span = int(S * 1.5)
    for k in range(-span, span, gap):
        x0, y0 = S / 2 + ca * -span - sa * k, S / 2 + sa * -span + ca * k
        x1, y1 = S / 2 + ca * span - sa * k, S / 2 + sa * span + ca * k
        d.line((x0, y0, x1, y1), fill=color + (255,), width=width)
    a = ImageChops.multiply(layer.getchannel("A"), mask)
    if region is not None:
        a = ImageChops.multiply(a, region)
    a = a.point(lambda v: int(v * strength))
    layer.putalpha(a)
    return layer


def gradient(size, cx, cy, r, inner=0, outer=255, invert=False):
    y, x = np.mgrid[0:size, 0:size]
    d = np.clip(np.hypot(x - cx, y - cy) / r, 0, 1)
    v = inner + (outer - inner) * d
    if invert:
        v = 255 - v
    return Image.fromarray(v.astype("uint8"), "L")


def wear(img: Image.Image, amount=0.55, seed=3) -> Image.Image:
    """Nick the edges and thin the ink in patches, so nothing looks freshly vector."""
    rng = np.random.default_rng(seed)
    noise = rng.random((S, S)).astype("float32")
    fine = Image.fromarray((noise * 255).astype("uint8"), "L").filter(ImageFilter.GaussianBlur(1.1))
    coarse = Image.fromarray((rng.random((S // 12, S // 12)) * 255).astype("uint8"), "L").resize((S, S), Image.BICUBIC)
    f = np.asarray(fine).astype("float32") / 255
    c = np.asarray(coarse).astype("float32") / 255
    keep = np.clip(1.15 - amount * (np.clip((f - 0.62) * 5, 0, 1) * 0.9 + np.clip((c - 0.7) * 3, 0, 1) * 0.5), 0, 1)
    a = np.asarray(img.getchannel("A")).astype("float32") * keep
    out = img.copy()
    out.putalpha(Image.fromarray(a.astype("uint8"), "L"))
    return out


def finish(img: Image.Image, size=160) -> Image.Image:
    img = img.resize((size, size), Image.LANCZOS)
    return img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=70, threshold=2))


def silhouette(poly, size=160) -> Image.Image:
    """The inside of a drawing as a solid shape: what the level of blood is clipped to, so it fills the
    brain or the jar to its edges instead of only the pixels the engraving happens to ink."""
    m = Image.new("L", (S, S), 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    m = m.filter(ImageFilter.GaussianBlur(2)).resize((size, size), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    out.putalpha(m)
    return out


# ------------------------------------------------------------------ the brain
def brain():
    base = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    red = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    cx, cy, rx, ry = S / 2, S / 2 - 10, 250, 205

    outline = arc(cx, cy, rx, ry, 0, math.tau, 240, bump=0.05, lobes=9, phase=0.4)
    fill = Image.new("L", (S, S), 0)
    ImageDraw.Draw(fill).polygon(outline, fill=255)

    # the shade: cross-hatch gathering under the lower right, the way an engraver models a solid
    shade = gradient(S, cx - 90, cy - 90, 330, inner=0, outer=255)
    base.alpha_composite(hatch(fill, BONE_DIM, math.radians(38), 13, 3, 0.85, region=shade))
    base.alpha_composite(hatch(fill, BONE_DIM, math.radians(-52), 17, 2, 0.55,
                               region=gradient(S, cx + 110, cy + 90, 300, inner=255, outer=0, invert=False)))

    # outline, drawn twice: the heavy stroke, then a thin one gone over beside it
    ink(base, outline + outline[:2], 15, 21, BONE, wobble=2.2, pressure=False)
    ink(base, [(x + 4, y + 3) for x, y in outline], 4, 6, BONE_DIM, wobble=2.6, pressure=False)

    # the fissure down the middle, and the two hemispheres
    ink(base, wave(cx + 4, cy - ry * 0.93, cx - 6, cy + ry * 0.93, 16, 2.4), 9, 16, BONE)
    ink(base, spiral(cx - 122, cy + 4, 92, 2.9), 5, 11, BONE_DIM)
    # gyri on the right: long folded runs, and shorter ones along the rim
    for i, (y, ln, amp) in enumerate(((cy - 100, 175, 20), (cy - 30, 200, 22), (cy + 42, 190, 20), (cy + 108, 150, 16))):
        ink(base, wave(cx + 42, y, cx + 42 + ln, y + (6 if i % 2 else -6), amp, 2.4, phase=i), 6, 12, BONE)
    for k in range(9):
        a = math.radians(-70 + k * 19)
        ink(base, arc(cx, cy, rx * 0.84, ry * 0.84, a, a + 0.22, 20), 4, 8, BONE_DIM, pressure=True)

    # the blood in it: a vein network the level fill will sit over, so the brain is never clean
    trunk = wave(cx + 150, cy - 140, cx + 40, cy + 20, 14, 1.4)
    ink(red, trunk, 5, 9, BLOOD)
    ink(red, wave(cx + 40, cy + 20, cx - 20, cy + 128, 10, 1.2), 4, 7, BLOOD)
    ink(red, wave(cx + 96, cy - 62, cx + 196, cy - 24, 8, 1.0), 3, 6, BLOOD)
    ink(red, wave(cx - 200, cy - 110, cx - 120, cy - 36, 9, 1.1), 3, 6, BLOOD)
    base.alpha_composite(red)
    return finish(wear(base, 0.5, seed=11)), silhouette(outline)


# ------------------------------------------------------------------ the jar
def jar():
    base = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    cx = S / 2
    left, right = cx - 170, cx + 170
    top_body, bottom = 176, 590

    # the glass: straight shoulders, a round base
    body = [(left + 20, top_body), (left, top_body + 34), (left, bottom - 110)]
    body += arc(cx, bottom - 110, 170, 110, math.pi, 0, 80)[::-1][::-1]
    body = [(left + 26, top_body), (left, top_body + 36), (left, bottom - 120)] + arc(cx, bottom - 120, 196, 120, math.pi, 0, 90) \
        + [(right, top_body + 36), (right - 26, top_body)]
    glass = Image.new("L", (S, S), 0)
    ImageDraw.Draw(glass).polygon(body + body[:1], fill=255)

    # shade: hatching down the left, where the glass turns away, and a clear streak on the right
    edge = gradient(S, left, S / 2, 220, inner=255, outer=0)
    base.alpha_composite(hatch(glass, BONE_DIM, math.radians(72), 12, 3, 0.85, region=edge))
    streak = Image.new("L", (S, S), 0)
    ImageDraw.Draw(streak).rounded_rectangle((right - 62, top_body + 46, right - 36, bottom - 160), 12, fill=255)
    base.alpha_composite(hatch(streak, BONE, math.radians(80), 9, 2, 0.6))

    # the lid: a broad band with ridges, and the lip under it
    lid = (left + 8, 58, right - 8, 150)
    ImageDraw.Draw(base).rounded_rectangle(lid, 16, fill=(20, 24, 27, 255))
    ink(base, [(lid[0], lid[1]), (lid[2], lid[1]), (lid[2], lid[3]), (lid[0], lid[3]), (lid[0], lid[1])], 12, 16, BONE, pressure=False)
    for x in range(int(lid[0] + 28), int(lid[2] - 20), 30):
        ink(base, [(x, lid[1] + 14), (x + 2, lid[3] - 14)], 4, 8, BONE_DIM)
    ink(base, [(left + 22, 150), (left + 22, top_body + 6)], 10, 14, BONE)
    ink(base, [(right - 22, 150), (right - 22, top_body + 6)], 10, 14, BONE)

    # the jar's outline
    ink(base, body, 16, 22, BONE, wobble=2.0, pressure=False)
    ink(base, [(x + 5, y + 2) for x, y in body[1:-1]], 4, 6, BONE_DIM, wobble=2.4, pressure=False)

    # what is in it, coiled: a spiral, drawn as if it had been moving
    ink(base, spiral(cx - 6, bottom - 175, 92, 3.0), 6, 12, BONE)
    ink(base, spiral(cx - 6, bottom - 175, 60, 2.2, start=0.25), 3, 6, BONE_DIM)
    # a label line and a drip of the fluid on the lid
    ink(base, [(cx - 66, top_body + 96), (cx + 66, top_body + 92)], 5, 8, BONE_DIM)
    red = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ink(red, [(right - 44, 150), (right - 40, 205), (right - 46, 236)], 8, 13, BLOOD)
    ink(red, [(right - 46, 236), (right - 46, 252)], 12, 16, BLOOD, pressure=False)
    base.alpha_composite(red)
    return finish(wear(base, 0.45, seed=29)), silhouette(body + body[:1])


# ------------------------------------------------------------------ the menu marks
def ring(layer, cx, cy, r, w, color, gap=None):
    ink(layer, arc(cx, cy, r, r, 0, math.tau, 200), w, w, color, wobble=1.6, pressure=False)
    if gap:
        ink(layer, arc(cx, cy, r + gap, r + gap, 0, math.tau, 200), max(2, w * 0.4), max(2, w * 0.4), color, wobble=1.8, pressure=False)


def eye(layer, cx, cy, w, h, color, pupil):
    top = [(cx - w, cy), (cx - w * 0.5, cy - h * 0.9), (cx + w * 0.5, cy - h * 0.9), (cx + w, cy)]
    bot = [(cx + w, cy), (cx + w * 0.5, cy + h * 0.9), (cx - w * 0.5, cy + h * 0.9), (cx - w, cy)]
    ink(layer, top + bot, 12, 16, color, wobble=1.4, pressure=False)
    ring(layer, cx, cy, h * 0.62, 10, color)
    ImageDraw.Draw(layer).ellipse((cx - h * 0.26, cy - h * 0.26, cx + h * 0.26, cy + h * 0.26), fill=pupil)


def metatron_mini() -> Image.Image:
    """The Seal of Metatron reduced to what survives at bar size: the ring, the eye, the three circles."""
    base = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    red = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    c = S / 2
    ring(base, c, c, 300, 20, BONE, gap=-26)
    ring(base, c, c, 212, 16, BONE, gap=-18)
    # the rune band, as short marks between the rings
    for k in range(36):
        a = k / 36 * math.tau
        if abs(math.sin(a - math.pi / 2)) > 0.86 and math.cos(a) < 0:      # leave the eye a clear top
            continue
        r0, r1 = 236, 274 - (k % 3) * 8
        ink(base, [(c + math.cos(a) * r0, c + math.sin(a) * r0), (c + math.cos(a + 0.05) * r1, c + math.sin(a + 0.05) * r1)],
            7, 11, BONE_DIM)
    # three circles, the seal's trinity, and a small mark in the middle
    for a in (-90, 30, 150):
        x, y = c + math.cos(math.radians(a)) * 108, c + math.sin(math.radians(a)) * 108 + 22
        ring(base, x, y, 62, 13, BONE, gap=-14)
    ink(base, [(c - 40, c + 4), (c + 40, c + 4), (c + 22, c + 56), (c - 22, c + 56), (c - 40, c + 4)], 8, 11, BONE_DIM, pressure=False)
    eye(red, c, 84, 96, 40, BLOOD, BLOOD)
    ring(red, c, c + 26, 62, 13, BLOOD, gap=-14)
    base.alpha_composite(red)
    return finish(wear(base, 0.35, seed=41))


def halo() -> Image.Image:
    """The Halo of the Sun: a disc ringed twice, with flares that alternate long and short."""
    base = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    red = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    c = S / 2
    for k in range(16):
        a = k / 16 * math.tau
        long = k % 2 == 0
        r0, r1 = 196, 300 if long else 252
        w = 26 if long else 16
        ink(base, [(c + math.cos(a) * r0, c + math.sin(a) * r0), (c + math.cos(a) * r1, c + math.sin(a) * r1)], w, w * 0.35, BONE, pressure=False)
    ring(base, c, c, 178, 18, BONE, gap=-22)
    ring(base, c, c, 120, 12, BONE_DIM)
    for i in range(10):
        ink(base, wave(c - 96, c - 60 + i * 24, c + 96, c - 60 + i * 24, 5, 2.0, phase=i), 4, 6, BONE_DIM)
    ring(red, c, c, 46, 20, BLOOD)
    ImageDraw.Draw(red).ellipse((c - 20, c - 20, c + 20, c + 20), fill=BLOOD)
    base.alpha_composite(red)
    return finish(wear(base, 0.35, seed=43))


def flauros() -> Image.Image:
    """A ring cut by a cross, a small circle in each quarter, and a red tick where the arms meet."""
    base = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    red = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    c = S / 2
    ring(base, c, c, 292, 20, BONE, gap=-24)
    ink(base, [(c, c - 292), (c, c + 292)], 12, 18, BONE, pressure=True)
    ink(base, [(c - 292, c), (c + 292, c)], 12, 18, BONE, pressure=True)
    for sx, sy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        ring(base, c + sx * 134, c + sy * 134, 72, 12, BONE_DIM, gap=-12)
        ink(base, [(c + sx * 134 - 30, c + sy * 134), (c + sx * 134 + 30, c + sy * 134)], 6, 9, BONE_DIM)
    ImageDraw.Draw(red).polygon([(c, c - 54), (c + 46, c), (c, c + 54), (c - 46, c)], fill=BLOOD)
    ring(red, c, c, 70, 12, BLOOD)
    base.alpha_composite(red)
    return finish(wear(base, 0.35, seed=47))


def metatron_full():
    """The seal as it is drawn in the game, engraved: only when the reference image is on disk."""
    ref = ROOT / "dev" / "reference" / "silent-hill-metatron.png"
    if not ref.is_file():
        return None
    src = Image.open(ref).convert("RGB").resize((S, S), Image.LANCZOS)
    # the reference is red strokes on an opaque white ground, so the strokes are where red beats green
    r, g, _ = src.split()
    mask = ImageChops.subtract(r, g).point(lambda v: 255 if v > 70 else 0).filter(ImageFilter.MaxFilter(3))
    red_zone = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(red_zone)
    k = S / 920
    d.ellipse((340 * k, 88 * k, 590 * k, 182 * k), fill=255)                          # the eye
    for x, y in ((465, 300), (335, 540), (595, 540)):                               # the three circles
        d.ellipse(((x - 100) * k, (y - 100) * k, (x + 100) * k, (y + 100) * k), fill=255)
    red_zone = red_zone.filter(ImageFilter.GaussianBlur(3))
    bone = Image.new("RGBA", (S, S), BONE + (255,))
    blood = Image.new("RGBA", (S, S), BLOOD + (255,))
    out = Image.composite(blood, bone, red_zone)
    out.putalpha(mask)
    return finish(wear(out, 0.3, seed=53), 256)


# ------------------------------------------------------------ the instruments
# The bar's instruments were drawn as thin clean lines while everything around them was engraved, so they
# read as a different set of icons in the same row. These are drawn the way the sheet's are: an outline
# that swells and thins, hatching where a surface turns away, worn edges, and blood only where something
# is cut off or bleeding. Each is drawn at 640 and brought down, so the line keeps its weight.

def slash(layer):
    """The mark for a thing that is off: a stroke drawn across it, in blood."""
    ink(layer, [(120, 140), (520, 500)], 22, 30, BLOOD, wobble=2.4, pressure=False)


def dim(alpha=0.45):
    return tuple(int(BONE[i] * alpha + 20 * (1 - alpha)) for i in range(3))


def wifi(level: int, off=False, wired=False):
    base = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    red = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    cx, cy = S / 2, 500
    if wired:
        # a plug: the body, two pins and the lead
        ImageDraw.Draw(base).rounded_rectangle((170, 250, 470, 450), 26, fill=(20, 24, 27, 255))
        ink(base, [(170, 276), (170, 424), (470, 424), (470, 276), (170, 276)], 15, 20, BONE, pressure=False)
        for x in (238, 402):
            ink(base, [(x, 250), (x, 150)], 16, 20, BONE, pressure=False)
        ink(base, [(320, 450), (320, 530)], 14, 18, BONE, pressure=False)
        base.alpha_composite(hatch(Image.new("L", (S, S), 0), BONE_DIM, 0, 12, 3))
        return finish(wear(base, 0.4, seed=61))
    for i, r in enumerate((150, 250, 350)):
        lit = (not off) and i < level
        colour = BONE if lit else dim(0.34)
        width = 30 if lit else 20
        ink(base, arc(cx, cy, r, r, math.radians(-146), math.radians(-34), 70),
            width, width * (0.55 if lit else 0.7), colour, wobble=1.8, pressure=True)
    dot = BONE if (not off and level > 0) else dim(0.34)
    ImageDraw.Draw(base).ellipse((cx - 34, cy - 34, cx + 34, cy + 34), fill=dot + (255,))
    ink(base, arc(cx, cy, 34, 34, 0, math.tau, 30), 8, 8, dot, pressure=False)
    if off:
        slash(red)
    base.alpha_composite(red)
    return finish(wear(base, 0.4, seed=63 + level))


def speaker(level: int, muted=False):
    base = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    red = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    body = [(120, 250), (210, 250), (330, 140), (330, 500), (210, 390), (120, 390)]
    shape = Image.new("L", (S, S), 0)
    ImageDraw.Draw(shape).polygon(body, fill=255)
    base.alpha_composite(hatch(shape, BONE_DIM, math.radians(55), 13, 3, 0.9,
                               region=gradient(S, 140, 200, 420, inner=0, outer=255)))
    ink(base, body + body[:1], 16, 22, BONE, wobble=1.8, pressure=False)
    for i, r in enumerate((120, 195, 270)):
        lit = (not muted) and i < level
        colour = BONE if lit else dim(0.3)
        ink(base, arc(370, 320, r, r, math.radians(-58), math.radians(58), 44),
            22 if lit else 14, 8, colour, wobble=1.6)
    if muted:
        slash(red)
    base.alpha_composite(red)
    return finish(wear(base, 0.4, seed=71 + level))


def sun_disc(level: int):
    """Brightness: the disc always there, the rays growing with it."""
    base = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    c = S / 2
    r = 132
    disc = Image.new("L", (S, S), 0)
    ImageDraw.Draw(disc).ellipse((c - r, c - r, c + r, c + r), fill=255)
    base.alpha_composite(hatch(disc, BONE_DIM, math.radians(42), 16, 2, 0.42,
                               region=gradient(S, c - 60, c - 60, 300, inner=0, outer=255)))
    ink(base, arc(c, c, r, r, 0, math.tau, 120), 18, 24, BONE, wobble=1.8, pressure=False)
    reach = 0.55 + 0.45 * (level / 3.0)
    for k in range(12):
        a = k * math.tau / 12
        long = k % 2 == 0
        r0 = r + 34
        r1 = r0 + (150 if long else 96) * reach
        colour = BONE if long or level >= 2 else BONE_DIM
        ink(base, [(c + math.cos(a) * r0, c + math.sin(a) * r0), (c + math.cos(a) * r1, c + math.sin(a) * r1)],
            24 if long else 15, 6, colour, pressure=False)
    return finish(wear(base, 0.38, seed=81 + level))


def bluetooth(state: str):
    base = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    red = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    off = state == "off"
    colour = dim(0.4) if off else BONE
    rune = [(200, 220), (420, 420), (320, 520), (320, 120), (420, 220), (200, 420)]
    ink(base, rune, 22, 30, colour, wobble=1.8, pressure=False)
    if state == "linked":
        for x in (118, 522):
            ImageDraw.Draw(red).ellipse((x - 26, 294, x + 26, 346), fill=BLOOD)
        ink(red, [(150, 320), (190, 320)], 8, 10, BLOOD, pressure=False)
        ink(red, [(450, 320), (490, 320)], 8, 10, BLOOD, pressure=False)
    if off:
        slash(red)
    base.alpha_composite(red)
    return finish(wear(base, 0.4, seed=91))


def battery(level: int, bolt=False):
    base = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    red = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    left, right, top, bottom = 80, 500, 200, 440
    body = [(left + 26, top), (right - 26, top), (right, top + 26), (right, bottom - 26),
            (right - 26, bottom), (left + 26, bottom), (left, bottom - 26), (left, top + 26)]
    inner = Image.new("L", (S, S), 0)
    ImageDraw.Draw(inner).polygon(body, fill=255)

    pad = 26
    fill_to = left + pad + (right - left - 2 * pad) * (level / 4.0)
    if level > 0:
        cell = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        d = ImageDraw.Draw(cell)
        d.rounded_rectangle((left + pad, top + pad, fill_to, bottom - pad), 12,
                            fill=tuple(int(c * 0.46) for c in BLOOD) + (255,))
        # the blood is not flat: it is hatched, like everything else here
        cell.putalpha(ImageChops.multiply(cell.getchannel("A"), inner))
        base.alpha_composite(cell)
        rows = Image.new("L", (S, S), 0)
        ImageDraw.Draw(rows).rounded_rectangle((left + pad, top + pad, fill_to, bottom - pad), 12, fill=255)
        base.alpha_composite(hatch(ImageChops.multiply(inner, rows), BLOOD, math.radians(72), 18, 3, 0.55,
                                   region=Image.new("L", (S, S), 255)))
    base.alpha_composite(hatch(inner, BONE_DIM, math.radians(-40), 18, 2, 0.28,
                               region=gradient(S, left, bottom, 520, inner=255, outer=0)))
    ink(base, body + body[:1], 16, 22, BLOOD if level == 0 else BONE, wobble=1.8, pressure=False)
    ink(base, [(right + 22, 262), (right + 22, 378)], 30, 34, BONE, pressure=False)
    if bolt:
        flash = [(300, 210), (210, 330), (285, 330), (250, 430), (360, 300), (290, 300), (300, 210)]
        ink(base, flash, 14, 18, BONE, wobble=1.4)
    base.alpha_composite(red)
    return finish(wear(base, 0.4, seed=101 + level))


# ------------------------------------------------------------------ the sky
def cloud_shape(cx, cy, k=1.0):
    pts = []
    lobes = ((-150, 20, 96), (-30, -56, 126), (108, 8, 104))
    for i, (dx, dy, r) in enumerate(lobes):
        a0 = math.pi if i == 0 else math.pi * 1.12
        a1 = math.tau if i == len(lobes) - 1 else math.pi * 1.92
        pts += arc(cx + dx * k, cy + dy * k, r * k, r * k, a0, a1, 40)
    pts.append((cx + 205 * k, cy + 104 * k))
    pts.append((cx - 200 * k, cy + 104 * k))
    return pts


def sky(kind: str):
    base = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    red = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    if kind == "sun":
        return sun_disc(3)

    if kind == "moon":
        outer = arc(330, 320, 210, 210, math.radians(58), math.radians(310), 90)
        innerc = arc(240, 268, 214, 214, math.radians(292), math.radians(76), 90)
        shape = outer + innerc
        mask = Image.new("L", (S, S), 0)
        ImageDraw.Draw(mask).polygon(shape, fill=255)
        base.alpha_composite(hatch(mask, BONE_DIM, math.radians(30), 18, 2, 0.4,
                                   region=gradient(S, 420, 420, 380, inner=0, outer=255)))
        ink(base, shape + shape[:1], 16, 24, BONE, wobble=2.0, pressure=False)
        return finish(wear(base, 0.38, seed=121))

    if kind == "fog":
        for i in range(5):
            y = 160 + i * 76
            x0 = 90 + (i % 2) * 54
            x1 = 550 - ((i + 1) % 2) * 66
            ink(base, wave(x0, y, x1, y, 10, 1.2, phase=i), 26 - i * 2, 10, BONE if i < 3 else BONE_DIM)
        return finish(wear(base, 0.45, seed=123))

    top = 250 if kind in ("cloud", "suncloud") else 210
    if kind == "suncloud":
        c = (430, 170)
        ink(base, arc(c[0], c[1], 86, 86, 0, math.tau, 60), 14, 18, BONE_DIM, pressure=False)
        for k in range(8):
            a = k * math.tau / 8
            ink(base, [(c[0] + math.cos(a) * 112, c[1] + math.sin(a) * 112),
                       (c[0] + math.cos(a) * 158, c[1] + math.sin(a) * 158)], 12, 5, BONE_DIM, pressure=False)
        shape = cloud_shape(290, 330, 0.9)
    else:
        shape = cloud_shape(320, top + 60, 1.0)

    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).polygon(shape, fill=255)
    base.alpha_composite(hatch(mask, BONE_DIM, math.radians(62), 17, 2, 0.4,
                               region=gradient(S, 180, 200, 460, inner=0, outer=255)))
    ink(base, shape + shape[:1], 17, 24, BONE, wobble=2.0, pressure=False)

    if kind == "rain":
        for i in range(4):
            x = 170 + i * 100
            ink(base, [(x, 430), (x - 34, 560)], 12, 16, BONE, wobble=1.2)
    elif kind == "snow":
        for i in range(3):
            cx, cy = 200 + i * 120, 470 + (i % 2) * 60
            for k in range(3):
                a = k * math.pi / 3
                ink(base, [(cx - math.cos(a) * 34, cy - math.sin(a) * 34),
                           (cx + math.cos(a) * 34, cy + math.sin(a) * 34)], 9, 11, BONE, pressure=False)
    elif kind == "storm":
        flash = [(356, 400), (236, 520), (318, 520), (258, 620), (404, 470), (322, 470), (356, 400)]
        ink(red, flash, 16, 24, BLOOD, wobble=1.6)
        ink(base, [(180, 430), (150, 520)], 10, 13, BONE_DIM, wobble=1.2)
    base.alpha_composite(red)
    return finish(wear(base, 0.4, seed=131))


INSTRUMENTS = {
    "net-0": lambda: wifi(0), "net-1": lambda: wifi(1), "net-2": lambda: wifi(2), "net-3": lambda: wifi(3),
    "net-off": lambda: wifi(0, off=True), "net-wired": lambda: wifi(3, wired=True),
    "vol-0": lambda: speaker(0), "vol-1": lambda: speaker(1), "vol-2": lambda: speaker(2),
    "vol-3": lambda: speaker(3), "vol-mute": lambda: speaker(0, muted=True),
    "sun-0": lambda: sun_disc(0), "sun-1": lambda: sun_disc(1), "sun-2": lambda: sun_disc(2),
    "sun-3": lambda: sun_disc(3),
    "bt-off": lambda: bluetooth("off"), "bt-on": lambda: bluetooth("on"), "bt-linked": lambda: bluetooth("linked"),
    "bat-0": lambda: battery(0), "bat-1": lambda: battery(1), "bat-2": lambda: battery(2),
    "bat-3": lambda: battery(3), "bat-4": lambda: battery(4),
    "bat-charge-1": lambda: battery(1, bolt=True), "bat-charge-2": lambda: battery(2, bolt=True),
    "bat-charge-3": lambda: battery(3, bolt=True), "bat-charge-4": lambda: battery(4, bolt=True),
    "sky-sun": lambda: sky("sun"), "sky-moon": lambda: sky("moon"), "sky-cloud": lambda: sky("cloud"),
    "sky-suncloud": lambda: sky("suncloud"), "sky-rain": lambda: sky("rain"),
    "sky-storm": lambda: sky("storm"), "sky-snow": lambda: sky("snow"), "sky-fog": lambda: sky("fog"),
}


# --------------------------------------------------------------- more marks
# The menu button can wear any of the author's signs, not only the spiral. Each is drawn, never traced from
# a page: the shell ships its own art.

def lens(cx, cy, half, rise, drop):
    """An eye's outline: two circular arcs meeting at the corners, not a polygon with knees.

    Each lid is the arc through the two corners and its own peak, so the centre sits opposite that peak and
    the sweep is taken around the top (or the bottom) of that circle - taking it around the wrong side is
    what draws a chord straight across the eye.
    """
    def lid(height, up):
        r = (half * half + height * height) / (2 * height)
        span = math.asin(min(1.0, half / r))
        if up:
            return arc(cx, cy - height + r, r, r, -math.pi / 2 - span, -math.pi / 2 + span, 48)
        return arc(cx, cy + height - r, r, r, math.pi / 2 - span, math.pi / 2 + span, 48)

    return lid(rise, True) + lid(drop, False)


def remina():
    """Remina: the planet that eats worlds — a sphere with one eye open in it, and its tendrils out."""
    base = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    red = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    c, r = S / 2, 210
    disc = Image.new("L", (S, S), 0)
    ImageDraw.Draw(disc).ellipse((c - r, c - r, c + r, c + r), fill=255)
    base.alpha_composite(hatch(disc, BONE_DIM, math.radians(28), 13, 3, 0.55,
                               region=gradient(S, c - 80, c - 90, 340, inner=0, outer=255)))
    # the tendrils it trails, longer where it has already passed
    for k in range(16):
        a = k * math.tau / 16 + 0.12
        r0 = r + 6
        r1 = r0 + 26 + 58 * (0.4 + 0.6 * abs(math.sin(k * 1.7)))
        ink(base, wave(c + math.cos(a) * r0, c + math.sin(a) * r0,
                       c + math.cos(a) * r1, c + math.sin(a) * r1, 9, 1.0, phase=k), 11, 4, BONE_DIM)
    ink(base, arc(c, c, r, r, 0, math.tau, 140), 17, 23, BONE, wobble=2.0, pressure=False)
    # the eye: the lid, the iris, the pupil
    eye = lens(c, c + 6, 152, 104, 112)
    ink(base, eye + eye[:1], 15, 21, BONE, wobble=1.6, pressure=False)
    ink(red, arc(c, c + 6, 74, 74, 0, math.tau, 60), 14, 18, BLOOD, pressure=False)
    ImageDraw.Draw(red).ellipse((c - 34, c - 28, c + 34, c + 40), fill=(22, 12, 14, 255))
    ink(red, Ink_spiral(c, c + 6, 60, 2.2), 7, 11, BLOOD)
    base.alpha_composite(red)
    return finish(wear(base, 0.38, seed=141))


def Ink_spiral(cx, cy, r, turns):
    return spiral(cx, cy, r, turns)


def amigara():
    """The hole shaped like a person, in the fault. It is waiting for exactly one of us."""
    base = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    face = Image.new("L", (S, S), 255)
    base.alpha_composite(hatch(face, BONE_DIM, math.radians(88), 15, 3, 0.5,
                               region=gradient(S, 320, 320, 420, inner=80, outer=255)))
    body = [(320, 70), (368, 118), (368, 170), (470, 232), (470, 300), (372, 262), (372, 420),
            (410, 596), (352, 596), (320, 440), (288, 596), (230, 596), (268, 420), (268, 262),
            (170, 300), (170, 232), (272, 170), (272, 118)]
    hole = Image.new("L", (S, S), 0)
    ImageDraw.Draw(hole).polygon(body, fill=255)
    cut = Image.new("RGBA", (S, S), (6, 7, 8, 255))
    cut.putalpha(hole)
    base.alpha_composite(cut)
    ink(base, body + body[:1], 15, 21, BONE, wobble=2.2, pressure=False)
    for x in (120, 520):                                       # the rock face, cracked
        ink(base, wave(x, 40, x + 30, 600, 16, 1.4), 7, 10, BONE_DIM)
    return finish(wear(base, 0.45, seed=157))


# The menu marks are vector art now (gen-marks.py); only the raster instruments and the two fills stay here.
MARKS = {}


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fn in (("brain", brain), ("jar", jar)):
        art, inside = fn()
        art.save(OUT / f"{name}.png")
        inside.save(OUT / f"{name}-fill.png")
        print(f"wrote {OUT / (name + '.png')} and {name}-fill.png {art.size}")
    for name, fn in (("menu-metatron", metatron_mini),):
        img = fn()
        if img is None:
            print(f"skipped {name}: no reference image")
            continue
        img.save(OUT / f"{name}.png")
        print(f"wrote {OUT / (name + '.png')} {img.size}")

    for name, fn in MARKS.items():
        fn().save(OUT / f"{name}.png")
    print(f"wrote {len(MARKS)} marks -> {OUT}")

    inst = OUT.parent / "instruments"
    inst.mkdir(parents=True, exist_ok=True)
    for name, fn in INSTRUMENTS.items():
        fn().save(inst / f"{name}.png")
    print(f"wrote {len(INSTRUMENTS)} instruments -> {inst}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

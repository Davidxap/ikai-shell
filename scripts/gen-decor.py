#!/usr/bin/env python3
"""The decorations that stand on both sides of the seal, engraved in Junji Ito's manner: heavy ink that swells and
thins, fine echo strokes, blood where something is cut. Each is drawn once (the left one) and mirrored by the
widget. Output is a tight vertical strip, not a square, because it is a thin thing.

    veins     the bloodlines of the original design (tomie/tomie-vein.png, not drawn here)
    thorns    a barbed stem, thorns alternating, blood at the tips
    curls     two small spirals on one stem: the Uzumaki curl
    hair      long strands of black hair, one caught in a curl
    drips     blood running down in three trails that end in drops
    eyes      one Uzumaki eyeball inside rippling vortex bands
    cracks    a crack through the plate that branches, blood in it
    stitches  a seam sewn shut with crossing stitches
    holes     the Amigara Fault: person-shaped holes cut into a pale slab, one of them bleeding
    teeth     a jaw of fangs on a slim spine, red at the root
    chain     a heavy rusted chain, a link torn open at the bottom
    static    a dying picture: scanlines, snow, torn bands, a blood hairline
    fog       a long narrow bank of fog, thin at both ends

    Drawn for the size they are SHOWN at, which is about 18x34 pixels on the bar: a decoration is a handful of
    bold shapes (strokes of 25+ units, features 60+ units across, aspect about 0.4 to 0.6), never fine detail.
    Check them with a downscale to that size, not a big preview -- a strip 90 units wide is a scratch.

    gen-decor.py     writes bar/modules/ito-art/decor/<name>.png
"""

from __future__ import annotations

import math
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import eyeart  # noqa: E402
from engrave import BLOOD, BONE, DIM, INK, S, blood, canvas, ellipse, fade, gp, hatch_poly, pen, solid  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "bar" / "modules" / "ito-art" / "decor"
CX = 320
RUST = (176, 98, 46)
SLAB = (30, 33, 37)
SHEET = Path(__file__).resolve().parent.parent / "bar" / "modules" / "ito-art" / "status-eyes"


def stem(img, x0=CX, y0=40, y1=600, amp=14, waves=3.0, w=(10, 20), color=BONE):
    pts = gp.wave(x0, y0, x0, y1, amp, waves)
    gp.ink(img, pts, w[0], w[1], color, wobble=1.2, pressure=True)
    return pts


def thorns():
    img = canvas()
    pts = stem(img, amp=22, waves=3.5, w=(12, 24))
    rng = random.Random(4)
    for i in range(3, len(pts) - 3, 4):
        x, y = pts[i]
        side = 1 if (i // 4) % 2 == 0 else -1
        ln = rng.uniform(56, 88)
        base = 14
        tip = (x + side * ln, y - rng.uniform(16, 34))
        poly = [(x, y - base), tip, (x, y + base)]
        solid(img, poly, BONE)
        gp.ink(img, [(x, y - base), tip, (x, y + base)], 3, 5, DIM, wobble=0.6, pressure=False)
        ex, ey = tip
        gp.ImageDraw.Draw(img).ellipse((ex - 7, ey - 7, ex + 7, ey + 7), fill=BLOOD + (255,))
    return img


def curls():
    img = canvas()
    stem(img, amp=10, waves=1.6, w=(9, 16))
    for cy, r, turns, side in ((170, 110, 2.6, 1), (430, 130, 2.9, -1)):
        cx = CX + side * 4
        gp.ink(img, gp.spiral(cx, cy, r, turns, n=220, start=0.05), 8, 24, BONE, wobble=1.3, pressure=True)
        gp.ink(img, gp.spiral(cx, cy, r * 0.62, turns * 0.7, n=140, start=0.2), 3, 8, BLOOD, wobble=1.0, pressure=True)
    return img


def hair():
    img = canvas()
    rng = random.Random(9)
    for k in range(6):
        x0 = CX + (k - 2.5) * 30
        x1 = CX + (k - 2.5) * 30 + rng.uniform(-60, 60)
        pts = gp.wave(x0, 30, x1, 610, rng.uniform(16, 34), rng.uniform(1.4, 2.4), phase=k)
        gp.ink(img, pts, 4, rng.uniform(13, 22), BONE if k % 3 else DIM, wobble=1.0, pressure=True)
    # one strand curls up on itself near the end
    gp.ink(img, gp.spiral(CX + 34, 520, 46, 2.2, n=120, start=0.1), 3, 9, BONE, wobble=0.8, pressure=True)
    return img


def drips():
    img = canvas()
    cap = gp.wave(CX - 92, 60, CX + 92, 60, 10, 1.4)
    gp.ink(img, cap, 22, 30, BONE, wobble=1.2, pressure=False)
    for x, ln, w in ((CX - 60, 360, 20), (CX + 2, 500, 26), (CX + 58, 270, 18)):
        trail = [(x, 66), (x + 3, 66 + ln * 0.3), (x - 3, 66 + ln * 0.62), (x + 1, 66 + ln)]
        gp.ink(img, trail, w * 0.6, w, BLOOD, wobble=1.0, pressure=False)
        gp.ink(img, [(x - w * 0.16, 74), (x - w * 0.12, 70 + ln * 0.5)], 3, 5, (255, 130, 140), wobble=0.5, pressure=False)
        yb = 66 + ln
        solid(img, ellipse(x + 1, yb + 6, w * 0.78, w * 1.0), BLOOD)
        gp.ImageDraw.Draw(img).ellipse((x - 5, yb - 4, x + 1, yb + 2), fill=(255, 130, 140, 200))
    return img


def _panel(name, width):
    return Image.open(SHEET.parent / "eyefx" / f"{name}.png").convert("RGBA").resize(
        (width, round(Image.open(SHEET.parent / "eyefx" / f"{name}.png").height * width / Image.open(SHEET.parent / "eyefx" / f"{name}.png").width)), Image.LANCZOS)


def eyes():
    """One Uzumaki eyeball (after the Uzumaki cover: a veined white globe, an iris of fine concentric rings, a dark
    pupil) ringed by rippling vortex bands that fade away above and below it. Drawn from scratch, not traced."""
    import numpy as np
    K = 2
    W, H = 400 * K, 640 * K
    cx, cy = W // 2, H // 2
    rng = random.Random(21)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    def ring(r, ph, amp):
        pts = []
        for i in range(240):
            t = math.tau * i / 240
            rr = r + amp * math.sin(3 * t + ph) + amp * 0.6 * math.sin(7 * t + ph * 2.3)
            pts.append((cx + rr * math.cos(t), cy + rr * math.sin(t) * 1.55))
        return pts

    for k in range(5, 0, -1):          # the vortex bands, each paler than the one inside it
        r, ph, f = (118 + 62 * k) * K, k * 1.7, 0.95 - 0.16 * k
        outer, inner = ring(r, ph, 5 * K), ring(r - 30 * K, ph + 0.9, 5 * K)
        m = Image.new("L", (W, H), 0)
        md = ImageDraw.Draw(m)
        md.polygon(outer, fill=255)
        md.polygon(inner, fill=0)
        band = Image.new("RGBA", (W, H), DIM + (0,))
        band.putalpha(m.point(lambda v, f=f: int(v * 0.5 * f)))
        img.alpha_composite(band)
        d = ImageDraw.Draw(img)
        d.line(outer + outer[:1], fill=BONE + (int(235 * f),), width=2 * K)
        d.line(inner + inner[:1], fill=BONE + (int(200 * f),), width=K)

    R = 128 * K                        # the globe, shaded toward its rim
    globe = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(globe).ellipse((cx - R, cy - R, cx + R, cy + R), fill=(236, 238, 240, 255))
    yy, xx = np.mgrid[0:H, 0:W]
    shade = 1 - 0.55 * np.clip(np.hypot(xx - cx, yy - cy) / R, 0, 1) ** 3.2
    arr = np.asarray(globe, np.float64).copy()
    arr[..., :3] *= shade[..., None]
    img.alpha_composite(Image.fromarray(arr.astype(np.uint8), "RGBA"))
    d = ImageDraw.Draw(img)
    d.ellipse((cx - R, cy - R, cx + R, cy + R), outline=(24, 26, 30, 255), width=3 * K)
    for _ in range(15):                # veins: forking, wavering hairlines from the rim toward the iris
        ang = rng.uniform(0, math.tau)
        x, y = cx + math.cos(ang) * R * 0.97, cy + math.sin(ang) * R * 0.97
        for _ in range(rng.randint(5, 9)):
            dx, dy = cx - x, cy - y
            dist = math.hypot(dx, dy) or 1
            if dist < 66 * K:
                break
            st = rng.uniform(9, 17) * K
            nx = x + dx / dist * st + rng.uniform(-9, 9) * K
            ny = y + dy / dist * st + rng.uniform(-9, 9) * K
            d.line((x, y, nx, ny), fill=BLOOD + (235,), width=int(2.2 * K))
            if rng.random() < 0.28:
                d.line((nx, ny, nx + rng.uniform(-22, 22) * K, ny + rng.uniform(-22, 22) * K), fill=BLOOD + (200,), width=K + 1)
            x, y = nx, ny
    ir = 60 * K                        # iris of fine concentric rings, pupil, one highlight
    d.ellipse((cx - ir, cy - ir, cx + ir, cy + ir), fill=(34, 36, 40, 255))
    for i in range(1, 14):
        rad = ir * i / 14
        d.ellipse((cx - rad, cy - rad, cx + rad, cy + rad), outline=(150, 156, 162, 200 if i % 2 else 110), width=K)
    d.ellipse((cx - ir, cy - ir, cx + ir, cy + ir), outline=(10, 12, 14, 255), width=2 * K)
    pr = 16 * K
    d.ellipse((cx - pr, cy - pr, cx + pr, cy + pr), fill=(6, 7, 9, 255))
    hx, hy, hr = cx + 6 * K, cy - 7 * K, 5 * K
    d.ellipse((hx - hr, hy - hr, hx + hr, hy + hr), fill=(235, 238, 240, 255))
    img = img.resize((W // K, H // K), Image.LANCZOS)
    a = np.asarray(img.getchannel("A"), np.float64)      # the outer bands thin to nothing at the strip's two ends
    yv = np.linspace(0, 1, a.shape[0])[:, None]
    img.putalpha(Image.fromarray((a * np.clip(np.minimum(yv, 1 - yv) / 0.12, 0, 1)).astype(np.uint8)))
    return img


def cracks():
    img = canvas()
    main = [(CX + 34, 30), (CX - 28, 140), (CX + 38, 235), (CX - 34, 345), (CX + 28, 450), (CX - 20, 530), (CX + 12, 610)]
    gp.ink(img, main, 8, 24, BLOOD, wobble=1.6, pressure=True)
    gp.ink(img, [(x + 5, y) for x, y in main], 4, 8, BONE, wobble=1.2, pressure=True)
    for i, (dx, dy, ln) in enumerate(((-1, 1, 150), (1, 1, 135), (-1, 1, 120), (1, 1, 145))):
        x, y = main[1 + i * 1 + (1 if i > 1 else 0)]
        branch = [(x, y), (x + dx * ln * 0.5, y + 38), (x + dx * ln, y + 32 + ln * 0.2)]
        gp.ink(img, branch, 5, 14, BONE, wobble=1.4, pressure=True)
        gp.ink(img, [(x + dx * ln * 0.5, y + 38), (x + dx * ln * 0.7, y + 92)], 4, 9, BONE, wobble=1.0, pressure=True)
    return img


def stitches():
    """A seam sewn shut in a hurry: a dark gash with a thread of blood in it, crossing stitches of uneven
    tension pulled across, blood beading at every puncture, two that have given way."""
    img = canvas()
    gash = gp.wave(CX, 40, CX, 606, 8, 1.4)
    gp.ink(img, gash, 14, 22, INK, wobble=1.2, pressure=True)
    gp.ink(img, gash, 5, 9, BLOOD, wobble=1.0, pressure=True)
    rng = random.Random(41)
    y, k = 88, 0
    while y < 580:
        spread = 68 * rng.uniform(0.78, 1.2)
        gp.ink(img, [(CX - spread, y - 24), (CX + spread, y + 24)], 9, 15, BONE, wobble=1.1, pressure=True)
        gp.ink(img, [(CX + spread, y - 24), (CX - spread, y + 24)], 9, 15, BONE, wobble=1.1, pressure=True)
        for px in (CX - spread, CX + spread):
            gp.ImageDraw.Draw(img).ellipse((px - 7, y - 7, px + 7, y + 7), fill=BLOOD + (240,))
        if k in (1, 4):
            sx = CX + rng.uniform(-10, 10)
            solid(img, ellipse(sx, y + 46, 10, 15), BLOOD)
            gp.ink(img, [(CX, y + 24), (sx, y + 64)], 5, 10, BLOOD, wobble=0.6, pressure=False)
        y += rng.uniform(78, 92)
        k += 1
    return img


def veins():
    """A bloodline: one swollen vein down the middle with twigs branching off it, thinning to nothing, and a pale
    highlight along it so it reads as wet ink and not as a smudge."""
    img = canvas()
    rng = random.Random(12)
    main = gp.wave(CX, 30, CX, 610, 26, 2.2)
    gp.ink(img, main, 8, 30, BLOOD, wobble=1.0, pressure=True)
    gp.ink(img, [(x - 5, y) for x, y in main[6:-6]], 2, 5, (255, 120, 132), wobble=0.8, pressure=True)
    for i in range(6, len(main) - 6, 7):
        x, y = main[i]
        side = 1 if (i // 7) % 2 == 0 else -1
        ln = rng.uniform(70, 130)
        pts = [(x, y), (x + side * ln * 0.45, y - rng.uniform(10, 34)), (x + side * ln, y - rng.uniform(34, 76))]
        gp.ink(img, pts, 2, 11, BLOOD, wobble=1.2, pressure=True)
        ex, ey = pts[-1]
        sub = [(pts[1][0], pts[1][1]), (pts[1][0] + side * ln * 0.3, pts[1][1] + 34)]
        gp.ink(img, sub, 2, 7, BLOOD, wobble=1.0, pressure=True)
        gp.ImageDraw.Draw(img).ellipse((ex - 5, ey - 5, ex + 5, ey + 5), fill=BLOOD + (255,))
    return img




def human_hole(img, cx, cy, s):
    """A person-shaped hole, the way the Amigara Fault's are: head, shoulders, one leg to a side each. Each
    one fits somebody exactly, so it is a figure, not a round pit. Black inside, a thin bone edge."""
    head = ellipse(cx, cy - 66 * s, 21 * s, 23 * s)
    body = [(cx - 32 * s, cy - 36 * s), (cx + 32 * s, cy - 36 * s), (cx + 38 * s, cy + 6 * s),
            (cx + 26 * s, cy + 70 * s), (cx + 5 * s, cy + 70 * s), (cx, cy + 22 * s),
            (cx - 5 * s, cy + 70 * s), (cx - 26 * s, cy + 70 * s), (cx - 38 * s, cy + 6 * s)]
    for shape in (head, body):
        solid(img, shape, (2, 2, 3))
        gp.ink(img, shape + shape[:1], 6, 10, BONE, wobble=0.9, pressure=True)
    return head, body


def holes():
    """The Enigma of Amigara Fault, engraved rather than filled: a dark stele with a thin bone edge and three
    person-shaped holes cut into it, the middle one bleeding. A pale slab was a big bright block that had
    nothing to do with the rest of the bar; a dark stone with a fine edge is what the sheet's own art is."""
    img = canvas()
    slab = [(CX - 88, 40), (CX + 84, 34), (CX + 94, 300), (CX + 82, 606), (CX - 84, 610), (CX - 96, 320)]
    solid(img, slab, SLAB)
    gp.ink(img, slab + slab[:1], 8, 15, BONE, wobble=1.6, pressure=True)
    gp.ink(img, [(x + 9, y + 7) for x, y in slab] + [(slab[0][0] + 9, slab[0][1] + 7)], 3, 5, DIM, wobble=1.2, pressure=True)
    for i, cy in enumerate((168, 348, 522)):
        human_hole(img, CX + (-3, 4, -1)[i], cy, 0.8)
    gp.ink(img, [(CX + 30, 318), (CX + 44, 356), (CX + 36, 396)], 6, 12, BLOOD, wobble=1.0, pressure=True)
    solid(img, ellipse(CX + 44, 404, 9, 13), BLOOD)
    return img


def teeth():
    """A jaw of fangs on a slim spine, both sides at once: drawn as thin bone outlines around dark teeth, red
    only at the root, not as solid pale diamonds."""
    img = canvas()
    spine = gp.wave(CX, 40, CX, 606, 5, 1.4)
    gp.ink(img, spine, 10, 16, DIM, wobble=0.8, pressure=True)
    rng = random.Random(52)
    y = 76
    while y < 590:
        base_h = rng.uniform(22, 30)
        x = CX + rng.uniform(-3, 3)
        for side in (1, -1):
            ln = rng.uniform(64, 88)
            tip = (x + side * ln, y + rng.uniform(-10, 10))
            tooth = [(x, y - base_h), tip, (x, y + base_h)]
            solid(img, tooth, (24, 26, 30))
            gp.ink(img, tooth + tooth[:1], 6, 10, BONE, wobble=0.6, pressure=True)
        gp.ImageDraw.Draw(img).ellipse((x - 11, y - 11, x + 11, y + 11), fill=BLOOD + (255,))
        y += rng.uniform(70, 82)
    return img


RUST_DEEP = (96, 50, 22)


def chain():
    """A thin rusted chain hanging from a hook, the fog town's own iron: slim links alternating a wide oval
    with a narrow edge-on one, a thread of rust running off them, the last link torn open and bleeding.
    Thin on purpose -- the sheet's linework is fine, and a fat chain was the one thing on the seal that
    looked like it came from somewhere else."""
    img = canvas()
    rng = random.Random(17)
    hook = gp.arc(CX, 62, 30, 30, math.radians(210), math.radians(500), 28)
    gp.ink(img, hook, 9, 14, DIM, wobble=0.8, pressure=True)
    y = 132
    for k in range(6):
        wide = k % 2 == 0
        rx, ry = (38, 46) if wide else (13, 46)
        pts = ellipse(CX, y, rx, ry)
        gp.ink(img, pts + pts[:1], 10, 15, BONE if wide else DIM, wobble=1.0, pressure=True)
        gp.ink(img, [(px, py) for px, py in pts[len(pts) // 8:len(pts) // 3]], 5, 8, RUST, wobble=0.8, pressure=True)
        if rng.random() < 0.75:
            dx = rng.uniform(-rx * 0.6, rx * 0.6)
            gp.ink(img, [(CX + dx, y + ry - 4), (CX + dx + rng.uniform(-3, 3), y + ry + rng.uniform(22, 40))],
                   4, 8, RUST, wobble=0.6, pressure=True)
        y += 84
    gp.ink(img, [(CX - 20, y - 60), (CX + 6, y - 22)], 7, 12, BLOOD, wobble=1.0, pressure=True)
    solid(img, ellipse(CX + 8, y - 12, 8, 12), BLOOD)
    return img


def static_():
    """A dying picture, as the media effect and the memory liquid draw it: scanlines on every second row, snow in bone and
    blood, a torn band shifted sideways with a blood hairline, a rolling sync bar. The edges break up raggedly."""
    import numpy as np
    W, H = 300, 640
    rng = np.random.default_rng(33)
    cell = 4
    gw, gh = W // cell, H // cell
    snow = rng.random((gh, gw))
    v = np.where(snow < 0.62, 0.0, (snow - 0.62) / 0.38)            # about 4 cells in 10 are lit
    tone = rng.random((gh, gw))
    a = np.repeat(np.repeat(v, cell, 0), cell, 1)
    t = np.repeat(np.repeat(tone, cell, 0), cell, 1)
    rows = np.arange(H)[:, None]
    scan = np.where(rows % 4 < 2, 1.0, 0.55)                          # scanlines
    a = a * scan
    for y0, sh in ((190, 38), (402, -26)):                            # tears: a band of rows shifted sideways
        a[y0:y0 + 14] = np.roll(a[y0:y0 + 14], sh, axis=1)
    sync = np.exp(-((rows - 300) / 30.0) ** 2)                        # the sync bar: a denser band
    a = np.clip(a + 0.45 * sync * (rng.random((H, W)) < 0.55), 0, 1)
    ragged = 0.10 + 0.07 * rng.random((H, 1))                         # each row ends at its own distance from the edge
    xs = np.arange(W)[None, :] / (W - 1)
    edge = np.clip(np.minimum(xs, 1 - xs) / ragged, 0, 1)
    ends = np.clip(np.minimum(rows / H, 1 - rows / H) / 0.05, 0, 1)
    a = a * edge * ends
    rgba = np.zeros((H, W, 4), np.float64)
    bone = np.array(BONE, np.float64)
    dim = np.array(DIM, np.float64)
    rgba[..., :3] = np.where((t > 0.5)[..., None], bone, dim)
    rgba[..., 3] = a * 215
    img = Image.fromarray(rgba.astype(np.uint8), "RGBA")
    d = ImageDraw.Draw(img)
    for y0 in (190, 402):                                             # the tear: a bright edge and a blood hairline
        d.rectangle((14, y0, W - 14, y0 + 2), fill=BONE + (150,))
        d.rectangle((24, y0 + 5, W - 24, y0 + 6), fill=BLOOD + (255,))
    return img


def fog():
    """Fog as it is: a long, narrow bank of layered soft noise drifting in thin horizontal veils, thick along the middle of
    the stem and thinning to nothing at both ends and at the sides, with the faintest red buried in it."""
    import numpy as np
    from fogfield import fbm, smooth
    W, H = 190, 640
    yy = np.linspace(0, 1, H)[:, None]
    xx = np.linspace(-1, 1, W)[None, :]
    n = 0.5 * fbm(W, H, seed=44, sx=3.2, base=110, octaves=4) + 0.5 * fbm(W, H, seed=45, sx=4.5, base=52, octaves=4)
    for i in range(H):                                                # drift: every row slides a little, like a moving bank
        n[i] = np.roll(n[i], int(7 * math.sin(i / 97.0) + 3 * math.sin(i / 31.0)))
    dens = 0.30 + 0.70 * smooth(n, 0.18, 0.80)
    prof = np.exp(-(xx / 0.58) ** 2) * np.clip(np.minimum(yy, 1 - yy) / 0.22, 0, 1) ** 0.9
    alpha = np.clip(dens * prof * 1.05, 0, 1) * 150
    rgba = np.zeros((H, W, 4), np.uint8)
    rgba[..., 0], rgba[..., 1], rgba[..., 2] = BONE
    rgba[..., 3] = alpha.astype(np.uint8)
    img = Image.fromarray(rgba, "RGBA")
    glow = Image.new("RGBA", (W, H), BLOOD + (0,))
    glow.putalpha(Image.fromarray((np.exp(-(((xx) / 0.5) ** 2 + ((yy - 0.52) / 0.12) ** 2)) * 20 * (dens > 0.3)).astype(np.uint8)))
    img.alpha_composite(glow)
    return img


DECOR = {"veins": veins, "thorns": thorns, "curls": curls, "hair": hair, "drips": drips, "eyes": eyes,
         "cracks": cracks, "stitches": stitches, "holes": holes, "teeth": teeth, "chain": chain, "static": static_,
         "fog": fog}


def finish(img: Image.Image, seed: int, wear: float = 0.35) -> Image.Image:
    if wear > 0:
        img = gp.wear(img, wear, seed=seed)
    box = img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    img = img.crop(box)
    # scale so the height is 512px, then pad a little
    k = 512 / img.height
    img = img.resize((max(1, round(img.width * k)), 512), Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.2, 70, 2))
    out = Image.new("RGBA", (img.width + 24, 536), (0, 0, 0, 0))
    out.alpha_composite(img, (12, 12))
    return out


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    for i, (name, fn) in enumerate(DECOR.items()):
        finish(fn(), 70 + i, 0 if name in ("eyes", "fog", "static") else 0.35).save(OUT / f"{name}.png")
    print(f"wrote {len(DECOR)} decorations -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

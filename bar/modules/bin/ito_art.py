"""ito_art: text and braille art shared by the terminal fetch (eye logo) and the screensaver (spiral, eye, fog).
Deterministic (seeded), numpy + Pillow. No colour here: the callers colour it (fastfetch `$1/$2/$3`, ttfx gradients)."""
from __future__ import annotations

import math
import os
import random
import re
import sys

EYE_COLS, EYE_ROWS = 54, 26


def eye_dots():
    """Three dot layers (lines, blood, hatch) on a 108 x 104 field: heavy Tomie lid, a G-pen lash line heavy toward the
    outer corner, a broken crease, paper-first sclera hatched only in the corners and under the lid, a solid pupil with a
    catchlight, a spiral iris of 2.6 turns, a little screentone under the eye and one blood tear from the inner corner."""
    import math
    from PIL import Image, ImageDraw
    W, H, SS = EYE_COLS * 2, EYE_ROWS * 4, 4
    layers = {n: Image.new("L", (W * SS, H * SS), 0) for n in ("lines", "blood", "hatch")}
    D = {n: ImageDraw.Draw(im) for n, im in layers.items()}

    def pt(x, y):
        return (x * SS, y * SS)

    def bez(p0, p1, p2, p3, n=80):
        out = []
        for i in range(n + 1):
            t, u = i / n, 1 - i / n
            out.append((u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
                        u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]))
        return out

    cx, cy = 54.0, 52.0
    inner, outer = (5.0, cy + 6), (103.0, cy - 4)
    top = bez(inner, (28, 12), (80, 8), outer)
    low = bez(inner, (36, 92), (76, 92), outer)

    def stroke(d, pts, w0, w1, skip=None):
        n = len(pts)
        for i in range(n - 1):
            if skip and skip(i / n):
                continue
            t = i / (n - 1)
            w = (w0 + (w1 - w0) * (t * t * (3 - 2 * t))) * SS
            d.line([pt(*pts[i]), pt(*pts[i + 1])], fill=255, width=max(1, int(w)))
            r = w / 2
            x, y = pt(*pts[i])
            d.ellipse([x - r, y - r, x + r, y + r], fill=255)

    # the lids: the upper heavy toward the outer corner (right), the lower a firm single line
    stroke(D["lines"], top, 1.6, 4.4)
    stroke(D["lines"], low, 1.2, 2.0)
    # a broken crease above the lid
    crease = [(x, y - 7 * math.sin(math.pi * i / len(top))) for i, (x, y) in enumerate(top)]
    stroke(D["lines"], crease[6:-6], 0.9, 1.4, skip=lambda t: 0.38 < t < 0.47 or 0.72 < t < 0.78)
    # lashes, longer toward the outer corner
    for i in range(18):
        t = 0.30 + 0.66 * i / 17
        x, y = top[int(t * (len(top) - 1))]
        ln = 3 + 8 * t ** 2.2
        D["lines"].line([pt(x, y), pt(x + 1.2 + 2 * t, y - ln)], fill=255, width=SS)
    # iris: a ring and a spiral of 2.6 turns (blood), clipped to the opening below
    r_i = 21.0
    D["lines"].ellipse([*pt(cx - r_i, cy - r_i), *pt(cx + r_i, cy + r_i)], outline=255, width=int(1.3 * SS))
    pts, a, a_end = [], 0.0, 2.6 * 2 * math.pi
    while a < a_end:
        rr = 3.2 + (r_i - 5.0) * a / a_end
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
        a += 0.07
    for i in range(0, len(pts) - 5, 8):             # a broken line: the spiral is felt more than read
        D["blood"].line([pt(*q) for q in pts[i:i + 6]], fill=255, width=int(0.9 * SS), joint="curve")
    # the pupil is solid (left dark), with a catchlight of paper
    D["lines"].ellipse([*pt(cx - 4.4, cy - 4.4), *pt(cx + 4.4, cy + 4.4)], outline=255, width=SS)
    D["lines"].ellipse([*pt(cx - 11.5, cy - 12), *pt(cx - 8.0, cy - 8.5)], fill=255)
    # clip everything but the lids, lashes and crease to the almond
    mask = Image.new("L", layers["lines"].size, 0)
    ImageDraw.Draw(mask).polygon([pt(*p) for p in top + low[::-1]], fill=255)
    # shadow under the upper lid: 45-degree hatching, hard against the lid and thinning toward the pupil
    h = D["hatch"]
    for k in range(-120, 140, 5):
        pts = []
        for i in range(0, len(top), 2):
            x, y = top[i]
            ya = y + 2
            yb = y + 2 + 11 * math.sin(math.pi * i / len(top)) ** 0.8
            # a hatch line at 45 degrees through (k, 0): y = x - k
            yy = x - k
            if ya <= yy <= yb:
                pts.append(pt(x, yy))
        for q in pts[:1]:
            h.ellipse([q[0] - SS * 0.6, q[1] - SS * 0.6, q[0] + SS * 0.6, q[1] + SS * 0.6], fill=255)
    # corner hatching only (contour lines of the sclera)
    for off in (0, 3, 6, 9):
        h.line([pt(inner[0] + 4 + off, cy + 3), pt(inner[0] + 12 + off, cy - 4)], fill=255, width=SS)
        h.line([pt(outer[0] - 4 - off, cy - 2), pt(outer[0] - 12 - off, cy + 6)], fill=255, width=SS)
    # sparse screentone under the eye
    for row in range(0, 8):
        for col in range(0, 24):
            x, y = 22 + col * 2.8 + (row % 2) * 1.4, 86 + row * 2.6
            if y < 102 and ((col * 7 + row * 13) % 5) < 4 - row // 2:
                h.ellipse([*pt(x - 0.5, y - 0.5), *pt(x + 0.5, y + 0.5)], fill=255)
    # one blood tear from the inner corner
    D["blood"].line([pt(inner[0] + 2, cy + 8), pt(inner[0] + 2.5, cy + 20)], fill=255, width=int(1.2 * SS))
    D["blood"].ellipse([*pt(inner[0] + 0.7, cy + 20), *pt(inner[0] + 4.3, cy + 24)], fill=255)
    out = {}
    for n, im in layers.items():
        small = im.resize((W, H), Image.LANCZOS).point(lambda v: 255 if v > 90 else 0)
        out[n] = small
    return out


BRAILLE_BIT = ((0, 0, 0x01), (0, 1, 0x02), (0, 2, 0x04), (1, 0, 0x08), (1, 1, 0x10), (1, 2, 0x20), (0, 3, 0x40), (1, 3, 0x80))


def eye_text():
    """The eye as fastfetch logo text: braille cells, `$1` lines, `$2` blood, `$3` hatch. Exactly 54 x 26 cells."""
    import numpy as np
    L = {n: np.asarray(im, bool) for n, im in eye_dots().items()}
    rows, lit, blood = [], 0, 0
    for r in range(EYE_ROWS):
        cur, line = None, ""
        for c in range(EYE_COLS):
            bits, votes = 0, {"lines": 0, "blood": 0, "hatch": 0}
            for dx, dy, b in BRAILLE_BIT:
                y, x = r * 4 + dy, c * 2 + dx
                for n in votes:
                    if L[n][y, x]:
                        votes[n] += 1
                        bits |= b
            ch = chr(0x2800 + bits)
            tone = "2" if votes["blood"] else ("1" if votes["lines"] else ("3" if votes["hatch"] else None))
            lit += bin(bits).count("1")
            blood += votes["blood"]
            if bits and tone != cur:
                line += "$" + tone
                cur = tone
            line += ch
        rows.append(line)
    return "\n".join(rows) + "\n", lit, blood




def braille(layers, cols, rows):
    """Merge boolean dot layers (each rows*4 x cols*2) into braille rows; returns [(char, tone-index-or-None)] per cell."""
    import numpy as np
    out = []
    for r in range(rows):
        row = []
        for c in range(cols):
            bits, tone = 0, None
            for ti, L in enumerate(layers):
                for dx, dy, b in BRAILLE_BIT:
                    if L[r * 4 + dy, c * 2 + dx]:
                        bits |= b
                        if tone is None:
                            tone = ti
            row.append((chr(0x2800 + bits), tone if bits else None))
        out.append(row)
    return out


def spiral_text(cols=70, rows=24):
    """A braille Uzumaki: the double-arm Archimedean spiral of the lock (boot-lock-v2 §5.1) on a 140 x 96 dot field (at 70 x 24 cells;
    larger fields scale the whole drawing by min(cols / 70, rows / 24), boot-screens-v2 B.3 T1). Arm A is a full line, arm B has
    every second dot (a lighter arm in a single-colour medium), the centre is left open."""
    import numpy as np
    W, H = cols * 2, rows * 4
    grid = np.zeros((H, W), bool)
    cx, cy = W / 2.0, H / 2.0
    k = min(cols / 70.0, rows / 24.0)
    R, T, r_hole = 46.0 * k, 4.0, 6.0 * k
    theta_max = 2 * math.pi * T
    t0 = theta_max * r_hole / R
    ys, xs = np.mgrid[0:H, 0:W]
    for arm in (0, 1):
        th, i = t0, 0
        while th <= theta_max:
            r = R * th / theta_max
            wd = (1.4 + 1.6 * (r / R) ** 0.8) * k ** 0.85
            a = th + arm * math.pi
            px, py = cx + r * math.cos(a), cy + r * math.sin(a) * 0.98
            if arm == 0 or (i // (2 if k <= 1.05 else max(2, round(2 * k)))) % 2 == 0:
                grid |= ((xs - px) ** 2 + (ys - py) ** 2) <= (wd / 2) ** 2
            th += 0.9 / max(1e-6, math.hypot(r, R / theta_max))
            i += 1
    cells = braille([grid], cols, rows)
    return "\n".join("".join(ch for ch, _t in row).rstrip("\u2800") for row in cells) + "\n"


def eye_plain(cols=70, rows=26):
    """The eye (54 x 26) centred in cols x rows, no colour codes."""
    text, _lit, _blood = eye_text()
    lines = [re.sub(r"\$[1-9]", "", l) for l in text.splitlines()]
    pad = max(0, (cols - EYE_COLS) // 2)
    return "\n".join(("\u2800" * pad + l).rstrip("\u2800") for l in lines) + "\n"


def eye_sized(cols, rows):
    """The eye drawn at cols x rows cells (boot-screens-v2 B.3 T1): the 54 x 26 dot drawing resampled to (2 cols) x (4 rows) dots and
    thresholded as eye_dots does; no colour codes. Empty cells are ASCII spaces."""
    import numpy as np
    from PIL import Image
    if (cols, rows) == (EYE_COLS, EYE_ROWS):
        text, _l, _b = eye_text()
        return "\n".join(re.sub(r"\$[1-9]", "", l).replace("\u2800", " ").rstrip() for l in text.splitlines()) + "\n"
    big = {n: im.resize((cols * 2, rows * 4), Image.LANCZOS).point(lambda v: 255 if v > 90 else 0) for n, im in eye_dots().items()}
    merged = np.zeros((rows * 4, cols * 2), bool)
    for im in big.values():
        merged |= np.asarray(im, bool)
    cells = braille([merged], cols, rows)
    return "\n".join("".join(ch for ch, _t in row).replace("\u2800", " ").rstrip() for row in cells) + "\n"


def fog_text(cols=70, rows=24):
    """The town dissolving: only 霧 (fog), 町 (town) and 声 (voice), scattered by fractal noise, densest at the bottom and
    thinning upward. Seeded, so the same text every run."""
    import numpy as np
    sys.path.insert(0, os.environ.get("ITO_BIN_DIR", "."))
    import ito_ink
    rng = random.Random(240)
    f = ito_ink.fbm(cols, rows, 240, sx=2.4, base=6.0, octaves=3)
    lines = []
    for y in range(rows):
        depth = (y / (rows - 1)) ** 1.7
        x, line = 0, ""
        while x < cols - 1:
            p = 0.04 + 0.34 * depth * (0.35 + 0.65 * float(f[y, x]))
            if rng.random() < p:
                line += rng.choice("霧町声")
                x += 2
            else:
                line += " "
                x += 1
        lines.append(line.rstrip())
    return "\n".join(lines) + "\n"


def eye_shut(size, colours):
    """The boot eye (boot-lock-v2 §5.3): a CLOSED eye as a plate of paper. The lids meet along a curved seam cut out of the paper
    (transparent: the theme's ink background shows through), a broken crease above it, lashes hanging down from the seam, no iris,
    one blood bead at the inner corner (blood well under 6 % of the ink). RGBA, `size` wide, paper = bone. Deterministic."""
    from PIL import Image, ImageDraw
    sys.path.insert(0, os.environ.get("ITO_BIN_DIR", "."))
    import ito_ink
    W, H, SS = int(size), int(size * 0.5), 4
    bone = tuple(int(v) for v in ito_ink.rgb(colours["bone"]))
    blood = tuple(int(v) for v in ito_ink.rgb(colours["blood"]))
    plate = Image.new("L", (W * SS, H * SS), 0)
    cut = Image.new("L", (W * SS, H * SS), 0)
    hair = Image.new("L", (W * SS, H * SS), 0)
    pd, cd, hd = ImageDraw.Draw(plate), ImageDraw.Draw(cut), ImageDraw.Draw(hair)

    def bez(p0, p1, p2, p3, n=120):
        out = []
        for i in range(n + 1):
            t, u = i / n, 1 - i / n
            out.append((u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
                        u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]))
        return [(x * SS, y * SS) for x, y in out]

    L, R_ = (W * 0.04, H * 0.50), (W * 0.96, H * 0.46)
    top = bez(L, (W * 0.25, H * 0.02), (W * 0.72, H * 0.0), R_)
    low = bez(R_, (W * 0.74, H * 0.98), (W * 0.26, H * 1.00), L)
    pd.polygon(top + low, fill=255)
    seam = bez(L, (W * 0.30, H * 0.62), (W * 0.70, H * 0.60), R_)           # where the lids meet, a little below the middle
    n = len(seam)
    for i in range(n - 1):
        t = i / (n - 1)
        wd = (1.2 + 3.4 * t * t) * SS * (W / 320.0)                         # heavier toward the outer corner
        cd.line([seam[i], seam[i + 1]], fill=255, width=max(1, int(wd)))
        x, y = seam[i]
        cd.ellipse([x - wd / 2, y - wd / 2, x + wd / 2, y + wd / 2], fill=255)
    crease = [(x, y - (H * 0.22) * SS * math.sin(math.pi * i / n) ** 0.7) for i, (x, y) in enumerate(seam)]
    for i in range(10, n - 10):                                             # a broken crease in the paper
        if 0.40 < i / n < 0.47 or 0.70 < i / n < 0.76:
            continue
        cd.line([crease[i], crease[i + 1]], fill=255, width=max(1, int(0.9 * SS * (W / 320.0))))
    for i in range(19):                                                     # lashes hang from the seam, longer to the outer corner
        t = 0.16 + 0.80 * i / 18
        x, y = seam[int(t * (n - 1))]
        ln = (H * 0.10 + H * 0.26 * t ** 2.0) * SS
        hd.polygon([(x - 1.3 * SS * W / 320, y), (x + 1.3 * SS * W / 320, y), (x + (2.0 + 6.0 * t) * SS * W / 320, y + ln)], fill=255)
    out = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    paper = Image.new("RGBA", out.size, bone + (255,))
    # plate minus the cut, plus the lashes (bone lines hanging below the plate)
    from PIL import ImageChops
    alpha = ImageChops.lighter(ImageChops.subtract(plate, cut), hair)
    out.paste(paper, mask=alpha)
    bd = ImageDraw.Draw(out)
    bx, by, br = (L[0] + W * 0.075) * SS, (L[1] + H * 0.07) * SS, 3.6 * SS * (W / 320.0)
    bd.ellipse([bx - br, by - br, bx + br, by + br], fill=blood + (255,))
    return out.resize((W, H), Image.LANCZOS)

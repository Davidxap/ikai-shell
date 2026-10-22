"""Eyes drawn in code. watcher() is the eye the "Eyes" effect and decoration use; remina() is the planet-eye of the Remina mark.

  remina  the eye of the planet on the Remina mark: a flat white almond, a red iris ringed in ink, a black slit
          pupil, one small highlight. Same geometry as gen-marks.py remina().

Drawn 4x and scaled down so the lines stay clean at the 18-34 px they end up at.
"""

from __future__ import annotations

from PIL import Image, ImageDraw

BONE = (199, 204, 209)
BLOOD = (196, 22, 42)
INK = (10, 10, 12)
SS = 4


def bez(p0, p1, p2, p3, n=40):
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        out.append((u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
                    u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]))
    return out


def almond(w, h, top=1.0, bottom=1.0, skew=0.0):
    """Outline of an eye `w` wide and `h` tall centred on (0,0). `skew` lifts the outer (right) corner."""
    L, R = (-w / 2, 0.0), (w / 2, -skew * h)
    up = bez(L, (-w * 0.2, -h * 0.62 * top), (w * 0.2, -h * 0.62 * top), R)
    dn = bez(R, (w * 0.2, h * 0.62 * bottom), (-w * 0.2, h * 0.62 * bottom), L)
    return up + dn[1:]


def _shift(pts, cx, cy, k):
    return [(cx + x * k, cy + y * k) for x, y in pts]


def remina(size: int, iris=BLOOD, veins=False, open_: float = 1.0, glow=False) -> Image.Image:
    """A `size` x size/2-ish square canvas holding one Remina eye."""
    k = SS
    W = size * k
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = W / 2
    ew, eh = W * 0.92, W * 0.19 * max(0.12, open_)
    shape = _shift(almond(ew, eh / 0.465), c, c, 1)
    d.polygon(shape, fill=BONE + (255,))
    # clip the iris to the almond
    layer = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    r = eh * 1.02
    ld.ellipse((c - r, c - r, c + r, c + r), fill=iris + (255,), outline=INK + (255,), width=max(2, int(W * 0.022)))
    ld.ellipse((c - r * 0.2, c - r * 0.78, c + r * 0.2, c + r * 0.78), fill=INK + (255,))
    ld.ellipse((c - r * 0.42, c - r * 0.5, c - r * 0.42 + r * 0.16, c - r * 0.5 + r * 0.16), fill=(240, 240, 242, 255))
    if veins:
        for dy in (-0.55, -0.15, 0.3, 0.6):
            ld.line([(c - ew * 0.5, c + eh * dy), (c - r * 1.05, c + eh * dy * 0.5)], fill=BLOOD + (255,), width=max(2, int(W * 0.012)))
            ld.line([(c + ew * 0.5, c + eh * dy), (c + r * 1.05, c + eh * dy * 0.5)], fill=BLOOD + (255,), width=max(2, int(W * 0.012)))
    mask = Image.new("L", (W, W), 0)
    ImageDraw.Draw(mask).polygon(shape, fill=255)
    layer.putalpha(Image.composite(layer.getchannel("A"), Image.new("L", (W, W), 0), mask))
    img.alpha_composite(layer)
    d = ImageDraw.Draw(img)
    d.line(shape + [shape[0]], fill=INK + (255,), width=max(3, int(W * 0.03)), joint="curve")
    return img.resize((size, size), Image.LANCZOS)


def watcher(width: int = 640, red: bool = False) -> Image.Image:
    """An eye that watches, drawn from scratch: a wide almond with a heavy upper lid and its crease, lashes, hatching
    under the lid, a ringed iris with a spiral for a pupil and one highlight. `red` is the bloodshot twin: blood
    in the iris and veins running in from both corners. 2.6 : 1, the shape ItoMediaFx and the seal decoration expect.
    Original artwork (no reference image is used), so it can ship with the repository."""
    import math
    k = SS
    W, H = width * k, round(width / 2.6) * k
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = W / 2, H / 2
    ink = INK + (255,)
    bone = BONE + (255,)
    accent = (BLOOD if red else BONE) + (255,)
    lw = max(2, round(W * 0.011))

    left, right = (W * 0.04, cy + H * 0.04), (W * 0.96, cy - H * 0.02)
    top = bez(left, (W * 0.24, -H * 0.02), (W * 0.72, H * 0.02), right, 80)
    low = bez(right, (W * 0.72, H * 1.04), (W * 0.26, H * 1.0), left, 80)
    shape = top + low
    d.polygon(shape, fill=(232, 234, 236, 255) if not red else (226, 214, 214, 255))

    # hatching under the upper lid: the shade the lid throws on the eye
    for i in range(26):
        t = 0.08 + 0.84 * i / 25
        px, py = top[round(t * 80)]
        ln = H * (0.10 + 0.07 * math.sin(t * math.pi))
        d.line([(px, py + lw), (px + (cx - px) * 0.05, py + ln)], fill=(20, 22, 26, 200), width=max(1, lw // 2))

    # iris, ringed, with the spiral
    r = H * 0.29
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=ink)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=accent, width=lw)
    # fine radial strokes across the iris, the way a pen would shade it
    for i in range(44):
        ang = i * 2 * math.pi / 44 + 0.03 * math.sin(i * 3.1)
        r0, r1 = r * (0.3 + 0.05 * ((i * 7) % 5)), r * (0.86 + 0.1 * ((i * 3) % 4) / 3)
        d.line([(cx + math.cos(ang) * r0, cy + math.sin(ang) * r0), (cx + math.cos(ang) * r1, cy + math.sin(ang) * r1)],
               fill=(BLOOD if red else BONE) + (110,), width=max(1, lw // 3))
    pts = []
    a = 0.0
    while a < 3.4 * 2 * math.pi:
        rr = r * 0.08 + a * r * 0.043
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
        a += 0.12
    d.line(pts, fill=accent, width=max(2, lw // 2 + 1), joint="curve")
    d.ellipse((cx - r * 0.42, cy - r * 0.62, cx - r * 0.2, cy - r * 0.4), fill=bone)

    # the lids: a firm line, a second one above it, lashes at the outer corner
    d.line(top, fill=ink, width=lw * 2, joint="curve")
    d.line(low, fill=ink, width=lw + 2, joint="curve")
    crease = [(x, y - H * 0.1 * math.sin((i / 80) * math.pi)) for i, (x, y) in enumerate(top)]
    d.line(crease[8:-8], fill=ink, width=max(2, lw - 1), joint="curve")
    for i in range(26):
        t = 0.10 + 0.86 * i / 25
        px, py = top[round(t * 80)]
        ln = H * (0.06 + 0.14 * (t ** 2.2))                       # longer towards the outer corner
        dx, dy = W * 0.012 * (0.5 + t), -ln
        w0 = max(2, lw * 0.9)
        d.polygon([(px - w0 / 2, py), (px + w0 / 2, py), (px + dx, py + dy)], fill=ink)
    if red:
        for sx, sgn in ((left, 1), (right, -1)):
            for j in range(5):
                y0 = sx[1] + (j - 2) * H * 0.035
                ex = sx[0] + sgn * W * (0.14 + 0.03 * j)
                ey = cy + (j - 2) * H * 0.06
                d.line([(sx[0] + sgn * W * 0.02, y0), ((sx[0] + ex) / 2, (y0 + ey) / 2 + H * 0.02 * (j % 2 * 2 - 1)), (ex, ey)],
                       fill=BLOOD + (200,), width=max(1, lw // 2))
    return img.resize((W // k, H // k), Image.LANCZOS)

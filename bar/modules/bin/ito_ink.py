"""ito_ink: the baked ink layers of the lock designs (boot-lock-v2 §3.0). numpy + Pillow, no other dependency.

Everything here is drawn the way the rest of the suite is drawn: tone only from line and dot, paper left as paper,
line weight following the light (from the upper left), solid blacks anchoring the drawing. Colours are ARGUMENTS
(a dict with ink / bone / blood as "#rrggbb" resolved by the caller from the theme); this module holds no colour of
its own. Each layer is W x H for one monitor, k = H / 1440, and is cached by the caller keyed by
(layer, W, H, colours, params, GEN_VERSION).

Layers: L1 engraved picture, L2 hatched vignette, L3 inked ring, L5 strata, L6 beam, L7 rust, SC a scene of `recipe sheets` on the theme.
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

GEN_VERSION = 4
BAND = 256


def rgb(hex_colour):
    h = hex_colour.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float64)


def smoothstep(e0, e1, x):
    t = np.clip((np.asarray(x, np.float64) - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def fbm(w, h, seed, sx=2.6, base=90.0, octaves=5):
    """Fractal value noise in 0..1, stretched sideways (a bank of fog is wider than it is tall). Port of fogfield.fbm."""
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float64)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        sy = max(2.0, base / (2 ** o))
        gw, gh = int(np.ceil(w / (sy * sx))) + 3, int(np.ceil(h / sy)) + 3
        grid = (rng.random((gh, gw)) * 255).astype(np.uint8)
        layer = np.asarray(Image.fromarray(grid).resize((int(gw * sy * sx), int(gh * sy)), Image.BICUBIC),
                           np.float64)[:h, :w] / 255.0
        out += layer * amp
        total += amp
        amp *= 0.55
    out /= total
    lo, hi = np.percentile(out, 3), np.percentile(out, 97)
    return np.clip((out - lo) / max(1e-6, hi - lo), 0, 1)


def _grid(w, y0, y1):
    ys, xs = np.mgrid[y0:y1, 0:w].astype(np.float64)
    return xs, ys


def line_cov(u, spacing, width):
    """Anti-aliased coverage of parallel lines: u is the coordinate across the lines; width may be an array."""
    d = np.abs(np.mod(u, spacing) - spacing / 2.0)
    return np.clip(width / 2.0 - d + 0.5, 0.0, 1.0)


def hatch(xs, ys, deg, spacing, w0, t, thr, wobble=None):
    """One hatch family: a line where t >= thr, swelling in shadow and tapering into light:
    w = w0 * (0.6 + 0.8 * (t - thr) / (1 - thr))."""
    a = math.radians(deg)
    u = xs * math.cos(a) + ys * math.sin(a)
    if wobble is not None:
        u = u + wobble
    w = w0 * (0.6 + 0.8 * np.clip((t - thr) / max(1e-6, 1 - thr), 0, 1))
    return line_cov(u, spacing, w) * (t >= thr)


def dots(xs, ys, pitch, radius):
    """A 45-degree grid of round dots (screentone); radius may be an array."""
    r2 = math.sqrt(2) / 2
    u, v = (xs + ys) * r2, (xs - ys) * r2
    du = np.mod(u, pitch) - pitch / 2
    dv = np.mod(v, pitch) - pitch / 2
    return np.clip(radius - np.hypot(du, dv) + 0.5, 0.0, 1.0)


def _cover_crop(im, w, h):
    im = ImageOps.exif_transpose(im).convert("RGB")
    s = max(w / im.width, h / im.height)
    im = im.resize((max(w, round(im.width * s)), max(h, round(im.height * s))), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def engraved_picture(src, w, h, colours, seed=1440):
    """L1: the picture as a pen drawing on dark paper, lost in fog. Returns an RGB PIL image w x h."""
    k = h / 1440.0
    im = Image.open(src)
    grey = ImageOps.autocontrast(_cover_crop(im, w, h).convert("L"), cutoff=1)
    grey = grey.filter(ImageFilter.GaussianBlur(max(0.5, 1.2 * k)))
    t = (1 - np.asarray(grey, np.float64) / 255.0) ** 0.9
    ink, bone = rgb(colours["ink"]), rgb(colours["bone"])
    paper = ink * (1 - 0.42) + bone * 0.42
    fog_c = ink * (1 - 0.55) + bone * 0.55
    wob = fbm(w, h, seed, sx=1.0, base=40.0, octaves=3)
    fogn = smoothstep(0.45, 0.80, fbm(w, h, seed + 1, sx=2.6, base=170.0))
    out = np.empty((h, w, 3), np.uint8)
    pitch, s, w0 = 5 * k, 4.5 * k, 0.9 * k
    for y0 in range(0, h, BAND):
        y1 = min(h, y0 + BAND)
        xs, ys = _grid(w, y0, y1)
        tb = t[y0:y1]
        wb = (wob[y0:y1] - 0.5) * 0.6 * k
        r = pitch * 0.5 * np.sqrt(np.clip((tb - 0.12) / 0.28, 0, 1))
        m = dots(xs, ys, pitch, r) * (tb >= 0.12)
        m = np.maximum(m, hatch(xs, ys, 45, s, w0, tb, 0.40, wb))
        m = np.maximum(m, hatch(xs, ys, -45, s, w0, tb, 0.65, wb))
        m = np.where(tb >= 0.86, 1.0, m)
        col = paper[None, None, :] * (1 - m[..., None]) + ink[None, None, :] * m[..., None]
        f = (0.35 * fogn[y0:y1])[..., None]
        col = col * (1 - f) + fog_c[None, None, :] * f
        out[y0:y1] = np.clip(col + 0.5, 0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGB")


def vignette(w, h, colours, seed=7):
    """L2: the darkness at the rim drawn as hatching (RGBA, ink marks on transparent)."""
    k = h / 1440.0
    ink = rgb(colours["ink"])
    wob = fbm(w, h, seed, sx=1.0, base=40.0, octaves=3)
    out = np.zeros((h, w, 4), np.uint8)
    out[..., :3] = ink.astype(np.uint8)
    s, w0 = 6 * k, 1.1 * k
    for y0 in range(0, h, BAND):
        y1 = min(h, y0 + BAND)
        xs, ys = _grid(w, y0, y1)
        d = np.sqrt(((xs - 0.5 * w) / (0.60 * w)) ** 2 + ((ys - 0.47 * h) / (0.62 * h)) ** 2)
        t = smoothstep(0.50, 1.10, d)
        wb = (wob[y0:y1] - 0.5) * 0.6 * k
        m = hatch(xs, ys, 45, s, w0, t, 0.15, wb)
        m = np.maximum(m, hatch(xs, ys, -45, s, w0, t, 0.45, wb))
        m = np.maximum(m, hatch(xs, ys, 0, s, w0, t, 0.70, wb))
        m = np.where(t >= 0.93, 1.0, m)
        out[y0:y1, :, 3] = np.clip(m * 0.92 * 255 + 0.5, 0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def ring(mark_size, k, colours, pad=8):
    """L3: a G-pen ring for the mark. The image is (mark_size + 2*pad*k) square; r = mark_size/2 + 3k. The line is heavy
    on the lower right (away from the upper-left light), with two gaps where the lit side breaks, and one broken
    inner hairline. bone, alpha 0.90 / 0.35."""
    S = round(mark_size + 2 * pad * k)
    Q = 4
    big = Image.new("RGBA", (S * Q, S * Q), (0, 0, 0, 0))
    bone = tuple(int(v) for v in rgb(colours["bone"]))
    cx = cy = S * Q / 2.0

    def arc(r, wfun, alpha, gaps):
        layer = Image.new("L", big.size, 0)
        dr = ImageDraw.Draw(layer)
        n = 720
        prev = None
        for i in range(n + 1):
            deg = 360.0 * i / n
            if any((a0 <= deg <= a1) if a0 <= a1 else (deg >= a0 or deg <= a1) for a0, a1 in gaps):
                prev = None
                continue
            th = math.radians(deg)
            p = (cx + r * Q * math.cos(th), cy + r * Q * math.sin(th))
            wd = max(1.0, wfun(th) * Q)
            if prev is not None:
                dr.line([prev, p], fill=255, width=int(round(wd)))
            dr.ellipse([p[0] - wd / 2, p[1] - wd / 2, p[0] + wd / 2, p[1] + wd / 2], fill=255)
            prev = p
        return layer.point(lambda v: int(v * alpha))

    def heavy(th):
        c = math.cos(th - math.radians(45))   # y grows downward, so +45 deg is the lower right
        return 0.6 * k + 2.2 * k * float(smoothstep(-0.2, 1.0, c))

    main = arc(mark_size / 2.0 + 3 * k, heavy, 0.90, [(197.5, 202.5), (245.5, 254.5)])
    hair = arc(mark_size / 2.0 + 3 * k - 3 * k, lambda th: 0.5 * k, 0.35, [(300.0, 20.0)])
    a = ImageChops.lighter(main, hair)
    big = Image.new("RGBA", big.size, bone + (0,))
    big.putalpha(a)
    return big.resize((S, S), Image.LANCZOS)


# ---------------------------------------------------------------------------------------------------------------
# Pen helpers shared by the layers below

LIGHT = np.array([-1.0, -1.0]) / math.sqrt(2)      # the light comes from the upper left (screen coordinates)


def mapper(w, h):
    """Reference coordinates (2560 x 1440 grid, centred) to this monitor's pixels."""
    k = h / 1440.0
    return k, (lambda x, y: ((x - 1280.0) * k + w / 2.0, (y - 720.0) * k + h / 2.0))


def person(cx, top, h, neck=1.0, tilt=0.0, raised=False, shoulders=0.26, hips=0.18, torso=None, samples=24):
    """A human silhouette as one polygon (head ellipse, neck, shoulders, arms at the sides or raised, hips, feet
    together), proportions of h: head 0.13 tall and 0.10 wide, shoulders `shoulders`, hips `hips`."""
    hh, hw = 0.13 * h, 0.10 * h
    head_cy = top + hh / 2
    neck_w, neck_h = 0.045 * h * neck, 0.04 * h * neck
    sy = top + hh + neck_h                                # shoulder line
    sw = shoulders * h / 2
    tw = (torso if torso is not None else shoulders * 0.80) * h / 2   # waist, arms folded in
    hw2 = hips * h / 2
    feet = top + h
    pts = []
    for i in range(samples):                              # head, clockwise from the top
        a = -math.pi / 2 + 2 * math.pi * i / samples
        pts.append((cx + math.cos(a) * hw / 2, head_cy + math.sin(a) * hh / 2))
    # replace the lower part of the ellipse by the neck and body, going clockwise down the right side
    head = [p for p in pts if p[1] <= head_cy + hh * 0.18]
    head_r = [p for p in head if p[0] >= cx]
    head_l = [p for p in head if p[0] < cx]
    body_r = [(cx + neck_w / 2, top + hh * 0.95), (cx + neck_w / 2, sy), (cx + sw, sy + 0.025 * h)]
    if raised:
        body_r += [(cx + sw * 1.15, sy - 0.10 * h), (cx + sw * 1.30, top + 0.02 * h), (cx + sw * 1.02, sy - 0.08 * h),
                   (cx + tw, sy + 0.06 * h)]
    else:
        body_r += [(cx + sw * 1.02, sy + 0.30 * h), (cx + tw * 1.12, sy + 0.36 * h)]
    body_r += [(cx + tw, top + 0.55 * h), (cx + hw2, top + 0.60 * h), (cx + hw2 * 0.80, top + 0.80 * h), (cx + hw2 * 0.34, feet)]
    body_l = [(2 * cx - x, y) for x, y in reversed(body_r)]
    poly = head_r + body_r + body_l + head_l
    if tilt:
        a = math.radians(tilt)
        poly = [(cx + (x - cx) * math.cos(a) - (y - top - h / 2) * math.sin(a), top + h / 2 + (x - cx) * math.sin(a) + (y - top - h / 2) * math.cos(a)) for x, y in poly]
    return poly


def strata(w, h, colours, seed=1440, yours_width=0.30):
    """L5: the cliff face of Amigara (§3.6): ink ground, thin strata, seven human-shaped holes with a paper rim
    light on their upper left. Yours (the seventh) is the tall one in the middle, and the field sits in it."""
    import random
    k, mp = mapper(w, h)
    ink, bone = rgb(colours["ink"]), rgb(colours["bone"])
    out = np.zeros((h, w, 4), np.uint8)
    out[..., :3] = ink.astype(np.uint8)
    ground = np.full((h, w), 0.88)
    wob = fbm(w, h, seed, sx=3.0, base=120.0, octaves=4)
    marks = np.zeros((h, w), np.float64)
    ph = math.radians(3.0)
    for y0 in range(0, h, BAND):
        y1 = min(h, y0 + BAND)
        xs, ys = _grid(w, y0, y1)
        f = wob[y0:y1]
        s = 5 * k * (1 + 0.4 * f)
        u = ys * math.cos(ph) - xs * math.sin(ph)
        d = np.abs(np.mod(u, s) - s / 2.0)
        wd = (0.8 + 0.8 * f) * k
        cov = np.clip(wd / 2 - d + 0.5, 0, 1)
        marks[y0:y1] = cov * (0.10 + 0.12 * f)
    # holes
    SS = 2
    hole = Image.new("L", (w * SS, h * SS), 0)
    hd = ImageDraw.Draw(hole)
    rim = Image.new("L", (w * SS, h * SS), 0)
    rd = ImageDraw.Draw(rim)
    rnd = random.Random(seed)
    strangers = [(360, 240, 300, dict()), (640, 520, 340, dict(neck=1.6)), (860, 180, 280, dict(tilt=8.0)),
                 (1700, 260, 320, dict()), (1960, 560, 300, dict(neck=1.9, tilt=-6.0)), (2240, 220, 340, dict(raised=True))]
    figures = [(c, t, hgt, kw) for c, t, hgt, kw in strangers]
    figures.append((1280, 300, 640, dict(shoulders=yours_width, torso=yours_width * 0.90)))
    for cx, top, hgt, kw in figures:
        poly_ref = person(cx, top, hgt, **kw)
        poly = [mp(x, y) for x, y in poly_ref]
        hd.polygon([(x * SS, y * SS) for x, y in poly], fill=255)
        n = len(poly)
        for i in range(n):
            a, b = poly[i], poly[(i + 1) % n]
            ex, ey = b[0] - a[0], b[1] - a[1]
            el = math.hypot(ex, ey) or 1.0
            nx, ny = ey / el, -ex / el
            mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            ccx, ccy = sum(p[0] for p in poly) / n, sum(p[1] for p in poly) / n
            if nx * (mx - ccx) + ny * (my - ccy) < 0:
                nx, ny = -nx, -ny
            if float(np.dot([nx, ny], LIGHT)) > math.cos(math.radians(60)):
                rd.line([a[0] * SS, a[1] * SS, b[0] * SS, b[1] * SS], fill=255, width=max(1, int(1.5 * k * SS)))
    hole_a = np.asarray(hole.resize((w, h), Image.LANCZOS), np.float64) / 255.0
    rim_a = np.asarray(rim.resize((w, h), Image.LANCZOS), np.float64) / 255.0
    # compose: ground, strata (bone), holes (solid ink), rim light (bone 0.35) on top of the holes' edge
    a = np.maximum(ground, 0.0)
    col = np.zeros((h, w, 3)) + ink
    t = marks * (1 - hole_a)
    col = col * (1 - t[..., None]) + bone * t[..., None]
    a = a * (1 - hole_a) + hole_a
    rr = rim_a * 0.35
    col = col * (1 - rr[..., None]) + bone * rr[..., None]
    out[..., :3] = np.clip(col + 0.5, 0, 255).astype(np.uint8)
    out[..., 3] = np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def beam(w, h, colours, strength=0.88, seed=662):
    """L6: the lantern's pool of light; outside it the darkness is hatching (L2's families) instead of flat alpha, and
    the rim of the light carries a ring of radio static. Pool P = (0.40 W, 0.46 H), radii 600k and 460k."""
    k = h / 1440.0
    px, py, rx, ry = 0.40 * w, 0.46 * h, 600 * k, 460 * k
    ink = rgb(colours["ink"])
    out = np.zeros((h, w, 4), np.uint8)
    out[..., :3] = ink.astype(np.uint8)
    wob = fbm(w, h, seed, sx=1.0, base=40.0, octaves=3)
    rng = np.random.default_rng(seed)
    qh, qw = max(2, h // 4), max(2, w // 4)
    noise = np.asarray(Image.fromarray((rng.random((qh, qw)) * 255).astype(np.uint8)).resize((w, h), Image.BILINEAR), np.float64) / 255.0 * 2 - 1
    s, w0 = 6 * k, 1.1 * k
    for y0 in range(0, h, BAND):
        y1 = min(h, y0 + BAND)
        xs, ys = _grid(w, y0, y1)
        d = np.sqrt(((xs - px) / rx) ** 2 + ((ys - py) / ry) ** 2)
        t = strength * smoothstep(0.62, 1.0, d)
        wb = (wob[y0:y1] - 0.5) * 0.6 * k
        m = hatch(xs, ys, 45, s, w0, t, 0.15, wb)
        m = np.maximum(m, hatch(xs, ys, -45, s, w0, t, 0.45, wb))
        m = np.maximum(m, hatch(xs, ys, 0, s, w0, t, 0.70, wb))
        m = np.where(t >= 0.93, 1.0, m)
        ring_a = np.where((d >= 0.78) & (d <= 1.08), noise[y0:y1] * 0.07 * (1 - np.abs(d - 0.93) / 0.15), 0.0)
        a = np.clip(m * 0.92 + ring_a, 0, 1)
        out[y0:y1, :, 3] = (a * 255 + 0.5).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def rust(w, h, colours, seed=890):
    """L7: the Otherworld below the golden line (§3.5): ink ground, rust as hatching in blood (not a tint), drips and
    flaking. Returns (RGBA image, blood coverage = blood-ink pixels / marked pixels)."""
    import random
    k = h / 1440.0
    y_seam, y_start = 0.618 * h, 0.6139 * h
    ink, blood, bone = rgb(colours["ink"]), rgb(colours["blood"]), rgb(colours["bone"])
    wob = fbm(w, h, seed, sx=1.0, base=40.0, octaves=3)
    fl = fbm(w, h, seed + 3, sx=2.0, base=60.0, octaves=4)
    ground_a = np.zeros((h, w))
    blood_m = np.zeros((h, w))
    flake = np.zeros((h, w))
    for y0 in range(0, h, BAND):
        y1 = min(h, y0 + BAND)
        xs, ys = _grid(w, y0, y1)
        g = np.clip((ys - y_start) / (0.0111 * h), 0, 1) * 0.70       # the ground comes in over 16 px at 1440p
        ground_a[y0:y1] = g
        t = np.clip((ys - y_seam) / (h - y_seam), 0, 1) * 0.55 + 0.25
        wb = (wob[y0:y1] - 0.5) * 0.6 * k
        m = hatch(xs, ys, 45, 11 * k, 1.0 * k, t, 0.25, wb) * (ys >= y_seam)
        blood_m[y0:y1] = m
        r = 5 * k * 0.45
        flake[y0:y1] = dots(xs, ys, 5 * k, r) * (fl[y0:y1] > 0.62) * (ys >= y_seam)
    rnd = random.Random(seed)
    drips = Image.new("L", (w, h), 0)
    dd = ImageDraw.Draw(drips)
    band = max(1, int(3 * k))
    for x in range(0, w, band):
        if rnd.random() < 0.14:
            ln = rnd.uniform(20, 220) * k
            x0 = x + band / 2
            steps = max(2, int(ln))
            for i in range(steps):
                wd = (1.6 - 1.2 * i / steps) * k
                yy = y_seam + i
                dd.ellipse([x0 - wd / 2, yy - wd / 2, x0 + wd / 2, yy + wd / 2], fill=255)
            rr = 2.2 * k
            dd.ellipse([x0 - rr, y_seam + ln - rr, x0 + rr, y_seam + ln + rr], fill=255)
    drip_m = np.asarray(drips, np.float64) / 255.0
    bm = np.clip(np.maximum(blood_m, drip_m), 0, 1)
    a_ground = ground_a
    a_blood = bm * np.where(drip_m > blood_m, 0.55, 0.40)
    a_flake = flake * 0.10
    # over-composite ground, blood, flake
    A1 = a_ground
    col = np.zeros((h, w, 3)) + ink
    A = A1.copy()
    for a_l, c_l in ((a_blood, blood), (a_flake, bone)):
        newA = a_l + A * (1 - a_l)
        with np.errstate(divide="ignore", invalid="ignore"):
            col = np.where(newA[..., None] > 0, (c_l * a_l[..., None] + col * (A * (1 - a_l))[..., None]) / np.maximum(newA[..., None], 1e-9), col)
        A = newA
    out = np.zeros((h, w, 4), np.uint8)
    out[..., :3] = np.clip(col + 0.5, 0, 255).astype(np.uint8)
    out[..., 3] = np.clip(A * 255 + 0.5, 0, 255).astype(np.uint8)
    marked = A > 0.05
    cover = float(((bm > 0.5) & marked).sum() / max(1, marked.sum()))
    return Image.fromarray(out, "RGBA"), cover


def spiral_geometry(shape, w, h):
    sh, k = SPIRAL_SHAPES[shape], h / 1440.0
    box = round(sh["R"] * k * 2) + 8
    cx, cy = round(sh["cx"] * w), round(sh["cy"] * h)
    return {"cx": cx, "cy": cy, "R": sh["R"] * k, "box": box, "bbox": [cx - box // 2, cy - box // 2, box, box],
            "frames": sh["n"], "shape": shape}


def _stamps(sh, k):
    out = []
    big_r, theta_max = sh["R"] * k, 2 * math.pi * sh["T"]
    theta = theta_max * sh["r_hole"] / sh["R"]
    while theta <= theta_max:
        r = big_r * theta / theta_max
        wd = (sh["w_in"] + (sh["w_out"] - sh["w_in"]) * (r / big_r) ** 0.8) * k
        alpha = 1.0 if r <= 0.82 * big_r else 1.0 - float(smoothstep(0.0, 1.0, (r - 0.82 * big_r) / (0.18 * big_r)))
        out.append((theta, r, wd, alpha))
        theta += (0.35 * wd) / max(1e-6, math.hypot(r, big_r / theta_max))
    return out


def _frames_stamp(shape, w, h, colours, target, arm_b_alpha=0.35):
    sh, k, SS = SPIRAL_SHAPES[shape], h / 1440.0, 4
    geo = spiral_geometry(shape, w, h)
    box, n = geo["box"], sh["n"]
    marks = _stamps(sh, k)
    arms = [(tuple(int(v) for v in rgb(colours["blood"])), 1.0, 0.0), (tuple(int(v) for v in rgb(colours["bone"])), arm_b_alpha, math.pi)]
    for i in range(n):
        rot = 2 * math.pi * i / n
        tile = Image.new("RGBA", (box, box), (0, 0, 0, 0))
        for col, arm_alpha, off in arms:
            mask = Image.new("L", (box * SS, box * SS), 0)
            d = ImageDraw.Draw(mask)
            for th, r, wd, a in marks:
                x = (box / 2 + r * math.cos(th + rot + off)) * SS
                y = (box / 2 + r * math.sin(th + rot + off)) * SS
                rad = wd * SS / 2
                d.ellipse([x - rad, y - rad, x + rad, y + rad], fill=round(255 * a * arm_alpha))
            layer = Image.new("RGBA", (box, box), col + (0,))
            layer.putalpha(mask.resize((box, box), Image.LANCZOS))
            tile = Image.alpha_composite(tile, layer)
        canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        canvas.paste(tile, (geo["cx"] - box // 2, geo["cy"] - box // 2))
        canvas.save(target / f"{i:02d}.png", optimize=False, compress_level=1)
    return geo


def _ribbon_geometry(sh, k, step):
    """The centre line of arm A at rotation 0: angles, radii, and the ribbon width at each sample."""
    big_r, theta_max = sh["R"] * k, 2 * math.pi * sh["T"]
    t0 = theta_max * sh["r_hole"] / sh["R"]
    # arc-length parametrisation: dtheta = step / hypot(r, dr/dtheta)
    th = [t0]
    while th[-1] < theta_max:
        r = big_r * th[-1] / theta_max
        th.append(th[-1] + step / max(1e-6, math.hypot(r, big_r / theta_max)))
    th = np.array(th)
    r = big_r * th / theta_max
    wd = (sh["w_in"] + (sh["w_out"] - sh["w_in"]) * (r / big_r) ** 0.8) * k
    fade = np.where(r <= 0.82 * big_r, 1.0, 1.0 - smoothstep(0.0, 1.0, (r - 0.82 * big_r) / (0.18 * big_r)))
    return th, r, wd, fade


def _frames_ribbon(shape, w, h, colours, target):
    """L8: an engraved spiral. Each arm is a ribbon drawn only in line: two edge strokes (heavy on the side facing away
    from the light, thin and broken where lit) and three hairlines cut inside it. Arm A bone 0.55, arm B blood 0.30."""
    sh, k, SS = SPIRAL_SHAPES[shape], h / 1440.0, 2
    geo = spiral_geometry(shape, w, h)
    box, n = geo["box"], sh["n"]
    th, r, wd, fade = _ribbon_geometry(sh, k, 1.5)
    arms = [(tuple(int(v) for v in rgb(colours["bone"])), 0.55, 0.0), (tuple(int(v) for v in rgb(colours["blood"])), 0.30, math.pi)]
    offs = (-0.5, -0.25, 0.0, 0.25, 0.5)            # edge, three hairlines, edge, as fractions of the ribbon width
    for i in range(n):
        rot = 2 * math.pi * i / n
        tile = Image.new("RGBA", (box, box), (0, 0, 0, 0))
        for col, arm_alpha, off in arms:
            mask = Image.new("L", (box * SS, box * SS), 0)
            d = ImageDraw.Draw(mask)
            ang = th + rot + off
            cxp, cyp = r * np.cos(ang), r * np.sin(ang)
            # unit normal of the centre line (screen coordinates)
            dx, dy = np.gradient(cxp), np.gradient(cyp)
            ln = np.hypot(dx, dy) + 1e-9
            nx, ny = -dy / ln, dx / ln
            for j, f in enumerate(offs):
                edge = j in (0, 4)
                px = (box / 2 + cxp + nx * wd * f) * SS
                py = (box / 2 + cyp + ny * wd * f) * SS
                if edge:
                    out_n = (nx * np.sign(f), ny * np.sign(f))
                    shade = -(out_n[0] * LIGHT[0] + out_n[1] * LIGHT[1])
                    heavy = shade > 0.15
                    pw = np.where(heavy, 2.2 * k, 0.6 * k)
                    # "broken where lit": the thin side drops out in a regular pattern along the arm
                    keep = np.where(heavy, True, (np.floor(th * 5.0) % 3) != 0)
                else:
                    pw = np.full(len(th), 0.7 * k)
                    keep = np.ones(len(th), bool)
                a_run = (fade * 255 * arm_alpha).astype(int)
                s0 = 0
                while s0 < len(th) - 1:
                    s1 = s0 + 1
                    key = (bool(keep[s0]), round(float(pw[s0]), 1), a_run[s0] // 24)
                    while s1 < len(th) - 1 and (bool(keep[s1]), round(float(pw[s1]), 1), a_run[s1] // 24) == key:
                        s1 += 1
                    if keep[s0] and a_run[s0] > 3:
                        pts = [(px[q], py[q]) for q in range(s0, s1 + 1)]
                        d.line(pts, fill=int(a_run[s0]), width=max(1, int(round(pw[s0] * SS))), joint="curve")
                    s0 = s1
            layer = Image.new("RGBA", (box, box), col + (0,))
            layer.putalpha(mask.resize((box, box), Image.LANCZOS))
            tile = Image.alpha_composite(tile, layer)
        canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        canvas.paste(tile, (geo["cx"] - box // 2, geo["cy"] - box // 2))
        canvas.save(target / f"{i:02d}.png", optimize=False, compress_level=1)
    return geo


def spiral_frames(shape, w, h, colours, target):
    """Draw the frames of `shape` into the (existing) directory `target`; returns the geometry. Frame i is rotated
    2*pi*i/n at constant speed, so the loop closes by construction, and increasing rotation flows inward."""
    from pathlib import Path
    target = Path(target)
    target.mkdir(parents=True, exist_ok=True)
    fn = _frames_ribbon if SPIRAL_SHAPES[shape]["style"] == "ribbon" else _frames_stamp
    return fn(shape, w, h, colours, target)


def duotone_picture(src, colours):
    """The v1 'fog' treatment (lockBg = duotone): grey -> autocontrast -> lerp(ink, paper), paper = lerp(ink, bone, 0.88)."""
    im = ImageOps.exif_transpose(Image.open(src))
    if max(im.size) > 4096:
        im.thumbnail((4096, 4096))
    ink, bone = rgb(colours["ink"]), rgb(colours["bone"])
    paper = tuple(int(round(v)) for v in ink + (bone - ink) * 0.88)
    return ImageOps.colorize(ImageOps.autocontrast(im.convert("L"), cutoff=1), black=tuple(int(v) for v in ink), white=paper)


def scene(src, w, h, colours):
    """SC: a lock scene of `ito-assets recipe sheets` (saved in ito_sheets' reference palette) recoloured onto the theme. The file is
    ink + u (bone - ink) + b (blood - ink) in the reference colours; u and b are recovered per pixel (least squares on that 2-colour
    basis) and the same sum is drawn with the theme's ink, bone and blood. Cover-cropped to w x h. Returns an RGB PIL image."""
    import ito_sheets as SH
    im = _cover_crop(Image.open(src), w, h)
    a = np.asarray(im, np.float32) - SH.INK_REF
    basis = np.stack([SH.BONE_REF - SH.INK_REF, SH.BLOOD_REF - SH.INK_REF], axis=1)     # 3 x 2
    ub = np.clip(a.reshape(-1, 3) @ np.linalg.pinv(basis).T, 0.0, 1.0)                    # N x 2: tone (u) and blood (b)
    ink, bone, blood = (rgb(colours[n]).astype(np.float32) for n in ("ink", "bone", "blood"))
    out = ink + ub[:, :1] * (bone - ink) + ub[:, 1:] * (blood - ink)
    return Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8).reshape(h, w, 3), "RGB")


# ---------------------------------------------------------------------------------------------------------------
# L7 watcher: Hellstar Remina's eye in the sky, drawn as an engraving (boot-lock-v2 §3.7). Port of scripts/eyeart.py watcher()
# with the colours as ARGUMENTS: paper = lerp(ink, bone, 0.80), lines = ink, iris and veins = blood.

def _bez(p0, p1, p2, p3, n=80):
    out = []
    for i in range(n + 1):
        t, u = i / n, 1 - i / n
        out.append((u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
                    u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]))
    return out




def watcher_size(width):
    return int(width), int(round(width / 2.6))


def watcher_frame(width, colours, gx=0.0, gy=0.0, lid=0.0):
    """One frame of the eye: `width` px wide, 2.6 : 1. (gx, gy) is the gaze in px; lid in 0..1 lowers the upper lid (a blink)."""
    SS = 4
    W, H0 = watcher_size(width)
    W, H = W * SS, H0 * SS
    ink = tuple(int(v) for v in rgb(colours["ink"]))
    bone = rgb(colours["bone"])
    paper = tuple(int(v) for v in rgb(colours["ink"]) * 0.2 + bone * 0.8)
    blood = tuple(int(v) for v in rgb(colours["blood"]))
    cx, cy = W / 2, H / 2
    lw = max(2, round(W * 0.011))
    left, right = (W * 0.04, cy + H * 0.04), (W * 0.96, cy - H * 0.02)
    top = _bez(left, (W * 0.24, -H * 0.02), (W * 0.72, H * 0.02), right)
    low = _bez(right, (W * 0.72, H * 1.04), (W * 0.26, H * 1.0), left)
    if lid > 0:                                              # the upper lid comes down toward the lower one
        lowl = low[::-1]
        top = [(x, y + (ly - y) * lid * 0.92) for (x, y), (_lx, ly) in zip(top, lowl)]
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    shape = top + low
    d.polygon(shape, fill=paper + (255,))
    n = len(top) - 1
    for i in range(26):                                      # the shade the lid throws on the eye
        t = 0.08 + 0.84 * i / 25
        px, py = top[round(t * n)]
        ln = H * (0.10 + 0.07 * math.sin(t * math.pi)) * (1 - lid * 0.7)
        d.line([(px, py + lw), (px + (cx - px) * 0.05, py + ln)], fill=ink + (200,), width=max(1, lw // 2))
    # iris with its spiral, looking where (gx, gy) says; everything is clipped to the opening
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ix, iy = cx + gx * SS, cy + gy * SS
    r = H * 0.29
    ld.ellipse((ix - r, iy - r, ix + r, iy + r), fill=ink + (255,), outline=blood + (255,), width=lw)
    for i in range(44):
        ang = i * 2 * math.pi / 44 + 0.03 * math.sin(i * 3.1)
        r0, r1 = r * (0.3 + 0.05 * ((i * 7) % 5)), r * (0.86 + 0.1 * ((i * 3) % 4) / 3)
        ld.line([(ix + math.cos(ang) * r0, iy + math.sin(ang) * r0), (ix + math.cos(ang) * r1, iy + math.sin(ang) * r1)],
                fill=blood + (110,), width=max(1, lw // 3))
    pts, a = [], 0.0
    while a < 2.6 * 2 * math.pi:
        rr = r * 0.08 + a * r * 0.043
        pts.append((ix + math.cos(a) * rr, iy + math.sin(a) * rr))
        a += 0.12
    ld.line(pts, fill=blood + (255,), width=max(2, lw // 2 + 1), joint="curve")
    ld.ellipse((ix - r * 0.42, iy - r * 0.62, ix - r * 0.2, iy - r * 0.4), fill=paper + (255,))      # the catchlight, paper
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).polygon(shape, fill=255)
    layer.putalpha(ImageChops.multiply(layer.getchannel("A"), mask))
    img.alpha_composite(layer)
    d = ImageDraw.Draw(img)
    d.line(top, fill=ink + (255,), width=lw * 2, joint="curve")             # the heavy upper lid
    d.line(low, fill=ink + (255,), width=lw + 2, joint="curve")
    crease = [(x, y - H * 0.1 * math.sin((i / n) * math.pi)) for i, (x, y) in enumerate(top)]
    d.line(crease[8:-8], fill=ink + (255,), width=max(2, lw - 1), joint="curve")
    for i in range(26):                                      # lashes, longer toward the outer corner
        t = 0.10 + 0.86 * i / 25
        px, py = top[round(t * n)]
        ln = H * (0.06 + 0.14 * (t ** 2.2))
        w0 = max(2, lw * 0.9)
        d.polygon([(px - w0 / 2, py), (px + w0 / 2, py), (px + W * 0.012 * (0.5 + t), py - ln)], fill=ink + (255,))
    return img.resize((W // SS, H // SS), Image.LANCZOS)


def watcher_frames(width, k, colours, target):
    """The drawn eye as ONE static image `eye.png` in `target` (an existing or new directory): hyprlock cannot animate faster than
    1 fps, so the watcher is a sharp still; the smooth motion lives in the Quickshell lock."""
    from pathlib import Path
    target = Path(target)
    target.mkdir(parents=True, exist_ok=True)
    w, h = watcher_size(width)
    watcher_frame(width, colours, 0.0, 0.0, 0.0).save(target / "eye.png", optimize=False, compress_level=6)
    return {"width": w, "height": h}


# ---------------------------------------------------------------------------------------------------------------
# A2: the watcher built on the user's engraved eye (decisions-b9 §4). The art lives in ~/.config/ito/assets/eye (never in the
# repo); only the dark-themes file is read: white ink, alpha = brightness. The eye is always LIGHT ink in a DARK pool, so on any
# theme the lines are the lighter of ink/bone and the pool the darker. The eye is a still (hyprlock cannot animate above 1 fps); the iris disc is a separate
# alpha image the Quickshell lock turns on the GPU. No blink, no frames. No colour literal here: every colour is an argument.

EYE_DEFAULTS = {"crop": [226, 134, 1422, 790], "iris": {"cx": 849, "cy": 490, "r": 203}, "spin": {"r0": 112, "r1": 146},
                "catchlight": [700, 415], "lidUpper": [[470, 500], [845, 177], [1250, 505]],
                "lidLower": [[470, 500], [850, 900], [1250, 505]], "meet": 0.85}
EYE_REF_SIZE = (1672, 941)
EYE_SPIN_PERIOD = 48      # seconds per full turn of the iris in the Quickshell lock (constant speed, never eased)
EYE_PAD = 0.02


class EyeArtError(Exception):
    """The asset is missing or unusable; the message is the one health line."""


def eye_files(folder):
    from pathlib import Path
    f = Path(folder)
    return [f / "spiral-eye-ink-for-dark-themes.png", f / "spiral-eye-ink-for-light-themes.png", f / "spiral-eye-cutout.png",
            f / "eye.json"]


def eye_signature(folder):
    """[(name, size, mtime_ns)] of the files the eye is drawn from (the cache key)."""
    out = []
    for f in eye_files(folder):
        try:
            st = f.stat()
            out.append([f.name, st.st_size, st.st_mtime_ns])
        except OSError:
            pass
    return out


def eye_load(folder):
    """(alpha float32 0..1 [H, W], meta dict). Raises EyeArtError with the reason. Bounded: <= 40 MB, each side <= 8192,
    <= 64 Mpx, verify() then a second open, aspect of the content 1.3-2.6."""
    import json
    f = eye_files(folder)[0]
    try:
        size = f.stat().st_size
    except OSError:
        raise EyeArtError("the dark-themes eye file is missing")
    if size > 40 * 1024 * 1024:
        raise EyeArtError("the eye file is larger than 40 MB")
    old = Image.MAX_IMAGE_PIXELS
    Image.MAX_IMAGE_PIXELS = int(64e6)
    try:
        try:
            with Image.open(f) as im:
                if im.format != "PNG":
                    raise EyeArtError("the eye file is not a PNG")
                if max(im.size) > 8192:
                    raise EyeArtError("the eye file is larger than 8192 px")
                im.verify()
            with Image.open(f) as im:
                im.load()
                a = np.asarray(im.convert("RGBA").getchannel("A"), np.float32) / 255.0
        except EyeArtError:
            raise
        except Exception as e:      # truncated, bomb, not an image...
            raise EyeArtError(f"the eye file cannot be read ({type(e).__name__})")
    finally:
        Image.MAX_IMAGE_PIXELS = old
    H, W = a.shape
    ys, xs = np.nonzero(a > 0.06)
    if xs.size < 100:
        raise EyeArtError("the eye file has no drawing")
    bx0, by0, bx1, by1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    if not 1.3 <= (bx1 - bx0) / max(1, by1 - by0) <= 2.6:
        raise EyeArtError("the eye drawing is not roughly 1.8:1")
    meta = json.loads(json.dumps(EYE_DEFAULTS))
    user = None
    try:
        user = json.loads(eye_files(folder)[3].read_text())
    except (OSError, ValueError):
        user = None
    if isinstance(user, dict):
        for k, v in user.items():
            if k in meta:
                meta[k] = v
    elif (W, H) != EYE_REF_SIZE:   # a redrawn eye of another size: the reference geometry, scaled to its own content box
        c0 = EYE_DEFAULTS["crop"]
        sx, sy = (bx1 - bx0) / (c0[2] - c0[0]), (by1 - by0) / (c0[3] - c0[1])
        T = lambda p: [bx0 + (p[0] - c0[0]) * sx, by0 + (p[1] - c0[1]) * sy]
        meta["crop"] = [bx0, by0, bx1, by1]
        iris = EYE_DEFAULTS["iris"]
        meta["iris"] = {"cx": T([iris["cx"], iris["cy"]])[0], "cy": T([iris["cx"], iris["cy"]])[1], "r": iris["r"] * (sx + sy) / 2}
        meta["spin"] = {k: v * (sx + sy) / 2 for k, v in EYE_DEFAULTS["spin"].items()}
        meta["catchlight"] = T(EYE_DEFAULTS["catchlight"])
        meta["lidUpper"] = [T(p) for p in EYE_DEFAULTS["lidUpper"]]
        meta["lidLower"] = [T(p) for p in EYE_DEFAULTS["lidLower"]]
    try:
        cx0, cy0, cx1, cy1 = [int(round(v)) for v in meta["crop"]]
        if not (0 <= cx0 < cx1 <= W and 0 <= cy0 < cy1 <= H):
            raise ValueError("crop")
        sp = meta["spin"]
        iris, cl = meta["iris"], meta["catchlight"]
        r1 = min(float(sp["r1"]), math.hypot(cl[0] - iris["cx"], cl[1] - iris["cy"]) - 22)   # the catchlight starts ~18 px inside its centre distance
        r0 = min(float(sp["r0"]), r1 - 8)
        if r1 < 40 or r0 < 0:
            raise ValueError("spin")
        meta["spin"] = {"r0": r0, "r1": r1}
        for key in ("lidUpper", "lidLower"):
            assert len(meta[key]) == 3 and all(len(p) == 2 for p in meta[key])
        meta["meet"] = float(meta["meet"])
    except Exception:
        raise EyeArtError("eye.json is not valid")
    meta["size"] = [W, H]
    return a, meta


def eye_pool(w, h, k, colours, ecx, ecy, ew, eh, seed=11):
    """The ink pool the eye sits in (RGBA, full canvas, the darker of ink/bone): an ellipse of semi-axes 0.60 ew x 0.62 eh,
    solid inside, hatched (A 45, B -45) toward the rim."""
    ink, bone = rgb(colours["ink"]), rgb(colours["bone"])
    lum = lambda c: 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    shade = ink if lum(ink) <= lum(bone) else bone
    ax, ay = 0.60 * ew, 0.62 * eh
    ext_x, ext_y = ax * 1.08, ay * 1.08
    x0, x1 = max(0, int(ecx - ext_x) - 2), min(w, int(ecx + ext_x) + 3)
    y0, y1 = max(0, int(ecy - ext_y) - 2), min(h, int(ecy + ext_y) + 3)
    out = np.zeros((h, w, 4), np.uint8)
    out[..., :3] = shade.astype(np.uint8)
    if x1 <= x0 or y1 <= y0:
        return Image.fromarray(out, "RGBA")
    ys, xs = np.mgrid[y0:y1, x0:x1].astype(np.float64)
    d = np.sqrt(((xs - ecx) / ax) ** 2 + ((ys - ecy) / ay) ** 2)
    t = 1.0 - smoothstep(0.66, 1.08, d)
    wob = (fbm(x1 - x0, y1 - y0, seed, sx=1.0, base=40.0, octaves=3) - 0.5) * 0.6 * k
    s, w0 = 6 * k, 1.1 * k
    m = hatch(xs, ys, 45, s, w0, t, 0.15, wob)
    m = np.maximum(m, hatch(xs, ys, -45, s, w0, t, 0.45, wob))
    m = np.where(t >= 0.97, 1.0, m)
    out[y0:y1, x0:x1, 3] = np.clip(m * 0.94 * 255 + 0.5, 0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def vignette_pool(w, h, colours, ecx, ecy, ew, eh):
    """L2w: L2's hatched vignette with the eye's pool laid over it (one image, so the validator's layer count holds)."""
    base = vignette(w, h, colours)
    base.alpha_composite(eye_pool(w, h, h / 1440.0, colours, ecx, ecy, ew, eh))
    return base


def eye_geometry(w, h):
    """Layout of decisions-b9 §4.3 for a W x H screen: content width ew = min(900 k, 1375), eh = ew * 656/1196, the frame
    1.04 ew x 1.04 eh, the eye centred at (W/2, 560 k)."""
    k = h / 1440.0
    ew = min(900.0 * k, 1375.0)
    eh = ew * 656.0 / 1196.0
    return {"k": k, "ew": ew, "eh": eh, "fw": int(round(1.04 * ew)), "fh": int(round(1.04 * eh)), "cx": w / 2.0, "cy": 560.0 * k}


def eye_planes(a, meta):
    """Split the engraving for a rotating iris. Returns (static, disc, geo): `static` is the full alpha with the iris disc faded
    out (weight s(r) = smoothstep(r0, r1, r) about the iris centre), `disc` the square crop of the alpha faded the other way
    (the complement under "over" compositing, zero beyond r1), so static + disc = the original at angle 0 and the two meet with no seam at any angle
    (every layer is the same ink colour, so they add like one engraving). r1 stays clear of the catchlight, which never moves."""
    iris, sp = meta["iris"], meta["spin"]
    cx, cy, r0, r1 = float(iris["cx"]), float(iris["cy"]), float(sp["r0"]), float(sp["r1"])
    H, W = a.shape
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float64)
    wgt = smoothstep(r0, r1, np.hypot(xs - cx, ys - cy)).astype(np.float32)
    static = a * wgt
    # "over" compositing of two layers is 1 - (1-t)(1-d), not t + d: solving for d keeps t + d equal to the original at angle 0
    # (a plain 1 - s weight would leave a dim ring in the cross-fade). a is capped so d still reaches 0 at r1.
    ac = np.minimum(a, 0.97)
    disc_a = (ac * (1.0 - wgt) / (1.0 - ac * wgt)).astype(np.float32)
    half = int(math.ceil(r1)) + 4
    x0, y0 = int(round(cx)) - half, int(round(cy)) - half
    n = 2 * half + 1     # odd: the iris centre is a pixel, so it is the box's centre
    box = np.zeros((n, n), np.float32)
    sx0, sy0, sx1, sy1 = max(0, x0), max(0, y0), min(W, x0 + n), min(H, y0 + n)
    box[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = disc_a[sy0:sy1, sx0:sx1]
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float64)
    box[np.hypot(xx - (cx - x0), yy - (cy - y0)) > r1] = 0.0
    return static, box, {"half": half, "x0": x0, "y0": y0, "cx": cx, "cy": cy}


def eye_layout(shape, meta, ew):
    """Sizes of the baked images and where the iris disc sits, from the geometry alone (no drawing): the same numbers the baker
    and the Quickshell model use. -> dict(px0, py0, px1, py1, fw, fh, scale, ds, spin)."""
    x0, y0, x1, y1 = [int(round(v)) for v in meta["crop"]]
    px, py = int(round(EYE_PAD * (x1 - x0))), int(round(EYE_PAD * (y1 - y0)))
    H, W = shape
    px0, py0, px1, py1 = max(0, x0 - px), max(0, y0 - py), min(W, x1 + px), min(H, y1 + py)
    fw = int(round((x1 - x0 + 2 * px) * ew / (x1 - x0)))
    fh = int(round((y1 - y0 + 2 * py) * ew / (x1 - x0)))
    scale = fw / float(px1 - px0)
    iris, sp = meta["iris"], meta["spin"]
    ds = max(2, int(round((2 * (int(math.ceil(float(sp["r1"]))) + 4) + 1) * scale)))
    spin = {"cx": round((round(float(iris["cx"])) + 0.5 - px0) / (px1 - px0), 6), "cy": round((round(float(iris["cy"])) + 0.5 - py0) / (py1 - py0), 6),
            "size": round(ds / fw, 6), "period": EYE_SPIN_PERIOD}
    return {"px0": px0, "py0": py0, "px1": px1, "py1": py1, "fw": fw, "fh": fh, "scale": scale, "ds": ds, "spin": spin}


def eye_spin_geometry(folder, ew):
    """The spin block for the Quickshell model (pure: reads the asset, writes nothing); None when the art is unusable."""
    try:
        a, meta = eye_load(folder)
    except EyeArtError:
        return None
    return eye_layout(a.shape, meta, ew)["spin"]


def eye_frame_set(a, meta, ew, colours, target, tone="flat"):
    """The watcher's art in `target`, tinted with the theme (the lighter of ink/bone for the lines): `eye.png` (the whole eye,
    for hyprlock and as the still), and for the Quickshell lock `static.png` (the eye without its iris disc), `iris.png` (the
    disc, alpha only, ready to be turned about its centre) and `spin.json` (where the disc sits, as fractions of the image).
    tone = "sync": the iris and the lid rim carry the accent (eye_masks, eye_stroke_rgb); "flat": one ink colour, as before."""
    import json
    from pathlib import Path
    target = Path(target)
    target.mkdir(parents=True, exist_ok=True)
    L = eye_layout(a.shape, meta, ew)
    px0, py0, px1, py1, fw, fh, scale = L["px0"], L["py0"], L["px1"], L["py1"], L["fw"], L["fh"], L["scale"]
    ink, bone = rgb(colours["ink"]), rgb(colours["bone"])
    lum = lambda c: 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    lines = tuple(int(v) for v in (bone if lum(bone) >= lum(ink) else ink))
    sync = tone == "sync"
    masks = eye_masks(a, meta) if sync else None

    def resized(plane, size):
        return np.asarray(Image.fromarray(np.ascontiguousarray(plane, np.float32), "F").resize(size, Image.LANCZOS), np.float64)

    def save(plane, name, size, m_plane=None, a_plane=None, rims=None):
        al = Image.fromarray(np.clip(plane * 255 + 0.5, 0, 255).astype(np.uint8), "L").resize(size, Image.LANCZOS)
        rgba = np.empty((size[1], size[0], 4), np.uint8)
        if m_plane is None:
            rgba[..., :3] = lines
        else:
            m = np.clip(resized(m_plane, size), 0.0, 1.0)
            up, lo = (np.clip(resized(rims[0], size), 0.0, 1.0), np.clip(resized(rims[1], size), 0.0, 1.0)) if rims else (None, None)
            rgba[..., :3] = eye_stroke_rgb(colours, np.clip(resized(a_plane, size), 0.0, 1.0), m, up, lo)
        rgba[..., 3] = np.asarray(al)
        Image.fromarray(rgba, "RGBA").save(target / name, optimize=False, compress_level=6)

    static, disc, g = eye_planes(a, meta)
    ds = L["ds"]
    if sync:
        sl = (slice(py0, py1), slice(px0, px1))
        x0, y0, n = g["x0"], g["y0"], disc.shape[0]
        box = lambda arr: _crop_box(arr, x0, y0, n)
        rims = (masks["rim_up"][sl], masks["rim_lo"][sl])
        save(a[sl], "eye.png", (fw, fh), masks["iris"][sl], a[sl], rims)
        save(static[sl], "static.png", (fw, fh), masks["iris"][sl], a[sl], rims)
        save(disc, "iris.png", (ds, ds), box(masks["disc"]), box(a))
    else:
        save(a[py0:py1, px0:px1], "eye.png", (fw, fh))
        save(static[py0:py1, px0:px1], "static.png", (fw, fh))
        save(disc, "iris.png", (ds, ds))
    (target / "spin.json").write_text(json.dumps(L["spin"]))
    out = {"width": fw, "height": fh, "spin": L["spin"]}
    if sync:
        out["eyeAccent"] = eye_accent(colours)
        if masks["note"]:
            out["note"] = masks["note"]
    return out


def eye_asset_frames(folder, ew, colours, target, tone="flat"):
    """Load the user's eye and bake its still, its static part and its iris disc into `target`. Raises EyeArtError."""
    a, meta = eye_load(folder)
    return eye_frame_set(a, meta, ew, colours, target, tone)


# ---------------------------------------------------------------------------------------------------------------
# Theme sync (lock-theme-sync.md): a light duotone with a hint of the accent in the shadows (`tone_sync`), and the accent in
# the watcher's eye (masks below). OKLab maths, float64. `flat` returns the input untouched, so rollback is byte-identical.

TONE_GAMMA = 1.0          # the base tone stays the approved sRGB lerp of ink/bone; do not change
TONE_VERSION = 4
TONE_K_MAX = 0.008        # design said 0.030; 0.030, 0.018 and 0.011 all read as a purple veil on the real lock picture (sheets 2026-10-10)
_M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566],
                [0.0883024619, 0.2817188376, 0.6299787005]])
_M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099],
                [0.0259040371, 0.7827717662, -0.8086757660]])
_M2I = np.array([[1.0, 0.3963377774, 0.2158037573], [1.0, -0.1055613458, -0.0638541728], [1.0, -0.0894841775, -1.2914855480]])
_M1I = np.array([[4.0767416621, -3.3077115913, 0.2309699292], [-1.2684380046, 2.6097574011, -0.3413193965],
                 [-0.0041960863, -0.7034186147, 1.7076147010]])
_S2L = np.where((np.arange(256) / 255.0) <= 0.04045, (np.arange(256) / 255.0) / 12.92,
                (((np.arange(256) / 255.0) + 0.055) / 1.055) ** 2.4)
_LIN_X = np.linspace(0.0, 1.0, 32769)
_LIN_Y = np.where(_LIN_X <= 0.0031308, 12.92 * _LIN_X, 1.055 * np.power(_LIN_X, 1 / 2.4) - 0.055)
_EPS = 1e-4


def srgb_to_lin(u8):
    return _S2L[np.asarray(u8, np.uint8)]


def lin_to_srgb(lin):
    """linear (clipped to 0..1) -> sRGB 0..255 float."""
    return np.interp(np.clip(lin, 0.0, 1.0), _LIN_X, _LIN_Y) * 255.0


def oklab(lin):
    """linear sRGB [..., 3] -> OKLab [..., 3]."""
    return np.cbrt(lin @ _M1.T) @ _M2.T


def from_oklab(lab):
    """OKLab [..., 3] -> linear sRGB [..., 3] (not clipped)."""
    return ((lab @ _M2I.T) ** 3) @ _M1I.T


def hex_lin(h):
    return srgb_to_lin(rgb(h).astype(np.uint8))


def hex_lab(h):
    return oklab(hex_lin(h))


def lab_hex(lab):
    v = np.clip(np.rint(lin_to_srgb(from_oklab(np.asarray(lab, np.float64)))), 0, 255).astype(int)
    return "#%02x%02x%02x" % tuple(v)


def rel_y(h):
    lin = hex_lin(h)
    return float(0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2])


def contrast(h1, h2):
    a, b = rel_y(h1), rel_y(h2)
    return (max(a, b) + 0.05) / (min(a, b) + 0.05)


def chroma(lab):
    return float(math.hypot(lab[1], lab[2]))


def _in_gamut(lin):
    return np.all((lin >= -_EPS) & (lin <= 1 + _EPS), axis=-1)


def clip_toward(base, target):
    """OKLab arrays [N, 3]: move from `base` (in gamut) towards `target` as far as the sRGB gamut allows (one scale per pixel,
    the hue is kept; never a per-channel clip). Returns the clipped OKLab."""
    out = target.copy()
    bad = ~_in_gamut(from_oklab(target))
    if bad.any():
        b, t = base[bad], target[bad]
        lo, hi = np.zeros(len(b)), np.ones(len(b))
        for _ in range(9):
            mid = (lo + hi) / 2
            ok = _in_gamut(from_oklab(b + (t - b) * mid[:, None]))
            lo, hi = np.where(ok, mid, lo), np.where(ok, hi, mid)
        out[bad] = b + (t - b) * lo[:, None]
    return out


def tone_params(colours):
    """The numbers of lock-theme-sync §1.1: D, Lt, K (hint strength), the hint direction (dA, dB), n (neutrality), A, `light`."""
    light = rel_y(colours["ink"]) > rel_y(colours["bone"])
    D, Lt = (colours["bone"], colours["ink"]) if light else (colours["ink"], colours["bone"])
    lab_i, lab_b, lab_bl = hex_lab(colours["ink"]), hex_lab(colours["bone"]), hex_lab(colours["blood"])
    c_bl = chroma(lab_bl)
    n = 1.0 - float(smoothstep(0.025, 0.080, max(chroma(lab_i), chroma(lab_b))))
    A = 0.7 if light else 1.0
    K = min(TONE_K_MAX, 0.35 * c_bl) * n * A
    dA, dB = (lab_bl[1] / c_bl, lab_bl[2] / c_bl) if c_bl > 1e-9 else (0.0, 0.0)
    if c_bl < 0.03:
        K = 0.0
    lab_d = hex_lab(D)
    if chroma(lab_d) >= 0.02 and c_bl > 1e-9:
        dh = abs(math.atan2(lab_d[2], lab_d[1]) - math.atan2(lab_bl[2], lab_bl[1]))
        if min(dh, 2 * math.pi - dh) > math.pi / 2:
            K *= 0.5
    return {"D": D, "Lt": Lt, "K": K, "dA": dA, "dB": dB, "n": n, "A": A, "light": light, "c_blood": c_bl}


def hint_weight(u):
    return smoothstep(0.03, 0.12, u) * (1.0 - smoothstep(0.22, 0.50, u))


def tone_sync(arr, colours, mode="sync", K=None):
    """rgb uint8 [H, W, 3] -> uint8: the accent hint in the deep-to-mid shadows, OKLab lightness kept (§1.1). Works in bands.
    `flat` (or K = 0) returns the same object. `K` overrides the strength (the text-floor fallback halves it)."""
    if mode != "sync":
        return arr
    p = tone_params(colours)
    K = p["K"] if K is None else K
    if K <= 0:
        return arr
    D = rgb(p["D"])
    span = rgb(p["Lt"]) - D
    den = float(span @ span)
    if den <= 0:
        return arr
    out = arr.copy()
    for y0 in range(0, arr.shape[0], BAND):
        band = arr[y0:y0 + BAND, :, :3]
        u = np.clip(((band.astype(np.float64) - D) @ span) / den, 0.0, 1.0)
        wt = hint_weight(u)
        idx = wt > 1e-4
        if not idx.any():
            continue
        lab = oklab(srgb_to_lin(band[idx]))
        tgt = lab.copy()
        tgt[:, 1] += p["dA"] * K * wt[idx]
        tgt[:, 2] += p["dB"] * K * wt[idx]
        lab = clip_toward(lab, tgt)
        out[y0:y0 + BAND, :, :3][idx] = np.clip(np.rint(lin_to_srgb(from_oklab(lab))), 0, 255).astype(np.uint8)
    return out


def tone_image(im, colours, mode="sync", K=None):
    """tone_sync on a PIL image (RGB or RGBA, alpha untouched). `flat` returns the same image."""
    if mode != "sync" or im.mode not in ("RGB", "RGBA"):
        return im
    a = np.asarray(im)
    res = tone_sync(a[..., :3], colours, mode, K)
    if res is a[..., :3] or res.base is a:
        return im
    if a.shape[2] == 4:
        o = a.copy()
        o[..., :3] = res
        return Image.fromarray(o, "RGBA")
    return Image.fromarray(res, "RGB")


def eye_accent(colours):
    """E of §3.1: blood if it holds 3:1 against the pool D, else lit, else blood lifted (OKLab L +0.02 per step, hue kept)."""
    D = tone_params(colours)["D"]
    if contrast(colours["blood"], D) >= 3.0:
        return colours["blood"].lower()
    if contrast(colours["lit"], D) >= 3.0:
        return colours["lit"].lower()
    lab = hex_lab(colours["blood"])
    L, s = lab[0], 1.0
    for _ in range(20):
        L += 0.02
        s = 1.0
        while s > 0.01 and not _in_gamut(from_oklab(np.array([L, lab[1] * s, lab[2] * s]))):
            s *= 0.95
        if contrast(lab_hex([L, lab[1] * s, lab[2] * s]), D) >= 3.0:
            break
    return lab_hex([L, lab[1] * s, lab[2] * s])


def _crop_box(arr, x0, y0, n):
    """The n x n box of `arr` at (x0, y0), zero outside the array (the same box eye_planes cuts for the iris disc)."""
    H, W = arr.shape
    box = np.zeros((n, n), np.float32)
    sx0, sy0, sx1, sy1 = max(0, x0), max(0, y0), min(W, x0 + n), min(H, y0 + n)
    box[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = arr[sy0:sy1, sx0:sx1]
    return box


def _dilate(m, k):
    """Square k x k dilation of a bool array (what PIL's MaxFilter(k) does, in a separable numpy form, about 40x faster)."""
    r = k // 2
    for ax in (0, 1):
        p = np.pad(m, [(r, r) if i == ax else (0, 0) for i in (0, 1)])
        n = m.shape[ax]
        out = m.copy()
        for d in range(2 * r + 1):
            out |= p[d:d + n] if ax == 0 else p[:, d:d + n]
        m = out
    return m


def eye_masks(a, meta):
    """Where the accent goes in the eye (lock-theme-sync §3.2), at the SOURCE pixels of the asset (float32 [H, W], 0..1):
    `iris` (static plane: the iris disc, the catchlight kept neutral outside the spinning disc), `disc` (the iris plane: a
    pure radial disc, so it rotates with no seam), `rim_up` / `rim_lo` (the lid rim, from the sclera) and `sclera`.
    `note` is set when the rim could not be found (iris only). numpy + Pillow only."""
    from PIL import ImageDraw
    H, W = a.shape
    iris, sp = meta["iris"], meta["spin"]
    cx, cy, ri, r1 = float(iris["cx"]), float(iris["cy"]), float(iris["r"]), float(sp["r1"])
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float64)
    r = np.hypot(xs - cx, ys - cy)
    R = 1.0 - smoothstep(ri - 10, ri + 1, r)
    cl = meta["catchlight"]
    Kc = smoothstep(0.13 * ri, 0.19 * ri, np.hypot(xs - cl[0], ys - cl[1]))
    m_iris = R * (Kc + (1.0 - Kc) * (1.0 - smoothstep(r1 - 2, r1 + 6, r)))
    out = {"iris": m_iris.astype(np.float32), "disc": R.astype(np.float32), "rim_up": np.zeros((H, W), np.float32),
           "rim_lo": np.zeros((H, W), np.float32), "sclera": np.zeros((H, W), bool), "note": None}
    # lid rim: the sclera is the bright region outside the iris disc, flood-filled from both sides of the iris
    blur = np.asarray(Image.fromarray(np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(4)))
    binm = ((blur >= 107) & (r > ri + 3)).astype(np.uint8) * 255
    pic = Image.fromarray(binm, "L").copy()
    for sx, sy in ((cx - 1.03 * ri, cy + 0.15 * ri), (cx + 1.03 * ri, cy + 0.15 * ri)):
        sx, sy = int(round(sx)), int(round(sy))
        if not (0 <= sx < W and 0 <= sy < H):
            continue
        if pic.getpixel((sx, sy)) != 255:
            win = binm[max(0, sy - 10):sy + 11, max(0, sx - 10):sx + 11]
            yy, xx = np.nonzero(win == 255)
            if not len(yy):
                continue
            j = int(np.argmin((yy - 10) ** 2 + (xx - 10) ** 2))
            sx, sy = max(0, sx - 10) + int(xx[j]), max(0, sy - 10) + int(yy[j])
        ImageDraw.floodfill(pic, (sx, sy), 128)
    scl = (np.asarray(pic) == 128)
    c0 = meta["crop"]
    crop_area = max(1.0, (c0[2] - c0[0]) * (c0[3] - c0[1]))
    if not 0.06 <= scl.sum() / crop_area <= 0.25:
        out["note"] = "eye rim not found; iris accent only"
        return out
    closed = ~_dilate(~_dilate(scl, 9), 9)       # close: MaxFilter(9) then MinFilter(9) (erosion = dilation of the complement)
    img = Image.fromarray(closed.astype(np.uint8) * 255, "L").filter(ImageFilter.GaussianBlur(6))
    S = np.asarray(img) >= 128
    out["sclera"] = S
    band = S & _dilate(~S, 5)                     # the 2 px just inside
    dil, dout = S, np.full((H, W), 99.0)
    for i in range(1, 7):
        dil = _dilate(dil, 5)
        dout[dil & (dout == 99.0)] = 2.0 * i
    outside = (dout < 99.0) & ~S
    rim = band.astype(np.float64) + np.where(outside, 1.0 - smoothstep(6, 12, dout), 0.0)
    rim *= smoothstep(ri + 4, ri + 12, r)     # fade out next to the iris so the iris edge is not doubled
    lu, ll = meta["lidUpper"], meta["lidLower"]
    x_a, y_a, x_b, y_b = lu[0][0], lu[0][1], lu[2][0], lu[2][1]
    line_y = y_a + (xs - x_a) * (y_b - y_a) / (x_b - x_a)
    upper = ys < line_y
    out["rim_up"] = np.where(upper, rim, 0.0).astype(np.float32)
    out["rim_lo"] = np.where(upper, 0.0, rim).astype(np.float32)
    return out


def eye_stroke_rgb(colours, alpha, m_iris, m_up=None, m_lo=None):
    """Per-pixel colour of the eye strokes at the TARGET size (§3.3): the lighter of ink/bone with a faint hint of the accent in
    the thin shading, mixed towards the eye accent E by the accent weight. alpha: stroke alpha 0..1, m_iris: iris weight,
    m_up / m_lo: lid-rim weights (upper stays stronger). All float [h, w]. -> uint8 [h, w, 3]."""
    p = tone_params(colours)
    lab_l = hex_lab(p["Lt"])
    Ke = min(0.060, 0.5 * p["c_blood"]) * p["n"] * p["A"] if p["c_blood"] >= 0.03 else 0.0
    h, w = alpha.shape
    m = 0.85 * m_iris
    if m_up is not None:
        m = np.maximum(m, 0.75 * m_up)
    if m_lo is not None:
        m = np.maximum(m, 0.55 * m_lo)
    base = np.broadcast_to(lab_l, (h * w, 3)).copy()
    cs = base.copy()
    if Ke > 0:
        f = Ke * (1.0 - smoothstep(0.30, 0.75, alpha)).reshape(-1)
        cs[:, 1] += p["dA"] * f
        cs[:, 2] += p["dB"] * f
        cs = clip_toward(base, cs)
    mm = m.reshape(-1)
    res = np.empty((h * w, 3), np.uint8)
    on = mm > 1e-3
    lab_e = hex_lab(eye_accent(colours))
    final = cs.copy()
    final[on] = clip_toward(cs[on], cs[on] + (lab_e - cs[on]) * mm[on, None])
    res[:] = np.clip(np.rint(lin_to_srgb(from_oklab(final))), 0, 255).astype(np.uint8)
    return res.reshape(h, w, 3)

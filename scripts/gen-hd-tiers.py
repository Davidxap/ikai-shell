#!/usr/bin/env python3
"""Exact-pixel tiers for every SHIPPED mark and workspace family (master-plan-v4 S2d-1; ported from lab/v8 hd.py + ws_geom.py).

Every tier is drawn at its own size from the family's BEST source and an enhancement route that keeps the original character:
  vector   -> the SVG of scripts/gen-marks.py (geometry read, gen-art.py never run) at 8x the tier, area (BOX) filter, FLOOR.
  engrave  -> the engrave / gen-premium canvas (before its fixed-size finish()) premultiplied BOX to the tier, FLOOR (+ SNAP < 48).
  raster   -> the shipped 512 picture, area filter + smoothstep + FLOOR.
  trace    -> hand-drawn rasters < 512 px (sheet cuts): bicubic x8, smoothed iso-contour, BOX; re-framed to a shared optical box.
  geometry -> ws_geom (seals, rings, marks) redrawn on whole pixels below 48 px.
FLOOR: a stroke whose peak coverage is < 0.8 is scaled to 0.85 (a 0.5 px line becomes a 1 px line, not a grey smear), line art only.
SNAP: alpha smoothstep 0.22-0.62 below 48 px (a stroke is a run of solid px with a 1 px antialiased edge). KNOCKOUT: the drawing's INK
(#08090a) fills become clear, so no tile ever has an opaque black ground. Nothing here replaces a default asset: the 256 / 512 originals stay
(the widget uses them when the flag `wsBarArt` is off); tiers go under `system/bar/<px>/` and `workspaces/bar/<px>/`.

  python3 scripts/gen-hd-tiers.py [--marks] [--ws] [--user-remina] [--only NAME[,NAME]] [--sizes 24,26] [--out DIR] [--check]
  --check prints what would be written. Honest limits per family are in HONEST below (and printed by the gate).
"""
import argparse, importlib.util, math, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, "..", "bar", "modules", "ito-art") + os.sep
TIERS = (24, 26, 28, 30, 32, 36, 40, 44, 48, 56, 60, 64, 72, 80, 88, 96, 112, 120, 128)
STATES = ("empty", "occupied", "active", "urgent")
BONE = (0xc7, 0xcc, 0xd1); BONE_DIM = (0x8e, 0x95, 0x9c); BLOOD = (0xc4, 0x16, 0x2a)
TAU = math.tau
FRAME = 0.93
sys.path.insert(0, HERE)


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m


# ---- raster primitives --------------------------------------------------------------------------------------------------
SS = 16


class Layer:
    def __init__(s, px):
        s.px = px; s.m = Image.new("L", (px * SS, px * SS), 0); s.d = ImageDraw.Draw(s.m)

    def poly(s, p): s.d.polygon([(x * SS, y * SS) for x, y in p], fill=255)

    def disc(s, x, y, r): s.d.ellipse(((x - r) * SS, (y - r) * SS, (x + r) * SS, (y + r) * SS), fill=255)

    def cov(s): return np.asarray(s.m.resize((s.px, s.px), Image.BOX), np.float32) / 255


def annulus(L, c, rin, rout, a0=0.0, a1=TAU, n=None):
    n = n or max(16, int((a1 - a0) / TAU * 720))
    o = [(c + math.cos(a0 + (a1 - a0) * i / n) * rout, c + math.sin(a0 + (a1 - a0) * i / n) * rout) for i in range(n + 1)]
    i_ = [(c + math.cos(a0 + (a1 - a0) * i / n) * rin, c + math.sin(a0 + (a1 - a0) * i / n) * rin) for i in range(n + 1)]
    L.poly(o + i_[::-1])


def comp(items, px):
    """premultiplied 'over' of (coverage, rgb, opacity) in paint order -> RGBA image."""
    acc = np.zeros((px, px, 4), np.float32)
    for cov, rgb, op in items:
        a = cov * op; col = np.array(rgb, np.float32) / 255
        acc[..., :3] = col * a[..., None] + acc[..., :3] * (1 - a[..., None])
        acc[..., 3] = a + acc[..., 3] * (1 - a)
    rgb = np.where(acc[..., 3:4] > 1e-4, acc[..., :3] / np.maximum(acc[..., 3:4], 1e-4), 0)
    return Image.fromarray((np.clip(np.dstack([rgb, acc[..., 3]]), 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")


def premul_box(im, px):
    return im.convert("RGBa").resize((px, px), Image.BOX).convert("RGBA")


def floor(im, peak_min=0.8, to=0.85):
    a = np.asarray(im, np.float32)[..., 3] / 255
    pk = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)), np.float32) / 255
    k = np.where((pk > 0.10) & (pk < peak_min), to / np.maximum(pk, 1e-3), 1.0)
    rgb = np.asarray(im, np.float32)[..., :3] / 255
    dark = (rgb.mean(-1) < 0.20) & ((rgb[..., 0] - rgb[..., 1]) < 0.12)       # the drawing's ink edges (half knocked out) are never lifted back to opaque black
    k = np.where(dark, 1.0, k)
    out = np.asarray(im).copy(); out[..., 3] = np.clip(a * k * 255 + 0.5, 0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def knockout(im):
    a = np.asarray(im, np.float32) / 255; rgb = a[..., :3]
    lum = rgb.mean(-1); red = np.clip((rgb[..., 0] - rgb[..., 1]) / 0.35, 0, 1)
    k = np.maximum(np.clip((lum - 0.06) / 0.22, 0, 1), red)
    out = (a * 255).astype(np.uint8); out[..., 3] = np.clip(a[..., 3] * k * 255 + 0.5, 0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def snap(im, px, lo=0.22, hi=0.62):
    if px >= 48: return im
    a = np.asarray(im, np.float32)[..., 3] / 255; t = np.clip((a - lo) / (hi - lo), 0, 1)
    out = np.asarray(im).copy(); out[..., 3] = (t * t * (3 - 2 * t) * 255 + 0.5).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def snap48(im, lo=0.10, hi=0.80):
    a = np.asarray(im, np.float32)[..., 3] / 255; t = np.clip((a - lo) / (hi - lo), 0, 1)
    out = np.asarray(im).copy(); out[..., 3] = (t * t * (3 - 2 * t) * 255 + 0.5).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def vector(svg, px):
    with tempfile.TemporaryDirectory() as td:
        s = os.path.join(td, "m.svg"); p = os.path.join(td, "m.png"); open(s, "w").write(svg)
        subprocess.run(["rsvg-convert", "-w", str(px * 8), "-h", str(px * 8), s, "-o", p], check=True)
        return floor(knockout(premul_box(Image.open(p), px)))


def reframe(im, fill=0.93):
    a = np.asarray(im.convert("RGBA"))[..., 3]; ys, xs = np.where(a > 8)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    side = int(math.ceil(max(x1 - x0, y1 - y0) / fill)); cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    box = (int(round(cx - side / 2)), int(round(cy - side / 2))); box = box + (box[0] + side, box[1] + side)
    return im.crop(box)


def gblur(m, sig):
    r = max(1, int(3 * sig)); x = np.arange(-r, r + 1); k = np.exp(-x * x / (2 * sig * sig)); k /= k.sum()
    m = np.apply_along_axis(lambda v: np.convolve(np.pad(v, r, mode="edge"), k, "valid"), 0, m)
    return np.apply_along_axis(lambda v: np.convolve(np.pad(v, r, mode="edge"), k, "valid"), 1, m)


def trace(src, px, fill=0.93, line=True, sig_src=None):
    """iso-contour of a hand-drawn raster at the tier (see the module doc); the hatching is merged below 48 px (sigma 0.9 source px)."""
    im = reframe(src.convert("RGBA"), fill); s = im.width; K = px * 8
    sig_src = sig_src if sig_src is not None else (0.9 if px < 48 else 0.35)
    pm = np.asarray(im.convert("RGBa"), np.float32) / 255
    up = np.stack([np.asarray(Image.fromarray(pm[..., c], "F").resize((K, K), Image.BICUBIC)) for c in range(4)], -1)
    a = gblur(np.clip(up[..., 3], 0, 1), sig_src * K / s)
    t = np.clip((a - 0.40) / 0.20, 0, 1); a2 = t * t * (3 - 2 * t)
    rgb = np.clip(up[..., :3] / np.maximum(up[..., 3:4], 1e-3), 0, 1)
    big = np.dstack([rgb * a2[..., None], a2[..., None]])
    out = np.stack([np.asarray(Image.fromarray(big[..., c].astype(np.float32), "F").resize((px, px), Image.BOX)) for c in range(4)], -1)
    al = np.clip(out[..., 3:4], 0, 1); col = np.where(al > 1e-4, out[..., :3] / np.maximum(al, 1e-4), 0)
    img = knockout(Image.fromarray((np.clip(np.dstack([col, al]), 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA"))
    return (floor(img) if px >= 48 else snap(img, px)) if line else img


# ---- micro tier of the sheet-cut ws families (ws_geom): seals, rings, marks, rebuilt from their measured geometry -----------
FONT = "/usr/share/fonts/noto/NotoSerif-Bold.ttf"


def arcs(L, c, r, w, n, gap_deg, phase=0.0):
    per = TAU / n; g = math.radians(gap_deg)
    for i in range(n):
        a0 = phase + i * per + g / 2; annulus(L, c, r - w / 2, r + w / 2, a0, a0 + per - g, n=64)


def ring(L, c, r, w):
    w = max(1, round(w)); ro = round(r + w / 2); annulus(L, c, ro - w, ro)


def digit_cov(n, px, h):
    S8 = 8; m = Image.new("L", (px * S8, px * S8), 0); d = ImageDraw.Draw(m)
    f = ImageFont.truetype(FONT, int(h * S8 * 1.36)); t = str(n)
    bb = d.textbbox((0, 0), t, font=f); w, hh = bb[2] - bb[0], bb[3] - bb[1]
    x = round((px - w / S8) / 2) * S8 - bb[0]; y = round((px - hh / S8) / 2) * S8 - bb[1]
    d.text((x, y), t, font=f, fill=255)
    return np.asarray(m.resize((px, px), Image.BOX), np.float32) / 255


def g_seal(n, st, px):
    c = px / 2; R = px / 2 * FRAME; w = max(1.3, 0.05 * px)
    L = Layer(px); arcs(L, c, 0.76 * R, w, 6, 26, 0.3)
    col = BLOOD if st in ("active", "urgent") else BONE
    op = 0.6 if st == "empty" else 1.0
    items = [(L.cov(), col, op)]
    if st == "urgent":
        L2 = Layer(px); arcs(L2, c, 0.76 * R - w - 1.0, max(1.0, w * 0.8), 5, 40, 0.9); items.append((L2.cov(), BLOOD, 0.9))
    items.append((digit_cov(n, px, round(0.66 * R)), col, op))
    return comp(items, px)


def g_orb(st, px):
    c = px / 2; R = px / 2 * FRAME
    tw = max(2.0, 0.18 * R); ow = max(1.2, 0.04 * px)
    T = Layer(px); ring(T, c, 0.49 * R, tw)
    O = Layer(px); arcs(O, c, 0.88 * R, ow, 5, 30, 0.2)
    if st in ("empty", "occupied"):
        op = 0.6 if st == "empty" else 1.0; col = BONE_DIM if st == "empty" else BONE
        return comp([(O.cov(), col, op), (T.cov(), col, op)], px)
    D = Layer(px); D.disc(c, c, max(1.0, 0.07 * R))
    if st == "active":
        return comp([(O.cov(), BLOOD, 1), (T.cov(), BLOOD, 1), (D.cov(), BONE, 1)], px)
    U = Layer(px); ring(U, c, 0.44 * R, 0.30 * R)
    return comp([(O.cov(), BLOOD, 1), (U.cov(), BLOOD, 1)], px)


def g_dot(st, px):
    c = px / 2; R = px / 2 * FRAME; w = max(1.3, 0.05 * px)
    if st == "empty":
        L = Layer(px); ring(L, c, 0.80 * R, w); return comp([(L.cov(), BONE_DIM, 0.8)], px)
    O = Layer(px); ring(O, c, 0.74 * R, max(1.1, 0.04 * px))
    if st == "occupied":
        D = Layer(px); D.disc(c, c, 0.46 * R); return comp([(O.cov(), BONE_DIM, 0.6), (D.cov(), BONE, 1)], px)
    if st == "active":
        A = Layer(px); ring(A, c, 0.32 * R, 0.28 * R); return comp([(O.cov(), BLOOD, 1), (A.cov(), BLOOD, 1)], px)
    D = Layer(px); D.disc(c, c, 0.46 * R); H = Layer(px); H.disc(c - 0.15 * R, c - 0.15 * R, max(0.8, 0.08 * R))
    return comp([(O.cov(), BLOOD, 1), (D.cov(), BLOOD, 1), (H.cov(), BONE, 0.9)], px)


# ---- sources ---------------------------------------------------------------------------------------------------------------
_MODS = {}


def mod(name, path):
    if name not in _MODS:
        _MODS[name] = _load(name, os.path.join(HERE, path))
    return _MODS[name]


def GM(): return mod("gen_marks", "gen-marks.py")


_CACHE = {}


def cached(key, fn):
    if key not in _CACHE: _CACHE[key] = fn()
    return _CACHE[key]


def tr(path, px, line=True, sig=None):
    return cached((path, px, line, sig), lambda: trace(Image.open(ART + path), px, line=line, sig_src=sig))


def tr_soft(path, px):
    """Tomie eyes / lips: no snap below 48 (snapping turns the lashes and teeth into pixel noise); tonal class, crisp is report-only."""
    if px >= 48: return tr(path, px)
    return cached((path, px, "soft"), lambda: knockout(trace(Image.open(ART + path), px, line=False, sig_src=0.6)))


def metatron_full(px):
    f = floor(premul_box(Image.open(ART + "system/menu-metatron-full.png"), px))
    return snap(f, px, 0.18, 0.70) if px < 48 else snap48(f)


def metatron_plain(px):
    gp = mod("gen_premium", "gen-premium.py")
    big = cached("metatron_mini", lambda: (setattr(gp, "finish", lambda img, size=160: img), gp.metatron_mini())[1])
    return floor(premul_box(big, px))


def engrave_fit(img, px):
    from iconfit import fit as icon_fit
    return snap(floor(premul_box(icon_fit(img), px)), px)


def ws_halo(n, st, px):
    m = mod("gen_halo_ws", "gen-halo-workspace.py")
    return engrave_fit(cached(("halo", n, st), lambda: m.halo(st, n)), px)


def ws_flauros(n, st, px):
    m = mod("gen_flauros_ws", "gen-flauros-workspace.py")
    return engrave_fit(cached(("flauros", n, st), lambda: m.flauros(st, n)), px)


ORBS = {"empty": "workspaces/workspace-1.png", "occupied": "workspaces/workspace-1.png", "active": "workspaces/workspace-2.png", "urgent": "workspaces/workspace-urgent.png"}
DOTS = {"empty": "workspace-indicators/indicator-empty.png", "occupied": "workspace-indicators/indicator-inactive.png",
        "active": "workspace-indicators/indicator-urgent.png", "urgent": "workspace-indicators/indicator-active.png"}
# the widget alternates two eyes by slot parity on empty / occupied (odd n = the open eye, even n = the closed one); active and urgent have one eye each
EYES = {1: {"empty": "eye-normal", "occupied": "eye-normal", "active": "eye-red", "urgent": "eye-bleeding"},
        2: {"empty": "eye-closed", "occupied": "eye-closed", "active": "eye-red", "urgent": "eye-bleeding"}}

# key: (art file in system/bar/<px>/, label, route, class, fn(px))
MARKS = {
    "amigara":       ("menu-amigara.png", "Amigara", "vector", "line", lambda p: vector(GM().amigara(), p)),
    "metatron":      ("menu-metatron-full.png", "Metatron", "raster512", "line", metatron_full),
    "metatron-mini": ("menu-metatron.png", "Metatron, plain", "engrave", "line", metatron_plain),
    "halo":          ("menu-halo.png", "Halo", "vector", "line", lambda p: vector(GM().halo(), p)),
    "flauros":       ("menu-flauros.png", "Flauros", "vector", "line", lambda p: vector(GM().flauros(), p)),
    "remina-ink":    ("menu-remina.png", "Remina Ink", "vector", "line", lambda p: vector(GM().remina(), p)),
}
# key: (family file token, label, route, class, ns, fn(n, st, px))
WS = {
    "numerals": ("numerals", "Seals", "geometry+trace", "line", range(1, 11),
                 lambda n, st, p: g_seal(n, st, p) if p < 48 else tr(f"workspace-labels/ws-{n}{'-red' if st in ('active', 'urgent') else ''}.png", p)),
    "orbs":     ("orbs", "Rings", "geometry+trace", "line", range(1, 11), lambda n, st, p: g_orb(st, p) if p < 48 else tr(ORBS[st], p)),
    "eyes":     ("eyes", "Tomie eyes", "trace-soft", "tonal", range(1, 11), lambda n, st, p: tr_soft(f"status-eyes/{EYES[(n - 1) % 2 + 1][st]}.png", p)),
    "dots":     ("dots", "Marks", "geometry+trace", "line", range(1, 11), lambda n, st, p: g_dot(st, p) if p < 48 else tr(DOTS[st], p)),
    "remina":   ("remina", "Remina", "vector", "line", range(1, 11), lambda n, st, p: vector(GM().remina_state(n, st), p)),
    "halo":     ("halo", "Halo", "engrave", "line", range(1, 11), ws_halo),
    "flauros":  ("flauros", "Flauros", "engrave", "line", range(1, 11), ws_flauros),
}
HONEST = {
    "amigara": "vector from the original SVG; PASS", "metatron": "512 raster, no vector source: the runes are a ring of ticks below 48 px",
    "metatron-mini": "engrave canvas of the 160 px original (the 160 file stays); PASS", "halo": "vector; PASS", "flauros": "vector; PASS",
    "remina-ink": "vector + knockout; PASS (replaces the sparse 6-tier set by all tiers)",
    "numerals": "micro = measured geometry (6-arc ring + digit); the scratchy double ring is lost below 48 px",
    "orbs": "micro = measured geometry; the scratchy rings are lost below 48 px", "dots": "micro = measured geometry",
    "eyes": "sheet cuts of 237 px: lashes and teeth are sub-pixel at <= 32 px (tonal class, crisp report-only); use >= 40 px or another family",
    "remina": "vector from gen-marks remina_state; PASS", "halo-ws": "engrave canvas; PASS", "flauros-ws": "engrave canvas; PASS",
}


def save(im, path, check):
    if check: return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, optimize=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--marks", action="store_true"); ap.add_argument("--ws", action="store_true"); ap.add_argument("--user-remina", action="store_true")
    ap.add_argument("--spiral", action="store_true", help="the Sheet spiral tiers (system-normal.png + the clean rebuild) from the shipped 282 px drawing, via bin/ito-assets' own recipe functions")
    ap.add_argument("--only", default=""); ap.add_argument("--sizes", default=""); ap.add_argument("--out", default=ART)
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    if not (a.marks or a.ws or a.user_remina or a.spiral): a.marks = a.ws = a.spiral = True
    only = [s for s in a.only.split(",") if s]; sizes = [int(s) for s in a.sizes.split(",") if s] or list(TIERS)
    out = a.out if a.out.endswith(os.sep) else a.out + os.sep
    n = 0
    if a.marks:
        for key, (art, lab, route, cls, fn) in MARKS.items():
            if only and key not in only: continue
            for px in sizes:
                save(fn(px), f"{out}system/bar/{px}/{art}", a.check); n += 1
            print(f"mark {key:14s} {route:10s} {len(sizes)} tiers", flush=True)
    if a.ws:
        for key, (tok, lab, route, cls, ns, fn) in WS.items():
            if only and key not in only: continue
            for px in sizes:
                for nn in ns:
                    for st in STATES:
                        save(fn(nn, st, px), f"{out}workspaces/bar/{px}/ws-{tok}-{nn}-{st}.png", a.check); n += 1
            print(f"ws   {key:14s} {route:14s} {len(sizes)} tiers", flush=True)
    if a.spiral:
        import importlib.machinery
        ldr = importlib.machinery.SourceFileLoader("ito_assets", os.path.join(HERE, "..", "bar", "modules", "bin", "ito-assets"))
        sp = importlib.util.spec_from_loader("ito_assets", ldr); ia = importlib.util.module_from_spec(sp); ldr.exec_module(ia)
        src = Image.open(ART + "system/system-normal.png").convert("RGBA")
        g = ia._d_spiral_fit(src)
        for px in sizes:
            save(ia._d_spiral_hand(src, px), f"{out}system/bar/{px}/system-normal.png", a.check)
            save(ia._d_spiral(g, px), f"{out}system/bar/{px}/system-normal-clean.png", a.check); n += 2
        print(f"mark spiral         hand+clean {len(sizes)} tiers", flush=True)
    if a.user_remina:
        # the user's Remina picture (marks/remina.png of the assets folder, never in the repo): area filter + the tone as ink LEVEL (v8 route)
        root = os.path.expanduser("~/.config/ito/assets/marks")
        src = Image.open(f"{root}/remina.png").convert("RGBA")
        for px in sizes:
            im = remina_user(src, px)
            for nm in ("remina.png", "remina.light.png"):
                save(im, f"{root}/bar/{px}/{nm}", a.check); n += 1
        print(f"user remina {len(sizes)} tiers", flush=True)
    print(f"{'would write' if a.check else 'wrote'} {n} files")


def remina_user(src, px):
    im = premul_box(src, px)
    a = np.asarray(im, np.float32) / 255
    disc = np.clip((a[..., 3] - 0.12) / 0.25, 0, 1)
    yy, xx = np.mgrid[0:px, 0:px]; R = px / 2 - 0.5; d = np.hypot(xx - (px - 1) / 2, yy - (px - 1) / 2)
    disc = disc * np.clip(R + 0.5 - d, 0, 1)
    lvl = np.clip(a[..., 3] / 0.9, 0.35, 1)
    out = np.dstack([a[..., :3] * lvl[..., None], disc[..., None]])
    return Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")


if __name__ == "__main__":
    main()

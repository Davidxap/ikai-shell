#!/usr/bin/env python3
"""S-D gate (boot-lock-v2 §7.1): ito_ink L1 / L2 / L3 on fixtures. Writes a contact sheet to ~/.cache/ito/lab/ink/."""
import shutil, sys, tempfile, time
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "bar" / "modules" / "bin"))
import ito_ink as ink

PALS = {
    "dark": {"ink": "#0e0e11", "bone": "#d6d3cb", "blood": "#8a1c1c"},
    "light": {"ink": "#1d2021", "bone": "#ebdbb2", "blood": "#cc241d"},
    "cool": {"ink": "#101820", "bone": "#c9d4dc", "blood": "#7a2a3a"},
    "paper": {"ink": "#2b2b2b", "bone": "#f2efe6", "blood": "#a02020"},
}
OUT = Path.home() / ".cache" / "ito" / "lab" / "ink"; OUT.mkdir(parents=True, exist_ok=True)
fails = []
def check(name, ok, detail=""):
    print(("ok   " if ok else "FAIL ") + name + (" " + str(detail) if detail else ""))
    if not ok: fails.append(name)

W, H = 2560, 1440
grad = Image.fromarray(np.tile(np.linspace(0, 255, W, dtype=np.uint8), (H, 1)), "L").convert("RGB")
gp = OUT / "gradient.png"; grad.save(gp)
pic = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / ".config/ito/marks/_lockbg.png"
for name, c in PALS.items():
    t0 = time.time(); im = ink.engraved_picture(gp, W, H, c); dt = time.time() - t0
    check(f"L1 gradient {name} size", im.size == (W, H))
    check(f"L1 gradient {name} budget <= 2.5 s", dt <= 2.5, f"{dt:.2f}s")
    a = np.asarray(im, np.float64).reshape(-1, 3)
    i0, b0 = ink.rgb(c["ink"]), ink.rgb(c["bone"]); d = b0 - i0
    tt = ((a - i0) @ d) / (d @ d)
    res = np.abs((a - i0) - tt[:, None] * d).max()
    check(f"L1 {name} every pixel on the ink-paper line (tol 2)", res <= 2.0, f"max {res:.2f}")
    # tonal steps: the fraction of ink-marked pixels per column band must rise in at least 5 distinct steps
    ink_frac = (tt < 0.2).reshape(H, W).mean(axis=0)
    bands = [ink_frac[i * (W // 8):(i + 1) * (W // 8)].mean() for i in range(8)]
    steps = len({round(b, 2) for b in bands})
    check(f"L1 {name} >= 5 distinct tonal steps", steps >= 5, [round(b, 2) for b in bands])
    if pic.is_file():
        t0 = time.time(); ph = ink.engraved_picture(pic, W, H, c); ph.save(OUT / f"l1-{name}.png")
        check(f"L1 picture {name} budget <= 2.5 s", time.time() - t0 <= 2.5, f"{time.time() - t0:.2f}s")
    v = ink.vignette(W, H, c); v.save(OUT / f"l2-{name}.png")
    av = np.asarray(v.split()[-1], np.float64) / 255
    check(f"L2 {name} centre clear, corners solid", av[H // 2 - 50:H // 2 + 50, W // 2 - 50:W // 2 + 50].max() < 0.01 and av[:6, :6].mean() > 0.85,
          f"centre {av[H//2,W//2]:.2f} corner {av[:6,:6].mean():.2f}")
    check(f"L2 {name} colour is ink", np.asarray(v)[0, 0, :3].tolist() == [int(x) for x in ink.rgb(c['ink'])])
    r = ink.ring(96, 1.0, c); r.save(OUT / f"l3-{name}.png")
    ar = np.asarray(r.split()[-1], np.float64) / 255
    S = r.width; cy = cx = S / 2
    def thick(deg):
        th = np.radians(deg); n = 0.0
        for rr in np.arange(S * 0.2, S / 2):
            x, y = int(cx + rr * np.cos(th)), int(cy + rr * np.sin(th))
            if 0 <= x < S and 0 <= y < S: n += ar[y, x]
        return n
    lr, ul = thick(45), thick(225)
    check(f"L3 {name} heavier on the lower right than the upper left", lr > 1.5 * ul, f"{lr:.1f} vs {ul:.1f}")
    check(f"L3 {name} gap at 200 deg", thick(200) < 0.5)
    check(f"L3 {name} size 96+16", r.size == (112, 112))
# watcher (L7): 12 frames at 1100 px, contrast of its ink on its paper and of its paper on L1's paper, blood share
def lum(rgb_):
    f = lambda v: (v / 255 / 12.92) if v / 255 <= 0.03928 else (((v / 255) + 0.055) / 1.055) ** 2.4
    r, g, b = rgb_
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)
for name, c in PALS.items():
    ink_, bone_, blood_ = ink.rgb(c["ink"]), ink.rgb(c["bone"]), ink.rgb(c["blood"])
    eye_paper = ink_ * 0.2 + bone_ * 0.8
    l1_paper = ink_ * 0.58 + bone_ * 0.42
    check(f"watcher {name}: ink on eye paper contrast >= 4.5", ratio(ink_, eye_paper) >= 4.5, f"{ratio(ink_, eye_paper):.1f}")
    check(f"watcher {name}: eye paper on L1 paper contrast >= 1.3", ratio(eye_paper, l1_paper) >= 1.3, f"{ratio(eye_paper, l1_paper):.2f}")
    t0 = time.time(); fr = ink.watcher_frame(1100, c); dt = time.time() - t0
    a = np.asarray(fr, float); opaque = a[..., 3] > 128
    near_blood = (np.abs(a[..., :3] - blood_).sum(axis=2) < 90) & opaque
    check(f"watcher {name}: blood <= 12 % of the drawn pixels", near_blood.sum() / max(1, opaque.sum()) <= 0.12, f"{near_blood.sum() / opaque.sum():.3f}")
    check(f"watcher {name}: a frame in <= 1.2 s", dt <= 1.2, f"{dt:.2f}s")
check("watcher: no frame animation left (no blink, no gaze frames)", not any(hasattr(ink, n) for n in ("WATCHER_FRAMES", "watcher_gaze", "EYE_FRAMES", "EYE_BLINK", "eye_blink", "eye_twist")))
with tempfile.TemporaryDirectory() as td:     # the drawn eye is ONE still
    geo = ink.watcher_frames(600, 0.5, PALS["dark"], Path(td) / "w")
    check("watcher drawn: a single eye.png, nothing else", sorted(p.name for p in (Path(td) / "w").iterdir()) == ["eye.png"])
# contact sheet
tiles = [Image.open(OUT / f"l1-{n}.png").resize((640, 360)) for n in PALS if (OUT / f"l1-{n}.png").is_file()]
tiles += [Image.open(OUT / f"l2-{n}.png").resize((640, 360)) for n in PALS]
sheet = Image.new("RGB", (640 * 4, 360 * (len(tiles) // 4 + 1)), (40, 40, 40))
# A2: the engraved eye. Synthetic fixtures always; the user's own asset too when it is there (never copied anywhere).
import tempfile
def eye_fixture(d, w=1672, h=941, kind="ok"):
    d = Path(d); d.mkdir(parents=True, exist_ok=True)
    f = d / "spiral-eye-ink-for-dark-themes.png"
    if kind == "ok":
        a = np.zeros((h, w, 4), np.uint8); a[..., :3] = 255
        yy, xx = np.mgrid[0:h, 0:w]
        a[..., 3] = (((xx - w / 2) / 590.0) ** 2 + ((yy - h / 2) / 320.0) ** 2 < 1).astype(np.uint8) * 200
        Image.fromarray(a, "RGBA").save(f)
    elif kind == "truncated":
        Image.new("RGBA", (w, h), (255, 255, 255, 255)).save(f); f.write_bytes(f.read_bytes()[:400])
    elif kind == "zero":
        f.write_bytes(b"")
    elif kind == "jpeg":
        Image.new("RGB", (w, h), (255, 255, 255)).save(f, format="JPEG")
    elif kind == "huge":
        Image.new("RGBA", (9000, 100), (255, 255, 255, 255)).save(f)
    elif kind == "blank":
        Image.new("RGBA", (w, h), (0, 0, 0, 0)).save(f)
    return d
with tempfile.TemporaryDirectory() as td:
    for kind in ("truncated", "zero", "jpeg", "huge", "blank"):
        try:
            ink.eye_load(eye_fixture(Path(td) / kind, kind=kind)); check(f"eye {kind}: refused", False)
        except ink.EyeArtError as e:
            check(f"eye {kind}: refused with a reason", True, str(e))
    try:
        ink.eye_load(Path(td) / "missing"); check("eye missing: refused", False)
    except ink.EyeArtError:
        check("eye missing: refused", True)
    d = eye_fixture(Path(td) / "ok")
    g = ink.eye_geometry(2560, 1440)
    check("eye geometry 1440p: ew 900, frame 936 x 513", g["ew"] == 900 and (g["fw"], g["fh"]) == (936, 513), (g["ew"], g["fw"], g["fh"]))
    check("eye geometry never upscales > 1.15 x", ink.eye_geometry(7680, 4320)["ew"] <= 1375)
user = Path.home() / ".config" / "ito" / "assets" / "eye"
if (user / "spiral-eye-ink-for-dark-themes.png").is_file():
    for name in ("dark", "paper"):
        c = PALS[name]; out = OUT / f"eye-{name}"; shutil.rmtree(out, ignore_errors=True)
        t0 = time.time(); geo = ink.eye_asset_frames(user, g["ew"], c, out); dt = time.time() - t0
        names = sorted(p.name for p in out.iterdir())
        check(f"eye {name}: one still + the iris disc, no frames", names == ["eye.png", "iris.png", "spin.json", "static.png"], names)
        check(f"eye {name}: bake <= 6 s", dt <= 6.0, f"{dt:.1f}s")
        eye = Image.open(out / "eye.png").convert("RGBA"); st = Image.open(out / "static.png").convert("RGBA"); ir = Image.open(out / "iris.png").convert("RGBA")
        import json
        sp = json.loads((out / "spin.json").read_text())
        check(f"eye {name}: still and static part are one size", eye.size == st.size == (936, 513), (eye.size, st.size))
        lum_ = lambda h: float(ink.rgb(h) @ [0.2126, 0.7152, 0.0722])
        want = c["bone"] if lum_(c["bone"]) >= lum_(c["ink"]) else c["ink"]
        for fn, im in (("eye", eye), ("static", st), ("iris", ir)):
            a_ = np.asarray(im, np.float64); px = a_[a_[..., 3] > 250][:, :3].mean(0)
            check(f"eye {name}: {fn} lines are the lighter token, tokens only", np.abs(px - ink.rgb(want)).max() < 1.5, px.round().tolist())
        # static + the disc at angle 0 reproduces the still (cross-fade under "over" compositing), at any angle nothing outside the disc moves
        def comp(ang):
            bg = Image.new("RGBA", eye.size, (0, 0, 0, 255)); bg.alpha_composite(st)
            r = ir.rotate(-ang, resample=Image.BICUBIC)
            bg.alpha_composite(r, (int(round(sp["cx"] * eye.size[0] - ir.size[0] / 2)), int(round(sp["cy"] * eye.size[1] - ir.size[1] / 2))))
            return np.asarray(bg.convert("L"), np.float64)
        ref = Image.new("RGBA", eye.size, (0, 0, 0, 255)); ref.alpha_composite(eye); ref = np.asarray(ref.convert("L"), np.float64)
        c0, c90 = comp(0), comp(90)
        check(f"eye {name}: static + disc at 0 deg equals the still", np.abs(c0 - ref).mean() < 1.2, np.abs(c0 - ref).mean())
        ys, xs = np.mgrid[0:eye.size[1], 0:eye.size[0]]
        outside = np.hypot(xs - sp["cx"] * eye.size[0], ys - sp["cy"] * eye.size[1]) > sp["size"] * eye.size[0] / 2 + 2
        check(f"eye {name}: at 90 deg nothing outside the disc moves (the lids, sclera, catchlight)", np.abs(c90 - c0)[outside].max() < 1.5, np.abs(c90 - c0)[outside].max())
        check(f"eye {name}: the iris does turn", np.abs(c90 - c0)[~outside].max() > 60)
        edge = np.abs(np.hypot(xs - sp["cx"] * eye.size[0], ys - sp["cy"] * eye.size[1]) - sp["size"] * eye.size[0] / 2) < 2.5
        check(f"eye {name}: the disc rim is transparent (no hard edge, no halo)", np.asarray(ir, np.float64)[..., 3][:3].max() < 2 and np.asarray(ir)[..., 3][:, :3].max() < 2)
# a theme change regenerates the eye in the NEW tokens; dark vs light follows the luminance of the theme (lines = the lighter token)
if (user / "spiral-eye-ink-for-dark-themes.png").is_file():
    themes = {"night": {"ink": "#0c0b0d", "bone": "#d8d1cc", "blood": "#8a1c1c"}, "latte": {"ink": "#eff1f5", "bone": "#4c4f69", "blood": "#d20f39"}}
    got = {}
    for tn, c in themes.items():
        shutil.rmtree(OUT / f"theme-{tn}", ignore_errors=True); ink.eye_asset_frames(user, 900, c, OUT / f"theme-{tn}")
        a_ = np.asarray(Image.open(OUT / f"theme-{tn}" / "eye.png").convert("RGBA"), np.float64)
        got[tn] = a_[a_[..., 3] > 250][:, :3].mean(0)
    check("theme change: night lines = its bone, latte lines = its ink (the lighter token)", np.abs(got["night"] - ink.rgb(themes["night"]["bone"])).max() < 1.5 and np.abs(got["latte"] - ink.rgb(themes["latte"]["ink"])).max() < 1.5, {k: v.round().tolist() for k, v in got.items()})
    check("theme change: the two bakes differ", np.abs(got["night"] - got["latte"]).max() > 15)
    pools = {tn: ink.eye_pool(400, 300, 1.0, c, 200, 150, 200, 110) for tn, c in themes.items()}
    pl = {tn: np.asarray(p)[150, 200, :3].astype(float) for tn, p in pools.items()}
    check("theme change: the pool is the darker token (night = ink, latte = bone)", np.abs(pl["night"] - ink.rgb(themes["night"]["ink"])).max() < 1.5 and np.abs(pl["latte"] - ink.rgb(themes["latte"]["bone"])).max() < 1.5, {k: v.round().tolist() for k, v in pl.items()})
for i, t in enumerate(tiles):
    bg = Image.new("RGB", t.size, (90, 90, 90)); bg.paste(t, mask=t.split()[-1] if t.mode == "RGBA" else None)
    sheet.paste(bg, ((i % 4) * 640, (i // 4) * 360))
sheet.save(OUT / "sheet.png")
print("FAILED: " + ", ".join(fails) if fails else "all ink checks passed"); sys.exit(1 if fails else 0)

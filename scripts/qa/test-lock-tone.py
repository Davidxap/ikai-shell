#!/usr/bin/env python3
"""Lock theme sync gate (lock-theme-sync.md section 7): the duotone with an accent hint (tone_sync), the accent in the watcher's
eye, the cache keys and the rollback. Lab only: fake palettes, offscreen arrays, nothing live is read, written or locked.
Usage: test-lock-tone.py [picture.png]    (the user's eye art is used when it is on the machine, else the eye checks are skipped)"""
import hashlib, json, math, shutil, sys, tempfile, time
from pathlib import Path
import numpy as np
from PIL import Image
BIN = Path(__file__).resolve().parents[2] / "bar" / "modules" / "bin"
sys.path.insert(0, str(BIN))
import ito_ink as ink
import ito_lock_model as LM
# Budgets are CPU seconds (time.process_time), not wall: a loaded machine stretched the latte bake to 1.90 s wall and made the gate flaky (D-022).
# Measured CPU: current 0.95 s, latte 1.50 s (the worst); 2.4 s keeps a real regression visible with 60 % headroom for a busy box.
BAKE_CPU = 2.4

PALS = {   # tag: (ink = theme background, bone = theme foreground, blood = accent, lit = accent lightened)
    "current": ("#0c0b0d", "#d8d1cc", "#ff2fb3", "#ff5dc4"), "matte": ("#121212", "#bebebe", "#e68e0d", "#f0a53a"),
    "hacker": ("#0B0C16", "#ddf7ff", "#82FB9C", "#9afbae"), "gruv": ("#282828", "#d4be98", "#7daea3", "#9bc3b9"),
    "cyber": ("#200000", "#ff4040", "#26bdfd", "#5fd0ff"), "latte": ("#eff1f5", "#4c4f69", "#1e66f5", "#4a85f7"),
    "flexoki": ("#FFFCF0", "#100F0F", "#205EA6", "#4385be")}
COL = lambda t: dict(zip(("ink", "bone", "blood", "lit"), PALS[t]))
OUT = Path.home() / ".cache" / "ito" / "lab" / "lock"; OUT.mkdir(parents=True, exist_ok=True)
fails, warns = [], []
def check(name, ok, detail=""):
    print(("ok   " if ok else "FAIL ") + name + (" " + str(detail) if detail else ""))
    if not ok: fails.append(name)
def warn(name, detail=""):
    print("WARN " + name + (" " + str(detail) if detail else "")); warns.append(name)

W, H = 1280, 720
pic = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / ".config/ito/marks/_lockbg.png"
if not pic.is_file():
    rng = np.random.default_rng(3)
    base = np.tile(np.linspace(0, 255, W), (H, 1)) * 0.7 + rng.random((H, W)) * 70
    pic = Path(tempfile.mkdtemp()) / "synthetic.png"; Image.fromarray(base.astype(np.uint8), "L").convert("RGB").save(pic)

def lab_of(arr):
    return ink.oklab(ink.srgb_to_lin(arr))
def hue(a, b):
    return math.degrees(math.atan2(b, a))
def dh(h1, h2):
    d = abs(h1 - h2) % 360
    return min(d, 360 - d)

# ---- S1: tone_sync on L1, per palette ------------------------------------------------------------------------------------
res = {}
for tag in PALS:
    c = COL(tag); p = ink.tone_params(c)
    flat = np.asarray(ink.engraved_picture(pic, W, H, c))
    t0 = time.process_time(); sync = ink.tone_sync(flat, c, "sync"); dt = time.process_time() - t0
    check(f"{tag}: flat returns the same object", ink.tone_sync(flat, c, "flat") is flat)
    K = p["K"]
    lf, ls = lab_of(flat), lab_of(sync)
    dab = np.hypot(ls[..., 1] - lf[..., 1], ls[..., 2] - lf[..., 2]); dl = ls[..., 0] - lf[..., 0]
    # 1 wash bound
    check(f"{tag}: wash bound (mean dC {dab.mean():.4f} <= 0.012, max {dab.max():.4f} <= K+0.002, |mean dL| {abs(dl.mean()):.4f} <= 0.004, max |dL| {abs(dl).max():.4f} <= 0.010)",
          dab.mean() <= 0.012 and dab.max() <= K + 0.002 + 1e-9 and abs(dl.mean()) <= 0.004 and abs(dl).max() <= 0.010)
    # 2 hint present, on hue
    D, Lt = ink.rgb(p["D"]), ink.rgb(p["Lt"]); sp = Lt - D
    u = np.clip(((flat.astype(float) - D) @ sp) / (sp @ sp), 0, 1)
    sel = (u >= 0.08) & (u <= 0.30)
    m = dab[sel].mean() if sel.any() else 0.0
    if tag == "cyber":
        check("cyber (n = 0): L1 is byte-identical to flat", np.array_equal(sync, flat))
    elif p["n"] >= 0.9 and not p["light"]:
        da, db = (ls[..., 1] - lf[..., 1])[sel].mean(), (ls[..., 2] - lf[..., 2])[sel].mean()
        bl = ink.hex_lab(c["blood"])
        check(f"{tag}: hint present (mean dC {m:.4f} in [{0.6*K:.4f}, {K + 0.001:.4f}] (8-bit rounding adds ~0.001)) and on hue ({dh(hue(da, db), hue(bl[1], bl[2])):.1f} deg <= 10)",
              0.6 * K <= m <= K + 0.001 and dh(hue(da, db), hue(bl[1], bl[2])) <= 10)
    elif p["light"]:
        check(f"{tag}: light theme, hint <= 0.7 K ({m:.4f} <= {0.7*K:.4f})", m <= 0.7 * K + 1e-9)
    # budget (the picture changes the share of pixels the hint touches)
    check(f"{tag}: tone_sync CPU budget <= 0.8 s at 720p ({dt:.2f}s)", dt <= 0.8)
    # the pool and the ground stay the theme colour exactly: u = 0 pixels untouched
    zero = u <= 0.02
    check(f"{tag}: ground (u ~ 0) untouched", np.array_equal(sync[zero], flat[zero]))
    # 6 text floors: the worst-case background under the text boxes (L1 only, so pessimistic: the vignette only darkens)
    boxes = {"clock": ((0.06, 0.77, 0.20, 0.83), "bone", 0.72, 4.5), "date": ((0.06, 0.84, 0.18, 0.87), "bone", 0.55, 3.0),
             "user": ((0.44, 0.66, 0.56, 0.70), "bone", 1.0, 4.5), "status": ((0.35, 0.95, 0.65, 0.98), "bone", 0.55, 3.0)}
    for name, ((x0, y0, x1, y1), tok, alpha, floor) in boxes.items():
        vals = {}
        for mode, img in (("flat", flat), ("sync", sync)):
            reg = img[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)].astype(float)
            lum = reg @ np.array([0.2126, 0.7152, 0.0722])
            pick = np.percentile(lum, 10 if p["light"] else 90)
            bg = reg.reshape(-1, 3)[np.argmin(abs(lum.reshape(-1) - pick))]
            txt = ink.rgb(c[tok]) * alpha + bg * (1 - alpha)
            to_h = lambda v: "#%02x%02x%02x" % tuple(int(round(x)) for x in v)
            vals[mode] = ink.contrast(to_h(txt), to_h(bg))
        ok = vals["sync"] >= 0.97 * vals["flat"] - 1e-9
        check(f"{tag}: text {name} sync {vals['sync']:.2f} >= 0.97 x flat {vals['flat']:.2f}", ok)
        if vals["flat"] < floor:
            warn(f"{tag}: text {name} is under its {floor}:1 floor already with flat ({vals['flat']:.2f})")
    res[tag] = (flat, sync)

# ---- S1: eye accent -------------------------------------------------------------------------------------------------------
for tag in PALS:
    c = COL(tag); p = ink.tone_params(c); E = ink.eye_accent(c)
    check(f"{tag}: eye accent {E} holds 3:1 on the pool ({ink.contrast(E, p['D']):.2f})", ink.contrast(E, p["D"]) >= 3.0)
for tag in ("current", "matte", "hacker"):
    check(f"{tag}: eyeAccent is the accent itself", ink.eye_accent(COL(tag)) == COL(tag)["blood"].lower())
check("latte: the accent is lifted", ink.eye_accent(COL("latte")) not in (COL("latte")["blood"].lower(), COL("latte")["lit"].lower()))

# ---- 7 two palettes, same bg/fg, accents #ff2fb3 vs #26bdfd ------------------------------------------------------------------
ca, cb = COL("current"), dict(COL("current"), blood="#26bdfd", lit="#5fd0ff")
fa, sa = res["current"]; fb = fa; sb = ink.tone_sync(fb, cb, "sync")
d = ink.oklab(ink.srgb_to_lin(sa)) - ink.oklab(ink.srgb_to_lin(sb))
Dn, Ltn = ink.rgb(ca["ink"]), ink.rgb(ca["bone"]); spn = Ltn - Dn
u = np.clip(((fa.astype(float) - Dn) @ spn) / (spn @ spn), 0, 1)
out = (u < 0.03) | (u > 0.50)
check("two palettes: outside u in [0.03, 0.50] the pixels are equal", np.array_equal(sa[out], sb[out]))
sel = (u >= 0.08) & (u <= 0.30)
va = (ink.oklab(ink.srgb_to_lin(sa)) - ink.oklab(ink.srgb_to_lin(fa)))[sel][:, 1:].mean(0)
vb = (ink.oklab(ink.srgb_to_lin(sb)) - ink.oklab(ink.srgb_to_lin(fa)))[sel][:, 1:].mean(0)
want = dh(hue(*ink.hex_lab(ca["blood"])[1:]), hue(*ink.hex_lab(cb["blood"])[1:]))
got = dh(hue(*va), hue(*vb))
check(f"two palettes: the angle between the hint vectors ({got:.1f}) is within 10 deg of the accents' ({want:.1f})", abs(got - want) <= 10)
cp, cq = dict(COL("current"), ink="#101018"), COL("current")
check("different bg, same accent: the pool is each D exactly", ink.tone_params(cp)["D"] == "#101018" and ink.tone_params(cq)["D"] == "#0c0b0d")

# ---- 8 rollback: flat keeps today's keys byte for byte -----------------------------------------------------------------------
tmp = Path(tempfile.mkdtemp()); cache = tmp / "cache"
ctx = {"colours": COL("current"), "picture": pic, "cache": cache, "tone": "flat"}
legacy = {"l1": ("ink", "bone"), "duotone": ("ink", "bone"), "l5": ("ink", "bone"), "eyea": ("ink", "bone")}
okk = True
for op, cols in legacy.items():
    job = {"op": op, "w": W, "h": H} if op != "eyea" else {"op": op, "ew": 900, "src": [["x", 1, 2]]}
    blob = json.dumps([op, job.get("w"), job.get("h"), {k: ctx["colours"][k] for k in cols}, {k: v for k, v in job.items() if k not in ("w", "h", "op")},
                       LM._stat(pic) if op in ("l1", "duotone") else None, LM.GEN_VERSION], sort_keys=True, default=str)
    key = hashlib.sha1(blob.encode()).hexdigest()[:12]
    got = LM.job_path(job, ctx).name
    okk &= key in got
    sy = LM.job_path(job, dict(ctx, tone="sync")).name
    okk &= sy != got
check("flat keys are the legacy keys (no tone, no blood); sync keys differ", okk)
check("keys: another accent gives another sync key, the same flat key",
      LM.job_path({"op": "l1", "w": W, "h": H}, dict(ctx, tone="sync")) != LM.job_path({"op": "l1", "w": W, "h": H}, dict(ctx, tone="sync", colours=dict(ctx["colours"], blood="#26bdfd")))
      and LM.job_path({"op": "l1", "w": W, "h": H}, ctx) == LM.job_path({"op": "l1", "w": W, "h": H}, dict(ctx, colours=dict(ctx["colours"], blood="#26bdfd"))))
f1, f2 = tmp / "a.png", tmp / "b.png"
LM.draw({"op": "l1", "w": W, "h": H}, f1, ctx); ink.engraved_picture(pic, W, H, ctx["colours"]).save(f2, compress_level=1)
check("flat bake equals the plain engraved picture, byte for byte", f1.read_bytes() == f2.read_bytes())

# ---- S2: the eye -------------------------------------------------------------------------------------------------------------
EYE = Path.home() / ".config/ito/assets/eye"
if not (EYE / "spiral-eye-ink-for-dark-themes.png").is_file():
    print("skip: the user's eye art is not on this machine; eye checks skipped")
else:
    a, meta = ink.eye_load(EYE)
    t0 = time.process_time(); mk = ink.eye_masks(a, meta); dt = time.process_time() - t0
    check(f"eye masks: the rim was found (note {mk['note']}) in {dt:.2f}s CPU <= 0.6 s", mk["note"] is None and dt <= 0.6)
    L = ink.eye_layout(a.shape, meta, 900); x0, y0, x1, y1 = [int(v) for v in (L["px0"], L["py0"], L["px1"], L["py1"])]
    sl = (slice(y0, y1), slice(x0, x1)); al = a[sl]
    m = np.maximum.reduce([0.85 * mk["iris"][sl], 0.75 * mk["rim_up"][sl], 0.55 * mk["rim_lo"][sl]])
    cov = (al * m).sum() / al.sum(); iris_share = (al * 0.85 * mk["iris"][sl]).sum() / (al * m).sum()
    check(f"eye: accent coverage {cov:.3f} in [0.12, 0.22], iris share {iris_share:.2f} >= 0.70", 0.12 <= cov <= 0.22 and iris_share >= 0.70)
    iris = meta["iris"]; ys, xs = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    cl = meta["catchlight"]
    cd = np.hypot(xs - cl[0], ys - cl[1]) <= 20
    check(f"eye: the catchlight stays neutral (mean m {mk['iris'][cd].mean() * 0.85:.3f} <= 0.05)", mk["iris"][cd].mean() * 0.85 <= 0.05)
    # erode the sclera 6 px (numpy)
    inner = ~ink._dilate(~mk["sclera"], 13)
    inner &= np.hypot(xs - iris["cx"], ys - iris["cy"]) > iris["r"] + 14
    mm = np.maximum.reduce([0.85 * mk["iris"], 0.75 * mk["rim_up"], 0.55 * mk["rim_lo"]])
    check(f"eye: the sclera interior stays neutral (mean m {mm[inner].mean():.4f} <= 0.02)", mm[inner].mean() <= 0.02)
    r = np.hypot(xs - iris["cx"], ys - iris["cy"])
    check("eye: the iris disc plane is rotation-invariant (m = 1 inside r1)", float(mk["disc"][r <= meta["spin"]["r1"]].min()) >= 0.999)
    # bake and look at the pixels
    for tag in ("current", "latte"):
        c = COL(tag); d = tmp / f"eye-{tag}"
        t0 = time.process_time(); geo = ink.eye_frame_set(a, meta, 900, c, d, "sync"); dt = time.process_time() - t0
        check(f"{tag}: eyeAccent recorded ({geo['eyeAccent']}) and the bake takes {dt:.2f}s CPU <= 2.4 s", geo["eyeAccent"] == ink.eye_accent(c) and dt <= BAKE_CPU)
        eye = np.asarray(Image.open(d / "eye.png").convert("RGBA")); st = np.asarray(Image.open(d / "static.png").convert("RGBA"))
        di = np.asarray(Image.open(d / "iris.png").convert("RGBA"))
        sc = L["scale"]; tx = lambda x, y: (int(round((x - L["px0"]) * sc)), int(round((y - L["py0"]) * sc)))
        # composite static + iris at 0 deg against mid grey and compare with eye.png. The flat bake has the same sub-pixel placement
        # error of the pasted disc, so the gate is what colour ADDS to it (<= 0.01 dE_ok at the 99th percentile).
        def seam_error(folder):
            e = [np.asarray(Image.open(folder / n).convert("RGBA")) for n in ("eye.png", "static.png", "iris.png")]
            g = Image.new("RGBA", (e[0].shape[1], e[0].shape[0]), (128, 128, 128, 255))
            e0 = g.copy(); e0.alpha_composite(Image.fromarray(e[0]))
            e1 = g.copy(); e1.alpha_composite(Image.fromarray(e[1]))
            spj = json.loads((folder / "spin.json").read_text()); dsz = e[2].shape[0]
            e1.alpha_composite(Image.fromarray(e[2]), (int(round(spj["cx"] * e[0].shape[1] - dsz / 2)), int(round(spj["cy"] * e[0].shape[0] - dsz / 2))))
            diff = ink.oklab(ink.srgb_to_lin(np.asarray(e0.convert("RGB")))) - ink.oklab(ink.srgb_to_lin(np.asarray(e1.convert("RGB"))))
            return float(np.percentile(np.linalg.norm(diff, axis=-1), 99))
        fl = tmp / f"eye-{tag}-flat"; ink.eye_frame_set(a, meta, 900, c, fl, "flat")
        es, ef = seam_error(d), seam_error(fl)
        check(f"{tag}: static + iris at 0 deg vs eye.png: 99th pct dE_ok {es:.4f} <= flat {ef:.4f} + 0.01", es <= ef + 0.01)
        # pixels: a solid sclera pixel is the lighter token, an iris pixel leans to the accent
        Lt = ink.rgb(ink.tone_params(c)["Lt"])
        px, py = tx(iris["cx"] - 1.2 * iris["r"], iris["cy"] + 0.0)
        sclera_px = eye[py - 3:py + 4, px - 3:px + 4]; solid = sclera_px[..., 3] > 240
        if solid.any():
            check(f"{tag}: solid sclera pixels are the neutral token", np.abs(sclera_px[solid][:, :3].astype(float).mean(0) - Lt).max() <= 2.5, sclera_px[solid][:, :3].mean(0).round().tolist())
        ix, iy = tx(iris["cx"], iris["cy"] - 100)
        ireg = eye[iy - 12:iy + 13, ix - 12:ix + 13]; solid = ireg[..., 3] > 240
        E = ink.rgb(geo["eyeAccent"])
        dist_e = np.abs(ireg[solid][:, :3].astype(float).mean(0) - E).max() if solid.any() else 999
        dist_l = np.abs(ireg[solid][:, :3].astype(float).mean(0) - Lt).max() if solid.any() else 0
        check(f"{tag}: solid iris pixels are close to the eye accent (not to the neutral token)", solid.any() and dist_e < dist_l)

shutil.rmtree(tmp, ignore_errors=True)
print(f"\n{len(fails)} failed, {len(warns)} warning(s)")
sys.exit(1 if fails else 0)

#!/usr/bin/env python3
"""S-E / S-F gate: for each design, the mock (drawn from the conf text) next to the nested-bench PNG, plus a numeric
check that the input-field box sits within 1 % of W in both. Writes ~/.cache/ito/lock-bench/compare-<design>.png."""
import sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "bar" / "modules" / "bin"))
import ito_preview as P

B = Path.home() / ".cache" / "ito" / "lock-bench"
designs = sys.argv[1:] or ["fog", "panel", "lantern", "amigara"]
bad = 0
for d in designs:
    png, conf = B / f"{d}.png", B / f"{d}.conf"
    if not png.is_file() or not conf.is_file():
        print(d, "no bench output"); bad += 1; continue
    bench = Image.open(png).convert("RGB")
    W, H = bench.size
    mock, boxes = P.render_lock(conf.read_text(), W, H, with_boxes=True)
    fb = [b for k, b in boxes if k == "input"][0]
    # the best shift between the bench and the mock, on the gradient of a window around the field (the picture is the
    # same in both, so the field's rim decides it). <= 1 % of W is a pass.
    def grad(im):
        g = np.asarray(im.convert("L"), float)
        return np.hypot(*np.gradient(g))
    gb, gm = grad(bench), grad(mock)
    x0, y0, x1, y1 = [int(v) for v in (fb[0] - 0.03 * W, fb[1] - 0.03 * H, fb[2] + 0.03 * W, fb[3] + 0.03 * H)]
    x0, y0 = max(x0, 0), max(y0, 0)
    ref = gm[y0:y1, x0:x1]
    reach = int(0.015 * W)
    best, bs = -1.0, (0, 0)
    for dy in range(-reach, reach + 1, 1):
        for dx in range(-reach, reach + 1, 2):
            if y0 + dy < 0 or x0 + dx < 0:
                continue
            cand = gb[y0 + dy:y1 + dy, x0 + dx:x1 + dx]
            if cand.shape != ref.shape:
                continue
            c = float((cand * ref).sum() / (np.linalg.norm(cand) * np.linalg.norm(ref) + 1e-9))
            if c > best:
                best, bs = c, (dx, dy)
    off = max(abs(bs[0]), abs(bs[1])) / W * 100
    sheet = Image.new("RGB", (W * 2 + 10, H), (60, 60, 60)); sheet.paste(bench, (0, 0)); sheet.paste(mock, (W + 10, 0))
    sheet.save(B / f"compare-{d}.png")
    ok = off <= 1.0
    bad += (not ok)
    print(f"{d:11s} best shift {bs} px = {off:.2f}% of W (corr {best:.3f})  {'ok' if ok else 'CHECK'}")
sys.exit(1 if bad else 0)

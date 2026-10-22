#!/usr/bin/env python3
"""BS1 gates (boot-screens-v2 F): `ito-assets ingest` turns generator grounds into transparency; corners are 0; corrupt and
wrong-ground files are rejected; slots are listed in the index; an empty folder changes nothing. Temp folders only."""
import json, os, subprocess, sys, tempfile
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

BIN = Path(__file__).resolve().parents[2] / "bar" / "modules" / "bin" / "ito-assets"
T = Path(tempfile.mkdtemp())
ENV = {**os.environ, "ITO_ASSETS_DIR": str(T / "assets"), "ITO_ASSETS_INDEX": str(T / "index.json"),
       "ITO_ART_DIR": str(BIN.parent.parent / "ito-art")}
fails = 0


def run(*a):
    r = subprocess.run([sys.executable, "-I", str(BIN), *a], capture_output=True, text=True, env=ENV)
    try:
        return r.returncode, json.loads(r.stdout.strip().splitlines()[-1])
    except (ValueError, IndexError):
        return r.returncode, {"raw": r.stdout + r.stderr}


def check(name, cond, extra=""):
    global fails
    print(("ok   " if cond else "FAIL ") + name + ((" " + str(extra)) if (extra and not cond) else ""))
    fails += 0 if cond else 1


def picture(path, size, ground, ink, fmt="PNG", noise=0.0):
    im = Image.new("RGB", size, (ground,) * 3)
    d = ImageDraw.Draw(im)
    w, h = size
    d.ellipse((w * .2, h * .2, w * .8, h * .8), fill=(ink,) * 3)
    d.ellipse((w * .4, h * .4, w * .6, h * .6), fill=(ground,) * 3)
    if noise:
        a = np.asarray(im, np.float32) + np.random.RandomState(1).normal(0, noise, (h, w, 3))
        im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    im.save(path, format=fmt)


# 1. empty folder: no slots, no files, no change
rc, o = run("index")
idx = json.loads((T / "index.json").read_text())
check("empty folder: empty index", rc == 0 and idx["files"] == {} and idx["slots"] == {} and idx["rejected"] == {})

# 2. black ground, white ink -> alpha, corners 0, ink kept
src = T / "gen-dark.png"
picture(src, (1000, 1200), 0, 255, noise=2.0)
rc, o = run("ingest", str(src), "--as", "fetch/logo")
check("black ground ingests", rc == 0 and o.get("indexed") is True, o)
out = Image.open(T / "assets" / "fetch" / "logo.png")
a = np.asarray(out.convert("RGBA"))
check("RGBA, same size", out.mode == "RGBA" and out.size == (1000, 1200), (out.mode, out.size))
check("corners alpha 0", all(a[y, x, 3] == 0 for y in (0, -1) for x in (0, -1)))
check("ground is transparent (corner patch)", int(a[:20, :20, 3].max()) == 0)
check("ink is opaque", a[600, 300, 3] > 240 and a[600, 500, 3] == 0 or a[600, 300, 3] > 240, (a[600, 300], a[600, 500]))
check("RGB is neutral white (the shell tints)", int(a[600, 300, 0]) == 255)
check("original kept under _sources", (T / "assets" / "_sources" / "fetch__logo.png").is_file())
check("slot listed in the index", "fetch/logo.png" in json.loads((T / "index.json").read_text())["slots"])

# 3. white ground, black ink (--light)
src2 = T / "gen-light.png"
picture(src2, (1000, 1200), 255, 0, noise=2.0)
rc, o = run("ingest", str(src2), "--as", "fetch/logo", "--light")
check("white ground ingests with --light", rc == 0 and o.get("indexed") is True, o)
b = np.asarray(Image.open(T / "assets" / "fetch" / "logo.light.png").convert("RGBA"))
check("light: corners alpha 0, ink black", b[0, 0, 3] == 0 and b[-1, -1, 3] == 0 and b[600, 300, 3] > 240 and b[600, 300, 0] == 0, (b[600, 300],))

# 4. the wrong ground is refused with advice
rc, o = run("ingest", str(src2), "--as", "fetch/logo")
check("white ground without --light is refused", rc == 1 and "ground" in o.get("error", ""), o)
rc, o = run("ingest", str(src), "--as", "fetch/logo", "--light")
check("black ground with --light is refused", rc == 1 and "ground" in o.get("error", ""), o)

# 5. corrupt / not an image / unknown slot / eye / aspect
bad = T / "bad.png"
bad.write_bytes(b"\x89PNG\r\n\x1a\n" + b"junk" * 50)
rc, o = run("ingest", str(bad), "--as", "fetch/logo")
check("corrupt file is rejected", rc == 1 and "rejected" in o.get("error", ""), o)
txt = T / "x.txt"; txt.write_text("hello")
rc, o = run("ingest", str(txt), "--as", "fetch/logo")
check("non-picture rejected", rc == 1, o)
rc, o = run("ingest", str(src), "--as", "nope/none")
check("unknown slot rejected", rc == 1 and "unknown slot" in o.get("error", ""), o)
rc, o = run("ingest", str(src), "--as", "eye/spiral")
check("eye/ is not an ingest slot", rc == 1 and "eye" in o.get("error", ""), o)
wide = T / "wide.png"; picture(wide, (1600, 900), 0, 255)
rc, o = run("ingest", str(wide), "--as", "system/jar")
check("wrong aspect for the slot is rejected", rc == 1 and "does not fit" in o.get("error", ""), o)
rc, o = run("ingest", str(wide), "--as", "boot/bg")
check("16:9 into boot/bg ok", rc == 0, o)
blank = T / "blank.png"; Image.new("RGB", (512, 512), (0, 0, 0)).save(blank)
rc, o = run("ingest", str(blank), "--as", "bg/grain")
check("an empty picture is refused", rc == 1 and "no ink" in o.get("error", ""), o)
# jpeg ground (lossy) still gives clean corners
jpg = T / "g.jpg"; picture(jpg, (1000, 1200), 0, 255, fmt="JPEG")
rc, o = run("ingest", str(jpg), "--as", "fetch/logo")
c = np.asarray(Image.open(T / "assets" / "fetch" / "logo.png").convert("RGBA"))
check("jpeg ground: ingests, corner patch transparent", rc == 0 and int(c[:30, :30, 3].max()) == 0, o)
# colour picture warns
col = T / "col.png"; im = Image.new("RGB", (512, 512), (0, 0, 0)); ImageDraw.Draw(im).ellipse((100, 100, 400, 400), fill=(255, 40, 40)); im.save(col)
rc, o = run("ingest", str(col), "--as", "bg/grain")
check("colour picture warns, still ingests", rc == 0 and any("monochrome" in w for w in o.get("warnings", [])), o)

# 6. the index never maps a slot as shipped art, and a hand-dropped bad file is rejected
(T / "assets" / "screensaver").mkdir(exist_ok=True)
(T / "assets" / "screensaver" / "spiral.png").write_bytes(b"\x89PNG\r\n\x1a\nnope")
run("index")
idx = json.loads((T / "index.json").read_text())
check("corrupt hand-dropped slot file is rejected", "screensaver/spiral.png" in idx["rejected"], idx["rejected"])
check("no slot leaks into files", all(k not in idx["files"] for k in idx["slots"]))
rc, o = run("slots")
check("slots listing", rc == 0 and any(s["slot"] == "fetch/logo.png" and s["present"] for s in o["slots"]), o)
sys.exit(1 if fails else 0)

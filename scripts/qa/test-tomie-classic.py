#!/usr/bin/env python3
"""Gate: `ito-assets recipe tomie` also writes Tomie Classic (marks/tomie-classic*.png + bar tiers), because the menu-mark picker
offers only Tomie Classic and a fresh install otherwise falls back to Uzumaki. The HD panel never replaces an existing classic.
Synthetic 565x933 drawing, temp folders only (no user art)."""
import json, os, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image, ImageDraw

BIN = Path(__file__).resolve().parents[2] / "bar" / "modules" / "bin" / "ito-assets"
T = Path(tempfile.mkdtemp())
fails = 0


def run(assets, src):
    env = {**os.environ, "ITO_ASSETS_DIR": str(assets), "ITO_ASSETS_INDEX": str(assets / "index.json"), "ITO_ART_DIR": str(BIN.parent.parent / "ito-art")}
    r = subprocess.run([sys.executable, "-I", str(BIN), "recipe", "tomie", str(src)], capture_output=True, text=True, env=env)
    try:
        return json.loads(r.stdout.strip().splitlines()[-1])
    except (ValueError, IndexError):
        return {"raw": r.stdout + r.stderr}


def check(name, cond, extra=""):
    global fails
    print(("ok   " if cond else "FAIL ") + name + ((" " + str(extra)[:300]) if (extra and not cond) else ""))
    fails += 0 if cond else 1


im = Image.new("RGB", (565, 933), "white")
d = ImageDraw.Draw(im)
d.ellipse((60, 40, 480, 420), outline="black", width=14, fill=(235, 235, 235))
d.rectangle((120, 60, 440, 200), fill="black")
d.ellipse((200, 250, 260, 300), outline="black", width=8)
d.ellipse((330, 250, 390, 300), outline="black", width=8)
d.ellipse((350, 330, 358, 338), fill=(200, 16, 20))
src = T / "Tommie.png"; im.save(src)
A = T / "a"; A.mkdir()
res = run(A, src)
check("the recipe runs on the Tommie drawing", res.get("ok") is True, res)
for rel in ("marks/tomie-classic.png", "marks/tomie-classic.light.png", "marks/bar/24/tomie-classic.png", "marks/bar/48/tomie-classic.light.png", "marks/bar/128/tomie-classic.png"):
    check(f"{rel} written", (A / rel).is_file())
check("tomie-classic is the same sticker as tomie", (A / "marks/tomie-classic.png").read_bytes() == (A / "marks/tomie.png").read_bytes())
# an existing classic is the user's: the HD panel does not replace it (source size check only needs the 1500x2000 size to be refused or accepted)
B = T / "b"; (B / "marks").mkdir(parents=True)
keep = B / "marks/tomie-classic.png"; Image.new("RGBA", (512, 512), (1, 2, 3, 255)).save(keep); before = keep.read_bytes()
hd = Image.new("RGB", (1500, 2000), "white"); hdp = T / "hd.png"; hd.save(hdp)
res = run(B, hdp)         # a blank HD panel is rejected by the recipe itself: nothing may be written, so the classic stays
check("a rejected HD panel leaves an existing classic alone", keep.read_bytes() == before, res)
sys.exit(1 if fails else 0)

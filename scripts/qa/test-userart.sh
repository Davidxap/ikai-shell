#!/usr/bin/env bash
# A1 gates (decisions-b9 section 6): with an empty folder the render is pixel-identical to the shipped one; a dropped file wins; a corrupt
# file (and one the index never lists) falls back to the shipped art. Offscreen lab on fake art in a temp folder; nothing of the user's is read.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
[ -x "$REPO/scripts/lab/render.sh" ] || { echo "skip: scripts/lab (the development lab harness) is not part of this checkout"; exit 0; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
export ITO_ASSETS_DIR=$T/assets ITO_ASSETS_INDEX=$T/index.json ITO_ART_DIR=$REPO/bar/modules/ito-art
mkdir -p /tmp/ito-lab/userart "$ITO_ASSETS_DIR/system"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
render() { cp "$ITO_ASSETS_INDEX" /tmp/ito-lab/userart/index.json; "$REPO/scripts/lab/render.sh" lab-userart.qml "$1" >/dev/null; }
bin=$REPO/bar/modules/bin/ito-assets

# 1. no folder content: an empty index
python3 -I "$bin" index >/dev/null
python3 -I -c "import json,os; i=json.load(open(os.environ['ITO_ASSETS_INDEX'])); assert i['files']=={} and i['rejected']=={}" && ok "empty folder: empty index"
echo '{}' > /tmp/ito-lab/userart/index.json
"$REPO/scripts/lab/render.sh" lab-userart.qml "$T/none.png" >/dev/null   # no index at all = the shipped path
render "$T/empty.png"
cmp -s "$T/none.png" "$T/empty.png" && ok "empty index renders pixel-identical to no index" || bad "empty index differs"

python3 -I -c "
import numpy as np; from PIL import Image
a=np.asarray(Image.open('$T/none.png').convert('RGB'),int); assert (np.abs(a-a[0,0]).max(axis=2)>30).mean()>0.05" && ok "the shipped render is not blank" || bad "the shipped render is blank (the lab shows nothing)"

# 2. a dropped file wins (the shipped disk, mirrored: same size, visibly different)
python3 -I - <<PY
from PIL import Image, ImageOps
im = Image.open("$ITO_ART_DIR/system/disk.png").convert("RGBA")
ImageOps.mirror(im).save("$ITO_ASSETS_DIR/system/disk.png")
PY
python3 -I "$bin" index >/dev/null
python3 -I -c "import json,os; i=json.load(open(os.environ['ITO_ASSETS_INDEX'])); assert 'system/disk.png' in i['files'], i" && ok "dropped file is indexed ok"
render "$T/user.png"
cmp -s "$T/none.png" "$T/user.png" && bad "dropped file did not win" || ok "dropped file wins (render differs)"
python3 -I - <<PY && ok "dropped file is the mirrored art" || bad "dropped render is not the mirrored shipped render"
import numpy as np
from PIL import Image, ImageOps
a = Image.open("$T/none.png").convert("RGBA"); b = Image.open("$T/user.png").convert("RGBA")
d = np.abs(np.asarray(ImageOps.mirror(a), int) - np.asarray(b, int)).max(axis=2)
assert (d > 24).mean() < 0.02, (d > 24).mean()
PY

# 3. corrupt files: rejected by the index, never used
for kind in truncated zero jpeg; do
  case $kind in
    truncated) head -c 300 "$ITO_ART_DIR/system/disk.png" > "$ITO_ASSETS_DIR/system/disk.png";;
    zero) : > "$ITO_ASSETS_DIR/system/disk.png";;
    jpeg) python3 -I -c "from PIL import Image; Image.new('RGB',(256,256),(200,0,0)).save('$ITO_ASSETS_DIR/system/disk.png', format='JPEG')";;
  esac
  python3 -I "$bin" index >/dev/null
  python3 -I -c "import json,os; i=json.load(open(os.environ['ITO_ASSETS_INDEX'])); assert 'system/disk.png' not in i['files'] and 'system/disk.png' in i['rejected'], i" && ok "$kind: rejected with a reason" || bad "$kind: not rejected"
  render "$T/c-$kind.png"
  cmp -s "$T/none.png" "$T/c-$kind.png" && ok "$kind: shipped art shown" || bad "$kind: render differs from the shipped art"
done
# a bomb header and a wrong aspect
python3 -I -c "
import struct,zlib
sig=b'\x89PNG\r\n\x1a\n'
def ch(t,d): return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
open('$ITO_ASSETS_DIR/system/disk.png','wb').write(sig+ch(b'IHDR',struct.pack('>IIBBBBB',20000,20000,8,6,0,0,0))+ch(b'IEND',b''))"
python3 -I "$bin" index >/dev/null
python3 -I -c "import json,os; i=json.load(open(os.environ['ITO_ASSETS_INDEX'])); assert 'system/disk.png' in i['rejected'], i" && ok "20000 x 20000 header: rejected" || bad "bomb header accepted"
python3 -I -c "from PIL import Image; Image.new('RGBA',(256,400),(0,0,0,0)).save('$ITO_ASSETS_DIR/system/disk.png')"
python3 -I "$bin" index >/dev/null
python3 -I -c "import json,os; i=json.load(open(os.environ['ITO_ASSETS_INDEX'])); assert 'aspect' in i['rejected']['system/disk.png'], i" && ok "wrong aspect: rejected" || bad "wrong aspect accepted"

# 4. sticky fallback: a listed file that then fails to load (the index is stale) falls back on Image.Error
python3 -I - <<PY
import json,os
p = os.environ["ITO_ASSETS_INDEX"]; i = json.load(open(p))
i["files"]["system/disk.png"] = {"mtime": 1, "w": 256, "h": 256}
open(p, "w").write(json.dumps(i))
PY
rm -f "$ITO_ASSETS_DIR/system/disk.png"
render "$T/stale.png"
cmp -s "$T/none.png" "$T/stale.png" && ok "missing file behind a listed entry: Image.Error -> shipped art (sticky)" || bad "stale entry broke the render"

# 5. mtime in the URL (cache invalidation) and the reserved folder
node --input-type=module -e '
import { loadQmlJs } from "'"$REPO"'/scripts/qa/icon-raster.mjs"
const U = loadQmlJs("bar/modules/ItoUserArt.js")
const idx = { root: "/h/assets", files: { "system/disk.png": { mtime: 5 }, "eye/x.png": { mtime: 5 } } }
const a = U.map(idx, {}, "file:///x/bar/modules/ito-art/system/disk.png")
const b = U.map({ ...idx, files: { "system/disk.png": { mtime: 6 } } }, {}, "file:///x/bar/modules/ito-art/system/disk.png")
if (a !== "file:///h/assets/system/disk.png?v=5" || a === b) { console.log("FAIL mtime url", a, b); process.exit(1) }
if (U.map(idx, {}, "file:///x/bar/modules/ito-art/eye/x.png") !== "") { console.log("FAIL eye mapped"); process.exit(1) }
if (U.map(idx, { [a]: true }, "file:///x/bar/modules/ito-art/system/disk.png") !== "") { console.log("FAIL sticky"); process.exit(1) }
if (U.map(idx, {}, "file:///x/other/system/disk.png") !== "") { console.log("FAIL other path mapped"); process.exit(1) }
console.log("ok   ItoUserArt.js: ?v=<mtime>, eye/ never mapped, failed set sticky, only ito-art paths")' || bad "ItoUserArt.js"
# 6. A1a/A1b/A1d, index side: light twin, bar buckets, user marks, the recipe tool (no render needed)
rm -rf "$ITO_ASSETS_DIR"; mkdir -p "$ITO_ASSETS_DIR/system/bar/28" "$ITO_ASSETS_DIR/system/bar/31" "$ITO_ASSETS_DIR/marks/bar/28"
python3 -I - <<PY
from PIL import Image
A = "$ITO_ASSETS_DIR"
def mk(rel, w, h): Image.new("RGBA", (w, h), (0, 0, 0, 0)).save(f"{A}/{rel}")
mk("system/disk.light.png", 256, 256); mk("system/bar/28/disk.png", 28, 28); mk("system/bar/31/disk.png", 31, 31); mk("system/bar/28/nope.png", 28, 28)
mk("marks/beetle.png", 512, 512); mk("marks/beetle.light.png", 512, 512); mk("marks/bar/28/beetle.png", 28, 28)
mk("marks/small.png", 256, 256); mk("marks/Bad.png", 512, 512)
PY
mkdir -p "$ITO_ASSETS_DIR/system/bar/32"; python3 -I -c "from PIL import Image; Image.new('RGBA',(28,28)).save('$ITO_ASSETS_DIR/system/bar/32/disk.png')"
python3 -I "$bin" index >/dev/null
python3 -I - <<PY && ok "index: light twin + bar bucket of a shipped picture, marks/ family" || bad "index: A1a/A1b rules"
import json, os
i = json.load(open(os.environ["ITO_ASSETS_INDEX"])); f, s, r = i["files"], i["slots"], i["rejected"]
assert "system/disk.light.png" in f and "system/bar/28/disk.png" in f and f["system/bar/28/disk.png"]["bar"] == 28, (f, r)
assert "system/bar/31/disk.png" in r and "system/bar/32/disk.png" in r and "system/bar/28/nope.png" in r, r     # not a bucket / wrong size / not shipped
assert {"marks/beetle.png", "marks/beetle.light.png", "marks/bar/28/beetle.png"} <= set(s), (s, r)
assert s["marks/beetle.png"]["mark"] == "beetle" and s["marks/beetle.light.png"]["light"] is True and s["marks/bar/28/beetle.png"]["bar"] == 28
assert "marks/small.png" in r and "marks/Bad.png" in r, r                                                    # not 512 / not [a-z0-9-]
PY
# the recipe: a synthetic line drawing -> a mark with both polarities and every bucket; never inside the repo; dry-run writes nothing
python3 -I -c "
from PIL import Image, ImageDraw
im = Image.new('RGB', (600, 500), 'white'); d = ImageDraw.Draw(im); d.ellipse((100, 80, 500, 420), outline='black', width=14); d.ellipse((260, 200, 340, 300), fill='black')
im.save('$T/line.png')"
rm -rf "$ITO_ASSETS_DIR"; mkdir -p "$ITO_ASSETS_DIR"
python3 -I "$bin" recipe lineart "$T/line.png" --as marks/ring --bar --dry-run >/dev/null && [[ -z $(find "$ITO_ASSETS_DIR" -type f) ]] && ok "recipe --dry-run writes nothing" || bad "recipe --dry-run wrote files"
python3 -I "$bin" recipe lineart "$T/line.png" --as marks/ring --bar >/dev/null
python3 -I - <<PY && ok "recipe: paper + ink polarity, ten buckets, neutral ink, no opaque black, indexed" || bad "recipe products"
import json, os
import numpy as np; from PIL import Image
A = os.environ["ITO_ASSETS_DIR"]
i = json.load(open(os.environ["ITO_ASSETS_INDEX"])); s = i["slots"]
want = {"marks/ring.png", "marks/ring.light.png"} | {f"marks/bar/{p}/ring.png" for p in (24, 28, 32, 40, 44, 48, 56, 64, 80, 88)}
assert want <= set(s), (set(s), i["rejected"])
for rel in want:
    a = np.asarray(Image.open(f"{A}/{rel}").convert("RGBA"), int)
    assert (a[..., 3] > 0).any() and (a[..., :3][a[..., 3] > 0] == 200).all(), rel
    assert a[0, 0, 3] == 0, rel
assert os.path.isfile(f"{A}/_sources/marks__ring.png")
PY
refusal=$(ITO_ASSETS_DIR="$REPO/.recipe-test" python3 -I "$bin" recipe lineart "$T/line.png" --as marks/ring 2>/dev/null || true)
[[ $refusal == *refused* && ! -e $REPO/.recipe-test ]] && ok "recipe refuses an assets folder inside the repo" || bad "recipe wrote inside the repo"
# 6. S2c: photo recipes refuse a source of the wrong size; the beetle family bucket (no shipped base) is indexed; remina-real -> remina
python3 -I - <<PY
from PIL import Image
Image.new("RGB", (100, 100), "white").save("$T/small.png")
PY
for r in tomie uzumaki-eye beetle ws-beetle; do
  m=$(python3 -I "$bin" recipe $r "$T/small.png" 2>/dev/null || true)
  [[ $m == *rejected* ]] || bad "recipe $r accepted a picture of the wrong size"
done
ok "photo recipes refuse a source of another size"
mkdir -p "$ITO_ASSETS_DIR/workspaces/bar/28" "$ITO_ASSETS_DIR/marks/bar/28"
python3 -I - <<PY
from PIL import Image
im = Image.new("RGBA", (28, 28), (0, 0, 0, 0)); im.putpixel((10, 10), (200, 200, 200, 255))
im.save("$ITO_ASSETS_DIR/workspaces/bar/28/ws-beetle-3-active.png")
im.save("$ITO_ASSETS_DIR/marks/bar/28/remina-real.png")
big = Image.new("RGBA", (512, 512), (0, 0, 0, 0)); big.putpixel((200, 200), (200, 200, 200, 255)); big.save("$ITO_ASSETS_DIR/marks/remina-real.png")
PY
python3 -I "$bin" migrate-marks >/dev/null; python3 -I "$bin" migrate-marks >/dev/null   # idempotent
python3 -I "$bin" index >/dev/null
python3 -I - <<PY && ok "ws-beetle bucket listed without a shipped base; remina-real renamed to remina" || bad "ws family / migrate-marks"
import json, os
i = json.load(open(os.environ["ITO_ASSETS_INDEX"])); s = i["slots"]
assert "workspaces/bar/28/ws-beetle-3-active.png" in s, i["rejected"]
assert "marks/remina.png" in s and "marks/bar/28/remina.png" in s and "marks/remina-real.png" not in s, (list(s), i["rejected"])
PY
python3 -I "$bin" index >/dev/null
[[ $fail == 0 ]] && echo "all user-art checks passed" || { echo "FAILED"; exit 1; }

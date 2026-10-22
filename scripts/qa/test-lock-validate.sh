#!/usr/bin/env bash
# S-E/S-F gate: validator v2. RED cases (each must be rejected with a reason), then the generated confs pass.
# Everything happens on files under a temp dir; nothing live is read or written, nothing is locked.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOCK="$REPO/bar/modules/bin/ito-lock"
D=$(mktemp -d); trap 'rm -rf "$D"' EXIT
export ITO_LOCK_MONITORS=":1280x720"
"$LOCK" candidate --all --out "$D" >/dev/null || { echo "FAIL: candidates did not validate"; exit 1; }
fail=0
expect_bad() {  # expect_bad <name> <design> <file>
  local out; out=$("$LOCK" validate "$3" --design "$2" 2>&1)
  if [[ $? -ne 0 ]]; then echo "ok   rejected: $1 -> $(echo "$out" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("reason",""))' 2>/dev/null)"
  else echo "FAIL accepted: $1"; fail=1; fi
}
mut() { sed "$2" "$D/$1.conf" > "$D/m-$3.conf"; }
mut fog '0,/^    font_size = .*/s//    font_size = 150/' bigfont;               expect_bad "font_size 150" fog "$D/m-bigfont.conf"
# accent on three widgets: recolour the clock, the name and the line
python3 - "$D/fog.conf" "$D/m-accent.conf" <<'PY'
import re,sys
t=open(sys.argv[1]).read()
n=0
def sub(m):
    global n
    n+=1
    return m.group(0).replace("$bone_dim","$blood").replace("$bone_soft","$blood") if n<=3 else m.group(0)
t=re.sub(r"^label \{.*?^\}", sub, t, flags=re.M|re.S)
open(sys.argv[2],"w").write(t)
PY
expect_bad "accent on three widgets" fog "$D/m-accent.conf"
mut fog 's/the fog waits for a name…/this one was made for you…/' ph;          expect_bad "wrong placeholder for the design" fog "$D/m-ph.conf"
python3 - "$D/fog.conf" "$D/m-layer.conf" <<'PY'
import re,sys
t=open(sys.argv[1]).read()
t=re.sub(r"^background \{\n(?:(?!^\}).)*zindex = -2\n\}\n*", "", t, count=1, flags=re.M|re.S)
open(sys.argv[2],"w").write(t)
PY
expect_bad "missing layer (zindex -2)" fog "$D/m-layer.conf"
python3 - "$D/fog.conf" "$D/m-size.conf" "$D" <<'PY'
import re,sys
from PIL import Image
t=open(sys.argv[1]).read()
m=re.search(r"path = (\S+/l2-[0-9a-f]{12}\.png)", t)
Image.new("RGBA",(100,100)).save(sys.argv[3]+"/l2-aaaaaaaaaaaa.png")
open(sys.argv[2],"w").write(t.replace(m.group(1), sys.argv[3]+"/l2-aaaaaaaaaaaa.png"))
PY
expect_bad "layer of the wrong size" fog "$D/m-size.conf"
mut fog 's/^    ignore_empty_input = true$/    ignore_empty_input = true\n    xray = true/' x; sed -i 's/^    zindex = -2$/    zindex = -2\n    xray = true/' "$D/m-x.conf"; expect_bad "xray" fog "$D/m-x.conf"
mut fog 's/^    position = 0, -12.00%$/    position = 0, -12.00%\n    onclick = x/' oc;  expect_bad "onclick" fog "$D/m-oc.conf"
mut fog 's/^    fail_timeout = 2400$//' ft;                                       expect_bad "no fail_timeout" fog "$D/m-ft.conf"
mut amigara 's/reload_time = 1//' rl; python3 - "$D/amigara.conf" "$D/m-timer.conf" <<'PY'
import re,sys
t=open(sys.argv[1]).read()
t=t.replace("    zindex = -2\n}","    zindex = -2\n    reload_time = 1\n}",1)
open(sys.argv[2],"w").write(t)
PY
expect_bad "amigara with a timer" amigara "$D/m-timer.conf"
python3 - "$D/watcher.conf" "$D/m-eye.conf" "$D/m-eye2.conf" <<'PY'
import sys
t=open(sys.argv[1]).read()
assert "reload_time" not in t.split("image {",1)[1].split("}",1)[0], "the watcher's eye must be a still"
assert "ito-lock-tick frame" not in t, "the watcher must not run the frame helper"
open(sys.argv[2],"w").write(t.replace("    zindex = 0\n}","    zindex = 0\n    reload_time = 1\n    reload_cmd = x\n}",1))
open(sys.argv[3],"w").write(t.replace("/eye.png","/00.png",1))
PY
if [[ $? -eq 0 ]]; then echo "ok   watcher conf: the eye is a still, no frame helper"; else echo "FAIL watcher conf is animated"; fail=1; fi
expect_bad "watcher eye with a reload timer" watcher "$D/m-eye.conf"
expect_bad "watcher eye that is not eye.png" watcher "$D/m-eye2.conf"
# the sheet scenes (tomie, pyramid, road, moth): drawn only when ito-assets recipe sheets wrote their pictures; RED cases on a fixture scene
SC=$(mktemp -d); trap 'rm -rf "$D" "$SC"' EXIT
python3 - "$SC" <<'PY'
import sys
from PIL import Image
for w, h in ((2560, 1440), (1920, 1080)):
    Image.new("RGB", (w, h), (13, 11, 11)).save(f"{sys.argv[1]}/tomie-{w}x{h}.png")
PY
ITO_LOCK_SCENE_DIR="$SC" "$LOCK" candidate --design tomie --out "$D" >/dev/null || { echo "FAIL: the tomie scene did not validate"; fail=1; }
if grep -q "/sc-[0-9a-f]\{12\}\.png" "$D/tomie.conf"; then echo "ok   tomie conf carries its scene layer"; else echo "FAIL tomie conf has no scene layer"; fail=1; fi
python3 - "$D/tomie.conf" "$D/m-sc-size.conf" "$D/m-sc-gone.conf" "$D" <<'PY'
import re, sys
from PIL import Image
t = open(sys.argv[1]).read()
m = re.search(r"path = (\S+/sc-[0-9a-f]{12}\.png)", t)
Image.new("RGB", (100, 100)).save(sys.argv[4] + "/sc-aaaaaaaaaaaa.png")
open(sys.argv[2], "w").write(t.replace(m.group(1), sys.argv[4] + "/sc-aaaaaaaaaaaa.png"))
open(sys.argv[3], "w").write(re.sub(r"^background \{\n(?:(?!^\}).)*zindex = -2\n\}\n*", "", t, count=1, flags=re.M | re.S))
PY
expect_bad "scene layer of the wrong size" tomie "$D/m-sc-size.conf"
expect_bad "scene without its scene layer" tomie "$D/m-sc-gone.conf"
sed 's/she remembers every face…/the fog waits for a name…/' "$D/tomie.conf" > "$D/m-sc-ph.conf"; expect_bad "scene with another design's placeholder" tomie "$D/m-sc-ph.conf"
for d in fog lantern amigara watcher tomie; do
  if "$LOCK" validate "$D/$d.conf" --design "$d" >/dev/null 2>&1; then echo "ok   generated $d passes"; else echo "FAIL generated $d"; fail=1; fi
done
exit $fail

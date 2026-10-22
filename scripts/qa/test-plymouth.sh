#!/usr/bin/env bash
# S-K gate on a fixture HOME and a fixture OMARCHY_PATH whose omarchy-plymouth-set/-reset are fakes (nothing real runs, sudo is
# never called): no TTY, a symlinked slot and an empty slot are refused; the official preview renders; apply records what it
# did; status flips to stale on a changed theme; reset asks.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PL="$REPO/bar/modules/bin/ito-plymouth"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
mkdir -p "$T/.config/omarchy/bar/modules" "$T/.config/ito/marks" "$T/op/bin" "$T/op/default"
cp -r /usr/share/omarchy/default/plymouth "$T/op/default/"
cp /usr/share/omarchy/bin/omarchy-plymouth-preview "$T/op/bin/"
printf '#!/bin/sh\necho "$@" >> "%s/set.log"\n' "$T" > "$T/op/bin/omarchy-plymouth-set"
printf '#!/bin/sh\necho reset >> "%s/set.log"\n' "$T" > "$T/op/bin/omarchy-plymouth-reset"
chmod +x "$T/op/bin/"*
echo '{}' > "$T/.config/omarchy/bar/modules/ito-style.json"
export HOME=$T OMARCHY_PATH=$T/op
# 1. no TTY: exit 1, no sudo
"$PL" apply </dev/null >/dev/null 2>&1; rc=$?
[[ $rc -eq 1 && ! -e $T/set.log ]] && ok "no TTY: apply exits 1 and never calls the set tool" || bad "no-TTY apply (rc=$rc)"
# 2. empty slot / symlinked slot (only when the composition uses the slot)
echo '{"bootComposition":"picture"}' > "$T/.config/omarchy/bar/modules/ito-style.json"
"$PL" compose >/dev/null 2>&1; [[ $? -eq 1 ]] && ok "empty slot: refused" || bad "empty slot accepted"
python3 -c "from PIL import Image; Image.new('RGBA',(64,64),(255,0,0,255)).save('$T/real.png')"
ln -s "$T/real.png" "$T/.config/ito/marks/_plymouth.png"
o=$("$PL" compose 2>&1); [[ $o == *symlink* ]] && ok "symlinked slot: refused" || bad "symlink accepted"
rm "$T/.config/ito/marks/_plymouth.png"; echo notanimage > "$T/.config/ito/marks/_plymouth.png"
"$PL" compose >/dev/null 2>&1; [[ $? -eq 1 ]] && ok "non-image slot: refused" || bad "non-image accepted"
rm "$T/.config/ito/marks/_plymouth.png"
# 3. the default composition (the shut eye) composes and previews through Omarchy's own tool, opening no window
echo '{}' > "$T/.config/omarchy/bar/modules/ito-style.json"
"$PL" preview | python3 -c "import json,sys; d=json.load(sys.stdin); from PIL import Image; im=Image.open(d['path']); assert im.size==(1920,1080)" && ok "the official preview renders (1920x1080)" || bad "preview"
# 3b. the boot cards: a card picture (cards/<scene>.png) fits 56 % of the smallest screen, keeps its alpha, takes the theme; without its
#     picture it falls back to the shut eye and says so (no tile); a light theme keeps the darks dark (never a negative)
mkdir -p "$T/.config/ito/assets/cards"
python3 - "$T/.config/ito/assets/cards/tomie.png" <<'PY'
import sys
from PIL import Image, ImageDraw
im = Image.new("RGBA", (1360, 1440), (13, 11, 11, 0)); d = ImageDraw.Draw(im)
d.rectangle([150, 150, 1210, 1290], fill=(13, 11, 11, 255)); d.rectangle([400, 400, 960, 1040], fill=(222, 214, 200, 255))
im.save(sys.argv[1])
PY
o=$(ITO_BOOT_SCREEN=1366x768 "$PL" compose --composition card-tomie)
python3 - "$o" <<'PY' && ok "card: 56 % of a 1366x768 screen, alpha kept, ground on the boot colour" || bad "card compose: $o"
import json, sys
from PIL import Image
d = json.loads(sys.argv[1]); im = Image.open(d["path"]).convert("RGBA")
assert d["missing_art"] is False and d["options"]["screen"] == [1366, 768], d
assert im.height == round(768 * 0.56) and im.height <= 0.6 * 768, im.size
assert im.getpixel((0, 0))[3] == 0 and im.getpixel((im.width // 2, im.height // 2))[3] == 255
c, g = im.getpixel((im.width // 2, im.height // 2)), im.getpixel((im.width // 2, round(im.height * 0.15)))
assert sum(c[:3]) > sum(g[:3]) + 300, (c, g)          # the bone square stays light over the dark ground (dark theme)
PY
printf 'background = "#f0f0f0"\nforeground = "#202020"\naccent = "#aa3344"\n' > "$T/light.toml"
o=$(ITO_LOCK_COLORS="$T/light.toml" ITO_BOOT_SCREEN=1920x1080 "$PL" compose --composition card-tomie)
python3 - "$o" <<'PY' && ok "card on a light theme: darks stay dark (a print, not a negative)" || bad "light card: $o"
import json, sys
from PIL import Image
im = Image.open(json.loads(sys.argv[1])["path"]).convert("RGBA")
c, g = im.getpixel((im.width // 2, im.height // 2)), im.getpixel((im.width // 2, round(im.height * 0.15)))
assert sum(c[:3]) > sum(g[:3]) + 300, (c, g)
PY
o=$("$PL" compose --composition card-moth)
[[ $(python3 -c "import json,sys; print(json.loads(sys.argv[1])['missing_art'])" "$o") == True ]] && ok "card without its picture: shut eye, missing_art" || bad "missing card: $o"
# 4. apply (with a TTY and a yes), status, stale on another theme
printf 'y\n' | script -qec "$PL apply" /dev/null >/dev/null 2>&1
grep -q '^#' "$T/set.log" && ok "apply ran the set tool with the ink, the text colour and a regular logo file" || bad "apply did not run the set tool: $(cat $T/set.log 2>&1)"
[[ -f $T/.config/ito/plymouth-applied.json ]] && ok "applied.json recorded" || bad "no applied.json"
"$PL" status | python3 -c "import json,sys; assert json.load(sys.stdin)['state']=='on'" && ok "status on after apply" || bad "status not on"
mkdir -p "$T/theme2"; printf 'background = "#102030"\nforeground = "#e0e0d0"\naccent = "#aa3344"\n' > "$T/theme2/colors.toml"
ITO_LOCK_COLORS="$T/theme2/colors.toml" "$PL" status | python3 -c "import json,sys; assert json.load(sys.stdin)['state']=='stale'" && ok "a changed theme flips it to stale" || bad "stale"
# 5. reset asks and calls Omarchy's reset
printf 'y\n' | script -qec "$PL reset" /dev/null >/dev/null 2>&1
grep -q reset "$T/set.log" && ok "reset ran Omarchy's reset" || bad "reset"
"$PL" reset </dev/null >/dev/null 2>&1; [[ $? -eq 1 ]] && ok "reset without a TTY: exit 1" || bad "reset no-TTY"
exit $fail

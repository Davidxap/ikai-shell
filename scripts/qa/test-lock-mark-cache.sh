#!/usr/bin/env bash
# The tinted lock mark is shared by every design and its file name carries a hash of the colours. A write for one design must
# never delete the file another design's model still names (the shell showed "Cannot open lock-mark-<hash>.png"), and a model
# that names a missing picture must read as stale, not as on. Fixture HOME only; nothing is locked.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOCK="$REPO/bar/modules/bin/ito-lock"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
H=$T/home; mkdir -p "$H/.config/omarchy/bar/modules/bin" "$H/.config/omarchy/hooks/theme-set.d" "$H/.config/omarchy/plugins" "$H/.config/ito/marks" "$H/.local/state/omarchy/current/theme"
cp "$HOME/.config/omarchy/shell.json" "$H/.config/omarchy/shell.json"
cp "$HOME/.local/state/omarchy/current/theme/colors.toml" "$H/.local/state/omarchy/current/theme/colors.toml"
cp "$REPO/bar/modules/bin/ito-lock-tick" "$H/.config/omarchy/bar/modules/bin/"
python3 -c "
from PIL import Image
im=Image.new('RGBA',(64,64),(0,0,0,0))
for x in range(16,48):
    for y in range(16,48): im.putpixel((x,y),(200,40,40,255))
im.save('$H/.config/ito/marks/testmark.png')"
echo '{"lockDesign":"fog","lockEngine":"ito-qs","menuMark":"custom:testmark"}' > "$H/.config/omarchy/bar/modules/ito-style.json"
export HOME=$H ITO_LOCK_OFFLINE=1
printf 'background = "#102030"\nforeground = "#e0e0d0"\naccent = "#aa3344"\n' > "$T/other.toml"
"$LOCK" apply --design fog >/dev/null 2>&1
a=$(ls "$H/.cache/ito"/lock-mark-*.png 2>/dev/null)
[[ -n $a ]] && ok "apply writes a tinted mark" || bad "no tinted mark after apply"
ITO_LOCK_COLORS="$T/other.toml" "$LOCK" preview --design lantern >/dev/null 2>&1
[[ -f $a ]] && ok "a write with other colours keeps the file a model still names" || bad "the mark named by model-fog.json was deleted"
rm -f "$a"
s=$("$LOCK" status 2>/dev/null)
python3 -c "import json,sys; d=json.loads(sys.argv[1]); assert d['state']!='on' and any(i['code']=='model_file_missing' for i in d['issues']), d" "$s" && ok "a model naming a missing picture is not 'on'" || bad "status ignores a missing model picture: $s"
exit $fail

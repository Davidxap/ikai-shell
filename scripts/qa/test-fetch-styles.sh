#!/usr/bin/env bash
# S16 gate on a fixture HOME: every fetch style draws 54-column boxes, the default style is today's config byte for byte,
# the engraving baked from a white-on-black picture is transparent where the ground was, and the pair is centred (lh parity).
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FF="$REPO/bar/modules/bin/ito-fastfetch"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir -p "$T/.config/ito/marks" "$T/.config/omarchy/branding" "$T/.config/omarchy/bar/modules" "$T/.config/fastfetch"
cp "$HOME/.config/omarchy/branding/about.txt" "$T/.config/omarchy/branding/"
python3 -I - "$T/.config/ito/marks/_fastfetch.png" <<'PY'
import sys; from PIL import Image, ImageDraw
im = Image.new("RGB", (400, 400), (0, 0, 0)); ImageDraw.Draw(im).ellipse((100, 100, 300, 300), outline=(255, 255, 255), width=12); im.save(sys.argv[1])
PY
export HOME=$T XDG_CONFIG_HOME=$T/.config ITO_STYLE_PATH=$T/.config/omarchy/bar/modules/ito-style.json
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
echo '{"fetchLogo":"picture"}' > "$ITO_STYLE_PATH"; "$FF" apply image >/dev/null; cp "$T/.config/fastfetch/config-ito-image.jsonc" "$T/default.jsonc"
echo '{"fetchLogo":"picture","fetchStyle":"ito","fetchPicture":"photo"}' > "$ITO_STYLE_PATH"; "$FF" apply image >/dev/null
cmp -s "$T/default.jsonc" "$T/.config/fastfetch/config-ito-image.jsonc" && ok "fetchStyle ito + fetchPicture photo == unset (byte for byte)" || bad "default config changed"
for st in ito rust otherworld chains ink eyes; do
  echo "{\"fetchLogo\":\"picture\",\"fetchStyle\":\"$st\"}" > "$ITO_STYLE_PATH"; "$FF" apply image >/dev/null
  python3 -I - "$T/.config/fastfetch/config-ito-image.jsonc" "$st" <<'PY' && ok "style $st: 6 frame lines of 54 columns" || bad "style $st widths"
import json, re, sys, unicodedata
body = "\n".join(l for l in open(sys.argv[1]) if not l.lstrip().startswith("//"))
fr = [m["format"] for m in json.loads(body)["modules"] if isinstance(m, dict) and m.get("type") == "custom" and re.search(r"[^\x00-\x7f]", m.get("format", ""))]
fr = [re.sub(r"\x1b\[[0-9;]*m", "", f) for f in fr]
w = lambda s: sum(2 if unicodedata.east_asian_width(c) in "WF" else 1 for c in s)
assert len(fr) == 6 and all(w(f) == 54 for f in fr), [(f, w(f)) for f in fr]
PY
  "$FF" preview --style "$st" >/dev/null && ok "preview --style $st" || bad "preview --style $st"
done
"$FF" preview --style bogus >/dev/null 2>&1 && bad "bogus style accepted" || ok "bogus style refused"
echo '{"fetchLogo":"picture","fetchPicture":"engraving"}' > "$ITO_STYLE_PATH"
python3 -I - "$FF" <<'PY' && ok "engraving: transparent ground, braille has no slab, lh parity centres the pair" || bad "engraving"
import json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(sys.argv[1])); import ito_fetch as F
from pathlib import Path
p, mode = F.bake_engraving(Path(os.environ["HOME"]) / ".config/ito/marks/_fastfetch.png", "auto", False)
import numpy as np
from PIL import Image
a = np.asarray(Image.open(p).convert("RGBA"))[..., 3]
assert mode == "lum" and a[0, 0] == 0 and a.max() == 255, (mode, a[0, 0], a.max())
lg = F.ImageLogo(p, None, "engraving", "engraving")
for mh in (9, 27, 29):
    lw, lh = lg.size(mh, 7.0, 16.5)
    assert (mh - lh) % 2 == 0 or mh - 3 < 1, (mh, lh)
    assert F.block(54, mh, lg, False, 7.0, 16.5)[0] == lw + F.GAP_ENGRAVING + 54
rows = lg.braille(*lg.size(27, 7.0, 16.5), False)
assert not any(r.startswith("⣿" * 8) for r in rows), "full block row"
PY
exit $fail

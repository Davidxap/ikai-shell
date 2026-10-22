#!/usr/bin/env bash
# S-I / F2 gate on a fixture HOME (nothing live is read or written): frame lines are 54 columns, every layout x logo
# renders with fastfetch (exit 0), the eye is deterministic and within its limits, a plain fastfetch prints no escape
# garbage in a terminal without the kitty protocol, the legacy launchers are removable, revert is byte-identical.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FF="$REPO/bar/modules/bin/ito-fastfetch"
ORIG_HOME=$HOME
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir -p "$T/.config/ito/marks" "$T/.config/omarchy/branding" "$T/.config/omarchy/bar/modules" "$T/.config/fastfetch"
cp "$HOME/.config/omarchy/branding/about.txt" "$T/.config/omarchy/branding/"
cp "$HOME/.config/ito/marks/_fastfetch.png" "$T/.config/ito/marks/" 2>/dev/null || python3 -c "from PIL import Image; Image.new('RGB',(400,400),(90,90,90)).save('$T/.config/ito/marks/_fastfetch.png')"
echo '{}' > "$T/.config/omarchy/bar/modules/ito-style.json"
export HOME=$T XDG_CONFIG_HOME=$T/.config ITO_STYLE_PATH=$T/.config/omarchy/bar/modules/ito-style.json
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
printf '// the user own config\n{"modules":["title"]}\n' > "$T/.config/fastfetch/config.jsonc"; cp "$T/.config/fastfetch/config.jsonc" "$T/own.jsonc"
"$FF" eye >/dev/null; a=$(md5sum "$T/.config/ito/fetch/eye.txt" | cut -d' ' -f1); rm "$T/.config/ito/fetch/eye.txt"; "$FF" eye >/dev/null; b=$(md5sum "$T/.config/ito/fetch/eye.txt" | cut -d' ' -f1)
[[ $a == "$b" ]] && ok "eye is deterministic" || bad "eye differs between two runs"
python3 - "$T/.config/ito/fetch/eye.txt" "$("$FF" eye)" <<'PY' && ok "eye is 54 x 26, blood <= 12 % of lit dots" || bad "eye limits"
import json,re,sys
rows=[re.sub(r"\$[1-9]","",l) for l in open(sys.argv[1]).read().splitlines()]
share=json.loads(sys.argv[2])["blood_share"]
assert len(rows)==26 and all(len(r)==54 for r in rows), (len(rows), {len(r) for r in rows})
assert share<=0.12, share
PY
for logo in omarchy eye picture; do
  echo "{\"fetchLogo\": \"$logo\"}" > "$ITO_STYLE_PATH"
  for layout in image compact text; do
    "$FF" apply "$layout" >/dev/null 2>&1
    f="$T/.config/fastfetch/config-ito-$layout.jsonc"
    if fastfetch -c "$f" --pipe >/dev/null 2>&1; then ok "fastfetch -c $layout x $logo exits 0"; else bad "fastfetch $layout x $logo"; fi
  done
done
echo '{}' > "$ITO_STYLE_PATH"
for term_want in ghostty:kitty-direct kitty:kitty-direct alacritty:chafa foot:chafa; do
  term=${term_want%%:*}; want=${term_want##*:}
  ITO_FETCH_TERMINAL=$term "$FF" apply image >/dev/null 2>&1
  got=$(python3 -c "import json,sys;print(json.loads('\n'.join(l for l in open(sys.argv[1]) if not l.lstrip().startswith('//')))['logo']['type'])" "$T/.config/fastfetch/config-ito-image.jsonc")
  [[ $got == "$want" ]] && ok "logo type for $term is $want" || bad "logo type for $term is $got, want $want"
done
ITO_FETCH_TERMINAL=ghostty "$FF" apply image --set-default >/dev/null 2>&1; s1=$("$FF" status | python3 -c "import json,sys;print(json.load(sys.stdin)['state'])")
python3 -c "from PIL import Image; Image.new('RGB',(300,300),(10,200,10)).save('$T/.config/ito/marks/_fastfetch.png')"
s2=$(ITO_FETCH_TERMINAL=ghostty "$FF" status | python3 -c "import json,sys;print(json.load(sys.stdin)['state'])")
[[ $s2 == stale ]] && ok "a new picture in the slot makes the applied config stale" || bad "picture change not seen ($s1 -> $s2)"
ITO_FETCH_TERMINAL=alacritty "$FF" apply image --set-default >/dev/null
python3 - "$T/.config/fastfetch/config.jsonc" <<'PY' && ok "every frame line is 54 columns (UTF-8 wc -L)" || bad "frame width"
import json,re,subprocess,sys
cfg=json.loads("\n".join(l for l in open(sys.argv[1]).read().splitlines() if not l.lstrip().startswith("//")))
n=0
for m in cfg["modules"]:
    f=m.get("format","") if isinstance(m,dict) else ""
    if re.match(r"^\x1b\[90m[┌└]",f):
        plain=re.sub(r"\x1b\[[0-9;?]*[a-zA-Z]","",f)
        w=int(subprocess.run(["wc","-L"],input=plain,capture_output=True,text=True,env={"LC_ALL":"C.UTF-8"}).stdout)
        assert w==54,(plain,w); n+=1
assert n==6, n
assert '"kitty-direct"' not in open(sys.argv[1]).read()
PY
for term in alacritty xterm-256color; do
  script -qec "stty cols 130 rows 40; env -u TERM_PROGRAM -u GHOSTTY_RESOURCES_DIR -u GHOSTTY_BIN_DIR -u GHOSTTY_SHELL_FEATURES -u KITTY_WINDOW_ID TERM=$term fastfetch" /dev/null | python3 -c "
import re,sys
d=sys.stdin.buffer.read().decode('utf-8','replace')
# fastfetch 2.70 opens with a kitty 'delete images' command (a=d) in every terminal; that is not a payload
sys.exit(1 if ('PNG' in d or re.search(r'\x1b_G(?!a=d)', d) or '1337;File' in d) else 0)" && ok "plain fastfetch in $term prints no image payload" || bad "payload in $term"
done
python3 - "$REPO/bar/modules/bin" <<'PY' && ok "frame: every W is exact, SGR only, no red, title validated" || bad "frame lines"
import re, sys
sys.path.insert(0, sys.argv[1])
import ito_fetch as F
for W in range(40, 260, 7):
    for name in ("ito.verse", "端子", "x" * 24):
        t, b = F.frame_top(W, name), F.frame_bottom(W)
        assert F.columns(F.strip_ansi(t)) == W and F.columns(F.strip_ansi(b)) == W, (W, name)
        for line in (t, b):
            for seq in re.findall(r"\x1b\[([0-9;]*)m", line):
                assert not (set(seq.split(";")) & {"31", "91", "41"}), seq        # no red in the frame
            assert "#" not in line                                              # no hex: the terminal palette drives it
assert F.valid_title("a\x1bb") == "ikai" and F.valid_title("y" * 25) == "ikai" and F.valid_title("") == "ikai"
assert F.valid_title("ito verse") == "ito verse"
PY
# The Control Centre preview is the real fastfetch run offscreen: compare it to an independent run (config applied the way the
# terminal reads it, parsed by the qa vt model) -- same text rows, same picture file, same cells (padding + width x height).
echo '{"fetchLogo": "picture"}' > "$ITO_STYLE_PATH"
ITO_FETCH_TERMINAL=ghostty "$FF" apply image >/dev/null 2>&1
PV=$(ITO_PREVIEW_RAW=$T/preview.raw ITO_FETCH_TERMINAL=ghostty "$FF" preview image)
python3 - "$T/.config/fastfetch/config-ito-image.jsonc" "$PV" "$REPO/scripts/qa" "$T/preview.raw" <<'PY' && ok "preview == real fastfetch: same rows, same picture, same placement" || bad "preview differs from the real fastfetch"
import json, sys
sys.path.insert(0, sys.argv[3]); import vt
cfg = json.loads("\n".join(l for l in open(sys.argv[1]) if not l.lstrip().startswith("//")))
item = json.loads(sys.argv[2])["items"][0]
assert item["real"] is True
sc = vt.Screen(160, 60); sc.feed(open(sys.argv[4], "rb").read())      # the bytes the real fastfetch wrote, parsed by the qa terminal model
real, prev = sc.lines(), item["text"]
assert real[:len(prev)] == prev and not any(l.strip() for l in real[len(prev):]), [(i, a, b) for i, (a, b) in enumerate(zip(real, prev)) if a != b][:3]
pl, lg = item["placements"], cfg["logo"]
assert len(pl) == 1 and len(sc.images) == 1 and pl[0]["path"] == lg["source"], (pl, sc.images)
assert (pl[0]["c"], pl[0]["r"]) == (lg["width"], lg["height"]), pl
assert pl[0]["col"] == lg["padding"]["left"] and pl[0]["row"] == lg["padding"]["top"], pl      # Omarchy's own placement
assert item["cols"] >= lg["padding"]["left"] + lg["width"] + lg["padding"]["right"]
PY
echo '{}' > "$ITO_STYLE_PATH"
# Legacy launchers (the About shadow, the `fastfetch` wrapper) are only ever removed: `wrapper --uninstall` deletes ours, leaves a foreign file alone
mkdir -p "$T/.local/bin"
printf '#!/bin/bash\n# ito-verse: generated by `ito-fastfetch wrapper --install`; remove with `ito-fastfetch wrapper --uninstall` or `ito-fastfetch revert`.\nexit 0\n' > "$T/.local/bin/fastfetch"
"$FF" wrapper --uninstall >/dev/null; [[ ! -e $T/.local/bin/fastfetch ]] && ok "wrapper --uninstall removes our legacy wrapper" || bad "legacy wrapper kept"
echo "someone else" > "$T/.local/bin/fastfetch"
"$FF" wrapper --uninstall >/dev/null; [[ $(cat "$T/.local/bin/fastfetch") == "someone else" ]] && ok "a foreign fastfetch is left alone" || bad "foreign file changed"
rm -f "$T/.local/bin/fastfetch"
! grep -q "centre_modules\|def cmd_show\|def cmd_about" "$FF" && ok "no custom centring, show or About code is left" || bad "centring code present"
"$FF" apply >/dev/null 2>&1      # the style changed above ({}): an apply brings the config, our default copy included, up to date
"$FF" status | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['state']=='on', d['state']" && ok "status on after apply" || bad "status"
# a plain apply after the picture changed redraws our default copy too (it used to stay "stale" forever)
"$FF" apply image --set-default >/dev/null 2>&1
python3 -c "from PIL import Image; Image.new('RGB',(400,400),(30,60,90)).save('$T/.config/ito/marks/_fastfetch.png')"
"$FF" status | python3 -c "import json,sys; assert json.load(sys.stdin)['state']=='stale'" && ok "a new picture makes the fetch out of date" || bad "stale after picture change"
"$FF" apply >/dev/null 2>&1
"$FF" status | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['state']=='on', d['state']" && ok "a plain apply brings the default copy up to date" || bad "plain apply leaves the default stale"
"$FF" revert >/dev/null
cmp -s "$T/.config/fastfetch/config.jsonc" "$T/own.jsonc" && ok "revert gives your config back byte for byte" || bad "revert"
exit $fail

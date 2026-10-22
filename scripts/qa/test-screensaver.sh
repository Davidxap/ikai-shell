#!/usr/bin/env bash
# S-J / F2 gate on a fixture HOME (nothing live is touched, nothing is started): the text sets are deterministic, within 70 x 26
# and never name the project; the timing truth follows shell.json; screensaver-off blocks `start`; the colour flags come from
# the theme; the launcher is Omarchy's with exactly one change; revert keeps a later hand edit of hypridle.conf.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SS="$REPO/bar/modules/bin/ito-screensaver"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
mkdir -p "$T/.config/omarchy/bar/modules" "$T/.config/omarchy/branding" "$T/.config/hypr" "$T/.local/state/omarchy/toggles" "$T/.config/ito"
echo '{"idle":{"lock":300,"screensaver":150}}' > "$T/.config/omarchy/shell.json"
echo '{}' > "$T/.config/omarchy/bar/modules/ito-style.json"
printf 'general {\n}\nlistener {\n    timeout = 300\n    on-timeout = pidof hyprlock || hyprlock\n}\n' > "$T/.config/hypr/hypridle.conf"
export HOME=$T ITO_SCREENSAVER_OFFLINE=1
for set in spiral eye fog; do
  echo "{\"screensaverText\":\"$set\"}" > "$T/.config/omarchy/bar/modules/ito-style.json"
  "$SS" apply-text >/dev/null; a=$(md5sum "$T/.config/omarchy/branding/screensaver.txt" | cut -d' ' -f1)
  rm "$T/.config/omarchy/branding/screensaver.txt"; "$SS" apply-text >/dev/null; b=$(md5sum "$T/.config/omarchy/branding/screensaver.txt" | cut -d' ' -f1)
  [[ $a == "$b" ]] && ok "$set: two runs, same bytes" || bad "$set differs between runs"
  python3 - "$T/.config/omarchy/branding/screensaver.txt" "$set" <<'PY' && ok "$set: <= 70 columns, <= 26 rows, no project name" || bad "$set limits"
import re,sys,unicodedata
t=open(sys.argv[1]).read()
rows=t.splitlines()
w=lambda s: sum(2 if unicodedata.east_asian_width(c) in "WF" else 1 for c in s)
assert len(rows)<=26 and max(w(r) for r in rows)<=70, (len(rows), max(w(r) for r in rows))
assert not re.search(r"ito.?.?verse|\bITO\b", t, re.I)
PY
done
# timing truth
echo '{}' > "$T/.config/omarchy/bar/modules/ito-style.json"; "$SS" apply >/dev/null
"$SS" status | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['starts_after']==150 and d['timer_owner']=='omarchy' and not d['idle_installed'], d" && ok "Omarchy's 150 s is the timer; apply installed no listener" || bad "timing truth"
grep -q "ito-verse screensaver" "$T/.config/hypr/hypridle.conf" && bad "a listener was installed without hyprlock owning the lock" || ok "no hypridle listener unless hyprlock owns the lock"
# screensaver-off blocks start
touch "$T/.local/state/omarchy/toggles/screensaver-off"
"$SS" start | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['started'] is False" && ok "screensaver-off blocks start" || bad "start ran with screensaver-off"
rm "$T/.local/state/omarchy/toggles/screensaver-off"
# colours from the theme, every effect
python3 - "$SS" <<'PY' && ok "colour flags from the theme for all eight effects, no '#'" || bad "colour flags"
import json,subprocess,sys
d=json.loads(subprocess.run([sys.argv[1],"effects"],capture_output=True,text=True).stdout)
assert len(d["ito"])==8 and len(d["all"])>=30
PY
for e in smoke rings blackhole crumble vhstape burn spotlights swarm; do
  echo "{\"screensaverEffect\":\"$e\"}" > "$T/.config/omarchy/bar/modules/ito-style.json"
  "$SS" run --dry-run | python3 -c "
import json,sys
d=json.load(sys.stdin); a=d['argv']
assert '$e' in a and not any('#' in x for x in a[a.index('$e'):]), a
assert any(x.startswith('--') and 'color' in x or 'gradient' in x for x in a[a.index('$e'):]) or '$e' in ('swarm',), a" && ok "$e: argv built" || bad "$e argv"
done
# the launcher is Omarchy's with one change
diff <(sed -e '/# ito-fullscreen-begin/,/# ito-fullscreen-end/d' -e '/^  opened=$/d' -e '/^  ensure_fullscreen$/d' -e 's/&& { opened=.*return 0; }/\&\& return 0/' -e 's/-e "\$ITO_RUN" run/-e omarchy-screensaver/' "$REPO/bar/modules/bin/ito-screensaver-launch" | tail -n +8) <(tail -n +3 /usr/share/omarchy/bin/omarchy-launch-screensaver) | grep -vE '^[0-9,c]+$|^---$|omarchy:summary|^[<>] *$' | grep -q . && bad "launcher differs from Omarchy's beyond the one line" || ok "launcher = Omarchy's, plus the runner line and the fullscreen guard"
# revert is strip-only
echo '{"lockEngine":"hyprlock"}' > "$T/.config/omarchy/bar/modules/ito-style.json"; "$SS" install-idle >/dev/null 2>&1
echo '# hand edit' >> "$T/.config/hypr/hypridle.conf"; "$SS" revert >/dev/null
grep -q "hand edit" "$T/.config/hypr/hypridle.conf" && ok "revert keeps a later hand edit" || bad "revert lost the hand edit"
exit $fail

#!/usr/bin/env bash
# Gate for bin/ito-compat (upgrade-drift detector): ok on the real machine, and every kind of drift is reported with
# what changed / is it safe / fix, on fixtures only (a fake HOME, a fake Omarchy shell dir, a fake verified.json).
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
C="$REPO/bar/modules/bin/ito-compat"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
export HOME=$T ITO_REPO="$REPO"
# 0. the recorded file and its deployed copy are the same bytes
cmp -s "$REPO/compat/verified.json" "$REPO/bar/modules/compat/verified.json" && ok "compat/verified.json == bar/modules/compat/verified.json" || bad "deployed copy differs: run scripts/sync-compat.sh --record"
# 1. the recorded surface is what a fresh scan finds today (a new omarchy-* command or /usr/share/omarchy read must be recorded)
"$C" scan > "$T/scan.json" 2>/dev/null
python3 - "$REPO/compat/verified.json" "$T/scan.json" <<'PY' && ok "recorded surface == fresh scan (paths, commands, Commons members, Ui types)" || bad "surface changed: run scripts/sync-compat.sh --record after checking"
import json,sys
v=json.load(open(sys.argv[1])); s=json.load(open(sys.argv[2]))
for k in ("paths","commands","commons","ui"):
    assert v[k]==s[k], (k, sorted(set(map(str,s[k]))^set(map(str,v[k]))) if k!="commons" else (v[k],s[k]))
PY
# 2. fixtures: a fake shell dir with the Commons members our code needs, a verbatim copy and a fake verified file
SH="$T/shell"; mkdir -p "$SH/Commons" "$SH/Ui" "$T/.config/omarchy/plugins/ito.lock" "$T/bin"
printf 'pragma Singleton\nimport QtQuick\nQtObject { readonly property color accent: "red"\n function mix() {} }\n' > "$SH/Commons/Color.qml"
printf 'import QtQuick\nItem {}\n' > "$SH/Ui/Button.qml"
printf 'source v1\n' > "$T/Service.qml"; sha256sum "$T/Service.qml" | cut -d' ' -f1 > "$T/.config/omarchy/plugins/ito.lock/service.sha256"
printf '#!/bin/sh\n' > "$T/bin/omarchy-fake"; chmod +x "$T/bin/omarchy-fake"
mkfile() { # $1 omarchy version
python3 - "$T" "$1" <<'PY'
import json,sys
t,ver=sys.argv[1:3]
json.dump({"schema":1,"verifiedOn":"2026-01-01","versions":{"omarchy":ver,"quickshell":"","qt6-base":"","hyprland":""},
 "verbatim":[{"id":"lock-service","label":"ito.lock Service.qml","source":t+"/Service.qml","hashFile":"plugins/ito.lock/service.sha256","fix":"run sync-ito-lock.sh"}],
 "paths":[t+"/shell"],"commands":["omarchy-fake"],"commons":{"Color":["accent","mix"]},"ui":["Button"]},open(t+"/v.json","w"))
PY
}
export ITO_COMPAT_FILE="$T/v.json" ITO_COMPAT_SHELL="$SH" PATH="$T/bin:$PATH"
# a fake pacman so the "installed" versions are ours
printf '#!/bin/sh\n[ "$2" = omarchy ] && echo "omarchy ${FAKE_OMARCHY:-4.0.6-1}" && exit 0\nexit 1\n' > "$T/bin/pacman"; chmod +x "$T/bin/pacman"
mkfile 4.0.6-1
out=$("$C" check); rc=$?; [[ $out == ok && $rc == 0 ]] && ok "no drift: prints ok, exit 0" || bad "expected ok, got rc=$rc: $out"
# 3. patch bump: noted, still exit 0
out=$(FAKE_OMARCHY=4.0.7-1 "$C" check); rc=$?; [[ $rc == 0 && $out == *"4.0.7-1"* && $out == *"is it safe"* && $out == *"fix:"* ]] && ok "patch update: noted with safe/fix, exit 0" || bad "patch bump rc=$rc: $out"
# 4. minor bump: drift, exit 1
out=$(FAKE_OMARCHY=4.1.0-1 "$C" check); rc=$?; [[ $rc == 1 && $out == *"4.1.0-1"* ]] && ok "minor update: drift, exit 1" || bad "minor bump rc=$rc: $out"
# 5. verbatim source changed
printf 'source v2\n' > "$T/Service.qml"
out=$("$C" check); rc=$?; [[ $rc == 1 && $out == *"changed since the copy"* && $out == *"sync-ito-lock.sh"* ]] && ok "verbatim copy drift reported with its fix" || bad "verbatim rc=$rc: $out"
printf 'source v1\n' > "$T/Service.qml"
# 6. command, path, Commons member and Ui type vanish: broken, exit 2, each named
rm "$T/bin/omarchy-fake"; rmdir "$SH/Ui" 2>/dev/null; rm "$SH/Ui/Button.qml"; printf 'pragma Singleton\nimport QtQuick\nQtObject { }\n' > "$SH/Commons/Color.qml"; mv "$SH" "$SH.gone"; mkdir -p "$SH/Commons" "$SH/Ui"; command cp "$SH.gone/Commons/Color.qml" "$SH/Commons/"
out=$("$C" check); rc=$?
[[ $rc == 2 && $out == *"omarchy-fake is gone"* && $out == *"Commons.Color lost: accent, mix"* && $out == *"component Button is gone"* ]] && ok "missing command / Commons member / Ui type: broken, exit 2" || bad "broken rc=$rc: $out"
rmdir "$SH" 2>/dev/null; rm -rf "$SH"; out=$("$C" check); [[ $out == *"no longer has $T/shell"* ]] && ok "missing path named" || bad "path: $out"
# 7. no verified file: broken with the record hint
rm "$T/v.json"; out=$("$C" check); rc=$?; [[ $rc == 2 && $out == *"sync-compat.sh --record"* ]] && ok "no verified.json: says how to record it" || bad "nofile rc=$rc: $out"
# 8. json is valid and carries state
mkfile 4.0.6-1; "$C" json > "$T/j.json"; python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); assert d["state"] in ("ok","drift","broken") and "items" in d' "$T/j.json" && ok "json valid" || bad "json: $(head -c 300 "$T/j.json")"
# 9. --record refuses without a terminal and without --yes
out=$("$REPO/scripts/sync-compat.sh" --record </dev/null 2>&1); [[ $? == 1 && $out == *refusing* ]] && ok "--record refuses without a terminal" || bad "--record guard: $out"
exit $fail

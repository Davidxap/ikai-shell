#!/usr/bin/env bash
# S-G / S-H gate on a fixture HOME: `ito-lock own` prints the exact change, refuses without a TTY (exit 1, nothing changed),
# applies what it printed, and `--undo` puts shell.json back byte for byte. The plugin's Service.qml differs from Omarchy's
# only in its header and the view name. Nothing live is read; nothing is locked.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOCK="$REPO/bar/modules/bin/ito-lock"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
mkdir -p "$T/.config/omarchy/plugins" "$T/.config/omarchy/bar/modules" "$T/.config/ito"
cp -r "$REPO/plugins/ito.lock" "$T/.config/omarchy/plugins/"
cp /usr/share/omarchy/config/omarchy/shell.json "$T/.config/omarchy/shell.json"     # Omarchy's defaults, not the live file: once the user owns the lock the live one is already "as it should be"
echo '{}' > "$T/.config/omarchy/bar/modules/ito-style.json"
mkdir -p "$T/.config/omarchy/bar/modules/bin" "$T/.config/omarchy/hooks/theme-set.d"
cp "$REPO/bar/modules/bin/ito-lock-tick" "$T/.config/omarchy/bar/modules/bin/"
export HOME=$T ITO_LOCK_OFFLINE=1
SJ="$T/.config/omarchy/shell.json"; before=$(md5sum "$SJ" | cut -d' ' -f1)
# 1. static: the copy differs from Omarchy's Service.qml only in its header and the view name
if diff <(tail -n +4 "$REPO/plugins/ito.lock/Service.qml" | sed 's/ItoLockView/LockView/') /usr/share/omarchy/shell/plugins/lock/Service.qml >/dev/null; then ok "Service.qml = Omarchy's, but the header and the view name"; else bad "Service.qml drifted from Omarchy's"; fi
[[ $(cut -c1-64 "$REPO/plugins/ito.lock/service.sha256") == $(sha256sum /usr/share/omarchy/shell/plugins/lock/Service.qml | cut -c1-64) ]] && ok "service.sha256 matches Omarchy's current file" || bad "service.sha256 is stale: run scripts/sync-ito-lock.sh"
python3 - "$REPO/plugins/ito.lock/manifest.json" <<'PY' && ok "manifest: id ito.lock, clonedFrom omarchy.lock, authentication" || bad "manifest"
import json,sys
m=json.load(open(sys.argv[1]))
assert m["id"]=="ito.lock" and m["omarchy"]["clonedFrom"]=="omarchy.lock" and "authentication" in m["omarchy"]["capabilities"]
assert m["kinds"]==["service"] and m["entryPoints"]["service"]=="Service.qml" and m.get("keepLoaded") is True
PY
# 2. dry run prints the diff and writes nothing
out=$("$LOCK" own ito-qs --dry-run 2>&1); echo "$out" | grep -q '"ito.lock"' && ok "dry run prints the shell.json diff" || bad "dry run diff"
[[ $(md5sum "$SJ" | cut -d' ' -f1) == "$before" ]] && ok "dry run wrote nothing" || bad "dry run changed shell.json"
# 3. no TTY: refused, exit 1, nothing changed
"$LOCK" own ito-qs </dev/null >/dev/null 2>&1; rc=$?
[[ $rc -eq 1 && $(md5sum "$SJ" | cut -d' ' -f1) == "$before" ]] && ok "no TTY: exit 1, nothing changed" || bad "no-TTY run (rc=$rc)"
# 4. with a TTY and a yes: applied, backed up
printf 'y\n' | script -qec "$LOCK own ito-qs" /dev/null >/tmp/own-run.$$ 2>&1
python3 - "$SJ" <<'PY' && ok "applied: ito.lock enabled, omarchy.lock disabled, restore recorded" || bad "applied state"
import json,sys
c=json.load(open(sys.argv[1]))
ids=[p.get("id") for p in c["plugins"] if isinstance(p,dict)]
assert "ito.lock" in ids and "omarchy.lock" in c["disabledPlugins"] and "ito.lock" in c["cloneSourceRestores"]
PY
"$LOCK" status | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['engine']=='ito-qs'; [d[k] for k in ('state','applied','current_inputs','in_charge','issues','conflicts','installed','design')]" && ok "status keeps its shape with engine ito-qs" || bad "status shape"
ls "$T/.cache/ito/lock/model-current.json" >/dev/null 2>&1 && ok "the model for the Quickshell view was written" || bad "no model written"
# 5. the printed diff is the applied diff (the +/- lines of what own printed equal the lines that really changed)
python3 - "$T" /tmp/own-run.$$ <<'PY' && ok "the diff that was printed is the diff that was applied" || bad "printed diff != applied diff"
import difflib, re, sys, glob
t, log = sys.argv[1:]
b = open(glob.glob(t + "/.config/ito/backups/own/*/shell.json")[0]).read().splitlines()
a = open(t + "/.config/omarchy/shell.json").read().splitlines()
real = [l for l in difflib.unified_diff(b, a, "x", "y", lineterm="", n=1) if l[:1] in "+-" and l[:3] not in ("+++", "---")]
printed = [l.rstrip("\r") for l in open(log, errors="replace").read().splitlines() if l[:1] in "+-" and l[:3] not in ("+++", "---")]
assert real and real == printed, (len(real), len(printed))
PY
# 6. undo restores byte for byte
printf 'y\n' | script -qec "$LOCK own --undo" /dev/null >/dev/null 2>&1
[[ $(md5sum "$SJ" | cut -d' ' -f1) == "$before" ]] && ok "--undo: shell.json is byte-identical to before" || bad "undo is not byte-identical"
"$LOCK" status | python3 -c "import json,sys; assert json.load(sys.stdin)['engine']=='hyprlock'" && ok "--undo: the owner is back to hyprlock" || bad "owner after undo"
rm -f /tmp/own-run.$$
exit $fail

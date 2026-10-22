#!/usr/bin/env bash
# ito-lock chain / status v2 against fixture HOMEs (dev/fixtures/home-{omarchy,hyprlock,mixed}). Never touches the
# live files: every run gets a throw-away HOME, ITO_LOCK_OFFLINE=1 keeps hyprctl/pgrep/systemctl out of it, and
# nothing here locks (only `chain`, `status` and `apply` into the fixture HOME are run).
#   scripts/qa/test-lock-status.sh [path/to/ito-lock]
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOCK=${1:-$REPO/bar/modules/bin/ito-lock}
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
fails=0
check() { if eval "$2"; then echo "ok   $1"; else echo "FAIL $1"; fails=$((fails + 1)); fi; }

mkhome() {   # mkhome NAME -> prints the HOME path
  local h="$TMP/$1"
  cp -a "$REPO/dev/fixtures/home-$1" "$h"
  grep -rl __HOME__ "$h" 2>/dev/null | xargs -r sed -i "s#__HOME__#$h#g"
  mkdir -p "$h/.config/omarchy/bar/modules" "$h/.local/state/omarchy/current/theme"
  ln -s "$REPO/bar/modules/bin" "$h/.config/omarchy/bar/modules/bin"
  cp "$HOME/.local/state/omarchy/current/theme/colors.toml" "$h/.local/state/omarchy/current/theme/colors.toml"
  echo '{"lockDesign": "fog"}' > "$h/.config/omarchy/bar/modules/ito-style.json"
  echo "$h"
}
run() {   # run HOME args... (offline, fixture Omarchy bin)
  local h=$1; shift
  HOME=$h ITO_LOCK_OFFLINE=1 ITO_OMARCHY_BIN=$h/omarchy-bin "$LOCK" "$@"
}
jq_() { python3 -c "import json,sys; d=json.loads(sys.stdin.read()); print($1)"; }

# --- chain ---------------------------------------------------------------------------------------------------
for name in omarchy hyprlock mixed; do
  H=$(mkhome $name); touch "$TMP/stamp-$name"; sleep 0.05
  C=$(run "$H" chain); S=$(run "$H" status)
  check "$name: chain is one JSON line with paths" "[[ \$(jq_ 'len(d[\"paths\"])' <<<\"\$C\") -ge 3 ]]"
  check "$name: chain and status write nothing" "[[ -z \$(find \"$H\" -newer \"$TMP/stamp-$name\" -type f) ]]"
  eval "C_$name=\$C; H_$name=\$H"
done
check "omarchy: every path is omarchy-shell" "[[ \$(jq_ 'sorted({p[\"engine\"] for p in d[\"paths\"]})' <<<\"\$C_omarchy\") == \"['omarchy-shell']\" ]]"
check "omarchy: four path kinds" "[[ \$(jq_ 'len({p[\"path\"] for p in d[\"paths\"]})' <<<\"\$C_omarchy\") == 4 ]]"
check "omarchy: no conflicts" "[[ \$(jq_ 'd[\"conflicts\"]' <<<\"\$C_omarchy\") == '[]' ]]"
check "hyprlock: every path is hyprlock" "[[ \$(jq_ 'sorted({p[\"engine\"] for p in d[\"paths\"]})' <<<\"\$C_hyprlock\") == \"['hyprlock']\" ]]"
check "hyprlock: menu override read" "[[ \$(jq_ '[p[\"origin\"] for p in d[\"paths\"] if p[\"path\"]==\"menu\"][0]' <<<\"\$C_hyprlock\") == override ]]"
check "hyprlock: stay awake respected by nobody" "[[ \$(jq_ 'd[\"stay_awake_respected_by\"]' <<<\"\$C_hyprlock\") == '[]' ]]"
check "mixed: two schedulers lock at 300 s" "jq_ 'd[\"conflicts\"]' <<<\"\$C_mixed\" | grep -q 'two schedulers lock at 300 s'"
check "mixed: chain_mixed issue" "jq_ '[i[\"code\"] for i in d[\"issues\"]]' <<<\"\$C_mixed\" | grep -q chain_mixed"
check "mixed: dangling lock-explorer reported" "jq_ '[i[\"code\"] for i in d[\"issues\"]]' <<<\"\$C_mixed\" | grep -q dangling_lock_plugin"

# --- status states (hyprlock engine) ---------------------------------------------------------------------------
check "off before any apply" "[[ \$(run \"$H_hyprlock\" status | jq_ 'd[\"state\"]') == off ]]"
run "$H_hyprlock" apply >/dev/null 2>&1
check "on after apply (4/4 hyprlock)" "[[ \$(run \"$H_hyprlock\" status | jq_ 'd[\"state\"]') == on ]]"
check "header carries the inputs hash" "grep -qE '^# ito-inputs: [0-9a-f]{12}$' \"$H_hyprlock/.config/hypr/hyprlock.conf\""
sed 's/^accent = .*/accent = "#123456"/; s/^foreground = .*/foreground = "#fedcba"/' \
  "$H_hyprlock/.local/state/omarchy/current/theme/colors.toml" > "$TMP/colors-other.toml"
check "a theme copy flips it to stale" "[[ \$(ITO_LOCK_COLORS=$TMP/colors-other.toml run \"$H_hyprlock\" status | jq_ 'd[\"state\"]') == stale ]]"
mv "$H_hyprlock/.config/omarchy/hooks/theme-set.d/60-ito-lock.sh" "$TMP/hook"
check "missing hook is partial" "[[ \$(run \"$H_hyprlock\" status | jq_ 'd[\"state\"]') == partial ]]"
mv "$TMP/hook" "$H_hyprlock/.config/omarchy/hooks/theme-set.d/60-ito-lock.sh"
cp "$H_hyprlock/.config/hypr/hyprlock.conf" "$TMP/good.conf"
python3 - "$H_hyprlock/.config/hypr/hyprlock.conf" <<'PY'
import re, sys
p = sys.argv[1]; t = open(p).read()
open(p, "w").write(re.sub(r"^input-field \{.*?^\}\n", "", t, flags=re.M | re.S))
PY
check "a hand-broken conf is error" "[[ \$(run \"$H_hyprlock\" status | jq_ 'd[\"state\"]') == error ]]"
cp "$TMP/good.conf" "$H_mixed/.config/hypr/hyprlock.conf.tmp" 2>/dev/null
run "$H_mixed" apply >/dev/null 2>&1
check "mixed chain is blocked" "[[ \$(run \"$H_mixed\" status | jq_ 'd[\"state\"]') == blocked ]]"
check "status keeps the v1 keys" "[[ \$(run \"$H_mixed\" status | jq_ 'all(k in d for k in (\"installed\",\"design\",\"hook\",\"backup\",\"picture\",\"background\"))') == True ]]"

# --- guard: a stale `locked` (status says locked with nothing behind it) is found; nothing is restarted or locked offline ---
g() { ITO_LOCK_STATUS_JSON="$1" run "$H_mixed" guard "${@:2}"; }
S_STUCK='{"locked":true,"requested":false,"sessionLocked":false,"secure":false}'
S_OPEN='{"locked":false,"requested":false,"sessionLocked":false,"secure":false}'
S_LOCK='{"locked":true,"requested":false,"sessionLocked":true,"secure":true}'
check "guard: stale locked is stuck (exit 1)" "g '$S_STUCK' >/dev/null; [[ \$? -eq 1 ]]"
check "guard: unlocked is ok (exit 0)" "g '$S_OPEN' >/dev/null; [[ \$? -eq 0 ]]"
check "guard: really locked is ok" "[[ \$(g '$S_LOCK' | jq_ 'd[\"state\"]') == ok ]]"
check "guard: no answer is unreachable (exit 2)" "g 'nonsense' >/dev/null; [[ \$? -eq 2 ]]"
check "guard --lock on a stuck service plans restart then lock" "[[ \$(g '$S_STUCK' --lock | jq_ 'd[\"action\"]') == 'restart lock' ]]"
check "guard --fix never locks" "[[ \$(g '$S_STUCK' --fix | jq_ 'd[\"action\"]') == restart ]]"
check "guard rejects unknown options" "g '$S_OPEN' --now >/dev/null 2>&1; [[ \$? -eq 1 ]]"

echo "---"; [[ $fails -eq 0 ]] && echo "all passed" || echo "$fails failed"
exit $((fails > 0))

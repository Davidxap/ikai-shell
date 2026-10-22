#!/usr/bin/env bash
# Deploy the repo onto the live shell, keeping what belongs to the user: the sidecar settings
# (ito-style.json) and the suite markers. Regenerates the markers afterwards. Restarts nothing.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIVE="$HOME/.config/omarchy"
# Pre-check: the style contract (docs/STYLE_CONTRACT.md) must be green before anything is copied.
"$REPO/scripts/qa/test-style-contract.sh" >/dev/null || { echo "deploy stopped: scripts/qa/test-style-contract.sh failed"; exit 1; }
"$REPO/scripts/qa/check-qt-color.sh" >/dev/null || { echo "deploy stopped: scripts/qa/check-qt-color.sh failed"; exit 1; }
# Bar-size art: the new set (workspaces/bar/) blocks the deploy; the old 256 px sets are only reported.
python3 "$REPO/scripts/qa/test-hd-tiers.py" >/dev/null || { echo "deploy stopped: scripts/qa/test-hd-tiers.py failed (a family lacks a tier or fails fill / black; run it for the per-family table)"; exit 1; }
python3 "$REPO/scripts/qa/test-barsize-legibility.py" --no-old >/dev/null || { echo "deploy stopped: scripts/qa/test-barsize-legibility.py failed (bar-size set)"; exit 1; }
python3 "$REPO/scripts/qa/test-barsize-legibility.py" 2>/dev/null | sed -n '/^== old/,$p' | grep -c '^info-FAIL' | sed 's/^/old 256 px art, legibility FAIL (report only): /' || true
keep="$(mktemp)"
cp "$LIVE/bar/modules/ito-style.json" "$keep" 2>/dev/null || true
# The running shell reloads a plugin the moment its files change, and a reload can leave the old generation's bar
# window on screen beside the new one (two bars). So when anything under plugins/ or the modules' QML changed and a
# shell is running, it is restarted cleanly afterwards instead of being left to reload itself.
# The running shell reloads a plugin the moment its files change. A reload while the engine's signature is stale retires
# the Ito-verse bar for good (the engine then falls back to another bar and rewrites shell.json), and a reload can also
# leave the old generation's bar on screen beside the new one. So when there is anything to copy and a shell is
# running, the shell is stopped first, the files are copied, the signature is made to match, and it is started again.
# What would actually change: a checksum comparison, leaving out what is the user's or generated (settings, signatures).
pending=0
pairs=("bar/modules|$LIVE/bar/modules" "themes/ito-verse|$LIVE/themes/ito-verse")
for d in "$REPO"/plugins/ito.*; do
  [[ -d $d && $(basename "$d") != ito.shell ]] && pairs+=("plugins/$(basename "$d")|$LIVE/plugins/$(basename "$d")")
done
for pair in "${pairs[@]}"; do
  n=$(rsync -rcn --out-format=%n --exclude=.ito-managed.json --exclude=ito-style.json --exclude=__pycache__ \
        "$REPO/${pair%%|*}/" "${pair##*|}/" 2>/dev/null | grep -vc '/$' || true)
  pending=$((pending + n))
done
was_running=0; pgrep -x quickshell >/dev/null && was_running=1
if [[ $pending -gt 0 && $was_running == 1 ]]; then
  "$LIVE/bar/modules/bin/ito-restart" stop >/dev/null 2>&1 || true
fi
"$REPO/scripts/sync.sh" push >/dev/null 2>&1
changed=0; [[ $pending -gt 0 ]] && changed=1
[[ -s $keep ]] && cp "$keep" "$LIVE/bar/modules/ito-style.json"
rm -f "$keep"
# The running shell reloads a plugin as soon as its files change, and it retires for good if the markers do not
# match the payload at that moment. So the markers are written only when they are stale, never as a matter of course.
if ! python3 "$REPO/scripts/gen-itobar-marker.py" --check >/dev/null 2>&1; then
  python3 "$REPO/scripts/gen-itobar-marker.py" | tail -1
  changed=1
fi
# shell-switch swaps in ~/.config/omarchy/shell.ito.json; on a machine that never ran Ito-verse nothing has made it yet.
# It is built from the user's own shell.json plus the Ito-verse bar (seed/), and never overwrites an existing one.
python3 "$REPO/scripts/seed-variant.py" >/dev/null 2>&1 || true
if [[ $was_running == 1 && ( $changed == 1 || $pending -gt 0 ) ]]; then
  echo "files changed: restarting the shell once, cleanly"
  "$LIVE/bar/modules/bin/ito-restart" start >/dev/null 2>&1 || "$LIVE/bar/modules/bin/ito-restart" >/dev/null
fi

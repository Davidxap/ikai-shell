#!/usr/bin/env bash
# Live check: opens every popup through its IPC target and prints how far the popup's centre is from its icon's centre.
# Needs the real shell. Turns the sidecar flag `debugAnchor` on for the run and puts it back on exit (also on Ctrl-C).
# Usage: scripts/qa/popup-anchor-live.sh [presence=true|false] [frameStyle=manga|chains|minimal]   (those two are set for the run and restored)
set -u
CFG="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/bar/modules/bin/ito-config"
declare -A OLD
restore() {
  for k in debugAnchor presence frameStyle; do
    if [[ ${OLD[$k]:-unset} == unset ]]; then "$CFG" unset "$k" >/dev/null 2>&1; else "$CFG" set "$k" "${OLD[$k]}" >/dev/null 2>&1; fi
  done
}
for k in debugAnchor presence frameStyle; do OLD[$k]=$("$CFG" get "$k" unset); done
trap restore EXIT INT TERM
for a in "$@"; do "$CFG" set "${a%%=*}" "${a#*=}" >/dev/null; done
"$CFG" set debugAnchor true >/dev/null
sleep 1
# target:emblem the frame logs (weather draws its own window, read from the layer surface)
TARGETS="omarchy.audio omarchy.bluetooth ito.processor ito.memory ito.storage omarchy.monitor ito.player omarchy.network ito.notifycenter omarchy.power ito.calendar ito.weather ito.aiusage"
printf '%-18s %8s %8s %8s %8s %s\n' target iconCx popCx dx topY note
for t in $TARGETS; do
  stamp="@$(date +%s.%N)"
  omarchy-shell "$t" open >/dev/null 2>&1
  sleep 1.8
  line=$(journalctl --user --since "$stamp" --no-pager 2>/dev/null | grep -a 'ito-anchor ' | tail -1)
  wy=""; wx=""; ww=""
  if [[ $t == ito.weather || $t == ito.aiusage ]]; then
    # the forecast has its own window: take the truth from the compositor, not from the log
    read -r wx wy ww < <(hyprctl layers -j | python3 -c "
import json,sys
for m,v in json.load(sys.stdin).items():
  for l,arr in v['levels'].items():
    for s in arr:
      if s['namespace']=='quickshell': print(s['x'], s['y'], s['w'])
" | tail -1)
  fi
  if [[ -z $line ]]; then printf '%-18s %8s %8s %8s %8s %s\n' "$t" - - - - "no log (hidden widget or popup did not open)"; else
    python3 - "$line" "$t" "$wx" "$wy" "$ww" <<'PY'
import re,sys
l,t,wx,wy,ww=sys.argv[1:6]
g=lambda k: float(re.search(k+r'=(-?[\d.]+)',l).group(1))
ic=g('iconX')+g('iconW')/2
if wx: cx=float(wx)+float(ww)/2; ty=float(wy)+12  # the window has 12 px around the card
else: cx=g('cardX')+g('cardW')/2; ty=g('cardY') if 'cardY' in l else -1
sw=g('screenW'); left=g('cardX'); right=left+g('cardW')
note='clamped' if left<=17 or right>=sw-17 else ''
if g('iconW')==0 and not wx: note='icon has no size (widget hidden: no hardware?)'
print('%-18s %8.0f %8.0f %8.0f %8.0f %s' % (t,ic,cx,cx-ic,ty,note))
PY
  fi
  omarchy-shell "$t" close >/dev/null 2>&1
  sleep 1.2
done

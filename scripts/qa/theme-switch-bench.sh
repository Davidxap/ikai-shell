#!/usr/bin/env bash
# S12 gate: time a real theme round trip (current -> B -> current) and the Omarchy shell's main-thread CPU, and say if it stalls.
#   scripts/qa/theme-switch-bench.sh [theme-B] [rounds]      default: kanagawa, 2 rounds; always switches back to the theme you had
# Each switch prints the theme-set time (ms), the shell main thread's CPU ticks (1/100 s) over the switch plus an 8 s tail, and the
# shell's RSS. FAIL when a switch takes over 9000 ms or the shell burns over 600 ticks (6 s of CPU): the frozen-bar bug of 2026-10-20
# was ~14500 ms and ~2000 ticks per switch (one JSON.parse of the 4 MB assets index per ItoConfig, a ~1 GB JS heap, multi-second GCs).
set -u
B="${1:-kanagawa}"; N="${2:-2}"
STATE="$HOME/.local/state/omarchy/current/theme.name"
A="$(cat "$STATE" 2>/dev/null)"
[ -n "$A" ] || { echo "no current theme"; exit 2; }
[ "$A" != "$B" ] || { echo "theme B is the current theme; pass another"; exit 2; }
restore() { [ "$(cat "$STATE" 2>/dev/null)" != "$A" ] && omarchy-theme-set "$A" >/dev/null 2>&1; echo "theme back to $(cat "$STATE")"; }
trap restore EXIT INT TERM
# the shell's own process (pgrep -o: the oldest match, never this script's own command line)
pid=$(pgrep -o -f -- '-p /usr/share/omarchy/shell')
[ -n "$pid" ] && [ -r "/proc/$pid/task/$pid/stat" ] || { echo "no running Omarchy shell"; exit 2; }
tk() { awk '{print $14+$15}' "/proc/$pid/task/$pid/stat"; }
fail=0
one() {
  local t0 s e ms ticks
  t0=$(tk); s=$(date +%s%N)
  omarchy-theme-set "$1" >/dev/null 2>&1
  e=$(date +%s%N); sleep 8
  ms=$(( (e - s) / 1000000 )); ticks=$(( $(tk) - t0 ))
  local v=ok; { [ "$ms" -gt 9000 ] || [ "$ticks" -gt 600 ]; } && { v=FAIL; fail=1; }
  echo "$v -> $1: ${ms} ms, shell main-thread ticks ${ticks}, rss $(ps -o rss= -p "$pid" | tr -d ' ') KB"
}
for _ in $(seq 1 "$N"); do one "$B"; one "$A"; done
exit $fail

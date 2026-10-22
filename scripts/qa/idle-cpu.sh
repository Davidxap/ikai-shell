#!/usr/bin/env bash
# Idle CPU of the running shell: ticks of the quickshell main thread (and the whole process) over N seconds (default 60).
# Read-only. Prints ticks, %CPU of one core, and the busiest threads. Usage: idle-cpu.sh [seconds]
set -euo pipefail
N=${1:-60}; pid=$(pgrep -x quickshell | head -1); [[ -n $pid ]] || { echo "no quickshell running"; exit 1; }
hz=$(getconf CLK_TCK)
tk() { awk '{print $14+$15}' "$1"; }
m0=$(tk /proc/$pid/task/$pid/stat); p0=$(tk /proc/$pid/stat)
declare -A t0; for t in /proc/$pid/task/*; do t0[$(basename $t)]=$(tk $t/stat 2>/dev/null || echo 0); done
sleep "$N"
m1=$(tk /proc/$pid/task/$pid/stat); p1=$(tk /proc/$pid/stat)
echo "pid $pid over ${N}s: main thread $((m1-m0)) ticks ($(awk -v t=$((m1-m0)) -v h=$hz -v n=$N 'BEGIN{printf "%.2f",100*t/h/n}')% of a core); whole process $((p1-p0)) ticks ($(awk -v t=$((p1-p0)) -v h=$hz -v n=$N 'BEGIN{printf "%.2f",100*t/h/n}')%)"
for t in /proc/$pid/task/*; do id=$(basename $t); d=$(( $(tk $t/stat 2>/dev/null || echo 0) - ${t0[$id]:-0} )); [[ $d -gt 0 ]] && echo "$d $(cat $t/comm)"; done | sort -rn | head -5 | sed 's/^/  thread ticks: /'
exit 0

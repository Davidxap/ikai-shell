#!/usr/bin/env bash
# lock-bench.sh <conf|design> <out.png> [seconds]
# A design name (fog, spiral...) makes the conf for the nested output's own size (ITO_LOCK_MONITORS), so the bench is geometrically
# faithful; the JSON then carries "conf" and "size". A path to a conf is used as it is.
# Render a hyprlock config without locking the real session: start a nested Hyprland as a window inside the session
# (dev/bench/nested.lua: one output, no autostart, no hypridle, no shell), check that its instance signature and
# Wayland socket both differ from the real session's (abort otherwise), run hyprlock inside it, capture the nested
# output only with grim at t = 5 s, stop everything, and check that no hyprlock is left running.
# Prints one JSON line; exit 0 when the PNG exists and the hyprlock log has no config errors.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
conf=${1:-}; out=${2:-}; secs=${3:-8}
die() { printf '{"ok":false,"error":"%s"}\n' "$1"; exit 1; }
design=""; [[ -f $conf ]] || { design=$conf; conf=""; }
[[ ( -f $conf || -n $design ) && -n $out ]] || die "usage: lock-bench.sh <conf|design> <out.png> [seconds]"
[[ -n ${WAYLAND_DISPLAY:-} && -n ${HYPRLAND_INSTANCE_SIGNATURE:-} ]] || die "run it from inside the Hyprland session"
command -v grim >/dev/null || die "grim is missing"
pgrep -x hyprlock >/dev/null && die "a hyprlock is already running; nothing was started"

real_wl=$WAYLAND_DISPLAY real_his=$HYPRLAND_INSTANCE_SIGNATURE
run=${XDG_RUNTIME_DIR:-/run/user/$(id -u)}
logdir=${XDG_CACHE_HOME:-$HOME/.cache}/ito/lock-bench; mkdir -p "$logdir" "$(dirname "$out")"
hlog=$logdir/nested.log llog=$logdir/hyprlock.log

# The nested compositor is a client of the real one (WAYLAND_DISPLAY stays the real socket for it), and it makes its
# own socket and instance. HYPRLAND_INSTANCE_SIGNATURE is cleared so nothing in it can talk to the real instance.
env -u HYPRLAND_INSTANCE_SIGNATURE Hyprland -c "$REPO/dev/bench/nested.lua" >"$hlog" 2>&1 &
hpid=$!
cleanup() {
  [[ -n ${lpid:-} ]] && kill "$lpid" 2>/dev/null
  kill "$hpid" 2>/dev/null; sleep 1; kill -9 "$hpid" 2>/dev/null
  wait "$hpid" 2>/dev/null
}
trap cleanup EXIT

nest_his="" nest_wl=""
for _ in $(seq 1 50); do
  sleep 0.2
  kill -0 "$hpid" 2>/dev/null || die "nested Hyprland exited at start (see $hlog)"
  for f in "$run"/hypr/*/hyprland.lock; do
    [[ -f $f ]] || continue
    [[ $(sed -n 1p "$f") == "$hpid" ]] || continue
    nest_his=$(basename "$(dirname "$f")"); nest_wl=$(sed -n 2p "$f")
  done
  [[ -n $nest_wl && -S $run/$nest_wl ]] && break
done
[[ -n $nest_his && -n $nest_wl ]] || die "nested Hyprland never published its socket (see $hlog)"
[[ $nest_his != "$real_his" && $nest_wl != "$real_wl" ]] || die "nested instance equals the real session; aborted"
sleep 1

nsize=$(HYPRLAND_INSTANCE_SIGNATURE=$nest_his hyprctl monitors -j 2>/dev/null | python3 -c "import json,sys; m=json.load(sys.stdin)[0]; print(f\"{m['width']}x{m['height']}\")" 2>/dev/null)
if [[ -n $design ]]; then
  cdir=$(mktemp -d); trap 'rm -rf "$cdir"; cleanup' EXIT
  ITO_LOCK_MONITORS=":${nsize:-1280x720}" "$REPO/bar/modules/bin/ito-lock" candidate --design "$design" --out "$cdir" >"$logdir/candidate.json" 2>&1 \
    || die "candidate for $design failed: $(head -c 300 "$logdir/candidate.json")"
  conf=$cdir/$design.conf; mkdir -p "$(dirname "$out")"; cp "$conf" "${out%.png}.conf"; conf=${out%.png}.conf
fi
WAYLAND_DISPLAY=$nest_wl HYPRLAND_INSTANCE_SIGNATURE=$nest_his \
  timeout -s USR1 -k 3 "$secs" hyprlock -c "$conf" >"$llog" 2>&1 &
lpid=$!
sleep 5
kill -0 "$lpid" 2>/dev/null; alive=$?
WAYLAND_DISPLAY=$nest_wl grim "$out" 2>>"$llog"; shot=$?
wait "$lpid" 2>/dev/null; lpid=""
cleanup; trap - EXIT
sleep 0.5
stray=false; pgrep -x hyprlock >/dev/null && stray=true
errors=$(grep -ciE 'error|invalid|could not|unknown|failed to' "$llog" | head -1)
ok=false; [[ $shot == 0 && -s $out && $alive == 0 && $errors == 0 && $stray == false ]] && ok=true
printf '{"ok":%s,"png":"%s","nested":"%s","nested_size":"%s","conf":"%s","alive_at_5s":%s,"config_errors":%s,"stray_hyprlock":%s,"log":"%s"}\n' \
  "$ok" "$out" "$nest_wl" "${nsize:-}" "$conf" "$([[ $alive == 0 ]] && echo true || echo false)" "${errors:-0}" "$stray" "$llog"
[[ $ok == true ]]

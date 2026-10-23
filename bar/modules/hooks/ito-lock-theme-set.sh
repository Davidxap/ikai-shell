#!/usr/bin/env bash
# Omarchy theme-set hook shipped by IKAI: redraws the themed system surfaces after a theme change, so their colours follow it.
# Installed as ~/.config/omarchy/hooks/theme-set.d/60-ito-lock.sh by `ito-lock apply` (removed by `ito-lock revert`).
# Each surface is refreshed only while its own toggle is on: the lock (lockTheme) and the terminal fetch (fastfetchTheme).
# It never runs hyprlock and never touches hypridle.conf. The redraws take a couple of seconds, so they run detached and the
# theme switch never waits for them; the boot logo needs a terminal (sudo) and is refreshed with `ito-plymouth apply`.
set -u
style="$HOME/.config/omarchy/bar/modules/ito-style.json"
bin="$HOME/.config/omarchy/bar/modules/bin"
[ -r "$style" ] || exit 0
on() { grep -Eq "\"$1\"[[:space:]]*:[[:space:]]*true" "$style"; }
if on lockTheme && [ -x "$bin/ito-lock" ]; then
  setsid -f "$bin/ito-lock" apply >/dev/null 2>&1 </dev/null || true
fi
if on fastfetchTheme && [ -x "$bin/ito-fastfetch" ]; then
  setsid -f "$bin/ito-fastfetch" apply >/dev/null 2>&1 </dev/null || true
fi
exit 0

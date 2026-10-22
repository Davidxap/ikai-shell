#!/usr/bin/env bash
# Omarchy theme-set hook shipped by IKAI: regenerates the themed lock screen after a theme change.
# Installed as ~/.config/omarchy/hooks/theme-set.d/60-ito-lock.sh by `ito-lock apply` (removed by `ito-lock revert`).
# It only acts while the lockTheme toggle is on; it never runs hyprlock and never touches hypridle.conf.
# `ito-lock apply` without a flag keeps the saved lockDesign; it redraws the spiral frames in the new colours, which
# takes a couple of seconds, so it runs detached and the theme switch never waits for it.
set -u
style="$HOME/.config/omarchy/bar/modules/ito-style.json"
tool="$HOME/.config/omarchy/bar/modules/bin/ito-lock"
[ -x "$tool" ] && [ -r "$style" ] || exit 0
grep -Eq '"lockTheme"[[:space:]]*:[[:space:]]*true' "$style" || exit 0
setsid -f "$tool" apply >/dev/null 2>&1 </dev/null || true
exit 0

#!/usr/bin/env bash
# Installs IKAI from the folder this file is in (a clone of the repository, or the plugin folder that
# `omarchy plugin add` made). It says what it will do and asks first; nothing changes until you answer y.
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
omarchy="$HOME/.config/omarchy"

echo "IKAI 0.2.0-beta"
echo
echo "This will:"
echo "  - copy the bar modules and the plugins/ito.* folders into $omarchy"
echo "  - keep your own IKAI settings if you already have any"
echo "  - keep the shell you use now as its own entry, so you can go back to it (Setup page, or scripts/shell-switch)"
echo "  - restart the shell once if it is running"
echo "It does not touch Omarchy's own files, and it does not switch shells until you say so."
echo

missing=()
for tool in rsync jq python3; do command -v "$tool" >/dev/null 2>&1 || missing+=("$tool"); done
if ((${#missing[@]})); then
  echo "Missing: ${missing[*]}. Install them with your package manager and run this again."
  read -rp "Press Enter to close. " _
  exit 1
fi

read -rp "Install IKAI? [y/N] " answer
if [[ ! $answer =~ ^[Yy] ]]; then
  echo "Nothing was changed."
  read -rp "Press Enter to close. " _
  exit 0
fi

mkdir -p "$HOME/.config/ito" && printf '%s\n' "$here" > "$HOME/.config/ito/repo"
"$here/scripts/deploy.sh" || { echo "The install failed; nothing else was changed."; read -rp "Press Enter to close. " _; exit 1; }
echo
echo "Installed."
read -rp "Switch to IKAI now? [y/N] " answer
if [[ $answer =~ ^[Yy] ]]; then
  "$here/scripts/shell-switch" ito
else
  echo "Whenever you want: $here/scripts/shell-switch ito"
fi
echo
echo "Then click the seal in the middle of the bar to open the Control Centre."
read -rp "Press Enter to close. " _

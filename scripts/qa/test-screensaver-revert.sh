#!/usr/bin/env bash
# ito-screensaver apply / revert on a fixture HOME: one apply call does text + idle; revert keeps a hand edit made to
# hypridle.conf after install (strip-only, H11). ITO_SCREENSAVER_OFFLINE=1 keeps the real hypridle untouched.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; S=$REPO/bar/modules/bin/ito-screensaver
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT; export ITO_SCREENSAVER_OFFLINE=1
mkdir -p "$T/.config/hypr" "$T/.config/omarchy/branding" "$T/.config/omarchy/bar/modules"
echo '{"lockEngine":"hyprlock"}' > "$T/.config/omarchy/bar/modules/ito-style.json"   # Ito installs its listener only when hyprlock owns the lock
cp "$REPO/dev/fixtures/home-mixed/.config/hypr/hypridle.conf" "$T/.config/hypr/"
echo "stock text" > "$T/.config/omarchy/branding/screensaver.txt"
HOME=$T "$S" apply | grep -q '"ok": true'
grep -q ">>> ito-verse screensaver" "$T/.config/hypr/hypridle.conf"
echo "# hand fix after install" >> "$T/.config/hypr/hypridle.conf"
HOME=$T "$S" revert >/dev/null
grep -q "hand fix after install" "$T/.config/hypr/hypridle.conf"
! grep -q "ito-verse screensaver" "$T/.config/hypr/hypridle.conf"
[[ $(cat "$T/.config/omarchy/branding/screensaver.txt") == "stock text" ]]
echo "ok: single apply, strip-only revert keeps the hand edit"

#!/usr/bin/env bash
# sync-ito-lock.sh: rebuild plugins/ito.lock/Service.qml from Omarchy's own lock service (boot-lock-v2 §3.9).
# The copy is VERBATIM except one thing: it instantiates ItoLockView instead of LockView (two places) and carries a header
# comment. PAM contexts, the IPC target `lock`, stranded-lock recovery and the fingerprint flow are Omarchy's, untouched.
# service.sha256 records the hash of the source this was copied from; ito-health warns when Omarchy's file no longer
# matches it (an Omarchy update), so the copy is re-synced on purpose and never drifts silently. Reads /usr/share only.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC=${OMARCHY_LOCK_SRC:-/usr/share/omarchy/shell/plugins/lock/Service.qml}
DST="$REPO/plugins/ito.lock"
[[ -f $SRC ]] || { echo "missing $SRC" >&2; exit 1; }
ver=$(pacman -Q omarchy 2>/dev/null | cut -d' ' -f2 || true)
{
  echo "// ito.lock Service.qml: a verbatim copy of Omarchy's plugins/lock/Service.qml (omarchy ${ver:-unknown})."
  echo "// The ONLY change: it instantiates ItoLockView where Omarchy instantiates LockView. Do not edit by hand:"
  echo "// scripts/sync-ito-lock.sh rebuilds it, and ito-health warns when Omarchy's original changes."
  sed 's/^\(\s*\)LockView {/\1ItoLockView {/' "$SRC"
} > "$DST/Service.qml"
sha256sum "$SRC" | cut -d' ' -f1 > "$DST/service.sha256"
echo "ito.lock Service.qml rebuilt from $SRC ($(cut -c1-12 "$DST/service.sha256"))"

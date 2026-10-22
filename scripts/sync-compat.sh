#!/usr/bin/env bash
# sync-compat.sh: keep compat/verified.json (what this shell was last verified against) honest.
#   scripts/sync-compat.sh            show what ito-compat sees now (same as `ito-compat status`)
#   scripts/sync-compat.sh --record   after YOU confirmed the new Omarchy/quickshell/Qt works: re-scan what our code reads
#                                     from Omarchy and rewrite compat/verified.json (and its deployed copy). Asks first;
#                                     `--yes` skips the question for scripted use by the maintainer. Never run by a hook.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOL="$REPO/bar/modules/bin/ito-compat"
DEST="$REPO/compat/verified.json"
COPY="$REPO/bar/modules/compat/verified.json"   # deployed with the shell, so ito-health can compare on a machine without the repo
export ITO_REPO="$REPO"
case "${1:-}" in
  "") exec "$TOOL" status ;;
  --record)
    "$TOOL" status || true
    echo
    "$TOOL" check || true
    echo
    if [[ ${2:-} != --yes ]]; then
      [[ -t 0 ]] || { echo "refusing: --record asks for a yes on a terminal (or pass --yes after you have tested)." >&2; exit 1; }
      read -r -p "Record the installed versions as verified, after trying the shell on them? [y/N] " a
      [[ $a == y || $a == Y ]] || { echo "nothing changed"; exit 1; }
    fi
    "$TOOL" record "$DEST"
    mkdir -p "$(dirname "$COPY")"; cp "$DEST" "$COPY"
    echo "recorded; commit compat/verified.json and bar/modules/compat/verified.json" ;;
  *) echo "usage: $0 [--record [--yes]]" >&2; exit 2 ;;
esac

#!/usr/bin/env bash
# Qt 6.12 hotfix: QtQuick 6.12 exports a new singleton `Color` (QQuickColor)
# that shadows the Omarchy singleton qs.Commons.Color in every file that does
# an unversioned `import QtQuick`. Pinning that import to 6.11 hides the new
# type, so `Color` resolves to qs.Commons.Color again.
#
# The unversioned `import QtQuick.Window` re-exports QtQuick 6.12 too (lab-verified;
# Controls, Layouts, Shapes, Effects, Templates, Dialogs do not), so it is pinned
# to `import QtQuick.Window 6.11` as well. Only .qml files that use `Color.<member>`
# and have one of those unversioned lines are touched. Idempotent. Dry run by default.
#
# Usage:
#   qt612-color-hotfix.sh [--apply] [--backup DIR] TARGET...
#   qt612-color-hotfix.sh --revert BACKUPDIR TARGET...   (restores the backed-up files)
#
# Examples:
#   qt612-color-hotfix.sh ~/.config/omarchy/plugins                # dry run
#   qt612-color-hotfix.sh --apply --backup ~/.config/omarchy/backups/2026-10-08-qt612 ~/.config/omarchy/plugins
#   sudo qt612-color-hotfix.sh --apply --backup /root/omarchy-shell-qt612 /usr/share/omarchy/shell
set -euo pipefail

apply=0
backup=""
revert=""
targets=()
while (($#)); do
  case "$1" in
    --apply) apply=1 ;;
    --backup) backup="$2"; shift ;;
    --revert) revert="$2"; shift ;;
    -h|--help) sed -n '2,24p' "$0"; exit 0 ;;
    *) targets+=("$1") ;;
  esac
  shift
done
((${#targets[@]})) || { echo "No target given" >&2; exit 2; }
if [[ -n $revert ]]; then
  for target in "${targets[@]}"; do
    target=$(readlink -f "$target")
    src="$revert/$(basename "$target")"
    [[ -d $src ]] || { echo "no backup at $src" >&2; exit 1; }
    cp -a "$src/." "$target/"
    echo "restored $target from $src"
  done
  exit 0
fi
if ((apply)) && [[ -z $backup ]]; then
  echo "--apply requires --backup DIR" >&2
  exit 2
fi

count=0
for target in "${targets[@]}"; do
  target=$(readlink -f "$target")
  while IFS= read -r -d '' file; do
    grep -qP '(?<![\w.])Color\.[A-Za-z_]' "$file" || continue
    grep -qP '^import QtQuick(\.Window(\s+as\s+\w+)?)?\s*$' "$file" || continue
    count=$((count + 1))
    if ((apply)); then
      dest="$backup/$(basename "$target")/${file#"$target"/}"
      mkdir -p "$(dirname "$dest")"
      cp -p "$file" "$dest"
      sed -i -E -e 's/^import QtQuick[[:space:]]*$/import QtQuick 6.11/' \
        -e 's/^import QtQuick\.Window([[:space:]]+as[[:space:]]+[A-Za-z_0-9]+)?[[:space:]]*$/import QtQuick.Window 6.11\1/' "$file"
      echo "patched $file"
    else
      echo "would patch $file"
    fi
  done < <(find -L "$target" -name '*.qml' -type f -print0)
done
echo "$count file(s) $( ((apply)) && echo patched || echo 'to patch (dry run)')"
((apply)) && echo "backup: $backup (restore with: cp -a $backup/<name>/. <target>/)"
exit 0

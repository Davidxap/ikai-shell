#!/usr/bin/env bash
# Qt 6.12 added a QtQuick singleton Color that shadows qs.Commons.Color.
# This guard fails if any .qml file has unversioned `import QtQuick` or `import QtQuick.Window` and uses Color.<member>.
set -euo pipefail
cd "$(dirname "$0")/../.."
bad=0
count=0
# Find all .qml files, exclude known dirs with backups, test data, vendored code, and node code
while IFS= read -r f; do
  count=$((count + 1))
  # Only files that import QtQuick (or QtQuick.Window, which re-exports the 6.12 Color) without a version are exposed
  grep -qE "^import QtQuick(\.Window)?\s*$" "$f" || continue
  # Skip if file uses `import qs.Commons as` aliasing (safe from shadow)
  grep -q "^import qs\.Commons as" "$f" && continue
  # Check for Color. member access (best-effort: skip pure comment lines)
  if grep -E '^\s*[^/]*\bColor\.[a-zA-Z]' "$f" >/dev/null 2>&1; then
    echo "$f:$(grep -n '\bColor\.[a-zA-Z]' "$f" | head -1 | cut -d: -f1): unversioned import QtQuick[.Window] shadows qs.Commons.Color"
    bad=1
  fi
done < <(find . -name '*.qml' -type f \
  ! -path './backups/*' \
  ! -path './openspec/*' \
  ! -path './dev/*' \
  ! -path './node_modules/*' \
  ! -path '*/.*/*')
[[ $bad -eq 0 ]] && echo "qt-color guard: ok ($count files checked)"
exit $bad

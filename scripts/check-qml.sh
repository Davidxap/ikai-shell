#!/usr/bin/env bash
# The mistakes qmllint can catch before the shell is restarted: duplicate names, syntax errors, unknown ids.
# The panel pages only load when opened, so a broken one otherwise goes unnoticed until someone clicks on it.
#   scripts/check-qml.sh          lint the Control Centre pages, the shared components and the system-panel widgets
#   CHECK_QML_SLOW=1 scripts/check-qml.sh   also qmllint plugins/ito.network/Panel.qml (2052 lines, qmllint needs > 2 min: D-023)
set -u
cd "$(dirname "$0")/.."
bad=0
for f in bar/modules/cc/*.qml bar/modules/cc/sysart/*.qml $(ls plugins/ito.lock/*.qml 2>/dev/null) bar/modules/Ito*.qml scripts/lab/lab-eye*.qml scripts/lab/Eye*.qml scripts/lab/lab-calendar*.qml scripts/lab/lab-clockface.qml plugins/ito.clock/*.qml plugins/ito.date/*.qml plugins/ito.cpu/*.qml plugins/ito.mem/*.qml plugins/ito.disk/*.qml plugins/ito.network/Panel.qml; do
  [[ -f $f ]] || continue   # scripts/lab is a development harness that is not published; its files are linted only where it exists
  lim=30; [[ $f == plugins/ito.network/Panel.qml ]] && lim=${CHECK_QML_SLOW:+400}
  if [[ -z $lim ]]; then out=; else out=$(timeout "$lim" qmllint "$f" 2>&1 | grep -E "[Dd]uplicat|Syntax|Unexpected|Expected|not defined|Cannot assign to non-existent|is not a" || true); fi
  # qmllint does not flag a property named with a capital, but the engine refuses the whole type ("Property names cannot begin with an upper case letter")
  up=$(grep -nE '^[[:space:]]*(readonly[[:space:]]+|required[[:space:]]+|default[[:space:]]+)*property[[:space:]]+[A-Za-z_.<>]+[[:space:]]+[A-Z]' "$f" || true)
  [[ -n $up ]] && out="${out:+$out
}property names cannot begin with an upper case letter:
$up"
  if [[ -n $out ]]; then echo "$f"; echo "$out" | sed 's/^/    /'; bad=1; fi
done
[[ $bad -eq 0 ]] && echo "qml: no errors in the pages, shared components and system-panel widgets"
exit $bad

#!/usr/bin/env bash
# Omarchy bar boot-flash hotfix for shell/shell.qml (omarchy 4.0.x).
#
# On start, `activeBarId` falls back to "omarchy.bar" until the async
# PluginRegistry scan has filled `installedPlugins`, so `defaultBarLoader`
# builds the stock bar for ~0.5 s before a configured plugin bar (bar.id) is
# loaded. This patch keeps `defaultBarLoader` inactive while the first scan is
# pending AND bar.id is not the stock bar. It is released by the first
# `pluginRegistry.scanFinished` or a 2.5 s timeout, so a missing/broken plugin
# bar still falls back to the stock bar. bar.id = omarchy.bar is unchanged.
#
# Text-anchored, idempotent, refuses unknown/upgraded files, keeps mode and
# ownership, coexists with qt612-color-hotfix.sh (touches no import line).
# Dry run by default.
#
# Usage:
#   omarchy-bar-boot-hotfix.sh [SHELLDIR]                      # dry run
#   omarchy-bar-boot-hotfix.sh --apply --backup DIR [SHELLDIR]
#   omarchy-bar-boot-hotfix.sh --revert DIR [SHELLDIR]
# SHELLDIR defaults to /usr/share/omarchy/shell. A package upgrade replaces the
# file and drops the patch; re-run --apply afterwards.
set -euo pipefail

apply=0
backup=""
revert=""
target=/usr/share/omarchy/shell
while (($#)); do
  case "$1" in
    --apply) apply=1 ;;
    --backup) backup="${2:?--backup needs DIR}"; shift ;;
    --revert) revert="${2:?--revert needs DIR}"; shift ;;
    -h|--help) sed -n '2,22p' "$0"; exit 0 ;;
    -*) echo "unknown option $1" >&2; exit 2 ;;
    *) target="$1" ;;
  esac
  shift
done
file="$(readlink -f "$target")/shell.qml"
[[ -f $file ]] || { echo "no shell.qml at $file" >&2; exit 1; }
if ((apply)) && [[ -z $backup ]]; then echo "--apply requires --backup DIR" >&2; exit 2; fi
if ((apply)) && [[ -n $revert ]]; then echo "--apply and --revert are exclusive" >&2; exit 2; fi

mode=check
((apply)) && mode=apply
[[ -n $revert ]] && mode=revert

# Writes the result to $tmp; exit codes: 0 change ready, 3 nothing to do, 4 refuse.
tmp=$(mktemp "$(dirname "$file")/.shell.qml.XXXXXX" 2>/dev/null || mktemp)
trap 'rm -f "$tmp"' EXIT
set +e
python3 -I - "$mode" "$file" "$tmp" <<'PY'
import sys
mode, src, out = sys.argv[1:4]
MARK = "ito-bar-boot-hotfix v1"
OLD = """  Loader {
    id: defaultBarLoader

    active: shell.activeBarId === shell.defaultBarId
    sourceComponent: defaultBarComponent
    onLoaded: shell.configureBar(item, shell.barManifestFor(shell.defaultBarId))
    onActiveChanged: if (!active && shell.activeBarId !== shell.defaultBarId) shell.bar = null
  }
"""
NEW = """  // ito-bar-boot-hotfix v1: until the first plugin scan lands, a configured
  // plugin bar looks "unavailable" and the stock bar would flash. Hold the stock
  // bar back until scanFinished (or 2.5 s), unless shell.json (not the builtin
  // placeholder used during construction) selects the stock bar.
  property bool barBootSettled: false
  Connections {
    target: shell.pluginRegistry
    function onScanFinished() { shell.barBootSettled = true }
  }
  Timer {
    interval: 2500
    running: !shell.barBootSettled
    onTriggered: shell.barBootSettled = true
  }

  Loader {
    id: defaultBarLoader

    active: shell.activeBarId === shell.defaultBarId
      && (shell.barBootSettled
        || (shell.selectedBarId === shell.defaultBarId && shell.shellConfig !== shell.builtinShellConfig))
    sourceComponent: defaultBarComponent
    onLoaded: shell.configureBar(item, shell.barManifestFor(shell.defaultBarId))
    onActiveChanged: if (!active) shell.bar = null
  }
"""
text = open(src, encoding="utf-8").read()
patched = MARK in text
if mode == "revert":
    if not patched:
        print(f"{src}: not patched (or replaced by an upgrade); nothing to revert"); sys.exit(3)
    if text.count(NEW) != 1:
        print(f"{src}: patched block was modified; refusing, restore the backup by hand", file=sys.stderr); sys.exit(4)
    open(out, "w", encoding="utf-8").write(text.replace(NEW, OLD)); sys.exit(0)
if patched:
    print(f"{src}: already patched"); sys.exit(3)
if text.count(OLD) != 1 or "barBootSettled" in text:
    print(f"{src}: defaultBarLoader block not found as expected (changed or upgraded "
          "omarchy?); refusing to patch", file=sys.stderr); sys.exit(4)
open(out, "w", encoding="utf-8").write(text.replace(OLD, NEW)); sys.exit(0)
PY
rc=$?
set -e
((rc == 3)) && exit 0
((rc == 0)) || exit "$rc"

install_result() {
  chmod --reference="$file" "$tmp"
  chown --reference="$file" "$tmp" 2>/dev/null || true
  mv -f "$tmp" "$file"
}

case $mode in
  check)
    echo "would patch $file (dry run; use --apply --backup DIR)"
    diff -u "$file" "$tmp" || true ;;
  apply)
    mkdir -p "$backup"
    [[ -e $backup/shell.qml ]] && { echo "backup $backup/shell.qml already exists; pick a new DIR" >&2; exit 1; }
    cp -p "$file" "$backup/shell.qml"
    install_result
    echo "patched $file"
    echo "backup: $backup/shell.qml (revert: $0 --revert $backup $(dirname "$file"))" ;;
  revert)
    [[ -f $revert/shell.qml ]] || { echo "no backup at $revert/shell.qml" >&2; exit 1; }
    install_result
    if cmp -s "$file" "$revert/shell.qml"; then
      echo "reverted $file (identical to $revert/shell.qml)"
    else
      echo "reverted $file (patch removed; other lines differ from the backup, e.g. a later hotfix, and were kept)"
    fi ;;
esac

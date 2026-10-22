#!/usr/bin/env bash
# Sync the Ito-verse repo with the live Omarchy state.
#
# The shell, the bar modules and the dressed clones run from ~/.config/omarchy,
# outside this repo. For a long time nothing copied them back, so the repo
# documented a system it did not contain. This script is that missing link.
#
#   sync.sh pull    live  -> repo   (capture the running system so git can hold it)
#   sync.sh push    repo  -> live   (deploy the repo onto the running system)
#   sync.sh status  show what differs, change nothing
#
# Nothing is deleted unless SYNC_PRUNE=1 is set.
#
# push never touches shell.json: the engine owns and rewrites that file at
# runtime. Layout changes go through ito-design; scripts/seed-variant.py creates the shell.ito.json that shell-switch needs.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OMARCHY="$HOME/.config/omarchy"

# repo path <- live path
PAIRS=(
  "bar/modules|$OMARCHY/bar/modules"
  "themes/ito-verse|$OMARCHY/themes/ito-verse"
  # The variant files are the user's, and the switcher keeps shell.ito.json current with the layout they
  # arrange, so neither push nor pull touches them.
)

# Every ito.* plugin is ours (the fork plus the repackaged widgets), except ito.shell,
# an abandoned prototype. A loop, so a new plugin is tracked without editing this list.
# Both sides are read: a plugin that only exists in the repo (a new widget) must be deployed too.
declare -A seen_plugins=()
for dir in "$OMARCHY"/plugins/ito.* "$REPO"/plugins/ito.*; do
  [[ -d $dir ]] || continue
  name=$(basename "$dir")
  [[ $name == ito.shell || -n ${seen_plugins[$name]:-} ]] && continue
  seen_plugins[$name]=1
  PAIRS+=("plugins/$name|$OMARCHY/plugins/$name")
done


die() { printf 'error: %s\n' "$1" >&2; exit 1; }

# rsync never deletes unless SYNC_PRUNE=1. It used to always pass --delete, so `pull`
# erased every file that existed only in the repo (new components not yet deployed).
copy_dir() {
  local src=$1 dst=$2
  mkdir -p "$dst"
  rsync -a --exclude=.ito-managed.json ${SYNC_PRUNE:+--delete} "$src/" "$dst/"
}

copy_file() {
  local src=$1 dst=$2
  mkdir -p "$(dirname "$dst")"
  cp -a "$src" "$dst"
}

# Owned by the repo: generated here (palette.toml -> colors.toml, shell.toml), deployed with
# `push`. The live copy is only a deployment, so `pull` must never overwrite it over the
# repo; it did once, and silently reverted an uncommitted edit.
REPO_OWNED=("themes/ito-verse")

is_repo_owned() {
  local rel=$1 owned
  for owned in "${REPO_OWNED[@]}"; do [[ $owned == "$rel" ]] && return 0; done
  return 1
}

do_sync() {
  local direction=$1 pair repo_rel live
  for pair in "${PAIRS[@]}"; do
    repo_rel=${pair%%|*}
    live=${pair##*|}
    local repo_path="$REPO/$repo_rel"

    # Never bring the live copy over unsaved work in the repo.
    if [[ $direction == pull && -n $(git -C "$REPO" status --porcelain -- "$repo_rel" 2>/dev/null) ]]; then
      printf '  skip  %-36s (uncommitted changes in the repo: commit or push first)\n' "$repo_rel"
      continue
    fi

    if [[ $direction == pull ]] && is_repo_owned "$repo_rel"; then
      printf '  skip  %-36s (repo-owned: edit here, deploy with push)\n' "$repo_rel"
      continue
    fi

    local src dst
    if [[ $direction == pull ]]; then src=$live;      dst=$repo_path
    else                               src=$repo_path; dst=$live
    fi

    if [[ ! -e $src ]]; then
      printf '  skip  %-36s (missing: %s)\n' "$repo_rel" "$src"
      continue
    fi

    if [[ -d $src ]]; then copy_dir "$src" "$dst"; else copy_file "$src" "$dst"; fi
    printf '  ok    %-36s\n' "$repo_rel"
  done
}

show_status() {
  local pair repo_rel live repo_path
  for pair in "${PAIRS[@]}"; do
    repo_rel=${pair%%|*}
    live=${pair##*|}
    repo_path="$REPO/$repo_rel"

    if [[ ! -e $live ]]; then
      printf '  %-36s live missing\n' "$repo_rel"
    elif [[ ! -e $repo_path ]]; then
      printf '  %-36s repo missing\n' "$repo_rel"
    elif diff -rq "$repo_path" "$live" >/dev/null 2>&1; then
      printf '  %-36s in sync\n' "$repo_rel"
    else
      printf '  %-36s DIFFERS\n' "$repo_rel"
    fi
  done
}

command -v rsync >/dev/null || die "rsync is required"

case "${1:-}" in
  pull)
    echo "live -> repo"
    do_sync pull
    echo
    echo "Review with 'git -C $REPO status' before committing."
    ;;
  push)
    echo "repo -> live"
    do_sync push
    echo
    echo "QML changed: restart the shell, then verify the journal and a capture."
    ;;
  status)
    echo "repo vs live"
    show_status
    ;;
  *)
    die "usage: sync.sh pull|push|status"
    ;;
esac

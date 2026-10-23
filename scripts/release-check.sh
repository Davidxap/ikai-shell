#!/usr/bin/env bash
# Read-only pre-publish hygiene check. Run it from anywhere, right before the release commit:
#   scripts/release-check.sh
# Prints PASS / WARN / FAIL per item; exits 1 when any item FAILs. Changes nothing (it only reads the tree and git).
# Scope: the files git would publish (tracked + untracked, minus .gitignore). dev/ is local-only and never inspected.
set -u
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO" || exit 2
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
fails=0; warns=0
ok()   { printf 'PASS  %-34s %s\n' "$1" "${2:-}"; }
warn() { printf 'WARN  %-34s %s\n' "$1" "${2:-}"; warns=$((warns+1)); }
bad()  { printf 'FAIL  %-34s %s\n' "$1" "${2:-}"; fails=$((fails+1)); }
show() { sed 's/^/        /' | head -"${1:-8}"; }

# Everything git would publish, as existing regular files.
git ls-files -co --exclude-standard | grep -v '^dev/' | while IFS= read -r f; do [ -f "$f" ] && printf '%s\n' "$f"; done | sort -u > "$TMP/all"
# the two files that describe these checks quote the patterns they look for; they are not scanned as text
grep -vE '\.(png|jpe?g|webp|gif|avif|mp4|ico|ttf|otf|woff2?)$' "$TMP/all" | grep -vxE 'scripts/release-check\.sh|docs/RELEASE\.md' > "$TMP/text"
grep -iE '\.(png|jpe?g|webp|gif|avif|mp4)$' "$TMP/all" > "$TMP/media"
echo "IKAI release check: $(wc -l < "$TMP/all") files would be published ($(git rev-parse --short HEAD 2>/dev/null))"
echo

# (1a) big images / media. Known, reviewed exceptions are listed here; anything else over 1 MB fails.
ALLOW='^(themes/ito-verse/backgrounds/tomie\.png|docs/media/tour\.(mp4|gif))$'
big="$(xargs -d '\n' stat -c '%s %n' < "$TMP/media" | awk '$1>1048576{print $1" "$2}' | sort -rn)"
unk="$(printf '%s\n' "$big" | grep -v '^$' | awk '{print $2}' | grep -vE "$ALLOW" || true)"
if [ -n "$unk" ]; then bad "1a images over 1 MB" "unreviewed:"; printf '%s\n' "$unk" | show
else ok "1a images over 1 MB" "only the reviewed ones: $(printf '%s\n' "$big" | grep -c .)"; fi
[ -n "$big" ] && printf '%s\n' "$big" | awk '{printf "        %.1f MB  %s\n",$1/1048576,$2}'

# (1b) no byte-identical copy of the user's own source art (~/Downloads/Ideas, ~/.config/ito/ref). The assets folder is
# not compared: it holds deployed copies of the repo's own art.
: > "$TMP/userhash"
for d in "$HOME/Downloads/Ideas" "$HOME/.config/ito/ref"; do
  [ -d "$d" ] && find "$d" -type f -exec sha256sum {} + 2>/dev/null | awk '{print $1}' >> "$TMP/userhash"
done
if [ ! -s "$TMP/userhash" ]; then warn "1b user art copies" "no source folder on this machine, not compared"
else
  xargs -d '\n' sha256sum < "$TMP/media" 2>/dev/null > "$TMP/mediahash"
  hit="$(grep -F -f "$TMP/userhash" "$TMP/mediahash" | awk '{print $2}')"
  [ -n "$hit" ] && { bad "1b user art copies" "identical to your source pictures:"; printf '%s\n' "$hit" | show; } \
                || ok "1b user art copies" "$(wc -l < "$TMP/userhash") source files compared, 0 identical"
fi

# (1c) the third-party art ART_LICENSE.md names is still named there.
miss=""
for k in "ito-art" "themes/ito-verse/backgrounds" "Lunar_enchantress"; do grep -q "$k" ART_LICENSE.md || miss="$miss $k"; done
[ -z "$miss" ] && ok "1c art licence coverage" "ART_LICENSE.md names the art folders and the Tomie source" || bad "1c art licence coverage" "ART_LICENSE.md lacks:$miss"
for f in $(grep -oE '`[^` ]+`' ART_LICENSE.md | tr -d '`' | grep -E '^(bar|themes|assets|icons|docs|preview)' | sed 's#/$##' | sort -u); do
  [ -e "$f" ] || bad "1c art licence paths" "ART_LICENSE.md names a path that does not exist: $f"
done

# (2) secrets and personal data
S1='(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(api[_-]?key|secret|passwd|password)[A-Za-z_]*["'"'"' ]*[:=]["'"'"' ]*["'"'"'][A-Za-z0-9/+_-]{12,}["'"'"'])'
hits="$(xargs -d '\n' grep -InE "$S1" < "$TMP/text" 2>/dev/null | grep -v 'plugins/.*/LICENSE' | cut -c1-140)"
[ -z "$hits" ] && ok "2a secrets and tokens" "none found" || { bad "2a secrets and tokens" ""; printf '%s\n' "$hits" | show; }
hits="$(xargs -d '\n' grep -InE 'davidxap@|[A-Za-z0-9._-]+@(gmail|hotmail|outlook|yahoo|proton|icloud)\.[a-z]+' < "$TMP/text" 2>/dev/null | cut -c1-140)"
[ -z "$hits" ] && ok "2b personal emails" "none found" || { bad "2b personal emails" ""; printf '%s\n' "$hits" | show; }
hits="$(xargs -d '\n' grep -InE '\.ssh/|ssh-(rsa|ed25519) |id_(rsa|ed25519)' < "$TMP/text" 2>/dev/null | cut -c1-140)"
[ -z "$hits" ] && ok "2c ssh material" "none found" || { bad "2c ssh material" ""; printf '%s\n' "$hits" | show; }
hits="$(xargs -d '\n' grep -InE 'Co-Authored-By|Generated with|noreply@anthropic' < "$TMP/text" 2>/dev/null | cut -c1-140)"
[ -z "$hits" ] && ok "2d AI attribution in files" "none found" || { bad "2d AI attribution in files" ""; printf '%s\n' "$hits" | show; }
if git rev-parse origin/main >/dev/null 2>&1; then
  n="$(git log origin/main..HEAD --format=%B | grep -ciE 'co-authored-by|generated with|claude|anthropic')"
  [ "$n" = 0 ] && ok "2e AI attribution in commits" "none in the unpushed commits" || warn "2e AI attribution in commits" "$n line(s) in unpushed commits; the squash commit replaces them"
fi

# (3) hard-coded absolute paths in shipped code and docs. /home/u/ and /home/user/ are fake test paths.
P='(/home/david|/mnt/DATA|/mnt/Data|/home/[a-z][a-z0-9_-]*/)'
hits="$(grep -v '^scripts/lab/' "$TMP/text" | xargs -d '\n' grep -InE "$P" 2>/dev/null | grep -vE '/home/(u|user|you|name|someone)/|^scripts/release-check\.sh|^docs/RELEASE\.md' | cut -c1-150)"
[ -z "$hits" ] && ok "3a absolute dev paths" "none outside scripts/lab" || { bad "3a absolute dev paths" ""; printf '%s\n' "$hits" | show 12; }
lab="$(git ls-files scripts/lab | head -1)"
[ -d scripts/lab ] && git check-ignore -q scripts/lab/x && ok "3b lab harness paths" "scripts/lab is ignored, so its personal paths are not published" \
  || bad "3b lab harness paths" "scripts/lab is not ignored: it names /home/david and /mnt/DATA"

# (4) .gitignore, stray files, size
miss=""
for p in dev/x CLAUDE.md openspec .atl __pycache__/a.pyc a.pyc bar/modules/ito-art/sh/x.png bar/modules/ito-art/hollow/x.png scripts/__pycache__/q.pyc a.bak a.lock; do git check-ignore -q "$p" || miss="$miss $p"; done
[ -z "$miss" ] && ok "4a .gitignore rules" "dev, CLAUDE.md, openspec, .atl, pyc, bak, lock, ito-art/sh ignored" || bad "4a .gitignore rules" "not ignored:$miss"
ti="$( { git ls-files -ci --exclude-standard; git diff --cached --name-only | git check-ignore --stdin 2>/dev/null; } | sort -u)"
[ -z "$ti" ] && ok "4b ignored paths tracked/staged" "none" || { bad "4b ignored paths tracked/staged" "$(printf '%s\n' "$ti" | wc -l) ignored path(s) still in the index; run the git rm -r --cached lines of docs/RELEASE.md step 3:"; printf '%s\n' "$ti" | show 12; }
tr="$(git ls-files | grep -E '^(dev|openspec|\.atl)(/|$)|^CLAUDE\.md$' || true)"
[ -z "$tr" ] && ok "4b2 private files tracked" "none tracked" || { bad "4b2 private files tracked" "tracked, remove with git rm --cached:"; printf '%s\n' "$tr" | show; }
st="$(grep -E '(^|/)__pycache__/|\.pyc$|\.bak|~$|\.swp$|\.lock$|\.orig$|\.rej$|\.DS_Store$|\.log$' "$TMP/all" || true)"
[ -z "$st" ] && ok "4c stray files" "no pycache / bak / lock / log in the publish set" || { bad "4c stray files" ""; printf '%s\n' "$st" | show; }
# root entries: only known names; anything else is probably a stray file (for example a mis-redirected command output).
KNOWN='^(\.gitignore|ART_LICENSE\.md|BarWidget\.qml|CHANGELOG\.md|CONTRIBUTING\.md|LICENSE|NOTICE|README\.md|THIRD_PARTY_NOTICES\.md|install\.sh|manifest\.json|preview\.jpg|assets|bar|compat|docs|icons|plugins|scripts|seed|skills|themes)$'
rootx="$(cut -d/ -f1 "$TMP/all" | sort -u | grep -vE "$KNOWN" || true)"
[ -z "$rootx" ] && ok "4d root entries" "all known" || { bad "4d root entries" "unknown, stray?:"; printf '%s\n' "$rootx" | show; }
sz="$(xargs -d '\n' du -cb < "$TMP/all" | tail -1 | cut -f1)"
if [ "$sz" -gt 104857600 ]; then warn "4e publish size" "$((sz/1048576)) MB (over 100 MB)"; else ok "4e publish size" "$((sz/1048576)) MB in $(wc -l < "$TMP/all") files"; fi
echo "      largest 20 files:"; xargs -d '\n' stat -c '%s %n' < "$TMP/all" | sort -rn | head -20 | awk '{printf "        %6.2f MB  %s\n",$1/1048576,$2}'

# (5) manifests and URLs
python3 - "$REPO" <<'PY' && ok "5a manifests" "valid JSON, ids well formed, plugin ids match their folders" || bad "5a manifests" "see above"
import glob, json, os, re, sys
root = sys.argv[1]; bad = 0
for f in ["manifest.json"] + sorted(glob.glob("plugins/*/manifest.json")):
    try: m = json.load(open(os.path.join(root, f)))
    except Exception as e: print("        invalid JSON:", f, e); bad += 1; continue
    i = m.get("id", "")
    if not re.fullmatch(r"[a-z0-9][a-z0-9._-]*", i): print("        bad id:", f, repr(i)); bad += 1
    if f != "manifest.json" and i != os.path.basename(os.path.dirname(f)): print("        id differs from folder:", f, i); bad += 1
    for k in ("name", "version"):
        if not m.get(k): print("        missing", k, ":", f); bad += 1
sys.exit(1 if bad else 0)
PY
old="$(xargs -d '\n' grep -h 'github\.com/Davidxap/ito-verse-shell' < "$TMP/text" 2>/dev/null | grep -viE 'archiv|legacy|previous repository|successor' | wc -l)"
new="$(xargs -d '\n' grep -oh 'github\.com/Davidxap/ikai-shell' < "$TMP/text" 2>/dev/null | wc -l)"
if [ "$old" -gt 0 ] && [ "$new" -gt 0 ]; then bad "5b repo URLs" "mixed: $old old (ito-verse-shell) and $new new (ikai-shell)"
elif [ "$old" -gt 0 ]; then warn "5b repo URLs" "$old still point to Davidxap/ito-verse-shell (expected until docs/RELEASE.md step: URL rename)"
else ok "5b repo URLs" "$new point to Davidxap/ikai-shell, none to the legacy repo"; fi

# (6) licences and naming
lic=""; for f in LICENSE ART_LICENSE.md NOTICE THIRD_PARTY_NOTICES.md; do [ -s "$f" ] || lic="$lic $f"; done
for p in bar state audio network bluetooth power display; do [ -s "plugins/ito.$p/LICENSE" ] || lic="$lic plugins/ito.$p/LICENSE"; done
[ -z "$lic" ] && ok "6a licence files" "LICENSE, ART_LICENSE, NOTICE, THIRD_PARTY_NOTICES and the 7 MIT folders" || bad "6a licence files" "missing:$lic"
grep -q 'PolyForm Noncommercial License 1.0.0' LICENSE && ok "6b code licence" "PolyForm Noncommercial 1.0.0" || bad "6b code licence" "LICENSE text not PolyForm Noncommercial"
oldn="$(grep -nE 'Ito[- ]verse( Shell)?' README.md LICENSE NOTICE ART_LICENSE.md THIRD_PARTY_NOTICES.md manifest.json 2>/dev/null | grep -vE 'formerly|began as|legacy|themes/ito-verse|ito-verse-shell|Ito-verse-icons|Ito-verse/|Ito-verse cursor' || true)"
[ -z "$oldn" ] && ok "6c IKAI naming" "no legacy product name in README, licences, manifest" || { bad "6c IKAI naming" ""; printf '%s\n' "$oldn" | show; }
for f in docs/INSTALLATION.md docs/UPGRADING.md docs/RELEASE.md; do [ -s "$f" ] || bad "6d docs present" "missing $f"; done
grep -q '^## Unreleased' CHANGELOG.md && ok "6e CHANGELOG" "has an Unreleased section" || bad "6e CHANGELOG" "no Unreleased section"

echo
printf 'Result: %d FAIL, %d WARN\n' "$fails" "$warns"
[ "$fails" -eq 0 ]

# Publishing IKAI: the checklist

For the maintainer. Every command here is run **by you**, in order, when you decide to publish. Nothing in this repository
runs them for you, and nothing here has been run yet. Names used: new repository `Davidxap/ikai-shell`, legacy repository
`Davidxap/ito-verse-shell` (to be archived).

## 0. Decide first

- [ ] The root manifest `id` (`davidxap.ito-verse-shell`, also `moduleName` in `BarWidget.qml`) and every `ito.*` plugin id stay as
      they are: renaming them makes Omarchy treat IKAI as a different plugin and breaks saved bar layouts. Only the URLs change.
- [ ] `themes/ito-verse/backgrounds/tomie.png` (8 MB) is a third-party collage. Confirm you may publish it, or leave it out of the
      commit (`git rm --cached themes/ito-verse/backgrounds/tomie.png`, then drop the README line that links it).
- [x] Decided: `scripts/lab/` (the development lab harness, 143 files naming `/home/david` and `/mnt/DATA`) is not part of the
      shell. It is in `.gitignore`; step 3 removes its 10 tracked files from the index. `scripts/check-qml.sh` and
      `scripts/qa/test-userart.sh` skip what lives there when the folder is absent.
- [x] Decided and done in `.gitignore`: `scripts/fix-omaplug-placement.sh`, `scripts/fix-update-center.sh` (one-off Shibumi
      fixes), `scripts/itobar-apply.sh`, `itobar-try.sh`, `itobar-backup.sh` (engine trial tools) and
      `scripts/gen-preview-sheet.py` (a mock-up generator) are referenced by nothing shipped and stay local; step 3 removes
      the tracked ones from the index. `scripts/omarchy-bar-boot-hotfix.sh` and `scripts/qt612-color-hotfix.sh` are
      Omarchy/Qt workarounds the compat list mentions: kept.
- [x] The stray root file `uzumaki-vortex` no longer exists.
- [ ] Version: `manifest.json` says `0.2.0-beta`. Keep it, or bump it (and the README header line) before the commit.

## 1. Check the tree

```bash
cd /mnt/DATA/Themes/Ito-verse
scripts/release-check.sh            # every line PASS (a WARN is a note); 5b warns until step 2 is done
node --test scripts/qa/ && scripts/check-qml.sh
bar/modules/bin/ito-health --text   # no WARN or FAIL
git status --short | head -50       # read it: only what you mean to publish
```

## 2. Point the URLs at the new repository (33 hits: 31 URLs, plus 2 ids that must NOT change)

```bash
cd /mnt/DATA/Themes/Ito-verse
grep -rIl 'github\.com/Davidxap/ito-verse-shell' --exclude-dir=.git --exclude-dir=dev --exclude=RELEASE.md --exclude=release-check.sh . \
  | xargs sed -i 's#github\.com/Davidxap/ito-verse-shell#github.com/Davidxap/ikai-shell#g'
scripts/release-check.sh            # 5b now PASS
git diff --stat | tail -1
```

This touches `manifest.json`, the 25 `plugins/*/manifest.json` (`homepage`), `README.md`, `docs/INSTALLATION.md`,
`bar/modules/bin/ito-health`, `bar/modules/cc/PageShells.qml` and `bar/modules/cc/ControlCenter.qml`. The id
`davidxap.ito-verse-shell` is not a URL and is left alone. Then deploy once so the live shell shows the new link:
`flock /tmp/ito-deploy.lock scripts/deploy.sh`.

## 3. One conventional commit, no AI attribution

A new repository should not inherit the 14 unpushed commits of the old one. Make a root commit of the tree as it is:

```bash
cd /mnt/DATA/Themes/Ito-verse
git checkout --orphan ikai-release
# every path that is ignored but still tracked leaves the index first (the files stay on disk):
git ls-files -ci --exclude-standard -z | xargs -0 -r git rm --cached -q
#   for the decisions above this removes the tracked files of scripts/lab/, the ignored scripts and the old-brand images (preview.png, docs/screenshots/desktop-control-center.jpg); to see them first: git ls-files -ci --exclude-standard
git rm -r --cached -q --ignore-unmatch scripts/lab   # explicit form of the same thing, harmless if already gone
scripts/release-check.sh            # 4b must now PASS
git add -A                          # honours .gitignore: dev/, CLAUDE.md, openspec, .atl, pycache stay out
git status --short | head -20       # last look
git commit -m "feat: IKAI shell, first release" \
           -m "A bar and Control Centre for Omarchy (Quickshell plugins), art, tools and docs; see CHANGELOG.md."
git log --format='%an <%ae>%n%B' -1 # one commit, your name, no Co-Authored-By line
```

If you would rather keep the history of the legacy repository: `git reset --soft origin/main && git add -A && git commit -m ...`
squashes the 14 local commits into one on top of it (the old history stays in the new repository).

## 4. The new repository

```bash
gh repo create Davidxap/ikai-shell --public --description "IKAI (異界): a bar and Control Centre for Omarchy" --source . --remote ikai
git push -u ikai ikai-release:main
git tag -a v0.2.0-beta -m "IKAI 0.2.0-beta"     # the version in manifest.json
git push ikai v0.2.0-beta
gh release create v0.2.0-beta --repo Davidxap/ikai-shell --prerelease --title "IKAI 0.2.0-beta" --notes-file <(sed -n '/^## Unreleased/,/^## /p' CHANGELOG.md | sed '$d')
```

Then, on GitHub, check **Settings → Features** (issues on), the topics (`omarchy`, `quickshell`, `hyprland`), and that the
licence is detected as PolyForm Noncommercial.

## 5. Archive the legacy repository, with a pointer

```bash
git clone https://github.com/Davidxap/ito-verse-shell.git /tmp/ito-verse-shell-legacy && cd /tmp/ito-verse-shell-legacy
printf '# Moved\n\nThis project is now **IKAI**: https://github.com/Davidxap/ikai-shell\n\nThis repository is archived and kept only so old links keep working.\n' > README.md
git add README.md && git commit -m "docs: point to the IKAI repository" && git push
gh repo edit Davidxap/ito-verse-shell --description "Moved to https://github.com/Davidxap/ikai-shell" 
gh repo archive Davidxap/ito-verse-shell --yes
```

Archiving is reversible in the repository settings; renaming or deleting the legacy repository is not part of this plan.

## 6. Omarchy marketplace

Comment on issue #8573 (check the repository that issue lives in before posting) with:

> IKAI (formerly "Ito-verse Shell") is published at https://github.com/Davidxap/ikai-shell (prerelease v0.2.0-beta).
> It is an Omarchy plugin: `omarchy plugin add https://github.com/Davidxap/ikai-shell`. Root manifest: `manifest.json`
> (id `davidxap.ito-verse-shell`, kind `bar-widget`). Licence: PolyForm Noncommercial 1.0.0 for the code, a separate art
> licence for the art, MIT for the forked bar engine and the five re-skinned Omarchy widgets. It needs Omarchy 4.0.6 or newer.
> The old repository `Davidxap/ito-verse-shell` is archived and points here.

## 7. After publishing

- [ ] `omarchy plugin add https://github.com/Davidxap/ikai-shell` on a clean user (or a scratch `HOME`) installs and `ito-health --text` is green.
- [ ] README links, the licence badge and the release page open.
- [ ] Remove the `origin` remote of the working copy or point it at the new repository: `git remote set-url origin https://github.com/Davidxap/ikai-shell.git`.

## 8. Texts to paste (archive note and repository description)

Additive text for step 5 and step 4. Replace `<NEW-REPO-URL>` with the final address (planned: `https://github.com/Davidxap/ikai-shell`).

### README of the ARCHIVED legacy repository (`Davidxap/ito-verse-shell`)

```markdown
# Ito-verse Shell is archived

**Ito-verse Shell continues as IKAI (異界): <NEW-REPO-URL>**

IKAI is the same project under a new name. It began as a shell in Junji Ito's universe, drifted into its own thing, and now
lives where Ito's manga and Silent Hill's Otherworld meet; 異界 (*ikai*) means "different world", the other world beyond the
ordinary one.

- This repository is **archived** as the legacy project. It is not maintained, and it is kept only so old links keep working.
- The rename is visible-brand only. Plugin ids (`ito.*`), commands (`ito-*`), `~/.config/ito` and the `itoverse` style id
  are unchanged, so existing installs and saved layouts keep working.
- Why the name, what it is based on and the credits: `docs/ABOUT.md` in the IKAI repository.

Fan work, not affiliated with or endorsed by Junji Ito, his publishers, Konami, HANCORE or Omarchy.
```

### GitHub description and topics of the NEW repository

- Description (one line): `IKAI (異界): a bar and Control Centre for Omarchy, from the other world. Fog, rust and ink, inspired by Junji Ito and Silent Hill. Successor of Ito-verse Shell.`
- Topics: `omarchy`, `quickshell`, `hyprland`, `status-bar`, `control-center`, `junji-ito`, `silent-hill`, `theme`

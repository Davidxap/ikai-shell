# Upgrading Omarchy, Arch and Qt under IKAI

IKAI is a plugin set that rides on Omarchy's shell, so an Omarchy, quickshell or Qt update can change something it reads.
One tool watches for that: `ito-compat` (also shown in the Health page as "Omarchy compatibility").

```
ito-compat check     "ok", or a list: what changed / is it safe / fix   (exit 0 ok, 1 drift, 2 broken)
ito-compat status    versions we verified vs installed, and what is watched
ito-compat json      the same for tools (ito-health reads this)
```

## What it watches
- Versions of omarchy, quickshell, qt6-base and hyprland against `compat/verified.json`.
- Files we copy byte for byte: the lock service (`plugins/ito.lock/Service.qml`, hash in `plugins/ito.lock/service.sha256`).
- Every `/usr/share/omarchy` path, every `omarchy-*` command, every `Commons.*` member and `qs.Ui` type our code uses.
- The Qt 6.12 import pin (`scripts/qa/check-qt-color.sh`) when the repository is present.

## After `pacman -Syu` or an Omarchy update
1. `ito-compat check`. A patch-only bump is a note; a minor bump or a changed Omarchy file is drift; a missing path, command or API is broken.
2. Fix what it names. The lock copy: `scripts/sync-ito-lock.sh`, read `git diff plugins/ito.lock`, deploy.
3. Run the gates: `node --test scripts/qa/`, the `scripts/qa/test-*` scripts, `scripts/check-qml.sh`.
4. Use the shell for a while. Once you are satisfied, accept the new versions: `scripts/sync-compat.sh --record`
   (asks first; never run by a hook). Commit `compat/verified.json` and `bar/modules/compat/verified.json`.

A new `omarchy-*` command or `/usr/share/omarchy` read in our code makes `scripts/qa/test-compat.sh` fail until it is recorded
the same way, so the watch list cannot go stale.

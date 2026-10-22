# About IKAI

IKAI (異界) is a bar and Control Centre for [Omarchy](https://omarchy.org). This page tells where the name comes from, what
the project stands on, what changed from Ito-verse Shell, and who is and is not connected to it.

## The name

**異界** is read **いかい / ikai** ("ee-kai") and means, literally, "different world": the other world, the world beyond,
the realm on the far side of the ordinary one (spirits, the dead, the uncanny). It is a real, common word in Japanese
horror and folklore writing.

It fits because the project drifted. It started as "Ito-verse Shell", a shell inside Junji Ito's universe. Over time it
became its own thing, but it still lives where Junji Ito's manga and Silent Hill's Otherworld meet. Japanese Silent Hill
fans call that other world **裏世界** (*ura-sekai*, the "reverse world"); that is a fandom term, not an official one. What
the shell tries to be is an interface found on the other side: rusted, hand-inked, a little wrong, and still readable at
a glance.

The seal in the middle of the bar keeps its kanji, including 伊藤 (Ito). It stays as a credit to the artist, not as the
name of the project.

## What it is based on

- **The bar engine: a fork.** `plugins/ito.bar` and `plugins/ito.state` are a fork of
  [Shibumi-Shell](https://github.com/HANCORE-linux/Shibumi-Shell) by HANCORE (the plugin `hancore.shibumi.bar`), MIT licence,
  Copyright (c) 2026 HANCORE. `plugins/ito.bar/NOTICE` says it is "mostly HANCORE's code: measured against the original,
  about 91% of the lines are the same", and that IKAI changed the plugin id and namespace (`ito.*`), the `itoverse` visual
  style, room for more widgets per side, and a few fixes. The layout engine, the drag-and-drop, the two layouts and the
  saved state are HANCORE's work. For `ito.state` the notices give about 98%.
- **The platform.** Omarchy (MIT, David Heinemeier Hansson and contributors) is the host the bar runs inside, with its shell
  engine and `omarchy-*` commands; Quickshell and Hyprland sit under it. Five widgets (`ito.audio`, `network`,
  `bluetooth`, `power`, `display`) are Omarchy's own, re-skinned: the logic is theirs, the artwork and readings are ours.
- **Written here.** The other widgets, the Control Centre, workspace styles, seal and decorations, media effects, custom
  pictures and GIFs, saved setups, the Health page and its report, and the tools.
- **Visual inspiration.** Junji Ito's manga (*Uzumaki*, *Tomie*; the notices also name *Gyo* and *Amigara Fault*) and the
  Silent Hill games: fog, rust, static, Pyramid Head, and the symbols of the Order. No code, page or asset from the books
  or the games is included or was copied; the names and imagery belong to their owners.

## What changed from Ito-verse Shell to IKAI

From the [CHANGELOG](../CHANGELOG.md), first IKAI release:

- The shell is now called **IKAI (異界)**. Visible names only: README, docs, About, Health, tooltips, manifest names,
  licence product names, icon and cursor theme names, installer messages.
- Unchanged on purpose: the `ito.*` plugin ids, the `ito-*` commands, `~/.config/ito` and `~/.cache/ito`, the `itoverse`
  style id, the `ito-verse` theme and icon/cursor folder names, and the root manifest id. Renaming ids would make Omarchy
  treat IKAI as a different plugin and break saved bar layouts. This is a decision, not an oversight.
- An optional `ikai` command alias: `ln -s ~/.config/omarchy/bar/modules/bin/ito-config ~/.local/bin/ikai`.
- Added since the legacy version, among other things: new boot and lock scenes (Welcome Road, Pyramid, Tomie, Moth),
  Silent Hill workspace families and marks, the Cult Symbols set, a per-icon choice between the original and the Silent
  Hill drawing, and a compatibility check (`ito-compat`). The full list is in the CHANGELOG.

## If you used Ito-verse Shell

- **Archived, not maintained.** The previous repository (`github.com/Davidxap/ito-verse-shell`) is archived as the legacy
  project. IKAI is its successor; new work happens here.
- **What keeps working:** your commands (`ito-config`, `ito-health`, ...), your settings folder (`~/.config/ito`), your
  saved layouts and styles (the plugin ids and the `itoverse` style id are unchanged), and your own art under
  `~/.config/ito/assets`.
- **What to do:** install from the new repository (see [INSTALLATION.md](INSTALLATION.md)) and run `ito-health --text`.
  `docs/UPGRADING.md` covers updates after Omarchy, Quickshell or Qt changes.
- Not verified here: a step-by-step upgrade from an old install on a separate machine. Run Health after the first start.

## Credits

- **HANCORE** for the bar engine worth forking (Shibumi-Shell, MIT).
- **David Heinemeier Hansson and the Omarchy contributors** for the platform and the widgets re-skinned here (MIT).
- **Junji Ito** and the **Silent Hill** games, as inspiration only.
- Some source images were found online and edited; their authors keep their rights. The Tomie ink drawing used for the
  lock, menu and workspace art is signed `@Lunar_enchantress`, is a third party's work, and is not distributed here.
  Rights holders can ask for credit or removal. Full list: [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

## Licences, short

- Code: PolyForm Noncommercial 1.0.0 ([LICENSE](../LICENSE)).
- Bar engine (`ito.bar`, `ito.state`): MIT, (c) HANCORE. Five re-skinned widgets: MIT, (c) David Heinemeier Hansson.
- Art (icons, marks, wallpapers): personal, non-commercial use ([ART_LICENSE.md](../ART_LICENSE.md)). It is fan art; do not
  present it as official Junji Ito or Silent Hill material.
- [NOTICE](../NOTICE) lists every part.

## Not affiliated

IKAI is a fan work. It is not affiliated with or endorsed by Junji Ito, his publishers, Konami, HANCORE or Omarchy.

# Third-party notices

IKAI stands on other people's work. This file says whose, what was used, and under which licence, so that
each of them gets the credit they are owed. If something here is missing or wrong, open an issue and it will be fixed.

## Code that is in this repository

| Work | Author | Licence | Where | What was used |
|---|---|---|---|---|
| [Shibumi-Shell](https://github.com/HANCORE-linux/Shibumi-Shell) | **HANCORE** | MIT | `plugins/ito.bar`, `plugins/ito.state` | The bar engine, forked: the layout engine, drag-and-drop, the two layouts (islands and screen-edge forms) and the saved state. About 91 % of the lines of `ito.bar` and 98 % of `ito.state` are still theirs. IKAI renamed it (`ito.*`), added its own visual style and made room for more widgets. The shapes of the bar (islands, pills, notch) also take aesthetic cues from Shibumi. Licence: `plugins/ito.bar/LICENSE`, `plugins/ito.state/LICENSE`. |
| [Omarchy](https://github.com/basecamp/omarchy) | **David Heinemeier Hansson** and contributors | MIT | `plugins/ito.audio`, `ito.network`, `ito.bluetooth`, `ito.power`, `ito.display` | Five widgets whose panels and logic are Omarchy's own, re-skinned with new artwork and readings. Licence: the `LICENSE` file inside each of those folders. |
| [PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0) | The PolyForm Project | (the licence text itself) | `LICENSE` | The licence IKAI's own code is offered under. |

## What IKAI needs at run time (not included)

These are installed by you and are not part of this repository:

- **[Omarchy](https://omarchy.org)** (MIT): the host the bar runs inside (`qs.Ui`, `qs.Commons`), its shell engine, its first-party
  plugins and its `omarchy-*` commands.
- **[Quickshell](https://quickshell.org)** (LGPL-3.0) and **[Hyprland](https://hyprland.org)** (BSD-3-Clause).
- **Noto Serif** and **Noto Serif CJK** (SIL Open Font License 1.1, Google): the typeface of the numbers, the clock and the
  kanji seal. Referenced by name, not bundled.
- **Adwaita** icons (LGPL-3.0 / CC BY-SA 3.0, The GNOME Project): the icon theme falls back to it for icons IKAI does not draw.
- **[wttr.in](https://github.com/chubin/wttr.in)** (Igor Chubin): the weather service `ito.weather` asks.
- **Python** with **Pillow** (HPND) and **NumPy** (BSD-3-Clause), used by the picture and art tools; `rsync`, `jq`, `zenity` and
  `wl-clipboard` for the installer and the panel.

## Inspiration

IKAI is a fan work **inspired by** Junji Ito's manga (*Uzumaki*, *Tomie*, *Gyo*, *Amigara Fault*) and by the Silent Hill
games. No code, page or asset from Junji Ito's books or from Konami's games is included or was copied; the names and the
imagery belong to their owners and are used only as inspiration. It is not affiliated with or endorsed by them, by HANCORE or
by Omarchy.

## Images

Some source images (a design sheet that is not included here, and the pieces cut from it that live in
`bar/modules/ito-art/`) were found online and edited. The Tomie wallpaper in `themes/ito-verse/backgrounds/` is the one image of
the work-in-progress Tomie theme that is published. They remain the property
of their authors, and `ART_LICENSE.md` explains the terms and how to ask for credit or removal. Everything drawn by the scripts
in `scripts/` is original work.

## Thank you

To HANCORE for a bar engine worth forking, to David Heinemeier Hansson and the Omarchy contributors for the platform and
widgets this is built on, and to Junji Ito for the nightmares.

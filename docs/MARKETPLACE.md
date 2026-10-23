# Omarchy Marketplace listing

For the maintainer. Nothing here contacts anyone: it is the checklist and the text to paste when you decide to submit.

## What the listing requires

Omarchy's own documentation (`/usr/share/omarchy/shell/README.md`, `omarchy plugin validate`) defines **plugins**, not a
marketplace process. The only stated requirements are technical; the submission itself is a comment on Omarchy issue
#8573 (check which repository that issue lives in before posting). Requirements known from Omarchy:

- A **git repository** with `manifest.json` at its root; `omarchy plugin add <url>` clones it into
  `~/.config/omarchy/plugins/<id>/`.
- Manifest: `schemaVersion` exactly `1`, `id`, `name`, `version`, `kinds` (non-empty array), `entryPoints` (safe relative
  paths that exist); id not in the reserved `omarchy.*` namespace; no symlinks inside the plugin folder.
- Optional but used by listings: `author`, `description`, `license`, `homepage`, `barWidget.displayName/category`.
- No screenshots, icon or category field exists in the manifest schema; screenshots are linked from the README.

## Our status

| Item | Status |
|---|---|
| `omarchy-plugin-validate .` (root) | PASS (run from a clean clone: the local `CLAUDE.md` symlink is untracked and not published) |
| Root manifest | id `davidxap.ito-verse-shell` (kept on purpose, renaming breaks saved layouts), name `IKAI`, version `0.2.0-beta`, kind `bar-widget`, entry `BarWidget.qml`, licence `PolyForm-Noncommercial-1.0.0`, author `davidxap` |
| 25 `plugins/ito.*/manifest.json` | PASS (validate); each has id, version, licence (MIT for the forked engine and the five re-skinned widgets) and `homepage` |
| Homepage URL | `https://github.com/Davidxap/ikai-shell` until step 2 of [RELEASE.md](RELEASE.md) points it at `ikai-shell` |
| Licence | PolyForm Noncommercial 1.0.0 (code), [ART_LICENSE.md](../ART_LICENSE.md) (art), MIT (HANCORE engine, Omarchy widgets) |
| Screenshots | `docs/screenshots/`; no personal data. The Control Centre captures are rendered offscreen with fake data under the IKAI name |
| Version | `0.2.0-beta`, prerelease tag `v0.2.0-beta` |
| Requirements stated | Omarchy 4.0.6 or newer |

## Submission text (paste)

**Title:** IKAI 異界

**Short description:** A bar and Control Centre for Omarchy from the other world: fog, rust and ink, inspired by Junji Ito and Silent Hill.

**Category:** Appearance (bar / shell)

**Long description:**

> IKAI (異界, "the other world", formerly Ito-verse Shell) replaces Omarchy's bar with one drawn as fine engravings, and adds
> a Control Centre to change nearly everything without touching a file. It runs as a plugin inside Omarchy's own shell.
>
> - Bar styles Islands, Full, Fit, Dock and Notch on any edge; a dozen workspace families or your own pictures; menu marks and
>   seals; popups drawn as inked panels.
> - Eleven Control Centre pages (Styles, Bars, Icons, Logo, Effects, Workspaces, Colors, Plugins, Setup, Boot & Lock, Health),
>   with search, Undo and per-section Reset.
> - Per-icon drawings (Original, Ink, Relic, Hollow), lock designs, boot cards, a fastfetch picture, presets and saved setups.
> - Your own art is supported and never leaves your machine.
> - A Health page that fixes what it can and writes a report any AI assistant can read; `ito-compat` checks every Omarchy,
>   Quickshell and Qt dependency after an update.
>
> Install: `omarchy plugin add https://github.com/Davidxap/ikai-shell`, enable the *Install IKAI* widget and answer the
> questions in the terminal. Requires Omarchy 4.0.6 or newer. Beta.

**Preview:** the root `preview.jpg` (the Marketplace builds its card and detail images from it); it is the same collage as `docs/screenshots/preview.jpg`.

**Screenshots (in this order):** `docs/screenshots/preview.jpg` (the collage first),
`docs/screenshots/cc-workspaces-dark.png`, `docs/screenshots/cc-logo-dark.png`, `docs/screenshots/popup-calendar-dark.png`,
`docs/screenshots/cc-workspaces-light.png`, `docs/media/tour.gif`.

**Licence note:** the code is PolyForm Noncommercial 1.0.0 (free for non-commercial use); the art is under a separate
personal, non-commercial art licence (`ART_LICENSE.md`). The bar engine (`plugins/ito.bar`, `plugins/ito.state`) is a fork of
Shibumi-Shell by HANCORE (MIT), and five widgets are re-skinned from Omarchy's own (MIT, David Heinemeier Hansson). Fan work,
not affiliated with Junji Ito, his publishers, Konami, HANCORE or Omarchy.

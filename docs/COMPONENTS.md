# Components

What is in the shell, grouped the way the repo is: the bar engine, the widgets on it, and the theme
underneath.

## Bar engine (`plugins/ito.bar`, `plugins/ito.state`)

A fork of the Shibumi bar engine by HANCORE (MIT; see `plugins/ito.bar/NOTICE` and `LICENSE`), running as a plugin inside
Omarchy's own shell host. It adds a pluggable style registry (IKAI's own style lives beside
Shibumi's, not on top of it), island/split/notch shapes, per-group corner radii, drag-to-reorder, and
the layer that reads `bar/modules/ito-style.json` (see `ito-config` below). It needs a suite-marker
signature (`.ito-managed.json`, written by `scripts/gen-itobar-marker.py`) to match its own files
exactly, or it refuses to start — `scripts/deploy.sh` keeps that signature current automatically.

## Widgets (`plugins/ito.*`)

Native IKAI widgets, each talking to the machine directly (no Omarchy CLI involved):

| Widget | What it is |
|---|---|
| `ito.tomie` | The 富江 seal at the centre of the bar. Opens the Control Centre (also from `omarchy-shell ito.controlcenter`). The one widget that cannot be turned off. |
| `ito.spiral` | The application menu button, drawn as Tomie's spiral. |
| `ito.workspaces` | Hyprland workspaces in eight drawn styles (Seals, Rings, Tomie, Remina, Uzumaki, Marks, Halo, Flauros) or four pictures of your own; the active one in blood. |
| `ito.tray` | The system tray, one sheet icon. |
| `ito.notifications` | The bell: still when idle, blood when something is waiting, an eye when muted. Toggles Do Not Disturb (through `ito-host dnd`, so it works without Omarchy's notification service); right-click opens the history. |
| `ito.media` | Previous/play-pause/next for whatever MPRIS player is active; draws nothing when none is. Right-click opens the player. |
| `ito.awake`, `ito.nightlight`, `ito.recording` | Stay awake, night light and screen recording, one widget each so they can be placed apart. |
| `ito.indicators` | Stay-awake, night light and screen-recording toggles, each with several drawn cameos to choose from. |
| `ito.cpu`, `ito.mem`, `ito.disk` | Live load/RAM/disk usage, engraved chip/RAM/drive artwork. RAM and disk read as `17/32G` in the Amount style; the totals are detected from the machine. |
| `ito.clock`, `ito.date` | The time and the date, serif numerals either side of the seal; the clock has optional seconds, 12 h, a date, kanji digits, the moon and a spiral tick. A click opens the calendar under it. |
| `ito.weather` | Current sky from `wttr.in`, polled over `curl`. |
| `ito.ai` | Local AI-tool token usage, read from whichever tracker is on the machine. |

## The popup kit (`bar/modules/`)

The popups share a small kit, so a new one costs a few lines:

| File | What it does |
|---|---|
| `ItoPanelFrame.qml` | The manga frame: paper, ruled edge, torn corners, blood and screentone, the static burst, the emblem and the note. Takes the shell's card, or any Item through `target`. |
| `ItoCrest.qml`, `ItoEye.qml` | The emblems, drawn as vector curves in the theme's colours. |
| `ItoEnter.qml` | The entrance: a short growth from the bar edge, following the Motion setting. |
| `ItoAutoClose.qml` | Closes a popup a few seconds after the pointer leaves it. |
| `ItoLayout.js` | How large a popup may be beside the bar on any edge (Omarchy's own measure fails with this engine's full-screen bar window). |
| `ItoClockFace.qml` | The bar clock's face (time, seconds, am/pm, moon, tick, date); shared with the lab. |
| `ItoTimeModel.js` | Date math for the clock and calendar, on civil dates, with node tests in `scripts/qa/time.test.mjs`. |
| `ItoEnso.qml` | The open ring that marks today. |
| `ItoMoon.qml` | The moon-phase disc. |
| `ItoCalendarPanel.qml` | The calendar popup (a KeyboardPanel host) opened by the clock and the date; `ItoCalendarCard.qml` is its content. |

## Dressed clones (`plugins/ito.audio`, `ito.network`, `ito.bluetooth`, `ito.display`, `ito.power`)

These started as `omarchy plugin clone` copies of Omarchy's own widgets, restyled to the bar's icon
set and typography. Their **panels and their logic are still Omarchy's** — they call Omarchy's own
CLI tools (`omarchy-*`) rather than talking to PipeWire/NetworkManager/BlueZ/brightnessctl/UPower
directly. This is a known, deliberate limitation (see `docs/THEME_ARCHITECTURE.md`): removing it
would mean rewriting five panels' worth of logic, which has been explicitly deferred.

## Theme and colour (`themes/ito-verse/`)

Everything colour-related comes from `themes/ito-verse/palette.toml`. `colors.toml` (the
foundational palette) and `shell.toml` (the 13 surface families Omarchy's shell engine reads) are
**generated** from it by `scripts/gen-palette.py`, which also checks every stop's contrast before
writing anything — never hand-edit those two files.

## Sidecar settings (`bar/modules/ito-style.json`)

Everything the Control Centre changes at runtime — bar shape and size, which widgets show, the
workspace style, the seal, the marks, the media effect, colours per module — lives here, not in
Omarchy's own `shell.json` (which the engine rewrites on its own whenever a widget is dragged or a
popup opens, and would silently discard anything written to it). Read and write it with
`bar/modules/bin/ito-config`, or through `ItoConfig.qml` from QML.

## Art (`bar/modules/ito-art/`)

`bar/modules/ito-art/` is what the running bar actually reads (see `docs/ICON_SPEC.md` for the exact
files and sizes). Most icons in `ito-art/` are drawn directly by the generators in `scripts/`
(`gen-engraved.py`, `gen-hardware.py`, `gen-decor.py`, ...).

## Tools (`scripts/`, `bar/modules/bin/`)

See the README's "Everyday tools" table for the tools meant to be run directly
(`ito-restart`, `ito-health`, `ito-config`, ...). Beyond those:

| Script | What it's for |
|---|---|
| `deploy.sh` | Repo → live sync. If anything would change and a shell is running it stops it first, copies, refreshes the engine's signature and starts it again; with nothing to change it does nothing. Also creates `shell.ito.json` (`seed-variant.py`) on a machine that never ran IKAI. The normal way to apply changes. |
| `seed-variant.py` | Makes IKAI known to `shell-switch` on a fresh machine: keeps the shell you are on as its own variant, and builds `shell.ito.json` from your `shell.json` plus `seed/shell.ito.json`. Never overwrites an existing one. |
| `check-qml.sh` | Lints the Control Centre pages and shared components before a deploy. |
| `qa/sweep-settings.py` | Beta QA: sets every option one value at a time on the live shell and asks Health after each whether an error appeared. |
| `sync.sh` | The lower-level `pull` / `push` / `status` rsync deploy.sh wraps. |
| `shell-switch` | Detects every installed shell and switches to one cleanly (stop → save → swap → start → verify). |
| `gen-palette.py` | Generates `colors.toml` / `shell.toml` from `palette.toml`, validating contrast. |
| `gen-engraved.py`, `gen-hardware.py`, `gen-decor.py`, `gen-marks.py`, `gen-tomie-icons.py`, `gen-indicator-icons.py`, `gen-gtk.py` | Icon/GTK-theme generators; each is its own icon family. |
| `gen-itobar-marker.py` | Writes the bar engine's suite-marker signature. |
| `gen-assets.py` | The tint helper the generators use to recolour art to a palette. |
| `lab/lore-sheets.sh` | Renders the three lore sheets (CPU, memory, storage; four palettes, idle to critical, subtle and full) to `/tmp/ito-lab/` on fake data and prints any budget or clearance failure. |
| `lab/` | Renders QML scenes off-screen, for iterating on an icon or effect without a live bar. |

## Lore pass (system panels, `loreLevel` off | subtle | full)

| Component | What it is |
|---|---|
| `bar/modules/ItoLore.js` | Pure logic: panel states and flags, the memo lines, static and rust maths, the Amigara figure fill, growth, the event-sign budget. |
| `ItoRust.qml` | The rust grating on a seal's frame: CPU or NVMe temperature, 60 to 90 degrees C. |
| `ItoStatic.qml` | Radio static around the busiest core once it passes 0.8; a burst at `full`. |
| `ItoLoreSfx.qml` | Lettered sound effects (ゴゴゴ, ざわざわ, ぞわぞわ, ドドド), shown for a few seconds when a threshold is crossed, `full` only. |
| `ItoChainChord.qml` | The memory vessel's 85 % line drawn as a taut chain. |
| `ItoGyoWalker.qml` | A fish on metal legs in the storage seal; its legs are how busy the device is. |

# IKAI: the full tour

What IKAI (異界) is and everything it does, in one place. Every name below was checked against the code in this repository
(`bar/modules`, `plugins/*`, `ito-config`). For step-by-step use see [USER_GUIDE.md](USER_GUIDE.md); for the story and credits see
[ABOUT.md](ABOUT.md).

- [What it is](#what-it-is)
- [Architecture](#architecture)
- [Bar widgets (plugins)](#bar-widgets-plugins)
- [The bar: forms, designs, styles](#the-bar-forms-designs-styles)
- [Popups](#popups)
- [Media](#media)
- [Workspaces, menu marks, seals](#workspaces-menu-marks-seals)
- [Icons](#icons)
- [Control Centre](#control-centre)
- [Effects and presets](#effects-and-presets)
- [Boot and Lock, screensaver, fastfetch](#boot-and-lock-screensaver-fastfetch)
- [Your own art](#your-own-art)
- [Settings: `ito-config`](#settings-ito-config)
- [Health, compatibility, backups, upgrades](#health-compatibility-backups-upgrades)
- [Performance](#performance)
- [Limitations and known issues](#limitations-and-known-issues)

## What it is

IKAI is a horror-manga look for the [Omarchy](https://omarchy.org) desktop (Hyprland, Quickshell): a bar, its popups, a lock
screen, boot splash, screensaver and terminal fetch, all drawn from one palette that follows the installed Omarchy theme. The
inspiration is Junji Ito and Silent Hill; the project is unofficial and ships no third-party artwork (see the licence notes in the
[README](../README.md#licence)). It was called Ito-verse Shell before 0.2.0; only the visible name changed.

You configure it from the **Control Centre** (click the centre seal) or with the `ito-config` command. Nothing is applied behind your
back: system-level surfaces (lock, boot, fastfetch) are changed only by commands you run, and each has a revert.

## Architecture

- **Platform.** The bar runs as a plugin hosted inside Omarchy's own shell engine (`qs.Ui`, `qs.Commons`). It is not a standalone
  Quickshell shell. Hyprland and Quickshell sit under Omarchy. Details: [THEME_ARCHITECTURE.md](THEME_ARCHITECTURE.md).
- **Engine fork.** `plugins/ito.bar` and `plugins/ito.state` are a fork of the Shibumi bar engine (MIT, HANCORE). They add a style
  system (forms, designs, plate effects), more room for widgets, and fixes. Most of those two plugins is still HANCORE's code.
- **Our plugins.** Every other `plugins/ito.*` folder is a widget or a service (next section). Each has a `manifest.json`.
- **Shared modules.** `bar/modules/` holds what the widgets share: the config reader (`ItoConfig.qml`), the popup frame
  (`ItoPanelFrame.qml`), the Control Centre (`cc/`), the art (`ito-art/`), the defaults registry (`ito-defaults.json`) and the
  command-line tools (`bin/`).
- **Settings** live in a sidecar, `ito-style.json`, not in Omarchy's `shell.json` (the bar engine rewrites `shell.json` and used to
  undo changes). `ito-config` and the Control Centre both read and write the sidecar; `ito-defaults.json` is the one source of what
  "unset" means.
- **Ids kept on purpose.** Plugin ids (`ito.*`), commands (`ito-*`), `~/.config/ito`, `~/.cache/ito`, the `itoverse` style id and
  the `ito-verse` theme folder did not change with the rename, so saved layouts and your art keep working.
- **Host abstraction.** Widgets call `ito-host`, not distribution tools directly.

## Bar widgets (plugins)

From `plugins/*/manifest.json`:

| Plugin | Does |
|---|---|
| `ito.bar`, `ito.state` | The bar host (forked engine) and the normalized config and theme palette state |
| `ito.spiral` | Application menu launcher (the spiral turns and bleeds on hover) |
| `ito.tomie` | The centre seal; opens the Control Centre |
| `ito.workspaces` | Workspace art: bone when idle, blood when active |
| `ito.clock`, `ito.date` | Serif-numeral time (seconds, 12 h, date, kanji digits, moon, tick; opens the calendar) and day/month numerals |
| `ito.cpu`, `ito.mem`, `ito.disk` | Load, memory, disk; the glyph heats with use |
| `ito.audio` | Volume slider, output picker, per-app mixer |
| `ito.network` | Wi-Fi list and connection state |
| `ito.bluetooth` | Device list with connect and disconnect |
| `ito.power` | Battery, power profile, system stats |
| `ito.display` | Brightness slider and laptop display controls |
| `ito.notifications` | A bell: waiting or silenced; click to silence |
| `ito.media` | Previous, play/pause, next for any MPRIS player, plus a player popup |
| `ito.weather` | Conditions now and for the days ahead |
| `ito.ai` | AI usage quota as a brain that fills with blood (form set by `aiStyle`) |
| `ito.tray` | System tray as bare glyphs |
| `ito.indicators` | Stay awake, night light, screen recording, each in several versions |
| `ito.awake`, `ito.nightlight`, `ito.recording` | The same indicators, one icon each, so you can place and move them alone |
| `ito.lock` | IKAI's Quickshell lock screen (a clone of Omarchy's, same PAM flow) |

`ito-plugins` lists every plugin the shell can see and whether it is on the bar. Widgets are placed by drag and drop in Omarchy's
engine; `ito-design` applies a whole arrangement safely.

## The bar: forms, designs, styles

Three independent choices (Control Centre, **Bars** page).

- **Form** (shape; `ItoSurfaces.js`): Islands (a floating pill, the only form that can be cut into islands), Full (edge to edge),
  Fit (as wide as its content, hanging from the edge), Dock (floating pill as wide as its content), Notch (hanging with flowing
  shoulders).
- **Design** (shape plus where each widget sits; `ItoLayouts.js`): Classic, Cluster, Compact, Floating dock, Monitor, Minimal, Zen.
- **Plate style** (`ItoSurfaces.js`): Clean ink, Bloodline, Smoked glass, Print page, Uzumaki, Bare (pills), Otherworld.
  Individual layers can be toggled: plate, smoked glass, print paper, blood, Uzumaki grain, screentone, grain, calm centre, widget
  pills, border, torn edge, fog, fog drift. Sliders: opacity, blood, grain and pill strength.
- **Bar world** (`surfaceWorld`): off, Fog, Rust, Cage.

The bar can sit on any screen edge; popups open beside it on a side bar.

## Popups

Popups are the cards that open from bar widgets. Each is framed by `ItoPanelFrame.qml`, which draws a frame, an emblem and optional
notes in the theme's colours and leaves the shell's own content (values, labels, sliders) on top and untouched.

**How they open.** Click the widget. Many also answer to `omarchy-shell <target> toggle` so a key can open them: `ito.calendar`,
`ito.player`, `ito.storage`, `ito.processor`, `ito.memory`, `ito.notifycenter`, plus Omarchy's `omarchy.network`, `omarchy.bluetooth`,
`omarchy.power`, `omarchy.monitor`. A popup closes on its own after `popupSeconds` (default 3, range 0 to 15, Icons page) once the
pointer has left it.

**Anchoring.** The card opens next to its icon on the bar's side (top, bottom, left or right). The frame knows where the icon meets
the bar edge (`anchorAlong`) so the opening starts from the icon. A debug flag, `debugAnchor`, logs where a popup landed.

**Frame styles** (Styles page, FRAME; `ItoFrameStyles.js`; stored as `panelFrame` and `frameStyle`):

| Style | Key | Look |
|---|---|---|
| Plain | `panelFrame=false` | The shell's own card, untouched, with its own open and close |
| Panel | `manga` (default) | Inked manga panel: ruled frame, torn corners, screentone |
| Chains | `chains` | Iron plates and hanging chains |
| Otherworld | `otherworld` | Rust, barbed wire, grating and fog |
| Minimal | `minimal` | A single quiet rule |

An unknown `frameStyle` resolves to Panel. `frameArt` chooses the art of Panel, Chains and Otherworld: `png` (pictures made once,
default) or `drawn` (procedural). The frame cracks and the border reddens when a popup reports a problem (alert).


**Opening animation** (Styles page, OPENING; `presenceReveal`): `none` (default), `spiral`, `blot`, `static`, `lid` (eyelids).
Related switches: `presence` (the sheet of paper that grows out of the icon and folds back), `presenceShoulders`, `presenceSwitch`
(`morph` between popups). Speed: Effects page, OPENING SPEED, key `openDuration`, 150 to 2400 ms, default 900. `motion` = off
makes every opening instant (`motion`: off, calm, lively; `motionScope`: `ito` or `all`).

**Eyes and vessel.** The eye at the head of a popup is `eyeStyle` (shaded, uzumaki, lashed, veined; the last three need your own
pictures) moved by `eyeMotion` (subtle, full; see Styles). `vesselFill` sets what fills the memory vessel: blood, whirlpool, hair,
rust, static, tone. `loreLevel` (off, subtle, full) adds small notes that follow the machine's state.

**Content per popup** (emblem in brackets; each emblem is the widget's current bar icon, in the style chosen for it, `ItoEmblemMap.js`; the calendar clock is drawn):

| Popup | Contents |
|---|---|
| Audio (waves) | Volume slider, output picker, per-app mixer |
| Network (signal) | Wi-Fi list and connection state |
| Bluetooth (rune) | Devices, connect and disconnect |
| Power (flame) | Battery, power profile, system stats |
| Display (eye) | Brightness and laptop display controls |
| Notifications (telephone) | Notification centre |
| Calendar (clock) | Month view; options `calendarWeekNumbers`, `calendarHolidays`, `calendarWeekStart`, `calendarZones` |
| Weather (sky emblem) | Conditions now and the days ahead |
| AI usage (mind) | AI quota readings |
| CPU / Memory / Disk (needle, web, amigara) | Process list and readings |
| Media player (spiral) | See [Media](#media) |

**Values and labels.** The Icons page sets how readings show on the bar: `valueStyle` (`percent` default, `amount` such as 17/32G,
`number`, `off` for icons only), `showValues`, and `valueLabels` (puts the reading's name in front, "CPU 42%"; not on vertical bars).
In popups the frame is drawn under the content and the card reserves headroom for the emblem (`panelHeadroom`, `panelFootroom`), so
the frame art does not sit over values.

**Theme.** Colours (ink, bone, blood, lit, warn) come from the installed Omarchy theme through `ItoPanelPalette`; light themes use
`.light` art where it exists. Presence and frame effects are static until a popup opens: nothing repaints while it is closed.

## Media

**Bar widget** (`ito.media`). Previous, play/pause and next buttons for whatever is playing, drawn as the sheet's rings. It reads
MPRIS (`Quickshell.Services.Mpris`), so any MPRIS player works: Spotify, a browser, mpv and so on. It uses the player that is
playing, else the first one found, and draws nothing (no bar width) when there is none. No player-specific integration exists; this
repository does not mention Spotifast. Left-click acts; right-click any ring, or `omarchy-shell ito.player toggle`, opens the player.
The tooltip shows the track title.

**Player popup.** Cover art, title, artist, album, a progress line you can seek on, and the controls. The position is polled once a
second only while the popup is open and something plays. The cover is pulled toward grey so any cover sits in the bar's world; with
no cover a spiral is drawn. A horizontal swipe on the card skips to the previous or next track.


**Effect behind the buttons** (`mediaFx`, Effects page, MEDIA; `ItoMediaFx.qml`): `blood` (default), `spiral`, `radio`, `fog`,
`static`, `custom`. It runs only while a track plays and leaps when the track changes. `custom` is your own picture or GIF
(PNG, WebP, APNG, JPG or GIF), chosen on the card and stored at `~/.config/ito/effects/custom`.

**Media icon style.** The play/pause/prev/next rings come in Original, Ink and Relic (Relic needs your shell asset sheet) via the
icon chooser. The Silent Hill cassette drawing on the play/pause button was removed in 0.2.0; a stored `icon:media` key is retired.

**Recording indicator.** Screen recording is an indicator (`ito.recording`, or inside `ito.indicators`) with three versions: Eye
(closed until recording, then opens ringed), Tape (a videotape with a red light) and Cassette (your weathered cassette, available
only once you build it from your sprite sheet; see [Your own art](#your-own-art)). Click to start or stop recording. Its siblings: stay
awake (Coffee, Radio, Flashlight, Weathered cup) and night light (Moon, Fog).

## Workspaces, menu marks, seals

**Workspace families** (`style`, Workspaces page): Seals (`numerals`), Rings (`orbs`, default), Eyes and lips (`eyes`), Remina,
Uzumaki v1, v2, v3, Marks (`dots`), Halo, Flauros, and, from your own art, Tomie, Beetle, Uzumaki Eye, Symbols, Pyramid, Heather,
Cult Symbols (`cult` is drawn by a recipe, no picture needed), plus `custom`. Each has empty, in-use, active and urgent states.
Show rule `workspaceShow`: `count` (always N, `workspaceCount` 1 to 10, default 5) or `used`.

**Menu marks** (`menuMark`, Logo page): Uzumaki v1/v2/v3, Remina Ink, Amigara, Metatron (full and plain), Halo, Flauros, Sheet spiral
(default `spiral`) and, from your art, Uzumaki Eye, Remina, Tomie Classic, Beetle, Heather, Heather sigil, Pyramid roundel, Pyramid
Head, Moth, Eye, Key. Your own pictures dropped in `~/.config/ito/marks/` become marks (`ito-marks`).

**Seal** (`seal`, default `tomie`): the centre button, with kanji options such as Tomie, Uzumaki, Junji Ito, Ikai (異界), Ura-sekai,
Red rust, Remains, Bloodstain, Kaii, Evil eye, Curse, Dense fog and more (`ItoMarks.js`), or your own picture. `sealLit`: auto,
on, off.

**Seal decoration** (`sealDeco`, default `veins`): Veins, Thorns, Curls, Hair, Drips, Eyes, Cracks, Stitches, Holes, Teeth, Chain,
Static, Fog, None. Effects page: `fxSeal`, `fxVeins`, `fxMark` choose the motion of each: Auto, None, Unwind, Breathe, Heartbeat,
Flicker, Sway, Tear, Ripple; `fxWhen` runs them on hover or always.

## Icons

Icons page. The icon chooser sets the drawing of every bar icon one by one, each card shown at the size the bar draws it:

- **Original**: the old inked drawing, exactly as it was.
- **Ink** (id `manga`): drawn in code, takes the theme's colours, sits on any bar style. `iconTone`: `theme` (transparent) or `ink`
  (heavy, the earlier look).
- **Relic** (id `gothic`): from your shell asset sheet; offered once you build it.
- **Hollow** (id `sh`): skins cut from your sprite sheet; offered once you build it.

Per-icon overrides are `icon:<family>` keys plus `iconStyleOverrides`; "Use Original for all" and per-style bulk buttons have Undo for
a few seconds. Other controls: `iconScale` (default 0.62), `aiStyle` (brain default; classic, hemispheres, neurons, eye, spiral),
`netIcon`, clock options (`clockSeconds`, `clockHour12`, `clockDate`, `clockMoon`, `clockNumerals`, `clockTick`), `iconOmens`.

## Control Centre

Click the seal, or `omarchy-shell ito.controlcenter open` (also `toggle`, `close`, `page <name>`). Eleven pages:

| Section | Page | Covers |
|---|---|---|
| Appearance | Styles | Presets, popup frames, openings, eyes, vessel, lore |
| | Bars | Form, design, plate style and layers, world |
| | Icons | Icon chooser, readings, popup timeout, indicator versions |
| | Logo | Seal, seal decoration, menu mark |
| | Effects | Marks and seal motion, media effect, motion, opening speed, light, vibrance, effect speed and strength |
| | Workspaces | Family, count, show rule |
| | Colors | Theme colours or your own accent (`colorMode`, `accentSource`, `accentCustom`) |
| System | Plugins | Installed and available plugins |
| | Setup | Profiles, switching shells |
| | Boot & Lock | Lock screen, terminal fetch, screensaver, boot splash |
| | Health | Runtime checks, errors, Fix buttons |

The search box finds controls on any page; every reset is backed up first.

## Effects and presets

Effects page: motion (off, calm, lively), glow `light` (0 to 2), colour `vibrance`, `fxSpeed`, `fxStrength`, and the marks and media
effects above.

**Presets** (Styles page; they set frame, opening, bar layers, world, eyes, vessel and lore; never colours, icons, layout or your art;
Undo for 12 seconds):

| Preset | Frame | Opening | Bar | Notes |
|---|---|---|---|---|
| Quiet | Minimal | none | plain | The calmest the shell gets |
| Fog town | Chains, drawn | static | fog world | Rust vessel, subtle lore |
| Uzumaki | Panel, drawn | spiral | paper, wood, screentone, torn | Uzumaki eye, whirlpool vessel |
| Otherworld | Otherworld, drawn | blot, with shoulders | rust world | Full eye motion, static vessel, full lore |

## Boot and Lock, screensaver, fastfetch

Boot & Lock page. Each surface is changed only by a command you run, and has a revert.

**Lock** (`lockDesign`; `ito-lock`). Designs: Fog (default), Lantern, Amigara, Watcher, Tomie, Pyramid, Welcome Road, Moth. Tomie,
Pyramid, Road and Moth are scenes that need your own pictures (`ito-assets recipe sheets`). Backgrounds `lockBg`: engraved,
duotone, raw, screenshot, ink. `lockTone`: sync or flat. Engines (`lockEngine`; `ito-lock own ENGINE|--undo`): `hyprlock`,
`omarchy-lock`, `ito-qs` (the `ito.lock` plugin). Authentication is never touched; `hypridle.conf` is never edited. Revert with
`ito-lock revert`. `ito-repair` offers a guided fix for Boot & Lock problems (`plan`, `apply`, `undo`).

**Boot** (`ito-plymouth`). `bootComposition`: eye-shut (default), uzumaki-eye, beetle, remina, tomie, eye-veined, eye-spiral,
card-tomie, card-pyramid, card-road, card-moth, picture, seal, caption. Also `bootSource` (slot, mark, theme), `bootFrame` (none,
disc, ring), `bootTone` (tint, duotone, raw), `bootUi`, `bootSize` (160 to 480). Plymouth can only change a logo, a background
colour and a text colour, so the design is baked into the logo. Applying needs `sudo` and rebuilds the initramfs, so it is always a
terminal step you run. Revert: `ito-plymouth reset`.

**Screensaver** (`ito-screensaver`). Brands Omarchy's own screensaver (the ttfx effects, not replaced). IKAI effects: smoke, rings,
blackhole, crumble, vhstape, burn, spotlights, swarm. Options: `screensaverText` (spiral, eye, fog, custom, stock),
`screensaverPalette`, `screensaverGround`, `screensaverFps`. `idleScreensaver` adds one hypridle listener that starts it before the
lock; it is off by default.

**Fastfetch** (`ito-fastfetch`). Three layouts written next to your own config: `image` (your picture beside the machine's lines,
drawn with the kitty graphics protocol), `compact`, `text` (Omarchy's logo, works in any terminal). `fetchStyle`: ito, rust,
otherworld, chains, ink, eyes. Also `fetchPicture` (photo, engraving), `fetchFrame`, `fetchOrnaments`, `fetchLogo`. Revert with
`ito-fastfetch revert`.

## Your own art

Pictures of characters and scenes are not shipped. Anything you want drawn from your own images goes in a user layer:

- `~/.config/ito/assets/<same path as bar/modules/ito-art>`: a PNG there replaces the shipped picture of that name. Add `.light` for
  light themes and `<dir>/bar/<px>/` for bar sizes. `ito-assets` only reads this folder and writes an index
  (`~/.cache/ito/assets-index.json`); it never copies over a picture.
- `ito-assets recipe <name> FILE` turns your source image into theme-ready art. Recipes include `eye-uzumaki`, `eye-lashed`,
  `eye-veined`, `tomie`, `uzumaki-eye`, `beetle`, `ws-beetle`, `ws-tomie`, `ws-uzumaki-eye`, `mark-heather`, `mark-pyramid`,
  `ws-heather`, `pyramid-head`, `relic-sys`, `ws-symbols`, `relic-apps`, `sprites`, `sheets` (lock scenes and boot cards), `spiral`,
  `ws-cult`, and the generic `lightink` / `lineart`. `ito-assets recipe --list` prints them; refused for a source of the wrong size.
  `--dry-run` previews the legibility gate.
- `ito-assets slots`, `ingest FILE --as SLOT`, `index`, `status` manage named slots and the index.
- `~/.config/ito/marks/`: menu marks (`ito-marks`). `~/.config/ito/effects/custom`: your media picture or GIF.
- When a picture is missing, the feature falls back to the default or is dimmed with the command to run.

See [TUTORIALS.md](TUTORIALS.md) and [ICON_SPEC.md](ICON_SPEC.md).

## Settings: `ito-config`

```
ito-config get <key> [fallback]   set <key> <value>   setmany k=v ...   toggle <key>   cycle <key> v1 v2 ...
ito-config list   defaults [--page P] [--section S] [--json]   backups   restore [ts]
ito-config reset [--all | --key k... | --section PAGE/SECTION | --page PAGE]   (backs up first)
```

Key groups, by the Control Centre page that owns them (from `ito-defaults.json`):

- **styles**: `panelFrame`, `frameStyle`, `frameArt`, `presence*`, `eyeStyle`, `eyeMotion`, `vesselFill`, `loreLevel`
- **bars**: `barSize`, `barFloat`, `barRadius`, `barGap`, `barShadow`, `surface*`, `fx*` plate layers, `bloodSeep`, `tooltipBlood`
- **widgets** (Icons): `iconStyle`, `iconStyleOverrides`, `icon:*`, `iconScale`, `iconTone`, `valueStyle`, `valueLabels`, `showValues`,
  `popupSeconds`, `clock*`, `calendar*`, `aiStyle`, `netIcon`, `shPack`
- **logo**: `seal`, `sealDeco`, `sealLit`, `menuMark`, `markScale`
- **effects**: `mediaFx`, `fxMark`, `fxSeal`, `fxVeins`, `fxWhen`, `motion`, `motionScope`, `openDuration`, `light`, `vibrance`,
  `fxSpeed`, `fxStrength`
- **workspaces**: `style`, `workspaceCount`, `workspaceShow`, `eyeWs*`, `wsBarArt`, `wsHdTiers`
- **colors**: `colorMode`, `accentSource`, `accentCustom`
- **sysart** (Boot & Lock): `lock*`, `boot*`, `screensaver*`, `idleScreensaver`, `fastfetch*`, `fetch*`

Values are validated against fixed lists; a bad value is refused. `ito-config defaults` shows what unset means.

## Health, compatibility, backups, upgrades

- **`ito-health`**: checks what is wrong, why and how to fix it. `--text` (plain report), `--report [--save]` (written for an AI
  assistant), `--fix ID` or `--fix all` (safe fixes only). The Health page shows the same with Fix buttons. Known problems:
  [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
- **`ito-compat`**: `check` (exit 0 ok, 1 drift, 2 broken), `status`, `json`. Watches Omarchy, Quickshell and Qt against the versions in
  `compat/verified.json` and tells you in plain language what changed and whether it is safe. See [UPGRADING.md](UPGRADING.md).
- **Backups and reverts**: `ito-config backups|restore`; `ito-profile list|save|load|delete` (named copies of your setup);
  `ito-lock revert`, `ito-fastfetch revert`, `ito-plymouth reset`, `ito-repair undo`; `ito-recover` switches every IKAI widget (the
  seal above all) back on from outside. Full list: [INSTALLATION.md](INSTALLATION.md#uninstalling-and-reverting).
- **Safe restart**: `ito-restart` stops Omarchy's restart loop, starts exactly one shell and checks. Never `pkill quickshell` (the
  loop starts a second bar). `ito-onebar` guarantees a single bar; `ito-shells` lists installed shells and switches.
- **Upgrade safety**: the sidecar and `~/.config/ito` survive updates; ids did not change; each apply backs up first.

## Performance

- Frames and presence draw nothing and run nothing while a popup is closed; the media position timer runs only while the player
  is open and something plays.
- Effects run `fxWhen=hover` by default (nothing moves until you reach for it); `always` runs them all the time.
- `fxFogDrift` (animated fog on the bar) costs a little idle CPU and is off by default.
- Pictures are baked once per size tier (`bar/<px>/` folders), not scaled live.
- `motion=off` makes entrances and openings instant.

## Limitations and known issues

- **Pictures are user-supplied.** Tomie, Pyramid Head, Heather, the Hollow skins, Relic icons, the lock scenes and boot cards come
  from images you provide; without them those options are dimmed or absent. No third-party artwork is shipped.
- **Plymouth needs `sudo`** and rebuilds the initramfs; IKAI never runs it for you.
- **Omarchy only.** It runs as a plugin of Omarchy's shell (4.0.6 or newer), not as a standalone shell, and can break when Omarchy,
  Quickshell or Qt change; `ito-compat` warns you.
- **Media** works through MPRIS only; a player without MPRIS support does not appear. Cassette (recording) and Weathered cup (stay
  awake) exist only when built from your sprite sheet.
- **Fastfetch `image` layout** needs a terminal with the kitty graphics protocol (use `text` elsewhere).
- **Licence.** The licence is PolyForm Noncommercial for the IKAI code, so GitHub detects it as "Other" and it is not OSI open source;
  the bar engine fork stays MIT (HANCORE). See [NOTICE](../NOTICE) and the README.
- **Beta.** 0.2.0-beta is the first release under the IKAI name.

# Changelog

## Unreleased (0.2.0-beta, the first release under the IKAI name)

IKAI (異界) is the new name of the project formerly called Ito-verse Shell. Visible names changed; plugin ids (`ito.*`), commands
(`ito-*`) and `~/.config/ito` did not. Highlights: the bar and its eleven-page Control Centre, workspace families and menu marks
(Tomie Classic, Pyramid Head), the Original / Ink / Relic / Hollow icon chooser, lock designs, boot cards and fastfetch pictures,
presets and saved setups, the Health page and `ito-compat`. Requires Omarchy 4.0.6 or newer. The detailed development log follows.

## Development log (before the first release)

### Popup emblems follow the current icons (2026-10-22)

The emblem at the head of every popup is now the widget's current bar icon (`ItoEmblemMap.js`, drawn by `ItoImage` in the style chosen for that widget), not an older drawing; the clock keeps its drawn sign. Doc shots `popup-emblems`, `popup-player`, `popup-forecast` re-rendered.

### Full tour (2026-10-22)
- `docs/FEATURES.md`: a complete, code-checked tour of IKAI (popups and frames, media, icons, lock, boot, your own art, limits), with a frames screenshot.

### Pyramid, neutral names, Tomie Classic (2026-10-22)
- Pyramid Head menu mark and the `pyramid` workspace family are cut from your side view with its own lighting and true deep blacks (no grey lift, no engraving), written in theme tokens so they follow the current theme: shadows in the theme's darkest colour, light in its foreground, blood in its accent. Empty is dimmed, occupied scratched, active a blood ring with a glow and runs, urgent a stronger glow. Re-run `ito-assets recipe pyramid-head FILE`.
- Neutral names: icon styles **Ink** (was Manga) and **Relic** (was Gothic), the sprite skins **Hollow** (was Silent Hill); frame style **Panel**, seal **Quiet hill**, surfaces **Print paper / Print page**, preset **Fog town**, fetch style **Rust**. Stored ids are unchanged; `ink`, `relic` and `hollow` are accepted as values.
- Recipes write `relic/sys/`, `hollow/` (skins without the `sp-` prefix) and `ws-symbols-*`; recipes `relic-sys`, `ws-symbols`, `relic-apps`, `hollow-pack` (the old names still run). Files under the old names keep working.
- Tomie Classic is drawn 0.87 of its menu-mark box (per-mark `scale`).
- Boot & Lock: an out-of-date surface is no longer shown in red (the page offers the update); Omarchy's screensaver switch being off is shown as information. The Icons chooser no longer loads a missing picture for sprite-made versions.

### Release notes (first IKAI release)
- Requires Omarchy 4.0.6 or newer. See `docs/INSTALLATION.md` (requirements, your own art, uninstall and revert) and `docs/UPGRADING.md` (`ito-compat`).
- Your own pictures live only in `~/.config/ito/assets`; the repository ships none of them. Recipes that need pictures only you have simply do not offer that design when the picture is missing.
- Release hygiene: no hard-coded developer paths in shipped code (`ito-health` and `ito-design` find the checkout through `ITO_REPO`, `~/.config/ito/repo` or their own location; `scripts/itobar-backup.sh` honours `ITO_BACKUP_DIR`), `scripts/release-check.sh` runs the pre-publish checks, `docs/RELEASE.md` is the publishing checklist.
- The Control Centre has eleven pages (Styles and Boot & Lock are documented in `docs/USER_GUIDE.md`).

### Rebrand
- The shell is now called **IKAI (異界)**, "the world beyond" (formerly Ito-verse). Visible names only: README, docs, About, Health, tooltips, manifest names, licence product names, icon and cursor theme names, installer messages.
- Unchanged on purpose: `ito.*` plugin ids, `ito-*` commands, `~/.config/ito`, `~/.cache/ito`, the `itoverse` style id, the `ito-verse` theme and icon/cursor folder names, the root manifest id and the GitHub URLs.
- Optional `ikai` alias: `ln -s ~/.config/omarchy/bar/modules/bin/ito-config ~/.local/bin/ikai`.

### Added
- Boot cards: `bootComposition` `card-tomie`, `card-pyramid`, `card-road`, `card-moth` (extra entries; default unchanged). `ito-assets recipe sheets` also writes `cards/<scene>.png`; the card fills 56 % of the smallest screen's height, no baked text, theme-tinted (light themes get a dark print, never a negative). Apply with `ito-plymouth apply` in a terminal.
- Uzumaki vortex workspaces (`uzumaki-vortex`); original Uzumaki set at every bar size (S1, S1b, S1c).
- Marks Remina / Remina Ink, real Tomie, Uzumaki Eye, Beetle (S2c). Tomie bone-tile mark, `minPx` 36. Beetle recipe.
- HD tier pipeline `scripts/gen-hd-tiers.py`, picker tiers, gate `test-hd-tiers` (S2d).
- `openDuration` control (S8).
- Form parity keys `formParity`, `dockFloat` (S13b).
- Reset registry `ito-defaults.json`; one dedupe map for Styles / Bars / Effects / Logo (S13e/f).
- Mark definition pipeline and "Logo size" control (S15).
- Tomie set from the real drawing, Beetle sharpened (S15b).
- Uzumaki Eye, Silent Hill and Heather / Pyramid workspaces and marks (S15c).
- Fastfetch engravings, pair composition, fetch styles (S16).
- Silent Hill asset pack, 283 files under `bar/modules/ito-art/sh/`, not wired yet (S17).
- Gothic bar icons (`iconStyle gothic`), workspace family `gothic` (S18a, S18c).
- Workspace family `gothic` is now shown as **Symbols** (new id `symbols`; `gothic` still works, `ito-config migrate` rewrites it). Its three faces (3, 5, 9) are replaced by engraved symbols: an hourglass running out in blood, an inverted pentagram, a bleeding key.
- Text seals, Ikai set; vertical writing (S19).
- `ito-health` "Theme-made files" check.
- Lock designs Tomie, Pyramid, Welcome Road, Moth (extra entries; Fog, Lantern, Amigara, Watcher stay). Scenes are recomposed in high resolution by `ito-assets recipe sheets` (`ito_sheets.py`) from the user's HD pictures into `~/.config/ito/assets/lock/`; the shell draws the clock, date, field and quote, and a design whose picture is missing is not offered.
- Workspace families `pyramid` (Pyramid Head side view in a red ring, recipe `pyramid-head`) and `heather` (recipe `ws-heather`); menu mark `pyramid-head`.
- Silent Hill sprites cut from the user's SHASSETS sheet (`ito_sprites.py`): Pyramid roundel, moth, eye roundel, key, cassette, cup, sign.
- `shPack` widget skins (clock spiral, notification eye, night-light moth, media cassette, low-battery pyramid), off by default (S17e). The "+ your pack" preset buttons and "Back to before the pack" were removed again: icons are chosen per icon in Widgets; a stored `packUndo` is dropped by `ito-config migrate`.
- Per-icon choice in Widgets > Icon drawing: Original / Silent Hill for notifications, clock, media, night light, power (keys `icon:notifications|clock|media|nightlight|power` = `original` | `sh`; unset follows `shPack`, so the old icons stay the default and an explicit Original beats the pack), plus the same two-choice row for the Cassette and Weathered cup versions; a tiny preview of both beside each. (Later moved into the ICONS section; the media cassette was removed, see Removed.)
- `ItoLore.quoteLines()`: one source (`QUOTES`) for the panel memo fallback lines, the lock and `ito-lock-tick`.
- `ito-health` knows Omarchy's `OmarchyLoadPatch` pragma notice and files it as not ours.
- `scripts/check-qml.sh` now also covers `plugins/ito.network/Panel.qml` (structural checks always, qmllint with `CHECK_QML_SLOW=1`).

### Changed
- Uzumaki preset restyles the bar.
- Icons page: a new **ICONS** section at the top lists every bar icon (audio, network, bluetooth, battery, low battery, display, notifications, CPU, memory, disk, AI, media, tray, weather, clock, the indicators) with a card per drawing at bar size in the theme colours: Original (the old inked drawing), Manga, Gothic (with your sheet), Silent Hill (with your sprites), or the indicator versions; plus **Use Original for all**, **Use Manga/Gothic for all** and a 12 s Undo. It writes the existing keys (`iconStyleOverrides`, `icon:<name>`); nothing changes until you pick. The old per-family rows, the per-icon Silent Hill rows and the INDICATOR ICONS section moved into it.
- Manga `display` icon redrawn for bar sizes (24-40 px): a solid bezel, clean glass and a large eye (shut, iris, rays, blood sun); the old-set wear only on the popup's large icon. The Original stays selectable.
- `scripts/qa/sweep-settings.py` backs up to `~/.cache/ito/sweep/` with a marker, refuses to start while a marker exists, restores on exit and on SIGTERM/SIGINT/SIGHUP and checks the restore byte for byte (gate `scripts/qa/test-sweep-guard.py`). A killed run no longer loses your settings.
- Welcome Road lock and boot scene (`road`, `card-road`) rebuilt with depth: real volume, fog layers, lighting, and a legible sign.
- Pyramid and Heather blood rebuilt: thin runs and splatter, no round-headed drips, in the tiles and the preview.
- Pyramid Head mark and `pyramid` workspaces: neutral iron, blood in the theme colour (spatter, inner face, runs, ring), no white spike at the helmet's tip, a dark edge on dark and light bars; urgent adds blood without flooding the head. The mark's natural-colour special case is gone.
- Workspace picker previews are numeral-free (`ws-<family>-preview-active`): no numeral is drawn in the art.
- Cult Symbols rebuilt with 9 verified Silent Hill cult symbols: Halo of the Sun, Seal of Metatron, Flauros, Brethren Symbol, Fitch, Holloway, Bartlett, Shepherd, 21 Sacraments. Slot 10 repeats the Halo of the Sun as the SH3 wall-painted version.
- Cult Symbols v3 (S10): the ten symbols are now traced from the pictures on skillunex.com/silent-hill-symbols, the page named as the reference: Halo of the Sun, Seal of Metatron, Flauros, Mark of Samael, Valtiel, Halo Sigil, Otherworld Gate, Faith & Torment, Eternal Flame, Sun's Vitality (same geometry as the pictures, engraved iron and blood on top). The v2 set is kept only in the backup `2026-10-20-cult-v3`. Gate `scripts/qa/test-cult.py`.
- `wsHdTiers` and `markHdTiers` are opt-in (legacy art revert).
- Eyes set and memory liquid: `vesselFill` replaces the eyes in the liquid (S14).
- Boot and Lock fixes (S13d).
- Legacy hooks renamed to `.sample` (11 files).
- The lock service `plugins/ito.lock/Service.qml` is resynced with Omarchy 4.0.6 (`service.sha256` updated; `ito-health` "Ito lock matches Omarchy's" stays green).
- Lock quotes of the CPU, disk and memory panels (level "off") read `ItoLore.js` QUOTES instead of three copies; the second line no longer carries the extra sentence that is not in the game.
- Icon theme: `index.theme` no longer lists the empty `scalable/apps` directory (D-018).
- Recipe sheets for the Boot & Lock sheets; "IKAI" is the visible name everywhere.

### Removed
- The Silent Hill media skin (the cassette drawn on the play / pause button): key `icon:media` is retired (`set` refuses it, `migrate` drops a stored one); media keeps its Original, Manga and Gothic drawings. The recording indicator's Cassette version stays (same sprite files, `icon:record`).
- Workspace family `pyramid-classic` (2026-10-20). A saved value maps to `pyramid`; its picker card and recipes are gone.
- `barDecor`, `gapThread` (S13a).
- `silenthill`, `shsymbols`, `vesselEyes`, `vesselLayout`, `tomie-head`.
- `flesh` merged into `bloodSeep`.
- `tomieSize` key (D-012); unused Python, JS and QML code (D-010, D-011).
- 13 v1 app SVGs in `icons/Ito-verse-icons/scalable/apps/` (S18b, folder empty until v2).
- Workspace banners: key `wsBanners`, `ItoWsBanner`, `ItoWsOverview`, the `ito.wsoverview` popup, recipe `gothic-banners`.
- Mark entries `tomie-clear`, `tomie-wide`; art seals `red-square`, `pyramid-seal`, `heather-seal`.
- `bar/modules/ItoEye.qml`, `bar/modules/ito-art/system/menu-tomie.png`.

### Fixed
- `ito-assets` index: a full-size replacement emptied the whole user art index (D-002).
- `check-qml` duplicate-id gate never matched (D-007).
- Test isolation: lock and fetch tests read live config and terminal env (D-006).
- Qt 6.12 colour guard: unversioned `import QtQuick.Window` was not flagged (B1).
- Theme switch: fixes from the 2026-10-16 debug.

### Earlier entries (prose)

- **Marks: Remina / Remina Ink, the real Tomie, Uzumaki Eye, Beetle.** Remina is your own picture, Remina Ink the drawn planet
  (a one-time `marksVer` rename keeps your choice); the drawn Tomie is gone, the Tomie mark is made from your own drawing
  (`ito-assets recipe tomie|uzumaki-eye|beetle|ws-beetle`, pixels only under `~/.config/ito/assets`). New Beetle workspace
  style (Mayan dot-and-bar numerals). The Uzumaki mark no longer fuses its two arms below 64 px.
- **Boot & Lock, rebuilt as four tabs** (Lock, Terminal, Screensaver, Boot). Each shows what is really in place (applied,
  out of date, partly there, not in charge), a preview drawn from sample data in your colours, one action chosen by that
  state, and the result of the last run next to the click. A toggle only flips after the helper succeeded. The lock tab
  lists the four ways the screen gets locked and which lock answers each (Omarchy's menu, idle and suspend use Omarchy's
  lock, not hyprlock) and offers three owners with their tradeoffs; changing it is a terminal step (`ito-lock own`).
- **Seven lock designs drawn as manga ink** (Fog, Spiral, Panel, Lantern, Otherworld, Amigara, Watcher): your picture as a
  pen engraving lost in fog, a hatched vignette, an inked ring, a koma page, cliff strata, a hatched flashlight beam, rust;
  the colours come from the theme. The same model feeds hyprlock and, as `ito.lock` (a clone of Omarchy's lock with its own
  PAM flow), a Quickshell view; the plugin is installed but only active after `ito-lock own ito-qs`.
- **Terminal fetch keeps Omarchy's lines and boxes and adds ornaments** (a kanji in each title, a sound effect on the rule,
  a stitched separator), an optional pen-drawn eye logo, a preview, and `ito-fastfetch run` now centres the block at any
  terminal width (it was never centred). The plain config no longer holds a protocol-specific image.
- **Screensaver: one scheduler, a text that is art.** Omarchy's idle timer decides when it starts (Ito only adds its own
  listener when hyprlock owns the lock); the text is a braille spiral, the eye, or a fog of kanji; effects take their colours
  from the theme; reverting only removes Ito's block from hypridle.conf.
- **Boot: a shut eye, applied from a terminal.** `ito-plymouth` composes the logo, previews it with Omarchy's own tool and
  applies it only in a visible terminal with your password; `reset` puts Omarchy's back.
- **A configurable clock and a keyboard-first calendar.** The bar clock can show 12 or 24 hours, seconds, the day
  or weekday and day beside the time, kanji digits, the moon's phase and a small spiral that steps each second; it
  never changes width as the digits change, and every option is off by default (Control Centre, Widgets, Clock &
  Calendar). The calendar, opened under the clock or the date, is now a normal keyboard panel: arrows or hjkl,
  PgUp/PgDn for months, Shift+PgUp/PgDn for years, `t` for today, `y` for a year plate, Enter to pick, Esc to go
  back or close. It adds ISO week numbers, a choice of week start, up to three extra time zones, and holidays from
  `~/.config/omarchy/ito-holidays.txt`. The old second calendar window is gone.
- **A screensaver of the shell's own** (Boot & Lock page). On: the drifting text becomes Ito's, and it starts
  itself a minute before the screen locks (240s idle, the lock is still 300s). Off: both go back to how they
  were. Respects Omarchy's own screensaver-off toggle; the lock keeps working exactly as before either way.
- **Boot splash and Lock screen get a picture gallery too, not just Terminal Fetch.** The gallery grid
  (thumbnails + "Your own") is now one reusable piece behind all three slots; each reads and picks from its own
  set (`ito-marks gallery SLOT ...`, unchanged). Seeded here: three bold, background-removed pictures for the
  splash (it wants one small, centred subject), three wide, atmospheric ones for the lock screen.
- **The Boot & Lock how-to now says a real size for each surface** (boot splash 512×512, terminal fetch 800×800,
  lock screen at least your own resolution) and what triggers each one, instead of "roughly square"/"any picture".
- **Fixed: the terminal fetch's picture never showed.** A raw picture slot (`_plymouth`, `_fastfetch`, `_lockbg`)
  kept the file exactly as it arrived; fastfetch's `image` and `compact` layouts hand that file straight to
  Ghostty's kitty-graphics protocol, which only decodes PNG through that path -- a JPG or WebP failed silently
  and fastfetch fell back to its own default logo, with nothing said about why. A raw slot's picture is now
  always re-encoded to PNG on the way in, whatever format it arrived as.
- **Terminal fetch: a gallery of ready-made pictures, next to your own.** `ito-marks gallery SLOT` lists a
  handful of pictures already agreed on for a raw slot; picking one is a copy into the slot, same as choosing
  your own. The Boot & Lock page shows them as a row of thumbnails under Terminal Fetch, the same grid the Logo
  page's menu marks use, with "Your own" alongside them for anything else. Picking a picture while the fetch is
  already on regenerates it at once, so the change shows without a second click.
- **A picture badge no longer glares beside the engraved marks.** A menu mark made from your own picture (a manga
  panel, a photo) carried paper-white and a full-bone ring, far brighter than the bone-toned engraved icons around
  it. Its whites now sit on bone and the ring a little under it.
- **Fixed: a workspace mark looked pixelated while it popped out.** The theme-tinted copy of an icon was scaled
  without smoothing when the mark animated to its active size.
- **`ito-marks import --raw`**: puts a picture in the round badge exactly as it is (its own greys and paper, no
  recolouring, no shading extraction), for a panel you want to see the way it was drawn.
- **Fixed: your own Tomie, Remina and Uzumaki badges had a red ring you never chose.** The shaded-picture badge drew an
  accent-red ring inside the bone one; it is gone, leaving only the bone ring.
- **Fixed: every widget had a faint background of its own, on top of the island's.** With "Widget pills" off, the
  fallback colour behind each widget was still a visible ~18% tint instead of nothing -- a little rounded bubble
  around every single icon, which read as backgrounds nested inside the island's own background. It is now fully
  transparent unless pills are switched on.
- **"Reset look" asks again before doing anything**, the same as "Reset layout" already did -- neither can be
  undone from here, and Reset look is the wider of the two (colours, effects, seal, decoration, mark, workspace
  style, every reading). It also no longer secretly forces the seal to Tomie and the workspace style to numerals:
  everything it clears now goes back to its own default, with nothing singled out.

- **Profiles: Designs and Setups are one thing now** (Setup page). The Bars page's "Designs" grid (Classic, Cluster,
  Compact, Floating dock, Monitor, Minimal, Zen) moved to Setup → Profiles, right above your own saved ones, as
  ready-made, non-deletable entries -- one place to pick a whole look for the bar, instead of two sections that both
  did a version of the same thing under overlapping names ("Look"/"Layout" meant different things on each page).
  Saving over an existing name, and deleting a saved profile, now ask once more before doing it; the Load/Look/Layout
  buttons have one persistent line explaining what each brings back, instead of only a hover tooltip.
- **Seal colour: Auto, On, Off** (Logo page). Auto is today's behaviour (blood while the panel is open or the pointer
  is on it, bone the rest of the time); On and Off hold the seal at one colour regardless.
- **Drag-to-move now works on a vertical bar** (left or right), not only a horizontal one: press a widget, move it,
  and it lands in the gap the guide shows, the same as on top or bottom.
- **Fixed:** the coffee-cup icon (Stay awake) sat visibly lower than the radio and flashlight beside it -- its
  drawing was bottom-heavy even though its box was centred, so it read as uncentred. It now sits level with them.
- **Fixed: a picture of your own (menu mark, seal, seal decoration, workspace pictures) no longer gets recoloured
  to the theme.** The shader that moves drawn bone-and-blood line art onto the theme's colours was also running on
  real pictures, flattening their own shading into a smear of two theme colours -- this is what made a custom
  Tomie/Remina/Uzumaki (or any other) picture look wrong. A picture now always keeps its own colours, under every
  theme.
- **Fixed: a picture that is not square was letterboxed into the round badge, not filled.** A tall or wide photo
  came out with the badge's own near-black background showing through the empty margins either side, which read
  as a shadow or a bad crop. A picture with no real transparency (a photo, a scan) is now cropped to fill the
  circle instead, centred, the way any avatar picker does -- a picture with real transparency (a drawn icon) still
  gets the old, gentler fit, since there is nothing wrong to show through.
- **Fixed: a shaded illustration lost its dark areas to the same badge disc.** The auto mode that adapts a picture
  extracts ink the way a clean scan needs -- crisp lines on a plain ground, almost nothing in between -- and drops
  the rest. A shaded manga panel or a photo has no such ground: much of it sits in the middle, and dropping "the
  rest" there dropped half the drawing, showing the disc through what should have been part of it (this is what
  was still wrong with Tomie after the letterbox fix -- her dark hair and clothing, not a margin). A picture with a
  wide spread of midtones now keeps its full shading instead of having it extracted as ink.
- **The menu mark's default is the sheet spiral again** (drawn by hand from the original design sheet) -- what the
  whole suite takes its name from. This only changes a fresh install; anyone who already chose a mark keeps it.
- **Fixed: a widget's shadow with no pill under it.** With "Shadow under the bar" on and pills off, every widget on
  an Islands bar cast its own small shadow anyway, with nothing shaped to justify it -- on top of the island's own
  shadow, this read as a shadow doubled behind every icon. A widget's shadow now only draws when its pill is
  actually visible.

## 0.2.0-beta

The second beta: popups drawn as manga panels, icons that answer the pointer, a bar you can rearrange freely, and a long list of fixes.

**Moving widgets**
- Dragging a widget on the bar (Bars > Layout > Move widgets) always moves that one widget to the gap nearest the pointer. It
  used to trade places with a widget when the pointer crossed its middle and insert at its edges, so the guide switched back and
  forth as it travelled (a flicker) and a drop on a neighbour swapped the two.
- Fixed: a widget moved later along its own side landed one place past the guide.
- **Stay awake, Night light and Recording are three widgets now** (`ito.awake`, `ito.nightlight`, `ito.recording`), so each one moves on
  its own; before, the three were one widget and moving the coffee cup moved all of them. The combined `ito.indicators` is still
  there for anyone who wants it. To split an existing bar in place (keeping every island cut):
  `bar/modules/bin/ito-design --split-indicators`.
- Adding or removing one widget no longer resets the cuts between the islands.


**Popups**
- Every popup is drawn as a manga panel: ruled double edge, torn corners, blood and screentone, a burst of static as it opens,
  an emblem for what it watches (waves, signal, rune, flame, clock, spiral, telephone, mind, the sky) and a note at the foot chosen
  from several original lines. Switch: Bars > "Manga frame on popups".
- New: a **media player** (cover, title, seekable progress, shuffle, repeat, controls; right-click the media rings), a
  **notification history** (right-click the bell), and a redesigned **calendar**, **forecast** and **AI usage** panel.
- Popups open beside the bar on any edge (top, bottom, left, right) and fit the screen. Fixed: on a side bar the audio,
  network and other popups came out 120 px wide.
- Fixed: the forecast's icons were unsized, so they came out huge and the hourly row ran off the edge.
- IPC for keybindings: `ito.player`, `ito.calendar`, `ito.weather`, `ito.notifycenter`, `ito.aiusage` (each `open`, `close`,
  `toggle`).

**Icons and the bar**
- Moving a widget (or applying a design) no longer makes the island plates vanish for a third of a second: every plate now has an instant fill under its canvas, which used to be created empty and painted a few frames later.
- **Customising the bar:** drag a widget by its grip to any place in any column of Icons > Your bar (a line shows the drop). The rows show the whole widget name (in the narrow columns it was cut to one or two letters), and the ▲ ▼ arrows now trade places with the next widget you can see (they used to trade with the engine's hidden slots, so they often seemed to do nothing).
- **Hover:** every icon gets a halo of the accent and a gesture that fits it (bell rings, chip beats, disk turns, volume dances,
  network beeps); the weather shows the sky (rain falls, lightning, rising heat, snow, mist). Follows the Motion setting.
- New emblems: a clock (with a real second hand), a signal and a telephone with a coiled cord; all emblems move while their popup is
  open. The notification icons are redrawn: a bell with an Uzumaki spiral and an eye for a clapper.
- **Tray:** the drawer takes its room at once, so its icons no longer show outside the island for two frames (it read as a second island and a flicker).
- **Setups** can be loaded whole, as look only, or as layout only (`ito-profile load NAME --only look|layout`).
- **AI usage:** a limit whose window has reset now reads 0% and asks for a fresh reading, instead of showing the old 100% until the timer runs.
- **Popups** never fall below 124 px: the bar engine rewrote shorter ones without end. Fixed: an empty adapted picture (a write cut short) is rebuilt.
- Health notices a moving wallpaper behind a see-through plate (it reads as shimmering) and offers a solid plate.

- **Media effects:** the Spiral is fitted so the whole spiral shows; the Eye can use your own picture. The muted-volume icon is redrawn.
- Everything that moves, and every icon that changed, is described in [docs/ANIMATIONS.md](docs/ANIMATIONS.md).

**Motion and cost**
- **Motion** setting (Effects): off, calm or lively. Popups, labels, the Control Centre and the workspace marks follow it;
  numbers glide to their new value.
- The idle cost of the shell dropped from about 3 % to 0.5 % of one core: the seal only breathes while an effect is on.

**Look**
- Labels over the bar follow the theme; "Tint labels with the accent" brings the accent back.
- Removed old sheet-derived icons that carried text and were not used by the shell. The "Eyes" decoration and effect now use
  original artwork committed to the repository instead of untracked third-party art.
- The **Spiral** media effect is fitted so the whole spiral is inside the strip and never cut by its edges, with a faint rim and arms that fade in and out. The **Eye** effect can use your own picture (`~/.config/ito/eyefx/`), and the built-in eye has a striated
  iris and heavier lashes.
- Seal decorations lie across the bar, above and below the seal, on a vertical bar (they used to shrink to a sliver).
- The Control Centre footer credits the author with a link.

**Compatibility**
- Tested: bar on top, bottom, left and right; Islands, Full, Fit, Dock and Notch; motion off, calm and lively; frame on and off.
- Ryoku: not supported yet (see the README's Compatibility table).

## 0.1.0-beta

The first public version.

**The bar**
- Bar engine forked from Shibumi-Shell (HANCORE, MIT) with its own `itoverse` style; shapes Islands, Full, Fit, Dock, Notch;
  any of the four edges; corners, heights, spacings, shadow, float.
- 19 widgets: menu spiral, workspaces, clock, date, seal, weather, AI usage, indicators (stay awake, night light,
  recording), media, tray, notifications, network, Bluetooth, volume, brightness, battery, CPU, memory, disk.
- Readings that say what they measure: `CPU 4%`, `RAM 17/32G`, `DISK 210/930G`; Percent, Amount, Number or Off.
- Popups that close by themselves after a few seconds (adjustable, or never).
- Stay awake and Do Not Disturb read through `ito-host`, independent of Omarchy's own services.

**The Control Centre**
- Nine pages with foldable sections, search that opens matches, and a footer that says what a control does.
- Icons: your bar in three columns with a switch and arrows per widget.
- Eight workspace styles (Seals, Rings, Tomie, Remina, Uzumaki, Marks, Halo, Flauros) and a Custom style from four pictures.
- Five seals, thirteen decorations, nine menu marks, eight motions, six media effects.
- Your own pictures and GIFs for the menu mark, seal, decoration, workspaces and media effect, with exact sizes and limits.
- Setup: named setups (`ito-profile`), switching between Omarchy's default bar, Shibumi, Caelestia and Ito-verse.
- `omarchy-shell ito.controlcenter toggle|open|close|page <name>` from a key or a script.

**Themes**
- Works on light and dark themes alike: the art is mapped between the theme's background and foreground (it used to keep a black
  plate under a light theme, which made the text unreadable), and the accent follows the theme.

**Health**
- Checks for the engine, the state, settings, fonts, themes, widgets, the seal, duplicate bars, virtual screens, the engine's
  signature, the active bar, art files, your pictures, slider ranges, helper programs and the log.
- A Fix for most, `Fix everything`, and a report written for AI assistants (`ito-health --report`).

**Install**
- `deploy.sh` stops the shell before copying when anything changed, refreshes the engine signature and restarts once; it does
  nothing when nothing changed.
- `seed-variant.py` makes `shell.ito.json` on a fresh machine and keeps the shell you were on as its own variant.

**Licence and credits**
- Code under PolyForm Noncommercial 1.0.0; the forked engine and five re-skinned Omarchy widgets keep their MIT licences with
  the original notices; the art is for personal, non-commercial use. See `NOTICE`.

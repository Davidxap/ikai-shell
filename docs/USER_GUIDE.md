# User guide

Everything you can change lives in the **Control Centre**. This guide goes through it page by page. If you would
rather follow a task from start to finish, see [TUTORIALS.md](TUTORIALS.md).

## Opening it, moving around

- **Click the 富江 seal** in the middle of the bar.
- Or from a terminal or a keybinding: `omarchy-shell ito.controlcenter toggle` (also `open`, `close`, and
  `page <name>` to jump to a page: `styles`, `bars`, `widgets`, `logo`, `effects`, `workspaces`, `colors`, `plugins`,
  `shells`, `sysart`, `health`). To bind a key, point one at `omarchy-shell ito.controlcenter toggle` in your Hyprland config.
- **Esc** closes it.

The window has three parts:

- **A sidebar** with the eleven pages, in two groups: *Appearance* (Styles, Bars, Icons, Logo, Effects, Workspaces, Colors)
  and *System* (Plugins, Setup, Boot & Lock, Health).
- **A search box** (`Ctrl K`). Type a word and every section that matches opens by itself, on every page you visit.
- **A footer** that says what the thing under the pointer does, with the version and the author on the right.

### Foldable sections

Each page is split into sections with a small **▸** and a title. **Click a title to open or fold it.** The first
section of a page starts open; the rest start folded so a page never overwhelms you. Whatever you open stays open
while you stay on that page.

### Everything is saved by itself

Every switch, card and slider writes to your settings the moment you use it, and the bar follows at once. There is no
Apply and no Save to press. If you want a copy to come back to, see [Setup](#setup).

---

## Styles

The look of the popups and of the Control Centre itself. Sections: **Presets** (a whole look in one click, with a short
*Undo the preset*), **Frame**, **Opening** (grow from the icon, shoulders, morph between popups), **Eyes**, **Memory liquid**
and **Lore**.

---

## Bars

![Bars](screenshots/cc-bars.png)

The shape of the bar.

- **Position.** Top, bottom, left or right. On the sides the widgets stack and show icons only. *Float off the
  edge* lifts the bar clear of the screen edge as a pill; off (the default) it touches the edge with no gap.
- **Shape.** Islands, Full, Fit, Dock or Notch: how the bar is cut. Each card draws its shape.
- **Details.** *Corners* (square, soft, round), *Height* (slim 40, regular 46, tall 52), *Spacing* (tight, normal,
  airy), and *Shadow under the bar*.
- **Look.** The plate the bar is painted on. Every layer is its own switch and they combine: grain, paper, blood,
  wood, glass, screentone, calm, torn edge, fog, borders, pills. Sliders for opacity, blood strength, grain and pill
  opacity.
- **Layout.** *Move widgets* enters an edit mode where you drag widgets on the bar itself: a line shows the gap it will go into,
  and only the widget you hold moves. *Reset look* puts the
  plate, effects, seal, workspaces and readings back to the defaults. *Reset layout* puts every widget back where it
  started. (For a gentler way to move widgets, use the Icons page.)

## Popups

The popups (audio, network, Bluetooth, power, display, the calendar, the forecast, the media player, the notification history
and the AI usage panel) share one look and one set of rules. Their colours are the installed theme's: the captures in the README
were taken on Blackturq, so they are teal; on Nord they are blue, on a light theme they turn to dark ink on paper.

- **The frame.** An inked panel: a ruled double edge, torn corners, a spatter of blood and a screentone patch, a burst of
  static as it opens, an emblem at the head and a short note at the foot. Switch it off with **Styles → Frame → Plain**;
  the plain card comes back.
- **The emblem** says what the popup watches: sound waves (audio), a signal (network), a rune (Bluetooth), a flame (power),
  an eye (display), a spiral (media player), a clock (calendar), a telephone (notifications), a mind (AI usage), and the
  sky for the forecast (sun, moon, cloud, rain, storm, snow, fog). Move the pointer near the head and it brightens.
- **Where they open.** Beside the bar, on whichever edge it is on, and they shrink to fit a small screen.
- **Motion.** They follow **Effects → Motion** (off, calm, lively).
- **Lore.** The processor, memory and storage popups can quote the stories they borrow from. **Bars → Details → Lore in the system
  panels** (or `ito-config set loreLevel off|subtle|full`): *off* (the default) leaves them as they were; *subtle* adds notes that follow
  the machine's state and still marks that each show a reading (rust for heat, a chain at the memory line, the figure filling its hole,
  extra copies for folded subvolumes, a square on the emptiest disk); *full* adds bursts of static, the walking fish and a few lettered
  sounds when a threshold is crossed. Every mark stands for a number or a state; none is decoration.

| Popup | Open it | From a key |
|---|---|---|
| Audio | Click the volume reading | `omarchy-shell omarchy.audio toggle` |
| Network | Click the network icon | `omarchy-shell omarchy.network toggle` |
| Bluetooth | Click the Bluetooth icon | `omarchy-shell omarchy.bluetooth toggle` |
| Media player | Right-click the media rings | `omarchy-shell ito.player toggle` |
| Calendar | Click the clock or the date | `omarchy-shell ito.calendar toggle` |
| Forecast | Click the weather | `omarchy-shell ito.weather toggle` |
| Notification history | Right-click the bell (a click toggles Do Not Disturb) | `omarchy-shell ito.notifycenter toggle` |
| AI usage | Click the AI reading | `omarchy-shell ito.aiusage toggle` |

Every one also answers to `open` and `close`. The media player shows the cover, the title, a progress line you can click to
seek, shuffle and repeat when the player supports them, and the controls. The notification history lists the last ten
notifications Omarchy kept, with the Do Not Disturb switch and a way to clear them.

## Animations

Hover an icon and it answers with a halo and a gesture that fits it (the bell rings, the volume dances, the weather plays the sky);
the popup emblems move while the popup is open. Follows **Effects → Motion**. The full list is in
[ANIMATIONS.md](ANIMATIONS.md).

## Icons

![Icons](screenshots/cc-icons.png)

Which widgets are on the bar, where, and how they read.

### Choosing icons

The **ICONS** section is the first thing on the Icons page. Every icon on the bar has one row, with a card for each
drawing it comes in, shown at the size your bar draws it and in your theme's colours. Click a card to use it.

- **Original**: the old inked drawing, exactly as it was. Every icon has it.
- **Ink**: the same object drawn as an engraving.
- **Relic**: from your shell asset sheet (only when you made it; AI needs a 30 px icon).
- **Hollow**: from your sprite sheet, where there is one: the eye for notifications, the spiral beside the clock,
  the moth for the night light, the pyramid beside a low battery.
- **Stay awake**, **Night light** and **Recording** list their versions; the first one is the Original.
- **Use Original for all** puts every icon back to its old drawing; **Use Ink for all** (or Relic, when that is your
  style) gives every icon that has it that drawing. Both show **Undo** for a few seconds.

Nothing changes until you click. **Reset section** clears your choices and every icon follows the style chosen under
**Icon drawing** again.

- **Readings.** How every number reads, everywhere at once:
  - **Percent**: `RAM 42%`.
  - **Amount**: the real quantity where there is one, used out of the total: `RAM 17/32G`, `DISK 210/930G`. Loudness,
    load and the rest have no total and stay a percentage. The total is detected from the machine, not fixed.
  - **Number**: the bare number, no unit.
  - **Off**: icons only.
  - **Name each reading** puts a small label in front (`CPU 42%`, `VOL 51%`), as Shibumi does. Horizontal bars only.
  - **Icon size** is the one size every icon shares, as a share of the bar's height.
  - **Close popups after** is how many seconds a widget's popup (calendar, volume, network, weather, AI usage...)
    stays once the pointer leaves it. `Never` (0) keeps it open until you click again. The pointer being on the popup
    keeps it open.
- **Your bar.** Three columns, laid out the way the bar is: **left, centre, right**; top to bottom is the order along
  the bar. Each widget has:
  - a **switch** that turns it on or off (it keeps its place),
  - **◀ ▶** to send it to the neighbouring column and **▲ ▼** to move it one place along its column,
  - for widgets with a reading, a **"Shows: Icon + text ↻"** line: click it to cycle icon and number, icon only,
    number only.
  **Drag a widget by its grip (⋮⋮) to any place in any column**; a line shows where it will land. The arrows do the same in small steps.
  The seal has a dot instead of a switch: it always stays on so the Control Centre can always be reached.
- **Not on the bar.** Widgets that are in no column: click one to add it (it lands on the right; move it from there).
- **Network icon.** Auto (the port on a cable, the signal arcs on Wi-Fi), always arcs, always the port.
- **Icon drawing.** The style every icon follows until you choose it in ICONS: Original, Ink or Relic, and how the
  Ink icons are inked. (`ito-config set iconStyle ink|relic` works too; the stored ids stay `manga` / `gothic`.)
- **AI usage icon.** What the AI quota fills as it is spent: Brain, Hemispheres, Neurons, Eye or Spiral.

## Clock and calendar

Click the clock or the date and the calendar opens under it. Keys: arrows or `h j k l` move the cursor a day or a
week, PgUp/PgDn turn the month, Shift+PgUp/PgDn the year, `t` goes to today, `y` shows the year plate, Enter or
Space picks, Esc goes back and then closes. `omarchy-shell ito.calendar open|close|toggle` does the same from a
keybinding.

Control Centre, Widgets, Clock & Calendar sets: 12 or 24 hours, seconds, the date beside the time (day, or weekday
and day), western or kanji digits, the moon's phase, a spiral tick, the first day of the week, ISO week numbers,
holidays, and up to three extra time zones written as `Label=Region/City`, comma separated
(`Tokyo=Asia/Tokyo, NYC=America/New_York`; press Enter). All are off, or the plain default, until you change them.

Holidays come from `~/.config/omarchy/ito-holidays.txt`, one per line, `#` for comments, read only while the calendar
is open: `2026-12-08 Founders' day` marks one date, `12-25 Christmas` marks that day every year.

## Logo

![Logo](screenshots/cc-logo.png)

The seal in the middle of the bar, what stands beside it, and the menu button.

- **Seal.** The kanji: Tomie (富江), Uzumaki (渦巻), Junji Ito (伊藤), Quiet hill (静丘), Remina (レミナ), or
  **your own picture** (*Choose picture for the seal*).
- **Seal colour: Auto, On, Off.** By default (**Auto**) the seal turns blood-red while the panel is open or the pointer
  is on it, and bone the rest of the time. **On** keeps it blood-red always; **Off** keeps it bone always, even with
  the panel open.
- **Menu mark.** The application-menu button: Uzumaki, Tomie, Remina, Amigara, Metatron (two versions), Halo, Flauros
  or the sheet spiral, or **your own picture** (*Choose picture for the menu mark*).
- **Seal decoration.** What stands on both sides of the seal: veins, thorns, curls, hair, drips, eyes, cracks, stitches,
  holes, teeth, chain, static, fog, or none; or **your own picture** (*Choose picture for the decoration*).
- **Your own.** Marks you have added; click one to use it.

Each *Choose picture* button opens your file dialog. A folded **How to prepare** panel under it gives the exact size
and format. A file that is too heavy or not a picture is refused with a sentence that says why. See
[CUSTOMIZATION.md](CUSTOMIZATION.md#your-own-pictures-and-effects) for the sizes.

## Effects

![Effects](screenshots/cc-effects.png)

How the shell moves and how much light it gives off. The cards run their effect live.

- **Menu mark / Seal / Seal decoration.** One of: Auto (each mark's own), None, Spin, Pulse, Breathe, Heartbeat, Flicker,
  Sway, Glitch, Ripple.
- **Media.** What moves behind the play buttons while something plays: Blood, Spiral, Eye, Fog, Static, or **Your own**
  (a picture or GIF). It only draws while something is playing, so an idle bar costs nothing.
- **Motion.** How things appear: *Off* (instant), *Calm* (default) or *Lively*. Popups, labels, the Control Centre and
  the workspace marks follow it.
- **When.** Effects run only while the pointer is over the thing (*On hover*, free while idle) or all the time
  (*Always*).
- **Light.** *Glow* (the bloom behind marks and active items; 0 turns every glow off), *Colour vibrance* (a quieter or
  more saturated accent), *Effect speed* and *Effect strength*. *Reset effects* puts them back.

## Workspaces

![Workspaces](screenshots/cc-workspaces.png)

- **Style.** Each card shows the family; among them Rings, Eyes and lips, Remina, three Uzumaki sets, Marks, Halo, Flauros,
  Tomie, Beetle and Uzumaki Eye, or **Custom**. Some Silent Hill families need pictures only you have (see
  [Your own art](INSTALLATION.md#your-own-art)); a family whose art is missing is not offered.
- **Your own pictures.** Four boxes, one for each state a workspace can be in: *Empty*, *In use*, *Active*, *Urgent*.
  Click a box, choose a file, done. One picture is enough: the empty boxes borrow from it. A row under the boxes shows
  how they look on the bar, and *Remove my pictures* goes back to Rings.
- **Which ones.** *Always N* draws the first N workspaces so the row never changes width; *Only in use* draws only those
  with windows, and the one you are on.
- **Count.** How many are always shown (1 to 10).

## Colors

![Colors](screenshots/cc-colors.png)

- **Palette.** *Follow theme* takes the colours of the installed Omarchy theme and changes with it (the default);
  *IKAI* is the shell's own palette (bone on ink, blood the one live colour) and does not change with the theme.
- **Accent.** In *Follow theme* mode, which colour of the theme is the blood: the theme's accent, Ito blood, or any of
  its palette colours, or a colour you type.
- **Preview.** The same art in the colours the bar is using now.

## Plugins

![Plugins](screenshots/cc-plugins.png)

Every plugin the shell can find, wherever it came from: IKAI, Omarchy, Shibumi, or anyone's. Filter with
*IKAI*, *Others*, *All widgets*, *Everything*.

- **Add** puts a widget on the right side of the bar; **Remove** takes it off. The bar restarts for a moment.
- To install a new plugin, drop its folder (a `manifest.json` and a `BarWidget.qml`) into
  `~/.config/omarchy/plugins/` (or `~/.config/ito/plugins/`) and press **Rescan**.
- After adding, move it wherever you like from the Icons page.

## Setup

![Setup](screenshots/cc-setup.png)

- **Profiles.** One place for every whole-bar look, whether it is one of the seven ready-made arrangements (Classic,
  Cluster, Compact, Floating dock, Monitor, Minimal, Zen — used to live on the Bars page as "Designs") or one you save
  yourself.
  - **Ready-made**: click a card to apply it (where every widget sits; the bar restarts for a moment; your colours stay
    as they are). *A ready-made profile also sets its own shape* makes it bring its own shape instead of the one you
    have.
  - **Your own**: type a name and press **Save profile** to keep a copy of the bar exactly as it is now — colours,
    effects, widgets and where they sit, your own pictures. Saving over an existing name asks once more before it
    replaces it. **Load** puts the bar back the way it was (it restarts for a few seconds); **Look** brings back only
    the colours, effects, marks and pictures; **Layout** brings back only the edge, shape and widgets. **Delete** asks
    once more before it removes the copy — the bar itself never changes.
- **Shells.** Every shell it finds: Omarchy's default bar, Shibumi, Caelestia, IKAI. **Switch** stops this shell and
  starts that one. Installing IKAI keeps the shell you were on as its own entry, so going back is one click.
- **About.** Who made it, where, and the licences.

## Boot & Lock

Four tabs, each with its own picture and a status that says whether it is applied:

- **Lock.** The design, the picture and who locks the screen: Omarchy's lock only recoloured, IKAI's own lock, or hyprlock.
  Revert with `ito-lock revert`.
- **Terminal.** The fastfetch picture and layout. Revert with `ito-fastfetch revert`.
- **Screensaver.** Timing, text and effect. Revert with `ito-screensaver revert`.
- **Boot.** The splash picture. Applying asks for your password, rebuilds the boot image and also changes the login logo, so
  it is always a step you run in a terminal (`ito-plymouth apply`). `ito-plymouth reset` brings Omarchy's own back.

Your pictures are copied into `~/.config/ito/` and never leave your machine; see [Your own art](INSTALLATION.md#your-own-art).

---

## Health

![Health](screenshots/cc-health.png)

What is wrong with the shell, why, and how to put it right.

- Each check says what it found. One that is not well also says **what it means** and **what to do**, and most have a
  **Fix** button.
- **Fix everything** applies every fix that is offered, restarting the shell once at the end if it needs it.
- **Copy report for an AI assistant** copies a full report (what is wrong, your machine and setup, the log, and how to
  fix each thing) so you can paste it into any assistant and it can solve the problem. **Save report as a file** writes
  the same report to `~/ito-health-report.md`.
- **Check again** runs every check again.

The report contains your IKAI settings, the list of plugins, monitor names and recent log lines. It has no
passwords or tokens, but read it before you paste it somewhere public.

---

## From the terminal

The panel is a front for a few tools in `bar/modules/bin/`: see the README's table. The most useful:

```bash
ito-health --text          # the diagnosis, in plain text
ito-health --fix all       # apply every safe fix
ito-health --report        # the full report for an AI assistant
ito-config list            # every setting
ito-config set valueStyle amount
ito-profile save "Evening" # a named setup
ito-profile load "Evening"
ito-restart                # the one safe way to restart the shell
```

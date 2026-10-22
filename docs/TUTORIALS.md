# Tutorials

Short, in order, each one ends with something you can see. Button names are exactly as they appear in the panel.
If a step does not do what it says, jump to [Get help](#12-something-is-wrong-get-help).

**Contents**
1. [Open the Control Centre](#1-open-the-control-centre)
2. [Make the numbers say what they mean](#2-make-the-numbers-say-what-they-mean)
3. [Turn widgets on and off, and move them](#3-turn-widgets-on-and-off-and-move-them)
4. [Change the colours](#4-change-the-colours)
5. [Pick a workspace style, or draw your own](#5-pick-a-workspace-style-or-draw-your-own)
6. [Your own menu button and seal](#6-your-own-menu-button-and-seal)
7. [Your own effect: a picture or a GIF](#7-your-own-effect-a-picture-or-a-gif)
8. [Make popups close by themselves](#8-make-popups-close-by-themselves)
9. [Add a plugin from someone else](#9-add-a-plugin-from-someone-else)
10. [Save your setup and come back to it](#10-save-your-setup-and-come-back-to-it)
11. [Switch to another shell, and back](#11-switch-to-another-shell-and-back)
12. [Something is wrong: get help](#12-something-is-wrong-get-help)
13. [Open the panel with a key](#13-open-the-panel-with-a-key)
14. [Use the popups](#14-use-the-popups)
15. [Make everything move less, or more](#15-make-everything-move-less-or-more)

---

## 1. Open the Control Centre

Click the **富江 seal** in the middle of the bar. The panel drops from the top. Click a name on the left to change
page. **Esc** closes it.

Sections inside a page are folded; **click a title** (the small ▸ turns to ▾) to open it. **Ctrl K** (or click the
search box) and type a word: every section that matches opens by itself.

## 2. Make the numbers say what they mean

Goal: `RAM 17/32G` instead of a bare `68`.

1. Open **Icons**. The first section, **Readings**, is open.
2. Pick **Amount**. Memory and disk now show what is used out of the total (`RAM 17/32G`, `DISK 210/930G`); volume, CPU
   and the rest keep a percentage, because they have no total.
3. Leave **Name each reading** on to get the small label in front (`CPU 4%`). Turn it off for numbers alone.
4. Want percentages everywhere? Pick **Percent**. Icons only? **Off**.

The totals come from your machine (`/proc/meminfo`, `df`): they are not fixed at 32.

## 3. Turn widgets on and off, and move them

Goal: put the clock on the left, hide the disk.

1. **Icons → Your bar** (open by default). You see three columns: **Left**, **Centre**, **Right**. Top to bottom is the
   order along the bar.
2. **Move anything anywhere:** hold a widget's grip (**⋮⋮**) and drag it to the place you want, in any column; a line shows where it will land.
   The arrows below do the same in small steps. **Hide the disk:** find *Disk* and click its **switch**. It turns off and keeps its place; switch it back on any time.
3. **Move the clock:** find *Clock* and use the arrows on its row. **◀** sends it to the column on its left (from the
   centre to the left side), **▶** to the column on its right, **▲ ▼** move it one place along its column.
4. Widgets that show a number have a line *Shows: Icon + text ↻*. Click it to cycle *icon and number → icon only → number
   only*.
5. A widget that is in no column appears under **Not on the bar** as a `+` button. Click it to add it on the right.

The seal cannot be switched off (it shows a dot instead of a switch): it is the door back to this panel.

Prefer dragging? **Bars → Layout → Move widgets** closes the panel and lets you drag widgets on the bar itself.

## 4. Change the colours

Goal: follow your Omarchy theme, or keep IKAI's own blood red.

1. Open **Colors → Palette**.
2. **Follow theme** takes the colours of whatever Omarchy theme is installed and changes with it (the default).
   **IKAI** keeps bone on ink with blood red, whatever the theme.
3. In Follow theme mode, **Accent** chooses which colour of the theme is the "blood": the theme's accent, Ito blood, or
   any of the theme's palette colours.
4. Too vivid, too dull? **Effects → Light → Colour vibrance**. **Glow** at 0 turns every glow off.

## 5. Pick a workspace style, or draw your own

Goal: your own pictures for the workspaces.

1. Open **Workspaces → Style**. Click any card to try it: Seals, Rings, Tomie, Remina, Uzumaki, Marks, Halo, Flauros.
2. For your own, open **Your own pictures**. It has four boxes, one for each state a workspace can be in:
   - **Empty**: no windows,
   - **In use**: has windows,
   - **Active**: the one you are on,
   - **Urgent**: a window asks for attention.
3. **Click a box**, choose a picture in the file dialog. Pictures should be **square, 256 × 256 px** (PNG with a
   transparent background is best; 128 to 1024 works). The style switches to **Custom** by itself and the bar uses it
   at once.
4. **One picture is enough**: the boxes you leave empty borrow from the nearest one you filled. To tell the states apart,
   fill all four, and make *Active* stand out (a red stroke, a brighter mark).
5. The row under the boxes shows how it looks. **Remove my pictures** goes back to Rings.

Every workspace wears the picture of its state, so the position in the row tells them apart. Want a number on each?
Bake it into a picture and use it as a mark instead.

## 6. Your own menu button and seal

Goal: your own picture as the menu button and the seal.

1. Open **Logo**. Under **Menu mark** press **Choose picture for the menu mark**. Use a **square 512 × 512 px** picture
   (PNG with transparency is best; 128 to 2048 works). It appears in the list of marks and is used at once.
2. The picture is adapted to the shell's colours: dark lines on light paper, light lines on dark, or red strokes; red
   becomes your accent and everything else follows the theme. The original is never modified.
3. For the seal's letters, open **Seal** and press **Choose picture for the seal** (**square 256 × 256 px**).
4. For what stands beside the seal, open **Seal decoration** and press **Choose picture for the decoration**
   (**600 × 200 px**, 3 : 1; its mirror is drawn on the other side).
5. Each button has a folded **How to prepare** panel under it with the size, format and colours.

If a file is refused, the panel says why (too heavy: the limit is 25 MB; or not a picture the shell can read). Use PNG,
JPG, WebP, GIF or SVG.

## 7. Your own effect: a picture or a GIF

Goal: a GIF moving behind the play buttons.

1. Open **Effects → Media**. Click the **Your own** card (it says *+ choose a picture or GIF*) and choose a file.
2. Use a wide, short picture: the strip behind the buttons is about **6 : 1**, so **600 × 100 px** is the right size (up
   to 1200 × 200 is fine, more than 2400 px on a side is refused). Keep a GIF under **3 MB** and about 100 frames; the
   hard limit is 8 MB.
3. It only plays while something is playing. Start some music to see it. Anything not 6 : 1 is cropped to the middle.
4. **Remove my effect** goes back to Blood.

## 8. Make popups close by themselves

Goal: the calendar or volume popup goes away when you stop using it.

1. **Icons → Readings → Close popups after.** Drag the slider: the number is seconds.
2. A popup closes that many seconds after you open it or after the pointer leaves it, and never while the pointer is on
   it. `Never` (0) keeps it open until you click again. The default is 3.

Popups you open with the keyboard, with the pointer far away, also close after that time. Set `Never` if you use them
that way.

## 9. Add a plugin from someone else

Goal: a widget somebody wrote on your bar.

1. Put its folder (it has a `manifest.json` and a `BarWidget.qml`) in `~/.config/omarchy/plugins/`.
2. Open **Plugins** and press **Rescan**. It is listed under *Others* with its author.
3. Press **Add** on its row. The bar restarts for a moment and the widget appears on the right.
4. Move it where you want it from **Icons → Your bar**. To take it off, press **Remove** on the Plugins page.

Any plugin the Omarchy shell can host can go on the bar, whoever made it.

## 10. Save your setup and come back to it

Goal: try a very different look without losing this one.

1. Open **Setup → Profiles**. Type a name (for example *Evening*) under "Your own" and press **Save profile**. It
   stores your colours, effects, widgets and their places, and your own pictures.
2. Change anything you like — or click one of the ready-made cards above (Classic, Cluster, Compact...) to try a whole
   different arrangement; those never change or disappear, so trying one costs nothing.
3. To come back, press **Load** on *Evening*. The bar restarts for a few seconds and is as it was.
4. **Delete** asks once more, then removes a saved copy (not the bar).

Everything you change is also remembered by itself, so you never *have* to save; this is for the looks you want to be
able to return to. From a terminal: `ito-profile save "Evening"`, `ito-profile load "Evening"`.

## 11. Switch to another shell, and back

Goal: try Shibumi's bar, or Omarchy's own, or Caelestia, and return.

1. Open **Setup → Shells**. Every shell it finds is listed.
2. Press **Switch** on the one you want. The current shell stops and the other starts.
3. To return: open the panel of that shell if it has one, or run `scripts/shell-switch ito` from a terminal, or press
   **Switch** on IKAI if you can reach this page.

Installing IKAI keeps the shell you were on as its own entry, so going back is always possible. If the shell ever
falls back to another bar by itself, Health says **Active bar** and its **Fix** switches back.

## 12. Something is wrong: get help

1. Open **Health**. Each check says what it found; a check that is not well says what it means and what to do.
2. Press **Fix everything**. It applies every fix that is offered, restarting the shell once at the end if it needs it.
3. Still stuck? Press **Copy report for an AI assistant** and paste it into any AI assistant (ChatGPT, Claude,
   whatever you use). The report says what is wrong, describes your machine and setup, includes the recent log and lists
   the fixes the tool can apply, so the assistant can solve it. **Save report as a file** writes it to
   `~/ito-health-report.md` if you want to attach it instead.
4. Read the report before pasting it in public: it holds your IKAI settings, plugin list, monitor names and recent log
   lines (no passwords or tokens).

From a terminal: `ito-health --text`, `ito-health --fix all`, `ito-health --report`. Every known problem, in words, is in
[TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## 13. Open the panel with a key

The panel answers to a command, so any keybinding can open it:

```bash
omarchy-shell ito.controlcenter toggle          # open / close
omarchy-shell ito.controlcenter open
omarchy-shell ito.controlcenter close
omarchy-shell ito.controlcenter page effects    # jump to a page
```

Pages: `bars`, `widgets` (Icons), `logo`, `effects`, `workspaces`, `colors`, `plugins`, `shells` (Setup), `health`.
Bind `toggle` to a key in your Hyprland config the way you bind any command.

## 14. Use the popups

Goal: play music from the bar and read your notifications.

1. **Media player.** Start something in a player (Spotify, a browser, mpv). Three small rings appear on the bar. **Right-click**
   any of them: a panel opens with the cover, the title, a progress line (click it to jump) and the controls. A left click on
   the rings still does previous, play or pause, and next.
2. **Notifications.** A click on the bell toggles Do Not Disturb. **Right-click** it to read the last ten notifications, switch
   Do Not Disturb from inside the panel, or clear them.
3. **Calendar and forecast.** Click the clock or the date for the month; click the weather for the hours and days ahead.
4. **AI usage.** Click the AI reading to see each provider's limits and what each model has used.
5. Every popup closes by itself a few seconds after the pointer leaves it (Icons → Readings → Close popups after), and every
   one answers to a key: see the table in the [User guide](USER_GUIDE.md#popups).

## 15. Make everything move less, or more

Goal: quieter, or livelier.

1. Open **Effects → Motion**.
2. **Off** makes every entrance instant: popups, labels, the Control Centre, the workspace marks.
3. **Calm** (the default) is short and quiet; **Lively** is a little longer with more travel.
4. The popups have their own frame: **Styles → Frame → Plain** turns it off and brings back the plain card.


## 16. The lock, the terminal, the screensaver and the boot screen

Open the Control Centre, then **Boot & Lock**. Four tabs, one per surface. Each one starts with a line that says what is
really in place: *Applied*, *out of date* (your theme or picture changed since), *partly in place*, or *not in charge*.

- **Lock.** Pick a design (the previews are drawn from sample data in your colours; nothing locks). *Try for 15 s* locks the
  screen for 15 seconds with the design and unlocks by itself. Under *Who locks* you see the four ways the screen gets
  locked (menu, idle, suspend, keybind) and which lock answers each. If they differ, choose one owner: Omarchy's lock
  themed, Ito's own lock, or hyprlock everywhere. The change opens a terminal, prints exactly what it changes, asks, and backs
  everything up; `ito-lock own --undo` puts it back. After choosing Ito's own lock, restart the shell once (`ito-restart`),
  then test it yourself: lock with the menu, type a wrong password, then the right one; and check that Stay Awake still holds.
- **Terminal.** Omarchy's lines and colours are never changed. Choose the logo (Omarchy's, the eye, your picture) and whether
  the ornaments are on. `ito-fastfetch run` centres the block in the terminal you are in.
- **Screensaver.** Omarchy's idle timer starts it; change the delay in Omarchy's settings. Choose the text and the effect.
- **Boot.** Choose the composition, then *Apply* in the terminal that opens (it asks for your password and rebuilds the
  boot image). *Put Omarchy's back* undoes it.

If a toggle does not flip, the line under it says why.

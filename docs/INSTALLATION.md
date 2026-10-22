# Installation

Requires an existing Omarchy install running Hyprland. `install.sh` (at the root) is
interactive: it says what it will do and asks `[y/N]` before changing anything. It runs `scripts/deploy.sh`, which copies
the plugin into `~/.config/omarchy`, records the folder in `~/.config/ito/repo` and restarts the shell once. It uses no
sudo, no network and installs no packages. `scripts/deploy.sh` and `scripts/shell-switch` are safe to run repeatedly.

## Requirements

- **Omarchy 4.0.6 or newer** with **Hyprland**, on Arch Linux (developed and tested on Omarchy 4.0.6, Quickshell 0.3.x,
  Hyprland 0.56, Qt 6.11). The bar is a plugin of Omarchy's shell engine; it does not run without it. Quickshell is a dependency of
  the `omarchy` package.
- Fonts: `noto-fonts` and `noto-fonts-cjk` (the numbers, the clock and the kanji seal).
- Tools the installer and the panel use: `rsync`, `jq`, `python` with `python-pillow` and `python-numpy` (to adapt your own
  pictures), `zenity` (or `kdialog`/`yad`, the file dialog), `wl-clipboard` (to copy the Health report), `librsvg` (only for SVG
  pictures).
- **Terminal fetch:** `fastfetch` draws the IKAI picture (install it with `sudo pacman -S fastfetch` if you do not have it). In a terminal that cannot draw pictures
  itself, fastfetch needs `libchafa`, which the `chafa` package provides; it is optional. Without it the image logo falls back to
  Omarchy's own logo and `ito-health` shows a warning with the fix (`sudo pacman -S chafa`). Ghostty and kitty draw the picture
  themselves.

## Compatibility

| | Status |
|---|---|
| Arch Linux | Supported (developed and tested here) |
| Omarchy with Hyprland | Supported (4.0.6 or newer; tested on 4.0.6, Quickshell 0.3.x, Hyprland 0.56, Qt 6.11) |
| Bar on top, bottom, left or right | Supported and tested, with every shape (Islands, Full, Fit, Dock, Notch) |
| Ryoku | Not yet. Ryoku has its own shell and plugin format, so this bar does not run there as it is; an adapter is planned |

Install them with your package manager. On Arch the packages are named `noto-fonts`, `noto-fonts-cjk`, `rsync`, `jq`,
`python-pillow`, `python-numpy`, `zenity`, `wl-clipboard` and `librsvg`.

`bar/modules/bin/ito-health` checks all of this and says what is missing.

## First install

**Option A: the Omarchy plugin.** `omarchy plugin add https://github.com/Davidxap/ikai-shell`, enable the *Install
IKAI* widget on your bar, and click it. A terminal opens, says what it will do (copy the shell into
`~/.config/omarchy`, keep your own settings, keep the shell you use now as its own entry) and asks before it changes anything;
it then offers to switch to IKAI. It is the same as running `install.sh` from the plugin's folder.

**Option B: by hand.** Download the repository from GitHub (the green **Code** button, then **Download ZIP**), unzip it and open a
terminal in the folder:

```bash
# 1. System colours (GTK, terminal, Hyprland borders, ...) via Omarchy's own theme switcher.
cp -r themes/ito-verse ~/.config/omarchy/themes/ito-verse
omarchy theme set ito-verse

# 2. The bar and its widgets: copy the repo onto the live config.
scripts/deploy.sh
```

`scripts/deploy.sh` (a thin wrapper over `scripts/sync.sh push`) copies `bar/modules/`, every
`plugins/ito.*` folder and `themes/ito-verse/` onto `~/.config/omarchy`, preserving your own
`ito-style.json` settings if one already exists, and regenerates the bar engine's suite-marker
signature (`scripts/gen-itobar-marker.py`) so the engine doesn't refuse to start. It restarts the
shell itself, but only if it detects the shell is already running and something actually changed. On a machine
that has never run IKAI it first keeps the shell you are on now (Omarchy's default, Shibumi, …) as a variant of its own, so you can switch back to it, and then creates `~/.config/omarchy/shell.ito.json` (your own shell config plus the
IKAI bar, from `seed/shell.ito.json`) so that the next step can find it; an existing one is never overwritten.

```bash
# 3. Make IKAI's shell the active one.
scripts/shell-switch ito
```

`scripts/shell-switch` detects every shell it can find (Omarchy variants by their
`shell.<name>.json`, plus Caelestia if installed), saves whatever was active before switching, and
swaps cleanly (stop → save → swap → start → verify, rolling back automatically if the new shell
fails to come up). Run it with no argument to list what it found.

### Optional: the cursor and the icons

The Tomie colour theme (step 1) does not select a cursor or icon theme by itself. To build and install them:

```bash
python3 scripts/gen-cursors.py            # the IKAI cursor theme, into ~/.local/share/icons/Ito-verse (folder name unchanged)
python3 scripts/gen-icons.py --install    # the inked IKAI icon theme, into ~/.local/share/icons/Ito-verse-icons (folder name unchanged)
```

Installing them changes nothing until something selects them (your desktop's cursor and icon settings).
`ito-health` reports whether they are installed.

## Updating

```bash
git pull
scripts/deploy.sh
```

That's the whole update: deploy.sh only touches what changed and only restarts if it needs to. What a release changed (renamed or removed settings
included) is in [CHANGELOG.md](../CHANGELOG.md). After an update of Omarchy, Quickshell or Qt, run `bar/modules/bin/ito-compat check`
and see [UPGRADING.md](UPGRADING.md).

## Verifying it worked

```bash
bar/modules/bin/ito-health --text
bar/modules/bin/ito-restart status    # {"shells":1,"launchers":1,"headless":[]} is a clean result
```

`ito-health` should report every check `ok`. If it doesn't, it names what's wrong and how to fix it
— `ito-health --fix all` applies every fix it considers safe. See `docs/TROUBLESHOOTING.md` for what
each check means.

## Your own art

IKAI never ships your pictures and never copies them into the repository. Anything you add lives in
`~/.config/ito/assets`, laid out like `bar/modules/ito-art/`: a PNG there replaces the shipped picture of the same name. Two
ways to add art:

- In the Control Centre: the picture pickers (Logo, Workspaces, Boot & Lock) copy and adapt your picture for you.
- From the terminal, with `ito-assets` (it only reads that folder and keeps a small index in `~/.cache/ito/`):

```bash
ito-assets slots                          # the named slots (boot, lock, screensaver...): path, canvas size, what each is for
ito-assets ingest FILE --as SLOT          # turn a picture into the slot's transparent PNG (the original is kept in _sources/)
ito-assets recipe --list                  # the recipes that cut ready-made art from a source picture of yours
ito-assets recipe lineart FILE --as REL   # theme-ready art from any one picture (neutral ink on alpha, with a light twin)
ito-assets index                          # rebuild the index after you add files by hand
```

Marks for the menu button go in `~/.config/ito/marks/` (`ito-marks import FILE`). Some designs (for example several lock and
boot scenes) are drawn by recipes from pictures only you have; a design whose picture is missing is simply not offered.
You are responsible for the right to use the pictures you add.

## Uninstalling and reverting

Revert what IKAI changed outside its own folder first, then go back to your previous shell and theme, and only then delete files.
Each tool undoes only what it wrote:

```bash
ito-config reset                  # your IKAI settings back to the defaults (it backs them up first; --page / --section / --key for less)
ito-lock revert                   # the hyprlock.conf you had before the first apply comes back, and the hook is removed
ito-fastfetch revert              # the generated fastfetch files go, Omarchy's default config comes back
ito-plymouth reset                # Omarchy's own boot screen and login logo (terminal only, asks for your password)
ito-screensaver revert            # only if you applied the IKAI screensaver

scripts/shell-switch <whatever you were on before>   # e.g. omarchy
omarchy theme set <whatever theme you were on before>

rm -rf ~/.config/omarchy/plugins/ito.*
rm -rf ~/.config/omarchy/bar/modules       # only if nothing else uses this folder
rm -rf ~/.config/omarchy/themes/ito-verse
rm -rf ~/.config/ito ~/.cache/ito          # only if you also want your own art, marks and settings gone
```

Switch shells and revert the colour theme **before** deleting any files: `shell-switch` needs the files present to shut the
shell down cleanly. The cursor and icon themes (`~/.local/share/icons/Ito-verse*`) are not selected by anything until you pick
them; remove the folders if you installed them.

## What "reversible" means here

Every step above is reversible on its own: the colour theme through `omarchy theme set`, the bar
through `shell-switch`, individual settings through the Control Centre's own reset buttons or
`bin/ito-config reset`. Nothing here modifies Omarchy's own stock bar or theme files in place — a
clone (`ito.audio` etc.) lives beside the original Omarchy widget it was cloned from, not over it.

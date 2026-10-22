# FAQ

**Does it work outside Omarchy?**
No. The bar runs as a plugin inside Omarchy's shell engine (`qs.Ui`, `qs.Commons`); it is not a standalone Quickshell
shell. Omarchy on Arch Linux with Hyprland is the supported setup. Most widgets talk to the machine directly through
`ito-host`, so they are not tied to Omarchy's commands, but the bar needs the Omarchy host.

**Does it work with Ryoku?**
Not yet, and it would be dishonest to say otherwise. Ryoku is an independent desktop with its own shell: a bar there is a
"bar style" (`barstyles/<id>/Scene.qml`) and widgets go through `Ryoku.PluginKit`. IKAI's bar is a plugin of Omarchy's
shell engine, so it cannot run inside Ryoku as it is. An adapter that reuses the art, the palette logic and the popups is
planned.

**Does it work with the bar on the side or at the bottom?**
Yes. The four edges and the five shapes are tested. Popups open beside the bar and shrink to fit the screen.

**Does it work on light themes?**
Yes. In *Follow theme* mode the shell places every colour of its art between the theme's background and its foreground, so a
dark theme gets light lines on a dark plate and a light theme gets dark lines on a light plate, with the theme's accent for
the blood. It switches by itself when you change theme. The *IKAI* palette (Colors page) is always dark.

**Will it break my current setup?**
No. Installing keeps the shell you are on as its own entry (Setup → Shells), and `scripts/shell-switch <name>` (or the
**Switch** button) returns to it. The colour theme is reversible with `omarchy theme set <previous theme>`. Nothing
modifies Omarchy's own files.

**Where are my settings?**
`~/.config/omarchy/bar/modules/ito-style.json` (the look, edited only through `ito-config` or the panel) and
`~/.config/omarchy/shell.json` (the bar's layout, owned by the engine). Your own pictures are in `~/.config/ito/`.
Named setups are in `~/.config/ito/profiles/`.

**Do I have to press Save?**
No. Every change is written the moment you make it. **Setup → Profiles** is for named copies you want to return to.

**How do I back up my look?**
Save a profile (Setup → Profiles), and copy `~/.config/ito/` if you want it on another machine. `ito-profile load` needs
IKAI installed there.

**It shows `68` next to RAM. I want `17/32G`.**
Icons → Readings → **Amount**. Percent shows `RAM 68%`; Number shows the bare number.

**Why does volume or CPU stay a percentage in Amount?**
There is no total to show them out of, so a percentage is the honest reading.

**A popup closes too fast (or never).**
Icons → Readings → **Close popups after**. `Never` keeps it open until you click again. If you open popups with the keyboard,
with the pointer far away, they also close after that time.

**Can I use my own pictures and GIFs?**
Yes: menu mark, seal, decoration, the four workspace pictures and the media effect (picture or GIF). Each page has a folded
*How to prepare* panel with the size. See [CUSTOMIZATION.md](CUSTOMIZATION.md#sizes-that-work).

**A picture was refused.**
It is over the limit (25 MB, 8000 px on a side; for the media effect 8 MB and 2400 px) or not a picture the shell can read.
The panel says which. Use PNG, JPG, WebP, GIF or SVG.

**Can I put another plugin's widget on the bar?**
Yes. Put the plugin's folder in `~/.config/omarchy/plugins/`, press **Rescan** on the Plugins page and **Add**.

**I switched to another shell and cannot get back.**
Run `scripts/shell-switch ito` from the repository, or `ito-health --fix switch`. If the IKAI bar is missing after a
deploy, Health's **Active bar** check and its Fix do the same.

**The bar disappeared or shows twice.**
Never kill `quickshell` by hand. Run `ito-restart`; Health's **One bar** check and `ito-health --fix onebar` fix a
duplicate. `docs/TROUBLESHOOTING.md` lists the rest.

**The panel looks empty on one page.**
Open Health. A page that fails to load is reported there with a fix, and `scripts/check-qml.sh` catches it before a deploy.

**Something else is wrong and I do not know what.**
Health → **Copy report for an AI assistant**, and paste it into any assistant. The report says what is wrong, describes your
machine and includes the log.

**Is it free? Can I use it commercially?**
It is free for any non-commercial use (PolyForm Noncommercial 1.0.0 for the code, personal non-commercial use for the art).
You may not use it to make money. The forked bar engine and five re-skinned Omarchy widgets keep their MIT licences. See
[NOTICE](../NOTICE).

**Who made it?**
davidxap. The bar engine is a fork of Shibumi-Shell by HANCORE; five widgets are Omarchy's own, re-skinned. See the credits
in the [README](../README.md#credits-plainly).

**Some of the artwork looks like it is from a manga.**
It is inspired by Junji Ito's work and by Silent Hill; it is a fan work and not affiliated with their authors or
publishers. Some source images were found online and edited; see [ART_LICENSE.md](../ART_LICENSE.md) and ask for credit or
removal if one is yours.

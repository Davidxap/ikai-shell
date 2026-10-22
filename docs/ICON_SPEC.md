# Icons: what the bar reads

The shell draws every icon from a PNG in `bar/modules/ito-art/`. Put yours in the same place with the same name and it
is used; nothing else needs changing. The shell recolours them to the installed theme, so draw in the two base colours.

## The rules for every icon
| | |
|---|---|
| Size | **256 × 256 px**, square (workspace art may be 288). Bigger is fine, it is scaled down. |
| Background | transparent PNG, no border, no drop shadow |
| Ink | fills about **74 %** of the box (the workspace rings fill 70 to 72 %), centred. It is shown at **29 px** on a 46 px bar, so keep lines at least 12 px thick at 256 and avoid fine hatching |
| Colours | bone `#c7ccd1` for the drawing, blood `#c4162a` for what is live or wrong. Anything reddish is turned into the theme's accent, everything neutral into the theme's foreground, and brightness is kept |
| States | the same drawing in each state, so the icon does not jump when it changes |

## Files the bar reads
| Folder | Files | What |
|---|---|---|
| `notifications/` | `notification` (idle), `notification-active` (something waiting), `notification-error`, `notification-muted`, `notification-dnd` (silenced), `notification-critical` | the bell |
| `media/` | `media-prev`, `media-play`, `media-pause`, `media-next`, `media-stop` | media controls (play is blood) |
| `instruments/` | `net-0` `net-1` `net-2` `net-3` (signal), `net-off`, `net-wired` | network |
| `instruments/` | `vol-0` `vol-1` `vol-2` `vol-3`, `vol-mute` | sound, low to high |
| `instruments/` | `display-0` `display-1` `display-2` `display-3` | brightness, dim to bright |
| `instruments/` | `bat-0..4`, `bat-charge-1..4`, `bt-off` `bt-on` `bt-linked`, `sky-*` | battery, Bluetooth, weather |
| `indicators/` | `awake-<version>-<off\|on>`, `night-<version>-<off\|on>`, `record-<version>-<off\|on>` | Stay awake (coffee, radio, flashlight), Night light (moon, fog), Recording (eye, tape). A new version needs one line in `bar/modules/ItoIcons.js` |
| `system/` | `tray-chevron` (the tray's `<`), `brain` + `brain-fill`, `ai-<form>` + `ai-<form>-fill` | tray, AI usage. A `-fill` file is the drawing's inside as a solid white silhouette, the same size and position, which the blood level is clipped to |
| `system/` | `menu-<name>` | menu marks (also `~/.config/ito/marks`, see the Logo page) |
| `workspaces/`, `workspace-labels/`, `workspace-indicators/`, `status-eyes/` | see `bar/modules/cc/PageWorkspaces.qml` | workspace styles: four states each (empty, occupied, active, urgent) |
| `decor/` | `veins`, `thorns`, `curls`, `hair`, `drips`, `eyes`, `cracks`, `stitches`, `holes`, `teeth`, `chain`, `static`, `fog` | what stands beside the seal. Tall and thin (about 1 : 4); the right side is the left mirrored |

## Delivering them
Copy the files over the ones with the same names, run `scripts/deploy.sh`, and check the bar at 29 px. If an icon looks bigger
or smaller than the workspace marks, its ink share is off: that is the first thing to fix.
(The old generator that rebuilt the icons from the design sheet has been removed, so nothing can overwrite them.)

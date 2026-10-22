# Animations and icons

Everything here follows **Effects → Motion** (Off, Calm, Lively). With Motion off nothing moves; with Lively the gestures last
longer. Nothing runs while the pointer is elsewhere and no popup is open, so an idle bar costs almost nothing.

## Hover: every icon answers

Move the pointer over an icon on the bar: a soft halo of the theme's accent rises behind it, and the icon makes one small gesture
that fits what it is.

| Icon | Gesture |
|---|---|
| Notifications (bell) | It swings from its top and rings, then settles |
| Processor, AI usage, battery, media play | A heartbeat |
| Disk | One slow turn |
| Volume | It dances up and down like a sound meter while the pointer stays |
| Network, Bluetooth | Three beeps, each a little larger |
| Brightness | A flicker, like a lamp |
| Stay awake (coffee, radio, flashlight) | The steam or flame gutters |
| Night light (moon, fog) | It breathes while the pointer stays |
| Recording (eye, tape) | A short shake |
| Tray | The applications lift, each with its halo |
| Everything else | It lifts and brightens |

**The weather plays the sky.** Over the forecast icon the sky outside moves: rain falls, a storm flashes and a bolt strikes, the sun
sends out rings of heat while its rays turn, snow drifts, mist slides past itself, the moon's star flickers and a cloud drifts.

## Popup emblems

Each popup has an emblem at its head, drawn as vectors (sharp at any scale) in the theme's colours, and it moves while the popup
is open:

| Popup | Emblem | Movement |
|---|---|---|
| Display | An eye | The spiral pupil turns |
| Audio | Sound waves | The rings breathe out and in |
| Network | A signal | Three arcs light one after another, outwards |
| Bluetooth | A rune | It pulses; the centre dot beats |
| Power | A flame | It gutters |
| Media player | A spiral | It turns |
| Calendar | A clock | A real hour and minute hand, and a second hand in blood that sweeps |
| Notifications | An old telephone with a coiled cord | It shakes in bursts, like a ringing phone, and a light blinks |
| AI usage | A mind | The folds light up in turn |
| Forecast | The sky (sun, moon, cloud, rain, storm, snow, fog) | What the sky is doing |

All of them end in blood diamonds between two rules, like the ornament over a chapter of a manga.

## Media effects

Behind the play buttons while something plays (Effects → Media):

- **Spiral**: fine arms of blood and bone, fitted so the whole spiral is inside the strip and never cut by its edges, with a faint
  rim and arms that fade in and out.
- **Eye**: an inked eye that blinks and darts. To use a picture of your own, put `eyes.png` and `eyes-red.png` (about 640 × 246 px,
  transparent) in `~/.config/ito/eyefx/`; delete them to return to the built-in eye.
- **Blood, Fog, Static**, and your own picture or GIF.

## Icons that were redrawn

- **Notification bell**: an Uzumaki spiral on its body and an eye for a clapper; with news waiting the spiral turns to blood, arcs
  ring either side and the eye weeps a drop.
- **Volume, muted**: the quiet waveform with a slash of blood (it used to be a filled speaker that read as a box).
- **Seal decorations on a vertical bar** lie across the bar, above and below the seal.
- **Emblems**: the hourglass, web and bell were replaced by the clock, the signal and the telephone.

## Smoothness fixes

- **Moving a widget** no longer makes the island plates disappear for a third of a second: every plate has an instant fill under
  its canvas.
- **The tray drawer** takes its room at once, so its icons never show outside the island.
- **Dragging on the bar** always moves the one widget you hold to the gap under the pointer (no more swapping), and stay awake,
  night light and recording are separate widgets.
- **Popups** never fall below 124 px, so the bar engine no longer resizes short ones without end.

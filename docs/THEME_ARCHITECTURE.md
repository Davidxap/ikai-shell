# Theme architecture

## The engine decision

IKAI runs its **own** bar engine, `ito.bar`/`ito.state` — an MIT-licensed fork of the Shibumi bar engine (the rest of IKAI is under PolyForm Noncommercial; see NOTICE)
(`plugins/ito.bar/NOTICE`), registered as a style alongside Shibumi's own, not layered on top of it.

This was a deliberate move away from Omarchy's stock bar engine, which has no style system at all
(no `shellStyle`, islands, splits, notch or frost — only a single `radius`), so a bar with real
shapes and effects was not reachable without editing files under `/usr/share`. The fork gives
IKAI a pluggable style registry instead.

## The hosting boundary (read this before assuming anything is portable)

`ito.bar` is a **plugin hosted inside Omarchy's own shell.qml engine** (`import qs.Ui`,
`import qs.Commons`) — it is not a standalone Quickshell shell. It cannot be run outside an Omarchy
install; the host engine is what actually opens the window, exposes `Quickshell.Hyprland`, and wires
up the plugin/module loading `ito.bar` depends on.

Within that boundary, most of the shell is written against the machine, not against Omarchy:

- Live data comes straight from `Quickshell.Hyprland` (workspaces), Pipewire (volume),
  `UPower` (battery), `Quickshell.Bluetooth`, `Quickshell.Networking`, or a polled
  `Process`/`Timer` (CPU, memory, disk, weather).
- Anything that would otherwise be a distribution-specific call (opening the app menu, switching
  workspace, which terminal to launch, toggling night light, starting a screen recording) goes
  through one abstraction, `bar/modules/bin/ito-host`, which picks the right tool for whatever
  compositor/terminal/launcher is actually present (Hyprland, sway, niri; several terminals and
  launchers).

The exception, by explicit decision, is `plugins/ito.audio`, `ito.network`, `ito.bluetooth`,
`ito.display` and `ito.power`: these are dressed clones of Omarchy's own widgets, and their panels
still call Omarchy's CLI tools (`omarchy-*`) directly rather than talking to
PipeWire/NetworkManager/BlueZ/brightnessctl/UPower themselves. Rewriting those five onto native APIs
to drop the last Omarchy-CLI dependency has been proposed and explicitly deferred — it is real
scope, and the five widgets work correctly as they are.

## Layers

1. **Theme.** `palette.toml` is the source; `scripts/gen-palette.py` generates `colors.toml` (the
   foundational palette) and `shell.toml` (the 13 surface families). The engine reads both through
   the `qs.Commons.Color` singleton (`Color.accent`, `Color.bar.active`, `Color.popups.border`, ...).
   IKAI's own modules read those tokens rather than hard-coding hex — see `ito.tomie`'s
   `BarWidget.qml` or `ito.workspaces`'s. The deliberate exception is the per-module `blood`
   setting, meant for the user to tweak; its default is the `paint` stop of the ramp.
2. **Widgets** (`plugins/ito.*`): root `Ui.BarWidget`, button `Ui.WidgetButton`, art at the sizes in
   `docs/ICON_SPEC.md`, paths via `Qt.resolvedUrl(...)` kept relative, settings read through
   `ItoConfig`/`ito-config` rather than through the engine's own `shell.json`.
3. **Dressed clones** (`ito.audio` and the other four): restyled button (`iconComponent` + a mapper
   matching Omarchy's own icon bands), Omarchy's stock panel, logic and IPC underneath.
4. **Persistence.** Two files, two owners:
   - `bar/modules/ito-style.json` — everything the Control Centre changes. Owned by IKAI;
     read/written through `ito-config` or `ItoConfig.qml`.
   - `shell.json` — the bar's shape/position/widget layout. Owned by the engine, which rewrites it
     at runtime the moment a widget is dragged or a popup opens. Never hand-edit it while a shell is
     running; a write can be reverted seconds later. `scripts/shell-switch` swaps
     `shell.<name>.json` files wholesale to change which shell is active, and never touches the
     active file's content.
5. **Named setups.** `bar/modules/bin/ito-profile` copies `ito-style.json`, the bar's part of `shell.json` (and its state entry), and your pictures under `~/.config/ito/profiles/<name>/`, and loads them back with the shell stopped, the way `ito-design` writes layouts.
6. **Repo ↔ live sync.** `scripts/sync.sh` (`pull` captures the live system into the repo, `push`
   deploys the repo onto it, `status` reports drift); `scripts/deploy.sh` wraps `push`: it stops the running shell first (a
   reload while the engine's signature is stale retires the IKAI bar and the engine falls back to another one), copies,
   refreshes the signature and starts one shell, and is the tool to actually use day to day. Neither ever touches
   `shell.json`.

## Runtime rules that matter

- `shell.json` is rewritten by the engine on its own; treat any manual edit to it as temporary.
- QML changes need a shell restart (`bin/ito-restart`) — Omarchy's own hot-reload only covers
  `shell.json`, not the plugin files themselves. `scripts/deploy.sh` does this automatically when it
  detects a QML/JS/JSON change.
- An `Image`'s `source` binding is evaluated even when the `Image` is `visible: false` — guard it
  with a conditional expression when the file might not exist yet, or the log fills with warnings
  for a picture nobody asked to see (see `plugins/ito.tomie/BarWidget.qml`'s seal picture).
- Give every `ColorOverlay`/effect item its own `id` when a property on it needs to be bound to from
  outside a `Loader` — binding to `parent.<prop>` inside a `Loader` does not reliably resolve to the
  delegate you mean.
- Benign warnings, safe to ignore: `qs.*` import warnings from qmllint (it does not know Omarchy's
  own module namespace), `File name case mismatch` on a case-insensitive mount, a duplicate
  `IpcHandler` warning during a hot reload.

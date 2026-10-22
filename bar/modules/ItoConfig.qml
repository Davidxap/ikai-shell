import QtQuick 6.11
import Quickshell
import Quickshell.Io
import qs.Commons as Commons
import "ItoSurfaces.js" as Surfaces
import "ItoMotion.js" as Motion
import "ItoUserArt.js" as UserArt
import "ItoIconMap.js" as IconMap
import "ItoLore.js" as Lore

// Settings that must survive the bar engine, and the colours the shell paints with.
//
// The engine owns shell.json and rewrites it whenever the user drags a module or a popup toggles, so any
// value stored in a layout entry can be reverted under our feet. That is the "the style changes by itself"
// bug: clicking a workspace makes the engine persist its own in-memory layout over ours.
//
// This sidecar lives next to the modules, so nothing but ito-config writes it. FileView watches it, which
// means a change applies live with no shell restart.
//
// COLOUR. The shell and the theme are two different things. By default the shell keeps its own palette
// (bone on ink, with blood as the one live colour), whatever theme is installed. With `colorMode` set to
// "theme" it follows the installed theme instead: blood becomes the theme's accent (or any colour of its
// palette the user picks), bone its foreground, and the pre-drawn art is recoloured by a shader onto both, so
// nothing stays crimson under a green theme.
QtObject {
  id: root

  // Absolute path, no file:// scheme.
  property string path: ""
  property var values: ({})

  function get(key, fallback) {
    var v = root.values[key]
    return (v === undefined || v === null || v === "") ? fallback : v
  }

  // The default is to follow the installed theme, as Shibumi does; the shell's own palette is one choice.
  readonly property bool followTheme: String(get("colorMode", "theme")) === "theme"

  // The installed theme's palette, read from its colors.toml (accent, foreground, color0..color15). This
  // is what the accent picker offers, so the choices are always the colours of the theme in use.
  property var themeColors: ({})
  // sidecar key `paletteGuard` (default off = today's read): a palette read that lacks a colour or fails keeps the previous palette
  readonly property bool paletteGuard: Surfaces.on(root, "paletteGuard")
  property int partialLoads: 0
  property string themeText: ""   // the last colors.toml text parsed (see themeFile.onLoaded)

  // Which of them is the shell's "blood": the theme's accent by default, any of its palette colours, or
  // a colour typed in.
  readonly property string accentSource: String(get("accentSource", "accent"))

  function pickAccent() {
    var src = accentSource
    if (src === "custom") return get("accentCustom", "#c4162a")
    if (src === "ito") return "#c4162a"
    if (src !== "accent" && themeColors[src]) return themeColors[src]
    return themeColors["accent"] || Commons.Color.accent
  }

  // How much light the shell gives off, and how vivid its colours are. Both are 1 when never touched, so
  // nothing changes until the user moves them. `light` scales every glow and bloom (0 is none, 2 is
  // strong); `vibrance` pushes the accent towards a saturated, brighter colour or towards a quieter one.
  readonly property real light: Math.max(0, Math.min(2.5, Number(get("light", 1))))
  readonly property real vibrance: Math.max(0.3, Math.min(2, Number(get("vibrance", 1))))
  readonly property real fxSpeed: Math.max(0.2, Math.min(3, Number(get("fxSpeed", 1))))
  // How the shell moves when things appear: off (instant), calm (short and quiet, the default) or lively (longer
  // and with more travel). `motionAmp` is 0, 1 or 1.7 so a caller only multiplies its own distance and time.
  readonly property string motion: ["off", "calm", "lively"].indexOf(String(get("motion", "calm"))) >= 0
    ? String(get("motion", "calm")) : "calm"
  // The system's reduced-motion preference (GNOME `enable-animations` false), read ONCE at start by `reducedProbe` below; a missing tool
  // or an error means false. `motion: off` stays the manual switch. Reduced is treated as off for every animation, never for functional timers.
  property bool systemReduced: false
  // How long the main opening takes, in ms (sidecar `openDuration`, 150..2400, default 900). `openScale` is that over the 340 ms reference
  // the timelines are written in (ItoPresence.js). It scales the openings only; `motion: off` / reduced motion still win (amp 0 = a cut).
  readonly property int openDuration: Math.max(150, Math.min(2400, Math.round(Number(get("openDuration", 900)) || 900)))
  readonly property real openScale: openDuration / 340
  readonly property real motionAmp: systemReduced || motion === "off" ? 0 : motion === "lively" ? 1.7 : 1
  property Process reducedProbe: Process {
    // one-shot: runs once at startup, exits by itself
    running: true
    command: ["gsettings", "get", "org.gnome.desktop.interface", "enable-animations"]
    stdout: StdioCollector {
      onStreamFinished: {
        root.systemReduced = String(text).trim() === "false"
        Motion.setReduced(root.systemReduced)
      }
    }
  }
  // Room the popups leave above their content for the eye that watches from the top edge (0 with the frame off).
  // what is drawn INSIDE the memory panel's liquid (sidecar key `vesselFill`, S14): blood (the liquid as it is) | whirlpool | hair | rust | static | tone
  readonly property string vesselFill: ["blood", "whirlpool", "hair", "rust", "static", "tone"].indexOf(String(get("vesselFill", "blood"))) >= 0 ? String(get("vesselFill", "blood")) : "blood"
  // the look of the eye at the head of the popups (sidecar key `eyeStyle`): "ink" (today's), "gekiga" (options.md section C1) or "real" (eyes-v2.md)
  // the drawing of the bar's icons (sidecar key `iconStyle`): "current" (the sheet PNGs) or "manga" (icons-v3.md: today's objects as
  // realistic gekiga engravings; for now the six pilot icons: disk, cpu, mem, battery, network, notifications). Rollback: unset.
  // the manga icons' rare omens (sidecar key `iconOmens`, on by default; ART_RULES B6): once in a long while, on a data update,
  // an icon does one small wrong thing (the finger taps the platter, the spiral turns back a notch). Never with motion off.
  readonly property bool iconOmens: get("iconOmens", true) !== false
  // S24: the visible names are Ink (id `manga`) and Relic (id `gothic`); a stored `ink` / `relic` reads as its id, the stored ids stay as they are
  readonly property string iconStyle: { var v = String(get("iconStyle", "current")); v = v === "ink" ? "manga" : v === "relic" ? "gothic" : v
    return ["current", "manga", "gothic"].indexOf(v) >= 0 ? v : "current" }
  // S18: `gothic` (shown as Relic) = your shell asset sheet (recipe relic-sys), an extra style; without its files every icon stays `current`.
  // per-icon style (sidecar key `iconStyleOverrides`, a free string "ai=current, media=manga": family = current | manga | gothic; the model
  // validates it, ItoIconMap.parseOverrides). A family it names keeps that style whatever `iconStyle` says; unset = follow the global style
  // and the families that default to the old drawing (ai, media, indicators, skies: ItoIconMap.DEFAULT_CURRENT).
  readonly property string iconStyleOverrides: String(get("iconStyleOverrides", ""))
  // S17e: the Hollow pack of widget skins (sidecar key `shPack`, off by default): the clock's spiral, the notifications eye, the
  // night light's moth and the low-battery pyramid, cut from your sprite sheet (recipe sprites, hollow/bar/<px>/<name>.png; the old sh/bar/<px>/sp-<name>.png still read).
  // Static pictures only; a widget whose file is missing keeps today's look. Rollback: unset shPack.
  readonly property bool shPack: get("shPack", false) === true
  // per-icon choice (sidecar keys `icon:notifications|clock|nightlight|power`, the Icons chooser on the Icons page): "sh" (shown as Hollow; `hollow` reads the same) = the sprite picture, "original" = today's icon,
  // unset = follow `shPack` (off = original). So an explicit Original beats the pack switch, and the pack stays the "all at once" switch.
  function shChoice(name) {
    var v = String(get("icon:" + name, ""))
    return v === "sh" || v === "hollow" ? true : v === "original" ? false : shPack
  }
  // (T15: the media cassette skin was removed; a stored `icon:media` is retired and read by nothing)
  readonly property var shChoices: ({ notifications: shChoice("notifications"), nightlight: shChoice("nightlight") })
  // how the manga icons are inked (sidecar key `iconTone`, icons-v6-tone.md): "theme" (the default: transparent, tinted by the theme; a
  // `void` is a cut-out and nothing dark is painted behind an icon) or "ink" (today's look, opaque void in the theme background).
  readonly property string iconTone: ["theme", "ink"].indexOf(String(get("iconTone", "theme"))) >= 0 ? String(get("iconTone", "theme")) : "theme"
  // the colour behind a bar icon: the pill laid over the background, or the background lifted by the paper layer (ItoSurfaces.iconSurface)
  readonly property color iconGround: { var s = Surfaces.iconSurface(root, ink, bone); return Qt.rgba(s.r, s.g, s.b, 1) }
  // the eye at the head of the popups (sidecar key `eyeStyle`, S14): "shaded" (drawn in code, the default), or one made from your own sheets: "uzumaki",
  // "lashed", "veined". The old names real, ink and gekiga read as "shaded" for one release (a sidecar written before the rename still works).
  readonly property string eyeStyle: {
    var v = String(get("eyeStyle", "shaded"))
    if (v === "real" || v === "ink" || v === "gekiga") return "shaded"
    return ["shaded", "uzumaki", "lashed", "veined"].indexOf(v) >= 0 ? v : "shaded"
  }
  // what is really drawn: the chosen eye when its files are here (and `userAssets` is on), else "shaded"
  readonly property string eyeFamily: eyeStyle === "shaded" || userEye(eyeStyle, 34) === null ? "shaded" : eyeStyle
  // the files of the user's eye `id` for a box `want` device px high ({ lid, iris, hot, tier, ar, irisAt, blood }) or null
  function userEye(id, want) { return userAssets ? UserArt.eye(userIndex, userFailed, String(id), want, lightGround) : null }
  // which face the real crest eye wears (sidecar key `crestEye`): "auto" (heavy; stare when hot; spiral when critical) or one of the seven archetypes
  // how much the real eyes move (sidecar key `eyeMotion`, eyes-animation.md): "off" (still eyes, exactly the eyes-v2 look), "subtle" (the default: they blink,
  // glance and follow the pointer) or "full" (plus micro-saccades, breathing pupils, a heartbeat, omens). It moves every eye but the shaded one's blink-less still frame.
  // `eyeLevel` is 0, 1 or 2: 0 when motion is off, whatever this says. Reduced motion (system `enable-animations` false) counts as off.
  readonly property string eyeMotion: ["off", "subtle", "full"].indexOf(String(get("eyeMotion", "subtle"))) >= 0 ? String(get("eyeMotion", "subtle")) : "subtle"
  readonly property int eyeLevel: motionAmp <= 0 || eyeMotion === "off" ? 0 : (eyeMotion === "full" ? 2 : 1)
  // how much of the lore pass the system panels show (sidecar key `loreLevel`, lore-pass.md): "off" (the panels as approved:
  // the legacy memo lines, no new marks), "subtle" (state memos, still marks) or "full" (plus motion and lettering). Ships "off".
  readonly property string loreLevel: Lore.level(get("loreLevel", "off"))
  readonly property string crestEye: ["auto", "heavy", "stare", "lidless", "spiral", "weeping", "poly", "slit"].indexOf(String(get("crestEye", "auto"))) >= 0 ? String(get("crestEye", "auto")) : "auto"
  readonly property int panelHeadroom: get("panelFrame", true) !== false ? 26 : 0
  // ...and below it, for the note at the foot and the corner art, so neither lies over a control.
  readonly property int panelFootroom: get("panelFrame", true) !== false ? 24 : 0
  readonly property real fxStrength: Math.max(0.2, Math.min(2.5, Number(get("fxStrength", 1))))

  // Push a colour towards more or less vivid. `c` may be a colour or the "#rrggbb" text the settings file holds: it
  // is turned into a colour first, because a plain string has no hue or saturation and the arithmetic below gave NaN,
  // which paints black. That is what took every accent (and the slider fills) away as soon as Vibrance moved.
  function vivid(c) {
    var col = Qt.color(String(c))
    if (Math.abs(vibrance - 1) < 0.01) return col
    var h = col.hsvHue < 0 ? 0 : col.hsvHue
    var out = Qt.hsva(h, Math.min(1, col.hsvSaturation * vibrance),
                      Math.min(1, col.hsvValue * (0.7 + 0.3 * vibrance)), col.a)
    return isNaN(out.r) ? col : out
  }

  // The colours everything paints with.
  readonly property color blood: vivid(followTheme ? pickAccent() : get("bloodLive", "#c4162a"))
  readonly property color lit: Qt.lighter(blood, 1.18)
  readonly property color bone: followTheme ? (themeColors["foreground"] || Commons.Color.foreground) : "#c7ccd1"
  readonly property color ink: followTheme ? (themeColors["background"] || Commons.Color.background) : "#0b0d0e"

  // The colour of an alert (a reading running hot, an error): the theme's red when it has one, else the accent, and
  // it must still read as red, so a hue further than 35 degrees from red is moved to 355 degrees, keeping saturation
  // and lightness. The same rule as `warn` in bin/ito-lock, so a panel and the lock screen agree.
  function alertRed(c) {
    var col = Qt.color(String(c))
    var deg = col.hslHue < 0 ? 0 : col.hslHue * 360
    if (Math.min(deg, 360 - deg) <= 35) return col
    var out = Qt.hsla(355 / 360, col.hslSaturation, col.hslLightness, col.a)
    return isNaN(out.r) ? col : out
  }
  readonly property color warn: alertRed((followTheme ? themeColors["red"] : "") || blood)

  // Whether the shell is following the theme. When it is, the pre-drawn art (bone and crimson) goes through
  // the theme shader (ItoThemeEffect), which moves it onto the colours above.
  readonly property bool tinted: followTheme

  // The theme's colors.toml. A theme swap changes what the `current` link points at, and a link is not
  // reliably watched, so the shell's own accent changing is the cue to read it again.
  property FileView themeFile: FileView {
    path: Commons.Color.currentThemePath + "/colors.toml"
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: {
      // theme-switch cost: ~27 ItoConfigs each reload on file change, accent change and foreground change; an identical file must not
      // hand every binding a fresh object again (the guard path keeps its own bookkeeping, so it is left alone)
      var raw = text()
      if (!root.paletteGuard && raw === root.themeText) return
      root.themeText = raw
      var out = {}
      var lines = raw.split("\n")
      for (var i = 0; i < lines.length; i++) {
        var m = lines[i].match(/^\s*([A-Za-z0-9_]+)\s*=\s*"(#[0-9A-Fa-f]{6,8})"/)
        if (m) out[m[1]] = m[2]
      }
      // colors.toml names the ANSI palette color0..color15; the picker shows them as color0..color15
      if (root.paletteGuard) {
        // a half-written file keeps the previous palette (visual-systems.md section 2.2)
        var r = Surfaces.acceptPalette(root.themeColors, out, root.partialLoads)
        root.partialLoads = r.partial ? root.partialLoads + 1 : 0
        root.themeColors = r.palette
      } else root.themeColors = out
    }
    onLoadFailed: { if (!root.paletteGuard) { root.themeText = ""; root.themeColors = ({}) } }
  }

  property Connections themeWatch: Connections {
    target: Commons.Color
    function onAccentChanged() { root.themeFile.reload() }
    function onForegroundChanged() { root.themeFile.reload() }
  }

  // Pictures of the user's own that replace a built-in mark of the same name (see bin/ito-marks). The index
  // is written by ito-marks whenever the folder is read.
  property var markOverrides: ({})
  property FileView marksIndex: FileView {
    path: Quickshell.env("HOME") + "/.cache/ito/marks/index.json"
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: {
      try { root.markOverrides = (JSON.parse(text()) || {}).overrides || ({}) } catch (e) { root.markOverrides = ({}) }
    }
    onLoadFailed: root.markOverrides = ({})
  }

  // YOUR OWN ART (decisions-b9 section 6): a PNG at ~/.config/ito/assets/<path under bar/modules/ito-art> replaces the shipped picture.
  // `bin/ito-assets` checks the folder and writes the index below; nothing here polls a folder. `userAssets` (default on) has no effect
  // while the folder is empty. A replacement that fails to load is remembered in `userFailed` and the shipped picture comes back.
  readonly property bool userAssets: get("userAssets", true) !== false
  property var userIndex: ({})
  property var userFailed: ({})
  readonly property var userKinds: !userAssets ? ({}) : UserArt.kinds(userIndex, function (r) {
    var m = IconMap.lookup("bar/modules/ito-art/" + r, true)
    return m ? m.kind : ""
  })
  // a light theme (the background's luminance, as the recipes measure it) shows a `<name>.light.png` twin when the user has one
  readonly property bool lightGround: 0.2126 * ink.r + 0.7152 * ink.g + 0.0722 * ink.b > 0.5
  function userArt(url) { return userAssets ? UserArt.map(userIndex, userFailed, String(url), lightGround) : "" }
  // the user's bar-size picture of a shipped `<dir>/<name>.png` for `want` device pixels: { url, px } or null
  // `def` (optional) overrides markDef for one family (S15b: the Beetle workspaces answer to wsBeetleDef)
  function userBar(base, want, def) { return userAssets ? UserArt.bar(userIndex, userFailed, String(base), want, lightGround, def !== undefined ? String(def) : String(get("markDef", "v9"))) : null }
  // the user's own menu marks (`user:<name>`), and the file of one for `want` device pixels: { url, px } or null
  readonly property var userMarks: userAssets ? UserArt.marks(userIndex) : []
  // every marks/<name>.png the index lists (the reserved names too): a user-backed picker entry (remina, tomie, ...) shows only when its file is here
  readonly property var userMarkNames: userAssets ? UserArt.markNames(userIndex) : []
  // S17c: the beetle answers to `beetleDef` (v12 | v10 | v9) when it is set; unset it follows markDef as before
  function userMark(name, want) { return userAssets ? UserArt.mark(userIndex, userFailed, String(name), want, lightGround, String(name) === "beetle" && ["v12", "v10", "v9"].indexOf(String(get("beetleDef", ""))) >= 0 ? String(get("beetleDef", "")) : String(get("markDef", "v9"))) : null }
  function userFail(url) {
    if (userFailed[url]) return
    var f = ({})
    for (var k in userFailed) f[k] = true
    f[url] = true
    userFailed = f
  }
  property FileView assetsIndex: FileView {
    path: Quickshell.env("HOME") + "/.cache/ito/assets-index.json"
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    // one parse per process, shared by every ItoConfig (UserArt.parseIndex, S12: a copy each made the heap ~1 GB and theme changes stall)
    onLoaded: root.userIndex = UserArt.parseIndex(text())
    onLoadFailed: root.userIndex = ({})
  }
  // one-shot at start: re-read the folder when it exists and changed (a missing folder costs one `test`; `flock -n` lets one instance of
  // the many ItoConfigs do the work). It exits by itself; nothing stays running.
  property Process assetsProbe: Process {
    running: root.path !== ""
    command: ["sh", "-c", "[ -d \"$HOME/.config/ito/assets\" ] || exit 0; exec flock -n /tmp/ito-assets.lock \"$HOME/.config/omarchy/bar/modules/bin/ito-assets\" index --if-stale"]
  }

  property FileView file: FileView {
    path: root.path
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: {
      try {
        root.values = JSON.parse(text()) || ({})
        root.sidecarLoaded = true
      } catch (e) {
        root.values = ({})
      }
    }
    onLoadFailed: root.values = ({})
  }

  // marksVer 2 (S2c), one shot: the mark picker was renamed (remina -> remina-ink, user:remina-real -> remina, user:tomie/beetle/uzumaki-eye -> their own
  // keys). `ito-config migrate-marks` does it in one write and sets marksVer = 2; it never runs again. flock -n: one of the many ItoConfigs does it.
  property bool sidecarLoaded: false
  property Process marksMigration: Process {
    // one-shot: runs only while marksVer < 2, exits by itself
    running: root.sidecarLoaded && String(root.path).slice(-14) === "ito-style.json" && Number(root.get("marksVer", 0)) < 2
    command: ["env", "ITO_STYLE_PATH=" + root.path, "flock", "-n", "/tmp/ito-marks.lock",
              Quickshell.env("HOME") + "/.config/omarchy/bar/modules/bin/ito-config", "migrate-marks"]
  }
}

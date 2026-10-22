.pragma library

// Maps today's icon art paths to a manga icon { kind, state } (icons-v2.md section 4.1), so the shared art components can
// show ItoIconBake instead of the PNG when `iconStyle` is manga: the pilot (disk, cpu, mem, battery, network,
// notifications) and the batches of icons-v3 V4 (audio, ...). Anything else returns null and the PNG is used, unchanged.
//   lookup(source, tintable)  source: a url or path string; tintable false (a user's own picture) never maps
// User pictures and user marks never map: `tintable: false`, ~/.cache/ito/marks/, ~/.config/ito/marks, and any path
// that is not inside the shell's own art folders.

var SYSTEM = {
  "system/disk.png": { kind: "disk", state: {}, level: true },
  "system/cpu.png": { kind: "cpu", state: {}, level: true },
  "system/mem.png": { kind: "mem", state: {}, level: true }
}
var NOTIFY = {
  "notification": "idle", "notification-active": "active", "notification-error": "error", "notification-muted": "muted",
  "notification-dnd": "dnd", "notification-critical": "critical", "notification-ring": "ring"
}
// panel-side battery and wifi pictures (plugins' assets/ and their copies in ito-art/battery, ito-art/network)
var BATTERY = { "battery-critical": { level: 0, critical: true }, "battery-low": { level: 1 }, "battery-25": { level: 1 },
                "battery-50": { level: 2 }, "battery-75": { level: 3 }, "battery-full": { level: 4 } }
var WIFI = { "wifi-off": { off: true }, "wifi-weak": { band: 1 }, "wifi-connecting": { band: 2 }, "wifi": { band: 3 } }

var IND_VERSIONS = ["coffee", "radio", "flashlight", "moon", "fog", "eye", "tape"]
var IND_IDS = { coffee: "awake", radio: "awake", flashlight: "awake", moon: "night", fog: "night", eye: "record", tape: "record" }
var SKIES = ["sun", "moon", "cloud", "suncloud", "rain", "storm", "snow", "fog"]
var MEDIA = ["prev", "play", "pause", "next", "stop", "shuffle", "repeat"]
function clone(o) { var r = {}; for (var k in o) r[k] = o[k]; return r }

// The part of `source` after the shell's art root, or "" when it is not shell art.
function relative(s) {
  var m = s.match(/(?:^|\/)bar\/modules\/ito-art\/(.+)$/) || s.match(/(?:^|\/)ito-assets\/(.+)$/)
  if (m) return m[1]
  var p = s.match(/(?:^|\/)plugins\/(ito\.(?:power|network))\/assets\/([^\/]+)$/)
  if (p) return (p[1] === "ito.power" ? "battery/" : "network/") + p[2]
  // V5-DUP (icons-v5.md section 7): the audio, bluetooth and display plugins' own copies of their pictures
  var d = s.match(/(?:^|\/)plugins\/ito\.(audio|bluetooth|display)\/assets\/([^\/]+)$/)
  if (d) return (d[1] === "display" ? "brightness/" : d[1] + "/") + d[2]
  return ""
}

function lookup(source, tintable) {
  var m0
  if (tintable === false || source === undefined || source === null) return null
  var s = String(source).split("?")[0]
  if (s === "" || /\/\.cache\/ito\/marks\//.test(s) || /\/\.config\/ito\/marks/.test(s)) return null
  var rel = relative(s)
  if (rel === "") return null
  // the AI forms (aiStyle): a level icon, like the disk
  if ((m0 = rel.match(/^system\/(?:ai-(classic|hemispheres|neurons|eye|spiral)|(brain))\.png$/))) return { kind: "ai", state: { form: m0[1] || m0[2] }, level: true }
  if (SYSTEM[rel]) return { kind: SYSTEM[rel].kind, state: clone(SYSTEM[rel].state), level: true }
  var m
  if ((m = rel.match(/^notifications\/(notification(?:-[a-z]+)?)\.png$/)) && NOTIFY[m[1]]) return { kind: "notifications", state: { face: NOTIFY[m[1]] } }
  if ((m = rel.match(/^instruments\/bat-([0-4])\.png$/))) return { kind: "battery", state: { level: +m[1] } }
  if ((m = rel.match(/^instruments\/bat-charge-([1-4])\.png$/))) return { kind: "battery", state: { level: +m[1], charging: true } }
  if ((m = rel.match(/^instruments\/net-([0-3])\.png$/))) return { kind: "network", state: { band: +m[1] } }
  if (rel === "instruments/net-off.png") return { kind: "network", state: { off: true } }
  if (rel === "instruments/net-wired.png") return { kind: "network", state: { wired: true } }
  // batch 2 (icons-v3 V4): audio
  if ((m = rel.match(/^instruments\/vol-([0-3])\.png$/))) return { kind: "audio", state: { level: +m[1] } }
  if (rel === "instruments/vol-mute.png") return { kind: "audio", state: { mute: true } }
  if ((m = rel.match(/^instruments\/display-([0-3])\.png$/))) return { kind: "display", state: { level: +m[1] } }
  if ((m = rel.match(/^instruments\/bt-(off|on|linked)\.png$/))) return { kind: "bluetooth", state: { mode: m[1] } }
  // V5-DUP: the panel duplicates (audio/ 4, bluetooth/ 3, brightness/ 2) are the same pictures as the bar's, so they map to the same kinds
  // and follow the family's style; a level is the band the panel picks (low / mid / high), a "connecting" adapter is the enabled one
  if ((m = rel.match(/^audio\/volume(?:-(high|low|muted))?\.png$/))) return { kind: "audio", state: m[1] === "muted" ? { mute: true } : { level: m[1] === "high" ? 3 : (m[1] === "low" ? 1 : 2) } }
  if ((m = rel.match(/^bluetooth\/bluetooth(?:-(connecting|off))?\.png$/))) return { kind: "bluetooth", state: { mode: m[1] === "off" ? "off" : (m[1] === "connecting" ? "on" : "linked") } }
  if ((m = rel.match(/^brightness\/brightness-(high|low)\.png$/))) return { kind: "display", state: { level: m[1] === "high" ? 3 : 1 } }
  // batch S6 (icons-v4.md section 2): the media buttons. pause is the face shown WHILE playing; shuffle and repeat are the bare marks
  if ((m = rel.match(/^media\/media-(prev|play|pause|next|stop|shuffle|repeat)\.png$/))) {
    var mf = m[1], ms = { face: mf }
    if (mf === "pause") ms.playing = true
    else if (mf === "shuffle") ms.on = false
    else if (mf === "repeat") ms.loop = "playlist"
    return { kind: "media", state: ms }
  }
  // batch S7 (icons-v4.md section 3): the indicators, 3 ids x versions x off / on
  if ((m = rel.match(/^indicators\/(awake|night|record)-([a-z]+)-(on|off)\.png$/)) && IND_VERSIONS.indexOf(m[2]) >= 0) return { kind: "indicator", state: { id: m[1], version: m[2], on: m[3] === "on" } }
  // batch S8 (icons-v4.md section 4): the weather skies
  if ((m = rel.match(/^instruments\/sky-(sun|moon|cloud|suncloud|rain|storm|snow|fog)\.png$/))) return { kind: "sky", state: { sky: m[1] } }
  if (rel === "system/tray-chevron.png") return { kind: "chevron", state: {} }
  if ((m = rel.match(/^battery\/([a-z0-9-]+)\.png$/)) && BATTERY[m[1]]) return { kind: "battery", state: clone(BATTERY[m[1]]) }
  if ((m = rel.match(/^network\/([a-z-]+)\.png$/)) && WIFI[m[1]]) return { kind: "network", state: clone(WIFI[m[1]]) }
  return null
}

// ---- the style per icon family (the user's rule: a family is the manga default only where it is clearly better than the old drawing)
// `iconStyleOverrides` is a free string "ai=current, media=manga" (family = style); a family it names takes that style whatever the
// global `iconStyle` says (so one icon can stay in the old style while the rest is manga, or opt in while the rest is current);
// otherwise the global style applies, except for the families that default to the old drawing (DEFAULT_CURRENT).
var FAMILIES = ["disk", "cpu", "mem", "battery", "network", "notifications", "audio", "display", "bluetooth", "tray", "ai", "media", "indicator", "sky"]
var FAMILY = { chevron: "tray" }
// (the acceptance table in dev/openspec/changes/ito-shell-inspiration/tasks.md: only the families that are clearly better than the old drawing
// in the A/B at the bar's size are manga by default; network and notifications wait for their light-bar re-weighting; the user flips any of them)
var DEFAULT_CURRENT = { mem: true, display: true, tray: true, network: true, notifications: true, battery: true, bluetooth: true, audio: true, ai: true, media: true, indicator: true, sky: true }
function familyOf(kind) { return FAMILY[kind] || kind }
// "ai=current, media=manga" -> { ai: "current", media: "manga" }; anything that is not a known family or style is dropped
function parseOverrides(str) {
  var out = {}
  if (typeof str !== "string") return out
  var parts = str.split(",")
  for (var i = 0; i < parts.length && i < 40; i++) {
    var kv = parts[i].split("=")
    if (kv.length !== 2) continue
    var f = kv[0].trim().toLowerCase(), v = kv[1].trim().toLowerCase()
    v = v === "ink" ? "manga" : v === "relic" ? "gothic" : v          // S24: the visible names read as their ids
    if (FAMILIES.indexOf(f) >= 0 && (v === "current" || v === "manga" || v === "gothic")) out[f] = v
  }
  return out
}
function formatOverrides(o) {
  var parts = []
  for (var i = 0; i < FAMILIES.length; i++) if (o && o[FAMILIES[i]]) parts.push(FAMILIES[i] + "=" + o[FAMILIES[i]])
  return parts.join(",")
}
function styleFor(globalStyle, overrides, kind) {
  var f = familyOf(kind), o = typeof overrides === "string" ? parseOverrides(overrides) : (overrides || {})
  if (o[f]) return o[f]
  if (globalStyle === "gothic") return GOTHIC_DEFAULT[f] ? "gothic" : "current"
  return globalStyle === "manga" && !DEFAULT_CURRENT[f] ? "manga" : "current"
}
// ---- S18 `iconStyle gothic` (master-plan-v4 18a): the user's shell asset sheet, cut by `ito-assets recipe relic-sys` into
// relic/sys/bar/<px>/<file>.png of the assets folder (the old gothic/sys/ files still read). It is an EXTRA style: the global `gothic` turns on only the families below (ai
// stays `current` unless `ai=gothic` is set, as for manga); a family can also take it through `iconStyleOverrides`.
var GOTHIC_DEFAULT = { network: true, cpu: true, battery: true, audio: true, bluetooth: true, display: true, tray: true, indicator: true }
var GOTHIC_TIERS = [24, 26, 28, 30, 32, 36, 40, 44, 48, 56, 64]
// the smallest tier an icon survives at (gpu: two fans turn to mush; ai: a blob): below it the icon is null and the caller keeps `current`
var GOTHIC_FLOOR = { gpu: 32, ai: 30 }
var GOTHIC_KINDS = { network: "network", cpu: "cpu", battery: "battery", audio: "audio", bluetooth: "bluetooth", display: "display", ai: "ai" }
// the gothic picture of `source`: { icon, file } (file = `<icon>[-<state>]`) or null (unknown, or a state the sheet does not draw: wired, charging)
function gothicIcon(source, tintable) {
  if (tintable === false) return null
  var s = String(source === undefined || source === null ? "" : source).split("?")[0], rel = relative(s)
  if (rel === "") return null
  if (rel === "system/tray.png") return { icon: "tray", file: "tray" }
  var m = lookup(source, tintable)
  if (!m) return null
  var st = m.state || {}, k = m.kind
  if (k === "cpu") return { icon: "cpu", file: "cpu" }
  if (k === "ai") return { icon: "ai", file: "ai" }
  if (k === "network") {
    if (st.wired) return null
    return { icon: "network", file: st.off ? "network-off" : "network-" + Math.max(0, Math.min(3, st.band === undefined ? 3 : st.band)) }
  }
  if (k === "battery") {
    if (st.charging) return null
    return { icon: "battery", file: "battery-" + Math.max(0, Math.min(4, st.level === undefined ? 4 : st.level)) }
  }
  if (k === "audio") return { icon: "audio", file: st.mute ? "audio-mute" : "audio-" + Math.max(0, Math.min(3, st.level === undefined ? 2 : st.level)) }
  if (k === "display") return { icon: "display", file: "display-" + Math.max(0, Math.min(3, st.level === undefined ? 3 : st.level)) }
  if (k === "bluetooth") return { icon: "bluetooth", file: "bluetooth-" + (st.mode === "linked" ? "linked" : st.mode === "off" ? "off" : "on") }
  if (k === "indicator" && st.id === "night") return { icon: "night", file: st.on ? "night-on" : "night-off" }
  return null
}
// the nearest gothic tier for `px` device pixels, or 0 when px is outside 24..64 by more than 15 %
function gothicTier(px) {
  var w = Math.max(1, Math.round(Number(px) || 0)), best = 0
  for (var i = 0; i < GOTHIC_TIERS.length; i++) if (best === 0 || Math.abs(GOTHIC_TIERS[i] - w) < Math.abs(best - w)) best = GOTHIC_TIERS[i]
  if (w < GOTHIC_TIERS[0] * 0.85 || w > GOTHIC_TIERS[GOTHIC_TIERS.length - 1] * 1.15) return 0
  return best
}
// `relic/sys/<file>.png` (the base ItoUserArt.bar turns into `relic/sys/bar/<px>/<file>[.light].png`, or the old gothic/sys/ file) when this source is drawn gothic, else ""
function gothicBase(globalStyle, overrides, source, tintable) {
  var g = gothicIcon(source, tintable)
  if (!g) return ""
  var fam = g.icon === "night" ? "indicator" : g.icon          // night is the indicator family
  return styleFor(globalStyle, overrides, fam) === "gothic" ? "relic/sys/" + g.file + ".png" : ""
}
// `relic/sys/bar/<px>/<file>.png` for a source and a device size, or null below the icon's floor / outside the tiers (the light twin is the caller's)
function gothic(source, px, tintable) {
  var g = gothicIcon(source, tintable)
  if (!g) return null
  var t = gothicTier(px)
  if (t === 0 || t < (GOTHIC_FLOOR[g.icon] || 0)) return null
  return "relic/sys/bar/" + t + "/" + g.file + ".png"
}
// the gothic file name when a base from gothicBase is given instead of a source (the same floor rule)
function gothicFor(base, px) {
  var m = /^(?:relic|gothic)\/sys\/([a-z]+)(?:-[a-z0-9]+)?\.png$/.exec(String(base))
  if (!m) return null
  var t = gothicTier(px)
  if (t === 0 || t < (GOTHIC_FLOOR[m[1]] || 0)) return null
  return String(base).replace(/^(?:relic|gothic)\/sys\//, "relic/sys/bar/" + t + "/")
}

// ---- S17e `shPack` (ItoConfig.shPack): the Hollow widget skins cut from the user's sprite sheet (recipe sprites, hollow/bar/<px>/<file>.png of
// the assets folder). Only pictures whose state the skin can still say: the notifications eye (4 faces) and the night light's moth. Anything
// else (and every source while shPack is off) is "": the picture stays as it is. (T15, S21: the media play/pause cassette was removed at the
// user's request, "elimina el de media que tiene cassete en el play"; a stored `icon:media` is retired and the media icon keeps its drawing.)
var SH_NOTIFY = { idle: "eye-idle", active: "eye-open", ring: "eye-open", error: "eye-alert", critical: "eye-alert", muted: "eye-shut", dnd: "eye-shut" }
// `on` is true (every skin), or the per-icon choice { notifications, nightlight } (ItoConfig.shChoices: each true = Hollow, false = the original icon)
function shBase(on, source, tintable) {
  if (on !== true && !(on && typeof on === "object")) return ""
  var all = on === true
  var m = lookup(source, tintable)
  if (!m) return ""
  var st = m.state || {}
  if (m.kind === "notifications" && SH_NOTIFY[st.face] && (all || on.notifications === true)) return "hollow/" + SH_NOTIFY[st.face] + ".png"
  if (m.kind === "indicator" && st.id === "night" && (all || on.nightlight === true)) return "hollow/moth-" + (st.on ? "on" : "off") + ".png"
  return ""
}

// ---- T15 (S21): the Icons chooser (cc/PageWidgets.qml, section ICONS). One row per bar icon, 2-4 cards: "original" (the old inked
// drawing exactly as it was), "manga" (shown Ink), "gothic" (shown Relic; only with your shell asset sheet), "sh" (shown Hollow: a skin from your sprites), or for
// the indicators their versions ("v:<key>", the first version is the Original). Every choice is written through the existing keys:
// `iconStyleOverrides` (family=current|manga|gothic) and `icon:<name>`; nothing new, and nothing is written until the user picks.
var GOTHIC_FAMILIES = { network: true, cpu: true, battery: true, audio: true, bluetooth: true, display: true, tray: true, ai: true, indicator: true }
var SH_KEYS = ["notifications", "clock", "nightlight", "power"]
var VERSION_IDS = ["awake", "night", "record"]
var ROWS = [
  { id: "audio", name: "Audio", family: "audio", art: "instruments/vol-2.png" },
  { id: "network", name: "Network", family: "network", art: "instruments/net-3.png" },
  { id: "bluetooth", name: "Bluetooth", family: "bluetooth", art: "instruments/bt-on.png" },
  { id: "battery", name: "Battery", family: "battery", art: "instruments/bat-3.png" },
  { id: "power", name: "Low battery", sh: "power", shArt: "pyramid", art: "instruments/bat-1.png" },
  { id: "display", name: "Display", family: "display", art: "instruments/display-2.png" },
  { id: "notifications", name: "Notifications", family: "notifications", sh: "notifications", shArt: "eye-idle", art: "notifications/notification.png" },
  { id: "cpu", name: "CPU", family: "cpu", art: "system/cpu.png" },
  { id: "mem", name: "Memory", family: "mem", art: "system/mem.png" },
  { id: "disk", name: "Disk", family: "disk", art: "system/disk.png" },
  { id: "ai", name: "AI usage", family: "ai", art: "ai" },
  { id: "media", name: "Media", family: "media", art: "media/media-play.png" },
  { id: "tray", name: "Tray", family: "tray", art: "system/tray-chevron.png", gothicArt: "system/tray.png" },
  { id: "weather", name: "Weather", family: "sky", art: "instruments/sky-suncloud.png" },
  { id: "clock", name: "Clock", sh: "clock", shArt: "spiral" },
  { id: "indicators", name: "Indicators", family: "indicator", art: "indicator" },
  { id: "awake", name: "Stay awake", versions: "awake" },
  { id: "night", name: "Night light", versions: "night", sh: "nightlight", shArt: "moth-on" },
  { id: "record", name: "Recording", versions: "record" }
]
var STYLE_NAMES = { original: "Original", manga: "Ink", gothic: "Relic", sh: "Hollow" }     // S24: visible names; the ids stay
// the cards of a row. has: { gothic: the gothic sheet is there, sh: the sprite skins are there, px: the bar icon's device px };
// versions: the indicator's versions the user can have (ItoIcons, already filtered by `available`)
function options(row, has, versions) {
  var h = has || {}, out = []
  if (row.versions) {
    var vs = versions || []
    for (var i = 0; i < vs.length; i++) out.push({ key: "v:" + vs[i].key, name: i === 0 ? "Original" : vs[i].name })
  } else {
    out.push({ key: "original", name: "Original" })
    if (row.family) {
      out.push({ key: "manga", name: STYLE_NAMES.manga })
      if (h.gothic && GOTHIC_FAMILIES[row.family] && !(row.family === "ai" && Number(h.px) > 0 && Number(h.px) < GOTHIC_FLOOR.ai)) out.push({ key: "gothic", name: STYLE_NAMES.gothic })
    }
  }
  if (row.sh && h.sh) out.push({ key: "sh", name: STYLE_NAMES.sh })
  return out
}
// the card that is on now. ctx: { style: iconStyle, overrides: iconStyleOverrides, sh(name) -> bool (ItoConfig.shChoice), version(id) -> key }
function selected(row, ctx) {
  if (row.sh && ctx.sh && ctx.sh(row.sh) === true) return "sh"
  if (row.versions) return "v:" + ctx.version(row.versions)
  if (!row.family) return "original"
  var st = styleFor(ctx.style, ctx.overrides, row.family)
  return st === "current" ? "original" : st
}
// what picking `key` on `row` writes: { key: value } for one `setmany` (an explicit "original" so a later pack switch cannot override it)
function pick(row, key, ctx) {
  var out = {}
  if (row.sh) out["icon:" + row.sh] = key === "sh" ? "sh" : "original"
  if (key === "sh") return out
  if (row.versions && key.indexOf("v:") === 0) out["icon:" + row.versions] = key.slice(2)
  if (row.family) {
    var o = parseOverrides(ctx.overrides)
    o[row.family] = key === "original" ? "current" : key
    out.iconStyleOverrides = formatOverrides(o)
  }
  return out
}
// every row at once: mode "original" (the old drawing everywhere, the first version of each indicator) or a style ("manga", "gothic": each
// family that has it, the others Original; the Silent Hill skins off; the indicator versions are left as they are)
function pickAll(mode, ctx, has, firstVersion) {
  var o = parseOverrides(ctx.overrides), out = {}
  for (var i = 0; i < ROWS.length; i++) {
    var r = ROWS[i]
    if (r.sh) out["icon:" + r.sh] = "original"
    if (r.versions && mode === "original" && firstVersion) out["icon:" + r.versions] = firstVersion(r.versions)
    if (!r.family) continue
    var ok = mode === "manga" || (mode === "gothic" && has && has.gothic && GOTHIC_FAMILIES[r.family])
    o[r.family] = mode !== "original" && ok ? mode : "current"
  }
  out.iconStyleOverrides = formatOverrides(o)
  return out
}
// the style the "Use ... for all" button applies: the global style, or Manga while the global style is the old drawing
function allStyle(globalStyle) { return globalStyle === "gothic" ? "gothic" : "manga" }
// the keys the chooser writes (the Undo snapshot)
function chooserKeys() {
  var k = ["iconStyleOverrides"]
  for (var i = 0; i < SH_KEYS.length; i++) k.push("icon:" + SH_KEYS[i])
  for (var j = 0; j < VERSION_IDS.length; j++) k.push("icon:" + VERSION_IDS[j])
  return k
}

// the manga picture for `source` when its family is drawn manga (by the global style, the family default or an override), else null
function drawn(globalStyle, overrides, source, tintable) {
  if (globalStyle !== "manga" && !overrides) return null
  var m = lookup(source, tintable)
  return m && styleFor(globalStyle, overrides, m.kind) === "manga" ? m : null
}

// Every art name the pilot maps (for the coverage test), relative to the art root.
function pilotNames() {
  var out = Object.keys(SYSTEM)
  for (var n in NOTIFY) out.push("notifications/" + n + ".png")
  for (var b = 0; b <= 4; b++) out.push("instruments/bat-" + b + ".png")
  for (var c = 1; c <= 4; c++) out.push("instruments/bat-charge-" + c + ".png")
  for (var w = 0; w <= 3; w++) out.push("instruments/net-" + w + ".png")
  out.push("instruments/net-off.png", "instruments/net-wired.png")
  for (var x in BATTERY) out.push("battery/" + x + ".png")
  for (var y in WIFI) out.push("network/" + y + ".png")
  for (var v = 0; v <= 3; v++) out.push("instruments/vol-" + v + ".png")
  out.push("instruments/vol-mute.png")
  for (var d = 0; d <= 3; d++) out.push("instruments/display-" + d + ".png")
  out.push("instruments/bt-off.png", "instruments/bt-on.png", "instruments/bt-linked.png", "system/tray-chevron.png")
  out.push("audio/volume.png", "audio/volume-high.png", "audio/volume-low.png", "audio/volume-muted.png")
  out.push("bluetooth/bluetooth.png", "bluetooth/bluetooth-connecting.png", "bluetooth/bluetooth-off.png")
  out.push("brightness/brightness-high.png", "brightness/brightness-low.png")
  for (var mi = 0; mi < MEDIA.length; mi++) out.push("media/media-" + MEDIA[mi] + ".png")
  for (var ii = 0; ii < IND_VERSIONS.length; ii++) { out.push("indicators/" + IND_IDS[IND_VERSIONS[ii]] + "-" + IND_VERSIONS[ii] + "-on.png"); out.push("indicators/" + IND_IDS[IND_VERSIONS[ii]] + "-" + IND_VERSIONS[ii] + "-off.png") }
  for (var si = 0; si < SKIES.length; si++) out.push("instruments/sky-" + SKIES[si] + ".png")
  out.push("system/brain.png", "system/ai-classic.png", "system/ai-hemispheres.png", "system/ai-neurons.png", "system/ai-eye.png", "system/ai-spiral.png")
  return out
}

if (typeof module !== "undefined") module.exports = { ROWS: ROWS, GOTHIC_FAMILIES: GOTHIC_FAMILIES, SH_KEYS: SH_KEYS, STYLE_NAMES: STYLE_NAMES, options: options, selected: selected, pick: pick, pickAll: pickAll, allStyle: allStyle, chooserKeys: chooserKeys, shBase: shBase, SH_NOTIFY: SH_NOTIFY, gothic: gothic, gothicBase: gothicBase, gothicFor: gothicFor, gothicIcon: gothicIcon, gothicTier: gothicTier, GOTHIC_FLOOR: GOTHIC_FLOOR, GOTHIC_DEFAULT: GOTHIC_DEFAULT, lookup: lookup, pilotNames: pilotNames, FAMILIES: FAMILIES, DEFAULT_CURRENT: DEFAULT_CURRENT, parseOverrides: parseOverrides, formatOverrides: formatOverrides, styleFor: styleFor, drawn: drawn, familyOf: familyOf }

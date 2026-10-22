.pragma library

// The Styles page's index (visual-v3.md section 4). Pure: the page builds its cards from these lists, the other pages ask `found(query)` to say
// "Found on Styles" when a search matches something that moved there. Every key here is a sidecar key that `bin/ito-config` validates.

// what an unset key means, so a preset card can tell whether it is the current one and Undo can restore what was there
var DEFAULTS = {
  panelFrame: true, frameStyle: "manga", frameArt: "png",
  presence: true, presenceReveal: "none", presenceShoulders: false, presenceSwitch: "morph",
  surfaceWorld: "off",
  eyeMotion: "subtle", vesselFill: "blood", loreLevel: "off", eyeStyle: "shaded",
  fxPlate: true, fxGlass: false, fxPaper: false, fxBlood: false, fxWood: false, fxTone: false, fxGrain: true, fxBorder: true,
  fxPills: false, fxTorn: false, fxFog: false, fxFogDrift: false, bloodSeep: false
}

// the bar's plate layers (ItoSurfaces `fx*` flags) every preset sets explicitly, so switching presets leaves nothing of the last one behind
var BAR_PLAIN = { fxPlate: true, fxGlass: false, fxPaper: false, fxBlood: false, fxWood: false, fxTone: false, fxGrain: true, fxBorder: true,
                  fxPills: false, fxTorn: false, fxFog: false, fxFogDrift: false, bloodSeep: false }
// S13e: the plate recipe "Uzumaki" moved here (paper + spiral wood), so Bars keeps one "Uzumaki": this preset
var BAR_MANGA = { fxPlate: true, fxGlass: false, fxPaper: true, fxBlood: false, fxWood: true, fxTone: true, fxGrain: true, fxBorder: true,
                  fxPills: false, fxTorn: true, fxFog: false, fxFogDrift: false, bloodSeep: false }
var BAR_OTHERWORLD = { fxPlate: true, fxGlass: false, fxPaper: false, fxBlood: false, fxWood: false, fxTone: false, fxGrain: true, fxBorder: true,
                       fxPills: false, fxTorn: true, fxFog: false, fxFogDrift: false, bloodSeep: false }
function withBar(bar, values) { var o = {}; for (var k in values) o[k] = values[k]; for (var b in bar) o[b] = bar[b]; return o }

// the four presets (visual-v3 section 4.3; the seal, seal effect, menu mark and main menu columns come with the seals slice). Never colours, icons, layout or the user's art.
var PRESETS = [
  { key: "quiet", name: "Quiet", note: "A single quiet rule, no opening animation, a bare bar. The calmest the shell gets.", frameStyle: "minimal", frameArt: "png",
    values: withBar(BAR_PLAIN, { panelFrame: true, frameStyle: "minimal", frameArt: "png", presence: true, presenceReveal: "none", presenceShoulders: false, presenceSwitch: "morph",
              surfaceWorld: "off", eyeMotion: "subtle", vesselFill: "blood", loreLevel: "off" }) },
  { key: "silenthill", name: "Fog town", note: "Iron chains and drawn art, fog on the bar, a static opening, rusted water in the vessel.", frameStyle: "chains", frameArt: "drawn",
    values: withBar(BAR_PLAIN, { panelFrame: true, frameStyle: "chains", frameArt: "drawn", presence: true, presenceReveal: "static", presenceShoulders: false, presenceSwitch: "morph",
              surfaceWorld: "fog", eyeMotion: "subtle", vesselFill: "rust", loreLevel: "subtle" }) },
  { key: "uzumaki", name: "Uzumaki", note: "The manga look: printed-paper bar with halftone, grain and a torn edge, the drawn manga frame, a spiral opening, your Uzumaki eye, a whirlpool in the vessel.", frameStyle: "manga", frameArt: "drawn",
    values: withBar(BAR_MANGA, { panelFrame: true, frameStyle: "manga", frameArt: "drawn", presence: true, presenceReveal: "spiral", presenceShoulders: false, presenceSwitch: "morph",
              surfaceWorld: "off", eyeMotion: "subtle", eyeStyle: "uzumaki", vesselFill: "whirlpool", loreLevel: "subtle" }) },
  { key: "otherworld", name: "Otherworld", note: "Rust, barbed wire and grating on the popups and the bar, a blot opening with shoulders, the eyes moving at full, a dying picture in the vessel.", frameStyle: "otherworld", frameArt: "drawn",
    values: withBar(BAR_OTHERWORLD, { panelFrame: true, frameStyle: "otherworld", frameArt: "drawn", presence: true, presenceReveal: "blot", presenceShoulders: true, presenceSwitch: "morph",
              surfaceWorld: "rust", eyeMotion: "full", vesselFill: "static", loreLevel: "full" }) }
]

// every key Reset styles unsets (the presets' keys plus eyeStyle)
var RESET_KEYS = ["panelFrame", "frameStyle", "frameArt", "presence", "presenceReveal", "presenceShoulders", "presenceSwitch", "surfaceWorld",
                  "eyeMotion", "vesselFill", "loreLevel", "eyeStyle",
                  "fxPlate", "fxGlass", "fxPaper", "fxBlood", "fxWood", "fxTone", "fxGrain", "fxBorder", "fxPills", "fxTorn", "fxFog", "fxFogDrift", "bloodSeep"]

function norm(v) { return String(v) }

// does the sidecar match every key of a preset? `get(key, fallback)` is the shell config's
function matches(preset, get) {
  for (var k in preset.values) if (norm(get(k, DEFAULTS[k])) !== norm(preset.values[k])) return false
  return true
}
// the preset the sidecar is on, or null ("Custom")
function current(get) {
  for (var i = 0; i < PRESETS.length; i++) if (matches(PRESETS[i], get)) return PRESETS[i].key
  return null
}
// what Undo needs: the value of every key of a preset right now, null where unset
function snapshot(preset, get) {
  var s = {}
  for (var k in preset.values) { var v = get(k, null); s[k] = v === undefined ? null : v }
  return s
}
// split a snapshot into what to set and what to unset
function restore(snap) {
  var set = {}, unset = []
  for (var k in snap) { if (snap[k] === null) unset.push(k); else set[k] = snap[k] }
  return { set: set, unset: unset }
}

// the search index of the page: the controls that live here, for "Found on Styles" on the other pages
var ENTRIES = [
  { section: "FRAME", name: "Popup frame", words: "frame border popup card chains panel manga minimal otherworld plain drawn art png" },
  { section: "OPENING", name: "Opening animation", words: "opening reveal animation spiral blot lid eyelid morph shoulders grow icon" },
  { section: "LOOK", page: "bars", name: "Bar world", words: "bar world rust fog flesh blood seep cage" },
  { section: "EYES", name: "Eyes", words: "eye eyes motion shaded uzumaki inked lashed veined blink" },
  { section: "MEMORY LIQUID", name: "Memory liquid", words: "liquid memory ram vessel blood whirlpool hair rust static screentone tone" },
  { section: "LORE", name: "Lore", words: "lore story notes memo" },
  { section: "PRESETS", name: "Presets", words: "preset theme look combination quiet fog town silent hill uzumaki otherworld" }
]
function found(query) {
  var q = String(query || "").toLowerCase().trim()
  if (q === "") return null
  for (var i = 0; i < ENTRIES.length; i++) {
    var e = ENTRIES[i]
    if ((e.name + " " + e.words + " " + e.section).toLowerCase().indexOf(q) >= 0) return e
  }
  return null
}

if (typeof module !== "undefined" && module.exports) module.exports = { DEFAULTS: DEFAULTS, PRESETS: PRESETS, RESET_KEYS: RESET_KEYS, BAR_MANGA: BAR_MANGA, matches: matches, current: current,
  snapshot: snapshot, restore: restore, ENTRIES: ENTRIES, found: found }

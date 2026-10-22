.pragma library

// What the bar's plate is made of.
//
// There is no "pick a style" here, on purpose. The plate is black, and every layer that makes it
// Ito is independent: smoked glass and manga paper can sit together, blood can run through either,
// the wood grain can be laid over all of it. A layer is one sidecar flag (`fx*`) and, where it has a
// strength, one tuning key (`surface*`). PRESETS are only shortcuts that set several flags at once.

var layers = [
  { flag: "fxPlate",  name: "Plate",         note: "The black plate itself. Off leaves only the icons floating on the desktop." },
  { flag: "fxGlass",  name: "Smoked glass",  note: "Makes the plate translucent, so the wallpaper shows through it darkened." },
  { flag: "fxPaper",  name: "Print paper",   note: "A hair off pure black, with press dirt on it, like a printed page." },
  { flag: "fxBlood",  name: "Blood",         note: "Blood veins spreading through the plate, from the design sheet." },
  { flag: "fxWood",   name: "Uzumaki grain", note: "Wood grain winding into spiral knots, kept to the ends of the bar." },
  { flag: "fxTone",   name: "Screentone",    note: "The manga halftone screen laid over everything." },
  { flag: "fxGrain",  name: "Grain",         note: "Fine dirt over the whole plate." },
  { flag: "fxCalm",   name: "Calm centre",   note: "Darkens the middle so readings stay legible over blood and grain." },
  { flag: "fxPills",  name: "Widget pills",  note: "Every widget sits in its own dark pill, like Shibumi. Makes the Floating look readable." },
  { flag: "fxBorder", name: "Border",        note: "A pale line drawn around the plate." },
  { flag: "fxTorn",   name: "Torn edge",     note: "The border reads as hand-torn paper instead of a ruled line. Needs Border on." },
  { flag: "fxFog",    name: "Fog",           note: "Silent Hill's fog, two still wisps laid across the plate, faint enough to read as atmosphere." },
  { flag: "fxFogDrift", name: "Fog drift",  note: "Lets the fog drift slowly. Costs a little idle CPU; needs Fog on." }
]

// What is on when the user has never said otherwise: a clean black plate with a little dirt.
var defaults = {
  fxPlate: true, fxGlass: false, fxPaper: false, fxBlood: false, fxWood: false,
  fxTone: false, fxGrain: true, fxCalm: true, fxBorder: true, fxPills: false, fxTorn: false, fxFog: false, fxFogDrift: false,
  pressBleed: false, bloodSeep: false,
  formParity: true, dockFloat: true,
  surfaceWorld: "off"
}

var presets = [
  { key: "clean", name: "Clean ink", note: "Plain black plate, a little dirt, the pale border.",
    set: { fxPlate: true, fxGlass: false, fxPaper: false, fxBlood: false, fxWood: false,
           fxTone: false, fxGrain: true, fxCalm: true, fxBorder: true, fxPills: false, fxTorn: false, fxFog: false, fxFogDrift: false, surfaceWorld: "off" } },
  { key: "bloodline", name: "Bloodline", note: "The design mock-up: black with blood veins running through it.",
    set: { fxPlate: true, fxGlass: false, fxPaper: false, fxBlood: true, fxWood: false,
           fxTone: false, fxGrain: true, fxCalm: true, fxBorder: true, fxPills: false, fxTorn: false, fxFog: false, fxFogDrift: false, surfaceWorld: "off" } },
  { key: "glass", name: "Smoked glass", note: "Translucent black over the wallpaper, nothing else.",
    set: { fxPlate: true, fxGlass: true, fxPaper: false, fxBlood: false, fxWood: false,
           fxTone: false, fxGrain: false, fxCalm: false, fxBorder: true, fxPills: false, fxTorn: false, fxFog: false, fxFogDrift: false, surfaceWorld: "off" } },
  { key: "page", name: "Print page", note: "Printed black paper with the halftone screen.",
    set: { fxPlate: true, fxGlass: false, fxPaper: true, fxBlood: false, fxWood: false,
           fxTone: true, fxGrain: true, fxCalm: true, fxBorder: true, fxPills: false, fxTorn: false, fxFog: false, fxFogDrift: false, surfaceWorld: "off" } },
  { key: "uzumaki", name: "Uzumaki", note: "Paper with spiral wood grain at both ends.",
    set: { fxPlate: true, fxGlass: false, fxPaper: true, fxBlood: false, fxWood: true,
           fxTone: false, fxGrain: true, fxCalm: true, fxBorder: true, fxPills: false, fxTorn: false, fxFog: false, fxFogDrift: false, surfaceWorld: "off" } },
  { key: "floating", name: "Bare (pills)", note: "No plate: each widget floats in its own dark pill over the desktop.",
    set: { fxPlate: false, fxGlass: false, fxPaper: false, fxBlood: false, fxWood: false,
           fxTone: false, fxGrain: false, fxCalm: false, fxBorder: false, fxPills: true, fxTorn: false, fxFog: false, fxFogDrift: false, surfaceWorld: "off" } },
  { key: "otherworld", name: "Otherworld", note: "The rim rusts through and the edges are riveted, like the Otherworld of the games.",
    set: { fxPlate: true, fxGlass: false, fxPaper: false, fxBlood: false, fxWood: false,
           fxTone: false, fxGrain: true, fxCalm: true, fxBorder: true, fxPills: false, fxTorn: true, fxFog: false, fxFogDrift: false, surfaceWorld: "rust" } }
]

// The Otherworld variants of the plate (decisions-b9 section 2.4; ItoWorld.js draws them). One key, `surfaceWorld`; each row is a tuned set.
// Dark values: R rust [rim, field], G grating [rim, field], T rot (drips), V rivets; fog / veins / grain are the plate layers the variant
// raises (`max(user value, this)`, never lowered); torn forces the torn border. `-` in the design table is 0 / false here.
var WORLD_KEYS = ["off", "fog", "rust", "cage"]
var WORLDS = {
  fog:   { name: "Fog",   note: "A faint fence at the edges and the town's fog.",
           R: [0, 0],        G: [0.07, 0],   T: 0,    V: 0,    fog: 0.08, veins: 0,    grain: 0.18, torn: false },
  rust:  { name: "Rust",  note: "The rim rusts through; rivets along the edges.",
           R: [0.55, 0.10],  G: [0.10, 0],   T: 0,    V: 0.90, fog: 0,    veins: 0,    grain: 0,    torn: true },
  cage:  { name: "Cage",  note: "The whole bar sits behind a fine wire mesh.",
           R: [0.22, 0.05],  G: [0.12, 0.035], T: 0,  V: 0.70, fog: 0,    veins: 0,    grain: 0,    torn: false }
}
// S13e/D3: the old "Flesh" world is the Blood layer's `bloodSeep` option now (fxBlood + bloodSeep): the rot drips from the top edge.
// SEEP is what that option lays (the old Flesh row minus its veins, which belong to `surfaceVeins`).
var SEEP = { name: "Blood seep", note: "Rot seeps down from the top edge.",
             R: [0.18, 0.04], G: [0, 0], T: 0.55, V: 0, fog: 0, veins: 0, grain: 0, torn: false }
// The marks the plate paints: the chosen world with the seep folded in (never lowering the world's own values), or null when neither is on.
function worldParams(world, rot) {
  var w = WORLDS[worldKey(world)] || null
  if (!rot) return w
  if (!w) return SEEP
  return { name: w.name, note: w.note, R: [Math.max(w.R[0], SEEP.R[0]), Math.max(w.R[1], SEEP.R[1])], G: w.G, T: Math.max(w.T, SEEP.T),
           V: w.V, fog: w.fog, veins: w.veins, grain: w.grain, torn: w.torn }
}
// The Otherworld FIELD alpha scale for a palette (decisions-b9 2.5 gate a, amended): a layer of alpha A can move the lightness of a pixel by at most
// A x span x SLOPE, span = |lum(fg) - lum(bg)| of the theme and SLOPE = 1.6 (the layer is blended in sRGB, whose slope toward linear light is steepest at paper white: measured up to 1.44 x the span on flexoki-light). On a light palette the span is wide (the stain is a dark mark on paper), so the FIELD alpha
// sum of the variant is capped to FIELD_DL / span; dark and mid keep 1 (their rust and rot are red-toward-ink: measured <= 0.014).
var FIELD_DL = 0.027
function worldFieldK(p, k, ink, bone) {
  if (!p || k !== "light" || !ink || !bone) return 1
  var span = Math.abs(lum(bone) - lum(ink)), A = 0.7 * (p.R[1] + p.G[1]) + (p.T > 0 ? 0.10 : 0)
  var v = A * span * 1.6
  return v > FIELD_DL ? Math.max(0, FIELD_DL / v) : 1
}
function worldKey(v) { v = String(v); return WORLDS[v] ? v : "off" }

// The bar's shapes. The fork owns the geometry (it is Shibumi's shell-form work). Each one is drawn with a
// diagram: `w` is how much of the screen's width it takes, `gap` how far it floats off the top edge, `r` its
// corner shape (0 square, 1 fully round), `flat` whether its top edge is flush.
var forms = [
  { key: "shibumi", name: "Islands", w: 0.94, gap: 3, r: 1, flat: false,
    note: "A floating pill across the screen, inset from its edges. The only form that can be cut into islands." },
  { key: "full", name: "Full", w: 1, gap: 0, r: 0, flat: true,
    note: "Edge to edge and square: the bar is the top of the screen." },
  { key: "fit", name: "Fit", w: 0.66, gap: 0, r: 0.4, flat: true,
    note: "As wide as what is in it, hanging from the top edge with its bottom corners rounded." },
  { key: "dock", name: "Dock", w: 0.66, gap: 3, r: 1, flat: false,
    note: "As wide as what is in it, floating clear of the edge like a pill." },
  { key: "notch", name: "Notch", w: 0.66, gap: 0, r: 0.4, flat: true, notch: true,
    note: "Hangs from the edge with flowing shoulders that melt into the screen." }
]

// Where the bar sits on the screen. `x`,`y`,`w`,`h` draw it on the little screen of the card.
var positions = [
  { key: "top",    name: "Top",    x: 0.0,  y: 0.0,  w: 1.0,  h: 0.28, note: "Along the top edge." },
  { key: "bottom", name: "Bottom", x: 0.0,  y: 0.72, w: 1.0,  h: 0.28, note: "Along the bottom edge." },
  { key: "left",   name: "Left",   x: 0.0,  y: 0.0,  w: 0.16, h: 1.0,  note: "Down the left edge, widgets stacked." },
  { key: "right",  name: "Right",  x: 0.84, y: 0.0,  w: 0.16, h: 1.0,  note: "Down the right edge, widgets stacked." }
]

function on(cfg, flag) {
  var value = cfg.get(flag, defaults[flag])
  return value === true || value === "true" || value === 1
}

// Every layer folded into the values ItoPlate paints with. The bar and the panel's preview both
// call this, so what the panel shows is exactly what the bar draws.
function resolve(cfg) {
  var glass = on(cfg, "fxGlass"), paper = on(cfg, "fxPaper")
  var world = worldKey(cfg.get("surfaceWorld", "off")), wp = WORLDS[world] || null
  var rot = on(cfg, "fxBlood") && on(cfg, "bloodSeep")
  var dirt = Math.max(on(cfg, "fxGrain") ? cfg.get("surfaceGrain", 0.14) : 0, paper ? 0.3 : 0)
  var veins = on(cfg, "fxBlood") ? cfg.get("surfaceVeins", 0.6) : 0
  var fog = on(cfg, "fxFog") ? cfg.get("surfaceFog", 0.05) : 0
  var torn = on(cfg, "fxTorn")
  if (wp) {                                  // a variant raises the plate layers it names, never lowers the user's (veins half as strong on a light theme)
    var light = cfg.ink && cfg.bone && klass(cfg.ink, cfg.bone) === "light"
    dirt = Math.max(dirt, wp.grain); fog = Math.max(fog, wp.fog); veins = Math.max(veins, wp.veins * (light ? 0.5 : 1))
    torn = torn || wp.torn
  }
  return {
    // The user's opacity always applies; smoked glass takes a further slice off it.
    plate: on(cfg, "fxPlate") ? cfg.get("surfaceOpacity", 1) * (glass ? 0.74 : 1) : 0,
    veins: veins,
    wood: on(cfg, "fxWood") ? cfg.get("surfaceWood", 0.26) : 0,
    calm: on(cfg, "fxCalm") ? cfg.get("surfaceCalm", 0.4) : 0,
    grain: dirt,
    tone: on(cfg, "fxTone") ? cfg.get("surfaceTone", 0.15) : 0,
    lift: paper ? 0.045 : 0,
    border: on(cfg, "fxBorder"),
    torn: torn,
    fog: fog,
    fogDrift: on(cfg, "fxFog") && on(cfg, "fxFogDrift"),
    world: world,
    rot: rot
  }
}


// ---- Luminance-aware layering (visual-systems.md section 2.3) ---------------------------------------------
// One place decides how a translucent layer sits on a surface. Colours are { r, g, b } 0..1. Nothing here makes a hue: a layer is
// an existing theme colour (the foreground, the foreground eased toward the surface, the accent, the darker of paper and ink)
// with an alpha picked by the surface's class.
function lin(v) { return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
function lum(c) { return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b) }
function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
function mixc(a, b, t) { return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t } }
// The surface class of icons-v6 section 3 (the same rule as ItoIconInk.themeRoles; scripts/qa/visual-systems.test.mjs keeps them equal):
// "mid" when the foreground is under 4.5:1 on S or S sits in the mid-luminance band, else "dark" (foreground brighter) or "light".
function klass(S, fg) {
  var lS = lum(S), cFg = contrast(fg, S)
  if (cFg < 4.5 || (lS > 0.18 && lS < 0.45)) return "mid"
  return lum(fg) > lS ? "dark" : "light"
}
// The foreground eased toward S until it holds at most 7:1 (icons-v6 `light` line): the ink of a light surface.
function inkL(S, fg) {
  var t = 0
  while (t < 1 && contrast(mixc(fg, S, t), S) > 7) t += 0.01
  return mixc(fg, S, Math.min(t, 1))
}
// The darker of two theme colours (frame-styles K3).
function shade(a, b) { return lum(a) <= lum(b) ? a : b }
// role -> [dark, light, mid] as [token, alpha]; tokens: fg, inkL, accent, shade, paper.
var OVERLAY = {
  hover:      [["fg", 0.08], ["inkL", 0.07], ["fg", 0.10]],
  press:      [["fg", 0.14], ["inkL", 0.12], ["fg", 0.16]],
  selected:   [["accent", 0.18], ["accent", 0.16], ["accent", 0.20]],
  separator:  [["fg", 0.18], ["inkL", 0.22], ["fg", 0.24]],
  pillFill:   [["shade", 0.78], ["paper", 0.86], ["shade", 0.82]],
  pillBorder: [["fg", 0.22], ["inkL", 0.18], ["fg", 0.26]],
  shadow:     [["shade", 0.55], ["inkL", 0.22], ["shade", 0.45]],
  idle:       [["shade", 0.12], ["inkL", 0.05], ["shade", 0.12]]
}
// overlay(role, S, fg, accent) -> { token: { r, g, b }, alpha }. S is the surface (the theme background), fg the theme foreground.
function overlay(role, S, fg, accent) {
  var row = OVERLAY[role]
  if (!row) return { token: fg, alpha: 0 }
  var k = klass(S, fg), spec = row[k === "dark" ? 0 : (k === "light" ? 1 : 2)], t = spec[0]
  var token = t === "fg" ? fg : t === "inkL" ? inkL(S, fg) : t === "accent" ? (accent || fg) : t === "shade" ? shade(S, fg) : S
  return { token: { r: token.r, g: token.g, b: token.b }, alpha: spec[1] }
}

// ---- Elevation: cast ink, not blur (visual-systems.md section 2.4) ----------------------------------------
// Levels 0..3 (fractional while a level change animates). A raised sheet casts a hard, offset ink shadow (light from the upper left):
// dp = [0, 1, 3, 6][level], offset dp/2 down and dp/4 right, n = ceil(level) layers; layer i (1..n) sits at offset*i/n with alpha
// shadowAlpha * (1 - (i-1)/n) * 0.6. Level 0 casts nothing. Returns { dp, n, layers: [{ ox, oy, alpha }] }.
var DP = [0, 1, 3, 6]
function elevation(level, shadowAlpha) {
  var lv = Math.max(0, Math.min(3, Number(level) || 0))
  var lo = Math.floor(lv), hi = Math.min(3, lo + 1)
  var dp = DP[lo] + (DP[hi] - DP[lo]) * (lv - lo)
  var n = Math.max(0, Math.ceil(lv - 1e-6)) || 0
  var layers = []
  for (var i = 1; i <= n; i++) {
    var f = i / n
    layers.push({ ox: dp / 4 * f, oy: dp / 2 * f, alpha: shadowAlpha * (1 - (i - 1) / n) * 0.6 })
  }
  return { dp: dp, n: n, layers: layers }
}

// The colour behind a bar icon (icons-v6-tone.md section 2.1): with pills on, the pill laid over the theme background; otherwise the
// background lifted toward the foreground by the paper layer. Glass and grain have no single colour, so the theme background stays
// (the icons only ever ADD marks, so those surfaces stay correct). `bg` and `fg` are { r, g, b } 0..1; the result is opaque.
// PILL mirrors plugins/ito.bar/styles/itoverse/VisualTokens.qml `pill` (scripts/qa/icon-tone.test.mjs keeps them equal).
var PILL = { r: 0.02, g: 0.024, b: 0.027 }
function iconSurface(cfg, bg, fg) {
  if (on(cfg, "fxPills")) {
    var a = Number(cfg.get("surfacePill", 0.78))
    // surfaceLayering `theme`: the pill is the same `pillFill` token the style paints (VisualTokens.qml), so icon and pill agree
    if (String(cfg.get("surfaceLayering", "theme")) === "theme") {
      var pf = overlay("pillFill", bg, fg, fg).token
      return { r: pf.r * a + bg.r * (1 - a), g: pf.g * a + bg.g * (1 - a), b: pf.b * a + bg.b * (1 - a), a: 1 }
    }
    return { r: PILL.r * a + bg.r * (1 - a), g: PILL.g * a + bg.g * (1 - a), b: PILL.b * a + bg.b * (1 - a), a: 1 }
  }
  var l = resolve(cfg).lift
  return { r: bg.r + (fg.r - bg.r) * l, g: bg.g + (fg.g - bg.g) * l, b: bg.b + (fg.b - bg.b) * l, a: 1 }
}

// ---- Safe palette read (visual-systems.md section 2.2) -----------------------------------------------------
// colors.toml is rewritten by a theme swap, and the file can be read half-written. A palette read that lacks a colour must never
// replace a good one (the bar would flash through the Omarchy defaults for a frame).
// usable(v): a "#rrggbb" / "#rrggbbaa" string, or a colour object whose r, g, b are finite numbers in 0..1.
function usable(v) {
  if (typeof v === "string") return /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(v)
  if (v && typeof v === "object") {
    var ok = function (n) { return typeof n === "number" && isFinite(n) && n >= 0 && n <= 1 }
    return ok(v.r) && ok(v.g) && ok(v.b)
  }
  return false
}
var REQUIRED = ["background", "foreground", "accent"]
// prev, next: { key: colour } maps. partialCount: how many consecutive partial loads came before this one.
// Returns { palette, partial }. A complete `next` wins at once. A partial one HOLDS the previous palette whole (never a merge, so a
// new background can not meet an old foreground and leave dark text on a dark bar). The second partial load in a row is accepted
// when it at least has a background and a foreground (a theme that lacks an accent degrades, it never sticks); without that pair
// the previous palette is kept.
function acceptPalette(prev, next, partialCount) {
  prev = prev || {}
  var clean = {}, k
  for (k in (next || {})) if (usable(next[k])) clean[k] = next[k]
  var complete = true
  for (var i = 0; i < REQUIRED.length; i++) if (!clean[REQUIRED[i]]) complete = false
  if (complete) return { palette: clean, partial: false }
  if ((partialCount || 0) >= 1 && clean.background && clean.foreground) return { palette: clean, partial: false }
  return { palette: prev, partial: true }
}

if (typeof module !== "undefined") module.exports = { presets: presets, WORLDS: WORLDS, SEEP: SEEP, worldParams: worldParams, WORLD_KEYS: WORLD_KEYS, worldKey: worldKey, worldFieldK: worldFieldK, elevation: elevation, lum: lum, contrast: contrast, klass: klass, inkL: inkL, shade: shade, overlay: overlay, OVERLAY: OVERLAY, usable: usable, acceptPalette: acceptPalette, resolve: resolve, on: on, iconSurface: iconSurface, PILL: PILL, defaults: defaults }

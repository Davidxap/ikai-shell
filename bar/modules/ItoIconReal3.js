.pragma library
.import "ItoIconReal.js" as Real

// Manga icons v4 (icons-v4.md): media (S6), indicators (S7) and weather skies (S8), drawn with the recipe of ItoIconReal.js (tone is
// luminance, a 2x bake, tonal steps from hatch density, thick-thin contours, one specular) and held to the bar's weight budget.
// Today's silhouette first; the horror in the rendering and the details. Pure and seeded; the same parts format and roles.
// Registered in ItoIconSet.js. Shared pieces here: `button` (the cast-iron push button of the media faces), `drawMoon`, `fogBands`
// and `cloudMass` (indicators and skies).

var K = Real.KIT, G = K.G
var P = G.P, flat = G.flat, clamp = G.clamp, lerp = G.lerp
var LIT = K.LIT, DARK = K.DARK, add = K.add, ground = K.ground, base = K.base, toneField = K.toneField, outline = K.outline
var dot = K.dot, drip = K.drip, rig = K.rig

var KINDS = ["media", "indicator", "sky"]
var STATES = {
  media: [{ face: "prev" }, { face: "play" }, { face: "pause", playing: true }, { face: "pause" }, { face: "next" }, { face: "stop" },
          { face: "shuffle", on: false }, { face: "shuffle", on: true }, { face: "repeat", loop: "none" }, { face: "repeat", loop: "playlist" }, { face: "repeat", loop: "track" }]
}
var VERSIONS = [["awake", "coffee"], ["awake", "radio"], ["awake", "flashlight"], ["night", "moon"], ["night", "fog"], ["record", "eye"], ["record", "tape"]]
STATES.indicator = []
for (var vi = 0; vi < VERSIONS.length; vi++) { STATES.indicator.push({ id: VERSIONS[vi][0], version: VERSIONS[vi][1], on: false }); STATES.indicator.push({ id: VERSIONS[vi][0], version: VERSIONS[vi][1], on: true }) }
var SKIES = ["sun", "moon", "cloud", "suncloud", "rain", "storm", "snow", "fog"]
STATES.sky = SKIES.map(function(k) { return { sky: k } })
var NOMINAL = { media: { face: "play" }, sky: { sky: "suncloud" }, indicator: { id: "awake", version: "coffee", on: false } }
var CURRENT = { media: "media/media-play.png", sky: "instruments/sky-suncloud.png", indicator: "indicators/awake-coffee-off.png" }
// the weight budget of this file (scripts/qa/icons-calibrate.mjs)
var WEIGHT = {
  "indicator:coffee:on": {  gain: [0.15, 0.15], line: [0.483, 0.866], scale: 1.04, ink: { gain: [0.15, 0.15], line: [0.483, 0.887] }  },
  "indicator:coffee": {  gain: [0.15, 0.15], line: [0.487, 1], scale: 1.04, ink: { gain: [0.15, 0.505], line: [0.487, 1] }  },
  "indicator:radio:on": {  gain: [0.15, 0.47], line: [0.565, 1], scale: 0.912, ink: { gain: [0.15, 0.476], line: [0.565, 1] }  },
  "indicator:radio": {  gain: [0.15, 0.535], line: [0.568, 1], scale: 0.912, ink: { gain: [0.15, 0.536], line: [0.568, 1] }  },
  "indicator:flashlight:on": {  gain: [0.15, 1], line: [0.746, 1.606], scale: 1.104, ink: { gain: [0.15, 1], line: [0.746, 1.371] }  },
  "indicator:flashlight": {  gain: [0.15, 1], line: [0.884, 2.06], scale: 1.104, ink: { gain: [0.15, 1], line: [0.884, 1.727] }  },
  "indicator:moon:on": {  gain: [0.15, 1], line: [0.886, 2.068], scale: 0.952, ink: { gain: [0.15, 1], line: [0.886, 1.85] }  },
  "indicator:moon": {  gain: [0.15, 1], line: [0.976, 2.053], scale: 0.952, ink: { gain: [0.15, 1], line: [0.976, 1.829] }  },
  "indicator:fog:on": {  gain: [0.372, 1], line: [1, 1.03], scale: 0.943, ink: { gain: [0.372, 1], line: [1, 1.159] }  },
  "indicator:fog": {  gain: [0.395, 1], line: [1, 1.434], scale: 0.943, ink: { gain: [0.395, 1], line: [1, 1.597] }  },
  "indicator:eye:on": {  gain: [0.558, 1], line: [1, 1.781], scale: 1.046, ink: { gain: [0.558, 1], line: [1, 1.715] }  },
  "indicator:eye": { gain: [0.569, 1], line: [1, 2.2], scale: 1.046 },
  "indicator:tape:on": {  gain: [0.05, 0.15], line: [0.4, 0.963], scale: 0.965, ink: { gain: [0.05, 0.15], line: [0.4, 0.962] }  },
  "indicator:tape": {  gain: [0.05, 0.15], line: [0.45, 0.938], scale: 0.965, ink: { gain: [0.05, 0.15], line: [0.45, 0.939] }  },
  "sky:sun": {  gain: [0.15, 1], line: [0.924, 1.458], scale: 1.04, ink: { gain: [0.15, 1], line: [0.924, 1.84] }  },
  "sky:moon": {  gain: [0.421, 1], line: [1, 2.161], scale: 0.912, ink: { gain: [0.421, 1], line: [1, 1.898] }  },
  "sky:cloud": {  gain: [0.15, 1], line: [1.05, 2.007], scale: 1.072, ink: { gain: [0.15, 1], line: [1.05, 2.079] }  },
  "sky:suncloud": {  gain: [0.15, 1], line: [0.773, 1.598], scale: 0.85, ink: { gain: [0.15, 1], line: [0.773, 1.492] }  },
  "sky:rain": {  gain: [0.15, 1], line: [0.984, 2.2], scale: 0.971, ink: { gain: [0.15, 1], line: [0.984, 2.136] }  },
  "sky:storm": {  gain: [0.15, 1], line: [1.25, 2.2], scale: 0.958, ink: { gain: [0.15, 1], line: [1.25, 2.146] }  },
  "sky:snow": { gain: [0.15, 1], line: [0.93, 2.2], scale: 0.985 },
  "sky:fog": {  gain: [0.397, 1], line: [1, 1.44], scale: 0.943, ink: { gain: [0.397, 1], line: [1, 1.601] }  },
  media: {  gain: [0.05, 1], line: [0.45, 1.346], scale: 0.889, ink: { gain: [0.05, 1], line: [0.45, 1.5], mass: [0.84, 1] }  }
}
for (var wk in WEIGHT) K.WEIGHT[wk] = WEIGHT[wk]

function ang(cx, cy, r, deg) { var a = deg * Math.PI / 180; return P(cx + Math.cos(a) * r, cy + Math.sin(a) * r) }
function poly(c, pts, wob) { return G.wobble(G.resample(pts, 0.8, true), c.rand, wob === undefined ? 0.12 : wob, true) }

// ---------------------------------------------------------------------------------------------------- media
// The buttons of a dead cassette deck (Silent Hill's tape recorders). Today's ring-with-glyph stays the silhouette: a round
// cast-iron push-button in its bezel, the symbol cast in RAISED relief (solid in the line colour: it must be the strongest mark).
// Shuffle and repeat stay bare marks, as today. One wrongness per face; accent only where a state lives.
var CHIP = { prev: 150, play: 35, pause: 15, next: 60, stop: 215 }     // where the rim is chipped, degrees (screen angles)

// the button: bezel arcs that do not quite meet, the iron face brushed in rings (darker toward the lower right), a chip out of the rim
function button(c, face) {
  var C = P(24, 24), R = 18, rim = c.tier === 0 ? 1.8 : 1.6
  var disc = G.wobble(G.ellipse(C.x, C.y, R, R, 56), c.rand, 0.12, true)
  var faceR = G.ellipse(C.x, C.y, R - 2.6, R - 2.6, 48)
  ground(c, disc, "under", "button")
  // the face: brushed iron, as a few pen arcs round the centre on the side that takes the light (a dark bar) or the shadow (a light
  // bar), two to four of them, thick-thin; the rest of the face is the ground
  if (c.tier >= 1) {
    var arcs = [], mid = c.light ? 215 : 40, nA = c.tier === 1 ? 3 : 4
    for (var q = 0; q < nA; q++) {
      var r = 6.2 + q * 3.1, span = 95 - q * 12, run = []
      for (var u = 0; u <= 14; u++) run.push(ang(C.x, C.y, r, mid - span / 2 + span * u / 14 + q * 9))
      arcs.push(G.ribbon(run, (0.55 + 0.1 * (q % 2)) * c.k * Math.max(0.6, c.lineK), { taperPow: 0.45 }))
    }
    add(c, "line", "under", arcs, null, "iron")
    // a light bar: the lower-right third of the face is hatched (the shadow side), the rest stays ground
    if (!c.light) toneField(c, faceR, function(p) { var pr = ((p.x - C.x) + (p.y - C.y)) / (2 * 14); return clamp(0.95 - 1.1 * Math.max(0, pr - 0.12), 0.05, 0.95) }, { dir: 45, cross: false, spacing: 1.6, w: 0.9, tag: "iron-shade" })
  } else add(c, LIT(c), "under", [flat(G.clipAbove(faceR, 24))], null, "iron-lit")
  // the bezel: an inner groove and the heavy outer arcs, two or three, that do not meet (G.contour breaks)
  add(c, "line", "over", outline(c, disc, 0.6, rim, { gaps: c.tier === 0 ? 2 : 3 }), null, "bezel")
  if (c.tier >= 2) add(c, "line", "over", outline(c, G.ellipse(C.x, C.y, R - 2.4, R - 2.4, 44), 0.35, 0.7, { gaps: 2 }), null, "groove")
  // the chip: a bite out of the rim, with its raw edge
  var ca = CHIP[face] === undefined ? 35 : CHIP[face]
  if (c.tier >= 1) {
    var a0 = ca - 9, a1 = ca + 9, o = [], q = []
    for (var i = 0; i <= 8; i++) { var t = i / 8, r1 = R + 0.4 - Math.sin(Math.PI * t) * 2.2 * (0.8 + 0.4 * c.rand()); o.push(ang(C.x, C.y, r1, lerp(a0, a1, t))) }
    for (var j = 8; j >= 0; j--) q.push(ang(C.x, C.y, R + 1.2, lerp(a0, a1, j / 8)))
    add(c, "void", "over", [flat(o.concat(q))], null, "chip")
    add(c, "line", "over", [G.ribbon(o, 0.45 * c.k * c.lw, { taperPow: 0.4 })], null, "chip-edge")
  }
  // rust at the lower right of the bezel, at L only
  if (c.tier >= 2) add(c, "line", "over", G.stipple(c, G.ellipse(C.x + 6, C.y + 8, 9, 7, 16), [G.ellipse(C.x, C.y, R - 3.4, R - 3.4, 30)], 14, 0.4, { lean: 1 }), null, "rust")
  c.silhouette = [flat(disc)]
  c.keyline = { x: 6, y: 6, w: 36, h: 36, shape: "square" }
  return { C: C, R: R, disc: disc }
}
// a raised symbol: solid in the line colour, with its lower-right edge cut back to the ground (the relief's shadow)
function symbol(c, polys, grp) {
  if (grp) rig(c, grp, 24, 24)
  // the weight budget's `mass` is the symbol's size (a solid shape has no contour to thin): scaled about its own centre
  var f = clamp(Math.sqrt(c.massK), 0.55, 1.2)
  add(c, "line", "over", polys.map(function(p) {
    var m = G.centroid(p), q = p.map(function(v) { return P(m.x + (v.x - m.x) * f, m.y + (v.y - m.y) * f) })
    return flat(G.wobble(G.resample(q, 0.7, true), c.rand, 0.08, true))
  }), null, "symbol")
  if (grp) rig(c, "")
}
function wedge(tip, base_, half) { return [P(tip[0], tip[1]), P(base_, tip[1] - half), P(base_, tip[1] + half)] }

function drawMedia(c) {
  var st = c.state, face = String(st.face || "play")
  if (face === "shuffle") return drawShuffle(c)
  if (face === "repeat") return drawRepeat(c)
  var B = button(c, face), C = B.C
  var hl = null
  if (face === "prev") {
    // two wedges pointing left, tips 2 units apart; a hairline crack from the left tip to the chip in the rim
    var w1 = wedge([10.5, 24], 22.4, 7.6), w2 = wedge([23.6, 24], 35.2, 7.6)
    symbol(c, [w1, w2], "sym")
    add(c, "line", "over", [G.crack(c, P(10.0, 24.6), ang(C.x, C.y, 16.4, CHIP.prev), 3, 0.5, 0)], null, "crack")
    hl = [P(11.6, 22.8), P(21.4, 17.2), P(21.9, 17.9), P(12.2, 23.6)]
  } else if (face === "next") {
    // drawn, not mirrored: the wedges a little offset; a smeared dried thumbprint at the lower left of the face
    var n1 = wedge([36.2, 24.4], 25.4, 7.5), n2 = wedge([24.2, 24.4], 13.0, 7.7)
    symbol(c, [n1, n2], "sym")
    if (c.tier >= 1) {
      var rid = []
      for (var k = 0; k < (c.tier === 1 ? 4 : 6); k++) {
        var r = 1.8 + k * 1.15, a0 = 195 + k * 4, a1 = 330 - k * 5
        var arc = []
        for (var s = 0; s <= 8; s++) { var tt = s / 8; if ((s + k) % 4 !== 3) arc.push(ang(14.5, 31.5, r, lerp(a0, a1, tt))) ; else { if (arc.length > 1) rid.push(G.ribbon(arc, 0.4 * c.k * c.lw, { taperPow: 0.5 })); arc = [] } }
        if (arc.length > 1) rid.push(G.ribbon(arc, 0.4 * c.k * c.lw, { taperPow: 0.5 }))
      }
      add(c, c.light ? "void" : "line", "over", rid, null, "thumbprint")
    }
    hl = [P(25.4, 17.8), P(35.2, 22.6), P(34.9, 23.3), P(25.0, 18.6)]
  } else if (face === "play") {
    // today's triangle, its point 1 unit right of centre; dry: dust in its base corner, a crack across it
    var tri = [P(16.0, 13.6), P(35.0, 24.2), P(16.0, 34.8)]
    symbol(c, [tri], "sym")
    add(c, "void", "over", [G.crack(c, P(18.2, 20.0), P(27.2, 25.6), 3, 0.55, 0)], null, "crack")
    if (c.tier >= 1) add(c, "void", "over", G.stipple(c, [P(17.8, 27), P(23, 29.6), P(17.8, 32.4)], [], c.tier === 1 ? 5 : 9, 0.4, {}), null, "dust")
    hl = [P(18.4, 17.6), P(31.2, 24.0), P(30.8, 24.7), P(18.0, 18.6)]
  } else if (face === "pause") {
    // two bars, the right one 1.5 longer; blood seeps from the seam where each meets the face while it plays
    var playing = !!st.playing
    var lb = [P(16.0, 15.6), P(21.0, 15.6), P(21.0, 32.4), P(16.0, 32.4)], rb = [P(27.2, 14.4), P(32.2, 14.4), P(32.2, 34.0), P(27.2, 34.0)]
    symbol(c, [lb, rb], "sym")
    if (playing) {
      rig(c, "seep", 24, 33)
      add(c, "blood", "over", [G.ribbon([P(15.2, 32.9), P(18.3, 33.3), P(21.4, 32.9)], 0.6 * c.k * Math.max(0.8, c.lineK), { taperPow: 0.2 }),
                               G.ribbon([P(26.6, 34.5), P(29.7, 34.9), P(32.8, 34.5)], 0.6 * c.k * Math.max(0.8, c.lineK), { taperPow: 0.2 })], null, "datum")
      rig(c, "bead", 29.7, 35.2)
      dot(c, 29.9, 36.6, 0.6, "blood", "over", "datum")
      rig(c, "")
      rig(c, "")
    }
    // the hidden drop that runs out of the seam in the omen
    rig(c, "drop", 18.3, 33.5, { hidden: true })
    dot(c, 18.3, 35.0, 0.8, "blood", "over", "datum")
    rig(c, "")
    hl = [P(16.0, 16.4), P(20.2, 16.4), P(20.2, 17.1), P(16.0, 17.1)]
  } else if (face === "stop") {
    // today's square, a little out of square (one corner 0.8 low); a nail head at each corner: the button is nailed shut
    var sq = [P(17.2, 17.0), P(30.8, 17.0), P(30.8, 30.8), P(17.2, 31.6)]
    symbol(c, [sq], "sym")
    var nails = [[18.8, 18.6], [29.2, 18.6], [29.2, 29.4], [18.8, 30.0]]
    add(c, "void", "over", nails.map(function(n) { return flat(G.ellipse(n[0], n[1], 0.95, 0.95, 8)) }), null, "nails")
    if (c.tier >= 1) add(c, "line", "over", nails.map(function(n) { return flat(G.ellipse(n[0] - 0.2, n[1] - 0.2, 0.4, 0.4, 6)) }), null, "nail-glint")
    hl = [P(17.8, 17.6), P(30.0, 17.6), P(30.0, 18.1), P(17.8, 18.1)]
  }
  c.highlight = { role: "paper", polys: [flat(hl || [P(14, 12), P(18, 10), P(18.6, 10.8), P(14.8, 12.8)])] }
}

// ---- shuffle: two crossing arrows as forged iron rods (lit top edge, dark underside), spear heads hammered flat; wire at the crossing
function rod(c, pts, w, tag) {
  var rib = G.ribbon(G.resample(pts, 0.7, false), w, { taper: false })
  return rib
}
function drawShuffle(c) {
  var on = !!c.state.on
  c.keyline = { x: 4, y: 9, w: 40, h: 30, shape: "landscape" }
  var wk = c.light ? 1 : 1                     // (the off rods' share is below)
  var W = 2.4 * Math.max(0.7, c.lineK) * (on ? 1 : 0.9)
  // rod A: lower left to upper right, rod B: upper left to lower right (A is over B at the crossing)
  var A = [P(5, 34), P(14, 33), P(22, 25), P(30, 16.4), P(36.4, 14.8)], Bp = [P(5, 14.4), P(14, 15), P(22, 23), P(30, 32), P(36.4, 33.6)]
  var sil = []
  // underside shadow first (a darker rod offset down-right), then the lit rod
  rig(c, "rodB", 22, 24)
  var RB = rod(c, Bp, W * c.k, "B")
  add(c, "line", "under", [RB], null, "rod")
  add(c, "line", "under", [G.ribbon(G.resample(Bp.map(function(p) { return P(p.x, p.y - 0.2) }), 0.7, false), W * 0.3 * c.k, { taper: false })], null, "rod-lit")
  var headB = [P(36.2, 28.4), P(43.2, 34.2), P(36.0, 38.6)]
  add(c, "line", "under", [flat(G.wobble(G.resample(headB, 0.6, true), c.rand, 0.1, true))], null, "head")
  rig(c, "")
  // the gap cut where A passes over B
  rig(c, "rodA", 22, 24)
  add(c, "void", "under", [G.ribbon(G.resample(A, 0.7, false), W * 1.7 * c.k, { taper: false })], [P(17, 19), P(27, 19), P(27, 29), P(17, 29)], "gap")
  var RA = rod(c, A, W * c.k, "A")
  add(c, "line", "under", [RA], null, "rod")
  add(c, "void", "under", [G.ribbon(G.resample(A.map(function(p) { return P(p.x, p.y - 0.25) }), 0.7, false), W * 0.28 * c.k, { taper: false })], null, "rod-cut")
  var headA = [P(36.4, 9.4), P(43.4, 15.0), P(36.2, 20.4)]
  add(c, "line", "under", [flat(G.wobble(G.resample(headA, 0.6, true), c.rand, 0.1, true))], null, "head")
  rig(c, "")
  // the wire: a few turns round both rods at the crossing, biting into the lower one
  var wire = []
  for (var i = 0; i < (c.tier === 0 ? 2 : 3); i++) { var o = (i - 1) * 1.7; wire.push(G.ribbon([P(19.6 + o, 27.6 - o * 0.4), P(24.2 + o, 21.2 - o * 0.4)], 0.55 * c.k * Math.max(0.8, c.lineK), { taperPow: 0.3 })) }
  add(c, "void", "over", wire, null, "wire")
  if (c.tier >= 1) add(c, "line", "over", [G.ribbon([P(18.8, 24.2), P(22.0, 25.0), P(25.4, 23.8)], 0.4 * c.k * c.lw, { taperPow: 0.3 })], null, "wire-glint")
  if (on) { rig(c, "bite", 22.4, 25.2); dot(c, 22.4, 26.6, 0.95, "blood", "over", "datum"); drip(c, P(22.4, 27.0), 2.2, 0.5, "blood"); c.parts[c.parts.length - 1].tag = "datum"; rig(c, "") }
  c.silhouette = [RA, RB, flat(headA), flat(headB)]
  c.highlight = { role: "paper", polys: [flat([P(8.4, 33.0), P(13.2, 32.2), P(13.3, 32.8), P(8.5, 33.6)])] }
  void sil; void wk
}
// ---- repeat: two U-shaped iron straps with arrowheads and two rivets. none: ghosted; playlist: full; track: a nail through the middle
function drawRepeat(c) {
  var loop = String(c.state.loop || "playlist")
  c.keyline = { x: 5, y: 8, w: 38, h: 32, shape: "landscape" }
  var W = 2.3 * Math.max(0.7, c.lineK), ghost = loop === "none"
  var top = [], bot = []
  for (var u = 0; u <= 12; u++) { var a1 = 165 + u * 105 / 12; top.push(ang(24, 24, 1, a1)); top[u] = P(24 + Math.cos(a1 * Math.PI / 180) * 15, 24 + Math.sin(a1 * Math.PI / 180) * 10) }
  top.push(P(32, 14))
  for (var u2 = 0; u2 <= 12; u2++) { var a2 = 345 + u2 * 105 / 12; bot.push(P(24 + Math.cos(a2 * Math.PI / 180) * 15, 24 + Math.sin(a2 * Math.PI / 180) * 10)) }
  bot.push(P(16, 34))
  var hTop = [P(31.6, 8.6), P(40.2, 15.2), P(31.4, 21.8)], hBot = [P(16.4, 26.2), P(7.8, 32.8), P(16.6, 39.4)]
  function strap(pts, head, tag) {
    var rib = G.ribbon(G.resample(pts, 0.7, false), W * c.k, { taper: false })
    if (ghost) {
      // ghosted: the strap's hollow outline as a broken hairline, the iron gone
      var o = []
      for (var s = 0; s < 2; s++) {
        var side = pts.map(function(p, i) { return P(p.x, p.y + (s ? 1 : -1) * W * 0.5) }), run = [], n = side.length
        var res = G.resample(side, 0.7, false)
        for (var q = 0; q < res.length; q++) { if (q % 9 < 6) run.push(res[q]); else { if (run.length > 1) o.push(G.ribbon(run, 0.5 * c.k, { taperPow: 0.3 })); run = [] } }
        if (run.length > 1) o.push(G.ribbon(run, 0.5 * c.k, { taperPow: 0.3 }))
      }
      add(c, "line", "under", o, null, tag + "-ghost")
      add(c, "line", "under", [G.ribbon(G.resample(head, 0.6, true).concat([head[0]]), 0.5 * c.k, { taper: false })], null, tag + "-head-ghost")
    } else {
      add(c, "line", "under", [rib, flat(G.wobble(G.resample(head, 0.6, true), c.rand, 0.1, true))], null, tag)
      add(c, "void", "under", [G.ribbon(G.resample(pts.map(function(p) { return P(p.x, p.y - W * 0.22) }), 0.7, false), W * 0.22 * c.k, { taper: false })], null, tag + "-cut")
    }
  }
  strap(top, hTop, "strap"); strap(bot, hBot, "strap")
  if (!ghost) add(c, "void", "over", [flat(G.ellipse(10.0, 24.4, 0.8, 0.8, 8)), flat(G.ellipse(38.0, 23.6, 0.8, 0.8, 8))], null, "rivets")
  if (loop === "track") {
    // a single nail driven through the middle of the loop: head and shank, reading as "1", with a bead of blood where it enters
    rig(c, "nail", 24, 24)
    add(c, "line", "over", [G.ribbon([P(24, 18.8), P(24.1, 26), P(24, 33.8)], 1.5 * c.k * Math.max(0.8, c.lineK), { taper: false }), flat(G.ellipse(24, 18.2, 2.6, 1.1, 12))], null, "nail")
    add(c, "void", "over", [G.ribbon([P(23.4, 19.6), P(23.4, 30)], 0.35 * c.k, { taper: false })], null, "nail-cut")
    dot(c, 24.3, 34.4, 0.9, "blood", "over", "datum")
    rig(c, "")
  }
  c.silhouette = [G.ribbon(top, W * c.k, { taper: false }), G.ribbon(bot, W * c.k, { taper: false }), flat(hTop), flat(hBot)]
  c.highlight = { role: "paper", polys: [flat([P(13.6, 14.2), P(21.6, 13.8), P(21.7, 14.4), P(13.8, 14.8)])] }
}


// ---------------------------------------------------------------------------------------------------- shared pieces
// a tone field of a form lit from the upper left, normalised to a box: t = 0.92 at the upper left, falling to the lower right
function litFn(x0, y0, x1, y1, k) {
  return function(p) { var u = clamp((p.x - x0) / (x1 - x0), 0, 1), v = clamp((p.y - y0) / (y1 - y0), 0, 1); return clamp(0.95 - (k || 0.8) * (0.55 * u + 0.45 * v), 0.08, 0.95) }
}
function rrect(x0, y0, x1, y1, r) {
  var o = [], n = 5
  var cs = [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]]
  for (var q = 0; q < 4; q++) for (var i = 0; i <= n; i++) { var a = (cs[q][2] + 90 * i / n) * Math.PI / 180; o.push(P(cs[q][0] + Math.cos(a) * r, cs[q][1] + Math.sin(a) * r)) }
  return o
}
// one solid face in the line colour at the budget (a lit enamel on a dark bar, ink on a light one), with its tone as hatch
function plate(c, region, fn0, tag, o) {
  // a light bar reads lighter for the same tone (the ground is the paper): the surface is taken a little darker there
  var kd = (o && o.kd) || 1, fn = c.light ? function(p) { return fn0(p) * kd } : function(p) { return fn0(p) * 0.52 }
  ground(c, region, (o && o.layer) || "under", tag || "plate")
  if (c.tier >= 1) toneField(c, region, fn, { dir: (o && o.dir) === undefined ? 45 : o.dir, cross: false, spacing: (o && o.spacing) || 1.5, layer: (o && o.layer) || "under", tag: (tag || "plate") + "-tone", exc: (o && o.exc) || [] })
  else add(c, LIT(c), (o && o.layer) || "under", [flat(G.clipAbove(region, 24))], region, (tag || "plate") + "-lit")
}
// the moon: a crescent lit from its outer edge, shaded as a sphere, with craters and the Remina lid crease along the inner curve
// (shared by the indicator and the sky). `bloody`: the craters are full of blood (the indicator's on state).
function moonShape(cx0, cy0, r0, cx1, cy1, r1) {
  var outer = [], inner = []
  for (var i = 0; i < 120; i++) { var a = i / 120 * Math.PI * 2, p = P(cx0 + Math.cos(a) * r0, cy0 + Math.sin(a) * r0); if (Math.hypot(p.x - cx1, p.y - cy1) > r1) outer.push({ a: a, p: p }) }
  for (var j = 0; j < 120; j++) { var b = j / 120 * Math.PI * 2, q = P(cx1 + Math.cos(b) * r1, cy1 + Math.sin(b) * r1); if (Math.hypot(q.x - cx0, q.y - cy0) < r0) inner.push({ a: b, p: q }) }
  // the outer arc is one run of the circle; rotate it to start after its gap, then the inner arc runs back
  var n = outer.length, gapAt = 0
  for (var k = 0; k < n; k++) { var d = (outer[(k + 1) % n].a - outer[k].a + Math.PI * 2) % (Math.PI * 2); if (d > 0.2) gapAt = (k + 1) % n }
  var arc = []
  for (var m = 0; m < n; m++) arc.push(outer[(gapAt + m) % n].p)
  var m2 = inner.length, ia = []
  var gi = 0
  for (var t = 0; t < m2; t++) { var dd = (inner[(t + 1) % m2].a - inner[t].a + Math.PI * 2) % (Math.PI * 2); if (dd > 0.2) gi = (t + 1) % m2 }
  for (var u = 0; u < m2; u++) ia.push(inner[(gi + u) % m2].p)
  // join: the outer arc's end is nearest the inner arc's start or end
  var e = arc[arc.length - 1], d0 = Math.hypot(ia[0].x - e.x, ia[0].y - e.y), d1 = Math.hypot(ia[m2 - 1].x - e.x, ia[m2 - 1].y - e.y)
  if (d1 < d0) ia.reverse()
  return { body: arc.concat(ia), inner: ia, outerArc: arc }
}
function drawMoon(c, o) {
  var S = moonShape(23.5, 25, 17.2, 31.4, 19.4, 14.2), body = G.wobble(G.resample(S.body, 0.9, true), c.rand, 0.15, true)
  var bloody = !!(o && o.bloody), tag = (o && o.tag) || "moon", x0 = 6, y0 = 8, x1 = 40, y1 = 42
  var craters = [[12.4, 27.6, 2.3], [16.2, 36.2, 1.8], [19.4, 17.6, 1.5], [11.0, 20.4, 1.0]]
  var ck = 1, cr = craters.map(function(q) { return G.ellipse(q[0], q[1], q[2] * ck, q[2] * ck * 0.86, 12) })
  ground(c, body, "under", tag)
  // sphere: lit from the outer (left) edge, the inner curve in shadow
  if (c.tier >= 1) toneField(c, body, function(p) { return clamp((0.9 - 0.9 * clamp((p.x - 6) / 26, 0, 1) - 0.1 * clamp((p.y - 20) / 20, 0, 1)) * (c.light ? 1 : 0.5), 0.06, 0.95) }, { dir: 70, cross: false, spacing: 1.5, exc: cr, tag: tag + "-tone" })
  else add(c, LIT(c), "under", [flat(G.clipAbove(body, 30))], body, tag + "-lit")
  // craters: pits with a lit lip on the lower right (a hatch cut), full of blood when bloody
  rig(c, "level", 16, 28)
  if (bloody) add(c, "blood", "level", cr.map(flat), null, "datum")
  else add(c, DARK(c), "under", cr.map(flat), null, "craters")
  rig(c, "")
  if (bloody) {   // one thin run leaves the lowest crater
    rig(c, "level", 16, 28)
    add(c, "blood", "level", [G.ribbon([P(16.4, 37.6), P(16.7, 40.4), P(16.5, 42.6)], 0.6 * c.k * Math.max(0.8, c.lineK), { taperPow: 0.2 })], null, "datum")
    rig(c, "")
  }
  // the Remina lid crease: a hairline fold along the inner curve, with a small fold at its middle
  rig(c, "crease", 28, 22)
  var ic = S.inner, cp = []
  for (var i = Math.floor(ic.length * 0.2); i < Math.floor(ic.length * 0.8); i++) cp.push(P(ic[i].x - (ic[i].x - 31.4) * 0.09, ic[i].y - (ic[i].y - 19.4) * 0.09))
  if (cp.length > 3) add(c, DARK(c) === "line" ? "line" : "line", "over", [G.ribbon(cp, 0.55 * c.k * c.lw, { taperPow: 0.5 })], null, "crease")
  rig(c, "")
  add(c, "line", "over", outline(c, body, 0.5, c.tier === 0 ? 1.7 : 1.4, { gaps: 1 }), null, "contour")
  return { body: body, S: S }
}
// fog: three horizontal wash bands (wavy stroke-and-hatch), the lowest swallowing the box edge, their ends fraying
function fogBands(c, o) {
  var rows = [[11, 18, 5, 43], [21, 28, 3, 45], [31, 38, 6, 42]], names = ["bandA", "bandB", "bandC"], out = []
  for (var b = 0; b < 3; b++) {
    var y0 = rows[b][0], y1 = rows[b][1], xa = rows[b][2], xb = rows[b][3], top = [], bot = []
    for (var i = 0; i <= 18; i++) { var t = i / 18, x = lerp(xa, xb, t), w = Math.sin(t * Math.PI * 3 + b * 1.7) * 0.9; top.push(P(x, y0 + w)); bot.push(P(x, y1 + w * 0.8)) }
    var poly = top.concat(bot.reverse()), region = G.wobble(G.resample(poly, 0.9, true), c.rand, 0.2, true)
    out.push(region)
    rig(c, names[b], 24, (y0 + y1) / 2)
    ground(c, region, "under", "fog")
    if (c.tier >= 1) toneField(c, region, function(p) { var u = Math.abs(p.x - 24) / 21, v = (p.y - y0) / (y1 - y0); return clamp((0.92 - 0.7 * Math.pow(u, 2.4) - 0.14 * v) * (c.light ? 1 : 0.5), 0.06, 0.95) }, { dir: 0, cross: false, spacing: 1.3, w: 1.0, tag: "fog-wash" })
    else add(c, LIT(c), "under", [flat(region)], null, "fog-lit")
    add(c, "line", "over", [G.ribbon(top, (b === 1 ? 1.1 : 0.9) * c.k * Math.max(0.7, c.lineK), { taperPow: 0.5 })], null, "fog-edge")
    rig(c, "")
  }
  return out
}
// a cumulus: a lit top edge of overlapping G-pen arcs, a hatched dark underside (horizontal), billows
function cloudMass(c, ox, oy, sc, o) {
  var opt = o || {}, S = sc || 1
  var T = function(pts) { return pts.map(function(p) { return P(ox + (p.x - 24) * S, oy + (p.y - 26) * S) }) }
  var bil = [[14, 28, 7.4], [22, 22, 8.6], [31, 24.2, 7.2], [37.4, 29.2, 5.6]]
  var up = []
  for (var x = 7; x <= 42; x += 0.7) { var best = 99; for (var q = 0; q < bil.length; q++) { var dx = x - bil[q][0]; if (Math.abs(dx) < bil[q][2]) best = Math.min(best, bil[q][1] - Math.sqrt(bil[q][2] * bil[q][2] - dx * dx)) } if (best < 99) up.push(P(x, best)) }
  var body = [P(7.4, 33.8)].concat(up.length ? up : [P(24, 20)]).concat([P(41.6, 33.8)])
  body = T(G.wobble(G.resample(body, 0.9, true), c.rand, 0.18, true))
  rig(c, opt.group || "cloud", ox, oy)
  ground(c, body, "under", "cloud")
  // lit top edge: tone falls toward the underside (horizontal hatch, dense below)
  var topY = oy + (14 - 26) * S, botY = oy + (34 - 26) * S
  if (c.tier >= 1) toneField(c, body, function(p) { var v = clamp((p.y - topY) / (botY - topY), 0, 1); return clamp(0.95 - (opt.dark ? 1.3 : 1.05) * Math.pow(Math.max(0, v - 0.45) / 0.55, 1.1), 0.05, 0.95) }, { dir: 0, cross: false, spacing: 1.6, tag: "cloud-tone" })
  else add(c, LIT(c), "under", [flat(G.clipAbove(body, oy - 2))], body, "cloud-lit")
  add(c, "line", "over", outline(c, body, 0.55, c.tier === 0 ? 1.7 : 1.35, { gaps: 1 }), null, "cloud-edge")
  // the billows: the joins between them as G-pen arcs (lit side), and the underside's base line
  if (c.tier >= 1) {
    var arcs = []
    for (var b = 1; b < bil.length; b++) {
      var q = bil[b], run = []
      for (var u = 0; u <= 8; u++) { var an = (200 + 70 * u / 8) * Math.PI / 180; run.push(P(ox + (q[0] + Math.cos(an) * q[2] * 0.82 - 24) * S, oy + (q[1] + Math.sin(an) * q[2] * 0.82 - 26) * S)) }
      arcs.push(G.ribbon(run, 0.5 * c.k * Math.max(0.6, c.lineK), { taperPow: 0.5 }))
    }
    add(c, "line", "over", arcs, null, "billows")
  }
  rig(c, "")
  return body
}


// ---------------------------------------------------------------------------------------------------- indicators
// Today's objects stay. "On" is the state, so accent lives only in "on", and every "on" adds less than 3 % accent (icons-v4.md section 3).
function indCoffee(c, on) {
  c.keyline = { x: 6, y: 4, w: 36, h: 36, shape: "square" }
  var body = G.wobble(G.resample([P(9, 14.4), P(33, 14.4), P(32.2, 24), P(30.4, 34), P(27, 36.6), P(15, 36.6), P(11.8, 34), P(9.8, 24)], 0.9, true), c.rand, 0.2, true)
  var handle = G.resample([P(32.6, 18.4), P(38.4, 18.2), P(40.8, 22.6), P(38.2, 28.6), P(31.2, 29.2)], 0.7, false)
  var saucer = G.ribbon([P(6.6, 39.2), P(24, 40), P(41.4, 39.2)], 1.5 * c.k * Math.max(0.35, c.lineK), { taperPow: 0.3 })
  var rimE = G.ellipse(21, 14.4, 12, 2.3, 24)
  c.silhouette = [flat(body), G.ribbon(handle, 4 * c.k, { taper: false }), saucer]
  plate(c, body, litFn(9, 14, 33, 37, 0.9), "enamel", { dir: 90, kd: 0.6 })
  // the coffee: black ink standing to 0.7 behind the glass, a blood meniscus on its surface
  var yL = 18.6
  rig(c, "fluid", 21, 28)
  if (on) {
    // black ink: on a dark bar it is the ground cut into the enamel; on a light bar a dense ink hatch (a solid fill would be the loudest mark on it)
    if (c.light || c.tier === 0) add(c, DARK(c), "under", [flat(body)], G.clipBelow(body, yL), "mass:coffee")
    else toneField(c, G.clipBelow(body, yL), function() { return 0.12 }, { dir: 0, cross: false, spacing: 1.25, w: 1.0, tag: "mass:coffee", layer: "under" })
    add(c, "blood", "level", [G.ribbon([P(10.2, yL + 0.1), P(15, yL - 0.3), P(21, yL + 0.2), P(27, yL - 0.2), P(31.8, yL + 0.1)], 0.7 * c.k * Math.max(0.35, c.lineK), { taperPow: 0.2 })], null, "datum")
  }
  rig(c, "")
  // inside: the rim ellipse, a dark tide-line ring where something dried
  add(c, "line", "over", outline(c, rimE, 0.5, 1.2, { gaps: 1 }), null, "rim")
  if (c.tier >= 1) add(c, DARK(c), "over", [G.ribbon(G.ellipse(21, 14.9, 10.6, 1.7, 22).slice(2, 16), 0.45 * c.k, { taperPow: 0.4 })], null, "tide")
  add(c, "line", "over", outline(c, body, 0.55, c.tier === 0 ? 1.8 : 1.5, { gaps: 2 }), null, "contour")
  // the handle, with its crack; the chip on the rim shows black iron
  add(c, "line", "over", [G.ribbon(handle, 2.2 * c.k * Math.max(0.35, c.lineK), { taper: false })], null, "handle")
  if (c.tier >= 1) add(c, "void", "over", [G.crack(c, P(38.4, 19), P(39.4, 22.4), 2, 0.5, 0)], null, "handle-crack")
  add(c, "line", "over", [saucer], null, "saucer")
  var chip = [P(13.2, 13.4), P(15.6, 13.2), P(15.0, 15.6), P(13.6, 15.2)]
  add(c, DARK(c) === "void" ? "line" : "void", "over", [flat(chip)], null, "chip")
  if (on) {
    drip(c, P(14.4, 15.8), 6.2, 0.7 * Math.max(0.5, c.lineK), "blood"); c.parts[c.parts.length - 1].tag = "datum"
    // steam: two thin curls that end as one hair strand
    rig(c, "steam", 22, 11.6)
    var cur = function(x0, ph) { var o = []; for (var i = 0; i <= 14; i++) { var t = i / 14; o.push(P(x0 + Math.sin(t * Math.PI * 2 + ph) * 1.5 * (1 - t * 0.3), 11.6 - t * 8.2)) } return o }
    add(c, "line", "over", [G.ribbon(cur(18.6, 0), 0.55 * c.k * Math.max(0.35, c.lineK), { taperPow: 0.5 }), G.ribbon(cur(25.2, 1.4), 0.55 * c.k * Math.max(0.35, c.lineK), { taperPow: 0.5 })], null, "steam")
    add(c, "line", "over", [G.ribbon([P(22, 3.4), P(24, 1.8), P(27.5, 1.6), P(29.8, 3.2), P(28.6, 4.6)], 0.4 * c.k * Math.max(0.35, c.lineK), { taperPow: 0.6 })], null, "hair")
    rig(c, "")
  } else {
    if (c.tier >= 2) add(c, "line", "over", [G.ribbon([P(18, 14.4), P(20, 15.6), P(23, 14.2), P(26, 15.8)], 0.35 * c.k, { taperPow: 0.4 })], null, "hair")
  }
  rig(c, "ripple", 21, 19, { hidden: true })
  add(c, "line", "over", outline(c, G.ellipse(21, 19.4, 9, 1.4, 20), 0.35, 0.7, { gaps: 1 }), null, "ripple")
  rig(c, "")
  c.highlight = { role: "paper", polys: [flat([P(11.8, 19), P(13.2, 18.4), P(13.4, 28), P(12.4, 28.4)])] }
}
function indRadio(c, on) {
  c.keyline = { x: 4, y: 4, w: 40, h: 36, shape: "landscape" }
  var body = G.wobble(G.resample(rrect(5, 17, 43, 39, 3.2), 0.9, true), c.rand, 0.15, true)
  c.silhouette = [flat(body), G.ribbon([P(35, 17.4), P(38.6, 11.4), P(41.6, 5.6)], 1.2 * c.k, { taper: false })]
  plate(c, body, litFn(5, 17, 43, 39, 0.8), "steel", { dir: 90, kd: 0.5 })
  // the grille: round holes (a 3 x 3 grid at M, 5 x 5 at L), two a hair larger and darker, like eyes
  var n = c.tier >= 2 ? 5 : 3, holes = [], big = []
  for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
    var hx = 17 + (i - (n - 1) / 2) * (12 / n) * 1.0, hy = 28 + (j - (n - 1) / 2) * (12 / n) * 1.0, eye = (i === 0 && j === 1) || (i === n - 1 && j === n - 2)
    var r = (eye ? 1.35 : 0.85) * (c.tier >= 2 ? 0.7 : 1) * (n === 3 ? 1.2 : 1)
    ;(eye ? big : holes).push(G.ellipse(hx, hy, r, r, 10))
  }
  var grille = G.ellipse(17, 28, 8.2, 8.2, 28)
  add(c, "line", "over", outline(c, grille, 0.45, 0.9, { gaps: 1 }), null, "grille")
  add(c, DARK(c) === "void" ? "void" : "line", "over", holes.map(flat), null, "holes")
  add(c, DARK(c) === "void" ? "void" : "line", "over", big.map(flat), null, "eyes")
  // tuning window with its needle, and the knob
  var win = rrect(26, 20.4, 38.4, 24.8, 0.8)
  add(c, "void", "over", [flat(win)], null, "window")
  add(c, "line", "over", outline(c, win, 0.4, 0.9, { gaps: 0 }), null, "window-edge")
  add(c, "line", "over", [G.ribbon([P(31.4, 20.6), P(31.6, 24.6)], 0.5 * c.k, { taper: false })], null, "needle")
  var knob = G.ellipse(34, 32, 3.2, 3.2, 14)
  add(c, "void", "over", [flat(knob)], null, "knob")
  add(c, "line", "over", outline(c, knob, 0.4, 1.1, { gaps: 1 }), null, "knob-edge")
  // the antenna, bent at a knuckle
  rig(c, "antenna", 35, 17.4)
  add(c, "line", "over", [G.ribbon([P(35, 17.4), P(37.6, 12.6), P(40.6, 7.4)], 1.1 * c.k * Math.max(0.35, c.lineK), { taper: false }), flat(G.ellipse(37.6, 12.6, 0.9, 0.9, 8)), flat(G.ellipse(40.8, 6.8, 0.8, 0.8, 8))], null, "antenna")
  rig(c, "")
  add(c, "line", "over", outline(c, body, 0.55, c.tier === 0 ? 1.8 : 1.5, { gaps: 2 }), null, "contour")
  // static spills out of the grille to the upper right: four short broken scratches; the tuning lamp is one blood dot
  rig(c, "static", 22, 22, on ? {} : { hidden: true })
  var sc = []
  for (var q = 0; q < 4; q++) sc.push(G.ribbon([P(22.4 + q * 1.6, 21.4 - q * 1.2), P(25.2 + q * 1.8, 17.8 - q * 1.5), P(26.6 + q * 1.9, 15.6 - q * 1.6)], 0.5 * c.k * Math.max(0.35, c.lineK), { taperPow: 0.5 }))
  add(c, "line", "over", sc, null, "static")
  rig(c, "")
  if (on) { rig(c, "lamp", 36, 22.6); dot(c, 36, 22.6, 0.85, "blood", "over", "datum"); rig(c, "") }
  c.highlight = { role: "paper", polys: [flat([P(7, 19.4), P(14, 18.6), P(14, 19.2), P(7.2, 20)])] }
}
function indFlashlight(c, on) {
  c.keyline = { x: 2, y: 12, w: 44, h: 24, shape: "landscape" }
  var head = [P(14, 15.8), P(23.4, 19.8), P(23.4, 28.2), P(14, 32.2)], tube = rrect(23, 19.6, 44, 28.4, 1.8)
  var lens = G.ellipse(14, 24, 2.8, 8.2, 20), clipR = rrect(29, 16.8, 36, 19.8, 0.8)
  var hp = G.wobble(G.resample(head, 0.9, true), c.rand, 0.12, true), tb = G.wobble(G.resample(tube, 0.9, true), c.rand, 0.12, true)
  c.silhouette = [flat(hp), flat(tb), flat(lens), flat(clipR)]
  plate(c, hp, litFn(14, 16, 24, 32, 0.9), "head", { dir: 90 })
  // the knurled tube: crosshatch
  ground(c, tb, "under", "tube")
  if (c.tier >= 1) toneField(c, tb, litFn(23, 19.6, 44, 28.4, 0.9), { dir: 60, cross: c.tier >= 2, spacing: 1.45, tag: "knurl" })
  else add(c, LIT(c), "under", [flat(G.clipAbove(tb, 24))], tb, "tube-lit")
  add(c, "line", "over", outline(c, tb, 0.5, 1.5, { gaps: 1 }), null, "tube-edge")
  add(c, "line", "over", outline(c, hp, 0.5, 1.5, { gaps: 1 }), null, "head-edge")
  base(c, clipR, 0.8, "over", "clip")
  add(c, "line", "over", outline(c, clipR, 0.4, 0.9, { gaps: 0 }), null, "clip-edge")
  // the lens: glass with a crack across it
  add(c, "void", "over", [flat(lens)], null, "lens")
  add(c, "line", "over", outline(c, lens, 0.55, 1.3, { gaps: 1 }), null, "lens-edge")
  add(c, "line", "over", [G.crack(c, P(12.6, 18), P(15.4, 30), 3, 0.5, 0)], null, "lens-crack")
  if (on) {
    // the beam: fine diverging lines leftward, fading; ash motes in it; the filament glows blood
    rig(c, "beam", 11, 24)
    var lines = []
    for (var i = 0; i < (c.tier === 1 ? 5 : 7); i++) { var nb = c.tier === 1 ? 5 : 7, k = i - (nb - 1) / 2, y1 = 24 + k * (c.tier === 1 ? 4.1 : 3.1); lines.push(G.ribbon([P(11.4, 24 + k * 1.5), P(6, 24 + k * 2.3), P(1.2, y1)], (Math.abs(k) === (nb - 1) / 2 ? 0.7 : 0.5) * c.k * Math.max(0.35, c.lineK), { taperPow: 0.6 })) }
    add(c, "line", "over", lines, null, "beam")
    add(c, "line", "over", [flat(G.ellipse(6.2, 22.4, 0.5, 0.5, 6)), flat(G.ellipse(3.6, 26, 0.45, 0.45, 6)), flat(G.ellipse(8.4, 25.2, 0.4, 0.4, 6))], null, "motes")
    rig(c, "")
    dot(c, 14.4, 24, 0.9, "blood", "over", "datum")
  }
  c.highlight = { role: "paper", polys: [flat([P(25, 20.8), P(42, 20.8), P(42, 21.5), P(25, 21.5)])] }
}
function indMoon(c, on) {
  c.keyline = { x: 6, y: 6, w: 34, h: 36, shape: "square" }
  var M = drawMoon(c, { bloody: on, tag: "moon" })
  c.silhouette = [flat(M.body)]
  c.highlight = { role: "paper", polys: [flat([P(9.6, 20), P(12.4, 15.4), P(13, 15.9), P(10.2, 20.6)])] }
}
function indFog(c, on) {
  c.keyline = { x: 3, y: 9, w: 42, h: 30, shape: "landscape" }
  var regions = fogBands(c)
  c.silhouette = regions.map(flat)
  // a ghost arc of the sun behind the middle band; on, the sun is lit: a blood disc, its lower half swallowed by the band
  rig(c, "sun", 33, 17.4)
  if (on) add(c, "blood", "under", [flat(G.ellipse(33, 17.4, 5, 5, 20))], G.clipAbove(G.ellipse(33, 17.4, 5.2, 5.2, 20), 21.4), "datum")
  else add(c, "line", "under", [G.ribbon(G.ellipse(33, 17.6, 5.4, 5.4, 22).slice(2, 15), 0.45 * c.k, { taperPow: 0.5 })], null, "ghost-sun")
  rig(c, "")
  rig(c, "figure", 24, 24, { hidden: true })
  add(c, DARK(c) === "void" ? "line" : "line", "over", [flat([P(23, 17.6), P(25, 17.6), P(25.4, 24.4), P(22.6, 24.4)])], null, "figure")
  rig(c, "")
  c.highlight = { role: "paper", polys: [flat([P(8, 11), P(15, 10.2), P(15, 10.7), P(8.2, 11.5)])] }
}
function indEye(c, on) {
  c.keyline = { x: 4, y: 12, w: 40, h: 24, shape: "landscape" }
  if (!on) {
    // a closed real eyelid: skin, the lid line, the fold above it, lashes as wet clumps, a bead of ink at the inner corner; stitched at the outer corner
    var up = [], lo = []
    for (var i = 0; i <= 20; i++) { var t = i / 20, x = lerp(6, 42, t); up.push(P(x, 24 - Math.sin(t * Math.PI) * 3.6)); lo.push(P(x, 24 + Math.sin(t * Math.PI) * 4.4)) }
    var lid = G.wobble(G.resample(up.concat(lo.reverse()), 0.8, true), c.rand, 0.12, true)
    c.silhouette = [flat(lid)]
    rig(c, "lid", 24, 24)
    plate(c, lid, litFn(6, 18, 42, 29, 0.7), "skin", { dir: 0 })
    // a light bar: the closed lid is shaded in ink lines, or it would vanish into the paper
    if (!c.light && c.tier >= 1) toneField(c, lid, function(p) { return 0.28 + 0.2 * (24 - p.y) / 5 }, { dir: 0, cross: false, spacing: 1.45, w: 0.9, tag: "lid-shade" })
    add(c, "line", "over", [G.ribbon(lo.slice().reverse().map(function(p) { return P(p.x, p.y - 0.3) }), 2.6 * c.k * Math.max(0.35, c.lineK), { taperPow: 0.35 })], null, "lid-line")
    var fold = []
    for (var f = 0; f <= 14; f++) { var tf = f / 14; fold.push(P(lerp(8, 40, tf), 19.8 - Math.sin(tf * Math.PI) * 2.6)) }
    add(c, "line", "over", [G.ribbon(fold, 0.55 * c.k, { taperPow: 0.5 })], null, "fold")
    if (!c.light && c.tier >= 1) {     // the brow: the skin between the lid and its fold, in ink lines on a light bar
      var brow = fold.concat(up.slice().reverse().map(function(p) { return P(p.x, p.y - 0.4) }))
      toneField(c, G.resample(brow, 0.8, true), function() { return 0.25 }, { dir: 0, cross: false, spacing: 1.4, w: 0.9, tag: "brow" })
    }
    var lashes = []
    for (var l = 0; l < 6; l++) { var lt = (l + 0.6) / 6.4, lx = lerp(8, 40, lt), ly = 24 + Math.sin(lt * Math.PI) * 4.6; lashes.push(G.ribbon([P(lx, ly), P(lx + (lt - 0.5) * 2.4, ly + 3.8 + (l % 2) * 0.8)], 0.8 * c.k * c.lw, { taperPow: 0.6 })) }
    add(c, "line", "over", lashes, null, "lashes")
    dot(c, 9.2, 25.4, 0.8, DARK(c) === "void" ? "line" : "line", "over", "bead")
    var st = []
    for (var s2 = 0; s2 < 3; s2++) st.push(G.ribbon([P(37.4 + s2 * 1.4, 22.2 + s2 * 0.6), P(37.8 + s2 * 1.4, 26.0 + s2 * 0.1)], 0.45 * c.k, { taperPow: 0.5 }))
    add(c, "line", "over", st, null, "stitches")
    rig(c, "")
    c.highlight = { role: "paper", polys: [flat([P(14, 21.4), P(22, 20.4), P(22, 21), P(14.2, 22)])] }
  } else {
    // the lids are open: a real eye ringed with stitches round the socket; the IRIS is blood (the recording light)
    var ea = [], eb = []
    for (var j = 0; j <= 22; j++) { var u = j / 22, ex = lerp(5, 43, u); ea.push(P(ex, 24 - Math.sin(u * Math.PI) * 9.4)); eb.push(P(ex, 24 + Math.sin(u * Math.PI) * 8.6)) }
    var eye = G.wobble(G.resample(ea.concat(eb.reverse()), 0.8, true), c.rand, 0.12, true)
    c.silhouette = [flat(eye)]
    rig(c, "eye", 24, 24)
    ground(c, eye, "under", "sclera")
    if (c.tier >= 1) toneField(c, eye, function(p) { return clamp((0.5 + 0.35 * (p.y - 24) / 9) * (c.light ? 1 : 0.4), 0.1, 0.9) }, { dir: 0, cross: false, spacing: 1.7, tag: "sclera-tone" })
    add(c, "line", "over", outline(c, eye, 0.6, c.tier === 0 ? 1.8 : 1.5, { gaps: 1 }), null, "lids")
    rig(c, "")
    rig(c, "iris", 24, 24)
    var iris = G.ellipse(24, 24, 4.7, 4.7, 22)
    add(c, "blood", "under", [flat(iris)], null, "datum")
    add(c, "void", "over", [flat(G.ellipse(24, 24, 2.3, 2.3, 12))], null, "pupil")
    if (c.tier >= 1) toneField(c, G.ellipse(24, 24, 5, 5, 20), function() { return 0.5 }, { role: "void", layer: "over", center: P(24, 24), r0: 2.8, cross: false, spacing: 1.7, w: 0.6, tag: "fibres" })
    add(c, "line", "over", [flat(G.ellipse(22.8, 22.6, 0.7, 0.7, 6))], null, "glint")
    rig(c, "")
    var sts = []
    for (var q = 0; q < 20; q++) { var a = (q + 0.3) / 20 * Math.PI * 2, rx = 19.4, ry = 19.4, p0 = P(24 + Math.cos(a) * (rx - 1.6), 24 + Math.sin(a) * (ry - 1.6)), p1 = P(24 + Math.cos(a) * (rx + 0.4), 24 + Math.sin(a) * (ry + 0.4)); sts.push(G.ribbon([p0, p1], 0.5 * c.k * Math.max(0.5, c.lineK), { taperPow: 0.4 })) }
    add(c, "line", "over", sts, null, "stitches")
    c.highlight = { role: "paper", polys: [flat([P(12, 19), P(17, 16.4), P(17.4, 17), P(12.4, 19.7)])] }
  }
}
function indTape(c, on) {
  c.keyline = { x: 4, y: 10, w: 40, h: 28, shape: "landscape" }
  var shell = G.wobble(G.resample(rrect(5, 11, 43, 37, 2.6), 0.9, true), c.rand, 0.12, true)
  c.silhouette = [flat(shell)]
  plate(c, shell, litFn(5, 11, 43, 37, 0.8), "shell", { dir: 90, kd: 0.32 })
  // the label, torn, with illegible scrawl; the window with its two reels as spirals (Uzumaki)
  var label = [P(9.6, 13.6), P(30, 13.4), P(33.2, 14.4), P(38.4, 13.8), P(38.6, 19.2), P(9.8, 19.4)]
  add(c, "void", "over", [flat(label)], null, "label")
  var scr = []
  for (var i = 0; i < 3; i++) { var yy = 15.2 + i * 1.5, pts = []; for (var j = 0; j <= 10; j++) pts.push(P(11 + j * 2.4 * (0.9 - i * 0.12), yy + Math.sin(j * 1.9 + i) * 0.35)); scr.push(G.ribbon(pts, 0.4 * c.k, { taperPow: 0.5 })) }
  add(c, "line", "over", scr, null, "scrawl")
  var win = G.wobble(G.resample(rrect(10.4, 22, 37.6, 32.6, 1.6), 0.9, true), c.rand, 0.1, true)
  if (c.light || c.tier === 0) add(c, DARK(c), "over", [flat(win)], null, "mass:window")
  else { add(c, "void", "over", [flat(win)], null, "window-ground"); toneField(c, win, function() { return 0.1 }, { dir: 0, cross: false, spacing: 1.3, w: 0.9, layer: "over", tag: "mass:window" }) }
  add(c, "line", "over", outline(c, win, 0.4, 1.0, { gaps: 1 }), null, "window-edge")
  var reel = function(cx, big) {
    var sp = [], R = big ? 4.6 : 3.8
    for (var q = 0; q <= 40; q++) { var t = q / 40, a = t * 3.1 * Math.PI * 2, r = lerp(R, 0.8, t); sp.push(P(cx + Math.cos(a) * r, 27.3 + Math.sin(a) * r)) }
    return G.ribbon(sp, 0.8 * c.k * Math.max(0.35, c.lineK), { taperPow: 0.2 })
  }
  rig(c, "reelL", 18, 27.3)
  if (on) add(c, "line", "over", [G.ribbon(G.ellipse(18, 27.3, 4.4, 4.4, 18).concat([P(22.4, 27.3)]), 1.1 * c.k * Math.max(0.5, c.lineK), { taper: false })], null, "tape-wound")
  add(c, on ? "void" : "line", "over", [reel(18, on)], null, "reel")
  rig(c, "")
  rig(c, "reelR", 30, 27.3)
  add(c, "line", "over", [reel(30, false)], null, "reel")
  rig(c, "")
  add(c, "line", "over", outline(c, shell, 0.55, c.tier === 0 ? 1.8 : 1.5, { gaps: 2 }), null, "contour")
  if (c.tier >= 1) add(c, "void", "over", [[7.4, 13.2], [40.6, 13.2], [7.4, 34.8], [40.6, 34.8]].map(function(q) { return flat(G.ellipse(q[0], q[1], 0.7, 0.7, 6)) }), null, "screws")
  if (on) { rig(c, "rec", 39.4, 14.6); dot(c, 39.4, 14.4, 1.5, "blood", "over", "datum"); rig(c, "") }
  c.highlight = { role: "paper", polys: [flat([P(7.4, 12.4), P(14, 12), P(14, 12.5), P(7.6, 12.9)])] }
}


// ---------------------------------------------------------------------------------------------------- weather skies
// From ito.weather/Sky.js: sun, moon, cloud, suncloud, rain, storm, snow, fog (day and night; the night maps sun -> moon and suncloud -> cloud).
// Weather has no alarm state, so accent appears only in the storm (icons-v4.md section 4).
// the sun: today's disc and its rays, the rays as HAIR: tapered thick-thin strands of uneven length that curl at their ends (Tomie),
// one gap at the lower right where two are missing. `half`: only the upper-right side shows (behind a cloud).
function sunAt(c, cx, cy, r, half) {
  var disc = G.wobble(G.ellipse(cx, cy, r, r, 30), c.rand, 0.1, true), rays = []
  var N = c.tier === 0 ? 8 : 13
  for (var i = 0; i < N; i++) {
    var a = (i + 0.5) / N * Math.PI * 2 - Math.PI / 2, deg = ((a * 180 / Math.PI) + 360) % 360
    if (!half && deg > 20 && deg < 62) continue                   // the gap at the lower right
    if (half && (deg > 200 && deg < 340 ? false : (deg > 120 && deg < 200 ? true : deg < 90 || deg >= 340 ? false : true))) continue
    var L = r + 5.4 + (c.rand() * 5 + (i % 3) * 1.2), a0 = a, curl = c.tier === 0 ? 0 : (i % 2 ? 0.34 : -0.3)
    var pts = []
    for (var k = 0; k <= 8; k++) { var t = k / 8, rr = lerp(r + 1.6, L, t), aa = a0 + curl * t * t; pts.push(P(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr)) }
    rays.push(G.ribbon(pts, (c.tier === 0 ? 1.4 : 1.0) * c.k * Math.max(0.5, c.lineK), { taperPow: 0.55, bias: 0.4 }))
  }
  rig(c, "rays", cx, cy)
  add(c, "line", "over", rays, null, "hair-rays")
  rig(c, "")
  ground(c, disc, "under", "sun")
  if (c.tier >= 1) toneField(c, disc, function(p) { return clamp(0.85 - 0.8 * ((p.x - cx) + (p.y - cy)) / (2 * r), 0.1, 0.9) * (c.light ? 1 : 0.5) }, { dir: 60, cross: false, spacing: 1.5, tag: "sun-tone" })
  else add(c, LIT(c), "under", [flat(G.clipAbove(disc, cy))], disc, "sun-lit")
  add(c, "line", "over", outline(c, disc, 0.5, c.tier === 0 ? 1.7 : 1.4, { gaps: 2 }), null, "sun-edge")
  return disc
}
function skySun(c) {
  c.keyline = { x: 4, y: 4, w: 40, h: 40, shape: "square" }
  var d = sunAt(c, 24, 24, 7.6, false)
  c.silhouette = [flat(G.ellipse(24, 24, 18, 18, 24))]
  c.highlight = { role: "paper", polys: [flat([P(19.4, 20), P(22, 18), P(22.4, 18.6), P(19.8, 20.7)])] }
  void d
}
function skyMoon(c) {
  c.keyline = { x: 6, y: 6, w: 34, h: 36, shape: "square" }
  var M = drawMoon(c, { bloody: false, tag: "moon" })
  add(c, "line", "over", [flat(G.ellipse(38.6, 12.6, 0.55, 0.55, 6)), flat(G.ellipse(41.4, 22.4, 0.5, 0.5, 6))], null, "stars")
  c.silhouette = [flat(M.body)]
  c.highlight = { role: "paper", polys: [flat([P(9.6, 20), P(12.4, 15.4), P(13, 15.9), P(10.2, 20.6)])] }
}
function skyCloud(c) {
  c.keyline = { x: 4, y: 12, w: 40, h: 26, shape: "landscape" }
  var body = cloudMass(c, 24, 26, 1.0, {})
  c.silhouette = [flat(body)]
  // one wet drip hangs from the underside
  rig(c, "drip", 20, 34)
  drip(c, P(20.4, 33.8), 4.6, 0.8 * Math.max(0.5, c.lineK), "line")
  rig(c, "")
  c.highlight = { role: "paper", polys: [flat([P(14, 22), P(18, 18.6), P(18.6, 19.2), P(14.6, 22.8)])] }
}
function skySuncloud(c) {
  c.keyline = { x: 3, y: 5, w: 42, h: 36, shape: "landscape" }
  sunAt(c, 33, 15, 5.6, true)
  var body = cloudMass(c, 21, 31, 0.86, {})
  c.silhouette = [flat(body), flat(G.ellipse(33, 15, 9, 9, 16))]
  c.highlight = { role: "paper", polys: [flat([P(10, 27), P(14, 24), P(14.6, 24.6), P(10.6, 27.6)])] }
}
function needles(c, base, n, w) {
  var out = [], beads = []
  for (var i = 0; i < n; i++) {
    var x = base.x0 + (i + 0.5) * (base.x1 - base.x0) / n + (c.rand() - 0.5) * 1.2, len = 5 + (i % 3) * 1.6 + c.rand() * 1.6, y0 = base.y + (i % 2) * 1.6
    var dx = -Math.sin(10 * Math.PI / 180) * len, dy = Math.cos(10 * Math.PI / 180) * len
    out.push(G.ribbon([P(x, y0), P(x + dx * 0.5, y0 + dy * 0.5), P(x + dx, y0 + dy)], w * c.k * Math.max(0.6, c.lineK), { taperPow: 0.5 }))
    if (i === 1 || i === n - 2) beads.push(P(x + dx, y0 + dy + 0.5))
  }
  return { lines: out, beads: beads }
}
function skyRain(c) {
  c.keyline = { x: 4, y: 8, w: 40, h: 34, shape: "landscape" }
  var body = cloudMass(c, 24, 20, 0.9, {})
  var nd = needles(c, { x0: 11, x1: 36, y: 30.4 }, 5, 1.0)
  rig(c, "scratches", 24, 36)
  add(c, "line", "over", nd.lines, null, "rain")
  nd.beads.forEach(function(b) { dot(c, b.x, b.y, 0.8, "line", "over", "bead") })
  rig(c, "")
  if (c.tier >= 1) add(c, "line", "over", [G.ribbon([P(10.6, 44.4), P(12.2, 43.2), P(13.8, 44.2)], 0.45 * c.k, { taperPow: 0.5 }), G.ribbon([P(31.4, 44.6), P(33, 43.2), P(34.8, 44.4)], 0.45 * c.k, { taperPow: 0.5 })], null, "splash")
  c.silhouette = [flat(body)]
  c.highlight = { role: "paper", polys: [flat([P(14, 14), P(17.6, 11.4), P(18.2, 12), P(14.6, 14.8)])] }
}
function skyStorm(c) {
  c.keyline = { x: 4, y: 8, w: 40, h: 36, shape: "landscape" }
  var body = cloudMass(c, 24, 20, 0.9, { dark: true })
  // the bolt is a CRACK (plaster breaking), in blood; a hairline crack continues up into the cloud body
  rig(c, "crack", 24, 30)
  var cr = G.crack(c, P(25, 29.4), P(22, 45), 5, 1.9 * Math.max(0.8, c.lineK), 0)
  add(c, "blood", "over", [cr], null, "datum")
  rig(c, "")
  add(c, "void", "over", [G.crack(c, P(25, 29.8), P(27.6, 18.6), 3, 0.5, 0)], null, "crack-up")
  c.silhouette = [flat(body), cr]
  c.highlight = { role: "paper", polys: [flat([P(14, 14), P(17.6, 11.4), P(18.2, 12), P(14.6, 14.8)])] }
}
function skySnow(c) {
  c.keyline = { x: 4, y: 8, w: 40, h: 34, shape: "landscape" }
  var body = cloudMass(c, 24, 20, 0.9, {})
  // ash falling (Silent Hill): irregular flecks, two smudged; two flakes are six-arm crystals with one arm broken off
  rig(c, "flecks", 24, 36)
  var fl = [[12, 33], [19, 38.4], [27, 34], [33, 40.4], [38, 33.6], [23, 43]]
  add(c, "line", "over", fl.map(function(q, i) { return flat(G.blob(q[0], q[1], (i % 2 ? 0.9 : 0.7) * c.k * 1.3, c.rand, 6, 0.5)) }), null, "ash")
  var cr = []
  ;[[16, 41], [31, 37]].forEach(function(q, qi) {
    for (var a = 0; a < 6; a++) { if (qi === 0 && a === 4) continue; var an = a * Math.PI / 3 + 0.3; cr.push(G.ribbon([P(q[0], q[1]), P(q[0] + Math.cos(an) * 2.8, q[1] + Math.sin(an) * 2.8)], 0.5 * c.k * Math.max(0.6, c.lineK), { taperPow: 0.4 })) }
  })
  add(c, "line", "over", cr, null, "crystals")
  rig(c, "")
  c.silhouette = [flat(body)]
  c.highlight = { role: "paper", polys: [flat([P(14, 14), P(17.6, 11.4), P(18.2, 12), P(14.6, 14.8)])] }
}
function skyFog(c) {
  c.keyline = { x: 3, y: 9, w: 42, h: 30, shape: "landscape" }
  var regions = fogBands(c)
  c.silhouette = regions.map(flat)
  rig(c, "figure", 24, 24, { hidden: true })
  add(c, "line", "over", [flat([P(23, 17.6), P(25, 17.6), P(25.4, 24.4), P(22.6, 24.4)])], null, "figure")
  rig(c, "")
  c.highlight = { role: "paper", polys: [flat([P(8, 11), P(15, 10.2), P(15, 10.7), P(8.2, 11.5)])] }
}
var SKY = { sun: skySun, moon: skyMoon, cloud: skyCloud, suncloud: skySuncloud, rain: skyRain, storm: skyStorm, snow: skySnow, fog: skyFog }
function drawSky(c) { var f = SKY[String(c.state.sky)]; if (f) f(c) }

var IND = { coffee: indCoffee, radio: indRadio, flashlight: indFlashlight, moon: indMoon, fog: indFog, eye: indEye, tape: indTape }
function drawIndicator(c) { var f = IND[String(c.state.version)]; if (f) f(c, !!c.state.on) }

var DRAW = { media: drawMedia, indicator: drawIndicator, sky: drawSky }

function iconParts(kind, state, sizePx, seed, opts) {
  var draw = DRAW[kind]
  if (!draw) return null
  var c = K.kit(kind, state, Math.max(8, Number(sizePx) || 29), (seed || 1) + faceSeed(kind, state), opts)
  draw(c)
  return K.finish(c)
}
// a seed per kind + face/version, so the three media buttons on the bar are a family but never identical (icons-v4.md section 0)
function faceSeed(kind, state) { var s = String((state && (state.face || state.version || state.sky)) || ""), h = 3; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973; return h }

if (typeof module !== "undefined") module.exports = { KINDS: KINDS, STATES: STATES, NOMINAL: NOMINAL, CURRENT: CURRENT, WEIGHT: WEIGHT, iconParts: iconParts, DRAW: DRAW }

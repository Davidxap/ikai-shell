.pragma library
.import "ItoIconInk.js" as Ink

// Manga icons v3 (icons-v3.md): the CURRENT icon's object, drawn as a realistic gekiga engraving, with the horror in the
// rendering and the details (a spiral groove cut into a real platter, an eye in a real chip), never instead of the object.
// Pure and seeded, the same parts format as ItoIconInk.iconParts (filled polygons with a colour role, painted in order by
// ItoIconBake), and the same roles (ItoIconInk.roles). New here:
//   tone is LUMINANCE. Every surface is given a tone (0 black .. 1 lit) and the renderer turns it into mark density by the
//   ground: on a light bar marks are dark ink (density = 1 - tone), on a dark bar marks are bone (density = tone), so a lit
//   face is lit and a shadow is dark in both themes (the v2 pilot drew dark-theme shadows as bright rims).
//   3-5 tonal steps from hatch density (ordered dither on lines that follow the form: rings on a platter, verticals on a
//   bell), drawn for a 2x bake that the bar downsamples: lines thinner than a device px become grey, which is the point.
//   one specular highlight (paper), small glints, cast shadows, rust pits, grain, cracks, wet drips.
//
//   iconParts(kind, state, sizePx, seed, opts)  opts.light: the line colour is lighter than the ground (a dark bar)
//
// Pilot kinds: disk, cpu, mem, battery, network, notifications (the six of icons-v2 section 7).

var G = Ink.geo
var P = G.P, flat = G.flat, clamp = G.clamp, lerp = G.lerp
var SUPER = 2                                    // the bake's supersampling: 2 bake px per device px
var KINDS = ["disk", "cpu", "mem", "battery", "network", "notifications"]
var STATES = {
  disk: [{ value: 0 }, { value: 0.25 }, { value: 0.5 }, { value: 0.8 }, { value: 0.95, hot: true }, { error: true }],
  cpu: [{ value: 0.1 }, { value: 0.5 }, { value: 0.8 }, { value: 0.95 }],
  mem: [{ value: 0.1 }, { value: 0.5 }, { value: 0.8 }, { value: 1 }],
  battery: [{ level: 0 }, { level: 1 }, { level: 2 }, { level: 3 }, { level: 4 }, { level: 3, charging: true }, { level: 0, critical: true }],
  network: [{ band: 0 }, { band: 1 }, { band: 2 }, { band: 3 }, { off: true }, { wired: true }],
  notifications: [{ face: "idle" }, { face: "active" }, { face: "ring" }, { face: "error" }, { face: "muted" }, { face: "dnd" }, { face: "critical" }]
}
var NOMINAL = { disk: { value: 0.5 }, cpu: { value: 0.5 }, mem: { value: 0.5 }, battery: { level: 2 }, network: { band: 2 }, notifications: { face: "idle" } }
// the PNG each kind stands in for (the recognisability test compares silhouettes with it)
var CURRENT = { disk: "system/disk.png", cpu: "system/cpu.png", mem: "system/mem.png", battery: "instruments/bat-2.png",
                network: "instruments/net-2.png", notifications: "notifications/notification.png" }
var GOLD = (Math.sqrt(5) - 1) / 2
// the engraving line: 1.8 bake px (0.9 device px), so the hatch stays visible as engraving at bar size instead of melting to flat grey
var TEX = 1.8
// light bars (ink on paper) read heavier than bone on black; every tone is lifted this much there (icons-v3 section 10.1)
var LIGHT_LIFT = 0.1

// ---------------------------------------------------------------------------------------------------- the weight budget
// Every bar icon must pull the eye as much as its neighbours (icons-v3.md section 11: the user's verdict on the live bar, "the
// manga icons stand out far more than the rest"). Two knobs per kind, calibrated by scripts/qa/icons-weight.test.mjs against
// the bar's median (today's icons) in four palettes:
//   gain   [dark bar, light bar]: how much of the heavy colour a tone puts down (1 = the full engraving; a lit face on a dark bar
//          at gain 0.4 is drawn with 40 % of its lines). Big solid faces in the heavy colour become hatch of their tone.
//   line   [dark bar, light bar]: the contours' width (1 = as drawn; never under 0.2)
//   mass   [dark bar, light bar]: for a drawing that is one solid mass cut back to the ground (scratchboard: the claw, the scar,
//          the bezel), how thick that mass is drawn (1 = as drawn)
//   scale  the drawing's size inside its box, so its longer side sits on today's 72 % keyline (pens keep their px width).
var WEIGHT = {
  disk: {  gain: [0.15, 0.15], line: [0.315, 0.453], scale: 0.855, ink: { gain: [0.15, 0.05], line: [0.315, 0.45], mass: [1, 1] }  },
  cpu: {  gain: [0.15, 1], line: [0.422, 1.162], scale: 0.866, ink: { gain: [0.15, 0.15], line: [0.422, 1] }  },
  mem: {  gain: [0.15, 0.15], line: [0.392, 0.58], scale: 0.918, ink: { gain: [0.15, 0.05], line: [0.392, 0.45], mass: [1, 1] }  },
  battery: {  gain: [0.15, 0.15], line: [0.377, 0.834], scale: 0.877, ink: { gain: [0.15, 0.15], line: [0.377, 0.724], mass: [1, 1] }  },
  network: {  gain: [0.15, 1], line: [0.694, 1.576], scale: 0.941, ink: { gain: [0.15, 1], line: [0.694, 1.436] }  },
  notifications: {  gain: [0.15, 1], line: [0.57, 1.468], scale: 0.848, ink: { gain: [0.15, 1], line: [0.57, 1.351] }  }
}
// a solid face larger than this (48-unit grid, squared) in the heavy colour is drawn as hatch instead
var SOLID_MAX = 22

// ---------------------------------------------------------------------------------------------------- kit
function kit(kind, state, size, seed, opts) {
  var c = kit0(kind, state, size, seed, opts)
  c.lw = 0.45 + 0.55 * Math.min(1, c.lineK)   // bright details (pins, lips, glints) thin with the contours
  return c
}
function kit0(kind, state, size, seed, opts) {
  var o = opts || {}
  var tier = size <= 20 ? 0 : (size <= 35 ? 1 : 2)
  // the budget holds on the bar (the M tier, 21-35 px); a popup's or a preview's large icon is the full engraving
  var NONE = { gain: [1, 1], scale: 1 }
  // the weight budget is held in both tones (icons-v6-tone.md section 3.1): `ink` (today's, the default) keeps its own light-bar entries
  var tone = o.tone === "theme" ? "theme" : "ink"
  var wt = o.weight || (tier === 1 ? (WEIGHT[kind + ":" + (state && (state.form || state.version || state.sky)) + (state && state.on ? ":on" : "")] || WEIGHT[kind + ":" + (state && (state.form || state.version || state.sky))] || WEIGHT[kind] || NONE) : NONE), lightLine = o.light !== false
  if (!o.weight && wt.ink && tone === "ink") wt = { gain: wt.ink.gain || wt.gain, line: wt.ink.line || wt.line, mass: wt.ink.mass || wt.mass, scale: wt.scale }
  var sc = wt.scale || 1
  // pens are sized for the px they land on after the drawing is scaled by `sc`
  var k = 48 / (size * sc)
  return {
    kind: kind, state: state || {}, size: size, tier: tier, k: k, kb: k / SUPER, light: lightLine,
    gain: clamp(lightLine ? wt.gain[0] : wt.gain[1], 0.05, 1), scale: sc,
    lineK: clamp(wt.line ? (lightLine ? wt.line[0] : wt.line[1]) : 1, 0.2, 2.2),
    lw: 1,
    massK: clamp(wt.mass ? (lightLine ? wt.mass[0] : wt.mass[1]) : 1, 0.3, 2.5),
    rand: Ink.rng(Ink.hash("v3|" + kind + "|" + JSON.stringify(state || {})) ^ ((seed || 1) * 2654435761)),
    parts: [], highlight: null, silhouette: [], keyline: null, lines: 0, group: "", rig: {}
  }
}
// roles for a light mark and a dark mark: on a dark bar light is the line colour and dark is the ground, on a light bar the reverse
function LIT(c) { return c.light ? "line" : "void" }
function DARK(c) { return c.light ? "void" : "line" }
function add(c, role, layer, polys, clip, tag) {
  if (!polys || polys.length === 0) return
  var part = { role: role, layer: layer, polys: polys, clip: clip ? flat(clip) : null, tag: tag || "" }
  if (c.group) { part.group = c.group; if (c.rig[c.group] && c.rig[c.group].hidden) part.hidden = true }
  c.parts.push(part)
}
// the parts added from here on move together (ItoIconMotion): `name` and its origin in the 48-unit grid; "" ends the group.
// `extra` goes into the rig entry (hidden: drawn only by a motion, never at rest; tx/ty: a direction the motion uses)
function rig(c, name, ox, oy, extra) {
  c.group = name || ""
  if (!name) return
  if (!c.rig[name]) { var r = { ox: ox, oy: oy }; for (var k in (extra || {})) r[k] = extra[k]; c.rig[name] = r }
}
// a surface of one flat tone, as one fill of the right role (the tone of the base before the hatch goes on)
// (`base`: the part is the base of a face, not a cut-out: the v6 `theme` tone does not let it cut the body wash, icons-v6-tone.md section 2)
function ground(c, region, layer, tag) { add(c, "void", layer || "under", [flat(region)], null, tag || "ground"); if (c.parts.length) c.parts[c.parts.length - 1].base = true }
// a tone as the weight budget draws it: the heavy colour (light marks on a dark bar, dark ink on a light one) is put down at `gain`
function weigh(c, t) { return c.light ? t * c.gain : 1 - (1 - t) * c.gain }
function base(c, region, tone, layer, tag, clip) {
  var heavy = c.light ? tone >= 0.5 : tone < 0.5
  // a large face in the heavy colour: hatch of its tone over the ground (the budget), unless it is the datum's mass
  if (heavy && c.gain < 0.999 && String(tag || "").indexOf("mass:") !== 0 && Math.abs(G.polyArea(region)) > SOLID_MAX) {
    add(c, "void", layer || "under", [flat(region)], clip, (tag || "base") + "-ground")
    toneField(c, region, function() { return tone }, { layer: layer || "under", dir: 45, cross: false, tag: (tag || "base") + "-hatch", clip: clip || null })
    return
  }
  add(c, tone >= 0.5 ? LIT(c) : DARK(c), layer || "under", [flat(region)], clip, tag || "base")
}

// The tone field: lines that follow the form (`dir` degrees, or rings around `center`), spaced a bake px or so apart, each
// line drawn only where the local density passes that line's own threshold (an ordered dither, so density varies smoothly
// along a line). `fn(p)` is the tone at a point (0 black, 1 lit); the marks are the opposite of the base the region was given:
// over a dark base they draw light, over a light base dark. `inc` / `exc` limit the region.
function toneField(c, region, fn, o) {
  var opt = o || {}, bb = G.bbox(region)
  // by default the region's base is the ground itself (dark on a dark bar, light on a light one) and every mark is line ink
  var baseLit = opt.baseLit === undefined ? !c.light : opt.baseLit
  var role = opt.role || (baseLit ? DARK(c) : LIT(c))
  // the weight budget, when the marks are the heavy colour: fewer lines, each one whole and crisp (a faint dither reads as grey
  // mud on the bar), so the spacing opens by 1 / gain and the tone is drawn as it is
  var sparse = !opt.role && role === "line" && c.gain < 0.999
  var w = Math.max(0.42, c.kb * (opt.w || 1.0) * TEX * (sparse ? 1.15 : 1))
  var sp = w * (opt.spacing || 1.55) / (sparse ? Math.max(0.18, c.gain) : 1)
  var inc = [region].concat(opt.inc || []), exc = opt.exc || []
  var polys = [], step = Math.max(0.45, w * 0.9)
  function dens(p) {
    if (opt.role) return clamp(fn(p), 0, 1)          // a coloured field (the datum's blood): its own density, no budget
    var t0 = clamp(fn(p) + (c.light ? 0 : LIGHT_LIFT), 0, 1), t = sparse ? t0 : weigh(c, t0)
    // the share of the region's base that the marks must cover to reach tone t
    return baseLit ? 1 - t : t
  }
  function ok(p) {
    for (var i = 0; i < inc.length; i++) if (!G.inside(inc[i], p.x, p.y)) return false
    for (var j = 0; j < exc.length; j++) if (G.inside(exc[j], p.x, p.y)) return false
    return true
  }
  function emit(span) {
    if (span.length < 2) return
    polys.push(G.ribbon(span, w, { taperPow: 0.18 }))
  }
  var maxCov = w / sp
  if (opt.center) {
    var C = opt.center, r0 = opt.r0 || 0.5, r1 = opt.r1 || Math.max(bb.x1 - C.x, C.x - bb.x0, bb.y1 - C.y, C.y - bb.y0)
    var ring = 0
    // each outline's nearest and farthest edge from the centre: a ring inside the nearest is wholly in, past the farthest wholly out
    function rspan(poly) {
      var lo = 1e9, hi = 0
      for (var i = 0; i < poly.length; i++) { var dd = Math.hypot(poly[i].x - C.x, poly[i].y - C.y); lo = Math.min(lo, dd); hi = Math.max(hi, dd) }
      return { lo: lo - 0.6, hi: hi + 0.6, poly: poly, inside: G.inside(poly, C.x, C.y) }
    }
    var incS = inc.map(rspan), excS = exc.map(rspan)
    ok = function(p) {
      var r = Math.hypot(p.x - C.x, p.y - C.y)
      for (var i = 0; i < incS.length; i++) {
        var s = incS[i]
        if (s.inside && r < s.lo) continue
        if (r > s.hi) return false
        if (!G.inside(s.poly, p.x, p.y)) return false
      }
      for (var j = 0; j < excS.length; j++) {
        var e = excS[j]
        if (r > e.hi || (!e.inside && r < e.lo)) continue
        if (e.inside && r < e.lo) return false
        if (G.inside(e.poly, p.x, p.y)) return false
      }
      return true
    }
    for (var r = r0; r <= r1; r += sp, ring++) {
      var thr = ((ring * GOLD + (opt.phase || 0.37)) % 1) * maxCov
      var n = Math.max(12, Math.ceil(2 * Math.PI * r / step)), span = []
      for (var i = 0; i <= n; i++) {
        var a = i / n * Math.PI * 2, p = P(C.x + Math.cos(a) * r, C.y + Math.sin(a) * r)
        if (ok(p) && dens(p) * maxCov > thr) span.push(p)
        else { emit(span); span = [] }
      }
      emit(span)
    }
  } else {
    var ang = (opt.dir === undefined ? 45 : opt.dir) * Math.PI / 180, d = P(Math.cos(ang), Math.sin(ang)), nr = P(-d.y, d.x)
    var cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2, half = Math.hypot(bb.x1 - bb.x0, bb.y1 - bb.y0) / 2 + 1
    // straight lines: the region is cut analytically (G.lineIv), only the density is sampled along each piece
    function family(dv, nv, phase, thr) {
      var idx = 0
      for (var off = -half; off <= half; off += sp, idx++) {
        var th = thr(idx), jit = (c.rand() - 0.5) * 0.18
        var p0 = P(cx + nv.x * (off + jit) - dv.x * half, cy + nv.y * (off + jit) - dv.y * half)
        var iv = G.lineIv(p0, dv, inc, exc)
        for (var m = 0; m < iv.length; m++) {
          var run = []
          for (var t = iv[m][0] + 0.1; t <= iv[m][1] - 0.1; t += step) {
            var q = P(p0.x + dv.x * t, p0.y + dv.y * t)
            if (dens(q) * maxCov > th) run.push(q)
            else { emit(run); run = [] }
          }
          emit(run)
        }
      }
    }
    family(d, nr, 0, function(i) { return ((i * GOLD + (opt.phase || 0.11)) % 1) * maxCov })
    // crosshatch where the density goes past what one family can carry
    if (opt.cross !== false) {
      var d2 = P(Math.cos(ang + Math.PI / 2.4), Math.sin(ang + Math.PI / 2.4)), n2 = P(-d2.y, d2.x)
      family(d2, n2, 0, function(i) { return (((i * GOLD + 0.53) % 1) * 0.5 + 0.5) * maxCov + maxCov * 0.35 })
    }
  }
  c.lines += polys.length
  add(c, role, opt.layer || "under", polys, opt.clip || null, opt.tag || "tone")
}

// a level's blood, solid; or under the weight budget (contours thinned) engraved: dense blood lines over the dark ink, with a solid
// band along its surface (`edge`, the meniscus), so the reading stays where it was
function bloodFill(c, role, layer, region, clip, tag) {
  if (c.lineK >= 0.999 || c.tier === 0) { add(c, role, layer, [flat(region)], clip, tag); return }
  toneField(c, region, function() { return 0.5 + 0.3 * c.lineK }, { role: role, layer: layer, dir: 0, cross: false, spacing: 1.5, w: 1.1, clip: clip, tag: tag })
}
// the outline: thick-thin, heavy on the side that faces the light when the line is light (a dark bar: the shadow side melts
// into the ground and breaks there), heavy on the shadow side when the line is dark (a light bar)
function outline(c, pts, thinPx, thickPx, extra) {
  var wk = c.lineK                     // the contour's share of the weight budget (WEIGHT.line)
  var o = { thin: thinPx * c.k * Math.max(0.35, wk), thick: thickPx * c.k * wk, rand: c.rand, gaps: c.tier === 0 ? 1 : 2, gapLen: 1.4 * c.k + 0.4,
            cavity: c.light, tail: false, twoWidths: c.tier === 0, litMin: 0.35 }
  for (var key in (extra || {})) o[key] = extra[key]
  if (extra && extra.cavity !== undefined) o.cavity = c.light ? !extra.cavity : extra.cavity
  return G.contour(pts, o).polys
}
function line(c, pts, wPx, role, layer, tag, clip) {
  add(c, role, layer || "over", [G.ribbon(pts, wPx * c.k, { taperPow: 0.3 })], clip, tag)
}
function dot(c, x, y, rPx, role, layer, tag) {
  add(c, role, layer || "over", [flat(G.blob(x, y, rPx * c.k, c.rand, 7, 0.3))], null, tag)
}
// rust: a cluster of pits (dark), each with a lit lip on its lower right
function rust(c, region, n, layer) {
  if (c.tier === 0) return
  var pits = G.stipple({ k: c.k, rand: c.rand }, region, [], n, 0.45, { lean: 1 })
  add(c, DARK(c), layer || "over", pits, null, "rust")
}
// a wet drip: a dark run from `p` down `len` units, a bead at its end, a glint on the bead
function drip(c, p, len, wPx, role) {
  var w = wPx * c.k, pts = [p, P(p.x + 0.2, p.y + len * 0.5), P(p.x - 0.1, p.y + len)]
  add(c, role || DARK(c), "over", [G.ribbon(G.resample(pts, 0.6, false), w, { taperPow: 0.1, bias: 0.5 }),
                                    flat(G.blob(p.x - 0.1, p.y + len + w * 0.3, w * 0.85, c.rand, 8, 0.15))], null, "drip")
}

// ---------------------------------------------------------------------------------------------------- disk
function drawDisk(c) {
  // A hard drive with its lid off (what people recognise as a hard disk): a portrait cast case, the platter exposed in its
  // well, the actuator arm across it, corner screws, the connector on the bottom edge. Ito / Silent Hill is in the details:
  // the data track is ONE engraved Uzumaki spiral and the used share is wet ink run into it from the rim; the arm is a bony
  // finger whose nail is the read head; rust and blood seep from two screws; an Amigara body-shaped slot is cut in the case.
  var st = c.state, v = clamp(Number(st.value) || 0, 0, 1), hot = !!st.hot || v > 0.9, err = !!st.error
  var X0 = 8.5, X1 = 39.5, Y0 = 3.2, Y1 = 44.8, rr = 2.6
  var caseL = [P(X0 + rr, Y0), P(X1 - rr, Y0), P(X1, Y0 + rr), P(X1, Y1 - rr), P(X1 - rr, Y1), P(X0 + rr, Y1), P(X0, Y1 - rr), P(X0, Y0 + rr)]
  var cas = G.wobble(G.resample(caseL, 1.0, true), c.rand, 0.25, true)
  c.keyline = { x: 7, y: 2, w: 34, h: 44, shape: "portrait" }
  c.silhouette = [flat(cas)]
  var PC = P(24.2, 19.6), R = c.tier === 0 ? 13.6 : 13.4
  var well = G.wobble(G.ellipse(PC.x, PC.y, R + 1.3, R + 1.3, 56), c.rand, 0.2, true)
  var disc = G.wobble(G.ellipse(PC.x, PC.y, R, R, 56), c.rand, 0.2, true)
  // the case: cast aluminium, lit from the upper left, brushed vertically; the platter well is cut into it
  ground(c, cas, "under", "case")
  function alu(p) { return clamp(0.86 - 0.5 * ((p.x - X0) / (X1 - X0) * 0.45 + (p.y - Y0) / (Y1 - Y0) * 0.55), 0.1, 0.95) }
  if (c.tier >= 1) toneField(c, cas, alu, { exc: [well], dir: 90, cross: false, spacing: 1.6, tag: "alu" })
  else add(c, LIT(c), "under", [flat(G.clipAbove(cas, 26))], cas, "case-lit")
  // the well's shadow (a dark ring inside the cut, deeper on the upper left where the wall casts it)
  base(c, well, 0.1, "under", "well")
  // the platter: mirror metal brushed in rings, two bright sectors toward the light
  // a mirror: lit base in both themes, the shading cut in as dark rings, so the black ink in the groove always reads
  if (c.light) ground(c, disc, "under", "platter"); else base(c, disc, 0.9, "under", "platter")
  var L = Math.atan2(-1, -1)
  function metal(p) {
    var a = Math.atan2(p.y - PC.y, p.x - PC.x), r = Math.hypot(p.x - PC.x, p.y - PC.y) / R
    var sheen = 0.5 + 0.5 * Math.cos(2 * (a - L)), side = 0.5 + 0.5 * Math.cos(a - L)
    return clamp(0.5 + 0.44 * sheen * (0.5 + 0.5 * side) + 0.06 * (1 - r), 0, 1)
  }
  var hubR = c.tier === 0 ? 3.6 : 3.2
  var hub = G.ellipse(PC.x, PC.y, hubR, hubR, 22)
  if (c.tier >= 1) toneField(c, disc, function(p) { return c.light ? metal(p) * 0.78 : metal(p) }, { baseLit: !c.light, center: PC, r0: hubR + 0.8, exc: [hub], w: 1.0, spacing: 1.6, tag: "brushed" })
  else add(c, DARK(c), "under", [flat(G.shift(disc, R * 0.55, R * 0.55))], disc, "platter-shade")
  // the groove: one spiral from the rim to the hub, the ink run into it from the rim inward
  var turns = c.tier === 0 ? 1.4 : (c.tier === 1 ? 2.4 : 3.4), rIn = hubR + 1.3, rOut = R - 1.2, sp = []
  for (var i = 0; i <= 220; i++) { var t = i / 220, ang = -t * turns * Math.PI * 2 - 2.2, rad = lerp(rOut, rIn, t); sp.push(P(PC.x + Math.cos(ang) * rad, PC.y + Math.sin(ang) * rad)) }
  sp = G.wobble(sp, c.rand, 0.15, false)
  add(c, DARK(c), "under", [G.ribbon(sp, (c.tier === 0 ? 1.3 : 0.65) * c.k, { taperPow: 0.12 })], null, "groove")
  // under the bar's weight budget the groove's lip, the ink's wet line and the hub's screws are left out: the drive keeps its
  // spiral, finger, screws and slot, and the eye is not pulled by the small bright marks
  var full = c.lineK >= 0.999
  if (c.tier >= 1 && full) add(c, LIT(c), "under", [G.ribbon(sp.map(function(p) { return P(p.x + 0.4 * c.k, p.y + 0.4 * c.k) }), 0.4 * c.k * c.lw, { taperPow: 0.2 })], null, "groove-lip")
  if (!err && v > 0.004) {
    var fill = sp.slice(0, Math.max(2, Math.round(sp.length * v)))
    // the ink fills most of the space between turns, so the used share reads as a black spiral at any size
    var pitch = (rOut - rIn) / turns, fw = Math.max(0.92 * pitch, 1.6 * c.k)
    add(c, DARK(c), "level", [G.ribbon(fill, fw, { taperPow: 0.06 })], null, "mass:ink")
    add(c, hot ? "warn" : "blood", "level", [G.ribbon(fill, fw * lerp(0.42, 0.78, Math.min(1, c.lineK)), { taperPow: 0.06 })], null, "datum")
    if (c.tier >= 1 && full) add(c, LIT(c), "level", [G.ribbon(fill.map(function(p) { return P(p.x - fw * 0.22, p.y - fw * 0.22) }), 0.32 * c.k * c.lw, { taperPow: 0.4 })], null, "wet")
    var f = fill[fill.length - 1]
    rig(c, "bead", f.x, f.y, { tx: PC.x, ty: PC.y })
    dot(c, f.x, f.y, c.tier === 0 ? 1.3 : 1.0, hot ? "warn" : "blood", "level", "bead")
    rig(c, "")
  }
  if (err) {   // no disk: the platter split, a black wedge torn out of it
    var wedge = [PC, P(PC.x + R * 0.15, PC.y + R * 1.05), P(PC.x + R * 0.5, PC.y + R * 0.8), P(PC.x + R * 0.36, PC.y + R * 0.6), P(PC.x + R * 0.75, PC.y + R * 0.55)]
    add(c, DARK(c), "level", [flat(G.wobble(G.resample(wedge, 0.8, true), c.rand, 0.6, true))], disc, "torn")
  }
  base(c, hub, 0.15, "over", "hub")
  add(c, "line", "over", outline(c, hub, 0.6, 1.2, { gaps: 1 }), null, "hub-ring")
  if (c.tier >= 1 && full) for (var s = 0; s < 3; s++) { var a2 = s * 2.094 - 0.6; dot(c, PC.x + Math.cos(a2) * hubR * 0.6, PC.y + Math.sin(a2) * hubR * 0.6, 0.45, LIT(c), "over", "hub-screw") }
  add(c, "line", "over", outline(c, disc, 0.5, 1.1, { gaps: 1 }), null, "platter-rim")
  // the actuator: a pivot bolt in the lower right, and the arm as a bony finger (two knuckles), its nail the read head
  var piv = P(33.2, 37.6), j1 = P(29.6, 30.4), j2 = P(25.6, 25.6), tip = P(21.6, 21.8)
  var bone = [piv, j1, j2, tip], wid = c.tier === 0 ? [4.2, 3.6, 3.1, 2.4] : [4.2, 3.6, 3.1, 2.3]
  var fpts = G.resample(bone, 0.6, false)
  var finger = G.ribbon(fpts, function(tt) { var k = tt * 3, i0 = Math.min(2, Math.floor(k)), u = k - i0; return lerp(wid[i0], wid[i0 + 1], u) * (1 + 0.18 * Math.max(0, 1 - Math.abs(u - 0) * 6) + 0.18 * Math.max(0, 1 - Math.abs(u - 1) * 6)) }, { taper: false })
  var fp = []
  for (var q = 0; q < finger.length; q += 2) fp.push(P(finger[q], finger[q + 1]))
  rig(c, "finger", piv.x, piv.y)
  if (c.tier >= 1) add(c, DARK(c), "over", [flat(G.shift(fp, 1.1 * c.k, 1.2 * c.k))], well, "finger-shadow")
  // pale bone, shaded on its lower-right side
  base(c, fp, 0.85, "over", "finger")
  if (c.tier >= 1) toneField(c, fp, function(p) { var nx = -(tip.y - piv.y), ny = tip.x - piv.x, l = Math.hypot(nx, ny), d = ((p.x - piv.x) * nx + (p.y - piv.y) * ny) / l; return clamp(0.8 + 0.25 * d, 0.2, 0.95) }, { baseLit: true, dir: 30, cross: false, spacing: 1.5, w: 0.8, layer: "over", tag: "bone" })
  add(c, "line", "over", outline(c, fp, 0.5, 1.2, { gaps: 1 }), null, "finger-edge")
  if (c.tier >= 1) {           // knuckle creases
    var cr = []
    var js = [j1, j2]
    for (var k2 = 0; k2 < 2; k2++) { var jp = js[k2]; cr.push(G.ribbon([P(jp.x - 1.3, jp.y - 0.4), P(jp.x + 0.2, jp.y + 0.5), P(jp.x + 1.3, jp.y + 0.2)], 0.38 * c.k, { taperPow: 0.5 })) }
    add(c, DARK(c), "over", cr, null, "knuckles")
  }
  var dx = tip.x - j2.x, dy = tip.y - j2.y, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l
  var nail = [P(tip.x - uy * 1.6, tip.y + ux * 1.6), P(tip.x + ux * 3.6, tip.y + uy * 3.6), P(tip.x + uy * 1.6, tip.y - ux * 1.6)]
  base(c, nail, 0.08, "over", "nail")
  rig(c, "")
  var bolt = G.ellipse(piv.x, piv.y, c.tier === 0 ? 3.4 : 3.1, c.tier === 0 ? 3.4 : 3.1, 18)
  base(c, bolt, 0.6, "over", "pivot")
  add(c, "line", "over", outline(c, bolt, 0.6, 1.4, { gaps: 1 }), null, "pivot-ring")
  dot(c, piv.x, piv.y, c.tier === 0 ? 0.9 : 0.65, DARK(c), "over", "pivot-pin")
  // screws in the corners, two weeping (rust on the left, blood on the right)
  var sc = [P(X0 + 2.6, Y0 + 2.6), P(X1 - 2.6, Y0 + 2.6), P(X0 + 2.6, Y1 - 6.4), P(X1 - 2.6, Y1 - 6.4)]
  for (var z = 0; z < sc.length; z++) {
    dot(c, sc[z].x + 0.35, sc[z].y + 0.35, c.tier === 0 ? 1.2 : 1.0, DARK(c), "over", "screw-shade")
    dot(c, sc[z].x, sc[z].y, (c.tier === 0 ? 1.1 : 0.9) * c.lw, LIT(c), "over", "screw")
    if (c.tier >= 1) add(c, DARK(c), "over", [G.ribbon([P(sc[z].x - 0.6, sc[z].y + 0.5), P(sc[z].x + 0.6, sc[z].y - 0.5)], 0.35 * c.k, { taper: false })], null, "screw-slot")
  }
  if (c.tier >= 1) {
    rig(c, "weep", sc[1].x, sc[1].y + 1.1)
    drip(c, P(sc[1].x, sc[1].y + 1.1), 3.2, 0.6, "blood")
    rig(c, "")
    drip(c, P(sc[0].x + 0.2, sc[0].y + 1.0), 2.0, 0.5)
    rust(c, G.wobble(G.ellipse(X0 + 4.5, Y1 - 10, 2.6, 4.5, 14), c.rand, 0.4, true), c.tier === 1 ? 4 : 10)
  }
  // the connector on the bottom edge: a dark slot with lit pins
  var cn = [P(14, Y1 - 3.4), P(34, Y1 - 3.4), P(34, Y1 - 0.6), P(14, Y1 - 0.6)]
  base(c, cn, 0.05, "over", "connector")
  if (c.tier >= 1) {
    var pins = []
    for (var pn = 0; pn < 7; pn++) { var px = 15.8 + pn * 2.7; pins.push(G.ribbon([P(px, Y1 - 2.9), P(px, Y1 - 1.2)], 0.6 * c.k * c.lw, { taper: false })) }
    add(c, LIT(c), "over", pins, null, "pins")
  }
  // the Amigara slot: a small body-shaped hole cut in the case, lower left
  var am = [P(0, -3.6), P(1.1, -3.1), P(1.0, -2.0), P(1.9, -1.4), P(2.0, 1.2), P(1.1, 2.8), P(0.2, 4.4), P(-0.2, 4.4), P(-1.1, 2.8), P(-2.0, 1.2), P(-1.9, -1.4), P(-1.0, -2.0), P(-1.1, -3.1)]
  var slot = G.xform(am.map(function(p) { return P(p.x * 1.55, p.y * 1.35) }), -6, 14.2, 37.0, 0, 0)
  base(c, slot, 0.03, "over", "mass:amigara")
  if (c.tier >= 1) add(c, LIT(c), "over", [G.ribbon(slot.slice(5, 10).map(function(p) { return P(p.x + 0.4, p.y + 0.3) }), 0.35 * c.k, { taperPow: 0.4 })], null, "slot-lip")
  add(c, "line", "over", outline(c, cas, 0.7, c.tier === 0 ? 2.0 : 1.8), null, "contour")
  if (c.tier === 2) {          // static over the lower case: a few scratches of interference
    var stc = []
    for (var n = 0; n < 6; n++) { var yy = 30 + c.rand() * 8, xx = X0 + 2 + c.rand() * 6; stc.push(G.ribbon([P(xx, yy), P(xx + 1.6 + c.rand() * 2, yy)], 0.35, { taper: false })) }
    add(c, LIT(c), "over", stc, null, "static")
  }
  var hl = []
  for (var h = 0; h <= 8; h++) { var ah = -2.45 + h * 0.07; hl.push(P(PC.x + Math.cos(ah) * R * 0.8, PC.y + Math.sin(ah) * R * 0.8)) }
  for (var h2 = 8; h2 >= 0; h2--) { var ah2 = -2.45 + h2 * 0.07; hl.push(P(PC.x + Math.cos(ah2) * R * 0.71, PC.y + Math.sin(ah2) * R * 0.71)) }
  c.highlight = { role: "paper", polys: [flat(hl)] }
}

// ---------------------------------------------------------------------------------------------------- cpu
// Today's chip with four pins a side, drawn as a real package: a bevelled lid lit from the upper left, metal pins (two bent,
// rusted), a cast shadow. The spiral of today's icon is ENGRAVED in the lid; the load is wet ink running into it from the
// outer end; a blood bead at the front; above 0.85 the core is warn.
function drawCpu(c) {
  var v = clamp(Number(c.state.value) || 0, 0, 1), CX = 24, CY = 24, H = 13.2, B = c.tier === 0 ? 2.2 : 2.4
  var pk = G.wobble([P(CX - H, CY - H), P(CX + H, CY - H), P(CX + H, CY + H), P(CX - H, CY + H)].map(function(p) { return p }), c.rand, 0, true)
  pk = G.resample(pk, 1.2, true)
  pk = G.wobble(pk, c.rand, 0.3, true)
  var lid = G.wobble(G.resample([P(CX - H + B, CY - H + B), P(CX + H - B, CY - H + B), P(CX + H - B, CY + H - B), P(CX - H + B, CY + H - B)], 1.2, true), c.rand, 0.25, true)
  c.keyline = { x: 4, y: 4, w: 40, h: 40, shape: "square" }
  var sil = [flat(pk)]
  // pins: four a side, metal with a lit and a dark half; two bent, one snapped
  var pins = [], pinD = [], offs = [-9, -3, 3, 9], plen = c.tier === 0 ? 5.6 : 5.8, pw = c.tier === 0 ? 2.4 : 2.0
  var sides = [[0, -1], [1, 0], [0, 1], [-1, 0]]
  for (var s = 0; s < 4; s++) for (var i = 0; i < 4; i++) {
    var dx = sides[s][0], dy = sides[s][1], o = offs[i], idx = s * 4 + i
    var bx = CX + (dx ? dx * H : o), by = CY + (dy ? dy * H : o)
    var len = idx === 9 && c.tier > 0 ? plen * 0.45 : plen * (0.9 + c.rand() * 0.15)
    var end = P(bx + dx * len, by + dy * len)
    if (idx === 2 || idx === 13) end = P(end.x + dy * 1.8, end.y + dx * 1.8)
    var pts = [P(bx, by), P(bx + dx * len * 0.6, by + dy * len * 0.6), end]
    pins.push(G.ribbon(pts, pw * (c.tier === 0 ? 1 : c.lw), { taperPow: 0.05, bias: 0.5 }))
    sil.push(G.ribbon(pts, pw + 0.6, { taper: false }))
    if (c.tier >= 1) pinD.push(G.ribbon(pts.map(function(p) { return P(p.x + (dy ? 0.55 : 0), p.y + (dx ? 0.55 : 0)) }), pw * 0.45, { taperPow: 0.1 }))
  }
  c.silhouette = sil
  // cast shadow to the lower right (only shows on a light bar: on a dark bar a shadow is the ground)
  if (c.tier >= 1 && !c.light) toneField(c, G.shift(pk, 2.6, 2.6), function() { return 0.25 }, { exc: [pk], tag: "cast", cross: false })
  add(c, LIT(c), "under", pins, null, "pins")
  add(c, DARK(c), "under", pinD, null, "pins-shade")
  // the package: bevel faces (top and left lit, bottom and right dark), the lid a mid tone, hatched at 45 degrees
  ground(c, pk, "under", "package")
  var bevelLit = G.wobble(G.resample([P(CX - H, CY + H), P(CX - H, CY - H), P(CX + H, CY - H), P(CX + H - B, CY - H + B), P(CX - H + B, CY - H + B), P(CX - H + B, CY + H - B)], 1.2, true), c.rand, 0.2, true)
  if (c.tier >= 1) toneField(c, pk, function(p) { return G.inside(bevelLit, p.x, p.y) ? 0.92 : 0.28 }, { exc: [lid], dir: 45, spacing: 1.4, tag: "bevels" })
  else add(c, LIT(c), "under", [flat(bevelLit)], pk, "bevel-lit")
  if (c.light) ground(c, lid, "under", "lid"); else base(c, lid, 0.62, "under", "lid", null)
  if (c.tier >= 1) toneField(c, lid, function(p) { var t = ((p.x - (CX - H)) + (p.y - (CY - H))) / (4 * H); return (0.9 - 0.3 * t) * (c.light ? 0.72 : 1) }, { baseLit: !c.light, dir: 45, cross: false, spacing: 2.0, tag: "lid-tone" })
  // the engraved spiral
  var turns = c.tier === 0 ? 1.4 : (c.tier === 1 ? 2.2 : 2.7), R = H - B - 1.8, t0 = c.tier === 0 ? 0.18 : 0.1
  var sp = []
  for (var q = 0; q <= 160; q++) { var t = lerp(1, t0, q / 160), an = t * turns * Math.PI * 2 + 0.4; sp.push(P(CX + 0.3 + Math.cos(an) * R * t, CY + 0.2 + Math.sin(an) * R * t)) }
  sp = G.wobble(sp, c.rand, 0.2, false)
  rig(c, "spiral", CX + 0.3, CY + 0.2)
  add(c, DARK(c), "under", [G.ribbon(sp, (c.tier === 0 ? 1.4 : 0.7) * c.k, { taperPow: 0.15 })], null, "groove")
  if (c.tier >= 1) add(c, LIT(c), "under", [G.ribbon(sp.map(function(p) { return P(p.x + 0.4 * c.k, p.y + 0.4 * c.k) }), 0.4 * c.k * c.lw, { taperPow: 0.3 })], null, "groove-lip")
  if (v > 0.004) {
    var fill = sp.slice(0, Math.max(2, Math.round(sp.length * v)))
    add(c, DARK(c), "level", [G.ribbon(fill, (c.tier === 0 ? 2.6 : 2.8) * c.k, { taperPow: 0.06 })], null, "mass:ink")
    add(c, v > 0.85 ? "warn" : "blood", "level", [G.ribbon(fill, (c.tier === 0 ? 1.6 : 1.7 * lerp(0.6, 1, Math.min(1, c.lineK))) * c.k, { taperPow: 0.06 })], null, "datum")
    if (c.tier >= 1) add(c, LIT(c), "level", [G.ribbon(fill.map(function(p) { return P(p.x - 0.3 * c.k, p.y - 0.3 * c.k) }), 0.32 * c.k * c.lw, { taperPow: 0.4 })], null, "wet")
    var fr = fill[fill.length - 1]
    dot(c, fr.x, fr.y, c.tier === 0 ? 1.3 : 1.0, v > 0.85 ? "warn" : "blood", "level", "bead")
    rig(c, "core", CX + 0.3, CY + 0.2)
    if (v > 0.85) add(c, "warn", "level", [flat(G.blob(CX + 0.3, CY + 0.2, c.tier === 0 ? 3.2 : 2.8, c.rand, 9, 0.3))], null, "hot-core")
    rig(c, "")
    // ink brimming over the groove's outer end and running down the lid
    if (c.tier >= 1 && v > 0.3) drip(c, P(sp[0].x, sp[0].y + 0.4), 3.2 + v * 2, 0.75)
  }
  rig(c, "")
  add(c, "line", "over", outline(c, pk, 0.7, c.tier === 0 ? 2.0 : 1.9), null, "contour")
  if (c.tier >= 1) add(c, "line", "over", outline(c, lid, 0.35, 0.8, { gaps: 1 }), null, "lid-edge")
  dot(c, CX - H + B + 2.2, CY - H + B + 2.2, c.tier === 0 ? 0 : 0.55, DARK(c), "over", "pin1")
  if (c.tier >= 1) rust(c, G.wobble(G.ellipse(CX + H - 1, CY + H - 1, 4.5, 4.5, 14), c.rand, 0.4, true), c.tier === 1 ? 5 : 10)
  var hp = [P(CX - H + 0.8, CY - H + 6.5), P(CX - H + 0.8, CY - H + 0.8), P(CX - H + 7, CY - H + 0.8), P(CX - H + 6.8, CY - H + 1.6), P(CX - H + 1.6, CY - H + 1.7), P(CX - H + 1.6, CY - H + 6.4)]
  c.highlight = { role: "paper", polys: [flat(hp)] }
}

// ---------------------------------------------------------------------------------------------------- mem
// Today's module with three eye windows and its legs below, drawn as a real board: a dark laminate with copper traces, three
// epoxy chips, and in each chip a real eye (lid, crease, lashes, iris, a wet glint) that opens with the memory in use; the
// last one bloodshot when full. Gold fingers below, one corroded; mould on the board.
function drawMem(c) {
  var v = clamp(Number(c.state.value) || 0, 0, 1), X0 = 4.5, X1 = 43.5, Y0 = 10.5, Y1 = 34
  var board = G.wobble(G.resample([P(X0, Y0), P(X1, Y0), P(X1, Y1), P(X0, Y1)], 1.2, true), c.rand, 0.3, true)
  c.keyline = { x: 2, y: 7, w: 44, h: 34, shape: "landscape" }
  var sil = [flat(board)]
  // legs: six gold fingers below the board (today's icon), metal two-tone, one green with corrosion (a dark lump)
  var legs = [], legD = []
  for (var i = 0; i < 6; i++) {
    var x = lerp(X0 + 5, X1 - 5, i / 5), len = c.tier === 0 ? 5.6 : 5.4 + (c.rand() - 0.5) * 0.8
    var pts = [P(x, Y1), P(x + 0.1, Y1 + len)]
    legs.push(G.ribbon(pts, c.tier === 0 ? 2.4 : 2.0 * c.lw, { taper: false }))
    sil.push(G.ribbon(pts, 2.6, { taper: false }))
    if (c.tier >= 1) legD.push(G.ribbon([P(x + 0.55, Y1 + 0.3), P(x + 0.6, Y1 + len)], 0.8, { taper: false }))
  }
  c.silhouette = sil
  add(c, LIT(c), "under", legs, null, "legs")
  add(c, DARK(c), "under", legD, null, "legs-shade")
  // the board: dark laminate, horizontal grain, lighter toward the lit top edge; copper traces as thin lit lines
  ground(c, board, "under", "board")
  var boardTone = function(p) { return 0.46 - 0.24 * (p.y - Y0) / (Y1 - Y0) - 0.08 * (p.x - X0) / (X1 - X0) }
  if (c.tier >= 1) toneField(c, board, boardTone, { dir: 0, cross: false, spacing: 1.7, tag: "grain" })
  var chips = [], cw = 5.4, ch = 7.9, xs = [12.0, 24.0, 36.0], cy = (Y0 + Y1) / 2 - 1.8
  for (var k = 0; k < 3; k++) chips.push(G.wobble(G.resample([P(xs[k] - cw, cy - ch), P(xs[k] + cw, cy - ch), P(xs[k] + cw, cy + ch), P(xs[k] - cw, cy + ch)], 1.0, true), c.rand, 0.2, true))
  if (c.tier >= 1) {
    var tr = []
    for (var j = 0; j < 4; j++) {
      var tx = lerp(X0 + 3, X1 - 3, (j + 0.5) / 4) + 2.2
      tr.push(G.ribbon([P(tx, Y1 - 0.6), P(tx, Y1 - 3.2), P(tx + 1.6, Y1 - 4.6)], 0.42 * c.k * c.lw, { taper: false }))
    }
    add(c, LIT(c), "under", tr, null, "traces")
    // each window sits on a row of tiny solder legs, and the frame is bevelled (lit top and left, dark bottom and right)
    var legsS = [], bev = []
    for (var cl = 0; cl < 3; cl++) {
      for (var lg = 0; lg < 4; lg++) { var lx = xs[cl] - cw + 1.6 + lg * (2 * cw - 3.2) / 3; legsS.push(G.ribbon([P(lx, cy + ch + 0.2), P(lx, cy + ch + 1.6)], 0.5 * c.k * c.lw, { taper: false })) }
      bev.push(G.ribbon([P(xs[cl] + cw + 0.5, cy - ch + 0.6), P(xs[cl] + cw + 0.5, cy + ch + 0.5), P(xs[cl] - cw + 0.6, cy + ch + 0.5)], 0.55 * c.k, { taper: false }))
    }
    add(c, LIT(c), "under", legsS, null, "solder")
    add(c, DARK(c), "under", bev, null, "bevel")
    add(c, LIT(c), "under", G.stipple({ k: c.k, rand: c.rand }, board, chips, c.tier === 1 ? 8 : 16, 0.4, { lean: 1 }), null, "mould")
    // the strip under the windows: small surface parts (dark bodies, lit solder caps) on a copper trace, one burnt
    var smd = [], caps = [], strip = cy + ch + 2.9
    for (var sm = 0; sm < 5; sm++) {
      var sx0 = lerp(X0 + 5.5, X1 - 7.5, sm / 4) + (c.rand() - 0.5)
      smd.push(flat([P(sx0, strip - 0.8), P(sx0 + 2.6, strip - 0.8), P(sx0 + 2.6, strip + 0.8), P(sx0, strip + 0.8)]))
      caps.push(G.ribbon([P(sx0 + 0.3, strip - 0.7), P(sx0 + 0.3, strip + 0.7)], 0.55 * c.k * c.lw, { taper: false }), G.ribbon([P(sx0 + 2.3, strip - 0.7), P(sx0 + 2.3, strip + 0.7)], 0.55 * c.k * c.lw, { taper: false }))
    }
    add(c, LIT(c), "under", [G.ribbon([P(X0 + 2, strip + 1.6), P(X1 - 2, strip + 1.5)], 0.4 * c.k * c.lw, { taper: false })], null, "trace")
    add(c, DARK(c), "under", smd, null, "smd")
    add(c, LIT(c), "under", caps, null, "smd-caps")
  }
  // the windows of today's icon: grey glass lit from the upper left; the memory in use is black ink standing in all three,
  // its surface ragged and stained, rising behind the eyes
  for (var m = 0; m < 3; m++) {
    // a heavy dark frame first, so the three windows stay three windows at bar size
    var frame = G.wobble(G.resample([P(xs[m] - cw - 1.3, cy - ch - 1.3), P(xs[m] + cw + 1.3, cy - ch - 1.3), P(xs[m] + cw + 1.3, cy + ch + 1.3), P(xs[m] - cw - 1.3, cy + ch + 1.3)], 1.0, true), c.rand, 0.2, true)
    base(c, frame, 0.04, "under", "frame")
    if (c.tier >= 2) toneField(c, frame, function(p) { return 0.32 }, { exc: [chips[m]], dir: 45, cross: false, spacing: 1.6, tag: "frame-metal" })
    if (c.light) ground(c, chips[m], "under", "window"); else base(c, chips[m], 0.8, "under", "window")
    toneField(c, chips[m], (function(X) { return function(p) { return (0.9 - 0.5 * ((p.x - (X - cw)) / (2 * cw) * 0.4 + (p.y - (cy - ch)) / (2 * ch) * 0.6)) * (c.light ? 0.7 : 1) } })(xs[m]), { baseLit: !c.light, dir: 45, cross: false, spacing: c.tier === 2 ? 1.7 : 2.6, tag: "glass" })
  }
  var yL = (cy + ch) - v * 2 * ch
  if (v > 0.004) for (var w = 0; w < 3; w++) {
    var surf = []
    for (var sx = 0; sx <= 8; sx++) surf.push(P(xs[w] - cw - 1 + sx * (2 * cw + 2) / 8, yL + (sx % 2 ? 0.35 : -0.25) * c.k + (c.rand() - 0.5) * 0.4))
    add(c, DARK(c), "level", [flat(G.levelPoly(surf, cy + ch + 3))], chips[w], "mass:ink")
    bloodFill(c, v > 0.9 ? "warn" : "blood", "level", G.levelPoly(surf.map(function(p) { return P(p.x, p.y + 0.9 * c.k) }), cy + ch + 3), chips[w], "datum")
    if (c.tier >= 1) add(c, "blood", "level", [G.ribbon(surf, 0.75 * c.k * c.lw, { taper: false, bias: 0.2 })], chips[w], "datum")
  }
  var eyes = []
  for (var e = 0; e < 3; e++) {
    var op = Math.round(clamp(v * 3 - e, 0, 1) * 8) / 8
    var ex = xs[e], ey = cy + 0.4, ew = cw * 0.92, eh = lerp(0.3, ch * 0.78, op)
    var almond = []
    for (var a = 0; a <= 14; a++) { var tt = a / 14; almond.push(P(lerp(ex - ew, ex + ew, tt), ey - Math.sin(Math.PI * tt) * eh * 0.62 + (tt - 0.5) * 0.8)) }
    for (var b = 14; b >= 0; b--) { var t2 = b / 14; almond.push(P(lerp(ex - ew, ex + ew, t2), ey + Math.sin(Math.PI * t2) * eh * 0.55 + (t2 - 0.5) * 0.8)) }
    eyes.push({ x: ex, y: ey, op: op, almond: almond, eh: eh, ew: ew })
  }
  for (var q = 0; q < 3; q++) {
    var E = eyes[q]
    rig(c, "eye" + q, E.x, E.y)
    if (E.op >= 0.25) {
      add(c, c.light ? "void" : "void", "over", [flat(E.almond.map(function(p) { return P(E.x + (p.x - E.x) * 1.18, E.y + (p.y - E.y) * 1.3) }))], null, "eye-halo")
      base(c, E.almond, 0.86, "over", "sclera")
      if (c.tier >= 2) toneField(c, E.almond, function(p) { return 0.9 - 0.45 * Math.max(0, (p.y - (E.y - E.eh * 0.6)) / (E.eh + 0.1)) }, { baseLit: true, dir: 0, cross: false, spacing: 1.8, layer: "over", tag: "sclera-shade" })
      var ir = Math.min(E.eh * 0.62, E.ew * 0.5), iris = G.ellipse(E.x + 0.4, E.y + 0.2, ir, ir, 16)
      rig(c, "iris" + q, E.x, E.y)
      // full: the last eye is bloodshot, and that IS the reading (the datum)
      add(c, q === 2 && v >= 0.92 ? "blood" : DARK(c), "over", [flat(iris)], E.almond, q === 2 && v >= 0.92 ? "datum" : "mass:iris")
      if (c.tier >= 2 && !(q === 2 && v >= 0.92)) add(c, LIT(c), "over", [flat(G.ellipse(E.x + 0.4, E.y + 0.2, ir * 0.62, ir * 0.62, 14))], E.almond, "iris-ring")
      add(c, DARK(c), "over", [flat(G.ellipse(E.x + 0.4, E.y + 0.2, ir * 0.42, ir * 0.42, 12))], E.almond, "pupil")
      if (c.tier >= 1) dot(c, E.x - ir * 0.25, E.y - ir * 0.3, 0.35, LIT(c), "over", "glint")
      if (q === 2 && v >= 0.92 && c.tier >= 1) {
        add(c, "blood", "over", [G.ribbon([P(E.x - E.ew + 0.6, E.y + 0.3), P(E.x - ir - 0.2, E.y + 0.1)], 0.35 * c.k, { taperPow: 0.4 }),
                                   G.ribbon([P(E.x + E.ew - 0.6, E.y - 0.2), P(E.x + ir + 0.3, E.y + 0.4)], 0.35 * c.k, { taperPow: 0.4 })], E.almond, "datum")
      }
    }
    // the lids: the upper lid heavy, a crease above it, lashes; shut: a curved line with lashes hanging down
    rig(c, "eye" + q, E.x, E.y)
    var upper = E.almond.slice(0, 15)
    add(c, DARK(c), "over", [G.ribbon(upper, (E.op < 0.25 ? 0.9 : 0.75) * c.k, { taperPow: 0.35 })], null, "lid")
    if (c.tier >= 1) {
      add(c, DARK(c), "over", [G.ribbon(upper.slice(2, 13).map(function(p) { return P(p.x, p.y - 1.3) }), 0.35 * c.k, { taperPow: 0.5 })], null, "crease")
      var lashes = []
      for (var l = 0; l < 5; l++) {
        var lp = upper[2 + l * 2.5 | 0], down = E.op < 0.25 ? 1 : -1
        lashes.push(G.ribbon([lp, P(lp.x + (l - 2) * 0.35, lp.y + down * 1.3)], 0.32 * c.k, { taperPow: 0.6 }))
      }
      add(c, DARK(c), "over", lashes, null, "lashes")
    }
    rig(c, "")
  }
  add(c, "line", "over", outline(c, board, 0.7, c.tier === 0 ? 2.0 : 1.8), null, "contour")
  for (var z = 0; z < 3; z++) if (c.tier >= 1) add(c, "line", "over", outline(c, chips[z], 0.35, 0.7, { gaps: 1 }), null, "chip-rim")
  if (c.tier >= 1) {
    add(c, DARK(c), "over", [G.crack({ k: c.k, rand: c.rand }, P(X1 - 0.5, Y0 + 0.5), P(X1 - 4, Y0 + 5), 2, 0.6, 0)], null, "crack")
    add(c, DARK(c), "over", [flat(G.blob(lerp(X0 + 5, X1 - 5, 0.8) + 0.2, Y1 + 3.6, 1.5, c.rand, 8, 0.6))], null, "corrosion")
    rust(c, G.wobble(G.ellipse(X0 + 4, Y1 - 3, 3.5, 2.5, 12), c.rand, 0.4, true), c.tier === 1 ? 4 : 9)
  }
  c.highlight = { role: "paper", polys: [flat([P(X0 + 1, Y0 - 0.6), P(X0 + 9, Y0 - 0.9), P(X0 + 8.8, Y0 + 0.4), P(X0 + 1.2, Y0 + 0.6)])] }
}

// ---------------------------------------------------------------------------------------------------- battery
// Today's cell with its terminal, filling left to right, drawn as a rusted iron cylinder lying down: shaded top to bottom like
// a cylinder, rivets bleeding rust, a sight glass along it. The charge is a wet black fluid in the glass with a swollen front,
// a blood stain on the front and a glint on top. Charging: a crack bolt through the glass. Critical: a warn drip at the terminal.
function drawBattery(c) {
  var st = c.state, v = clamp((Number(st.level) || 0) / 4, 0, 1), X0 = 4, X1 = 40.5, Y0 = 14, Y1 = 34.5
  var cell = G.wobble(G.resample([P(X0 + 2.5, Y0), P(X1 - 2, Y0), P(X1, Y0 + 2), P(X1, Y1 - 2), P(X1 - 2, Y1), P(X0 + 2.5, Y1), P(X0, Y1 - 2.5), P(X0, Y0 + 2.5)], 1.2, true), c.rand, 0.3, true)
  var cap = G.wobble(G.resample([P(X1, 19.4), P(X1 + 3.6, 19.6), P(X1 + 4.3, 21), P(X1 + 4.3, 27.6), P(X1 + 3.6, 29), P(X1, 29.2)], 0.9, true), c.rand, 0.2, true)
  c.keyline = { x: 2, y: 7, w: 44, h: 34, shape: "landscape" }
  c.silhouette = [flat(cell), flat(cap)]
  function cyl(p) { var t = (p.y - Y0) / (Y1 - Y0); return clamp(0.86 - 1.0 * Math.pow(t, 0.9) + 0.25 * Math.max(0, 0.25 - Math.abs(t - 0.18)) * 3, 0.05, 0.95) }
  ground(c, cell, "under", "casing")
  if (c.tier >= 1) toneField(c, cell, cyl, { dir: 0, cross: false, spacing: 1.5, tag: "cylinder" })
  else add(c, LIT(c), "under", [flat(G.clipAbove(cell, Y0 + 7))], null, "casing-lit")
  ground(c, cap, "under", "cap")
  if (c.tier >= 1) toneField(c, cap, cyl, { dir: 0, cross: false, spacing: 1.5, tag: "cap-tone" })
  // the sight glass
  var gx0 = X0 + 3.4, gx1 = X1 - 3.4, gy0 = Y0 + 4.6, gy1 = Y1 - 4.6
  var glass = G.wobble(G.resample([P(gx0 + 1, gy0), P(gx1 - 1, gy0), P(gx1, gy0 + 1), P(gx1, gy1 - 1), P(gx1 - 1, gy1), P(gx0 + 1, gy1), P(gx0, gy1 - 1), P(gx0, gy0 + 1)], 1.0, true), c.rand, 0.2, true)
  // empty glass is lit (the light comes through it), so the black fluid reads against it in both themes
  // the glass is the ground seen through it (dark on a dark bar, paper on a light one) with a faint reflection, so the blood reads
  ground(c, glass, "under", "glass")
  if (c.tier >= 1) toneField(c, glass, function(p) { return c.light ? 0.16 : 0.82 }, { dir: 0, cross: false, spacing: 2.2, tag: "glass-tone" })
  // the fluid: black, filling from the left, its front swollen and stained
  var xf = lerp(gx0, gx1, v)
  if (v > 0) {
    var front = []
    for (var i = 0; i <= 10; i++) { var t = i / 10; front.push(P(xf + Math.sin(Math.PI * t) * 1.3 + (c.rand() - 0.5) * 0.5, lerp(gy0 - 1, gy1 + 1, t))) }
    var fluid = [P(gx0 - 1, gy0 - 1)].concat(front).concat([P(gx0 - 1, gy1 + 1)])
    rig(c, "fluid", gx0, (gy0 + gy1) / 2)
    add(c, DARK(c), "level", [flat(fluid)], glass, "mass:fluid")
    // the fluid is blood (the accent where the state lives), a dark rim of clot along its front; warn when low
    var lowB = (Number(st.level) || 0) <= 1 || st.critical
    bloodFill(c, lowB ? "warn" : "blood", "level", fluid.map(function(p) { return P(p.x - 1.0 * c.k, p.y) }), G.wobble(G.resample([P(gx0 + 0.6, gy0 + 0.6), P(gx1 - 0.6, gy0 + 0.6), P(gx1 - 0.6, gy1 - 0.6), P(gx0 + 0.6, gy1 - 0.6)], 1, true), c.rand, 0, true), "datum")
    if (c.tier >= 1) {
      add(c, LIT(c), "level", [G.ribbon([P(gx0 + 1, gy0 + 1.1), P(Math.max(gx0 + 1.5, xf - 1.5), gy0 + 1.2)], 0.45 * c.k, { taperPow: 0.3 })], glass, "wet")
      add(c, "blood", "level", [G.ribbon(front, 0.95 * c.k * c.lw, { taper: false, bias: 0.2 })], glass, "stain")
    } else add(c, "blood", "level", [G.ribbon(front, 1.0 * c.k, { taper: false })], glass, "stain")
    // a bubble that only an omen shows (ItoIconMotion): hidden at rest, it rises through the fluid
    if (c.tier >= 1 && xf - gx0 > 3) {
      var bx = lerp(gx0, xf, 0.45), by = gy1 - 1.3
      rig(c, "bubble", bx, by, { hidden: true, rise: gy1 - gy0 - 2.6 })
      add(c, LIT(c), "level", [flat(G.ellipse(bx, by, 0.95, 0.95, 12))], glass, "bubble")
      add(c, DARK(c), "level", [flat(G.ellipse(bx + 0.15, by + 0.15, 0.5, 0.5, 10))], glass, "bubble")
    }
    rig(c, "")
  }
  if (st.charging) {
    var bolt = [P(xf + 2.5, gy0 - 1.5), P(xf - 0.5, (gy0 + gy1) / 2 + 0.3), P(xf + 3, (gy0 + gy1) / 2 - 0.6), P(xf + 0.2, gy1 + 1.5)]
    rig(c, "bolt", xf + 1, (gy0 + gy1) / 2)
    add(c, DARK(c), "level", [G.ribbon(G.resample(bolt, 0.8, false), 2.0 * c.k, { taperPow: 0.4 })], null, "bolt-edge")
    add(c, LIT(c), "level", [G.ribbon(G.resample(bolt, 0.8, false), 0.9 * c.k, { taperPow: 0.4 })], null, "bolt")
    rig(c, "")
  }
  add(c, "line", "over", outline(c, glass, 0.45, 1.0, { cavity: true, gaps: 1 }), null, "glass-rim")
  // rivets along top and bottom, two weeping rust
  if (c.tier >= 1) {
    var rv = [X0 + 5, (X0 + X1) / 2, X1 - 5]
    for (var r = 0; r < 3; r++) for (var row = 0; row < 2; row++) {
      var ry = row ? Y1 - 2.3 : Y0 + 2.3
      dot(c, rv[r] + 0.4, ry + 0.4, 0.7, DARK(c), "over", "rivet-shade")
      dot(c, rv[r], ry, 0.62 * c.lw, LIT(c), "over", "rivet")
    }
    drip(c, P(rv[0] + 0.3, Y0 + 3.1), 1.6, 0.5)
    drip(c, P(rv[2] + 0.2, Y1 - 1.4), 2.6, 0.55)
    rust(c, G.wobble(G.ellipse(X1 - 6, Y1 - 3, 5, 2.4, 14), c.rand, 0.4, true), c.tier === 1 ? 5 : 12)
  }
  // four claw gouges dragged across the casing and the glass (something tried to get in, or out)
  var claws = [], lips = []
  for (var cl = 0; cl < 4; cl++) {
    var cx0 = X0 + 17 + cl * 2.4, g0 = P(cx0, Y0 - 0.6), g1 = P(cx0 + 5.2, Y1 + 0.2)
    var gp = G.wobble(G.resample([g0, P((g0.x + g1.x) / 2 + 0.3, (g0.y + g1.y) / 2), g1], 0.8, false), c.rand, 0.25, false)
    claws.push(G.ribbon(gp, (c.tier === 0 ? 1.1 : 0.85) * c.k, { taperPow: 0.6 }))
    if (c.tier >= 1) lips.push(G.ribbon(gp.map(function(p) { return P(p.x + 0.45 * c.k, p.y + 0.2 * c.k) }), 0.35 * c.k * c.lw, { taperPow: 0.6 }))
  }
  add(c, DARK(c), "over", claws, cell, "claws")
  add(c, LIT(c), "over", lips, cell, "claw-lips")
  add(c, "line", "over", outline(c, cell, 0.75, c.tier === 0 ? 2.0 : 1.9), null, "contour")
  add(c, "line", "over", outline(c, cap, 0.6, 1.4, { gaps: 1 }), null, "cap-edge")
  rig(c, "tdrip", st.critical ? X1 + 3.4 : X1 + 2.6, 29.2)
  if (c.tier >= 1 && !st.critical) drip(c, P(X1 + 2.6, 29.2), 2.4, 0.75, "blood")
  if (st.critical) drip(c, P(X1 + 3.4, 29.2), 4.2, 1.1, "warn")
  rig(c, "")
  // the one highlight: a reflection streak across the glass
  var hx = gx0 + 3.2
  c.highlight = { role: "paper", polys: [flat([P(hx, gy0 + 0.5), P(hx + 1.5, gy0 + 0.5), P(hx - 0.4, gy1 - 0.5), P(hx - 1.6, gy1 - 0.5)])] }
}

// ---------------------------------------------------------------------------------------------------- network
// Today's three arcs and the diamond under them, drawn as bent iron bands (a lit upper edge, a dark underside, thickness)
// over a faceted iron nail head. Unlit bands are ghosts: a broken hairline and static dust. A wet drip hangs from the middle
// band. Off: today's spiral, as an iron band wound inward, stained. Wired: today's port as a real RJ45 socket.
function drawNetwork(c) {
  var st = c.state
  c.keyline = { x: 2, y: 7, w: 44, h: 34, shape: "landscape" }
  if (st.wired) return drawPort(c)
  if (st.off) return drawSpiralOff(c)
  // today's geometry: three arcs of 90 degrees over the nail, radii 9.5 / 17 / 24.5 from it
  var band = clamp(Math.round(Number(st.band) || 0), 0, 3), GC = P(24, 35.2), A0 = -136, A1 = -44
  var RAD = [9.4, 16.9, 24.4], TH = c.tier === 0 ? [4.0, 4.2, 4.4] : [3.4, 3.6, 3.8]
  var sil = []
  var dia = [P(GC.x, GC.y - 3.6), P(GC.x + 3.2, GC.y), P(GC.x, GC.y + 3.6), P(GC.x - 3.2, GC.y)]
  rig(c, "bands", GC.x, GC.y)
  for (var b = 0; b < 3; b++) {
    var r = RAD[b], th = TH[b], lit = b < band
    var a0 = A0 + b * 1.2, a1 = A1 - b * 1.2
    var outer = [], inner = []
    for (var i = 0; i <= 30; i++) {
      var a = (a0 + (a1 - a0) * i / 30) * Math.PI / 180
      var sag = Math.sin(Math.PI * i / 30) * 0.6
      outer.push(P(GC.x + Math.cos(a) * (r + th / 2 + sag * 0.3), GC.y + Math.sin(a) * (r + th / 2 + sag * 0.3)))
      inner.unshift(P(GC.x + Math.cos(a) * (r - th / 2), GC.y + Math.sin(a) * (r - th / 2)))
    }
    var poly = G.wobble(outer.concat(inner), c.rand, 0.25, true)
    sil.push(flat(poly))
    if (lit) {
      ground(c, poly, "under", "band")
      if (c.tier >= 1) toneField(c, poly, (function(R0, T0) { return function(p) {
        var rr = Math.hypot(p.x - GC.x, p.y - GC.y), u = (rr - (R0 - T0 / 2)) / T0
        var ang = Math.atan2(p.y - GC.y, p.x - GC.x), side = 0.5 + 0.5 * Math.cos(ang - Math.atan2(-1, -1))
        return clamp(0.08 + 0.85 * Math.pow(u, 1.3) * (0.55 + 0.45 * side), 0, 1)
      } })(r, th), { center: GC, r0: r - th / 2, r1: r + th / 2 + 0.6, w: 0.9, spacing: 1.45, tag: "iron" })
      else add(c, LIT(c), "under", [flat(outer.concat(inner.map(function(p) { return P(GC.x + (p.x - GC.x) * (r / (r - th / 2)) * 0.98, GC.y + (p.y - GC.y) * (r / (r - th / 2)) * 0.98) })))], poly, "band-lit")
      add(c, "line", "over", outline(c, poly, 0.6, c.tier === 0 ? 1.8 : 1.5, { gaps: 1 }), null, "contour")
      // barbs: the band is wound with wire, short twisted spikes on its outer edge (Silent Hill's fences)
      var barbs = [], nb = c.tier === 0 ? 2 : 3 + b
      for (var bb2 = 0; bb2 < nb; bb2++) {
        var ab = (a0 + (a1 - a0) * (bb2 + 0.5) / nb) * Math.PI / 180, ro = r + th / 2
        var bp = P(GC.x + Math.cos(ab) * ro, GC.y + Math.sin(ab) * ro), tg = P(-Math.sin(ab), Math.cos(ab)), nr2 = P(Math.cos(ab), Math.sin(ab))
        var bl = (c.tier === 0 ? 2.6 : 2.0)
        barbs.push(G.ribbon([P(bp.x - tg.x * bl * 0.6 - nr2.x * 0.4, bp.y - tg.y * bl * 0.6 - nr2.y * 0.4), P(bp.x + tg.x * bl * 0.6 + nr2.x * bl * 0.8, bp.y + tg.y * bl * 0.6 + nr2.y * bl * 0.8)], (c.tier === 0 ? 1.0 : 0.6) * c.k, { taperPow: 0.5 }))
        barbs.push(G.ribbon([P(bp.x + tg.x * bl * 0.6 - nr2.x * 0.4, bp.y + tg.y * bl * 0.6 - nr2.y * 0.4), P(bp.x - tg.x * bl * 0.6 + nr2.x * bl * 0.8, bp.y - tg.y * bl * 0.6 + nr2.y * bl * 0.8)], (c.tier === 0 ? 1.0 : 0.6) * c.k, { taperPow: 0.5 }))
      }
      add(c, "line", "over", barbs, null, "barbs")
    } else {
      // a ghost: the band's hollow outline in a broken hairline (the shape stays, the iron is gone), static dust in it
      var ghost = [], gl = []
      for (var g = 0; g <= 40; g++) {
        var ag = (a0 + (a1 - a0) * g / 40) * Math.PI / 180
        if ((g % 8) < 6) gl.push(P(GC.x + Math.cos(ag) * r, GC.y + Math.sin(ag) * r))
        else { if (gl.length > 1) ghost.push(G.ribbon(gl, (c.tier === 0 ? 1.0 : 0.5) * c.k, { taperPow: 0.3 })); gl = [] }
      }
      if (gl.length > 1) ghost.push(G.ribbon(gl, (c.tier === 0 ? 1.0 : 0.5) * c.k, { taperPow: 0.3 }))
      add(c, "line", "under", ghost, null, "contour")
      if (c.tier >= 1) add(c, "line", "under", G.stipple({ k: c.k, rand: c.rand }, poly, [], 5 + b * 3, 0.35, {}), null, "static")
    }
  }
  if (band >= 2 && c.tier >= 1) drip(c, P(GC.x + 1.2, GC.y - RAD[1] + TH[1] / 2 - 0.2), 2.6, 0.7)
  rig(c, "")
  // the nail head: four facets lit from the upper left
  ground(c, dia, "over", "nail")
  var C0 = P(GC.x - 0.2, GC.y - 0.3)
  add(c, LIT(c), "over", [flat([dia[3], dia[0], C0])], null, "facet-lit")
  add(c, DARK(c), "over", [flat([dia[1], dia[2], C0])], null, "facet-dark")
  if (c.tier >= 1) toneField(c, dia, function(p) { return p.x > C0.x ? 0.5 : 0.35 }, { dir: 45, spacing: 1.5, w: 0.8, exc: [[dia[3], dia[0], C0], [dia[1], dia[2], C0]], cross: false, layer: "over", tag: "facets" })
  add(c, "line", "over", outline(c, dia, 0.6, 1.5, { gaps: 1 }), null, "nail-edge")
  // the nail is driven into something that bleeds
  rig(c, "ndrip", GC.x + 0.4, GC.y + 3.6)
  drip(c, P(GC.x + 0.4, GC.y + 3.6), band === 0 ? 3.2 : 2.2, c.tier === 0 ? 1.2 : 0.9, band === 0 ? "warn" : "blood")
  c.parts[c.parts.length - 1].tag = "datum"
  rig(c, "")
  sil.push(flat(dia))
  // the silhouette: today's fan (the outer band and the nail), filled
  var fan = [GC]
  for (var f = 0; f <= 24; f++) { var af = (A0 + (A1 - A0) * f / 24) * Math.PI / 180; fan.push(P(GC.x + Math.cos(af) * (RAD[2] + TH[2] / 2), GC.y + Math.sin(af) * (RAD[2] + TH[2] / 2))) }
  c.silhouette = [flat(fan), flat(dia)]
  c.highlight = { role: "paper", polys: [flat([P(GC.x - 2.4, GC.y - 0.9), P(GC.x - 0.4, GC.y - 2.9), P(GC.x - 0.1, GC.y - 2.3), P(GC.x - 1.9, GC.y - 0.5)])] }
  void sil
}
function drawSpiralOff(c) {
  var C = P(24, 25.5), R = 18.5, turns = 2.3, sp = []
  for (var i = 0; i <= 180; i++) { var t = i / 180, a = t * turns * Math.PI * 2 + 1.2, r = R * (1 - t * 0.86); sp.push(P(C.x + Math.cos(a) * r, C.y + Math.sin(a) * r * 0.96)) }
  sp = G.wobble(sp, c.rand, 0.25, false)
  rig(c, "spiral", C.x, C.y)
  var w = function(t) { return lerp(c.tier === 0 ? 4.6 : 3.8, 1.2, t) }
  var bandPoly = G.ribbon(sp, function(t) { return w(t) }, { taperPow: 0.05 })
  var pts = []
  for (var q = 0; q < bandPoly.length; q += 2) pts.push(P(bandPoly[q], bandPoly[q + 1]))
  ground(c, pts, "under", "band")
  if (c.tier >= 1) toneField(c, pts, function(p) { var a = Math.atan2(p.y - C.y, p.x - C.x); return 0.25 + 0.6 * (0.5 + 0.5 * Math.cos(a - Math.atan2(-1, -1))) }, { dir: 45, spacing: 1.5, tag: "iron" })
  add(c, "line", "over", outline(c, pts, 0.5, 1.4, { gaps: 2 }), null, "contour")
  add(c, "blood", "level", [G.ribbon(sp, function(t) { return lerp(c.tier === 0 ? 2.2 : 1.7, 0.7, t) * c.k }, { taperPow: 0.2 })], null, "datum")
  dot(c, sp[sp.length - 1].x, sp[sp.length - 1].y, 1.2, "blood", "level", "bead")
  if (c.tier >= 1) drip(c, P(sp[40].x, sp[40].y + 1.5), 3, 0.65)
  rig(c, "")
  c.silhouette = [flat(G.ellipse(C.x, C.y, R + 2, (R + 2) * 0.96, 30))]
  c.keyline = { x: 4, y: 4, w: 40, h: 40, shape: "circle" }
  c.highlight = { role: "paper", polys: [flat([P(C.x - R * 0.72, C.y - R * 0.42), P(C.x - R * 0.5, C.y - R * 0.72), P(C.x - R * 0.46, C.y - R * 0.64), P(C.x - R * 0.66, C.y - R * 0.36)])] }
}
function drawPort(c) {
  var X0 = 7, X1 = 41, Y0 = 10.5, Y1 = 33, LX0 = 18, LX1 = 30, LY = 38.5
  var shroud = G.wobble(G.resample([P(X0, Y0), P(X1, Y0), P(X1, Y1), P(LX1 + 2.5, Y1), P(LX1 + 2.5, LY), P(LX0 - 2.5, LY), P(LX0 - 2.5, Y1), P(X0, Y1)], 1.0, true), c.rand, 0.25, true)
  var cav = G.wobble(G.resample([P(X0 + 3, Y0 + 3), P(X1 - 3, Y0 + 3), P(X1 - 3, Y1 - 2.5), P(LX1, Y1 - 2.5), P(LX1, LY - 2.6), P(LX0, LY - 2.6), P(LX0, Y1 - 2.5), P(X0 + 3, Y1 - 2.5)], 0.9, true), c.rand, 0.2, true)
  c.silhouette = [flat(shroud)]
  ground(c, shroud, "under", "shroud")
  if (c.tier >= 1) toneField(c, shroud, function(p) { return 0.85 - 0.6 * ((p.x - X0) / (X1 - X0) * 0.4 + (p.y - Y0) / (LY - Y0) * 0.6) }, { exc: [cav], dir: 90, cross: false, spacing: 1.6, tag: "steel" })
  base(c, cav, 0.04, "under", "mass:cavity")
  var n = c.tier === 0 ? 4 : 6, pins = []
  for (var i = 0; i < n; i++) {
    var x = lerp(X0 + 6.5, X1 - 6.5, i / (n - 1))
    pins.push(G.ribbon([P(x, Y0 + 4.2), P(x, Y0 + (c.tier === 0 ? 10 : 9.5))], (c.tier === 0 ? 2.2 : 1.5) * Math.max(1, c.k * 0.5), { taper: false }))
  }
  add(c, LIT(c), "over", pins, null, "contacts")
  if (c.tier >= 1) dot(c, X1 - 5.5, Y0 + 4.8, 1.2, "blood", "over", "led")
  add(c, "line", "over", outline(c, shroud, 0.7, c.tier === 0 ? 2.0 : 1.8), null, "contour")
  add(c, "line", "over", outline(c, cav, 0.4, 0.9, { cavity: true, gaps: 1 }), null, "cavity-rim")
  if (c.tier >= 1) { drip(c, P(LX0 + 1.5, LY - 0.2), 2.4, 0.6); rust(c, G.wobble(G.ellipse(X1 - 4, Y1 - 1.5, 3.5, 2, 12), c.rand, 0.3, true), c.tier === 1 ? 4 : 9) }
  c.highlight = { role: "paper", polys: [flat([P(X0 + 0.8, Y0 + 6), P(X0 + 0.8, Y0 + 0.8), P(X0 + 7, Y0 + 0.8), P(X0 + 6.8, Y0 + 1.6), P(X0 + 1.6, Y0 + 1.6), P(X0 + 1.6, Y0 + 6)])] }
}

// ---------------------------------------------------------------------------------------------------- notifications
// Today's bell with the spiral on its body and the eye for a clapper, cast in bronze: shaded like a cylinder (lit left, dark
// right), the spiral engraved, a thick lip with a black mouth, the crown knob. The clapper is a real eyeball on a cord.
// active: the bell swings, a blood bead at the crown, tremor lines. dnd: the eye shut (today's dnd). error: a crack, a drip.
// muted: the cord cut. critical: warn, the eye wide.
function drawBell(c) {
  var face = String(c.state.face || "idle")
  var swing = face === "active" ? 5 : (face === "ring" ? -5 : (face === "muted" ? 2.5 : 0))
  var PIV = P(24, 5.5)
  c.rig.bell = { ox: PIV.x, oy: PIV.y }
  c.keyline = { x: 7, y: 2, w: 34, h: 44, shape: "portrait" }
  var prof = [[2.6, 7.6], [6.4, 8.8], [9.2, 11.4], [10.8, 15.6], [11.4, 21], [12.1, 26.4], [13.6, 30.6], [15.8, 33.4], [17.2, 34.8]]
  var right = prof.map(function(q) { return P(24 + q[0], q[1]) })
  var left = prof.slice().reverse().map(function(q) { return P(24 - q[0] * 1.01, q[1]) })
  var body0 = right.concat([P(24 + 17.4, 36.2), P(24 + 9, 37.3), P(24, 37.6), P(24 - 9, 37.3), P(24 - 17.4, 36.1)]).concat(left)
  var T = function(pts) { return G.xform(pts.map(function(p) { return P(p.x - PIV.x, p.y - PIV.y) }), swing, PIV.x, PIV.y, 0, 0) }
  var body = T(G.wobble(G.resample(body0, 1.0, true), c.rand, 0.3, true))
  var lipF = T(G.ellipse(24, 36.2, 17.2, 2.4, 30))
  var mouth = T(G.ellipse(24, 35.3, 15.4, 1.6, 26))
  var knob = T(G.ellipse(24, 6.2, 2.6, 2.2, 14))
  var shut = face === "dnd", wide = face === "critical"
  var eyeC = T([P(24, 41.6)])[0], er = c.tier === 0 ? 3.3 : 3.0
  var eye = G.ellipse(eyeC.x, eyeC.y, er * 1.15, shut ? er * 0.55 : er, 18)
  c.silhouette = [flat(body), flat(lipF), flat(knob), flat(eye)]
  // bronze: a cylinder lit from the left, the shoulder brighter, the right side in shadow
  ground(c, body, "under", "bronze")
  function bronze(p) {
    var u = clamp((p.x - (eyeC.x - 17)) / 34, 0, 1), sh = clamp((p.y - 8) / 30, 0, 1)
    return clamp(0.95 - 0.8 * Math.pow(u, 1.2) + 0.08 * (1 - sh), 0.08, 0.97)
  }
  if (c.tier >= 1) toneField(c, body, bronze, { dir: 90 + swing, spacing: 1.5, tag: "bronze-tone" })
  else add(c, LIT(c), "under", [flat(G.clipAbove(T(G.ellipse(19.5, 22, 7, 16, 20)), 40))], body, "bronze-lit")
  // the engraved spiral on the body (today's spiral)
  var sp = [], turns = c.tier === 0 ? 1.4 : (c.tier === 1 ? 2.2 : 2.8), R = c.tier === 0 ? 6.6 : 7.0
  for (var i = 0; i <= 140; i++) { var t = lerp(1, 0.1, i / 140), a = t * turns * Math.PI * 2 + 2.6; sp.push(P(24 + Math.cos(a) * R * t, 23.5 + Math.sin(a) * R * t * 1.08)) }
  sp = T(G.wobble(sp, c.rand, 0.15, false))
  add(c, DARK(c), "under", [G.ribbon(sp, (c.tier === 0 ? 1.5 : 0.9) * c.k, { taperPow: 0.2 })], null, "groove")
  if (c.tier >= 1) add(c, LIT(c), "under", [G.ribbon(sp.map(function(p) { return P(p.x + 0.4 * c.k, p.y + 0.4 * c.k) }), 0.38 * c.k * c.lw, { taperPow: 0.3 })], null, "groove-lip")
  // the lip: a lit band, the mouth black above it
  base(c, lipF, 0.7, "over", "lip")
  if (c.tier >= 1) toneField(c, lipF, function(p) { return clamp(0.85 - 0.75 * (p.x - (eyeC.x - 17)) / 34, 0.05, 0.9) }, { baseLit: true, dir: 90, cross: false, spacing: 1.5, layer: "over", tag: "lip-tone" })
  base(c, mouth, 0.03, "over", "mass:mouth")
  add(c, "line", "over", outline(c, body, 0.7, c.tier === 0 ? 2.0 : 1.9), null, "contour")
  add(c, "line", "over", outline(c, lipF, 0.5, 1.4, { gaps: 1 }), null, "lip-edge")
  base(c, knob, 0.6, "over", "knob")
  add(c, "line", "over", outline(c, knob, 0.5, 1.2, { gaps: 1 }), null, "knob-edge")
  // do not disturb: the bell is bound in bandages (Silent Hill's nurses), stitched across, muffled
  if (shut) {
    rig(c, "bandage", 7, 20)
    // under the bandages the bell is in shadow (on a dark bar; on a light one the ink would swallow the bandages)
    add(c, DARK(c), "over", [flat(body)], null, "bound")
    var wraps = [[10, 14, -18], [18, 22, -12], [26, 30, -7]]
    for (var wi = 0; wi < wraps.length; wi++) {
      var yA = wraps[wi][0], yB = wraps[wi][1], tilt = wraps[wi][2]
      var strip = T(G.xform([P(-22, yA - 18), P(22, yA - 18), P(22, yB - 18), P(-22, yB - 18)], tilt, 24, 18, 0, 0))
      add(c, LIT(c), "over", [flat(strip)], body, "bandage")
      if (c.tier >= 1) {
        toneField(c, strip, function(p) { return 0.95 - 0.35 * clamp((p.x - 7) / 34, 0, 1) }, { inc: [body], baseLit: true, dir: tilt, cross: false, spacing: 1.6, layer: "over", tag: "bandage-tone" })
        var e0 = strip.slice(0, 2), e1 = strip.slice(2, 4)
        add(c, DARK(c), "over", [G.ribbon(e0, 0.5 * c.k, { taper: false }), G.ribbon(e1, 0.5 * c.k, { taper: false })], body, "bandage-edge")
        var stt = []
        for (var sti = 0; sti < 4; sti++) {
          var u = 0.2 + sti * 0.2, m0 = P(lerp(strip[0].x, strip[1].x, u), lerp(strip[0].y, strip[1].y, u)), m1 = P(lerp(strip[3].x, strip[2].x, u), lerp(strip[3].y, strip[2].y, u))
          stt.push(G.ribbon([P(lerp(m0.x, m1.x, 0.2) - 0.8, lerp(m0.y, m1.y, 0.2)), P(lerp(m0.x, m1.x, 0.8) + 0.8, lerp(m0.y, m1.y, 0.8))], 0.4 * c.k, { taper: false }))
        }
        add(c, DARK(c), "over", stt, body, "stitches")
      }
    }
    rig(c, "")
  }
  // the cord and the eye
  var cordTop = T([P(24, 37.4)])[0]
  add(c, "line", "over", [G.ribbon([cordTop, P(eyeC.x, eyeC.y - er)], Math.max(0.9, 0.6 * c.k), { taper: false })], null, "cord")
  if (face === "muted") add(c, "void", "over", [G.ribbon([P(cordTop.x - 1.5, cordTop.y + 1.3), P(cordTop.x + 1.5, cordTop.y + 1.0)], 1.0 * c.k, { taper: false })], null, "cut")
  rig(c, "eye", eyeC.x, eyeC.y)
  if (shut) {
    base(c, eye, 0.1, "over", "mass:lid")
    var lidL = []
    for (var l = 0; l <= 10; l++) { var tl = l / 10; lidL.push(P(eyeC.x - er * 1.1 + tl * er * 2.2, eyeC.y + Math.sin(Math.PI * tl) * er * 0.35)) }
    add(c, LIT(c), "over", [G.ribbon(lidL, 0.7 * c.k, { taperPow: 0.3 })], null, "lid")
    var ls = []
    for (var q = 0; q < 5; q++) { var lp = lidL[1 + q * 2]; ls.push(G.ribbon([lp, P(lp.x + (q - 2) * 0.4, lp.y + 1.5)], 0.4 * c.k, { taperPow: 0.6 })) }
    if (c.tier >= 1) add(c, LIT(c), "over", ls, null, "lashes")
  } else {
    base(c, eye, 0.88, "over", "sclera")
    if (c.tier >= 1) toneField(c, eye, function(p) { return 0.92 - 0.6 * clamp((p.x - eyeC.x + er) / (2 * er) * 0.5 + (p.y - eyeC.y + er) / (2 * er) * 0.5, 0, 1) }, { baseLit: true, dir: 45, cross: false, spacing: 1.6, layer: "over", tag: "sclera-shade" })
    var ir = wide ? er * 0.45 : er * 0.62
    rig(c, "iris", eyeC.x, eyeC.y)
    add(c, wide ? "warn" : (face === "active" || face === "ring" ? "blood" : DARK(c)), "over", [flat(G.ellipse(eyeC.x + 0.3, eyeC.y + 0.3, ir, ir, 14))], eye, "mass:iris")
    add(c, DARK(c), "over", [flat(G.ellipse(eyeC.x + 0.3, eyeC.y + 0.3, ir * 0.45, ir * 0.45, 10))], eye, "pupil")
    rig(c, "eye", eyeC.x, eyeC.y)
    add(c, "line", "over", outline(c, eye, 0.45, 1.0, { gaps: 1 }), null, "eye-rim")
  }
  rig(c, "")
  if (face === "active" || face === "critical") {
    dot(c, knob[3].x + 2.6, knob[3].y + 2.0, c.tier === 0 ? 2.0 : 1.7, face === "critical" ? "warn" : "blood", "over", "bead")
    c.parts[c.parts.length - 1].tag = "datum"
    drip(c, P(knob[3].x + 2.6, knob[3].y + 3.2), 3.2, 0.8, face === "critical" ? "warn" : "blood")
    c.parts[c.parts.length - 1].tag = "datum"
  }
  if (face === "error") {
    var e0 = T([P(36.5, 35.5)])[0], e1 = T([P(31, 25)])[0]
    add(c, DARK(c), "over", [G.crack({ k: c.k, rand: c.rand }, e0, e1, 3, 0.9, 0)], null, "crack")
    drip(c, T([P(33, 37)])[0], 3.2, 0.9, "blood")
  }
  if (face === "ring" || face === "active") {
    var tr = []
    for (var s2 = -1; s2 <= 1; s2 += 2) for (var m = 0; m < (c.tier === 0 ? 1 : 2); m++) {
      var x0 = 24 + s2 * (19.6 + m * 2.6), pts = []
      for (var z = 0; z <= 6; z++) pts.push(P(x0 + Math.sin(z * 1.7 + m) * 0.6, 14 + m * 3 + z * 2.0))
      tr.push(G.ribbon(pts, (c.tier === 0 ? 1.4 : 0.9 - m * 0.2) * c.k, { taperPow: 0.5 }))
    }
    add(c, "line", "over", tr, null, "tremor")
  }
  if (c.tier >= 1) rust(c, T(G.wobble(G.ellipse(32.5, 30, 3.4, 4.5, 14), c.rand, 0.4, true)), c.tier === 1 ? 5 : 11)
  // the one highlight: a sharp sliver on the bronze shoulder, upper left
  c.highlight = { role: "paper", polys: [flat(T([P(16.6, 14.4), P(18.2, 11.4), P(18.9, 11.8), P(17.6, 15.0)]))] }
}

var DRAW = { disk: drawDisk, cpu: drawCpu, mem: drawMem, battery: drawBattery, network: drawNetwork, notifications: drawBell }

function iconParts(kind, state, sizePx, seed, opts) {
  var draw = DRAW[kind]
  if (!draw) return null
  var c = kit(kind, state, Math.max(8, Number(sizePx) || 29), seed, opts)
  draw(c)
  return finish(c)
}
// the drawn kit as the bake's parts: thin polygons dropped, every polygon wound alike, the layers in paint order
function finish(c) {
  var kind = c.kind
  if (c.scale !== 1) scaleAll(c, c.scale)
  var ORDER = { under: 0, level: 1, over: 2 }
  for (var o = 0; o < c.parts.length; o++) { c.parts[o].polys = c.parts[o].polys.filter(function(p) { return p.length >= 6 }).map(G.orient); c.parts[o].n = o }
  c.parts = c.parts.filter(function(p) { return p.polys.length > 0 })
  c.parts.sort(function(a, b) { return ORDER[a.layer] - ORDER[b.layer] || a.n - b.n })
  var strokes = 0
  for (var i = 0; i < c.parts.length; i++) { delete c.parts[i].n; strokes += c.parts[i].polys.length }
  if (c.highlight) c.highlight.polys = c.highlight.polys.map(G.orient)
  return { kind: kind, state: c.state, size: c.size, tier: c.tier, k: c.k, light: c.light, supersample: SUPER,
           parts: c.parts, highlight: c.highlight, silhouette: c.silhouette, keyline: c.keyline, strokes: strokes, paths: c.parts.length,
           rig: c.rig }
}

// the whole drawing scaled about the box centre (the weight budget's optical size)
function scaleAll(c, sc) {
  function sp(a) { if (!a) return a; var o = []; for (var i = 0; i < a.length; i += 2) o.push(+(24 + (a[i] - 24) * sc).toFixed(3), +(24 + (a[i + 1] - 24) * sc).toFixed(3)); return o }
  for (var i = 0; i < c.parts.length; i++) { c.parts[i].polys = c.parts[i].polys.map(sp); if (c.parts[i].clip) c.parts[i].clip = sp(c.parts[i].clip) }
  if (c.highlight) c.highlight.polys = c.highlight.polys.map(sp)
  c.silhouette = c.silhouette.map(sp)
  if (c.keyline) c.keyline = { x: 24 + (c.keyline.x - 24) * sc, y: 24 + (c.keyline.y - 24) * sc, w: c.keyline.w * sc, h: c.keyline.h * sc, shape: c.keyline.shape }
  for (var g in c.rig) {
    var r = c.rig[g]
    r.ox = 24 + (r.ox - 24) * sc; r.oy = 24 + (r.oy - 24) * sc
    if (r.tx !== undefined) { r.tx = 24 + (r.tx - 24) * sc; r.ty = 24 + (r.ty - 24) * sc }
    if (r.rise !== undefined) r.rise *= sc
  }
}

// the kit, for the batch files (ItoIconReal2.js ...): a top-level var so a QML .import sees it
var KIT = { kit: kit, finish: finish, LIT: LIT, DARK: DARK, add: add, ground: ground, base: base, toneField: toneField, outline: outline,
            line: line, dot: dot, rust: rust, drip: drip, rig: rig, G: G, TEX: TEX, GOLD: GOLD, weigh: weigh, WEIGHT: WEIGHT }

if (typeof module !== "undefined") module.exports = { KINDS: KINDS, STATES: STATES, NOMINAL: NOMINAL, CURRENT: CURRENT, SUPER: SUPER, iconParts: iconParts, WEIGHT: WEIGHT,
  KIT: KIT, DRAW: DRAW }

// The lore pass of the system panels (design: dev/openspec/changes/ito-system-panels/lore-pass.md): states, memo lines,
// and the small maths of the lore marks (rust grating, radio static, great knife, Amigara figure, growth, budget).
//
// Pure functions: no I/O, no QML types, so the same file loads in the shell, in the offscreen lab and in `node --test`
// (scripts/qa/models.test.mjs). No `.pragma` and no JS-to-JS import (the shape of ItoChart.js). Angles are degrees,
// 0 at 12 o'clock, clockwise. Every reference encodes a metric or a state: a mark that cannot say what value it shows is
// not drawn.

var LEVELS = ["off", "subtle", "full"]

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v) }
function num(v) { var n = Number(v); return isFinite(n) ? n : 0 }

// anything not in LEVELS -> "subtle"
function level(v) { return LEVELS.indexOf(String(v)) >= 0 ? String(v) : "subtle" }

// ---------------------------------------------------------------------------------------------------- states

var STATES = ["idle", "busy", "hot", "critical"]

// Raw state of a panel from the metrics it already holds (table 1b).
//   cpu   m: { pct, temp, maxCore, load1 (load1 / threads, -1 unknown), psi (-1 unknown) }
//   ram   m: { pct }
//   disk  m: { rootFraction, anyHot, temp, busy, rw (read + write bytes/s) }
function stateFor(panel, m) {
  m = m || {}
  if (panel === "cpu") {
    var pct = num(m.pct)
    if (pct > 0.9 || (m.temp !== null && m.temp !== undefined && num(m.temp) > 80)) return "critical"
    if (num(m.maxCore) >= 0.8 || num(m.load1) > 0.8 || num(m.psi) > 20) return "hot"
    if (pct >= 0.25) return "busy"
    return "idle"
  }
  if (panel === "ram") {
    var p = num(m.pct)
    if (p > 0.9) return "critical"
    if (p > 0.85) return "hot"
    if (p >= 0.5) return "busy"
    return "idle"
  }
  if (panel === "disk") {
    var busy = num(m.busy)
    if (num(m.rootFraction) > 0.9) return "critical"
    if (m.anyHot || (m.temp !== null && m.temp !== undefined && num(m.temp) > 80) || busy >= 0.8) return "hot"
    if (num(m.rw) > 1048576 || busy >= 0.2) return "busy"
    return "idle"
  }
  return "idle"
}

// A rise is taken at once; a fall only after 3 consecutive refreshes in a lower state. `prev` null -> raw.
function settle(prev, raw, streak) {
  var r = STATES.indexOf(raw) < 0 ? 0 : STATES.indexOf(raw)
  if (prev === null || prev === undefined || STATES.indexOf(prev) < 0) return { state: STATES[r], streak: 0 }
  var p = STATES.indexOf(prev)
  if (r > p) return { state: STATES[r], streak: 0 }
  if (r === p) return { state: prev, streak: 0 }
  var s = num(streak) + 1
  if (s >= 3) return { state: STATES[r], streak: 0 }
  return { state: prev, streak: s }
}

// Booleans used to pick conditional memo lines and marks (table 1b).
//   cpu   m: { pct, load1, freqAvg, freqMax }
//   ram   m: { pct, swapMax (largest swap fraction, 0..1), groups (process groups holding memory, at most 7), cache (cache / total) }
//   disk  m: { busy, temp, more }
function flagsFor(panel, m) {
  m = m || {}
  if (panel === "cpu") {
    var ratio = num(m.freqMax) > 0 ? num(m.freqAvg) / num(m.freqMax) : 1
    return {
      oversub: num(m.load1) > 1,
      throttled: num(m.pct) > 0.8 && num(m.freqMax) > 0 && ratio < 0.6,
      quiet: num(m.pct) < 0.05
    }
  }
  if (panel === "ram") {
    return {
      swapping: num(m.swapMax) > 0.5,
      swapHot: num(m.swapMax) > 0.8,
      crowd: num(m.groups) >= 7,
      cached: num(m.cache) > 0.3
    }
  }
  if (panel === "disk") {
    return {
      walking: num(m.busy) >= 0.2,
      pounding: num(m.busy) >= 0.8,
      rust: m.temp !== null && m.temp !== undefined && num(m.temp) > 70,
      hidden: num(m.more) > 0
    }
  }
  return {}
}

// ------------------------------------------------------------------------------------------------------- memos
// Only real, attributable lines from the games, films and manga this shell borrows from. Nothing here is invented. `src` names the
// source of each line (data, not shown). A state without a line shows no memo. `when` names a flag of `flagsFor`.
// Lines are verbatim apart from case (the memo is set in lowercase; tested). More are welcome only with a source that can be checked.

var QUOTES = {
  dreams: { text: "in my restless dreams, i see that town.", src: "Silent Hill 2 (2001), James Sunderland's opening monologue" },
  promise: { text: "you promised you'd take me there again someday.", src: "Silent Hill 2 (2001), Mary's letter" }
}

// the text of every QUOTES entry, in order: the panels' legacy (level "off") lines and the lock read this one source
function quoteLines() {
  var out = []
  for (var k in QUOTES) out.push(QUOTES[k].text)
  return out
}

var MEMOS = {
  cpu:  { idle: [QUOTES.dreams, QUOTES.promise], busy: [], hot: [], critical: [] },
  ram:  { idle: [QUOTES.dreams, QUOTES.promise], busy: [], hot: [], critical: [] },
  disk: { idle: [QUOTES.dreams, QUOTES.promise], busy: [], hot: [], critical: [] }
}

// `lvl` "off": the panel's legacy lines (`legacy`, the three it had), rotating. Else the pool of the state, filtered by
// `when`; never empty (an empty filtered pool falls back to the unfiltered one).
function memoFor(panel, state, flags, seed, lvl, legacy) {
  var s = Math.floor(Math.abs(num(seed)))
  if (lvl === "off") {
    var l = legacy || []
    return l.length > 0 ? String(l[s % l.length]) : ""
  }
  var table = MEMOS[panel] || {}
  var all = table[state] || []
  var f = flags || {}
  var pool = []
  for (var i = 0; i < all.length; i++) if (!all[i].when || f[all[i].when]) pool.push(all[i])
  if (pool.length === 0) pool = all
  return pool.length > 0 ? pool[s % pool.length].text : ""
}

// ------------------------------------------------------------------------------------------------------ CPU marks

// One entry per refresh: { i, v } (the busiest core's index and load). Pushes `sample`, trims to `window`, returns
// { hist, i, v } of the maximum; the latest entry wins ties.
function peakHold(hist, sample, window) {
  var out = (hist || []).slice()
  if (sample) out.push({ i: sample.i, v: sample.v })
  var w = Math.max(1, Math.floor(num(window)) || 30)
  while (out.length > w) out.shift()
  var best = null
  for (var k = 0; k < out.length; k++) if (best === null || out[k].v >= best.v) best = out[k]
  return { hist: out, i: best ? best.i : -1, v: best ? best.v : 0 }
}

// 0 below the threshold; else 1..7 by how far the busiest core is past it
function staticCount(maxLoad, threshold) {
  var m = num(maxLoad), t = num(threshold)
  if (m < t) return 0
  var span = 1 - t
  if (!(span > 0)) return 7
  return clamp(Math.ceil(7 * (m - t) / span), 1, 7)
}

function rng(seed) {
  var a = (Math.floor(num(seed)) + 0x9e3779b9) >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    var t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// `count` ticks: dAngle in [-12, 12] degrees (seeded, sorted, >= 2.5 apart), len 2..6 px (seeded)
function staticTicks(count, seed) {
  var n = clamp(Math.floor(num(count)), 0, 7)
  var r = rng(seed)
  var w = 24 / Math.max(1, n)
  var jitter = Math.max(0, (w - 2.5) / 2)
  var out = []
  for (var i = 0; i < n; i++) {
    var c = -12 + (i + 0.5) * w
    out.push({ dAngle: Math.round((c + (r() * 2 - 1) * jitter) * 100) / 100, len: 2 + Math.floor(r() * 5) })
  }
  return out
}

// ---------------------------------------------------------------------------------------------------- rust

// CPU and NVMe: 60 -> 0 degrees, 80 -> 240, 90 -> 360 (hot = 80); 0 without a reading; quantised to 4 degrees
function rustSweep(tempC, hot) {
  if (tempC === null || tempC === undefined || !isFinite(Number(tempC))) return 0
  var raw = 360 * clamp((Number(tempC) - (hot - 20)) / 30, 0, 1)
  return clamp(Math.round(raw / 4) * 4, 0, 360)
}
function rustNotch(hot) { return 360 * clamp((hot - (hot - 20)) / 30, 0, 1) }

// ------------------------------------------------------------------------------------------- Amigara figure
// Unit coordinates of chart-language 1d: a head circle r 5 at (0, -9) and a body trapezoid y -3..13, width 16 -> 10.
// The head is a 32-gon whose area equals the circle's.

var HEAD_N = 32
var HEAD_R = 5 * Math.sqrt(2 * Math.PI / (HEAD_N * Math.sin(2 * Math.PI / HEAD_N)))

function headPolygon() {
  var pts = []
  for (var i = 0; i < HEAD_N; i++) {
    var a = 2 * Math.PI * i / HEAD_N
    pts.push({ x: HEAD_R * Math.sin(a), y: -9 - HEAD_R * Math.cos(a) })
  }
  return pts
}
function bodyPolygon() { return [{ x: -8, y: -3 }, { x: 8, y: -3 }, { x: 5, y: 13 }, { x: -5, y: 13 }] }

function polyArea(p) {
  var a = 0
  for (var i = 0; i < p.length; i++) {
    var q = p[(i + 1) % p.length]
    a += p[i].x * q.y - q.x * p[i].y
  }
  return Math.abs(a) / 2
}

// the part of a polygon with y >= level (below the level, y grows downward)
function clipBelow(p, level) {
  var out = []
  for (var i = 0; i < p.length; i++) {
    var a = p[i], b = p[(i + 1) % p.length]
    var ain = a.y >= level, bin = b.y >= level
    if (ain) out.push({ x: a.x, y: a.y })
    if (ain !== bin) {
      var t = (level - a.y) / (b.y - a.y)
      out.push({ x: a.x + (b.x - a.x) * t, y: level })
    }
  }
  return out
}

function figureArea() { return polyArea(headPolygon()) + polyArea(bodyPolygon()) }

function filledArea(level) {
  var h = clipBelow(headPolygon(), level), b = clipBelow(bodyPolygon(), level)
  return (h.length >= 3 ? polyArea(h) : 0) + (b.length >= 3 ? polyArea(b) : 0)
}

// -> { level, body: [pts], head: [pts] }: the polygon(s) of the figure below `level` whose area is `f` of figureArea()
function figureFill(f) {
  var frac = clamp(num(f), 0, 1)
  var top = -9 - HEAD_R, bottom = 13
  if (frac <= 0) return { level: bottom, body: [], head: [] }
  if (frac >= 1) return { level: top, body: bodyPolygon(), head: headPolygon() }
  var target = frac * figureArea()
  var lo = top, hi = bottom                 // area below `lo` is the whole figure, below `hi` it is nothing
  for (var i = 0; i < 24; i++) {
    var mid = (lo + hi) / 2
    if (filledArea(mid) > target) lo = mid
    else hi = mid
  }
  var level = (lo + hi) / 2
  var h = clipBelow(headPolygon(), level), b = clipBelow(bodyPolygon(), level)
  return { level: level, body: b.length >= 3 ? b : [], head: h.length >= 3 ? h : [] }
}

// -------------------------------------------------------------------------------------------------- growth, disk

// `prev` map key -> bytes (null the first time), `rows` [{ key, bytes }]. A row is growing when it existed before and grew
// by >= 64 MiB or >= 5 % of its previous size. -> { keys (at most 2, largest absolute growth first), map }
function growing(prev, rows, now) {
  var map = {}, found = []
  var list = rows || []
  for (var i = 0; i < list.length; i++) {
    var key = String(list[i].key), bytes = num(list[i].bytes)
    map[key] = bytes
    if (prev && prev[key] !== undefined) {
      var d = bytes - prev[key]
      if (d >= 64 * 1048576 || (prev[key] > 0 && d >= 0.05 * prev[key])) found.push({ key: key, d: d })
    }
  }
  found.sort(function (a, b) { return b.d - a.d })
  return { keys: found.slice(0, 2).map(function (x) { return x.key }), map: map }
}

// index of the mount with the most free space among those not hot; -1 with fewer than 2 mounts or all hot
function saveTarget(mounts) {
  var list = mounts || []
  if (list.length < 2) return -1
  var best = -1
  for (var i = 0; i < list.length; i++) {
    if (list[i].hot) continue
    if (best < 0 || num(list[i].avail) > num(list[best].avail)) best = i
  }
  return best
}

// ---------------------------------------------------------------------------------------------------------- SFX

// -> { text, key } or null (table 1d)
function sfxFor(panel, state, flags) {
  var f = flags || {}
  var up = state === "hot" || state === "critical"
  if (panel === "cpu" && f.oversub) return { text: "ゴゴゴ", key: "gogogo" }
  if (panel === "ram") {
    if (up) return { text: "ざわざわ", key: "zawazawa" }
    if (f.swapHot) return { text: "ぞわぞわ", key: "zowazowa" }
  }
  if (panel === "disk" && f.pounding) return { text: "ドドド", key: "dododo" }
  return null
}

// ------------------------------------------------------------------------------------------------------- budget

var SFX_KEYS = ["gogogo", "zawazawa", "zowazowa", "dododo"]
var FULL_ONLY = SFX_KEYS.concat(["nooses"])
var PRIORITY = {
  cpu: ["static", "knife", "gogogo"],
  ram: ["zawazawa", "nooses", "zowazowa"],
  disk: ["walker", "dododo"]
}

// `wanted`: the event-sign keys present now. -> the visible subset, in priority order. off: none; subtle: at most 2, no
// lettering and no nooses; full: at most 3 and at most ONE SFX.
function budget(panel, wanted, lvl) {
  if (lvl === "off") return []
  var order = PRIORITY[panel] || []
  var want = wanted || []
  var cap = lvl === "full" ? 3 : 2
  var out = [], sfx = 0
  for (var i = 0; i < order.length; i++) {
    var key = order[i]
    if (want.indexOf(key) < 0) continue
    if (lvl !== "full" && FULL_ONLY.indexOf(key) >= 0) continue
    var isSfx = SFX_KEYS.indexOf(key) >= 0
    if (isSfx && sfx >= 1) continue
    if (out.length >= cap) break
    if (isSfx) sfx++
    out.push(key)
  }
  return out
}

// A box in the seal's square S, at a corner, with `inset` from the edges. `clear`: every corner of the box is at least
// R + 3 px from the centre (R = S / 2), so the box never touches the seal's rules.
function cornerBox(S, corner, w, h, inset) {
  var x = (corner === "tr" || corner === "br") ? S - w - inset : inset
  var y = (corner === "bl" || corner === "br") ? S - h - inset : inset
  var cx = S / 2, cy = S / 2, R = S / 2
  var xs = [x, x + w], ys = [y, y + h], clear = true
  for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) {
    var d = Math.sqrt((xs[i] - cx) * (xs[i] - cx) + (ys[j] - cy) * (ys[j] - cy))
    if (d < R + 3) clear = false
  }
  return { x: x, y: y, w: w, h: h, clear: clear }
}

// ---------------------------------------------------------------------------------------------------- labels

var LABELS = {
  cpu: { cores: { kanji: "核", text: "CORES" }, busiest: { kanji: "憑", text: "BUSIEST" } },
  ram: { breakdown: { kanji: "層", text: "BREAKDOWN" }, largest: { kanji: "棲", text: "LARGEST · RESIDENT" }, swap: { kanji: "換", text: "SWAP" } },
  disk: { mounts: { kanji: "穴", text: "MOUNTS" }, read: { kanji: "読", text: "READ" }, write: { kanji: "書", text: "WRITE" },
          temp: { kanji: "熱", text: "TEMP" }, busy: { kanji: "働", text: "BUSY" } }
}

if (typeof module !== "undefined") module.exports = {
  LEVELS: LEVELS, level: level, stateFor: stateFor, settle: settle, flagsFor: flagsFor, MEMOS: MEMOS, memoFor: memoFor, quoteLines: quoteLines, QUOTES: QUOTES,
  peakHold: peakHold, staticCount: staticCount, staticTicks: staticTicks, rustSweep: rustSweep, rustNotch: rustNotch,
  figureArea: figureArea, figureFill: figureFill, growing: growing, saveTarget: saveTarget, sfxFor: sfxFor,
  budget: budget, cornerBox: cornerBox, LABELS: LABELS
}

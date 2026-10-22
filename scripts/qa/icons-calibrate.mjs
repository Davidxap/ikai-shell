// Calibrates the weight budget (icons-v3.md section 11) of each manga kind: the scale that puts its longer side on today's
// keyline, then the gains (dark bar, light bar) that bring its visual weight to the bar's median (today's icons) in every
// palette. Prints the WEIGHT table to paste into the kind's file. Offline only; the test (icons-weight.test.mjs) checks it.
//   node scripts/qa/icons-calibrate.mjs [kind ...]
import { loadSet } from "./icon-set.mjs"
import * as W from "./icon-weight.mjs"
import { SURFACES, compose, measure, pngMeasure } from "./icon-tone.mjs"
// ICON_TONE=theme: the weight is the v6 theme tone composited over the flat surface (icons-v6-tone.md section 3.1), against the PNG median measured the same way
const THEME = process.env.ICON_TONE === "theme"

const Set = loadSet()
const pals = W.palettes()
const dark = pals.filter((p) => W.isDark(p)), light = pals.filter((p) => !W.isDark(p))
const median = (tok) => THEME ? W.median(W.BAR.filter((b) => W.inBudget(b.slot)).map((b) => pngMeasure(b, 29, tok, SURFACES[0]).weight)) : W.median(W.barWeights(null, () => false, tok, 29, false).filter((b) => W.inBudget(b.slot)).map((b) => b.weight))
// the family weight: today's bar median, lifted to just under the budget's +15 % edge (W.FAMILY), so the engraving keeps room
// BIAS_LIGHT / BIAS_DARK: aim a little above or below the family on that side (a level picture whose weight falls with the datum)
const bias = (p) => W.isDark(p) ? +(process.env.BIAS_DARK || 1) : +(process.env.BIAS_LIGHT || 1)
const target = new Map(pals.map((p) => [p.name, median(p) * W.FAMILY * bias(p)]))
const kinds = process.argv.slice(2).length ? process.argv.slice(2) : Set.KINDS
const out = {}
for (const spec of kinds) {
  // "ai:eye": one form of a kind, calibrated alone (WEIGHT["ai:eye"])
  // "indicator:coffee:on": the on state alone (its own gain and line; the size stays the off state's)
  const [kind, form, which] = spec.split(":")
  // "ai:eye" (a form at 0.4), "indicator:coffee" (a version, off), "sky:rain" (a sky), "media:stop" (a face)
  const picture = { ai: () => ({ form, value: 0.4 }), indicator: () => Set.STATES.indicator.find((s) => s.version === form && !!s.on === (which === "on")), sky: () => ({ sky: form }), media: () => (Set.STATES.media.find((s) => s.face === form)) }
  const st = form ? (picture[kind] ? picture[kind]() : Object.assign({}, Set.NOMINAL[kind], { form })) : (W.BAR.find((b) => b.kind === kind) || {}).state || Set.NOMINAL[kind]
  // a picture with two states (an indicator's off and on) is calibrated on their mean: the family weight holds in both
  const one = (it, k, x, size, p) => THEME ? (() => { const c = compose(it, k, x, size, p, SURFACES[0], "theme"), m = measure(c, p); return { ...W.mangaWeight(it, k, x, size, p), weight: m.weight } })() : W.mangaWeight(it, k, x, size, p)
  const mw = (it, k, state, size, p) => { const L = Array.isArray(state) ? state : [state], r = L.map((x) => one(it, k, x, size, p)); const m = { ...r[0] }; for (const key of ["weight", "optical", "extent"]) m[key] = r.reduce((a, b) => a + b[key], 0) / r.length; return m }
  const with_ = (wt) => (k, s, size, seed, o) => Set.iconParts(k, s, size, seed, Object.assign({}, o, { weight: wt }))
  // the scale: the optical size of today's icons, by AREA (a portrait drive and a round dial must look the same size): the inked
  // box covers OPTICAL of the icon box, and the longer side stays within EXTENT_MAX
  const OPTICAL = 0.5, EXTENT_MAX = 0.8
  let scale = 1
  // SCALE: the size is given (an indicator's on state keeps its off state's size), only the tone and the contours are solved
  for (let it = 0; it < (process.env.SCALE ? 0 : 4); it++) {
    const m = mw(with_({ gain: [1, 1], scale }), kind, st, 48, pals[0])
    scale = scale * Math.min(Math.sqrt(OPTICAL / Math.max(0.05, m.optical)), EXTENT_MAX / Math.max(0.3, m.extent))
    scale = Math.max(0.6, Math.min(1.1, scale))
  }
  scale = process.env.SCALE ? +process.env.SCALE : +scale.toFixed(3)
  // per bar side: the tone keeps at least TONE of its lines while the contours thin down to LINE_MIN; past that the tone gives way
  const TONE = +(process.env.TONE || 0.15), LINE_MIN = +(process.env.LINE_MIN || 0.45), LINE_MAX = +(process.env.LINE_MAX || 1.5)
  const solve = (set, idx) => {
    if (!set.length) return [1, 1]
    const f = (g, l) => { const gg = [1, 1], ll = [1, 1]; gg[idx] = g; ll[idx] = l; let r = 0
      for (const p of set) r += mw(with_({ gain: gg, line: ll, scale }), kind, st, 29, p).weight / target.get(p.name); return r / set.length }
    const bis = (fn, lo, hi) => { if (fn(hi) <= 1) return hi; if (fn(lo) > 1) return lo; for (let i = 0; i < 13; i++) { const m = (lo + hi) / 2; if (fn(m) > 1) hi = m; else lo = m } return (lo + hi) / 2 }
    // lighter than the family: the contours (and bright details) thicken, up to LINE_MAX
    if (f(1, 1) <= 1) { if (f(1, LINE_MAX) <= 1) return [1, LINE_MAX]; let up = 1, top = LINE_MAX
      for (let i = 0; i < 12; i++) { const m = (up + top) / 2; if (f(1, m) > 1) top = m; else up = m } return [1, +((up + top) / 2).toFixed(3)] }
    // first the tone, down to TONE, at full contours; then the contours; then the tone again
    let g = bis((x) => f(x, 1), TONE, 1)
    if (f(g, 1) <= 1.001) return [+g.toFixed(3), 1]
    let l = bis((x) => f(TONE, x), LINE_MIN, 1)
    if (f(TONE, l) <= 1.001) return [TONE, +l.toFixed(3)]
    g = bis((x) => f(x, LINE_MIN), 0.05, TONE)
    return [+g.toFixed(3), LINE_MIN]
  }
  const d = solve(dark, 0), li = solve(light, 1)
  // a solid mass (scratchboard) ignores tone and contour: its thickness is the third knob, solved to the family weight
  const massFor = (set, idx, g, l) => {
    if (!set.length) return 1
    const f = (m) => { const gg = [1, 1], ll = [1, 1], mm = [1, 1]; gg[idx] = g; ll[idx] = l; mm[idx] = m; let r = 0
      for (const p of set) r += mw(with_({ gain: gg, line: ll, mass: mm, scale }), kind, st, 29, p).weight / target.get(p.name); return r / set.length }
    if (Math.abs(f(1) - 1) <= 0.06) return 1
    let lo = 0.3, hi = 2.5
    if (f(lo) > 1) return lo
    if (f(hi) < 1) return hi
    for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (f(m) > 1) hi = m; else lo = m }
    return +((lo + hi) / 2).toFixed(3)
  }
  const md = massFor(dark, 0, d[0], d[1]), ml = massFor(light, 1, li[0], li[1])
  out[spec] = { gain: [d[0], li[0]], line: [d[1], li[1]], scale }
  if (md !== 1 || ml !== 1) out[spec].mass = [md, ml]
  console.log(spec.padEnd(14), JSON.stringify(out[spec]))
}
console.log(JSON.stringify(out))

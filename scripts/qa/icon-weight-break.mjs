// Which parts of a manga icon carry its visual weight (icons-v3.md section 11): the weight with each tag left out.
//   node scripts/qa/icon-weight-break.mjs <kind> '<state json>' [gain line mass scale]
import { loadSet } from "./icon-set.mjs"
import * as W from "./icon-weight.mjs"
const Set = loadSet(), tok = W.palettes()[0]
const [kind, sj, g, l, m, sc] = process.argv.slice(2)
const st = sj ? JSON.parse(sj) : Set.NOMINAL[kind]
const wt = g ? { gain: [+g, +g], line: [+l, +l], mass: [+m, +m], scale: +sc } : undefined
const fn = (filt) => (k, s, z, sd, o) => { const r = Set.iconParts(k, s, z, sd, wt ? { ...o, weight: wt } : o); if (filt) r.parts = r.parts.filter(filt); return r }
const full = W.mangaWeight(fn(null), kind, st, 29, tok)
const tags = new globalThis.Set(fn(null)(kind, st, 29, 1, { light: true }).parts.map((p) => p.tag))
const rows = [...tags].map((t) => [t, full.weight - W.mangaWeight(fn((p) => p.tag !== t), kind, st, 29, tok).weight]).sort((a, b) => b[1] - a[1])
const med = W.median(W.barWeights(null, () => false, tok, 29, false).filter((b) => W.inBudget(b.slot)).map((b) => b.weight))
console.log(kind, JSON.stringify(st), tok.name, "weight", full.weight.toFixed(3), "bar median", med.toFixed(3), "accent", full.accent.toFixed(3))
for (const [t, d] of rows.slice(0, 12)) console.log("  ", t.padEnd(18), d.toFixed(4))

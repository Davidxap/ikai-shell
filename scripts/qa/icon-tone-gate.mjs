// The acceptance gate (icons-v6-tone.md section 6) per family: which of W-T6..W-T10 each family fails, over every palette, size and surface.
//   node scripts/qa/icon-tone-gate.mjs
import { loadSet } from "./icon-set.mjs"
import * as W from "./icon-weight.mjs"
import { tonePalettes, SURFACES, compose, measure, pngMeasure } from "./icon-tone.mjs"
import { loadQmlJs } from "./icon-raster.mjs"
const Set = loadSet(), MapJs = loadQmlJs("bar/modules/ItoIconMap.js")
const slots = W.BAR.filter((b) => b.slot !== "workspaces" && b.kind && Set.KINDS.includes(b.kind))
const fam = {}
for (const b of slots) {
  const f = MapJs.familyOf(b.kind), r = (fam[f] = fam[f] || { patch: 0, heavy: 0, peak: 0, n: 0, held: !!MapJs.DEFAULT_CURRENT[f] })
  for (const tok of tonePalettes()) for (const surf of SURFACES) {
    const m = measure(compose(Set.iconParts, b.kind, b.state, 29, tok, surf, "theme"), tok), png = pngMeasure(b, 29, tok, surf)
    r.n++
    if (m.patch > 0) r.patch++
    if (m.heavy > Math.max(0.04, png.heavy + (m.cls === "mid" ? 0.05 : 0.02))) r.heavy++
    if (surf.name === SURFACES[0].name && m.peak > Math.max(1.25 * png.peak, 0.55)) r.peak++
  }
}
for (const f in fam) { const r = fam[f]; console.log(f.padEnd(14), (r.held ? "held (old default)" : "manga default").padEnd(20), "patch", r.patch, " heavy", r.heavy, " squint", r.peak, " of", r.n) }

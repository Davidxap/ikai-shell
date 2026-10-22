// Prints the bar's weight under the v6 theme tone (and ink) per palette against today's PNG median measured the same way (S1, 29 px).
//   node scripts/qa/icon-tone-report.mjs [theme|ink]
import { loadSet } from "./icon-set.mjs"
import * as W from "./icon-weight.mjs"
import { tonePalettes, SURFACES, compose, measure, pngMeasure } from "./icon-tone.mjs"
const Set = loadSet(), tone = process.argv[2] || "theme"
const slots = W.BAR.filter((b) => b.slot !== "workspaces")
for (const tok of tonePalettes()) {
  const med = W.median(slots.map((b) => pngMeasure(b, 29, tok, SURFACES[0]).weight))
  const row = slots.filter((b) => b.kind && Set.KINDS.includes(b.kind)).map((b) => { const m = measure(compose(Set.iconParts, b.kind, b.state, 29, tok, SURFACES[0], tone), tok); return (b.slot + (b.state.face ? ":" + b.state.face : "")).slice(0, 8) + " " + ((m.weight / med - 1) * 100).toFixed(0) + "%" })
  console.log(tok.name.padEnd(16), med.toFixed(3), row.join(" | "))
}

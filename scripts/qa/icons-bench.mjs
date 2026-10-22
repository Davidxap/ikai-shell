// I-T5: cost of building one manga icon's geometry (ItoIconInk.iconParts), the work done on a state or tier change.
//   node scripts/qa/icons-bench.mjs        median and p95 per master, every pilot kind and state; exit 1 above the gates
// Gates (icons-v2.md section 4.3): median <= 0.8 ms at M (29 px), <= 2 ms at L (48 px). Measured in this realm (a vm
// sandbox would call Math through another realm and run far slower than the shell's JS engine).
import { loadInk, loadQmlJs } from "./icon-raster.mjs"

const { Ink } = loadInk()
const Real = loadQmlJs("bar/modules/ItoIconReal.js", { Ink })
const GATES = { S: [16, 0.8], M: [29, 0.8], L: [48, 2.0] }
let bad = 0
for (const [master, [size, gate]] of Object.entries(GATES)) {
  const times = []
  for (const kind of Ink.KINDS) for (const state of Ink.STATES[kind]) {
    for (let w = 0; w < 5; w++) Ink.iconParts(kind, state, size, w + 1)
    for (let r = 0; r < 30; r++) {
      const t0 = process.hrtime.bigint()
      Ink.iconParts(kind, state, size, r + 7)
      times.push(Number(process.hrtime.bigint() - t0) / 1e6)
    }
  }
  times.sort((a, b) => a - b)
  const med = times[Math.floor(times.length / 2)], p95 = times[Math.floor(times.length * 0.95)]
  const ok = med <= gate
  if (!ok) bad = 1
  console.log(`${master} ${size}px  median ${med.toFixed(3)} ms  p95 ${p95.toFixed(3)} ms  gate ${gate} ms  ${ok ? "ok" : "OVER"}`)
}
// v3 (icons-v3.md section 4): a heavier engraving, baked once per state and cached; gates 3 ms at M, 5 ms at L (node)
const GATES3 = { S: [16, 2.0], M: [29, 3.0], L: [48, 5.0] }
for (const [master, [size, gate]] of Object.entries(GATES3)) {
  const times = []
  for (const kind of Real.KINDS) for (const state of Real.STATES[kind]) for (const light of [true, false]) {
    for (let w = 0; w < 3; w++) Real.iconParts(kind, state, size, w + 1, { light })
    for (let r = 0; r < 12; r++) {
      const t0 = process.hrtime.bigint()
      Real.iconParts(kind, state, size, r + 7, { light })
      times.push(Number(process.hrtime.bigint() - t0) / 1e6)
    }
  }
  times.sort((a, b) => a - b)
  const med = times[Math.floor(times.length / 2)], p95 = times[Math.floor(times.length * 0.95)]
  if (med > gate) bad = 1
  console.log(`v3 ${master} ${size}px  median ${med.toFixed(3)} ms  p95 ${p95.toFixed(3)} ms  gate ${gate} ms  ${med <= gate ? "ok" : "OVER"}`)
}
process.exit(bad)

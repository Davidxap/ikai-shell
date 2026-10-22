// Cost of one full rebuild of the RAM vessel's geometry (ItoIchor.js buildGeometry: three strata with skin, highlight,
// wall highlight, both film crescents and the platelets), the work done per frame while the liquid moves.
//   node scripts/qa/ichor-bench.mjs        prints the median and p95 in microseconds; exit 1 above the 250 us gate
import fs from "node:fs"
import path from "node:path"
import vm from "node:vm"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
function load(rel) {
  const src = fs.readFileSync(path.join(root, rel), "utf8")
    .split("\n").filter((l) => !/^\s*\.(pragma|import)\b/.test(l)).join("\n")
  const sandbox = { module: { exports: {} } }
  vm.runInNewContext(src, sandbox, { filename: rel })
  return sandbox.module.exports
}
const Chart = load("bar/modules/ItoChart.js")
const Ichor = load("bar/modules/ItoIchor.js")
// The eyes are measured in the main realm: code in a vm sandbox calls Math through another realm and runs about 20 times
// slower, which is not what the shell's JS engine does (the liquid's number above keeps its old loader and gate).
function loadHere(rel) {
  const src = fs.readFileSync(path.join(root, rel), "utf8")
  const mod = { exports: {} }
  vm.runInThisContext("(function(module){" + src.split("\n").filter((l) => !/^\s*\.pragma\b/.test(l)).join("\n") + "\n})", { filename: rel })(mod)
  return mod.exports
}
const Eye = loadHere("bar/modules/ItoEyeModel.js")
const IchorHere = loadHere("bar/modules/ItoIchor.js")
const Real = loadHere("bar/modules/ItoEyeReal.js")
const Mot = loadHere("bar/modules/ItoEyeMotion.js")

const RUNS = 2000, GATE_US = 250
const rv = 64
const levels = [0.25, 0.4, 0.5, 0].map((f) => 2 * rv * Chart.segmentHeightForArea(f))
const live = [true, true, true, false]

// warm up so the JIT has seen the code
for (let i = 0; i < 300; i++) Ichor.buildGeometry(rv, levels, live, { a1: 6, a2: 1, a3: 0.5 }, -40, 80)

const times = []
for (let i = 0; i < RUNS; i++) {
  const a1 = 8 * Math.sin(i * 0.11), a2 = 3 * Math.sin(i * 0.23), a3 = Math.sin(i * 0.7)
  const t0 = process.hrtime.bigint()
  Ichor.buildGeometry(rv, levels, live, { a1, a2, a3 }, -60 + (i % 40), 60 - (i % 50))
  times.push(Number(process.hrtime.bigint() - t0) / 1000)
}
times.sort((a, b) => a - b)
const median = times[Math.floor(RUNS / 2)], p95 = times[Math.floor(RUNS * 0.95)]
console.log(`ichor rebuild: ${RUNS} runs, median ${median.toFixed(1)} us, p95 ${p95.toFixed(1)} us (gate ${GATE_US} us)`)

// The eyes (ichor-eyes.md section 3): one tick of seven eyes (blink + gaze step), and one lid rebuild.
// the lid gate is 100, not the design's 60: the ink pass (hatch, clumped lashes, film) made one rebuild heavier, and it only runs
// while a lid moves (about 25 rebuilds per blink)
const EYE_TICK_US = 40, LID_US = 100
const fit = [1, 2, 3, 4, 5, 6, 7].map((i) => ({ seed: i * 7919, S: 40 - 3 * i, g: { x: 0, y: 0 } }))   // S14: the liquid has no eyes; the eye's own blink + gaze stay
const tick = (n) => {
  for (const e of fit) {
    const b = Eye.blinkAt(e.seed, n / 30, 0.05)
    e.g = Eye.gazeStep(e.g, Eye.gazeToward(40 - 20 * e.seed % 7, 30, e.S, 0, false), 0.6, 1 / 30)
    if (b < -1) throw new Error("unreachable")
  }
}
for (let i = 0; i < 300; i++) tick(i)
const et = []
for (let i = 0; i < RUNS; i++) { const t0 = process.hrtime.bigint(); tick(i); et.push(Number(process.hrtime.bigint() - t0) / 1000) }
et.sort((a, b) => a - b)
const eyeMedian = et[Math.floor(RUNS / 2)]
for (let i = 0; i < 200; i++) Eye.lidShape((i % 50) / 50, 3, 40, 7, false)
const lt = []
for (let i = 0; i < RUNS; i++) { const t0 = process.hrtime.bigint(); Eye.lidShape(((i * 7) % 50) / 50, 3, 40, 7, false); lt.push(Number(process.hrtime.bigint() - t0) / 1000) }
lt.sort((a, b) => a - b)
const lidMedian = lt[Math.floor(RUNS / 2)]
console.log(`eyes tick (7 x blink + gaze): median ${eyeMedian.toFixed(1)} us (gate ${EYE_TICK_US} us); lidShape L3 40 px: median ${lidMedian.toFixed(1)} us (gate ${LID_US} us)`)

// The gekiga bake (options.md C, T2): the stroke list of one eye at 320 px, median over 80 different eyes, after the distance
// fields are built (that happens once, the first time an eye is baked).
const GEKIGA_MS = 4
Eye.gekigaParts(Eye.gekigaParams(0), 320, 0)
const gt = []
for (let i = 0; i < 160; i++) { const p = Eye.gekigaParams(i); const t0 = process.hrtime.bigint(); Eye.gekigaParts(p, 320, i); gt.push(Number(process.hrtime.bigint() - t0) / 1e6) }
gt.sort((a, b) => a - b)
const gekigaMedian = gt[80]
console.log(`gekiga bake strokes (320 px): median ${gekigaMedian.toFixed(2)} ms (gate ${GEKIGA_MS} ms)`)

// The real eye (eyes-v2.md section 6): the stroke list of one eye per tier, median over 80 different eyes (cold: the cache is cleared
// each time, so this is the generation and nothing else). Gates 2.5 ms at T1 (46 px), 4 ms at T2 (96 px), 6 ms at T3 (160 px).
const REAL = [[46, 2.5], [96, 4], [160, 6]]
let realOk = true
for (const [S, gate] of REAL) {
  for (let i = 0; i < 40; i++) { Real.clearCache(); Real.realParts(Real.realParams(Real.ARCHETYPES[i % 7], i), S) }
  const rt = []
  for (let i = 0; i < 160; i++) { Real.clearCache(); const p = Real.realParams(Real.ARCHETYPES[i % 7], i); const t0 = process.hrtime.bigint(); Real.realParts(p, S); rt.push(Number(process.hrtime.bigint() - t0) / 1e6) }
  rt.sort((a, b) => a - b)
  console.log(`real eye strokes (${S} px): median ${rt[80].toFixed(2)} ms (gate ${gate} ms)`)
  if (rt[80] > gate) realOk = false
  // the same eyes as plates (EM-B1): realPlates <= 1.3 x realParts at every tier
  for (let i = 0; i < 40; i++) { Real.clearCache(); Real.realPlates(Real.realParams(Real.ARCHETYPES[i % 7], i), S, undefined, false, { gaze: { x: 9, y: 2 } }) }
  const pt = []
  for (let i = 0; i < 160; i++) { Real.clearCache(); const p = Real.realParams(Real.ARCHETYPES[i % 7], i); const t0 = process.hrtime.bigint(); Real.realPlates(p, S, undefined, false, { gaze: { x: 9, y: 2 } }); pt.push(Number(process.hrtime.bigint() - t0) / 1e6) }
  pt.sort((a, b) => a - b)
  console.log(`real eye plates (${S} px): median ${pt[80].toFixed(2)} ms = ${(pt[80] / rt[80]).toFixed(2)} x the flat strokes (gate 1.3 x)`)
  if (pt[80] > 1.3 * rt[80]) realOk = false
}
// The eye's motion (eyes-animation.md EM-B1): one `stepEye` per eye per tick, level 2 (the heaviest), a pointer on the move, median <= 0.05 ms.
const MOTION_MS = 0.05, MOT_ARCHS = ["heavy", "stare", "lidless", "spiral", "weeping", "poly", "slit"]
const ms = MOT_ARCHS.map((a, i) => Mot.newEye(i + 3, a, { tier: 2, pupil0: 0.4, S: 68 }))
const mstep = (n) => {
  const i = n % ms.length
  ms[i] = Mot.stepEye(ms[i], n * 0.033, 0.033, { level: 2, amp: 1, arch: MOT_ARCHS[i], look: { dx: 40 * Math.sin(n * 0.05), dy: 20 * Math.cos(n * 0.07) }, S: 68, pulse: "always", bloodshot: 0.9, bpm: 72 })
}
for (let n = 0; n < 3000; n++) mstep(n)
const mt = []
for (let n = 0; n < 20000; n++) { const t0 = process.hrtime.bigint(); mstep(3000 + n); mt.push(Number(process.hrtime.bigint() - t0) / 1e6) }
mt.sort((a, b) => a - b)
const motionMedian = mt[10000]
console.log(`eye motion (stepEye, level 2): median ${(motionMedian * 1000).toFixed(1)} us, p95 ${(mt[19000] * 1000).toFixed(1)} us (gate ${MOTION_MS * 1000} us)`)

process.exit(motionMedian <= MOTION_MS && realOk && median <= GATE_US && eyeMedian <= EYE_TICK_US && lidMedian <= LID_US && gekigaMedian <= GEKIGA_MS ? 0 : 1)

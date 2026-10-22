// S14: the memory liquid's fills (ItoIchorFx.js), the user's popup-head eyes (ItoUserArt.eye) and the ito-config migrate table.
//   node --test scripts/qa/s14.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import vm from "node:vm"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
function load(rel) {
  const src = fs.readFileSync(path.join(root, rel), "utf8").split("\n").filter((l) => !/^\s*\.(pragma|import)\b/.test(l)).join("\n")
  const sandbox = { module: { exports: {} }, Math, Date }
  vm.runInNewContext(src, sandbox, { filename: rel })
  return sandbox.module.exports
}
const Fx = load("bar/modules/ItoIchorFx.js")
const Art = load("bar/modules/ItoUserArt.js")

// a recording 2D context: every method is a no-op that counts; gradients answer addColorStop
function ctxMock() {
  const calls = {}
  return new Proxy({}, { get: (_, k) => (k === "calls" ? calls : (...a) => { calls[k] = (calls[k] || 0) + 1; return { addColorStop() {} } }), set: () => true })
}
const tok = { r: 0.5, g: 0.4, b: 0.3 }
function opts(fill, extra) {
  const rv = 64, pts = []
  for (let i = 0; i < 40; i++) { const a = Math.PI * 2 * i / 40; pts.push({ x: rv + 60 * Math.cos(a), y: rv + 60 * Math.sin(a) }) }
  return Object.assign({ fill, rv, k: 1, liquid: pts, surf: pts.slice(0, 14), levelPx: 70, t: 3.3, used: 0.58, tight: false, peaks: [{ frac: 0.7, age: 10 }], sync: -1, frame: 2,
    c: { fill: tok, deep: tok, clot: tok, bone: tok, panel: tok, rust: tok, light: false } }, extra)
}

test("S14 fills: every fill but blood draws, blood draws nothing, a closed liquid draws nothing", () => {
  for (const f of Fx.FILLS) {
    const c = ctxMock(); Fx.paint(c, opts(f))
    assert.equal(Object.keys(c.calls).length > 0, f !== "blood", f)
  }
  const c = ctxMock(); Fx.paint(c, opts("whirlpool", { levelPx: 0 })); assert.equal(Object.keys(c.calls).length, 0)
  for (const f of ["hair", "static", "rust", "whirlpool", "tone"]) for (const tight of [false, true]) for (const lv of [8, 40, 120]) Fx.paint(ctxMock(), opts(f, { tight, levelPx: lv, sync: 0.4 }))
})

test("S14 fills: only whirlpool, hair, rust and static have a clock; the peaks are noted after a fall of 5 %", () => {
  assert.deepEqual(Object.keys(Fx.MOVES).filter((k) => Fx.MOVES[k]).sort(), ["hair", "rust", "static", "whirlpool"])
  let s = null
  for (const f of [0.5, 0.6, 0.7]) s = Fx.notePeak(s, f, 1)
  assert.equal(s.peaks.length, 0)
  s = Fx.notePeak(s, 0.6, 2); assert.equal(s.peaks.length, 1); assert.ok(Math.abs(s.peaks[0].frac - 0.7) < 1e-9)
  for (const f of [0.9, 0.8, 0.5, 0.7, 0.4]) s = Fx.notePeak(s, f, 3)
  assert.ok(s.peaks.length <= 2)
  assert.ok(Math.abs(Fx.areaOf(Fx.heightOf(0.37)) - 0.37) < 1e-6)
})

test("S14 eyes: tiers, polarity, and a missing file means null (the shaded eye)", () => {
  const slots = {}
  for (const id of ["uzumaki"]) for (const t of ["", "h34/", "h54/"]) for (const l of ["lid", "iris", "hot"]) for (const s of [".png", ".light.png"]) slots["eyes/" + id + "/" + t + l + s] = { mtime: 1 }
  const idx = { root: "/x", slots }
  assert.equal(Art.eyeTier(34), 34); assert.equal(Art.eyeTier(60), 54); assert.equal(Art.eyeTier(400), 0)
  const e = Art.eye(idx, {}, "uzumaki", 34, false)
  assert.ok(e.lid.endsWith("eyes/uzumaki/h34/lid.png?v=1") && e.iris.endsWith("iris.png?v=1") && e.hot.endsWith("hot.png?v=1"))
  assert.ok(Art.eye(idx, {}, "uzumaki", 34, true).lid.includes("lid.light.png"))
  assert.equal(Art.eye(idx, {}, "lashed", 34, false), null)          // no files: shaded
  assert.equal(Art.eye(idx, {}, "real", 34, false), null)            // not an eye any more
  assert.equal(Art.eye({ root: "/x", slots: {} }, {}, "uzumaki", 34, false), null)
  const failed = { ["file:///x/eyes/uzumaki/h34/lid.png?v=1"]: true }
  assert.equal(Art.eye(idx, failed, "uzumaki", 34, false), null)     // a file that failed to load
})

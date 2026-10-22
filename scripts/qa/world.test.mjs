// The Otherworld bar (decisions-b9 section 2): the pure plan of ItoWorld.js, the WORLDS table of ItoSurfaces.js, ItoCanon.js, the ito-config enum.
//   node --test scripts/qa/world.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { loadQmlJs, root } from "./icon-raster.mjs"

const Canon = loadQmlJs("bar/modules/ItoCanon.js")
const World = loadQmlJs("bar/modules/ItoWorld.js", { Canon })
const Surf = loadQmlJs("bar/modules/ItoSurfaces.js")
const KEYS = ["fog", "rust", "cage"]
// S13e/D3: the old Flesh world is the Blood layer's seep (fxBlood + bloodSeep): its marks are Surf.SEEP, folded in by Surf.worldParams
const ALL = [...KEYS, "seep"]
const P = (k) => (k === "seep" ? Surf.SEEP : Surf.WORLDS[k])
const SIZES = [[160, 38], [300, 46], [600, 46], [1000, 46], [1800, 46], [900, 58]]
const BLOOD = Canon.rgb(Canon.BLOOD)
const isBlood = (c) => Math.abs(c.r - BLOOD.r) < 1e-6 && Math.abs(c.g - BLOOD.g) < 1e-6

test("WD-T1 the table: four variants, off is not a row, the enum of ito-config is the same list", () => {
  assert.deepEqual(Surf.WORLD_KEYS, ["off", ...KEYS])
  assert.deepEqual(Object.keys(Surf.WORLDS), KEYS)
  const cfg = fs.readFileSync(path.join(root, "bar/modules/bin/ito-config"), "utf8")
  assert.match(cfg, /"surfaceWorld": \("off", "fog", "rust", "cage"\)/)
  assert.equal(Surf.worldKey("bogus"), "off"); assert.equal(Surf.worldKey("rust"), "rust"); assert.equal(Surf.worldKey(undefined), "off")
  const W = Surf.WORLDS
  assert.deepEqual([W.rust.R, W.rust.G, W.rust.V, W.rust.torn], [[0.55, 0.10], [0.10, 0], 0.90, true])
  assert.deepEqual([Surf.SEEP.R, Surf.SEEP.T, Surf.SEEP.veins], [[0.18, 0.04], 0.55, 0]); assert.equal(W.flesh, undefined)
  assert.deepEqual([W.cage.R, W.cage.G, W.cage.V], [[0.22, 0.05], [0.12, 0.035], 0.70])
  assert.deepEqual([W.fog.G, W.fog.fog, W.fog.grain], [[0.07, 0], 0.08, 0.18])
})

test("WD-T2 every plan is finite, inside the plate, repeatable; off / a tiny plate / a bad input plan nothing", () => {
  for (const k of ALL) for (const cls of ["dark", "mid", "light"]) for (const [w, h] of SIZES) {
    const a = World.plan(P(k), w, h, cls, { radius: h / 2 })
    assert.ok(World.finite(a, w, h), `${k} ${cls} ${w}x${h}`)
    assert.deepEqual(World.plan(P(k), w, h, cls, { radius: h / 2 }), a, "the same plate paints the same marks")
  }
  assert.deepEqual(World.plan(null, 1000, 46, "dark"), [])
  assert.deepEqual(World.plan(Surf.WORLDS.rust, 10, 46, "dark"), [])
  for (const bad of [NaN, undefined, Infinity, -4, "x"]) assert.ok(Array.isArray(World.plan(Surf.WORLDS.rust, bad, bad, "dark")))
})

test("WD-T3 light themes: no translucent red anywhere (only opaque rot bulbs of radius <= 1.5 use the red)", () => {
  for (const k of ALL) for (const [w, h] of SIZES) {
    for (const op of World.plan(P(k), w, h, "light", { radius: h / 2 }))
      if (isBlood(op.c)) assert.ok(op.k === "disc" && op.a === 1 && op.r <= 1.5, `${k} ${op.k} a ${op.a}`)
  }
  // dark and mid: the rot is translucent red, the rust is the derived rustC (red toward ink)
  const seep = World.plan(Surf.SEEP, 1000, 46, "dark")
  assert.ok(seep.some((o) => o.k === "fill" && isBlood(o.c) && o.a < 1))
})

test("WD-T4 the FIELD never carries more than the table says (rust alpha, rot 0.10, mesh), the RIM zone and end emphasis", () => {
  for (const k of ALL) for (const cls of ["dark", "mid", "light"]) {
    const p = P(k), m = World.CLASS_M[cls], [w, h] = [1000, 46], band = World.bandOf(h)
    for (const op of World.plan(p, w, h, cls, { radius: 23 })) {
      if (op.k === "rects" && !isBlood(op.c)) {
        for (let i = 0; i < op.pts.length; i += 2) {
          const cx = op.pts[i] + op.s / 2, cy = op.pts[i + 1] + op.s / 2
          if (!World.isRim(cx, cy, w, h)) assert.ok(op.a <= m * p.R[1] + 1e-9, `${k} ${cls} field cell a ${op.a}`)
          else assert.ok(op.a <= m * p.R[0] + 1e-9, `${k} rim cell a ${op.a}`)
        }
      }
      if (op.k === "fill") for (let i = 1; i < op.pts.length; i += 2) if (op.pts[i] >= band + 2) assert.ok(op.a <= 0.10 + 1e-9, `rot in FIELD a ${op.a}`)
      if (op.k === "lines") assert.ok(op.clip && op.a <= m * Math.max(...p.G) + 1e-9)
    }
  }
  assert.ok(World.endE(0, 1000) === 1 && World.endE(500, 1000) === 0 && World.endE(10, 1000) === 1)
})

test("WD-T5 the two ends carry equal marks (within 1.3x) on every plate width", () => {
  for (const k of ["rust", "seep", "cage"]) for (const w of [300, 450, 600, 800, 1000, 1400, 1800]) {
    const ops = World.plan(P(k), w, 46, "dark", { radius: 23 }), endW = Math.min(80, 0.18 * w)
    let l = 0, r = 0
    for (const op of ops) if (op.k === "rects") for (let i = 0; i < op.pts.length; i += 2) {
      const x = op.pts[i] + op.s / 2, wgt = op.a * op.s * op.s
      if (x < endW) l += wgt; else if (x > w - endW) r += wgt
    }
    const ratio = Math.max(l, r) / Math.max(1e-9, Math.min(l, r))
    assert.ok(ratio <= 1.3, `${k} ${w}: ${ratio.toFixed(2)}`)
  }
})

test("WD-T6 rivets: along both bands, symmetric about the middle, skipping the ends; drips: 2-9, kept out of the end zones", () => {
  const ops = World.plan(Surf.WORLDS.rust, 1000, 46, "dark", { radius: 23 })
  const heads = ops.filter((o) => o.k === "disc" && o.r === 1.5)
  assert.ok(heads.length > 8 && heads.length % 4 === 0)
  for (const h of heads) assert.ok(Math.abs(h.y - 4) < 1e-9 || Math.abs(h.y - 42) < 1e-9)
  for (const h of heads) assert.ok(heads.some((q) => q.y === h.y && Math.abs(q.x - (1000 - h.x)) < 1e-9), "mirrored")
  assert.ok(heads.every((h) => h.x >= 23 && h.x <= 977))
  for (const [w, n] of [[300, 2], [600, 3], [1000, 5], [1800, 9], [4000, 9]]) {
    const dr = World.plan(Surf.SEEP, w, 46, "dark").filter((o) => o.k === "disc")
    assert.equal(dr.length, n, `drips at ${w}`)
    for (const d of dr) assert.ok(d.x >= Math.max(12, Math.min(80, 0.18 * w)) - 1e-9 && d.x <= w - Math.max(12, Math.min(80, 0.18 * w)) + 1e-9)
  }
})

test("WD-T7 resolve: the variant raises the plate layers, never lowers the user's; presets clear it", () => {
  const cfgOf = (o, extra = {}) => ({ ink: { r: 0.02, g: 0.02, b: 0.03 }, bone: { r: 0.8, g: 0.8, b: 0.82 }, get: (k, f) => (k in o ? o[k] : f), ...extra })
  const off = Surf.resolve(cfgOf({})), rust = Surf.resolve(cfgOf({ surfaceWorld: "rust" }))
  assert.equal(off.world, "off"); assert.equal(rust.world, "rust")
  assert.deepEqual({ ...off, world: 0, torn: 0 }, { ...rust, world: 0, torn: 0 }, "rust changes only the torn border (and the world key)")
  assert.equal(rust.torn, true); assert.equal(off.torn, false)
  assert.equal(Surf.resolve(cfgOf({ surfaceWorld: "fog" })).fog, 0.08)
  assert.equal(Surf.resolve(cfgOf({ surfaceWorld: "fog", fxFog: true, surfaceFog: 0.2 })).fog, 0.2, "the user's own fog is higher")
  assert.equal(Surf.resolve(cfgOf({ surfaceWorld: "fog" })).grain, 0.18)
  // D3: Blood seep = fxBlood && bloodSeep; the stored `flesh` world is no world any more (migrated by `ito-config migrate`)
  assert.equal(Surf.resolve(cfgOf({ surfaceWorld: "flesh" })).world, "off")
  assert.equal(Surf.resolve(cfgOf({})).rot, false); assert.equal(Surf.resolve(cfgOf({ fxBlood: true })).rot, false)
  assert.equal(Surf.resolve(cfgOf({ bloodSeep: true })).rot, false, "the seep needs Blood on")
  assert.equal(Surf.resolve(cfgOf({ fxBlood: true, bloodSeep: true })).rot, true)
  assert.equal(Surf.worldParams("off", false), null); assert.equal(Surf.worldParams("off", true), Surf.SEEP); assert.equal(Surf.worldParams("rust", false), Surf.WORLDS.rust)
  const both = Surf.worldParams("rust", true)
  assert.equal(both.T, 0.55); assert.equal(both.V, 0.9); assert.deepEqual(both.R, [0.55, 0.10], "a world's own rim is never lowered by the seep")
  assert.equal(Surf.resolve(cfgOf({ surfaceWorld: "bogus" })).world, "off")
  for (const p of Surf.presets) assert.equal(p.set.surfaceWorld, p.key === "otherworld" ? "rust" : "off", p.key)
  const ow = Surf.presets.find((p) => p.key === "otherworld"), clean = Surf.presets.find((p) => p.key === "clean")
  assert.deepEqual({ ...ow.set, fxTorn: 0, surfaceWorld: 0 }, { ...clean.set, fxTorn: 0, surfaceWorld: 0 })
  assert.equal(ow.set.fxTorn, true)
})

test("WD-T8 canon: the three literals live in ItoCanon.js only; the plate and the shader effect name no colour", () => {
  assert.deepEqual([Canon.BONE, Canon.INK, Canon.BLOOD], ["#c7ccd1", "#050607", "#c4162a"])
  const near = (a, b) => Math.abs(a - b) < 1e-9
  const iron = Canon.mix(Canon.rgb(Canon.INK), Canon.rgb(Canon.BONE), 0.34)
  assert.ok(near(Canon.iron.r, iron.r) && near(Canon.iron.g, iron.g))
  assert.ok(near(Canon.stain.b, Canon.mix(Canon.rgb(Canon.INK), Canon.rgb(Canon.BONE), 0.40).b))
  for (const f of ["bar/modules/ItoPlate.qml", "bar/modules/ItoThemeEffect.qml", "bar/modules/ItoWorld.js"])
    assert.ok(!/#[0-9a-fA-F]{6}\b/.test(fs.readFileSync(path.join(root, f), "utf8").replace(/\/\/.*$/gm, "")), f)
})

test("WD-T9 FIELD alpha cap on light palettes (gate a): fieldK is 1 on dark and mid, < 1 on a wide light span, and scales every FIELD alpha", () => {
  const dark = { r: 0.02, g: 0.02, b: 0.03 }, paper = { r: 0.95, g: 0.94, b: 0.9 }
  for (const k of ALL) {
    assert.equal(Surf.worldFieldK(P(k), "dark", dark, paper), 1, k + " dark")
    assert.equal(Surf.worldFieldK(P(k), "mid", dark, paper), 1, k + " mid")
  }
  assert.equal(Surf.worldFieldK(Surf.WORLDS.fog, "light", paper, dark), 1, "fog has no FIELD alpha")
  for (const k of ["rust", "seep", "cage"]) {
    const K = Surf.worldFieldK(P(k), "light", paper, dark)
    assert.ok(K > 0 && K < 1, `${k} light K ${K}`)
    const full = World.plan(P(k), 1000, 46, "light", { radius: 23 }), cut = World.plan(P(k), 1000, 46, "light", { radius: 23, fieldK: K })
    const fieldMax = (ops) => Math.max(0, ...ops.filter((o) => o.k === "rects").flatMap((o) => o.pts.filter((_, i) => i % 2 === 0).map((_, j) => World.isRim(o.pts[2 * j] + o.s / 2, o.pts[2 * j + 1] + o.s / 2, 1000, 46) ? 0 : o.a)))
    assert.ok(fieldMax(cut) <= fieldMax(full) * K + 1 / 48, `${k} rust FIELD alpha scaled`)
  }
  // the opaque rot bulbs (r <= 1.5, a = 1, light themes only) stay full strength and are excluded from the FIELD |dL| gate (scripts/lab/world-gates.mjs): tiny marks the design allows in red
  const seep = World.plan(Surf.SEEP, 1000, 46, "light", { radius: 23, fieldK: 0.3 })
  assert.ok(seep.filter((o) => o.k === "disc").every((o) => o.a === 1 && o.r <= 1.5))
  assert.equal(World.plan(Surf.WORLDS.rust, 1000, 46, "dark", { radius: 23, fieldK: 1 }).length, World.plan(Surf.WORLDS.rust, 1000, 46, "dark", { radius: 23 }).length, "dark plan unchanged")
  assert.deepEqual(World.plan(Surf.WORLDS.cage, 1000, 46, "dark", { radius: 23 }), World.plan(Surf.WORLDS.cage, 1000, 46, "dark", { radius: 23, fieldK: 1 }))
})

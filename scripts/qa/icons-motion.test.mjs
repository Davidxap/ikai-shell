// Tests for the manga icons' motion (icons-v3.md section 5, bar/modules/ItoIconMotion.js), IM-T1..IM-T8.
//   node --test scripts/qa/icons-motion.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { loadInk, loadQmlJs, root } from "./icon-raster.mjs"

const { Ink } = loadInk()
import { loadSet } from "./icon-set.mjs"
const Real = loadSet()
const Mot = loadQmlJs("bar/modules/ItoIconMotion.js")
const json = (x) => JSON.stringify(x)
const REST = json(Mot.rest())
const EVENTS = (kind) => Object.keys(Mot.DUR[kind])
const KINDS = Object.keys(Mot.DUR)
// a motion key is a kind, or "<kind>:<picture>" for the pictures that have gestures of their own (the AI forms, icons-v4.md section 0)
const baseOf = (mk) => { const b = mk.split(":")[0]; return b === "ind" ? "indicator" : b }
const IDOF = { coffee: "awake", radio: "awake", flashlight: "awake", moon: "night", fog: "night", eye: "record", tape: "record" }
const indOf = (mk, on) => ({ id: IDOF[mk.slice(4)], version: mk.slice(4), on })
const nominalOf = (mk) => mk.startsWith("sky:") ? { sky: mk.slice(4) } : mk.startsWith("ai:") ? { form: mk.slice(3), value: 0.5 } : (mk.startsWith("ind:") ? indOf(mk, true) : Real.NOMINAL[mk])
const rigOf = (mk, state, size = 29) => Real.iconParts(baseOf(mk), state, size, 1).rig
const ctxOf = (kind, state, extra = {}) => ({ rig: rigOf(kind, state), size: 29, n: 1, px: 0, py: 0, which: 1, seed: 3, face: state && state.face, ...extra })
// the state each event is played in (an edge plays in its new state)
const STATE_FOR = {
  disk: { hot: { value: 0.95, hot: true } }, cpu: { hot: { value: 0.95 } }, mem: { full: { value: 1 } },
  battery: { charge: { level: 3, charging: true }, low: { level: 0, critical: true }, omen: { level: 3 } },
  network: { drop: { off: true }, connect: { band: 2 } }, notifications: { dnd: { face: "dnd" }, arrive: { face: "active" } },
  audio: { mute: { mute: true }, louder: { level: 3 } }, media: { play: { face: "pause", playing: true }, toggle: { face: "shuffle", on: true }, omen: { face: "pause", playing: true }, press: { face: "next" } }, bluetooth: { link: { mode: "linked" } }, display: { brighter: { level: 3 } }
}
const stateFor = (kind, ev) => (STATE_FOR[kind] && STATE_FOR[kind][ev]) || (kind.startsWith("ind:") ? indOf(kind, ev !== "off" && !(kind === "ind:eye" && ["omen", "hover"].includes(ev))) : nominalOf(kind))
function moved(p) {
  if (json(p) === REST) return false
  return true
}

test("IM-T1 the curves mirror ItoMotion.js", () => {
  const src = fs.readFileSync(path.join(root, "bar/modules/ItoMotion.js"), "utf8")
  for (const name of Object.keys(Mot.CURVES)) {
    const m = src.match(new RegExp("var " + name + "\\s*=\\s*\\[([^\\]]+)\\]"))
    assert.ok(m, name)
    assert.deepEqual(Mot.CURVES[name], m[1].split(",").map(Number), name)
  }
})

test("IM-T2 every event ends EXACTLY at rest, and amp 0 is rest at every t", () => {
  for (const kind of KINDS) for (const ev of EVENTS(kind)) {
    const ctx = ctxOf(kind, stateFor(kind, ev))
    for (const amp of [1, 1.7]) {
      const d = Mot.duration(kind, ev, amp)
      assert.ok(d > 0, kind + " " + ev)
      for (const t of [d, d + 1, d * 3]) assert.equal(json(Mot.phase(kind, ev, t, amp, 3, ctx)), REST, kind + " " + ev + " amp " + amp + " t " + t)
    }
    for (const t of [0, 50, 200, 900]) assert.equal(json(Mot.phase(kind, ev, t, 0, 3, ctx)), REST, kind + " " + ev + " amp 0")
    assert.equal(Mot.duration(kind, ev, 0), 0)
  }
})

test("IM-T3 every event moves something part way, only groups the drawing has, deterministic, and two plays differ", () => {
  for (const kind of KINDS) for (const ev of EVENTS(kind)) {
    const st = stateFor(kind, ev), ctx = ctxOf(kind, st, { px: 0.7, py: -0.4 }), d = Mot.duration(kind, ev, 1)
    let any = false
    for (let i = 1; i < 12; i++) {
      const p = Mot.phase(kind, ev, d * i / 12, 1, 3, ctx)
      assert.equal(json(p), json(Mot.phase(kind, ev, d * i / 12, 1, 3, ctx)), "deterministic")
      if (moved(p)) any = true
      for (const g of Object.keys(p.groups)) assert.ok(ctx.rig[g], kind + " " + ev + " moves a group the drawing lacks: " + g)
      for (const v of [p.root.dx, p.root.dy, p.root.rot, p.root.sx, p.root.sy, p.glintDx]) assert.ok(Number.isFinite(v))
    }
    assert.ok(any, kind + " " + ev + " never moves")
  }
  // two hovers in a row are not the same gesture (the serial number seeds it)
  for (const kind of ["disk", "cpu", "notifications", "battery"]) {
    const st = Real.NOMINAL[kind], a = [], b = []
    for (let i = 1; i < 10; i++) { a.push(json(Mot.phase(kind, "hover", 60 * i, 1, 3, ctxOf(kind, st, { n: 1 })))); b.push(json(Mot.phase(kind, "hover", 60 * i, 1, 3, ctxOf(kind, st, { n: 2 })))) }
    assert.notEqual(a.join(), b.join(), kind)
  }
})

test("IM-T4 lively (amp 1.7) is longer and travels further than calm (amp 1)", () => {
  for (const kind of KINDS) for (const ev of EVENTS(kind)) {
    assert.equal(Mot.duration(kind, ev, 1.7), Math.round(Mot.DUR[kind][ev] * 1.7))
  }
  const mag = (p) => Math.abs(p.root.dx) + Math.abs(p.root.dy) + Math.abs(p.root.rot) + Math.abs(1 - p.root.sx) + Math.abs(1 - p.root.sy)
    + Object.values(p.groups).reduce((s, g) => s + Math.abs(g.dx) + Math.abs(g.dy) + Math.abs(g.rot) + Math.abs(1 - g.sx) + Math.abs(1 - g.sy), 0)
  for (const [kind, ev] of [["disk", "hover"], ["cpu", "hover"], ["notifications", "hover"], ["battery", "hover"], ["network", "hover"], ["disk", "omen"]]) {
    const ctx = ctxOf(kind, stateFor(kind, ev))
    let m1 = 0, m2 = 0
    for (let i = 1; i < 40; i++) { m1 = Math.max(m1, mag(Mot.phase(kind, ev, Mot.duration(kind, ev, 1) * i / 40, 1, 3, ctx))); m2 = Math.max(m2, mag(Mot.phase(kind, ev, Mot.duration(kind, ev, 1.7) * i / 40, 1.7, 3, ctx))) }
    assert.ok(m2 > m1 * 1.3, kind + " " + ev + " " + m1.toFixed(3) + " vs " + m2.toFixed(3))
  }
})

test("IM-T5 the pointer: the hover holds a follow that is zero with the pointer centred, and the leave lets it go", () => {
  const d = Mot.duration("mem", "hover", 1)
  const held = Mot.phase("mem", "hover", d, 1, 3, ctxOf("mem", { value: 0.9 }, { px: 1, py: 0 }))
  assert.ok(held.groups.iris0 && held.groups.iris0.dx > 0.6, "the eyes look toward the pointer")
  assert.ok(held.groups.iris2.dx < held.groups.iris0.dx, "the last eye lags")
  assert.equal(json(Mot.phase("mem", "hover", d, 1, 3, ctxOf("mem", { value: 0.9 }, { px: 0, py: 0 }))), REST, "pointer centred: at rest")
  assert.equal(json(Mot.phase("mem", "leave", Mot.duration("mem", "leave", 1), 1, 3, ctxOf("mem", { value: 0.9 }, { px: 1 }))), REST)
  const disk = Mot.phase("disk", "hover", Mot.duration("disk", "hover", 1), 1, 3, ctxOf("disk", { value: 0.5 }, { px: -1 }))
  assert.ok(disk.glintDx < -1, "the platter's sheen slides with the pointer")
})

test("IM-T6 state edges", () => {
  const E = Mot.edge
  assert.equal(E("disk", { value: 0.5 }, { value: 0.5 + 1 / 48 }), "write")
  assert.equal(E("disk", { value: 0.5 }, { value: 0.5 }), "")
  assert.equal(E("disk", { value: 0.88 }, { value: 0.95, hot: true }), "hot")
  assert.equal(E("cpu", { value: 0.2 }, { value: 0.5 }), "load")
  assert.equal(E("cpu", { value: 0.8 }, { value: 0.9 }), "hot")
  assert.equal(E("cpu", { value: 0.5 }, { value: 0.2 }), "")
  assert.equal(E("mem", { value: 0.2 }, { value: 0.4 }), "use")
  assert.equal(E("mem", { value: 0.9 }, { value: 0.95 }), "full")
  assert.equal(E("battery", { level: 2 }, { level: 2, charging: true }), "charge")
  assert.equal(E("battery", { level: 2 }, { level: 1 }), "low")
  assert.equal(E("battery", { level: 1 }, { level: 0, critical: true }), "low")
  assert.equal(E("battery", { level: 3 }, { level: 2 }), "")
  assert.equal(E("network", { band: 3 }, { off: true }), "drop")
  assert.equal(E("network", { off: true }, { band: 2 }), "connect")
  assert.equal(E("network", { band: 2 }, { band: 3 }), "")
  assert.equal(E("notifications", { face: "idle" }, { face: "dnd" }), "dnd")
  assert.equal(E("notifications", { face: "idle" }, { face: "active" }), "arrive")
  assert.equal(E("notifications", { face: "active" }, { face: "idle" }), "")
  assert.equal(E("audio", { level: 1 }, { level: 2 }), "louder")
  assert.equal(E("audio", { level: 2 }, { mute: true }), "mute")
  assert.equal(E("audio", { level: 2 }, { level: 1 }), "")
})

test("IM-T10 the AI quota's edges (icons-v4.md section 1.2) and every form's rig has the groups its gestures move", () => {
  const E = Mot.edge
  assert.equal(E("ai:brain", { form: "brain", value: 0.4 }, { form: "brain", value: 0.95 }), "full")
  assert.equal(E("ai:brain", { form: "brain", value: 0.4 }, { form: "brain", value: 0.46 }), "soak")
  assert.equal(E("ai:brain", { form: "brain", value: 0.4 }, { form: "brain", value: 0.43 }), "")
  assert.equal(E("ai:eye", { form: "eye", value: 0.8 }, { form: "eye", value: 0.2 }), "drain")
  assert.equal(E("ai:eye", { form: "eye", value: 0.8 }, { form: "eye", value: 0.6 }), "")
  assert.equal(E("ai:spiral", { form: "brain", value: 0.4 }, { form: "spiral", value: 0.4 }), "draw")
  const need = { brain: ["spiral"], classic: ["spiral"], hemispheres: ["lobeL", "lobeR"], neurons: ["pupilsA", "pupilsB", "pupilsC", "cellsA", "cellsB", "cellsC"], eye: ["eye", "iris"], spiral: ["spiral", "bead"] }
  for (const [form, groups] of Object.entries(need)) {
    const rig = rigOf("ai:" + form, { form, value: 0.5 })
    for (const g of groups) assert.ok(rig[g], form + " lacks the group " + g)
  }
  // a hover never leaves a group displaced once the pointer is centred (the follow is zero)
  for (const form of Object.keys(need)) {
    const mk = "ai:" + form, ctx = ctxOf(mk, nominalOf(mk), { px: 0, py: 0 })
    assert.equal(json(Mot.phase(mk, "hover", Mot.duration(mk, "hover", 1), 1, 3, ctx)), REST, mk)
  }
})

test("IM-T11 media edges (icons-v4.md section 2.3)", () => {
  const E = Mot.edge
  assert.equal(E("media", { face: "play" }, { face: "pause", playing: true }), "play")
  assert.equal(E("media", { face: "pause", playing: true }, { face: "play" }), "")
  assert.equal(E("media", { face: "shuffle", on: false }, { face: "shuffle", on: true }), "toggle")
  assert.equal(E("media", { face: "repeat", loop: "playlist" }, { face: "repeat", loop: "track" }), "toggle")
  assert.equal(E("media", { face: "prev" }, { face: "next" }), "")
})

test("IM-T12 indicator edges (icons-v4.md section 3)", () => {
  const E = Mot.edge
  assert.equal(E("ind:coffee", { on: false }, { on: true }), "on")
  assert.equal(E("ind:tape", { on: true }, { on: false }), "off")
  assert.equal(E("ind:eye", { on: true }, { on: true }), "")
})

test("IM-T13 sky edges (icons-v4.md section 4)", () => {
  assert.equal(Mot.edge("sky:rain", { sky: "cloud" }, { sky: "rain" }), "arrive")
  assert.equal(Mot.edge("sky:rain", { sky: "rain" }, { sky: "rain" }), "")
})

test("IM-T7 omens are rare (about 1 in 240 update-minutes), never closer than 20 min, never off or with motion off", () => {
  let fired = 0, last = -1e15
  const minutes = 240 * 400
  for (let m = 0; m < minutes; m++) {
    const now = m * 60000 + 1234
    if (Mot.omenDue("disk", 7, now, -1e15, true, 1)) fired++
  }
  assert.ok(fired > 400 * 0.75 && fired < 400 * 1.25, "rate " + fired + " per " + minutes + " minutes")
  let n = 0
  for (let m = 0; m < minutes; m++) {
    const now = m * 60000
    if (Mot.omenDue("cpu", 7, now, last, true, 1)) { assert.ok(now - last >= 20 * 60000); last = now; n++ }
  }
  assert.ok(n > 0)
  for (let m = 0; m < 20000; m++) {
    assert.equal(Mot.omenDue("disk", 7, m * 60000, -1e15, false, 1), false)
    assert.equal(Mot.omenDue("disk", 7, m * 60000, -1e15, true, 0), false)
  }
})

test("IM-T8 an omen never falsifies a reading: it never scales a level (the datum) and ends at rest", () => {
  for (const kind of KINDS) {
    if (kind === "ai:eye") continue      // the eye's omen ends in a blink: the lids close over the soak and open again, the bake never changes (icons-v4.md section 1.2)
    const st = stateFor(kind, "omen"), ip = Real.iconParts(baseOf(kind), st, 29, 1), ctx = ctxOf(kind, st)
    const levelGroups = new Set(ip.parts.filter((p) => p.layer === "level" && !p.hidden && p.group).map((p) => p.group))
    const d = Mot.duration(kind, "omen", 1)
    for (let i = 1; i < 30; i++) {
      const p = Mot.phase(kind, "omen", d * i / 30, 1, 3, ctx)
      for (const g of Object.keys(p.groups)) if (levelGroups.has(g)) assert.ok(Math.abs(p.groups[g].sx - 1) < 1e-9 && Math.abs(p.groups[g].sy - 1) < 1e-9, kind + " omen scales the level group " + g)
    }
  }
})

test("IM-B1 bench: one pose costs under 50 us (median)", () => {
  const ctx = ctxOf("mem", { value: 0.7 }, { px: 0.4 })
  const ts = []
  for (let r = 0; r < 7; r++) {
    const t0 = process.hrtime.bigint()
    for (let i = 0; i < 2000; i++) Mot.phase(KINDS[i % KINDS.length], "hover", (i * 7) % 600, 1, 3, ctx)
    ts.push(Number(process.hrtime.bigint() - t0) / 2000 / 1000)
  }
  ts.sort((a, b) => a - b)
  assert.ok(ts[3] < 50, "median " + ts[3].toFixed(2) + " us")
})

test("IM-T9 the hover's glance (the icon cannot see the pointer) goes to a seeded side, never the centre, and varies", () => {
  const sides = new Set()
  for (let n = 1; n < 60; n++) {
    const g = Mot.glance(5, n)
    assert.ok(Math.abs(g.px) >= 0.55 && Math.abs(g.px) <= 1 && g.py >= -0.5 && g.py <= 0.35)
    assert.deepEqual(g, Mot.glance(5, n))
    sides.add(Math.sign(g.px))
  }
  assert.equal(sides.size, 2)
})

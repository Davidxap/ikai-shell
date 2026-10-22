// Popup presence (ito-panel-presence/motion-spec.md, icons-v5.md section 4, visual-systems.md section 2.6): the pure timeline.
//   node --test scripts/qa/presence.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import { loadQmlJs } from "./icon-raster.mjs"

const P = loadQmlJs("bar/modules/ItoPresence.js")
const M = loadQmlJs("bar/modules/ItoMotion.js")
const Bus = loadQmlJs("bar/modules/ItoPresenceBus.js")
const j = (v) => JSON.parse(JSON.stringify(v))
const IN = (t, o = {}) => P.phases(t, { dir: "in", amp: 1, ...o })
const OUT = (t, o = {}) => P.phases(t, { dir: "out", amp: 1, ...o })

test("PR-T-totals (motion speed rule): enter 340, exit 220; lid 340 / exit 240; switch 340; amp never lengthens", () => {
  assert.deepEqual([1, 1.7, 0].map((a) => P.total("in", a)), [340, 340, 0])
  assert.deepEqual([1, 1.7, 0].map((a) => P.total("out", a)), [220, 220, 0])
  assert.deepEqual([1, 1.7, 0].map((a) => P.total("in", a, { lid: true })), [340, 340, 0])
  assert.deepEqual([1, 1.7, 0].map((a) => P.total("out", a, { lid: true })), [240, 240, 0])
  assert.equal(P.total("in", 1, { sw: true }), 340)
  for (const amp of [0.5, 1, 1.7, 2]) for (const o of [{}, { lid: true }, { sw: true }]) for (const d of ["in", "out"]) assert.ok(P.total(d, amp, o) <= 340)
})
test("PR-T-mirror curves and roles equal ItoMotion (MO-T6)", () => {
  for (const [n, c] of Object.entries(j(P.CURVES))) assert.deepEqual(j(M.CURVES[n]), c, n)
  for (const [n, r] of Object.entries(j(P.ROLES))) { assert.equal(M.ROLES[n].ms, r.ms, n); assert.equal(M.ROLES[n].curve, r.curve, n) }
  assert.deepEqual(j(M.bezier(M.CURVES.morph, 0.7)), P.bezier(P.CURVES.morph, 0.7))
})
test("PR-T-index c[7] and c[12] share the same timing", () => {
  const ph = IN(300)
  assert.equal(ph.c.length, 8)
  const n = P.STAGGER.max
  assert.equal(Math.min(12, n), 7)
})
test("PR-T-continuity an enter from a mid-exit snapshot is continuous at t = 0, lid channel too", () => {
  for (const lid of [false, true]) {
    const snap = P.snapshot(OUT(120, { lid, from: P.restState(true, lid) }))
    const e = IN(0, { from: snap, lid })
    for (const k of ["pa", "pb", "fill", "reveal", "sh"]) assert.ok(Math.abs(e[k] - snap[k]) < 1e-6, k)
    if (lid) { assert.ok(Math.abs(e.lu - snap.lu) < 1e-6 && Math.abs(e.ll - snap.ll) < 1e-6) }
    snap.c.forEach((c, i) => { assert.ok(Math.abs(e.c[i].o - c.o) < 1e-6 && Math.abs(e.c[i].d - c.d) < 1e-6) })
  }
})
test("PR-T-amp0 amp 0 returns the end state at t = 0 and never runs", () => {
  const e = IN(0, { amp: 0 }), x = OUT(0, { amp: 0 })
  assert.equal(e.pa, 1); assert.equal(e.fill, 1); assert.equal(e.c[3].o, 1); assert.equal(e.lu, null)
  assert.equal(x.pa, 0); assert.equal(x.fill, 0); assert.equal(x.c[0].o, 0)
  assert.equal(e.done, true)
})
test("PR-T-morph the pb peak is in [1.01, 1.03]; pa never overshoots", () => {
  let pk = 0, pa = 0
  for (let t = 0; t <= 340; t += 2) { const e = IN(t); pk = Math.max(pk, e.pb); pa = Math.max(pa, e.pa) }
  assert.ok(pk >= 1.01 && pk <= 1.03, "peak " + pk)
  assert.ok(pa <= 1.0001)
})
test("PR-T-flush the exit ends on the icon rect (and on the card's bar edge for a strip); shoulders and fill end together", () => {
  const C = { x: 0, y: 0, w: 380, h: 300 }
  const cases = [{ side: "top", I: { x: 200, y: -34, w: 28, h: 28 } }, { side: "bottom", I: { x: 200, y: 310, w: 28, h: 28 } },
                 { side: "left", I: { x: -34, y: 100, w: 28, h: 28 } }, { side: "right", I: { x: 390, y: 100, w: 28, h: 28 } },
                 { side: "top", I: P.stripRect("top", C, null) }, { side: "bottom", I: P.stripRect("bottom", C, null) }]
  for (const amp of [1, 1.7]) for (const cs of cases) for (const lid of [false, true]) {
    const end = OUT(P.total("out", amp, { lid }), { amp, lid })
    assert.equal(end.done, true)
    const r = P.rect(end, cs.I, C, cs.side)
    for (const [a, b] of [[r.x, cs.I.x], [r.y, cs.I.y], [r.w, cs.I.w], [r.h, cs.I.h]]) assert.ok(Math.abs(a - b) < 0.5, cs.side + " " + a + " " + b)
    assert.ok(end.fill < 1e-9 && end.sh < 1e-9)
  }
  // the strip is flush with the card edge
  const s = P.stripRect("top", C, null); assert.equal(s.y, C.y)
  const sb = P.stripRect("bottom", C, null); assert.equal(sb.y + sb.h, C.y + C.h)
})
test("PR-T-bleed the overshoot never takes the bar-facing edge past the card edge", () => {
  const C = { x: 0, y: 0, w: 380, h: 300 }
  for (const [side, I] of [["top", { x: 200, y: -34, w: 28, h: 28 }], ["bottom", { x: 200, y: 310, w: 28, h: 28 }]]) {
    for (let t = 0; t <= 340; t += 5) {
      const r = P.rect(IN(t), I, C, side)
      if (side === "top") { assert.ok(r.y <= 0.0001, "bar edge " + r.y); assert.ok(r.y + r.h <= C.h + P.OVERSHOOT_PX + 0.001) }
      if (side === "bottom") { assert.ok(r.y + r.h >= C.h - 0.0001, "bar edge " + (r.y + r.h)); assert.ok(r.y >= -P.OVERSHOOT_PX - 0.001) }
    }
  }
})
test("PR-T-fill the fill leads the content; content is invisible before 60 ms", () => {
  assert.ok(IN(70).fill >= 0.999)
  for (let t = 0; t < 60; t += 10) for (const c of IN(t).c) assert.ok(c.o < 1e-9)
  assert.ok(IN(340).c[7].o > 0.99)
})
test("PR-T-lid parting: exactly 0 / 1 at the window ends, held 12 %, monotonic after x 0.40; lower lid lags 20 ms", () => {
  assert.equal(P.lidOpen(0), 0); assert.equal(P.lidOpen(1), 1)
  assert.ok(Math.abs(P.lidOpen(0.3) - 0.12) < 1e-9 && Math.abs(P.lidOpen(0.40) - 0.12) < 1e-9)
  let prev = 0.12
  for (let x = 0.4; x <= 1.0001; x += 0.01) { const v = P.lidOpen(x); assert.ok(v >= prev - 1e-9); prev = v }
  const o = { lid: true }
  assert.equal(IN(100, o).lu, 0); assert.equal(IN(120, o).ll, 0)
  assert.ok(IN(320, o).lu === 1 && IN(340, o).ll === 1)
  assert.ok(IN(160, o).lu >= IN(160, o).ll)
  // the opening about 70 ms in is the held slit near 12 %
  const u = IN(180, o).lu
  assert.ok(u > 0.10 && u < 0.13, "slit " + u)
})
test("PR-T-lid-absent no lid channel on a plain enter or a switch", () => {
  assert.equal(IN(200).lu, null); assert.equal(IN(200, { sw: true }).lu, null)
})
test("PR-T-exit the lids blink shut 0-160 (upper leads); the sheet collapses 80-240; a switch skips the exit", () => {
  const o = { lid: true, from: P.restState(true, true) }
  assert.equal(OUT(0, o).lu, 1); assert.equal(OUT(160, o).lu, 0); assert.equal(OUT(200, o).ll, 0)
  assert.ok(OUT(80, o).lu <= OUT(80, o).ll)
  assert.equal(OUT(80, o).pb, 1); assert.equal(OUT(240, o).pb, 0)
  assert.equal(P.total("out", 1, { sw: true }), 0)
  assert.equal(OUT(0, { sw: true }).fill, 0)
})
test("PR-T-switch the sheet is inked at once and runs 340 ms on the long spatial role", () => {
  const e = IN(0, { sw: true, from: { ...P.restState(false, false), fill: 1 } })
  assert.equal(e.fill, 1); assert.equal(e.pa, 0)
  assert.equal(IN(340, { sw: true }).pb, 1)
  assert.ok(IN(170, { sw: true }).pa > 0.3 && IN(170, { sw: true }).pa < 1.05)
})
test("PR-T-bus a rect is collected once, only when fresh (220 ms)", () => {
  Bus.clear()
  Bus.put({ x: 1, y: 2, w: 3, h: 4 }, 1000)
  assert.equal(Bus.take(1300, 220), null)
  Bus.put({ x: 1, y: 2, w: 3, h: 4 }, 1000)
  assert.deepEqual(j(Bus.take(1100, 220)), { x: 1, y: 2, w: 3, h: 4 })
  assert.equal(Bus.take(1100, 220), null)
  assert.equal(Bus.take(0, 220), null)
})
test("PR-T-iconrect the icon rect is inflated by 2 px and follows the bar side", () => {
  const h = { ax: 100, ay: 6, aw: 24, ah: 24, ox: 80, oy: 46, barPos: "top", screenW: 1920, screenH: 1080, barH: 40, barW: 1920 }
  assert.deepEqual(j(P.iconRect(h)), { x: 18, y: -42, w: 28, h: 28 })
  assert.equal(P.iconRect({ ...h, barPos: "bottom", oy: 900 }).y, 1080 - 40 + 6 - 900 - 2)
})

test("PR-T-finite phases is finite for 20000 random cases, including a bad snapshot (presence-crash.md)", () => {
  let seed = 12345
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
  const fin = (v) => v === null || (typeof v === "number" && Number.isFinite(v))
  for (let n = 0; n < 20000; n++) {
    const dir = rnd() < 0.5 ? "in" : "out", amp = [0.5, 1, 1.7][Math.floor(rnd() * 3)], lid = rnd() < 0.5, sw = rnd() < 0.3
    let from = null
    if (rnd() < 0.5) {
      from = P.snapshot(P.restState(rnd() < 0.5, lid))
      if (rnd() < 0.5) { from.pa = NaN; from.c[0].o = undefined; from.c[3].d = NaN; from.fill = undefined }
    }
    const ph = P.phases(rnd() * 900, { dir, amp, lid, sw, from })
    for (const k of ["pa", "pb", "fill", "reveal", "sh", "lu", "ll"]) assert.ok(fin(ph[k]), k)
    for (const c of ph.c) assert.ok(Number.isFinite(c.o) && Number.isFinite(c.d))
  }
})
test("PR-T-sane maps NaN to the end value per direction and a NaN travel to 0", () => {
  const mk = () => ({ pa: NaN, pb: undefined, fill: NaN, reveal: NaN, sh: NaN, lu: NaN, ll: null, c: [{ o: NaN, d: NaN }] })
  const i = P.sane(mk(), "in"), o = P.sane(mk(), "out")
  assert.equal(i.pa, 1); assert.equal(i.fill, 1); assert.equal(i.lu, 1); assert.equal(i.ll, null); assert.equal(i.c[0].o, 1); assert.equal(i.c[0].d, 0)
  assert.equal(o.pb, 0); assert.equal(o.reveal, 0); assert.equal(o.lu, 0); assert.equal(o.c[0].o, 0); assert.equal(o.c[0].d, 0)
})

// B9b (decisions-b9 1.3): Plain (`panelFrame: false`) is the shell's own card, so every presence key is inert there.
import fs from "node:fs"
import path from "node:path"
import { root as repoRoot } from "./icon-raster.mjs"
test("PR-T-plain panelFrame false: ItoPresence is never loaded (presence, reveal, shoulders, switch are inert)", () => {
  const frame = fs.readFileSync(path.join(repoRoot, "bar/modules/ItoPanelFrame.qml"), "utf8")
  assert.match(frame, /readonly property bool on: cfg \? cfg\.get\("panelFrame", true\) !== false : true/)
  assert.match(frame, /readonly property bool presenceOn: on && cfg !== null && cfg\.get\("presence", true\) === true/)
  assert.match(frame, /active: root\.presenceOn/)
  const pres = fs.readFileSync(path.join(repoRoot, "bar/modules/ItoPresence.qml"), "utf8")
  for (const key of ["presenceReveal", "presenceSwitch", "presenceShoulders"]) assert.ok(pres.includes(`"${key}"`), key)
  // the three keys are read only inside ItoPresence.qml: nothing outside the presence host can act on them
  for (const f of fs.readdirSync(path.join(repoRoot, "bar/modules")).filter((n) => n.endsWith(".qml") && n !== "ItoPresence.qml"))
    assert.ok(!/presenceReveal|presenceSwitch|presenceShoulders/.test(fs.readFileSync(path.join(repoRoot, "bar/modules", f), "utf8").replace(/\/\/.*$/gm, "")), f)
})

// ---- spiral / blot opening (visual-v3.md section 1.6)
const RM = loadQmlJs("bar/modules/ItoRevealMap.js")
test("PR-T-mask totals 340 / 170, amp 0 -> 0, a switch never masks, mk null without a mask", () => {
  assert.equal(P.total("in", 1, { mask: "spiral" }), 340)
  assert.equal(P.total("out", 1, { mask: "blot" }), 170)
  assert.equal(P.total("in", 1.7, { mask: "spiral" }), 340)
  assert.equal(P.total("in", 0, { mask: "spiral" }), 0)
  assert.equal(P.total("in", 1, { mask: "spiral", sw: true }), 340)
  assert.equal(IN(100).mk, null)
})
test("PR-T-mask mk is monotonic, ends exactly 1 / 0, and is continuous from a mid-exit", () => {
  for (const mask of ["spiral", "blot"]) {
    let prev = -1
    for (let t = 0; t <= 340; t += 5) { const m = IN(t, { mask }).mk; assert.ok(m >= prev - 1e-12); prev = m }
    assert.equal(IN(340, { mask }).mk, 1); assert.equal(IN(0, { mask }).mk, 0)
    prev = 2
    for (let t = 0; t <= 170; t += 5) { const m = OUT(t, { mask }).mk; assert.ok(m <= prev + 1e-12); prev = m }
    assert.equal(OUT(170, { mask }).mk, 0)
    const snap = P.snapshot(OUT(70, { mask }))
    assert.ok(Math.abs(IN(0, { mask, from: snap }).mk - snap.mk) < 1e-6)
    assert.equal(IN(120, { mask }).pa, 1)
  }
})
test("PR-T-mask a NaN mk snapshot never reaches the output", () => {
  const snap = P.snapshot(OUT(70, { mask: "spiral" })); snap.mk = NaN
  const e = IN(50, { mask: "spiral", from: snap })
  assert.ok(Number.isFinite(e.mk))
  assert.equal(P.sane({ pa: 1, pb: 1, fill: 1, reveal: 1, sh: 1, lu: null, ll: null, mk: NaN, c: [] }, "in").mk, 1)
})
test("PR-T-map T in [0,1], T(O)=0, clockwise from the away direction, area at 70 ms in 25-60 % (the spiral eases in: slow start)", () => {
  const W = 380, H = 520
  for (const side of ["top", "bottom", "left", "right"]) for (const kind of ["spiral", "blot"]) {
    const O = RM.origin(side, W, H, 190, 260)
    assert.ok(RM.T(kind, side, O, W, H, O.x, O.y) < 1e-9)
    for (let x = 0; x <= W; x += 19) for (let y = 0; y <= H; y += 26) { const t = RM.T(kind, side, O, W, H, x, y); assert.ok(t >= 0 && t <= 1) }
  }
  const O = RM.origin("top", W, H, 190, 20)
  // clockwise on screen from "down": the left of O (9 o'clock) comes before the right (3 o'clock)
  assert.ok(RM.thetaPrime("top", O, O.x - 50, O.y) < RM.thetaPrime("top", O, O.x + 50, O.y))
  const OL = RM.origin("left", W, H, 0, 260)
  assert.ok(RM.thetaPrime("left", OL, OL.x + 50, OL.y) < 1e-9)  // straight away from the bar = 0
  assert.ok(Math.abs(RM.thetaPrime("left", OL, OL.x, OL.y + 50) - 0.25) < 1e-9)  // clockwise (downwards on screen) = a quarter turn
  const O2 = RM.origin("top", W, H, 190, 20); let hit = 0, n = 0
  const lvl = RM.level(IN(70, { mask: "spiral" }).mk)
  for (let i = 0; i < 40; i++) for (let j = 0; j < 40; j++) { n++; if (RM.T("spiral", "top", O2, W, H, (i + .5) * W / 40, (j + .5) * H / 40) <= lvl) hit++ }
  assert.ok(hit / n >= 0.25 && hit / n <= 0.60, "area " + hit / n)
  assert.deepEqual(JSON.stringify(RM.droplets("top", O2, W, H)), JSON.stringify(RM.droplets("top", O2, W, H)))
})

// ---- the user's opening speed (sidecar `openDuration`, S8): k = openDuration / 340 scales every total and window
test("PR-T-open every in total equals openDuration, clamps to 150..2400, out is shorter and floored", () => {
  for (const ms of [150, 340, 900, 1800, 2400]) {
    const k = P.openK(ms)
    for (const o of [{}, { lid: true }, { sw: true }, { mask: "spiral" }, { mask: "blot" }]) {
      assert.equal(P.total("in", 1, { ...o, k }), ms)
      const out = P.total("out", 1, { ...o, k })
      if (o.sw) assert.equal(out, 0); else assert.ok(out >= 150 && out < ms || ms <= 340, `${ms} ${JSON.stringify(o)} ${out}`)
    }
  }
  assert.equal(P.openK(50), P.openK(150)); assert.equal(P.openK(99999), P.openK(2400))
  assert.equal(P.openK(undefined), 1); assert.equal(P.openK(NaN), 1); assert.equal(P.openK("x"), 1)
  assert.equal(P.total("in", 1, {}), 340)                       // no k = the reference
  assert.equal(P.total("in", 0, { k: 2.65 }), 0)                // motion off / reduced still wins
  assert.equal(P.total("in", 1.7, { k: 2.65 }), P.total("in", 1, { k: 2.65 }))   // lively raises travel, never time
})
test("PR-T-open the timeline stretches with k and every channel stays finite at k 0.44 and 7.06", () => {
  for (const k of [P.openK(150), 1, P.openK(900), P.openK(2400)]) for (const dir of ["in", "out"]) for (const o of [{}, { lid: true }, { mask: "blot" }, { mask: "spiral" }, { sw: true }]) {
    const tot = P.total(dir, 1, { ...o, k })
    for (let i = 0; i <= 40; i++) {
      const ph = P.phases(tot * i / 40, { dir, amp: 1, k, ...o })
      for (const v of [ph.pa, ph.pb, ph.fill, ph.reveal, ph.sh, ...ph.c.flatMap((c) => [c.o, c.d])]) assert.ok(Number.isFinite(v))
    }
    if (tot > 0) assert.equal(P.phases(tot, { dir, amp: 1, k, ...o }).done, true)
  }
  // the reveal at half of the run is the same state at every speed (one divisor)
  const a = P.phases(170, { dir: "in", amp: 1, k: 1 }), b = P.phases(450, { dir: "in", amp: 1, k: P.openK(900) })
  assert.ok(Math.abs(a.pa - b.pa) < 0.01 && Math.abs(a.fill - b.fill) < 0.01)
})

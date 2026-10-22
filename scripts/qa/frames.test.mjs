// Popup frame styles (ito-panel-presence 2.2 and 2.4, icons-v5.md section 2.5): the registry and the manga v2 geometry.
//   node --test scripts/qa/frames.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import { loadQmlJs, root } from "./icon-raster.mjs"

const S = loadQmlJs("bar/modules/ItoFrameStyles.js")
const A = loadQmlJs("bar/modules/ItoFrameArt.js")
const SIZES = [[380, 260], [300, 520], [440, 330]]

test("FS-T registry: unknown styles resolve to manga", () => {
  assert.equal(S.resolve("manga"), "manga")
  for (const k of ["chains", "otherworld", "minimal"]) assert.equal(S.resolve(k), k)
  for (const k of ["bogus", undefined, null, ""]) assert.equal(S.resolve(k), "manga", String(k))
  assert.deepEqual([S.radius("manga"), S.radius("chains"), S.radius("otherworld"), S.radius("minimal")], [3, 2, 1, 6])
  assert.deepEqual([S.ruleAlpha("manga"), S.ruleAlpha("chains"), S.ruleAlpha("otherworld"), S.ruleAlpha("minimal")], [0.6, 0.4, 0.6, 0.3])
  assert.equal(S.file("otherworld"), "ItoFrameOtherworld.qml")
  assert.equal(S.file("bogus"), "ItoFrameManga.qml")
  assert.equal(S.artMode("drawn"), "drawn")
  for (const v of ["png", "x", undefined, null]) assert.equal(S.artMode(v), "png")
})
test("FA-T every number of the drawn art is finite and inside the card", () => {
  for (const [W, H] of SIZES) {
    const rule = A.rule(W, H), tone = A.tone(W, H, 26, 24), spl = A.splatter(W, H, 26, 24, 7)
    for (const s of rule) for (const v of [s.x1, s.y1, s.x2, s.y2, s.w]) assert.ok(isFinite(v))
    for (const d of tone) { assert.ok(isFinite(d.x + d.y + d.r + d.a)); assert.ok(d.x >= 0 && d.x <= W && d.y >= 0 && d.y <= H) }
    for (const d of spl) { assert.ok(isFinite(d.x + d.y + d.r)); assert.ok(d.x >= 0 && d.x <= W && d.y >= 0 && d.y <= H) }
    for (const c of [A.corner(W, 11), A.corner(W, 29)]) for (const v of c.poly) assert.ok(isFinite(v))
  }
  for (const bad of [NaN, undefined, null, "x"]) { assert.ok(A.rule(bad, bad).length === 6); assert.ok(A.tone(bad, bad, bad, bad).every((d) => isFinite(d.x))) }
})
test("FA-T keep-out: no ornament above 0.15 inside the content rectangle (the rules, the crack and the fog excepted)", () => {
  for (const [W, H] of SIZES) {
    const ko = A.keepOut(W, H, 26, 24)
    for (const d of A.tone(W, H, 26, 24)) if (A.inside(ko, d.x, d.y)) assert.ok(d.a <= 0.15, `dot ${d.x},${d.y} a ${d.a}`)
    for (const d of A.splatter(W, H, 26, 24, 7)) assert.ok(!A.inside(ko, d.x, d.y), `drop ${d.x},${d.y} in the keep-out`)
    // the corner wedges (top-left; the bottom-right one is the same turned) stay out of the rectangle
    const c = A.corner(W, 11)
    for (let i = 0; i < c.poly.length; i += 2) assert.ok(!A.inside(ko, c.poly[i], c.poly[i + 1]), "corner vertex in the keep-out")
  }
})
test("FA-T the rule's breaks leave the emblem's top-centre gap alone and the screentone/corner zones", () => {
  for (const [W, H] of SIZES) {
    const topBreak = W * 0.27
    assert.ok(Math.abs(topBreak - W / 2) > 60 * A.scale(W) - 5, "the break sits clear of the emblem gap")
    assert.ok(topBreak > 36 * A.scale(W) + 5, "and clear of the torn corner")
    assert.equal(A.rule(W, H).filter((s) => s.w === 2).length, 2, "heavy lower-right: bottom and right")
  }
})
test("FA-T splatter: 8 to 12 drops, seeded (repeatable)", () => {
  for (const [W, H] of SIZES) {
    const a = A.splatter(W, H, 26, 24, 7)
    assert.ok(a.length >= 8 && a.length <= 12, String(a.length))
    assert.deepEqual(A.splatter(W, H, 26, 24, 7), a)
  }
})
test("FA-T no accent at rest: the drawn art touches `hot` only for the rule's alert colour, the splatter and the kana, all alert-only", () => {
  const art = fs.readFileSync(root + "/bar/modules/ItoFrameMangaArt.qml", "utf8")
  assert.ok(/if \(alert && roomy\) \{[\s\S]*fillC/.test(art), "the splatter (hot) is inside the alert branch")
  assert.ok(/ruleC: ink \? \(alert \? ink\.alertRule : ink\.rule\)/.test(art), "the rule is `rule` at rest")
  const manga = fs.readFileSync(root + "/bar/modules/ItoFrameManga.qml", "utf8")
  assert.ok(/opacity: root\.alert \? 1 : 0/.test(manga), "the kana is invisible at rest")
})

// B9b (decisions-b9 1.2): the chains hang on the side rule; the sway is a tip travel, the angle follows
test("chains: tip travel never exceeds the bleed (10 px outside, 14 px inside) at any amp, settle and k", () => {
  const L = (k) => 18 * 7 * k + 8 * k
  for (const k of [0.8, 0.9, 1, 1.15]) for (const amp of [0.3, 1, 1.7]) for (let i = 0; i <= 400; i++) {
    const st = i / 400
    const s = S.chainTip(k, amp, st, false)
    assert.ok(s >= 0 && s <= 8 + 1e-9)
    assert.ok(0.75 * k + s + 0.6 <= 10.0, `outside k${k} amp${amp} settle${st}: ${0.75 * k + s + 0.6}`)   // 0.6 = the secondary rotation at the tip
    assert.ok(2 * k + 2.75 * k + s + 0.6 <= 14.0, `inside k${k}`)
    assert.ok(S.chainAngle(s, L(k)) < 10)
    const sb = S.chainTip(k, amp, st, true)
    assert.ok(sb <= 3.5 + 1e-9 && sb >= 0)
  }
  assert.equal(S.chainAngle(NaN, 100), 0)
  assert.equal(S.chainAngle(5, 0), 0)
  assert.ok(S.chainTip(1, 1, 0, false) < S.chainTip(1, 1, 1, false), "rest 0.44 of the open travel")
  assert.ok(Math.abs(S.chainTip(1, 1, 0, false) / S.chainTip(1, 1, 1, false) - 0.44) < 1e-9)
  assert.equal(S.chainTip(1, 1, 0, true), 1.6)
})

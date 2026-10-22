// D4 "not here" table (bar/modules/ItoApplies.js): every row, every form.   node --test scripts/qa/applies.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import { loadQmlJs } from "./icon-raster.mjs"

const A = loadQmlJs("bar/modules/ItoApplies.js")
const S = loadQmlJs("bar/modules/ItoSurfaces.js")
const cfg = (o = {}) => { o = { formParity: false, ...o }; return { get: (k, d) => (o[k] === undefined ? d : o[k]) } }
const why = (k, o, f) => A.why(k, cfg(o), f)

test("AP-1 cuts only in Islands", () => {
  for (const k of ["cutLeft", "cutRight"])
    for (const f of A.FORMS) assert.equal(why(k, {}, f), f === "shibumi" ? "" : "Only the Islands shape can be cut.")
})
test("AP-2 corners say why only in Full", () => {
  for (const f of A.FORMS) assert.equal(why("barRadius", {}, f), f === "full" ? "Full runs edge to edge: no corners." : "")
})
test("AP-3 barFloat: Islands always, Dock without parity, never Full/Fit/Notch", () => {
  for (const f of ["full", "fit", "notch"]) assert.equal(why("barFloat", {}, f), "This shape always touches the edge.")
  assert.equal(why("barFloat", {}, "shibumi"), "")
  assert.equal(why("barFloat", {}, "dock"), "")
  assert.match(why("barFloat", { formParity: true }, "dock"), /Dock floats/)
})
test("AP-4 dockFloat needs the Dock and parity", () => {
  for (const f of A.FORMS.filter((x) => x !== "dock")) assert.equal(why("dockFloat", { formParity: true }, f), "Only the Dock floats on its own.")
  assert.equal(why("dockFloat", {}, "dock"), "Needs form parity on.")
  assert.equal(why("dockFloat", { formParity: true }, "dock"), "")
})
test("AP-5 pills and shadow in the V2 forms follow parity; the Notch has no shadow", () => {
  for (const k of ["fxPills", "barShadow"])
    for (const f of ["full", "fit", "dock", "notch"]) {
      const off = why(k, {}, f), on = why(k, { formParity: true }, f)
      if (k === "barShadow" && f === "notch") { assert.equal(off, "The Notch draws no shadow."); assert.equal(on, off) }
      else { assert.equal(off, "Only in Islands (turn on form parity)."); assert.equal(on, "") }
    }
  for (const k of ["fxPills", "barShadow"]) assert.equal(why(k, {}, "shibumi"), "")
})
test("AP-6 dependent layers say what they need, in every form", () => {
  for (const f of A.FORMS) {
    assert.equal(why("fxTorn", { fxBorder: false }, f), "Needs Border on.")
    assert.equal(why("fxTorn", {}, f), "")
    assert.equal(why("fxFogDrift", {}, f), "Needs Fog on.")
    assert.equal(why("fxFogDrift", { fxFog: true }, f), "")
    assert.equal(why("surfaceVeins", {}, f), "Needs Blood on.")
    assert.equal(why("surfaceVeins", { fxBlood: true }, f), "")
    assert.equal(why("bloodSeep", {}, f), "Needs Blood on.")
    assert.equal(why("bloodSeep", { fxBlood: true }, f), "")
    assert.equal(why("surfaceGrain", { fxGrain: false }, f), "Needs Grain on.")
    assert.equal(why("surfaceGrain", {}, f), "")
  }
})
test("AP-7 pill opacity needs pills, then the form rule", () => {
  assert.equal(why("surfacePill", {}, "shibumi"), "Needs Widget pills on.")
  assert.equal(why("surfacePill", { fxPills: true }, "shibumi"), "")
  assert.equal(why("surfacePill", { fxPills: true }, "notch"), "Only in Islands (turn on form parity).")
  assert.equal(why("surfacePill", { fxPills: true, formParity: true }, "notch"), "")
})
test("AP-8 every table key is covered, unknown keys and forms never throw", () => {
  assert.equal(why("nope", {}, "dock"), "")
  assert.equal(why("barRadius", {}, "weird"), "")
  assert.ok(A.KEYS.length >= 12)
})
test("AP-9 the defaults the table assumes are the real ones", () => {
  for (const k of Object.keys(A.DEFAULT)) assert.equal(A.DEFAULT[k], S.defaults[k], k)
})

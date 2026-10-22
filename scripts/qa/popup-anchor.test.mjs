// Popup anchor (popup-anchor.md): the pure clamp of ItoLayout.alongStart.
//   node --test scripts/qa/popup-anchor.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import { loadQmlJs } from "./icon-raster.mjs"

const L = loadQmlJs("bar/modules/ItoLayout.js")
const centre = (start, size) => start + size / 2

test("PA-T1 a popup is centred on its icon when there is room", () => {
  const s = L.alongStart(1300, 60, 420, 2560, 0)
  assert.equal(centre(s, 420), 1330)
})
test("PA-T2 it is clamped at both ends of the screen, keeping the margin", () => {
  assert.equal(L.alongStart(10, 30, 420, 2560, 12), 12)
  assert.equal(L.alongStart(2500, 30, 420, 2560, 12), 2560 - 420 - 12)
  assert.equal(L.alongStart(2500, 30, 420, 2560, 0), 2140)
})
test("PA-T3 a popup wider than the screen starts at the margin", () => {
  assert.equal(L.alongStart(100, 30, 900, 800, 12), 12)
})
test("PA-T4 the result is whole pixels and stays inside the screen for any icon", () => {
  for (let x = -50; x < 2700; x += 37.3) {
    const s = L.alongStart(x, 28.5, 421, 2560, 8)
    assert.ok(Number.isInteger(s))
    assert.ok(s >= 8 && s + 421 <= 2560 - 8)
  }
})
test("PA-T5 same maths on a side bar (heights)", () => {
  assert.equal(centre(L.alongStart(700, 40, 500, 1440, 12), 500), 720)
})

// KeyboardPanel (shell) puts the card at `extent + gap` from the bar's edge; the engine's bar window is screen-sized.
const panel = (pos, o = {}) => Object.assign({ barPos: pos, barH: 1440, barW: 2560, screenW: 2560, screenH: 1440, margin: 8, gap: 8, verticalContentInset: 20, bar: { barSize: 46 } }, o)
test("PA-T6 gapFor puts the card right under a top bar even when the bar window is the whole screen", () => {
  const p = panel("top")
  p.gap = L.gapFor(p)
  assert.equal(p.barH + p.gap, 46 + 8)
})
test("PA-T7 same for bottom, left and right bars (the panel mirrors the formula)", () => {
  for (const pos of ["bottom", "left", "right"]) {
    const p = panel(pos)
    p.gap = L.gapFor(p)
    const ext = pos === "left" || pos === "right" ? p.barW : p.barH
    assert.equal(ext + p.gap, 46 + 8, pos)
  }
})
test("PA-T8 a bar window that is only the bar keeps the plain gap", () => {
  const p = panel("top", { barH: 46 })
  assert.equal(L.gapFor(p), 8)
})
test("PA-T9 popupHeight/Width keep their room once the gap is corrected", () => {
  const p = panel("top")
  p.gap = L.gapFor(p)
  assert.equal(L.popupHeight(p, 5000), 1440 - (46 + 8 + 8))
})

// Every popup emblem is the widget's CURRENT icon (ItoEmblemMap.js), and the frame draws it with ItoImage.
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const src = fs.readFileSync(path.join(root, "bar/modules/ItoEmblemMap.js"), "utf8").replace(/^\.pragma library\n/, "")
const M = new Function(`${src}; return { art, isLevel, kinds }`)()
const ICON = path.join(root, "bar/modules/ito-art")

// popup -> emblem the plugins pass to ItoPanelFrame
const POPUPS = { display: "eye", audio: "waves", network: "signal", bluetooth: "rune", power: "flame", player: "spiral",
  notifications: "phone", cpu: "needle", mem: "web", disk: "amigara", weather: "sun" }

test("each popup emblem resolves to an existing icon of its widget", () => {
  for (const [popup, kind] of Object.entries(POPUPS)) {
    const a = M.art(kind, "brain")
    assert.ok(a, `${popup}: no icon for ${kind}`)
    assert.ok(fs.existsSync(path.join(ICON, a)), `${popup}: ${a} missing`)
  }
})
test("display shows the current display icon, ai follows aiStyle, the clock keeps its sign", () => {
  assert.equal(M.art("eye"), "instruments/display-3.png")
  assert.equal(M.art("mind", "brain"), "system/brain.png")
  assert.equal(M.art("mind", "neurons"), "system/ai-neurons.png")
  assert.equal(M.art("clock"), "")
})
test("every sky resolves", () => {
  for (const k of ["sun", "moon", "cloud", "rain", "storm", "snow", "fog"]) assert.ok(fs.existsSync(path.join(ICON, M.art(k))), k)
})
test("the frame draws the resolved icon through ItoImage", () => {
  const f = fs.readFileSync(path.join(root, "bar/modules/ItoPanelFrame.qml"), "utf8")
  assert.match(f, /EmblemMap\.art\(/)
  assert.match(f, /ItoImage \{[^}]*root\.artBase \+ root\.emblemArt/s)
})

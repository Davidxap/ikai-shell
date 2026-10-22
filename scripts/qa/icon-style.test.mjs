// The per-icon style (iconStyleOverrides, ItoIconMap.js): a pure parse, and which style a family gets.
//   node --test scripts/qa/icon-style.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import { loadQmlJs } from "./icon-raster.mjs"

const M = loadQmlJs("bar/modules/ItoIconMap.js")

test("IS-T1 parseOverrides: families and styles only, case and spaces forgiven, the rest dropped", () => {
  assert.deepEqual({ ...M.parseOverrides("ai=current, media = MANGA") }, { ai: "current", media: "manga" })
  assert.deepEqual({ ...M.parseOverrides("bogus=manga,ai=weird,=,disk") }, {})
  assert.deepEqual({ ...M.parseOverrides("") }, {})
  assert.deepEqual({ ...M.parseOverrides(undefined) }, {})
  assert.equal(M.formatOverrides({ media: "manga", ai: "current" }), "ai=current,media=manga")
})

test("IS-T2 styleFor: an override wins; otherwise the global style, except the families that default to the old drawing", () => {
  assert.equal(M.styleFor("current", "", "disk"), "current")
  assert.equal(M.styleFor("manga", "", "disk"), "manga")
  assert.equal(M.styleFor("manga", "disk=current", "disk"), "current")
  assert.equal(M.styleFor("current", "disk=manga", "disk"), "manga")        // opt in while the rest is current
  assert.equal(M.styleFor("manga", "", "media"), "current")                 // a family that defaults to the old drawing
  assert.equal(M.styleFor("manga", "", "cpu"), "manga")
  assert.equal(M.styleFor("manga", "", "disk"), "manga")
  assert.equal(M.styleFor("manga", "", "mem"), "current")
  assert.equal(M.styleFor("manga", "media=manga", "media"), "manga")
  assert.equal(M.styleFor("manga", "tray=current", "chevron"), "current")   // the tray's kind is chevron
  assert.equal(M.styleFor("manga", "*", "disk"), "manga")                   // "*" (the Control Centre's previews) is no override
})

test("IS-T3 drawn: with iconStyle unset and no overrides nothing is drawn (the default path is untouched); user pictures never map", () => {
  const src = "/x/bar/modules/ito-art/system/disk.png"
  assert.equal(M.drawn("current", "", src, true), null)
  assert.ok(M.drawn("manga", "", src, true))
  assert.equal(M.drawn("manga", "disk=current", src, true), null)
  assert.ok(M.drawn("current", "disk=manga", src, true))
  assert.equal(M.drawn("manga", "disk=manga", src, false), null)
  assert.equal(M.drawn("manga", "", "/x/bar/modules/ito-art/media/media-play.png", true), null)
  assert.ok(M.drawn("manga", "media=manga", "/x/bar/modules/ito-art/media/media-play.png", true))
})

test("IS-T4 V5-DUP: the panels' duplicate pictures map to the bar's kinds, from the art folder and from the plugins' assets, and follow the family's style", () => {
  const art = "/x/bar/modules/ito-art/"
  const want = {
    "audio/volume.png": { kind: "audio", state: { level: 2 } }, "audio/volume-high.png": { kind: "audio", state: { level: 3 } },
    "audio/volume-low.png": { kind: "audio", state: { level: 1 } }, "audio/volume-muted.png": { kind: "audio", state: { mute: true } },
    "bluetooth/bluetooth.png": { kind: "bluetooth", state: { mode: "linked" } }, "bluetooth/bluetooth-connecting.png": { kind: "bluetooth", state: { mode: "on" } },
    "bluetooth/bluetooth-off.png": { kind: "bluetooth", state: { mode: "off" } },
    "brightness/brightness-high.png": { kind: "display", state: { level: 3 } }, "brightness/brightness-low.png": { kind: "display", state: { level: 1 } }
  }
  const plug = { audio: "ito.audio", bluetooth: "ito.bluetooth", brightness: "ito.display" }
  for (const [rel, w] of Object.entries(want)) {
    assert.deepEqual(JSON.parse(JSON.stringify(M.lookup(art + rel, true))), w, rel)
    const [dir, file] = rel.split("/")
    assert.deepEqual(JSON.parse(JSON.stringify(M.lookup("file:///x/plugins/" + plug[dir] + "/assets/" + file, true))), w, "plugin copy of " + rel)
    // they follow their family: old where the family is old, drawn where it is manga (live overrides)
    assert.equal(M.drawn("current", "", art + rel, true), null, rel)
    assert.equal(M.drawn("manga", "audio=current,bluetooth=current,display=current", art + rel, true), null, rel)
    assert.ok(M.drawn("current", "audio=manga,bluetooth=manga,display=manga", art + rel, true), rel)
  }
  assert.equal(M.lookup(art + "audio/volume-mid.png", true), null)
  assert.equal(M.lookup("/x/plugins/ito.audio/assets/vol.png", true), null)
  assert.ok(M.pilotNames().includes("brightness/brightness-low.png"))
})

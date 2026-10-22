// The Styles page's index (visual-v3.md slice U1/U2): presets use only valid keys and values, every moved key is still reachable from a page.
//   node --test scripts/qa/styles.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { loadQmlJs } from "./icon-raster.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const Idx = loadQmlJs("bar/modules/cc/StylesIndex.js")
const cfg = fs.readFileSync(path.join(root, "bar/modules/bin/ito-config"), "utf8")
const enumBody = cfg.slice(cfg.indexOf("ENUMS = {") >= 0 ? cfg.indexOf("ENUMS = {") : 0)
const enumOf = (key) => { const m = enumBody.match(new RegExp('"' + key + '": \\(([^)]*)\\)')); return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : null }
const BOOLS = new Set([...cfg.match(/BOOLS = \{([^}]*)\}/s)[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]))

test("ST-T1 presets: every key is a real sidecar key with a valid value; Reset covers every preset key", () => {
  for (const p of Idx.PRESETS) for (const [k, v] of Object.entries(p.values)) {
    if (BOOLS.has(k)) assert.equal(typeof v, "boolean", `${p.key}.${k}`)
    else { const e = enumOf(k); assert.ok(e, `no ENUM for ${k}`); assert.ok(e.includes(String(v)), `${p.key}.${k}=${v}`) }
    assert.ok(Idx.RESET_KEYS.includes(k), `reset misses ${k}`)
  }
  assert.ok(Idx.RESET_KEYS.includes("eyeStyle"))
  assert.ok(enumOf("presenceReveal").includes("spiral"))
})
test("ST-T2 current(), snapshot() and restore(): a preset is current when all its keys match, Undo restores unset keys by unsetting", () => {
  const store = {}
  const get = (k, d) => (store[k] === undefined ? d : store[k])
  assert.equal(Idx.current(get), null)
  const p = Idx.PRESETS[2]
  const snap = Idx.snapshot(p, (k, d) => (store[k] === undefined ? null : store[k]))
  assert.ok(Object.values(snap).every((v) => v === null))
  Object.assign(store, p.values)
  assert.equal(Idx.current(get), "uzumaki")
  const r = Idx.restore(snap)
  assert.equal(Object.keys(r.set).length, 0); assert.equal(r.unset.length, Object.keys(p.values).length)
  store.frameStyle = "manga"; store.eyeMotion = "full"
  assert.equal(Idx.current(get), null)
})
test("ST-T3 found(): a query that matches a moved control finds its place; nothing for gibberish", () => {
  assert.equal(Idx.found("chains").section, "FRAME")
  assert.equal(Idx.found("spiral").section, "OPENING")
  assert.equal(Idx.found("rust").section, "LOOK"); assert.equal(Idx.found("rust").page, "bars")   // S13e: the world moved to Bars
  assert.equal(Idx.found("zzzzqq"), null); assert.equal(Idx.found(""), null)
})
test("ST-T4 every key that moved off PageBars is on PageStyles, and PageBars no longer writes it", () => {
  const styles = fs.readFileSync(path.join(root, "bar/modules/cc/PageStyles.qml"), "utf8")
  const bars = fs.readFileSync(path.join(root, "bar/modules/cc/PageBars.qml"), "utf8")
  for (const k of ["panelFrame", "frameStyle", "frameArt", "presence", "presenceReveal", "presenceShoulders", "presenceSwitch", "eyeStyle", "eyeMotion", "vesselFill", "loreLevel"]) {
    assert.ok(styles.includes('"' + k + '"'), "Styles misses " + k)
    assert.ok(!bars.includes('"' + k + '"'), "PageBars still has " + k)
  }
  assert.ok(!styles.includes('act.set("surfaceWorld"') && bars.includes('"surfaceWorld"'), "S13e: the world is a Bars control only (a preset still sets it)")
  assert.ok(!/ito-config|execDetached/.test(fs.readFileSync(path.join(root, "bar/modules/ItoPreviewConfig.qml"), "utf8").replace(/\/\/.*$/gm, "")), "a preview must never write")
  for (const f of ["ItoBarPreview.qml", "ItoRevealPreview.qml", "ItoPreviewConfig.qml"]) assert.ok(!/execDetached|\.set\(|setMany/.test(fs.readFileSync(path.join(root, "bar/modules", f), "utf8")), f)
})
test("ST-T5 every preset sets every bar plate flag explicitly; Uzumaki gives the manga bar; Undo and Reset cover them", () => {
  const FX = ["fxPlate", "fxGlass", "fxPaper", "fxBlood", "fxWood", "fxTone", "fxGrain", "fxBorder", "fxPills", "fxTorn", "fxFog", "fxFogDrift", "bloodSeep"]
  for (const p of Idx.PRESETS) for (const k of FX) { assert.equal(typeof p.values[k], "boolean", `${p.key}.${k}`); assert.ok(k in Idx.DEFAULTS, `DEFAULTS ${k}`); assert.ok(Idx.RESET_KEYS.includes(k), `reset ${k}`) }
  const u = Idx.PRESETS.find((p) => p.key === "uzumaki").values
  for (const k of ["fxPaper", "fxTone", "fxGrain", "fxBorder", "fxTorn", "fxPlate"]) assert.equal(u[k], true, k)
  assert.equal(u.fxWood, true, "S13e: the Uzumaki plate recipe moved into the Uzumaki preset")
  for (const k of ["fxGlass", "fxBlood", "fxPills", "fxFog"]) assert.equal(u[k], false, k)
  for (const k of ["fxPaper", "fxTone"]) for (const key of ["quiet", "silenthill", "otherworld"]) assert.equal(Idx.PRESETS.find((p) => p.key === key).values[k], false, `${key}.${k}`)
  // a bar left on the manga plate is no longer "Uzumaki" once one flag differs
  const store = { ...u }; const get = (k, d) => (store[k] === undefined ? d : store[k])
  assert.equal(Idx.current(get), "uzumaki"); store.fxTorn = false; assert.equal(Idx.current(get), null)
  const snap = Idx.snapshot(Idx.PRESETS[2], () => null); assert.ok("fxTorn" in snap)
})

// S16: the "+ your pack" presets and their undo are gone; the preset cards keep today's values
test("ST-S16 no preset packs: the index exports none, no pack key leaks into PRESETS", () => {
  for (const k of ["PACKS", "withPack", "PACK_UNDO_KEY", "packSnapshot", "parseUndo"]) assert.ok(!(k in Idx), k)
  // the plain preset cards keep today's values: no pack key leaks into PRESETS
  for (const p of Idx.PRESETS) assert.ok(!("shPack" in p.values) && !("menuMark" in p.values) && !("style" in p.values), p.key)
})

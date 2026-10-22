// S13f: the defaults registry (bar/modules/ito-defaults.json) is the one source of what "unset" means.   node --test scripts/qa/defaults.test.mjs
// S13e: every sidecar key is written by exactly one page.
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { loadQmlJs, root } from "./icon-raster.mjs"

const REG = JSON.parse(fs.readFileSync(path.join(root, "bar/modules/ito-defaults.json"), "utf8"))
const D = loadQmlJs("bar/modules/ItoDefaults.js")
const S = loadQmlJs("bar/modules/ItoSurfaces.js")
const Idx = loadQmlJs("bar/modules/cc/StylesIndex.js")
const A = loadQmlJs("bar/modules/ItoApplies.js")
const read = (p) => fs.readFileSync(path.join(root, p), "utf8")
const walk = (dir, out = []) => { for (const f of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) { const p = path.join(dir, f.name); if (f.isDirectory()) { if (!["node_modules", "__pycache__"].includes(f.name)) walk(p, out) } else out.push(p) } return out }
const sources = [...walk("bar"), ...walk("plugins")].filter((p) => /\.(qml|js)$/.test(p) && !p.endsWith("ItoDefaults.js"))
const norm = (v) => String(v)
const isSet = (v) => v !== undefined && v !== null

test("DF-1 ItoDefaults.js is the registry (regenerate: python3 scripts/gen-defaults-js.py)", () => {
  assert.deepEqual(D.DATA, REG)
})

test("DF-2 every entry is well formed", () => {
  const pages = new Set(["bars", "styles", "colors", "effects", "logo", "widgets", "workspaces", "shells", "sysart", "hidden"])
  for (const [k, e] of Object.entries(REG)) {
    assert.ok(pages.has(e.page), `${k}: page ${e.page}`)
    assert.ok(["bool", "enum", "int", "float", "string"].includes(e.kind), `${k}: kind`)
    assert.ok("default" in e && typeof e.section === "string", `${k}`)
    if (e.kind === "bool") assert.ok(e.default === null || typeof e.default === "boolean", `${k}: bool default`)
  }
})

test("DF-3 the other fallback tables agree with the registry (ItoSurfaces.defaults, StylesIndex.DEFAULTS, ItoApplies.DEFAULT)", () => {
  for (const [name, table] of [["ItoSurfaces.defaults", S.defaults], ["StylesIndex.DEFAULTS", Idx.DEFAULTS], ["ItoApplies.DEFAULT", A.DEFAULT]])
    for (const [k, v] of Object.entries(table)) {
      assert.ok(REG[k], `${name}.${k} is not in the registry`)
      assert.equal(norm(REG[k].default), norm(v), `${name}.${k}`)
    }
})

test("DF-4 ito-config: every key it validates has a registry entry, retired keys have none, DEFAULT_ON agrees", () => {
  const cfg = read("bar/modules/bin/ito-config")
  const set = (name) => { const m = cfg.match(new RegExp(name + " = \\{([^}]*)\\}")); return [...m[1].matchAll(/"(\w+)"/g)].map((x) => x[1]) }
  const enums = [...cfg.match(/ENUMS = \{([\s\S]*?)\n# Keys that no/)[1].matchAll(/"(\w+)": \(/g)].map((x) => x[1])
  const retired = [...cfg.match(/RETIRED = \{([^}]*)\}/)[1].matchAll(/"(\w+)"/g)].map((x) => x[1])
  const known = new Set([...set("INTS"), ...set("BOOLS"), ...set("FLOATS"), ...enums])
  // not user settings: they are caches / counters / recipe outputs, or have no sidecar default
  const exempt = new Set(["surfacePlate", "surfaceBorder", "surfaceCorners"])   // validated, but nothing reads them (legacy booleans of the first plate)
  for (const k of known) if (!retired.includes(k) && !exempt.has(k)) assert.ok(REG[k], `${k} is validated by ito-config but missing from the registry`)
  for (const k of retired) assert.ok(!REG[k], `${k} is retired and must not have a default`)
  for (const k of set("DEFAULT_ON")) assert.equal(REG[k] && REG[k].default, true, `DEFAULT_ON ${k}`)
})

// A literal read as `.get("key", <literal>)` in the shell must equal the registry. Known and accepted differences, each with its reason:
const CALLSITE_OK = {
  fetchLogo: "the pane shows '' as 'automatic'",
  wsArtScale: "-1 = unset (the style's own size); the registry says unset",
  markScale: "the spiral mark reads -1 = unset (then sizes by the plain icon rule) and 0.65 once it sizes by the fit",
  menuMark: "the picker reads it with the live default of the bar plugin (spiral) and the effect page with '' for 'none'",
  accentSource: "PageColors shows 'cursor' as the swatch row's pick; the config property answers 'accent'"
}
test("DF-5 every literal fallback at a `.get(\"key\", literal)` call site equals the registry default", () => {
  const bad = []
  for (const f of sources) {
    const text = read(f)
    for (const m of text.matchAll(/\.get\(\s*"([A-Za-z][\w]*)"\s*,\s*(true|false|-?[0-9.]+|"[^"]*")\s*\)/g)) {
      const k = m[1], lit = m[2].replace(/^"|"$/g, "")
      const e = REG[k]
      if (!e || CALLSITE_OK[k]) continue
      if (e.default === null) continue
      if (norm(e.default) !== lit && !(typeof e.default === "number" && Number(lit) === e.default)) bad.push(`${f}: ${k} falls back to ${m[2]}, registry says ${JSON.stringify(e.default)}`)
    }
  }
  assert.deepEqual(bad, [])
})

test("DF-6 differs / changed: only a stored non-default counts; a family key is found by its prefix", () => {
  const get = (o) => (k, d) => (o[k] === undefined || o[k] === "" ? d : o[k])
  assert.equal(D.differs("fxGrain", get({})), false)
  assert.equal(D.differs("fxGrain", get({ fxGrain: true })), false)
  assert.equal(D.differs("fxGrain", get({ fxGrain: false })), true)
  assert.equal(D.differs("barSize", get({ barSize: 46 })), false)
  assert.equal(D.differs("barSize", get({ barSize: 40 })), true)
  assert.equal(D.differs("wsArtScale", get({ wsArtScale: 0.65 })), true)      // default unset: any stored value differs
  assert.equal(D.differs("nope", get({ nope: 1 })), false)
  const vals = { fxGlass: true, "icon:awake": "coffee", eyeMotion: "subtle" }
  assert.deepEqual(D.changed("bars", "LOOK", get(vals), vals), ["fxGlass"])
  assert.deepEqual(D.changed("widgets", undefined, get(vals), vals), ["icon:awake"])
  assert.deepEqual(D.changed("styles", undefined, get(vals), vals), [])
})

// ---- S13e: one writer per key. A key of a page is written (act.set / setMany / toggle / unset, or a CcMeter `key:`) only by that page's files.
const PAGE_FILES = { bars: ["PageBars.qml"], styles: ["PageStyles.qml"], colors: ["PageColors.qml"], effects: ["PageEffects.qml"], logo: ["PageLogo.qml"],
  widgets: ["PageWidgets.qml"], workspaces: ["PageWorkspaces.qml"], shells: ["PageShells.qml"], sysart: ["PageSystemArt.qml", "sysart/"] }
// writes that are deliberate: a preset (applyPreset writes whole looks), a profile, a sheet that only RESETS or mirrors, a recipe tool
const MULTI_OK = {
  style: ["PageWorkspaces.qml"], panelFrame: ["PageStyles.qml"]
}
test("DF-7 S13e: every sidecar key a page writes belongs to that page (no second control for the same key)", () => {
  const files = fs.readdirSync(path.join(root, "bar/modules/cc")).filter((f) => /^Page.*\.qml$/.test(f)).map((f) => "bar/modules/cc/" + f)
    .concat(walk("bar/modules/cc/sysart"))
  const writers = {}
  for (const f of files) {
    const text = read(f)
    const add = (k) => { (writers[k] = writers[k] || new Set()).add(f.replace("bar/modules/cc/", "")) }
    for (const m of text.matchAll(/\b(?:act|actions|page\.act)\.(?:set|toggle|cycle)\(\s*"([\w]+)"/g)) add(m[1])
    for (const m of text.matchAll(/\bkey:\s*"(\w+)"/g)) add(m[1])
    for (const m of text.matchAll(/\bsetting:\s*"(\w+)"/g)) add(m[1])
    for (const m of text.matchAll(/\b(?:optKey|setKey):\s*"(\w+)"/g)) add(m[1])
  }
  const bad = []
  for (const [k, w] of Object.entries(writers)) {
    const e = REG[k]
    if (!e || e.page === "hidden") continue
    const ok = (PAGE_FILES[e.page] || []).concat(MULTI_OK[k] || [])
    for (const f of w) if (!ok.some((o) => f === o || (o.endsWith("/") && f.startsWith(o)))) bad.push(`${k} (page ${e.page}) is also written by ${f}`)
  }
  assert.deepEqual(bad, [])
})

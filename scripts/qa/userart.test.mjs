// Tests for the user-art layer (decisions-userart.md A1a, A1b): light twins, bar-size buckets, user marks.
//   node --test scripts/qa/userart.test.mjs
// Pure: fake index objects only, no file of the user's is read.
import { test } from "node:test"
import assert from "node:assert/strict"
import { loadQmlJs } from "./icon-raster.mjs"

const U = loadQmlJs("bar/modules/ItoUserArt.js")
const M = loadQmlJs("bar/modules/ItoMarks.js")
const ART = "file:///x/bar/modules/ito-art/"
const idx = (files = {}, slots = {}) => ({ root: "/h/assets", files, slots })

test("light twin wins only on a light ground, only when listed", () => {
  const i = idx({ "system/menu-amigara.png": { mtime: 1 }, "system/menu-amigara.light.png": { mtime: 2 } })
  assert.equal(U.map(i, {}, ART + "system/menu-amigara.png", false), "file:///h/assets/system/menu-amigara.png?v=1")
  assert.equal(U.map(i, {}, ART + "system/menu-amigara.png", true), "file:///h/assets/system/menu-amigara.light.png?v=2")
  assert.equal(U.map(i, {}, ART + "system/menu-amigara.png"), "file:///h/assets/system/menu-amigara.png?v=1", "no flag = today's behaviour")
  const plain = idx({ "system/menu-amigara.png": { mtime: 1 } })
  assert.equal(U.map(plain, {}, ART + "system/menu-amigara.png", true), "file:///h/assets/system/menu-amigara.png?v=1", "no twin = the plain file")
  const onlyLight = idx({ "system/menu-amigara.light.png": { mtime: 2 } })
  assert.equal(U.map(onlyLight, {}, ART + "system/menu-amigara.png", false), "", "a twin alone never replaces on a dark theme")
  assert.equal(U.map(onlyLight, {}, ART + "system/menu-amigara.png", true), "file:///h/assets/system/menu-amigara.light.png?v=2")
})

test("a light twin that failed to load falls back to the plain file", () => {
  const i = idx({ "a/b.png": { mtime: 1 }, "a/b.light.png": { mtime: 2 } })
  assert.equal(U.map(i, { "file:///h/assets/a/b.light.png?v=2": true }, ART + "a/b.png", true), "file:///h/assets/a/b.png?v=1")
  assert.equal(U.map(i, { "file:///h/assets/a/b.light.png?v=2": true, "file:///h/assets/a/b.png?v=1": true }, ART + "a/b.png", true), "")
})

test("barPx: nearest bucket within 15 %, else 0", () => {
  assert.equal(U.barPx(28), 28)
  assert.equal(U.barPx(30), 30)
  assert.equal(U.barPx(26), 26)
  assert.equal(U.barPx(25), 24, "a tie goes to the smaller tier (today's 25 px stays 24)")
  assert.equal(U.barPx(27), 26)
  assert.equal(U.barPx(40), 40)
  assert.equal(U.barPx(44), 44)
  assert.equal(U.barPx(88), 88)
  assert.equal(U.barPx(0), 0)
  assert.equal(U.barPx(200), 0)
  assert.equal(U.barPx(56), 56)
})

test("S15: bar 40 x markScale 0.54 / 0.65 / 0.70 / 0.80 / 0.90 picks 24 / 26 / 28 / 32 / 36", () => {
  const pick = (scale) => U.barPx(Math.round(40 * scale))
  assert.deepEqual([0.54, 0.65, 0.70, 0.80, 0.90].map(pick), [24, 26, 28, 32, 36])
})

test("S15: markDef v10 takes the v10 files first, then the plain ones; v9 never looks at them", () => {
  const f = { "marks/bar/26/tomie.png": { mtime: 1 }, "marks/bar/26/tomie.v10.png": { mtime: 2 }, "marks/bar/26/tomie.v10.light.png": { mtime: 3 } }
  const s = { "marks/tomie.png": { mtime: 9 }, ...f }
  const i = idx({}, s)
  assert.equal(U.mark(i, {}, "tomie", 26, false, "v9").url, "file:///h/assets/marks/bar/26/tomie.png?v=1")
  assert.equal(U.mark(i, {}, "tomie", 26, false, "v10").url, "file:///h/assets/marks/bar/26/tomie.v10.png?v=2")
  assert.equal(U.mark(i, {}, "tomie", 26, true, "v10").url, "file:///h/assets/marks/bar/26/tomie.v10.light.png?v=3")
  assert.equal(U.mark(i, {}, "tomie", 26, false).url, "file:///h/assets/marks/bar/26/tomie.png?v=1", "no def = v9")
  const only = idx({}, { "marks/tomie.png": { mtime: 9 }, "marks/bar/28/tomie.png": { mtime: 5 } })
  assert.equal(U.mark(only, {}, "tomie", 28, false, "v10").url, "file:///h/assets/marks/bar/28/tomie.png?v=5", "no v10 file: the plain one")
  const sp = idx({ "system/bar/26/system-normal.v10.png": { mtime: 4 } })
  assert.equal(U.bar(sp, {}, "system/system-normal.png", 26, false, "v10").url, "file:///h/assets/system/bar/26/system-normal.v10.png?v=4")
  assert.equal(U.bar(sp, {}, "system/system-normal.png", 26, false, "v9"), null, "markDef v9: the raster stays")
})

test("bar(): the bucket file of a shipped picture, light twin first on a light ground", () => {
  const i = idx({ "system/bar/28/menu-remina.png": { mtime: 3 }, "system/bar/28/menu-remina.light.png": { mtime: 4 } })
  assert.deepEqual(U.bar(i, {}, "system/menu-remina.png", 28, false), { url: "file:///h/assets/system/bar/28/menu-remina.png?v=3", px: 28 })
  assert.deepEqual(U.bar(i, {}, "system/menu-remina.png", 29, true), { url: "file:///h/assets/system/bar/28/menu-remina.light.png?v=4", px: 28 })
  assert.equal(U.bar(i, {}, "system/menu-remina.png", 48, false), null, "no such bucket")
  assert.equal(U.bar(i, {}, "system/menu-remina.png", 40, false), null, "outside 15 % of every bucket")
  assert.equal(U.bar(idx(), {}, "system/menu-remina.png", 28, false), null, "empty folder: nothing")
  assert.equal(U.bar(null, {}, "system/menu-remina.png", 28, false), null)
})

test("mark(): marks/<name> with bucket, light twin, 512 fallback, failure fallback", () => {
  const s = {
    "marks/beetle.png": { mtime: 1 }, "marks/beetle.light.png": { mtime: 2 }, "marks/bar/28/beetle.png": { mtime: 3 },
  }
  const i = idx({}, s)
  assert.deepEqual(U.mark(i, {}, "beetle", 28, false), { url: "file:///h/assets/marks/bar/28/beetle.png?v=3", px: 28 })
  assert.deepEqual(U.mark(i, {}, "beetle", 28, true), { url: "file:///h/assets/marks/bar/28/beetle.png?v=3", px: 28 }, "the bar file is polarity-free")
  assert.deepEqual(U.mark(i, {}, "beetle", 96, false), { url: "file:///h/assets/marks/beetle.png?v=1", px: 0 })
  assert.deepEqual(U.mark(i, {}, "beetle", 96, true), { url: "file:///h/assets/marks/beetle.light.png?v=2", px: 0 })
  assert.deepEqual(U.mark(i, { "file:///h/assets/marks/bar/28/beetle.png?v=3": true }, "beetle", 28, false), { url: "file:///h/assets/marks/beetle.png?v=1", px: 0 })
  assert.equal(U.mark(i, {}, "nope", 28, false), null)
  assert.equal(U.mark(i, {}, "../x", 28, false), null)
  assert.equal(U.mark(i, { "file:///h/assets/marks/beetle.png?v=1": true }, "beetle", 96, false), null)
})

test("marks(): lists plain files only, as user:<name>", () => {
  const i = idx({}, { "marks/b.png": {}, "marks/b.light.png": {}, "marks/bar/28/b.png": {}, "marks/a-1.png": {}, "boot/bg.png": {} })
  assert.deepEqual(U.marks(i).map(m => m.key), ["user:a-1", "user:b"])
  assert.deepEqual(U.marks(null), [])
  assert.deepEqual(U.marks(idx()), [])
})

test("ItoMarks: user:<name> is tintable, has a default effect and falls back to the sheet spiral", () => {
  assert.equal(M.userName("user:beetle"), "beetle")
  assert.equal(M.userName("user:Bad Name"), "")
  assert.equal(M.userName("custom:x"), "")
  assert.equal(M.isCustom("user:beetle", {}), false)
  assert.equal(M.source(ART, "user:beetle", "/h", {}, "file:///h/assets/marks/beetle.png?v=1"), "file:///h/assets/marks/beetle.png?v=1")
  assert.equal(M.source(ART, "user:beetle", "/h", {}, ""), ART + "system/system-normal.png")
  assert.equal(M.source(ART, "amigara", "/h", {}), ART + "system/menu-amigara.png", "built-in marks unchanged")
  assert.equal(M.autoEffect("user:beetle"), "pulse")
  assert.equal(M.autoEffect("tomie-classic"), "heartbeat")
  assert.equal(M.autoEffect("amigara"), "breathe")
})

test("S2c: user-backed entries (remina, tomie-classic, beetle, uzumaki-eye) resolve through the index", () => {
  assert.equal(M.userName("tomie-classic"), "tomie-classic")
  assert.equal(M.userName("remina-ink"), "", "the drawn one is shipped art")
  assert.equal(M.source(ART, "tomie-classic", "/h", {}, "file:///h/assets/marks/tomie-classic.png?v=1"), "file:///h/assets/marks/tomie-classic.png?v=1")
  assert.equal(M.source(ART, "tomie-classic", "/h", {}, ""), ART + "system/menu-uzumaki.png", "no user file: the Uzumaki mark")
  assert.equal(M.source(ART, "remina-ink", "/h", {}), ART + "system/menu-remina.png")
  assert.equal(M.resolve("tomie", []), "uzumaki", "missing user file -> uzumaki")
  assert.equal(M.resolve("tomie-classic", ["tomie-classic"]), "tomie-classic")
  assert.equal(M.resolve("remina", ["tomie"]), "uzumaki")
  assert.equal(M.resolve("remina-ink", []), "remina-ink", "shipped art never needs the index")
  assert.equal(M.resolve("user:x", []), "user:x")
  assert.equal(M.resolve("amigara", null), "amigara")
  assert.deepEqual(M.menuMarks.map(m => m.key), ["uzumaki-v1", "uzumaki-v2", "uzumaki", "uzumaki-eye", "remina", "remina-ink", "tomie-classic", "beetle", "heather", "heather-sigil", "pyramid-roundel", "pyramid-head", "moth", "eye-roundel", "key", "amigara", "metatron", "metatron-mini", "halo", "flauros", "spiral", "spiral-clean"])
  assert.equal(M.autoEffect("beetle"), "breathe")
  assert.equal(M.autoEffect("uzumaki-eye"), "pulse")
  assert.equal(M.userEntry("tomie-classic").minPx, 36, "Tomie is never drawn under 36 px")
  assert.equal(M.userEntry("beetle").minPx, undefined, "no other mark has a floor")
})

test("S15c: heather is a user-backed extra mark (pyramid was removed; its name stays reserved): hidden without files, resolve to uzumaki, own effects, never twice as user:<name>", () => {
  assert.equal(M.resolve("heather", []), "uzumaki"); assert.equal(M.resolve("pyramid", ["pyramid"]), "pyramid", "a removed key is not user-backed any more")
  assert.equal(M.resolve("heather", ["heather"]), "heather")
  assert.equal(M.autoEffect("heather"), "heartbeat")
  assert.equal(M.migrateMark("heather"), "heather")
  const i = idx({}, { "marks/heather.png": {}, "marks/pyramid.png": {}, "marks/other.png": {} })
  assert.deepEqual(U.marks(i).map(m => m.key), ["user:other"])
  for (const k of ["uzumaki-v1", "uzumaki-v2", "uzumaki", "uzumaki-eye", "remina", "remina-ink", "tomie-classic", "beetle", "amigara", "metatron", "metatron-mini", "halo", "flauros", "spiral", "spiral-clean"])
    assert.ok(M.menuMarks.some(m => m.key === k), "every existing mark is still in the picker: " + k)
})

test("S15c: workspace families uzumaki-eye: alt definition only with def alt, falls back to the plain set, no set = null", () => {
  const e = idx({ "workspaces/bar/26/ws-uzumaki-eye-3-active.png": { mtime: 1 }, "workspaces/bar/26/ws-uzumaki-eye-3-active.light.png": { mtime: 2 }, "workspaces/bar/26/ws-uzumaki-eye-3-active.alt.png": { mtime: 3 } })
  const base = "workspaces/ws-uzumaki-eye-3-active.png"
  assert.equal(U.bar(e, {}, base, 26, false, "v9").url, "file:///h/assets/workspaces/bar/26/ws-uzumaki-eye-3-active.png?v=1")
  assert.equal(U.bar(e, {}, base, 26, true, "v9").url, "file:///h/assets/workspaces/bar/26/ws-uzumaki-eye-3-active.light.png?v=2")
  assert.equal(U.bar(e, {}, base, 26, false, "alt").url, "file:///h/assets/workspaces/bar/26/ws-uzumaki-eye-3-active.alt.png?v=3")
  assert.equal(U.bar(e, {}, base, 26, true, "alt").url, "file:///h/assets/workspaces/bar/26/ws-uzumaki-eye-3-active.alt.png?v=3", "no alt light twin: the alt file serves both")
  const s = idx({ "workspaces/bar/64/ws-uzumaki-eye-2-active.png": { mtime: 5 } })
  assert.equal(U.bar(s, {}, "workspaces/ws-uzumaki-eye-2-active.png", 64, false, "alt").url, "file:///h/assets/workspaces/bar/64/ws-uzumaki-eye-2-active.png?v=5", "alt falls back to the plain set")
  assert.equal(U.bar(idx(), {}, "workspaces/ws-uzumaki-eye-2-active.png", 64, false, "v9"), null, "no set: the card is hidden")
})

test("S2c: marksVer migration table, both directions of remina", () => {
  assert.equal(M.migrateMark("remina"), "remina-ink", "the old drawn planet")
  assert.equal(M.migrateMark("user:remina-real"), "remina", "the user's picture")
  assert.equal(M.migrateMark("user:tomie"), "tomie-classic")
  assert.equal(M.migrateMark("user:beetle"), "beetle")
  assert.equal(M.migrateMark("user:uzumaki-eye"), "uzumaki-eye")
  assert.equal(M.migrateMark("uzumaki"), "uzumaki")
  assert.equal(M.migrateMark("user:other"), "user:other")
  assert.equal(M.migrateMark(M.migrateMark("remina")), "remina-ink", "remina-ink is not mapped again")
})

test("S2c: the reserved names never show twice as user:<name>; markNames lists them all", () => {
  const i = idx({}, { "marks/tomie.png": {}, "marks/beetle.png": {}, "marks/remina.png": {}, "marks/uzumaki-eye.png": {}, "marks/other.png": {}, "marks/bar/28/other.png": {} })
  assert.deepEqual(U.marks(i).map(m => m.key), ["user:other"])
  assert.deepEqual(U.markNames(i), ["beetle", "other", "remina", "tomie", "uzumaki-eye"])
  assert.deepEqual(U.markNames(null), [])
})

test("S9: only Tomie Classic is the Tomie mark: the HD `tomie` entry left the picker, a stored tomie reads as tomie-classic, its file never shows as user:tomie", () => {
  assert.equal(M.userEntry("tomie"), null, "no HD tomie entry")
  assert.equal(M.userEntry("tomie-classic").name, "Tomie Classic")
  for (const k of ["tomie", "tomie-head", "user:tomie-head", "user:tomie", "user:tomie-classic"])
    assert.equal(M.resolve(k, ["tomie", "tomie-classic"]), "tomie-classic", k)
  assert.equal(M.resolve("tomie", ["tomie"]), "uzumaki", "no tomie-classic file: the default mark")
  const i = idx({}, { "marks/tomie.png": {}, "marks/tomie-classic.png": {}, "marks/other.png": {} })
  assert.deepEqual(U.marks(i).map(m => m.key), ["user:other"], "tomie and tomie-classic are reserved")
  assert.equal(M.migrateMark("tomie-head"), "tomie-classic")
})

test("S23: every built-in mark, pyramid-head included, follows the theme (no natural-tone bypass); Tomie Classic is drawn 0.87 (S25)", () => {
  for (const m of M.menuMarks) assert.equal(m.tone, undefined, m.key)
  assert.equal(M.isCustom("pyramid-head", {}), false, "pyramid-head goes through the theme shader")
  assert.equal(M.isCustom("custom:x", {}), true, "a custom picture is never tinted (as before)")
  assert.equal(M.isCustom("amigara", { amigara: "/p.png" }), true, "an override picture is never tinted (as before)")
  assert.equal(M.markScale("tomie-classic", {}), 0.87)
  assert.equal(M.markScale("tomie-classic", { "tomie-classic": "/p.png" }), 1, "a picture of the user's own that replaces it is not shrunk")
  assert.equal(M.markScale("uzumaki", {}), 1)
})

test("S2c: the tier list is the S2d one", () => {
  assert.equal(U.barPx(36), 36)
  assert.equal(U.barPx(128), 128)
  assert.equal(U.barPx(112), 112)
})

test("S15b: workspace families: Tomie (one definition), Beetle v10 only with wsBeetleDef v10; no set = null (card hidden)", () => {
  const t = idx({ "workspaces/bar/24/ws-tomie-1-empty.png": { mtime: 1 }, "workspaces/bar/24/ws-tomie-1-empty.light.png": { mtime: 2 } })
  assert.equal(U.bar(t, {}, "workspaces/ws-tomie-1-empty.png", 22, false, "v9").url, "file:///h/assets/workspaces/bar/24/ws-tomie-1-empty.png?v=1", "22 device px -> the 24 tier")
  assert.equal(U.bar(t, {}, "workspaces/ws-tomie-1-empty.png", 24, true, "v9").url, "file:///h/assets/workspaces/bar/24/ws-tomie-1-empty.light.png?v=2")
  const b = idx({ "workspaces/bar/26/ws-beetle-3-active.png": { mtime: 1 }, "workspaces/bar/26/ws-beetle-3-active.v10.png": { mtime: 2 } })
  assert.equal(U.bar(b, {}, "workspaces/ws-beetle-3-active.png", 26, false, "v9").url, "file:///h/assets/workspaces/bar/26/ws-beetle-3-active.png?v=1")
  assert.equal(U.bar(b, {}, "workspaces/ws-beetle-3-active.png", 26, false, "v10").url, "file:///h/assets/workspaces/bar/26/ws-beetle-3-active.v10.png?v=2")
  assert.equal(U.bar(idx(), {}, "workspaces/ws-tomie-3-active.png", 64, false, "v9"), null, "no set: the card is hidden")
  assert.equal(U.barPx(26), 26); assert.equal(U.barPx(30), 30)
})

test("S17b: heather / pyramid are the characters; the old sigils are extra entries (picker order, migration keeps the current choice, never twice as user:<name>)", () => {
  const keys = M.menuMarks.map(m => m.key)
  assert.ok(keys.indexOf("heather-sigil") === keys.indexOf("heather") + 1, "the sigil right after its character")
  assert.equal(M.migrateMark("heather"), "heather", "a stored heather is now the character; nobody loses the sigil: it is listed")
  assert.equal(M.migrateMark("heather-sigil"), "heather-sigil")
  assert.equal(M.resolve("heather-sigil", []), "uzumaki", "no file: hidden, shows uzumaki")
  assert.equal(M.userName("heather-sigil"), "heather-sigil"); assert.equal(M.autoEffect("heather-sigil"), "heartbeat")
  const i = idx({}, { "marks/heather.png": {}, "marks/heather-sigil.png": {}, "marks/pyramid-sigil.png": {}, "marks/other.png": {} })
  assert.deepEqual(U.marks(i).map(m => m.key), ["user:other"])
})

test("S17c: def v12 = the tight / three-tone files; no v12 file = the plain set (never the v10); v10 and v9 unchanged", () => {
  const b = idx({ "workspaces/bar/26/ws-beetle-3-active.png": { mtime: 1 }, "workspaces/bar/26/ws-beetle-3-active.v10.png": { mtime: 2 }, "workspaces/bar/26/ws-beetle-3-active.v12.png": { mtime: 3 }, "workspaces/bar/26/ws-beetle-3-active.v12.light.png": { mtime: 4 } })
  const base = "workspaces/ws-beetle-3-active.png", u = "file:///h/assets/workspaces/bar/26/ws-beetle-3-active"
  assert.equal(U.bar(b, {}, base, 26, false, "v12").url, u + ".v12.png?v=3"); assert.equal(U.bar(b, {}, base, 26, true, "v12").url, u + ".v12.light.png?v=4")
  assert.equal(U.bar(b, {}, base, 26, false, "v10").url, u + ".v10.png?v=2"); assert.equal(U.bar(b, {}, base, 26, false, "v9").url, u + ".png?v=1")
  const e = idx({ "workspaces/bar/26/ws-uzumaki-eye-3-active.png": { mtime: 1 } })
  assert.equal(U.bar(e, {}, "workspaces/ws-uzumaki-eye-3-active.png", 26, false, "v12").url, "file:///h/assets/workspaces/bar/26/ws-uzumaki-eye-3-active.png?v=1", "no tight set: today's")
})

test("S17d: user family files resolve like any other; def v10 below 40 px, the plain file from 40 (path logic, family-independent)", () => {
  const s = idx({ "workspaces/bar/24/ws-gothic-6-active.png": { mtime: 1 }, "workspaces/bar/24/ws-tomie-6-active.png": { mtime: 2 },
                  "workspaces/bar/32/ws-beetle-2-active.png": { mtime: 3 }, "workspaces/bar/32/ws-beetle-2-active.v10.png": { mtime: 4 }, "workspaces/bar/44/ws-beetle-2-active.png": { mtime: 5 } })
  assert.equal(U.bar(s, {}, "workspaces/ws-gothic-6-active.png", 24, false, "v9").url, "file:///h/assets/workspaces/bar/24/ws-gothic-6-active.png?v=1")
  assert.equal(U.bar(s, {}, "workspaces/ws-tomie-6-active.png", 24, false, "v9").url, "file:///h/assets/workspaces/bar/24/ws-tomie-6-active.png?v=2")
  assert.equal(U.bar(s, {}, "workspaces/ws-beetle-2-active.png", 32, false, "v10").url, "file:///h/assets/workspaces/bar/32/ws-beetle-2-active.v10.png?v=4")
  assert.equal(U.bar(s, {}, "workspaces/ws-beetle-2-active.png", 44, false, "v10").url, "file:///h/assets/workspaces/bar/44/ws-beetle-2-active.png?v=5")
  assert.equal(U.bar(idx(), {}, "workspaces/ws-gothic-2-active.png", 64, false, "v9"), null, "no files: the card is hidden")
})

// T9 (S12): every ItoConfig used to JSON.parse its own copy of the ~4 MB assets index (~7 MB of JS heap each, ~1 GB across the shell),
// so each theme change's allocations set off multi-second garbage collections on the shell's main thread. The parse is shared per process.
test("S12: the index text is parsed once per process and shared; derived lists are memoised on it", () => {
  const files = {}, slots = {}
  for (let i = 0; i < 19000; i++) files[`workspaces/bar/26/ws-t-${i}.png`] = { mtime: i }
  slots["marks/zz-mine.png"] = { mtime: 1 }; slots["marks/tomie.png"] = { mtime: 2 }
  const text = JSON.stringify({ version: 1, root: "/h/assets", files, slots })
  const a = U.parseIndex(text), b = U.parseIndex(String(text.slice(0)))
  assert.equal(a, b, "equal text: the same object, not a second copy")
  assert.equal(Object.keys(a.files).length, 19000)
  assert.deepEqual(U.parseIndex("{not json"), {}, "a damaged file reads as empty")
  assert.deepEqual(U.parseIndex(JSON.stringify({ version: 2, files })), {}, "another version reads as empty")
  assert.deepEqual(U.parseIndex(""), {})
  const c = U.parseIndex(text)
  assert.equal(c, a, "a damaged read in between does not drop the shared parse of the same text")
  const look = (r) => (r.indexOf("ws-t-") >= 0 ? "ws" : "")
  const k1 = U.kinds(a, look), k2 = U.kinds(a, look)
  assert.equal(k1, k2, "kinds of the same index: memoised"); assert.deepEqual(k1, { ws: true })
  assert.equal(U.marks(a), U.marks(a)); assert.deepEqual(U.marks(a).map((m) => m.key), ["user:zz-mine"])
  assert.equal(U.markNames(a), U.markNames(a)); assert.deepEqual(U.markNames(a), ["tomie", "zz-mine"])
  const other = U.parseIndex(JSON.stringify({ version: 1, root: "/h", files: {}, slots: {} }))
  assert.notEqual(other, a); assert.deepEqual(U.kinds(other, look), {}, "a new index is read afresh")
  let t0 = process.hrtime.bigint()
  for (let i = 0; i < 50; i++) { const j = U.parseIndex(text); U.kinds(j, look); U.marks(j); U.markNames(j) }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6
  assert.ok(ms < 1500, `50 ItoConfigs reading the same 19k-entry index cost ${ms.toFixed(0)} ms (gate 1500 ms; one parse, then string compares)`)
})

test("S24: the neutral asset names still find the files written under the old ones (hollow/ <- sh/ sp-, relic/sys/ <- gothic/sys/, ws-symbols- <- ws-gothic-)", () => {
  assert.equal(U.legacy("hollow/bar/28/eye-idle.png"), "sh/bar/28/sp-eye-idle.png")
  assert.equal(U.legacy("hollow/bar/28/cassette-on.light.png"), "sh/bar/28/cassette-on.light.png")
  assert.equal(U.legacy("relic/sys/bar/28/cpu.png"), "gothic/sys/bar/28/cpu.png")
  assert.equal(U.legacy("workspaces/bar/40/ws-symbols-3-active.png"), "workspaces/bar/40/ws-gothic-3-active.png")
  assert.equal(U.legacy("marks/bar/40/pyramid-head.png"), "")
  const i = { root: "/h", files: {}, slots: { "sh/bar/28/sp-spiral.png": { mtime: 5 } } }
  assert.equal(U.bar(i, {}, "hollow/spiral.png", 28, false, "v9").url, "file:///h/sh/bar/28/sp-spiral.png?v=5")
})

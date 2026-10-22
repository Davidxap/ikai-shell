.pragma library
// The user-art override (decisions-b9 section 6). Pure: no files, no QML. `index` is ~/.cache/ito/assets-index.json as bin/ito-assets
// writes it ({root, files: {rel: {mtime, w, h}}}); a picture of the shell's at `.../bar/modules/ito-art/<rel>` is replaced by
// `<root>/<rel>?v=<mtime>` when the index lists <rel> as ok. The `?v=` makes a redrawn file a new URL, so Qt's pixmap cache reloads it.

function rel(url) {
  var s = String(url).split("?")[0]
  var m = s.match(/(?:^|\/)bar\/modules\/ito-art\/(.+)$/)
  if (!m) return ""
  var r = m[1]
  if (r.indexOf("..") >= 0 || r.indexOf("//") >= 0 || /^eye(\/|$)/.test(r)) return ""
  return r
}

// S24 (2026-10-22): the asset names written from now on are neutral (hollow/, relic/sys/, ws-symbols-); a file a recipe wrote under the old
// name (sh/ with sp-<name> sprite skins, gothic/sys/, ws-gothic-) still answers. `legacy(r)` is the old name of a new one ("" = none), and
// back again for a shipped `sh/` path, so either spelling finds either file.
var HOLLOW_SKINS = ["spiral", "eye-idle", "eye-open", "eye-alert", "eye-shut", "moth-on", "moth-off", "pyramid", "sign", "sign-bleeding"]
function legacy(r) {
  r = String(r)
  var m = /^hollow\/(bar\/\d+\/)?([a-z0-9-]+)(\..*)$/.exec(r)
  if (m) return "sh/" + (m[1] || "") + (HOLLOW_SKINS.indexOf(m[2]) >= 0 ? "sp-" : "") + m[2] + m[3]
  m = /^sh\/(bar\/\d+\/)?(?:sp-)?([a-z0-9-]+)(\..*)$/.exec(r)
  if (m) return "hollow/" + (m[1] || "") + m[2] + m[3]
  if (/^relic\/sys\//.test(r)) return r.replace(/^relic\/sys\//, "gothic/sys/")
  if (/^(workspaces\/(?:bar\/\d+\/)?)ws-symbols-/.test(r)) return r.replace("ws-symbols-", "ws-gothic-")
  return ""
}
function withLegacy(list) {
  var out = list.slice()
  for (var i = 0; i < list.length; i++) { var o = legacy(list[i]); if (o !== "") out.push(o) }
  return out
}

// `<dir>/<name>.png` -> `<dir>/<name>.light.png`: the twin a light theme shows (decisions-userart section 1)
function lightOf(r) { return /\.light\.png$/.test(r) ? r : r.replace(/\.png$/, ".light.png") }

function fileUrl(index, failed, entry, r) {
  if (!entry || !index.root) return ""
  var u = "file://" + index.root + "/" + r + "?v=" + entry.mtime
  return failed && failed[u] ? "" : u
}

// the replacement URL for `url`, or "" (use the shipped picture). `failed` is a {url: true} set of replacements that did not load.
// `light`: the theme's ground is light; a `<name>.light.png` the index lists then wins over `<name>.png` (when it did not fail to load).
function map(index, failed, url, light) {
  if (!index || !index.files) return ""
  var r = rel(url)
  if (r === "") return ""
  var rs = withLegacy([r])
  for (var k = 0; k < rs.length; k++) {
    if (light && !/\.light\.png$/.test(rs[k])) {
      var l = fileUrl(index, failed, index.files[lightOf(rs[k])], lightOf(rs[k]))
      if (l !== "") return l
    }
    var u = fileUrl(index, failed, index.files[rs[k]], rs[k])
    if (u !== "") return u
  }
  return ""
}

var BAR_PX = [24, 26, 28, 30, 32, 36, 40, 44, 48, 56, 60, 64, 72, 80, 88, 96, 112, 120, 128]

// the tier for `want` device pixels: the nearest of BAR_PX (S2d: no 15 % window above the smallest tier, so every step of a size control lands on a
// tier and a small tier is never stretched); 0 only below the smallest tier by more than 15 % or above the biggest by more than 15 %
function barPx(want) {
  var w = Math.max(1, Math.round(Number(want) || 0)), best = 0
  for (var i = 0; i < BAR_PX.length; i++)
    if (best === 0 || Math.abs(BAR_PX[i] - w) < Math.abs(best - w)) best = BAR_PX[i]
  if (w < BAR_PX[0]) return w >= BAR_PX[0] * 0.85 ? best : 0
  if (w > BAR_PX[BAR_PX.length - 1]) return w <= BAR_PX[BAR_PX.length - 1] * 1.15 ? best : 0
  return best
}

// the bar-size picture of the user's `<dir>/<name>.png` (a shipped one, or `marks/<name>.png`): { url, px } or null. Looked up in the
// files and the slots of the index; on a light theme the bucket's `.light` twin first, then its plain file. No bucket listed = null
// (the caller keeps its 512 picture).
// `def` is the key markDef: "v10" tries the v10 definition files (`<name>.v10.png`, bin/ito-assets recipes) first and falls back to the plain ones; anything else = plain.
// S17: "v12" does the same with `<name>.v12.png` (the beetle, the tight Uzumaki Eye); no v12 file = the plain one (never the v10).
// S15c: "alt" does the same with `<name>.alt.png` (the alternative definition of a workspace family: keys shMicro art, eyeWsIris plain).
function bar(index, failed, base, want, light, def) {
  if (!index) return null
  var px = barPx(want)
  if (px === 0) return null
  var i = String(base).lastIndexOf("/")
  var name = String(base).substring(i + 1)
  var b = (i >= 0 ? String(base).substring(0, i + 1) : "") + "bar/" + px + "/" + name
  var tries = light ? [lightOf(b), b] : [b]
  if (def === "v10" || def === "v12" || def === "alt") {
    var v = b.replace(/\.png$/, "." + def + ".png")
    tries = light ? [lightOf(v), v].concat(tries) : [v].concat(tries)
  }
  tries = withLegacy(tries)
  for (var k = 0; k < tries.length; k++) {
    var e = (index.files && index.files[tries[k]]) || (index.slots && index.slots[tries[k]])
    var u = fileUrl(index, failed, e, tries[k])
    if (u !== "") return { url: u, px: px }
  }
  return null
}

// the user's menu mark `marks/<name>.png`: { url, px } (px 0 = the 512 picture), light twin on a light theme, or null when it is not listed
// (deleted, rejected, or failed to load: the caller falls back to the default mark).
function mark(index, failed, name, want, light, def) {
  if (!index || !index.slots || !/^[a-z0-9-]{1,24}$/.test(String(name))) return null
  var base = "marks/" + name + ".png"
  if (!index.slots[base]) return null
  var b = bar(index, failed, base, want, light, def)
  if (b) return b
  var r = light && index.slots[lightOf(base)] ? lightOf(base) : base
  var u = fileUrl(index, failed, index.slots[r], r)
  if (u === "" && r !== base) u = fileUrl(index, failed, index.slots[base], base)
  return u === "" ? null : { url: u, px: 0 }
}

// the names the picker already lists as its own entries (ItoMarks.menuMarks with `user:`): they never show twice as `user:<name>`
// (the retired names tomie, tomie-clear, tomie-wide, pyramid, pyramid-sigil stay reserved: their files may still sit in the assets folder and must not turn into `user:<name>` entries)
var RESERVED = ["uzumaki-eye", "remina", "tomie", "tomie-classic", "tomie-clear", "tomie-wide", "tomie-head", "beetle", "heather", "heather-sigil", "pyramid", "pyramid-sigil", "pyramid-roundel", "pyramid-head", "moth", "eye-roundel", "key"]

// the names of every `marks/<name>.png` the index lists, the reserved ones included
function markNames(index) {
  if (index && index === memo.namesOf) return memo.names
  var out = []
  memo.namesOf = index
  memo.names = out
  if (!index || !index.slots) return out
  for (var r in index.slots) {
    var m = /^marks\/([a-z0-9-]{1,24})\.png$/.exec(r)
    if (m) out.push(m[1])
  }
  return out.sort()
}

// the user's marks the index lists, as picker entries `{ key: "user:<name>", name, note }`
function marks(index) {
  if (index && index === memo.marksOf) return memo.marks
  var out = []
  memo.marksOf = index
  memo.marks = out
  if (!index || !index.slots) return out
  for (var r in index.slots) {
    var m = /^marks\/([a-z0-9-]{1,24})\.png$/.exec(r)
    if (m && RESERVED.indexOf(m[1]) < 0) out.push({ key: "user:" + m[1], name: m[1], note: "Your own mark, from the marks folder of your assets." })
  }
  out.sort(function (a, b) { return a.key < b.key ? -1 : 1 })
  return out
}

// ---- S14: the popup-head eyes made from the user's sheets (bin/ito-assets recipe eye-<id>) ------------------------------------------------------------
// `eyes/<id>/{lid,iris,hot}[.light].png` is the 512-wide master, `eyes/<id>/h<H>/...` the tier of a box H px high. `ar` is the crop's width : height, `iris`
// the turning disc (centre x, y and radius in crop px), `blood` the share of the iris radius the blood point takes (the shell draws it, it is never baked).
var EYES = {
  uzumaki: { ar: [1129, 589], iris: [593, 332, 195], blood: 0.07, hot: true, name: "Uzumaki eye" },
  lashed: { ar: [178, 100], iris: [90, 48, 26], blood: 0.30, hot: false, name: "Inked eye" },
  veined: { ar: [410, 285], iris: [203, 143, 30], blood: 0.9, hot: false, name: "Veined eye" }
}
var EYE_TIERS = [34, 54, 68, 108]

// the tier for a box `want` device px high: the nearest, or 0 (the 512 master) when the box is taller than the biggest tier by 15 %
function eyeTier(want) {
  var w = Math.max(1, Math.round(Number(want) || 0)), best = EYE_TIERS[0]
  for (var i = 0; i < EYE_TIERS.length; i++) if (Math.abs(EYE_TIERS[i] - w) < Math.abs(best - w)) best = EYE_TIERS[i]
  return w > EYE_TIERS[EYE_TIERS.length - 1] * 1.15 ? 0 : best
}
// the files of one eye for a box `want` device px high, in the polarity of the ground: { lid, iris, hot ("" when none), tier, ar, irisAt, blood } or null (not drawn
// yet, a file rejected or failed to load: the caller keeps the shaded eye). A light ground needs the `.light` files, a dark one the plain files.
function eye(index, failed, id, want, light) {
  var e = EYES[id]
  if (!e || !index || !index.slots) return null
  var tier = eyeTier(want), dir = "eyes/" + id + "/" + (tier ? "h" + tier + "/" : ""), sfx = light ? ".light.png" : ".png", out = { tier: tier, ar: e.ar, irisAt: e.iris, blood: e.blood, hot: "" }
  var names = ["lid", "iris"]
  for (var i = 0; i < names.length; i++) {
    var r = dir + names[i] + sfx, u = fileUrl(index, failed, index.slots[r], r)
    if (u === "") return null
    out[names[i]] = u
  }
  if (e.hot) { var rh = dir + "hot" + sfx; out.hot = fileUrl(index, failed, index.slots[rh], rh) }
  return out
}

// the icon kinds (ItoIconMap kinds: disk, cpu, ...) that have at least one user file; `lookupKind(relPath)` returns a kind or "".
// Memoised on the index object (one shared parse, see parseIndex): `lookupKind` must be the same pure lookup for every caller (ItoConfig's).
function kinds(index, lookupKind) {
  if (index && index === memo.kindsOf) return memo.kinds
  var out = {}
  memo.kindsOf = index
  memo.kinds = out
  if (!index || !index.files) return out
  for (var r in index.files) {
    var k = lookupKind(r)
    if (k) out[k] = true
  }
  return out
}

// ---- one parse per process (S12) ----------------------------------------------------------------------------------------------------------------------
// This file is a `.pragma library`: one instance per QML engine, shared by every ItoConfig. Each of them used to JSON.parse its own copy of the
// ~4 MB index (~7 MB of JS heap each, about 1 GB across the shell), and the heap that size made every theme change set off garbage collections of
// many seconds on the shell's main thread (the "everything freezes on a theme change" bug). The same text now gives back the same object, and
// the lists derived from it (kinds, marks, markNames) are kept with it. Callers only read the index; never change what this returns.
var memo = { text: null, index: null, kindsOf: null, kinds: null, marksOf: null, marks: null, namesOf: null, names: null }
function parseIndex(text) {
  var t = String(text || "")
  if (memo.text !== null && t === memo.text) return memo.index
  var j = null
  try { j = JSON.parse(t) } catch (e) { j = null }
  if (!j || j.version !== 1 || !j.files) return ({})
  memo.text = t
  memo.index = j
  return j
}

if (typeof module !== "undefined") module.exports = { parseIndex: parseIndex, rel: rel, map: map, legacy: legacy, kinds: kinds, lightOf: lightOf, barPx: barPx, bar: bar, mark: mark, marks: marks, markNames: markNames, EYES: EYES, eye: eye, eyeTier: eyeTier }

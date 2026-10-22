// Tests for the manga icon pilot (dev/openspec/changes/ito-shell-inspiration/icons-v2.md, I-T1..I-T4, I-T7, I-T7b, I-T9 model side).
//   node --test scripts/qa/icons.test.mjs
// Kept apart from models.test.mjs so the icon work never edits a file the eye work is changing. Every input is made up;
// the only file read besides the code is an installed theme's colors.toml (a fake palette, as the lab scenes use).
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { loadInk, loadQmlJs, raster, mask, coverage, density, squint, ncc, ROLE, SS, root } from "./icon-raster.mjs"

const { Ink, Chart } = loadInk()
const Map = loadQmlJs("bar/modules/ItoIconMap.js")
const SIZES = [16, 20, 24, 29, 32, 48]
const json = (x) => JSON.stringify(x)
const everyState = () => Ink.KINDS.flatMap((kind) => Ink.STATES[kind].map((state) => ({ kind, state })))
const nominal = () => Ink.KINDS.map((kind) => ({ kind, state: Ink.NOMINAL[kind] })).concat([{ kind: "network", state: { wired: true } }])

function polysPoints(polys) {
  const pts = []
  for (const p of polys) for (let i = 0; i < p.length; i += 2) pts.push([p[i], p[i + 1]])
  return pts
}
function shares(ip, size) {
  const cov = coverage(raster(ip, size))
  let ink = 0, mass = 0, blood = 0
  for (let i = 0; i < cov.line.length; i++) {
    ink += cov.line[i] + cov.mass[i] + cov.blood[i] + cov.warn[i] + cov.paper[i]
    mass += cov.mass[i]; blood += cov.blood[i] + cov.warn[i]
  }
  return { ink, mass: mass / ink, blood: blood / ink }
}

// ------------------------------------------------------------------------------------------------ I-T1 model
import { loadSet } from "./icon-set.mjs"
const IconSet = loadSet()

test("I-T1 iconParts is deterministic: same input, same list; another seed, another hand", () => {
  for (const { kind, state } of everyState()) for (const s of [16, 29, 48]) {
    assert.equal(json(Ink.iconParts(kind, state, s, 3)), json(Ink.iconParts(kind, state, s, 3)), kind + " " + json(state) + " " + s)
  }
  assert.notEqual(json(Ink.iconParts("disk", { value: 0.5 }, 29, 1)), json(Ink.iconParts("disk", { value: 0.5 }, 29, 2)))
})

test("I-T1 tiers: S <= 20 px is T0, 21-35 M is T1, >= 36 L is T2; hysteresis holds a tier for 2 px", () => {
  assert.equal(Ink.masterFor(16), "S"); assert.equal(Ink.masterFor(20), "S"); assert.equal(Ink.masterFor(21), "M")
  assert.equal(Ink.masterFor(35), "M"); assert.equal(Ink.masterFor(36), "L")
  assert.equal(Ink.masterFor(22, "S"), "S"); assert.equal(Ink.masterFor(19, "M"), "M"); assert.equal(Ink.masterFor(34, "L"), "L")
  assert.equal(Ink.iconParts("cpu", {}, 16).tier, 0); assert.equal(Ink.iconParts("cpu", {}, 29).tier, 1); assert.equal(Ink.iconParts("cpu", {}, 48).tier, 2)
})

test("I-T1 stroke caps: T0 <= 6 paths, T1 <= 40 strokes, T2 <= 160 strokes", () => {
  for (const { kind, state } of everyState()) for (const s of SIZES) {
    const ip = Ink.iconParts(kind, state, s, 1)
    const label = kind + " " + json(state) + " " + s + "px"
    if (ip.tier === 0) assert.ok(ip.paths <= Ink.CAP[0], label + ": " + ip.paths + " paths")
    else assert.ok(ip.strokes <= Ink.CAP[ip.tier], label + ": " + ip.strokes + " strokes")
  }
})

test("I-T1 exactly one hard highlight, and no other paper mark", () => {
  for (const { kind, state } of everyState()) for (const s of SIZES) {
    const ip = Ink.iconParts(kind, state, s, 1)
    assert.ok(ip.highlight && ip.highlight.role === "paper" && ip.highlight.polys.length === 1, kind + " " + s)
    assert.equal(ip.parts.filter((p) => p.role === "paper").length, 0, kind + " " + s)
  }
})

test("I-T1 masses sit inside the keyline box", () => {
  for (const { kind, state } of everyState()) for (const s of SIZES) {
    const ip = Ink.iconParts(kind, state, s, 1), k = ip.keyline
    for (const part of ip.parts.filter((p) => p.role === "mass")) for (const [x, y] of polysPoints(part.polys)) {
      assert.ok(x >= k.x - 1 && x <= k.x + k.w + 1 && y >= k.y - 1 && y <= k.y + k.h + 1, kind + " " + json(state) + " " + s + " " + part.tag + " at " + x.toFixed(1) + "," + y.toFixed(1))
    }
  }
})

test("I-T1 every part has a known role and layer, no alpha of its own (no translucent fill)", () => {
  for (const { kind, state } of everyState()) {
    for (const part of Ink.iconParts(kind, state, 29, 1).parts) {
      assert.ok(part.role in ROLE && part.role !== "ground", part.role)
      assert.ok(["under", "level", "over"].includes(part.layer), part.layer)
      assert.equal(part.a, undefined)
      for (const p of part.polys) assert.ok(p.length >= 6 && p.every(Number.isFinite), kind + " " + part.tag)
    }
  }
})

test("an unknown kind draws nothing", () => {
  assert.equal(Ink.iconParts("tray", {}, 29), null)
  assert.deepEqual(Ink.sigilParts("nope", {}, 16), [])
})

test("sigilParts: at S, at most 6 SVG paths", () => {
  for (const { kind, state } of everyState()) {
    const sp = Ink.sigilParts(kind, state, 16, 1)
    assert.ok(sp.length >= 1 && sp.length <= 6, kind + " " + json(state) + " " + sp.length)
    for (const p of sp) assert.match(p.path, /^M[-\d. ]+(L[-\d. ]+)+Z/)
  }
})

// ------------------------------------------------------------------------------------------------ I-T2 anti-mud
test("I-T2 anti-mud: no hatch under 2.0 device px, contour >= 1.6 px at S and >= 1.0 px at M, no hatch at T0", () => {
  for (const { kind, state } of everyState()) for (const s of SIZES) {
    const ip = Ink.iconParts(kind, state, s, 1)
    for (const f of ip.families) assert.ok(f.spacingPx >= Ink.MUD_PX, kind + " " + s + " " + f.spacingPx)
    if (ip.master === "S") { assert.ok(ip.pens.thinPx >= 1.6); assert.equal(ip.families.length, 0, kind + " T0 hatch") }
    if (ip.master === "M") assert.ok(ip.pens.thinPx >= 1.0)
    if (ip.tier >= 1) assert.ok(ip.families.length <= (ip.tier === 1 ? 1 : 2), kind + " " + s + " families")
    if (ip.tier === 1) for (const f of ip.families) assert.ok(f.lines <= 5, kind + " " + s + " T1 lines " + f.lines)
  }
})

test("I-T2 a pale ground thickens the contour by 1 px at M and drops the hatch", () => {
  const a = Ink.iconParts("disk", { value: 0.5 }, 29, 1), b = Ink.iconParts("disk", { value: 0.5 }, 29, 1, { pale: true })
  assert.ok(a.families.length >= 1)
  assert.equal(b.families.length, 0)
  assert.equal(b.pens.thinPx, a.pens.thinPx + 1)
})

// ------------------------------------------------------------------------------------------------ I-T3 coverage
function dilate(m, rad) {
  const n = m.n, out = new Uint8Array(n * n), tmp = new Uint8Array(n * n)
  for (let y = 0; y < n; y++) { let last = -1e9; for (let x = 0; x < n; x++) { if (m.buf[y * n + x]) last = x; if (x - last <= rad) tmp[y * n + x] = 1 }
    last = 1e9; for (let x = n - 1; x >= 0; x--) { if (m.buf[y * n + x]) last = x; if (last - x <= rad) tmp[y * n + x] = 1 } }
  for (let x = 0; x < n; x++) { let last = -1e9; for (let y = 0; y < n; y++) { if (tmp[y * n + x]) last = y; if (y - last <= rad) out[y * n + x] = 1 }
    last = 1e9; for (let y = n - 1; y >= 0; y--) { if (tmp[y * n + x]) last = y; if (last - y <= rad) out[y * n + x] = 1 } }
  return out
}
test("I-T3 coverage: the silhouette fills 66-80 % of the keyline box at every master; ink stays inside it", () => {
  for (const { kind, state } of nominal()) for (const s of [16, 29, 48]) {
    const ip = Ink.iconParts(kind, state, s, 1), k = ip.keyline
    const m = mask(ip.silhouette, s), sc = m.n / 48
    let inBox = 0
    for (let y = Math.ceil(k.y * sc); y < (k.y + k.h) * sc; y++) for (let x = Math.ceil(k.x * sc); x < (k.x + k.w) * sc; x++) inBox += m.buf[y * m.n + x]
    const share = inBox / (k.w * k.h * sc * sc)
    assert.ok(share >= 0.66 && share <= 0.80, kind + " " + json(state) + " " + s + "px: " + (share * 100).toFixed(1) + " %")
    // the G-pen sits astride the outline: the silhouette is grown by the pen's outer half before ink is counted outside it
    const r = raster(ip, s), grown = dilate(m, Math.ceil(ip.pens.thickPx * 0.7 * SS) + SS)
    let ink = 0, out = 0
    for (let i = 0; i < r.buf.length; i++) if (r.buf[i] !== ROLE.ground && r.buf[i] !== ROLE.void) { ink++; if (!grown[i]) out++ }
    assert.ok(out / ink < 0.08, kind + " " + s + "px ink outside the silhouette " + (out / ink * 100).toFixed(1) + " %")
  }
})

// ------------------------------------------------------------------------------------------------ I-T4 map
test("I-T4 ItoIconMap maps every pilot PNG that exists, and the pilot names cover the pilot folders", () => {
  const art = path.join(root, "bar/modules/ito-art")
  for (const rel of Map.pilotNames()) {
    assert.ok(fs.existsSync(path.join(art, rel)), rel + " exists")
    const hit = Map.lookup("file://" + path.join(art, rel))
    // the v3 set draws every mapped kind (the pilot's v2 model only its own six)
    assert.ok(hit && IconSet.KINDS.includes(hit.kind), rel)
    assert.ok(IconSet.iconParts(hit.kind, hit.state, 29, 1), rel + " draws")
  }
  const want = ["notifications", "network", "battery"].flatMap((d) => fs.readdirSync(path.join(art, d)).map((f) => d + "/" + f))
    .concat(fs.readdirSync(path.join(art, "instruments")).filter((f) => /^(bat|net)-/.test(f)).map((f) => "instruments/" + f))
    .concat(["system/disk.png", "system/cpu.png", "system/mem.png"])
  for (const rel of want) assert.ok(Map.lookup(path.join(art, rel)), rel + " is mapped")
})

test("I-T4 the plugins' panel assets map; fills, other art and unknown names do not", () => {
  assert.deepEqual(JSON.parse(json(Map.lookup("file:///x/plugins/ito.power/assets/battery-50.png"))), { kind: "battery", state: { level: 2 } })
  assert.deepEqual(JSON.parse(json(Map.lookup("/x/plugins/ito.network/assets/wifi-off.png"))), { kind: "network", state: { off: true } })
  assert.deepEqual(JSON.parse(json(Map.lookup("qrc:/x/bar/modules/ito-art/instruments/bat-charge-3.png"))), { kind: "battery", state: { level: 3, charging: true } })
  assert.equal(Map.lookup("/x/bar/modules/ito-art/system/disk-fill.png"), null)
  assert.equal(Map.lookup("/x/bar/modules/ito-art/workspaces/ws-halo-1-active.png"), null)
  assert.equal(Map.lookup("/x/bar/modules/ito-art/system/menu-uzumaki.png"), null)
  assert.equal(Map.lookup("/x/plugins/ito.audio/assets/vol.png"), null)
  assert.equal(Map.lookup(""), null); assert.equal(Map.lookup(undefined), null)
})

test("I-T4 user pictures never map: tintable false, ~/.cache/ito/marks, ~/.config/ito/marks, foreign paths", () => {
  const disk = "/x/bar/modules/ito-art/system/disk.png"
  assert.ok(Map.lookup(disk))
  assert.equal(Map.lookup(disk, false), null)
  assert.equal(Map.lookup("/home/u/.cache/ito/marks/system/disk.png"), null)
  assert.equal(Map.lookup("/home/u/.config/ito/marks/notification.png"), null)
  assert.equal(Map.lookup("/home/u/Pictures/disk.png"), null)
  assert.equal(Map.lookup("/home/u/Pictures/notifications/notification.png"), null)
})

// ------------------------------------------------------------------------------------------------ I-T7 squint
function squintOf(kind, state) {
  const r = raster(Ink.iconParts(kind, state, 20, 1), 20)
  return squint(density(r), 20, 2).d
}
test("I-T7 squint: at 20 px, downscaled x0.5 and blurred, every kind differs from every other (NCC < 0.80)", () => {
  const maps = nominal().slice(0, 6).map(({ kind, state }) => [kind, squintOf(kind, state)])
  for (let i = 0; i < maps.length; i++) for (let j = i + 1; j < maps.length; j++) {
    const v = ncc(maps[i][1], maps[j][1])
    assert.ok(v < 0.80, maps[i][0] + " vs " + maps[j][0] + " " + v.toFixed(3))
  }
})
test("I-T7 squint: the state pairs that must differ do (NCC < 0.92)", () => {
  const pairs = [["network", { band: 2 }, { off: true }], ["battery", { level: 2 }, { level: 0 }], ["notifications", { face: "idle" }, { face: "active" }],
                 ["disk", { value: 0.5 }, { value: 0 }]]
  for (const [kind, a, b] of pairs) {
    const v = ncc(squintOf(kind, a), squintOf(kind, b))
    assert.ok(v < 0.92, kind + " " + json(a) + " vs " + json(b) + " " + v.toFixed(3))
  }
})

// ------------------------------------------------------------------------------------------------ I-T7b anti-badge
// The contour alone, rasterised; rays from the silhouette's centre: a ray that leaves without touching the contour is a gap.
function contourGap(ip, size, tag) {
  const r = raster(ip, size, { only: (p) => p.tag === tag, noHighlight: true })
  // from the middle of the contour's box (its ink centroid can fall on a heavy edge); ink under the start is skipped
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1
  for (let i = 0; i < r.buf.length; i++) if (r.buf[i]) { const x = i % r.n, y = (i / r.n) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  const pts = []
  for (let i = 0; i < r.buf.length; i++) if (r.buf[i]) pts.push([i % r.n, (i / r.n) | 0])
  let gap = false
  for (let a = 0; a < 720 && !gap; a++) {
    const t = a / 720 * Math.PI * 2, dx = Math.cos(t), dy = Math.sin(t)
    let hit = false, clear = false
    for (let s = 0; s < r.n * 1.5; s += 0.5) {
      const x = Math.round(cx + dx * s), y = Math.round(cy + dy * s)
      if (x < 0 || y < 0 || x >= r.n || y >= r.n) break
      if (!r.buf[y * r.n + x]) { clear = true; continue }
      if (clear) { hit = true; break }
    }
    if (!hit) gap = true
  }
  // best-fit circle (Kasa) residual over the contour pixels, relative to its radius
  let sx = 0, sy = 0
  for (const [x, y] of pts) { sx += x; sy += y }
  const mx = sx / pts.length, my = sy / pts.length
  let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0
  for (const [x, y] of pts) {
    const u = x - mx, v = y - my
    suu += u * u; svv += v * v; suv += u * v; suuu += u * u * u; svvv += v * v * v; suvv += u * v * v; svuu += v * u * u
  }
  const det = suu * svv - suv * suv
  const uc = (0.5 * (suuu + suvv) * svv - 0.5 * (svvv + svuu) * suv) / det, vc = (0.5 * (svvv + svuu) * suu - 0.5 * (suuu + suvv) * suv) / det
  const R = Math.sqrt(uc * uc + vc * vc + (suu + svv) / pts.length)
  let res = 0
  for (const [x, y] of pts) res += (Math.hypot(x - mx - uc, y - my - vc) - R) ** 2
  return { gap, residual: Math.sqrt(res / pts.length) / R }
}
test("I-T7b anti-badge: no closed circular contour (a lit-side gap, or the best-fit circle misses by > 3 % of r)", () => {
  for (const { kind, state } of everyState()) for (const s of [29, 48]) {
    const ip = Ink.iconParts(kind, state, s, 1)
    for (const tag of ["contour", "rim", "rim-torn"]) {
      if (!ip.parts.some((p) => p.tag === tag)) continue
      const g = contourGap(ip, s, tag)
      assert.ok(g.gap || g.residual > 0.03, kind + " " + json(state) + " " + s + " " + tag)
      assert.ok(g.gap, kind + " " + json(state) + " " + s + "px " + tag + ": a closed keyline")
    }
  }
})

test("I-T7b the solid mass is 15-35 % of the ink; blood stays an accent (<= 12 %)", () => {
  for (const { kind, state } of nominal()) for (const s of [16, 29, 48]) {
    const sh = shares(Ink.iconParts(kind, state, s, 1), s)
    assert.ok(sh.mass >= 0.15 && sh.mass <= 0.35, kind + " " + json(state) + " " + s + "px mass " + (sh.mass * 100).toFixed(1) + " %")
  }
  for (const { kind, state } of everyState()) for (const s of [16, 29, 48]) {
    const sh = shares(Ink.iconParts(kind, state, s, 1), s)
    assert.ok(sh.blood <= 0.12, kind + " " + json(state) + " " + s + "px blood " + (sh.blood * 100).toFixed(1) + " %")
  }
})

test("I-T7b no translucent fill: pixels between 0.2 and 0.9 coverage are only edge antialiasing", () => {
  for (const { kind, state } of nominal()) {
    const r = raster(Ink.iconParts(kind, state, 29, 1), 29), d = density(r)
    let partial = 0, inner = 0, ink = 0
    for (let y = 1; y < 28; y++) for (let x = 1; x < 28; x++) {
      const v = d[y * 29 + x]
      if (v > 0.02) ink++
      if (v <= 0.2 || v >= 0.9) continue
      partial++
      // an edge pixel has a neighbour clearly on the other side (near-empty and near-full around it)
      let lo = false, hi = false
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const w = d[(y + j) * 29 + x + i]; if (w < 0.35) lo = true; if (w > 0.65) hi = true }
      if (!(lo || hi)) inner++
    }
    assert.equal(inner, 0, kind + ": " + inner + " partial pixels with no edge next to them")
    assert.ok(partial < ink, kind)
  }
})

function themeTokens(name) {
  const f = "/usr/share/omarchy/themes/" + name + "/colors.toml"
  if (!fs.existsSync(f)) return null
  const t = fs.readFileSync(f, "utf8")
  const get = (k) => { const m = t.match(new RegExp("^\\s*" + k + "\\s*=\\s*\"#([0-9A-Fa-f]{6})\"", "m")); return m ? m[1] : null }
  const c = (h) => ({ r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255, a: 1 })
  const blood = c(get("accent")), bone = c(get("foreground")), ink = c(get("background"))
  return { blood, bone, ink, lit: blood, warn: c(get("red") || get("accent")) }
}

test("I-T7b the disk at 0.5 on tokyo-night: under the squint the body-shaped hole is the densest region", { skip: !themeTokens("tokyo-night") && "tokyo-night not installed" }, () => {
  const tok = themeTokens("tokyo-night"), ro = Ink.roles(tok, tok.ink)
  assert.ok(Chart.contrast(ro.line, ro.void) > 4.5)
  const ip = Ink.iconParts("disk", { value: 0.5 }, 20, 1)
  const sq = squint(density(raster(ip, 20)), 20, 2)
  const hole = mask([ip.levelPath], 20), slab = mask(ip.silhouette.slice(0, 1), 20)
  let hs = 0, hn = 0, ss = 0, sn = 0
  for (let y = 0; y < sq.size; y++) for (let x = 0; x < sq.size; x++) {
    let h = 0, s = 0
    for (let j = 0; j < 2 * SS; j++) for (let i = 0; i < 2 * SS; i++) { const k = (y * 2 * SS + j) * hole.n + x * 2 * SS + i; h += hole.buf[k]; s += slab.buf[k] }
    const v = sq.d[y * sq.size + x]
    if (h > 2 * SS * SS) { hs += v; hn++ } else if (s > 2 * SS * SS) { ss += v; sn++ }
  }
  assert.ok(hn > 0 && sn > 0)
  assert.ok(hs / hn > 1.1 * (ss / sn), "hole " + (hs / hn).toFixed(2) + " vs slab " + (ss / sn).toFixed(2))
})

// ------------------------------------------------------------------------------------------------ I-T9 model side
test("I-T9 roles: line by contrast (dark ground: bone; light ground: ink), contrast rows pass on the installed themes", () => {
  for (const name of ["tokyo-night", "everforest", "flexoki-light", "catppuccin-latte", "gruvbox", "rose-pine"]) {
    const tok = themeTokens(name)
    if (!tok) continue
    const ro = Ink.roles(tok, tok.ink)
    const dark = Chart.luminance(tok.ink) < Chart.luminance(tok.bone)
    assert.equal(json(ro.line), json(Chart.contrast(tok.bone, tok.ink) >= Chart.contrast(tok.ink, tok.ink) ? Chart.rgba(tok.bone.r, tok.bone.g, tok.bone.b, 1) : tok.ink), name)
    assert.equal(json(ro.mass), json(ro.line))
    for (const row of ro.report) assert.ok(row.ok, name + " " + row.token + " " + row.ratio.toFixed(2) + " < " + row.need)
    if (!dark) assert.ok(Chart.luminance(ro.paper) >= Chart.luminance(tok.ink), name + ": the paper highlight is never darker than a light ground")
  }
})
test("I-T9 roles: on a light panel the line is the dark token and the void is the ground", () => {
  const light = { r: 0.97, g: 0.96, b: 0.92, a: 1 }, dark = { r: 0.08, g: 0.07, b: 0.07, a: 1 }
  const ro = Ink.roles({ blood: { r: 0.6, g: 0.1, b: 0.1 }, lit: { r: 0.7, g: 0.2, b: 0.2 }, bone: dark, ink: light, warn: { r: 0.7, g: 0.1, b: 0.1 } }, light)
  assert.equal(json(ro.line), json(Chart.rgba(dark.r, dark.g, dark.b, 1)))
  assert.equal(json(ro.void), json(Chart.rgba(light.r, light.g, light.b, 1)))
  assert.ok(Chart.luminance(ro.paper) >= Chart.luminance(light))
  assert.equal(Ink.roles(null, light), null)
})

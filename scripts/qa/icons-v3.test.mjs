// Tests for the manga icons v3 (dev/openspec/changes/ito-shell-inspiration/icons-v3.md, V-T1..V-T7).
//   node --test scripts/qa/icons-v3.test.mjs
// The recognisability test reads today's PNGs (bar/modules/ito-art) through ImageMagick; nothing reads the screen.
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { loadInk, loadQmlJs, raster, coverage, density, squint, ncc, ROLE, SS, root } from "./icon-raster.mjs"

const { Ink, Chart } = loadInk()
const Real = loadQmlJs("bar/modules/ItoIconReal.js", { Ink })
const json = (x) => JSON.stringify(x)
const every = () => Real.KINDS.flatMap((kind) => Real.STATES[kind].map((state) => ({ kind, state })))

function themeTokens(name) {
  const f = "/usr/share/omarchy/themes/" + name + "/colors.toml"
  if (!fs.existsSync(f)) return null
  const t = fs.readFileSync(f, "utf8")
  const get = (k) => { const m = t.match(new RegExp("^\\s*" + k + "\\s*=\\s*\"#([0-9A-Fa-f]{6})\"", "m")); return m ? m[1] : null }
  const c = (h) => ({ r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255, a: 1 })
  const blood = c(get("accent"))
  return { blood, bone: c(get("foreground")), ink: c(get("background")), lit: blood, warn: c(get("accent")) }
}
const THEMES = ["tokyo-night", "flexoki-light"].map((n) => [n, themeTokens(n)]).filter((x) => x[1])

// luminance per pixel of a raster painted with real role colours
function lumImage(r, ro) {
  const names = Object.keys(ROLE), L = new Float32Array(r.size * r.size)
  const lum = {}
  for (const n of names) { const col = n === "ground" || n === "void" ? ro.void : (ro[n] || ro.line); lum[n] = Chart.luminance(col) }
  for (let y = 0; y < r.n; y++) for (let x = 0; x < r.n; x++) L[((y / SS) | 0) * r.size + ((x / SS) | 0)] += lum[names[r.buf[y * r.n + x]]] / (SS * SS)
  return L
}
// what the icon covers (any painted role), holes filled from the border
function filled(buf, n) {
  const out = new Uint8Array(n * n).fill(1), q = []
  const push = (x, y) => { const i = y * n + x; if (x < 0 || y < 0 || x >= n || y >= n || !out[i] || buf[i]) return; out[i] = 0; q.push(i) }
  for (let i = 0; i < n; i++) { push(i, 0); push(i, n - 1); push(0, i); push(n - 1, i) }
  while (q.length) { const i = q.pop(), x = i % n, y = (i / n) | 0; push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1) }
  return out
}
function currentMask(rel, n) {
  const raw = execFileSync("magick", [path.join(root, "bar/modules/ito-art", rel), "-resize", n + "x" + n + "!", "-alpha", "extract", "-depth", "8", "gray:-"])
  const b = new Uint8Array(n * n)
  for (let i = 0; i < n * n; i++) b[i] = raw[i] > 110 ? 1 : 0
  return filled(b, n)
}
function v3Mask(kind, state, n) {
  const r = raster(Real.iconParts(kind, state, 48, 1), 48)          // 48 px x 4 supersamples = 192
  const m = new Uint8Array(r.n * r.n)
  for (let i = 0; i < m.length; i++) m[i] = r.buf[i] !== ROLE.ground ? 1 : 0
  const f = filled(m, r.n), out = new Uint8Array(n * n), s = r.n / n
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let t = 0
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) t += f[(y * s + j) * r.n + x * s + i]
    out[y * n + x] = t > 0 ? 1 : 0
  }
  return out
}
function bboxNorm(m, n) {      // crop to the mask's box and resample to 48 x 48 (the art's margins differ, the object must not)
  let x0 = n, y0 = n, x1 = -1, y1 = -1
  for (let i = 0; i < m.length; i++) if (m[i]) { const x = i % n, y = (i / n) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
  const w = Math.max(x1 - x0 + 1, y1 - y0 + 1), out = new Uint8Array(48 * 48)
  const ox = x0 - (w - (x1 - x0 + 1)) / 2, oy = y0 - (w - (y1 - y0 + 1)) / 2
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
    const sx = Math.floor(ox + (x + 0.5) * w / 48), sy = Math.floor(oy + (y + 0.5) * w / 48)
    out[y * 48 + x] = sx >= 0 && sy >= 0 && sx < n && sy < n ? m[sy * n + sx] : 0
  }
  return out
}
function iou(a, b) { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { i += a[k] & b[k]; u += a[k] | b[k] } return i / u }
// line icons (arcs, a spiral) are thin: both masks are grown by `r` px of 48 before they are compared
function grow(m, r) {
  const out = new Uint8Array(48 * 48)
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
    if (!m[y * 48 + x]) continue
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < 48 && yy < 48 && i * i + j * j <= r * r) out[yy * 48 + xx] = 1 }
  }
  return out
}

test("V-T1 deterministic, every part well formed, exactly one paper highlight", () => {
  for (const { kind, state } of every()) for (const s of [16, 29, 48]) for (const light of [true, false]) {
    const a = Real.iconParts(kind, state, s, 2, { light }), b = Real.iconParts(kind, state, s, 2, { light })
    assert.equal(json(a), json(b))
    assert.ok(a.highlight && a.highlight.polys.length === 1)
    for (const p of a.parts) {
      assert.ok(p.role in ROLE && p.role !== "ground" && p.role !== "paper", kind + " " + p.tag + " " + p.role)
      for (const q of p.polys) assert.ok(q.every(Number.isFinite), kind + " " + p.tag)
    }
  }
})

test("V-T2 recognisable: the filled silhouette matches today's icon (IoU >= 0.62, both framed alike and grown by 2 px of 48)", () => {
  // the disk is the exception the user asked for (2026-10-04): it must read as a hard drive (a portrait case), not today's circle
  for (const kind of Real.KINDS.filter((k) => k !== "disk")) {
    // framed alike (both cropped to their box) or as drawn (both on the 48-unit box); the better of the two
    const cm = currentMask(Real.CURRENT[kind], 96), vm = v3Mask(kind, Real.NOMINAL[kind], 96)
    const v = Math.max(iou(grow(bboxNorm(cm, 96), 2), grow(bboxNorm(vm, 96), 2)), iou(grow(bboxNorm(cm, 96).map((_, i) => cm[Math.floor(i / 48) * 2 * 96 + (i % 48) * 2]), 2), grow(bboxNorm(vm, 96).map((_, i) => vm[Math.floor(i / 48) * 2 * 96 + (i % 48) * 2]), 2)))
    if (process.env.V3_DIAG) console.log("IoU", kind, v.toFixed(3))
    assert.ok(process.env.V3_DIAG || v >= 0.62, kind + " IoU " + v.toFixed(3))
  }
})

test("V-T2b the disk reads as a hard drive: a portrait case (taller than wide), the round platter in its upper half", () => {
  const ip = Real.iconParts("disk", Real.NOMINAL.disk, 48, 1)
  const xs = [], ys = []
  for (const p of ip.silhouette[0].filter((_, i) => i % 2 === 0)) xs.push(p)
  for (const p of ip.silhouette[0].filter((_, i) => i % 2 === 1)) ys.push(p)
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys)
  assert.ok(h / w > 1.2, "aspect " + (h / w).toFixed(2))
  const rim = ip.parts.find((p) => p.tag === "platter-rim")
  assert.ok(rim, "the platter is drawn")
  const py = rim.polys.flatMap((q) => q.filter((_, i) => i % 2 === 1))
  assert.ok((Math.min(...py) + Math.max(...py)) / 2 < Math.min(...ys) + h * 0.5, "the platter sits in the upper half")
  for (const tag of ["finger", "nail", "screw", "connector", "mass:amigara"]) assert.ok(ip.parts.some((p) => p.tag === tag || p.tag.startsWith(tag + "-")), tag)
})

test("V-T3 rendered, not flat: at 29 px at least 4 tonal steps inside the object (8 luminance bins with >= 3 % each), 5 at 48", () => {
  for (const [name, tok] of THEMES) {
    const ro = Ink.roles(tok, tok.ink)
    for (const kind of Real.KINDS) for (const [s, need] of [[29, 4], [48, 5]]) {
      const r = raster(Real.iconParts(kind, Real.NOMINAL[kind], s, 1, { light: ro.lineLight }), s)
      const L = lumImage(r, ro), cov = coverage(r), lo = Chart.luminance(tok.ink), hi = Chart.luminance(tok.bone)
      const bins = new Array(8).fill(0)
      let n = 0
      const m = new Uint8Array(s * s)
      for (let i = 0; i < s * s; i++) m[i] = cov.ground[i] < 0.5 ? 1 : 0
      const f = filled(m, s)
      for (let i = 0; i < s * s; i++) if (f[i]) { const t = (L[i] - Math.min(lo, hi)) / Math.abs(hi - lo); bins[Math.max(0, Math.min(7, Math.floor(t * 8)))]++; n++ }
      const steps = bins.filter((b) => b / n >= 0.03).length
      assert.ok(steps >= need, name + " " + kind + " " + s + "px: " + steps + " tonal steps")
    }
  }
})

test("V-T4 the light comes from the upper left in BOTH themes: the lit half of the object is brighter than the shadow half", () => {
  for (const [name, tok] of THEMES) {
    const ro = Ink.roles(tok, tok.ink)
    // the battery is judged full: half empty, its black fluid would decide the halves, not the light
    for (const [kind, state] of [["disk", Real.NOMINAL.disk], ["cpu", Real.NOMINAL.cpu], ["battery", { level: 4 }], ["notifications", Real.NOMINAL.notifications]]) {
      const s = 48, r = raster(Real.iconParts(kind, state, s, 1, { light: ro.lineLight }), s), L = lumImage(r, ro), cov = coverage(r)
      const m = new Uint8Array(s * s)
      for (let i = 0; i < s * s; i++) m[i] = cov.ground[i] < 0.5 ? 1 : 0
      const f = filled(m, s)
      let cx = 0, cy = 0, n = 0
      for (let i = 0; i < s * s; i++) if (f[i]) { cx += i % s; cy += (i / s) | 0; n++ }
      cx /= n; cy /= n
      let a = 0, an = 0, b = 0, bn = 0
      for (let i = 0; i < s * s; i++) if (f[i]) { const x = i % s, y = (i / s) | 0; if ((x - cx) + (y - cy) < 0) { a += L[i]; an++ } else { b += L[i]; bn++ } }
      assert.ok(a / an > b / bn, name + " " + kind + ": lit half " + (a / an).toFixed(3) + " vs shadow half " + (b / bn).toFixed(3))
    }
  }
})

// tonal edges: neighbouring pixels inside the object whose luminance differs by more than 0.08
function edges(L, mask, n) {
  let e = 0
  for (let y = 0; y < n; y++) for (let x = 0; x < n - 1; x++) { const i = y * n + x; if (mask[i] && mask[i + 1] && Math.abs(L[i] - L[i + 1]) > 0.08) e++ }
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n; x++) { const i = y * n + x; if (mask[i] && mask[i + n] && Math.abs(L[i] - L[i + n]) > 0.08) e++ }
  return e
}
// tonal steps: the 8-bin luminance histogram inside the object, bins holding >= 8 % of its pixels (antialiasing alone does not count)
function steps(L, mask, lo, hi) {
  const bins = new Array(8).fill(0)
  let n = 0
  for (let i = 0; i < L.length; i++) if (mask[i]) { const t = (L[i] - lo) / Math.max(1e-6, hi - lo); bins[Math.max(0, Math.min(7, Math.floor(t * 8)))]++; n++ }
  return bins.filter((b) => b / n >= 0.08).length
}
test("V-T5 as rendered as today at the same weight (the budget, section 11): at 32 px >= 3 tonal steps, and at least today's tonal edges per unit of visual weight", () => {
  const n = 32
  for (const kind of Real.KINDS) {
    const raw = execFileSync("magick", [path.join(root, "bar/modules/ito-art", Real.CURRENT[kind]), "-resize", n + "x" + n + "!", "-background", "black", "-flatten", "-colorspace", "Gray", "-depth", "8", "gray:-"])
    const Lc = new Float32Array(n * n), mc = currentMask(Real.CURRENT[kind], n)
    for (let i = 0; i < n * n; i++) Lc[i] = raw[i] / 255
    let cmax = 0, wc = 0
    for (let i = 0; i < n * n; i++) if (mc[i]) cmax = Math.max(cmax, Lc[i])
    for (let i = 0; i < n * n; i++) wc += Lc[i] / Math.max(1e-6, cmax)
    const tok = THEMES[0][1], ro = Ink.roles(tok, tok.ink)
    const r = raster(Real.iconParts(kind, Real.NOMINAL[kind], n, 1, { light: ro.lineLight }), n), L = lumImage(r, ro), cov = coverage(r)
    const m = new Uint8Array(n * n)
    for (let i = 0; i < n * n; i++) m[i] = cov.ground[i] < 0.5 ? 1 : 0
    const lo = Chart.luminance(tok.ink), hi = Chart.luminance(tok.bone)
    let wv = 0
    for (let i = 0; i < n * n; i++) wv += Math.abs(L[i] - lo) / Math.abs(hi - lo)
    const sv = steps(L, filled(m, n), lo, hi), ev = edges(L, filled(m, n), n), ec = edges(Lc, mc, n)
    if (process.env.V3_DIAG) console.log("steps", kind, sv, "edges/weight", (ev / wv).toFixed(1), "today", (ec / wc).toFixed(1))
    if (process.env.V3_DIAG) continue
    assert.ok(sv >= 3, kind + ": v3 " + sv + " tonal steps")
    assert.ok(ev / wv >= 0.95 * ec / wc, kind + ": " + (ev / wv).toFixed(1) + " tonal edges per weight vs today " + (ec / wc).toFixed(1))
  }
})

test("V-T6 blood stays an accent: outside the datum itself (the level, the off spiral) it is <= 12 % of the ink in every state", () => {
  for (const { kind, state } of every()) for (const s of [16, 29, 48]) {
    const cov = coverage(raster(Real.iconParts(kind, state, s, 1), s, { only: (p) => p.tag !== "datum" }))
    let ink = 0, blood = 0
    for (let i = 0; i < cov.line.length; i++) { ink += cov.line[i] + cov.blood[i] + cov.warn[i]; blood += cov.blood[i] + cov.warn[i] }
    assert.ok(blood / ink <= 0.12, kind + " " + json(state) + " " + s + " " + (blood / ink * 100).toFixed(1) + " %")
  }
})

test("V-T7 the datum shows: state pairs differ under a squint at 24 px (NCC < 0.95)", () => {
  const pairs = [["disk", { value: 0 }, { value: 0.8 }], ["cpu", { value: 0.1 }, { value: 0.95 }], ["mem", { value: 0.1 }, { value: 1 }],
                 ["battery", { level: 0 }, { level: 4 }], ["battery", { level: 2 }, { level: 0 }], ["network", { band: 2 }, { off: true }],
                 ["network", { band: 1 }, { band: 3 }], ["notifications", { face: "idle" }, { face: "active" }], ["notifications", { face: "idle" }, { face: "dnd" }]]
  // compared in colour (the three channels of the role colours, squinted each), since the datum now carries the accent
  for (const [name, tok] of THEMES) for (const [kind, a, b] of pairs) {
    const ro = Ink.roles(tok, tok.ink), light = ro.lineLight
    const names = Object.keys(ROLE)
    const sq = (st) => {
      const r = raster(Real.iconParts(kind, st, 24, 1, { light }), 24), out = []
      for (const ch of ["r", "g", "b"]) {
        const d = new Float32Array(24 * 24)
        for (let y = 0; y < r.n; y++) for (let x = 0; x < r.n; x++) {
          const role = names[r.buf[y * r.n + x]], col = role === "ground" || role === "void" ? ro.void : (ro[role] || ro.line)
          d[((y / SS) | 0) * 24 + ((x / SS) | 0)] += col[ch] / (SS * SS)
        }
        out.push(...squint(d, 24, 2).d)
      }
      return Float32Array.from(out)
    }
    const v = ncc(sq(a), sq(b))
    if (process.env.V3_DIAG) console.log("ncc", kind, json(a), json(b), name, v.toFixed(3))
    assert.ok(process.env.V3_DIAG || v < 0.95, kind + " " + json(a) + " vs " + json(b) + (" " + name + " ") + v.toFixed(3))
  }
})

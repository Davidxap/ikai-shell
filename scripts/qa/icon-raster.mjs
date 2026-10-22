// A small software rasteriser for the manga icon model (bar/modules/ItoIconInk.js), used by the icon tests and bench.
// It paints the parts in order (nonzero fill, an optional clip polygon, 4x4 supersampling) into a role buffer, so the
// tests measure what the bake will paint without a Canvas. Nothing here reads the machine's screen or theme.
import fs from "node:fs"
import path from "node:path"
import vm from "node:vm"
import { fileURLToPath } from "node:url"

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

// Loads a QML-flavoured JS file in this realm (`.pragma` / `.import` lines dropped); `deps` become the imported names.
export function loadQmlJs(rel, deps) {
  const src = fs.readFileSync(path.join(root, rel), "utf8")
    .split("\n").filter((l) => !/^\s*\.(pragma|import)\b/.test(l)).join("\n")
  const names = Object.keys(deps || {})
  const mod = { exports: {} }
  vm.runInThisContext("(function(module" + names.map((n) => "," + n).join("") + "){" + src + "\n})", { filename: rel })(mod, ...names.map((n) => deps[n]))
  return mod.exports
}

export function loadInk() {
  const Chart = loadQmlJs("bar/modules/ItoChart.js")
  return { Chart, Ink: loadQmlJs("bar/modules/ItoIconInk.js", { Chart }) }
}

export const ROLE = { ground: 0, line: 1, mass: 2, void: 3, paper: 4, blood: 5, warn: 6 }
export const SS = 4

function fillMask(polys, n, scale) {
  const m = new Uint8Array(n * n)
  for (let sy = 0; sy < n; sy++) {
    const y = (sy + 0.5) / scale
    const xs = []
    for (const p of polys) {
      const k = p.length / 2
      for (let i = 0, j = k - 1; i < k; j = i++) {
        const ay = p[2 * j + 1], by = p[2 * i + 1]
        if ((ay > y) === (by > y)) continue
        const ax = p[2 * j], bx = p[2 * i]
        xs.push([ax + (bx - ax) * (y - ay) / (by - ay), by > ay ? 1 : -1])
      }
    }
    if (xs.length < 2) continue
    xs.sort((a, b) => a[0] - b[0])
    let w = 0
    for (let q = 0; q < xs.length - 1; q++) {
      w += xs[q][1]
      if (w === 0) continue
      const x0 = Math.max(0, Math.ceil(xs[q][0] * scale - 0.5)), x1 = Math.min(n - 1, Math.floor(xs[q + 1][0] * scale - 0.5))
      for (let x = x0; x <= x1; x++) m[sy * n + x] = 1
    }
  }
  return m
}

// Paints `ip` (iconParts output) at `size` px. Returns { size, n, buf } with buf the role per supersample.
export function raster(ip, size, opts = {}) {
  const n = size * SS, scale = n / 48
  const buf = new Uint8Array(n * n)
  // a part drawn only by a motion (`hidden`, ItoIconMotion: the battery's rising bubble) is not in the still icon
  const parts = ip.parts.filter((p) => !p.hidden && (!opts.only || opts.only(p)))
  for (const part of parts) {
    const m = fillMask(part.polys, n, scale)
    const clip = part.clip ? fillMask([part.clip], n, scale) : null
    const r = ROLE[part.role]
    for (let i = 0; i < m.length; i++) if (m[i] && (!clip || clip[i])) buf[i] = r
  }
  if (ip.highlight && !opts.noHighlight) {
    const m = fillMask(ip.highlight.polys, n, scale)
    for (let i = 0; i < m.length; i++) if (m[i]) buf[i] = ROLE.paper
  }
  return { size, n, buf }
}

// A plain mask (1 where any of `polys` is filled) at `size` px, supersampled.
export function mask(polys, size) { return { size, n: size * SS, buf: fillMask(polys, size * SS, size * SS / 48) } }

// Per-pixel share of each role (Float32 per role), from the supersampled buffer.
export function coverage(r) {
  const out = {}
  for (const k of Object.keys(ROLE)) out[k] = new Float32Array(r.size * r.size)
  const names = Object.keys(ROLE)
  for (let y = 0; y < r.n; y++) for (let x = 0; x < r.n; x++) {
    const role = names[r.buf[y * r.n + x]]
    out[role][((y / SS) | 0) * r.size + ((x / SS) | 0)] += 1 / (SS * SS)
  }
  return out
}

// Ink density per pixel (0..1): line and mass are full ink, blood and warn are ink too, paper and void are none.
export function density(r) {
  const cov = coverage(r), d = new Float32Array(r.size * r.size)
  for (let i = 0; i < d.length; i++) d[i] = cov.line[i] + cov.mass[i] + cov.blood[i] + cov.warn[i]
  return d
}

// Box-downscale by an integer factor, then a 3x3 blur (the squint).
export function squint(d, size, factor) {
  const s = Math.floor(size / factor), out = new Float32Array(s * s)
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    let t = 0
    for (let j = 0; j < factor; j++) for (let i = 0; i < factor; i++) t += d[(y * factor + j) * size + x * factor + i]
    out[y * s + x] = t / (factor * factor)
  }
  const b = new Float32Array(s * s)
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    let t = 0, c = 0
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const yy = y + j, xx = x + i
      if (yy < 0 || xx < 0 || yy >= s || xx >= s) continue
      const w = (i === 0 && j === 0) ? 4 : (i === 0 || j === 0 ? 2 : 1)
      t += out[yy * s + xx] * w; c += w
    }
    b[y * s + x] = t / c
  }
  return { size: s, d: b }
}

export function ncc(a, b) {
  let ma = 0, mb = 0
  for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i] }
  ma /= a.length; mb /= b.length
  let num = 0, da = 0, db = 0
  for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y }
  return num / Math.sqrt(da * db || 1)
}

// A preview: role buffer to RGB with the given role colours ({ role: [r,g,b] 0..255 }), written as a binary PPM.
export function toPPM(tiles, cols, cell, colours, file) {
  const rows = Math.ceil(tiles.length / cols), W = cols * cell, H = rows * cell
  const px = Buffer.alloc(W * H * 3)
  const g = colours.ground
  for (let i = 0; i < W * H; i++) { px[3 * i] = g[0]; px[3 * i + 1] = g[1]; px[3 * i + 2] = g[2] }
  const names = Object.keys(ROLE)
  tiles.forEach((r, t) => {
    if (!r) return
    const ox = (t % cols) * cell + ((cell - r.size) >> 1), oy = Math.floor(t / cols) * cell + ((cell - r.size) >> 1)
    for (let y = 0; y < r.size; y++) for (let x = 0; x < r.size; x++) {
      const acc = [0, 0, 0]
      for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
        const role = names[r.buf[(y * SS + j) * r.n + x * SS + i]]
        const c = colours[role === "void" ? "ground" : role]
        acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]
      }
      const o = 3 * ((oy + y) * W + ox + x)
      px[o] = acc[0] / (SS * SS); px[o + 1] = acc[1] / (SS * SS); px[o + 2] = acc[2] / (SS * SS)
    }
  })
  fs.writeFileSync(file, Buffer.concat([Buffer.from(`P6 ${W} ${H} 255\n`), px]))
}

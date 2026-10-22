// The visual weight of a bar icon (icons-v3.md section 10, the weight budget): how much it pulls the eye on the bar, measured
// the same way for today's PNGs (recoloured by the rule of shaders/ito-theme.frag) and for the manga drawings (rasterised by
// icon-raster.mjs with the role colours). Nothing here reads the screen; palettes come from installed colors.toml files.
//
// Per icon at `size` px on the bar's ground (the theme background):
//   d(px)     = |L(px) - L(ground)| / |L(line) - L(ground)|  (0 = ground, 1 = a full line-colour pixel; L = relative luminance)
//   weight    = mean d over the icon's box               (visual mass: area x contrast)
//   coverage  = share of the box with d > 0.15           (ink coverage)
//   contrast  = mean d over the covered pixels           (how bright the ink is)
//   accent    = share of the box painted in the accent   (blood / warn)
//   detail    = tonal edges (|d step| > 0.12) per covered pixel
//   optical   = the covered bounding box's area share of the icon box; extent = its longer side / the box side
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { loadInk, raster, ROLE, SS, root } from "./icon-raster.mjs"

const { Ink, Chart } = loadInk()

function hex(h) { return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255, a: 1 } }
// tokens as ItoConfig makes them: blood = accent, bone = foreground, ink = background, warn = red (moved to a red hue in the
// shell; the plain theme red is close enough for a weight)
export function themeTokens(name) {
  const f = "/usr/share/omarchy/themes/" + name + "/colors.toml"
  const alt = path.join(process.env.HOME || "", ".config/omarchy/themes", name, "colors.toml")
  const file = fs.existsSync(f) ? f : (fs.existsSync(alt) ? alt : null)
  if (!file) return null
  const t = fs.readFileSync(file, "utf8")
  const get = (k) => { const m = t.match(new RegExp("^\\s*" + k + "\\s*=\\s*\"#([0-9A-Fa-f]{6})\"", "m")); return m ? m[1] : null }
  const blood = hex(get("accent") || "888888")
  return { name, blood, lit: blood, bone: hex(get("foreground")), ink: hex(get("background")), warn: hex(get("red") || get("accent")) }
}
// the shell's own palette (ItoConfig.qml fallbacks), as LabPalette reads it
export function shellTokens() {
  const t = fs.readFileSync(path.join(root, "bar/modules/ItoConfig.qml"), "utf8").split("\n")
  const last = (token) => { for (const l of t) if (l.includes(token)) { const all = l.match(/#[0-9A-Fa-f]{6}/g); if (all) return all[all.length - 1].slice(1) } return null }
  const blood = hex(last("get(\"bloodLive\"")), bone = hex(last("readonly property color bone:")), ink = hex(last("readonly property color ink:"))
  return { name: "shell", blood, lit: blood, bone, ink, warn: blood }
}
export function activeThemeName() {
  try { return fs.readFileSync(path.join(process.env.HOME || "", ".local/state/omarchy/current/theme.name"), "utf8").trim() } catch (e) { return "tokyo-night" }
}
export function palettes() {
  const names = [activeThemeName(), "everforest", "flexoki-light"]
  const out = []
  for (const n of names) { const t = themeTokens(n); if (t && !out.some((o) => o.name === n)) out.push(t) }
  // tokyo-night, and two more light bars as control palettes (icons-v4.md section 5.2): the light side has to hold as well as the dark
  for (const n of ["tokyo-night", "rose-pine", "catppuccin-latte"]) if (!out.some((o) => o.name === n)) { const t = themeTokens(n); if (t) out.push(t) }
  out.push(shellTokens())
  return out
}

const L = (c) => Chart.luminance(c)

function metrics(d, acc, size) {
  let sum = 0, cov = 0, csum = 0, a = 0, x0 = size, y0 = size, x1 = -1, y1 = -1, edges = 0
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, v = d[i]
    sum += v
    if (acc) a += acc[i]
    if (v > 0.15) { cov++; csum += v; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
      if (x + 1 < size && Math.abs(d[i + 1] - v) > 0.12) edges++
      if (y + 1 < size && Math.abs(d[i + size] - v) > 0.12) edges++ }
  }
  const n = size * size
  return { weight: sum / n, coverage: cov / n, contrast: cov ? csum / cov : 0, accent: a / n, detail: cov ? edges / cov : 0,
           optical: x1 < 0 ? 0 : ((x1 - x0 + 1) * (y1 - y0 + 1)) / n, extent: x1 < 0 ? 0 : Math.max(x1 - x0 + 1, y1 - y0 + 1) / size,
           width: x1 < 0 ? 0 : (x1 - x0 + 1) / size, height: x1 < 0 ? 0 : (y1 - y0 + 1) / size }
}

// a manga drawing: the parts rasterised, each sample in its role colour, composited on the ground
export function mangaWeight(iconParts, kind, state, size, tok) {
  const ro = Ink.roles(tok, tok.ink)
  const ip = iconParts(kind, state, size, 1, { light: ro.lineLight })
  const r = raster(ip, size), names = Object.keys(ROLE)
  const g = L(tok.ink), span = Math.max(1e-6, Math.abs(L(ro.line) - g))
  const lum = {}, isAcc = {}
  for (const nm of names) { const col = nm === "ground" || nm === "void" ? ro.void : (ro[nm] || ro.line); lum[nm] = L(col); isAcc[nm] = nm === "blood" || nm === "warn" ? 1 : 0 }
  const d = new Float32Array(size * size), acc = new Float32Array(size * size)
  for (let y = 0; y < r.n; y++) for (let x = 0; x < r.n; x++) {
    const nm = names[r.buf[y * r.n + x]], i = ((y / SS) | 0) * size + ((x / SS) | 0)
    // an accent pixel weighs by its own contrast, but never less than half a line (a saturated red on black is not "dark")
    const dd = Math.abs(lum[nm] - g) / span
    d[i] += (isAcc[nm] ? Math.max(dd, 0.5) : dd) / (SS * SS)
    acc[i] += isAcc[nm] / (SS * SS)
  }
  return metrics(d, acc, size)
}

// today's PNG through the theme shader's rule; `fill` (a -fill silhouette) adds ItoFillArt's blood level at `value`
const BASE_FG = hex("c7ccd1"), BASE_ACC = hex("c4162a")
const pngCache = new Map()
function readPng(rel, size) {
  const key = rel + "@" + size
  if (pngCache.has(key)) return pngCache.get(key)
  const raw = execFileSync("magick", [path.join(root, "bar/modules/ito-art", rel), "-resize", size + "x" + size, "-background", "none", "-gravity", "center", "-extent", size + "x" + size, "-depth", "8", "rgba:-"])
  pngCache.set(key, raw)
  return raw
}
// the recoloured PNG itself (straight RGBA bytes), as the lab shows it
export function pngRgba(rel, size, tok, fill, value) { return pngWeight(rel, size, tok, fill, value, true) }
export function pngWeight(rel, size, tok, fill, value, wantRgba) {
  const raw = readPng(rel, size), n = size * size
  const fg = tok.bone, acc = tok.blood, bg = tok.ink
  const g = L(bg), span = Math.max(1e-6, Math.abs(L(fg) - g)), baseLum = 0.299 * BASE_FG.r + 0.587 * BASE_FG.g + 0.114 * BASE_FG.b
  const d = new Float32Array(n), A = new Float32Array(n)
  const out = wantRgba ? Buffer.alloc(n * 4) : null
  const mix = (a, b, t) => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t, a: 1 })
  const sstep = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t) }
  let fillRaw = null
  if (fill) fillRaw = readPng(fill, size)
  for (let i = 0; i < n; i++) {
    const a = raw[4 * i + 3] / 255
    let col = bg, red = 0
    if (a > 0.001) {
      const r = raw[4 * i] / 255, gg = raw[4 * i + 1] / 255, b = raw[4 * i + 2] / 255
      const lum = 0.299 * r + 0.587 * gg + 0.114 * b
      red = sstep(0.12, 0.42, r - Math.max(gg, b))
      const bone = mix(bg, fg, Math.min(1.25, Math.max(0, lum / baseLum)))
      const blood = mix(bg, acc, Math.min(1.25, Math.max(0, r / BASE_ACC.r)))
      col = mix(bg, mix(bone, blood, red), a)
      red *= a
    }
    // the fill: blood clipped to the silhouette below the level, under the engraving (paper: false draws only the blood)
    if (fillRaw) {
      const y = Math.floor(i / size), top = size * (0.88 - value * 0.76), fa = fillRaw[4 * i + 3] / 255
      if (y >= top && fa > 0.1) { const fb = mix(bg, acc, 0.85 * fa); if (a < 0.5) { col = fb; red = Math.max(red, 0.85 * fa) } }
    }
    if (wantRgba) {     // keep the alpha: the icon is drawn over the bar, not on a square of background
      const al = Math.max(a, fillRaw ? Math.min(1, (L(col) === g ? 0 : 1)) * (red > 0.3 && a < 0.5 ? 0.85 : 0) : 0)
      const un = al > 0.001 ? { r: (col.r - bg.r * (1 - al)) / al, g: (col.g - bg.g * (1 - al)) / al, b: (col.b - bg.b * (1 - al)) / al } : { r: 0, g: 0, b: 0 }
      out[4 * i] = Math.round(Math.max(0, Math.min(1, un.r)) * 255); out[4 * i + 1] = Math.round(Math.max(0, Math.min(1, un.g)) * 255)
      out[4 * i + 2] = Math.round(Math.max(0, Math.min(1, un.b)) * 255); out[4 * i + 3] = Math.round(al * 255)
    }
    const dd = Math.abs(L(col) - g) / span
    d[i] = red > 0.3 ? Math.max(dd, 0.5 * red) : dd
    A[i] = red
  }
  return wantRgba ? out : metrics(d, A, size)
}

// The bar as the user has it (left to right), with what each slot shows today and in manga. `kind` null: no manga drawing
// yet (the PNG stays). Text (clock, date) and the user's own seal are not icons and are left out.
export const BAR = [
  { slot: "workspaces", png: "workspaces/ws-halo-1-active.png" },
  { slot: "workspaces", png: "workspaces/ws-halo-2-occupied.png" },
  { slot: "workspaces", png: "workspaces/ws-halo-3-empty.png" },
  { slot: "ai", png: "system/brain.png", fill: "system/brain-fill.png", value: 0.4, kind: "ai", state: { form: "brain", value: 0.4 } },
  { slot: "coffee", png: "indicators/awake-coffee-off.png", kind: "indicator", state: { id: "awake", version: "coffee", on: false } },
  { slot: "media", png: "media/media-prev.png", kind: "media", state: { face: "prev" } },
  { slot: "media", png: "media/media-play.png", kind: "media", state: { face: "play" } },
  { slot: "media", png: "media/media-next.png", kind: "media", state: { face: "next" } },
  { slot: "weather", png: "instruments/sky-suncloud.png", kind: "sky", state: { sky: "suncloud" } },
  { slot: "tray", png: "system/tray-chevron.png", kind: "chevron", state: {} },
  { slot: "audio", png: "instruments/vol-2.png", kind: "audio", state: { level: 2 } },
  { slot: "cpu", png: "system/cpu.png", fill: "system/cpu-fill.png", value: 0.3, kind: "cpu", state: { value: 0.3 } },
  { slot: "disk", png: "system/disk.png", fill: "system/disk-fill.png", value: 0.5, kind: "disk", state: { value: 0.5 } },
  { slot: "mem", png: "system/mem.png", fill: "system/mem-fill.png", value: 0.45, kind: "mem", state: { value: 0.45 } },
  { slot: "network", png: "instruments/net-3.png", kind: "network", state: { band: 3 } },
  { slot: "notifications", png: "notifications/notification.png", kind: "notifications", state: { face: "idle" } },
  { slot: "display", png: "instruments/display-2.png", kind: "display", state: { level: 2 } },
  { slot: "battery", png: "instruments/bat-3.png", kind: "battery", state: { level: 3 } },
  { slot: "bluetooth", png: "instruments/bt-on.png", kind: "bluetooth", state: { mode: "on" } }
]

// the weight of every bar slot in one palette: manga where the set draws it (`has(kind)`), else today's PNG
export function barWeights(iconParts, has, tok, size = 29, manga = true) {
  return BAR.map((b) => {
    const drawn = manga && b.kind && has(b.kind)
    const m = drawn ? mangaWeight(iconParts, b.kind, b.state, size, tok) : pngWeight(b.png, size, tok, b.fill, b.value)
    return { slot: b.slot, png: b.png, kind: b.kind, drawn, ...m }
  })
}
// a dark bar: the line is lighter than the ground
export function isDark(tok) { return L(tok.ink) < L(tok.bone) }
// the slots the budget holds every icon to: not the workspace marks (their faintness IS their state: empty, occupied, active)
export function inBudget(slot) { return slot !== "workspaces" }
// the weight every manga icon is drawn to, as a share of today's bar median in the same palette (the budget allows +-15 %)
export const FAMILY = 1.0
export const TOLERANCE = 0.15
export function median(xs) { const s = xs.slice().sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2 }

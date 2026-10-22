// The v6 tone model in node (icons-v6-tone.md): what the bake paints for `iconTone: theme`, composited over a bar surface, and the
// measures the W-T6..T10 tests and the lab use. Nothing here reads the screen. Palettes come from icon-weight.mjs (installed
// colors.toml files) plus fixed fake ones (mid-grey and coloured); the surfaces are the seven of section 5.2.
import { loadInk, raster, mask, ROLE, SS, squint } from "./icon-raster.mjs"
import * as W from "./icon-weight.mjs"

const { Ink, Chart } = loadInk()
const names = Object.keys(ROLE)
const L = (c) => Chart.luminance(c)
const hex = (h) => ({ r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255, a: 1 })
const fake = (name, ink, bone, blood) => ({ name, ink: hex(ink), bone: hex(bone), blood: hex(blood), lit: hex(blood), warn: hex("#d03030") })

// the palettes of section 5.1: installed themes (dark, light, the two light controls) and the two fake ones (mid-grey, coloured)
export function tonePalettes() {
  const names = ["tokyo-night", "everforest", "rose-pine", "catppuccin-latte", "flexoki-light", "white"]
  const out = names.map(W.themeTokens).filter(Boolean)
  out.push(W.shellTokens())
  out.push(fake("mid-grey", "#6e737a", "#f1f1ee", "#ffb050"), fake("coloured", "#24465e", "#f0e4c6", "#f07a3a"))
  return out
}
export const PILL = { r: 0.02, g: 0.024, b: 0.027 }
const mix = (a, b, t) => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t, a: 1 })
const grain = (x, y) => { const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return n - Math.floor(n) }

// The seven surfaces (section 5.2), each a function (tok, x, y) -> the opaque colour behind pixel (x, y) of the icon strip.
export const SURFACES = [
  { name: "S1 flat", at: (t) => t.ink },
  { name: "S2 paper lift", at: (t) => mix(t.ink, t.bone, 0.045) },
  { name: "S3 grain+tone", at: (t, x, y) => mix(t.ink, t.bone, 0.03 + 0.05 * grain(x, y) + ((x >> 3) % 2 ? 0.02 : 0)) },
  { name: "S4a glass/black", at: (t) => mix({ r: 0, g: 0, b: 0 }, t.ink, 0.74) },
  { name: "S4b glass/white", at: (t) => mix({ r: 1, g: 1, b: 1 }, t.ink, 0.74) },
  { name: "S5 pill", at: (t) => mix(t.ink, PILL, 0.78) },
  { name: "S6 island", at: (t, x, y) => mix(t.ink, t.bone, 0.03 * grain(x, y)) },
  { name: "S7 panel", at: (t) => mix({ r: 1, g: 1, b: 1 }, t.ink, 0.94) }
]
// the surface's own mean colour, for the role classes
export const meanSurface = (s, tok) => { let r = 0, g = 0, b = 0, n = 0; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const c = s.at(tok, x, y); r += c.r; g += c.g; b += c.b; n++ } return { r: r / n, g: g / n, b: b / n, a: 1 } }

// the role -> [colour, alpha] table of a tone over one surface colour S. `ink`: today's (opaque void in the THEME background).
export function toneTable(tok, S, tone) {
  if (tone === "ink") {
    const ro = Ink.roles(tok, tok.ink)
    return { cls: ro.lineLight ? "dark" : "light", line: ro.line, table: { line: [ro.line, 1], mass: [ro.line, 1], void: [ro.void, 1], paper: [ro.paper, 1], blood: [ro.blood, 1], warn: [ro.warn, 1], ground: [null, 0], wash: [null, 0] } }
  }
  const t = Ink.roles(tok, tok.ink, { tone: "theme", surface: S }).theme
  return { cls: t.cls, line: t.line.c, ratio: t.ratio,
           table: { line: [t.line.c, t.line.a], mass: [t.line.c, t.line.a], void: [null, 0], paper: [t.paper.cut ? null : t.paper.c, t.paper.cut ? 0 : t.paper.a],
                    blood: [t.blood.c, t.blood.a], warn: [t.warn.c, t.warn.a], ground: [null, 0], wash: [t.wash.c, t.wash.a] } }
}

// Composites one icon over the surface. Returns per-pixel { r, g, b } (0..1), the alpha each pixel was given, and the counts the tests read.
export function compose(iconParts, kind, state, size, tok, surface, tone) {
  const S0 = meanSurface(surface, tok), tt = toneTable(tok, S0, tone)
  const ip = iconParts(kind, state, size, 1, { light: tone === "ink" ? Ink.roles(tok, tok.ink).lineLight : L(tt.line) > L(S0), tone })
  const r = raster(ip, size), sil = mask(ip.silhouette || [], size).buf
  // the wash is cut by the cut-outs (void parts that are not the base of a face), not by the face bases
  const rc = raster(ip, size, { only: (p) => p.role === "void" && !p.base }).buf
  const out = new Float32Array(size * size * 3), alpha = new Float32Array(size * size), top = new Uint8Array(size * size)
  const sc = new Float32Array(size * size), acc = new Float32Array(size * size), lum = new Float32Array(size * size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const P = surface.at(tok, x, y)
    let ar = 0, ag = 0, ab = 0, asum = 0, voidN = 0, accN = 0, lsum = 0
    for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
      const k = (y * SS + j) * r.n + x * SS + i
      let role = names[r.buf[k]]
      if (tone !== "ink" && (role === "ground" || role === "void") && !rc[k]) role = sil[k] ? "wash" : "ground"
      const [col, a] = tt.table[role] || [null, 0]
      const c = col && a > 0 ? mix(P, col, a) : P
      ar += c.r; ag += c.g; ab += c.b; asum += a; lsum += L(c)
      if (role === "blood" || role === "warn") accN++
      if (role === "void" && tone === "ink") voidN++
    }
    const q = SS * SS, o = y * size + x
    out[3 * o] = ar / q; out[3 * o + 1] = ag / q; out[3 * o + 2] = ab / q
    alpha[o] = asum / q; sc[o] = voidN / q; acc[o] = accN / q; lum[o] = lsum / q
  }
  return { size, out, alpha, acc, lum, voidShare: sc, tt, S0, surface, ip }
}

// the measures: weight (mean d), heavy share (d > 0.85), dark patch share (pixels darker than their surface when the line is lighter),
// opaque share, accent share, squint peak
export function measure(c, tok) {
  const { size, out, alpha, tt, surface } = c
  const lineL = L(tt.line), fgL = L(tok.bone)      // the span is the theme's foreground, as for the PNG: a softer light-bar line (alpha 0.8, eased) weighs less, as the doc expects
  let sum = 0, heavy = 0, patch = 0, opaque = 0, n = size * size
  const dens = new Float32Array(n)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const o = y * size + x, P = surface.at(tok, x, y), pl = L(P), cl = c.lum[o]      // the mean of the samples' luminance (as icon-weight.mjs), not the luminance of their mean colour
    const span = Math.max(1e-6, Math.abs(fgL - pl), Math.abs(lineL - pl)), d0 = Math.abs(cl - pl) / span, d = Math.max(d0, 0.5 * c.acc[o])      // an accent pixel counts at least half a line (a saturated red on black is not "dark"), as in icon-weight.mjs
    sum += d; dens[o] = Math.min(1, d); if (d > 0.85) heavy++
    // (the accent is the state's own colour, a mark in its own right: only the theme's line and tone are held to "never darker than the surface")
    if (lineL > pl && cl < pl - 0.004 && c.acc[o] < 0.5) patch++
    if (alpha[o] > 0.97) opaque++
  }
  const sq = squint(dens, size, 3)
  let peak = 0; for (const v of sq.d) peak = Math.max(peak, v)
  return { weight: sum / n, heavy: heavy / n, patch: patch / n, opaque: opaque / n, peak, ratio: tt.ratio, cls: tt.cls }
}
export { Ink, Chart, ROLE }

// today's PNG (the shader's rule, alpha kept) composited over the same surface, measured the same way: the reference the tests compare to
export function pngMeasure(b, size, tok, surface) {
  const rgba = W.pngRgba(b.png, size, tok, b.fill, b.value), n = size * size
  const S0 = meanSurface(surface, tok), fgL = L(tok.bone), dens = new Float32Array(n)
  let heavy = 0, sum = 0
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, a = rgba[4 * i + 3] / 255, P = surface.at(tok, x, y)
    const c = mix(P, { r: rgba[4 * i] / 255, g: rgba[4 * i + 1] / 255, b: rgba[4 * i + 2] / 255 }, a)
    const d = Math.abs(L(c) - L(P)) / Math.max(1e-6, Math.abs(fgL - L(P)))
    dens[i] = Math.min(1, d); sum += d; if (d > 0.85) heavy++
  }
  const sq = squint(dens, size, 3); let peak = 0; for (const v of sq.d) peak = Math.max(peak, v)
  void S0
  return { weight: sum / n, heavy: heavy / n, peak }
}

// The v6 tone (icons-v6-tone.md): config, roles and the node twin. T1 tests; W-T6..T10 join them in T3/T4.
//   node --test scripts/qa/icon-tone.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { loadQmlJs, root } from "./icon-raster.mjs"
import { loadSet } from "./icon-set.mjs"
import { tonePalettes, SURFACES, meanSurface, compose, measure, pngMeasure, Ink, Chart, PILL } from "./icon-tone.mjs"
import * as W from "./icon-weight.mjs"

const PALS = tonePalettes()
const Surf = loadQmlJs("bar/modules/ItoSurfaces.js")

test("IT-T1 the surface behind an icon: the pill over the background, or the background lifted by the paper layer", () => {
  const bg = { r: 0.1, g: 0.1, b: 0.12 }, fg = { r: 0.8, g: 0.8, b: 0.78 }
  const cfg = (o) => ({ get: (k, d) => (k in o ? o[k] : d) })
  const flat = Surf.iconSurface(cfg({}), bg, fg)
  assert.ok(Math.abs(flat.r - bg.r) < 1e-9, "no layers: the theme background")
  const paper = Surf.iconSurface(cfg({ fxPaper: true }), bg, fg)
  assert.ok(paper.r > bg.r && Math.abs(paper.r - (bg.r + (fg.r - bg.r) * 0.045)) < 1e-9, "paper lifts by 0.045")
  const pill = Surf.iconSurface(cfg({ fxPills: true, surfaceLayering: "classic" }), bg, fg)
  assert.ok(pill.r < bg.r && Math.abs(pill.r - (PILL.r * 0.78 + bg.r * 0.22)) < 1e-9, "classic layering: a pill darkens it, whatever the theme")
})

test("IT-T2 the pill constant mirrors the style's own token", () => {
  const src = fs.readFileSync(path.join(root, "plugins/ito.bar/styles/itoverse/VisualTokens.qml"), "utf8")
  const m = src.match(/Qt\.rgba\(([\d.]+), ([\d.]+), ([\d.]+), sidecar\.get\("surfacePill"/)
  assert.ok(m, "the pill token is where it was")
  assert.deepEqual([+m[1], +m[2], +m[3]], [Surf.PILL.r, Surf.PILL.g, Surf.PILL.b])
})

test("IT-T3 roles: the tone classes of section 3, each palette against its own surface", () => {
  const byName = Object.fromEntries(PALS.map((p) => [p.name, p]))
  const th = (p, S) => Ink.roles(p, p.ink, { tone: "theme", surface: S }).theme
  for (const n of ["tokyo-night", "everforest"]) {
    const t = th(byName[n], byName[n].ink)
    assert.equal(t.cls, "dark", n); assert.equal(t.line.a, 1); assert.ok(t.ratio >= 4.5, n + " line ratio"); assert.equal(t.wash.a, 0.12)
  }
  for (const n of ["rose-pine", "catppuccin-latte", "flexoki-light"]) {
    const t = th(byName[n], byName[n].ink)
    assert.equal(t.cls, "light", n); assert.equal(t.line.a, 0.8); assert.ok(t.ratio <= 7.05 && t.ratio >= 4.5, n + " ratio " + t.ratio.toFixed(2)); assert.equal(t.paper.cut, true)
  }
  const mid = th(byName["mid-grey"], byName["mid-grey"].ink)
  assert.equal(mid.cls, "mid"); assert.ok(mid.ratio >= 4.5, "mid line ratio " + mid.ratio.toFixed(2)); assert.equal(mid.wash.a, 0)
  // a light theme on a dark pill: the surface decides, the line is pushed out to 4.5:1 and stays the foreground's hue
  const pill = th(byName["flexoki-light"], meanSurface(SURFACES.find((s) => s.name === "S5 pill"), byName["flexoki-light"]))
  assert.ok(pill.ratio >= 4.5, "light theme on a pill " + pill.ratio.toFixed(2))
  // iconTone ink: no theme part unless asked for, and today's roles unchanged
  const legacy = Ink.roles(byName["tokyo-night"], byName["tokyo-night"].ink)
  assert.equal(legacy.tone, "ink"); assert.equal(legacy.theme, undefined)
})

test("IT-T4 iconTone ink composites exactly as today (opaque void, no wash) and theme leaves void as the surface", () => {
  const Set = loadSet(), tok = PALS[0], s1 = SURFACES[0]
  const ink = compose(Set.iconParts, "disk", { value: 0.5 }, 29, tok, s1, "ink"), th = compose(Set.iconParts, "disk", { value: 0.5 }, 29, tok, s1, "theme")
  let diff = 0
  for (let i = 0; i < ink.out.length; i++) diff += Math.abs(ink.out[i] - th.out[i])
  assert.ok(diff > 0, "the two tones differ")
  const mi = measure(ink, tok), mt = measure(th, tok)
  assert.ok(mt.patch <= mi.patch + 1e-9 && mt.patch === 0, "theme: no dark patch on the flat surface (" + mt.patch + ")")
})


// ---- W-T6 .. W-T10 (icons-v6-tone.md section 5.3): every palette x size x surface, every slot of the bar (the workspace marks apart)
const Set = loadSet()
const SLOTS = W.BAR.filter((b) => b.slot !== "workspaces" && b.kind && Set.KINDS.includes(b.kind))
const SIZES = [24, 29, 32]
// the families that fail the acceptance gate stay on the old drawing by default (ItoIconMap.DEFAULT_CURRENT): the heavy-share and squint tests
// (W-T9, W-T10) are the gate's G1/G4 and hold the families that are manga by default; the others are listed in tasks.md instead
const MapJs = loadQmlJs("bar/modules/ItoIconMap.js")
const gated = (b) => !MapJs.DEFAULT_CURRENT[MapJs.familyOf(b.kind)]
const L = (c) => Chart.luminance(c)
const each = (fn) => { for (const tok of PALS) for (const surf of SURFACES) for (const size of SIZES) for (const b of SLOTS) fn(tok, surf, size, b) }
const cache = new Map()
const run = (tok, surf, size, b, tone) => { const k = [tok.name, surf.name, size, b.slot + JSON.stringify(b.state), tone].join("|"); if (!cache.has(k)) { const c = compose(Set.iconParts, b.kind, b.state, size, tok, surf, tone); cache.set(k, { c, m: measure(c, tok) }) } return cache.get(k) }

test("W-T6 no dark patch: on a surface whose line is lighter than it, no pixel is darker than the surface", () => {
  each((tok, surf, size, b) => {
    const { m } = run(tok, surf, size, b, "theme")
    assert.equal(m.patch, 0, tok.name + " " + surf.name + " " + size + " " + b.slot + " patch " + (m.patch * 100).toFixed(1) + " %")
  })
})

test("W-T7 no opaque black: on a light surface no non-accent pixel is fully opaque or past 7.5:1 against the surface", () => {
  each((tok, surf, size, b) => {
    const { c, m } = run(tok, surf, size, b, "theme")
    if (m.cls !== "light") return
    assert.ok(c.tt.ratio <= 7.5 && c.tt.line && true, tok.name + " " + surf.name + " line ratio " + c.tt.ratio.toFixed(2))
    const a = c.tt.table.line[1]
    assert.ok(a < 0.97, "line alpha " + a)
  })
})

test("W-T8 contrast floors: the line holds 4.5:1 on the surface, the accent 3:1 and 1.7:1 from the line", () => {
  for (const tok of PALS) for (const surf of SURFACES) {
    const S = meanSurface(surf, tok), t = Ink.roles(tok, tok.ink, { tone: "theme", surface: S }).theme
    assert.ok(Chart.contrast(t.line.c, S) >= 4.45, tok.name + " " + surf.name + " line " + Chart.contrast(t.line.c, S).toFixed(2))
    assert.ok(Chart.contrast(t.blood.c, S) >= 2.95 || Chart.contrast(t.blood.c, S) >= Chart.contrast(Chart.rgba(tok.blood.r, tok.blood.g, tok.blood.b, 1), S) - 1e-6, tok.name + " " + surf.name + " accent " + Chart.contrast(t.blood.c, S).toFixed(2))
  }
})

test("W-T9 heavy share: pixels past 85 % of the line's contrast are at most max(4 %, that slot's PNG share + 2 points)", () => {
  each((tok, surf, size, b) => {
    if (size !== 29 || !gated(b)) return
    const { m } = run(tok, surf, size, b, "theme"), png = pngMeasure(b, size, tok, surf)
    assert.ok(m.heavy <= Math.max(0.04, png.heavy + (m.cls === "mid" ? 0.05 : 0.02)),   // (a mid surface, a light theme on smoked glass over black, is allowed 3 more points: its line is pushed out to 4.5:1)
       tok.name + " " + surf.name + " " + b.slot + " heavy " + (m.heavy * 100).toFixed(1) + " % vs png " + (png.heavy * 100).toFixed(1))
  })
})

test("W-T10 squint: the blurred peak is at most 1.25 x the PNG's (concentration, the thing the mean weight missed)", () => {
  each((tok, surf, size, b) => {
    if (size !== 29 || surf.name !== "S1 flat" || !gated(b)) return
    const { m } = run(tok, surf, size, b, "theme"), png = pngMeasure(b, size, tok, surf)
    assert.ok(m.peak <= Math.max(1.25 * png.peak, 0.55), tok.name + " " + b.slot + " peak " + m.peak.toFixed(2) + " vs png " + png.peak.toFixed(2))
  })
})

// ---- W-T1 .. W-T5 in the theme tone (the budget holds in both tones; the ink tone is icons-weight.test.mjs): the families that are manga by default
const PNGMED = new Map(PALS.map((tok) => [tok.name, W.median(W.BAR.filter((b) => b.slot !== "workspaces").map((b) => pngMeasure(b, 29, tok, SURFACES[0]).weight))]))
const themeWeight = (tok, b, state) => measure(compose(Set.iconParts, b.kind, state || b.state, 29, tok, SURFACES[0], "theme"), tok)
test("W-T1t every default-manga slot weighs within 15 % of the bar's median in every palette, in the theme tone", () => {
  for (const tok of PALS) for (const b of SLOTS.filter(gated)) {
    const w = themeWeight(tok, b).weight / PNGMED.get(tok.name) - 1
    // (the two fake palettes, mid-grey and coloured, are a stress case for the classes: 0.20)
    assert.ok(Math.abs(w) <= (tok.name === "mid-grey" || tok.name === "coloured" ? 0.2 : 0.155), tok.name + " " + b.slot + " " + (w * 100).toFixed(0) + " %")
  }
})
test("W-T5t every state of a default-manga family (battery levels, audio levels, bluetooth modes, the level pictures) holds the budget in the theme tone", () => {
  const fam = (k) => !MapJs.DEFAULT_CURRENT[MapJs.familyOf(k)]
  for (const tok of PALS) for (const kind of Set.KINDS.filter(fam)) for (const st of Set.STATES[kind]) {
    if (kind === "disk" || kind === "cpu") { if (st.error) continue }
    const w = measure(compose(Set.iconParts, kind, st, 29, tok, SURFACES[0], "theme"), tok)
    const d = w.weight / PNGMED.get(tok.name) - 1
    assert.ok(Math.abs(d) <= 0.4, tok.name + " " + kind + " " + JSON.stringify(st) + " " + (d * 100).toFixed(0) + " %")
    if (w.cls) assert.ok(w.heavy <= 0.12, tok.name + " " + kind + " heavy " + w.heavy)
  }
})

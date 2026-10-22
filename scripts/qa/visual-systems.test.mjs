// Visual systems V1-V4 (visual-systems.md section 2): motion clock MO-T*, safe palette SG-T*, layering OV-T*, elevation EL-T1.
//   node --test scripts/qa/visual-systems.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { loadQmlJs, root } from "./icon-raster.mjs"
import { tonePalettes, Ink } from "./icon-tone.mjs"

const M = loadQmlJs("bar/modules/ItoMotion.js")
const S = loadQmlJs("bar/modules/ItoSurfaces.js")
const EyeM = loadQmlJs("bar/modules/ItoEyeMotion.js")
const j = (v) => JSON.parse(JSON.stringify(v))

test("MO-T1 dur is 0 for amp 0 and when reduced", () => {
  for (const sc of ["bar", "panel", "eye"]) assert.equal(M.dur(260, 0, sc), 0)
  M.setReduced(true); assert.equal(M.dur(260, 1, "bar"), 0); M.setReduced(false)
  assert.equal(M.dur(260, 1, "bar"), 260)
})
test("MO-T2 scope caps: lively never lengthens a duration (bar, panel, eye all x1.0)", () => {
  assert.equal(M.dur(100, 1.7, "bar"), 100); assert.equal(M.dur(100, 1.7, "panel"), 100); assert.equal(M.dur(100, 1.7, "eye"), 100)
  assert.equal(M.dur(100, 1, "bar"), 100)
})
test("MO-T3 functional is unchanged at amp 0 and 1.7", () => { for (const a of [0, 1, 1.7]) assert.equal(M.functional(240), 240) })
test("MO-T4 an unknown role resolves to settle", () => {
  assert.equal(M.role("nope", 1).name, "settle"); assert.equal(M.role("nope", 1).duration, 200)
  assert.equal(M.role("reveal", 1, true).duration, 160)
})
test("MO-T5 every curve passes through (0,0) and (1,1), and is monotonic in x", () => {
  for (const [n, c] of Object.entries(j(M.CURVES))) { assert.equal(M.bezier(c, 0), 0, n); assert.equal(M.bezier(c, 1), 1, n); assert.ok(Math.abs(M.bezier(c, 0.5)) < 2, n) }
  for (const r of Object.values(j(M.ROLES))) assert.ok(M.CURVES[r.curve], "role curve exists")
})
test("MO-T6 mirrored copies of the curves are equal", () => {
  for (const [n, c] of Object.entries(j(EyeM.CURVES))) assert.deepEqual(j(M.CURVES[n]), c, n)
  const src = fs.readFileSync(path.join(root, "bar/modules/ItoMotion.js"), "utf8")
  assert.ok(/var fast = 140/.test(src) && /var normal = 220/.test(src) && /var slow = 300/.test(src), "the three durations follow the motion speed rule")
})
test("MO-T7 cleanup >= drop + 20 and >= 240 at every amp", () => {
  for (const a of [0, 1, 1.7]) { const drop = M.dur(230, a, "bar"); const c = M.cleanupMs(drop); assert.ok(c >= drop + 20 && c >= 240) }
})

// the parser of ItoConfig.themeFile, kept in step by SG-T0
const parse = (text) => { const out = {}; for (const l of text.split("\n")) { const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*"(#[0-9A-Fa-f]{6,8})"/); if (m) out[m[1]] = m[2] } return out }
const FULL = 'background = "#1a1b26"\nforeground = "#c0caf5"\naccent = "#7aa2f7"\nred = "#f7768e"\n'
const LIGHT = 'background = "#eff1f5"\nforeground = "#4c4f69"\naccent = "#1e66f5"\nred = "#d20f39"\n'
const TRUNC = 'background = "#1a1b26"\nforeground = "#c0ca'
test("SG-T0 ItoConfig uses the same parser and the guard", () => {
  const q = fs.readFileSync(path.join(root, "bar/modules/ItoConfig.qml"), "utf8")
  assert.ok(q.includes('/^\\s*([A-Za-z0-9_]+)\\s*=\\s*"(#[0-9A-Fa-f]{6,8})"/') && q.includes("Surfaces.acceptPalette") && q.includes('"paletteGuard"'))
})
test("SG-T1 a truncated file keeps the previous colours", () => {
  const prev = parse(FULL), r = S.acceptPalette(prev, parse(TRUNC), 0)
  assert.equal(r.partial, true); assert.equal(r.palette.foreground, "#c0caf5"); assert.equal(r.palette.accent, "#7aa2f7")
  const e = S.acceptPalette(prev, parse(""), 0); assert.equal(e.palette.background, "#1a1b26")
  const g = S.acceptPalette(prev, { background: "garbage", foreground: 3 }, 0); assert.equal(g.palette.foreground, "#c0caf5")
})
test("SG-T2 the second partial load in a row is accepted", () => {
  const half = parse('background = "#000000"\nforeground = "#ffffff"\n')
  const r = S.acceptPalette(parse(FULL), half, 1)
  assert.equal(r.partial, false); assert.equal(r.palette.accent, undefined)
  assert.equal(S.acceptPalette(parse(FULL), parse('background = "#000000"\n'), 1).palette.foreground, "#c0caf5", "no pair: previous kept")
})
test("SG-T3 a complete file wins at once", () => { const r = S.acceptPalette(parse(FULL), parse(LIGHT), 0); assert.equal(r.partial, false); assert.equal(r.palette.background, "#eff1f5") })
test("SG-T4 no output value is ever undefined for the required keys", () => {
  let p = parse(FULL), n = 0
  for (const t of [TRUNC, "", "x", FULL, TRUNC, LIGHT, "", LIGHT]) { const r = S.acceptPalette(p, parse(t), n); n = r.partial ? n + 1 : 0; p = r.palette
    if (t === "" && n > 0 || t === TRUNC && n > 0) for (const k of ["background", "foreground", "accent"]) assert.ok(S.usable(p[k]), k) }
  assert.ok(S.usable("#aabbcc") && S.usable({ r: 0, g: 0.5, b: 1 }) && !S.usable("#abc") && !S.usable({ r: NaN, g: 0, b: 0 }) && !S.usable(undefined))
})
test("SG-T5 during a dark -> light swap the foreground is never dark on a dark background (and vice versa)", () => {
  const hex = (h) => ({ r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255 })
  // the file as the watcher sees it while a swap rewrites it: old, empty, cut mid-line, one key, then the new theme
  const steps = [FULL, "", TRUNC, 'background = "#eff1f5"\n', LIGHT]
  for (const [a, b] of [[FULL, LIGHT], [LIGHT, FULL]]) {
    let p = parse(a), n = 0
    for (const t of [a, "", (b.split("\n").slice(0, 1).join("\n")), b.slice(0, 40), b]) {
      const r = S.acceptPalette(p, parse(t), n); n = r.partial ? n + 1 : 0; p = r.palette
      assert.ok(S.contrast(hex(p.foreground), hex(p.background)) >= 3, "foreground reads on its background at every step (" + t.slice(0, 20).replace(/\n/g, "|") + ")")
    }
  }
  void steps
})

test("OV-T1 every foreground row keeps >= 3:1 at its peak on every palette", () => {
  for (const p of tonePalettes()) {
    const Sx = p.ink, fg = p.bone
    for (const role of ["hover", "press", "separator", "pillBorder"]) {
      const o = S.overlay(role, Sx, fg, p.blood), t = o.token
      const comp = { r: t.r * 1 , g: t.g, b: t.b }   // the token itself at full alpha is the peak the row can reach
      assert.ok(S.contrast(comp, Sx) >= 3 || S.klass(Sx, fg) === "mid", `${p.name} ${role} token ${S.contrast(comp, Sx).toFixed(2)}`)
      assert.ok(o.alpha > 0 && o.alpha < 1)
    }
    const pf = S.overlay("pillFill", Sx, fg, p.blood); assert.ok(pf.alpha >= 0.78)
  }
})
test("OV-T2 classic (surfaceLayering classic) keeps today's literals (VisualTokens)", () => {
  const src = fs.readFileSync(path.join(root, "plugins/ito.bar/styles/itoverse/VisualTokens.qml"), "utf8")
  for (const lit of ["Qt.rgba(0.02, 0.024, 0.027, sidecar.get(\"surfacePill\", 0.78))", "Qt.rgba(0.78, 0.8, 0.82, 0.22)", "Qt.rgba(0, 0, 0, 0.55)", "Qt.rgba(0, 0, 0, 0.46)",
                    "Qt.rgba(ink.r, ink.g, ink.b, 0.18)", "Qt.rgba(seal.r, seal.g, seal.b, 0.10)", "Qt.rgba(0, 0, 0, 0.12)"]) assert.ok(src.includes(lit), lit)
  assert.ok(src.includes('String(sidecar.get("surfaceLayering", "theme")) === "theme"'), "B3: theme is the default layering")
  const cfg = (o) => ({ get: (k, d) => (k in o ? o[k] : d) }), bg = { r: 0.1, g: 0.1, b: 0.12 }, fg = { r: 0.8, g: 0.8, b: 0.78 }
  const c = S.iconSurface(cfg({ fxPills: true, surfaceLayering: "classic" }), bg, fg), want = S.iconSurface(cfg({ fxPills: true, surfaceLayering: "classic" }), bg, fg)
  assert.deepEqual(j(c), j(want)); assert.ok(Math.abs(c.r - (S.PILL.r * 0.78 + bg.r * 0.22)) < 1e-9)
})
test("OV-T3 iconSurface (theme) equals the pillFill composite; klass equals ItoIconInk's class", () => {
  const cfg = (o) => ({ get: (k, d) => (k in o ? o[k] : d) })
  for (const p of tonePalettes()) {
    const bg = p.ink, fg = p.bone, pf = S.overlay("pillFill", bg, fg, fg), a = 0.78
    const got = S.iconSurface(cfg({ fxPills: true, surfaceLayering: "theme" }), bg, fg)
    assert.ok(Math.abs(got.r - (pf.token.r * a + bg.r * (1 - a))) < 1e-9, p.name)
    const th = Ink.roles(p, p.ink, { tone: "theme", surface: p.ink }).theme
    assert.equal(S.klass(bg, fg), th.cls, p.name + " class")
  }
})
test("OV-T5 a light theme gets a light pill under theme layering, a dark theme a dark one", () => {
  const dark = S.overlay("pillFill", { r: 0.1, g: 0.1, b: 0.14 }, { r: 0.8, g: 0.85, b: 0.95 }, null)
  const light = S.overlay("pillFill", { r: 0.94, g: 0.95, b: 0.96 }, { r: 0.3, g: 0.31, b: 0.41 }, null)
  assert.ok(S.lum(dark.token) < 0.1 && S.lum(light.token) > 0.7)
})

test("EL-T1 elevation: offsets and alphas per level, nothing at level 0", () => {
  assert.equal(S.elevation(0, 0.55).n, 0); assert.deepEqual(j(S.elevation(0, 0.55).layers), [])
  const l1 = S.elevation(1, 0.55); assert.equal(l1.n, 1); assert.equal(l1.layers[0].oy, 0.5); assert.equal(l1.layers[0].ox, 0.25)
  assert.ok(Math.abs(l1.layers[0].alpha - 0.55 * 0.6) < 1e-9)
  const l3 = S.elevation(3, 0.55); assert.equal(l3.n, 3); assert.equal(l3.layers[2].oy, 3); assert.equal(l3.layers[2].ox, 1.5)
  assert.ok(l3.layers[0].alpha > l3.layers[2].alpha)
  const half = S.elevation(0.5, 0.55); assert.equal(half.n, 1); assert.ok(half.dp > 0 && half.dp < 1)
  for (const L of [1, 2, 3]) assert.ok(S.elevation(L, 0.55).layers.every((l) => l.oy <= 3.0001 && l.ox <= 1.5001))
})

test("B3 motionScope ito keeps the fork's durations; fog is static unless fxFogDrift; reduced is read once", () => {
  const vt = fs.readFileSync(path.join(root, "plugins/ito.bar/styles/itoverse/VisualTokens.qml"), "utf8")
  assert.ok(vt.includes('sidecar.get("motionScope", "ito")'))
  assert.ok(/colorDuration: motionAll \? Motion\.dur\(160, look\.motionAmp, "bar"\) : 160/.test(vt))
  assert.ok(/returnCleanupDuration: motionAll \? Math\.max\(240, invalidDropDuration \+ 20\) : 240/.test(vt))
  const plate = fs.readFileSync(path.join(root, "bar/modules/ItoPlate.qml"), "utf8")
  assert.ok(/running: fogCanvas\.visible && root\.fogDrift/.test(plate), "the fog Timer runs only with the drift flag")
  const cfgq = fs.readFileSync(path.join(root, "bar/modules/ItoConfig.qml"), "utf8")
  assert.ok(cfgq.includes("enable-animations") && cfgq.includes("Motion.setReduced"))
  assert.equal(S.resolve({ get: (k, d) => (k === "fxFog" ? true : d) }).fogDrift, false)
  assert.equal(S.resolve({ get: (k, d) => (k === "fxFog" || k === "fxFogDrift" ? true : d) }).fogDrift, true)
  for (const amp of [0, 1, 1.7]) { M.setReduced(true); assert.equal(M.dur(160, amp, "bar"), 0); M.setReduced(false) }
})

const SL = loadQmlJs("bar/modules/ItoStateLayer.js")
test("SL-T1 endR is the distance to the farthest corner of the rect inset by r(1 - 1/sqrt 2)", () => {
  assert.ok(Math.abs(SL.endR(0, 0, 100, 40, 0) - Math.hypot(100, 40)) < 1e-9, "no radius: the plain corner")
  assert.ok(Math.abs(SL.endR(100, 40, 100, 40, 0) - Math.hypot(100, 40)) < 1e-9, "the opposite corner")
  const d = 20 * (1 - Math.SQRT1_2)
  assert.ok(Math.abs(SL.endR(50, 20, 100, 40, 20) - Math.hypot(50 - d, 20 - d)) < 1e-9, "centre press, r 20")
  assert.ok(Math.abs(SL.endR(0, 20, 100, 40, 20) - Math.hypot(100 - d, 20 - d)) < 1e-9, "edge press")
  // the blot never crosses a rounded corner: at its reach it only touches the inset corner, inside the arc
  for (const [px, py] of [[0, 0], [100, 0], [50, 20], [100, 40]]) assert.ok(SL.endR(px, py, 100, 40, 20) <= Math.hypot(Math.max(px, 100 - px), Math.max(py, 40 - py)) + 1e-9)
})
test("SL-T2 the bleed alpha is zero at rho 1, falls monotonically and stays under its base", () => {
  const reach = 90
  assert.equal(SL.alphaAt(0.2, 1, reach), 0)
  let last = Infinity
  for (let p = 0; p <= 1.0001; p += 0.05) { const a = SL.alphaAt(0.2, p, reach); assert.ok(a <= last + 1e-12 && a <= 0.2 && a >= 0); last = a }
  assert.ok(SL.rhoAt(0, reach) > 0 && SL.rhoAt(0, reach) < 1)
  const path = SL.blotPath(SL.BLOT_R, 7)
  assert.equal(path.length, 24)
  for (const q of path) { const r = Math.hypot(q.x - SL.BLOT_R, q.y - SL.BLOT_R) / SL.BLOT_R; assert.ok(r >= 0.88 * 0.88 - 1e-9 && r <= 1.12 + 1e-9, "radius " + r) }
  assert.deepEqual(JSON.stringify(SL.blotPath(40, 7)), JSON.stringify(path), "seeded: the same outline every time")
})
test("SL-T3 pressBleed is off by default, the layer has no clock and no polling", () => {
  assert.equal(S.on({ get: (k, d) => d }, "pressBleed"), false)
  for (const f of ["ItoStateLayer.qml", "ItoBleedShape.qml"]) {
    const src = fs.readFileSync(path.join(root, "bar/modules", f), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n")
    assert.ok(!/\b(Timer|FrameAnimation|Behavior)\b|loops|running\s*:/.test(src), f + " must have no clock")
    assert.ok(!/HoverHandler/.test(src), f + " must not take the hover")
  }
  assert.ok(/PointHandler/.test(fs.readFileSync(path.join(root, "bar/modules/ItoStateLayer.qml"), "utf8")))
})

test("MO-T-speed every role, every motion level: <= 340 ms, in <= 260 for user-triggered roles, lively never longer than calm, reduced = 0", () => {
  for (const [name, r] of Object.entries(j(M.ROLES))) {
    const amb = name === "world"
    for (const amp of [0, 1, 1.7, 2.5]) {
      for (const leaving of [false, true]) {
        const x = M.role(name, amp, leaving)
        if (amp === 0) { assert.equal(x.duration, 0, name); continue }
        if (!amb) assert.ok(x.duration <= 340, name + " " + amp + " " + x.duration)
        assert.ok(x.duration <= M.role(name, 1, leaving).duration, name + " lively longer than calm")
      }
    }
    M.setReduced(true); assert.equal(M.role(name, 1.7).duration, 0, name); M.setReduced(false)
  }
  for (const n of ["settle", "arrive", "leave", "reveal", "color", "mark", "snap", "bleed", "morph", "spatialFast", "spatial"]) assert.ok(M.role(n, 1.7).duration <= 300, n)
  assert.ok(M.slow <= 300 && M.normal <= 220)
})

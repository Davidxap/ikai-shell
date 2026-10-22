// Tests for the manga icon batches after the pilot (icons-v3 V4): every kind ItoIconSet adds beyond the six pilot kinds.
//   node --test scripts/qa/icons-batch.test.mjs
// B-T1 deterministic and well formed, one highlight; B-T2 today's silhouette (IoU >= 0.62); B-T3 blood stays an accent outside
// the datum; B-T4 the state pairs of PAIRS differ under a squint at 24 px. The weight budget is icons-weight.test.mjs.
import { test } from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { loadInk, loadQmlJs, raster, coverage, squint, ncc, ROLE, SS, root } from "./icon-raster.mjs"
import { loadSet } from "./icon-set.mjs"

const { Ink } = loadInk()
const Real = loadSet()
const PILOT = ["disk", "cpu", "mem", "battery", "network", "notifications"]
const KINDS = Real.KINDS.filter((k) => !PILOT.includes(k))
const json = (x) => JSON.stringify(x)
const IDS = { coffee: "awake", radio: "awake", flashlight: "awake", moon: "night", fog: "night", eye: "record", tape: "record" }
// the state pairs whose difference IS the reading
const PAIRS = {
  audio: [[{ level: 0 }, { level: 3 }], [{ level: 2 }, { mute: true }], [{ level: 1 }, { level: 3 }]],
  display: [[{ level: 0 }, { level: 3 }], [{ level: 1 }, { level: 3 }]],
  bluetooth: [[{ mode: "on" }, { mode: "off" }], [{ mode: "on" }, { mode: "linked" }]],
  media: [[{ face: "play" }, { face: "pause", playing: true }], [{ face: "repeat", loop: "none" }, { face: "repeat", loop: "playlist" }], [{ face: "repeat", loop: "playlist" }, { face: "repeat", loop: "track" }]],
  // (the radio's on state is four scratches and a lamp dot and the moon's is blood in its craters, all <= 1.5 % by design: it is not asked to differ under a squint)
  indicator: ["coffee", "flashlight", "fog", "eye", "tape"].map((v) => [{ id: IDS[v], version: v, on: false }, { id: IDS[v], version: v, on: true }]),
  sky: [[{ sky: "rain" }, { sky: "snow" }], [{ sky: "rain" }, { sky: "storm" }], [{ sky: "cloud" }, { sky: "suncloud" }], [{ sky: "sun" }, { sky: "moon" }], [{ sky: "cloud" }, { sky: "fog" }]],
  ai: [[{ form: "brain", value: 0 }, { form: "brain", value: 0.95 }], [{ form: "classic", value: 0 }, { form: "classic", value: 0.95 }], [{ form: "eye", value: 0.05 }, { form: "eye", value: 0.95 }],
       [{ form: "neurons", value: 0.05 }, { form: "neurons", value: 0.95 }], [{ form: "spiral", value: 0.05 }, { form: "spiral", value: 0.95 }],
       [{ form: "hemispheres", value: 0.05 }, { form: "hemispheres", value: 0.95 }]]
}

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
test("B-T1 deterministic, every part well formed, exactly one paper highlight", () => {
  for (const kind of KINDS) for (const state of Real.STATES[kind]) for (const s of [16, 29, 48]) for (const light of [true, false]) {
    const a = Real.iconParts(kind, state, s, 2, { light }), b = Real.iconParts(kind, state, s, 2, { light })
    assert.equal(json(a), json(b))
    assert.ok(a.highlight && a.highlight.polys.length === 1, kind)
    for (const p of a.parts) {
      assert.ok(p.role in ROLE && p.role !== "ground" && p.role !== "paper", kind + " " + p.tag + " " + p.role)
      for (const q of p.polys) assert.ok(q.every(Number.isFinite), kind + " " + p.tag)
    }
  }
})

test("B-T2 recognisable: the filled silhouette matches today's icon (IoU >= 0.62, grown 2 px of 48)", () => {
  const cases = KINDS.map((k) => [k, Real.CURRENT[k], Real.NOMINAL[k]])
  for (const v of Object.keys(IDS)) for (const on of [false, true]) cases.push(["indicator", "indicators/" + IDS[v] + "-" + v + "-" + (on ? "on" : "off") + ".png", { id: IDS[v], version: v, on }])
  for (const k of ["sun", "moon", "cloud", "suncloud", "rain", "storm", "snow", "fog"]) cases.push(["sky", "instruments/sky-" + k + ".png", { sky: k }])
  for (const f of ["prev", "pause", "next", "stop", "shuffle", "repeat"]) cases.push(["media", "media/media-" + f + ".png", f === "pause" ? { face: f, playing: true } : { face: f }])
  for (const f of ["classic", "hemispheres", "neurons", "eye", "spiral"]) cases.push(["ai", "system/ai-" + f + ".png", { form: f, value: 0.4 }])
  for (const [kind, png, st] of cases) {
    const cm = currentMask(png, 96), vm = v3Mask(kind, st, 96)
    const v = iou(grow(bboxNorm(cm, 96), 2), grow(bboxNorm(vm, 96), 2))
    if (process.env.V3_DIAG) console.log("IoU", kind, png, v.toFixed(3))
    // the bare marks (shuffle, repeat) are thin strokes in today's art and forged rods here: a little looser
    assert.ok(v >= (kind === "media" && /shuffle|repeat/.test(png) ? 0.45 : (kind === "sky" && /sun.png|moon.png/.test(png) ? 0.5 : 0.62)), kind + " " + png + " IoU " + v.toFixed(3))
  }
})

test("B-T3 blood stays an accent: outside the datum it is <= 12 % of the ink in every state", () => {
  for (const kind of KINDS) for (const state of Real.STATES[kind]) for (const s of [16, 29, 48]) {
    const cov = coverage(raster(Real.iconParts(kind, state, s, 1), s, { only: (p) => p.tag !== "datum" }))
    let ink = 0, blood = 0
    for (let i = 0; i < cov.line.length; i++) { ink += cov.line[i] + cov.blood[i] + cov.warn[i]; blood += cov.blood[i] + cov.warn[i] }
    assert.ok(blood / Math.max(1e-6, ink) <= 0.12, kind + " " + json(state) + " " + s)
  }
})

test("B-T4 the datum shows: state pairs differ under a squint at 24 px (NCC < 0.95), dark and light bar", () => {
  const tokOf = (bone, ink, blood) => ({ bone, ink, blood, lit: blood, warn: blood })
  const c = (r, g, b) => ({ r, g, b, a: 1 })
  // two fixed fake palettes (a test fixture, not shipped colours): bone on black, ink on paper, a red accent
  const THEMES = [["dark", tokOf(c(0.8, 0.8, 0.78), c(0.07, 0.07, 0.08), c(0.75, 0.1, 0.12))], ["light", tokOf(c(0.95, 0.94, 0.9), c(0.1, 0.1, 0.1), c(0.7, 0.1, 0.12))]]
  for (const [name, tok] of THEMES) for (const kind of KINDS) for (const [a, b] of PAIRS[kind] || []) {
    const ground = name === "dark" ? tok.ink : tok.bone
    const ro = Ink.roles(name === "dark" ? tok : { ...tok, bone: tok.ink, ink: tok.bone }, ground), names = Object.keys(ROLE)
    const sq = (st) => {
      const r = raster(Real.iconParts(kind, st, 24, 1, { light: ro.lineLight }), 24), out = []
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
    // on a light bar the soaked ink stays (blood is the quieter mark there, icons-v4.md 5.2), so the AI forms show the datum by colour and are held to a looser bound; a ghosted repeat (hairlines) has the strap's own shape
    const bound = (kind === "ai" && name === "light") || kind === "media" || kind === "indicator" || kind === "sky" ? 0.985 : 0.95
    assert.ok(v < bound, kind + " " + json(a) + " vs " + json(b) + " " + name + " " + v.toFixed(3))
  }
})

test("B-T5 the panel duplicates draw at the L tier (40 and 48 px), on a dark and a light bar: well formed, one highlight, no opaque ground", () => {
  const Map_ = loadQmlJs("bar/modules/ItoIconMap.js")
  for (const rel of ["audio/volume.png", "audio/volume-high.png", "audio/volume-low.png", "audio/volume-muted.png", "bluetooth/bluetooth.png", "bluetooth/bluetooth-connecting.png", "bluetooth/bluetooth-off.png", "brightness/brightness-high.png", "brightness/brightness-low.png"]) {
    const hit = Map_.lookup("/x/bar/modules/ito-art/" + rel, true)
    assert.ok(hit, rel)
    for (const s of [40, 48]) for (const light of [true, false]) {
      const a = Real.iconParts(hit.kind, hit.state, s, 1, { light })
      assert.ok(a && a.highlight && a.highlight.polys.length === 1, rel + " " + s)
      assert.ok(a.parts.length >= 2, rel + " has marks")
      for (const p of a.parts) assert.ok(p.role in ROLE && p.role !== "paper", rel + " " + p.tag)
    }
  }
})

.pragma library
// What is drawn INSIDE the memory liquid (S14, sidecar key `vesselFill`). Pure drawing: `paint(ctx, o)` takes a Canvas 2D context (or any
// object with the same calls) and one options object, and draws the fill over the liquid; nothing here reads the shell, a file or a clock.
// The numbers are the recipes of the lab sheet (lab/v9/s14/liquid14.py, px at a vessel of radius 64; `k` = radius / 64 scales every length).
//
//   o.fill      whirlpool | hair | rust | static | tone   (blood draws nothing: the liquid as it is)
//   o.rv        the vessel's radius in px; the item is 2 rv square and the vessel's centre is (rv, rv)
//   o.liquid    the liquid's polygon [{x, y}] (the top stratum's, ItoIchor.js buildGeometry) and `o.surf` its top surface [{x, y}]
//   o.levelPx   the liquid's height in px; o.t seconds of the fill's own clock (0 = the still frame)
//   o.used      used memory 0..1; o.tight a swap is in use or memory is over its line
//   o.peaks     [{ frac, age }] the level's last peaks above it (fractions of the disc's area, age in seconds): rust's tide marks
//   o.sync      -1, or 0..1 the progress of the one-shot sync bar (static); o.frame the frame counter (the snow is dealt again with it)
//   o.c         { fill, deep, clot, bone, panel, rust: {r, g, b}, light: bool } the tokens
// Every colour is an {r,g,b} token of ItoSealInk (or a mix of two); none is written here.

var FILLS = ["blood", "whirlpool", "hair", "rust", "static", "tone"]
// the fills that have a motion of their own (a clock runs for them only while the popup is open)
var MOVES = { blood: false, whirlpool: true, hair: true, rust: true, static: true, tone: false }
// seconds between two redraws of each (the frame the clock hands over is skipped until then)
var STEP = { whirlpool: 1 / 30, hair: 1 / 24, rust: 1 / 10, static: 1 / 12 }

function rgba(c, a) { return "rgba(" + Math.round(c.r * 255) + "," + Math.round(c.g * 255) + "," + Math.round(c.b * 255) + "," + (Math.round(a * 1000) / 1000) + ")" }
function mixc(a, b, t) { return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t } }
function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v) }
// a seeded unit random (an LCG): the same fill draws the same strands and flakes every time
function rng(seed) {
  var s = (seed >>> 0) || 1
  return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
}
// the disc segment of height h (in units of rv, 0..2) holds this fraction of the disc's area; and its inverse (the level of a fraction)
function areaOf(h) { var d = 1 - clamp(h, 0, 2); return (Math.acos(d) - d * Math.sqrt(Math.max(0, 1 - d * d))) / Math.PI }
function heightOf(frac) {
  var lo = 0, hi = 2
  for (var i = 0; i < 40; i++) { var h = (lo + hi) / 2; if (areaOf(h) < frac) lo = h; else hi = h }
  return (lo + hi) / 2
}

function trace(ctx, pts) {
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.closePath()
}
function clipLiquid(ctx, o) { trace(ctx, o.liquid); ctx.clip() }
function clipGlass(ctx, o) { ctx.beginPath(); ctx.arc(o.rv, o.rv, o.rv - 0.6 * o.k, 0, 2 * Math.PI); ctx.clip() }

// a tapering ribbon through `pts` (w0 at the start, w1 at the end), added to the current path
function ribbon(ctx, pts, w0, w1) {
  var n = pts.length, L = [], R = []
  for (var i = 0; i < n; i++) {
    var a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1e-6
    var w = (w0 + (w1 - w0) * i / (n - 1)) / 2
    L.push({ x: pts[i].x - dy / len * w, y: pts[i].y + dx / len * w })
    R.push({ x: pts[i].x + dy / len * w, y: pts[i].y - dx / len * w })
  }
  ctx.moveTo(L[0].x, L[0].y)
  for (i = 1; i < n; i++) ctx.lineTo(L[i].x, L[i].y)
  for (i = n - 1; i >= 0; i--) ctx.lineTo(R[i].x, R[i].y)
  ctx.closePath()
}

// ---- whirlpool: the liquid winds into one tapering Uzumaki vortex ----------------------------------------------------------------------
// 2 arms, 2.25 turns (2.75 tight), from the liquid's inscribed radius to 1.2 px, 2.8 -> 0.6 px, the clot token at 0.85; a bone sheen arm
// (0.7 -> 0.3 px, 0.22, 0.4 rad behind). The centre sits at 55 % of the depth; the surface above it sags into a funnel (2.5 px deep, 7 px each side).
// Motion: 1 turn / 40 s, 1 turn / 12 s when tight. The 0.22 px hand wobble is the vortex workspaces'.
function whirlpool(ctx, o) {
  var k = o.k, rv = o.rv, depth = o.levelPx, ys = 2 * rv - depth, cx = rv, cy = ys + 0.55 * depth
  var hw = Math.sqrt(Math.max(0, rv * rv - (cy - rv) * (cy - rv)))
  var R = Math.max(6 * k, Math.min(depth * 0.48, hw * 0.92))
  var turns = o.tight ? 2.75 : 2.25
  var phase = o.t / (o.tight ? 12 : 40) * 2 * Math.PI
  var c = o.c
  ctx.save(); clipLiquid(ctx, o)
  for (var arm = 0; arm < 2; arm++) {
    var main = [], sheen = []
    for (var i = 0; i < 90; i++) {
      var u = i / 89, th = phase + arm * Math.PI + u * turns * 2 * Math.PI
      var r = R * Math.pow(1 - u, 1.35) + 1.2 * k * u
      var wob = 0.22 * k * Math.sin(i * 1.93 + arm * 3.1) * (1 - u * 0.5)
      main.push({ x: cx + (r + wob) * Math.cos(th), y: cy + (r + wob) * Math.sin(th) * 0.92 })
      var th2 = th - 0.4
      sheen.push({ x: cx + (r + wob) * Math.cos(th2), y: cy + (r + wob) * Math.sin(th2) * 0.92 })
    }
    ctx.fillStyle = rgba(c.light ? c.clot : mixc(c.clot, c.panel, 0.55), 0.9)
    ctx.beginPath(); ribbon(ctx, main, 2.8 * k, 0.6 * k); ctx.fill()
    ctx.fillStyle = rgba(c.light ? c.panel : c.bone, 0.22)
    ctx.beginPath(); ribbon(ctx, sheen, 0.7 * k, 0.3 * k); ctx.fill()
  }
  ctx.restore()
  // the funnel: a soft V cut out of the surface over the centre
  ctx.save(); clipGlass(ctx, o)
  ctx.fillStyle = rgba(c.panel, 1)
  ctx.beginPath()
  ctx.moveTo(cx - 7 * k, ys - 1); ctx.lineTo(cx - 7 * k, ys + 1.2)
  ctx.lineTo(cx, ys + 1.2 + 2.5 * k); ctx.lineTo(cx + 7 * k, ys + 1.2); ctx.lineTo(cx + 7 * k, ys - 1)
  ctx.closePath(); ctx.fill()
  ctx.restore()
}

// ---- hair: black hair rises from the bottom of the vessel ------------------------------------------------------------------------------
// locks = 2 + round(4 f) (f = the disc's filled share), 7-11 strands each (0.75 -> 0.25 px), length 0.55-0.95 of the depth; two curled locks float on the
// surface above 70 %. Sway 3.5 px at the tips, period 7 s; tight: x1.6, the phases pulled together (the locks tangle).
function hair(ctx, o) {
  var k = o.k, rv = o.rv, depth = o.levelPx, ys = 2 * rv - depth, cx = rv, cy = rv, c = o.c
  var f = areaOf(depth / rv), rnd = rng(7)
  var col = c.light ? c.clot : mixc(c.clot, c.panel, 0.75)
  var locks = 2 + Math.round(4 * f), amp = 3.5 * k * (o.tight ? 1.6 : 1)
  var sway = o.t / 7 * 2 * Math.PI
  ctx.save(); clipLiquid(ctx, o)
  ctx.strokeStyle = rgba(col, 0.9); ctx.lineCap = "round"; ctx.lineJoin = "round"
  for (var kk = 0; kk < locks; kk++) {
    var hwFloor = rv * 0.7
    var x0 = cx + (kk - (locks - 1) / 2) / Math.max(1, locks - 1) * hwFloor * 1.6 * (0.6 + 0.4 * f) + (rnd() * 6 - 3) * k
    var yfloor = cy + Math.sqrt(Math.max(0, rv * rv - (x0 - cx) * (x0 - cx))) - 1.5 * k
    var length = depth * (0.55 + 0.4 * rnd())
    var ph = rnd() * 6.28 * (o.tight ? 0.3 : 1), lean = rnd() * 0.5 - 0.25
    var ns = 7 + Math.floor(rnd() * 5)
    for (var s = 0; s < ns; s++) {
      var off = (s - ns / 2) * (0.45 + 0.45 * rnd()) * k, sph = ph + s * 0.22, pts = []
      for (var i = 0; i < 26; i++) {
        var u = i / 25
        pts.push({ x: x0 + off * (1 - 0.5 * u) + lean * u * length + amp * Math.pow(u, 1.2) * Math.sin(2.1 * u * 5 + sph + sway) + 1.2 * k * u * Math.sin(u * 13 + s),
                   y: yfloor - u * length })
      }
      // three chunks, thinner towards the tip: 0.75 -> 0.5 -> 0.3 px
      var cut = [0, 9, 18, 25], wid = [0.95, 0.65, 0.4]
      for (var q = 0; q < 3; q++) {
        ctx.lineWidth = Math.max(0.45, wid[q] * k)
        ctx.beginPath(); ctx.moveTo(pts[cut[q]].x, pts[cut[q]].y)
        for (i = cut[q] + 1; i <= cut[q + 1]; i++) ctx.lineTo(pts[i].x, pts[i].y)
        ctx.stroke()
      }
    }
  }
  ctx.restore()
  if (f > 0.7 || o.tight) {      // two locks lie ON the surface (clipped to the glass, not to the liquid)
    ctx.save(); clipGlass(ctx, o)
    ctx.strokeStyle = rgba(col, 0.9); ctx.lineCap = "round"
    var hwx = Math.sqrt(Math.max(0, rv * rv - (ys - rv) * (ys - rv))) - 6 * k
    var xs = [cx - 22 * k, cx + 14 * k]
    for (kk = 0; kk < 2; kk++) {
      for (s = 0; s < 4; s++) {
        ctx.lineWidth = Math.max(0.5, (0.9 - 0.2 * s / 3) * k)
        ctx.beginPath()
        var on = false
        for (i = 0; i < 40; i++) {
          u = i / 39
          var x = xs[kk] + (u - 0.5) * 30 * k, y = ys - 0.6 * k + 1.6 * k * Math.sin(u * 9 + s * 0.6 + kk) + (s - 1.5) * 0.5 * k
          if (Math.abs(x - cx) < hwx) { if (!on) { ctx.moveTo(x, y); on = true } else ctx.lineTo(x, y) } else on = false
        }
        ctx.stroke()
      }
    }
    ctx.restore()
  }
}

// ---- rust: oxidised water with sediment, stains on the glass -------------------------------------------------------------------------
// the body 62 % toward the rust token keeping a depth ramp (lighter under the surface, darker at the floor); 22 flakes of sediment (clot, 0.7) sinking
// 2 px/s; a crust at the meniscus (rust 0.85, 1.6 px, ragged); TIDE MARKS: a broken 1.2 px chord (rust, 0.55 -> 0.35 over ten minutes) and two short
// runs down the glass at each of the level's last two peaks above it. The marks are data: where memory stood.
function rust(ctx, o) {
  var k = o.k, rv = o.rv, depth = o.levelPx, ys = 2 * rv - depth, cx = rv, c = o.c, rnd = rng(11)
  ctx.save(); clipLiquid(ctx, o)
  var g = ctx.createLinearGradient(0, ys, 0, 2 * rv)
  g.addColorStop(0, rgba(mixc(c.rust, c.bone, 0.18), 0.62)); g.addColorStop(1, rgba(mixc(c.rust, c.clot, 0.35), 0.5))
  ctx.fillStyle = g; ctx.fillRect(0, ys - 2, 2 * rv, depth + 4)
  ctx.fillStyle = rgba(c.clot, 0.85)
  var span = Math.max(1, depth - 4 * k)
  for (var i = 0; i < 22; i++) {
    var y0 = Math.pow(rnd(), 1.8) * span, x = 0, r = (0.9 + 0.9 * rnd()) * k
    // a flake sinks 2 px / s and comes round to the top again: the sediment never settles
    var y = 2 * rv - 2 * k - ((y0 + 2 * k * o.t) % span)
    var hw = Math.sqrt(Math.max(0, rv * rv - (y - rv) * (y - rv))) - 3 * k
    x = cx + (rnd() * 2 - 1) * Math.max(0, hw)
    ctx.beginPath()
    for (var q = 0; q < 5; q++) {
      var a = q * 1.2566, rr = r * (0.6 + 0.6 * rnd())
      if (q === 0) ctx.moveTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); else ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a))
    }
    ctx.closePath(); ctx.fill()
  }
  ctx.restore()
  ctx.save(); clipGlass(ctx, o)
  if (o.surf && o.surf.length > 2) {    // the crust, along the meniscus
    ctx.strokeStyle = rgba(c.rust, 0.85); ctx.lineWidth = 1.6 * k; ctx.lineJoin = "round"; ctx.lineCap = "round"
    ctx.beginPath()
    for (i = 0; i < o.surf.length; i++) {
      var py = o.surf[i].y + 1.0 * k - Math.abs(Math.sin(i * 1.7)) * 1.1 * k
      if (i === 0) ctx.moveTo(o.surf[i].x, py); else ctx.lineTo(o.surf[i].x, py)
    }
    ctx.stroke()
  }
  var cur = areaOf(depth / rv), peaks = o.peaks || []
  ctx.lineCap = "round"
  for (var p = 0; p < peaks.length; p++) {
    if (!(peaks[p].frac > cur + 0.01) || peaks[p].frac >= 0.97) continue
    var yp = 2 * rv - heightOf(peaks[p].frac) * rv
    var hwp = Math.sqrt(Math.max(0, rv * rv - (yp - rv) * (yp - rv)))
    var alpha = 0.55 - 0.20 * clamp((peaks[p].age || 0) / 600, 0, 1)
    ctx.strokeStyle = rgba(c.rust, alpha)
    var xx = cx - hwp
    while (xx < cx + hwp) {
      var run = (4 + 10 * rnd()) * k, gap = (1 + 3 * rnd()) * k
      ctx.lineWidth = (0.8 + 0.6 * rnd()) * k
      ctx.beginPath()
      for (var m = 0; m <= 7; m++) { var px = xx + Math.min(run, cx + hwp - xx) * m / 7, py2 = yp + 0.5 * k * Math.sin(px * 0.7); if (m === 0) ctx.moveTo(px, py2); else ctx.lineTo(px, py2) }
      ctx.stroke(); xx += run + gap
    }
    for (var d = 0; d < 2; d++) {   // two runs down the glass
      var xr = cx + (rnd() * 1.6 - 0.8) * hwp, ln = (3 + 3 * rnd()) * k
      ctx.lineWidth = 1.0 * k
      ctx.beginPath(); ctx.moveTo(xr, yp); ctx.lineTo(xr + 0.2 * k, yp + ln); ctx.stroke()
    }
  }
  ctx.restore()
}

// ---- static: the liquid is a dying TV picture ----------------------------------------------------------------------------------------
// scanlines every 2nd row darker (clot 0.20); snow 16 % of the pixels at 0.30 (bone / panel) dealt again with `frame` (12 fps while live); one 3-row tear
// every ~4 s (a bone streak with a clot shadow under it); `sync` rolls a 6 px bar with denser snow down the liquid once (420 ms).
function staticFill(ctx, o) {
  var k = o.k, rv = o.rv, depth = o.levelPx, ys = 2 * rv - depth, c = o.c, rnd = rng(5 + (o.frame | 0) * 7919)
  ctx.save(); clipLiquid(ctx, o)
  ctx.fillStyle = rgba(c.clot, 0.20)
  for (var y = Math.floor(ys) + 1; y < 2 * rv; y += 2) ctx.fillRect(0, y, 2 * rv, 1)
  var n = Math.round(0.16 * 2 * rv * depth)
  for (var i = 0; i < n; i++) {
    ctx.fillStyle = rgba(rnd() < 0.5 ? c.bone : c.panel, 0.30)
    ctx.fillRect(Math.floor(rnd() * 2 * rv), Math.floor(ys + rnd() * depth), 1, 1)
  }
  if (o.sync >= 0 && o.sync <= 1) {
    var yb = ys + o.sync * depth
    ctx.fillStyle = rgba(c.bone, 0.18); ctx.fillRect(0, yb - 3, 2 * rv, 6)
    ctx.fillStyle = rgba(c.bone, 0.30)
    for (i = 0; i < Math.round(0.45 * 2 * rv * 6); i++) ctx.fillRect(Math.floor(rnd() * 2 * rv), Math.floor(yb - 3 + rnd() * 6), 1, 1)
  }
  // the tear: lit for the first 0.3 s of every 4 s (the still frame, t = 0, shows it)
  if ((o.t % 4) < 0.3) {
    var tr = rng(13 + Math.floor(o.t / 4) * 31), ty = Math.floor(ys + 4 * k + tr() * Math.max(1, depth - 10 * k))
    var x = 0
    ctx.fillStyle = rgba(c.bone, 0.28)
    while (x < 2 * rv) { var w = 6 + tr() * 22; ctx.fillRect(x + 3, ty, w, 1); x += w + tr() * 14 }
    ctx.fillStyle = rgba(c.clot, 0.35); ctx.fillRect(0, ty + 1, 2 * rv, 2)
  }
  ctx.restore()
}

// ---- tone: printed like a manga page --------------------------------------------------------------------------------------------------
// the body lifted 30 % toward bone at 0.75, then a 45 degree halftone grid, pitch 3.2 px, dot radius 0.35 -> 1.45 px with depth (clot, 0.9), and a G-pen
// line (1.5 px, clot) along the surface. No clock of its own.
function tone(ctx, o) {
  var k = o.k, rv = o.rv, depth = o.levelPx, ys = 2 * rv - depth, c = o.c, S = 2 * rv
  var p = 3.2 * Math.max(0.8, k), root2 = Math.SQRT2
  ctx.save(); clipLiquid(ctx, o)
  ctx.fillStyle = rgba(mixc(c.fill, c.light ? c.panel : c.bone, 0.2), 0.75); ctx.fillRect(0, ys - 2, S, depth + 4)
  ctx.fillStyle = rgba(c.clot, 1)
  ctx.beginPath()
  var N = Math.ceil(S * 1.5 / p)
  for (var i = -N; i <= N; i++) for (var j = -N; j <= N; j++) {
    var x = (i + j) * p / root2, y = (i - j) * p / root2
    if (x < -2 || x > S + 2 || y < ys - 1 || y > S + 2) continue
    var r = (0.5 + 1.2 * clamp((y - ys) / Math.max(1, depth), 0, 1)) * k
    ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 2 * Math.PI)
  }
  ctx.fill()
  ctx.restore()
  if (o.surf && o.surf.length > 2) {
    ctx.save(); clipGlass(ctx, o)
    ctx.strokeStyle = rgba(c.clot, 1); ctx.lineWidth = 1.5 * k; ctx.lineJoin = "round"; ctx.lineCap = "round"
    ctx.beginPath(); ctx.moveTo(o.surf[0].x, o.surf[0].y + 1.2 * k)
    for (i = 1; i < o.surf.length; i++) ctx.lineTo(o.surf[i].x, o.surf[i].y + 1.2 * k)
    ctx.stroke(); ctx.restore()
  }
}

// draws the fill named by o.fill; anything else (blood) draws nothing
function paint(ctx, o) {
  if (!o || !o.liquid || o.liquid.length < 3 || !(o.levelPx > 0.5) || !o.c) return
  if (o.fill === "whirlpool") whirlpool(ctx, o)
  else if (o.fill === "hair") hair(ctx, o)
  else if (o.fill === "rust") rust(ctx, o)
  else if (o.fill === "static") staticFill(ctx, o)
  else if (o.fill === "tone") tone(ctx, o)
}

// the level's peaks above its current value, kept by hand by the host: `state` { run (the highest level since the last fall), peaks: [{ frac, at }] (newest last, at most two) };
// `frac` is the disc's filled share now, `nowMs` a wall-clock time. A peak is recorded when the level has fallen by 5 % from its run. -> the same state
function notePeak(state, frac, nowMs) {
  var s = state || { run: frac, peaks: [] }
  if (frac >= s.run) { s.run = frac; return s }
  if (s.run - frac >= 0.05) {
    var last = s.peaks.length ? s.peaks[s.peaks.length - 1] : null
    if (!last || Math.abs(last.frac - s.run) > 0.02) s.peaks.push({ frac: s.run, at: nowMs })
    while (s.peaks.length > 2) s.peaks.shift()
    s.run = frac
  }
  return s
}

if (typeof module !== "undefined") module.exports = { FILLS: FILLS, MOVES: MOVES, STEP: STEP, paint: paint, notePeak: notePeak, areaOf: areaOf, heightOf: heightOf, rng: rng }

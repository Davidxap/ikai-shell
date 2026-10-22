import QtQuick
import "ItoInk.js" as Ink

// A live data glyph. The value is carried by the SHAPE, not by letters:
//
//   cpu   Uzumaki spiral      its turns tighten and its outer end bleeds as load climbs
//   mem   Tomie's eye         opens wider and reddens with veins as memory fills
//   disk  Amigara's figure    the human-shaped hole; blood rises in it as the disk fills
//   net   signal arcs         one arc per band of signal; a bloody slash when offline
//   vol   speaker             one wave per band of volume; a bloody slash when muted
//   sun   brightness          eight rays, lit in proportion; the rest stay dim
//   sky   weather              sun, moon, cloud, rain, storm, snow, fog - inked in the same hand
//   bluetooth  the rune; slashed when off, blood beads when something is connected
//   battery    a cell with blood standing in it to the charge
//   jar   tray                a specimen jar; what is still running is kept in it
//   brain AI usage            a brain with one hemisphere wound into a spiral, filling with blood as the quota is used
//
// `value` is 0..1. For net and vol, -1 means offline / muted.
//
// Colours come in as properties so the component depends on nothing from the shell:
// the plugin that hosts it feeds it the theme, and the lab that previews it feeds it
// the palette under test. It is drawn on a 30-unit grid and scaled to `size`, so one
// design serves every bar height.
Canvas {
  id: root

  property string kind: "cpu"
  property real value: 0            // 0..1
  property int size: 28
  property int seed: 1
  property bool active: false       // a second state: connected, charging
  property color bone: "#c7ccd1"
  property color blood: "#c4162a"
  property color ink: "#14181b"
  property real boneAlpha: 0.88

  width: size
  height: size
  antialiasing: true

  onValueChanged: requestPaint()
  onActiveChanged: requestPaint()
  onKindChanged: requestPaint()
  onSizeChanged: requestPaint()
  onBoneChanged: requestPaint()
  onBloodChanged: requestPaint()
  onBoneAlphaChanged: requestPaint()
  Component.onCompleted: requestPaint()

  function clamp(x) { return Math.max(0, Math.min(1, x)) }
  function boneInk() { return Qt.rgba(bone.r, bone.g, bone.b, boneAlpha) }

  // ------------------------------------------------------------------ cpu
  function paintSpiral(ctx) {
    var v = clamp(value)
    var turns = 2.3 + v * 2.1
    var body = Ink.spiralPts(15, 15, 13.2, turns, 200, 0.03, 1)
    Ink.inkPath(ctx, body, boneInk(), 1.5, seed, 0.26)

    // The outer end bleeds first and furthest as the load climbs.
    var from = 1 - (0.1 + 0.6 * v)
    var tail = Ink.spiralPts(15, 15, 13.2, turns, 130, from, 1)
    Ink.inkPath(ctx, tail, blood, 1.95, seed + 3, 0.22, false)

    if (v > 0.5) Ink.inkDot(ctx, 15, 15, 1.1 + (v - 0.5) * 2.4, blood, seed)
  }

  // ------------------------------------------------------------------ mem
  function paintEye(ctx) {
    var v = clamp(value)
    var h = 9 * (0.66 + 0.34 * v)        // lid half-height: heavy-lidded when idle, wide when full
    var L = { x: 2.2, y: 15 }, R = { x: 27.8, y: 15 }
    var up = Ink.quadPts(L, { x: 15, y: 15 - h * 2.0 }, R, 32)
    var dn = Ink.quadPts(L, { x: 15, y: 15 + h * 1.5 }, R, 32)

    ctx.save()
    ctx.beginPath()
    ctx.moveTo(up[0].x, up[0].y)
    for (var i = 1; i < up.length; i++) ctx.lineTo(up[i].x, up[i].y)
    for (var j = dn.length - 1; j >= 0; j--) ctx.lineTo(dn[j].x, dn[j].y)
    ctx.closePath()
    ctx.clip()

    // iris: a toned disc with radial hatching, then the pupil
    ctx.beginPath()
    ctx.arc(15, 15, 5.6, 0, Math.PI * 2)
    ctx.fillStyle = Ink.mix(ink, bone, 0.14)
    ctx.fill()
    for (var k = 0; k < 16; k++) {
      var a = (k / 16) * Math.PI * 2
      var pts = [{ x: 15 + Math.cos(a) * 2.9, y: 15 + Math.sin(a) * 2.9 },
                 { x: 15 + Math.cos(a) * 5.3, y: 15 + Math.sin(a) * 5.3 }]
      Ink.inkPath(ctx, pts, Ink.withAlpha(bone, 0.5), 0.7, seed + k, 0.1, false)
    }
    Ink.inkPath(ctx, Ink.arcPts(15, 15, 5.6, 0, Math.PI * 2, 36), boneInk(), 1.1, seed + 40, 0.15, false)
    Ink.inkDot(ctx, 15, 15, 2.5 + v * 0.5, "#05080a", seed)
    Ink.inkDot(ctx, 13.4, 13.4, 0.8, Ink.withAlpha(bone, 0.9), seed + 2)

    // blood veins creep in from the corners once memory is under real pressure
    var veins = v > 0.4 ? Math.round((v - 0.4) / 0.6 * 8) : 0
    var angles = [Math.PI, 0, 0.82 * Math.PI, 0.18 * Math.PI, 1.18 * Math.PI, -0.18 * Math.PI,
                  0.66 * Math.PI, 0.34 * Math.PI]
    for (var n = 0; n < veins; n++) {
      var t = angles[n]
      var vein = [{ x: 15 + Math.cos(t) * 5.7, y: 15 + Math.sin(t) * 5.7 },
                  { x: 15 + Math.cos(t + 0.06) * 8.6, y: 15 + Math.sin(t + 0.06) * 8.6 },
                  { x: 15 + Math.cos(t - 0.05) * 11.8, y: 15 + Math.sin(t - 0.05) * 11.8 }]
      Ink.inkPath(ctx, vein, blood, 1.0, seed + 60 + n, 0.3, false)
    }
    ctx.restore()

    Ink.inkPath(ctx, up, boneInk(), 1.5, seed, 0.24)
    Ink.inkPath(ctx, dn, boneInk(), 1.3, seed + 1, 0.24)

    // lashes along the upper lid
    var lashAt = [0.2, 0.34, 0.5, 0.66, 0.8]
    for (var m = 0; m < lashAt.length; m++) {
      var p = up[Math.round(lashAt[m] * (up.length - 1))]
      var dx = (p.x - 15) / 12
      var lash = [{ x: p.x, y: p.y }, { x: p.x + dx * 1.6, y: p.y - 2.4 }]
      Ink.inkPath(ctx, lash, Ink.withAlpha(bone, 0.7), 0.8, seed + 80 + m, 0.1, false)
    }
  }

  // ----------------------------------------------------------------- disk
  function figurePts() {
    // head, then body; each closed by repeating the first point
    var head = Ink.arcPts(15, 6.3, 3.4, 0, Math.PI * 2, 24)
    var body = [
      { x: 9.4, y: 12.8 }, { x: 10.4, y: 11.2 }, { x: 12.4, y: 10.5 }, { x: 17.6, y: 10.5 },
      { x: 19.6, y: 11.2 }, { x: 20.6, y: 12.8 }, { x: 21.6, y: 19.8 }, { x: 19.4, y: 20.1 },
      { x: 19.0, y: 27.6 }, { x: 15.9, y: 27.6 }, { x: 15, y: 21.6 }, { x: 14.1, y: 27.6 },
      { x: 11.0, y: 27.6 }, { x: 10.6, y: 20.1 }, { x: 8.4, y: 19.8 }, { x: 9.4, y: 12.8 }
    ]
    return { head: head, body: body }
  }

  function tracePath(ctx, fig) {
    ctx.beginPath()
    ctx.moveTo(fig.head[0].x, fig.head[0].y)
    for (var i = 1; i < fig.head.length; i++) ctx.lineTo(fig.head[i].x, fig.head[i].y)
    ctx.closePath()
    ctx.moveTo(fig.body[0].x, fig.body[0].y)
    for (var j = 1; j < fig.body.length; j++) ctx.lineTo(fig.body[j].x, fig.body[j].y)
    ctx.closePath()
  }

  function paintFigure(ctx) {
    var v = clamp(value)
    var fig = figurePts()

    ctx.save()
    tracePath(ctx, fig)
    ctx.clip()
    ctx.fillStyle = Ink.mix(ink, bone, 0.05)
    ctx.fillRect(0, 0, 30, 30)

    // the level: a surface with a small ripple, lit at the top edge
    var top = 28.2 - v * (28.2 - 3.0)
    ctx.beginPath()
    ctx.moveTo(0, 30)
    ctx.lineTo(0, top)
    for (var x = 0; x <= 30; x += 1) ctx.lineTo(x, top + Math.sin(x * 1.1 + seed) * 0.55)
    ctx.lineTo(30, 30)
    ctx.closePath()
    ctx.fillStyle = Ink.mix(blood, ink, 0.35)
    ctx.fill()
    Ink.inkPath(ctx, [{ x: 0, y: top }, { x: 30, y: top }], blood, 1.1, seed, 0.3, false)
    ctx.restore()

    Ink.inkPath(ctx, fig.head.concat([fig.head[0]]), boneInk(), 1.35, seed, 0.2)
    Ink.inkPath(ctx, fig.body, boneInk(), 1.35, seed + 2, 0.2)
  }


  // ------------------------------------------------------------------ net
  function slash(ctx) {
    Ink.inkPath(ctx, [{ x: 5, y: 5.5 }, { x: 25, y: 25.5 }], blood, 1.9, seed + 9, 0.2, false)
  }

  function paintNet(ctx) {
    var off = value < 0
    var lit = off ? 0 : Math.max(1, Math.ceil(clamp(value) * 3 - 0.001))
    var radii = [6.5, 12.2, 17.8]
    for (var i = 0; i < 3; i++) {
      var pts = Ink.arcPts(15, 24, radii[i], 1.25 * Math.PI, 1.75 * Math.PI, 22)
      var on = i < lit
      Ink.inkPath(ctx, pts, on ? boneInk() : Ink.withAlpha(bone, 0.2), on ? 1.7 : 1.2, seed + i, 0.2, on)
    }
    Ink.inkDot(ctx, 15, 23.6, 1.8, off ? Ink.withAlpha(bone, 0.3) : boneInk(), seed)
    if (off) slash(ctx)
  }

  // ------------------------------------------------------------------ vol
  function paintSpeaker(ctx) {
    var muted = value < 0
    var lit = muted ? 0 : Math.max(1, Math.ceil(clamp(value) * 2 - 0.001))
    var body = [{ x: 3.5, y: 11.6 }, { x: 8.6, y: 11.6 }, { x: 14.6, y: 6.6 }, { x: 14.6, y: 23.4 },
                { x: 8.6, y: 18.4 }, { x: 3.5, y: 18.4 }, { x: 3.5, y: 11.6 }]
    Ink.inkPath(ctx, body, muted ? Ink.withAlpha(bone, 0.45) : boneInk(), 1.5, seed, 0.2)
    var radii = [6.2, 10.6]
    for (var i = 0; i < 2; i++) {
      var pts = Ink.arcPts(15.6, 15, radii[i], -0.72, 0.72, 16)
      var on = i < lit
      Ink.inkPath(ctx, pts, on ? boneInk() : Ink.withAlpha(bone, 0.2), on ? 1.6 : 1.2, seed + 3 + i, 0.2, on)
    }
    if (muted) slash(ctx)
  }

  // ------------------------------------------------------------------ sun
  function paintSun(ctx) {
    var lit = Math.max(1, Math.round(clamp(value) * 8))
    Ink.inkPath(ctx, Ink.arcPts(15, 15, 4.5, 0, Math.PI * 2, 30), boneInk(), 1.5, seed, 0.18)
    for (var k = 0; k < 8; k++) {
      var a = k * Math.PI / 4 - Math.PI / 2
      var inner = 7.6, outer = k % 2 === 0 ? 12.4 : 11.0
      var ray = [{ x: 15 + Math.cos(a) * inner, y: 15 + Math.sin(a) * inner },
                 { x: 15 + Math.cos(a) * outer, y: 15 + Math.sin(a) * outer }]
      var on = k < lit
      Ink.inkPath(ctx, ray, on ? boneInk() : Ink.withAlpha(bone, 0.2), on ? 1.5 : 1.1, seed + 20 + k, 0.15, false)
    }
  }


  // ------------------------------------------------------------ bluetooth
  // The rune: one spine with two folded barbs. `value` -1 is off (slashed), 0 is on and alone, and
  // `active` means something is connected: the barbs fill in and two blood beads sit either side.
  function paintBluetooth(ctx) {
    var off = value < 0
    var line = off ? Ink.withAlpha(bone, 0.35) : boneInk()
    var rune = [{ x: 10.2, y: 10.4 }, { x: 19.6, y: 19.6 }, { x: 15.0, y: 24.2 }, { x: 15.0, y: 5.8 },
                { x: 19.6, y: 10.4 }, { x: 10.2, y: 19.6 }]
    Ink.inkPath(ctx, rune, line, 1.6, seed, 0.18)
    if (active && !off) {
      Ink.inkDot(ctx, 6.2, 15, 1.5, blood, seed)
      Ink.inkDot(ctx, 23.8, 15, 1.5, blood, seed + 1)
    }
    if (off) slash(ctx)
  }

  // ------------------------------------------------------------- battery
  // A cell on its side: the body, the nub, and blood standing in it to the charge. Under a fifth it is
  // all blood and the outline turns to it too; `active` (charging) draws the bolt across it.
  function paintBattery(ctx) {
    var v = clamp(value)
    var left = 4.4, right = 24.4, top = 9.4, bottom = 20.6
    var low = v < 0.2
    var body = [{ x: left + 2, y: top }, { x: right - 2, y: top }, { x: right, y: top + 2 },
                { x: right, y: bottom - 2 }, { x: right - 2, y: bottom }, { x: left + 2, y: bottom },
                { x: left, y: bottom - 2 }, { x: left, y: top + 2 }, { x: left + 2, y: top }]
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(body[0].x, body[0].y)
    for (var i = 1; i < body.length; i++) ctx.lineTo(body[i].x, body[i].y)
    ctx.closePath()
    ctx.clip()
    ctx.fillStyle = Ink.mix(low ? blood : ink, ink, low ? 0.3 : 0)
    ctx.fillRect(left, top, right - left, bottom - top)
    ctx.fillStyle = Ink.mix(blood, ink, low ? 0.15 : 0.5)
    ctx.fillRect(left, top, (right - left) * v, bottom - top)
    ctx.restore()
    Ink.inkPath(ctx, body, low ? blood : boneInk(), 1.6, seed, 0.16)
    Ink.inkPath(ctx, [{ x: right + 1.8, y: 12.2 }, { x: right + 1.8, y: 17.8 }], boneInk(), 2.0, seed + 2, 0.1, false)
    if (active) {
      var bolt = [{ x: 15.6, y: 7.6 }, { x: 11.4, y: 15.2 }, { x: 14.6, y: 15.2 },
                  { x: 12.6, y: 22.6 }, { x: 18.4, y: 13.6 }, { x: 15.0, y: 13.6 }, { x: 15.6, y: 7.6 }]
      Ink.inkPath(ctx, bolt, boneInk(), 1.3, seed + 4, 0.1)
    }
  }

  // ------------------------------------------------------------------ jar
  // The tray: a specimen jar. Ito keeps what he cannot kill in one, and that is what a tray is - the
  // things still running that you put away. Something is curled inside it, and the fluid line rises
  // with `value`, which the tray feeds from how many items it holds.
  function paintJar(ctx) {
    // The jar's box is tall and narrow, so at full size it towers over the round and wide glyphs beside it.
    // Drawn at four fifths, its weight matches them.
    ctx.save()
    ctx.translate(15, 15.5)
    ctx.scale(0.8, 0.8)
    ctx.translate(-15, -15)
    var v = clamp(value)
    var left = 7.6, right = 22.4, top = 7.4, bottom = 25.6

    // the lid, a flat band with a lip
    Ink.inkPath(ctx, [{ x: left - 1.2, y: 4.6 }, { x: right + 1.2, y: 4.6 }], boneInk(), 1.7, seed, 0.14, false)
    Ink.inkPath(ctx, [{ x: left - 1.2, y: 4.6 }, { x: left - 1.2, y: 7.0 },
                      { x: right + 1.2, y: 7.0 }, { x: right + 1.2, y: 4.6 }],
                boneInk(), 1.4, seed + 1, 0.12, false)

    // the body: straight sides, a rounded base
    var body = [{ x: left, y: top }, { x: left, y: bottom - 2.6 }]
    var base = Ink.arcPts(15, bottom - 2.6, 7.4, Math.PI * 0.02, Math.PI * 0.98, 20)
    for (var i = 0; i < base.length; i++) body.push(base[i])
    body.push({ x: right, y: bottom - 2.6 })
    body.push({ x: right, y: top })
    Ink.inkPath(ctx, body, boneInk(), 1.7, seed + 2, 0.18)

    // the fluid, and what is curled in it
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(left, top)
    ctx.lineTo(left, bottom - 2.6)
    for (var j = 0; j < base.length; j++) ctx.lineTo(base[j].x, base[j].y)
    ctx.lineTo(right, top)
    ctx.closePath()
    ctx.clip()
    var line = (bottom - 1) - v * (bottom - 1 - (top + 2.2))
    ctx.fillStyle = Ink.mix(blood, ink, 0.55)
    ctx.fillRect(0, line, 30, 30)
    Ink.inkPath(ctx, [{ x: left - 1, y: line }, { x: right + 1, y: line }], blood, 1.2, seed + 3, 0.3, false)
    ctx.restore()

    Ink.inkPath(ctx, Ink.spiralPts(15, 17.0, 4.4, 1.9, 70, 0.08, 1),
                Ink.withAlpha(bone, 0.72), 1.15, seed + 5, 0.12, false)
    ctx.restore()
  }

  // -------------------------------------------------------------- weather
  // The sky, drawn in the same hand as the instruments. `value` is unused here: the WEATHER picks
  // the kind, and the only red on these is what is falling out of the cloud in a storm.

  // A cloud as three overlapping swells plus a flat base, traced as one outline so the ink closes.
  function cloudPts(cx, cy, scale) {
    var pts = []
    var lobes = [{ x: -6.2, y: 0.4, r: 4.0 }, { x: -1.2, y: -2.2, r: 5.2 }, { x: 4.6, y: 0.2, r: 4.2 }]
    for (var i = 0; i < lobes.length; i++) {
      var l = lobes[i]
      var from = i === 0 ? Math.PI : Math.PI * 1.12
      var to = i === lobes.length - 1 ? Math.PI * 2 : Math.PI * 1.92
      var arc = Ink.arcPts(cx + l.x * scale, cy + l.y * scale, l.r * scale, from, to, 18)
      for (var j = 0; j < arc.length; j++) pts.push(arc[j])
    }
    pts.push({ x: cx + 8.4 * scale, y: cy + 4.4 * scale })
    pts.push({ x: cx - 8.0 * scale, y: cy + 4.4 * scale })
    pts.push(pts[0])
    return pts
  }

  function paintCloud(ctx) {
    Ink.inkPath(ctx, cloudPts(15, 14.4, 1.18), boneInk(), 1.6, seed, 0.2)
  }

  function paintSunCloud(ctx) {
    Ink.inkPath(ctx, Ink.arcPts(20.4, 9.0, 3.4, 0, Math.PI * 2, 24), Ink.withAlpha(bone, 0.75), 1.3, seed + 1, 0.16, false)
    for (var k = 0; k < 6; k++) {
      var a = k * Math.PI / 3
      var ray = [{ x: 20.4 + Math.cos(a) * 4.8, y: 9.0 + Math.sin(a) * 4.8 },
                 { x: 20.4 + Math.cos(a) * 6.6, y: 9.0 + Math.sin(a) * 6.6 }]
      Ink.inkPath(ctx, ray, Ink.withAlpha(bone, 0.55), 1.0, seed + 30 + k, 0.12, false)
    }
    Ink.inkPath(ctx, cloudPts(13.4, 17.0, 1.0), boneInk(), 1.6, seed + 3, 0.2)
  }

  // The moon is a crescent: the disc, then the shadow bitten out of it, the way the sheet inks a nail.
  function paintMoon(ctx) {
    var outer = Ink.arcPts(15.4, 15, 8.2, Math.PI * 0.32, Math.PI * 1.72, 40)
    var inner = Ink.arcPts(11.0, 13.2, 8.4, Math.PI * 1.62, Math.PI * 0.42, 40)
    var shape = outer.concat(inner)
    shape.push(outer[0])
    Ink.inkPath(ctx, shape, boneInk(), 1.6, seed, 0.2)
  }

  function drops(ctx, n, y0, length, color, tilt) {
    for (var i = 0; i < n; i++) {
      var x = 8.6 + i * (13.0 / Math.max(1, n - 1))
      Ink.inkPath(ctx, [{ x: x, y: y0 }, { x: x - tilt, y: y0 + length }],
                  color, 1.3, seed + 40 + i, 0.14, false)
    }
  }

  function paintRain(ctx) {
    Ink.inkPath(ctx, cloudPts(15, 11.6, 1.1), boneInk(), 1.6, seed, 0.2)
    drops(ctx, 3, 18.4, 5.0, Ink.withAlpha(bone, 0.8), 1.0)
  }

  // The one weather that bleeds: the bolt is drawn in blood, because it is the sky breaking open.
  function paintStorm(ctx) {
    Ink.inkPath(ctx, cloudPts(15, 11.0, 1.1), boneInk(), 1.6, seed, 0.2)
    var bolt = [{ x: 16.6, y: 16.2 }, { x: 12.6, y: 21.4 }, { x: 15.4, y: 21.4 },
                { x: 12.4, y: 27.0 }, { x: 18.6, y: 20.2 }, { x: 15.6, y: 20.2 }]
    Ink.inkPath(ctx, bolt, blood, 1.5, seed + 5, 0.16)
    drops(ctx, 2, 17.8, 3.4, Ink.withAlpha(bone, 0.55), 0.8)
  }

  function paintSnow(ctx) {
    Ink.inkPath(ctx, cloudPts(15, 11.6, 1.1), boneInk(), 1.6, seed, 0.2)
    for (var i = 0; i < 3; i++) {
      var cx = 9.6 + i * 5.4, cy = 21.4 + (i % 2) * 2.6
      for (var k = 0; k < 3; k++) {
        var a = k * Math.PI / 3
        Ink.inkPath(ctx, [{ x: cx - Math.cos(a) * 1.9, y: cy - Math.sin(a) * 1.9 },
                          { x: cx + Math.cos(a) * 1.9, y: cy + Math.sin(a) * 1.9 }],
                    Ink.withAlpha(bone, 0.8), 1.0, seed + 50 + i * 3 + k, 0.1, false)
      }
    }
  }

  // Fog is the Silent Hill one: flat bands that thin out as they go down.
  function paintFog(ctx) {
    for (var i = 0; i < 4; i++) {
      var y = 9.4 + i * 4.2
      var x0 = 5.0 + (i % 2) * 2.4, x1 = 25.0 - ((i + 1) % 2) * 2.8
      Ink.inkPath(ctx, [{ x: x0, y: y }, { x: x1, y: y }],
                  Ink.withAlpha(bone, 0.88 - i * 0.16), 1.5, seed + 60 + i, 0.5, false)
    }
  }


  // ---------------------------------------------------------------- brain
  // A human brain seen from above, so it reads at 30px: two hemispheres split by a fissure, one of them
  // wound into a single spiral (Ito builds half his stories on one), the other folded like a cortex.
  // Blood fills it from the bottom as the value climbs, and drips from the base once it is nearly full.
  // The edge is scalloped, because a smooth oval reads as an egg rather than a brain.
  function brainOutline() {
    var pts = []
    for (var i = 0; i <= 90; i++) {
      var a = (i / 90) * Math.PI * 2
      var bump = 1 + 0.035 * Math.sin(9 * a + 0.4)
      pts.push({ x: 15 + 11.4 * Math.cos(a) * bump, y: 14.8 + 9.4 * Math.sin(a) * bump })
    }
    return pts
  }

  function paintBrain(ctx) {
    var v = clamp(value)
    var shape = brainOutline()

    ctx.save()
    ctx.beginPath()
    ctx.moveTo(shape[0].x, shape[0].y)
    for (var i = 1; i < shape.length; i++) ctx.lineTo(shape[i].x, shape[i].y)
    ctx.closePath()
    ctx.clip()

    // the blood inside, dark enough to stay a shadow rather than a colour
    var top = 24.4 - v * (24.4 - 5.6)
    ctx.beginPath()
    ctx.moveTo(0, 30); ctx.lineTo(0, top)
    for (var x = 0; x <= 30; x += 1) ctx.lineTo(x, top + Math.sin(x * 1.4 + seed) * 0.4)
    ctx.lineTo(30, 30); ctx.closePath()
    ctx.fillStyle = Ink.mix(blood, ink, 0.68)
    ctx.fill()
    if (v > 0.02)
      Ink.inkPath(ctx, [{ x: 0, y: top }, { x: 30, y: top }], Ink.withAlpha(blood, 0.8), 1.0, seed, 0.3, false)
    ctx.restore()

    // the silhouette and the one spiral: nothing else, so it carries the same weight as the
    // weather and the jar instead of reading as a dense blot.
    Ink.inkPath(ctx, shape, boneInk(), 1.5, seed, 0.16)
    Ink.inkPath(ctx, Ink.spiralPts(15, 14.8, 8.2, 2.6, 130, 0.05, 1),
                Ink.withAlpha(bone, 0.62), 1.1, seed + 7, 0.1, false)

    if (v > 0.6) {
      Ink.inkPath(ctx, [{ x: 15.0, y: 24.0 }, { x: 15.0, y: 26.0 }], blood, 1.1, seed + 21, 0.1, false)
      Ink.inkDot(ctx, 15.0, 26.9, 0.85 + (v - 0.6) * 0.9, blood, seed)
    }
  }

  onPaint: {
    var ctx = getContext("2d")
    ctx.clearRect(0, 0, width, height)
    ctx.save()
    ctx.scale(size / 30, size / 30)
    if (kind === "cpu") paintSpiral(ctx)
    else if (kind === "mem") paintEye(ctx)
    else if (kind === "disk") paintFigure(ctx)
    else if (kind === "net") paintNet(ctx)
    else if (kind === "vol") paintSpeaker(ctx)
    else if (kind === "sun") paintSun(ctx)
    else if (kind === "brain") paintBrain(ctx)
    else if (kind === "jar") paintJar(ctx)
    else if (kind === "bluetooth") paintBluetooth(ctx)
    else if (kind === "battery") paintBattery(ctx)
    else if (kind === "cloud") paintCloud(ctx)
    else if (kind === "suncloud") paintSunCloud(ctx)
    else if (kind === "moon") paintMoon(ctx)
    else if (kind === "rain") paintRain(ctx)
    else if (kind === "storm") paintStorm(ctx)
    else if (kind === "snow") paintSnow(ctx)
    else if (kind === "fog") paintFog(ctx)
    ctx.restore()
  }
}

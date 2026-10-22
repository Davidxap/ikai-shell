import QtQuick

// One plate of a real eye (eyes-animation.md section 3.1): a list of strokes (ItoEyeReal.realPlates) drawn once into a Canvas, and again only when the
// strokes, the size or a colour change. It has no clock and no animation; a closed panel never creates it. Colours come in `pal` ({ paper, ink, skin, tint,
// caruncle, vein0, vein1, tear }) and `ground` (the colour of what the eye sits on), all derived from the shell's tokens by ItoSealInk; this file writes none.
//   strokes  the plate's strokes (null: draws nothing)
//   clipPoly the opening (flat), for the strokes that are `clip`ped to it
//   band     { d, poly }: the front plate's occluder, an opaque band of `ground` d units wide round the opening, clear inside it, painted first
//   flapFill, flapInk  with `band.flap` (ItoEyeReal.flapShape): the occluder is a torn flap of skin in `flapFill`, its outline inked 0.5 px in `flapInk`
//                      (a drowned eye on the liquid); the opening is cleared the same way
//   uw, uh   the plate's size in units; `size` is the eye's width in px (100 units), so a unit is size / 100 px
Item {
  id: root

  property var strokes: null
  property var clipPoly: null
  property var band: null
  property var pal: null
  property color ground
  property color flapFill: "transparent"
  property color flapInk: "transparent"
  property real uw: 100
  property real uh: 62
  property real size: 46
  signal painted()

  readonly property real k: size / 100
  width: uw * k
  height: uh * k
  readonly property real dpr: Math.max(1, Screen.devicePixelRatio)

  Canvas {
    id: cv
    width: Math.max(1, Math.ceil(root.width * root.dpr))
    height: Math.max(1, Math.ceil(root.height * root.dpr))
    scale: 1 / root.dpr
    transformOrigin: Item.TopLeft
    renderTarget: Canvas.Image
    renderStrategy: Canvas.Immediate

    Connections {
      target: root
      function onStrokesChanged() { cv.requestPaint() }
      function onPalChanged() { cv.requestPaint() }
      function onGroundChanged() { if (root.band) cv.requestPaint() }
      function onFlapFillChanged() { if (root.band && root.band.flap) cv.requestPaint() }
      function onFlapInkChanged() { if (root.band && root.band.flap) cv.requestPaint() }
      function onBandChanged() { cv.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()
    Component.onCompleted: requestPaint()

    function rgba(c, a) { return "rgba(" + Math.round(c.r * 255) + "," + Math.round(c.g * 255) + "," + Math.round(c.b * 255) + "," + a + ")" }
    function mixc(a, b, t) { return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t } }
    function trace(ctx, poly) {
      ctx.moveTo(poly[0], poly[1])
      for (var i = 2; i < poly.length; i += 2) ctx.lineTo(poly[i], poly[i + 1])
      ctx.closePath()
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.reset()
      var list = root.strokes, pal = root.pal, bd = root.band
      if (pal && (list || bd)) {
        var k = width / root.uw
        ctx.scale(k, k)
        // the occluder: where the iris can be (its disc swept over the gaze ellipse; without a sweep, the opening stroked d units wide with round
        // joins, an exact dilation), then the opening itself cleared
        if (bd && bd.poly) {
          ctx.save()
          ctx.lineJoin = "round"
          ctx.lineCap = "round"
          ctx.strokeStyle = rgba(root.ground, 1)
          ctx.fillStyle = rgba(root.ground, 1)
          var sw = bd.sweep, fl = bd.flap
          if (fl && fl.poly && root.flapFill.a > 0) {
            ctx.fillStyle = rgba(root.flapFill, 1)
            ctx.beginPath(); trace(ctx, fl.poly); ctx.fill()
            ctx.strokeStyle = rgba(root.flapInk, 0.85)
            ctx.lineWidth = 0.5 / root.k
            for (var cr = 0; fl.contour && cr < fl.contour.length; cr++) {
              var run = fl.contour[cr]
              ctx.beginPath(); ctx.moveTo(run[0], run[1])
              for (var cp = 2; cp + 1 < run.length; cp += 2) ctx.lineTo(run[cp], run[cp + 1])
              ctx.stroke()
            }
          } else if (sw && sw.rx < 0.01 && sw.ry < 0.01) {
            ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.r, 0, 2 * Math.PI); ctx.fill()
          } else if (sw) {
            ctx.lineWidth = 2 * sw.r
            ctx.beginPath()
            for (var e = 0; e <= 32; e++) {
              var ea = e / 32 * 2 * Math.PI, ex = sw.x + sw.rx * Math.cos(ea), ey = sw.y + sw.ry * Math.sin(ea)
              if (e === 0) ctx.moveTo(ex, ey); else ctx.lineTo(ex, ey)
            }
            ctx.closePath(); ctx.fill(); ctx.stroke()
          } else {
            ctx.lineWidth = 2 * bd.d
            ctx.beginPath(); trace(ctx, bd.poly); ctx.stroke()
          }
          ctx.globalCompositeOperation = "destination-out"
          ctx.fillStyle = rgba(root.ground, 1)       // the colour does not matter: destination-out only takes the shape
          ctx.beginPath(); trace(ctx, bd.poly); ctx.fill()
          ctx.restore()
        }
        var clipped = false
        for (var i = 0; list && i < list.length; i++) {
          var s = list[i], want = s.clip === true
          if (want !== clipped) {
            if (clipped) ctx.restore()
            if (want && root.clipPoly) { ctx.save(); ctx.beginPath(); trace(ctx, root.clipPoly); ctx.clip() }
            clipped = want && !!root.clipPoly
          }
          var col = s.role === "paper" ? pal.paper : s.role === "ink" ? pal.ink : s.role === "skin" ? pal.skin : s.role === "tint" ? pal.tint
            : s.role === "caruncle" ? pal.caruncle : s.role === "tear" ? pal.tear : mixc(pal.vein0, pal.vein1, s.m === undefined ? 0 : s.m)
          ctx.fillStyle = rgba(col, s.a)
          ctx.beginPath()
          trace(ctx, s.poly)
          if (s.poly2) trace(ctx, s.poly2)
          ctx.fill()
        }
        if (clipped) ctx.restore()
      }
      root.painted()
    }
  }
}

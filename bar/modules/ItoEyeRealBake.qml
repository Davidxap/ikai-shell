import QtQuick

// The bake of one real eye (ItoEyeReal.realParts): its strokes drawn once into a Canvas, and again only when the strokes, the size or a
// colour change. It has no clock and no animation, and a closed panel never creates it (the popups' Loaders are `active: opened || hold`).
// Colours come in `pal` ({ paper, ink, skin, tint, caruncle, vein0, vein1, tear }, all derived from the shell's tokens by ItoSealInk); this file
// writes none.
//   parts    what ItoEyeReal.realParts returned (null: draws nothing)
//   size     the eye's width in px (the height is 0.62 of it)
//   mirror   the inner corner on the right
Item {
  id: root

  property var parts: null
  property var pal: null
  property real size: 46
  property bool mirror: false

  width: size
  height: size * 0.62
  readonly property real dpr: Math.max(1, Screen.devicePixelRatio)

  Canvas {
    id: cv
    width: Math.ceil(root.width * root.dpr)
    height: Math.ceil(root.height * root.dpr)
    scale: 1 / root.dpr
    transformOrigin: Item.TopLeft
    renderTarget: Canvas.Image
    renderStrategy: Canvas.Immediate

    Connections {
      target: root
      function onPartsChanged() { cv.requestPaint() }
      function onPalChanged() { cv.requestPaint() }
      function onMirrorChanged() { cv.requestPaint() }
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
      var parts = root.parts, pal = root.pal
      if (!parts || !pal) return
      var k = width / 100
      ctx.scale(k, k)
      if (root.mirror) { ctx.translate(100, 0); ctx.scale(-1, 1) }

      var clipped = false, list = parts.strokes
      for (var i = 0; i < list.length; i++) {
        var s = list[i], want = s.clip === true
        if (want !== clipped) {
          if (clipped) ctx.restore()
          if (want) { ctx.save(); ctx.beginPath(); trace(ctx, parts.clip); ctx.clip() }
          clipped = want
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
  }
}

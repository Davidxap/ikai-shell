import QtQuick

// The bake of one gekiga eye (ItoEyeModel.gekigaParts): its strokes drawn once into a Canvas, and again only when the strokes, the
// size or a colour change. It has no clock and no animation: nothing here runs between those changes, and a closed panel never
// creates it. Colours come in `pal` ({ paper, ink, tint, skin, veinHot, gleam }, all from the shell's tokens); this file writes none.
//   parts    what gekigaParts returned (null: draws nothing)
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

      // the flesh ring, fading to nothing at its edge (the outline is never inked)
      ctx.save()
      ctx.beginPath(); trace(ctx, parts.ring); ctx.clip()
      ctx.translate(50, 31); ctx.scale(1, 0.62)
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, 56)
      g.addColorStop(0, rgba(pal.skin, 1)); g.addColorStop(0.55, rgba(pal.skin, 0.9)); g.addColorStop(1, rgba(pal.skin, 0))
      ctx.fillStyle = g
      ctx.fillRect(-60, -60, 120, 120)
      ctx.restore()

      var clipped = false, list = parts.strokes
      for (var i = 0; i < list.length; i++) {
        var s = list[i], want = s.clip === true
        if (want !== clipped) {
          if (clipped) ctx.restore()
          if (want) { ctx.save(); ctx.beginPath(); trace(ctx, parts.clip); ctx.clip() }
          clipped = want
        }
        var col = s.role === "paper" ? pal.paper : s.role === "ink" ? pal.ink : s.role === "irisTint" ? pal.tint
          : s.role === "skin" ? pal.skin : s.role === "gleam" ? pal.gleam : mixc(pal.ink, pal.veinHot, s.m)
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

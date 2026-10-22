import QtQuick 6.11
import "ItoFrameArt.js" as Art

// The manga frame's drawn art (frameArt `drawn`, icons-v5.md section 2.5), painted ONCE in one Canvas at the card's size and again
// only when the size, the colours, the alert or the room change: the G-pen outer rule (unless the presence sheet draws the rule),
// two hatched torn corners, the screentone patch of dots and, only with `alert`, the splatter. No clock, no animation.
// Colours are all `ink` (an ItoFrameInk) tokens: bone strokes, `rule`, `alertRule`, and `hot` for the splatter (a state, not decor).
Canvas {
  id: root

  property var ink: null
  property bool alert: false
  property bool roomy: true
  property bool ruled: true                 // draw the outer rule (false while the presence sheet owns it)
  property real head: 26                    // the room above and below the content (ItoConfig.panelHeadroom / panelFootroom)
  property real foot: 24

  antialiasing: true
  visible: !!ink && width > 8 && height > 8

  onWidthChanged: requestPaint()
  onHeightChanged: requestPaint()
  onVisibleChanged: requestPaint()
  onAlertChanged: requestPaint()
  onRoomyChanged: requestPaint()
  onRuledChanged: requestPaint()
  readonly property color boneC: ink ? ink.bone : "transparent"
  readonly property color ruleC: ink ? (alert ? ink.alertRule : ink.rule) : "transparent"
  readonly property color fillC: ink ? ink.hot : "transparent"
  onBoneCChanged: requestPaint()
  onRuleCChanged: requestPaint()
  onFillCChanged: requestPaint()

  function rgba(c, a) { return Qt.rgba(c.r, c.g, c.b, a) }

  function paintCorner(ctx, W, seed) {
    var cn = Art.corner(W, seed)
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(cn.poly[0], cn.poly[1])
    for (var i = 2; i + 1 < cn.poly.length; i += 2) ctx.lineTo(cn.poly[i], cn.poly[i + 1])
    ctx.closePath()
    ctx.clip()
    ctx.lineWidth = 0.7
    for (var j = 0; j < cn.hatch.length; j++) {
      var h = cn.hatch[j]
      var mx = (h[0] + h[2]) / 2, my = (h[1] + h[3]) / 2
      ctx.strokeStyle = rgba(root.boneC, Art.toneAt(Math.sqrt(mx * mx + my * my), cn.reach) * 0.5)
      ctx.beginPath(); ctx.moveTo(h[0], h[1]); ctx.lineTo(h[2], h[3]); ctx.stroke()
    }
    ctx.restore()
  }

  onPaint: {
    var ctx = getContext("2d")
    ctx.reset()
    if (!visible) return
    var W = width, H = height
    // the G-pen rule
    if (ruled) {
      var segs = Art.rule(W, H)
      ctx.strokeStyle = root.ruleC
      ctx.lineCap = "butt"
      for (var s = 0; s < segs.length; s++) {
        var g = segs[s]
        ctx.lineWidth = g.w
        ctx.beginPath(); ctx.moveTo(g.x1, g.y1); ctx.lineTo(g.x2, g.y2); ctx.stroke()
      }
    }
    // torn corners: top-left, and the same turned half a circle at the bottom-right
    ctx.save(); paintCorner(ctx, W, 11); ctx.restore()
    ctx.save(); ctx.translate(W, H); ctx.rotate(Math.PI); paintCorner(ctx, W, 29); ctx.restore()
    // screentone, top-right
    var dots = Art.tone(W, H, head, foot)
    for (var d = 0; d < dots.length; d++) {
      var p = dots[d]
      ctx.fillStyle = rgba(root.boneC, p.a)
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 2 * Math.PI); ctx.fill()
    }
    // the splatter is an alert's, and a short card has no room for it
    if (alert && roomy) {
      var dr = Art.splatter(W, H, head, foot, 7)
      ctx.lineCap = "round"
      for (var q = 0; q < dr.length; q++) {
        var o = dr[q]
        ctx.fillStyle = rgba(root.fillC, 0.6); ctx.strokeStyle = rgba(root.fillC, 0.6)
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 2 * Math.PI); ctx.fill()
        if (o.tx !== null) { ctx.lineWidth = Math.max(0.6, o.r * 0.7); ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.tx, o.ty); ctx.stroke() }
      }
    }
  }
}

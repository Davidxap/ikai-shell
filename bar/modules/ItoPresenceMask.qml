import QtQuick 6.11
import QtQuick.Effects
import "ItoRevealMap.js" as R

// The popup's spiral / blot opening (visual-v3.md section 1; sidecar `presenceReveal: spiral | blot`). ItoPanelFrame loads this while
// the flag is spiral or blot, as a child of the card. It is inert at rest (no layer, no map, no effect: the card renders as it always
// did); `run` turns the layers on for the length of a masked open or close. It is NOT loaded and unloaded per run: the effect refers
// to the map item, and destroying the map first leaves the effect pointing at a dead texture (a SIGSEGV in the lab).
//
// Two GPU layers, both driven by ONE number, ItoPresence's `ph.mk`:
//   1. the card's own layer gets a MultiEffect whose mask is the time map (alpha A = 1 - T, baked once into a half-size Canvas): the
//      sheet, the frame and the content unwind together, from the icon outwards;
//   2. an inked edge (a bone rectangle masked by a thin band of the same map) marks the leading line of the unwinding arm.
// The map is painted once per open (and again only if the card is resized): there is no per-frame JavaScript here. No clock, no timer.
Item {
  id: root

  property var pres: null          // the running ItoPresence
  property Item card: null
  property string kind: "spiral"   // "spiral" | "blot" | "static"
  property bool run: false         // a masked open or close is engaged
  property string side: "top"
  property color edgeColor: "white"

  readonly property real cw: pres ? pres.cardRect.w : 0
  readonly property real ch: pres ? pres.cardRect.h : 0
  readonly property var iconRect: pres ? pres.iconR : ({ x: 0, y: 0, w: 56, h: 6 })
  readonly property var org: R.origin(side, cw, ch, iconRect.x + iconRect.w / 2, iconRect.y + iconRect.h / 2)
  readonly property real dm: Math.max(1, R.dmax(org, cw, ch))
  // the map's progress, always finite (Qt 6.12 lets NaN through into the scene graph: presence-crash.md)
  function fin(v, d) { return typeof v === "number" && isFinite(v) ? v : d }
  readonly property real mk: Math.max(0, Math.min(1, fin(pres ? pres.ph.mk : 1, 1)))
  readonly property real lvl: R.level(mk)
  readonly property bool vertical: side === "top" || side === "bottom"
  readonly property real delta: R.edgeDelta(kind, dm, vertical ? ch : cw)

  width: run ? cw : 0; height: run ? ch : 0
  enabled: false

  // ------------------------------------------------------------------------------------------------------- the time map
  // the Canvas is baked at half size and scaled by 2 (alpha only, no colour, so a palette change never needs a re-bake)
  Item {
    id: map
    width: root.run ? root.cw : 1; height: root.run ? root.ch : 1
    visible: false
    layer.enabled: true
    Canvas {
      id: cv
      width: Math.ceil(map.width / 2); height: Math.ceil(map.height / 2)
      scale: 2
      transformOrigin: Item.TopLeft
      smooth: true
      renderTarget: Canvas.Image
      onPaint: root.bake(getContext("2d"))
      onWidthChanged: requestPaint()
      onHeightChanged: requestPaint()
      Component.onCompleted: requestPaint()
      Connections { target: root; function onKindChanged() { cv.requestPaint() } function onSideChanged() { cv.requestPaint() } function onOrgChanged() { cv.requestPaint() } }
    }
  }

  // if this item is ever destroyed while a run is on (the flag turned off mid-open), the card gives up its layer first: the effect must never outlive the map
  Component.onDestruction: { if (root.run && root.card) { root.card.layer.effect = null; root.card.layer.enabled = false } }

  function bake(ctx) {
    var w = cv.width, h = cv.height
    if (w < 2 || h < 2) return
    var s = 0.5, ox = org.x * s, oy = org.y * s, dd = dm * s
    ctx.reset()
    ctx.clearRect(0, 0, w, h)
    ctx.globalCompositeOperation = "lighter"
    var g, i
    if (kind === "static") {
      // a straight wipe from the bar's edge: A = 1 - T with T the share of the way across the card
      g = side === "left" ? ctx.createLinearGradient(0, 0, w, 0) : side === "right" ? ctx.createLinearGradient(w, 0, 0, 0)
        : side === "bottom" ? ctx.createLinearGradient(0, h, 0, 0) : ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, "rgba(255,255,255,1)")
      g.addColorStop(1, "rgba(255,255,255,0)")
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    } else if (kind === "blot") {
      // wedges from O, each filled with a radial ramp whose reach is the blot's radius in that direction (A = 1 - d / reach)
      var n = 180, far = dd * 4
      for (i = 0; i < n; i++) {
        var p0 = (i / n) * 2 * Math.PI, p1 = ((i + 1) / n) * 2 * Math.PI, pm = (p0 + p1) / 2
        var reach = dd * R.blotRadius(pm)
        g = ctx.createRadialGradient(ox, oy, 0, ox, oy, reach)
        g.addColorStop(0, "rgba(255,255,255,1)")
        g.addColorStop(1, "rgba(255,255,255,0)")
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.moveTo(ox, oy)
        ctx.lineTo(ox + Math.cos(p0) * far, oy + Math.sin(p0) * far)
        ctx.lineTo(ox + Math.cos(p1) * far, oy + Math.sin(p1) * far)
        ctx.closePath()
        ctx.fill()
      }
      // the satellite droplets: each a small well that opens 0.05 of the way before the arm arrives
      var drops = R.droplets(side, org, cw, ch)
      for (i = 0; i < drops.length; i++) {
        var d = drops[i]
        g = ctx.createRadialGradient(d.x * s, d.y * s, 0, d.x * s, d.y * s, d.r * s)
        g.addColorStop(0, "rgba(255,255,255,0.05)")
        g.addColorStop(1, "rgba(255,255,255,0)")
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      }
    } else {
      // 0.72 x (1 - d) from a radial ramp, plus 0.28 x (1 - theta) from a conical one; the sum is A = 1 - T. Qt's conical gradient
      // grows counter-clockwise from its start angle (measured counter-clockwise on screen), theta grows clockwise from the
      // away-from-the-bar direction, so the start is -away and the stops climb 0 -> 0.28
      g = ctx.createRadialGradient(ox, oy, 0, ox, oy, dd)
      g.addColorStop(0, "rgba(255,255,255," + R.SPIRAL.radial + ")")
      g.addColorStop(1, "rgba(255,255,255,0)")
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      g = ctx.createConicalGradient(ox, oy, -R.awayAngle(side))
      g.addColorStop(0, "rgba(255,255,255,0)")
      g.addColorStop(1, "rgba(255,255,255," + R.SPIRAL.turn + ")")
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }
  }

  // ---------------------------------------------------------------------------------------------------- 1. the content mask
  // The card is layered only while this item exists; the Bindings give the card its old layer back when the run is over.
  Binding { target: root.card; property: "layer.enabled"; value: true; when: root.card !== null && root.run }
  Binding { target: root.card; property: "layer.effect"; value: cardEffect; when: root.card !== null && root.run }
  Component {
    id: cardEffect
    MultiEffect {
      maskEnabled: true
      maskSource: map
      maskThresholdMin: 1 - root.lvl
      maskSpreadAtMin: R.SPREAD
      maskThresholdMax: 1
      maskSpreadAtMax: 0
    }
  }

  // ------------------------------------------------------------------------------------------------------- 2. the inked edge
  // A bone rectangle seen only through a thin band of the map, just inside the revealed set (T between mk - delta and mk): the leading
  // line of the arm. Hidden at both ends of the run, where it would be a dot or a frame.
  Item {
    id: edge
    anchors.fill: parent
    z: 500
    visible: root.run && root.mk > 0.02 && root.mk < 0.98
    layer.enabled: visible
    layer.effect: MultiEffect {
      maskEnabled: true
      maskSource: map
      maskThresholdMin: 1 - root.lvl
      maskSpreadAtMin: 0.004
      maskThresholdMax: 1 - root.lvl + root.delta
      maskSpreadAtMax: 0.004
    }
    Rectangle {
      anchors.fill: parent
      color: Qt.rgba(root.edgeColor.r, root.edgeColor.g, root.edgeColor.b, R.edgeAlpha(root.kind))
    }
    // static: the band is snow (45 % of the pixels, bone and dark, 0.8), baked once at half size
    Canvas {
      id: snow
      visible: root.kind === "static"
      anchors.fill: parent
      renderTarget: Canvas.Image
      onWidthChanged: if (visible) requestPaint()
      onHeightChanged: if (visible) requestPaint()
      onVisibleChanged: if (visible) requestPaint()
      onPaint: {
        var ctx = getContext("2d"), w = Math.ceil(width / 2), h = Math.ceil(height / 2), e = root.edgeColor
        ctx.reset(); ctx.scale(2, 2)
        var s = 12345
        for (var i = 0; i < w * h * 0.45; i++) {
          s = (Math.imul(s, 1664525) + 1013904223) >>> 0
          var x = (s % w), y = Math.floor(s / w) % h
          ctx.fillStyle = (s & 0x100) ? Qt.rgba(e.r, e.g, e.b, 0.8) : Qt.rgba(e.r * 0.1, e.g * 0.1, e.b * 0.1, 0.8)
          ctx.fillRect(x, y, 1, 1)
        }
      }
    }
  }

  // static: scanlines on every 2nd row of the revealed card, fading out over the last 30 % of the run (the card's layer masks them with it)
  Canvas {
    id: scan
    visible: root.run && root.kind === "static"
    anchors.fill: parent
    z: 400
    opacity: Math.max(0, Math.min(1, (0.95 - root.mk) / 0.3)) * 0.14
    renderTarget: Canvas.Image
    onWidthChanged: if (visible) requestPaint()
    onHeightChanged: if (visible) requestPaint()
    onVisibleChanged: if (visible) requestPaint()
    onPaint: {
      var ctx = getContext("2d"), e = root.edgeColor
      ctx.reset()
      ctx.fillStyle = Qt.rgba(e.r * 0.1, e.g * 0.1, e.b * 0.1, 1)
      for (var y = 1; y < height; y += 2) ctx.fillRect(0, y, width, 1)
    }
  }
}

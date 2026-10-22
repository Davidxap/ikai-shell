import QtQuick 6.11
import "ItoMotion.js" as Motion

// The manga finisher (frame-styles.md section 4): 14 thin filled triangles fanned out of the point where the bar icon meets the card's
// bar-facing edge, apex at 0.12 W and base (2 k wide) at 0.58 W from that point, spread evenly over 150 degrees and opening away from the
// bar. Painted once at the card's size; `play()` fades it 0.45 -> 0 while it scales 0.92 -> 1.06 about the anchor over 260 ms (decel), then it
// is invisible. Edge-started and one-shot: nothing runs before or after, and with motion off it never shows.
Item {
  id: root

  property color tone: "transparent"        // alpha(bone, 0.28), from the frame's ink
  property string barSide: "top"
  property real anchorX: -1                 // the icon's centre along the bar edge, in card coordinates (-1: the middle)
  property real amp: 1
  property real k: 1

  visible: opacity > 0.01
  opacity: 0
  readonly property real ax: barSide === "left" ? 0 : barSide === "right" ? width : (anchorX >= 0 && anchorX <= width ? anchorX : width / 2)
  readonly property real ay: barSide === "top" ? 0 : barSide === "bottom" ? height : (anchorX >= 0 && anchorX <= height ? anchorX : height / 2)
  readonly property real toward: barSide === "top" ? Math.PI / 2 : barSide === "bottom" ? -Math.PI / 2 : barSide === "left" ? 0 : Math.PI

  property real grow: 0.92
  transform: Scale { origin.x: root.ax; origin.y: root.ay; xScale: root.grow; yScale: root.grow }

  Canvas {
    id: cv
    anchors.fill: parent
    antialiasing: true
    onPaint: {
      var ctx = getContext("2d")
      ctx.reset()
      if (width < 8 || height < 8) return
      var W = root.barSide === "left" || root.barSide === "right" ? height : width
      var r0 = 0.12 * W, r1 = 0.58 * W, half = Math.max(0.5, root.k)
      ctx.fillStyle = root.tone
      for (var i = 0; i < 14; i++) {
        var a = root.toward + (i / 13 - 0.5) * (150 * Math.PI / 180)
        var cs = Math.cos(a), sn = Math.sin(a)
        ctx.beginPath()
        ctx.moveTo(root.ax + cs * r0, root.ay + sn * r0)
        ctx.lineTo(root.ax + cs * r1 - sn * half, root.ay + sn * r1 + cs * half)
        ctx.lineTo(root.ax + cs * r1 + sn * half, root.ay + sn * r1 - cs * half)
        ctx.closePath()
        ctx.fill()
      }
    }
    Connections {
      target: root
      function onToneChanged() { cv.requestPaint() }
      function onBarSideChanged() { cv.requestPaint() }
      function onAnchorXChanged() { cv.requestPaint() }
      function onWidthChanged() { cv.requestPaint() }
      function onHeightChanged() { cv.requestPaint() }
    }
  }

  // one-shot: started by `play()` on the popup's open edge; two parallel 260 ms steps, then it stops (no loops)
  ParallelAnimation {
    id: run
    NumberAnimation { target: root; property: "opacity"; from: 0.45; to: 0; duration: Motion.dur(260, root.amp, "panel"); easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.CURVES.decel }
    NumberAnimation { target: root; property: "grow"; from: 0.92; to: 1.06; duration: Motion.dur(260, root.amp, "panel"); easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.CURVES.decel }
  }
  function play() { if (root.amp > 0 && width > 8) { cv.requestPaint(); run.restart() } }
}

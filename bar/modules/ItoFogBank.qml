import QtQuick 6.11
import QtQuick.Shapes
import "ItoMotion.js" as Motion

// The fog of the Otherworld frame (ito-panel-presence/frame-styles.md section 6): three ellipses of `fog` fading to nothing, along the bottom,
// at 0.25 W, 0.6 W and 0.85 W, sized 0.7 W x 0.5 H, 0.5 W x 0.4 H and 0.6 W x 0.45 H. They drift sideways by +-0.08 W over 14 s, one third of a
// cycle apart, only while `live` (the popup is open) and motion is on: translation only, one clock. With `live` false they sit still.
Item {
  id: root

  property var ink: null
  property bool live: false
  property real amp: 1
  property real open: 1                    // 0..1: the fade-in on the frame's reveal

  function fin(v, d) { v = Number(v); return isFinite(v) ? v : d }
  readonly property real fw: Math.max(0, width)
  readonly property real fh: Math.max(0, height)
  readonly property color cFog: ink ? ink.fog : "transparent"
  readonly property color cNone: ink ? ink.alpha(ink.fog, 0) : "transparent"

  // phase 0..1 per full drift (14 s); a sine of it moves each ellipse, the three a third of a turn apart
  property real phase: 0
  NumberAnimation on phase {
    from: 0; to: 1
    duration: Motion.dur(14000, root.amp, "panel") > 0 ? Motion.dur(14000, root.amp, "panel") : 14000
    loops: Animation.Infinite
    running: root.live && root.amp > 0 && root.fw > 0
  }

  opacity: Math.max(0, Math.min(1, fin(open, 1)))

  Repeater {
    model: [
      { "cx": 0.25, "w": 0.70, "h": 0.50, "ph": 0 },
      { "cx": 0.60, "w": 0.50, "h": 0.40, "ph": 1 / 3 },
      { "cx": 0.85, "w": 0.60, "h": 0.45, "ph": 2 / 3 }
    ]
    delegate: Item {
      id: bank
      required property var modelData
      readonly property real ew: root.fw * modelData.w
      readonly property real eh: root.fh * modelData.h
      // drift is 0 at rest; the ellipse is centred on x = cx W, its lower half hanging out of the box (the frame clips it)
      x: root.fw * modelData.cx - ew / 2 + (root.live && root.amp > 0 ? 0.08 * root.fw * Math.sin(2 * Math.PI * (root.phase + modelData.ph)) : 0)
      y: root.fh - eh / 2
      width: ew; height: eh
      visible: ew > 2 && eh > 2 && root.cFog.a > 0
      Shape {
        width: 64; height: 64
        transform: Scale { xScale: bank.ew / 64; yScale: bank.eh / 64 }
        preferredRendererType: Shape.GeometryRenderer
        ShapePath {
          strokeColor: "transparent"
          fillGradient: RadialGradient {
            centerX: 32; centerY: 32; centerRadius: 32; focalX: 32; focalY: 32
            GradientStop { position: 0; color: root.cFog }
            GradientStop { position: 1; color: root.cNone }
          }
          startX: 0; startY: 0
          PathLine { x: 64; y: 0 }
          PathLine { x: 64; y: 64 }
          PathLine { x: 0; y: 64 }
          PathLine { x: 0; y: 0 }
        }
      }
    }
  }
}

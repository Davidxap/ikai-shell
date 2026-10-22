import QtQuick
import QtQuick.Shapes

// The moon as a disc: the dark side, the lit side, and a thin ring for the new moon. `illum` (0..1) and `waxing` come
// from ItoTimeModel.moonPhase. The lit part is a half circle on the limb plus a half ellipse for the terminator, so it
// is one filled path; it is re-built only when `illum` moves by a 1/56 step. Colours are tokens handed in by the host.
Item {
  id: root

  property real size: 24
  property real illum: 0.5
  property bool waxing: true
  property color lit: "transparent"
  property color dark: "transparent"
  property color ring: "transparent"

  readonly property real q: Math.round(illum * 56) / 56
  readonly property real r: size / 2
  readonly property real a: Math.max(0.01, Math.abs(1 - 2 * q) * r)     // the terminator's half width
  readonly property bool gibbous: q > 0.5
  readonly property bool isNew: q < 0.03

  width: size
  height: size

  Shape {
    anchors.fill: parent
    preferredRendererType: Shape.CurveRenderer
    // the lit side sits on the right while waxing, on the left while waning
    transform: Scale { origin.x: root.r; origin.y: root.r; xScale: root.waxing ? 1 : -1 }

    ShapePath {                                   // the dark disc
      strokeColor: root.isNew ? root.ring : "transparent"
      strokeWidth: 1
      fillColor: root.dark
      PathAngleArc { centerX: root.r; centerY: root.r; radiusX: root.r - 0.5; radiusY: root.r - 0.5; startAngle: 0; sweepAngle: 360 }
    }
    ShapePath {                                   // the lit part
      strokeColor: "transparent"
      strokeWidth: 0
      fillColor: root.isNew ? "transparent" : root.lit
      startX: root.r; startY: 0.5
      PathArc { x: root.r; y: root.size - 0.5; radiusX: root.r - 0.5; radiusY: root.r - 0.5; direction: PathArc.Clockwise }
      PathArc {
        x: root.r; y: 0.5
        radiusX: root.a; radiusY: root.r - 0.5
        direction: root.gibbous ? PathArc.Clockwise : PathArc.Counterclockwise
      }
    }
  }
}

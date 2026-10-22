import QtQuick
import QtQuick.Shapes

// The ensō: an open brush ring. The seal of today in the calendar and of the current month in the year plate.
// A 330 degree sweep that starts at `startAngle` (QML angles: 0 is three o'clock, clockwise), so the gap sits at the
// upper right. `drawn` (0..1) is how much of it is inked; the host animates it (this has no clock of its own).
// `color` and everything else are handed in as tokens; nothing here is a colour of its own.
Item {
  id: root

  property real size: 32
  property color color: "transparent"
  property real strokeWidth: 1.8
  property real drawn: 1
  property real startAngle: 300
  property real sweep: 330

  implicitWidth: size
  implicitHeight: size
  width: size
  height: size

  Shape {
    anchors.fill: parent
    preferredRendererType: Shape.CurveRenderer
    visible: root.drawn > 0.001
    ShapePath {
      strokeColor: root.color
      strokeWidth: root.strokeWidth
      fillColor: "transparent"
      capStyle: ShapePath.RoundCap
      PathAngleArc {
        centerX: root.size / 2; centerY: root.size / 2
        radiusX: (root.size - root.strokeWidth) / 2; radiusY: (root.size - root.strokeWidth) / 2
        startAngle: root.startAngle
        sweepAngle: root.sweep * Math.max(0, Math.min(1, root.drawn))
      }
    }
  }
}

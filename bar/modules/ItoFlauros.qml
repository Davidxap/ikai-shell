import QtQuick
import QtQuick.Shapes

// The warning glyph beside a reading that has crossed its line: an upward triangle (the pyramid that repels the
// Order's god in Silent Hill) with three lines from its corners to its centre. Side 7 px, stroke 1 in `ink.hot`.
// A static shape: it appears (`visible`) and never moves. The warning is also carried by the colour, but the glyph
// keeps it from relying on colour alone. `ink` is an ItoSealInk.
Item {
  id: root

  property var ink: null

  implicitWidth: 7
  implicitHeight: 7
  width: implicitWidth
  height: implicitHeight

  Shape {
    anchors.fill: parent
    antialiasing: true
    ShapePath {
      strokeWidth: 1
      strokeColor: root.ink ? root.ink.hot : Qt.rgba(0.8, 0.3, 0.3, 1)
      fillColor: Qt.rgba(0, 0, 0, 0)
      capStyle: ShapePath.RoundCap
      joinStyle: ShapePath.RoundJoin
      PathSvg { path: "M 3.5 0.5 L 0.5 6.2 L 6.5 6.2 Z M 3.5 0.5 L 3.5 4.3 M 0.5 6.2 L 3.5 4.3 M 6.5 6.2 L 3.5 4.3" }
    }
  }
}

import QtQuick 6.11
import QtQuick.Shapes
import "ItoWire.js" as Wire

// A grating segment (ito-panel-presence/frame-styles.md section 6): a diamond mesh of +-45 degree lines 6 k apart (`mesh`, 0.8 px, or 0.22 `hot`
// in an alert) under a 1.2 px top bar (`iron`, `hot` in an alert). Drawn once from ItoWire.meshPath. It fills its own box; the frame places it.
// No clock, no animation.
Item {
  id: root

  property var ink: null
  property real k: 1
  property bool alert: false

  readonly property string mesh: Wire.meshPath(width, height - 1.2, 6 * Math.max(0.3, k))
  readonly property color cMesh: ink ? (alert ? ink.alpha(ink.hot, 0.22) : ink.mesh) : "transparent"
  readonly property color cBar: ink ? (alert ? ink.hot : ink.iron) : "transparent"

  visible: width > 6 && height > 6 && !!ink

  Shape {
    y: 1.2
    width: root.width; height: Math.max(0, root.height - 1.2)
    preferredRendererType: Shape.GeometryRenderer
    ShapePath {
      fillColor: "transparent"; strokeColor: root.cMesh; strokeWidth: 0.8
      PathSvg { path: root.mesh }
    }
  }
  Rectangle { x: 0; y: 0; width: root.width; height: 1.2; color: root.cBar }
}

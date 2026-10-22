import QtQuick 6.11
import QtQuick.Shapes
import "ItoWire.js" as Wire

// Barbed wire (ito-panel-presence/frame-styles.md section 6): two strands twisting about each other, a pair of crossed barbs every 26 k. Drawn
// once, in the frame's `ink` tokens only (strands `iron`, barbs `ironHi`, both `hot` in an alert). It runs along y = `wireY` from `x0` to `x1` in
// this item's own coordinates. `open` (0..1) reveals it with a clip that grows from `anchorX` outward. No clock, no animation.
Item {
  id: root

  property var ink: null
  property real k: 1
  property real x0: 0
  property real x1: 0
  property real wireY: 0
  property real anchorX: -1
  property real open: 1
  property bool alert: false

  function fin(v, d) { v = Number(v); return isFinite(v) ? v : d }
  readonly property real span: Math.max(0, fin(x1, 0) - fin(x0, 0))
  readonly property real ax: Math.max(fin(x0, 0), Math.min(fin(x1, 0), fin(anchorX, -1) < 0 ? (fin(x0, 0) + fin(x1, 0)) / 2 : fin(anchorX, 0)))
  // how far the clip reaches either side of the anchor when fully open: the longer way to an end
  readonly property real reach: Math.max(ax - fin(x0, 0), fin(x1, 0) - ax)
  readonly property real half: reach * Math.max(0, Math.min(1, fin(open, 1)))
  readonly property color cIron: ink ? (alert ? ink.hot : ink.iron) : "transparent"
  readonly property color cHi: ink ? (alert ? ink.hot : ink.ironHi) : "transparent"

  readonly property var strandA: Wire.strand(x0, x1, k, 1)
  readonly property var strandB: Wire.strand(x0, x1, k, -1)
  readonly property var barbList: Wire.barbs(x0, x1, k)
  function pts(flat) { var out = []; for (var i = 0; i + 1 < flat.length; i += 2) out.push(Qt.point(flat[i], flat[i + 1])); return out }

  visible: span > 4 && !!ink
  x: 0; y: wireY
  width: 1; height: 1

  Item {
    id: clipper
    x: root.ax - root.half
    y: -12
    width: root.half * 2
    height: 24
    clip: true
    visible: width > 0.5
    Shape {
      x: -clipper.x; y: 12
      width: 1; height: 1
      preferredRendererType: Shape.GeometryRenderer
      ShapePath {
        fillColor: "transparent"; strokeColor: root.cIron; strokeWidth: 0.9
        PathPolyline { path: root.pts(root.strandA) }
      }
      ShapePath {
        fillColor: "transparent"; strokeColor: root.cIron; strokeWidth: 0.9
        PathPolyline { path: root.pts(root.strandB) }
      }
      ShapePath {
        fillColor: "transparent"; strokeColor: root.cHi; strokeWidth: 1.0; capStyle: ShapePath.RoundCap
        PathMultiline { paths: root.barbPaths }
      }
    }
  }
  readonly property var barbPaths: {
    var out = []
    for (var i = 0; i < barbList.length; i++) out.push([Qt.point(barbList[i][0], barbList[i][1]), Qt.point(barbList[i][2], barbList[i][3])])
    return out
  }
}

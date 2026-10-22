import QtQuick
import QtQuick.Shapes

// The Otherworld chain (Silent Hill): the memory line as a taut chain drawn across the vessel at the height where the filled
// area is 85 % (it replaces the dashed hot chord at `loreLevel` subtle and full). It lies on the exact chord, with no sag: the
// height is data. Links at 5 px pitch alternate a face-on link (an ellipse 4 x 2.2, stroke 0.8) and an edge-on one (a 4 x 0.8
// bar); the chain runs to 2 px inside the seal's inner rule. Over 85 % it takes the alarm colour at 0.6.
//
// `size` is the vessel seal's width (it fills the seal's square); `cx`, `cy` the centre; `y` the chord's height in the seal's
// coordinates; `rInner` the inner rule's radius (73 of 78, scaled); `k` the seal's scale. Not used on the lesser swap seals
// (the caller does not create it under 24 px). Static: no clock, rebuilt only when the geometry or the hot flag changes. Colours
// come only from `ink` (an ItoSealInk). Imports nothing from the shell.
Item {
  id: root

  property var ink: null
  property real size: 156
  property real cx: size / 2
  property real cy: size / 2
  property real y0: 0
  property real rInner: 73
  property real k: 1
  property bool hot: false

  width: size
  height: size

  readonly property real dy: y0 - cy
  readonly property real reach: Math.max(0, Math.sqrt(Math.max(0, rInner * rInner - dy * dy)) - 2 * k)
  // the links, as one SVG path: face-on ellipses (open) and edge-on bars
  readonly property string d: {
    if (reach <= 0) return ""
    var pitch = 5 * k, n = Math.floor(2 * reach / pitch) + 1, out = []
    var x0 = cx - (n - 1) * pitch / 2
    for (var i = 0; i < n; i++) {
      var x = x0 + i * pitch
      if (i % 2 === 0) {
        var rx = 2 * k, ry = 1.1 * k
        out.push("M " + (x + rx) + " " + y0 + " A " + rx + " " + ry + " 0 1 1 " + (x - rx) + " " + y0 + " A " + rx + " " + ry + " 0 1 1 " + (x + rx) + " " + y0 + " Z")
      } else {
        out.push("M " + (x - 2 * k) + " " + y0 + " L " + (x + 2 * k) + " " + y0)
      }
    }
    return out.join(" ")
  }

  Shape {
    anchors.fill: parent
    antialiasing: true
    ShapePath {
      strokeWidth: 0.8
      strokeColor: root.ink ? (root.hot ? root.ink.alpha(root.ink.hot, 0.6) : root.ink.threshold) : "transparent"
      fillColor: "transparent"
      capStyle: ShapePath.FlatCap
      joinStyle: ShapePath.RoundJoin
      PathSvg { path: root.d }
    }
  }
}

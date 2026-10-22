import QtQuick
import QtQuick.Shapes
import "ItoChart.js" as Chart
import "ItoLore.js" as Lore

// The Otherworld rust grating (Silent Hill): temperature as a hatched band on the seal's frame, between its two rules
// (r 87..91). From 12 o'clock clockwise it spreads with the heat: 60 degrees C is nothing, 80 degrees is 240 degrees of
// the circle, 90 degrees closes it. A small notch marks 80 degrees (240 degrees), the line the heat must not cross; above
// it the whole hatch is the alarm colour. One X-hatch every 4 degrees (two 0.7 px lines corner to corner of its cell).
//
// Used by the CPU seal (core temperature) and the platter seal (NVMe). Static: no clock, no Behavior; the Shape is rebuilt
// only when the quantised sweep (every 4 degrees) or the hot flag changes. `temp` is in degrees C (-1: no sensor, nothing is
// drawn). `crackOpen` skips the cells around 200 degrees, where the frame's crack enters. Under 160 px (k < 0.87) the pitch is
// 6 degrees and a cell has one diagonal. Colours come only from `ink` (an ItoSealInk). Imports nothing from the shell.
Item {
  id: root

  property var ink: null
  property real size: 184
  property real temp: -1
  property real hot: 80
  property bool crackOpen: false
  property string lvl: "off"

  width: size
  height: size
  visible: lvl !== "off" && temp >= 0

  readonly property real half: size / 2
  readonly property real k: half / Chart.REFERENCE_R
  readonly property bool small: size < 160
  readonly property real pitch: small ? 6 : 4
  readonly property real sweep: temp >= 0 ? Lore.rustSweep(temp, hot) : 0
  readonly property bool isHot: temp > hot
  readonly property color none: "transparent"

  // the hatch: for each cell of `pitch` degrees inside the sweep, its diagonals as 2-point segments
  readonly property var hatch: {
    var out = []
    if (lvl === "off" || sweep <= 0) return out
    var cells = Math.floor(sweep / pitch)
    var rIn = 87 * k, rOut = 91 * k
    function pt(a, r) { var p = Chart.polar(a, r); return Qt.point(half + p.x, half + p.y) }
    for (var i = 0; i < cells; i++) {
      var a0 = i * pitch, a1 = a0 + pitch
      if (crackOpen && a1 > 197 && a0 < 203) continue
      out.push([pt(a0, rIn), pt(a1, rOut)])
      if (!small) out.push([pt(a0, rOut), pt(a1, rIn)])
    }
    return out
  }
  readonly property real notchAngle: Lore.rustNotch(hot)
  readonly property var notch: {
    var a = Chart.polar(notchAngle, 86 * k), b = Chart.polar(notchAngle, 91 * k)
    return [Qt.point(half + a.x, half + a.y), Qt.point(half + b.x, half + b.y)]
  }

  Shape {
    anchors.fill: parent
    antialiasing: true
    ShapePath {
      strokeWidth: 0.7
      strokeColor: root.ink ? (root.isHot ? root.ink.hot : root.ink.tick) : root.none
      fillColor: root.none
      PathMultiline { paths: root.hatch }
    }
    ShapePath {
      strokeWidth: 1
      strokeColor: root.ink ? root.ink.threshold : root.none
      fillColor: root.none
      PathPolyline { path: root.notch }
    }
  }
}

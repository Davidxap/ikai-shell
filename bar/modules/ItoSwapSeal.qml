import QtQuick
import QtQuick.Shapes
import "ItoChart.js" as Chart

// A lesser circle of the memory seal: one swap kind as a small vessel of the same liquid (ItoIchor, one stratum,
// area-true). 30 px across, the seal's rule pair scaled down, the liquid radius 11. `kind` "zram" (compressed memory:
// memory wound in on itself, so a faint two-turn spiral under the liquid) or "file" (plain). `hot` turns the liquid
// to the alert colour (the caller says when: above 0.8 used); the number stays as text beside it.
//
// Everything is gated by `live` (the panel-open flag) and `amp` (motion amplitude) in ItoIchor. Colours come only
// from `ink` (an ItoSealInk). Imports nothing from the shell, so the offscreen lab can render it.
Item {
  id: root

  property var ink: null
  property real value: 0            // used / size, 0..1
  property bool hot: false
  property string kind: "file"
  property bool live: false
  property real amp: 1

  width: 30; height: 30

  Rectangle {
    anchors.fill: parent
    anchors.margins: 0.5
    radius: width / 2
    color: Qt.rgba(0, 0, 0, 0)
    border.width: 1
    border.color: root.ink ? root.ink.rule : Qt.rgba(0, 0, 0, 0)
    antialiasing: true
  }
  Rectangle {
    anchors.fill: parent
    anchors.margins: 2.3
    radius: width / 2
    color: Qt.rgba(0, 0, 0, 0)
    border.width: 1
    border.color: root.ink ? root.ink.ruleSoft : Qt.rgba(0, 0, 0, 0)
    antialiasing: true
  }

  // compressed memory, wound in on itself
  Shape {
    anchors.fill: parent
    visible: root.kind === "zram"
    antialiasing: true
    ShapePath {
      strokeWidth: 0.8
      strokeColor: root.ink ? root.ink.spiralGhost : Qt.rgba(0, 0, 0, 0)
      fillColor: Qt.rgba(0, 0, 0, 0)
      capStyle: ShapePath.RoundCap
      PathPolyline { path: root.spiral }
    }
  }
  readonly property var spiral: {
    var raw = Chart.spiralPoints(2, 9, 34), out = []
    for (var i = 0; i < raw.length; i++) out.push(Qt.point(15 + raw[i].x, 15 + raw[i].y))
    return out
  }

  ItoIchor {
    x: 4; y: 4
    radius: 11
    ink: root.ink
    value: root.value
    hot: root.hot
    live: root.live
    amp: root.amp
  }
}

import QtQuick
import QtQuick.Shapes
import "ItoChart.js" as Chart
import "ItoLore.js" as Lore

// Radio static (the pocket radio of Silent Hill): the busiest core is past the 0.8 line, and the scale breaks up around it.
// 1 to 7 short radial strokes (Lore.staticCount: how far past the line) from r 80 outward, at the busiest ray's angle
// plus a seeded spread of up to 12 degrees either way (Lore.staticTicks, seeded by the ray's index so they do not jitter),
// drawn over the regular ticks. At `subtle` they are still. At `full` every time the count RISES they burst: opacity
// 0.7 -> 0.15 -> 0.7 -> 0.2 -> 0.7 over 600 ms (one SequentialAnimation, started by the edge, never looping).
//
// `angle` is the busiest ray's angle in degrees (12 o'clock, clockwise); `count` how many strokes (0: nothing); `seed` the ray's
// index. `live` is the panel-open flag and `amp` the motion amplitude: closed or amp 0, nothing moves. `pose` is for the lab:
// -1 in use, else a frozen opacity (the burst frame). Colours come only from `ink` (an ItoSealInk). Imports nothing from the shell.
Item {
  id: root

  property var ink: null
  property real size: 184
  property real angle: 0
  property int count: 0
  property int seed: 0
  property string lvl: "off"
  property bool live: false
  property real amp: 1
  property real pose: -1

  width: size
  height: size
  visible: lvl !== "off" && count > 0

  readonly property real half: size / 2
  readonly property real k: half / Chart.REFERENCE_R
  readonly property real ampDur: Math.min(amp, 1)
  readonly property color none: "transparent"
  // under 160 px at most five strokes, scaled with the seal
  readonly property int shown: Math.min(count, size < 160 ? 5 : 7)
  readonly property var ticks: Lore.staticTicks(shown, seed)

  readonly property var strokes: {
    var out = []
    for (var i = 0; i < ticks.length; i++) {
      var a = angle + ticks[i].dAngle
      var p = Chart.polar(a, 80 * k), q = Chart.polar(a, (80 + ticks[i].len) * k)
      out.push([Qt.point(half + p.x, half + p.y), Qt.point(half + q.x, half + q.y)])
    }
    return out
  }

  // opacity of the strokes; a value that is not a number between 0 and 1 falls back to the resting 0.7
  property real flash: 0.7
  function sane(v) { return (v >= 0 && v <= 1) ? v : 0.7 }

  Shape {
    anchors.fill: parent
    opacity: root.sane(root.pose >= 0 ? root.pose : root.flash)
    antialiasing: true
    ShapePath {
      strokeWidth: 1
      strokeColor: root.ink ? root.ink.hot : root.none
      fillColor: root.none
      capStyle: ShapePath.FlatCap
      PathMultiline { paths: root.strokes }
    }
  }

  // one burst per rising count, at full, while the panel is open and motion is on
  property int lastCount: 0
  onCountChanged: {
    if (count > lastCount && lvl === "full" && pose < 0 && live && amp > 0) burst.restart()
    lastCount = count
  }
  onLiveChanged: if (!live) { burst.stop(); flash = 0.7; lastCount = count }

  SequentialAnimation {
    id: burst
    NumberAnimation { target: root; property: "flash"; to: 0.15; duration: Math.round(120 * root.ampDur) }
    NumberAnimation { target: root; property: "flash"; to: 0.7; duration: Math.round(120 * root.ampDur) }
    NumberAnimation { target: root; property: "flash"; to: 0.2; duration: Math.round(120 * root.ampDur) }
    NumberAnimation { target: root; property: "flash"; to: 0.7; duration: Math.round(240 * root.ampDur) }
  }
}

import QtQuick
import "ItoChart.js" as Chart
import "ItoMotion.js" as Motion

// A groove cut in stone with liquid running in it: the bar of a row, a cell or a process line.
//
// The groove is `ink.track`; the liquid is a Rectangle whose width follows `fraction` through a spring (ItoSpring, one
// table of numbers) with a bead at its end (a bulge leading a rise, a flattened drag on a fall: surface tension lag).
// `notches` draws a ruler of 1 px lines every 10 % over the groove and the liquid. `threshold` (0..1, or below 0 for
// none) draws a 1 x 9 px mark at that fraction, above and below the groove. `hot` eases the liquid and its bead to
// `ink.hot`.
//
// Only Rectangles: width, x and scale change, nothing is redrawn. Everything is gated by `live` (the panel is open) and
// `amp` (motion amplitude): closed, it is a still picture and costs nothing. Colours come only from `ink` (an ItoSealInk).
Item {
  id: root

  property var ink: null
  property real fraction: 0
  property bool hot: false
  property real threshold: -1
  property bool notches: true
  property int grooveHeight: 5
  property int beadSize: 7
  property string kind: "row"
  property bool live: true
  property real amp: 1

  readonly property real ampDur: Math.min(amp, 1)
  readonly property real target: Chart.clamp(fraction, 0, 1)
  readonly property real shown: spring.shown
  readonly property real lag: Chart.clamp((target - shown) * 8, -0.3, 0.5)

  implicitHeight: 9
  height: implicitHeight

  ItoSpring { id: spring; target: root.target; kind: root.kind; live: root.live; amp: root.amp }

  property real hotMix: hot ? 1 : 0
  Behavior on hotMix {
    enabled: root.live && root.amp > 0
    NumberAnimation { duration: Math.round(Motion.normal * root.ampDur) }
  }
  readonly property color liquid: ink ? ink.mix(ink.fill, ink.hot, hotMix) : Qt.rgba(0.5, 0.5, 0.5, 1)

  Rectangle {
    id: groove
    anchors.verticalCenter: parent.verticalCenter
    width: parent.width; height: root.grooveHeight
    radius: height / 2
    color: root.ink ? root.ink.track : Qt.rgba(0.5, 0.5, 0.5, 0.14)
  }

  Rectangle {
    visible: root.target > 0 || root.shown > 0.001
    anchors.verticalCenter: parent.verticalCenter
    x: 0
    width: Math.max(root.grooveHeight, groove.width * root.shown)
    height: root.grooveHeight
    radius: height / 2
    color: root.liquid
    antialiasing: true
  }

  Rectangle {
    id: bead
    visible: root.target > 0 || root.shown > 0.001
    width: root.beadSize; height: root.beadSize; radius: width / 2
    anchors.verticalCenter: parent.verticalCenter
    x: Chart.clamp(groove.width * root.shown, root.beadSize / 2, Math.max(root.beadSize / 2, groove.width - root.beadSize / 2)) - width / 2
    color: root.liquid
    antialiasing: true
    transform: Scale { origin.x: bead.width / 2; origin.y: bead.height / 2; xScale: 1 + root.lag }
  }

  // the ruler, over the liquid too
  Repeater {
    model: root.notches ? 9 : 0
    Rectangle {
      required property int index
      x: Math.round(groove.width * (index + 1) / 10)
      width: 1
      height: root.grooveHeight
      anchors.verticalCenter: parent.verticalCenter
      color: root.ink ? root.ink.notch : Qt.rgba(0, 0, 0, 0.5)
    }
  }

  Rectangle {
    visible: root.threshold >= 0
    x: Math.round(groove.width * Chart.clamp(root.threshold, 0, 1))
    width: 1; height: 9
    anchors.verticalCenter: parent.verticalCenter
    color: root.ink ? Qt.rgba(root.ink.threshold.r, root.ink.threshold.g, root.ink.threshold.b, 0.6) : Qt.rgba(0.8, 0.3, 0.3, 0.6)
  }
}

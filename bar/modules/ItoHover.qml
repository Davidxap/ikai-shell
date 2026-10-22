import QtQuick 6.11
import "ItoSurfaces.js" as Surfaces

// What an icon does when the pointer is over it: a soft halo of the accent rises behind it, and the icon makes one small
// gesture that fits what it is (a bell rings, a spiral turns, a heart beats, a flame gutters...). One shared language, so
// every icon on the bar answers the same way.
//
//   kind   lift      it rises a little and brightens         (most things)
//          ring      it swings from its top, like a bell      (notifications)
//          spin      one slow turn                            (the menu spiral, the tray jar)
//          pulse     a heartbeat                               (the brain, the chip, the drive)
//          wiggle    a short shake                             (the eye that watches, the tape)
//          flicker   a candle in a draught                     (the coffee cup, the flame)
//          breathe   it swells and settles while the pointer stays (the moon, the fog)
//          equalizer it dances up and down like a sound meter    (the volume)
//          signal    three beeps, each a little larger            (the network, Bluetooth)
//
// Place it in the same widget as the icon and give it the icon as `target`. It costs nothing while the pointer is
// elsewhere: nothing runs, and the halo is not even visible. `amp` is the Motion setting: with 0 there is only the
// halo, no movement.
Item {
  id: root

  property Item target: null
  property bool hovered: false
  property string kind: "lift"
  property real amp: 1
  property var palette: null               // the widget's ItoConfig: the halo is its blood and the press bleed reads its theme
  property color glow: palette ? palette.blood : "transparent"
  property real light: 1
  property real haloSize: 1.9              // the halo's width as a multiple of the icon's

  width: target ? target.width * haloSize : 0
  height: width
  z: -1
  visible: halo.strength > 0.005

  function place() {
    if (!target || !parent) return
    var p = target.mapToItem(parent, target.width / 2, target.height / 2)
    x = p.x - width / 2
    y = p.y - height / 2
  }

  ItoGlow {
    id: halo
    anchors.fill: parent
    color: root.glow
    strength: root.hovered ? 0.34 * root.light : 0
    Behavior on strength { NumberAnimation { duration: 200 * Math.min(root.amp, 1) } }
  }

  // The press bleed (flag pressBleed, default off): a passive layer over the widget's own area, in the widget's coordinates, above its
  // click area so it sees the press first and leaves it to the widget. Nothing is created while the flag is off.
  Loader {
    parent: root.parent
    z: 5
    x: root.x; y: root.y; width: root.width; height: root.height
    active: root.palette !== null && Surfaces.on(root.palette, "pressBleed")
    sourceComponent: ItoStateLayer { cfg: root.palette; radius: root.width / 2 }
  }

  readonly property real d: Math.max(0.001, Math.min(amp, 1))   // time never scales past 1.0
  function rest() {
    if (!target) return
    target.scale = 1
    target.rotation = 0
  }

  onHoveredChanged: {
    place()
    ring.stop(); spin.stop(); pulse.stop(); wiggle.stop(); flicker.stop(); breathe.stop(); lift.stop(); settle.stop(); eq.stop(); signalBeat.stop()
    if (!target) return
    if (!hovered || kind !== "equalizer") target.transform = []
    // a manga icon (iconStyle manga) moves itself (ItoIconLive): it is told, and only the halo is drawn here
    if (target.ownsMotion === true && typeof target.hoverEdge === "function") target.hoverEdge(hovered)
    if (!hovered || amp <= 0 || target.ownsMotion === true) { settle.start(); return }
    if (kind === "ring") { target.transformOrigin = Item.Top; ring.start() }
    else if (kind === "spin") spin.start()
    else if (kind === "pulse") pulse.start()
    else if (kind === "wiggle") wiggle.start()
    else if (kind === "flicker") flicker.start()
    else if (kind === "breathe") breathe.start()
    else if (kind === "equalizer") { target.transform = eqScale; eq.start() }
    else if (kind === "signal") signalBeat.start()
    else lift.start()
  }

  // back to rest, briefly, when the pointer leaves
  ParallelAnimation {
    id: settle
    NumberAnimation { target: root.target; property: "scale"; to: 1; duration: 140; easing.type: Easing.OutCubic }
    NumberAnimation { target: root.target; property: "rotation"; to: 0; duration: 140; easing.type: Easing.OutCubic }
  }

  NumberAnimation { id: lift; target: root.target; property: "scale"; to: 1.09; duration: 150 * root.d; easing.type: Easing.OutBack }

  SequentialAnimation {
    id: ring
    NumberAnimation { target: root.target; property: "rotation"; to: 16; duration: 70 * root.d; easing.type: Easing.OutQuad }
    NumberAnimation { target: root.target; property: "rotation"; to: -13; duration: 110 * root.d; easing.type: Easing.InOutQuad }
    NumberAnimation { target: root.target; property: "rotation"; to: 9; duration: 100 * root.d; easing.type: Easing.InOutQuad }
    NumberAnimation { target: root.target; property: "rotation"; to: -5; duration: 90 * root.d; easing.type: Easing.InOutQuad }
    NumberAnimation { target: root.target; property: "rotation"; to: 2; duration: 80 * root.d; easing.type: Easing.InOutQuad }
    NumberAnimation { target: root.target; property: "rotation"; to: 0; duration: 80 * root.d }
  }

  SequentialAnimation {
    id: spin
    NumberAnimation { target: root.target; property: "rotation"; from: 0; to: 360; duration: 260 * root.d; easing.type: Easing.OutCubic }
    PropertyAction { target: root.target; property: "rotation"; value: 0 }
  }

  SequentialAnimation {
    id: pulse
    NumberAnimation { target: root.target; property: "scale"; to: 1.17; duration: 90 * root.d; easing.type: Easing.OutQuad }
    NumberAnimation { target: root.target; property: "scale"; to: 1.03; duration: 110 * root.d; easing.type: Easing.InOutQuad }
    NumberAnimation { target: root.target; property: "scale"; to: 1.12; duration: 90 * root.d; easing.type: Easing.OutQuad }
    NumberAnimation { target: root.target; property: "scale"; to: 1.06; duration: 180 * root.d; easing.type: Easing.InOutQuad }
  }

  SequentialAnimation {
    id: wiggle
    NumberAnimation { target: root.target; property: "rotation"; to: -8; duration: 60 * root.d }
    NumberAnimation { target: root.target; property: "rotation"; to: 8; duration: 90 * root.d }
    NumberAnimation { target: root.target; property: "rotation"; to: -5; duration: 80 * root.d }
    NumberAnimation { target: root.target; property: "rotation"; to: 3; duration: 70 * root.d }
    NumberAnimation { target: root.target; property: "rotation"; to: 0; duration: 70 * root.d }
    NumberAnimation { target: root.target; property: "scale"; to: 1.07; duration: 120 * root.d }
  }

  SequentialAnimation {
    id: flicker
    NumberAnimation { target: root.target; property: "scale"; to: 1.1; duration: 70 * root.d }
    NumberAnimation { target: root.target; property: "scale"; to: 1.03; duration: 60 * root.d }
    NumberAnimation { target: root.target; property: "scale"; to: 1.09; duration: 90 * root.d }
    NumberAnimation { target: root.target; property: "scale"; to: 1.05; duration: 100 * root.d }
    NumberAnimation { target: root.target; property: "scale"; to: 1.08; duration: 120 * root.d }
  }

  SequentialAnimation {
    id: breathe
    loops: Animation.Infinite
    NumberAnimation { target: root.target; property: "scale"; to: 1.12; duration: 900 * root.d; easing.type: Easing.InOutSine }
    NumberAnimation { target: root.target; property: "scale"; to: 1.03; duration: 900 * root.d; easing.type: Easing.InOutSine }
  }

  // the meter: the icon is stretched up and down from its middle, at a rate that never quite repeats
  Scale { id: eqScale; origin.x: root.target ? root.target.width / 2 : 0; origin.y: root.target ? root.target.height / 2 : 0; yScale: 1 }
  SequentialAnimation {
    id: eq
    loops: Animation.Infinite
    NumberAnimation { target: eqScale; property: "yScale"; to: 1.22; duration: 130 * root.d; easing.type: Easing.OutQuad }
    NumberAnimation { target: eqScale; property: "yScale"; to: 0.72; duration: 110 * root.d; easing.type: Easing.InOutQuad }
    NumberAnimation { target: eqScale; property: "yScale"; to: 1.12; duration: 90 * root.d; easing.type: Easing.OutQuad }
    NumberAnimation { target: eqScale; property: "yScale"; to: 0.85; duration: 150 * root.d; easing.type: Easing.InOutQuad }
    NumberAnimation { target: eqScale; property: "yScale"; to: 1.3; duration: 100 * root.d; easing.type: Easing.OutQuad }
    NumberAnimation { target: eqScale; property: "yScale"; to: 0.9; duration: 120 * root.d; easing.type: Easing.InOutQuad }
  }
  SequentialAnimation {
    id: signalBeat
    NumberAnimation { target: root.target; property: "scale"; to: 1.1; duration: 110 * root.d; easing.type: Easing.OutQuad }
    NumberAnimation { target: root.target; property: "scale"; to: 0.98; duration: 90 * root.d }
    NumberAnimation { target: root.target; property: "scale"; to: 1.18; duration: 120 * root.d; easing.type: Easing.OutQuad }
    NumberAnimation { target: root.target; property: "scale"; to: 1.0; duration: 100 * root.d }
    NumberAnimation { target: root.target; property: "scale"; to: 1.26; duration: 130 * root.d; easing.type: Easing.OutQuad }
    NumberAnimation { target: root.target; property: "scale"; to: 1.08; duration: 200 * root.d; easing.type: Easing.InOutQuad }
  }
}

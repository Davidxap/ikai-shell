import QtQuick

// Every living effect of a mark, in one place: the menu mark, the seal and the veins all use it.
//
// One clock (`t`) drives everything, and one envelope (`amount`) says how much of the effect is on. Switching
// on or off only moves the envelope, so an effect always eases in and settles back to rest, whatever it is.
// The clock runs only while something is animating: a hover-only effect costs nothing while the pointer is
// elsewhere.
//
//   kind    none · spin (Unwind) · breathe · heartbeat · flicker · sway · tear · ripple   (S14: pulse reads as breathe, glitch as tear)
//   active  whether the effect is on right now (a hover, or true for "always")
Item {
  id: root

  property string kind: "none"
  readonly property string eff: kind === "pulse" ? "breathe" : (kind === "glitch" ? "tear" : kind)
  property bool active: false
  property real speed: 1
  property real strength: 1
  property color color: "#c4162a"
  // Set to keep a ring or bloom drawn under the content for ripple; harmless for the other kinds.
  property real ringSize: 1.9

  default property alias content: holder.data

  readonly property bool running: eff !== "none" && (active || amount > 0.002)

  property real amount: (active && eff !== "none") ? 1 : 0
  Behavior on amount {
    NumberAnimation {
      duration: root.amount < 0.5 ? 380 : 700
      easing.type: Easing.BezierSpline
      easing.bezierCurve: [0.05, 0.7, 0.1, 1, 1, 1]
    }
  }

  property real t: 0

  FrameAnimation {
    running: root.running
    onTriggered: {
      var dt = frameTime
      root.t += dt * root.speed
      // tear: a CRT tear lasts 160 ms and comes back every 5 to 11 s
      if (root.eff === "tear" && root.t >= root.nextTear) { root.tearAt = root.t; root.nextTear = root.t + 5 + 6 * Math.random() }
    }
  }

  // spin is "Unwind" (S14): on the pointer it winds 1.25 turns and slackens back to rest, the Uzumaki way (ease 0.33, 0, 0.15, 1); off it unwinds the same way
  readonly property int unwindMs: 1500
  property real angle: 0
  onActiveChanged: {
    if (eff !== "spin") return
    windIn.stop(); windOut.stop()
    if (active) windIn.restart()
    else { windOut.to = Math.round(angle / 360) * 360; windOut.restart() }
  }
  SequentialAnimation {
    id: windIn
    loops: Animation.Infinite      // as long as it is on: wind, slacken, rest, again
    ScriptAction { script: root.angle = 0 }
    NumberAnimation { target: root; property: "angle"; to: 450; duration: root.unwindMs * 0.6; easing.type: Easing.BezierSpline; easing.bezierCurve: [0.33, 0, 0.15, 1, 1, 1] }
    NumberAnimation { target: root; property: "angle"; to: 360; duration: root.unwindMs * 0.4; easing.type: Easing.BezierSpline; easing.bezierCurve: [0.33, 0, 0.15, 1, 1, 1] }
    PauseAnimation { duration: root.unwindMs }
  }
  NumberAnimation {
    id: windOut
    target: root; property: "angle"
    duration: root.unwindMs * 0.5
    easing.type: Easing.BezierSpline; easing.bezierCurve: [0.33, 0, 0.15, 1, 1, 1]
    onStopped: if (!root.active) root.angle = 0
  }
  property real tearAt: -10
  property real nextTear: 3
  readonly property real tearAge: t - tearAt
  readonly property bool tearOn: tearAge >= 0 && tearAge < 0.16

  function bump(p, centre, width) {
    var d = (p - centre) / width
    return Math.exp(-d * d)
  }
  readonly property real k: strength
  readonly property real a: amount

  // -- the wave forms ------------------------------------------------------------------------------------
  readonly property real cycle: 0.5 - 0.5 * Math.cos(t * 2 * Math.PI / 1.1)
  readonly property real slow: 0.5 - 0.5 * Math.cos(t * 2 * Math.PI / 2.2)
  readonly property real beatPhase: (t % 1.25) / 1.25
  readonly property real beat: bump(beatPhase, 0.07, 0.045) + 0.7 * bump(beatPhase, 0.25, 0.055)
  readonly property real flickerGate: Math.max(0, Math.sin(t * 0.9 + 1) - 0.35) / 0.65
  readonly property real flickerNoise: Math.max(0, Math.sin(t * 43) * Math.sin(t * 17.3) + Math.sin(t * 7.7) * 0.6)
  // the failing tube (the S12 fluorescent pattern): mostly lit, with dips to 0.85 and, rarely, to 0.72
  readonly property real flickerLevel: flickerGate <= 0 ? 1 : (flickerNoise > 0.9 ? 0.72 : (flickerNoise > 0.35 ? 0.85 : 1))

  Item {
    id: holder
    anchors.fill: parent
    transformOrigin: Item.Center

    rotation: root.eff === "spin" ? root.angle
            : root.eff === "sway" ? 9 * root.k * root.a * Math.sin(root.t * 2 * Math.PI / 2.6)
            : 0
    scale: root.eff === "breathe" ? 1 + 0.045 * root.k * root.a * root.slow
         : root.eff === "heartbeat" ? 1 + 0.15 * root.k * root.a * root.beat
         : 1
    opacity: root.eff === "breathe" ? 1 - 0.38 * root.k * root.a * root.slow
           : root.eff === "flicker" ? 1 - (1 - root.flickerLevel) * root.a * Math.min(1, root.k)
           : root.eff === "tear" ? (root.tearOn ? 1 - 0.18 * root.a : 1)
           : 1
    // tear: the mark jerks sideways by 6 to 12 % of its width, then settles (the slices of the lab sheet need a shader the bar does not have)
    transform: Translate {
      x: root.eff === "tear" && root.tearOn ? Math.round(holder.width * (root.tearAge < 0.08 ? 0.09 : -0.04) * (Math.floor(root.tearAt * 7) % 2 === 0 ? 1 : -1) * root.a) : 0
    }
  }

  // ripple: a ring leaves the mark and fades out, again and again
  Rectangle {
    visible: root.eff === "ripple" && root.amount > 0.002
    anchors.centerIn: parent
    width: parent.width
    height: parent.height
    radius: width / 2
    color: "transparent"
    border.width: 1.4
    border.color: root.color
    readonly property real p: (root.t / 1.8) % 1
    scale: 1 + (root.ringSize - 1) * p * root.k
    opacity: (1 - p) * (1 - p) * 0.6 * root.amount
    z: -1
  }
}

import QtQuick
import QtQuick.Shapes
import "ItoIchor.js" as Ichor

// One drop of the viscous liquid: it forms at the source (its origin, the point at the top-centre of this item), sags
// and stretches on a neck, snaps, wobbles as it falls `fall` px and lands with a ring and two satellites. The whole
// life is one number, `phase` 0..1, turned into a pose by Ichor.dripPose() (the table is ItoIchor.js DRIP);
// everything is moved and scaled by transforms only (no per-frame geometry).
//
// A drop is DATA, never decoration: it appears only when `interval` (seconds between drops, from Ichor.dripInterval
// / writeDripInterval) says there is something pending or written, and never while the panel is closed, with the
// motion off, or with no data (`interval` 0). At most one drop is in flight.
//
// The lab (and a caller that wants to freeze a moment) sets `posePhase` >= 0: the drop is then drawn at that phase
// and nothing runs.
//
// `ink` is an ItoSealInk (the bulb is its `fill` and glow / clot tones, or the hot ones when `hot`), `live` is the
// panel-open flag, `amp` the motion amplitude (0 off, 1 calm, 1.7 lively), `unit` the vessel's scale (1 = full size).
Item {
  id: root

  property var ink: null
  property bool live: false
  property real amp: 1
  property real interval: 0        // seconds between drops; 0 none
  property real fall: Ichor.DRIP.fall   // px the drop falls
  property real unit: 1
  property bool hot: false
  property real posePhase: -1      // >= 0: draw this phase and run nothing

  property real phase: 0           // 0..1, driven by the animation below
  readonly property real shown: posePhase >= 0 ? posePhase : phase
  readonly property bool dropping: fallAnim.running
  readonly property real ampDur: Math.min(amp, 1)
  readonly property var pose: Ichor.dripPose(shown, fall, unit)
  readonly property bool visibleDrop: posePhase >= 0 || dropping

  // Lets a vessel know when the drop lets go (its surface recoils).
  signal detached()

  property bool _armed: false
  property real _delay: 0
  function _reschedule() { _delay = Ichor.dripDelay(interval > 0 ? interval : 6, Math.random(), amp) * 1000 }

  width: 1; height: 1
  visible: visibleDrop

  readonly property color noColor: Qt.rgba(0, 0, 0, 0)
  readonly property color bodyColor: ink ? (hot ? ink.hot : ink.fill) : noColor
  readonly property color glowColor: ink ? (hot ? ink.hotGlow : ink.glow) : noColor
  readonly property color clotColor: ink ? (hot ? ink.hotClot : ink.clot) : noColor
  // the bulb's centre: the teardrop's cusp (2.2 radii above it) is what joins the neck
  readonly property real bulbY: pose.y + pose.radius * 1.6

  onLiveChanged: { if (!live) { _armed = false; phase = 0 } else _reschedule() }
  onIntervalChanged: _reschedule()
  Component.onCompleted: _reschedule()

  // the wait before a drop forms; one at a time
  Timer {
    id: wait
    running: root.live && root.amp > 0 && root.interval > 0 && root.posePhase < 0 && !root._armed
    interval: root._delay
    repeat: false
    onTriggered: root._armed = true
  }

  NumberAnimation on phase {
    id: fallAnim
    running: root.live && root.amp > 0 && root._armed && root.posePhase < 0
    from: 0; to: 1; duration: Math.round(Ichor.DRIP.durationMs * root.ampDur)
    easing.type: Easing.Linear
    onStopped: { root._armed = false; root.phase = 0; root._reschedule() }
  }

  // signals the recoil once per drop, as the neck snaps
  property real _lastPhase: 0
  onShownChanged: {
    if (_lastPhase < Ichor.DRIP.stretch && shown >= Ichor.DRIP.stretch) detached()
    _lastPhase = shown
  }

  // the ring the landing spreads: a flat ellipse (an Item scaled in y), fading as it opens
  Item {
    visible: root.pose.ringOpacity > 0.001
    x: 0
    y: root.bulbY
    opacity: root.pose.ringOpacity
    transform: Scale { yScale: Ichor.DRIP.ringYScale }
    Rectangle {
      x: -root.pose.ringR; y: -root.pose.ringR
      width: 2 * root.pose.ringR; height: width
      radius: width / 2
      color: root.noColor
      border.width: root.pose.ringWidth
      border.color: root.ink ? root.ink.alpha(root.bodyColor, 0.7) : root.noColor
      antialiasing: true
    }
  }

  // two satellites jump out of the splash and fall back
  Repeater {
    model: 2
    Rectangle {
      required property int index
      readonly property real r: Ichor.DRIP.satR * root.unit
      visible: root.pose.satOpacity > 0.001
      x: (index === 0 ? -1 : 1) * root.pose.satDx - r
      y: root.bulbY - root.pose.satDy - r
      width: 2 * r; height: width
      radius: r
      opacity: root.pose.satOpacity
      color: root.bodyColor
      antialiasing: true
    }
  }

  // the neck: a bridge from the source to the bulb, as wide and as long as the pose says (it retracts when it snaps)
  Rectangle {
    visible: root.pose.neck > 0.05 && root.pose.neckLen > 0.05
    opacity: root.pose.opacity
    x: -root.pose.neck / 2
    y: 0
    width: root.pose.neck
    height: root.pose.neckLen
    radius: Math.min(width, height) / 2
    color: root.bodyColor
    antialiasing: true
  }

  // the bulb: a teardrop of unit radius, scaled; a radial ramp from the glow to the clot, and a small highlight
  Item {
    x: 0
    y: root.bulbY
    opacity: root.pose.opacity
    transform: Scale {
      xScale: root.pose.radius * root.pose.xScale
      yScale: root.pose.radius * root.pose.yScale
    }
    Shape {
      antialiasing: true
      ShapePath {
        strokeWidth: -1
        fillGradient: RadialGradient {
          centerX: -0.35; centerY: -0.35; centerRadius: 1.4
          focalX: -0.35; focalY: -0.35; focalRadius: 0
          GradientStop { position: 0; color: root.glowColor }
          GradientStop { position: 0.55; color: root.bodyColor }
          GradientStop { position: 1; color: root.ink ? root.ink.mix(root.bodyColor, root.clotColor, 0.6) : root.noColor }
        }
        PathPolyline { path: root.teardrop }
      }
    }
    // a bright dot on the upper left of the bulb (unit space: radius 0.28 at -0.4, -0.45)
    Rectangle {
      x: -0.4 - 0.28; y: -0.45 - 0.28
      width: 0.56; height: 0.56; radius: 0.28
      color: root.ink ? root.ink.alpha(root.ink.highlight, root.ink.highlightA) : root.noColor
      antialiasing: true
    }
  }

  readonly property var teardrop: {
    var raw = Ichor.teardropPoints(24), out = []
    for (var i = 0; i < raw.length; i++) out.push(Qt.point(raw[i].x, raw[i].y))
    return out
  }
}

pragma ComponentBehavior: Bound
import QtQuick
import "ItoIconMotion.js" as Motion

// A manga icon that moves (icons-v3.md section 5): ItoIconBake plus the edges that play ItoIconMotion. Nothing runs while it is
// idle. One NumberAnimation on `t` is started by an edge (the pointer arriving or leaving, a press, a state change, the first
// draw, a rare omen) and stops itself at the event's end; the pose at that end is the rest pose, so the icon is then exactly its
// plate. The hover arrives from the widget's ItoHover (`hoverEdge`, forwarded by ItoImage / ItoFillArt / ItoArt): a HoverHandler
// here would take the hover from the widget's MouseArea underneath (its tooltip; scripts/lab/tst_icon_live_events.qml), so
// the icon does not know where the pointer is and glances to a seeded side instead. The press is a PointHandler, which is
// passive: the click still reaches the widget. `amp` is the shell's motionAmp (0 = still: every event is skipped and the state changes instantly);
// `omens` is the iconOmens setting. No Timer, no FrameAnimation, no Behavior (scripts/qa/check-live-gates.sh, EDGE_ONLY).
Item {
  id: root

  property string kind: ""
  property var iconState: ({})
  property real size: 29
  property var roles: null
  property real amp: 1
  property bool omens: true
  property bool drawOn: true
  property int motionSeed: 1

  width: size
  height: size

  // the event playing ("" = none), its clock and serial number, and what the pose reads
  property string ev: ""
  property real t: 0
  property int n: 0
  property int which: 0
  property real px: 0
  property real py: 0
  property bool hovering: false
  property string lastKey: ""
  property var lastState: null

  // the motion's per-picture key (icons-v4.md section 0): the AI form, the indicator version and the sky have gestures of their own
  readonly property string mkind: kind === "ai" ? "ai:" + String((iconState && iconState.form) || "brain")
    : (kind === "indicator" ? "ind:" + String((iconState && iconState.version) || "") : (kind === "sky" ? "sky:" + String((iconState && iconState.sky) || "") : kind))

  readonly property var ctx: ({ rig: bake.parts ? bake.parts.rig : null, size: root.size, n: root.n, px: root.px, py: root.py,
                                which: root.which, seed: root.motionSeed, face: root.iconState ? root.iconState.face : "" })
  readonly property var pose: ev === "" || !(amp > 0) ? null : Motion.phase(mkind, ev, t, amp, motionSeed, ctx)
  readonly property var rp: pose ? pose.root : null

  function play(e) {
    if (!(amp > 0) || kind === "") { ev = ""; return }
    var d = Motion.duration(mkind, e, amp)
    if (!d) { if (e === "leave" && !clock.running) ev = ""; return }
    clock.stop()
    n = n + 1
    ev = e
    t = 0
    clock.duration = d
    clock.to = d
    clock.start()
  }
  function done() {
    if (clock.running) return
    // after any event the icon is at rest; with the pointer still over it, the hover's follow is held (its end pose)
    if (ev !== "leave" && hovering && amp > 0) { ev = "hover"; t = Motion.duration(mkind, "hover", amp) }
    else ev = ""
  }
  // the pointer arrived (true) or left: the hover's glance goes to a side seeded by the hover's serial number
  function hoverEdge(on) {
    if (on === hovering) return
    hovering = on
    if (on) {
      var g = Motion.glance(motionSeed, n + 1)
      px = g.px
      py = g.py
      play("hover")
    } else play("leave")
  }
  // a state change: the edge it plays, or (on a data update with no edge) the rare omen
  function stateEdge() {
    var key = bake.stepKey
    if (key === lastKey) return
    var cur = JSON.parse(key), prev = lastState
    lastKey = key
    lastState = cur
    if (prev === null) return
    var e = Motion.edge(mkind, prev, cur)
    if (kind === "mem" && e === "use") which = Math.max(0, Math.min(2, Math.floor(Math.max(0, Number(cur.value)) * 3 - 0.001)))
    if (mkind === "ai:neurons" && e === "soak") {     // the row the level crossed: A above y 17, B to y 30, C below
      var yl = 41.5 - 35 * Math.max(0, Math.min(1, Number(cur.value) || 0))
      which = yl < 17 ? 0 : (yl <= 30 ? 1 : 2)
    }
    if (e !== "") { play(e); return }
    var now = Date.now()
    if (ev === "" && Motion.omenDue(mkind, motionSeed, now, Motion.shared.last, omens, amp)) { Motion.shared.last = now; play("omen") }
  }

  ItoIconBake {
    id: bake
    kind: root.kind
    iconState: root.iconState
    size: root.size
    roles: root.roles
    pose: root.pose
    onStepKeyChanged: root.stateEdge()
    transform: [
      Scale { origin.x: root.rp ? root.rp.ox * root.size / 48 : 0; origin.y: root.rp ? root.rp.oy * root.size / 48 : 0
              xScale: root.rp ? root.rp.sx : 1; yScale: root.rp ? root.rp.sy : 1 },
      Rotation { origin.x: root.rp ? root.rp.ox * root.size / 48 : 0; origin.y: root.rp ? root.rp.oy * root.size / 48 : 0; angle: root.rp ? root.rp.rot : 0 },
      Translate { x: root.rp ? root.rp.dx * root.size / 48 : 0; y: root.rp ? root.rp.dy * root.size / 48 : 0 }
    ]
  }

  // started by play() only; it stops itself at `to` (never loops, never runs on its own)
  NumberAnimation {
    id: clock
    target: root
    property: "t"
    from: 0
    onStopped: root.done()
  }

  PointHandler {
    acceptedButtons: Qt.LeftButton | Qt.RightButton | Qt.MiddleButton
    onActiveChanged: if (active) root.play("press")
  }

  Component.onCompleted: {
    lastKey = bake.stepKey
    lastState = JSON.parse(bake.stepKey)
    if (drawOn) play("draw")
  }
}

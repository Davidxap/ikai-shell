import QtQuick 6.11
import "ItoSurfaces.js" as Surfaces
import "ItoMotion.js" as Motion
import "ItoStateLayer.js" as SL

// The press of the state layer: ink soaks into the paper from where it was pressed (visual-systems.md section 2.5).
//
// Put it over the widget with `anchors.fill: parent`. A PASSIVE PointHandler tells it where the press landed and leaves the press
// to the widget under it (a HoverHandler took the hover from the MouseArea in tst_icon_live_events.qml, so none is used). One blot,
// scaled from its press point to the far corner of the widget's inset rect; it fades to nothing exactly there, and it is cut to that inset
// rect, so it never shows outside the rounded shape as long as `radius` is the widget's corner radius. The colour is the theme's `press` overlay, never the accent.
//
// Sidecar key `pressBleed` (default off): off, the layer is invisible and does nothing. Motion 0 (or reduced motion): no bleed.
// It runs ONE animation per press, started by that press and ending by itself: no clock, no loop (EDGE_ONLY in check-live-gates.sh).
Item {
  id: root

  property var cfg: null
  property real radius: 0
  property bool pressable: true          // false for a disabled control: it gets no bleed

  readonly property bool armed: pressable && cfg !== null && Surfaces.on(cfg, "pressBleed") && cfg.motionAmp > 0
  readonly property var tone: cfg ? Surfaces.overlay("press", cfg.ink, cfg.bone, cfg.blood) : ({ token: { r: 0, g: 0, b: 0 }, alpha: 0 })

  property real progress: 1              // 1 = at rest (nothing drawn)
  property real reach: 0
  property real pressX: 0
  property real pressY: 0

  function fire(x, y) {
    if (!armed || width <= 0 || height <= 0) return
    pressX = x; pressY = y
    reach = SL.endR(x, y, width, height, radius)
    var r = Motion.role("bleed", cfg.motionAmp)
    grow.stop()
    grow.duration = r.duration
    grow.easing.bezierCurve = r.curve
    progress = 0
    grow.start()
  }

  // The blot is cut to the widget's rect inset by r(1 - 1/sqrt 2): that rect's corners sit exactly on the rounded corners, so nothing can
  // ever show outside the rounded shape, with no rounded clip and no shader (an axis-aligned clip is free in the scene graph).
  readonly property real inset: Math.max(0, radius) * (1 - Math.SQRT1_2)
  Item {
    visible: root.armed && root.progress < 1        // the layer itself stays visible: an invisible item gets no press
    anchors.fill: parent
    anchors.margins: root.inset
    clip: true
    ItoBleedShape {
      x: root.pressX - root.inset - width / 2
      y: root.pressY - root.inset - height / 2
      seed: Math.round(root.width / 16) * 31 + Math.round(root.height / 16) + 7
      scale: SL.scaleAt(root.progress, root.reach)
      opacity: SL.alphaAt(root.tone.alpha, root.progress, root.reach)
      color: Qt.rgba(root.tone.token.r, root.tone.token.g, root.tone.token.b, 1)
    }
  }

  NumberAnimation {
    id: grow
    target: root
    property: "progress"
    from: 0
    to: 1
    easing.type: Easing.BezierSpline
  }

  PointHandler {
    acceptedButtons: Qt.LeftButton
    onActiveChanged: if (active) root.fire(point.position.x, point.position.y)
  }
}

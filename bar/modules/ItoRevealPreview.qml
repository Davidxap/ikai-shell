import QtQuick 6.11
import "ItoPresence.js" as P

// A still of how a popup opens, for the Styles page (visual-v3.md section 4.2): a small fake card with three rows, held at one progress `u` of the
// opening `kind` (none | spiral | blot | static | lid), drawn by the REAL ItoPresenceMask / ItoPresenceLids on a stand-in for the running presence. `play()` runs the
// opening once (a one-shot, over the user's opening speed) so the page can show it when the pointer is on the card. Nothing else runs; nothing is written.
Item {
  id: root

  property var cfg: null                 // an ItoPreviewConfig
  property string kind: "spiral"
  property real u: 1                     // progress 0..1 of the opening
  readonly property color paper: cfg ? cfg.ink : "black"
  readonly property color bone: cfg ? cfg.bone : "white"
  readonly property color blood: cfg ? cfg.blood : "red"

  // how long the opening runs here, in ms: the user's `openDuration` (read from the real config behind `cfg`; 0 with motion off or reduced
  // motion, so the card shows the end state), unless a caller sets `openMs` (>= 0) itself. The mask takes 240 of the 340 base ms.
  property real openMs: -1
  readonly property var real_: cfg && cfg.source ? cfg.source : null
  readonly property real runMs: (openMs >= 0 ? openMs
    : real_ && real_.openDuration !== undefined ? (real_.motionAmp > 0 ? real_.openDuration : 0) : 340) * 240 / 340
  readonly property var curve: kind === "blot" ? P.BLEED : kind === "static" ? P.STATIC_EASE : kind === "spiral" ? P.SPIRAL_EASE : P.CURVES.decel

  function play() { if (kind === "spiral" || kind === "blot" || kind === "static" || kind === "lid") { anim.stop(); anim.start() } }

  // one-shot: 0 -> 1 over the opening's own length, started by the pointer entering the card, gone when it ends
  NumberAnimation { id: anim; target: root; property: "u"; from: 0; to: 1; duration: Math.round(root.runMs)
    easing.type: Easing.BezierSpline; easing.bezierCurve: root.curve }

  Rectangle {
    id: fake
    anchors.fill: parent
    radius: 3
    color: root.paper
    border.width: 1
    border.color: Qt.rgba(root.bone.r, root.bone.g, root.bone.b, 0.45)
    clip: true                           // nothing of the rows leaves the card, whatever size the caller gives it
    // three rows sized from the card's own height: a margin, then rows and gaps that always fit inside it
    readonly property real pad: Math.max(4, Math.min(14, Math.round(height * 0.2)))
    readonly property real gap: Math.max(2, Math.round(height * 0.09))
    readonly property real rowH: Math.max(2, Math.floor((height - 2 * pad - 2 * gap) / 3))
    Column {
      x: Math.min(10, Math.round(fake.width * 0.14)); y: fake.pad; width: fake.width - 2 * x; spacing: fake.gap
      Repeater {
        model: 3
        Rectangle { required property int index; width: parent.width * (1 - index * 0.18); height: fake.rowH; radius: Math.min(2, height / 2); color: Qt.rgba(root.bone.r, root.bone.g, root.bone.b, 0.45 - index * 0.08) }
      }
    }
  }

  // the stand-in for ItoPresence: the numbers the mask and the lids read
  QtObject {
    id: stub
    readonly property real mkv: root.kind === "lid" ? 1 : root.u
    property var ph: ({ mk: root.u, fill: 1, lu: root.u, ll: root.u })
    property var cardRect: ({ x: 0, y: 0, w: fake.width, h: fake.height })
    property var iconR: ({ x: fake.width / 2 - 8, y: -2, w: 16, h: 6 })
    property var rc: ({ x: 0, y: 0, w: fake.width, h: fake.height, r: 3 })
  }

  Loader {
    parent: fake
    z: 500
    width: fake.width; height: fake.height
    active: root.kind === "spiral" || root.kind === "blot" || root.kind === "static"
    sourceComponent: ItoPresenceMask { pres: stub; card: fake; run: true; kind: root.kind; side: "top"; edgeColor: root.bone }
  }
  Loader {
    parent: fake
    z: 500
    width: fake.width; height: fake.height
    active: root.kind === "lid"
    sourceComponent: ItoPresenceLids { pres: stub; paper: root.paper; line: root.bone; blood: root.blood; alert: false }
  }
}

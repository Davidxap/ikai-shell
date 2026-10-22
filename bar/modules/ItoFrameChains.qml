import QtQuick 6.11
import QtQuick.Shapes
import "ItoMotion.js" as Motion
import "ItoFrameStyles.js" as Styles

// The `chains` frame style: the shackled panel (ito-panel-presence/frame-styles.md section 5, lighting from icons-v5.md section 2.5: `ironHi`
// only on the upper-left edges, `iron` contours elsewhere, rust is not used). A 1 px rule at 0.4, two iron shackle plates at the top corners, a
// padlock at the bottom-right (roomy cards only), and a chain hanging from each plate ON the side rule (centre line 2 k inside the edge; 7 k on the side that faces
// a side bar, so nothing bleeds toward the bar). It carries NO inner rule.
//
// Motion, only while `live` (the popup is open and motion is on): both chains sway about their pivots, one clock (`phase`), the right chain a
// phase behind. The sway is a tip travel in px (decisions-b9 1.2, ItoFrameStyles.chainTip): it starts at min(8, 9 - 0.75 k, 13.4 - 4.75 k) and
// decays to 0.44 of it over 1.2 s, so the chain never bleeds more than 10 px outside the card nor reaches deeper than 14 px inside. In an alert the padlock opens and the left
// chain's last two links drop and turn, once, on a spring (240 ms). With `live` false nothing runs.
Item {
  id: root

  property var cfg: null
  property var ink: null
  property real reveal: 1
  property bool alert: false
  property bool live: false
  property real amp: 1
  property real k: 1
  property string barSide: "top"
  property size finalSize: Qt.size(width, height)
  property string art: "png"
  property url artBase
  property bool roomy: height >= 260
  property bool sheet: false
  property real anchorAlong: -1
  property real emblemOpacity: 0.85
  property alias chainL: chainLeft           // for the lab's bleed measurement
  property alias chainR: chainRight

  function fin(v, d) { v = Number(v); return isFinite(v) ? v : d }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }
  function stage(a, b) { return clamp((fin(reveal, 1) - a) / (b - a), 0, 1) }
  function ease(t) { return t * t * (3 - 2 * t) }

  readonly property real u: clamp(fin(k, 1), 0.8, 1.15)
  readonly property real cw: Math.max(0, width)
  readonly property real ch: Math.max(0, height)
  readonly property bool ready: !!ink && cw > 40 && ch > 40
  readonly property color bone: cfg ? cfg.bone : palette.windowText
  readonly property color cIron: ink ? ink.iron : "transparent"
  readonly property color cHi: ink ? ink.ironHi : "transparent"
  readonly property color cPanel: ink ? ink.panel : "transparent"

  // the outer rule: 1 px, bone 0.4 (the presence sheet draws it while it exists)
  Rectangle {
    anchors.fill: parent
    radius: 2
    visible: !root.sheet && root.ready
    color: "transparent"
    border.width: 1
    border.color: !root.ink ? "transparent" : root.alert ? root.ink.alertRule : root.ink.alpha(root.ink.bone, 0.4)
  }

  // ---- shackle plates, top-left and top-right: 16 x 16 k with the inner-bottom corner cut by 5 k; the lit edges (top, and the left of the shape) in ironHi
  component Plate: Item {
    id: pl
    property bool isRight: false
    readonly property real pa: 16 * root.u
    readonly property real pc: 5 * root.u
    // the shape's points, in the plate's own box (0..a), the outer corner at the card's corner
    readonly property var pts: isRight ? [[pa, 0], [0, 0], [0, pa - pc], [pc, pa], [pa, pa]] : [[0, 0], [pa, 0], [pa, pa - pc], [pa - pc, pa], [0, pa]]
    x: isRight ? root.cw - pa : 0; y: 0; width: pa; height: pa
    opacity: root.ease(root.stage(0, 0.5))
    scale: 0.85 + 0.15 * root.ease(root.stage(0, 0.5))
    transformOrigin: isRight ? Item.TopRight : Item.TopLeft
    Shape {
      anchors.fill: parent
      preferredRendererType: Shape.GeometryRenderer
      ShapePath {
        fillColor: root.cIron
        strokeColor: root.cIron
        strokeWidth: 0.8 * root.u
        startX: pl.pts[0][0]; startY: pl.pts[0][1]
        PathLine { x: pl.pts[1][0]; y: pl.pts[1][1] }
        PathLine { x: pl.pts[2][0]; y: pl.pts[2][1] }
        PathLine { x: pl.pts[3][0]; y: pl.pts[3][1] }
        PathLine { x: pl.pts[4][0]; y: pl.pts[4][1] }
        PathLine { x: pl.pts[0][0]; y: pl.pts[0][1] }
      }
      // the lit rim: the top edge and the left edge of the shape
      ShapePath {
        fillColor: "transparent"
        strokeColor: root.cHi
        strokeWidth: 0.8 * root.u
        capStyle: ShapePath.FlatCap
        startX: pl.isRight ? pl.pa : 0; startY: 0.4 * root.u
        PathLine { x: pl.isRight ? 0 : pl.pa; y: 0.4 * root.u }
      }
      ShapePath {
        fillColor: "transparent"
        strokeColor: root.cHi
        strokeWidth: 0.8 * root.u
        capStyle: ShapePath.FlatCap
        startX: pl.isRight ? 0.4 * root.u : 0.4 * root.u; startY: 0
        PathLine { x: 0.4 * root.u; y: pl.isRight ? pl.pa - pl.pc : pl.pa }
      }
    }
    // one rivet, 5 k in from the outer corner
    Rectangle {
      width: 2.8 * root.u; height: 2.8 * root.u; radius: width / 2; color: root.cHi
      x: (pl.isRight ? pl.pa - 5 * root.u : 5 * root.u) - width / 2; y: 5 * root.u - height / 2
    }
  }
  Plate { visible: root.ready; isRight: false }
  Plate { visible: root.ready; isRight: true }

  // ---- the chains
  readonly property real pitch: 7 * u
  readonly property int links: Math.max(5, Math.min(18, Math.round(0.42 * ch / pitch)))
  readonly property bool barFacing: barSide === "left" || barSide === "right"
  readonly property real leftX: barSide === "left" ? 7 * u : 2 * u        // the centre line: ON the side rule, 7 k in on the side that faces a side bar
  readonly property real rightX: barSide === "right" ? cw - 7 * u : cw - 2 * u
  readonly property real pivotY: 16 * u

  // one clock for both chains: phase 0..1 per full swing (3.2 s); runs only while the popup is open and motion is on
  property real phase: 0
  NumberAnimation on phase {
    from: 0; to: 1
    duration: Motion.dur(3200, root.amp, "panel") > 0 ? Motion.dur(3200, root.amp, "panel") : 3200
    loops: Animation.Infinite
    running: root.live && root.amp > 0 && root.ready
  }
  // the swing's settle: 1 at the open edge, 0 after 1.2 s
  property real settle: 1
  NumberAnimation {
    id: settleRun
    target: root; property: "settle"; from: 1; to: 0
    duration: Motion.dur(1200, root.amp, "panel")
    easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.CURVES.decel
  }
  onLiveChanged: if (live && amp > 0) { settle = 1; settleRun.restart() } else { settleRun.stop() }
  // tip travel (px) and the angle it means for each chain's own length; both chains use the same pair so they stay matched
  readonly property real tip: Styles.chainTip(u, clamp(fin(amp, 0), 0, 1.7), clamp(fin(settle, 0), 0, 1), barFacing)
  readonly property real swingL: Styles.chainAngle(tip, chainLeft.length)
  readonly property real swingR: Styles.chainAngle(tip, chainRight.length)
  readonly property real angL: live && amp > 0 ? swingL * Math.sin(2 * Math.PI * phase) : 0
  readonly property real angR: live && amp > 0 ? swingR * Math.sin(2 * Math.PI * (phase + 0.4)) : 0

  // the alert: the left chain's last two links give way (a spring, once); the padlock opens
  property real broken: alert ? 1 : 0
  Behavior on broken { enabled: root.live; NumberAnimation { duration: Motion.dur(240, root.amp, "panel"); easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.CURVES.spring } }

  ItoChain {
    id: chainLeft
    visible: root.ready
    x: root.leftX; y: root.pivotY
    ink: root.ink; k: root.u; count: root.links; end: "hook"
    angle: root.angL
    fall: root.broken; fallLinks: 2; hot: root.alert
    opacity: root.ease(root.stage(0.25, 0.75))
  }
  ItoChain {
    id: chainRight
    visible: root.ready
    x: root.rightX; y: root.pivotY
    ink: root.ink; k: root.u; count: root.links; end: "ring"
    angle: root.angR
    opacity: root.ease(root.stage(0.25, 0.75))
  }

  // ---- the padlock, bottom-right, roomy cards only; its shackle lifts 3 k and turns 20 degrees about its right foot in an alert
  Item {
    id: lock
    visible: root.ready && root.roomy
    width: 11 * root.u; height: 15 * root.u
    x: root.cw - 8 - width; y: root.ch - 8 - height
    opacity: root.ease(root.stage(0, 0.5))
    Rectangle {                                          // the shackle, a U 7 x 6 k: its lower half hides behind the body
      id: shackle
      x: 2 * root.u; y: 0; width: 7 * root.u; height: 10 * root.u; radius: 3.5 * root.u
      color: "transparent"; border.width: 1.6 * root.u; border.color: root.cIron
      transform: [
        Translate { y: -3 * root.u * root.broken },
        Rotation { origin.x: shackle.width; origin.y: 6 * root.u; angle: 20 * root.broken }
      ]
    }
    Rectangle { x: -0.4 * root.u; y: 6 * root.u - 0.4 * root.u; width: 11 * root.u; height: 9 * root.u; radius: 1.5 * root.u; color: root.cHi }
    Rectangle { y: 6 * root.u; width: 11 * root.u; height: 9 * root.u; radius: 1.5 * root.u; color: root.cIron }
    Rectangle { x: 5.5 * root.u - root.u; y: 8.6 * root.u; width: 2 * root.u; height: 2 * root.u; radius: root.u; color: root.cPanel }
    Rectangle { x: 5.5 * root.u - 0.4 * root.u; y: 10 * root.u; width: 0.8 * root.u; height: 2.2 * root.u; color: root.cPanel }
  }
}

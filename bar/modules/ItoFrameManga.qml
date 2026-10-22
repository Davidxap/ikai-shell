import QtQuick 6.11
import "ItoMotion.js" as Motion

// The `manga` frame style: the inked page (ito-panel-presence/frame-styles.md section 4). ItoPanelFrame loads it with a Loader and fills
// it over the card; the emblem, the memo and the opening flash stay in the frame, identical for every style.
//
// Two arts, one switch (sidecar `frameArt`, `art` here):
//   png    today's frame, moved here unchanged: mist, screentone, blood and the spiral as pictures, torn corners as pictures, the rules,
//          the blood crack in an alert. It is what ships.
//   drawn  manga v2 (icons-v5.md section 2.5): the same rules, mist and crack, but the corners, the screentone, the G-pen rule and the
//          alert's splatter are procedural (ItoFrameMangaArt, one Canvas); no spiral; the crack and the rule use `hot`; an alert adds the
//          kana ゴゴゴ; the speed lines (ItoSpeedLines) replace the opening static.
// The ItoFrameStyle contract (design.md): ink, reveal, alert, live, amp, k, barSide, finalSize.
Item {
  id: root

  property var cfg: null                    // the host's palette (an ItoConfig or an ItoPanelPalette)
  property var ink: null                    // an ItoFrameInk; only the drawn art reads it
  property real reveal: 1
  property bool alert: false
  property bool live: false
  property real amp: 1
  property real k: 1
  property string barSide: "top"
  property size finalSize: Qt.size(width, height)
  property string art: "png"
  property url artBase: Qt.resolvedUrl("ito-art/")
  property bool roomy: height >= 260
  property bool sheet: false                // the presence sheet draws the paper and the outer rule
  property real anchorAlong: -1             // where the icon meets the bar edge, for the speed lines
  property real emblemOpacity: 0.85
  readonly property bool drawn: art === "drawn" && !!ink

  readonly property color bone: cfg ? cfg.bone : palette.windowText
  readonly property real head: cfg && cfg.panelHeadroom !== undefined ? cfg.panelHeadroom : 26
  readonly property real foot: cfg && cfg.panelFootroom !== undefined ? cfg.panelFootroom : 24

  // the speed lines: called by the frame on the open edge
  function finish() { if (drawn && speed.item) speed.item.play() }

  // mist thickening towards the foot, the way Silent Hill's fog lies low
  Rectangle {
    anchors { left: parent.left; right: parent.right; bottom: parent.bottom; margins: 1 }
    height: parent.height * 0.35
    gradient: Gradient {
      GradientStop { position: 0; color: Qt.rgba(root.bone.r, root.bone.g, root.bone.b, 0) }
      GradientStop { position: 1; color: Qt.rgba(root.bone.r, root.bone.g, root.bone.b, 0.05) }
    }
  }

  // ---- today's pictures (art png) ----
  // screentone patch, top right
  ItoImage {
    palette: root.cfg
    visible: !root.drawn
    source: root.artBase + "misc/screentone.png"
    width: 64; height: 73
    anchors { top: parent.top; right: parent.right; topMargin: 6; rightMargin: 6 }
    opacity: 0.32
    smooth: true
  }

  // blood, bottom left
  ItoImage {
    palette: root.cfg
    visible: root.roomy && !root.drawn
    source: root.artBase + "misc/blood-splatter.png"
    width: 34; height: 40
    anchors { bottom: parent.bottom; left: parent.left; bottomMargin: 3; leftMargin: 3 }
    opacity: 0.55
    smooth: true
  }

  // the panel's rules: a firm outer line and a thin inner one
  Rectangle {
    anchors.fill: parent
    radius: 3
    visible: !root.sheet && !root.drawn
    color: "transparent"
    border.width: 1
    border.color: root.alert && root.cfg ? Qt.rgba(root.cfg.blood.r, root.cfg.blood.g, root.cfg.blood.b, 0.75) : Qt.rgba(root.bone.r, root.bone.g, root.bone.b, 0.6)
  }
  Rectangle {
    anchors { fill: parent; margins: 5 }
    radius: 1
    color: "transparent"
    border.width: 1
    border.color: Qt.rgba(root.bone.r, root.bone.g, root.bone.b, 0.24)
  }

  // a spiral, faint, low in the corner where nothing else lives
  ItoImage {
    palette: root.cfg
    visible: root.roomy && !root.drawn
    source: root.artBase + "system/menu-uzumaki.png"
    width: 22; height: 22
    anchors { bottom: parent.bottom; right: parent.right; bottomMargin: 4; rightMargin: 12 }
    opacity: 0.2
    smooth: true
  }

  // A crack runs up the left edge while something is wrong: a hairline drawn in the accent, so it follows the theme
  // (a picture of one would not). It is painted when it appears or the size or colour changes, and never animates.
  Canvas {
    id: crack
    width: 46
    height: Math.min(root.height * 0.55, 240)
    anchors { left: parent.left; bottom: parent.bottom; leftMargin: 2; bottomMargin: 10 }
    opacity: root.alert ? 1 : 0
    visible: opacity > 0.01
    Behavior on opacity { NumberAnimation { duration: 160 * Math.min(root.amp, 1) } }
    readonly property color line: root.drawn ? root.ink.hot : (root.cfg ? root.cfg.blood : root.palette.highlight)
    onLineChanged: requestPaint()
    onHeightChanged: requestPaint()
    onVisibleChanged: if (visible) requestPaint()
    onPaint: {
      var c = getContext("2d")
      c.reset()
      var h = height
      // the main fault: a jagged run from the foot upwards, drifting a little in from the edge
      var pts = [[2, h], [9, h * 0.86], [5, h * 0.74], [16, h * 0.6], [10, h * 0.47], [21, h * 0.33], [15, h * 0.2], [24, h * 0.06]]
      c.lineJoin = "miter"; c.lineCap = "round"
      c.strokeStyle = Qt.rgba(line.r, line.g, line.b, 0.9); c.lineWidth = 1.4
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1])
      for (var k = 1; k < pts.length; k++) c.lineTo(pts[k][0], pts[k][1])
      c.stroke()
      // three short branches, thinner
      c.lineWidth = 0.9; c.strokeStyle = Qt.rgba(line.r, line.g, line.b, 0.7)
      var br = [[5, h * 0.74, 1, h * 0.7], [16, h * 0.6, 32, h * 0.56], [10, h * 0.47, 3, h * 0.41], [21, h * 0.33, 38, h * 0.3]]
      for (var b = 0; b < br.length; b++) {
        c.beginPath(); c.moveTo(br[b][0], br[b][1]); c.lineTo(br[b][2], br[b][3]); c.stroke()
      }
    }
  }

  // torn corners, top left and bottom right
  ItoImage {
    palette: root.cfg
    visible: !root.drawn
    source: root.artBase + "misc/corner.png"
    width: 36; height: 43
    anchors { top: parent.top; left: parent.left }
    opacity: 0.9
    smooth: true
  }
  ItoImage {
    palette: root.cfg
    visible: !root.drawn
    source: root.artBase + "misc/corner.png"
    width: 36; height: 43
    anchors { bottom: parent.bottom; right: parent.right }
    rotation: 180
    opacity: 0.9
    smooth: true
  }

  // ---- manga v2 (art drawn) ----
  Loader {
    anchors.fill: parent
    active: root.drawn
    sourceComponent: ItoFrameMangaArt {
      ink: root.ink
      alert: root.alert
      roomy: root.roomy
      ruled: !root.sheet
      head: root.head
      foot: root.foot
    }
  }
  // the alert's sound effect, below the screentone: fades in over 200 ms
  Text {
    visible: root.drawn && opacity > 0.01
    opacity: root.alert ? 1 : 0
    Behavior on opacity { NumberAnimation { duration: Motion.dur(200, root.amp, "panel") } }
    text: "ゴゴゴ"
    color: root.drawn ? root.ink.alpha(root.ink.hot, 0.55) : "transparent"
    font.family: "Noto Serif CJK JP"
    font.weight: Font.Black
    font.pixelSize: Math.round(13 * root.k)
    rotation: -10
    anchors { top: parent.top; topMargin: 32; right: parent.right; rightMargin: 14 }
  }
  // the finisher
  Loader {
    id: speed
    anchors.fill: parent
    active: root.drawn
    sourceComponent: ItoSpeedLines {
      tone: root.ink.alpha(root.ink.bone, 0.28)
      barSide: root.barSide
      anchorX: root.anchorAlong
      amp: root.amp
      k: root.k
    }
  }
}

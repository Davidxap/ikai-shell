import QtQuick
import "../ItoMotion.js" as Motion

// A gallery card drawn as a manga panel (koma): an ink gutter around a panel whose border is thin on the lit side
// (top, left) and heavy on the shadow side (right, bottom), a narration box with the kanji and name, a thumbnail
// cut at a slight tilt, and a hanko stamp on the chosen one. Colours are pal tokens only. boot-lock-v2 §2.5.
Item {
  id: root

  property var host: null
  property var pal: null
  property string kanji: ""
  property string name: ""
  property string note: ""
  property string hint: ""
  property string source: ""            // thumbnail path ("" draws the kanji large on the panel ink)
  property bool current: false
  property bool thumbFit: false         // letterbox the thumbnail on the panel ink instead of cropping it (wide or tall stills)
  property bool unavailable: false      // fixed, needs a picture, font missing...: dimmed, screentoned, reason in note
  property string tone: Qt.resolvedUrl("../ito-art/surface/tone.png")
  readonly property bool hovered: hover.hovered

  signal activated()

  implicitWidth: 282
  implicitHeight: 193
  opacity: unavailable ? 0.45 : 1

  // the page around the panel
  Rectangle { anchors.fill: parent; color: root.pal.ink }

  Item {
    id: panel
    x: 6; y: 6
    width: parent.width - 12
    height: 160

    // the thumbnail container is sheared (a tilted cut); the caption box stays upright over it
    Item {
      id: cut
      anchors.fill: parent
      anchors.margins: 3
      clip: true
      transform: Matrix4x4 {
        matrix: Qt.matrix4x4(1, -0.06, 0, 0.06 * cut.height / 2,
                             0, 1, 0, 0,
                             0, 0, 1, 0,
                             0, 0, 0, 1)
      }

      Rectangle { anchors.fill: parent; color: root.pal.ink }
      Text {
        visible: root.source === "" || thumb.status !== Image.Ready
        anchors.centerIn: parent
        text: root.kanji
        color: root.pal.bone
        opacity: 0.22
        font.family: "Noto Serif CJK JP"
        font.pixelSize: 96
      }
      Image {
        id: thumb
        anchors.fill: parent
        source: root.source !== "" ? "file://" + root.source : ""
        fillMode: root.thumbFit ? Image.PreserveAspectFit : Image.PreserveAspectCrop
        asynchronous: true
        cache: false
        sourceSize.width: 532
        sourceSize.height: 300
        opacity: root.hovered ? 1.0 : 0.92
        Behavior on opacity { NumberAnimation { duration: Motion.normal } }
      }
      Image {
        visible: root.unavailable
        anchors.fill: parent
        source: root.tone
        fillMode: Image.Tile
        opacity: 0.18
      }
    }

    // panel border: lit side thin, shadow side heavy
    Rectangle { x: 0; y: 0; width: parent.width; height: 1; color: Qt.alpha(root.pal.bone, 0.55) }
    Rectangle { x: 0; y: 0; width: 1; height: parent.height; color: Qt.alpha(root.pal.bone, 0.55) }
    Rectangle {
      readonly property real w: root.hovered ? 3.5 : 2.5
      x: parent.width - w; y: 0; width: w; height: parent.height; color: Qt.alpha(root.pal.bone, 0.85)
    }
    Rectangle {
      readonly property real w: root.hovered ? 3.5 : 2.5
      x: 0; y: parent.height - w; width: parent.width; height: w; color: Qt.alpha(root.pal.bone, 0.85)
    }

    // the narration box
    Rectangle {
      x: 10; y: 10
      width: capText.implicitWidth + 16
      height: 22
      color: Qt.alpha(root.pal.ink, 0.72)
      border.width: 1
      border.color: Qt.alpha(root.pal.bone, 0.55)
      Text {
        id: capText
        anchors.centerIn: parent
        text: root.kanji + " " + root.name.toUpperCase()
        color: root.pal.bone
        font.family: "Noto Serif"
        font.pixelSize: 11
        font.letterSpacing: 1.5
      }
    }

    // the hanko, only on the chosen card
    Rectangle {
      visible: root.current
      width: 24; height: 24
      x: parent.width - width - 12; y: 10
      rotation: 6
      radius: 3
      color: root.pal.blood
      Text {
        anchors.centerIn: parent
        text: root.kanji
        color: root.pal.ink
        font.family: "Noto Serif CJK JP"
        font.pixelSize: 15
      }
    }
  }

  Text {
    x: 8
    y: 170
    width: parent.width - 16
    text: root.note
    elide: Text.ElideRight
    color: root.pal.bone
    opacity: 0.72
    font.family: "Noto Serif"
    font.pixelSize: 11
  }

  HoverHandler {
    id: hover
    cursorShape: root.unavailable ? Qt.ArrowCursor : Qt.PointingHandCursor
    onHoveredChanged: if (root.host) root.host.hint = hovered ? (root.hint || root.note) : ""
  }
  TapHandler { onTapped: if (!root.unavailable) root.activated() }
}

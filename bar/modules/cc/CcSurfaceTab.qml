import QtQuick
import "../ItoMotion.js" as Motion

// One surface tab of the Boot & Lock page, drawn as a small koma: a fixed slot holds the kanji (or the surface picture),
// the title and the live subtitle, and the state lozenge at the top right (boot-lock-v2 §2.2, §2.5):
//   off      hollow ring, bone 0.55          on       filled disc, bone
//   stale    half disc, bone outline         partial  warn outline
//   blocked  warn filled                     error    warn filled
Item {
  id: root

  property var host: null
  property var pal: null
  property string kanji: ""
  property string thumb: ""
  property string title: ""
  property string sub: ""
  property string state: "off"
  property string hint: ""
  property bool current: false
  readonly property bool hovered: hover.hovered
  readonly property bool warned: state === "partial" || state === "blocked" || state === "error"     // stale (out of date) is not a fault: its half disc says it, the page offers the update

  signal activated()
  signal repair()

  implicitWidth: 211
  implicitHeight: 76

  Rectangle { anchors.fill: parent; color: root.pal.ink }
  Item {
    anchors.fill: parent
    anchors.margins: 3
    clip: true

    Rectangle { anchors.fill: parent; color: Qt.alpha(root.pal.bone, root.current ? 0.07 : (root.hovered ? 0.05 : 0.025)) }
    // fixed 54 px slot: the kanji centred in it (or the surface's own picture, centre-cropped, once it exists)
    Item {
      id: slot
      x: 0; y: 0; width: 54; height: parent.height
      Text {
        anchors.centerIn: parent
        visible: root.thumb === "" || thumbImg.status !== Image.Ready
        text: root.kanji
        color: root.current ? root.pal.lit : root.pal.bone
        opacity: root.current ? 0.7 : 0.45
        font.family: "Noto Serif CJK JP"
        font.pixelSize: 28
      }
      Image {
        id: thumbImg
        anchors.fill: parent
        anchors.margins: 4
        source: root.thumb !== "" ? "file://" + root.thumb : ""
        fillMode: Image.PreserveAspectCrop
        asynchronous: true
        cache: false
        sourceSize.width: 96
        sourceSize.height: 96
        opacity: root.current ? 0.95 : 0.7
      }
      Rectangle { x: parent.width - 1; y: 8; width: 1; height: parent.height - 16; color: Qt.alpha(root.pal.bone, 0.18) }
    }
    Column {
      x: 64
      width: parent.width - 64 - 30
      anchors.verticalCenter: parent.verticalCenter
      spacing: 3
      Text {
        width: parent.width
        text: root.title
        elide: Text.ElideRight
        color: root.pal.bone
        font.family: "Noto Serif"
        font.pixelSize: 13
        font.weight: root.current ? Font.DemiBold : Font.Normal
      }
      Text {
        width: parent.width
        text: root.sub
        elide: Text.ElideRight
        color: root.warned ? root.pal.warn : root.pal.bone
        opacity: root.warned ? 1 : 0.72
        font.family: "Noto Serif"
        font.pixelSize: 11
      }
    }

    // the state lozenge
    Item {
      width: 12; height: 12
      x: parent.width - 18; y: 9
      Rectangle {
        anchors.fill: parent
        radius: 6
        color: root.state === "on" ? root.pal.bone
             : (root.state === "blocked" || root.state === "error") ? root.pal.warn : Qt.alpha(root.pal.ink, 0)
        border.width: 1.5
        border.color: root.state === "off" ? Qt.alpha(root.pal.bone, 0.55) : (root.warned ? root.pal.warn : root.pal.bone)
      }
      Rectangle {   // the half disc of "out of date"
        visible: root.state === "stale"
        x: 0; y: 0; width: 6; height: 12
        radius: 0
        color: Qt.alpha(root.pal.ink, 0)
        clip: true
        Rectangle { width: 12; height: 12; radius: 6; color: root.pal.bone }
      }
    }
  }

  // a warning lozenge points at the guided repair
  Item {
    visible: root.warned
    x: parent.width - 28; y: 3; width: 25; height: 25
    HoverHandler {
      id: lozHover
      cursorShape: Qt.PointingHandCursor
      onHoveredChanged: if (root.host) root.host.hint = hovered ? "Needs attention: click to open the guided repair in a terminal." : root.hint
    }
    TapHandler { onTapped: root.repair() }
  }

  // panel border: lit side thin, shadow side heavy; blood underline on the chosen tab
  Rectangle { x: 3; y: 3; width: parent.width - 6; height: 1; color: Qt.alpha(root.pal.bone, 0.55) }
  Rectangle { x: 3; y: 3; width: 1; height: parent.height - 6; color: Qt.alpha(root.pal.bone, 0.55) }
  Rectangle { x: parent.width - 3 - width; y: 3; width: root.hovered ? 3.5 : 2.5; height: parent.height - 6; color: Qt.alpha(root.pal.bone, 0.85) }
  Rectangle { x: 3; y: parent.height - 3 - height; width: parent.width - 6; height: root.hovered ? 3.5 : 2.5; color: Qt.alpha(root.pal.bone, 0.85) }
  Rectangle {
    x: 64; y: parent.height - 9
    width: 26; height: 2
    color: root.pal.blood
    opacity: root.current ? 1 : 0
    Behavior on opacity { NumberAnimation { duration: Motion.normal } }
  }

  HoverHandler {
    id: hover
    cursorShape: Qt.PointingHandCursor
    onHoveredChanged: if (root.host) root.host.hint = hovered ? root.hint : ""
  }
  TapHandler { onTapped: root.activated() }
}

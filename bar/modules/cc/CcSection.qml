import QtQuick
import QtQuick.Layouts
import "../ItoDefaults.js" as Defaults

// A section of a page: a heading you can click to fold or unfold what belongs to it, and a line saying what the
// section is. Whatever is written inside the section goes into its body, which only shows while it is open.
// Searching opens every section, so a match is never hidden behind a closed heading.
ColumnLayout {
  id: root

  property var pal: null
  property var host: null                 // the control centre, to know whether a search is running
  property string label: ""
  property string note: ""
  property bool startOpen: false          // how it begins; a click on the heading changes it for this visit
  default property alias body: bodyColumn.data

  // S13f: the sidecar keys of this section (the defaults registry, page + label) that are not at their default; "Reset section" shows only then
  property string scope: label            // the registry's section name when it differs from the heading
  readonly property var changedKeys: {
    if (!host || !pal || host.page === undefined) return []
    var _ = pal.values
    return Defaults.changed(String(host.page), scope, pal.get, pal.values)
  }

  property bool userOpen: startOpen
  readonly property bool searching: host !== null && host.query !== ""
  readonly property bool expanded: userOpen || searching

  Layout.fillWidth: true
  spacing: 3

  Item {
    Layout.fillWidth: true
    Layout.preferredHeight: 26

    RowLayout {
      anchors.fill: parent
      spacing: 10

      Text {
        text: "▸"
        rotation: root.expanded ? 90 : 0
        color: root.pal.blood
        font.pixelSize: 14
        Behavior on rotation { NumberAnimation { duration: 140; easing.type: Easing.OutCubic } }
      }

      Text {
        text: root.label
        color: root.pal.bone
        opacity: headHover.hovered ? 1 : 0.9
        font.family: "Noto Serif"
        font.pixelSize: 11
        font.weight: Font.DemiBold
        font.letterSpacing: 3
      }

      Rectangle {
        Layout.fillWidth: true
        height: 1
        color: root.pal.blood
        opacity: headHover.hovered ? 0.8 : 0.45
      }

      Text {
        visible: root.changedKeys.length > 0
        text: "↺ Reset section"
        color: root.pal.bone
        opacity: resetMouse.containsMouse ? 1 : 0.6
        font.family: "Noto Serif"
        font.pixelSize: 11
        MouseArea {
          id: resetMouse
          anchors.fill: parent
          anchors.margins: -4
          hoverEnabled: true
          cursorShape: Qt.PointingHandCursor
          onEntered: if (root.host) root.host.hint = "Put this section's " + root.changedKeys.length + " changed setting(s) back to the default (a backup is kept; Undo shows after)."
          onExited: if (root.host) root.host.hint = ""
          onClicked: root.host.actions.resetKeys(root.changedKeys)
        }
      }
    }

    HoverHandler {
      id: headHover
      cursorShape: Qt.PointingHandCursor
      onHoveredChanged: if (root.host) root.host.hint = hovered ? (root.expanded ? "Click to fold this section." : "Click to open this section.") : ""
    }
    TapHandler { onTapped: root.userOpen = !root.userOpen }
  }

  Text {
    visible: root.note !== ""
    Layout.fillWidth: true
    text: root.note
    color: root.pal.bone
    opacity: 0.55
    font.family: "Noto Serif"
    font.pixelSize: 11
    wrapMode: Text.WordWrap
  }

  ColumnLayout {
    id: bodyColumn
    Layout.fillWidth: true
    Layout.topMargin: 6
    spacing: 10
    visible: root.expanded
  }
}

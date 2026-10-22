import QtQuick
import "../ItoDefaults.js" as Defaults

// The small "↺" beside a control (S13f): it shows only when one of its sidecar keys is set to something other than the default of the
// defaults registry (ito-defaults.json), and one click puts them back (`ito-config reset --key`, which backs the sidecar up first).
// The slot is always 18 px wide so a row never shifts when the mark appears.
Item {
  id: root

  property var host: null
  property var pal: null
  property var keys: []
  readonly property var changed: {
    var _ = pal ? pal.values : null
    var out = []
    for (var i = 0; pal && i < keys.length; i++) if (Defaults.differs(String(keys[i]), pal.get)) out.push(String(keys[i]))
    return out
  }
  readonly property bool shown: changed.length > 0

  implicitWidth: 18
  implicitHeight: 18
  width: 18
  height: 18

  Text {
    anchors.centerIn: parent
    visible: root.shown
    text: "↺"
    color: root.pal ? root.pal.bone : "white"
    opacity: tap.containsMouse ? 1 : 0.55
    font.pixelSize: 14
  }

  MouseArea {
    id: tap
    anchors.fill: parent
    enabled: root.shown
    hoverEnabled: true
    cursorShape: Qt.PointingHandCursor
    onEntered: if (root.host) root.host.hint = "Not the default. Click to put it back."
    onExited: if (root.host) root.host.hint = ""
    onClicked: if (root.host && root.host.actions) root.host.actions.resetKeys(root.changed)
  }
}

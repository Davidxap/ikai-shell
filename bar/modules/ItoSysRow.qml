import QtQuick

// One line of a system panel: a small label, a groove with liquid showing a fraction, and the reading at the right.
// Set `fraction` below 0 for a reading that has no groove (a load average, a temperature in words): the value then
// takes the room the groove would have had. `hot` turns the liquid and its bead to the alert colour and shows the
// warning glyph beside the value when a reading runs high. `threshold` (0..1, below 0 for none) marks where "hot" starts.
//
// The groove is a ruler cut in stone (notches every 10 %) with liquid running in it: it settles on a new reading like
// something thick, a bead leading its end. See ItoGroove. Nothing moves between refreshes.
//
// Colours come only from `cfg` (through an ItoSealInk), so it follows the theme. Give it the panel's palette under a
// name this component has no property of (the widget's `tint`): `cfg: cfg` inside it would bind to its own, empty `cfg`.
// With no `cfg` it draws neutral grey, never a colour of its own. It imports nothing from the shell, so the offscreen
// lab can render it. `live` is the panel-open flag: closed, nothing animates (a caller with no such flag leaves it true;
// a row only ever moves when its reading changes). Motion follows `cfg.motionAmp` (0 is instant).
Item {
  id: root

  property var cfg: null
  property var ink: null            // an ItoSealInk shared by the panel; when null the row makes its own from `cfg`
  property string label: ""
  property string value: ""
  property real fraction: -1
  property bool hot: false
  property real threshold: -1
  property bool live: true
  property int labelWidth: 76
  property int labelElide: Text.ElideRight     // ElideMiddle suits a path (a mount point)
  property bool labelCaps: true                // a path keeps its case
  property int valueWidth: 100

  readonly property var seal: ink ? ink : ownInk
  readonly property bool hasBar: fraction >= 0
  readonly property real amp: cfg && cfg.motionAmp !== undefined ? cfg.motionAmp : 1

  ItoSealInk { id: ownInk; source: root.ink ? null : root.cfg }

  implicitHeight: 18
  height: implicitHeight

  Text {
    id: name
    anchors { left: parent.left; verticalCenter: parent.verticalCenter }
    width: root.labelWidth
    text: root.labelCaps ? root.label.toUpperCase() : root.label
    elide: root.labelElide
    color: root.seal.label
    font.family: "Noto Serif"; font.pixelSize: 9; font.letterSpacing: 1.4
    renderType: Text.NativeRendering
  }

  ItoGroove {
    visible: root.hasBar
    anchors.verticalCenter: parent.verticalCenter
    x: root.labelWidth + 8
    width: Math.max(0, root.width - root.labelWidth - root.valueWidth - 16)
    ink: root.seal
    fraction: Math.max(0, root.fraction)
    hot: root.hot
    threshold: root.threshold
    live: root.live
    amp: root.amp
  }

  ItoFlauros {
    visible: root.hot
    ink: root.seal
    anchors.verticalCenter: parent.verticalCenter
    x: root.width - valueText.contentWidth - width - 5
  }

  Text {
    id: valueText
    anchors { right: parent.right; verticalCenter: parent.verticalCenter }
    width: root.hasBar ? root.valueWidth : Math.max(0, root.width - root.labelWidth - 8)
    horizontalAlignment: Text.AlignRight
    text: root.value
    elide: Text.ElideRight
    color: root.seal.bone
    font.family: "Noto Serif"; font.pixelSize: 11
    renderType: Text.NativeRendering
  }
}

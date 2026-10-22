import QtQuick 6.11

// The `minimal` frame style: the quiet card (ito-panel-presence/frame-styles.md section 7). Radius 6, one 1 px rule at bone 0.3; no ornaments, no
// inner rule, no fog, no finisher; the emblem shows at 0.7. In an alert the rule turns `alertRule` and a 2 px bar in `hot` runs down the left edge,
// inset 12 at the top and the bottom. Static: no clock, no animation.
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
  property real emblemOpacity: 0.7

  readonly property bool ready: !!ink

  Rectangle {
    anchors.fill: parent
    radius: 6
    visible: !root.sheet && root.ready
    color: "transparent"
    border.width: 1
    border.color: !root.ink ? "transparent" : root.alert ? root.ink.alertRule : root.ink.alpha(root.ink.bone, 0.3)
  }
  Rectangle {
    visible: root.alert && root.ready
    x: 0; y: 12; width: 2; height: Math.max(0, root.height - 24); radius: 1
    color: root.ready ? root.ink.hot : "transparent"
  }
}

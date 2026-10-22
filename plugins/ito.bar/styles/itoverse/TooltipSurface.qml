import QtQuick
import "../../../../bar/modules" as Ito

// Ito-verse tooltip: the theme's background and foreground with a thin edge of the foreground. The edge takes the
// accent only when the user turns "Tint labels with the accent" on.
//
// Written to tolerate a host that has not injected `bar` yet. The fork's own tooltip
// dereferences bar.visualTokens without a guard and throws a TypeError at startup; the same
// mistake, repeated across Shibumi's widgets, accounts for nearly all of its journal errors.
Item {
  id: root

  property var bar: null

  Ito.ItoConfig {
    id: cfg
    path: Qt.resolvedUrl("../../../../bar/modules/ito-style.json").toString().replace("file://", "")
  }
  readonly property bool tinted: cfg.get("tooltipBlood", false) === true
  readonly property var tokens: bar && bar.visualTokens ? bar.visualTokens : null
  readonly property string resolvedText: {
    const target = bar ? bar.tooltipTarget : null
    return target && target.tooltipText !== undefined
      ? String(target.tooltipText) : String(bar ? bar.tooltipText || "" : "")
  }

  // Entrance: a short fade and a small slide towards the bar. Both run on the render thread, and only when a
  // label appears or moves to another target, so an idle bar costs nothing. Motion "off" makes it instant.
  readonly property real amp: cfg.motionAmp
  property real enter: 1
  Connections {
    target: root.bar
    function onTooltipShownChanged() { if (root.bar && root.bar.tooltipShown) root.restartEnter() }
    function onTooltipTargetChanged() { if (root.bar && root.bar.tooltipShown) root.restartEnter() }
  }
  function restartEnter() {
    enterAnim.stop()
    if (amp <= 0) { enter = 1; return }
    enter = 0
    enterAnim.start()
  }
  NumberAnimation {
    id: enterAnim
    target: root
    property: "enter"
    to: 1
    duration: Math.round(150 * Math.min(root.amp, 1))
    easing.type: Easing.OutCubic
  }

  implicitWidth: bubble.implicitWidth
  implicitHeight: bubble.implicitHeight

  Rectangle {
    id: bubble

    anchors.fill: parent
    opacity: root.enter
    transform: Translate { y: (1 - root.enter) * -5 * root.amp }
    implicitWidth: label.implicitWidth + 2 * (root.tokens ? root.tokens.tooltipPaddingX : 10)
    implicitHeight: label.implicitHeight + 2 * (root.tokens ? root.tokens.tooltipPaddingY : 4)
    color: Qt.rgba(cfg.ink.r, cfg.ink.g, cfg.ink.b, 0.94)
    border.color: root.tinted ? Qt.darker(cfg.blood, 1.6) : Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.35)
    border.width: 1
    radius: root.tokens ? root.tokens.tooltipRadius : 6

    Ito.ItoElevation { cfg: cfg; level: 1 }

    Text {
      id: label

      anchors.centerIn: parent
      text: root.resolvedText
      color: cfg.bone
      font.family: "Noto Serif CJK JP"
      font.pixelSize: 12
      font.letterSpacing: 0.5
      renderType: Text.NativeRendering
    }
  }
}

import QtQuick
import QtQuick.Shapes
import "ItoChart.js" as Chart

// One mount of the Disk panel: a 12 px index glyph, then a reskinned ItoSysRow (the mount point, a groove with the used
// share and a mark at 90 %, "used / size" as text). The glyph is the platter in miniature: `ringCount` concentric circles
// with this row's own ring (`ringIndex`, 0 outermost) filled, so the row maps to its ring on the seal. It turns to the
// alert colour with the row.
//
// The lore pass (`lvl` off | subtle | full; off draws none of it and keeps the row exactly as it was): `extra` subvolumes folded into this
// row are drawn as up to three pale copies of the glyph behind it, each 1.5 px further down and right (the Black Paradox doubles), and
// `saveTarget` marks the mount with the most free space with a small accent square between the glyph and the row (the red save
// square of Silent Hill). With the lore on, the row's lead is 20 px instead of 16 on EVERY row, so the grooves stay aligned.
//
// Give it the panel palette as `cfg` (the widget's `tint`) or a shared `ink` (an ItoSealInk). `live` is the panel-open
// flag: closed, nothing animates. Imports nothing from the shell, so the offscreen lab can render it.
Item {
  id: root

  property var cfg: null
  property var ink: null
  property int ringIndex: 0
  property int ringCount: 1
  property string label: ""
  property string value: ""
  property real fraction: 0
  property bool hot: false
  property real threshold: 0.9
  property bool live: true
  property string lvl: "off"
  property int extra: 0
  property bool saveTarget: false
  // on a narrow column the label and value shrink so the groove keeps some length
  property int labelWidth: width < 300 ? 72 : 96
  property int valueWidth: width < 300 ? 98 : 112

  readonly property var seal: ink ? ink : ownInk
  ItoSealInk { id: ownInk; source: root.ink ? null : root.cfg }

  implicitHeight: 18
  height: implicitHeight

  // the glyph: circles from r 5.6 inwards, the row's own ring drawn thick and filled
  readonly property int rings: Math.max(1, Math.min(6, ringCount))
  readonly property real pitch: Math.min(2.2, 4.3 / rings)
  component Rings: Item {
    id: rg
    property bool ghost: false
    width: 12; height: 12
    Repeater {
      model: root.rings
      Shape {
        id: circle
        required property int index
        readonly property bool own: index === root.ringIndex
        readonly property real r: 5.8 - root.pitch * (index + 0.5)
        anchors.fill: parent
        antialiasing: true
        ShapePath {
          strokeWidth: circle.own ? root.pitch * 0.85 : 0.7
          strokeColor: rg.ghost ? root.seal.alpha(root.seal.rule, 0.35) : (circle.own ? (root.hot ? root.seal.hot : root.seal.fill) : root.seal.tick)
          fillColor: Qt.rgba(0, 0, 0, 0)
          startX: 6 + circle.r; startY: 6
          PathAngleArc { centerX: 6; centerY: 6; radiusX: circle.r; radiusY: circle.r; startAngle: 0; sweepAngle: 360 }
        }
      }
    }
  }
  Item {
    id: glyph
    x: 0; width: 12; height: 12
    anchors.verticalCenter: parent.verticalCenter
    // the doubles: behind the glyph, the furthest first
    Repeater {
      model: root.copies
      Rings {
        required property int index
        ghost: true
        x: 1.5 * (root.copies - index); y: x
        z: -1 - index
      }
    }
    Rings {}
  }
  // the save square: 4 x 4 in a 6 px slot right of the glyph
  Rectangle {
    visible: root.lvl !== "off" && root.saveTarget
    x: 15; width: 4; height: 4
    anchors.verticalCenter: parent.verticalCenter
    color: root.seal.fill
    antialiasing: true
  }

  readonly property int copies: lvl !== "off" ? Math.min(Math.max(0, extra), 3) : 0
  readonly property real lead: lvl !== "off" ? 20 : 16
  ItoSysRow {
    x: root.lead
    width: root.width - root.lead
    cfg: root.cfg
    ink: root.seal
    live: root.live
    label: root.label
    labelElide: Text.ElideMiddle
    labelCaps: false
    labelWidth: root.labelWidth
    valueWidth: root.valueWidth
    value: root.value
    fraction: root.fraction
    hot: root.hot
    threshold: root.threshold
  }
}

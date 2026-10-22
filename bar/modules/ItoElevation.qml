import QtQuick
import "ItoSurfaces.js" as Surfaces

// Elevation as cast ink (visual-systems.md section 2.4): hard offset slivers along the lower and right edges of the sheet it is a
// child of, never a blur. Colour is the theme's shadow token (ItoSurfaces.overlay "shadow"), so it follows the theme and its class.
// Strips lie outside the sheet's rectangle, so a translucent sheet is not darkened. `cfg` is an ItoConfig; `level` 0..3; flag
// `elevation` (flat | ink): flat draws nothing, whatever the level. The change of level animates with the `settle` role.
Item {
  id: root

  property var cfg: null
  property real level: 0
  property Item target: parent
  readonly property bool active: cfg !== null && String(cfg.get("elevation", "flat")) === "ink"
  property real shown: active ? level : 0
  Behavior on shown { ItoAnim { role: "settle"; amp: root.cfg ? root.cfg.motionAmp : 1 } }

  readonly property var shadow: cfg ? Surfaces.overlay("shadow", cfg.ink, cfg.bone, cfg.blood) : { token: { r: 0, g: 0, b: 0 }, alpha: 0 }
  readonly property var geo: Surfaces.elevation(shown, shadow.alpha)

  anchors.fill: parent
  z: -1
  visible: geo.n > 0
  enabled: false

  Repeater {
    model: 3
    delegate: Item {
      id: layer
      required property int index
      readonly property var l: root.geo.layers[index]
      visible: l !== undefined
      anchors.fill: parent
      // the bottom edge, shifted right by the offset, and the right edge, shifted down
      Rectangle {
        x: layer.l ? layer.l.ox : 0
        y: root.target ? root.target.height : 0
        width: root.target ? root.target.width : 0
        height: layer.l ? layer.l.oy : 0
        color: Qt.rgba(root.shadow.token.r, root.shadow.token.g, root.shadow.token.b, layer.l ? layer.l.alpha : 0)
      }
      Rectangle {
        x: root.target ? root.target.width : 0
        y: layer.l ? layer.l.oy : 0
        width: layer.l ? layer.l.ox : 0
        height: root.target ? root.target.height - (layer.l ? layer.l.oy : 0) : 0
        color: Qt.rgba(root.shadow.token.r, root.shadow.token.g, root.shadow.token.b, layer.l ? layer.l.alpha : 0)
      }
    }
  }
}

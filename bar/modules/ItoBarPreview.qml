import QtQuick 6.11
import "ItoSurfaces.js" as Surfaces

// A still preview of the bar for the Styles page (visual-v3.md section 4.2): two islands with three glyph blocks each on the real plate, the gap between
// them and the surface world. 206 x 64 by default. Nothing runs and nothing is written.
// `cfg` is an ItoPreviewConfig (its overrides carry the key being previewed: surfaceWorld). Built only while its card is visible
// and its section open (the caller's Loader).
Item {
  id: root

  property var cfg: null
  readonly property real isl: 82              // the island's width
  readonly property real ih: 34               // and height
  readonly property real gap: 14

  readonly property var look: Surfaces.resolve(cfg)


  Repeater {
    model: 2
    delegate: Item {
      id: island
      required property int index
      x: (root.width - 2 * root.isl - root.gap) / 2 + index * (root.isl + root.gap)
      y: (root.height - root.ih) / 2
      width: root.isl; height: root.ih

      ItoPlate {
        anchors.fill: parent
        palette: root.cfg && root.cfg.source ? root.cfg.source : root.cfg      // the real config: the plate's theme shader reads it
        radius: 12
        artBase: Qt.resolvedUrl("ito-art/")
        plate: root.look.plate
        veins: root.look.veins
        wood: root.look.wood
        calm: root.look.calm
        grain: root.look.grain
        tone: root.look.tone
        lift: root.look.lift
        border: root.look.border
        torn: root.look.torn
        fog: root.look.fog
        world: root.look.world
        rot: root.look.rot
      }
      // three glyph blocks (the widgets), in the bone token
      Row {
        anchors.centerIn: parent
        spacing: 12
        Repeater {
          model: 3
          Rectangle {
            width: 12; height: 12; radius: 3
            color: "transparent"
            border.width: 1.2
            border.color: Qt.rgba(root.cfg.bone.r, root.cfg.bone.g, root.cfg.bone.b, 0.75)
          }
        }
      }
    }
  }
}

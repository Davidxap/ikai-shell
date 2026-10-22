import QtQuick
import "ItoIconMap.js" as IconMap

// A data glyph made from the design sheet's own inked art.
//
// The sheet already draws the STATES: a spiral that is calm, then active, then urgent;
// an eye that closes, opens, reddens and bleeds; wifi weak, normal, off. So the value
// does not need a drawn symbol, it needs to pick between those states. `sources` is
// ordered from calm to severe and the value (0..1) crossfades between neighbours, so
// the art moves through its states smoothly instead of snapping.
//
// It fits each image into a square box preserving its aspect, so a wide icon and a
// tall one carry the same visual weight at one `size`.
Item {
  id: root

  property var sources: []          // urls, calm -> severe
  property real value: 0            // 0..1
  property int size: 32
  property real alpha: 1
  property var palette: null        // an ItoConfig, so the art follows the shell's colours

  width: size
  height: size
  // iconStyle manga: when the pictures are ones the manga map knows, they are drawn and move themselves (ItoIconLive), so
  // ItoHover keeps only its halo
  readonly property bool ownsMotion: !!palette && sources.length > 0
    && IconMap.drawn(String(palette.iconStyle || "current"), String(palette.iconStyleOverrides || ""), String(sources[0]), true) !== null
  function hoverEdge(on) { for (var i = 0; i < pics.count; i++) if (pics.itemAt(i)) pics.itemAt(i).hoverEdge(on) }

  function weight(i) {
    var n = sources.length
    if (n < 2) return 1
    var step = 1 / (n - 1)
    return Math.max(0, 1 - Math.abs(Math.max(0, Math.min(1, value)) - i * step) / step)
  }

  Repeater {
    id: pics
    model: root.sources

    ItoImage {
      palette: root.palette
      required property int index
      required property var modelData
      anchors.fill: parent
      source: modelData
      fillMode: Image.PreserveAspectFit
      smooth: true
      mipmap: true
      opacity: root.alpha * root.weight(index)
      visible: opacity > 0.01
    }
  }
}

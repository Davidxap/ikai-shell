import QtQuick 6.11
import "ItoFrameStyles.js" as Styles

// A still preview of a popup frame style for the Control Centre cards (frame-styles.md section 10): the real style item (ItoFrame<Name>.qml) at
// card size, fully revealed, with nothing running (`live` false), over the card's ground. `styleKey` plain draws the shell's own card edge.
// Built only while its card is visible and its section open (the caller's Loader).
Item {
  id: root

  property var pal: null                 // the shell's ItoConfig
  property string styleKey: "manga"      // manga | chains | otherworld | minimal | plain
  property bool alert: false
  property string art: "png"             // the manga style's art: png | drawn (sidecar `frameArt`)

  ItoPanelPalette { id: tint; source: root.pal }
  ItoFrameInk { id: frameInk; source: tint }

  Rectangle {
    anchors.fill: parent
    radius: root.styleKey === "plain" ? 8 : Styles.radius(root.styleKey)
    color: root.pal ? root.pal.ink : "transparent"
    border.width: root.styleKey === "plain" ? 1 : 0
    border.color: root.pal ? Qt.rgba(root.pal.bone.r, root.pal.bone.g, root.pal.bone.b, 0.25) : "transparent"
  }
  Loader {
    anchors.fill: parent
    active: root.styleKey !== "plain" && width > 40
    source: Styles.file(root.styleKey)
    onLoaded: {
      item.ink = frameInk; item.cfg = tint; if (item.art !== undefined) item.art = root.art; item.reveal = 1; item.live = false; item.amp = 0; item.sheet = false
      item.k = Math.max(0.8, Math.min(1.15, width / 380)); item.alert = Qt.binding(function () { return root.alert })
    }
  }
}

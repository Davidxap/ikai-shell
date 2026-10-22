import QtQuick
import QtQuick.Shapes
import "ItoIconInk.js" as Ink

// The one hard highlight of a manga icon (icons-v2.md section 3.3): a paper sliver or notch on the lit side, drawn as a tiny
// Shape over the bake so a hover can slide it (`dx`, in px) without repainting anything. No clock, no Behavior; the host
// animates `dx` if it wants. Colour: `roles.paper` (ItoIconInk.roles); none is written here.
Item {
  id: root

  property var parts: null
  property var roles: null
  property real size: 29
  property real dx: 0

  width: size
  height: size
  readonly property string path: parts && parts.highlight ? Ink.svg(parts.highlight.polys) : ""
  readonly property color none: Qt.alpha(palette.window, 0)
  // theme tone: the paper sliver is cut (not drawn) on a light bar and wherever it would not stand out from the line
  readonly property bool themed: !!roles && roles.tone === "theme" && !!roles.theme
  readonly property color paperColor: themed ? (roles.theme.paper.cut ? none : Qt.color(Ink.css(roles.theme.paper.c))) : Qt.color(Ink.css(roles.paper))

  Shape {
    width: 48; height: 48
    x: root.dx
    preferredRendererType: Shape.CurveRenderer
    antialiasing: true
    transform: Scale { xScale: root.size / 48; yScale: root.size / 48 }
    ShapePath {
      strokeWidth: -1
      fillColor: root.roles && root.path !== "" ? root.paperColor : root.none
      PathSvg { path: root.path }
    }
  }
}

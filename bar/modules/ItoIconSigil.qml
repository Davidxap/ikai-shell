pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Shapes
import "ItoIconInk.js" as Ink

// The T0 sigil of a manga icon (icons-v2.md section 3.3) for S sizes (<= 20 px): at most 6 filled paths
// (ItoIconInk.sigilParts, the highlight included), no Canvas, no clock, no Behavior: it draws what it is given.
// Colours come in `roles` (ItoIconInk.roles); this file writes none, and with no roles it draws nothing.
Item {
  id: root

  property string kind: ""
  property var iconState: ({})
  property real size: 16
  property int seed: 1
  property var roles: null

  width: size
  height: size

  readonly property var paths: {
    if (kind === "") return []
    var out = Ink.sigilParts(kind, iconState, size, seed, { master: "S", pale: !!(roles && roles.pale) })
    var ip = Ink.iconParts(kind, iconState, size, seed, { master: "S" })
    if (ip && ip.highlight) out.push({ role: "paper", path: Ink.svg(ip.highlight.polys) })
    return out
  }
  readonly property color none: Qt.alpha(palette.window, 0)
  // a role colour ({r,g,b} from ItoIconInk.roles) as a colour value; built from the numbers, never written here
  function colorOf(p) { return roles && p && roles[p.role] ? Qt.color(Ink.css(roles[p.role])) : none }

  Shape {
    id: sh
    width: 48; height: 48
    preferredRendererType: Shape.CurveRenderer
    antialiasing: true
    transform: Scale { xScale: root.size / 48; yScale: root.size / 48 }
    // six fixed slots: an empty slot draws nothing, so no path is created or removed when the state changes
    Instantiator {
      model: 6
      delegate: ShapePath {
        id: sp
        required property int index
        readonly property var part: index < root.paths.length ? root.paths[index] : null
        strokeWidth: -1
        fillColor: root.colorOf(part)
        PathSvg { path: sp.part ? sp.part.path : "" }
      }
      onObjectAdded: function(i, o) { sh.data.push(o) }
    }
  }
}

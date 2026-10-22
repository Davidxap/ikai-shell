import QtQuick
import QtQuick.Shapes
import "ItoEyeReal.js" as EyeR

// The T0 sigil of the real eye (eyes-v2.md section 4): below 24 px an eye is a handful of filled paths, not a Canvas. At most 6 paths
// (ItoEyeReal.sigilParts), no clock, no animation, no Behavior: it draws what it is given. Colours come in `pal` (as ItoEyeRealBake's:
// paper, ink, tear), all derived from the shell's tokens by ItoSealInk; this file writes none.
//   params   ItoEyeReal.realParams or ItoEyeReal.eyeballParams
//   size     the box's width in px (the height is 0.62 of it)
//   paper    false leaves the sclera out (the core seal draws on its own ground)
//   mirror   the inner corner on the right
//   blinkK   the eye's height as a scale about the lid line (1 open .. 0.12 shut): a blink at 12 px is a transform, not a re-bake (EM4)
//   irisDx/Dy  px: the iris and its pinpoint (their own Shape item, `irisItem`) are moved by this much, a glance (EM4)
// Still no clock: both are plain inputs; at 1 / 0 / 0 the sigil is what it always was.
Item {
  id: root

  property var params: null
  property var pal: null
  property real size: 12
  property bool paper: true
  property bool mirror: false

  width: size
  height: size * 0.62

  property real blinkK: 1
  property real irisDx: 0
  property real irisDy: 0

  readonly property var parts: params ? EyeR.sigilParts(params, size, { paper: paper }) : []
  // the iris group (the iris, its catchlight pin or its spiral) moves on its own; the rest of the eye (sclera, lids, tear) stays
  function isIris(part) { return part.id === "iris" || part.id === "pin" || part.id === "spiral" }
  readonly property var baseParts: parts.filter(function(q) { return !isIris(q) })
  readonly property var irisParts: parts.filter(function(q) { return isIris(q) })
  // the lid line: where the lids meet when shut, the middle of the opening (px)
  readonly property real lidY: {
    if (!params) return height / 2
    var g = EyeR.buildGeo(params)
    return (g.yU(50) + g.yL(50)) / 2 * size / 100
  }

  readonly property color none: Qt.alpha(palette.window, 0)
  // the sclera path takes `pal.sclera` when the host gives one (the core seal: a soft tone of its rule ink instead of paper)
  function colorOf(part) {
    if (!pal) return none
    if (part.id === "sclera" && pal.sclera !== undefined) return pal.sclera
    return part.role === "paper" ? pal.paper : (part.role === "tear" ? pal.tear : pal.ink)
  }

  transform: Scale { yScale: root.blinkK; origin.y: root.lidY }

  Shape {
    id: sh
    width: 100; height: 62
    preferredRendererType: Shape.CurveRenderer
    antialiasing: true
    transform: Matrix4x4 {
      readonly property real s: root.size / 100
      matrix: Qt.matrix4x4(root.mirror ? -s : s, 0, 0, root.mirror ? 100 * s : 0,
                           0, s, 0, 0,
                           0, 0, 1, 0,
                           0, 0, 0, 1)
    }
    // six fixed slots: a slot with no part draws nothing, so no path is ever created or removed while the eye changes
    Instantiator {
      model: 6
      delegate: ShapePath {
        id: sp
        required property int index
        readonly property var part: index < root.baseParts.length ? root.baseParts[index] : null
        strokeWidth: -1
        fillColor: part ? root.colorOf(part) : root.none
        PathSvg { path: sp.part ? sp.part.path : "" }
      }
      onObjectAdded: function(i, o) { sh.data.push(o) }
    }
  }

  // the iris group in its own item: a glance translates it (it never leaves the opening by more than the lids cover: <= 1.2 px)
  Item {
    id: irisItem
    x: root.irisDx; y: root.irisDy
    Shape {
      id: shi
      width: 100; height: 62
      preferredRendererType: Shape.CurveRenderer
      antialiasing: true
      transform: Matrix4x4 {
        readonly property real s: root.size / 100
        matrix: Qt.matrix4x4(root.mirror ? -s : s, 0, 0, root.mirror ? 100 * s : 0,
                             0, s, 0, 0,
                             0, 0, 1, 0,
                             0, 0, 0, 1)
      }
      Instantiator {
        model: 3
        delegate: ShapePath {
          id: spi
          required property int index
          readonly property var part: index < root.irisParts.length ? root.irisParts[index] : null
          strokeWidth: -1
          fillColor: part ? root.colorOf(part) : root.none
          PathSvg { path: spi.part ? spi.part.path : "" }
        }
        onObjectAdded: function(i, o) { shi.data.push(o) }
      }
    }
  }
}

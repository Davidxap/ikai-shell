import QtQuick
import QtQuick.Shapes

// The weather, alive over its own icon while the pointer is on it. Only what the sky is doing moves:
//
//   rain    drops fall through the icon            storm   the sky flashes and a bolt strikes
//   snow    flakes drift down                      fog     bands of mist slide past each other
//   sun     heat rises in rings, and the rays turn moon    a star flickers beside it
//   cloud   it drifts, and the light through it shifts
//
// It is drawn over the icon, in the icon's own box, in the theme's colours, and nothing runs (or is even visible) while
// `live` is false. `amp` is the Motion setting.
Item {
  id: root

  property string kind: "cloud"
  // the icon it plays over: it is placed over it (in this item's parent) when the pointer arrives, and never takes part in the
  // widget's own layout, which it once did and shifted everything by a cell
  property Item glyph: null
  property bool live: false
  onLiveChanged: if (live) place()
  function place() {
    if (!glyph || !parent) return
    var p = glyph.mapToItem(parent, 0, 0)
    x = p.x; y = p.y; width = glyph.width; height = glyph.height
  }
  property real amp: 1
  property color bone: "#c7ccd1"
  property color blood: "#c4162a"

  visible: live && amp > 0
  clip: false

  property real t: 0
  FrameAnimation { running: root.live && root.amp > 0; onTriggered: root.t += frameTime }

  readonly property real w: width
  readonly property real h: height

  // ---------------------------------------------------------------- rain and snow: things that fall
  Repeater {
    model: (root.kind === "rain" || root.kind === "storm") ? 10 : (root.kind === "snow" ? 8 : 0)
    Rectangle {
      required property int index
      readonly property real seed: (index * 0.37 + 0.11) % 1
      readonly property real phase: ((root.t * (root.kind === "snow" ? 0.55 : 1.5) + seed * 3.1) % 1)
      width: root.kind === "snow" ? 2.8 : 1.7
      height: root.kind === "snow" ? 2.8 : root.h * 0.3
      radius: root.kind === "snow" ? 1.4 : 0.85
      x: root.w * (0.16 + 0.68 * ((index * 0.6180339) % 1)) + (root.kind === "snow" ? Math.sin(root.t * 2 + index) * 2.2 : -phase * 2.5)
      y: -height + phase * (root.h + height)
      rotation: root.kind === "snow" ? 0 : 12
      color: root.kind === "snow" ? root.bone : root.blood
      opacity: Math.min(1, (1 - phase) * 1.4)
    }
  }

  // ---------------------------------------------------------------- storm: a flash over the whole icon and a bolt
  Rectangle {
    anchors.centerIn: parent
    width: root.w * 1.5; height: root.h * 1.5; radius: width / 2
    visible: root.kind === "storm"
    color: root.bone
    opacity: root.kind === "storm" ? Math.max(0, Math.sin(root.t * 3.3) - 0.72) * 1.7 : 0
  }
  Shape {
    anchors.fill: parent
    visible: root.kind === "storm"
    preferredRendererType: Shape.CurveRenderer
    opacity: Math.max(0, Math.sin(root.t * 3.3) - 0.55) * 2.2
    ShapePath {
      strokeColor: root.blood; strokeWidth: 1.6; fillColor: "transparent"; capStyle: ShapePath.RoundCap; joinStyle: ShapePath.MiterJoin
      PathPolyline {
        path: [Qt.point(root.w * 0.56, root.h * 0.42), Qt.point(root.w * 0.4, root.h * 0.66),
               Qt.point(root.w * 0.53, root.h * 0.66), Qt.point(root.w * 0.38, root.h * 0.94)]
      }
    }
  }

  // ---------------------------------------------------------------- fog: mist sliding
  Repeater {
    model: root.kind === "fog" ? 3 : 0
    Rectangle {
      required property int index
      width: root.w * 0.62; height: 2
      radius: 1
      color: root.bone
      opacity: 0.35 + 0.25 * Math.sin(root.t * 1.4 + index * 2)
      y: root.h * (0.3 + 0.2 * index)
      x: (root.w - width) / 2 + Math.sin(root.t * (0.8 + index * 0.25) + index * 1.9) * root.w * 0.24
    }
  }

  // ---------------------------------------------------------------- sun: heat rings rise, rays turn
  Repeater {
    model: root.kind === "sun" || root.kind === "suncloud" ? 2 : 0
    Rectangle {
      required property int index
      readonly property real p: ((root.t * 0.8 + index * 0.5) % 1)
      anchors.centerIn: parent
      width: root.w * (0.5 + p * 0.95); height: width; radius: width / 2
      color: "transparent"
      border.width: 1.2
      border.color: root.blood
      opacity: (1 - p) * 0.55
    }
  }
  Item {
    anchors.fill: parent
    visible: root.kind === "sun" || root.kind === "suncloud"
    rotation: root.t * 22
    Repeater {
      model: 8
      Rectangle {
        required property int index
        width: 1.4; height: root.h * 0.12; radius: 0.7
        color: root.blood
        opacity: 0.5
        x: root.w / 2 - width / 2
        y: root.h * 0.03
        transform: Rotation { origin.x: 0.7; origin.y: root.h * 0.47; angle: index * 45 }
      }
    }
  }

  // ---------------------------------------------------------------- moon: a star flickers
  Shape {
    anchors.fill: parent
    visible: root.kind === "moon"
    preferredRendererType: Shape.CurveRenderer
    opacity: 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(root.t * 5.7) * Math.sin(root.t * 2.3))
    ShapePath {
      strokeColor: root.bone; strokeWidth: 1.2; fillColor: "transparent"; capStyle: ShapePath.RoundCap
      PathMultiline {
        paths: [[Qt.point(root.w * 0.82, root.h * 0.14), Qt.point(root.w * 0.82, root.h * 0.32)],
                [Qt.point(root.w * 0.73, root.h * 0.23), Qt.point(root.w * 0.91, root.h * 0.23)]]
      }
    }
  }

  // ---------------------------------------------------------------- cloud: a soft light passing over it
  Rectangle {
    visible: root.kind === "cloud"
    width: root.w * 0.35; height: root.h * 0.8; radius: width / 2
    y: root.h * 0.1
    x: -width + ((root.t * 0.5) % 1) * (root.w + width)
    color: root.bone
    opacity: 0.16
    rotation: 18
  }
}

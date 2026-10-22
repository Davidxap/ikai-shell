import QtQuick 6.11
import QtQuick.Shapes
import "ItoStateLayer.js" as SL

// The blot of the ink bleed: one seeded 24-point outline, built once, scaled by ItoStateLayer. It draws nothing else and runs no clock.
Shape {
  id: root

  property color color: "transparent"
  property int seed: 1
  width: SL.BLOT_R * 2
  height: SL.BLOT_R * 2
  transformOrigin: Item.Center
  preferredRendererType: Shape.CurveRenderer

  ShapePath {
    fillColor: root.color
    strokeWidth: -1
    PathPolyline { path: SL.blotPath(SL.BLOT_R, root.seed) }
  }
}

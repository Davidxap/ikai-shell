pragma ComponentBehavior: Bound

import QtQuick
import qs.Commons as Commons
import "." as Ito

// The IKAI bar style. It brings its own geometry (a 52px bar, see VisualTokens) and,
// for now, draws the bar with the fork's own surface. The tooltip is ours, written to tolerate
// an uninjected `bar`. The textured surface comes next; keeping the surface swappable is why the
// two components are declared here and not inherited.
Item {
  id: root

  property var bar: null

  Ito.VisualTokens {
    id: tokens
    bar: root.bar
  }

  readonly property int contractVersion: 1
  readonly property string styleId: "itoverse"
  readonly property string displayName: "IKAI"
  readonly property int sizeHorizontal: tokens.barHeight
  // As thick on the sides as along the top, so the same icons and numbers fit whichever edge the bar is on.
  readonly property int sizeVertical: tokens.barHeight
  readonly property int exclusiveSizeHorizontal: tokens.exclusiveHeight
  readonly property int tooltipGap: Commons.Style.space(6)
  readonly property int colorTransitionDuration: tokens.colorDuration
  readonly property string fontFamily: tokens.fontFamily
  readonly property color foreground: tokens.ink
  readonly property color barForeground: tokens.ink
  // See-through: the fork's run chrome fills with this, and the plate has to show through it.
  readonly property color background: tokens.barBackground
  readonly property color urgent: tokens.seal
  readonly property var visualTokens: tokens
  readonly property Component barSurfaceComponent: barSurface
  readonly property Component tooltipSurfaceComponent: tooltipSurface

  visible: false
  width: 0
  height: 0

  Component {
    id: barSurface

    Ito.BarSurface { bar: root.bar }
  }

  Component {
    id: tooltipSurface

    Ito.TooltipSurface { bar: root.bar }
  }
}

import QtQuick
import "ItoInk.js" as Ink

// A short blood vein with thorns, for dividing groups and flanking the Tomie seal.
//
// The sheet ships one (tomie-mark.png) but at bar size it thins to two dark
// brackets and reads as nothing, so it is drawn instead, in the same inked stroke as
// the data glyphs. Thorns alternate sides and climb, the way the sheet's mark does.
Canvas {
  id: root

  property color color: "#9d3446"
  property bool flip: false          // thorns lean the other way, for the mirrored side
  property int seed: 4
  property int size: 28              // height in px; the width follows

  width: Math.round(size * 0.42)
  height: size
  antialiasing: true

  onColorChanged: requestPaint()
  onFlipChanged: requestPaint()
  onSizeChanged: requestPaint()
  Component.onCompleted: requestPaint()

  onPaint: {
    var ctx = getContext("2d")
    ctx.clearRect(0, 0, width, height)
    ctx.save()
    ctx.scale(width / 12, height / 28)
    var dir = flip ? -1 : 1

    // the stem: nearly straight, with a slight sway
    var stem = [{ x: 6, y: 1 }, { x: 5.4, y: 7 }, { x: 6.5, y: 14 }, { x: 5.6, y: 21 }, { x: 6, y: 27 }]
    Ink.inkPath(ctx, stem, color, 1.5, seed, 0.25)

    // thorns: [y on the stem, side, length]
    var thorns = [[6.5, -1, 4.6], [11, 1, 5.4], [15.5, -1, 3.8], [20, 1, 4.6], [24, -1, 3]]
    for (var i = 0; i < thorns.length; i++) {
      var y = thorns[i][0]
      var side = thorns[i][1] * dir
      var len = thorns[i][2]
      var thorn = [{ x: 6, y: y }, { x: 6 + side * len * 0.55, y: y - len * 0.5 },
                   { x: 6 + side * len, y: y - len * 0.95 }]
      Ink.inkPath(ctx, thorn, color, 1.1, seed + 10 + i, 0.2, false)
    }
    ctx.restore()
  }
}

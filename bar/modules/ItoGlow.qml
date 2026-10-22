import QtQuick

// A soft radial bloom of one colour, for lighting a glyph from behind.
//
// The shell's effect layer is not available to every renderer (the offscreen lab uses
// the software backend), and a Canvas gradient is enough for a bloom: no shader, no
// blur, and it costs nothing while `strength` is zero.
Canvas {
  id: root

  property color color: "#c4162a"
  property real strength: 0.3      // peak alpha at the centre

  onColorChanged: requestPaint()
  onStrengthChanged: requestPaint()
  onWidthChanged: requestPaint()
  onHeightChanged: requestPaint()
  visible: strength > 0.005

  onPaint: {
    var ctx = getContext("2d")
    ctx.clearRect(0, 0, width, height)
    var g = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) / 2)
    g.addColorStop(0, Qt.rgba(color.r, color.g, color.b, strength))
    g.addColorStop(0.55, Qt.rgba(color.r, color.g, color.b, strength * 0.35))
    g.addColorStop(1, Qt.rgba(color.r, color.g, color.b, 0))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, width, height)
  }
}

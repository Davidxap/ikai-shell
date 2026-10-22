import QtQuick

// Sheet art with blood rising inside it, for anything that is a quantity of a thing:
// a drive that fills, a battery that drains. The art is drawn once and the blood is
// composed over it with source-atop, so it only ever lands on the ink, never on the
// empty space around it.
Canvas {
  id: root

  property url source
  property real value: 0            // 0..1, how full
  property int size: 32
  property color blood: "#c4162a"
  property real lift: 0.16          // how much the untouched ink is dimmed under the blood

  width: size
  height: size
  antialiasing: true

  Image { id: probe; source: root.source; visible: false }

  onSourceChanged: loadImage(source)
  onValueChanged: requestPaint()
  onBloodChanged: requestPaint()
  onSizeChanged: requestPaint()
  onImageLoaded: requestPaint()
  Component.onCompleted: loadImage(source)

  onPaint: {
    var ctx = getContext("2d")
    ctx.clearRect(0, 0, width, height)
    if (!isImageLoaded(source) || probe.implicitWidth <= 0) return

    var scale = Math.min(width / probe.implicitWidth, height / probe.implicitHeight)
    var w = probe.implicitWidth * scale, h = probe.implicitHeight * scale
    var x = (width - w) / 2, y = (height - h) / 2
    ctx.drawImage(source, x, y, w, h)

    var level = Math.max(0, Math.min(1, value))
    var top = y + h * (1 - level)
    ctx.globalCompositeOperation = "source-atop"
    var g = ctx.createLinearGradient(0, top, 0, y + h)
    g.addColorStop(0, Qt.rgba(blood.r, blood.g, blood.b, 0.95))
    g.addColorStop(1, Qt.rgba(blood.r * 0.7, blood.g * 0.7, blood.b * 0.7, 0.95))
    ctx.fillStyle = g
    ctx.fillRect(x, top, w, y + h - top)
    ctx.globalCompositeOperation = "source-over"
  }
}

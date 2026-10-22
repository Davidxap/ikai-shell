import QtQuick

// A live data readout for the bar: a glyph that reacts to the value, a jagged
// history trace and the number itself.
//
// Shape language is deliberate. Silent Hill reads as instruments failing in
// grime - seismograph needles, rust, static - so the trace is drawn with hard
// segments and a ragged baseline instead of the smooth bezier a system monitor
// would use. Junji Ito supplies the glyph: the spiral tightens as load climbs,
// which is Uzumaki's whole idea of a thing winding in on itself.
//
// Everything is painted in Canvas rather than loaded from PNG, so these gauges
// do not depend on the icon sheet.
Item {
  id: root

  // "spiral" (cpu), "ring" (memory), "column" (disk).
  property string glyph: "spiral"
  property real value: 0            // 0..1
  property var history: []          // recent values, oldest first
  property color blood: "#651817"
  property color bone: "#d6d3cb"
  property int traceWidth: 34
  property int glyphSize: 18
  property bool showTrace: true

  implicitWidth: glyphSize + (showTrace ? traceWidth + 5 : 0)
  implicitHeight: glyphSize

  onValueChanged: { glyphCanvas.requestPaint(); trace.requestPaint() }
  onHistoryChanged: trace.requestPaint()
  onBloodChanged: { glyphCanvas.requestPaint(); trace.requestPaint() }

  Row {
    anchors.fill: parent
    spacing: 5

    Canvas {
      id: glyphCanvas
      width: root.glyphSize
      height: root.glyphSize
      anchors.verticalCenter: parent.verticalCenter

      // The glyph leans toward blood as the value climbs, so a machine under
      // load visibly darkens instead of only reporting a bigger number.
      readonly property color ink: Qt.tint(root.bone,
        Qt.rgba(root.blood.r, root.blood.g, root.blood.b, root.value * 0.85))

      onInkChanged: requestPaint()
      Component.onCompleted: requestPaint()

      onPaint: {
        var ctx = getContext("2d")
        ctx.clearRect(0, 0, width, height)
        ctx.strokeStyle = ink
        ctx.lineCap = "round"
        ctx.lineJoin = "round"

        var cx = width / 2
        var cy = height / 2
        var r = Math.min(width, height) / 2 - 1.5

        if (root.glyph === "spiral") {
          // Turns tighten with load: idle drifts open, a busy machine winds in.
          var turns = 2.1 + root.value * 2.4
          ctx.lineWidth = 1.5
          ctx.beginPath()
          var steps = 150
          for (var i = 0; i <= steps; i++) {
            var t = i / steps
            var angle = t * turns * Math.PI * 2
            var radius = r * t
            var x = cx + Math.cos(angle) * radius
            var y = cy + Math.sin(angle) * radius
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
          }
          ctx.stroke()
        } else if (root.glyph === "ring") {
          ctx.lineWidth = 2
          ctx.globalAlpha = 0.28
          ctx.beginPath()
          ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.stroke()

          ctx.globalAlpha = 1
          ctx.beginPath()
          ctx.arc(cx, cy, r, -Math.PI / 2,
                  -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, root.value))
          ctx.stroke()
        } else {
          // A column filling from the bottom, drawn as stacked marks.
          var bars = 4
          var gap = 2
          var barH = (height - gap * (bars - 1)) / bars
          var lit = Math.round(root.value * bars)
          for (var b = 0; b < bars; b++) {
            ctx.globalAlpha = b < lit ? 1 : 0.22
            ctx.fillStyle = ink
            ctx.fillRect(1, height - (b + 1) * barH - b * gap, width - 2, barH)
          }
        }
      }
    }

    Canvas {
      id: trace
      visible: root.showTrace
      width: root.traceWidth
      height: Math.round(root.glyphSize * 0.72)
      anchors.verticalCenter: parent.verticalCenter

      Component.onCompleted: requestPaint()

      onPaint: {
        var ctx = getContext("2d")
        ctx.clearRect(0, 0, width, height)
        var values = root.history || []
        if (values.length < 2) return

        var points = []
        for (var i = 0; i < values.length; i++) {
          points.push({
            x: (i / (values.length - 1)) * width,
            y: height - Math.max(0.02, Math.min(1, values[i])) * (height - 1) - 0.5
          })
        }

        // Filled body under the needle, kept faint so the bar stays ink.
        ctx.beginPath()
        ctx.moveTo(points[0].x, height)
        for (var j = 0; j < points.length; j++) ctx.lineTo(points[j].x, points[j].y)
        ctx.lineTo(points[points.length - 1].x, height)
        ctx.closePath()
        ctx.fillStyle = Qt.rgba(root.blood.r, root.blood.g, root.blood.b, 0.45)
        ctx.fill()

        // Hard segments, no smoothing: an instrument, not a chart.
        ctx.beginPath()
        ctx.moveTo(points[0].x, points[0].y)
        for (var k = 1; k < points.length; k++) ctx.lineTo(points[k].x, points[k].y)
        ctx.strokeStyle = Qt.tint(root.bone,
          Qt.rgba(root.blood.r, root.blood.g, root.blood.b, 0.55))
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }
  }
}

import QtQuick

// A piece of engraved art that fills with blood to a level: the brain of the AI quota, the tray's jar.
//
// The engraving is mostly hatching, so filling only the pixels it inks would look like a few red lines.
// So the level is clipped to the drawing's SILHOUETTE (a second, solid image of its inside), painted
// first, and the engraving goes over it. The blood is painted straight from the palette; only the
// engraving is hue-shifted under a theme, so the fill is never shifted twice.
Item {
  id: root

  property url art
  property url inside
  property real value: 0            // 0..1, how full
  property int size: 30
  property var palette: null
  property color blood: palette ? palette.blood : "#c4162a"
  property real lift: 0.10          // the fill's alpha at the very bottom is 1, its surface fades to this
  // The engraved brain and jar are drawn on their own solid silhouette, like paper under the ink. A line drawing has an
  // empty inside, so it sets this to false and only the blood is painted, up to the level.
  property bool paper: true

  width: size
  height: size
  // iconStyle manga: the drawn icon moves itself (ItoIconLive), so ItoHover keeps only its halo
  readonly property bool ownsMotion: engraving.drawn
  function hoverEdge(on) { engraving.hoverEdge(on) }

  // YOUR OWN ART: the silhouette follows the user's file too (when they drew one), else the shipped one
  readonly property url insideUrl: {
    var u = palette && typeof palette.userArt === "function" ? palette.userArt(String(inside)) : ""
    return u !== "" ? u : inside
  }

  Canvas {
    id: level
    anchors.fill: parent
    antialiasing: true
    visible: !engraving.drawn && !engraving.gothic         // iconStyle manga: the bake draws its own level (ink in the groove), not this tint; gothic is a static picture

    Image {
      id: probe; source: root.insideUrl; visible: false
      onStatusChanged: if (status === Image.Error && root.palette && typeof root.palette.userFail === "function" && String(root.insideUrl) !== String(root.inside)) root.palette.userFail(String(root.insideUrl))
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!isImageLoaded(root.insideUrl)) return
      var v = Math.max(0, Math.min(1, root.value))
      // the drawing sits inside the image with a margin, so the level is measured over that ink box
      var top = height * (0.88 - v * 0.76)
      if (!root.paper) {
        if (v <= 0.005) return
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, top, width, height - top)
        ctx.clip()
      }
      ctx.drawImage(root.insideUrl, 0, 0, width, height)
      ctx.globalCompositeOperation = "source-in"
      var g = ctx.createLinearGradient(0, top, 0, height)
      g.addColorStop(0, Qt.rgba(root.blood.r, root.blood.g, root.blood.b, 0.55))
      g.addColorStop(0.35, Qt.rgba(root.blood.r, root.blood.g, root.blood.b, 0.85))
      g.addColorStop(1, Qt.rgba(root.blood.r * 0.55, root.blood.g * 0.5, root.blood.b * 0.5, 0.95))
      ctx.fillStyle = g
      ctx.fillRect(0, top, width, height - top)
      ctx.globalCompositeOperation = "source-over"
      if (!root.paper) ctx.restore()
    }

    Component.onCompleted: loadImage(root.insideUrl)
    onImageLoaded: requestPaint()
    Connections {
      target: root
      function onValueChanged() { level.requestPaint() }
      function onBloodChanged() { level.requestPaint() }
      function onSizeChanged() { level.requestPaint() }
      function onInsideUrlChanged() { level.loadImage(root.insideUrl) }
    }
  }

  ItoImage {
    id: engraving
    anchors.fill: parent
    palette: root.palette
    source: root.art
    level: root.value
  }
}

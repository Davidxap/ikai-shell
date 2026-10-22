import QtQuick

// What moves behind the media controls while something plays. One kind is chosen on the Effects page:
//
//   blood    a slosh of blood that rises and falls with a beat
//   spiral   the Uzumaki spiral, turning
//   radio    the pocket radio: a tuning scale, channel numbers, a blood needle sweeping it, static that thins as the music swells
//   fog      Silent Hill's fog, drifting slowly across
//   static   a dying picture: scanlines, snow and a tear (the same recipe as the memory liquid's static)
//   custom   the user's own picture or GIF (Effects page -> Choose your own), drawn behind the buttons
//
// The effect eases in when playback starts and drains away when it stops. It is drawn on one Canvas that repaints
// only while there is something to see, so an idle bar costs nothing. `pulse()` throws it up for a moment (a new track).
Item {
  id: root

  property string kind: "blood"
  property bool active: false
  property color blood: "#c4162a"
  property color bone: "#c7ccd1"
  property real radius: height / 2
  property real speed: 1
  property url customSource: ""        // the user's own picture or GIF, for kind "custom"

  property real surge: 0
  function pulse() { surgeAnim.restart() }

  property real shown: active ? 1 : 0
  Behavior on shown {
    NumberAnimation {
      duration: root.active ? 900 : 1500
      easing.type: Easing.BezierSpline
      easing.bezierCurve: [0.05, 0.7, 0.1, 1, 1, 1]
    }
  }

  property real t: 0
  readonly property bool running: shown > 0.004

  NumberAnimation { id: surgeAnim; target: root; property: "surge"; from: 1; to: 0; duration: 1800; easing.type: Easing.OutCubic }

  FrameAnimation {
    running: root.running && root.kind !== "custom"
    onTriggered: {
      root.t += frameTime * root.speed
      canvas.requestPaint()
    }
  }

  // The user's own picture or GIF. It only plays while it is showing. It is cut to a rectangle set in from the pill's
  // round ends (no shader mask, so it costs nothing extra and works on any renderer), and shown a little transparent.
  Item {
    id: customFx
    anchors.fill: parent
    anchors.leftMargin: root.radius * 0.45
    anchors.rightMargin: root.radius * 0.45
    clip: true
    visible: root.kind === "custom" && root.running && root.customSource.toString() !== ""

    AnimatedImage {
      anchors.fill: parent
      source: customFx.visible ? root.customSource : ""
      fillMode: Image.PreserveAspectCrop
      playing: customFx.visible
      smooth: true
      opacity: 0.62 * root.shown
    }
  }

  Canvas {
    id: canvas
    anchors.fill: parent
    visible: root.running && root.kind !== "custom"
    antialiasing: true

    function clipPill(ctx, w, h, r) {
      r = Math.min(r, h / 2, w / 2)
      ctx.beginPath()
      ctx.moveTo(r, 0); ctx.lineTo(w - r, 0); ctx.arc(w - r, r, r, -Math.PI / 2, 0)
      ctx.lineTo(w, h - r); ctx.arc(w - r, h - r, r, 0, Math.PI / 2)
      ctx.lineTo(r, h); ctx.arc(r, h - r, r, Math.PI / 2, Math.PI)
      ctx.lineTo(0, r); ctx.arc(r, r, r, Math.PI, Math.PI * 1.5)
      ctx.closePath()
    }
    function rgba(c, a) { return Qt.rgba(c.r, c.g, c.b, a) }

    // ------------------------------------------------------------------ blood
    function wave(ctx, w, h, base, amp, phase, aTop, aBottom) {
      var t = root.t
      ctx.beginPath(); ctx.moveTo(0, h)
      for (var x = 0; x <= w; x += 3)
        ctx.lineTo(x, base + Math.sin(x * 0.11 + t * 2.1 + phase) * amp + Math.sin(x * 0.23 - t * 1.4 + phase * 1.7) * amp * 0.55)
      ctx.lineTo(w, h); ctx.closePath()
      var b = root.blood
      var g = ctx.createLinearGradient(0, base - amp, 0, h)
      g.addColorStop(0, rgba(b, aTop)); g.addColorStop(1, Qt.rgba(b.r * 0.5, b.g * 0.45, b.b * 0.45, aBottom))
      ctx.fillStyle = g; ctx.fill()
    }
    function paintBlood(ctx, w, h) {
      var beat = 0.72 + 0.28 * Math.sin(root.t * 2.6) * Math.sin(root.t * 0.85 + 1.0)
      var amp = h * (0.05 + 0.05 * beat) + h * 0.16 * root.surge
      var fill = Math.min(0.95, 0.42 * root.shown + root.surge * 0.22)
      var base = h * (1 - fill)
      wave(ctx, w, h, base + h * 0.05, amp * 0.8, 2.0, 0.42, 0.62)
      wave(ctx, w, h, base, amp, 0.0, 0.66, 0.92)
    }

    // ------------------------------------------------------------------ spiral
    // Not a clean mathematical curve: the wobble is what tells this from a logo. A third, faint arm keeps
    // it from ever quite settling into a simple two-arm pattern, and a few dark growths sit on the ink the
    // way the curse marks skin in Uzumaki -- small, uneven, not decoration.
    function paintSpiral(ctx, w, h) {
      // Fitted so the whole spiral is inside the strip: it reaches the edges, and is never cut by them.
      var cx = w / 2, cy = h / 2, rx = w * 0.47, ry = h * 0.44
      var spin = root.t * 0.9 + root.surge * 3
      var S = root.shown

      // a faint ring at the rim, so the round shape reads as complete even where the arms are thin
      ctx.beginPath()
      for (var k = 0; k <= 96; k++) {
        var q = k / 96 * Math.PI * 2
        var px = cx + Math.cos(q) * rx, py = cy + Math.sin(q) * ry
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.lineWidth = 1
      ctx.strokeStyle = rgba(root.bone, 0.16 * S)
      ctx.stroke()

      // three arms; each fades in from the centre and out at the rim, drawn as three pieces of one path
      var arms = [
        { off: 0, width: 2.4, colour: root.blood, alpha: 0.85 },
        { off: Math.PI, width: 1.8, colour: root.bone, alpha: 0.42 },
        { off: Math.PI * 0.55, width: 0.9, colour: root.bone, alpha: 0.2 }
      ]
      var bands = [[0, 0.16, 0.35], [0.16, 0.86, 1], [0.86, 1, 0.55]]     // from, to, share of the arm's alpha
      var dots = []
      for (var arm = 0; arm < arms.length; arm++) {
        var A = arms[arm]
        for (var band = 0; band < bands.length; band++) {
          ctx.beginPath()
          var from = Math.floor(bands[band][0] * 170), to = Math.ceil(bands[band][1] * 170)
          for (var i = from; i <= to; i++) {
            var u = i / 170
            var wob = Math.sin(u * 19 + arm * 3 + root.t * 1.3) * (1 - u) * 0.035
            var a = spin + A.off + u * 4.4 * Math.PI + wob
            var f = u * (1 + 0.008 * Math.sin(u * 11 - root.t))
            var x = cx + Math.cos(a) * f * rx, y = cy + Math.sin(a) * f * ry
            if (i === from) ctx.moveTo(x, y); else ctx.lineTo(x, y)
            if (arm === 0 && band === 1 && i % 34 === 0) dots.push([x, y, 1 + hash(i) * 1.2])
          }
          ctx.lineWidth = A.width + root.surge * 1.0
          ctx.lineCap = "round"
          ctx.strokeStyle = rgba(A.colour, A.alpha * bands[band][2] * S)
          ctx.stroke()
        }
      }
      // beads of blood along the main arm, and the eye of the storm
      ctx.fillStyle = rgba(root.blood, 0.6 * S)
      for (var d = 0; d < dots.length; d++) { ctx.beginPath(); ctx.arc(dots[d][0], dots[d][1], dots[d][2], 0, Math.PI * 2); ctx.fill() }
      ctx.beginPath(); ctx.arc(cx, cy, 1.8, 0, Math.PI * 2)
      ctx.fillStyle = rgba(root.blood, 0.95 * S)
      ctx.fill()
    }

    function frac(v) { return v - Math.floor(v) }
    function hash(v) { return frac(Math.sin(v * 12.9898 + 78.233) * 43758.5453) }

    readonly property url fogArt: Qt.resolvedUrl("ito-art/misc/fog.png")
    Component.onCompleted: loadImage(fogArt)
    onImageLoaded: requestPaint()

    // ------------------------------------------------------------------ fog
    // A texture of layered noise (scripts/gen-fog.py), not radial blobs: two copies drift at different speeds and
    // heights so the streaks slide across each other the way a bank of fog does, with the red sun the game hides
    // in it. Nothing else: no grain on top.
    function paintFog(ctx, w, h) {
      if (isImageLoaded(fogArt)) {
        var th = Math.round(h * 1.7), tw = Math.round(Math.round(h * 1.7) * 4.8)
        for (var layer = 0; layer < 2; layer++) {
          var speed = layer === 0 ? 6 : 11, x0 = -((root.t * speed + layer * tw * 0.5) % tw)
          var y = (layer === 0 ? -h * 0.35 : -h * 0.55) + Math.sin(root.t * 0.25 + layer * 2) * h * 0.06
          ctx.globalAlpha = (layer === 0 ? 0.34 : 0.24) * (1 + 0.5 * root.surge) * root.shown
          // whole-pixel tiles: butted at fractional positions they leave a hairline where they meet
          for (var x = Math.round(x0); x < w; x += Math.round(tw)) ctx.drawImage(fogArt, x, Math.round(y), Math.round(tw), Math.round(th))
        }
        ctx.globalAlpha = 1
      }
      var sx = w * (0.72 + 0.04 * Math.sin(root.t * 0.3))
      var sg = ctx.createRadialGradient(sx, h * 0.55, 0, sx, h * 0.55, h * 0.95)
      sg.addColorStop(0, rgba(root.blood, 0.26 * root.shown)); sg.addColorStop(1, rgba(root.blood, 0))
      ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h)
    }

    // ------------------------------------------------------------------ static
    // A dying picture (the recipe of the memory liquid's static): scanlines on every 2nd row (clot-dark 14 %), snow of 16 % of the pixels at 0.30
    // (bone and dark), re-dealt at 12 fps, one 3-row tear with a blood hairline every ~4 s, and a sync bar that rolls down when the track changes.
    function paintStatic(ctx, w, h) {
      var step = Math.floor(root.t * 12)
      function rnd(i) { var v = Math.sin((step + 1) * 12.9898 + i * 78.233) * 43758.5453; return v - Math.floor(v) }
      ctx.fillStyle = Qt.rgba(root.blood.r * 0.15, root.blood.g * 0.15, root.blood.b * 0.15, 0.14 * root.shown)   // a darkening of the accent
      for (var y = 1; y < h; y += 2) ctx.fillRect(0, y, w, 1)
      var n = Math.round(0.16 * w * h * 0.5)
      for (var i = 0; i < n; i++) {
        ctx.fillStyle = rgba(rnd(i) < 0.5 ? root.bone : root.blood, 0.30 * root.shown)
        ctx.fillRect(Math.floor(rnd(i + 5000) * w), Math.floor(rnd(i + 9000) * h), 1, 1)
      }
      var tear = (root.t / 4) % 1
      if (tear < 0.06 + root.surge * 0.2) {
        var ty = Math.floor(h * (0.2 + rnd(500) * 0.6))
        ctx.fillStyle = rgba(root.bone, 0.28 * root.shown); ctx.fillRect(3, ty, w - 3, 3)
        ctx.fillStyle = rgba(root.blood, 0.45 * root.shown); ctx.fillRect(0, ty + 1, w, 1)
      }
      if (root.surge > 0.02) {       // the sync bar rolls down once while the surge dies away
        var yb = (1 - root.surge) * (h + 12) - 6
        ctx.fillStyle = rgba(root.bone, 0.18 * root.shown); ctx.fillRect(0, yb - 3, w, 6)
      }
    }

    // ------------------------------------------------------------------ radio
    // The pocket radio of Silent Hill: a tuning scale (a tick every 18 % of the height, a long one every fifth, bone 0.35 / 0.55), the channel numbers 1-9 at 0.4,
    // a blood needle (1.5 px) that sweeps the dial once a minute (the bar does not know the track's position), and static whose density falls as the music
    // swells (0.22 at rest to 0.04 at a peak: the station comes in). The needle sits on a channel number at its tuned moment.
    function paintRadio(ctx, w, h) {
      var step = Math.max(3, h * 0.18), n = Math.floor(w / step), S = root.shown
      var beat = Math.min(1, 0.72 + 0.28 * Math.sin(root.t * 2.6) * Math.sin(root.t * 0.85 + 1.0) + root.surge * 0.5)
      ctx.lineWidth = 1
      for (var i = 0; i <= n; i++) {
        var x = Math.round(i * step + 2) + 0.5, lng = i % 5 === 0
        ctx.strokeStyle = rgba(root.bone, (lng ? 0.55 : 0.35) * S)
        ctx.beginPath(); ctx.moveTo(x, h * (lng ? 0.60 : 0.72)); ctx.lineTo(x, h * 0.88); ctx.stroke()
      }
      ctx.strokeStyle = rgba(root.bone, 0.22 * S)
      ctx.beginPath(); ctx.moveTo(0, h * 0.88 + 0.5); ctx.lineTo(w, h * 0.88 + 0.5); ctx.stroke()
      if (h >= 26) {
        ctx.font = Math.round(h * 0.26) + "px sans-serif"; ctx.fillStyle = rgba(root.bone, 0.4 * S)
        for (var c = 0; c <= n && c / 5 < 9; c += 5) ctx.fillText(String(c / 5 + 1), Math.round(c * step + 2) - 3, h * 0.42)
      }
      var nx = Math.round(w * (0.12 + 0.76 * ((root.t / 60) % 1)))
      ctx.fillStyle = rgba(root.blood, 0.9 * S); ctx.fillRect(nx, h * 0.10, 1.5, h * 0.80)
      var dens = 0.22 - 0.18 * beat, speck = Math.floor(root.t * 12)
      var m = Math.round(dens * w * h * 0.5)
      for (var k = 0; k < m; k++) {
        var v = Math.sin((speck + 1) * 12.9898 + k * 78.233) * 43758.5453, u = Math.sin((speck + 3) * 7.131 + k * 31.7) * 9631.1
        ctx.fillStyle = rgba(root.bone, 0.30 * S)
        ctx.fillRect(Math.floor((v - Math.floor(v)) * w), Math.floor((u - Math.floor(u)) * h), 1, 1)
      }
    }

    onPaint: {
      var ctx = getContext("2d")
      var w = width, h = height
      ctx.clearRect(0, 0, w, h)
      if (root.shown <= 0.004 || w < 4 || h < 4) return
      ctx.save()
      clipPill(ctx, w, h, root.radius)
      ctx.clip()
      if (root.kind === "spiral") paintSpiral(ctx, w, h)
      else if (root.kind === "radio") paintRadio(ctx, w, h)
      else if (root.kind === "fog") paintFog(ctx, w, h)
      else if (root.kind === "static") paintStatic(ctx, w, h)
      else paintBlood(ctx, w, h)
      ctx.restore()
    }
  }
}

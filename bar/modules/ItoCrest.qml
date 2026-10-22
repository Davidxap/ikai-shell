import QtQuick
import QtQuick.Shapes
import "ItoEyeReal.js" as EyeR

// The emblem at the head of a popup: a small drawn sign for what the popup watches, between two rules that end in
// diamonds, like the ornament over a chapter in a manga. One is chosen with `kind`:
//
//   eye        watching            spiral     the player (a record that never ends)
//   waves      sound               signal     the network (a signal that will not settle)
//   rune       Bluetooth           flame      power
//   clock      time                phone      notifications (a receiver that rings)
//   mind       AI usage
//   needle     the processor (a seismograph)      web        memory (a thread)
//   amigara    storage (a hole in the shape of a person)
//   sun moon cloud rain storm snow fog   the sky
//
// Everything is vector (Shapes, curve renderer), so it stays sharp at any size and screen scale, and it takes the
// theme's colours: `bone` for the line, `blood` for the one living detail. Lines are inked by hand: circles and arcs
// wander a little off true, the way a pen does, so nothing looks like a stock icon.
//
// It moves only while `live` (the popup is open) and Motion is not off: one clock, and only transforms and opacity
// change, never the geometry, so nothing is re-tessellated and an open popup costs almost nothing.
Item {
  id: root

  property string kind: "eye"
  // the colours come from the host (the popup's palette); there is no colour of its own here
  property color bone
  property color blood
  property color ink
  // the host's ItoConfig / ItoPanelPalette (for `lit` and `warn`); without one they are derived from the three above
  property var tints: null
  // the eye's look (S14): "shaded" (drawn in code: ItoEyeGlyph, ItoEyeReal.js) or one made from the user's sheets, "uzumaki", "lashed" or "veined"
  // (ItoUserArt.eye, drawn from the files `bin/ito-assets recipe eye-<id>` made). With no files, or `userAssets` off, a user eye draws the shaded one.
  // The shaded eye is `heavy` calm, `stare` when `hot` (the reading is past its warn threshold) and `spiral` when `critical` (the lore state), each swap
  // one re-bake on the edge of the state. `crestEye` overrides the face.
  property string eyeStyle: "shaded"
  property bool hot: false
  property bool critical: false
  property string crestEye: "auto"
  property bool live: false
  property real amp: 1
  // how much the real eye moves (ItoConfig.eyeLevel: 0 still, 1 subtle, 2 full; eyes-animation.md). 0 draws the still eye of eyes-v2 (ItoEyeGlyph); above it the eye
  // is an ItoEyeLive driven by an ItoEyeMotor. `pointer` is null or { x, y } in this item's coordinates: the eye follows it, and its pupil opens a little.
  property int eyeLevel: 0
  property var pointer: null

  implicitWidth: 96
  implicitHeight: 32

  readonly property real cx: width / 2
  readonly property real cy: height / 2
  readonly property real u: Math.min(height, 32) / 32       // one drawing unit: the emblem is designed on 32 px
  readonly property color line: Qt.rgba(bone.r, bone.g, bone.b, 0.92)
  readonly property color soft: Qt.rgba(bone.r, bone.g, bone.b, 0.55)
  readonly property color dim: Qt.rgba(bone.r, bone.g, bone.b, 0.3)
  readonly property color redSoft: Qt.rgba(blood.r, blood.g, blood.b, 0.5)

  // seconds since it started moving
  property real t: 0
  // `t` is read by every emblem but the eye (the shaded one is driven by its own motor, the user's by its own animators)
  FrameAnimation {
    running: root.live && root.amp > 0 && root.kind !== "eye"
    onTriggered: root.t += frameTime
  }
  readonly property bool moving: live && amp > 0
  // a wall clock in milliseconds, refreshed only while the emblem is the clock and it is moving
  property real nowMs: Date.now()
  Timer { running: root.moving && root.kind === "clock"; interval: 250; repeat: true; onTriggered: root.nowMs = Date.now() }

  function pt(x, y) { return Qt.point(cx + x * u, cy + y * u) }
  function wob(i, k) { return 0.3 * Math.sin(i * 2.31 + k) + 0.2 * Math.sin(i * 5.17 + k * 1.7) }
  // a circle or an arc, wandering off true by a few tenths of a unit: ink, not geometry
  function inked(x, y, r, a0, a1, n, k) {
    var out = []
    for (var i = 0; i <= n; i++) {
      var a = a0 + (a1 - a0) * i / n
      var rr = r + wob(i, k)
      out.push(pt(x + Math.cos(a) * rr, y + Math.sin(a) * rr))
    }
    return out
  }
  // the thread of a web at radius r: from spoke to spoke, sagging in towards the middle between them
  function webRing(r) {
    var out = []
    for (var i = 0; i < 5; i++) {
      var a0 = (-90 + 72 * i) * Math.PI / 180, a1 = (-90 + 72 * (i + 1)) * Math.PI / 180, am = (a0 + a1) / 2
      var x0 = Math.cos(a0) * r, y0 = Math.sin(a0) * r, x1 = Math.cos(a1) * r, y1 = Math.sin(a1) * r
      var cx2 = Math.cos(am) * r * 0.78, cy2 = Math.sin(am) * r * 0.78
      for (var k = 0; k < 6; k++) {
        var f = k / 6, g = 1 - f
        out.push(pt(g * g * x0 + 2 * g * f * cx2 + f * f * x1, g * g * y0 + 2 * g * f * cy2 + f * f * y1))
      }
    }
    out.push(out[0])
    return out
  }
  function spiralPts(x, y, r0, r1, turns, k) {
    var out = [], n = Math.round(turns * 34)
    for (var i = 0; i <= n; i++) {
      var f = i / n, a = f * turns * 2 * Math.PI
      var rr = r0 + (r1 - r0) * f + 0.25 * wob(i, k)
      out.push(pt(x + Math.cos(a) * rr, y + Math.sin(a) * rr))
    }
    return out
  }

  // ---------------------------------------------------------------- the rules either side
  Shape {
    anchors.fill: parent
    preferredRendererType: Shape.CurveRenderer
    antialiasing: true
    visible: root.kind !== "eye"

    ShapePath {
      strokeColor: root.soft; strokeWidth: 1; fillColor: "transparent"; capStyle: ShapePath.RoundCap
      startX: 2; startY: root.cy
      PathLine { x: root.cx - 24 * root.u; y: root.cy }
    }
    ShapePath {
      strokeColor: root.soft; strokeWidth: 1; fillColor: "transparent"; capStyle: ShapePath.RoundCap
      startX: root.width - 2; startY: root.cy
      PathLine { x: root.cx + 24 * root.u; y: root.cy }
    }
    ShapePath {
      strokeColor: root.blood; strokeWidth: 1; fillColor: root.redSoft
      startX: root.cx - 24 * root.u; startY: root.cy - 2.6
      PathLine { x: root.cx - 24 * root.u + 2.6; y: root.cy }
      PathLine { x: root.cx - 24 * root.u; y: root.cy + 2.6 }
      PathLine { x: root.cx - 24 * root.u - 2.6; y: root.cy }
      PathLine { x: root.cx - 24 * root.u; y: root.cy - 2.6 }
    }
    ShapePath {
      strokeColor: root.blood; strokeWidth: 1; fillColor: root.redSoft
      startX: root.cx + 24 * root.u; startY: root.cy - 2.6
      PathLine { x: root.cx + 24 * root.u + 2.6; y: root.cy }
      PathLine { x: root.cx + 24 * root.u; y: root.cy + 2.6 }
      PathLine { x: root.cx + 24 * root.u - 2.6; y: root.cy }
      PathLine { x: root.cx + 24 * root.u; y: root.cy - 2.6 }
    }
  }

  // ---------------------------------------------------------------- the colours the eyes are inked with
  QtObject {
    id: fallbackPalette
    readonly property color blood: root.blood
    readonly property color bone: root.bone
    readonly property color ink: root.ink
    readonly property color lit: root.bone
    readonly property color warn: root.blood
  }
  ItoSealInk { id: crestInk; source: root.tints ? root.tints : fallbackPalette }
  // ---------------------------------------------------------------- eye, shaded: one eye, the resting face of the shell
  // `live` never reaches the still eye, so it costs one bake per state, palette or size and nothing while the popup is open.
  readonly property real eyeBoxH: 34 * (height / 28)
  // the user's eye: its files for the box this eye fills (device px high, the card's scale included), or null (no files: the shaded eye)
  readonly property var userLayers: kind === "eye" && eyeStyle !== "shaded" && tints && typeof tints.userEye === "function"
    ? tints.userEye(eyeStyle, Math.round(eyeBoxH * Math.max(1, Screen.devicePixelRatio) * Math.max(1, scale))) : null
  readonly property bool real: kind === "eye" && userLayers === null
  readonly property string realFace: EyeR.crestArchetype(critical ? "critical" : (hot ? "hot" : "calm"), crestEye)
  // 68 px wide in the 28 px slot (it scales with the slot), so the eye reaches the full tier. Its box is 42 px tall, its content (brow to bag) 33 px:
  // it is centred on the slot, reaches up to the frame's top edge (the clip starts there) and the lower cheek is cut at the slot's foot + 6 px.
  readonly property real realS: height / 28
  readonly property real realW: EyeR.CREST_PX * realS
  Item {
    visible: root.real
    clip: true
    x: (parent.width - width) / 2; y: -6 * root.realS
    width: 92 * root.realS; height: 34 * root.realS
    Loader {
      active: root.real
      x: (parent.width - width) / 2; y: -0.4 * root.realS
      sourceComponent: root.eyeLevel > 0 ? liveEye : stillEye
    }
  }
  // motion off: the still eye of eyes-v2, drawn exactly as before (the rollback of eyes-animation.md is `ito-config set eyeMotion off`)
  Component {
    id: stillEye
    ItoEyeGlyph {
      ink: crestInk; style: "real"; frame: true; fade: 0
      size: root.realW; seed: 13; archetype: root.realFace; rl: EyeR.CREST[root.realFace]
    }
  }
  // motion on: the eye of ItoEyeLive, and the one clock that moves it (an event-driven Timer: it sleeps between events)
  Component {
    id: liveEye
    Item {
      width: live.width; height: live.height
      ItoEyeLive {
        id: live
        ink: crestInk; frame: true; fade: 0
        size: root.realW; seed: 13; archetype: root.realFace; rl: EyeR.CREST[root.realFace]
      }
      ItoEyeMotor {
        eye: live; space: root
        live: root.live; level: root.eyeLevel; amp: root.amp
        arch: root.realFace; rlTable: EyeR.CREST; seed: 13
        hot: root.hot; critical: root.critical
        pointer: root.pointer; hover: root.pointer !== null
      }
    }
  }

  // ---------------------------------------------------------------- eye, yours: lid, a turning iris and one blood point, from your own sheets
  // Three pictures in one box (92 x 34 at the popup head): `lid` (lashes, lid, sclera: a hole where the iris is), `iris` (the disc) turning about its centre and,
  // for the Uzumaki eye, `hot` (the same spiral in blood, shown while the reading is hot at the full level). The blood point is the shell's own, in the theme's blood.
  // The iris turns once in 40 s (12 s hot at full) and the eye blinks (the whole eye 1 -> 0.1 -> 1 in 180 ms) at full: only while the popup is open (`live`), and
  // never with motion off; at rest nothing runs. The theme shader tints the pictures like every other art of the shell.
  Item {
    id: yours
    visible: root.userLayers !== null
    x: (parent.width - width) / 2; y: -6 * root.realS
    width: 92 * root.realS; height: 34 * root.realS
    readonly property var lay: root.userLayers
    readonly property real fit: lay ? Math.min(width / lay.ar[0], height / lay.ar[1]) : 1
    readonly property real ox: lay ? (width - lay.ar[0] * fit) / 2 : 0
    readonly property real oy: lay ? (height - lay.ar[1] * fit) / 2 : 0
    readonly property real irisR: lay ? lay.irisAt[2] * fit : 1
    property real blinkK: 1
    readonly property bool turning: root.live && root.eyeLevel > 0 && root.amp > 0
    readonly property bool fast: root.hot && root.eyeLevel >= 2
    Item {
      id: eyeGroup
      anchors.fill: parent
      transform: Scale { yScale: yours.blinkK; origin.y: yours.height / 2 }
      layer.enabled: !!root.tints && root.tints.tinted === true
      layer.smooth: true
      layer.effect: ItoThemeEffect { palette: root.tints }
      Image {
        x: yours.ox; y: yours.oy; width: yours.lay ? yours.lay.ar[0] * yours.fit : 0; height: yours.lay ? yours.lay.ar[1] * yours.fit : 0
        source: yours.lay ? yours.lay.lid : ""; smooth: true; mipmap: true
        onStatusChanged: if (status === Image.Error && root.tints && typeof root.tints.userFail === "function") root.tints.userFail(String(source))
      }
      Item {
        id: irisTurn
        x: yours.lay ? yours.ox + yours.lay.irisAt[0] * yours.fit : 0
        y: yours.lay ? yours.oy + yours.lay.irisAt[1] * yours.fit : 0
        width: 0; height: 0
        RotationAnimator on rotation {
          from: 0; to: 360
          duration: yours.fast ? 12000 : 40000
          loops: Animation.Infinite
          running: yours.turning
        }
        Image {
          x: yours.lay ? -yours.lay.irisAt[0] * yours.fit : 0; y: yours.lay ? -yours.lay.irisAt[1] * yours.fit : 0
          width: yours.lay ? yours.lay.ar[0] * yours.fit : 0; height: yours.lay ? yours.lay.ar[1] * yours.fit : 0
          source: yours.lay ? yours.lay.iris : ""; smooth: true; mipmap: true
        }
        Image {
          x: yours.lay ? -yours.lay.irisAt[0] * yours.fit : 0; y: yours.lay ? -yours.lay.irisAt[1] * yours.fit : 0
          width: yours.lay ? yours.lay.ar[0] * yours.fit : 0; height: yours.lay ? yours.lay.ar[1] * yours.fit : 0
          source: yours.lay ? yours.lay.hot : ""; smooth: true; mipmap: true
          visible: root.hot && root.eyeLevel >= 2 && source.toString() !== ""
        }
      }
    }
    Rectangle {      // the blood point: the spiral's eye, at least 0.9 px
      readonly property real r: Math.max(0.9, yours.irisR * (yours.lay ? yours.lay.blood : 0))
      x: irisTurn.x - r; y: irisTurn.y - r
      width: 2 * r; height: 2 * r; radius: r
      color: root.blood
      antialiasing: true
    }
    SequentialAnimation {
      id: blinkAnim
      NumberAnimation { target: yours; property: "blinkK"; to: 0.1; duration: 70 }
      NumberAnimation { target: yours; property: "blinkK"; to: 1; duration: 110 }
    }
    // one blink every 9 to 22 s, full only: a Timer that exists only while the popup is open
    Timer {
      id: blinkTimer
      interval: 9000
      repeat: true
      running: yours.turning && root.eyeLevel >= 2 && yours.visible
      onRunningChanged: if (running) interval = 9000 + Math.floor(Math.random() * 13000)
      onTriggered: { blinkAnim.start(); interval = 9000 + Math.floor(Math.random() * 13000) }   // one-shot: a single blink per trigger
    }
  }

  // ---------------------------------------------------------------- spiral: the player, turning
  Item {
    anchors.fill: parent
    visible: root.kind === "spiral"
    rotation: root.moving ? root.t * 42 : 0
    Shape {
      anchors.fill: parent
      preferredRendererType: Shape.CurveRenderer
      antialiasing: true
      ShapePath {
        strokeColor: root.line; strokeWidth: 1.5; fillColor: "transparent"
        capStyle: ShapePath.RoundCap; joinStyle: ShapePath.RoundJoin
        PathPolyline { path: root.spiralPts(0, 0, 1.2, 14, 3.4, 1) }
      }
      ShapePath {
        strokeColor: root.redSoft; strokeWidth: 1.1; fillColor: "transparent"
        capStyle: ShapePath.RoundCap; joinStyle: ShapePath.RoundJoin
        PathPolyline { path: root.spiralPts(0, 0, 1.2, 12, 3.0, 4).map(function(p) { return Qt.point(2 * root.cx - p.x, 2 * root.cy - p.y) }) }
      }
    }
  }
  Shape {
    anchors.fill: parent
    preferredRendererType: Shape.CurveRenderer
    antialiasing: true
    visible: root.kind === "spiral"
    ShapePath {
      strokeColor: root.blood; strokeWidth: 1.2; fillColor: root.blood
      startX: root.cx + 2 * root.u; startY: root.cy
      PathAngleArc { centerX: root.cx; centerY: root.cy; radiusX: 2 * root.u; radiusY: 2 * root.u; startAngle: 0; sweepAngle: 360 }
    }
  }

  // ---------------------------------------------------------------- waves: sound
  Shape {
    anchors.fill: parent
    preferredRendererType: Shape.CurveRenderer
    antialiasing: true
    visible: root.kind === "waves"
    ShapePath {
      strokeColor: root.blood; strokeWidth: 1.2; fillColor: root.blood
      startX: root.cx + 2.4 * root.u; startY: root.cy
      PathAngleArc { centerX: root.cx; centerY: root.cy; radiusX: 2.4 * root.u; radiusY: 2.4 * root.u; startAngle: 0; sweepAngle: 360 }
    }
  }
  // two rings of arcs, each side; the outer one breathes out and in, half a beat behind the inner
  Repeater {
    model: [{ "r": 8, "w": 1.4, "k": 1 }, { "r": 13.5, "w": 1.2, "k": 2 }]
    Item {
      required property var modelData
      required property int index
      anchors.fill: parent
      visible: root.kind === "waves"
      scale: root.moving ? 1 + 0.09 * Math.sin(root.t * 4 - index * 1.6) : 1
      opacity: root.moving ? 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(root.t * 4 - index * 1.6)) : 1
      Shape {
        anchors.fill: parent
        preferredRendererType: Shape.CurveRenderer
        antialiasing: true
        ShapePath {
          strokeColor: index === 0 ? root.line : root.soft; strokeWidth: modelData.w; fillColor: "transparent"; capStyle: ShapePath.RoundCap
          PathPolyline { path: root.inked(0, 0, modelData.r, -0.9, 0.9, 16, modelData.k) }
        }
        ShapePath {
          strokeColor: index === 0 ? root.line : root.soft; strokeWidth: modelData.w; fillColor: "transparent"; capStyle: ShapePath.RoundCap
          PathPolyline { path: root.inked(0, 0, modelData.r, Math.PI - 0.9, Math.PI + 0.9, 16, modelData.k + 3) }
        }
      }
    }
  }

  // ---------------------------------------------------------------- signal: the network
  // A dot and three arcs that never quite close: they light one after another, outwards, and start again, like a
  // signal looking for something to answer it.
  Shape {
    anchors.fill: parent
    preferredRendererType: Shape.CurveRenderer
    antialiasing: true
    visible: root.kind === "signal"
    ShapePath {
      strokeColor: root.blood; strokeWidth: 1.2; fillColor: root.blood
      startX: root.cx + 2.3 * root.u; startY: root.cy + 9 * root.u
      PathAngleArc { centerX: root.cx; centerY: root.cy + 9 * root.u; radiusX: 2.3 * root.u; radiusY: 2.3 * root.u; startAngle: 0; sweepAngle: 360 }
    }
    // a crack in the mast: it is not a clean line
    ShapePath {
      strokeColor: root.soft; strokeWidth: 1; fillColor: "transparent"; capStyle: ShapePath.RoundCap
      PathPolyline { path: [root.pt(0, 6.5), root.pt(-1.2, 3), root.pt(1, 0.5), root.pt(-0.6, -2)] }
    }
  }
  Repeater {
    model: [{ "r": 7, "k": 1 }, { "r": 12, "k": 5 }, { "r": 17, "k": 9 }]
    Shape {
      required property var modelData
      required property int index
      anchors.fill: parent
      preferredRendererType: Shape.CurveRenderer
      antialiasing: true
      visible: root.kind === "signal"
      opacity: root.moving ? Math.max(0.22, 1 - ((root.t * 1.5 - index * 0.5) % 1.8 + 1.8) % 1.8 / 1.1) : 1
      ShapePath {
        strokeColor: index === 0 ? root.line : (index === 1 ? root.soft : root.dim)
        strokeWidth: 1.5 - index * 0.15; fillColor: "transparent"; capStyle: ShapePath.RoundCap
        PathPolyline { path: root.inked(0, 9, modelData.r, -Math.PI * 0.86, -Math.PI * 0.14, 22, modelData.k) }
      }
    }
  }

  // ---------------------------------------------------------------- rune: Bluetooth
  Shape {
    anchors.fill: parent
    preferredRendererType: Shape.CurveRenderer
    antialiasing: true
    visible: root.kind === "rune"
    opacity: root.moving ? 0.8 + 0.2 * Math.sin(root.t * 3.1) * Math.sin(root.t * 1.3 + 1) : 1
    ShapePath {
      strokeColor: root.line; strokeWidth: 1.5; fillColor: "transparent"
      capStyle: ShapePath.RoundCap; joinStyle: ShapePath.MiterJoin
      PathPolyline {
        path: [root.pt(-6, -6), root.pt(6, 6), root.pt(0, 12), root.pt(0, -12), root.pt(6, -6), root.pt(-6, 6)]
      }
    }
  }
  Shape {
    anchors.fill: parent
    preferredRendererType: Shape.CurveRenderer
    antialiasing: true
    visible: root.kind === "rune"
    scale: root.moving ? 1 + 0.35 * Math.max(0, Math.sin(root.t * 3.4)) : 1
    ShapePath {
      strokeColor: root.blood; strokeWidth: 1.2; fillColor: root.blood
      startX: root.cx + 1.6 * root.u; startY: root.cy
      PathAngleArc { centerX: root.cx; centerY: root.cy; radiusX: 1.6 * root.u; radiusY: 1.6 * root.u; startAngle: 0; sweepAngle: 360 }
    }
  }

  // ---------------------------------------------------------------- flame: power, guttering
  Item {
    anchors.fill: parent
    visible: root.kind === "flame"
    transformOrigin: Item.Bottom
    scale: root.moving ? 1 + 0.03 * Math.sin(root.t * 5.3) : 1
    transform: Scale {
      origin.x: root.cx; origin.y: root.cy + 12 * root.u
      yScale: root.moving ? 1 + 0.07 * Math.sin(root.t * 7.1) + 0.04 * Math.sin(root.t * 13.3 + 2) : 1
    }
    Shape {
      anchors.fill: parent
      preferredRendererType: Shape.CurveRenderer
      antialiasing: true
      ShapePath {
        strokeColor: root.line; strokeWidth: 1.4; fillColor: "transparent"; joinStyle: ShapePath.RoundJoin
        startX: root.cx; startY: root.cy - 13 * root.u
        PathCubic {
          x: root.cx; y: root.cy + 12 * root.u
          control1X: root.cx + 12 * root.u; control1Y: root.cy - 4 * root.u
          control2X: root.cx + 10 * root.u; control2Y: root.cy + 12 * root.u
        }
        PathCubic {
          x: root.cx; y: root.cy - 13 * root.u
          control1X: root.cx - 10 * root.u; control1Y: root.cy + 12 * root.u
          control2X: root.cx - 12 * root.u; control2Y: root.cy - 4 * root.u
        }
      }
      ShapePath {
        strokeColor: root.blood; strokeWidth: 1.2
        fillColor: Qt.rgba(root.blood.r, root.blood.g, root.blood.b, 0.45)
        startX: root.cx; startY: root.cy - 2 * root.u
        PathCubic {
          x: root.cx; y: root.cy + 9 * root.u
          control1X: root.cx + 5 * root.u; control1Y: root.cy + 2 * root.u
          control2X: root.cx + 4 * root.u; control2Y: root.cy + 9 * root.u
        }
        PathCubic {
          x: root.cx; y: root.cy - 2 * root.u
          control1X: root.cx - 4 * root.u; control1Y: root.cy + 9 * root.u
          control2X: root.cx - 5 * root.u; control2Y: root.cy + 2 * root.u
        }
      }
    }
  }

  // ---------------------------------------------------------------- clock: time, with a hand that will not stop
  // A hand-inked face with twelve uneven ticks, an hour and a minute hand that tell the real time, and a second
  // hand in blood that sweeps. Twelve is marked in blood: it is where the loop begins again.
  Shape {
    anchors.fill: parent
    preferredRendererType: Shape.CurveRenderer
    antialiasing: true
    visible: root.kind === "clock"
    ShapePath {
      strokeColor: root.line; strokeWidth: 1.5; fillColor: "transparent"; joinStyle: ShapePath.RoundJoin
      PathPolyline { path: root.inked(0, 0, 12.5, 0, Math.PI * 2, 48, 2) }
    }
    ShapePath {
      strokeColor: root.soft; strokeWidth: 1; fillColor: "transparent"; capStyle: ShapePath.RoundCap
      PathMultiline {
        paths: {
          var out = []
          for (var i = 0; i < 12; i++) {
            var a = i * Math.PI / 6 - Math.PI / 2
            var r1 = (i % 3 === 0 ? 8.2 : 9.6) + 0.3 * root.wob(i, 6)
            out.push([root.pt(Math.cos(a) * r1, Math.sin(a) * r1), root.pt(Math.cos(a) * 11, Math.sin(a) * 11)])
          }
          return out
        }
      }
    }
    ShapePath {
      strokeColor: root.blood; strokeWidth: 1.6; fillColor: "transparent"; capStyle: ShapePath.RoundCap
      PathPolyline { path: [root.pt(0, -8.4), root.pt(0, -11.2)] }
    }
  }
  // hour and minute hands: real time
  Repeater {
    model: [{ "len": 6, "w": 1.9 }, { "len": 9.5, "w": 1.4 }]
    Item {
      required property var modelData
      required property int index
      anchors.fill: parent
      visible: root.kind === "clock"
      readonly property real mins: new Date(root.nowMs).getMinutes() + new Date(root.nowMs).getSeconds() / 60
      rotation: index === 0 ? ((new Date(root.nowMs).getHours() % 12) + mins / 60) * 30 : mins * 6
      Shape {
        anchors.fill: parent
        preferredRendererType: Shape.CurveRenderer
        antialiasing: true
        ShapePath {
          strokeColor: root.line; strokeWidth: modelData.w; fillColor: "transparent"; capStyle: ShapePath.RoundCap
          PathPolyline { path: [root.pt(0, 1.5), root.pt(0, -modelData.len)] }
        }
      }
    }
  }
  // the second hand sweeps; it ends in a small loop, a curl of hair
  Item {
    anchors.fill: parent
    visible: root.kind === "clock"
    rotation: (root.nowMs % 60000) / 1000 * 6 + (root.moving ? (root.nowMs % 250) * 0 : 0)
    Behavior on rotation { enabled: false }
    Shape {
      anchors.fill: parent
      preferredRendererType: Shape.CurveRenderer
      antialiasing: true
      ShapePath {
        strokeColor: root.blood; strokeWidth: 1; fillColor: "transparent"; capStyle: ShapePath.RoundCap
        PathPolyline { path: [root.pt(0, 3.4), root.pt(0, -9.4)] }
      }
      ShapePath {
        strokeColor: root.blood; strokeWidth: 1; fillColor: "transparent"
        PathPolyline { path: root.inked(0, -10.6, 1.3, 0, Math.PI * 2, 14, 8) }
      }
    }
  }
  Shape {
    anchors.fill: parent
    preferredRendererType: Shape.CurveRenderer
    antialiasing: true
    visible: root.kind === "clock"
    ShapePath {
      strokeColor: root.line; strokeWidth: 1; fillColor: root.ink
      startX: root.cx + 1.5 * root.u; startY: root.cy
      PathAngleArc { centerX: root.cx; centerY: root.cy; radiusX: 1.5 * root.u; radiusY: 1.5 * root.u; startAngle: 0; sweepAngle: 360 }
    }
  }

  // ---------------------------------------------------------------- phone: notifications, a receiver that rings
  // An old handset with a coiled cord (a spiral, of course). It shakes in short bursts, the way a ringing phone
  // does, then goes still; a small blood light beats beside it.
  Item {
    anchors.fill: parent
    visible: root.kind === "phone"
    transformOrigin: Item.Center
    readonly property real ring: root.moving ? Math.max(0, Math.sin(root.t * 2.4 - 0.4) - 0.35) / 0.65 : 0
    rotation: ring * 7 * Math.sin(root.t * 46)
    Shape {
      anchors.fill: parent
      preferredRendererType: Shape.CurveRenderer
      antialiasing: true
      // the handset: a long curved grip with a cup at each end
      ShapePath {
        strokeColor: root.line; strokeWidth: 2.4; fillColor: "transparent"; capStyle: ShapePath.RoundCap
        startX: root.cx - 10 * root.u; startY: root.cy - 4 * root.u
        PathCubic {
          x: root.cx + 10 * root.u; y: root.cy - 4 * root.u
          control1X: root.cx - 6 * root.u; control1Y: root.cy - 11 * root.u
          control2X: root.cx + 6 * root.u; control2Y: root.cy - 11 * root.u
        }
      }
      ShapePath {
        strokeColor: root.line; strokeWidth: 1.2; fillColor: root.ink; joinStyle: ShapePath.RoundJoin
        PathPolyline { path: [root.pt(-13, -4), root.pt(-7, -4), root.pt(-6.4, 1.6), root.pt(-12.4, 1.6), root.pt(-13, -4)] }
      }
      ShapePath {
        strokeColor: root.line; strokeWidth: 1.2; fillColor: root.ink; joinStyle: ShapePath.RoundJoin
        PathPolyline { path: [root.pt(13, -4), root.pt(7, -4), root.pt(6.4, 1.6), root.pt(12.4, 1.6), root.pt(13, -4)] }
      }
      // the coiled cord hangs from the middle
      ShapePath {
        strokeColor: root.soft; strokeWidth: 1.1; fillColor: "transparent"; capStyle: ShapePath.RoundCap; joinStyle: ShapePath.RoundJoin
        PathPolyline {
          path: {
            var out = []
            for (var i = 0; i <= 60; i++) {
              var f = i / 60, a = f * 5 * 2 * Math.PI
              out.push(root.pt(Math.cos(a) * 3 + Math.sin(f * 6) * 0.6, -5 + f * 15 + Math.sin(a) * 1.6))
            }
            return out
          }
        }
      }
    }
  }
  Shape {
    anchors.fill: parent
    preferredRendererType: Shape.CurveRenderer
    antialiasing: true
    visible: root.kind === "phone"
    opacity: root.moving ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(root.t * 9)) : 1
    ShapePath {
      strokeColor: root.blood; strokeWidth: 1; fillColor: root.blood
      startX: root.cx + 1.9 * root.u; startY: root.cy - 9.6 * root.u
      PathAngleArc { centerX: root.cx; centerY: root.cy - 9.6 * root.u; radiusX: 1.9 * root.u; radiusY: 1.9 * root.u; startAngle: 0; sweepAngle: 360 }
    }
  }

  // ---------------------------------------------------------------- mind: AI usage
  Shape {
    anchors.fill: parent
    preferredRendererType: Shape.CurveRenderer
    antialiasing: true
    visible: root.kind === "mind"
    ShapePath {
      strokeColor: root.line; strokeWidth: 1.4; fillColor: "transparent"; joinStyle: ShapePath.RoundJoin
      startX: root.cx; startY: root.cy - 10 * root.u
      PathCubic { x: root.cx - 12 * root.u; y: root.cy - 1 * root.u; control1X: root.cx - 8 * root.u; control1Y: root.cy - 12 * root.u; control2X: root.cx - 14 * root.u; control2Y: root.cy - 8 * root.u }
      PathCubic { x: root.cx; y: root.cy + 10 * root.u; control1X: root.cx - 11 * root.u; control1Y: root.cy + 8 * root.u; control2X: root.cx - 5 * root.u; control2Y: root.cy + 11 * root.u }
    }
    ShapePath {
      strokeColor: root.line; strokeWidth: 1.4; fillColor: "transparent"; joinStyle: ShapePath.RoundJoin
      startX: root.cx; startY: root.cy - 10 * root.u
      PathCubic { x: root.cx + 12 * root.u; y: root.cy - 1 * root.u; control1X: root.cx + 8 * root.u; control1Y: root.cy - 12 * root.u; control2X: root.cx + 14 * root.u; control2Y: root.cy - 8 * root.u }
      PathCubic { x: root.cx; y: root.cy + 10 * root.u; control1X: root.cx + 11 * root.u; control1Y: root.cy + 8 * root.u; control2X: root.cx + 5 * root.u; control2Y: root.cy + 11 * root.u }
    }
  }
  // the folds light up in turn, as if something were thinking
  Repeater {
    model: [-1, 1]
    Shape {
      required property int modelData
      required property int index
      anchors.fill: parent
      preferredRendererType: Shape.CurveRenderer
      antialiasing: true
      visible: root.kind === "mind"
      opacity: root.moving ? 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(root.t * 3 + index * 3.14)) : 0.6
      ShapePath {
        strokeColor: root.soft; strokeWidth: 1; fillColor: "transparent"; capStyle: ShapePath.RoundCap
        PathPolyline { path: [root.pt(modelData * 3, -6), root.pt(modelData * 7, -3), root.pt(modelData * 4, 0), root.pt(modelData * 8, 3)] }
      }
    }
  }
  Shape {
    anchors.fill: parent
    preferredRendererType: Shape.CurveRenderer
    antialiasing: true
    visible: root.kind === "mind"
    scale: root.moving ? 1 + 0.5 * Math.max(0, Math.sin(root.t * 3)) : 1
    ShapePath {
      strokeColor: root.blood; strokeWidth: 1; fillColor: root.blood
      startX: root.cx + 1.8 * root.u; startY: root.cy + 2 * root.u
      PathAngleArc { centerX: root.cx; centerY: root.cy + 2 * root.u; radiusX: 1.8 * root.u; radiusY: 1.8 * root.u; startAngle: 0; sweepAngle: 360 }
    }
  }

  // ---------------------------------------------------------------- needle: the processor, a seismograph
  // A trace that shivers along its line and, once, tears up and down; the needle that draws it rests on the peak, and
  // that peak is the one thing in blood.
  Shape {
    anchors.fill: parent
    preferredRendererType: Shape.CurveRenderer
    antialiasing: true
    visible: root.kind === "needle"
    ShapePath {
      strokeColor: root.line; strokeWidth: 1.3; fillColor: "transparent"; capStyle: ShapePath.RoundCap; joinStyle: ShapePath.MiterJoin
      PathPolyline { path: [root.pt(-15, 4), root.pt(-12, 4.7), root.pt(-9, 3.5), root.pt(-6.5, 4.5), root.pt(-4.4, 3.8), root.pt(-3.2, 3.9)] }
    }
    ShapePath {
      strokeColor: root.line; strokeWidth: 1.3; fillColor: "transparent"; capStyle: ShapePath.RoundCap; joinStyle: ShapePath.MiterJoin
      PathPolyline { path: [root.pt(2.6, 4.2), root.pt(5, 3.5), root.pt(8, 4.6), root.pt(11, 3.8), root.pt(15, 4.2)] }
    }
    // the tear: up to the peak, down below the line, and back
    ShapePath {
      strokeColor: root.blood; strokeWidth: 1.5; fillColor: "transparent"; capStyle: ShapePath.RoundCap; joinStyle: ShapePath.MiterJoin
      PathPolyline { path: [root.pt(-3.2, 3.9), root.pt(-1.2, -9.5), root.pt(1, 10.5), root.pt(2.6, 4.2)] }
    }
    // the arm of the needle, from its pivot to the peak
    ShapePath {
      strokeColor: root.soft; strokeWidth: 1; fillColor: "transparent"; capStyle: ShapePath.RoundCap
      PathPolyline { path: [root.pt(13, -12), root.pt(-0.6, -8.6)] }
    }
    ShapePath {
      strokeColor: root.soft; strokeWidth: 1; fillColor: "transparent"
      startX: root.cx + (13 + 1.6) * root.u; startY: root.cy - 12 * root.u
      PathAngleArc { centerX: root.cx + 13 * root.u; centerY: root.cy - 12 * root.u; radiusX: 1.6 * root.u; radiusY: 1.6 * root.u; startAngle: 0; sweepAngle: 360 }
    }
  }
  Shape {
    anchors.fill: parent
    preferredRendererType: Shape.CurveRenderer
    antialiasing: true
    visible: root.kind === "needle"
    scale: root.moving ? 1 + 0.35 * Math.max(0, Math.sin(root.t * 3)) : 1
    ShapePath {
      strokeColor: root.blood; strokeWidth: 1; fillColor: root.blood
      startX: root.cx + (-1.2 + 1.7) * root.u; startY: root.cy - 9.5 * root.u
      PathAngleArc { centerX: root.cx - 1.2 * root.u; centerY: root.cy - 9.5 * root.u; radiusX: 1.7 * root.u; radiusY: 1.7 * root.u; startAngle: 0; sweepAngle: 360 }
    }
  }

  // ---------------------------------------------------------------- web: memory, a thread (糸) that keeps spinning
  // Five spokes, two rings of thread sagging between them, and one strand in blood that runs off the edge and hangs.
  Shape {
    anchors.fill: parent
    preferredRendererType: Shape.CurveRenderer
    antialiasing: true
    visible: root.kind === "web"
    ShapePath {
      strokeColor: root.soft; strokeWidth: 1; fillColor: "transparent"; capStyle: ShapePath.RoundCap
      PathMultiline {
        paths: [0, 1, 3, 4].map(function(i) {
          var a = (-90 + 72 * i) * Math.PI / 180
          return [root.pt(0, 0), root.pt(Math.cos(a) * 13, Math.sin(a) * 13)]
        })
      }
    }
    ShapePath {
      strokeColor: root.line; strokeWidth: 1.2; fillColor: "transparent"; capStyle: ShapePath.RoundCap; joinStyle: ShapePath.RoundJoin
      PathPolyline { path: root.webRing(5.4) }
    }
    ShapePath {
      strokeColor: root.line; strokeWidth: 1.2; fillColor: "transparent"; capStyle: ShapePath.RoundCap; joinStyle: ShapePath.RoundJoin
      PathPolyline { path: root.webRing(10) }
    }
    // the strand that got away: the third spoke, prolonged and hanging, with a drop at its end
    ShapePath {
      strokeColor: root.blood; strokeWidth: 1.4; fillColor: "transparent"; capStyle: ShapePath.RoundCap
      PathPolyline { path: [root.pt(0, 0), root.pt(7.6, 10.5), root.pt(8.4, 13.5)] }
    }
  }
  Shape {
    anchors.fill: parent
    preferredRendererType: Shape.CurveRenderer
    antialiasing: true
    visible: root.kind === "web"
    scale: root.moving ? 1 + 0.3 * Math.max(0, Math.sin(root.t * 3)) : 1
    ShapePath {
      strokeColor: root.blood; strokeWidth: 1; fillColor: root.blood
      startX: root.cx + 1.9 * root.u; startY: root.cy
      PathAngleArc { centerX: root.cx; centerY: root.cy; radiusX: 1.9 * root.u; radiusY: 1.9 * root.u; startAngle: 0; sweepAngle: 360 }
      PathAngleArc { centerX: root.cx + 8.4 * root.u; centerY: root.cy + 14.6 * root.u; radiusX: 1.4 * root.u; radiusY: 1.4 * root.u; startAngle: 0; sweepAngle: 360 }
    }
  }

  // ---------------------------------------------------------------- amigara: storage, the hole made for you
  // A wall with a hole in it, and the hole is the shape of a person: it was cut for one body, and it is yours.
  Shape {
    anchors.fill: parent
    preferredRendererType: Shape.CurveRenderer
    antialiasing: true
    visible: root.kind === "amigara"
    ShapePath {
      strokeColor: root.line; strokeWidth: 1.4; fillColor: "transparent"; joinStyle: ShapePath.MiterJoin
      PathPolyline { path: [root.pt(-12, -13), root.pt(12, -13), root.pt(12, 13), root.pt(-12, 13), root.pt(-12, -13)] }
    }
    // the wall's grain, at two corners
    ShapePath {
      strokeColor: root.dim; strokeWidth: 1; fillColor: "transparent"; capStyle: ShapePath.RoundCap
      PathMultiline {
        paths: [[root.pt(-9.5, -10.5), root.pt(-6, -10.5)], [root.pt(-9.5, -8), root.pt(-7.5, -8)],
                [root.pt(6, 10.5), root.pt(9.5, 10.5)], [root.pt(7.5, 8), root.pt(9.5, 8)]]
      }
    }
    // the hole: a head and a body with its arms at its sides
    ShapePath {
      strokeColor: root.blood; strokeWidth: 1.2; fillColor: root.redSoft; joinStyle: ShapePath.MiterJoin
      PathPolyline { path: [root.pt(-4.4, -3.4), root.pt(4.4, -3.4), root.pt(5.2, 4.6), root.pt(3, 4.6), root.pt(3, 11), root.pt(-3, 11), root.pt(-3, 4.6), root.pt(-5.2, 4.6), root.pt(-4.4, -3.4)] }
    }
    ShapePath {
      strokeColor: root.blood; strokeWidth: 1.2; fillColor: root.redSoft
      startX: root.cx + 3.2 * root.u; startY: root.cy - 7.4 * root.u
      PathAngleArc { centerX: root.cx; centerY: root.cy - 7.4 * root.u; radiusX: 3.2 * root.u; radiusY: 3.2 * root.u; startAngle: 0; sweepAngle: 360 }
    }
  }

  // ---------------------------------------------------------------- the sky
  Item {
    anchors.fill: parent
    visible: ["sun", "suncloud"].indexOf(root.kind) >= 0
    rotation: root.moving ? root.t * 8 : 0
    Shape {
      anchors.fill: parent
      preferredRendererType: Shape.CurveRenderer
      antialiasing: true
      ShapePath {
        strokeColor: root.soft; strokeWidth: 1.2; fillColor: "transparent"; capStyle: ShapePath.RoundCap
        PathMultiline {
          paths: {
            var out = []
            for (var i = 0; i < 12; i++) {
              var a = i * Math.PI / 6
              out.push([root.pt(Math.cos(a) * 9, Math.sin(a) * 9), root.pt(Math.cos(a) * (i % 2 ? 12 : 14), Math.sin(a) * (i % 2 ? 12 : 14))])
            }
            return out
          }
        }
      }
    }
  }
  Shape {
    anchors.fill: parent
    preferredRendererType: Shape.CurveRenderer
    antialiasing: true
    visible: ["sun", "suncloud"].indexOf(root.kind) >= 0
    ShapePath {
      strokeColor: root.line; strokeWidth: 1.4; fillColor: "transparent"
      PathPolyline { path: root.inked(0, 0, 6, 0, Math.PI * 2, 30, 3) }
    }
    ShapePath {
      strokeColor: root.blood; strokeWidth: 1; fillColor: root.blood
      startX: root.cx + 1.8 * root.u; startY: root.cy
      PathAngleArc { centerX: root.cx; centerY: root.cy; radiusX: 1.8 * root.u; radiusY: 1.8 * root.u; startAngle: 0; sweepAngle: 360 }
    }
  }

  Shape {
    anchors.fill: parent
    preferredRendererType: Shape.CurveRenderer
    antialiasing: true
    visible: root.kind === "moon"
    ShapePath {
      strokeColor: root.line; strokeWidth: 1.4; fillColor: "transparent"; joinStyle: ShapePath.RoundJoin
      startX: root.cx + 4 * root.u; startY: root.cy - 12 * root.u
      PathArc { x: root.cx + 4 * root.u; y: root.cy + 12 * root.u; radiusX: 12 * root.u; radiusY: 12 * root.u; direction: PathArc.Counterclockwise }
      PathArc { x: root.cx + 4 * root.u; y: root.cy - 12 * root.u; radiusX: 9 * root.u; radiusY: 9 * root.u; direction: PathArc.Clockwise }
    }
  }
  Shape {
    anchors.fill: parent
    preferredRendererType: Shape.CurveRenderer
    antialiasing: true
    visible: root.kind === "moon"
    opacity: root.moving ? 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(root.t * 2.6)) : 1
    ShapePath {
      strokeColor: root.blood; strokeWidth: 1; fillColor: root.blood
      startX: root.cx + 9 * root.u + 1.6 * root.u; startY: root.cy - 6 * root.u
      PathAngleArc { centerX: root.cx + 9 * root.u; centerY: root.cy - 6 * root.u; radiusX: 1.6 * root.u; radiusY: 1.6 * root.u; startAngle: 0; sweepAngle: 360 }
    }
  }

  // a cloud, drifting a little, with what falls from it
  Item {
    anchors.fill: parent
    visible: ["cloud", "rain", "storm", "snow"].indexOf(root.kind) >= 0
    x: root.moving ? 1.6 * Math.sin(root.t * 0.9) : 0
    Shape {
      anchors.fill: parent
      preferredRendererType: Shape.CurveRenderer
      antialiasing: true
      ShapePath {
        strokeColor: root.line; strokeWidth: 1.4; fillColor: "transparent"
        capStyle: ShapePath.RoundCap; joinStyle: ShapePath.RoundJoin
        startX: root.cx - 12 * root.u; startY: root.cy + (root.kind === "cloud" ? 5 : 1) * root.u
        PathArc { x: root.cx - 9 * root.u; y: root.cy + (root.kind === "cloud" ? -3 : -7) * root.u; radiusX: 5 * root.u; radiusY: 5 * root.u; direction: PathArc.Clockwise }
        PathArc { x: root.cx + 4 * root.u; y: root.cy + (root.kind === "cloud" ? -6 : -10) * root.u; radiusX: 7 * root.u; radiusY: 7 * root.u; direction: PathArc.Clockwise }
        PathArc { x: root.cx + 11 * root.u; y: root.cy + (root.kind === "cloud" ? 1 : -3) * root.u; radiusX: 6 * root.u; radiusY: 6 * root.u; direction: PathArc.Clockwise }
        PathArc { x: root.cx + 9 * root.u; y: root.cy + (root.kind === "cloud" ? 5 : 1) * root.u; radiusX: 3 * root.u; radiusY: 3 * root.u; direction: PathArc.Clockwise }
        PathLine { x: root.cx - 12 * root.u; y: root.cy + (root.kind === "cloud" ? 5 : 1) * root.u }
      }
    }
  }
  // rain and snow fall; the storm flashes
  Item {
    anchors.fill: parent
    visible: root.kind === "rain" || root.kind === "snow"
    y: root.moving ? ((root.t * 9) % 6) - 3 : 0
    opacity: root.moving ? 1 - (((root.t * 9) % 6) / 6) * 0.8 : 1
    Shape {
      anchors.fill: parent
      preferredRendererType: Shape.CurveRenderer
      antialiasing: true
      ShapePath {
        strokeColor: root.blood; strokeWidth: 1.3; fillColor: "transparent"; capStyle: ShapePath.RoundCap
        PathMultiline {
          paths: root.kind === "rain" ? [
            [root.pt(-7, 5), root.pt(-9, 11)], [root.pt(-1, 5), root.pt(-3, 11)],
            [root.pt(5, 5), root.pt(3, 11)], [root.pt(10, 5), root.pt(8, 11)]] : []
        }
      }
      ShapePath {
        strokeColor: root.blood; strokeWidth: 1.2; fillColor: "transparent"; capStyle: ShapePath.RoundCap
        PathMultiline {
          paths: {
            if (root.kind !== "snow") return []
            var out = []
            var cs = [[-6, 9], [0, 12], [6, 9]]
            for (var c = 0; c < cs.length; c++)
              for (var k = 0; k < 3; k++) {
                var a = k * Math.PI / 3
                out.push([root.pt(cs[c][0] - Math.cos(a) * 2.2, cs[c][1] - Math.sin(a) * 2.2),
                          root.pt(cs[c][0] + Math.cos(a) * 2.2, cs[c][1] + Math.sin(a) * 2.2)])
              }
            return out
          }
        }
      }
    }
  }
  Shape {
    anchors.fill: parent
    preferredRendererType: Shape.CurveRenderer
    antialiasing: true
    visible: root.kind === "storm"
    opacity: root.moving ? (Math.sin(root.t * 3.7) > 0.55 || Math.sin(root.t * 9.1) > 0.92 ? 1 : 0.2) : 1
    ShapePath {
      strokeColor: root.blood; strokeWidth: 1.3; fillColor: "transparent"
      capStyle: ShapePath.RoundCap; joinStyle: ShapePath.MiterJoin
      PathPolyline { path: [root.pt(2, 3), root.pt(-3, 8), root.pt(1, 8), root.pt(-3, 13)] }
    }
  }

  // fog: layers that do not quite line up, sliding past each other
  Repeater {
    model: [{ "y": -7, "x0": -12, "c1": -6, "c2": 2, "dx": 20, "col": 0, "ph": 0 },
            { "y": 0, "x0": -8, "c1": -2, "c2": 6, "dx": 20, "col": 0, "ph": 2 },
            { "y": 7, "x0": -12, "c1": -6, "c2": 0, "dx": 18, "col": 1, "ph": 4 }]
    Item {
      required property var modelData
      anchors.fill: parent
      visible: root.kind === "fog"
      x: root.moving ? 2.2 * Math.sin(root.t * 0.8 + modelData.ph) : 0
      Shape {
        anchors.fill: parent
        preferredRendererType: Shape.CurveRenderer
        antialiasing: true
        ShapePath {
          strokeColor: modelData.col ? root.blood : root.line; strokeWidth: 1.4; fillColor: "transparent"; capStyle: ShapePath.RoundCap
          startX: root.cx + modelData.x0 * root.u; startY: root.cy + modelData.y * root.u
          PathCubic {
            x: root.cx + (modelData.x0 + modelData.dx) * root.u; y: root.cy + modelData.y * root.u
            control1X: root.cx + modelData.c1 * root.u; control1Y: root.cy + (modelData.y - 3) * root.u
            control2X: root.cx + modelData.c2 * root.u; control2Y: root.cy + (modelData.y + 3) * root.u
          }
        }
      }
    }
  }
}

import QtQuick
import QtQuick.Shapes
import "ItoEyeModel.js" as EyeM
import "ItoEyeReal.js" as EyeR

// One inked eye (ichor-eyes.md section 1). It has NO clock: it draws what it is given (blink, gaze, pupil, fade) and nothing
// else, so the lab, the liquid and later a panel frame can all use it. The drawing is ItoEyeModel.js; this file only turns
// its parts into paths and colours them from the ItoSealInk eye tokens (no colour is written here).
//
//   ink      an ItoSealInk
//   size     the eye's width in px (its height is 0.62 of that)
//   blink    0 open .. 1 shut (layer D is rebuilt when it moves by 0.02)
//   gazeX/Y  the iris centre's offset in units (+-11, +-3.5): the iris is cut by the flesh ring, never by a clip
//   pupil    the pupil radius in units (6.5; 3.8 for the stare)
//   mirror   drawn flipped about its centre (the inner corner on the right)
//   seed     where the iris spiral starts, and the hand of every stroke (hatch, veins, striae, gaps): an integer
//   fade     0 .. 1: every colour toward `body` (depth: the eye is submerged)
//   hot      0 .. 1: the veins go from `eyeVein` to `eyeVeinHot`, thicker
//   body     the colour of the liquid around the eye (the flesh ring is derived from it)
//   style    "ink" (the look so far) or "gekiga" (options.md section C: duotone paper and ink, tone as hatch, baked once into a
//            Canvas by ItoEyeBake). Gekiga is a still, open eye: blink, gaze and pupil are not drawn, and below 28 px the eye is the
//            ink style again (hatch would turn to mud there).
//   frame    gekiga on a frame (the popup crest) rather than in the liquid: paper is `bone`, ink the panel's, the specular `highlight`
//   style    also "real" (eyes-v2.md: realistic manga eyes). `archetype` picks the face (stare heavy lidless spiral weeping poly slit, or `eyeball`:
//            a loose lidless sphere), `rl` overrides ItoEyeReal.realParams (veil, yaw, bloodshot, ...). The tier follows the size (with
//            hysteresis): < 24 px a sigil (ItoEyeSigil, a few Shape paths), 24-55 bold, 56-119 full, >= 120 detail (ItoEyeRealBake, a Canvas
//            baked once). `blink` picks one of four baked frames (open, 0.35, 0.7, shut), each baked the first time it is asked for.
//            `crest` is the frame palette (the crest), `sigilPaper: false` leaves the sclera out of a sigil. Like the others it has no clock.
//   mole     lore pass (Tomie's mole): a small filled dot under the outer corner, at (80, 50) in eye units, radius max(2.2, 0.9 px) units, in
//            the eye's line colour and faded like the eye; ink style at detail 2 and 3 only (nothing at 1, in gekiga or real); it mirrors with the eye
//   gk       overrides of ItoEyeModel.gekigaParams (aperture, droop, tilt, irisR, lidCover, lowerGap, pupilState, bloodshot, gazeX, veil)
// Layers (z): A sclera, caruncle, veins; B the iris group; C flesh ring, crease, hatch, lower lid; D the lid.
Item {
  id: root

  property var ink: null
  property real size: 40
  property real blink: 0
  property real gazeX: 0
  property real gazeY: 0
  property real pupil: 6.5
  property bool mirror: false
  property int seed: 0
  property real fade: 0.12
  property real hot: 0
  property color body: ink ? ink.fill : noColor
  property string style: "ink"
  property bool frame: false
  property var gk: null
  property string archetype: "heavy"
  property var rl: null
  property bool sigilPaper: true
  property bool mole: false

  readonly property color noColor: Qt.rgba(0, 0, 0, 0)
  width: size
  height: size * EyeM.BOX.h / EyeM.BOX.w

  // the detail level, with hysteresis (it only ever changes in `refresh`)
  readonly property int sizePx: Math.max(1, Math.round(size))
  property int level: EyeM.detailFor(Math.max(1, Math.round(size)))   // the first value; `refresh` takes over on a resize
  function refresh() { level = EyeM.detailFor(sizePx, level); rtier = EyeR.tierFor(sizePx, rtier) }
  onSizePxChanged: refresh()

  readonly property real qb: EyeM.quantBlink(blink)
  readonly property real qpupil: Math.round(pupil * 10) / 10
  readonly property real gx: Math.max(-EyeM.GAZE.x, Math.min(EyeM.GAZE.x, gazeX))
  readonly property real gy: Math.max(-EyeM.GAZE.y, Math.min(EyeM.GAZE.y, gazeY))

  readonly property bool pale: ink ? ink.eyePale : false
  // ---- real ---------------------------------------------------------------------------------------------------------------------------
  readonly property bool realOn: style === "real" && ink !== null
  readonly property bool ball: archetype === "eyeball"
  property int rtier: EyeR.tierFor(Math.max(1, Math.round(size)))   // with hysteresis, like `level`
  readonly property int blinkIdx: Math.max(0, Math.min(3, Math.round(blink * 3)))
  property int seenMask: 1
  onBlinkIdxChanged: seenMask = seenMask | (1 << blinkIdx)
  readonly property bool realSigil: realOn && (ball || rtier < 1)
  readonly property bool realBake: realOn && !realSigil
  // the paper and the ink of the eye, by luminance (ItoSealInk); on the liquid they are mixed toward the body by `fade`
  readonly property color rPaper0: !ink ? noColor : (frame ? ink.realPaperF : ink.realPaper(body))
  readonly property color rInk0: !ink ? noColor : (frame ? ink.realInkF : ink.realInk(rPaper0))
  readonly property bool rEdge: realOn && !frame && ink.realEdge(rPaper0, body)
  function rfade(c) { return !ink ? noColor : (frame || fade <= 0 ? c : ink.mix(c, body, fade)) }
  readonly property var realPal: {
    if (!realOn) return null
    return {
      paper: rfade(rPaper0), ink: rfade(rInk0), skin: rfade(ink.realSkin(rPaper0, rInk0, frame ? ink.panel : body)), tint: rfade(ink.realTint(rPaper0, frame)), caruncle: rfade(ink.realCaruncle(rPaper0)),
      vein0: rfade(ink.realVein(rPaper0, rInk0, 0)), vein1: rfade(ink.realVein(rPaper0, rInk0, 1)), tear: rfade(ink.realTear(rPaper0, rInk0))
    }
  }
  readonly property var blinkValues: [0, 0.35, 0.7, 1]
  function realParamsFor(idx) {
    if (!realOn) return null
    if (ball) return EyeR.eyeballParams(seed, rl && rl.yaw !== undefined ? rl.yaw : 0, rl)
    var o = {}, k
    if (rl) for (k in rl) o[k] = rl[k]
    o.blink = blinkValues[idx]
    return EyeR.realParams(archetype, seed, o)
  }
  readonly property var rParamsNow: realSigil ? realParamsFor(blinkIdx) : null
  function partsFor(idx) { return realBake && (seenMask & (1 << idx)) ? EyeR.realParts(realParamsFor(idx), sizePx, rtier, rEdge) : null }

  // gekiga draws its own layers, so the ink style's parts are not built at all while it is on
  readonly property bool gekiga: style === "gekiga" && sizePx >= EyeM.GK.minPx && ink !== null
  readonly property bool other: gekiga || realOn
  readonly property var noStatics: ({ A: [], C: [] })
  readonly property var statics: other ? noStatics : EyeM.staticParts(level, sizePx, seed, pale)
  readonly property var partsA: statics.A
  readonly property var partsC: statics.C
  readonly property var partsB: other ? [] : EyeM.irisParts(level, sizePx, seed, qpupil)
  readonly property var partsD: other ? [] : EyeM.lidShape(qb, level, sizePx, seed, pale)
  readonly property var gkParts: gekiga ? EyeM.gekigaParts(EyeM.gekigaParams(seed, gk), sizePx, seed) : null

  // ---- colours: one token per role, mixed toward the body by `fade` (the gleam by half as much) -------------------
  function raw(role) {
    if (!ink) return noColor
    switch (role) {
      case "sclera": return ink.eyeSclera
      case "line": return ink.eyeLine
      case "iris": return ink.eyeIris
      case "pupil": return ink.eyePupil
      case "gleam": return ink.eyeGleam
      case "vein": return ink.mix(ink.eyeVein, ink.eyeVeinHot, hot)
      case "skin": return ink.eyeSkin(body)
      case "caruncle": return ink.mix(ink.eyeSclera, raw("vein"), EyeM.EYE_INK.caruncle)
      case "disc1": return ink.mix(ink.eyeIrisRim, ink.eyePupil, EyeM.EYE_INK.discL1)
      case "shade": return ink.eyeShade
      case "keyline": return ink.eyeKeyline
      case "lidTone": return ink.eyeLidTone
      case "bagTone": return ink.eyeBagTone(body)
      case "fill": return body
      case "scleraEnd": return ink.mix(ink.eyeSclera, ink.eyeShade, EyeM.EYE_INK.shadeEnd)
      case "irisRim": return ink.eyeIrisRim
    }
    return noColor
  }
  function faded(role) {
    if (!ink) return noColor
    return ink.mix(raw(role), body, role === "gleam" ? fade * EyeM.FADE.gleamMul : fade)
  }
  // a part's colour: what is under it, mixed toward its token by its strength (opaque), or its token translucent
  function colorOf(p) {
    if (!p || !ink) return noColor
    var a = p.role === "vein" ? p.a + (1 - p.a) * hot : p.a
    if (p.alpha) return ink.alpha(faded(p.role), a)
    return a >= 0.999 ? faded(p.role) : ink.mix(faded(p.under), faded(p.role), a)
  }
  function pathOf(p) { return !p ? "" : (p.hotPath && hot > 0.5 ? p.hotPath : p.path) }
  function index(parts) { var m = {}; for (var i = 0; i < parts.length; i++) m[parts[i].id] = parts[i]; return m }

  // the gekiga colours, one per role, from the same tokens (on a frame: paper `bone`, ink the panel's)
  readonly property var gkPal: {
    if (!ink || !gekiga) return null
    var paper = frame ? ink.bone : faded("sclera"), line = frame ? ink.panel : faded("line")
    return {
      paper: paper, ink: line, tint: ink.mix(paper, ink.eyeIris, 0.18),
      skin: frame ? ink.mix(ink.panel, ink.bone, 0.08) : faded("skin"),
      veinHot: ink.eyeVeinHot, gleam: frame ? ink.highlight : faded("gleam")
    }
  }

  readonly property var byA: index(partsA)
  readonly property var byB: index(partsB)
  readonly property var byC: index(partsC)
  readonly property var byD: index(partsD)

  RadialGradient {
    id: scleraGrad
    centerX: 50; centerY: 33; focalX: 50; focalY: 33; centerRadius: 46; focalRadius: 0
    GradientStop { position: 0; color: root.faded("sclera") }
    GradientStop { position: 0.26; color: root.faded("sclera") }
    GradientStop { position: 0.60; color: root.faded("scleraEnd") }
    GradientStop { position: 1; color: root.faded("shade") }
  }
  RadialGradient {
    id: irisGrad
    centerX: 0; centerY: 0; focalX: 0; focalY: 0; centerRadius: 16; focalRadius: 0
    GradientStop { position: 0; color: root.faded("iris") }
    GradientStop { position: 0.62; color: root.faded("iris") }
    GradientStop { position: 1; color: root.faded("irisRim") }
    GradientStop { position: 1; color: root.faded("irisRim") }
  }

  ItoEyeBake {
    visible: root.gekiga
    parts: root.gkParts
    pal: root.gkPal
    size: root.size
    mirror: root.mirror
  }

  // the real eye: four frames, each baked the first time it is asked for; or the sigil
  Repeater {
    model: 4
    ItoEyeRealBake {
      required property int index
      visible: root.realBake && index === root.blinkIdx
      parts: root.partsFor(index)
      pal: root.realPal
      size: root.size
      mirror: root.mirror
    }
  }
  ItoEyeSigil {
    visible: root.realSigil
    params: root.rParamsNow
    pal: root.realPal
    size: root.size
    paper: root.sigilPaper
    mirror: root.mirror
  }

  // the drawing, in units, scaled (and mirrored about x = 50) by one matrix
  Item {
    id: unit
    visible: !root.gekiga && !root.realOn
    width: EyeM.BOX.w; height: EyeM.BOX.h
    transform: Matrix4x4 {
      readonly property real s: root.size / EyeM.BOX.w
      matrix: Qt.matrix4x4(root.mirror ? -s : s, 0, 0, root.mirror ? EyeM.BOX.w * s : 0,
                           0, s, 0, 0,
                           0, 0, 1, 0,
                           0, 0, 0, 1)
    }

    component Layer: Shape {
      id: sh
      property var slots: []
      property var byId: ({})
      width: EyeM.BOX.w; height: EyeM.BOX.h
      preferredRendererType: Shape.CurveRenderer
      antialiasing: true
      Instantiator {
        model: sh.slots
        delegate: ShapePath {
          id: sp
          required property string modelData
          readonly property var p: sh.byId[modelData] === undefined ? null : sh.byId[modelData]
          strokeWidth: -1
          fillColor: p && !p.grad ? root.colorOf(p) : root.noColor
          fillRule: p && p.rule === "odd" ? ShapePath.OddEvenFill : ShapePath.WindingFill
          fillGradient: p && p.grad === "sclera" ? scleraGrad : (p && p.grad === "iris" ? irisGrad : null)
          PathSvg { path: root.pathOf(sp.p) }
        }
        onObjectAdded: function(i, o) { sh.data.push(o) }
      }
    }

    Layer { id: layerA; z: 1; slots: EyeM.SLOTS.A; byId: root.byA }
    Layer {
      id: layerB
      z: 2
      x: EyeM.IRIS_C.x + root.gx; y: EyeM.IRIS_C.y + root.gy
      slots: EyeM.SLOTS.B; byId: root.byB
    }
    Layer { id: layerC; z: 3; slots: EyeM.SLOTS.C; byId: root.byC }
    Layer { id: layerD; z: 4; slots: EyeM.SLOTS.D; byId: root.byD }

    // Tomie's mole: on the skin under the outer corner, drawn with the flesh ring's layer so the lid never covers it
    Shape {
      z: 3.5
      visible: root.mole && root.level >= 2
      width: EyeM.BOX.w; height: EyeM.BOX.h
      preferredRendererType: Shape.CurveRenderer
      antialiasing: true
      ShapePath {
        id: molePath
        readonly property real r: Math.max(2.2, 0.9 / (root.size / 100))
        strokeWidth: -1
        fillColor: root.faded("line")
        PathSvg { path: "M " + (80 + molePath.r) + " 50 A " + molePath.r + " " + molePath.r + " 0 1 1 " + (80 - molePath.r) + " 50 A " + molePath.r + " " + molePath.r + " 0 1 1 " + (80 + molePath.r) + " 50 Z" }
      }
    }
  }
}

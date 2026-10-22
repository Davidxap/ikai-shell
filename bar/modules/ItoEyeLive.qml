import QtQuick
import QtQuick.Shapes
import "ItoEyeReal.js" as EyeR
import "ItoEyeMotion.js" as Mot
import "ItoIchor.js" as Ichor

// A real eye that can MOVE (eyes-animation.md section 3): the same drawing as ItoEyeGlyph's `real` style, split into plates (ItoEyeReal.realPlates) so the
// iris, the pupil and the catchlight move as textures and shapes over baked canvases, and nothing is ever repainted while the eye moves.
//
//   back plate     sclera paper, hatch, caruncle, stipple          (one per lid frame: a frame swap)
//   vein plate     the veins, only when `veinPlate` (a pulse: opacity)
//   iris plate     the iris, baked unclipped with the pupil at its smallest, ONE for all frames: moved by x / y, turned by rotation
//   pupil shapes   up to three unit shapes scaled by the pupil
//   catchlight     paper Shapes at 0.3 of the gaze (parallax: it stays with the light)
//   front plate    an opaque ground-coloured band round the opening (it hides the iris that strays under a lid), then lids, lashes, skin  (per lid frame)
//
// It has NO clock: it draws what it is given (the inputs below), so the lab, the crest's motor and the liquid can all use it. ItoEyeGlyph is not touched:
// not using ItoEyeLive is the rollback. Colours come only from the ItoSealInk tokens (as ItoEyeGlyph's `real` style); this file writes none.
//
//   ink, size, mirror, seed, archetype, rl, frame, body, fade   as ItoEyeGlyph (frame: the crest's palette; body: the liquid the eye is on)
//   lid         the lid frame (an index into ItoEyeMotion.frameValues: 4 frames at T1, 6 at T2 and up; the last is shut)
//   gazeX/Y     the iris centre's offset in units, inside the archetype's gaze box
//   pupilK      the pupil as a multiplier of the baked one (1 = baked); for the spiral the iris plate's scale (the breath)
//   irisRot     the iris plate's rotation in degrees (the spiral's turn)
//   veinK       the vein plate's opacity (the pulse; with `veinPlate`)
//   flap        the eye is drowned in the liquid (not on a frame): instead of the flat occluder band it wears a torn flap of its own skin (master-queue
//               section 2): filled `mix(flapBody, bone, 0.10)`, its outline inked 0.5 px and broken on the lit side. `flapBody` is the liquid's colour at the eye's
//               centre, set by the host when the fade step or the 8 px depth bucket changes (it defaults to `body`)
//   tearU/tearK the weeping eye's tear bead (EM5, P7): its place along the baked trail (0 at the corner .. 1) and its scale (0..1), from ItoEyeMotion.tearAt.
//               Defaults 0 / 1 draw the bead where the flat bake has it. The bead and its glint are not part of the front plate.
//   omenPupil   > 0 shows the second pupil (the "extra pupil" omen)
//   bakeMask    the lid frames to bake (bit i); with `lazy` a frame is also baked the first time it is shown (as the glyph does)
//   paints      how many times any plate has been painted (a read-only counter for the lab: it must not change while the eye moves)
//   paintedMask the frames whose plates are painted now (the motor reads it to know the shut and the open frame are ready)
Item {
  id: root

  property var ink: null
  property real size: 68
  property bool mirror: false
  property int seed: 0
  property string archetype: "heavy"
  property var rl: null
  property bool frame: false
  property color body: ink ? ink.fill : noColor
  property real fade: 0

  property int lid: 0
  property real gazeX: 0
  property real gazeY: 0
  property real pupilK: 1
  property real irisRot: 0
  property real veinK: 1
  property real tearU: 0
  property real tearK: 1
  property real omenPupil: 0
  property bool veinPlate: false
  property bool flap: false
  property color flapBody: body
  property int bakeMask: 0
  property bool lazy: true
  property bool showIris: true       // a test hook for the lab's leak test: false hides the iris, pupils and catchlight

  readonly property color noColor: Qt.alpha(palette.window, 0)
  readonly property real k: size / 100
  width: size
  height: size * 0.62

  readonly property int sizePx: Math.max(1, Math.round(size))
  property int rtier: EyeR.tierFor(Math.max(1, Math.round(size)))
  onSizePxChanged: rtier = EyeR.tierFor(sizePx, rtier)
  readonly property bool supported: ink !== null && archetype !== "eyeball" && rtier >= 1
  readonly property var lidValues: Mot.frameValues(rtier)
  readonly property int nFrames: lidValues.length
  readonly property int lidIdx: Math.max(0, Math.min(nFrames - 1, lid))
  readonly property int shutIdx: nFrames - 1

  // ---- the frames that are baked ---------------------------------------------------------------------------------------------------------------
  property int seenMask: 1
  onLidIdxChanged: if (lazy) seenMask = seenMask | (1 << lidIdx)
  // a new face or a new tier: only the open frame is kept; the others are baked again when they are asked for
  onArchetypeChanged: { seenMask = 1 | (1 << lidIdx); paintedMask = 0 }
  onSeedChanged: { seenMask = 1 | (1 << lidIdx); paintedMask = 0 }
  onRlChanged: { seenMask = 1 | (1 << lidIdx); paintedMask = 0 }
  onRtierChanged: { seenMask = 1 | (1 << lidIdx); paintedMask = 0 }
  readonly property int bakedMask: ((lazy ? seenMask : 1) | bakeMask | 1) & ((1 << nFrames) - 1)
  function nearestBaked(i, mask) {
    var best = 0, bd = 99
    for (var j = 0; j < nFrames; j++) {
      if (!(mask & (1 << j))) continue
      var d = Math.abs(j - i)
      if (d < bd) { bd = d; best = j }
    }
    return best
  }
  // the frame on show: the one asked for, or the nearest one that is baked (a frame that is not baked yet is never waited for)
  readonly property int shownIdx: nearestBaked(lidIdx, bakedMask)

  // ---- palette: as ItoEyeGlyph's real style ------------------------------------------------------------------------------------------------------
  readonly property color rPaper0: !ink ? noColor : (frame ? ink.realPaperF : ink.realPaper(body))
  readonly property color rInk0: !ink ? noColor : (frame ? ink.realInkF : ink.realInk(rPaper0))
  readonly property bool rEdge: ink !== null && !frame && ink.realEdge(rPaper0, body)
  function rfade(c) { return !ink ? noColor : (frame || fade <= 0 ? c : ink.mix(c, body, fade)) }
  readonly property var realPal: {
    if (!ink) return null
    return {
      paper: rfade(rPaper0), ink: rfade(rInk0), skin: rfade(ink.realSkin(rPaper0, rInk0, frame ? ink.panel : body)), tint: rfade(ink.realTint(rPaper0, frame)), caruncle: rfade(ink.realCaruncle(rPaper0)),
      vein0: rfade(ink.realVein(rPaper0, rInk0, 0)), vein1: rfade(ink.realVein(rPaper0, rInk0, 1)), tear: rfade(ink.realTear(rPaper0, rInk0))
    }
  }
  // what the eye sits on: the panel on a frame, the liquid at the eye's depth on the liquid (the occluder band is this colour, not a mix)
  readonly property color ground: !ink ? noColor : (frame ? ink.panel : body)
  readonly property bool flapOn: flap && !frame && ink !== null
  readonly property color flapFill: !flapOn ? noColor : ink.mix(flapBody, ink.bone, Ichor.FLAP.mix)

  // ---- the plates -------------------------------------------------------------------------------------------------------------------------------
  readonly property var gazeBox: Mot.MOTION[archetype] ? Mot.MOTION[archetype].gaze : ({ x: 0, y: 0 })
  function paramsFor(idx) {
    var o = {}, kk
    if (rl) for (kk in rl) o[kk] = rl[kk]
    o.blink = lidValues[idx]
    return EyeR.realParams(archetype, seed, o)
  }
  function platesFor(idx) {
    if (!supported || !(bakedMask & (1 << idx))) return null
    return EyeR.realPlates(paramsFor(idx), sizePx, rtier, rEdge, { veins: veinPlate, gaze: gazeBox, flap: flapOn, flapOpen: flapOn && idx > 0 && plate0 ? plate0.clip : null,
                                                    irisAt: idx > 0 && plate0 ? { x: plate0.iris.x, y: plate0.iris.y, r: plate0.band.sweep.r } : null })
  }
  readonly property var plate0: supported ? platesFor(0) : null
  readonly property real pupil0: plate0 ? plate0.pupilBase : 0.4
  readonly property bool isSpiral: archetype === "spiral"

  property int paints: 0
  property int paintedMask: 0
  function markPainted(i) { paintedMask = paintedMask | (1 << i) }
  function clearPainted(i) { paintedMask = paintedMask & ~(1 << i) }

  function pathOf(poly, beads) {
    if (!poly || poly.length < 4) return ""
    var s = "M " + poly[0] + " " + poly[1], i, j
    for (i = 2; i < poly.length; i += 2) s += " L " + poly[i] + " " + poly[i + 1]
    s += " Z"
    if (beads) for (j = 0; j < beads.length; j++) {
      var b = beads[j]
      s += " M " + b[0] + " " + b[1]
      for (i = 2; i < b.length; i += 2) s += " L " + b[i] + " " + b[i + 1]
      s += " Z"
    }
    return s
  }
  // a point u (0..1) of the way along a polyline of [x, y] points
  function trailAt(trail, u) {
    if (!trail || trail.length < 2) return trail && trail.length ? trail[0] : [0, 0]
    var uu = Math.max(0, Math.min(1, Number(u) || 0)), tot = 0, i, segs = []
    for (i = 1; i < trail.length; i++) { var l = Math.hypot(trail[i][0] - trail[i - 1][0], trail[i][1] - trail[i - 1][1]); segs.push(l); tot += l }
    var want = uu * tot
    for (i = 0; i < segs.length; i++) {
      if (want <= segs[i] || i === segs.length - 1) {
        var f = segs[i] > 0 ? Math.min(1, want / segs[i]) : 0
        return [trail[i][0] + (trail[i + 1][0] - trail[i][0]) * f, trail[i][1] + (trail[i + 1][1] - trail[i][1]) * f]
      }
      want -= segs[i]
    }
    return trail[trail.length - 1]
  }
  function ellipsePath(rx, ry, cx, cy) {
    return "M " + (cx - rx) + " " + cy + " A " + rx + " " + ry + " 0 1 0 " + (cx + rx) + " " + cy + " A " + rx + " " + ry + " 0 1 0 " + (cx - rx) + " " + cy + " Z"
  }
  readonly property string omenPath: pathOf([1, 0, 0.8, 0.59, 0.31, 0.95, -0.31, 0.95, -0.8, 0.59, -1, 0, -0.8, -0.59, -0.31, -0.95, 0.31, -0.95, 0.8, -0.59], null)

  // the whole eye is mirrored by one transform, so the plates are drawn the one way round
  Item {
    id: stage
    width: root.width
    height: root.height
    clip: true                      // the eye's own box: what the band cannot cover beyond it (the iris at the edge of its gaze) is cut here, as the flat bake's canvas cuts it
    visible: root.supported
    transform: Scale { xScale: root.mirror ? -1 : 1; origin.x: stage.width / 2 }

    // back plates (and the vein plates), one set per lid frame
    Repeater {
      model: 6
      Item {
        id: bk
        required property int index
        readonly property var parts: index < root.nFrames ? root.platesFor(index) : null
        z: 1
        visible: index === root.shownIdx
        ItoEyePlate {
          strokes: bk.parts ? bk.parts.back : null
          clipPoly: bk.parts ? bk.parts.clip : null
          pal: root.realPal
          size: root.size
          onPainted: root.paints = root.paints + 1
        }
        ItoEyePlate {
          visible: root.veinPlate
          opacity: root.veinK
          strokes: bk.parts && root.veinPlate ? bk.parts.veins : null
          clipPoly: bk.parts ? bk.parts.clip : null
          pal: root.realPal
          size: root.size
          onPainted: root.paints = root.paints + 1
        }
      }
    }

    // the iris, its pupils: one baked plate that moves
    Item {
      id: irisGroup
      z: 2
      visible: root.plate0 !== null && root.showIris
      readonly property var ip: root.plate0 ? root.plate0.iris : null
      x: ip ? (ip.x + root.gazeX) * root.k : 0
      y: ip ? (ip.y + root.gazeY) * root.k : 0
      rotation: root.irisRot
      scale: root.isSpiral ? root.pupilK : 1
      transformOrigin: Item.TopLeft
      ItoEyePlate {
        x: irisGroup.ip ? -irisGroup.ip.cx * root.k : 0
        y: irisGroup.ip ? -irisGroup.ip.cy * root.k : 0
        uw: irisGroup.ip ? irisGroup.ip.size : 1
        uh: uw
        strokes: irisGroup.ip ? irisGroup.ip.strokes : null
        clipPoly: null
        pal: root.realPal
        size: root.size
        onPainted: root.paints = root.paints + 1
      }
      Repeater {
        model: 3
        Item {
          id: pu
          required property int index
          readonly property var d: root.plate0 && index < root.plate0.pupils.length ? root.plate0.pupils[index] : null
          visible: d !== null && root.shownIdx < root.shutIdx
          x: d ? d.cx * root.k : 0
          y: d ? d.cy * root.k : 0
          scale: d ? d.r * root.k * (root.isSpiral ? 1 : root.pupilK) : 0
          transformOrigin: Item.TopLeft
          Shape {
            preferredRendererType: Shape.CurveRenderer
            antialiasing: true
            ShapePath {
              strokeWidth: -1
              fillColor: root.realPal ? root.realPal.ink : root.noColor
              PathSvg { path: pu.d ? root.pathOf(pu.d.poly, pu.d.beads) : "" }
            }
          }
        }
      }
      // the omen: a second, small pupil off the axis (66 ms)
      Item {
        visible: root.omenPupil > 0 && irisGroup.ip !== null
        x: irisGroup.ip ? 0.32 * irisGroup.ip.R * root.k : 0
        y: irisGroup.ip ? -0.28 * irisGroup.ip.R * root.k : 0
        scale: irisGroup.ip ? 0.3 * irisGroup.ip.R * root.k : 0
        transformOrigin: Item.TopLeft
        Shape {
          preferredRendererType: Shape.CurveRenderer
          antialiasing: true
          ShapePath {
            strokeWidth: -1
            fillColor: root.realPal ? root.realPal.ink : root.noColor
            PathSvg { path: root.omenPath }
          }
        }
      }
    }

    // the catchlight: paper, at 0.3 of the gaze
    Item {
      id: specGroup
      z: 4
      visible: root.plate0 !== null && root.showIris && root.shownIdx < root.shutIdx
      x: root.plate0 ? (root.plate0.iris.x + 0.3 * root.gazeX) * root.k : 0
      y: root.plate0 ? (root.plate0.iris.y + 0.3 * root.gazeY) * root.k : 0
      Repeater {
        model: 3
        Item {
          id: sp
          required property int index
          readonly property var d: root.plate0 && index < root.plate0.spec.length ? root.plate0.spec[index] : null
          visible: d !== null
          scale: root.k
          transformOrigin: Item.TopLeft
          Shape {
            preferredRendererType: Shape.CurveRenderer
            antialiasing: true
            ShapePath {
              strokeWidth: -1
              fillColor: root.realPal ? Qt.alpha(root.realPal.paper, sp.d ? sp.d.a : 1) : root.noColor
              PathSvg { path: sp.d ? root.pathOf(sp.d.poly, null) : "" }
            }
          }
        }
      }
    }

    // the tear bead (P7): a tear-coloured ellipse and a paper glint, moved along the baked trail by `tearU` and scaled by `tearK`; two small paths built once
    Item {
      id: tearItem
      z: 6
      readonly property var td: root.plate0 ? root.plate0.tear : null
      readonly property var at: td ? root.trailAt(td.trail, root.tearU) : null
      visible: td !== null && root.tearK > 0.01 && root.shownIdx < root.shutIdx
      x: at ? at[0] * root.k : 0
      y: at ? at[1] * root.k : 0
      scale: root.k * root.tearK
      transformOrigin: Item.TopLeft
      Shape {
        preferredRendererType: Shape.CurveRenderer
        antialiasing: true
        ShapePath {
          strokeWidth: -1
          fillColor: root.realPal ? root.realPal.tear : root.noColor
          PathSvg { path: tearItem.td ? root.ellipsePath(tearItem.td.rx, tearItem.td.ry, 0, 0) : "" }
        }
        ShapePath {
          strokeWidth: -1
          fillColor: root.realPal ? Qt.alpha(root.realPal.paper, 0.95) : root.noColor
          PathSvg { path: tearItem.td ? root.ellipsePath(tearItem.td.gr, tearItem.td.gr, tearItem.td.gx, tearItem.td.gy) : "" }
        }
      }
    }

    // front plates: the band, then what goes over the iris, one per lid frame
    Repeater {
      model: 6
      Item {
        id: fr
        required property int index
        readonly property var parts: index < root.nFrames ? root.platesFor(index) : null
        z: 5
        visible: index === root.shownIdx
        ItoEyePlate {
          strokes: fr.parts ? fr.parts.front : null
          clipPoly: fr.parts ? fr.parts.clip : null
          band: fr.parts ? fr.parts.band : null
          ground: root.ground
          flapFill: root.flapFill
          flapInk: root.realPal ? root.realPal.skin : root.noColor
          pal: root.realPal
          size: root.size
          onStrokesChanged: root.clearPainted(fr.index)
          onPainted: { root.paints = root.paints + 1; if (fr.parts) root.markPainted(fr.index) }
        }
      }
    }
  }
}

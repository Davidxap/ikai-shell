import QtQuick
import "ItoChart.js" as Chart
import "ItoIchor.js" as Ichor
import "ItoEyeModel.js" as EyeM
import "ItoEyeReal.js" as EyeR

// The inks of the system-panel diagrams: every colour a seal, vessel, groove or drop is drawn with, derived in
// this one place from the panel palette. Nothing here is a colour of its own.
//
// Give it the panel's palette as `source` (an ItoPanelPalette over the widget's ItoConfig, or anything with
// `blood`, `bone`, `ink`, `lit` and `warn`). Whatever the shell is doing (following the theme, on its own palette, a
// custom accent) the diagrams read only these tokens, so no diagram has a branch for a mode.
//
//   fill      the liquid, rays, arcs, drops: `blood`, moved to reach 3:1 against the panel ink if it is too dark
//   hot       the same for `warn`: over-threshold fills, the crack, the warning glyph
//   deep      the bottom of the "used" gradient (fill, darker), at least 2.5:1
//   hotDeep   the same for `hot`, so a hot vessel keeps its gradient
//   sheen     `lit` at 0.7: the surface line and the highlight on a bead
//   rule / ruleSoft   `bone` at 0.6 / 0.24: the seals' rules
//   tick      `bone` at 0.3: ticks, idle runes, the thread band
//   track     `bone` at 0.12: empty grooves and ray tracks
//   notch     the panel ink at 0.55: ruler notches drawn over a groove
//   threshold `hot` at 0.35: a threshold ring, chord, spoke or notch
//   spiral / spiralGhost   `bone` at 0.85 / 0.28
//   label     `bone` at 0.6, raised in steps of 0.05 only where 4.5:1 would not be reached: captions and labels
//
// The materiality of the liquid (factors in ItoIchor.js INK, nothing written here):
//   glow / hotGlow    the light of the skin under the surface: `fill` (or `hot`) lighter and more saturated, stepped until
//                     it separates from it (1.2:1)
//   clot / hotClot    the dense, dark tone at the floor, on clotted rims and in platelets: darker, at least 2:1 on the panel
//   highlight         the specular: `lit` into the lighter of `bone` and the panel (a paper on a light theme), opaque
//   highlightA        its opacity: 0.6, raised until it reads 1.4:1 over `fill`, at most 0.85 (a WARN when it cannot)
//   stain             `fill` at the opacity that reads 1.8:1 on the panel: the wet film on the wall
//   skinLine          `clot` at 0.5: the 1 px interface between strata
//
// The eye of the ichor (factors in ItoEyeModel.js EYE_INK, nothing written here; ichor-eyes.md 1e). `lightenTo` and `darkenTo`
// are ensureContrast with the direction forced, so a pupil stays darker than its iris on any theme:
//   eyeSclera         the white of the eye: `highlight` into `fill`, lightened toward 2:1 on the liquid, never darkened (`eyePale` when it falls short)
//   eyeKeyline        `eyeLine` darkened to 3:1 (4.5:1 when pale) on the liquid: the contour that cuts the eye from it
//   eyeLidTone / eyeBagTone(body)   the tinted shadow of the lid (translucent) and of the bag under the eye
//   eyeShade          the sclera toward `clot`: the shadow under the lid and at the corners
//   eyeLine           the ink of lids, lashes, creases and hatch: `clot` darkened to 4.5:1 on the sclera
//   eyeIris / eyeIrisRim   the liquid toward `clot` (the iris, and its dark limbal edge)
//   eyePupil          `clot` darkened to 3:1 on the iris
//   eyeGleam          `highlight` lightened to 4.5:1 on the pupil: the wet point of light
//   eyeVein / eyeVeinHot   the bloodshot veins (`fill`, or `hot`) darkened to 1.8:1 on the sclera
//   eyeSkin(body)     the flesh around the eye: the stratum's body toward the sclera (`eyeSkin0` over the plain `fill`)
//
// The real eye (eyes-v2.md section 5; factors in ItoEyeReal.js REAL_INK). Paper and ink are picked by LUMINANCE, never by role name, so a
// light panel is never a negative (there `panel` is the paper and `bone` the ink):
//   realPaperF / realInkF        frame (the crest): the lighter of `bone` and the panel; the darker, darkened to 7:1 on that paper
//   realPaper(body)              liquid: the same paper, lightened to 2:1 against the stratum `body`
//   realInk(paper)               liquid: the darker of `bone` and the panel, mixed toward `clot`, darkened to 7:1 on `paper`
//   realTint(paper, frame)       the iris base: the paper mixed toward `lit` (frame) or `blood` (liquid)
//   realVein(paper, ink, b)      the ink toward `blood` by 0.3 + 0.5 b, darkened to 3:1 on the paper; realTear the ink toward `warn`
//   realSkin(paper, ink, ground) the marks on the skin: the ink where it reads 3:1 on the ground, else the paper toward the ground
//   realCaruncle(paper)          the paper toward `blood`
//   realEdge(paper, body)        the paper reaches less than 1.6:1 on the liquid: the eye turns its edge mode on
// The catchlight, the cornea and the meniscus are the paper itself (never `lit`, never a colour).
//
// The lightness step is Chart.ensureContrast (WCAG ratio; lighter on a dark panel, darker on a light one). On a
// light theme the same functions darken instead of lighten.
QtObject {
  id: root

  property var source: null

  readonly property color panel: source ? source.ink : Qt.rgba(0.1, 0.1, 0.1, 1)
  readonly property color bone: source ? source.bone : Qt.rgba(0.8, 0.8, 0.8, 1)
  readonly property color lit: source ? source.lit : Qt.rgba(0.6, 0.6, 0.6, 1)
  readonly property color blood: source ? source.blood : Qt.rgba(0.5, 0.5, 0.5, 1)
  readonly property color warn: source && source.warn !== undefined ? source.warn : blood

  // colours cross into the maths as plain numbers and come back through Qt.rgba
  function num(c) { return { r: c.r, g: c.g, b: c.b, a: c.a } }
  function col(n) { return Qt.rgba(n.r, n.g, n.b, n.a) }
  function alpha(c, a) { return Qt.rgba(c.r, c.g, c.b, a) }
  function reach(c, target) { return col(Chart.ensureContrast(num(c), num(panel), target)) }

  // `a` at fraction `t` of the way to `b`, and `c` at opacity `a` laid over the panel: an opaque colour, so stacked
  // translucent layers of a vessel do not blend twice.
  function mix(a, b, t) { return col(Chart.mix(num(a), num(b), t)) }
  function settle(c, a) { return col(Chart.over(Chart.withAlpha(num(c), a), num(panel))) }

  readonly property color fill: reach(blood, 3.0)
  readonly property color hot: reach(warn, 3.0)
  readonly property color deep: reach(Qt.darker(fill, 1.35), 2.5)
  readonly property color hotDeep: reach(Qt.darker(hot, 1.35), 2.5)
  readonly property color sheen: alpha(lit, 0.7)
  readonly property color rule: alpha(bone, 0.6)
  readonly property color ruleSoft: alpha(bone, 0.24)
  readonly property color tick: alpha(bone, 0.3)
  readonly property color track: alpha(bone, 0.12)
  readonly property color notch: alpha(panel, 0.55)
  readonly property color threshold: alpha(hot, 0.35)
  readonly property color spiral: alpha(bone, 0.85)
  readonly property color spiralGhost: alpha(bone, 0.28)
  readonly property color label: alpha(bone, Chart.ensureAlphaContrast(num(bone), num(panel), 0.6, 4.5))

  function glowOf(c) {
    var g = Ichor.INK.glow
    return col(Chart.ensureSeparation(Chart.shade(num(c), g.dl, g.sMul), num(c), g.target, g.step, g.maxSteps))
  }
  function clotOf(c) { return reach(col(Chart.shade(num(c), Ichor.INK.clot.dl, Ichor.INK.clot.sMul)), Ichor.INK.clot.target) }

  // the rust of `c` (the memory liquid's `rust` fill; a colour, never a hex): the hue taken to 20 degrees, saturation at least 0.5, lightness held in
  // 0.30-0.42 (0.36-0.46 on a light panel), then 12 % bone for the dusty top. The alertRed rule one step further: any accent rusts red-brown.
  function rustOf(c) {
    var light = panel.hslLightness > 0.5
    var l = Math.min(light ? 0.46 : 0.42, Math.max(light ? 0.36 : 0.30, c.hslLightness)), s = Math.max(c.hslSaturation, 0.5)
    return mix(Qt.hsla(20 / 360, s, l, 1), bone, 0.12)
  }

  readonly property color glow: glowOf(fill)
  readonly property color clot: clotOf(fill)
  readonly property color hotGlow: glowOf(hot)
  readonly property color hotClot: clotOf(hot)
  readonly property color highlight: mix(col(Chart.brightest(num(bone), num(panel))), lit, Ichor.INK.highlight.litMix)
  readonly property real highlightA: Math.min(Ichor.INK.highlight.maxAlpha,
    Chart.ensureAlphaContrast(num(highlight), num(fill), Ichor.INK.highlight.alpha, Ichor.INK.highlight.target))
  readonly property color stain: alpha(fill, Chart.ensureAlphaContrast(num(fill), num(panel), Ichor.INK.stain.alpha, Ichor.INK.stain.target))
  readonly property color skinLine: alpha(clot, Ichor.INK.skinLine.alpha)

  // the sclera is lightened toward 2:1 on the liquid and NEVER darkened: where the palette cannot reach 2:1 (a light liquid)
  // it stays as pale as it can be (`eyePale`) and the eye separates by ink weight, the keyline and the tinted tones instead
  readonly property color eyeScleraBase: mix(highlight, fill, EyeM.EYE_INK.sclera.mix)
  readonly property color eyeSclera: col(Chart.lightenTo(num(eyeScleraBase), num(fill), EyeM.EYE_INK.sclera.target))
  readonly property bool eyePale: Chart.contrast(num(eyeSclera), num(fill)) < EyeM.EYE_INK.pale.below
  readonly property color eyeShade: mix(eyeSclera, clot, EyeM.EYE_INK.shade.mix)
  // the ink is dark enough for the sclera AND for the flesh around it (heavier requirement when pale)
  readonly property color eyeLine: col(Chart.darkenTo(Chart.darkenTo(num(clot), num(eyeSclera), eyePale ? EyeM.EYE_INK.line.paleTarget : EyeM.EYE_INK.line.target),
    num(eyeSkin0), eyePale ? EyeM.EYE_INK.line.paleVsSkin : EyeM.EYE_INK.line.vsSkin))
  // the keyline: the ink that cuts the flesh ring from the liquid
  readonly property color eyeKeyline: col(Chart.darkenTo(num(eyeLine), num(fill), eyePale ? EyeM.EYE_INK.keyline.paleTarget : EyeM.EYE_INK.keyline.target))
  // the translucent tinted shade of the lid on the sclera, and the opaque tone of the bag under the eye
  readonly property color eyeLidTone: col(Chart.darkenTo(num(mix(eyeShade, clot, EyeM.EYE_INK.lidTone.mix)), num(eyeSclera), EyeM.EYE_INK.lidTone.target))
  function eyeBagTone(body) {
    var sk = eyeSkin(body)
    return col(Chart.darkenTo(num(mix(sk, clot, EyeM.EYE_INK.bagTone.mix)), num(sk), EyeM.EYE_INK.bagTone.vsSkin))
  }
  // the pupil is as dark as the clot allows against the plain iris; the iris is then lifted until the pupil reads on it
  readonly property color eyeIris0: mix(fill, clot, EyeM.EYE_INK.iris.mix)
  readonly property color eyePupil: col(Chart.darkenTo(num(clot), num(eyeIris0), EyeM.EYE_INK.pupil.target))
  readonly property color eyeIris: col(Chart.lightenTo(num(eyeIris0), num(eyePupil), EyeM.EYE_INK.pupil.target))
  readonly property color eyeIrisRim: mix(fill, clot, EyeM.EYE_INK.irisRim.mix)
  readonly property color eyeGleam: col(Chart.lightenTo(num(highlight), num(eyePupil), EyeM.EYE_INK.gleam.target))
  readonly property color eyeVein: col(Chart.darkenTo(num(mix(fill, clot, EyeM.EYE_INK.vein.mix)), num(eyeSclera), EyeM.EYE_INK.vein.target))
  readonly property color eyeVeinHot: col(Chart.darkenTo(num(hot), num(eyeSclera), EyeM.EYE_INK.vein.target))
  function eyeSkin(body) { return mix(body, eyeSclera, EyeM.EYE_INK.skin.mix) }
  readonly property color eyeSkin0: eyeSkin(fill)

  // ---- the real eye -------------------------------------------------------------------------------------------------------------------
  readonly property color realLight: Chart.luminance(num(bone)) >= Chart.luminance(num(panel)) ? bone : panel
  readonly property color realDark: Chart.luminance(num(bone)) >= Chart.luminance(num(panel)) ? panel : bone
  readonly property color realPaperF: realLight
  readonly property color realInkF: col(Chart.darkenTo(num(realDark), num(realPaperF), EyeR.REAL_INK.ink.target))
  function realPaper(body) { return col(Chart.lightenTo(num(realLight), num(body), EyeR.REAL_INK.paper.target)) }
  function realInk(paper) {
    return col(Chart.darkenTo(num(mix(realDark, clot, EyeR.REAL_INK.ink.clotMix)), num(paper), EyeR.REAL_INK.ink.target))
  }
  function realTint(paper, frame) { return mix(paper, frame ? lit : blood, frame ? EyeR.REAL_INK.tint.frame : EyeR.REAL_INK.tint.liquid) }
  function realVein(paper, ink, b) {
    var v = EyeR.REAL_INK.vein
    return col(Chart.darkenTo(num(mix(ink, blood, v.mix + v.per * Math.max(0, Math.min(1, b)))), num(paper), v.target))
  }
  function realTear(paper, ink) { return col(Chart.darkenTo(num(mix(ink, warn, EyeR.REAL_INK.tear.mix)), num(paper), EyeR.REAL_INK.tear.target)) }
  // the ink of the marks on the skin: the ink where it reads 3:1 on `ground` (the panel, or the liquid at the eye's depth), else the paper
  // mixed toward the ground (hatch drawn in light lines on a dark ground)
  function realSkin(paper, ink, ground) {
    return Chart.contrast(num(ink), num(ground)) >= EyeR.REAL_INK.skin.need ? ink : mix(paper, ground, EyeR.REAL_INK.skin.mix)
  }
  function realCaruncle(paper) { return mix(paper, blood, EyeR.REAL_INK.caruncle) }
  function realEdge(paper, body) { return Chart.contrast(num(paper), num(body)) < EyeR.REAL_INK.edgeBelow }
  readonly property color realPaper0: realPaper(fill)
  readonly property color realInk0: realInk(realPaper0)

  // The contrast checks of the design (section 4 of chart-language.md and 1b of ichor-materiality.md), with alpha
  // composited over `bg` (the panel unless a row says otherwise):
  // -> [{ token, ratio, need, ok, warn }]. `bone` must reach 4.5 and aims for 7; `label` 4.5; `fill`/`hot` 3. A row with
  // `warn` is reported as a WARN when it fails, every other as a FAIL: fix a FAIL by editing Ichor.INK, never by a
  // per-theme branch. Rows named `x vs fill` are measured over the liquid.
  function report() {
    var c = Ichor.INK
    var rows = [
      { token: "fill", c: fill, need: 3.0 }, { token: "hot", c: hot, need: 3.0 }, { token: "deep", c: deep, need: 2.5 },
      { token: "bone", c: bone, need: 4.5 }, { token: "label", c: label, need: 4.5 },
      { token: "glow vs fill", c: glow, need: c.glow.target, bg: fill },
      { token: "clot", c: clot, need: c.clot.target },
      { token: "clot vs fill", c: clot, need: c.clot.vsFill, bg: fill },
      { token: "hotGlow vs hot", c: hotGlow, need: c.glow.target, bg: hot },
      { token: "hotClot", c: hotClot, need: c.clot.target },
      { token: "hotClot vs hot", c: hotClot, need: c.clot.vsFill, bg: hot },
      { token: "highlight vs fill", c: alpha(highlight, highlightA), need: c.highlight.target, bg: fill, warn: true },
      { token: "stain", c: stain, need: c.stain.target },
      { token: "eyeSclera vs fill (lighter or 2:1)", c: eyeSclera, need: EyeM.EYE_INK.sclera.target, bg: fill,
        alt: Chart.luminance(num(eyeSclera)) > Chart.luminance(num(fill)) },
      { token: "eyeLine vs sclera", c: eyeLine, need: eyePale ? EyeM.EYE_INK.line.paleTarget : EyeM.EYE_INK.line.target, bg: eyeSclera },
      { token: "eyeLine vs skin0", c: eyeLine, need: eyePale ? EyeM.EYE_INK.line.paleVsSkin : EyeM.EYE_INK.line.vsSkin, bg: eyeSkin0 },
      { token: "eyeKeyline vs fill", c: eyeKeyline, need: eyePale ? EyeM.EYE_INK.keyline.paleTarget : EyeM.EYE_INK.keyline.target, bg: fill },
      { token: "eyeLidTone on sclera", c: alpha(eyeLidTone, EyeM.EYE_INK.lidTone.alpha), need: EyeM.EYE_INK.lidTone.composite, bg: eyeSclera },
      { token: "eyeBagTone vs skin0", c: eyeBagTone(fill), need: EyeM.EYE_INK.bagTone.vsSkin, bg: eyeSkin0 },
      { token: "eyePupil vs iris", c: eyePupil, need: EyeM.EYE_INK.pupil.target, bg: eyeIris },
      { token: "eyeGleam vs pupil", c: eyeGleam, need: EyeM.EYE_INK.gleam.target, bg: eyePupil },
      { token: "eyeVein vs sclera", c: eyeVein, need: EyeM.EYE_INK.vein.target, bg: eyeSclera },
      { token: "realPaper vs body (2:1, or edge mode)", c: realPaper0, need: EyeR.REAL_INK.paper.target, bg: fill, alt: realEdge(realPaper0, fill) },
      { token: "realInk vs realPaper (7:1)", c: realInk0, need: EyeR.REAL_INK.ink.target, bg: realPaper0 },
      { token: "realVein vs realPaper (3:1)", c: realVein(realPaper0, realInk0, 0.5), need: EyeR.REAL_INK.vein.target, bg: realPaper0 },
      { token: "realTear vs realPaper (3:1)", c: realTear(realPaper0, realInk0), need: EyeR.REAL_INK.tear.target, bg: realPaper0 },
      { token: "realTint vs pupil (3:1)", c: realTint(realPaper0, false), need: EyeR.REAL_INK.pupil.target, bg: realInk0 },
      { token: "realSkin vs panel (3:1)", c: realSkin(realPaperF, realInkF, panel), need: EyeR.REAL_INK.skin.need, bg: panel },
      { token: "realInkF vs realPaperF (7:1)", c: realInkF, need: EyeR.REAL_INK.ink.target, bg: realPaperF },
      { token: "realTintF vs realInkF (3:1)", c: realTint(realPaperF, true), need: EyeR.REAL_INK.pupil.target, bg: realInkF }
    ]
    var out = []
    for (var i = 0; i < rows.length; i++) {
      var bg = rows[i].bg === undefined ? panel : rows[i].bg
      var ratio = Chart.contrast(num(rows[i].c), num(bg))
      out.push({ token: rows[i].token, ratio: ratio, need: rows[i].need, ok: ratio >= rows[i].need || !!rows[i].alt, warn: !!rows[i].warn })
    }
    return out
  }
}

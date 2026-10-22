pragma ComponentBehavior: Bound
import QtQuick
import "ItoIconInk.js" as Ink
import "ItoIconSet.js" as Real

// The bake of one manga icon (icons-v2.md section 4.1): ItoIconInk.iconParts painted into three Canvases, once, and again only
// when that layer's own strokes change. `under` (casing, hatch, cast shadows) and `over` (contour, rim) are the plate;
// `level` (the ink standing in a hole, a groove, a cell; its stain and bead) is a separate small layer, so a value that
// moves inside a state repaints the level only, and only when it crosses a 1/48 step. The one highlight is its own
// overlay (ItoIconHighlight), so hover can move it without a re-bake. No clock, no animation, no Behavior.
// Motion (icons-v3.md section 5): the parts come in runs (consecutive parts of one layer and one moving `group`, ItoIconReal's
// rig), each its own Canvas; `pose` (ItoIconMotion.phase, given by the host ItoIconLive) moves a group's Canvas by a transform,
// so a moving part never repaints anything. With no pose every run sits still, exactly the plate.
// Colours come in `roles` (ItoIconInk.roles: line, mass, void, paper, blood, warn, all from the shell's tokens); this file
// writes none, and with no roles it draws nothing.
//   kind, iconState   what to draw ({ value } for the level icons, { level }, { band }, { face }, ...)
//   size          the icon's box in px
//   engine        "real" (icons-v3: the current object drawn as a realistic engraving, baked at 2x and downsampled, every size)
//                 or "ink" (the v2 pilot; below 21 px use ItoIconSigil instead)
Item {
  id: root

  property string kind: ""
  property var iconState: ({})
  property real size: 29
  property int seed: 1
  property var roles: null
  property bool highlight: true
  property real highlightDx: 0
  property string engine: "real"
  property var pose: null           // ItoIconMotion.phase(...): groups moved, layers faded (the draw-on); null = at rest
  readonly property int superSample: engine === "real" ? Real.SUPER : 1

  width: size
  height: size
  readonly property real dpr: Math.max(1, Screen.devicePixelRatio)

  // the level only moves in 1/48 steps: a state copy with the value rounded, so a tiny change does not re-bake
  readonly property var stepped: {
    var s = JSON.parse(JSON.stringify(root.iconState || {}))      // a plain copy (a QML map does not enumerate its keys)
    if (s.value !== undefined) s.value = Math.round(Number(s.value) * 48) / 48
    return s
  }
  // a string, so a value that moves inside one 1/48 step changes nothing and builds nothing
  readonly property string stepKey: JSON.stringify(stepped)
  readonly property var parts: kind === "" || !roles ? null
    : (engine === "real" ? Real.iconParts(kind, JSON.parse(stepKey), size, seed, { light: theme ? !!theme.lineLight : !!roles.lineLight, tone: theme ? "theme" : "ink" })
                         : Ink.iconParts(kind, JSON.parse(stepKey), size, seed, { pale: !!roles.pale }))

  // consecutive parts of one layer and one group; the run structure only changes with the state, so the delegates stay
  readonly property var runs: {
    var out = []
    if (!parts) return out
    var list = parts.parts                 // already in paint order (layer, then the order drawn)
    for (var i = 0; i < list.length; i++) {
      var p = list[i], g = p.group || "", last = out.length ? out[out.length - 1] : null
      if (last && last.layer === p.layer && last.group === g) last.parts.push(p)
      else out.push({ layer: p.layer, group: g, hidden: !!p.hidden, parts: [p] })
    }
    // the voids of the later runs of the same group cut this run (theme tone); a moving group cuts only itself
    for (var a = 0; a < out.length; a++) {
      var cuts = []
      for (var b = a + 1; b < out.length; b++) if (out[b].group === out[a].group) for (var c = 0; c < out[b].parts.length; c++) if (out[b].parts[c].role === "void" && !out[b].hidden) cuts.push(out[b].parts[c])
      out[a].cuts = cuts
    }
    return out
  }
  readonly property real unit: size / 48
  function groupPose(g) { return g !== "" && pose && pose.groups ? (pose.groups[g] || null) : null }
  function layerAlpha(l) { return pose && pose.layers && pose.layers[l] !== undefined ? Math.max(0, Math.min(1, pose.layers[l])) : 1 }

  function trace(ctx, p) {
    ctx.moveTo(p[0], p[1])
    for (var i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1])
    ctx.closePath()
  }
  // iconTone theme (icons-v6-tone.md): every role is a theme colour with an alpha, and `void` is a CUT-OUT (destination-out) that
  // removes what lies under it in the same motion group, the same occlusion as before minus the paint. `ink` is today's opaque look.
  readonly property var theme: roles && roles.tone === "theme" && roles.theme ? roles.theme : null
  function toneOf(part) {            // { cut, style } for a part under the theme tone; null = not drawn
    var t = root.theme
    if (part.role === "void") return { cut: true, style: Ink.cssa({ r: 0, g: 0, b: 0 }, 1) }
    if (part.role === "line" || part.role === "mass") return { cut: false, style: Ink.cssa(t.line.c, t.line.a) }
    if (part.role === "blood") return { cut: false, style: Ink.cssa(t.blood.c, t.blood.a) }
    if (part.role === "warn") return { cut: false, style: Ink.cssa(t.warn.c, t.warn.a) }
    if (part.role === "paper") return t.paper.cut ? null : { cut: false, style: Ink.cssa(t.paper.c, t.paper.a) }
    return null
  }
  function paintOne(ctx, part, cut, style) {
    if (part.clip) { ctx.save(); ctx.beginPath(); trace(ctx, part.clip); ctx.clip() }
    ctx.globalCompositeOperation = cut ? "destination-out" : "source-over"
    ctx.fillStyle = style
    ctx.beginPath()
    for (var j = 0; j < part.polys.length; j++) trace(ctx, part.polys[j])
    ctx.fill()
    if (part.clip) ctx.restore()
  }
  function paintParts(cv, list, cuts) {
    var ctx = cv.getContext("2d")
    ctx.reset()
    if (!root.roles || !list) return
    var k = cv.width / 48
    ctx.scale(k, k)
    var th = root.theme
    for (var i = 0; i < list.length; i++) {
      var part = list[i]
      if (th) {
        var tn = toneOf(part)
        if (tn) paintOne(ctx, part, tn.cut, tn.style)
        continue
      }
      var col = root.roles[part.role]
      if (!col) continue
      paintOne(ctx, part, false, Ink.css(col))
    }
    // the cut-outs of the runs drawn after this one in the same group (glass, a lens, a window over the engraving under it)
    if (th && cuts) for (var c = 0; c < cuts.length; c++) paintOne(ctx, cuts[c], true, Ink.cssa({ r: 0, g: 0, b: 0 }, 1))
  }
  // the body wash (the silhouette painted first, a faint flat tone: the old PNG's body), cut by the static cut-outs that are not face bases
  function paintWash(cv) {
    var ctx = cv.getContext("2d")
    ctx.reset()
    var th = root.theme
    if (!th || !root.parts || th.wash.a <= 0) return
    var k = cv.width / 48
    ctx.scale(k, k)
    var sil = root.parts.silhouette || []
    ctx.fillStyle = Ink.cssa(th.wash.c, th.wash.a)
    ctx.beginPath()
    for (var i = 0; i < sil.length; i++) trace(ctx, sil[i])
    ctx.fill()
    var list = root.parts.parts
    for (var q = 0; q < list.length; q++) {
      var p = list[q]
      if (p.role === "void" && !p.base && !p.group && !p.hidden) paintOne(ctx, p, true, Ink.cssa({ r: 0, g: 0, b: 0 }, 1))
    }
  }

  component Layer: Canvas {
    id: cv
    property var list: []
    property var cuts: []
    property string sig: ""
    // drawn at superSample x the device pixels and shown scaled down (smooth), so lines finer than a pixel become tone
    width: Math.ceil(root.width * root.dpr * root.superSample)
    height: Math.ceil(root.height * root.dpr * root.superSample)
    scale: 1 / (root.dpr * root.superSample)
    smooth: true
    transformOrigin: Item.TopLeft
    renderTarget: Canvas.Image
    renderStrategy: Canvas.Immediate
    // repaint only when this layer's own strokes (or the colours) changed
    onListChanged: cv.rebuild()
    onCutsChanged: cv.rebuild()
    function rebuild() { var s = JSON.stringify(list) + "|" + JSON.stringify(cuts); if (s !== sig) { sig = s; requestPaint() } }
    onWidthChanged: requestPaint()
    Connections { target: root; function onRolesChanged() { cv.requestPaint() } }
    onPaint: root.paintParts(cv, list, cuts)
  }

  // the body wash: below every run, shown only with the theme tone
  Canvas {
    id: washCv
    visible: root.theme !== null && root.theme.wash.a > 0
    width: Math.ceil(root.width * root.dpr * root.superSample)
    height: Math.ceil(root.height * root.dpr * root.superSample)
    scale: 1 / (root.dpr * root.superSample)
    smooth: true
    transformOrigin: Item.TopLeft
    renderTarget: Canvas.Image
    renderStrategy: Canvas.Immediate
    onWidthChanged: requestPaint()
    Connections {
      target: root
      function onRolesChanged() { washCv.requestPaint() }
      function onPartsChanged() { washCv.requestPaint() }
    }
    onPaint: root.paintWash(washCv)
  }

  Repeater {
    model: root.runs.length
    Item {
      id: run
      required property int index
      readonly property var r: root.runs[index] || null
      readonly property var gp: r ? root.groupPose(r.group) : null
      width: root.width
      height: root.height
      opacity: (r ? root.layerAlpha(r.layer) : 1) * (gp ? gp.op : (r && r.hidden ? 0 : 1))
      visible: opacity > 0.002
      transform: [
        Scale { origin.x: run.gp ? run.gp.ox * root.unit : 0; origin.y: run.gp ? run.gp.oy * root.unit : 0
                xScale: run.gp ? run.gp.sx : 1; yScale: run.gp ? run.gp.sy : 1 },
        Rotation { origin.x: run.gp ? run.gp.ox * root.unit : 0; origin.y: run.gp ? run.gp.oy * root.unit : 0; angle: run.gp ? run.gp.rot : 0 },
        Translate { x: run.gp ? run.gp.dx * root.unit : 0; y: run.gp ? run.gp.dy * root.unit : 0 }
      ]
      Layer {
        list: run.r ? run.r.parts : []
        cuts: run.r ? run.r.cuts : []
      }
    }
  }

  ItoIconHighlight {
    visible: root.highlight
    opacity: root.layerAlpha("hl")
    parts: root.parts
    roles: root.roles
    size: root.size
    dx: root.highlightDx + (root.pose ? root.pose.glintDx * root.unit : 0)
  }
}

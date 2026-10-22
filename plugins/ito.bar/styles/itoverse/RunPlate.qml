import QtQuick
import "../../../../bar/modules" as Ito
import "../../../../bar/modules/ItoSurfaces.js" as Surfaces

// One plate for one run of the bar.
//
// The fork already knows how to cut the bar into runs (Shibumi's split islands) and paints each one
// through RunChrome. That paints a flat rectangle; a style can hand it a plate instead through the
// `runPlate` token, so every island — joined or split — carries the same surface.
//
// What the plate is made of is all sidecar: one `fx*` flag per layer, folded by Surfaces.resolve.
Ito.ItoPlate {
  palette: cfg
  id: root

  Ito.ItoConfig {
    id: cfg
    path: Qt.resolvedUrl("../../../../bar/modules/ito-style.json").toString().replace("file://", "")
  }

  // Tell the surface the layout is still moving (see BarSurface.itoSettleTouch).
  function touchSurface() {
    var p = parent
    while (p && typeof p.itoSettleTouch !== "function") p = p.parent
    if (p) p.itoSettleTouch()
  }
  onWidthChanged: touchSurface()
  onHeightChanged: touchSurface()
  readonly property var look: Surfaces.resolve(cfg)

  // Form parity (sidecar `formParity`): which edge the plate is flush with. RunChrome (the engine) squares the TOP of Fit/Dock
  // plates and tells Islands only about the top, so a bottom bar kept its top corners square and its bottom ones round, the wrong
  // way round. RunPlate finds its RunChrome by what it exposes (`atTop`, `flushToEdge`, `shellStyle`), whether it sits in an island
  // delegate or in the direct-child Loaders of Fit/Dock/Notch, and squares the edge that touches the screen.
  readonly property bool parity: Surfaces.on(cfg, "formParity")
  readonly property var chrome: {
    var p = parent
    while (p && !(p.atTop !== undefined && p.flushToEdge !== undefined && p.shellStyle !== undefined)) p = p.parent
    return p
  }
  edgeManaged: parity && chrome !== null && chrome !== undefined
  bottomEdge: edgeManaged && chrome.atTop === false
  flatEdge: edgeManaged && (chrome.shellStyle === "fit"
    || ((chrome.shellStyle === "shibumi" || chrome.shellStyle === "dock") && chrome.flushToEdge === true))

  // The run's own corner: a floating island is a pill, a screen-edge form keeps the fork's radius.
  property int cornerRadius: Math.floor(height / 2)
  radius: cornerRadius
  artBase: Qt.resolvedUrl("../../../../bar/modules/ito-art/")
  plate: look.plate
  veins: look.veins
  wood: look.wood
  calm: look.calm
  grain: look.grain
  tone: look.tone
  lift: look.lift
  border: look.border
  torn: look.torn
  fog: look.fog
  fogDrift: look.fogDrift
  world: look.world
  rot: look.rot
}

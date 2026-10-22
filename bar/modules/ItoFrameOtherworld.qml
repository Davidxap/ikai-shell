import QtQuick 6.11
import QtQuick.Shapes
import "ItoWire.js" as Wire

// The `otherworld` frame style (ito-panel-presence/frame-styles.md section 6): rust, wire, grating and fog. A 2 px `rust` outer rule with rivets
// (r 1.5 k, `ironHi` at 0.8) every 56 k, an inner rule inset 4, two corner blooms of `rustBloom`, barbed wire along the top (two runs, the
// emblem's gap between them), a grating along the bottom (roomy cards only) and a fog bank that drifts only while `live`. Radius 1. In an alert
// the rivets and the grating's bar turn `hot`, the blooms `alertSoft`, the mesh `hot` at 0.22. Colours are `ItoFrameInk` tokens only.
// Reveal staging: rule and rivets 0 to 0.5, wire and grating 0.25 to 0.75, blooms and fog 0.5 to 1. The only clock is the fog's, in ItoFogBank.
Item {
  id: root

  property var cfg: null
  property var ink: null
  property real reveal: 1
  property bool alert: false
  property bool live: false
  property real amp: 1
  property real k: 1
  property string barSide: "top"
  property size finalSize: Qt.size(width, height)
  property string art: "png"
  property url artBase
  property bool roomy: height >= 260
  property bool sheet: false
  property real anchorAlong: -1
  property real emblemOpacity: 0.85

  function fin(v, d) { v = Number(v); return isFinite(v) ? v : d }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }
  function stage(a, b) { return clamp((fin(reveal, 1) - a) / (b - a), 0, 1) }
  function ease(t) { return t * t * (3 - 2 * t) }

  readonly property real u: clamp(fin(k, 1), 0.8, 1.15)
  readonly property real cw: Math.max(0, width)
  readonly property real ch: Math.max(0, height)
  readonly property bool ready: !!ink && cw > 40 && ch > 40
  readonly property color cRivet: ink ? (alert ? ink.hot : ink.ironHi) : "transparent"
  readonly property color cBloom: ink ? (alert ? ink.alertSoft : ink.rustBloom) : "transparent"
  readonly property color cBloomNone: ink ? ink.alpha(cBloom, 0) : "transparent"
  readonly property real bloomR: 0.6 * Math.min(cw, ch)
  readonly property real corner: stage(0, 0.5)         // rule and rivets
  readonly property real edge: stage(0.25, 0.75)       // wire and grating
  readonly property real air: stage(0.5, 1)            // blooms and fog

  // everything is kept inside the card except the rule's rivets, which sit on it
  Item {
    anchors.fill: parent
    clip: true
    visible: root.ready

    // ---- rust blooms, top-left and bottom-right
    Repeater {
      model: 2
      delegate: Shape {
        id: bloom
        required property int index
        readonly property real r: root.bloomR
        x: index === 0 ? -r : root.cw - r
        y: index === 0 ? -r : root.ch - r
        width: 2 * r; height: 2 * r
        opacity: root.ease(root.air)
        preferredRendererType: Shape.GeometryRenderer
        ShapePath {
          strokeColor: "transparent"
          fillGradient: RadialGradient {
            centerX: bloom.r; centerY: bloom.r; centerRadius: bloom.r; focalX: bloom.r; focalY: bloom.r
            GradientStop { position: 0; color: root.cBloom }
            GradientStop { position: 1; color: root.cBloomNone }
          }
          startX: 0; startY: 0
          PathLine { x: bloom.width; y: 0 }
          PathLine { x: bloom.width; y: bloom.height }
          PathLine { x: 0; y: bloom.height }
          PathLine { x: 0; y: 0 }
        }
      }
    }

    // ---- fog, along the bottom (drift only while live)
    ItoFogBank {
      anchors.fill: parent
      ink: root.ink; live: root.live; amp: root.amp
      open: root.ease(root.air)
    }

    // ---- grating, along the bottom, roomy cards only: 16 k high, 4 px above the edge; two runs, 8 to 0.4 W and 0.6 W to W - 8
    ItoGrating {
      visible: root.roomy
      x: 8; y: root.ch - 4 - 16 * root.u; width: Math.max(0, 0.4 * root.cw - 8); height: 16 * root.u
      ink: root.ink; k: root.u; alert: root.alert
      opacity: root.ease(root.edge)
    }
    ItoGrating {
      visible: root.roomy
      x: 0.6 * root.cw; y: root.ch - 4 - 16 * root.u; width: Math.max(0, 0.4 * root.cw - 8); height: 16 * root.u
      ink: root.ink; k: root.u; alert: root.alert
      opacity: root.ease(root.edge)
    }

    // ---- barbed wire along the top at y = 9 k: from 10 to W/2 - 60 k and from W/2 + 60 k to W - 10 (the emblem sits between)
    ItoBarbedWire {
      ink: root.ink; k: root.u; alert: root.alert
      x0: 10; x1: root.cw / 2 - 60 * root.u; wireY: 9 * root.u
      anchorX: root.anchorAlong; open: root.ease(root.edge)
    }
    ItoBarbedWire {
      ink: root.ink; k: root.u; alert: root.alert
      x0: root.cw / 2 + 60 * root.u; x1: root.cw - 10; wireY: 9 * root.u
      anchorX: root.anchorAlong; open: root.ease(root.edge)
    }

    // ---- the inner rule: inset 4, 1 px, ruleSoft
    Rectangle {
      x: 4; y: 4; width: Math.max(0, root.cw - 8); height: Math.max(0, root.ch - 8)
      radius: 1; color: "transparent"
      border.width: 1; border.color: root.ink ? root.ink.ruleSoft : "transparent"
    }
  }

  // ---- the outer rule: 2 px rust (the presence sheet draws its own 1 px rule while it exists)
  Rectangle {
    anchors.fill: parent
    radius: 1
    visible: !root.sheet && root.ready
    color: "transparent"
    border.width: 2
    border.color: !root.ink ? "transparent" : root.ink.rust
    opacity: root.ease(root.corner)
  }

  // ---- rivets on the rule, every 56 k; none in the emblem's gap at the top centre (120 k) nor the memo's at the bottom centre (220 k)
  readonly property var topX: Wire.rivets(14 * u, cw - 14 * u, u, cw / 2, 120 * u)
  readonly property var botX: Wire.rivets(14 * u, cw - 14 * u, u, cw / 2, 220 * u)
  readonly property var sideY: Wire.rivets(14 * u, ch - 14 * u, u, -1e9, 0)
  component Rivet: Rectangle {
    width: 3 * root.u; height: width; radius: width / 2
    color: root.cRivet; opacity: 0.8 * root.ease(root.corner)
    visible: root.ready
  }
  Repeater { model: root.topX; Rivet { required property var modelData; x: modelData - width / 2; y: 1 - height / 2 } }
  Repeater { model: root.botX; Rivet { required property var modelData; x: modelData - width / 2; y: root.ch - 1 - height / 2 } }
  Repeater { model: root.sideY; Rivet { required property var modelData; x: 1 - width / 2; y: modelData - height / 2 } }
  Repeater { model: root.sideY; Rivet { required property var modelData; x: root.cw - 1 - width / 2; y: modelData - height / 2 } }
}

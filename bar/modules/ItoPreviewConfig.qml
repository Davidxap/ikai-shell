import QtQuick 6.11

// A stand-in for the shell's ItoConfig, for the previews on the Styles page: it answers `get(key, fallback)` from its `overrides` map first and from the real
// config after, and it proxies the colour and scale properties the preview consumers read (ItoPanelPalette, ItoFramePreview, ItoPlate, ItoSurfaces).
// Motion is always off (motionAmp 0, eyeLevel 0): a preview is a still. NOTHING here writes: no preview ever touches the sidecar.
QtObject {
  id: root

  property var source: null            // the shell's ItoConfig
  property var overrides: ({})         // { key: value } wins over the source

  function get(key, fallback) {
    if (overrides && overrides[key] !== undefined) return overrides[key]
    return source ? source.get(key, fallback) : fallback
  }

  readonly property color blood: source ? source.blood : "transparent"
  readonly property color bone: source ? source.bone : "transparent"
  readonly property color ink: source ? source.ink : "transparent"
  readonly property color lit: source ? source.lit : "transparent"
  readonly property color warn: source ? source.warn : "transparent"
  readonly property real light: source ? source.light : 1
  readonly property real vibrance: source && source.vibrance !== undefined ? source.vibrance : 1
  readonly property bool tinted: source ? source.tinted : false
  readonly property real motionAmp: 0
  readonly property int eyeLevel: 0
  readonly property string eyeStyle: overrides && overrides.eyeStyle !== undefined ? String(overrides.eyeStyle) : (source ? source.eyeStyle : "shaded")
  readonly property string eyeFamily: eyeStyle === "shaded" || userEye(eyeStyle, 34) === null ? "shaded" : eyeStyle
  function userEye(id, want) { return source && typeof source.userEye === "function" ? source.userEye(id, want) : null }
  readonly property string crestEye: source && source.crestEye !== undefined ? source.crestEye : "auto"
  readonly property string eyeMotion: "off"
  readonly property string loreLevel: String(get("loreLevel", "off"))
  readonly property string vesselFill: ["blood", "whirlpool", "hair", "rust", "static", "tone"].indexOf(String(get("vesselFill", "blood"))) >= 0 ? String(get("vesselFill", "blood")) : "blood"
  readonly property int panelHeadroom: source ? source.panelHeadroom : 0
  readonly property int panelFootroom: source ? source.panelFootroom : 0
}

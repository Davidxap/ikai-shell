import QtQuick

// The colours of a system panel, for the art it shows.
//
// The pre-drawn art (the icon in a panel's head, the spiral and the blood in the frame's corners) is bone and
// crimson. Under a theme the shell's shader moves it onto the theme's colours; on the shell's own palette
// (ItoConfig.tinted is false) it is shown as drawn, crimson included, and a blood colour chosen in the settings
// would not reach it. A panel must never show a baked red, so this stands in for the config wherever a panel hands
// one to art: the same colours and settings, but `tinted` is always true, so the shader runs and every red on the
// panel is the accent the shell is using (the theme's, or the chosen one). It is used only while a panel is open.
//
// `warn` is the colour of a hot or alerting reading: the theme's red (hue-corrected), else blood; see ItoConfig.warn.
// A panel's content must be given THIS palette under a name the content components do not use for their own property
// (the widget calls it `tint`, not `cfg`): inside a component with a `cfg` property, `cfg: cfg` binds to itself.
//
// Pass the widget's ItoConfig as `source`. Nothing here is a colour of its own.
QtObject {
  id: root

  property var source: null

  readonly property color blood: source ? source.blood : Qt.rgba(0.5, 0.5, 0.5, 1)
  readonly property color lit: source ? source.lit : Qt.rgba(0.5, 0.5, 0.5, 1)
  readonly property color warn: source ? source.warn : blood
  readonly property color bone: source ? source.bone : Qt.rgba(0.8, 0.8, 0.8, 1)
  readonly property color ink: source ? source.ink : Qt.rgba(0.1, 0.1, 0.1, 1)
  readonly property bool tinted: true
  readonly property real motionAmp: source ? source.motionAmp : 1
  readonly property real openScale: source && source.openScale !== undefined ? source.openScale : 1
  readonly property string eyeStyle: source ? source.eyeStyle : "shaded"
  readonly property string eyeFamily: source && source.eyeFamily !== undefined ? source.eyeFamily : "shaded"
  function userEye(id, want) { return source && typeof source.userEye === "function" ? source.userEye(id, want) : null }
  readonly property string crestEye: source ? source.crestEye : "auto"
  readonly property string eyeMotion: source ? source.eyeMotion : "subtle"
  readonly property int eyeLevel: source ? source.eyeLevel : 1
  readonly property string loreLevel: source ? source.loreLevel : "off"
  readonly property string vesselFill: source && source.vesselFill !== undefined ? source.vesselFill : "blood"
  readonly property real light: source ? source.light : 1
  readonly property int panelHeadroom: source ? source.panelHeadroom : 0
  readonly property int panelFootroom: source ? source.panelFootroom : 0

  function get(key, fallback) { return source ? source.get(key, fallback) : fallback }
}

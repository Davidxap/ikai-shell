import QtQuick

// The number that sits beside an instrument: 42%, 7%, 100%. Bone by default, blood when the value
// runs hot. It only recolours on a change; nothing here moves while idle.
//
// The sidecar key `valueStyle` picks how it reads everywhere at once: "percent" (42%), "number" (42),
// "amount" (6.2/16G, for the widgets that have a quantity to give; the rest stay a percentage) or "off".
// `valueLabels` puts the reading's name in front of it (CPU 42%), the way Shibumi does, so a number always
// says what it is. A count that is not a percentage (the tray) sets `percent: false`.
Text {
  id: root

  property int barSize: 46
  property var value: 0
  property bool percent: true
  property bool hot: false
  property string label: ""         // what it measures: CPU, RAM, VOL...
  property string detail: ""        // the quantity, for the "amount" style: 6.2/16G
  property bool vertical: false     // on a vertical bar there is no room for the name

  ItoConfig {
    id: cfg
    path: Qt.resolvedUrl("ito-style.json").toString().replace("file://", "")
  }

  readonly property string mode: String(cfg.get("valueStyle", "percent"))

  readonly property bool named: label !== "" && !vertical && cfg.get("valueLabels", true) !== false
  // The number glides to its new value instead of jumping. It only runs when the reading changes (every few
  // seconds), for a fraction of a second, and not at all when Motion is off or the value is not a number.
  property real glide: Number(value) || 0
  Behavior on glide {
    enabled: cfg.motionAmp > 0 && !isNaN(Number(root.value))
    NumberAnimation { duration: Math.round(240 * Math.min(cfg.motionAmp, 1)); easing.type: Easing.OutCubic }
  }
  readonly property var counted: isNaN(Number(value)) ? value : Math.round(glide)
  readonly property string shown: mode === "amount" && detail !== "" ? detail
    : counted + (percent && mode !== "number" ? "%" : "")
  readonly property color quiet: Qt.rgba(cfg.bone.r * 0.6, cfg.bone.g * 0.6, cfg.bone.b * 0.6, 1)

  textFormat: Text.RichText
  text: named ? "<span style='font-size:" + Math.round(barSize * 0.2) + "px;color:" + quiet + ";letter-spacing:1px'>" + label + "</span>&nbsp;" + shown : shown
  font.family: "Noto Serif"
  font.pixelSize: Math.round(barSize * 0.30)
  font.weight: Font.DemiBold
  color: hot ? cfg.lit : cfg.bone
  renderType: Text.NativeRendering
  // Serif digits sit above the middle of their line box; lift the box so they centre on the icon.
  bottomPadding: Math.round(barSize * 0.06)

  Behavior on color { ColorAnimation { duration: 180 } }
}

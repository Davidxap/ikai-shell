import QtQuick 6.11
import "ItoChart.js" as Chart

// The inks of the popup frame styles (ito-panel-presence/frame-styles.md section 1): ItoSealInk's tokens plus the materials of the
// metal and rust styles. Give it `source` an ItoPanelPalette (forced tinted), never a raw ItoConfig: media, notifications, ai and
// weather pass a raw `cfg` to their frames, and a raw one would let a baked red through. Nothing here is a colour of its own.
//
//   paper       the sheet fill: the panel ink at 0.96
//   shade       the darker of panel and bone (by luminance): the base of every metal, so metal is dark-on-dark on a dark theme and
//               darkens on a light one (blood never turns pink there)
//   iron        links, plates, nuts: shade toward bone by 0.34, opaque
//   ironHi      rims, rivets, highlights: shade toward bone by 0.62, opaque
//   rust        material, not an accent: blood toward shade by 0.45, moved to reach 3:1 on the panel
//   rustBloom   corner blooms: blood toward shade by 0.3 at 0.16
//   mesh, fog   grating lines (bone 0.11) and fog banks (bone 0.07)
//   alertRule   `hot` at 0.75: the rule in an alert;  alertSoft  `hot` at 0.35: alert washes
// `frameReport()` is ItoSealInk.report() plus three rows: iron >= 1.6:1, ironHi >= 3:1, rust >= 3:1 against the panel.
ItoSealInk {
  id: root

  readonly property color shade: Chart.luminance(num(bone)) >= Chart.luminance(num(panel)) ? panel : bone
  readonly property color paper: alpha(panel, 0.96)
  readonly property color iron: reach(settle(mix(shade, bone, 0.34), 1), 1.6)
  readonly property color ironHi: reach(settle(mix(shade, bone, 0.62), 1), 3.0)
  readonly property color rust: reach(settle(mix(fill, shade, 0.45), 0.9), 3.0)
  readonly property color rustBloom: alpha(mix(blood, shade, 0.3), 0.16)
  readonly property color mesh: alpha(bone, 0.11)
  readonly property color fog: alpha(bone, 0.07)
  readonly property color alertRule: alpha(hot, 0.75)
  readonly property color alertSoft: alpha(hot, 0.35)

  function frameReport() {
    var out = report()
    var rows = [{ token: "iron vs panel", c: iron, need: 1.6 }, { token: "ironHi vs panel", c: ironHi, need: 3.0 }, { token: "rust vs panel", c: rust, need: 3.0 }]
    for (var i = 0; i < rows.length; i++) {
      var ratio = Chart.contrast(num(rows[i].c), num(panel))
      out.push({ token: rows[i].token, ratio: ratio, need: rows[i].need, ok: ratio >= rows[i].need, warn: false })
    }
    return out
  }
}

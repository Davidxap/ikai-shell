import QtQuick
import "ItoMotion.js" as Motion

// A NumberAnimation that takes its time and curve from a motion role (ItoMotion.js ROLES) and the shell's motion amplitude.
// `ItoAnim { role: "arrive"; amp: cfg.motionAmp }`. Duration 0 (motion off) is a cut, also inside a Behavior.
// For a migration that must stay time-identical: `ms` + `curve` (a name from Motion.CURVES) instead of a role.
NumberAnimation {
  property string role: ""
  property real amp: 1
  property string scope: ""
  property bool leaving: false
  property int ms: 0
  property string curve: "standard"
  readonly property var _r: role !== "" ? Motion.role(role, amp, leaving) : null
  duration: _r ? (scope === "" ? _r.duration : Motion.dur(Motion.ROLES[role] ? (leaving && Motion.ROLES[role].out ? Motion.ROLES[role].out.ms : Motion.ROLES[role].ms) : 260, amp, scope))
                : Motion.dur(ms, amp, scope === "" ? "panel" : scope)
  easing.type: Easing.BezierSpline
  easing.bezierCurve: _r ? _r.curve : (Motion.CURVES[curve] || Motion.CURVES.standard)
}

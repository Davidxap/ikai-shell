import QtQuick
import QtQuick.Shapes
import "ItoTimeModel.js" as Model

// The face of the bar clock: the time as serif numerals in a Row (or a Column on a vertical bar), with the optional
// seconds, am/pm, moon, spiral tick and date beside it. Pure: it takes the moment as `date` and the colours as
// `bone` / `blood`, imports nothing from the shell, and has no clock of its own (the host passes `date` and, for the
// tick, `tickAngle`). The widget and scripts/lab/lab-clockface.qml share it.
//
// Every numeral Text uses tabular, lining figures so the island never changes width when a digit changes. In 12 h the
// hour keeps the width of two digits. visual-spec section 2.
Item {
  id: root

  property date date: new Date(2026, 9, 2, 23, 7, 41)
  property color bone: "transparent"
  property color blood: "transparent"
  property real k: 1                    // barSize / 52
  property bool vertical: false
  property bool hovered: false
  property bool live: true              // false while the bar is hidden: the hover wash does not animate
  property bool hour12: false
  property bool seconds: false
  property string numerals: "western"   // western | kanji
  property string dateMode: "off"       // off | day | weekday
  property bool moon: false
  property bool tick: false
  property real motionAmp: 1
  property real tickAngle: 0            // degrees, driven by the host
  // S17e `shPack`: a static picture beside the hour (the spiral from the user's sprite sheet), { url, px } or null; never over the digits
  property var shGlyph: null
  property int shGlyphSize: 0           // logical px; the host picks the tier file for it
  property bool shTinted: false         // the host's theme recolour for the picture only (its own effect component)
  property Component shEffect: null

  readonly property bool kanji: numerals === "kanji"
  readonly property var t: Model.formatClock(date.getHours(), date.getMinutes(), date.getSeconds(),
    { hour12: hour12, seconds: seconds, numerals: numerals })
  readonly property var phase: Model.moonPhase(date.getTime())
  readonly property string dateText: dateMode === "off" ? ""
    : (dateMode === "weekday" ? Model.DAY_NAMES[date.getDay()].slice(0, 3).toLowerCase() + " " : "") + date.getDate()
  readonly property bool tickShown: tick && motionAmp > 0 && !vertical
  readonly property int digitPx: Math.round((kanji ? 17 : 19) * k)
  readonly property real digitSpacing: kanji ? 0.5 : 1.5
  readonly property string face: "Noto Serif CJK JP"

  implicitWidth: vertical ? stacked.implicitWidth : row.implicitWidth
  implicitHeight: vertical ? stacked.implicitHeight : row.implicitHeight

  // width of two digits at the hour's font: 12 h reserves it, so 9:59 -> 10:00 does not move the island
  TextMetrics {
    id: twoDigits
    text: root.kanji ? "〇〇" : "00"
    font.family: root.face; font.weight: Font.Medium; font.pixelSize: root.digitPx
    font.letterSpacing: root.digitSpacing
    font.features: { "tnum": 1, "lnum": 1 }
  }

  // Noto Serif CJK JP has no tabular figures (the `tnum` feature changes nothing: the lab gate measured a 1.9 px spread
  // at 19 px), so every western digit sits in a slot as wide as the widest digit and the island cannot change width.
  // Kanji digits are full width by nature and need no slot. `text` is right aligned inside at least `slots` slots
  // (12 h reserves two for the hour).
  component Digits: Row {
    id: dg
    property string text: ""
    property int slots: 0
    property color color: root.bone
    property int px: root.digitPx
    property real tracking: root.digitSpacing
    property int weight: Font.Medium
    property real slotW: 0
    readonly property string padded: root.kanji || slots === 0 ? text : text.padStart(slots, " ")
    spacing: 0
    baselineOffset: ruler.baselineOffset         // so `anchors.baseline` lines this up with the neighbouring text
    Text { id: ruler; visible: false; text: "0"; font.family: root.face; font.weight: dg.weight; font.pixelSize: dg.px; font.letterSpacing: dg.tracking }
    TextMetrics { id: probe; font.family: root.face; font.weight: dg.weight; font.pixelSize: dg.px; font.letterSpacing: dg.tracking }
    function measure() {
      var w = 0
      for (var d = 0; d < 10; d++) { probe.text = String(d); w = Math.max(w, probe.advanceWidth) }
      slotW = Math.ceil(w * 100) / 100
    }
    onPxChanged: measure()
    Component.onCompleted: measure()
    Repeater {
      model: dg.padded.length
      Item {
        required property int index
        readonly property string ch: dg.padded.charAt(index)
        width: root.kanji ? glyph.implicitWidth : dg.slotW
        height: glyph.implicitHeight
        Text {
          id: glyph
          anchors.horizontalCenter: parent.horizontalCenter
          text: parent.ch; color: dg.color
          renderType: Text.NativeRendering
          font.family: root.face; font.weight: dg.weight; font.pixelSize: dg.px; font.letterSpacing: dg.tracking
        }
      }
    }
  }

  // "am" and "pm" differ in width: the meridiem keeps the wider of the two
  TextMetrics { id: amM; text: "am"; font.family: root.face; font.pixelSize: Math.round(9 * root.k); font.letterSpacing: 1 }
  TextMetrics { id: pmM; text: "pm"; font.family: root.face; font.pixelSize: Math.round(9 * root.k); font.letterSpacing: 1 }

  component Num: Text {
    renderType: Text.NativeRendering
    font.family: root.face
    font.features: { "tnum": 1, "lnum": 1 }
  }

  Row {
    id: row
    visible: !root.vertical
    anchors.centerIn: parent
    spacing: 0

    Image {
      visible: !!root.shGlyph && root.shGlyphSize > 0
      anchors.verticalCenter: parent.verticalCenter
      width: visible ? root.shGlyphSize : 0; height: width
      source: root.shGlyph ? String(root.shGlyph.url) : ""
      sourceSize: root.shGlyph ? Qt.size(root.shGlyph.px, root.shGlyph.px) : Qt.size(0, 0)
      fillMode: Image.PreserveAspectFit
      smooth: true
      layer.enabled: visible && root.shTinted && root.shEffect !== null
      layer.smooth: true
      layer.effect: root.shEffect
    }
    Item { visible: !!root.shGlyph && root.shGlyphSize > 0; width: Math.round(6 * root.k); height: 1 }

    ItoMoon {
      visible: root.moon
      anchors.verticalCenter: parent.verticalCenter
      size: Math.round(12 * root.k)
      illum: root.phase.illum; waxing: root.phase.waxing
      lit: Qt.rgba(root.bone.r, root.bone.g, root.bone.b, 0.85)
      dark: Qt.rgba(root.bone.r, root.bone.g, root.bone.b, 0.14)
      ring: root.blood
    }
    Item { visible: root.moon; width: Math.round(6 * root.k); height: 1 }

    Digits {
      id: hh
      text: root.t.hh; slots: root.hour12 ? 2 : 0
      color: root.bone; opacity: root.hovered ? 1 : 0.92
      Behavior on opacity { enabled: root.live && root.motionAmp > 0; NumberAnimation { duration: 140 * root.motionAmp } }
    }
    Num { id: colon; text: ":"; color: root.blood; font.weight: Font.Medium; font.pixelSize: root.digitPx; font.letterSpacing: root.digitSpacing }
    Digits { text: root.t.mm; color: root.bone }

    Item { visible: root.seconds; width: Math.round(3 * root.k); height: 1 }
    Digits {
      visible: root.seconds
      anchors.baseline: colon.baseline
      text: root.t.ss
      color: Qt.rgba(root.blood.r, root.blood.g, root.blood.b, 0.8)
      px: Math.round(11 * root.k); tracking: 0; weight: Font.Normal
    }
    Item { visible: root.hour12; width: Math.round(3 * root.k); height: 1 }
    Item {
      visible: root.hour12
      anchors.baseline: colon.baseline
      width: Math.max(amM.advanceWidth, pmM.advanceWidth); height: 1
      Num {
        anchors.baseline: parent.baseline
        text: root.t.meridiem
        color: Qt.rgba(root.bone.r, root.bone.g, root.bone.b, 0.55)
        font.pixelSize: Math.round(9 * root.k); font.letterSpacing: 1
      }
    }

    Item { visible: root.tickShown; width: Math.round(5 * root.k); height: 1 }
    Shape {
      visible: root.tickShown
      anchors.verticalCenter: parent.verticalCenter
      width: Math.round(10 * root.k); height: width
      preferredRendererType: Shape.CurveRenderer
      rotation: root.tickAngle
      ShapePath {
        strokeColor: Qt.rgba(root.bone.r, root.bone.g, root.bone.b, 0.5)
        strokeWidth: 1
        fillColor: "transparent"
        capStyle: ShapePath.RoundCap
        PathPolyline { path: root.spiral(Math.round(10 * root.k)) }
      }
    }

    Item { visible: root.dateText !== ""; width: Math.round(8 * root.k); height: 1 }
    Rectangle {
      visible: root.dateText !== ""
      anchors.verticalCenter: parent.verticalCenter
      width: 1; height: Math.round(10 * root.k)
      color: Qt.rgba(root.bone.r, root.bone.g, root.bone.b, 0.25)
    }
    Item { visible: root.dateText !== ""; width: Math.round(8 * root.k); height: 1 }
    Num {
      visible: root.dateText !== ""
      anchors.baseline: colon.baseline
      text: root.dateText
      color: Qt.rgba(root.bone.r, root.bone.g, root.bone.b, 0.75)
      font.pixelSize: Math.round(14 * root.k); font.letterSpacing: 1
    }
  }

  // an Archimedean spiral of 2.5 turns inside a `size` square, as polyline points
  function spiral(size) {
    var pts = [], turns = 2.5, n = 40, c = size / 2, r = size / 2 - 0.5
    for (var i = 0; i <= n; i++) {
      var f = i / n, a = f * turns * 2 * Math.PI
      pts.push(Qt.point(c + Math.cos(a) * r * f, c + Math.sin(a) * r * f))
    }
    return pts
  }

  // vertical: hour over minutes with the one red mark between them; the date and the tick are not shown
  Column {
    id: stacked
    visible: root.vertical
    anchors.centerIn: parent
    spacing: 1

    ItoMoon {
      visible: root.moon
      anchors.horizontalCenter: parent.horizontalCenter
      size: Math.round(12 * root.k)
      illum: root.phase.illum; waxing: root.phase.waxing
      lit: Qt.rgba(root.bone.r, root.bone.g, root.bone.b, 0.85)
      dark: Qt.rgba(root.bone.r, root.bone.g, root.bone.b, 0.14)
      ring: root.blood
    }
    Digits { anchors.horizontalCenter: parent.horizontalCenter; text: root.t.hh; slots: root.hour12 ? 2 : 0 }
    Rectangle { anchors.horizontalCenter: parent.horizontalCenter; width: 10; height: 2; radius: 1; color: root.blood }
    Digits { anchors.horizontalCenter: parent.horizontalCenter; text: root.t.mm }
    Digits {
      visible: root.seconds
      anchors.horizontalCenter: parent.horizontalCenter
      text: root.t.ss; color: Qt.rgba(root.blood.r, root.blood.g, root.blood.b, 0.8)
      px: Math.round(11 * root.k); tracking: 0; weight: Font.Normal
    }
    Num {
      visible: root.hour12
      anchors.horizontalCenter: parent.horizontalCenter
      text: root.t.meridiem; color: Qt.rgba(root.bone.r, root.bone.g, root.bone.b, 0.55)
      font.pixelSize: Math.round(8 * root.k); font.letterSpacing: 1
    }
  }
}

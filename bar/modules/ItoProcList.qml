import QtQuick
import "ItoMotion.js" as Motion

// The busiest processes, one per line: the name, a thin bar proportional to its share, and the reading. A name
// shared by several processes carries a count ("firefox ×12"). Nothing here can be clicked: no PIDs, no icons, no
// sorting, no kill (the panel closes by itself and opens under the pointer, so a stray click must do nothing).
//
// `rows` is a list of { name, count, fraction, value }: `fraction` is 0..1 of the largest reading shown, `value` the
// text at the right ("12.4%", "1.8 G"; "—" when there is no reading yet). Colours come only from `cfg` (through an
// ItoSealInk). It imports nothing from the shell, so the offscreen lab can render it.
//
// The bar is a groove with liquid running in it (ItoGroove, 4 px, a bead at its end, no ruler, no threshold), settling
// on a new share like something thick. Rows are kept by name, not rebuilt on every refresh: when the order changes a row
// slides to its new line, a new name fades in, a name that left fades out. `live` is the panel-open flag: closed,
// nothing animates. Motion follows `cfg.motionAmp` (0 is instant). Nothing runs between refreshes but the animations.
Item {
  id: root

  property var cfg: null
  property var ink: null            // an ItoSealInk shared by the panel; when null the list makes its own from `cfg`
  property bool live: true
  property var rows: []
  property string emptyText: "Nothing to show"
  property int rowHeight: 18
  property int valueWidth: 56

  readonly property var seal: ink ? ink : ownInk
  readonly property real rawAmp: cfg && cfg.motionAmp !== undefined ? cfg.motionAmp : 1
  readonly property real amp: Math.min(rawAmp, 1)

  ItoSealInk { id: ownInk; source: root.ink ? null : root.cfg }

  implicitHeight: Math.max(1, rows.length) * rowHeight
  height: implicitHeight

  // One entry per name on show or still fading out. `slot` is the line a row belongs on; `present` is false while
  // it fades out, after which `sweep` drops it.
  ListModel { id: shown }

  function indexOfName(name) {
    for (var i = 0; i < shown.count; i++)
      if (shown.get(i).name === name && shown.get(i).present) return i
    return -1
  }

  function sync() {
    var list = root.rows || []
    var i, at
    for (i = 0; i < shown.count; i++) {
      var still = false
      for (var j = 0; j < list.length; j++) if (list[j].name === shown.get(i).name) { still = true; break }
      if (!still && shown.get(i).present) shown.setProperty(i, "present", false)
    }
    for (i = 0; i < list.length; i++) {
      var r = list[i]
      at = indexOfName(r.name)
      var entry = { name: String(r.name), count: Number(r.count), fraction: Number(r.fraction), value: String(r.value), slot: i, present: true }
      if (at >= 0) shown.set(at, entry)
      else shown.append(entry)
    }
    var gone = false
    for (i = 0; i < shown.count; i++) if (!shown.get(i).present) gone = true
    if (gone) sweep.restart()
  }
  onRowsChanged: sync()
  Component.onCompleted: sync()

  Timer {
    id: sweep
    interval: Math.round(Motion.normal * root.amp) + 60
    onTriggered: {
      for (var i = shown.count - 1; i >= 0; i--)
        if (!shown.get(i).present) shown.remove(i)
    }
  }

  Text {
    visible: root.rows.length === 0
    anchors { left: parent.left; verticalCenter: parent.verticalCenter }
    text: root.emptyText
    color: root.seal.label
    font.family: "Noto Serif"; font.pixelSize: 11; font.italic: true
    renderType: Text.NativeRendering
  }

  Repeater {
    model: shown
    Item {
      id: line
      required property string name
      required property int count
      required property real fraction
      required property string value
      required property int slot
      required property bool present

      width: root.width
      height: root.rowHeight
      y: slot * root.rowHeight
      // false at creation, true one step later: that step is what fades a new name in
      property bool arrived: false
      opacity: present && arrived ? 1 : 0
      Behavior on y { enabled: root.live; NumberAnimation { duration: Math.round(Motion.slow * root.amp); easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.spring } }
      Behavior on opacity { enabled: root.live; NumberAnimation { duration: Math.round(Motion.normal * root.amp); easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.soft } }
      Component.onCompleted: arrived = true

      // the count sits outside the name so a long name is cut short, never the count
      Text {
        id: countText
        visible: line.count > 1
        anchors { left: nameText.right; leftMargin: 3; verticalCenter: parent.verticalCenter }
        text: "×" + line.count
        color: root.seal.label
        font.family: "Noto Serif"; font.pixelSize: 10
        renderType: Text.NativeRendering
      }
      Text {
        id: nameText
        anchors { left: parent.left; verticalCenter: parent.verticalCenter }
        readonly property real room: Math.round(root.width * 0.42) - (countText.visible ? countText.implicitWidth + 3 : 0)
        width: Math.min(implicitWidth, Math.max(24, room))
        text: line.name
        elide: Text.ElideRight
        color: root.seal.bone
        font.family: "Noto Serif"; font.pixelSize: 11
        renderType: Text.NativeRendering
      }

      ItoGroove {
        anchors.verticalCenter: parent.verticalCenter
        x: Math.round(root.width * 0.42) + 8
        width: Math.max(0, root.width - x - root.valueWidth - 8)
        ink: root.seal
        fraction: line.fraction
        notches: false
        grooveHeight: 4
        beadSize: 5
        kind: "groove"
        live: root.live && line.present
        amp: root.rawAmp
      }

      Text {
        anchors { right: parent.right; verticalCenter: parent.verticalCenter }
        width: root.valueWidth
        horizontalAlignment: Text.AlignRight
        text: line.value
        elide: Text.ElideRight
        color: root.seal.bone
        font.family: "Noto Serif"; font.pixelSize: 11
        renderType: Text.NativeRendering
      }
    }
  }
}

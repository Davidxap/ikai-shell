import QtQuick
import QtQuick.Layouts
import Quickshell
import ".." as Cc

// The top of a surface pane (boot-lock-v2 §2.1): the status strip (what is applied and whether it is the truth),
// then the hero preview koma on the left and the action column on the right: one primary action chosen by the
// state, Try and Back to mine, and the result line of the last run.
ColumnLayout {
  id: head

  property var host: null           // the Boot & Lock page
  property var status: null         // the helper's status v2 JSON
  property var run: null            // the surface's SurfaceRun
  property string preview: ""       // a picture path for the hero, "" for the empty panel
  property string previewCaption: ""
  property string loadingText: ""   // shown under the kanji while the preview is being drawn
  property bool heroFit: false      // show the whole picture (letterboxed) instead of cropping it to the panel
  property real heroZoom: 1         // crop the centre of the picture (a boot screen is mostly empty)
  property string kanji: ""
  property string primaryOff: "Turn on"
  property string blockedLabel: "Update to this theme"
  property bool primaryEnabled: true
  property bool primaryJumps: false // blocked: the primary action opens the reason instead of running
  property string tryLabel: "Try"
  property string tryHint: ""
  property bool tryEnabled: true
  property string backHint: ""
  property bool backEnabled: true
  property string needsCommand: ""  // a step only you can take (root or a terminal): the exact command, shown once in the "Needs you" block
  property string needsText: ""
  property bool needsCopied: false
  readonly property var pal: host.pal
  // the guided repair (bin/ito-repair) is offered whenever the strip shows a warning
  readonly property bool needsRepair: warnIssue !== null || state === "partial" || state === "blocked" || state === "error"     // stale: the primary button ("Update to this theme") is the fix, no red repair
  readonly property string state: status && status.state ? String(status.state) : "off"

  signal primary()
  signal tryIt()
  signal back()
  signal jump()

  Layout.fillWidth: true
  spacing: 16

  function hhmm(iso) {
    if (!iso) return ""
    var d = new Date(iso)
    return isNaN(d.getTime()) ? "" : Qt.formatTime(d, "hh:mm")
  }
  readonly property string stateLine: {
    var at = status && status.applied ? hhmm(status.applied.at) : ""
    switch (state) {
      case "on": return "◉ Applied " + at + " · matches your colours"
      case "stale": return "◐ Applied " + at + " · out of date: something it uses changed since"
      case "partial": return "◐ Partly in place: a piece is missing"
      case "blocked": return "◉ Applied " + at + " · not in charge"
      case "error": return "⚠ The file fails today's check · Repair… rewrites it"
      default: return "○ Off · yours is in place"
    }
  }
  readonly property var warnIssue: {
    var list = status && status.issues ? status.issues : []
    for (var i = 0; i < list.length; i++) if (list[i].level === "warn") return list[i]
    return null
  }
  readonly property string primaryLabel: {
    if (run && run.busy) return "Working…"
    switch (state) {
      case "on": return "Applied"
      case "stale": return "Update to this theme"
      case "partial": case "error": return "Repair"
      case "blocked": return primaryJumps ? "Why it is not in charge ▾" : blockedLabel
      default: return primaryOff
    }
  }

  // ---- status strip
  Rectangle {
    Layout.fillWidth: true
    Layout.preferredHeight: 44
    color: Qt.alpha(head.pal.bone, 0.035)
    border.width: 1
    border.color: Qt.alpha(head.pal.bone, 0.12)
    RowLayout {
      anchors.fill: parent
      anchors.leftMargin: 14
      anchors.rightMargin: 14
      spacing: 12
      Text {
        text: head.stateLine
        color: head.state === "error" ? head.pal.warn : head.pal.bone
        font.family: "Noto Serif"
        font.pixelSize: 12
      }
      Rectangle { visible: head.warnIssue !== null && head.needsCommand === ""; width: 1; Layout.preferredHeight: 20; color: Qt.alpha(head.pal.bone, 0.3) }
      Text {
        visible: head.warnIssue !== null && head.needsCommand === ""
        Layout.fillWidth: true
        text: head.warnIssue ? "⚠ " + head.warnIssue.text : ""
        elide: Text.ElideRight
        color: head.pal.warn
        font.family: "Noto Serif"
        font.pixelSize: 12
      }
      Item { visible: head.warnIssue === null || head.needsCommand !== ""; Layout.fillWidth: true }
      Cc.CcCard {
        visible: head.needsRepair && head.needsCommand === ""
        Layout.preferredWidth: 96; Layout.preferredHeight: 28
        radius: 14; host: head.host.cc; pal: head.pal; showCaption: false
        hint: "Opens a terminal with the guided repair: it shows each change, asks, and backs the file up first."
        onActivated: head.host.openRepair()
        Text { anchors.centerIn: parent; text: "Repair…"; color: head.pal.warn; font.family: "Noto Serif"; font.pixelSize: 12 }
      }
    }
  }

  // ---- Needs you: the one place that says what only you can do, with the exact command
  Rectangle {
    visible: head.needsCommand !== ""
    Layout.fillWidth: true
    Layout.preferredHeight: needsCol.implicitHeight + 24
    color: Qt.alpha(head.pal.warn, 0.08)
    border.width: 1
    border.color: Qt.alpha(head.pal.warn, 0.5)
    ColumnLayout {
      id: needsCol
      anchors.fill: parent
      anchors.margins: 12
      spacing: 8
      Text {
        text: "Needs you"
        color: head.pal.warn
        font.family: "Noto Serif"; font.pixelSize: 13; font.bold: true
      }
      Text {
        Layout.fillWidth: true
        wrapMode: Text.WordWrap
        text: head.needsText
        color: head.pal.bone
        font.family: "Noto Serif"; font.pixelSize: 12
      }
      RowLayout {
        Layout.fillWidth: true
        spacing: 12
        Rectangle {
          Layout.fillWidth: true
          Layout.preferredHeight: 32
          color: Qt.alpha(head.pal.ink, 0.6)
          border.width: 1
          border.color: Qt.alpha(head.pal.bone, 0.2)
          Text {
            anchors.fill: parent; anchors.leftMargin: 10; anchors.rightMargin: 10
            verticalAlignment: Text.AlignVCenter
            elide: Text.ElideMiddle
            text: head.needsCommand
            color: head.pal.bone
            font.family: "JetBrains Mono"; font.pixelSize: 12
          }
        }
        Cc.CcCard {
          Layout.preferredWidth: 96; Layout.preferredHeight: 32
          radius: 16; host: head.host.cc; pal: head.pal; showCaption: false
          hint: "Copies the command; paste it in a terminal."
          onActivated: {
            Quickshell.execDetached(["sh", "-c", "printf %s \"$1\" | wl-copy", "sh", head.needsCommand])
            head.needsCopied = true
          }
          Text { anchors.centerIn: parent; text: head.needsCopied ? "Copied" : "Copy"; color: head.pal.bone; font.family: "Noto Serif"; font.pixelSize: 12 }
        }
      }
    }
  }

  // ---- hero + action column
  RowLayout {
    Layout.fillWidth: true
    spacing: 16

    Item {
      Layout.preferredWidth: 560
      Layout.preferredHeight: 315
      Rectangle { anchors.fill: parent; color: head.pal.ink }
      Item {
        anchors.fill: parent
        anchors.margins: 6
        clip: true
        Text {
          visible: head.preview === "" || heroImg.status !== Image.Ready
          anchors.centerIn: parent
          text: head.kanji
          color: head.pal.bone
          opacity: 0.18
          font.family: "Noto Serif CJK JP"
          font.pixelSize: 180
        }
        Text {
          visible: head.loadingText !== "" && head.preview === ""
          anchors.horizontalCenter: parent.horizontalCenter
          anchors.bottom: parent.bottom; anchors.bottomMargin: 36
          text: head.loadingText
          color: head.pal.bone; opacity: 0.6
          font.family: "Noto Serif"; font.pixelSize: 12
        }
        Image {
          id: heroImg
          anchors.fill: parent
          source: head.preview !== "" ? "file://" + head.preview : ""
          fillMode: head.heroFit ? Image.PreserveAspectFit : Image.PreserveAspectCrop
          scale: head.heroZoom
          asynchronous: true
          cache: false
          sourceSize.width: 1120 * head.heroZoom
          sourceSize.height: 630 * head.heroZoom
          opacity: head.run && head.run.busy ? 0.55 : 1
        }
        Text {
          anchors.left: parent.left; anchors.bottom: parent.bottom
          anchors.margins: 10
          text: head.previewCaption
          color: head.pal.bone
          opacity: 0.6
          style: Text.Outline
          styleColor: Qt.alpha(head.pal.ink, 0.8)
          font.family: "Noto Serif"
          font.pixelSize: 11
        }
        Text {
          visible: head.run !== null && head.run.busy
          anchors.right: parent.right; anchors.bottom: parent.bottom
          anchors.margins: 10
          text: "◜"
          color: head.pal.bone
          font.pixelSize: 14
          RotationAnimation on rotation { running: head.run !== null && head.run.busy; from: 0; to: 360; duration: 900; loops: Animation.Infinite }
        }
      }
      // the panel border: lit side thin, shadow side heavy
      Rectangle { x: 6; y: 6; width: parent.width - 12; height: 1; color: Qt.alpha(head.pal.bone, 0.55) }
      Rectangle { x: 6; y: 6; width: 1; height: parent.height - 12; color: Qt.alpha(head.pal.bone, 0.55) }
      Rectangle { x: parent.width - 8.5; y: 6; width: 2.5; height: parent.height - 12; color: Qt.alpha(head.pal.bone, 0.85) }
      Rectangle { x: 6; y: parent.height - 8.5; width: parent.width - 12; height: 2.5; color: Qt.alpha(head.pal.bone, 0.85) }
    }

    ColumnLayout {
      Layout.preferredWidth: 304
      Layout.alignment: Qt.AlignTop
      spacing: 12

      Cc.CcCard {
        Layout.preferredWidth: 304; Layout.preferredHeight: 40
        radius: 20; host: head.host.cc; pal: head.pal; showCaption: false
        current: head.state !== "on"
        opacity: !head.primaryEnabled || head.state === "on" || (head.run && head.run.busy) ? 0.5 : 1
        hint: head.state === "on" ? "Applied, and it matches your colours." : "Write it now, in your colours. What you had is saved first."
        onActivated: {
          if (!head.primaryEnabled || head.state === "on" || (head.run && head.run.busy)) return
          if (head.state === "blocked" && head.primaryJumps) head.jump()
          else head.primary()
        }
        Text { anchors.centerIn: parent; text: head.primaryLabel; color: head.pal.bone; font.family: "Noto Serif"; font.pixelSize: 13 }
      }
      RowLayout {
        spacing: 12
        Cc.CcCard {
          Layout.preferredWidth: 146; Layout.preferredHeight: 36
          radius: 18; host: head.host.cc; pal: head.pal; showCaption: false
          opacity: head.tryEnabled ? 1 : 0.35
          hint: head.tryHint
          onActivated: if (head.tryEnabled) head.tryIt()
          Text { anchors.centerIn: parent; text: head.tryLabel; color: head.pal.bone; font.family: "Noto Serif"; font.pixelSize: 12 }
        }
        Cc.CcCard {
          Layout.preferredWidth: 146; Layout.preferredHeight: 36
          radius: 18; host: head.host.cc; pal: head.pal; showCaption: false
          opacity: head.backEnabled && head.state !== "off" ? 1 : 0.35
          hint: head.backHint
          onActivated: if (head.backEnabled && head.state !== "off") head.back()
          Text { anchors.centerIn: parent; text: "Back to mine"; color: head.pal.bone; font.family: "Noto Serif"; font.pixelSize: 12 }
        }
      }
      ResultLine { run: head.run }
    }
  }

  component ResultLine: ColumnLayout {
    id: rl
    property var run: null
    property bool open: false
    Layout.fillWidth: true
    spacing: 2
    visible: run !== null && (run.busy || run.result !== "")
    Text {
      Layout.fillWidth: true
      wrapMode: Text.WordWrap
      text: rl.run && rl.run.busy ? "Working…" : (rl.run ? rl.run.result : "")
      color: rl.run && rl.run.failed ? head.pal.warn : head.pal.bone
      opacity: rl.run && rl.run.failed ? 1 : 0.72
      font.family: "Noto Serif"
      font.pixelSize: 12
    }
    Text {
      visible: rl.run !== null && rl.run.failed && rl.run.details !== ""
      text: rl.open ? "hide details" : "details"
      color: head.pal.bone
      opacity: 0.72
      font.family: "Noto Serif"
      font.pixelSize: 12
      font.underline: true
      MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: rl.open = !rl.open }
    }
    Text {
      visible: rl.open && rl.run !== null && rl.run.failed
      Layout.fillWidth: true
      wrapMode: Text.WrapAnywhere
      text: rl.run ? rl.run.details : ""
      color: head.pal.bone
      opacity: 0.72
      font.family: "JetBrains Mono"
      font.pixelSize: 11
    }
  }
}

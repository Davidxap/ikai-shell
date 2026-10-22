import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Io

// Health: what is wrong with the shell, why, and how to put it right. A check that is not well says what it found,
// what it means and what to do, and offers a Fix button when there is a safe fix. Each error in the log is listed
// once with where it comes from. "Copy report" puts the whole thing on the clipboard to send to someone.
ColumnLayout {
  id: page

  property var cc: null
  readonly property var pal: cc.pal
  readonly property color bone: pal.bone
  readonly property string helper: Qt.resolvedUrl("../bin/ito-health").toString().replace("file://", "")

  property var checks: []
  property string message: ""
  property bool messageOk: true
  property var opened: ({})
  readonly property int problems: checks.filter(function(c) { return c.status !== "ok" }).length
  readonly property int fixable: checks.filter(function(c) { return c.status !== "ok" && c.fixId }).length

  spacing: 10

  function recheck() { run.running = true }
  function toggle(id) {
    var next = {}
    for (var k in opened) next[k] = opened[k]
    next[id] = !next[id]
    opened = next
  }

  Process {
    id: run
    command: [page.helper]
    running: true
    stdout: StdioCollector {
      onStreamFinished: {
        try { page.checks = JSON.parse(this.text) } catch (e) { page.checks = [] }
        // What is wrong is shown open: what it is, why, what to do and every distinct error, without a click.
        var next = {}
        for (var k in page.opened) next[k] = page.opened[k]
        for (var i = 0; i < page.checks.length; i++)
          if (page.checks[i].status !== "ok" && next[page.checks[i].id] === undefined) next[page.checks[i].id] = true
        page.opened = next
      }
    }
  }

  // A fix runs the helper and then looks again. Fixes that restart the shell end this panel with it, which is fine.
  Process {
    id: fixer
    stdout: StdioCollector {
      onStreamFinished: {
        try {
          var res = JSON.parse(this.text)
          page.message = res.message
          page.messageOk = res.ok !== false
        } catch (e) { page.message = ""; page.messageOk = true }
        recheckLater.restart()
      }
    }
  }
  Process {
    id: copier
    command: ["sh", "-c", "if command -v wl-copy >/dev/null 2>&1; then '" + page.helper + "' --report | wl-copy && echo copied; else '" + page.helper + "' --report --save >/dev/null && echo saved; fi"]
    stdout: StdioCollector {
      onStreamFinished: {
        var t = String(text).trim()
        page.messageOk = t !== ""
        page.message = t === "copied" ? "Report copied. Paste it into your AI assistant."
          : (t === "saved" ? "There is no clipboard tool, so the report was saved to ~/ito-health-report.md instead."
                           : "The report could not be made.")
      }
    }
  }
  Process {
    id: saver
    command: [page.helper, "--report", "--save"]
    stdout: StdioCollector {
      onStreamFinished: {
        try { page.message = JSON.parse(text).message; page.messageOk = true } catch (e) { page.message = "It could not be saved."; page.messageOk = false }
      }
    }
  }
  Timer { id: recheckLater; interval: 1500; onTriggered: page.recheck() }

  function applyFix(id) {
    page.message = "Working…"
    page.messageOk = true
    fixer.command = [page.helper, "--fix", id]
    fixer.running = true
  }

  CcSection {
    host: page.cc
    startOpen: true
    pal: page.pal
    label: "HEALTH"
    note: page.checks.length === 0 ? "Checking…"
      : (page.problems === 0 ? "Everything the shell needs is in place."
         : page.problems + (page.problems === 1 ? " thing needs" : " things need") + " attention. Open one to see what it means and how to fix it.")


    Text {
      visible: page.message !== ""
      Layout.fillWidth: true
      text: page.message
      wrapMode: Text.WordWrap
      color: page.messageOk ? page.pal.lit : page.pal.blood
      font.family: "Noto Serif"
      font.pixelSize: 12
    }


    RowLayout {
      Layout.fillWidth: true
      spacing: 8

      Repeater {
        model: [
          { "label": "Fix everything", "tip": "Apply every fix that is offered, restarting the shell once at the end if it needs it.", "act": "all", "show": page.fixable > 0, "w": 170 },
          { "label": "Copy report for an AI assistant", "tip": "Copies a full report (what is wrong, your setup, the log and how to fix each thing) so you can paste it into any AI assistant and it can solve it.", "act": "copy", "show": true, "w": 250 },
          { "label": "Save report as a file", "tip": "Writes the same report to ~/ito-health-report.md, to attach or send.", "act": "save", "show": true, "w": 170 },
          { "label": "Check again", "tip": "Run every check again.", "act": "again", "show": true, "w": 120 }
        ]

        CcCard {
          required property var modelData
          visible: modelData.show
          Layout.preferredWidth: modelData.w
          Layout.preferredHeight: 34
          radius: 17
          host: page.cc
          pal: page.pal
          showCaption: false
          hint: modelData.tip
          current: modelData.act === "all"
          onActivated: {
            if (modelData.act === "again") page.recheck()
            else if (modelData.act === "all") page.applyFix("all")
            else if (modelData.act === "save") { page.message = "Saving…"; page.messageOk = true; saver.running = true }
            else { page.message = "Copying…"; page.messageOk = true; copier.running = true }
          }

          Text {
            anchors.centerIn: parent
            text: modelData.label
            color: parent.current ? page.pal.lit : page.bone
            font.family: "Noto Serif"
            font.pixelSize: 12
          }
        }
      }
    }

    Text {
      Layout.fillWidth: true
      wrapMode: Text.WordWrap
      visible: page.problems > 0
      text: "Stuck? Press “Copy report for an AI assistant” and paste it into ChatGPT, Claude or any assistant: it holds everything needed to solve it."
      color: page.bone
      opacity: 0.6
      font.family: "Noto Serif"
      font.pixelSize: 11
    }

    Repeater {
      model: page.checks

      Rectangle {
        id: row
        required property var modelData
        readonly property bool bad: !!modelData && modelData.status !== "ok"
        readonly property bool hasMore: bad || (!!modelData && !!modelData.items && modelData.items.length > 0)
        readonly property bool open: !!page.opened[modelData.id]

        Layout.fillWidth: true
        Layout.preferredHeight: head.implicitHeight + (open ? detailCol.implicitHeight + 16 : 0) + 20
        radius: 12
        clip: true
        color: Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.035)
        border.width: 1
        border.color: !bad ? Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.12)
          : Qt.rgba(page.pal.blood.r, page.pal.blood.g, page.pal.blood.b, modelData.status === "fail" ? 0.8 : 0.45)
        visible: page.cc.match(modelData.name + " " + modelData.detail + " health")


        MouseArea {
          anchors.fill: head
          enabled: row.hasMore
          cursorShape: row.hasMore ? Qt.PointingHandCursor : Qt.ArrowCursor
          onClicked: page.toggle(row.modelData.id)
        }

        RowLayout {
          id: head
          x: 14
          y: 10
          width: parent.width - 28
          spacing: 12

          // the light: bone when well, a half-lit blood mark for a warning, a solid one for a failure
          Rectangle {
            Layout.alignment: Qt.AlignTop
            Layout.topMargin: 3
            width: 12
            height: 12
            radius: 6
            color: !row.bad ? "transparent"
              : (row.modelData.status === "warn" ? Qt.rgba(page.pal.blood.r, page.pal.blood.g, page.pal.blood.b, 0.45) : page.pal.blood)
            border.width: 1.5
            border.color: !row.bad ? page.bone : page.pal.blood
            opacity: !row.bad ? 0.6 : 1
          }

          ColumnLayout {
            Layout.fillWidth: true
            spacing: 1

            Text {
              text: row.modelData.name
              color: page.bone
              font.family: "Noto Serif"
              font.pixelSize: 13
            }

            Text {
              Layout.fillWidth: true
              text: row.modelData.detail
              color: page.bone
              opacity: 0.6
              wrapMode: Text.WordWrap
              font.family: "Noto Serif"
              font.pixelSize: 11
            }
          }

          // the safe fix, when there is one
          CcCard {
            visible: row.bad && !!row.modelData.fixId
            Layout.alignment: Qt.AlignTop
            Layout.preferredWidth: 62
            Layout.preferredHeight: 28
            radius: 14
            host: page.cc
            pal: page.pal
            showCaption: false
            current: true
            hint: "Fix this now: " + row.modelData.fix
            onActivated: page.applyFix(row.modelData.fixId)

            Text {
              anchors.centerIn: parent
              text: "Fix"
              color: page.pal.lit
              font.family: "Noto Serif"
              font.pixelSize: 12
            }
          }

          Text {
            visible: row.hasMore
            Layout.alignment: Qt.AlignTop
            text: row.open ? "▾" : "▸"
            color: page.bone
            opacity: 0.5
            font.pixelSize: 13
          }
        }

        // what it means, what to do, and every distinct error
        ColumnLayout {
          id: detailCol
          x: 38
          y: head.implicitHeight + 16
          width: parent.width - 62
          spacing: 8
          opacity: row.open ? 1 : 0
          Behavior on opacity { NumberAnimation { duration: 180 } }

          Text {
            visible: row.bad && row.modelData.why !== ""
            Layout.fillWidth: true
            textFormat: Text.StyledText
            wrapMode: Text.WordWrap
            text: "<b>What it means.</b> " + row.modelData.why
            color: page.bone
            opacity: 0.8
            font.family: "Noto Serif"
            font.pixelSize: 11
          }

          Text {
            visible: row.bad && row.modelData.fix !== ""
            Layout.fillWidth: true
            textFormat: Text.StyledText
            wrapMode: Text.WordWrap
            text: "<b>What to do.</b> " + row.modelData.fix
            color: page.bone
            opacity: 0.8
            font.family: "Noto Serif"
            font.pixelSize: 11
          }

          Repeater {
            model: row.modelData.items || []

            Rectangle {
              required property var modelData
              Layout.fillWidth: true
              implicitHeight: itemCol.implicitHeight + 16
              radius: 8
              color: Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.04)

              ColumnLayout {
                id: itemCol
                x: 10
                y: 8
                width: parent.width - 20
                spacing: 2

                Text {
                  Layout.fillWidth: true
                  wrapMode: Text.WordWrap
                  textFormat: Text.StyledText
                  text: "<b>" + modelData.title + "</b>" + (modelData.count > 1 ? "  ×" + modelData.count : "")
                  color: page.pal.lit
                  font.family: "Noto Serif"
                  font.pixelSize: 11
                }
                Text {
                  visible: modelData.file !== ""
                  Layout.fillWidth: true
                  text: modelData.file
                  wrapMode: Text.WrapAnywhere
                  color: page.bone
                  opacity: 0.55
                  font.family: "monospace"
                  font.pixelSize: 10
                }
                Text {
                  Layout.fillWidth: true
                  wrapMode: Text.WordWrap
                  text: modelData.message
                  color: page.bone
                  opacity: 0.55
                  font.family: "monospace"
                  font.pixelSize: 10
                }
                Text {
                  Layout.fillWidth: true
                  wrapMode: Text.WordWrap
                  textFormat: Text.StyledText
                  text: "<b>Means:</b> " + modelData.why + "<br><b>Do:</b> " + modelData.fix
                  color: page.bone
                  opacity: 0.75
                  font.family: "Noto Serif"
                  font.pixelSize: 10
                }
              }
            }
          }
        }
      }
    }

  }

}

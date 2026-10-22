import QtQuick
import QtQuick.Layouts

// One choice on the Styles page: a CcCard with a preview over its name. The preview is built only while its section is open and the card is visible
// (a search that does not match hides the card and frees it). `words` are extra search keywords; the card is shown when the search matches the name,
// the note or the words.
CcCard {
  id: root

  property var section: null            // the CcSection this card sits in
  property string name: ""
  property string note: ""
  property string words: ""
  property Component preview: null
  property real cardW: 206
  property real previewH: 96
  // D4: an option that does not apply says why. A non-empty `reason` dims the card, shows it under the preview and hands it to the footer
  // instead of the note; the page must not act on a click while `unavailable` (CcCard still emits `activated`).
  property string reason: ""
  // `naReason` (inherited from CcCard) is the same D4 reason under the name CcToggle/CcMeter use; either one makes the card unavailable
  readonly property string why: reason !== "" ? reason : naReason
  readonly property bool unavailable: why !== ""

  Layout.preferredWidth: cardW
  Layout.preferredHeight: previewH + 34
  caption: name
  hint: unavailable ? why : note
  opacity: unavailable ? 0.55 : 1
  visible: host === null || host.match(name + " " + note + " " + words)

  Loader {
    anchors { horizontalCenter: parent.horizontalCenter; top: parent.top; topMargin: 8 }
    width: parent.width - 16
    height: root.previewH
    active: root.visible && root.preview !== null && (root.section === null || root.section.expanded)
    sourceComponent: root.preview
  }
  Text {
    visible: root.unavailable
    z: 3
    anchors { horizontalCenter: parent.horizontalCenter; top: parent.top; topMargin: 8 + root.previewH - 26 }
    width: parent.width - 16
    height: 26
    text: root.why
    color: root.pal ? root.pal.bone : "white"
    horizontalAlignment: Text.AlignHCenter
    verticalAlignment: Text.AlignBottom
    wrapMode: Text.WordWrap
    maximumLineCount: 2
    elide: Text.ElideRight
    font.family: "Noto Serif"; font.italic: true; font.pixelSize: 10
  }
}

import QtQuick
import Quickshell
import qs.Ui as Ui

// The Marketplace entry of IKAI: one small button on whatever bar you use now.
//
// IKAI is a suite (a bar engine, twenty widgets, a Control Centre and tools) that lives in ~/.config/omarchy
// next to Omarchy's own files, so a plugin folder alone cannot carry it. This button opens a terminal that runs
// install.sh from the plugin's own folder. install.sh says what it will do and asks before it changes anything.
Ui.BarWidget {
  id: root
  moduleName: "davidxap.ito-verse-shell"

  readonly property string here: Qt.resolvedUrl(".").toString().replace("file://", "")

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  Ui.WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    tooltipText: "Install IKAI (opens a terminal and asks before it changes anything)"
    horizontalMargin: 4
    labelVisible: false
    hasVisualContent: true
    fixedWidth: vertical ? barSize : icon.width + scaledHorizontalMargin * 2
    fixedHeight: vertical ? icon.height + scaledVerticalPadding * 2 : barSize
    onPressed: function(mouseButton) {
      if (mouseButton === Qt.LeftButton)
        Quickshell.execDetached(["xdg-terminal-exec", "bash", root.here + "install.sh"])
    }

    Image {
      id: icon
      anchors.centerIn: parent
      width: Math.round(button.barSize * 0.62)
      height: width
      source: Qt.resolvedUrl("bar/modules/ito-art/system/menu-uzumaki.png")
      fillMode: Image.PreserveAspectFit
      smooth: true
      mipmap: true
      opacity: button.tooltipHovered ? 1 : 0.8
    }
  }
}

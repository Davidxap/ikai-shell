import QtQuick
import QtQuick.Effects
import Quickshell
import Quickshell.Widgets
import Quickshell.Services.SystemTray
import qs.Ui as Ui
import "../../bar/modules" as Ito
import "../../bar/modules/ItoMotion.js" as Motion

// Ito tray — one sheet icon that opens onto the tray.
//
// Written for IKAI rather than ported. The stock tray runs to 850 lines because it
// also draws its own menus, overflow drawers and category buckets. This one leans on the
// platform: Quickshell resolves every icon into a ready image:// URL, and
// SystemTrayItem.display() opens the application's own menu.
//
// Closed, the tray is a single jar with a count. Hovering it (or clicking it, to pin it
// open) slides the applications out to its left, every one drawn in bone. Left click
// activates, middle click is the secondary action, right click opens the app's menu, the
// wheel is forwarded to the app.
Ui.BarWidget {
  id: root
  moduleName: "ito.tray"

  Ito.ItoConfig {
    id: cfg
    path: Qt.resolvedUrl("../../bar/modules/ito-style.json").toString().replace("file://", "")
  }

  readonly property url art: Qt.resolvedUrl("../../bar/modules/ito-art/")
  readonly property color blood: cfg.blood
  // The standard bar glyph; the same size as the spiral, workspaces and instruments.
  readonly property int glyph: Math.round(root.barSize * cfg.get("iconScale", 0.62))
  // The bar's own icons fill about 74% of their box (see docs/ICON_SPEC.md); an application's icon fills all of it, so
  // at the same box it looks a third bigger. Fitted to the same 74%, they look the same size as everything else.
  readonly property int itemSize: Math.round(glyph * 0.74)
  readonly property bool showValues: cfg.get("showValues", true)
    && cfg.get("valueStyle", "percent") !== "off"
    && cfg.get("content:ito.tray", "both") !== "icon"
  // "text" mode drops the icon and leaves the reading
  readonly property bool showIcon: cfg.get("content:ito.tray", "both") !== "text"

  readonly property int count: {
    var n = 0
    var items = SystemTray.items.values
    for (var i = 0; i < items.length; i++)
      if (items[i].status !== Status.Passive) n++
    return n
  }

  property bool pinned: false
  readonly property bool open: pinned || hover.hovered || closeDelay.running
  // The room the drawer occupies in the bar: taken when it opens, given back once its icons have faded out.
  property bool spaceOpen: false
  onOpenChanged: {
    if (open) { spaceOpen = true; spaceTimer.stop() } else spaceTimer.restart()
  }
  Timer { id: spaceTimer; interval: 260; onTriggered: root.spaceOpen = false }

  // Pinned open by a click, but only for as long as the pointer stays around: a drawer left open behind
  // the pointer looks like the tray is broken, so it lets go a few seconds after the pointer leaves.
  Timer {
    interval: Math.max(500, Math.round(Number(cfg.get("popupSeconds", 3)) * 1000))
    running: root.pinned && !hover.hovered && Number(cfg.get("popupSeconds", 3)) > 0
    onTriggered: root.pinned = false
  }

  // The pointer crosses gaps between the glyphs; a short grace keeps the drawer from flickering.
  Timer { id: closeDelay; interval: 380 }
  HoverHandler {
    id: hover
    onHoveredChanged: if (!hovered) closeDelay.restart()
  }

  implicitWidth: row.implicitWidth
  implicitHeight: root.vertical ? row.implicitHeight : root.barSize

  // On a vertical bar the drawer opens downward from the jar and the applications stack.
  Grid {
    id: row
    columns: root.vertical ? 1 : 9
    horizontalItemAlignment: Grid.AlignHCenter
    verticalItemAlignment: Grid.AlignVCenter
    anchors.verticalCenter: root.vertical ? undefined : parent.verticalCenter
    anchors.horizontalCenter: root.vertical ? parent.horizontalCenter : undefined

    // The drawer takes its room at once and gives it back only after the icons have faded. It used to grow a little at a
    // time, and the island's plate, which follows the widget's width a beat behind, was still narrow while the icons were
    // already showing: they appeared outside the island for two frames, which read as a second island and a flicker.
    Item {
      id: drawer
      clip: true
      height: root.vertical ? (root.spaceOpen ? items.implicitHeight : 0) : root.barSize
      width: root.vertical ? root.barSize : (root.spaceOpen ? items.implicitWidth : 0)

      Behavior on opacity { NumberAnimation { duration: Math.round(Motion.normal * cfg.motionAmp); easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.soft } }
      opacity: root.open ? 1 : 0
      visible: root.spaceOpen || opacity > 0.01          // nothing is drawn (or recoloured) while the drawer is shut

      Grid {
        id: items
        columns: root.vertical ? 1 : 99
        anchors.right: root.vertical ? undefined : parent.right
        anchors.horizontalCenter: root.vertical ? parent.horizontalCenter : undefined
        anchors.bottom: root.vertical ? parent.bottom : undefined
        height: root.vertical ? implicitHeight : parent.height
        verticalItemAlignment: Grid.AlignVCenter
        spacing: 0
        transform: Translate {
          x: root.vertical ? 0 : (root.open ? 0 : 14)
          y: root.vertical ? (root.open ? 0 : -14) : 0
          Behavior on x { NumberAnimation { duration: Math.round(Motion.normal * cfg.motionAmp); easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.decel } }
          Behavior on y { NumberAnimation { duration: Math.round(Motion.normal * cfg.motionAmp); easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.decel } }
        }

        Repeater {
          model: SystemTray.items

          Ui.WidgetButton {
            id: trayButton
            required property var modelData

            readonly property bool passive: modelData.status === Status.Passive
            readonly property bool wantsAttention: modelData.status === Status.NeedsAttention
            readonly property string iconName: String(modelData.icon || "")
            readonly property bool symbolic: iconName.split("?")[0].slice(-9) === "-symbolic"

            // A passive item is hidden by the app; collapse it out of the row.
            visible: !passive
            bar: root.bar
            tooltipText: String(modelData.tooltipTitle || modelData.title || modelData.id || "")
            text: ""
            labelVisible: false
            hasVisualContent: true
            horizontalMargin: 3
            fixedWidth: root.vertical ? root.barSize : root.itemSize + scaledHorizontalMargin * 2
            fixedHeight: root.vertical ? root.itemSize + 10 : root.barSize

            function showMenu() {
              if (!modelData.hasMenu) return
              root.openMenu(modelData, trayButton)
            }

            onPressed: function(button) {
              if (button === Qt.RightButton) showMenu()
              else if (button === Qt.MiddleButton) modelData.secondaryActivate()
              else if (modelData.onlyMenu) showMenu()
              else modelData.activate()
            }

            onWheelMoved: function(delta) { modelData.scroll(delta, false) }

            Ito.ItoHover { target: appGlyph; hovered: trayButton.tooltipHovered; kind: "lift"; amp: cfg.motionAmp; glow: cfg.blood; palette: cfg; light: cfg.light }
            Item {
              id: appGlyph
              anchors.centerIn: parent
              width: root.itemSize
              height: root.itemSize

              IconImage {
                anchors.fill: parent
                source: trayButton.iconName
                // Bone, so the tray follows the palette instead of showing each app's own
                // colours. Colour returns on hover, and stays for an app asking for attention.
                layer.enabled: true
                layer.effect: MultiEffect {
                  colorization: (trayButton.symbolic || !(trayButton.tooltipHovered || trayButton.wantsAttention)) ? 1.0 : 0.0
                  colorizationColor: trayButton.wantsAttention ? cfg.lit : cfg.bone
                  Behavior on colorization { NumberAnimation { duration: 160 } }
                }
              }
            }
          }
        }
      }
    }

    Ui.WidgetButton {
      id: toggle
      bar: root.bar
      tooltipText: root.count === 0 ? "Tray — nothing here" : "Tray — " + root.count
      text: ""
      labelVisible: false
      hasVisualContent: true
      horizontalMargin: 4
      fixedWidth: root.vertical ? root.barSize : content.width + scaledHorizontalMargin * 2
      fixedHeight: root.vertical ? content.height + 10 : root.barSize
      onPressed: function(button) { if (button === Qt.LeftButton) root.pinned = !root.pinned }

      Grid {
        id: content
        anchors.centerIn: parent
        columns: root.vertical ? 1 : 9
        spacing: 3
        horizontalItemAlignment: Grid.AlignHCenter
        verticalItemAlignment: Grid.AlignVCenter

        // Omarchy's own tray control, a single "<" pointing at the drawer, in our ink. It turns over when the drawer is
        // open ("<" becomes ">"), with a little spring, and lights up while it is.
        Item {
          width: root.glyph
          height: root.glyph

          Ito.ItoImage {
            palette: cfg
            anchors.centerIn: parent
            // Discreet: a small "<" is enough to say "there is a drawer here"; it does not need the full icon size.
            width: Math.round(root.glyph * 0.56)
            height: width
            source: root.art + "system/tray-chevron.png"
            fillMode: Image.PreserveAspectFit
            smooth: true
            mipmap: true
            opacity: root.open || toggle.tooltipHovered ? 1 : 0.7
            rotation: root.open ? 180 : 0
            // vertically, the drawer opens downward, so the chevron points down and turns up
            transformOrigin: Item.Center
            Behavior on opacity { NumberAnimation { duration: 180 } }
            Behavior on rotation {
              NumberAnimation { duration: Motion.slow; easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.spring }
            }
          }
        }

        Ito.ItoValue {
          visible: root.showValues && root.count > 0
          barSize: root.barSize
          percent: false
          value: root.count
        }
      }
    }
  }

  // ------------------------------------------------------------------ the application's own menu
  //
  // Right click shows what the application offers by default: Steam's library and settings, Spotify's
  // transport, the open and quit of chat apps, and every submenu. Quickshell can show these as a
  // platform menu only when the shell runs as a QApplication, and this one does not, so the entries are
  // read (QsMenuOpener) and drawn here, in the shell's own ink. A submenu opens in place with a way back.
  property var menuItem: null
  property Item menuAnchor: null
  property bool menuOpen: false
  property var submenuStack: []
  readonly property int submenuDepth: submenuStack.length
  readonly property string submenuTitle: submenuDepth > 0 ? submenuStack[submenuDepth - 1].title : ""
  readonly property var menuEntries: submenuDepth > 0 ? submenuStack[submenuDepth - 1].opener.children
                                                      : menuOpener.children
  // The row under the pointer right after a level changes is not the one that was clicked
  property bool settling: false

  Timer { id: settle; interval: 250; onTriggered: root.settling = false }

  QsMenuOpener {
    id: menuOpener
    menu: root.menuItem ? root.menuItem.menu : null
  }

  Component { id: openerMaker; QsMenuOpener {} }

  function resetMenu() {
    var stack = submenuStack
    submenuStack = []
    for (var i = stack.length - 1; i >= 0; i--) stack[i].opener.destroy()
    settling = false
    menuFlick.contentY = 0
  }

  function openMenu(item, anchorItem) {
    if (!item || !item.menu) return
    resetMenu()
    menuItem = item
    menuAnchor = anchorItem
    menuOpen = true
  }

  function close() {
    menuOpen = false
  }

  function enter(entry, title) {
    var opener = openerMaker.createObject(root, { menu: entry })
    if (!opener) return
    var stack = submenuStack.slice()
    stack.push({ opener: opener, title: title })
    submenuStack = stack
    settling = true
    settle.restart()
    menuFlick.contentY = 0
  }

  function leave() {
    if (submenuStack.length === 0) return
    var stack = submenuStack.slice()
    var top = stack.pop()
    submenuStack = stack
    top.opener.destroy()
    settling = true
    settle.restart()
    menuFlick.contentY = 0
  }

  Ui.PopupCard {
    id: menuPopup
    anchorItem: root.menuAnchor || root
    owner: root
    bar: root.bar
    open: root.menuOpen
    // let the card finish fading before the level is reset, or the parent menu flashes
    onVisibleChanged: if (!visible) root.resetMenu()
    padding: 8
    borderColor: Qt.rgba(cfg.blood.r, cfg.blood.g, cfg.blood.b, 0.5)
    contentWidth: menuPopup.fittedContentWidth(248)
    contentHeight: menuPopup.fittedContentHeight(
      (backRow.visible ? backRow.height : 0) + menuColumn.implicitHeight, 460)

    Column {
      anchors.fill: parent
      spacing: 0

      // the way back out of a submenu, pinned above the rows
      Item {
        id: backRow
        visible: root.submenuDepth > 0
        width: parent.width
        height: visible ? 34 : 0

        Rectangle {
          anchors.fill: parent
          anchors.bottomMargin: 4
          radius: 8
          color: backHover.containsMouse ? Qt.rgba(cfg.blood.r, cfg.blood.g, cfg.blood.b, 0.22) : "transparent"
          Behavior on color { ColorAnimation { duration: 120 } }
        }

        Text {
          x: 8
          anchors.verticalCenter: parent.verticalCenter
          anchors.verticalCenterOffset: -2
          text: "\u2039  " + root.submenuTitle
          textFormat: Text.PlainText
          width: parent.width - 16
          elide: Text.ElideRight
          color: cfg.bone
          font.family: "Noto Serif"
          font.pixelSize: 13
        }

        MouseArea {
          id: backHover
          anchors.fill: parent
          hoverEnabled: true
          onClicked: if (!root.settling) root.leave()
        }
      }

      Flickable {
        id: menuFlick
        width: parent.width
        height: parent.height - (backRow.visible ? backRow.height : 0)
        contentWidth: width
        contentHeight: menuColumn.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        flickableDirection: Flickable.VerticalFlick
        interactive: contentHeight > height

        Column {
          id: menuColumn
          width: menuFlick.width

          Repeater {
            model: root.menuEntries

            delegate: Item {
              id: entry
              required property var modelData
              required property int index

              readonly property bool sep: modelData.isSeparator
              readonly property string label: String(modelData.text || "")
              // At the top level many apps put their own name first, as a submenu that repeats the whole
              // menu; it adds nothing here.
              readonly property bool repeatsApp: root.submenuDepth === 0 && index === 0 && modelData.hasChildren
                && label.toLowerCase() === String(root.menuItem ? (root.menuItem.title || root.menuItem.id) : "").toLowerCase()
              readonly property bool leadingRule: root.submenuDepth === 0 && sep && index <= 1

              visible: !repeatsApp && !leadingRule
              width: menuColumn.width
              implicitHeight: (repeatsApp || leadingRule) ? 0 : (sep ? 11 : 32)
              opacity: modelData.enabled ? 1 : 0.4

              Rectangle {
                visible: entry.sep
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.leftMargin: 10
                anchors.rightMargin: 10
                anchors.verticalCenter: parent.verticalCenter
                height: 1
                color: cfg.bone
                opacity: 0.25
              }

              Rectangle {
                visible: !entry.sep
                anchors.fill: parent
                radius: 8
                color: rowHover.containsMouse && entry.modelData.enabled
                  ? Qt.rgba(cfg.blood.r, cfg.blood.g, cfg.blood.b, 0.24) : "transparent"
                Behavior on color { ColorAnimation { duration: 120 } }
              }

              // a tick or a dot for entries that can be on and off
              Text {
                visible: !entry.sep && entry.modelData.buttonType !== QsMenuButtonType.None
                x: 6
                width: 18
                anchors.verticalCenter: parent.verticalCenter
                horizontalAlignment: Text.AlignHCenter
                text: entry.modelData.checkState === Qt.Checked
                  ? (entry.modelData.buttonType === QsMenuButtonType.RadioButton ? "\u25cf" : "\u2713") : ""
                color: cfg.lit
                font.pixelSize: 12
              }

              Image {
                id: entryIcon
                visible: !entry.sep && String(entry.modelData.icon || "") !== ""
                x: 26
                anchors.verticalCenter: parent.verticalCenter
                width: 16
                height: 16
                sourceSize: Qt.size(32, 32)
                source: String(entry.modelData.icon || "")
                fillMode: Image.PreserveAspectFit
              }

              Text {
                visible: !entry.sep
                anchors.verticalCenter: parent.verticalCenter
                x: entryIcon.visible ? 48 : 28
                width: parent.width - x - (entry.modelData.hasChildren ? 26 : 10)
                text: entry.label.replace(/_/g, "")
                textFormat: Text.PlainText
                elide: Text.ElideRight
                color: cfg.bone
                font.family: "Noto Serif"
                font.pixelSize: 13
              }

              Text {
                visible: !entry.sep && entry.modelData.hasChildren
                anchors.right: parent.right
                anchors.rightMargin: 10
                anchors.verticalCenter: parent.verticalCenter
                text: "\u203a"
                color: cfg.bone
                opacity: 0.7
                font.pixelSize: 16
              }

              MouseArea {
                id: rowHover
                anchors.fill: parent
                enabled: !entry.sep && entry.modelData.enabled
                hoverEnabled: true
                onClicked: {
                  if (root.settling) return
                  if (entry.modelData.hasChildren) {
                    root.enter(entry.modelData, entry.label.replace(/_/g, ""))
                  } else {
                    entry.modelData.triggered()
                    root.close()
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

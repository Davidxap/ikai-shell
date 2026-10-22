pragma ComponentBehavior: Bound

import QtQuick
import qs.Commons as Commons
import "../../core" as Core
import "../../core/RunGeometry.js" as RunGeometry
import "../../core/ResponsiveLayout.js" as ResponsiveLayout
import "." as Shibumi

Item {
  id: root

  required property var bar
  property var layoutSession: null
  property string screenName: ""
  readonly property int responsiveStage: contentLoader.item
    && "narrowStage" in contentLoader.item
      ? Number(contentLoader.item.narrowStage) || 0 : 0
  readonly property var responsiveProbe: contentLoader.item
    && "responsiveProbe" in contentLoader.item
      ? contentLoader.item.responsiveProbe : ({})
  readonly property var reactorFacade: bar && bar.shell
    && typeof bar.shell.serviceFor === "function"
    ? bar.shell.serviceFor("hancore.shibumi.reactor") : null
  readonly property int reactorMode: reactorFacade
    ? Number(reactorFacade.mode || 0) : 0
  readonly property bool layoutProtected: bar.layoutController
    && "activeLayoutProtected" in bar.layoutController
    && bar.layoutController.activeLayoutProtected === true
  readonly property bool layoutChangesAllowed:
    layoutSession && layoutSession.editing || !layoutProtected
  focus: layoutSession && layoutSession.editing

  Loader {
    id: contentLoader
    anchors.fill: parent
    sourceComponent: root.bar.vertical ? verticalContent : horizontalContent
  }

  MouseArea {
    anchors.fill: parent
    acceptedButtons: Qt.LeftButton
    z: -10

    onClicked: {
      if (root.layoutSession && root.layoutSession.editing)
        root.layoutSession.setEditing(false)
    }
    onDoubleClicked: {
      if (root.layoutSession) root.layoutSession.setEditing(true)
    }
  }

  Keys.onEscapePressed: {
    if (root.layoutSession) root.layoutSession.setEditing(false)
  }

  Connections {
    target: root.layoutSession

    function onEditingChanged() {
      if (root.layoutSession && root.layoutSession.editing)
        root.forceActiveFocus()
    }
  }

  Component {
    id: horizontalContent

    Item {
      id: horizontalSurface

      // Tell the drag session where the plate is, so an empty part of it can be dropped on.
      Binding {
        target: root.layoutSession
        property: "shellLeft"
        value: horizontalSurface.mapToItem(null, runChrome.x, 0).x
        when: root.layoutSession !== null
      }
      Binding {
        target: root.layoutSession
        property: "shellRight"
        value: horizontalSurface.mapToItem(null, runChrome.x + runChrome.width, 0).x
        when: root.layoutSession !== null
      }
      Binding {
        target: root.layoutSession
        property: "flowShell"
        value: horizontalSurface.compactShell
        when: root.layoutSession !== null
      }
      Binding {
        target: root.layoutSession
        property: "vertical"
        value: false
        when: root.layoutSession !== null
      }

      // Where the dragged widget will go when it is dropped between others or in an empty part of the bar.
      Rectangle {
        visible: root.layoutSession !== null && root.layoutSession.active && root.layoutSession.insertRegion !== ""
        x: horizontalSurface.mapFromItem(null, root.layoutSession ? root.layoutSession.insertX : 0, 0).x - 1.5
        y: runChrome.y + 4
        width: 3
        height: Math.max(0, runChrome.height - 8)
        radius: 1.5
        color: root.bar.urgent
        z: 90
        Behavior on x { NumberAnimation { duration: 90; easing.type: Easing.OutCubic } }
      }

      readonly property int frameInset: root.bar.visualTokens.islandInsetX
      readonly property int contentInset:
        root.bar.visualTokens.islandContentInsetX !== undefined
          ? root.bar.visualTokens.islandContentInsetX : Commons.Style.space(4)
      readonly property int cutPadding: Commons.Style.space(4)
      readonly property int centerGap: Commons.Style.space(12)
      readonly property string shellStyle:
        ["shibumi", "full", "fit", "dock", "notch"]
          .indexOf(String(root.bar.visualTokens.shellStyle || "")) >= 0
          ? String(root.bar.visualTokens.shellStyle) : "shibumi"
      readonly property bool shibumiShell: shellStyle === "shibumi"
      // A style can ask for the dock to float clear of the screen edge, as the islands do.
      readonly property bool floatingShell: shellStyle === "dock"
        && root.bar.visualTokens.floatingDock === true
      readonly property bool compactShell:
        ["fit", "dock", "notch"].indexOf(shellStyle) >= 0
      readonly property real leftSideWidth: leftGroups.budgetWidthForStage(0) + leftExtras.width
        + leftGroups.editingWidthOverhead
      readonly property real centerSideWidth: centerGroups.budgetWidthForStage(0) + centerExtras.width
        + centerGroups.editingWidthOverhead
      readonly property real rightSideWidth: rightExtras.width + rightGroups.budgetWidthForStage(0)
        + rightGroups.editingWidthOverhead
      readonly property real wingWidth: shellStyle === "notch"
        ? 2 * root.bar.visualTokens.shellWingWidth : 0
      // A content-sized shell is as wide as what is in it. With a centre anchor (the seal) it is made the same
      // width on both sides of the anchor, so the seal stays exactly in the middle of the plate and of the
      // screen, and the shorter side is simply left with some room.
      // Only when there is something on both sides to balance: a bar that is all in the middle (Compact, Dock, Zen)
      // is simply as wide as what is in it and centred as a whole, like Shibumi's, and does not grow empty room
      // on the shorter side of the seal to keep it exactly centred.
      readonly property bool anchorCentred: anchorOffset >= 0
        && (!compactShell || (leftSideWidth > 0 && rightSideWidth > 0))
      readonly property real naturalShellWidth: anchorCentred
        ? 2 * Math.max(leftSideWidth + centerGap + anchorOffset,
                       (centerSideWidth - anchorOffset) + centerGap + rightSideWidth)
          + 2 * contentInset + wingWidth
        : leftSideWidth + centerSideWidth + rightSideWidth + 2 * centerGap + 2 * contentInset + wingWidth
      readonly property real shellWidth: shibumiShell
        ? Math.max(0, width - 2 * frameInset)
        : compactShell ? Math.min(width - 2 * frameInset,
            Math.max(Commons.Style.space(80), naturalShellWidth))
        : width
      // Fit/Dock/Notch are content-sized. Feeding their current shell width
      // back into responsive staging lets a transient provider width compact
      // the shell and hide G9/G10 even though the monitor still has room.
      // Stage against the output capacity; shellWidth remains presentation.
      readonly property real responsiveCapacity: compactShell
        ? Math.max(0, width - 2 * frameInset) : shellWidth
      readonly property real shellX: shibumiShell ? frameInset
        : Math.round((width - shellWidth) / 2)
      readonly property real shellContentInset: contentInset
        + (shellStyle === "notch"
          ? root.bar.visualTokens.shellWingWidth : 0)
      readonly property real measuredCenterSpan: Math.max(0,
        rightRegion.x - (leftRegion.x + leftRegion.width) - 2 * centerGap)
      readonly property real centerAvailableWidth:
        ResponsiveLayout.centerAvailableWidth(compactShell, width,
          frameInset, shellContentInset, leftRegion.width, rightRegion.width,
          centerGap, measuredCenterSpan, centerExtras.width)
      property int narrowStage: 0
      readonly property real sideMargin: shellX + shellContentInset
      readonly property real responsiveSideInset: shellContentInset
      readonly property real centerFloorWidth: Math.max(80,
        Number(centerGroups.minimumResponsiveWidth) || 0)
      readonly property var narrowCandidateWidths: [0, 1, 2, 3].map(function(stage) {
        return leftGroups.budgetWidthForStage(stage)
          + rightGroups.budgetWidthForStage(stage)
          + horizontalSurface.centerFloorWidth
          + leftExtras.width + centerExtras.width + rightExtras.width
          + 2 * horizontalSurface.centerGap
          + 2 * horizontalSurface.responsiveSideInset
      })
      readonly property var responsiveProbe: ({
        shellWidth: Math.round(shellWidth),
        capacity: Math.round(responsiveCapacity),
        stage: narrowStage,
        candidates: narrowCandidateWidths.map(function(value) {
          return Math.round(Number(value) || 0)
        }),
        left: leftGroups.stageBudgetWidths,
        right: rightGroups.stageBudgetWidths,
        extras: [leftExtras.width, centerExtras.width, rightExtras.width],
        centerFloor: Math.round(centerFloorWidth),
        centerAvailable: Math.round(centerAvailableWidth)
      })
      // The centre anchor (the seal) sits exactly in the middle of the bar, and whatever else is in the centre
      // section hangs off it to one side or both.
      property real anchorOffset: -1
      function findSlot(item, id) {
        var kids = item.children
        for (var i = 0; i < kids.length; i++) {
          var kid = kids[i]
          if (kid.moduleName !== undefined && String(kid.moduleName) === id) return kid
          var deeper = findSlot(kid, id)
          if (deeper) return deeper
        }
        return null
      }
      function refreshAnchor() {
        var id = String(root.bar.centerAnchor || "")
        var slot = id !== "" ? findSlot(centerRegion, id) : null
        anchorOffset = slot && slot.width > 0 ? centerRegion.mapFromItem(slot, slot.width / 2, 0).x : -1
      }
      Timer { id: anchorSettle; interval: 60; running: true; onTriggered: horizontalSurface.refreshAnchor() }
      Connections {
        target: centerRegion
        function onWidthChanged() { anchorSettle.restart() }
        function onChildrenChanged() { anchorSettle.restart() }
      }
      Connections {
        target: root.bar
        function onCenterAnchorChanged() { anchorSettle.restart() }
      }
      readonly property real idealCenterX: anchorCentred
        ? Math.round(width / 2 - anchorOffset)
        : Math.round((width - centerRegion.width) / 2)
      readonly property real minCenterX: Math.round(leftRegion.x + leftRegion.width + centerGap)
      readonly property real maxCenterX: Math.round(rightRegion.x - centerGap - centerRegion.width)
      readonly property real centerTargetX: maxCenterX < minCenterX
        // At an exact fit, pixel rounding can make the two legal limits cross
        // by one pixel. Falling back to the screen center then overlaps the
        // asymmetric right run (notably G8 with G9/MPRIS). Split the tiny
        // deficit between both sides instead and preserve the visible gaps.
        ? Math.round((minCenterX + maxCenterX) / 2)
        : Math.max(minCenterX, Math.min(idealCenterX, maxCenterX))
      readonly property var runs: {
        void(leftGroups.groupGeometry)
        void(rightGroups.groupGeometry)
        void(leftRegion.x)
        void(leftRegion.width)
        void(centerRegion.x)
        void(centerRegion.width)
        void(rightRegion.x)
        void(rightRegion.width)
        void(runChrome.width)
        void(root.bar.layoutController.splits)
        return RunGeometry.compute({
          width: runChrome.width,
          padding: cutPadding,
          sections: [
            {
              x: leftRegion.x + leftGroups.x - runChrome.x,
              groups: leftGroups.groupGeometry,
              splits: root.bar.layoutController.splits.left
            },
            {
              x: rightRegion.x + rightGroups.x - runChrome.x,
              groups: rightGroups.groupGeometry,
              splits: root.bar.layoutController.splits.right
            }
          ],
          left: leftRegion.width > 0.5 ? {
            x: leftRegion.x - runChrome.x,
            width: leftRegion.width
          } : null,
          center: {
            x: centerRegion.x - runChrome.x,
            width: centerRegion.width
          },
          right: rightRegion.width > 0.5 ? {
            x: rightRegion.x - runChrome.x,
            width: rightRegion.width
          } : null,
          boundaries: root.bar.layoutController.splits.boundaries
        })
      }

      function toggleBoundary(index) {
        if (!root.layoutChangesAllowed) return false
        return root.bar.layoutController.toggleSplit(
          "boundaries", index,
          root.layoutSession && root.layoutSession.editing)
      }

      function updateNarrowStage() {
        narrowStage = ResponsiveLayout.nextNarrowStage(narrowStage,
          responsiveCapacity, narrowCandidateWidths)
      }

      function scheduleNarrowUpdate() { narrowTimer.restart() }

      function resetResponsiveProbe() {
        // Provider swaps and widget enable/disable operations are transient
        // width changes. If the bar entered the hysteresis band while one
        // side was rebuilding, it could otherwise keep G9/G10 hidden after
        // the original layout had returned. Probe the complete stage once
        // the configuration settles; updateNarrowStage immediately narrows
        // it again when the full composition genuinely does not fit.
        narrowStage = 0
        scheduleNarrowUpdate()
      }

      onWidthChanged: scheduleNarrowUpdate()
      onNarrowCandidateWidthsChanged: scheduleNarrowUpdate()
      Component.onCompleted: scheduleNarrowUpdate()

      Timer {
        id: narrowTimer
        interval: 80
        onTriggered: horizontalSurface.updateNarrowStage()
      }

      Timer {
        id: responsiveResetTimer
        interval: 220
        onTriggered: horizontalSurface.resetResponsiveProbe()
      }

      Connections {
        target: root.bar && root.bar.shell
          && typeof root.bar.shell.serviceFor === "function"
          ? root.bar.shell.serviceFor("ito.state") : null
        ignoreUnknownSignals: true
        function onRevisionChanged() { responsiveResetTimer.restart() }
      }

      Connections {
        target: root.bar
        ignoreUnknownSignals: true
        function onLayoutConfigChanged() { responsiveResetTimer.restart() }
      }

      Shibumi.RunChrome {
        id: runChrome

        bar: root.bar
        screenName: root.screenName
        screenX: horizontalSurface.shellX
        runs: horizontalSurface.runs
        // V1 and every V2 shell form are intentionally opaque. The saved
        // transparency preference belongs only to the stock Omarchy bar.
        visible: true
        x: horizontalSurface.shellX
        width: Math.max(0, horizontalSurface.shellWidth)
        height: horizontalSurface.shibumiShell || horizontalSurface.floatingShell
          ? Math.min(parent.height, root.bar.visualTokens.islandHeight)
          : parent.height
        y: horizontalSurface.shibumiShell || horizontalSurface.floatingShell
          ? (root.bar.position === "bottom" ? 0
            : root.bar.visualTokens.islandOffsetY)
          : (root.bar.position === "bottom"
            ? parent.height - height : 0)
        z: 0
      }

      Rectangle {
        x: runChrome.x - Commons.Style.space(3)
        y: runChrome.y - Commons.Style.space(3)
        width: runChrome.width + Commons.Style.space(6)
        height: runChrome.height + Commons.Style.space(6)
        visible: root.layoutSession && root.layoutSession.editing
        color: "transparent"
        border.width: 1
        border.color: root.bar.urgent
        radius: root.bar.layoutController.v2Mode
          ? 0 : root.bar.visualTokens.islandRadius + Commons.Style.space(2)
        z: 80

        SequentialAnimation on opacity {
          running: root.layoutSession && root.layoutSession.editing
          loops: Animation.Infinite
          NumberAnimation {
            from: 1
            to: 0.45
            duration: 900
            easing.type: Easing.InOutSine
          }
          NumberAnimation {
            from: 0.45
            to: 1
            duration: 900
            easing.type: Easing.InOutSine
          }
        }
      }

      Loader {
        id: gapEffectsLoader

        active: !root.bar.barHidden
          && root.bar.layoutController.v2Mode !== true
          && root.reactorMode >= 1 && root.reactorMode <= 8
          && horizontalSurface.runs.length > 1
        x: runChrome.x
        y: runChrome.y
        width: runChrome.width
        height: runChrome.height
        z: 5
        sourceComponent: !active ? null
          : root.reactorMode >= 7 ? reactorEventComponent
          : gapEffectsComponent

        Component {
          id: gapEffectsComponent

          Shibumi.GapEffectsLayer {
            bar: root.bar
            mode: root.reactorMode
            runs: horizontalSurface.runs
          }
        }

        Component {
          id: reactorEventComponent

          Shibumi.ReactorEventLayer {
            bar: root.bar
            service: root.reactorFacade
            runs: horizontalSurface.runs
            screenName: root.screenName
          }
        }
      }

      Row {
        id: leftRegion

        anchors.left: parent.left
        anchors.leftMargin: horizontalSurface.shellX
          + horizontalSurface.shellContentInset
        anchors.verticalCenter: runChrome.verticalCenter
        z: 10

        Shibumi.GroupSection {
          id: leftGroups
          // Provider-owned extras may follow the full bar height while the
          // grouped V1 row remains 32px. Center both siblings independently
          // so either height cannot displace the other from the island axis.
          anchors.verticalCenter: parent.verticalCenter
          bar: root.bar
          region: "left"
          screenName: root.screenName
          layoutSession: root.layoutSession
          visibilityStage: horizontalSurface.narrowStage
        }

        Core.BarSection {
          id: leftExtras
          anchors.verticalCenter: parent.verticalCenter
          bar: root.bar
          region: "left-extra"
          screenName: root.screenName
          entries: root.bar.unassignedLayoutEntries("left")
        }
      }

      Row {
        id: centerRegion

        anchors.verticalCenter: runChrome.verticalCenter
        x: horizontalSurface.centerTargetX
        z: 10

        Behavior on x {
          NumberAnimation { duration: 120; easing.type: Easing.OutCubic }
        }

        Shibumi.GroupSection {
          id: centerGroups
          anchors.verticalCenter: parent.verticalCenter
          bar: root.bar
          region: "center"
          screenName: root.screenName
          layoutSession: root.layoutSession
          visibilityStage: horizontalSurface.narrowStage
          // The widget API uses zero for an unconstrained width.
          availableWidth: Math.max(1, horizontalSurface.centerAvailableWidth)
        }

        Core.BarSection {
          id: centerExtras
          anchors.verticalCenter: parent.verticalCenter
          bar: root.bar
          region: "center-extra"
          screenName: root.screenName
          entries: root.bar.unassignedLayoutEntries("center")
        }
      }

      Row {
        id: rightRegion

        anchors.right: parent.right
        anchors.rightMargin: horizontalSurface.shellX
          + horizontalSurface.shellContentInset
        anchors.verticalCenter: runChrome.verticalCenter
        z: 10

        Core.BarSection {
          id: rightExtras
          anchors.verticalCenter: parent.verticalCenter
          bar: root.bar
          region: "right-extra"
          screenName: root.screenName
          entries: root.bar.unassignedLayoutEntries("right")
        }

        Shibumi.GroupSection {
          id: rightGroups
          anchors.verticalCenter: parent.verticalCenter
          bar: root.bar
          region: "right"
          screenName: root.screenName
          layoutSession: root.layoutSession
          visibilityStage: horizontalSurface.narrowStage
        }
      }

      component BoundaryMarker: Item {
        id: boundaryMarker

        property real boundaryX: 0
        property int boundaryIndex: -1
        readonly property bool splitOn: boundaryIndex >= 0
          && root.bar.layoutController.splitEnabled("boundaries", boundaryIndex)

        visible: boundaryX > 0 && boundaryIndex >= 0
        x: boundaryX - width / 2
        width: 14
        height: parent.height
        z: 40

        Rectangle {
          anchors.centerIn: parent
          width: 1
          height: Math.min(parent.height - 8, 14)
          visible: boundaryMarker.splitOn
            && !horizontalSurface.shibumiShell
          color: boundaryMouse.containsMouse
            ? root.bar.urgent
            : root.bar.visualTokens.separator !== undefined
              ? root.bar.visualTokens.separator : root.bar.visualTokens.sumi
          opacity: 0.62

          Behavior on color { ColorAnimation { duration: 120 } }
        }

        Text {
          anchors.centerIn: parent
          visible: (root.bar.layoutController.v2Mode !== true
            || !boundaryMarker.splitOn)
            && root.bar.visualTokens.plainEditing !== true
          text: root.bar.layoutController.v2Mode !== true
              && boundaryMarker.splitOn ? "│" : "•"
          color: boundaryMouse.containsMouse
              || (root.bar.layoutController.v2Mode !== true
                && boundaryMarker.splitOn)
            ? root.bar.urgent : root.bar.visualTokens.sumi
          font.pixelSize: 10
          font.family: root.bar.fontFamily
          opacity: root.layoutSession && root.layoutSession.editing
            ? boundaryMouse.containsMouse ? 0.95 : 0.34
            : boundaryMouse.containsMouse ? 0.9 : 0

          Behavior on opacity { NumberAnimation { duration: 120 } }
        }

        MouseArea {
          id: boundaryMouse
          anchors.fill: parent
          enabled: root.layoutChangesAllowed
            && root.bar.visualTokens.plainEditing !== true
          hoverEnabled: true
          acceptedButtons: Qt.LeftButton
          cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
          onClicked: horizontalSurface.toggleBoundary(boundaryMarker.boundaryIndex)
        }
      }

      BoundaryMarker {
        boundaryIndex: 0
        boundaryX: leftRegion.width > 0.5 && centerRegion.width > 0.5
          ? leftRegion.x + leftRegion.width + Commons.Style.space(9) : 0
      }

      BoundaryMarker {
        boundaryIndex: 1
        boundaryX: centerRegion.width > 0.5 && rightRegion.width > 0.5
          ? rightRegion.x - Commons.Style.space(9) : 0
      }
    }
  }

  Component {
    id: verticalContent

    Item {
      id: verticalSurface

      readonly property bool atLeft: root.bar.position === "left"
      readonly property int thick: root.bar.barSize
      readonly property string shellStyle:
        ["shibumi", "full", "fit", "dock", "notch"]
          .indexOf(String(root.bar.visualTokens.shellStyle || "")) >= 0
          ? String(root.bar.visualTokens.shellStyle) : "shibumi"
      readonly property bool shibumiShell: shellStyle === "shibumi"
      readonly property bool compactShell: ["fit", "dock", "notch"].indexOf(shellStyle) >= 0
      readonly property bool floatingShell: shellStyle === "dock" && root.bar.visualTokens.floatingDock === true
      readonly property int frameInset: root.bar.visualTokens.islandInsetX
      readonly property int contentInset: root.bar.visualTokens.islandContentInsetX !== undefined
        ? root.bar.visualTokens.islandContentInsetX : Commons.Style.space(4)
      readonly property int flowGap: Commons.Style.space(10)
      readonly property real wing: shellStyle === "notch" ? 2 * root.bar.visualTokens.shellWingWidth : 0

      // The three columns, top to bottom: what is in them decides how long a content-sized shell is.
      readonly property real naturalLength: leftColumn.height + centerColumn.height + rightColumn.height
        + (leftColumn.height > 0 && centerColumn.height > 0 ? flowGap : 0)
        + (rightColumn.height > 0 && (leftColumn.height > 0 || centerColumn.height > 0) ? flowGap : 0)
        + 2 * contentInset + wing
      // Full-length forms span the edge; content-sized ones (Fit, Dock, Notch) are as long as what is in them, centred.
      readonly property real shellLength: compactShell
        ? Math.min(height - 2 * frameInset, Math.max(Commons.Style.space(80), naturalLength))
        : Math.max(0, height - 2 * frameInset)
      readonly property real shellStart: compactShell ? Math.round((height - shellLength) / 2) : frameInset

      // Tell the drag session where the plate is (top/bottom this time, since the bar runs top-to-bottom), so an
      // empty part of it can be dropped on -- the same three bindings horizontalSurface makes, along the other axis.
      Binding {
        target: root.layoutSession
        property: "shellLeft"
        value: verticalSurface.mapToItem(null, 0, verticalSurface.shellStart).y
        when: root.layoutSession !== null
      }
      Binding {
        target: root.layoutSession
        property: "shellRight"
        value: verticalSurface.mapToItem(null, 0, verticalSurface.shellStart + verticalSurface.shellLength).y
        when: root.layoutSession !== null
      }
      Binding {
        target: root.layoutSession
        property: "flowShell"
        value: verticalSurface.compactShell
        when: root.layoutSession !== null
      }
      Binding {
        target: root.layoutSession
        property: "vertical"
        value: true
        when: root.layoutSession !== null
      }

      // Where the dragged widget will go, drawn across the bar's thickness instead of along its length.
      Rectangle {
        visible: root.layoutSession !== null && root.layoutSession.active && root.layoutSession.insertRegion !== ""
        y: verticalSurface.mapFromItem(null, 0, root.layoutSession ? root.layoutSession.insertX : 0).y - 1.5
        x: 4
        width: Math.max(0, verticalSurface.thick - 8)
        height: 3
        radius: 1.5
        color: root.bar.urgent
        z: 90
        Behavior on y { NumberAnimation { duration: 90; easing.type: Easing.OutCubic } }
      }

      // The shape itself: the horizontal bar's own chrome, turned on its side, so every form (Islands, Full, Fit,
      // Dock, Notch) is drawn the same way on the left and the right as along the top.
      Item {
        id: turned
        width: verticalSurface.shellLength
        height: verticalSurface.thick
        transformOrigin: Item.TopLeft
        rotation: verticalSurface.atLeft ? -90 : 90
        x: verticalSurface.atLeft ? 0 : verticalSurface.thick
        y: verticalSurface.atLeft ? verticalSurface.shellStart + verticalSurface.shellLength : verticalSurface.shellStart
        z: 0

        Shibumi.RunChrome {
          id: sideChrome
          bar: root.bar
          screenName: root.screenName
          screenX: 0
          runs: [{ "x": 0, "width": turned.width }]
          x: 0
          width: turned.width
          height: verticalSurface.shibumiShell || verticalSurface.floatingShell
            ? Math.min(turned.height, root.bar.visualTokens.islandHeight) : turned.height
          y: verticalSurface.shibumiShell || verticalSurface.floatingShell ? root.bar.visualTokens.islandOffsetY : 0
        }
      }

      // The centre anchor (the seal) sits exactly in the middle of the bar's length, as on a horizontal bar.
      property real anchorOffset: -1
      function findSlot(item, id) {
        var kids = item.children
        for (var i = 0; i < kids.length; i++) {
          var kid = kids[i]
          if (kid.moduleName !== undefined && String(kid.moduleName) === id) return kid
          var deeper = findSlot(kid, id)
          if (deeper) return deeper
        }
        return null
      }
      function refreshAnchor() {
        var id = String(root.bar.centerAnchor || "")
        var slot = id !== "" ? findSlot(centerColumn, id) : null
        anchorOffset = slot && slot.height > 0 ? centerColumn.mapFromItem(slot, 0, slot.height / 2).y : -1
      }
      Timer { id: verticalSettle; interval: 60; running: true; onTriggered: verticalSurface.refreshAnchor() }
      Connections {
        target: centerColumn
        function onHeightChanged() { verticalSettle.restart() }
        function onChildrenChanged() { verticalSettle.restart() }
      }

      // Every column is as wide as the bar is thick, and its widgets are centred in that width.
      Column {
        id: leftColumn
        x: Math.round((verticalSurface.thick - width) / 2)
        y: verticalSurface.shellStart + verticalSurface.contentInset + (verticalSurface.wing / 2)
        z: 10

        Shibumi.GroupSection {
          bar: root.bar
          region: "left"
          screenName: root.screenName
          layoutSession: root.layoutSession
        }

        Core.BarSection {
          bar: root.bar
          region: "left-extra"
          screenName: root.screenName
          entries: root.bar.unassignedLayoutEntries("left")
        }
      }

      Column {
        id: centerColumn
        x: Math.round((verticalSurface.thick - width) / 2)
        z: 10
        y: {
          if (verticalSurface.compactShell) {
            // one flow: left, then centre, then right, one after another
            return Math.round(leftColumn.y + leftColumn.height + (leftColumn.height > 0 ? verticalSurface.flowGap : 0))
          }
          // full length: centred on the anchor when there is one, but never over the left or right columns
          var ideal = verticalSurface.anchorOffset >= 0
            ? verticalSurface.height / 2 - verticalSurface.anchorOffset
            : (verticalSurface.height - height) / 2
          var low = leftColumn.y + leftColumn.height + Commons.Style.space(12)
          var high = rightColumn.y - Commons.Style.space(12) - height
          return Math.round(high < low ? (low + high) / 2 : Math.max(low, Math.min(ideal, high)))
        }

        Shibumi.GroupSection {
          id: centerGroups
          bar: root.bar
          region: "center"
          screenName: root.screenName
          layoutSession: root.layoutSession
        }

        Core.BarSection {
          bar: root.bar
          region: "center-extra"
          screenName: root.screenName
          entries: root.bar.unassignedLayoutEntries("center")
        }
      }

      Column {
        id: rightColumn
        x: Math.round((verticalSurface.thick - width) / 2)
        z: 10
        y: verticalSurface.compactShell
          ? Math.round(centerColumn.y + centerColumn.height + ((centerColumn.height > 0 || leftColumn.height > 0) ? verticalSurface.flowGap : 0))
          : verticalSurface.shellStart + verticalSurface.shellLength - verticalSurface.contentInset - height - (verticalSurface.wing / 2)

        Core.BarSection {
          bar: root.bar
          region: "right-extra"
          screenName: root.screenName
          entries: root.bar.unassignedLayoutEntries("right")
        }

        Shibumi.GroupSection {
          bar: root.bar
          region: "right"
          screenName: root.screenName
          layoutSession: root.layoutSession
        }
      }
    }
  }
}

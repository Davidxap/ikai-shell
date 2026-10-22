pragma ComponentBehavior: Bound

import QtQuick

Item {
  id: root

  property var layoutController: null
  property string screenName: ""
  property bool editing: false
  property bool active: false
  property bool returning: false
  property string sourceGroupId: ""
  property string targetGroupId: ""
  property string targetRegion: ""
  property int targetIndex: -1
  property Item targetItem: null
  property Item sourceItem: null
  property var sourceWindow: null
  property var targets: []
  // Dropping "between" widgets or into an empty part of the bar (not on top of one): the region and slot the widget
  // would be inserted at, and where the marker that shows it stands (window coordinates).
  property string insertRegion: ""
  property int insertIndex: -1
  property real insertX: 0
  // Where the bar's plate is, so an empty part of it can be told from outside it, and whether its regions flow one
  // into the next (a content-sized shell) or sit at the two ends and the middle (a full-width one).
  property real shellLeft: 0
  property real shellRight: 0
  property bool flowShell: false
  // On a vertical bar the axis a drag travels along is Y, not X: shellLeft/shellRight then hold the top/bottom of
  // the plate, and every "along the bar" comparison below reads Y instead of X.
  property bool vertical: false
  property real ghostX: 0
  property real ghostY: 0
  property real ghostWidth: 0
  property real ghostHeight: 0
  property real ghostHomeX: 0
  property real ghostHomeY: 0
  property url ghostImageUrl: ""
  // The image-provider URL is valid only while its grab result is retained.
  property var ghostImageGrab: null
  property int captureGeneration: 0

  visible: false
  width: 0
  height: 0

  onSourceItemChanged: {
    if (!sourceItem && (active || returning)) cancel()
  }
  Connections {
    target: root.sourceItem ? root.sourceItem.Window : null
    function onWindowChanged() {
      if (root.active || root.returning) root.cancel()
    }
  }
  Connections {
    target: root.sourceWindow
    function onVisibleChanged() {
      if (target && !target.visible) root.cancel()
    }
    function onWidthChanged() {
      if (target && !root.positiveSize(target)) root.cancel()
    }
    function onHeightChanged() {
      if (target && !root.positiveSize(target)) root.cancel()
    }
  }

  function groupExists(groupId) {
    return layoutController
      && typeof layoutController.groupLocation === "function"
      && layoutController.groupLocation(groupId) !== null
  }

  function setEditing(value) {
    const next = value === true
    if (editing === next) return false
    editing = next
    if (!editing) cancel()
    return true
  }

  function toggleEditing() {
    return setEditing(!editing)
  }

  function registerTarget(groupId, item) {
    const group = String(groupId || "")
    if (!groupExists(group) || !item) return false
    const next = []
    for (let i = 0; i < targets.length; i++) {
      const current = targets[i]
      if (current && current.item !== item && current.groupId !== group)
        next.push(current)
    }
    next.push({ groupId: group, item: item })
    targets = next
    return true
  }

  function registerSlotTarget(region, index, groupId, item) {
    const targetRegionValue = String(region || "")
    const targetIndexValue = Math.floor(Number(index))
    if (!layoutController
        || ["left", "center", "right"].indexOf(targetRegionValue) < 0
        || !Number.isFinite(targetIndexValue) || targetIndexValue < 0
        || !item) return false
    const next = []
    for (let i = 0; i < targets.length; i++) {
      const current = targets[i]
      if (!current || current.item === item) continue
      if (current.region === targetRegionValue
          && current.index === targetIndexValue) continue
      if (groupId !== "" && current.groupId === String(groupId)) continue
      next.push(current)
    }
    next.push({
      groupId: String(groupId || ""),
      region: targetRegionValue,
      index: targetIndexValue,
      item: item
    })
    targets = next
    return true
  }

  function unregisterTarget(item) {
    if (!item) return false
    const next = []
    let removed = false
    for (let i = 0; i < targets.length; i++) {
      const current = targets[i]
      if (current && current.item === item) {
        removed = true
        if (current.item === targetItem) {
          targetGroupId = ""
          targetRegion = ""
          targetIndex = -1
          targetItem = null
        }
      } else if (current) {
        next.push(current)
      }
    }
    if (!removed) return false
    targets = next
    if (sourceItem === item) cancel()
    return true
  }

  function targetAt(windowX, windowY) {
    const px = Number(windowX)
    const py = Number(windowY)
    if (!Number.isFinite(px) || !Number.isFinite(py)) return ""
    for (let i = targets.length - 1; i >= 0; i--) {
      const target = targets[i]
      const item = target ? target.item : null
      if (!item || !item.visible || item.width <= 0.5 || item.height <= 0.5)
        continue
      const origin = item.mapToItem(null, 0, 0)
      if (px >= origin.x && px <= origin.x + item.width
          && py >= origin.y && py <= origin.y + item.height)
        return target
    }
    return null
  }

  function positiveSize(item) {
    return item && Number.isFinite(item.width) && Number.isFinite(item.height)
      && item.width > 0 && item.height > 0
  }

  function begin(groupId, item, windowX, windowY) {
    const source = String(groupId || "")
    cancel()
    if (!groupExists(source) || !item || !item.visible || !positiveSize(item)
        || typeof item.mapToItem !== "function"
        || typeof item.grabToImage !== "function") return false
    const window = item.Window.window
    if (!window || !window.visible || !positiveSize(window)) return false
    const origin = item.mapToItem(null, 0, 0)
    if (!Number.isFinite(origin.x) || !Number.isFinite(origin.y)) return false

    sourceGroupId = source
    sourceItem = item
    sourceWindow = window
    ghostHomeX = origin.x
    ghostHomeY = origin.y
    ghostWidth = item.width
    ghostHeight = item.height
    ghostX = Number.isFinite(Number(windowX))
      ? Number(windowX) - ghostWidth / 2 : ghostHomeX
    ghostY = Number.isFinite(Number(windowY))
      ? Number(windowY) - ghostHeight / 2 : ghostHomeY
    const generation = captureGeneration
    const capturedItem = sourceItem
    // Bound the raster to this output's validated logical window size,
    // preserving aspect ratio. Ghost geometry stays in logical coordinates.
    const captureScale = Math.min(1,
      window.width / ghostWidth, window.height / ghostHeight)
    if (!sourceItem.grabToImage(function(result) {
      if (root) root.acceptGhostCapture(generation, capturedItem, result)
    }, Qt.size(Math.max(1, Math.ceil(ghostWidth * captureScale)),
      Math.max(1, Math.ceil(ghostHeight * captureScale))))) {
      cancel()
      return false
    }
    active = true
    return true
  }

  function acceptGhostCapture(generation, item, result) {
    if (generation !== captureGeneration || sourceItem !== item
        || (!active && !returning) || !result || !result.url) return false
    ghostImageGrab = result
    ghostImageUrl = result.url
    return true
  }

  function move(windowX, windowY) {
    if (!active) return false
    const px = Number(windowX)
    const py = Number(windowY)
    if (!Number.isFinite(px) || !Number.isFinite(py)) return false
    ghostX = px - ghostWidth / 2
    ghostY = py - ghostHeight / 2
    // Ito-verse: dragging always moves the widget to the gap nearest the pointer; it never trades places. Trading when the
    // pointer crossed the middle of a widget and inserting at its edges made the ghost and the marker switch back and
    // forth as it travelled (a flicker), and dropping on a neighbour swapped the two instead of moving one.
    updateTarget(null)
    return computeInsert(px, py)
  }

  function edgeZone(item, px) {
    const origin = item.mapToItem(null, 0, 0)
    const share = (px - origin.x) / Math.max(1, item.width)
    return share < 0.28 || share > 0.72
  }

  function clearInsert() {
    insertRegion = ""
    insertIndex = -1
  }

  // The visible widgets of the bar in the order they stand, each with where it is and where it sits in the layout.
  // The coordinate a drag travels along: X on a horizontal bar, Y on a vertical one.
  function axisPos(x, y) { return vertical ? y : x }

  function placedTargets() {
    const out = []
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i]
      const item = t ? t.item : null
      if (!t || !item || !item.visible || item.width <= 0.5 || t.groupId === "" || t.groupId === sourceGroupId) continue
      const loc = layoutController && typeof layoutController.groupLocation === "function"
        ? layoutController.groupLocation(t.groupId) : null
      if (!loc) continue
      const origin = item.mapToItem(null, 0, 0)
      const near = axisPos(origin.x, origin.y)
      const far = near + (vertical ? item.height : item.width)
      out.push({ region: loc.region, index: loc.index, left: near, right: far })
    }
    out.sort(function(a, b) { return a.left - b.left })
    return out
  }

  function computeInsert(px, py) {
    if (!layoutController || typeof layoutController.insertGroupAt !== "function") { clearInsert(); return false }
    const placed = placedTargets()
    const p = axisPos(px, py)
    const span = Math.max(1, shellRight - shellLeft)
    // outside the plate: nothing to drop on
    if (shellRight > shellLeft && (p < shellLeft - 6 || p > shellRight + 6)) { clearInsert(); return false }

    let region = ""
    let index = 0
    let markerX = p

    if (!flowShell) {
      // a full-width bar: left widgets sit at the left end, right ones at the right end, the rest in the middle
      const third = span / 3
      region = p < shellLeft + third ? "left" : (p > shellRight - third ? "right" : "center")
    } else {
      // content-sized: the regions run on into one another, so the neighbours decide the region
      let prev = null
      let next = null
      for (let i = 0; i < placed.length; i++) {
        if ((placed[i].left + placed[i].right) / 2 <= p) prev = placed[i]
        else if (!next) next = placed[i]
      }
      if (prev && next && prev.region !== next.region) {
        const towardsPrev = p - prev.right < next.left - p
        region = towardsPrev ? prev.region : next.region
        index = towardsPrev ? prev.index + 1 : next.index
        markerX = towardsPrev ? prev.right + 3 : next.left - 3
      } else if (next) {
        region = next.region
        index = next.index
        markerX = next.left - 3
      } else if (prev) {
        region = prev.region
        index = prev.index + 1
        markerX = prev.right + 3
      } else {
        region = "center"
        index = 0
      }
      insertRegion = region
      insertIndex = index
      insertX = markerX
      return true
    }

    // full-width bar: among the widgets of that region, before the first one the pointer has not reached
    const mine = placed.filter(function(t) { return t.region === region })
    let before = null
    let after = null
    for (let i = 0; i < mine.length; i++) {
      if ((mine[i].left + mine[i].right) / 2 <= p) after = mine[i]
      else if (!before) before = mine[i]
    }
    if (before) { index = before.index; markerX = before.left - 3 }
    else if (after) { index = after.index + 1; markerX = after.right + 3 }
    else { index = 0 }
    insertRegion = region
    insertIndex = index
    insertX = markerX
    return true
  }

  function updateTarget(target) {
    const group = target ? String(target.groupId || "") : ""
    const slotTarget = target && target.region !== undefined
    if (!active || !target
        || (group !== "" && group === sourceGroupId)
        || (!slotTarget && !groupExists(group))) {
      targetGroupId = ""
      targetRegion = ""
      targetIndex = -1
      targetItem = null
      return false
    }
    targetGroupId = group
    targetRegion = slotTarget ? String(target.region || "") : ""
    targetIndex = slotTarget ? Math.floor(Number(target.index)) : -1
    targetItem = target.item || null
    return true
  }

  function drop() {
    const source = sourceGroupId
    const target = targetGroupId
    const controller = layoutController
    if (source !== "" && target === "" && insertRegion !== "" && insertIndex >= 0
        && controller && typeof controller.insertGroupAt === "function") {
      const region = insertRegion
      const index = insertIndex
      cancel()
      return controller.insertGroupAt(source, region, index)
    }
    if (source !== "" && targetRegion !== "" && targetIndex >= 0
        && controller && typeof controller.moveGroupToSlot === "function") {
      const region = targetRegion
      const index = targetIndex
      cancel()
      return controller.moveGroupToSlot(source, region, index)
    }
    if (source !== "" && target !== "" && controller
        && typeof controller.swapGroups === "function") {
      cancel()
      return controller.swapGroups(source, target)
    }
    if (active && sourceItem) {
      active = false
      returning = true
      targetGroupId = ""
      ghostX = ghostHomeX
      ghostY = ghostHomeY
    } else {
      cancel()
    }
    return false
  }

  function finishReturn() {
    if (!returning) return false
    cancel()
    return true
  }

  function cancel() {
    insertRegion = ""
    insertIndex = -1
    captureGeneration++
    active = false
    returning = false
    sourceGroupId = ""
    targetGroupId = ""
    targetRegion = ""
    targetIndex = -1
    targetItem = null
    sourceItem = null
    sourceWindow = null
    ghostX = 0
    ghostY = 0
    ghostWidth = 0
    ghostHeight = 0
    ghostHomeX = 0
    ghostHomeY = 0
    ghostImageUrl = ""
    ghostImageGrab = null
  }

  Component.onDestruction: {
    cancel()
    targets = []
  }
}

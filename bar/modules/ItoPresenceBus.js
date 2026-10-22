.pragma library

// The one-slot mailbox between a popup that is closed by a switch to another popup and the popup that opens in its place
// (icons-v5.md section 4.1, A4). A pragma library script is a single instance for the whole shell, so the two ends share it
// with no QML singleton (this folder has no qmldir). It is pure: the caller passes the time, nothing here reads a clock.
//
//   put(rect, now)           the leaving popup leaves its card's rect (screen coordinates: x, y, w, h)
//   take(now, windowMs)      the arriving popup collects it: the rect when it is no older than `windowMs`, else null (stale or absent)
// A taken or stale rect is dropped, so a later ordinary open always starts from its icon.
var slot = null

function put(rect, now) { slot = { rect: rect, t: now } }
function take(now, windowMs) {
  var s = slot
  slot = null
  if (!s || !(now - s.t >= 0) || now - s.t > windowMs) return null
  return s.rect
}
function clear() { slot = null }

if (typeof module !== "undefined") module.exports = { put: put, take: take, clear: clear }

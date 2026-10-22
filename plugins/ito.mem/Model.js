// The memory panel's data, as pure functions: no I/O, no shell types, so this loads in the shell and in
// `node --test` (scripts/qa/models.test.mjs). No `.pragma`: a plain import gives the widget its own copy.
//
// The panel runs one `sh -c` per refresh. Its output is cut into sections at lines "@@name":
//   (start)  /proc/meminfo     @@swaps  /proc/swaps     @@procs  every /proc/<pid>/stat (read by bar/modules/ItoProcs.js)
// A missing source is an empty section, and an empty section is simply no row: nothing is an error.
// Sizes are KiB throughout (what /proc/meminfo and /proc/swaps give); fmtSize turns them into GiB / MiB for the eye.

var DIRTY_MIN_KIB = 64 * 1024     // the writeback line only shows above 64 MiB

function splitSections(text) {
  var out = { main: "", swaps: "", procs: "" }
  var current = "main"
  var lines = String(text || "").split("\n")
  var buf = { main: [], swaps: [], procs: [] }
  for (var i = 0; i < lines.length; i++) {
    var m = /^@@(\w+)\s*$/.exec(lines[i])
    if (m) { current = buf[m[1]] ? m[1] : "_skip"; continue }
    if (buf[current]) buf[current].push(lines[i])
  }
  for (var k in buf) out[k] = buf[k].join("\n")
  return out
}

// /proc/meminfo -> the fields the panel uses, in KiB (0 when a field is absent); null without a usable MemTotal.
function parseMeminfo(text) {
  var want = { MemTotal: 1, MemFree: 1, MemAvailable: 1, Buffers: 1, Cached: 1, SReclaimable: 1, Shmem: 1, Dirty: 1, Writeback: 1 }
  var m = {}
  var lines = String(text || "").split("\n")
  for (var i = 0; i < lines.length; i++) {
    var r = /^(\w+):\s+(\d+)/.exec(lines[i])
    if (r && want[r[1]]) m[r[1]] = parseFloat(r[2])
  }
  if (!(m.MemTotal > 0)) return null
  for (var k in want) if (m[k] === undefined) m[k] = 0
  return m
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

// The four parts of the stacked bar, each clamped so that together they never pass MemTotal:
//   used = Total - Available     cache = Cached + Buffers + SReclaimable - Shmem     shared = Shmem     free = MemFree
// `available` is MemAvailable as the kernel reports it (it is not a fifth part: it overlaps free and cache).
function breakdown(mem) {
  if (!mem) return null
  var total = mem.MemTotal
  var room = total
  var used = clamp(total - mem.MemAvailable, 0, room); room -= used
  var cache = clamp(mem.Cached + mem.Buffers + mem.SReclaimable - mem.Shmem, 0, room); room -= cache
  var shared = clamp(mem.Shmem, 0, room); room -= shared
  var free = clamp(mem.MemFree, 0, room)
  return { total: total, used: used, cache: cache, shared: shared, free: free, available: clamp(mem.MemAvailable, 0, total) }
}

// 0 KiB -> "0 KiB"; under 1 MiB in KiB; under 1 GiB in MiB (one decimal below 10 MiB); from 1 GiB with one decimal.
function fmtSize(kib) {
  var k = Math.max(0, Number(kib) || 0)
  if (k >= 1048576) return (k / 1048576).toFixed(1) + " GiB"
  if (k >= 1024) return (k < 10240 ? (k / 1024).toFixed(1) : String(Math.round(k / 1024))) + " MiB"
  return Math.round(k) + " KiB"
}

function fmtPercent(fraction) {
  var f = Number(fraction)
  if (isNaN(f)) return "—"
  return (Math.round(f * 1000) / 10).toFixed(1) + "%"
}

// The legend of the stacked bar: [{ key, label, kib, fraction, size, percent }] in bar order. `fraction` is the share
// of the total. Available is listed last with `swatch: false`: it is not a segment of the bar.
function legend(b) {
  if (!b) return []
  var parts = [["used", "Used"], ["cache", "Cache"], ["shared", "Shared"], ["free", "Free"]]
  var rows = []
  for (var i = 0; i < parts.length; i++) {
    var kib = b[parts[i][0]]
    var f = b.total > 0 ? kib / b.total : 0
    rows.push({ key: parts[i][0], label: parts[i][1], kib: kib, fraction: f, size: fmtSize(kib), percent: fmtPercent(f), swatch: true })
  }
  var af = b.total > 0 ? b.available / b.total : 0
  rows.push({ key: "available", label: "Available", kib: b.available, fraction: af, size: fmtSize(b.available), percent: fmtPercent(af), swatch: false })
  return rows
}

// /proc/swaps -> [{ kind: "zram" | "file", label, size, used, fraction, value }] (KiB), one row per kind that has any.
// Devices named zram* are compressed RAM; every other swap (file or partition) is folded into "file".
function parseSwaps(text) {
  var kinds = { zram: { size: 0, used: 0 }, file: { size: 0, used: 0 } }
  var lines = String(text || "").split("\n")
  for (var i = 0; i < lines.length; i++) {
    var f = lines[i].trim().split(/\s+/)
    if (f.length < 4 || f[0] === "Filename") continue
    var size = parseFloat(f[2]), used = parseFloat(f[3])
    if (isNaN(size) || isNaN(used) || size <= 0) continue
    var kind = /(^|\/)zram\d*$/.test(f[0]) ? "zram" : "file"
    kinds[kind].size += size
    kinds[kind].used += Math.min(used, size)
  }
  var rows = []
  var order = [["zram", "zram"], ["file", "Swap file"]]
  for (var k = 0; k < order.length; k++) {
    var s = kinds[order[k][0]]
    if (s.size <= 0) continue
    rows.push({ kind: order[k][0], label: order[k][1], size: s.size, used: s.used, fraction: s.used / s.size,
      value: fmtSize(s.used) + " / " + fmtSize(s.size) })
  }
  return rows
}

// Dirty + Writeback in KiB when above the threshold, else null (no row).
function dirtyKiB(mem) {
  if (!mem) return null
  var d = mem.Dirty + mem.Writeback
  return d > DIRTY_MIN_KIB ? d : null
}

// Dirty + Writeback in KiB, whatever its size (0 when there is none or meminfo is unreadable): it sets how often a drop
// forms under the vessel (ItoIchor.js dripInterval, which is silent below 1 MiB). `dirtyKiB` above keeps the 64 MiB
// threshold of the "Unwritten" row.
function dirtyTotal(mem) {
  if (!mem) return 0
  return Math.max(0, mem.Dirty + mem.Writeback)
}

// One refresh. Returns { mem, parts, legend, swaps, dirty, dirtyAll, procsText }; `parts` is null when meminfo is unreadable.
function update(text) {
  var sec = splitSections(text)
  var mem = parseMeminfo(sec.main)
  var b = breakdown(mem)
  return { mem: mem, parts: b, legend: legend(b), swaps: parseSwaps(sec.swaps), dirty: dirtyKiB(mem), dirtyAll: dirtyTotal(mem), procsText: sec.procs }
}

if (typeof module !== "undefined") module.exports = { splitSections: splitSections, parseMeminfo: parseMeminfo, breakdown: breakdown, fmtSize: fmtSize, fmtPercent: fmtPercent, legend: legend, parseSwaps: parseSwaps, dirtyKiB: dirtyKiB, dirtyTotal: dirtyTotal, update: update }

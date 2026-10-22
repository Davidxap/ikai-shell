// The disk panel's data, as pure functions: no I/O, no shell types, so this loads in the shell and in
// `node --test` (scripts/qa/models.test.mjs). No `.pragma`: a plain import gives the widget its own copy.
//
// The panel runs one `sh -c` per refresh. Its output is cut into sections at lines "@@name":
//   (start)  df -l -B1 --output=source,target,fstype,size,used,avail, local filesystems only (under `timeout 2`)
//   @@stats  /proc/diskstats       @@temp  the NVMe sensor (hwmon named "nvme"), millidegrees
// A missing source is an empty section, and an empty section is simply no row: nothing is an error. A df that timed out
// (an empty first section) keeps the mounts of the previous refresh, so the rings do not empty on a hiccup.
// Sizes are bytes throughout (df -B1); rates are bytes per second.

var MAX_MOUNTS = 6                 // rows (and rings) shown; the rest are counted, not drawn
var HOT_MOUNT = 0.9                // a mount above this fraction is hot
var HOT_TEMP = 80                  // degrees C
// whole disks only: partitions (nvme0n1p1, sda1) would count their disk's traffic twice
var WHOLE_DISK = /^(nvme\d+n\d+|sd[a-z]+|vd[a-z]+|mmcblk\d+)$/

function splitSections(text) {
  var out = { main: "", stats: "", temp: "" }
  var current = "main"
  var lines = String(text || "").split("\n")
  var buf = { main: [], stats: [], temp: [] }
  for (var i = 0; i < lines.length; i++) {
    var m = /^@@(\w+)\s*$/.exec(lines[i])
    if (m) { current = buf[m[1]] ? m[1] : "_skip"; continue }
    if (buf[current]) buf[current].push(lines[i])
  }
  for (var k in buf) out[k] = buf[k].join("\n")
  return out
}

// df output -> [{ source, target, fstype, size, used, avail }] in bytes. Read from the right: the last three fields are
// numbers and the one before them is the type, so a mount point with spaces in it ("/mnt/My Disk") stays whole.
// The header, blank lines and anything that does not end in three numbers are skipped.
function parseDf(text) {
  var rows = []
  var lines = String(text || "").split("\n")
  for (var i = 0; i < lines.length; i++) {
    var f = lines[i].trim().split(/\s+/)
    if (f.length < 6) continue
    var avail = Number(f[f.length - 1]), used = Number(f[f.length - 2]), size = Number(f[f.length - 3])
    if (!isFinite(avail) || !isFinite(used) || !isFinite(size)) continue
    if (/^[0-9]/.test(f[f.length - 3]) === false) continue
    rows.push({ source: f[0], fstype: f[f.length - 4], target: f.slice(1, f.length - 4).join(" "), size: size, used: used, avail: avail })
  }
  return rows
}

// 0 B -> "0 B"; below 1 GiB in MiB; below 1000 GiB in GiB (one decimal under 100); then TiB with one decimal.
function fmtBytes(bytes) {
  var b = Math.max(0, Number(bytes) || 0)
  var gib = b / 1073741824
  if (gib >= 1000) return (gib / 1024).toFixed(1) + " TiB"
  if (gib >= 100) return String(Math.round(gib)) + " GiB"
  if (gib >= 1) return gib.toFixed(1) + " GiB"
  var mib = b / 1048576
  if (mib >= 1) return (mib < 10 ? mib.toFixed(1) : String(Math.round(mib))) + " MiB"
  return Math.round(b / 1024) + " KiB"
}

// "used / size" with one unit for both, chosen by the size: "412 / 931 GiB", "0.1 / 1.0 GiB", "0.9 / 1.8 TiB".
function fmtUsage(used, size) {
  var s = Math.max(0, Number(size) || 0), u = Math.max(0, Number(used) || 0)
  var gib = s / 1073741824
  var unit, div
  if (gib >= 1000) { unit = "TiB"; div = 1099511627776 }
  else if (gib >= 1) { unit = "GiB"; div = 1073741824 }
  else { unit = "MiB"; div = 1048576 }
  var digits = unit === "GiB" && gib >= 100 ? 0 : 1
  return (u / div).toFixed(digits) + " / " + (s / div).toFixed(digits) + " " + unit
}

// Bytes per second, decimal units like the disk makers and btop: "0 B/s", "812 KB/s", "12.4 MB/s", "1.2 GB/s".
function fmtRate(bps) {
  var v = Math.max(0, Number(bps) || 0)
  if (v >= 1e9) return (v / 1e9).toFixed(1) + " GB/s"
  if (v >= 1e6) return (v / 1e6).toFixed(1) + " MB/s"
  if (v >= 1e3) return Math.round(v / 1e3) + " KB/s"
  return Math.round(v) + " B/s"
}

// The mounts as rows of the panel, one per SOURCE: btrfs subvolumes (and bind mounts) repeat their device, so they are
// one row led by the shortest mount point and a count of the others ("/ (+3)"). The row that holds "/" comes first
// (ring 0, the outermost), the others keep df's order; filesystems of no size are left out; at most 6 rows.
// `fraction` is used / (used + avail), the figure df itself calls "Use%", so the header's reading and the ring agree.
// -> { mounts: [{ key, source, target, label, fstype, size, used, avail, fraction, percent, value, hot, threshold, extra }], more }
function mounts(rows) {
  var order = [], bySource = {}
  for (var i = 0; i < (rows || []).length; i++) {
    var r = rows[i]
    if (!(r.size > 0)) continue
    var g = bySource[r.source]
    if (!g) { g = bySource[r.source] = { rows: [] }; order.push(r.source) }
    g.rows.push(r)
  }
  var groups = []
  for (var s = 0; s < order.length; s++) {
    var list = bySource[order[s]].rows.slice()
    list.sort(function(a, b) { return a.target.length - b.target.length })
    var head = list[0]
    var total = head.used + head.avail
    var f = total > 0 ? Math.min(1, head.used / total) : 0
    groups.push({
      key: order[s], source: head.source, target: head.target, fstype: head.fstype,
      label: head.target + (list.length > 1 ? " (+" + (list.length - 1) + ")" : ""),
      size: head.size, used: head.used, avail: head.avail,
      fraction: f, percent: Math.round(f * 100) + "%", value: fmtUsage(head.used, head.size),
      hot: f > HOT_MOUNT, threshold: HOT_MOUNT, extra: list.length - 1, isRoot: list.some(function(x) { return x.target === "/" })
    })
  }
  var rootAt = -1
  for (var k = 0; k < groups.length; k++) if (groups[k].isRoot) { rootAt = k; break }
  if (rootAt > 0) groups.unshift(groups.splice(rootAt, 1)[0])
  for (var j = 0; j < groups.length; j++) delete groups[j].isRoot
  return { mounts: groups.slice(0, MAX_MOUNTS), more: Math.max(0, groups.length - MAX_MOUNTS) }
}

// /proc/diskstats -> { name: { r, w, ticks } }: bytes (sectors of 512 x field 6 and field 10) and `ticks`, the milliseconds spent
// doing I/O (field 13; null when the line is too short), whole disks only; {} when none.
function parseDiskstats(text) {
  var out = {}
  var lines = String(text || "").split("\n")
  for (var i = 0; i < lines.length; i++) {
    var f = lines[i].trim().split(/\s+/)
    if (f.length < 10) continue
    var name = f[2]
    if (!WHOLE_DISK.test(name)) continue
    var rs = Number(f[5]), ws = Number(f[9])
    if (!isFinite(rs) || !isFinite(ws)) continue
    var tk = f.length > 12 ? Number(f[12]) : NaN
    out[name] = { r: rs * 512, w: ws * 512, ticks: isFinite(tk) ? tk : null }
  }
  return out
}

// Read and write rate between two diskstats samples `dtMs` apart: { read, write, busy } bytes/s summed over the whole disks
// that are in both, and `busy` the MAX over those disks of the share of the interval spent doing I/O (0..1; null when no
// disk reports ticks). null for the first sample, a clock that did not move (under 200 ms), or no disk in common. A counter
// that went backwards (a disk that was reset) adds nothing for that disk.
function ioRates(prev, cur, dtMs) {
  if (!prev || !cur || !(dtMs >= 200)) return null
  var read = 0, write = 0, any = false, busy = null
  for (var name in cur) {
    if (!prev[name]) continue
    any = true
    var dr = cur[name].r - prev[name].r, dw = cur[name].w - prev[name].w
    if (dr > 0) read += dr
    if (dw > 0) write += dw
    var tc = cur[name].ticks, tp = prev[name].ticks
    if (tc !== null && tc !== undefined && tp !== null && tp !== undefined) {
      var share = Math.max(0, Math.min(1, (tc - tp) / dtMs))
      busy = busy === null ? share : Math.max(busy, share)
    }
  }
  if (!any) return null
  return { read: read * 1000 / dtMs, write: write * 1000 / dtMs, busy: busy }
}

// millidegrees -> degrees Celsius, or null
function parseTemp(text) {
  var v = parseInt(String(text || "").trim().split("\n")[0], 10)
  return v > 0 ? v / 1000 : null
}

// One refresh. `prev` is the previous return's `sample` (null on the first), `nowMs` the time of this reading. Returns
//   { sample, mounts, more, io, hasStats, temp }
// `io` is null until there is something to compare; `hasStats` says whether /proc/diskstats had a whole disk at all (no
// disk: no READ/WRITE cells and a still rune band). `mounts` keeps the previous refresh's list when df gave nothing.
// Keep `sample` for the next call and drop it when the panel closes.
function update(prev, text, nowMs) {
  var sec = splitSections(text)
  var m = mounts(parseDf(sec.main))
  var kept = m.mounts.length === 0 && prev && prev.mounts ? prev : null
  var disks = parseDiskstats(sec.stats)
  var names = Object.keys(disks)
  var io = prev && prev.disks ? ioRates(prev.disks, disks, Number(nowMs) - prev.t) : null
  var list = kept ? kept.mounts : m.mounts
  var more = kept ? kept.more : m.more
  return {
    sample: { t: Number(nowMs) || 0, disks: disks, mounts: list, more: more },
    mounts: list,
    more: more,
    io: io,
    hasStats: names.length > 0,
    temp: parseTemp(sec.temp)
  }
}

// The cells beside the platter: [{ key, label, value, fraction, hot, threshold }]. READ and WRITE have no groove
// (fraction -1) and read "—" until a rate exists; neither exists without diskstats; BUSY (the share of time the device
// spent doing I/O, a groove with a mark at 80 %) follows them and reads "—" until a rate exists; TEMP only with an NVMe sensor.
function readings(view) {
  var rows = []
  if (!view) return rows
  if (view.hasStats) {
    rows.push({ key: "read", label: "Read", value: view.io ? fmtRate(view.io.read) : "—", fraction: -1, hot: false, threshold: -1 })
    rows.push({ key: "write", label: "Write", value: view.io ? fmtRate(view.io.write) : "—", fraction: -1, hot: false, threshold: -1 })
  }
  if (view.hasStats) {
    var b = view.io && view.io.busy !== null && view.io.busy !== undefined ? view.io.busy : null
    rows.push({ key: "busy", label: "Busy", value: b === null ? "—" : Math.round(b * 100) + " %", fraction: b === null ? -1 : b, hot: b !== null && b >= 0.8, threshold: 0.8 })
  }
  if (view.temp !== null && view.temp !== undefined)
    rows.push({ key: "temp", label: "Temp", value: Math.round(view.temp) + " °C", fraction: Math.min(1, view.temp / 100), hot: view.temp > HOT_TEMP, threshold: HOT_TEMP / 100 })
  return rows
}

if (typeof module !== "undefined") module.exports = {
  MAX_MOUNTS: MAX_MOUNTS, splitSections: splitSections, parseDf: parseDf, fmtBytes: fmtBytes, fmtUsage: fmtUsage, fmtRate: fmtRate,
  mounts: mounts, parseDiskstats: parseDiskstats, ioRates: ioRates, parseTemp: parseTemp, update: update, readings: readings
}

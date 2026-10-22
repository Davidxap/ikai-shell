// The busiest processes, from the text of /proc/<pid>/stat files (concatenated, one line per process).
//
// Pure functions: no I/O, no shell types, so the same file loads in the shell and in `node --test`
// (scripts/qa/models.test.mjs). No `.pragma` and no JS-to-JS import, so a Model.js can sit next to it.
//
// Privacy: only the name (`comm`) between the first "(" and the last ")" is ever read. Never `cmdline`, never
// `environ`. Kernel threads are folded into one name ("kworker/u32:1" -> "kworker").
//
// Field numbers below are proc(5)'s, counted from 1 (pid is 1, comm is 2). After the closing ")" the fields
// resume at 3 (state), so field N sits at index N - 3 of the remainder.

// "kworker/u32:1" -> "kworker" for a kernel thread (its parent is kthreadd, pid 2); user processes keep their name.
function normalizeComm(comm, ppid, pid) {
  var name = String(comm === undefined || comm === null ? "" : comm)
  if (Number(ppid) === 2 || Number(pid) === 2) {
    var slash = name.indexOf("/")
    if (slash > 0) name = name.substring(0, slash)
  }
  return name
}

// -> [{ pid, comm, ppid, ticks, start, rss }]   ticks = utime + stime; rss in pages. Malformed lines are skipped.
function parsePidStats(text) {
  var out = []
  var lines = String(text || "").split("\n")
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i]
    var open = line.indexOf("(")
    var close = line.lastIndexOf(")")
    if (open <= 0 || close < open) continue
    var pid = parseInt(line.substring(0, open), 10)
    if (!(pid > 0)) continue
    var rest = line.substring(close + 1).trim().split(/\s+/)
    if (rest.length < 22) continue
    var ppid = parseInt(rest[1], 10)
    var utime = parseFloat(rest[11])
    var stime = parseFloat(rest[12])
    var start = parseFloat(rest[19])
    var rss = parseFloat(rest[21])
    if (isNaN(ppid) || isNaN(utime) || isNaN(stime) || isNaN(start)) continue
    out.push({
      pid: pid,
      comm: normalizeComm(line.substring(open + 1, close), ppid, pid),
      ppid: ppid,
      ticks: utime + stime,
      start: start,
      rss: isNaN(rss) ? 0 : Math.max(0, rss)
    })
  }
  return out
}

// The table kept between two samples: pid -> { start, ticks }.
function snapshot(procs) {
  var map = {}
  for (var i = 0; i < procs.length; i++) map[procs[i].pid] = { start: procs[i].start, ticks: procs[i].ticks }
  return map
}

// Adds `cpu` (a fraction of the whole machine, 0..1) to each process: its ticks since `prev` over the machine's
// total jiffies over the same interval. `cpu` is null when there is nothing to compare: the first sample, a
// process that appeared since, or a pid reused by a new process (its start time differs).
function procRates(prev, procs, dTotal) {
  var out = []
  for (var i = 0; i < procs.length; i++) {
    var p = procs[i]
    var before = prev ? prev[p.pid] : null
    var cpu = null
    if (before && before.start === p.start && dTotal > 0 && p.ticks >= before.ticks)
      cpu = Math.min(1, (p.ticks - before.ticks) / dTotal)
    out.push({ pid: p.pid, comm: p.comm, ppid: p.ppid, ticks: p.ticks, start: p.start, rss: p.rss, cpu: cpu })
  }
  return out
}

function fmtPercent(fraction) {
  if (fraction === null || fraction === undefined || isNaN(fraction)) return "—"
  return (Math.round(fraction * 1000) / 10).toFixed(1) + "%"
}

function fmtBytes(bytes) {
  var b = Number(bytes) || 0
  if (b >= 1073741824) return (b / 1073741824).toFixed(1) + " G"
  if (b >= 1048576) return Math.round(b / 1048576) + " M"
  return Math.round(b / 1024) + " K"
}

// Groups by name and keeps the `n` biggest by `metric` ("cpu" or "rss"). Rows for ItoProcList:
// [{ name, count, fraction, value }], `fraction` being the share of the largest row kept; the memory rows also carry `bytes`.
// Before the first comparison there are no CPU readings: the list is ordered by memory and every value is "—".
function groupTop(procs, metric, n, pageSize) {
  var groups = {}
  var order = []
  for (var i = 0; i < procs.length; i++) {
    var p = procs[i]
    var g = groups[p.comm]
    if (!g) { g = groups[p.comm] = { name: p.comm, count: 0, cpu: null, rss: 0 }; order.push(g) }
    g.count++
    g.rss += p.rss
    if (p.cpu !== null && p.cpu !== undefined) g.cpu = (g.cpu === null ? 0 : g.cpu) + p.cpu
  }
  var anyCpu = false
  for (var k = 0; k < order.length; k++) if (order[k].cpu !== null) anyCpu = true
  var byCpu = metric === "cpu" && anyCpu
  var size = Number(pageSize) > 0 ? Number(pageSize) : 4096
  order.sort(function (a, b) {
    var d = byCpu ? (b.cpu || 0) - (a.cpu || 0) : b.rss - a.rss
    if (d !== 0) return d
    return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0)
  })
  var top = order.slice(0, Math.max(0, n))
  var max = 0
  for (var j = 0; j < top.length; j++) {
    var v = metric === "cpu" ? (top[j].cpu || 0) : top[j].rss
    if (v > max) max = v
  }
  var rows = []
  for (var m = 0; m < top.length; m++) {
    var t = top[m]
    var value = metric === "cpu" ? (anyCpu ? (t.cpu || 0) : 0) : t.rss
    var row = {
      name: t.name,
      count: t.count,
      fraction: max > 0 && (metric !== "cpu" || anyCpu) ? value / max : 0,
      value: metric === "cpu" ? fmtPercent(anyCpu ? (t.cpu || 0) : null) : fmtBytes(t.rss * size)
    }
    if (metric !== "cpu") row.bytes = t.rss * size   // resident bytes of the group (the eyes of the RAM vessel size themselves by it)
    rows.push(row)
  }
  return rows
}

if (typeof module !== "undefined") module.exports = { normalizeComm: normalizeComm, parsePidStats: parsePidStats, snapshot: snapshot, procRates: procRates, groupTop: groupTop, fmtPercent: fmtPercent, fmtBytes: fmtBytes }

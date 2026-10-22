// The CPU panel's data, as pure functions: no I/O, no shell types, so this loads in the shell and in
// `node --test` (scripts/qa/models.test.mjs). No `.pragma`: a plain import gives the widget its own copy.
//
// The panel runs one `sh -c` per refresh. Its output is cut into sections at lines "@@name":
//   (start)  /proc/stat then /proc/loadavg      @@psi  /proc/pressure/cpu      @@freq  scaling_cur_freq, kHz, one per core
//   @@temp   the CPU sensor, millidegrees       @@procs  every /proc/<pid>/stat (read by bar/modules/ItoProcs.js)
// A missing source is an empty section, and an empty section is simply no row: nothing is an error.

function splitSections(text) {
  var out = { main: "", psi: "", freq: "", temp: "", procs: "" }
  var current = "main"
  var lines = String(text || "").split("\n")
  var buf = { main: [], psi: [], freq: [], temp: [], procs: [] }
  for (var i = 0; i < lines.length; i++) {
    var m = /^@@(\w+)\s*$/.exec(lines[i])
    if (m) { current = buf[m[1]] ? m[1] : "_skip"; continue }
    if (buf[current]) buf[current].push(lines[i])
  }
  for (var k in buf) out[k] = buf[k].join("\n")
  return out
}

// "cpu" and "cpuN" lines of /proc/stat -> { total: {idle,total}, cores: [{idle,total}] }.
// First 8 fields only (guest times are already inside user/nice); idle = idle + iowait, as the bar widget does.
function parseCpuStat(text) {
  var res = { total: null, cores: [] }
  var lines = String(text || "").split("\n")
  for (var i = 0; i < lines.length; i++) {
    var m = /^(cpu\d*)\s+(.*)$/.exec(lines[i])
    if (!m) continue
    var f = m[2].trim().split(/\s+/)
    if (f.length < 4) continue
    var total = 0
    var nums = []
    for (var j = 0; j < f.length && j < 8; j++) { nums.push(parseFloat(f[j]) || 0); total += nums[j] }
    var sample = { idle: nums[3] + (nums.length > 4 ? nums[4] : 0), total: total }
    if (m[1] === "cpu") res.total = sample
    else res.cores.push(sample)
  }
  return res
}

// One 0..1 load per core between two samples; [] when there is nothing to compare (first sample, core count changed).
function coreLoads(prev, cur) {
  if (!prev || !cur || prev.length !== cur.length) return []
  var out = []
  for (var i = 0; i < cur.length; i++) {
    var dTotal = cur[i].total - prev[i].total
    if (dTotal > 0) out.push(Math.max(0, Math.min(1, 1 - (cur[i].idle - prev[i].idle) / dTotal)))
    else out.push(0)
  }
  return out
}

// -> [1 min, 5 min, 15 min] or null
function parseLoadavg(text) {
  var lines = String(text || "").split("\n")
  for (var i = 0; i < lines.length; i++) {
    var m = /^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+\d+\/\d+/.exec(lines[i])
    if (m) return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]
  }
  return null
}

// "some avg10=1.23 ..." of /proc/pressure/cpu -> 1.23 (percent), or null
function parsePsi(text) {
  var m = /(?:^|\n)some\s+avg10=(\d+(?:\.\d+)?)/.exec(String(text || ""))
  return m ? parseFloat(m[1]) : null
}

// scaling_cur_freq lines (kHz) -> { avg, max } in MHz, or null
function parseFreq(text) {
  var lines = String(text || "").split("\n")
  var sum = 0, n = 0, max = 0
  for (var i = 0; i < lines.length; i++) {
    var v = parseInt(lines[i], 10)
    if (!(v > 0)) continue
    sum += v; n++
    if (v > max) max = v
  }
  return n > 0 ? { avg: sum / n / 1000, max: max / 1000 } : null
}

// millidegrees -> degrees Celsius, or null
function parseTemp(text) {
  var v = parseInt(String(text || "").trim().split("\n")[0], 10)
  return v > 0 ? v / 1000 : null
}

// The grid of per-core bars: one row up to 32 cores, two above.
function coreGridColumns(n) {
  var count = Math.max(0, Math.floor(Number(n) || 0))
  if (count <= 0) return 0
  return count <= 32 ? count : Math.ceil(count / 2)
}

function fmtGHz(mhz) { return (mhz / 1000).toFixed(1) }

// One refresh: `prev` is the previous return's `sample` (null on the first). Returns
//   { sample, cores, pct, dTotal, load, psi, freq, temp, procsText }
// `cores` is [] on the first sample; `dTotal` (the machine's jiffies since the last sample, -1 on the first) is what
// ItoProcs.procRates divides by. Keep `sample` for the next call and drop it when the panel closes.
function update(prev, text) {
  var sec = splitSections(text)
  var stat = parseCpuStat(sec.main)
  var cores = coreLoads(prev ? prev.cores : null, stat.cores)
  var pct = -1
  var dTotal = -1
  if (prev && prev.total && stat.total && stat.total.total > prev.total.total) {
    dTotal = stat.total.total - prev.total.total
    pct = Math.max(0, Math.min(1, 1 - (stat.total.idle - prev.total.idle) / dTotal))
  }
  return {
    sample: { total: stat.total, cores: stat.cores },
    cores: cores,
    pct: pct,
    dTotal: dTotal,
    load: parseLoadavg(sec.main),
    psi: parsePsi(sec.psi),
    freq: parseFreq(sec.freq),
    temp: parseTemp(sec.temp),
    procsText: sec.procs
  }
}

// The readings beside the core seal: [{ key, label, value, fraction, hot, threshold }]. A source that is not there gives
// no line. `threads` is the number of logical CPUs, so a load of 8 on 8 threads reads as full. `threshold` is the
// fraction where "hot" starts (0.8 load, 0.2 pressure, 0.8 temperature), or -1 for a reading with none (the clock), so a
// groove draws its mark from the model and not from a constant in the QML.
function readings(view, threads) {
  var rows = []
  if (!view) return rows
  var n = Math.max(1, Number(threads) || 1)
  if (view.load)
    rows.push({ key: "load", label: "Load", value: view.load[0].toFixed(2) + "  " + view.load[1].toFixed(2) + "  " + view.load[2].toFixed(2),
      fraction: Math.min(1, view.load[0] / n), hot: view.load[0] / n > 0.8, threshold: 0.8 })
  if (view.psi !== null && view.psi !== undefined)
    rows.push({ key: "psi", label: "Pressure", value: view.psi.toFixed(1) + " %", fraction: Math.min(1, view.psi / 100), hot: view.psi > 20, threshold: 0.2 })
  if (view.freq)
    rows.push({ key: "freq", label: "Freq", value: fmtGHz(view.freq.avg) + " avg / " + fmtGHz(view.freq.max) + " max",
      fraction: view.freq.max > 0 ? Math.min(1, view.freq.avg / view.freq.max) : 0, hot: false, threshold: -1 })
  if (view.temp !== null && view.temp !== undefined)
    rows.push({ key: "temp", label: "Temp", value: Math.round(view.temp) + " °C", fraction: Math.min(1, view.temp / 100), hot: view.temp > 80, threshold: 0.8 })
  return rows
}

if (typeof module !== "undefined") module.exports = { splitSections: splitSections, parseCpuStat: parseCpuStat, coreLoads: coreLoads, parseLoadavg: parseLoadavg, parsePsi: parsePsi, parseFreq: parseFreq, parseTemp: parseTemp, coreGridColumns: coreGridColumns, update: update, readings: readings }

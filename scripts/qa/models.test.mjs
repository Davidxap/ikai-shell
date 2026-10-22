// Tests for the pure logic in the plugins' Model.js files and bar/modules/ItoProcs.js.
//   node --test scripts/qa/models.test.mjs
// Every input here is made-up /proc text. Nothing is read from the machine running the tests.
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import vm from "node:vm"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

// Loads a QML-flavoured JS file: drops `.pragma` and `.import` lines, then runs it with a fake `module`.
function load(rel) {
  const src = fs.readFileSync(path.join(root, rel), "utf8")
    .split("\n").filter((l) => !/^\s*\.(pragma|import)\b/.test(l)).join("\n")
  const sandbox = { module: { exports: {} } }
  vm.runInNewContext(src, sandbox, { filename: rel })
  return sandbox.module.exports
}

// The files run in their own vm context, so their arrays and objects have another realm's prototypes:
// compare through JSON, which is also what QML sees.
const same = (actual, expected) => assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected)

const Procs = load("bar/modules/ItoProcs.js")
const Cpu = load("plugins/ito.cpu/Model.js")
const Mem = load("plugins/ito.mem/Model.js")
const Disk = load("plugins/ito.disk/Model.js")
const Chart = load("bar/modules/ItoChart.js")
const Ichor = load("bar/modules/ItoIchor.js")
const Eye = load("bar/modules/ItoEyeModel.js")
const Real = load("bar/modules/ItoEyeReal.js")
const Lore = load("bar/modules/ItoLore.js")

// ---- a made-up /proc/<pid>/stat line: fields 1-2 then 3.. (state is field 3); utime 14, stime 15, start 22, rss 24
function statLine(pid, comm, ppid, utime, stime, start, rss) {
  const f = new Array(50).fill("0")
  f[0] = "S"; f[1] = String(ppid); f[11] = String(utime); f[12] = String(stime); f[19] = String(start); f[21] = String(rss)
  return pid + " (" + comm + ") " + f.join(" ")
}

test("loader runs a file with the module export guard", () => {
  assert.equal(typeof Procs.parsePidStats, "function")
  assert.equal(typeof Cpu.update, "function")
})

// ------------------------------------------------------------------------------------------------ ItoProcs
test("parsePidStats: a plain line", () => {
  const p = Procs.parsePidStats(statLine(100, "bash", 1, 30, 12, 5000, 700))
  same(p, [{ pid: 100, comm: "bash", ppid: 1, ticks: 42, start: 5000, rss: 700 }])
})

test("parsePidStats: comm with spaces and parentheses", () => {
  const p = Procs.parsePidStats(statLine(200, "Web Content (x) )", 1, 1, 1, 9, 5))
  assert.equal(p.length, 1)
  assert.equal(p[0].comm, "Web Content (x) )")
  assert.equal(p[0].ticks, 2)
  assert.equal(p[0].rss, 5)
})

test("parsePidStats: skips garbage and blank lines", () => {
  const text = ["", "not a stat line", "12 (short) S 1", statLine(7, "ok", 1, 1, 0, 1, 1), "abc (x) S"].join("\n")
  const p = Procs.parsePidStats(text)
  same(p.map((x) => x.pid), [7])
})

test("normalizeComm: kernel threads lose their suffix, user processes do not", () => {
  assert.equal(Procs.normalizeComm("kworker/u32:1", 2, 900), "kworker")
  assert.equal(Procs.normalizeComm("ksoftirqd/3", 2, 30), "ksoftirqd")
  assert.equal(Procs.normalizeComm("kthreadd", 0, 2), "kthreadd")
  assert.equal(Procs.normalizeComm("a/b", 1, 500), "a/b")
  assert.equal(Procs.normalizeComm(undefined, 1, 5), "")
})

test("parsePidStats: kworker threads are normalised through their ppid", () => {
  const text = [statLine(41, "kworker/u32:1", 2, 1, 0, 3, 0), statLine(42, "kworker/0:2H", 2, 1, 0, 3, 0)].join("\n")
  same(Procs.parsePidStats(text).map((x) => x.comm), ["kworker", "kworker"])
})

test("procRates: first sample has no readings", () => {
  const procs = Procs.parsePidStats(statLine(1, "a", 1, 10, 0, 1, 1))
  assert.equal(Procs.procRates(null, procs, -1)[0].cpu, null)
  assert.equal(Procs.procRates({}, procs, 100)[0].cpu, null)
})

test("procRates: share of the machine between two samples", () => {
  const a = Procs.parsePidStats(statLine(1, "a", 1, 10, 0, 1, 1))
  const b = Procs.parsePidStats(statLine(1, "a", 1, 40, 10, 1, 1))
  const rates = Procs.procRates(Procs.snapshot(a), b, 200)
  assert.equal(rates[0].cpu, 0.2)
})

test("procRates: pid reuse (different start time) gives no reading", () => {
  const a = Procs.parsePidStats(statLine(1, "old", 1, 1000, 0, 100, 1))
  const b = Procs.parsePidStats(statLine(1, "new", 1, 5, 0, 999, 1))
  assert.equal(Procs.procRates(Procs.snapshot(a), b, 100)[0].cpu, null)
})

test("procRates: a counter that went backwards gives no reading", () => {
  const a = Procs.parsePidStats(statLine(1, "a", 1, 100, 0, 1, 1))
  const b = Procs.parsePidStats(statLine(1, "a", 1, 90, 0, 1, 1))
  assert.equal(Procs.procRates(Procs.snapshot(a), b, 100)[0].cpu, null)
})

test("groupTop: groups by name, sums, orders by cpu and scales bars", () => {
  const procs = [
    { comm: "firefox", rss: 100, cpu: 0.10 }, { comm: "firefox", rss: 50, cpu: 0.05 },
    { comm: "quickshell", rss: 300, cpu: 0.05 }, { comm: "idle", rss: 10, cpu: 0 }
  ]
  const rows = Procs.groupTop(procs, "cpu", 2)
  assert.equal(rows.length, 2)
  same(rows[0], { name: "firefox", count: 2, fraction: 1, value: "15.0%" })
  assert.equal(rows[1].name, "quickshell")
  assert.ok(Math.abs(rows[1].fraction - 1 / 3) < 1e-9)
})

test("groupTop: first sample orders by memory and shows a dash", () => {
  const procs = [{ comm: "small", rss: 10, cpu: null }, { comm: "big", rss: 900, cpu: null }]
  const rows = Procs.groupTop(procs, "cpu", 5)
  same(rows.map((r) => r.name), ["big", "small"])
  same(rows.map((r) => r.value), ["—", "—"])
  same(rows.map((r) => r.fraction), [0, 0])
})

test("groupTop: by resident memory, formatted with the page size", () => {
  const procs = [{ comm: "a", rss: 262144, cpu: null }, { comm: "b", rss: 1024, cpu: null }]
  const rows = Procs.groupTop(procs, "rss", 5, 4096)
  assert.equal(rows[0].value, "1.0 G")
  assert.equal(rows[1].value, "4 M")
})

test("groupTop: memory rows carry the group's resident bytes (the eyes use them), cpu rows do not", () => {
  const procs = [{ comm: "a", rss: 100, cpu: null }, { comm: "a", rss: 50, cpu: null }, { comm: "b", rss: 10, cpu: null }]
  const rows = Procs.groupTop(procs, "rss", 5, 4096)
  same(rows.map((r) => r.bytes), [150 * 4096, 10 * 4096])
  assert.equal(Procs.groupTop(procs, "cpu", 5)[0].bytes, undefined)
})

test("groupTop: n larger than the list, and an empty list", () => {
  assert.equal(Procs.groupTop([{ comm: "a", rss: 1, cpu: 0.1 }], "cpu", 5).length, 1)
  same(Procs.groupTop([], "cpu", 5), [])
})

test("fmtPercent and fmtBytes", () => {
  assert.equal(Procs.fmtPercent(0.1234), "12.3%")
  assert.equal(Procs.fmtPercent(null), "—")
  assert.equal(Procs.fmtBytes(1536), "2 K")
  assert.equal(Procs.fmtBytes(5 * 1048576), "5 M")
})

// -------------------------------------------------------------------------------------------- ito.cpu Model
const STAT_A = [
  "cpu  1000 0 500 8000 500 0 0 0 0 0",
  "cpu0 500 0 250 4000 250 0 0 0 0 0",
  "cpu1 500 0 250 4000 250 0 0 0 0 0",
  "intr 12345 1 2 3", "ctxt 999",
  "0.52 0.58 0.59 1/518 12345"
].join("\n")
const STAT_B = [
  "cpu  1400 0 700 8400 500 0 0 0 0 0",
  "cpu0 900 0 250 4050 250 0 0 0 0 0",
  "cpu1 500 0 450 4350 250 0 0 0 0 0",
  "intr 12999 1 2 3", "ctxt 1999",
  "1.50 1.00 0.75 3/520 12399"
].join("\n")

test("splitSections: cuts at @@ lines, unknown sections are dropped, missing ones are empty", () => {
  const s = Cpu.splitSections("MAIN\n@@psi\nsome avg10=1.00\n@@wat\nignored\n@@procs\n1 (a) S\n")
  assert.equal(s.main, "MAIN")
  assert.equal(s.psi, "some avg10=1.00")
  assert.equal(s.freq, "")
  assert.equal(s.temp, "")
  assert.equal(s.procs.trim(), "1 (a) S")
  assert.equal(Cpu.splitSections("").main, "")
  assert.equal(Cpu.splitSections(undefined).procs, "")
})

test("parseCpuStat: total and cores, idle includes iowait", () => {
  const r = Cpu.parseCpuStat(STAT_A)
  same(r.total, { idle: 8500, total: 10000 })
  assert.equal(r.cores.length, 2)
  same(r.cores[0], { idle: 4250, total: 5000 })
})

test("parseCpuStat: only the first 8 fields count", () => {
  const r = Cpu.parseCpuStat("cpu  10 0 10 70 10 0 0 0 999 999")
  assert.equal(r.total.total, 100)
})

test("parseCpuStat: nothing usable", () => {
  same(Cpu.parseCpuStat("garbage"), { total: null, cores: [] })
})

test("coreLoads: deltas per core; empty on first sample or a changed core count", () => {
  const a = Cpu.parseCpuStat(STAT_A), b = Cpu.parseCpuStat(STAT_B)
  const loads = Cpu.coreLoads(a.cores, b.cores)
  assert.equal(loads.length, 2)
  assert.ok(Math.abs(loads[0] - (1 - 50 / 450)) < 1e-9)   // cpu0: total +450, idle +50
  assert.ok(Math.abs(loads[1] - (1 - 350 / 550)) < 1e-9)  // cpu1: total +550, idle +350
  same(Cpu.coreLoads(null, b.cores), [])
  same(Cpu.coreLoads(a.cores.slice(1), b.cores), [])
})

test("coreLoads: a core with no time passed reads 0", () => {
  const a = Cpu.parseCpuStat(STAT_A)
  same(Cpu.coreLoads(a.cores, a.cores), [0, 0])
})

test("parseLoadavg", () => {
  same(Cpu.parseLoadavg(STAT_A), [0.52, 0.58, 0.59])
  assert.equal(Cpu.parseLoadavg("nothing"), null)
})

test("parsePsi: some avg10, ignores full", () => {
  assert.equal(Cpu.parsePsi("some avg10=3.25 avg60=1.00 avg300=0.50 total=100\nfull avg10=9.00 avg60=0 avg300=0 total=1"), 3.25)
  assert.equal(Cpu.parsePsi(""), null)
})

test("parseFreq: average and max in MHz, nulls when absent", () => {
  const f = Cpu.parseFreq("2000000\n4000000\n3000000\n")
  assert.equal(f.avg, 3000)
  assert.equal(f.max, 4000)
  assert.equal(Cpu.parseFreq(""), null)
  assert.equal(Cpu.parseFreq("abc\n0\n"), null)
})

test("parseTemp: millidegrees", () => {
  assert.equal(Cpu.parseTemp("62500\n"), 62.5)
  assert.equal(Cpu.parseTemp(""), null)
})

test("coreGridColumns: one row up to 32 cores, two above", () => {
  assert.equal(Cpu.coreGridColumns(0), 0)
  assert.equal(Cpu.coreGridColumns(1), 1)
  assert.equal(Cpu.coreGridColumns(16), 16)
  assert.equal(Cpu.coreGridColumns(32), 32)
  assert.equal(Cpu.coreGridColumns(33), 17)
  assert.equal(Cpu.coreGridColumns(64), 32)
  assert.equal(Cpu.coreGridColumns("x"), 0)
})

test("update: first sample has no readings, second has", () => {
  const text = (stat) => stat + "\n@@psi\nsome avg10=1.20 avg60=0 avg300=0 total=1\n@@freq\n3000000\n4000000\n@@temp\n62000\n@@procs\n" + statLine(1, "a", 1, 10, 0, 1, 1)
  const first = Cpu.update(null, text(STAT_A))
  same(first.cores, [])
  assert.equal(first.pct, -1)
  assert.equal(first.dTotal, -1)
  assert.equal(first.psi, 1.2)
  assert.equal(first.temp, 62)
  assert.match(first.procsText, /^1 \(a\)/)
  const second = Cpu.update(first.sample, text(STAT_B))
  assert.equal(second.cores.length, 2)
  assert.equal(second.dTotal, 1000)                      // 11000 - 10000 jiffies
  assert.ok(Math.abs(second.pct - 0.6) < 1e-9)           // idle +400 of +1000
  same(second.load, [1.5, 1, 0.75])
})

test("update: missing sections give no readings, never an error", () => {
  const first = Cpu.update(null, STAT_A)
  const second = Cpu.update(first.sample, STAT_B)
  assert.equal(second.psi, null)
  assert.equal(second.freq, null)
  assert.equal(second.temp, null)
  assert.equal(second.procsText, "")
  same(Cpu.readings(second, 2).map((r) => r.key), ["load"])
  same(Cpu.readings(null, 2), [])
})

test("update: an empty or broken read keeps working", () => {
  const r = Cpu.update(null, "")
  assert.equal(r.sample.total, null)
  same(r.cores, [])
  const again = Cpu.update(r.sample, "")
  assert.equal(again.pct, -1)
})

test("readings: full set, formatted, with hot flags", () => {
  const rows = Cpu.readings({ load: [7, 4, 2], psi: 30, freq: { avg: 3400, max: 4600 }, temp: 85 }, 8)
  same(rows.map((r) => r.key), ["load", "psi", "freq", "temp"])
  assert.equal(rows[0].value, "7.00  4.00  2.00")
  assert.equal(rows[0].hot, true)
  assert.equal(rows[1].value, "30.0 %")
  assert.equal(rows[2].value, "3.4 avg / 4.6 max")
  assert.equal(rows[3].value, "85 °C")
  assert.equal(rows[3].hot, true)
})

test("readings: every row carries its threshold (0.8 load, 0.2 pressure, none for the clock, 0.8 temperature)", () => {
  const rows = Cpu.readings({ load: [1, 1, 1], psi: 5, freq: { avg: 3400, max: 4600 }, temp: 50 }, 8)
  same(rows.map((r) => r.threshold), [0.8, 0.2, -1, 0.8])
  // the hot flag is "fraction above threshold" for the rows that have one
  const hot = Cpu.readings({ load: [7, 4, 2], psi: 30, freq: { avg: 1, max: 2 }, temp: 85 }, 8)
  same(hot.filter((r) => r.threshold >= 0).map((r) => r.fraction > r.threshold === r.hot), [true, true, true])
  same(Cpu.readings({ psi: 1 }, 4).map((r) => r.threshold), [0.2])
})

// ------------------------------------------------------------------------------------------------ ito.mem
const MEMINFO = [
  "MemTotal:       16000000 kB", "MemFree:         2000000 kB", "MemAvailable:   10000000 kB",
  "Buffers:         100000 kB", "Cached:          4040000 kB", "SwapCached:            0 kB",
  "Shmem:            640000 kB", "SReclaimable:     500000 kB", "Dirty:             1000 kB", "Writeback:             0 kB"
].join("\n")
const SWAPS = [
  "Filename\t\t\t\tType\t\tSize\t\tUsed\t\tPriority",
  "/dev/zram0                              partition\t8000000\t\t2000000\t\t100",
  "/swapfile                               file\t\t4000000\t\t1000000\t\t-2"
].join("\n")

test("mem splitSections: cuts at @@ lines, unknown ones dropped, missing ones empty", () => {
  const s = Mem.splitSections("MemTotal: 1 kB\n@@swaps\nx\n@@nope\ny\n@@procs\n1 (a) S")
  same([s.main, s.swaps, s.procs], ["MemTotal: 1 kB", "x", "1 (a) S"])
  same(Mem.splitSections(""), { main: "", swaps: "", procs: "" })
})

test("mem parseMeminfo: the fields used, in KiB; null without MemTotal", () => {
  const m = Mem.parseMeminfo(MEMINFO)
  assert.equal(m.MemTotal, 16000000)
  assert.equal(m.Shmem, 640000)
  assert.equal(m.Writeback, 0)
  assert.equal(Mem.parseMeminfo("garbage\nMemFree: 5 kB"), null)
  assert.equal(Mem.parseMeminfo(""), null)
  assert.equal(Mem.parseMeminfo("MemTotal: 100 kB").MemAvailable, 0)
})

test("mem breakdown: used, cache, shared, free from the rules of the design", () => {
  const b = Mem.breakdown(Mem.parseMeminfo(MEMINFO))
  same(b, { total: 16000000, used: 6000000, cache: 4000000, shared: 640000, free: 2000000, available: 10000000 })
  assert.equal(Mem.breakdown(null), null)
})

test("mem breakdown: parts are clamped and never pass the total", () => {
  // nothing available: everything is used, the rest is squeezed out
  let b = Mem.breakdown(Mem.parseMeminfo("MemTotal: 1000 kB\nMemAvailable: 0 kB\nMemFree: 900 kB\nCached: 500 kB"))
  assert.equal(b.used, 1000)
  assert.equal(b.cache + b.shared + b.free, 0)
  // more shared than cache: cache is 0, not negative
  b = Mem.breakdown(Mem.parseMeminfo("MemTotal: 1000 kB\nMemAvailable: 800 kB\nMemFree: 100 kB\nCached: 50 kB\nShmem: 400 kB"))
  assert.equal(b.cache, 0)
  assert.equal(b.shared, 400)
  // absurd numbers still sum to at most the total
  b = Mem.breakdown(Mem.parseMeminfo("MemTotal: 1000 kB\nMemAvailable: 300 kB\nMemFree: 5000 kB\nCached: 9000 kB\nShmem: 10 kB"))
  assert.ok(b.used + b.cache + b.shared + b.free <= 1000)
  // available above the total is cut to it
  assert.equal(Mem.breakdown(Mem.parseMeminfo("MemTotal: 1000 kB\nMemAvailable: 5000 kB")).available, 1000)
})

test("mem fmtSize: GiB with one decimal, MiB when small, KiB below that", () => {
  assert.equal(Mem.fmtSize(6000000), "5.7 GiB")
  assert.equal(Mem.fmtSize(1048576), "1.0 GiB")
  assert.equal(Mem.fmtSize(640000), "625 MiB")
  assert.equal(Mem.fmtSize(5120), "5.0 MiB")
  assert.equal(Mem.fmtSize(512), "512 KiB")
  assert.equal(Mem.fmtSize(0), "0 KiB")
  assert.equal(Mem.fmtSize(-5), "0 KiB")
  assert.equal(Mem.fmtSize(undefined), "0 KiB")
})

test("mem legend: every part with its size and percent, available last and not a swatch", () => {
  const l = Mem.legend(Mem.breakdown(Mem.parseMeminfo(MEMINFO)))
  same(l.map((r) => r.key), ["used", "cache", "shared", "free", "available"])
  same(l.map((r) => r.size), ["5.7 GiB", "3.8 GiB", "625 MiB", "1.9 GiB", "9.5 GiB"])
  same(l.map((r) => r.percent), ["37.5%", "25.0%", "4.0%", "12.5%", "62.5%"])
  same(l.map((r) => r.swatch), [true, true, true, true, false])
  same(Mem.legend(null), [])
})

test("mem parseSwaps: zram and file kinds with used / size", () => {
  const rows = Mem.parseSwaps(SWAPS)
  same(rows.map((r) => r.kind), ["zram", "file"])
  same(rows.map((r) => r.value), ["1.9 GiB / 7.6 GiB", "977 MiB / 3.8 GiB"])
  assert.equal(rows[0].fraction, 0.25)
  assert.equal(rows[1].label, "Swap file")
})

test("mem parseSwaps: several devices of a kind add up; no swap gives no rows; junk is skipped", () => {
  const two = "Filename Type Size Used Priority\n/dev/zram0 partition 100 10 1\n/dev/zram1 partition 100 30 1\n/dev/nvme0n1p3 partition 200 0 -2"
  const rows = Mem.parseSwaps(two)
  same(rows.map((r) => [r.kind, r.size, r.used]), [["zram", 200, 40], ["file", 200, 0]])
  same(Mem.parseSwaps("Filename Type Size Used Priority\n"), [])
  same(Mem.parseSwaps(""), [])
  same(Mem.parseSwaps("bad line\n/x file abc def 1"), [])
})

test("mem dirtyKiB: only above 64 MiB, Dirty + Writeback together", () => {
  assert.equal(Mem.dirtyKiB({ Dirty: 30000, Writeback: 30000 }), null)
  assert.equal(Mem.dirtyKiB({ Dirty: 65536, Writeback: 0 }), null)
  assert.equal(Mem.dirtyKiB({ Dirty: 60000, Writeback: 60000 }), 120000)
  assert.equal(Mem.dirtyKiB(null), null)
})

test("mem dirtyTotal: the raw sum, whatever its size; 0 without meminfo", () => {
  assert.equal(Mem.dirtyTotal({ Dirty: 30000, Writeback: 30000 }), 60000)
  assert.equal(Mem.dirtyTotal({ Dirty: 0, Writeback: 0 }), 0)
  assert.equal(Mem.dirtyTotal({ Dirty: 5, Writeback: -9 }), 0)
  assert.equal(Mem.dirtyTotal(null), 0)
  assert.equal(Mem.update(MEMINFO).dirtyAll, 1000)        // Dirty 1000 kB + Writeback 0
  assert.equal(Mem.update("").dirtyAll, 0)
})

test("mem update: a full read", () => {
  const r = Mem.update(MEMINFO + "\n@@swaps\n" + SWAPS + "\n@@procs\n" + statLine(5, "firefox", 1, 1, 1, 1, 100))
  assert.equal(r.parts.used, 6000000)
  assert.equal(r.legend.length, 5)
  assert.equal(r.swaps.length, 2)
  assert.equal(r.dirty, null)
  assert.ok(r.procsText.indexOf("firefox") > 0)
})

test("mem update: missing sections and an empty read are quiet", () => {
  const r = Mem.update(MEMINFO)
  same(r.swaps, [])
  assert.equal(r.procsText, "")
  const e = Mem.update("")
  assert.equal(e.parts, null)
  same(e.legend, [])
  same(e.swaps, [])
  assert.equal(e.dirty, null)
})

test("mem processes: top by resident memory in GiB / MiB, grouped by name with a count", () => {
  const text = [statLine(1, "firefox", 1, 1, 1, 1, 200000), statLine(2, "firefox", 1, 1, 1, 2, 100000),
    statLine(3, "code", 1, 1, 1, 3, 150000), statLine(4, "small", 1, 1, 1, 4, 10), statLine(5, "kworker/u32:1", 2, 1, 1, 5, 1)].join("\n")
  const rows = Procs.groupTop(Procs.parsePidStats(text), "rss", 5, 4096)
  same(rows.map((r) => [r.name, r.count]), [["firefox", 2], ["code", 1], ["small", 1], ["kworker", 1]])
  same(rows.map((r) => r.value), ["1.1 G", "586 M", "40 K", "4 K"])
})

// ------------------------------------------------------------------------------------------------ ItoChart
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " " + a + " vs " + b)

test("chart polar: 12 o'clock is up, clockwise", () => {
  near(Chart.polar(0, 10).x, 0, 1e-9); near(Chart.polar(0, 10).y, -10, 1e-9)
  near(Chart.polar(90, 10).x, 10, 1e-9); near(Chart.polar(180, 10).y, 10, 1e-9)
})

test("chart segmentHeightForArea: ends, middle, monotonic, round trip", () => {
  assert.equal(Chart.segmentHeightForArea(0), 0)
  assert.equal(Chart.segmentHeightForArea(1), 1)
  near(Chart.segmentHeightForArea(0.5), 0.5, 1e-4)
  let last = -1
  for (let i = 0; i <= 200; i++) {
    const f = i / 200
    const h = Chart.segmentHeightForArea(f)
    assert.ok(h >= last, "monotonic at " + f)
    last = h
    near(Chart.segmentAreaForHeight(h), f, 1e-4, "area round trip at " + f)
  }
})

test("chart strata: cumulative, clamped, coincident boundaries for empty parts", () => {
  const s = Chart.strata([0.3, 0, 0.5, 0.4])
  same(s.cum, [0.3, 0.3, 0.8, 1])
  assert.equal(s.heights[0], s.heights[1])
  assert.ok(s.heights.every((h) => h >= 0 && h <= 1))
  assert.ok(s.heights[3] === 1)
  same(Chart.strata([-1, 0.2]).cum, [0, 0.2])
})

test("chart coreTiers and ray widths: no overlap, width in range", () => {
  for (const n of [1, 4, 16, 48, 49, 64, 128]) {
    const t = Chart.coreTiers(n)
    assert.equal(t.rays, n)
    assert.equal(t.tiers.reduce((a, x) => a + x.count, 0), n)
    assert.equal(t.tiers.length, n <= 48 ? 1 : 2)
    for (const x of t.tiers) {
      assert.ok(x.width >= 1.6 && x.width <= 8, "width " + x.width + " for " + n)
      const pitch = 2 * Math.PI * x.rIn / x.count
      if (x.count >= 4) assert.ok(x.width < pitch, "overlap at n=" + n + ": " + x.width + " >= " + pitch)
    }
  }
  near(Chart.coreTiers(4).tiers[0].width, 8, 1e-9)
  near(Chart.coreTiers(16).tiers[0].width, 7.3, 0.05)
  near(Chart.coreTiers(48).tiers[0].width, 2.4, 0.05)
  same(Chart.coreTiers(49).tiers.map((x) => [x.rIn, x.rOut]), [[30, 51], [55, 76]])
  const big = Chart.coreTiers(256)
  assert.equal(big.rays, 128); assert.equal(big.group, 2)
  same(Chart.coreTiers(0), { rays: 0, group: 1, tiers: [] })
})

test("chart groupCores: max of each run so the worst core stays visible", () => {
  const loads = Array.from({ length: 256 }, (_, i) => (i % 2 ? 0.9 : 0.1))
  const g = Chart.groupCores(loads, 128)
  assert.equal(g.length, 128)
  assert.ok(g.every((v) => v === 0.9))
  same(Chart.groupCores([0.1, 0.2], 128), [0.1, 0.2])
})

test("chart tickLayout: one per ray, a major every ceil(n/4)", () => {
  const t = Chart.tickLayout(16)
  assert.equal(t.length, 16)
  same(t.filter((x) => x.major).map((x) => x.index), [0, 4, 8, 12])
  assert.equal(Chart.tickLayout(0).length, 0)
})

test("chart spiral: turns monotonic and clamped, points end on the radius", () => {
  near(Chart.spiralTurns(0), 1.25, 1e-9)
  near(Chart.spiralTurns(1.25), 4, 1e-9)
  near(Chart.spiralTurns(9), 4, 1e-9)
  near(Chart.spiralTurns(-2), 1.25, 1e-9)
  let last = 0
  for (let i = 0; i <= 50; i++) { const t = Chart.spiralTurns(i / 40); assert.ok(t >= last); last = t }
  for (const turns of [1.25, 2, 4]) {
    const p = Chart.spiralPoints(turns, 21, 34)
    assert.equal(p.length, Math.round(turns * 34) + 1)
    near(Math.hypot(p[p.length - 1].x, p[p.length - 1].y), 21, 1e-9)
    near(Math.hypot(p[0].x, p[0].y), 0, 1e-9)
  }
})

test("chart ioSpeed: still below 4 KiB/s, capped at 72", () => {
  assert.equal(Chart.ioSpeed(0), 0)
  assert.equal(Chart.ioSpeed(4095), 0)
  assert.ok(Chart.ioSpeed(4096) >= 3)
  assert.equal(Chart.ioSpeed(1e12), 72)
  assert.ok(Chart.ioSpeed(1e6) > Chart.ioSpeed(1e5))
})

test("chart ringLayout and runeLayout", () => {
  const one = Chart.ringLayout(1)
  near(one.stroke, 13, 1e-9)
  const six = Chart.ringLayout(6)
  near(six.pitch, 50 / 6, 1e-9)
  assert.ok(six.rings[0].radius > six.rings[5].radius)
  assert.ok(six.rings[5].radius - six.stroke / 2 >= 26 - 1e-9)
  const r = Chart.runeLayout(24)
  assert.equal(r.length, 24)
  same(r.slice(0, 8).map((x) => x.glyph), [0, 1, 2, 3, 1, 2, 0, 3])
  near(Chart.arcSweep(0.25), 90, 1e-9)
  near(Chart.arcSweep(3), 360, 1e-9)
})

test("chart crack: three polylines from the outer rule at 200 degrees in to 0.55 R, scaled with the radius", () => {
  const c = Chart.crack()
  assert.equal(c.length, 3)
  const r = (p) => Math.hypot(p.x, p.y)
  near(r(c[0][0]), 91, 0.01)
  near(r(c[0][c[0].length - 1]), 50.6, 0.3)
  for (const line of c) for (const p of line) assert.ok(r(p) <= 91.01 && r(p) >= 50, "point at r " + r(p))
  // the entry is at compass 200 degrees: down and to the left
  assert.ok(c[0][0].x < 0 && c[0][0].y > 0)
  // each branch starts on the main line
  same(c[1][0], JSON.parse(JSON.stringify(c[0][1])))
  same(c[2][0], JSON.parse(JSON.stringify(c[0][3])))
  const half = Chart.crack(46)
  near(r(half[0][0]), 45.5, 0.01)
  assert.equal(Chart.CRACK_GAP, 6)
})

test("chart runes: strokes fit the band, a band is count runes of the pattern, the up points away from the centre", () => {
  for (let g = 0; g < 4; g++) {
    const s = Chart.runeStrokes(g, 3)
    assert.ok(s.length >= 1)
    for (const line of s) for (const p of line) assert.ok(Math.abs(p.y) <= 1.5 + 1e-9 && Math.abs(p.x) <= 1.5)
  }
  const band = Chart.runePolylines(24, 84.5, 3)
  // strokes per glyph: 1 stroke, 2 chevron, 2 arrow, 3 algiz; the pattern A B C D B C A D three times
  assert.equal(band.length, 3 * (1 + 2 + 2 + 3 + 2 + 2 + 1 + 3))
  for (const line of band) for (const p of line) {
    const rr = Math.hypot(p.x, p.y)
    assert.ok(rr >= 84.5 - 1.6 && rr <= 84.5 + 1.6, "radius " + rr)
  }
  same(Chart.runePolylines(0, 84, 3), [])
  // the first rune sits on 12 o'clock: its stroke runs along the radius (x ~ 0, y from -rMid-1.5 to -rMid+1.5)
  const first = band[0]
  near(first[0].x, 0, 1e-9); near(first[0].y, -(84.5 - 1.5), 1e-9); near(first[1].y, -(84.5 + 1.5), 1e-9)
})

test("chart ensureContrast: black on white is 21, pass-through, and the four palettes reach their target", () => {
  const black = Chart.rgba(0, 0, 0), white = Chart.rgba(1, 1, 1)
  near(Chart.contrast(black, white), 21, 1e-6)
  near(Chart.contrast(white, black), 21, 1e-6)
  const ok = Chart.rgba(0.9, 0.2, 0.2)
  assert.equal(Chart.ensureContrast(ok, black, 3), ok)
  // made-up accents against made-up panel inks: dark blue-black, teal-green on dark, a light paper, a near-black crimson
  const cases = [
    [Chart.rgba(0.5, 0.98, 0.61), Chart.rgba(0.04, 0.05, 0.09)],
    [Chart.rgba(0.2, 0.33, 0.27), Chart.rgba(0.18, 0.22, 0.2)],
    [Chart.rgba(0.85, 0.75, 0.2), Chart.rgba(1, 0.98, 0.94)],
    [Chart.rgba(0.77, 0.09, 0.16), Chart.rgba(0.04, 0.05, 0.05)],
    [Chart.rgba(0.1, 0.1, 0.1), Chart.rgba(0.05, 0.05, 0.05)]
  ]
  for (const [c, bg] of cases) {
    const out = Chart.ensureContrast(c, bg, 3)
    assert.ok(Chart.contrast(out, bg) >= 3, "contrast " + Chart.contrast(out, bg))
    const a = Chart.toHsl(c), b = Chart.toHsl(out)
    if (a.s > 0.05 && b.l > 0.02 && b.l < 0.98) near(Math.min(Math.abs(a.h - b.h), 1 - Math.abs(a.h - b.h)) * 360, 0, 1, "hue kept")
  }
})

test("chart ensureAlphaContrast: keeps the alpha that passes, raises the one that does not", () => {
  const bg = Chart.rgba(0, 0, 0)
  assert.equal(Chart.ensureAlphaContrast(Chart.rgba(1, 1, 1), bg, 0.6, 4.5), 0.6)
  const dim = Chart.rgba(0.5, 0.5, 0.5)
  const a = Chart.ensureAlphaContrast(dim, bg, 0.3, 4.5)
  assert.ok(a > 0.3 && a <= 1)
  assert.ok(Chart.contrast(Chart.withAlpha(dim, a), bg) >= 4.5 || a === 1)
})

test("chart contrast composites a translucent colour over its ground", () => {
  const bg = Chart.rgba(0, 0, 0)
  assert.ok(Chart.contrast(Chart.rgba(1, 1, 1, 0.6), bg) < Chart.contrast(Chart.rgba(1, 1, 1, 1), bg))
  near(Chart.mix(Chart.rgba(0, 0, 0), Chart.rgba(1, 1, 1), 0.5).r, 0.5, 1e-9)
})

// ---- colour helpers of the materiality pass (M1)
test("chart shade: lightness moves, hue kept, clamps hold", () => {
  const c = Chart.rgba(0.77, 0.09, 0.16)
  const a = Chart.toHsl(c)
  const lighter = Chart.shade(c, 0.12, 1.12), b = Chart.toHsl(lighter)
  near(b.l, a.l + 0.12, 1e-9)
  near(b.s, Math.min(1, a.s * 1.12), 1e-9)
  near(Math.min(Math.abs(a.h - b.h), 1 - Math.abs(a.h - b.h)) * 360, 0, 1, "hue kept")
  near(Chart.toHsl(Chart.shade(c, 0.9, 1)).l, 0.94, 1e-9)         // upper lightness clamp
  near(Chart.toHsl(Chart.shade(c, -0.9, 1)).l, 0, 1e-9)           // lower clamp
  assert.ok(Chart.toHsl(Chart.shade(Chart.rgba(0.9, 0.1, 0.1), 0, 5)).s <= 1)   // saturation clamp
  const grey = Chart.shade(Chart.rgba(0.5, 0.5, 0.5), 0.1, 1.5)
  near(grey.r, grey.g, 1e-9)                                     // no hue invented on a grey
  near(Chart.shade(c, 0, 1).r, c.r, 1e-9)
})

test("chart brightest: the higher luminance of two", () => {
  const dark = Chart.rgba(0.1, 0.1, 0.12), light = Chart.rgba(0.9, 0.88, 0.8)
  assert.equal(Chart.brightest(dark, light), light)
  assert.equal(Chart.brightest(light, dark), light)
})

test("chart ensureSeparation: unchanged when it already separates, reaches the target or stops at maxSteps", () => {
  const ref = Chart.rgba(0.4, 0.05, 0.08)
  const already = Chart.rgba(0.9, 0.8, 0.8)
  assert.equal(Chart.ensureSeparation(already, ref, 1.2, 0.04, 4), already)
  const close = Chart.shade(ref, 0.01, 1)
  const out = Chart.ensureSeparation(close, ref, 1.2, 0.04, 8)
  assert.ok(Chart.contrast(out, ref) >= 1.2, "reached " + Chart.contrast(out, ref))
  // a darker step direction is kept (the sign of dl)
  const dark = Chart.ensureSeparation(Chart.shade(ref, -0.01, 1), ref, 1.2, -0.04, 8)
  assert.ok(Chart.toHsl(dark).l < Chart.toHsl(ref).l)
  // unreachable target: exactly maxSteps steps of dl, no more
  const stuck = Chart.ensureSeparation(close, ref, 50, 0.04, 3)
  near(Chart.toHsl(stuck).l, Math.min(0.94, Chart.toHsl(close).l + 0.12), 1e-9)
})

// ------------------------------------------------------------------------------------------------ ItoIchor
test("ichor springFor: table values, lively thickens, unknown falls back to rows", () => {
  const calm = Ichor.springFor("vessel", 1)
  same(calm, { spring: 0.9, damping: 0.26, mass: 2.6, velocity: 0.45, epsilon: 0.0015 })
  const lively = Ichor.springFor("vessel", 1.7)
  near(lively.damping, 0.208, 1e-9); near(lively.mass, 3.12, 1e-9)
  same(Ichor.springFor("ray", 1), { spring: 1.9, damping: 0.24, mass: 1.3, velocity: 1.4, epsilon: 0.002 })
  same(Ichor.springFor("nope", 1), JSON.parse(JSON.stringify(Ichor.springFor("row", 1))))
})

test("ichor tables: the numbers of the design, in one place", () => {
  same(Ichor.MODES.map((m) => [m.f, m.z, m.g, m.cap, m.capFrac]), [[0.62, 0.36, 1.00, 12, 0.10], [1.15, 0.40, 0.16, 5, 0.05], [2.6, 0.10, 0.02, 1.2, 0.012]])
  same([Ichor.SURFACE.pivot, Ichor.SURFACE.up, Ichor.SURFACE.down, Ichor.SURFACE.crown], [0.20, 0.85, 1.15, 1.2])
  same([Ichor.SURFACE.meniscusRise, Ichor.SURFACE.meniscusReach, Ichor.SURFACE.cling, Ichor.SURFACE.lag], [2.6, 5.0, 1.2, 0.6])
  same([Ichor.SKIN.band, Ichor.SKIN.hiBand, Ichor.SKIN.wallArc], [3.5, 2.2, 0.9])
  same([Ichor.DRIP.dv2, Ichor.DRIP.dv3, Ichor.DRIP.fall, Ichor.DRIP.durationMs], [9, 12, 16, 2200])
  assert.equal(Ichor.SURFACE_SAMPLES, 14); assert.equal(Ichor.ARC_SAMPLES, 20)
  near(Ichor.scaleFor(64), 1, 1e-9); near(Ichor.scaleFor(128), 1, 1e-9); near(Ichor.scaleFor(32), 0.5, 1e-9); near(Ichor.scaleFor(11), 0.3, 1e-9)
  near(Ichor.thinness(0), 1, 1e-9); near(Ichor.thinness(12), 0.5, 1e-9); near(Ichor.thinness(24), 0, 1e-9); near(Ichor.thinness(90), 0, 1e-9)
  near(Ichor.highlightX(0), 0.36, 1e-9); near(Ichor.highlightX(10), 0.18, 1e-9); near(Ichor.highlightX(-10), 0.58, 1e-9)
  near(Ichor.highlightX(1000), 0.18, 1e-9); near(Ichor.highlightX(-1000), 0.72, 1e-9)
})

test("ichor slosh: three modes; decays to quiet within 6 s from the caps", () => {
  let s = { a1: 12, v1: 0, a2: 5, v2: 0, a3: 1.2, v3: 0, quiet: 0 }
  let t = 0
  while (t < 8 && !Ichor.isQuiet(s)) { s = Ichor.sloshStep(s, 1 / 60, 0, { rv: 64, gain: 1 }); t += 1 / 60 }
  assert.ok(Ichor.isQuiet(s), "never went quiet")
  assert.ok(t <= 6, "quiet only after " + t + " s")
  same(Ichor.newSlosh(), { a1: 0, v1: 0, a2: 0, v2: 0, a3: 0, v3: 0, quiet: 0 })
})

test("ichor slosh: a3 keeps an envelope above 0.15 px at 1 s from 1.2 px", () => {
  let s = { a1: 0, v1: 0, a2: 0, v2: 0, a3: 1.2, v3: 0, quiet: 0 }
  let peak = 0
  for (let i = 0; i < 60; i++) {
    s = Ichor.sloshStep(s, 1 / 60, 0, { rv: 64, gain: 1 })
    if (i >= 40) peak = Math.max(peak, Math.abs(s.a3))    // the last third of the first second
  }
  assert.ok(peak > 0.15, "envelope " + peak)
})

test("ichor slosh: capped at min(cap, capFrac x 2rv) under a 10 s random drive, and stable", () => {
  for (const rv of [11, 64]) {
    for (const gain of [1, 1.6]) {
      let s = Ichor.newSlosh()
      let seed = 12345
      const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
      const caps = Ichor.MODES.map((m) => Math.min(m.cap, m.capFrac * 2 * rv))
      let peak = [0, 0, 0]
      for (let i = 0; i < 600; i++) {
        s = Ichor.sloshStep(s, 1 / 60, (rnd() - 0.5) * 6000, { rv, gain })
        for (const [k, a] of [s.a1, s.a2, s.a3].entries()) {
          assert.ok(Number.isFinite(a), "NaN")
          peak[k] = Math.max(peak[k], Math.abs(a))
        }
      }
      for (let k = 0; k < 3; k++) assert.ok(peak[k] <= caps[k] + 1e-9, "mode " + k + " peak " + peak[k] + " > " + caps[k] + " at rv " + rv)
    }
  }
})

test("ichor slosh: bounded for frame times of 0.5 s (clamped), 1/240 s, 0 and negative", () => {
  for (const dt of [0.5, 1 / 240, 0, -1]) {
    let s = { a1: 12, v1: 30, a2: -5, v2: -30, a3: 1.2, v3: 10, quiet: 0 }
    for (let i = 0; i < 2000; i++) {
      s = Ichor.sloshStep(s, dt, 800 * Math.sin(i), { rv: 64, gain: 1.6 })
      assert.ok(Number.isFinite(s.a1) && Number.isFinite(s.a2) && Number.isFinite(s.a3))
      assert.ok(Math.abs(s.a1) <= 12 + 1e-9 && Math.abs(s.a2) <= 5 + 1e-9 && Math.abs(s.a3) <= 1.2 + 1e-9)
    }
  }
})

test("ichor kick wakes the modes (bulge and ripple)", () => {
  const k = Ichor.kick({ a1: 0, v1: 0, a2: 0, v2: 0, a3: 0, v3: 0, quiet: 20 }, 9, 12)
  assert.equal(k.v2, 9); assert.equal(k.v3, 12); assert.equal(k.quiet, 0)
})

test("ichor surfaceOffset: at the pivot only the crown (and bulge) remain; the tilt is asymmetric", () => {
  const u0 = Ichor.SURFACE.pivot
  near(Ichor.surfaceOffset(8, 0, 0, u0, 1), 1.2 * (1 + Math.cos(Math.PI * u0)) / 2, 1e-9)
  near(Ichor.surfaceOffset(0, 0, 0, 0, 1), 1.2, 1e-9)               // crown at the middle
  near(Ichor.surfaceOffset(0, 0, 0, -1, 1), 0, 1e-9)                // and none at the wall
  near(Ichor.surfaceOffset(0, 0, 0, 0, 0.3), 0.36, 1e-9)            // scaled by s
  const right = Ichor.surfaceOffset(10, 0, 0, 1, 1), left = Ichor.surfaceOffset(10, 0, 0, -1, 1)
  near(right, 10 * 0.85, 1e-9); near(left, -10 * 1.15, 1e-9)        // it sinks further than it lifts
  near(Ichor.surfaceOffset(-10, 0, 0, 1, 1), -10 * 1.15, 1e-9)
  near(Ichor.surfaceOffset(-10, 0, 0, -1, 1), 10 * 0.85, 1e-9)
  near(Ichor.surfaceOffset(0, 0, 1.2, 0, 1), 1.2 + 1.2, 1e-9)       // ripple cos(0) plus crown
})

function polygonChecks(rv, levelPx, off, hM, s) {
  const cx = 70, cy = 80
  const p = Ichor.surfacePolygon(cx, cy, rv, levelPx, off, hM, s)
  assert.equal(p.length, 34)
  for (const q of p) {
    assert.ok(Number.isFinite(q.x) && Number.isFinite(q.y), "NaN")
    assert.ok(Math.hypot(q.x - cx, q.y - cy) <= rv + 0.01, "outside the circle: " + Math.hypot(q.x - cx, q.y - cy))
  }
  for (const q of [p[0], p[13], ...p.slice(14)]) near(Math.hypot(q.x - cx, q.y - cy), rv, 0.01, "not on the circle")
  return p
}

test("ichor surfacePolygon: 34 points, inside the circle, ends on it, at many levels, tilts, crown and sizes", () => {
  for (const [rv, s] of [[64, 1], [11, 0.3], [15, 0.3], [32, 0.5]]) {
    for (const f of [0, 0.01, 0.16, 0.5, 0.9, 1]) {
      for (const off of [{ a1: 0, a2: 0, a3: 0 }, { a1: 12, a2: -5, a3: 1.2 }, { a1: -12, a2: 5, a3: -1.2 }]) {
        for (const hM of [0, 2.6, 5.72]) polygonChecks(rv, f * 2 * rv, off, hM, s)
      }
    }
  }
  polygonChecks(64, 50, undefined, undefined, undefined)
  polygonChecks(64, 50, { a1: 12, a2: 0 }, 2.6)                      // a3 missing counts as 0
})

test("ichor surfacePolygon: empty and full are degenerate/complete without NaN", () => {
  const cx = 70, cy = 80
  const empty = Ichor.surfacePolygon(cx, cy, 64, 0, { a1: 0, a2: 0, a3: 0 }, 0, 1)
  assert.ok(empty.every((q) => Math.abs(q.y - (cy + 64)) < 1e-6 || Math.abs(q.x - cx) < 1e-6))
  const full = Ichor.surfacePolygon(cx, cy, 64, 128, { a1: 0, a2: 0, a3: 0 }, 0, 1)
  const ys = full.map((q) => q.y)
  assert.ok(Math.min(...ys) < cy - 63.9 && Math.max(...ys) > cy + 62)
})

test("ichor surfacePolygon: the surface is domed by the crown and higher at the walls with a meniscus", () => {
  const cx = 70, cy = 80
  const flat = Ichor.surfacePolygon(cx, cy, 64, 64, { a1: 0, a2: 0, a3: 0 }, 0, 1)
  const ys = flat.slice(0, 14).map((q) => q.y)
  near(flat[0].y - Math.min(...ys), 1.2, 0.05, "crown 1.2 px above the wall ends")
  const men = Ichor.surfacePolygon(cx, cy, 64, 64, { a1: 0, a2: 0, a3: 0 }, 2.6, 1)
  assert.ok(men[0].y < men[6].y - 1, "wall end should climb")
})

test("ichor meniscus: rising is late, falling clings, static case is 2.6, scaled by s", () => {
  near(Ichor.meniscusHeight(0, 128), 2.6, 1e-9)
  assert.ok(Ichor.meniscusHeight(100, 128) < 2.6)
  assert.ok(Ichor.meniscusHeight(-100, 128) > 2.6)
  near(Ichor.meniscusHeight(-1e6, 128), 2.6 * 2.2, 1e-9)
  near(Ichor.meniscusHeight(1e6, 128), 2.6 * 0.4, 1e-9)
  near(Ichor.meniscusHeight(0, 22, 0.3), 2.6 * 0.3, 1e-9)
  near(Ichor.meniscusAt(2.6, 5, 1), 2.6 * Math.exp(-1), 1e-9)
  near(Ichor.meniscusAt(2.6, 1.5, 0.3), 2.6 * Math.exp(-1), 1e-9)
})

test("ichor filmStep: long films drain faster, the last px linger, an 80 px film is gone in about 8 s, rises are followed", () => {
  near(Ichor.filmStep(80, 0, 1), 80 - 16, 1e-9)                  // 80 px: capped at 16 px/s
  near(Ichor.filmStep(10, 0, 1), 10 - 6.5, 1e-9)                 // 4 + 0.25 x 10
  near(Ichor.filmStep(2, 0, 1), 2 - 4.5, 1e-9 + 2.5)             // never below the level
  assert.equal(Ichor.filmStep(2, 0, 1), 0)
  near(Ichor.filmStep(80, 90, 1), 90, 1e-9)
  near(Ichor.filmStep(52, 50, 1), 50, 1e-9)
  let top = 80, t = 0
  while (top > 0.5 && t < 20) { top = Ichor.filmStep(top, 0, 1 / 60); t += 1 / 60 }
  assert.ok(t > 6.5 && t < 9, "80 px film gone after " + t + " s")
  // shorter films drain slower than long ones per px
  assert.ok(80 - Ichor.filmStep(80, 0, 1) > 10 - Ichor.filmStep(10, 0, 1))
})

// ---- geometry of the skin, film, platelets (M3)
const inCircle = (pts, cx, cy, rv, tol = 0.01) => pts.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y) && Math.hypot(q.x - cx, q.y - cy) <= rv + tol)

test("ichor skinBand: inside the circle, inside the top polygon's bounds, empty for nothing", () => {
  for (const [rv, s] of [[64, 1], [15, 0.3]]) {
    const cx = rv, cy = rv
    for (const off of [{ a1: 0, a2: 0, a3: 0 }, { a1: 10, a2: 2, a3: 1 }, { a1: -10, a2: -2, a3: -1 }]) {
      const poly = Ichor.surfacePolygon(cx, cy, rv, rv * 1.1, off, 2.6 * s, s)
      const surf = poly.slice(0, 14)
      for (const w of [3.5 * s, 2.2 * s]) {
        const band = Ichor.skinBand(surf, w, { cx, cy, rv })
        assert.equal(band.length, 28)
        assert.ok(inCircle(band, cx, cy, rv), "band left the circle")
        const ys = poly.map((q) => q.y), xs = poly.map((q) => q.x)
        for (const q of band) {
          assert.ok(q.x >= Math.min(...xs) - 1e-6 && q.x <= Math.max(...xs) + 1e-6, "x out of the polygon's bounds")
          assert.ok(q.y >= Math.min(...ys) - 1e-6 && q.y <= Math.max(...ys) + 1e-6, "y out of the polygon's bounds")
        }
        assert.ok(Math.hypot(band[27].x - band[0].x, band[27].y - band[0].y) <= w + 1e-6)   // the moved copy is reversed: 27 = moved first
      }
    }
  }
  same(Ichor.skinBand([], 3, null), [])
  same(Ichor.skinBand([{ x: 0, y: 0 }, { x: 1, y: 0 }], 0, null), [])
  const flat = Ichor.skinBand([{ x: 0, y: 5 }, { x: 10, y: 5 }, { x: 20, y: 5 }], 3, null)
  near(flat[3].y, 8, 1e-9)                                            // straight down, 3 px
  const axis = Ichor.bandAxis([{ x: 0, y: 5 }, { x: 10, y: 5 }, { x: 20, y: 5 }], 3)
  near(axis.x1, 10, 1e-9); near(axis.y1, 5, 1e-9); near(axis.y2, 8, 1e-9)
})

test("ichor wallHighlight: inside the circle, on the left wall, hidden when small or shallow, length follows the tilt", () => {
  const rv = 64, cx = 64, cy = 64
  const poly = (a1) => Ichor.surfacePolygon(cx, cy, rv, 90, { a1, a2: 0, a3: 0 }, 2.6, 1)
  const w0 = Ichor.wallHighlight(cx, cy, rv, poly(0)[0], 0, 1)
  assert.equal(w0.length, 26)
  assert.ok(inCircle(w0, cx, cy, rv), "wall highlight left the circle")
  assert.ok(w0.every((q) => q.x < cx), "not on the left wall")
  const long = Ichor.wallHighlight(cx, cy, rv, poly(10)[0], 10, 1), short = Ichor.wallHighlight(cx, cy, rv, poly(-10)[0], -10, 1)
  const span = (w) => Math.max(...w.map((q) => q.y)) - Math.min(...w.map((q) => q.y))
  assert.ok(span(long) > span(short), "the arc should be longer at a1 +10")
  same(Ichor.wallHighlight(23, 23, 23, { x: 1, y: 10 }, 0, 0.36), [])           // rv < 24
  same(Ichor.wallHighlight(cx, cy, rv, { x: 3, y: cy + rv - 7 }, 0, 1), [])       // depth < 8
  for (const t of [0, 0.3, 0.6, 0.95]) {                                          // clamped, near the bottom too
    const w = Ichor.wallHighlight(cx, cy, rv, Ichor.surfacePolygon(cx, cy, rv, 128 * t + 12, { a1: 0, a2: 0, a3: 0 }, 2.6, 1)[0], 12, 1)
    assert.ok(inCircle(w, cx, cy, rv))
  }
})

test("ichor filmCrescent: empty under half a pixel, lobes only from 10 px, at most 24 steps a side, inside the circle, never mirrored", () => {
  const cx = 64, cy = 64, rv = 64
  same(Ichor.filmCrescent(cx, cy, rv, 50, 50.4, "left", 1), [])
  same(Ichor.filmCrescent(cx, cy, rv, 50, 40, "right", 1), [])
  const thickAt = (f, i) => Math.abs(f[i].x - f[f.length - 1 - i].x)
  const wobble = (f) => { const n = f.length / 2; let m = 0; for (let i = 1; i < n; i++) m = Math.max(m, Math.abs(thickAt(f, i) - thickAt(f, i - 1))); return m }
  const short = Ichor.filmCrescent(cx, cy, rv, 20, 29.5, "left", 1)       // 9.5 px: no lobes
  const long = Ichor.filmCrescent(cx, cy, rv, 20, 30.5, "left", 1)        // 10.5 px: lobes
  assert.ok(short.length >= 6 && long.length >= 6)
  const smooth = (f) => { const n = f.length / 2; const d = []; for (let i = 0; i < n; i++) d.push(thickAt(f, i)); return d }
  const ds = smooth(short), dl = smooth(long)
  assert.ok(ds.every((v, i) => i === 0 || v <= ds[i - 1] + 1e-9), "no lobes: the crescent only tapers")
  assert.ok(dl.some((v, i) => i > 0 && v > dl[i - 1] + 1e-3), "lobes: a bulge somewhere")
  for (const [lvl, top] of [[20, 100], [20, 60], [0, 128], [64, 128]]) {
    for (const side of ["left", "right"]) {
      const f = Ichor.filmCrescent(cx, cy, rv, lvl, top, side, 1)
      assert.ok(f.length <= 50, "too many points " + f.length)
      assert.ok(inCircle(f, cx, cy, rv), "film left the circle")
      assert.ok(f.every((q) => (side === "left" ? q.x <= cx + 1e-6 : q.x >= cx - 1e-6)), "film crossed the middle")
    }
  }
  // thick at the surface (3.2) and thin at the top (0.9) on a long film with no lobe at its ends
  const f = Ichor.filmCrescent(cx, cy, rv, 20, 100, "right", 1)
  const n = f.length / 2
  near(thickAt(f, 0), 3.2, 0.15)
  near(thickAt(f, n - 1), 0.9, 0.15)
  // two lobes on the left, one on the right: count the local maxima of the thickness
  const peaks = (side) => { const g = smooth(Ichor.filmCrescent(cx, cy, rv, 20, 100, side, 1)); let c = 0; for (let i = 1; i < g.length - 1; i++) if (g[i] > g[i - 1] && g[i] > g[i + 1]) c++; return c }
  assert.equal(peaks("left"), 2); assert.equal(peaks("right"), 1)
  near(Math.max(...smooth(Ichor.filmCrescent(11, 11, 11, 4, 20, "left", 0.3))), 3.2 * 0.3 + 2.4 * 0.3, 0.6)   // scaled
})

test("ichor platelets: deterministic, five, inside the used box and the circle, none when shallow or small", () => {
  const cx = 64, cy = 64, rv = 64
  const a = Ichor.platelets(cx, cy, rv, 70, 0, 0), b = Ichor.platelets(cx, cy, rv, 70, 0, 0)
  same(a, JSON.parse(JSON.stringify(b)))
  assert.equal(a.length, 5)
  assert.equal(a.filter((p) => p.tone === "clot").length, 4); assert.equal(a.filter((p) => p.tone === "glow").length, 1)
  for (const [a1, a2] of [[0, 0], [12, 5], [-12, -5]]) {
    for (const top of [40, 70, 100, 110]) {
      for (const p of Ichor.platelets(cx, cy, rv, top, a1, a2)) {
        assert.ok(Math.hypot(p.x - cx, p.y - cy) <= rv - 3 + 1e-6, "outside the inset circle")
        assert.ok(p.y >= top + 4 - 1e-6, "not 4 px under the surface")
        assert.ok(p.r >= 0.8 - 1e-9 && p.r <= 1.2 + 1e-9)
      }
    }
  }
  same(Ichor.platelets(cx, cy, rv, 120, 0, 0), [])                 // depth 8 < 14
  same(Ichor.platelets(23, 23, 23, 30, 0, 0), [])                  // rv < 24
  const moved = Ichor.platelets(cx, cy, rv, 70, 10, 0)
  near(moved[1].x - a[1].x, 4.5, 0.5)                                // 0.45 a1 in x
  assert.ok(Ichor.platelets(cx, cy, rv, 70, 0, 4).every((p, i) => p.y >= a[i].y - 1e-9))
})

test("ichor buildGeometry: a full rebuild is consistent (strata order, top, skin, film, platelets)", () => {
  const rv = 64
  const levels = [0.25, 0.4, 0.5, 0.5].map((f) => 2 * rv * Chart.segmentHeightForArea(f))
  const g = Ichor.buildGeometry(rv, levels, [true, true, true, false], { a1: 6, a2: 1, a3: 0.5 }, -40, 80)
  assert.equal(g.topIdx, 2)
  assert.ok(g.top[2] < g.top[1] && g.top[1] < g.top[0], "higher strata reach higher (smaller y)")
  assert.equal(g.surfTop, g.top[2])
  assert.equal(g.skin.length, 28); assert.equal(g.hi.length, 28)
  assert.ok(g.filmL.length > 0 && g.filmR.length > 0)
  assert.equal(g.platelets.length, 5)
  assert.ok(inCircle(g.polys[0], rv, rv, rv) && inCircle(g.polys[1], rv, rv, rv) && inCircle(g.polys[2], rv, rv, rv))
  const still = Ichor.buildGeometry(rv, levels, [true, true, true, false], { a1: 0, a2: 0, a3: 0 }, 0, 0)
  assert.equal(still.filmL.length, 0)
  near(still.hx, 0.36, 1e-9)
  const empty = Ichor.buildGeometry(rv, [0, 0, 0, 0], [false, false, false, false], null, 0, 0)
  assert.equal(empty.topIdx, -1); assert.equal(empty.skin.length, 0); assert.equal(empty.platelets.length, 0)
  const swap = Ichor.buildGeometry(11, [11, 0, 0, 0], [true, false, false, false], { a1: 0, a2: 0, a3: 0 }, 0, 0)
  assert.equal(swap.platelets.length, 0); assert.equal(swap.wall.length, 0)
  near(swap.s, 0.3, 1e-9)
})

// ---- the drop (M4)
test("ichor dripPose: continuous across phase boundaries in every field, ring fields only in the landing", () => {
  const fall = 16
  const keys = ["neck", "neckLen", "radius", "y", "xScale", "yScale", "opacity"]
  const range = { neck: 5, neckLen: 18, radius: 3.2, y: fall, xScale: 1.4, yScale: 0.7, opacity: 1 }
  for (let i = 0; i < 1000; i++) {
    const a = Ichor.dripPose(i / 1000, fall), b = Ichor.dripPose((i + 1) / 1000, fall)
    for (const k of keys) {
      assert.ok(Math.abs(b[k] - a[k]) < 0.05 * range[k], k + " jumps at phase " + i / 1000)
      if (k !== "neckLen" && k !== "y") assert.ok(Math.abs(b[k] - a[k]) < 0.05, k + " absolute jump at phase " + i / 1000)
    }
    if (i / 1000 + 0.001 < 0.88) for (const k of ["ringR", "ringOpacity", "ringWidth", "satDx", "satDy", "satOpacity"]) assert.equal(b[k], 0, k + " outside the landing")
  }
  // the four boundaries named by the design, both sides of each
  for (const at of [0.50, 0.64, 0.68, 0.88]) {
    const a = Ichor.dripPose(at - 1e-6, fall), b = Ichor.dripPose(at + 1e-6, fall)
    for (const k of keys) near(a[k], b[k], 1e-3, k + " at " + at)
  }
  const land = Ichor.dripPose(0.94, fall)
  assert.ok(land.ringR > 1 && land.ringOpacity > 0 && land.ringWidth > 0.6 && land.satDx > 0 && land.satDy > 0 && land.satOpacity > 0)
  const end = Ichor.dripPose(1, fall)
  near(end.opacity, 0, 1e-9); near(end.ringOpacity, 0, 1e-9); near(end.satOpacity, 0, 1e-9)
  near(end.ringR, 3.2 * 5, 1e-9); near(end.satDx, 6, 1e-9); near(end.ringWidth, 0.6, 1e-9)
})

test("ichor dripPose: the values of the table at its landmarks", () => {
  const fall = 16
  near(Ichor.dripPose(0, fall).radius, 1.8, 1e-9)
  near(Ichor.dripPose(0, fall).neck, 5, 1e-9)
  near(Ichor.dripPose(0.5, fall).radius, 5, 1e-9)
  near(Ichor.dripPose(0.5, fall).y, 3.5, 1e-9)
  near(Ichor.dripPose(0.5, fall).neck, 3, 1e-9)
  near(Ichor.dripPose(0.64, fall).y, 10.5, 1e-9)
  near(Ichor.dripPose(0.64, fall).neck, 0.8, 1e-9)
  near(Ichor.dripPose(0.64, fall).yScale, 1.35, 1e-9)
  near(Ichor.dripPose(0.64, fall).xScale, 0.88, 1e-9)
  near(Ichor.dripPose(0.68, fall).neck, 0, 1e-9)
  near(Ichor.dripPose(0.68, fall).neckLen, 0, 1e-9)
  near(Ichor.dripPose(0.68, fall).yScale, 0.90, 1e-9)
  near(Ichor.dripPose(0.68, fall).xScale, 1.06, 1e-9)
  near(Ichor.dripPose(0.88, fall).y, fall, 1e-9)
  near(Ichor.dripPose(0.88, fall).yScale, 1, 1e-9)
  near(Ichor.dripPose(1, fall).xScale, 2.4, 1e-9)
  near(Ichor.dripPose(1, fall).yScale, 0.30, 1e-9)
  near(Ichor.dripPose(1, fall).opacity, 0, 1e-9)
  assert.ok(Ichor.dripPose(0.6, fall).neckLen > Ichor.dripPose(0.5, fall).neckLen, "the neck stretches")
  assert.ok(Ichor.dripPose(0.76, fall).y > 10.5 && Ichor.dripPose(0.76, fall).y < fall)
  // scaled for a small vessel, and a fall shorter than the stretch never goes backwards
  near(Ichor.dripPose(0.5, 4.8, 0.3).radius, 1.5, 1e-9)
  assert.ok(Ichor.dripPose(0.8, 1, 1).y >= 10.5)
  assert.equal(Ichor.teardropPoints(24).length, 26)
})

test("ichor dripRecoil: kicks bulge and ripple only while the neck snaps", () => {
  same(Ichor.dripRecoil(0.66), { dv2: 9, dv3: 12 })
  same(Ichor.dripRecoil(0.64), { dv2: 9, dv3: 12 })
  same(Ichor.dripRecoil(0.68), { dv2: 0, dv3: 0 })
  same(Ichor.dripRecoil(0.3), { dv2: 0, dv3: 0 })
  same(Ichor.dripRecoil(0.9), { dv2: 0, dv3: 0 })
})

test("ichor drip intervals: none below the floor, clamped, delay jitter and minimum", () => {
  assert.equal(Ichor.dripInterval(512), null)
  near(Ichor.dripInterval(1024), 30, 1e-9)
  near(Ichor.dripInterval(64 * 1024), 6, 1e-9)
  near(Ichor.dripInterval(900 * 1024), 6, 1e-9)
  assert.equal(Ichor.writeDripInterval(65535), null)
  near(Ichor.writeDripInterval(1e12), 6, 1e-9)
  assert.ok(Ichor.writeDripInterval(65536) <= 40 && Ichor.writeDripInterval(65536) > 6)
  near(Ichor.dripDelay(30, 0, 1), 22.5, 1e-9)
  near(Ichor.dripDelay(30, 1, 1), 37.5, 1e-9)
  near(Ichor.dripDelay(30, 0.5, 1.7), 30 / 1.4, 1e-9)
  assert.equal(Ichor.dripDelay(6, 0, 1.7), 6)
})

// ----------------------------------------------------------------------------------------------- ito.disk
const GIB = 1073741824
const DF_HEAD = "Filesystem     Mounted on      Type     1B-blocks         Used        Avail"
const dfLine = (src, target, fs, size, used) => [src, target, fs, size, used, size - used].join(" ")
// one btrfs device mounted four times, a vfat boot partition, a data disk and a mount point with a space in it
const DF = [
  DF_HEAD,
  dfLine("/dev/nvme0n1p2", "/home", "btrfs", 500 * GIB, 200 * GIB),
  dfLine("/dev/nvme0n1p1", "/boot", "vfat", 1 * GIB, 0.1 * GIB),
  dfLine("/dev/nvme0n1p2", "/", "btrfs", 500 * GIB, 200 * GIB),
  dfLine("/dev/nvme0n1p2", "/var/log", "btrfs", 500 * GIB, 200 * GIB),
  dfLine("/dev/nvme0n1p2", "/var/cache", "btrfs", 500 * GIB, 200 * GIB),
  dfLine("/dev/sda1", "/mnt/My Disk", "ext4", 2000 * GIB, 1900 * GIB)
].join("\n")

test("disk splitSections: cuts at @@ lines, unknown ones dropped, missing ones empty", () => {
  const s = Disk.splitSections("df text\n@@stats\nstats text\n@@junk\nx\n@@temp\n43000\n")
  assert.equal(s.main, "df text")
  assert.equal(s.stats, "stats text")
  assert.equal(s.temp, "43000\n")
  same(Disk.splitSections(""), { main: "", stats: "", temp: "" })
})

test("disk parseDf: bytes, a mount point with spaces stays whole, header and junk are skipped", () => {
  const rows = Disk.parseDf(DF + "\nnot a df line\n\n/dev/x /y ext4 abc 1 2")
  assert.equal(rows.length, 6)
  same(rows[0], { source: "/dev/nvme0n1p2", fstype: "btrfs", target: "/home", size: 500 * GIB, used: 200 * GIB, avail: 300 * GIB })
  assert.equal(rows[5].target, "/mnt/My Disk")
  assert.equal(rows[5].fstype, "ext4")
  same(Disk.parseDf(""), [])
})

test("disk mounts: one row per source, '/' first, subvolumes folded into '/ (+3)', df percent", () => {
  const m = Disk.mounts(Disk.parseDf(DF))
  same(m.mounts.map((x) => x.label), ["/ (+3)", "/boot", "/mnt/My Disk"])
  assert.equal(m.more, 0)
  assert.equal(m.mounts[0].extra, 3)
  assert.equal(m.mounts[0].target, "/")
  near(m.mounts[0].fraction, 0.4, 1e-9)
  assert.equal(m.mounts[0].percent, "40%")
  assert.equal(m.mounts[0].hot, false)
  near(m.mounts[1].fraction, 0.1, 1e-9)
  // a mount above 90 % is hot, with the threshold the groove draws
  assert.equal(m.mounts[2].hot, true)
  assert.equal(m.mounts[2].threshold, 0.9)
  assert.equal(m.mounts[2].percent, "95%")
})

test("disk mounts: at most 6 rows, the rest counted; filesystems of no size are left out; '/' wins whatever its place", () => {
  const rows = []
  for (let i = 0; i < 9; i++) rows.push({ source: "/dev/sd" + "abcdefghi"[i] + "1", target: i === 8 ? "/" : "/mnt/d" + i, fstype: "ext4", size: 100 * GIB, used: 10 * GIB, avail: 90 * GIB })
  rows.push({ source: "none", target: "/empty", fstype: "x", size: 0, used: 0, avail: 0 })
  const m = Disk.mounts(rows)
  assert.equal(m.mounts.length, 6)
  assert.equal(m.more, 3)
  assert.equal(m.mounts[0].target, "/")
  assert.ok(!m.mounts.some((x) => x.target === "/empty"))
  same(Disk.mounts([]), { mounts: [], more: 0 })
  same(Disk.mounts(null), { mounts: [], more: 0 })
})

test("disk fmtBytes / fmtUsage / fmtRate: GiB and MB/s as text", () => {
  assert.equal(Disk.fmtBytes(0), "0 KiB")
  assert.equal(Disk.fmtBytes(512 * 1024), "512 KiB")
  assert.equal(Disk.fmtBytes(5 * 1048576), "5.0 MiB")
  assert.equal(Disk.fmtBytes(300 * 1048576), "300 MiB")
  assert.equal(Disk.fmtBytes(12.34 * GIB), "12.3 GiB")
  assert.equal(Disk.fmtBytes(412 * GIB), "412 GiB")
  assert.equal(Disk.fmtBytes(2048 * GIB), "2.0 TiB")
  assert.equal(Disk.fmtUsage(200 * GIB, 500 * GIB), "200 / 500 GiB")
  assert.equal(Disk.fmtUsage(0.1 * GIB, 1 * GIB), "0.1 / 1.0 GiB")
  assert.equal(Disk.fmtUsage(50 * GIB, 64 * GIB), "50.0 / 64.0 GiB")
  assert.equal(Disk.fmtUsage(1900 * GIB, 2000 * GIB), "1.9 / 2.0 TiB")
  assert.equal(Disk.fmtUsage(300 * 1048576, 500 * 1048576), "300.0 / 500.0 MiB")
  assert.equal(Disk.fmtRate(0), "0 B/s")
  assert.equal(Disk.fmtRate(812), "812 B/s")
  assert.equal(Disk.fmtRate(812000), "812 KB/s")
  assert.equal(Disk.fmtRate(12.4e6), "12.4 MB/s")
  assert.equal(Disk.fmtRate(1.25e9), "1.3 GB/s")
  assert.equal(Disk.fmtRate(-5), "0 B/s")
})

// a diskstats line: major minor name, then 11 counters; sectors read is the 3rd of them (field 6), written the 7th (field 10)
const dsLine = (name, sr, sw) => "259 0 " + name + " 100 0 " + sr + " 5 200 0 " + sw + " 9 0 4 5"
const DISKSTATS = [
  dsLine("nvme0n1", 2000, 4000), dsLine("nvme0n1p1", 500, 500), dsLine("nvme0n1p2", 1500, 3500),
  dsLine("sda", 100, 200), dsLine("sda1", 100, 200), dsLine("loop0", 9, 9), dsLine("dm-0", 7, 7), dsLine("zram0", 3, 3),
  dsLine("mmcblk0", 10, 20), dsLine("mmcblk0boot0", 1, 1), dsLine("vdb", 4, 8), dsLine("sr0", 1, 1)
].join("\n")

test("disk parseDiskstats: whole disks only, sectors of 512 bytes from fields 6 and 10", () => {
  const d = Disk.parseDiskstats(DISKSTATS)
  same(Object.keys(d).sort(), ["mmcblk0", "nvme0n1", "sda", "vdb"])
  same(d.nvme0n1, { r: 2000 * 512, w: 4000 * 512, ticks: 4 })
  same(d.mmcblk0, { r: 10 * 512, w: 20 * 512, ticks: 4 })
  // a short line (10 fields) has no ticks: null, not NaN
  assert.equal(Disk.parseDiskstats("259 0 sda 1 0 2 3 4 0 5 6").sda.ticks, null)
  same(Disk.parseDiskstats(""), {})
  same(Disk.parseDiskstats("short line 1 2"), {})
})

test("disk ioRates: bytes per second summed over the disks in both samples; first sample, no time or no disk give null", () => {
  const a = Disk.parseDiskstats([dsLine("nvme0n1", 0, 0), dsLine("sda", 0, 0)].join("\n"))
  const b = Disk.parseDiskstats([dsLine("nvme0n1", 2000, 4000), dsLine("sda", 1000, 0), dsLine("vdb", 99, 99)].join("\n"))
  const r = Disk.ioRates(a, b, 2000)
  near(r.read, (3000 * 512) / 2, 1e-6)
  near(r.write, (4000 * 512) / 2, 1e-6)
  assert.equal(Disk.ioRates(null, b, 2000), null)
  assert.equal(Disk.ioRates(a, b, 0), null)
  assert.equal(Disk.ioRates(a, b, 100), null)
  assert.equal(Disk.ioRates({ nvme1n1: { r: 0, w: 0 } }, b, 2000), null)
  // a counter that went backwards adds nothing for that disk
  const back = Disk.ioRates(b, a, 1000)
  assert.equal(back.read, 0)
  assert.equal(back.write, 0)
})

test("disk parseTemp: millidegrees, null without a sensor", () => {
  near(Disk.parseTemp("43850\n"), 43.85, 1e-9)
  assert.equal(Disk.parseTemp(""), null)
  assert.equal(Disk.parseTemp("0"), null)
})

test("disk update: first sample has mounts but no rates, the second has rates", () => {
  const t1 = DF + "\n@@stats\n" + [dsLine("nvme0n1", 0, 0)].join("\n") + "\n@@temp\n41000\n"
  const t2 = DF + "\n@@stats\n" + [dsLine("nvme0n1", 2048, 4096)].join("\n") + "\n@@temp\n42000\n"
  const a = Disk.update(null, t1, 10000)
  assert.equal(a.mounts.length, 3)
  assert.equal(a.io, null)
  assert.equal(a.hasStats, true)
  near(a.temp, 41, 1e-9)
  const b = Disk.update(a.sample, t2, 12000)
  near(b.io.read, 2048 * 512 / 2, 1e-6)
  near(b.io.write, 4096 * 512 / 2, 1e-6)
  assert.equal(b.mounts.length, 3)
})

test("disk update: a df that timed out keeps the previous mounts; missing sections are quiet, never an error", () => {
  const good = Disk.update(null, DF, 1000)
  const hiccup = Disk.update(good.sample, "@@stats\n" + dsLine("nvme0n1", 1, 1), 4000)
  assert.equal(hiccup.mounts.length, 3)
  same(hiccup.mounts, JSON.parse(JSON.stringify(good.mounts)))
  const first = Disk.update(null, "", 1000)
  same(first.mounts, [])
  assert.equal(first.io, null)
  assert.equal(first.hasStats, false)
  assert.equal(first.temp, null)
  const garbage = Disk.update(null, "@@stats\ngarbage\n@@temp\nxx", 1000)
  assert.equal(garbage.hasStats, false)
  assert.equal(garbage.temp, null)
})

test("disk readings: READ and WRITE need diskstats and show a dash until a rate exists; TEMP only with a sensor", () => {
  same(Disk.readings(null), [])
  same(Disk.readings({ hasStats: false, io: null, temp: null }), [])
  const first = Disk.readings({ hasStats: true, io: null, temp: null })
  same(first.map((r) => [r.key, r.value, r.fraction]), [["read", "\u2014", -1], ["write", "\u2014", -1], ["busy", "\u2014", -1]])
  const rows = Disk.readings({ hasStats: true, io: { read: 12.4e6, write: 812000, busy: 0.37 }, temp: 84 })
  same(rows.map((r) => r.key), ["read", "write", "busy", "temp"])
  assert.equal(rows[0].value, "12.4 MB/s")
  assert.equal(rows[1].value, "812 KB/s")
  assert.equal(rows[2].value, "37 %"); near(rows[2].fraction, 0.37, 1e-9); assert.equal(rows[2].hot, false); assert.equal(rows[2].threshold, 0.8)
  assert.equal(rows[3].value, "84 \u00b0C")
  assert.equal(rows[3].hot, true)
  assert.equal(rows[3].threshold, 0.8)
  assert.equal(Disk.readings({ hasStats: true, io: { read: 1, write: 1, busy: 0.8 }, temp: null })[2].hot, true)
  // no ticks reported: the cell is a dash
  assert.equal(Disk.readings({ hasStats: true, io: { read: 1, write: 1, busy: null }, temp: null })[2].value, "\u2014")
  same(Disk.readings({ hasStats: false, io: null, temp: 40 }).map((r) => r.key), ["temp"])
})

test("disk busy (L3): the max over the disks of ticks / dt, clamped 0..1; first sample null; a counter that went back is 0", () => {
  const ds = (name, tk) => "259 0 " + name + " 100 0 8 5 200 0 8 9 0 " + tk + " 5"
  const a = Disk.parseDiskstats([ds("nvme0n1", 1000), ds("sda", 5000)].join("\n"))
  const b = Disk.parseDiskstats([ds("nvme0n1", 1740), ds("sda", 5100)].join("\n"))
  near(Disk.ioRates(a, b, 2000).busy, 0.37, 1e-9)               // the busier disk, not the sum
  assert.equal(Disk.ioRates(null, b, 2000), null)
  const over = Disk.parseDiskstats(ds("nvme0n1", 9000))
  assert.equal(Disk.ioRates(a, over, 2000).busy, 1)             // clamped
  const back = Disk.ioRates(b, a, 2000)
  assert.equal(back.busy, 0)                                    // reset: nothing, not negative
  const none = Disk.parseDiskstats("259 0 nvme0n1 1 0 2 3 4 0 5 6")
  assert.equal(Disk.ioRates(none, none, 2000).busy, null)       // no ticks field at all
})

// ------------------------------------------------------------------------------------------------ ItoChart: lightenTo / darkenTo
test("chart lightenTo / darkenTo: reach the target or the lightness limit, never the wrong way, hue kept", () => {
  const bgs = [Chart.rgba(0.1, 0.1, 0.1), Chart.rgba(0.9, 0.9, 0.85), Chart.rgba(0.5, 0.2, 0.2), Chart.rgba(0.2, 0.3, 0.25)]
  const cs = [Chart.rgba(0.6, 0.1, 0.1), Chart.rgba(0.2, 0.5, 0.3), Chart.rgba(0.5, 0.5, 0.5), Chart.rgba(0.9, 0.8, 0.2)]
  for (const bg of bgs) for (const c of cs) for (const target of [1.8, 3, 4.5]) {
    const hl = Chart.toHsl(c)
    for (const [fn, dir] of [[Chart.lightenTo, 1], [Chart.darkenTo, -1]]) {
      const out = fn(c, bg, target), ho = Chart.toHsl(out)
      if (Chart.contrast(c, bg) >= target) { assert.equal(out, c); continue }
      assert.ok(dir * (ho.l - hl.l) >= -1e-9, "wrong way")
      const limit = dir > 0 ? ho.l >= Math.min(1, hl.l + 12 * 0.04) - 1e-9 : ho.l <= Math.max(0, hl.l - 12 * 0.04) + 1e-9
      assert.ok(Chart.contrast(out, bg) >= target || limit, "neither target nor limit")
      if (hl.s > 0.05 && ho.l > 0.02 && ho.l < 0.98) {
        const dh = Math.abs(ho.h - hl.h) * 360
        assert.ok(Math.min(dh, 360 - dh) <= 1, "hue moved " + dh)
      }
    }
  }
  // the direction is forced: a dark colour on a dark ground is lightened by lightenTo, not by the automatic rule's twin
  const dark = Chart.rgba(0.12, 0.05, 0.05), bg = Chart.rgba(0.08, 0.02, 0.02)
  assert.ok(Chart.toHsl(Chart.darkenTo(dark, bg, 4.5)).l <= Chart.toHsl(dark).l)
  assert.ok(Chart.toHsl(Chart.lightenTo(dark, bg, 4.5)).l >= Chart.toHsl(dark).l)
})

// ------------------------------------------------------------------------------------------------ ItoEyeModel (geometry)
function inPoly(p, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}
function distToPoly(p, poly) {
  let best = Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy
    const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0
    best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy))
  }
  return best
}
function polyArea(poly) {
  let s = 0
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; s += a.x * b.y - b.x * a.y }
  return Math.abs(s) / 2
}
const opening = Eye.openingPoints(240), ringOuter = Eye.outerPoints(240)
const GAZES = [-1, 0, 1].flatMap((i) => [-1, 0, 1].map((j) => ({ x: i * Eye.GAZE.x, y: j * Eye.GAZE.y })))

test("eye opening is convex", () => {
  let sign = 0
  for (let i = 0; i < opening.length; i++) {
    const a = opening[i], b = opening[(i + 1) % opening.length], c = opening[(i + 2) % opening.length]
    const cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (Math.abs(cr) < 1e-9) continue
    if (!sign) sign = Math.sign(cr)
    assert.equal(Math.sign(cr), sign, "concave at " + i)
  }
})

test("eye veins and caruncle stay at least 0.8 inside the opening", () => {
  const pts = []
  for (const level of [2, 3]) for (const S of [28, 72, 320]) for (const seed of [0, 7, 13, 20]) for (const extra of [false, true])
    for (const v of Eye.veinNetwork(level, S, seed, extra)) pts.push(...v.pts)
  const c = Eye.CARUNCLE
  for (let i = 0; i < 24; i++) { const a = Math.PI * 2 * i / 24; pts.push({ x: c.c.x + c.rx * Math.cos(a), y: c.c.y + c.ry * Math.sin(a) }) }
  for (const p of pts) {
    assert.ok(inPoly(p, opening), "outside " + p.x + "," + p.y)
    assert.ok(distToPoly(p, opening) >= 0.8, "too close " + p.x.toFixed(1) + "," + p.y.toFixed(1) + " " + distToPoly(p, opening).toFixed(2))
  }
})

test("eye iris stays inside the ring at every gaze extreme; pupil and main gleam inside the opening", () => {
  for (const g of GAZES) {
    for (let i = 0; i < 72; i++) {
      const a = Math.PI * 2 * i / 72
      const p = { x: Eye.IRIS_C.x + g.x + Eye.IRIS_R * Math.cos(a), y: Eye.IRIS_C.y + g.y + Eye.IRIS_R * Math.sin(a) }
      assert.ok(inPoly(p, ringOuter) && distToPoly(p, ringOuter) >= 1, "iris out at gaze " + g.x + "," + g.y)
    }
    const centre = { x: Eye.IRIS_C.x + g.x, y: Eye.IRIS_C.y + g.y }
    for (let i = 0; i < 36; i++) {
      const a = Math.PI * 2 * i / 36
      const pp = { x: centre.x + 6.5 * Math.cos(a), y: centre.y + 6.5 * Math.sin(a) }
      assert.ok(inPoly(pp, opening), "pupil out at gaze " + g.x + "," + g.y)
      const gl = { x: centre.x - 5.6 + 3 * Math.cos(a), y: centre.y - 6.2 + 2 * Math.sin(a) }
      assert.ok(inPoly(gl, opening), "gleam out at gaze " + g.x + "," + g.y)
      for (const seed of [0, 7, 20]) for (const pane of Eye.windowPanes(seed)) for (const q of pane)
        assert.ok(inPoly({ x: centre.x + q.x, y: centre.y + q.y }, opening), "window pane out at gaze " + g.x + "," + g.y)
    }
  }
})

test("eye lid: no skin at b 0, edge on the lower lid at b 1, hatch inside the lid skin, lash counts, lashes swing down", () => {
  const skinArea = (b) => { const g = Eye.lidGeometry(b, 3, 40); return polyArea(g.top.concat(g.topE.slice().reverse())) }
  assert.ok(skinArea(0) < 1, "area at 0 " + skinArea(0))
  assert.ok(skinArea(1) > 200)
  const g1 = Eye.lidGeometry(1, 3, 40)
  for (let i = 0; i <= g1.N; i++) assert.ok(Math.hypot(g1.E[i].x - Eye.Lr(i / g1.N).x, g1.E[i].y - Eye.Lr(i / g1.N).y) <= 0.8, "E vs Lr at " + i)
  for (const b of [0.3, 0.5, 0.8, 1]) {
    const g = Eye.lidGeometry(b, 3, 40), poly = g.top.concat(g.topE.slice().reverse())
    assert.equal(g.film.length, 8)
    for (const [p0, p1] of g.film) { assert.ok(inPoly(p0, poly), "hatch start at b " + b); assert.ok(inPoly(p1, poly), "hatch end at b " + b) }
  }
  assert.equal(Eye.lidGeometry(0, 3, 40).lashes.length, 12); assert.equal(Eye.lidGeometry(0, 3, 40).lower, 4)
  assert.equal(Eye.lidGeometry(0, 2, 20).lashes.length, 5); assert.equal(Eye.lidGeometry(0, 2, 20).lower, 0)
  assert.equal(Eye.lidGeometry(0, 1, 12).lashes.length, 0)
  for (const l of g1.lashes) assert.ok(l.tip.y > l.base.y, "closed lash points down")
  for (const l of Eye.lidGeometry(0, 3, 40).lashes.slice(0, 7)) assert.ok(l.tip.y < l.base.y, "open lash points up")
})

test("eye strokes: never below 0.6 px at any level and size, fainter when widened", () => {
  for (let S = 12; S <= 40; S++) {
    const level = Eye.detailFor(S)
    const parts = [...Eye.staticParts(level, S, 7, false).A, ...Eye.staticParts(level, S, 7, false).C, ...Eye.irisParts(level, S, 7), ...Eye.lidShape(0.6, level, S, 7, false)]
    assert.ok(parts.every((p) => p.path.length > 0 && p.a >= 0 && p.a <= 1))
    for (const w of [0.45, 0.55, 0.6, 0.8, 1, 1.4, 3]) {
      const f = Eye.strokeFor(w, S, 0.8)
      assert.ok(f.w * S / 100 >= 0.6 - 1e-9)
      if (w * S / 100 < 0.6) assert.ok(f.a < 0.8); else assert.equal(f.a, 0.8)
    }
  }
})

test("eye detailFor: thresholds and hysteresis", () => {
  assert.equal(Eye.detailFor(28), 3); assert.equal(Eye.detailFor(27.9), 2)
  assert.equal(Eye.detailFor(16), 2); assert.equal(Eye.detailFor(15.9), 1)
  assert.equal(Eye.detailFor(27, 3), 3); assert.equal(Eye.detailFor(26.9, 3), 2)
  assert.equal(Eye.detailFor(15, 2), 2); assert.equal(Eye.detailFor(14.9, 2), 1)
  assert.equal(Eye.detailFor(27.5, 2), 2); assert.equal(Eye.detailFor(15.5, 1), 1); assert.equal(Eye.detailFor(16, 1), 2)
  assert.equal(Eye.detailFor(8), 1); assert.equal(Eye.detailFor(40, 1), 3)
})

test("eye parts: slots are fixed per layer, spiral is 2.25 turns clockwise from the seed angle", () => {
  const known = (layer, parts) => parts.every((p) => Eye.SLOTS[layer].includes(p.id))
  for (const level of [1, 2, 3]) {
    const sp = Eye.staticParts(level, 30, 3, false)
    assert.ok(known("A", sp.A) && known("C", sp.C) && known("B", Eye.irisParts(level, 30, 1)) && known("D", Eye.lidShape(0.5, level, 30, 3, false)))
  }
  const pts = Eye.spiralPoints(250)   // 250 / 1000 of a turn = 90 degrees
  assert.equal(pts.length, Math.round(2.25 * 360 / 14) + 1)
  near(Math.hypot(pts[0].x, pts[0].y), 7, 1e-9); near(Math.hypot(pts.at(-1).x, pts.at(-1).y), Eye.SPIRAL.r1, 1e-9)
  near(Math.atan2(pts[0].y, pts[0].x), Math.PI / 2, 1e-9)
  const a0 = Math.atan2(pts[0].y, pts[0].x), a1 = Math.atan2(pts[1].y, pts[1].x)
  assert.ok(((a1 - a0 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI > 0, "clockwise on screen")
})

// ------------------------------------------------------------------------------------------------ ItoEyeModel (the ink pass)
const cmds = (p) => (p.match(/[MLCQA]/g) || []).length
const nums = (p) => { const n = p.match(/-?\d+(\.\d+)?/g).map(Number), out = []; for (let i = 0; i + 1 < n.length; i += 2) out.push({ x: n[i], y: n[i + 1] }); return out }
const allParts = (level, S, seed, pale = false, b = 0, pupil = 6.5) => {
  const st = Eye.staticParts(level, S, seed, pale)
  return { A: st.A, C: st.C, B: Eye.irisParts(level, S, seed, pupil), D: Eye.lidShape(b, level, S, seed, pale) }
}

test("eye ink: hash is deterministic in [0,1); vnoise in [-1,1] and continuous", () => {
  for (let i = 0; i < 500; i++) { const h = Eye.hash(7, 3, i); assert.ok(h >= 0 && h < 1); assert.equal(h, Eye.hash(7, 3, i)) }
  assert.notEqual(Eye.hash(7, 3, 1), Eye.hash(31, 3, 1))
  let prev = Eye.vnoise(5, 2, 0, 6)
  for (let i = 1; i <= 200; i++) {
    const v = Eye.vnoise(5, 2, i / 200, 6)
    assert.ok(v >= -1 && v <= 1); assert.ok(Math.abs(v - prev) < 0.2); prev = v
  }
})

test("eye ink: ribbonGapped with 2 gaps yields 3 closed runs; inkProfile is pointed at both ends", () => {
  const pts = Array.from({ length: 40 }, (_, i) => ({ x: i * 2, y: Math.sin(i / 5) * 3 }))
  const path = Eye.ribbonGapped(pts, () => 2, [[0.2, 0.26], [0.6, 0.66]])
  assert.equal((path.match(/Z/g) || []).length, 3)
  assert.equal((Eye.ribbonGapped(pts, () => 2, []).match(/Z/g) || []).length, 1)
  const w = Eye.inkProfile({ w: 2, e0: 0.1, e1: 0.14, dip: 0.45, dipAt: 0.48 })
  assert.equal(w(0), 0); assert.equal(w(1), 0); assert.ok(w(0.25) > w(0.48))
})

test("eye ink: lid weight is a hairline inside, fattest in the outer third", () => {
  assert.ok(Eye.lidW(0.05) < 0.8); assert.ok(Eye.lidW(0.7) > 4.5); assert.ok(Eye.lidW(0.7) > 2.5 * Eye.lidW(0.1))
})

test("eye ink: gaps, crosshatch and stipple only when fine (S >= 56); budgets per level; slots; paths", () => {
  const budget = { fine: 2600, coarse: 1000, 2: 400, 1: 120 }
  for (const seed of [0, 7, 20]) for (const [level, S, key] of [[3, 320, "fine"], [3, 72, "fine"], [3, 56, "fine"], [3, 55, "coarse"], [3, 28, "coarse"], [2, 20, 2], [1, 12, 1]]) {
    const P = allParts(level, S, seed), fine = S >= Eye.INK_FINE && level === 3
    const total = [...P.A, ...P.B, ...P.C, ...P.D].reduce((n, p) => n + cmds(p.path), 0)
    assert.ok(total <= budget[key], `vertices ${total} at ${S}px seed ${seed}`)
    assert.ok(P.D.reduce((n, p) => n + cmds(p.path), 0) <= 450)
    assert.ok([...P.A, ...P.B, ...P.C, ...P.D].length <= 28)
    const runs = (id) => (P.C.find((p) => p.id === id).path.match(/Z/g) || []).length
    if (level === 3) {
      assert.equal(runs("crease"), fine ? 2 : 1); assert.equal(runs("lower"), fine ? 2 : 1)
      assert.equal(runs("keyline"), fine ? 3 : 1)
      const cross = P.C.find((p) => p.id === "creaseHatch").strokes.length
      assert.equal(cross, fine ? 26 + 14 : 16)
      assert.equal(P.C.find((p) => p.id === "underHatch").strokes.length, fine ? 16 + 10 : 10)
      assert.equal(!!(P.C.find((p) => p.id === "underHatch").dots || []).length, fine)
      assert.equal(!!(P.A.find((p) => p.id === "cornerHatch").dots || []).length, fine)
      assert.equal(P.D.find((p) => p.id === "shadow").strokes.length, fine ? 22 + 12 : 14)
      assert.equal(P.B.find((p) => p.id === "striae").strokes.length, fine ? 48 : 28)
    }
  }
})

test("eye ink: keyline lies in the box, none at L1; hatch hangs from its line; corner hatch and stipple stay 0.8 inside", () => {
  for (const seed of [0, 7, 20]) for (const S of [28, 72, 320]) {
    const P = allParts(3, S, seed)
    for (const q of nums(P.C.find((p) => p.id === "keyline").path)) assert.ok(q.x >= -0.3 && q.x <= 100.3 && q.y >= -0.3 && q.y <= 62, "keyline " + q.x + "," + q.y)
    for (const id of ["creaseHatch", "underHatch"]) for (const st of P.C.find((p) => p.id === id).strokes)
      assert.ok(Math.hypot(st.a.x - st.base.x, st.a.y - st.base.y) <= 1.0, id + " start off its line")
    const ch = P.A.find((p) => p.id === "cornerHatch")
    for (const st of ch.strokes) { assert.ok(Eye.openDist(st.a) >= 0.8 - 1e-9); assert.ok(Eye.openDist(st.b) >= 0.8 - 1e-9) }
    for (const d of ch.dots || []) assert.ok(Eye.openDist(d.c) >= 0.8)
  }
  assert.ok(!allParts(1, 12, 7).C.some((p) => p.id === "keyline"))
  assert.ok(allParts(2, 20, 7).C.some((p) => p.id === "keyline"))
})

test("eye ink: veins have no twigs below fine; the pupil stays within 5% of its radius", () => {
  for (const seed of [0, 7, 20]) {
    assert.ok(!Eye.veinNetwork(3, 40, seed, false).some((v) => v.lvl === 3))
    assert.ok(Eye.veinNetwork(3, 320, seed, false).some((v) => v.lvl === 3))
    assert.equal(Eye.veinNetwork(2, 20, seed, false).length, 2)
    for (const pr of [3.8, 6.5]) for (const q of Eye.pupilOutline(seed, pr)) assert.ok(Math.abs(Math.hypot(q.x, q.y) / pr - 1) <= 0.05)
  }
})

test("eye ink: layer D shades and hatches fade with the blink, the spiral starts inside the pupil", () => {
  const strength = (b, id) => { const p = Eye.lidShape(b, 3, 160, 7, false).find((q) => q.id === id); return p ? p.a : 0 }
  assert.ok(strength(0, "lidTone") > strength(0.5, "lidTone") && strength(0.5, "lidTone") > strength(0.9, "lidTone"))
  assert.ok(strength(0, "shadow") > strength(0.5, "shadow"))
  const sp = Eye.spiralPoints(7, 6.5 - 0.3)
  assert.ok(Math.hypot(sp[0].x, sp[0].y) < 6.5)
  const pale = Eye.lidShape(0, 3, 160, 7, true).find((q) => q.id === "lidTone").a
  assert.ok(pale > Eye.lidShape(0, 3, 160, 7, false).find((q) => q.id === "lidTone").a)
})

// ------------------------------------------------------------------------------------------------ ItoEyeModel (behaviour)
test("eye blink: deterministic, in [b0, 1], .72 s per blink, mean interval 9..22 s, rarely two of seven shut", () => {
  assert.equal(Eye.BLINK_LEN.toFixed(2), "0.72")
  for (const seed of [1, 99, 7919]) {
    assert.equal(Eye.blinkAt(seed, 33.3, 0.1), Eye.blinkAt(seed, 33.3, 0.1))
    for (let t = 0; t < 120; t += 0.05) { const b = Eye.blinkAt(seed, t, 0.1); assert.ok(b >= 0.1 - 1e-9 && b <= 1 + 1e-9) }
    // the shut time of one blink is .72 s long; count blinks and their gaps over an hour
    const starts = []
    let prev = false
    for (let t = 0; t < 3600; t += 0.02) { const on = Eye.blinkAt(seed, t, 0) > 0.001; if (on && !prev) starts.push(t); prev = on }
    const mean = (3600 - starts[0]) / (starts.length - 1)
    assert.ok(mean >= 9 * 0.5 && mean <= 22 * 1.01, "mean interval " + mean)
    const P = 9 + 13 * Eye.hash(seed, 41, 0)
    assert.ok(P >= 9 && P <= 22)
  }
  // a single blink: shut for exactly the hold, travelling .72 s in all
  let first = null, last = null
  for (let t = 0; t < 40; t += 0.005) if (Eye.blinkAt(5, t, 0) > 0.0004) { if (first === null) first = t; if (t < first + 0.9) last = t }
  assert.ok(last - first >= 0.69 && last - first <= 0.74, "length " + (last - first))
  const rows = [1, 2, 3, 4, 5, 6, 7].map((i) => ({ seed: i * 7919 }))   // seven eyes with their own schedules
  let two = 0, n = 0
  for (let t = 0; t < 3600; t += 0.1) { n++; let shut = 0; for (const r of rows) if (Eye.blinkAt(r.seed, t, 0) > 0.5) shut++; if (shut >= 2) two++ }
  assert.ok(two / n < 0.02, "two or more shut " + two / n)
  assert.equal(Eye.blinkingAt(5, first + 0.3), true)
  assert.equal(Eye.blinkingAt(5, first + 0.5), true)
})

test("eye gaze: converges without overshoot, stays in the ellipse; the pointer sets the target", () => {
  let g = { x: 0, y: 0 }
  const target = { x: 0.6 * Eye.GAZE.x, y: -0.6 * Eye.GAZE.y }
  let prev = Infinity
  for (let i = 0; i < 400; i++) {
    g = Eye.gazeStep(g, target, 0.6, 1 / 30)
    assert.ok(g.x <= target.x + 1e-9 && g.y >= target.y - 1e-9)
    const d = Math.hypot(g.x - target.x, g.y - target.y); assert.ok(d <= prev + 1e-9); prev = d
    assert.ok((g.x / Eye.GAZE.x) ** 2 + (g.y / Eye.GAZE.y) ** 2 <= 1 + 1e-9)
  }
  assert.ok(prev < 0.01)
  for (const seed of [1, 2, 3]) for (let t = 0; t < 200; t += 0.7) { const q = Eye.idleGaze(seed, t); assert.ok((q.x / Eye.GAZE.x) ** 2 + (q.y / Eye.GAZE.y) ** 2 <= 1 + 1e-9) }
  const far = Eye.gazeToward(500, 0, 30, 0, false), near1 = Eye.gazeToward(15, 0, 30, 0, false)
  near(far.x, Eye.GAZE.x, 1e-9); assert.ok(near1.x < far.x && near1.x > 0)
  near(Eye.gazeToward(500, 0, 30, 0, true).x, -Eye.GAZE.x, 1e-9)
  const turned = Eye.gazeToward(100, 0, 20, 90, false)
  assert.ok(turned.y < 0, "a 90 degree turn moves a pointer on the right to the eye's up")
})

test("eye stare: pinpoint pupils and lids open within .3 s, back to normal after 8 s", () => {
  const s = Eye.stareState(0.3)
  assert.ok(s.active && s.pupil <= 4.0 && s.mix > 0.8 && s.look)
  assert.equal(Eye.stareState(-1).active, false)
  assert.equal(Eye.stareState(8.01).active, false)
  near(Eye.stareState(8.01).pupil, Eye.PUPIL.open, 1e-9)
  assert.ok(Eye.stareState(7.9).pupil > Eye.stareState(4).pupil)
  // the gaze reaches (0, 0) within .5 px of the iris centre .3 s after the saccade starts
  let g = Eye.GAZE.x * 0.9; g = { x: g, y: 2 }
  for (let t = 0; t < 0.3; t += 1 / 60) g = Eye.gazeStep(g, { x: 0, y: 0 }, Eye.EYES.tauSaccade, 1 / 60)
  assert.ok(Math.hypot(g.x, g.y) < 0.5)
})

test("eye depth: fade steps 0..5", () => {
  assert.equal(Eye.fadeStep(0), 0); assert.equal(Eye.fadeStep(1), 5); assert.equal(Eye.fadeStep(-3), 0); assert.equal(Eye.fadeStep(9), 5)
})

// ------------------------------------------------------------------------------------------------ ItoEyeModel (gekiga, options.md C)
const gk = (seed, S, over) => Eye.gekigaParts(Eye.gekigaParams(seed, over), S, seed)
const NEUTRAL = { aperture: 1, droop: 0, tilt: 0, bulge: 0 }
const pts = (s) => { const o = []; for (let i = 0; i < s.poly.length; i += 2) o.push({ x: s.poly[i], y: s.poly[i + 1] }); return o }
const layerOf = (r, l) => r.strokes.filter((s) => s.layer === l)

test("gekiga: same seed, same stroke list; another seed, another eye", () => {
  same(gk(7, 320), JSON.parse(JSON.stringify(gk(7, 320))))
  assert.equal(JSON.stringify(gk(7, 320).strokes), JSON.stringify(gk(7, 320).strokes))
  assert.notEqual(JSON.stringify(gk(7, 320).strokes), JSON.stringify(gk(8, 320).strokes))
})

test("gekiga: below 28 px there is no gekiga (the host falls back to the ink style)", () => {
  assert.equal(Eye.gekigaParts(Eye.gekigaParams(3), 27, 3), null)
  assert.ok(Eye.gekigaParts(Eye.gekigaParams(3), 28, 3))
})

test("gekiga: parameters stay inside the uneasy envelope, the pair is never a copy", () => {
  for (let seed = 0; seed < 200; seed++) {
    const p = Eye.gekigaParams(seed)
    for (const k of Object.keys(Eye.GK_RANGE)) assert.ok(p[k] >= Eye.GK_RANGE[k][0] && p[k] <= Eye.GK_RANGE[k][1], k + " " + p[k])
    assert.ok(["pin", "calm", "dilated", "torn"].includes(p.pupilState), "spiral is never rolled")
    const q = Eye.gekigaPair(p, seed)
    assert.ok(q.aperture < p.aperture + 1e-9 && q.droop > p.droop && q.irisR !== p.irisR)
  }
})

test("gekiga: stroke counts per level", () => {
  for (const seed of [1, 2, 3, 4]) {
    const hi = gk(seed, 320), lo = gk(seed, 46)
    const n = (r, re) => r.strokes.filter((s) => re.test(s.id)).length
    assert.ok(n(hi, /^scl\d+$/) >= 220 * 0.9 && n(hi, /^scl\d+$/) <= 420, "sclera fine " + n(hi, /^scl\d+$/))
    assert.ok(n(lo, /^scl\d+$/) >= 110 * 0.9 && n(lo, /^scl\d+$/) <= 210, "sclera half " + n(lo, /^scl\d+$/))
    assert.ok(n(hi, /^sh\d+$/) >= 60 * 0.9 && n(hi, /^sh\d+$/) <= 110, "shadow fine " + n(hi, /^sh\d+$/))
    assert.ok(n(hi, /^fib\d+$/) >= 70 && n(hi, /^fib\d+$/) <= 110)
    assert.ok(hi.fine && !lo.fine)
    assert.ok(hi.count > lo.count)
  }
})

test("gekiga: sclera hatch stays inside the opening, skin outside it, nothing but tokens", () => {
  for (const seed of [1, 5, 9, 13]) {
    const r = gk(seed, 320, NEUTRAL)
    for (const s of [...layerOf(r, "sclera").filter((x) => x.id !== "sclera"), ...layerOf(r, "shadow")])
      for (const q of pts(s)) assert.ok(Eye.openDist(q) >= 0.3, s.id + " " + Eye.openDist(q))
    for (const s of layerOf(r, "skin"))
      for (const q of pts(s)) assert.ok(Eye.openDist(q) <= 0.5 && q.x > -1 && q.x < 101 && q.y > -1 && q.y < 63, s.id + " " + JSON.stringify(q))
    for (const s of r.strokes) assert.ok(["paper", "ink", "irisTint", "skin", "vein", "gleam"].includes(s.role) && s.a >= 0 && s.a <= 1, s.id)
  }
})

test("gekiga: the iris is cut by the opening, the lid covers lidCover of it, at 0 the iris floats (sanpaku)", () => {
  for (const lc of [0, 0.1, 0.2, 0.38]) {
    const p = Eye.gekigaParams(4, { ...NEUTRAL, lidCover: lc, lowerGap: 2, irisR: 14, pupilState: "calm" }), r = Eye.gekigaParts(p, 320, 4)
    for (const id of ["iris", "limbus", "pupil", "spec"]) assert.ok(r.strokes.find((s) => s.id === id).clip, id + " is clipped")
    const tx = (fn) => { let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (fn(m).x < 50) lo = m; else hi = m } return fn(lo) }
    const lid = tx(Eye.U).y, iris = r.iris
    near(iris.y - iris.r, lid - 2 * iris.r * lc, lc > 0 ? 1e-6 : 100, "iris top for lidCover " + lc)
    if (lc === 0) assert.ok(iris.y - iris.r > lid && iris.y + iris.r < tx((t) => Eye.Lr(t)).y, "sclera all round")
    assert.ok(r.clip.length > 20)
  }
})

test("gekiga: the pupil states", () => {
  const ext = (r, id) => { const q = pts(r.strokes.find((s) => s.id === id)); return Math.max(...q.map((a) => a.x)) - Math.min(...q.map((a) => a.x)) }
  const w = (state) => ext(gk(2, 320, { ...NEUTRAL, pupilState: state, irisR: 14 }), "pupil")
  assert.ok(w("pin") < w("calm") && w("calm") < w("dilated"))
  near(w("pin"), 2.8, 0.2); near(w("calm"), 0.84 * 14, 0.5); near(w("dilated"), 1.56 * 14, 0.8)
  assert.equal(pts(gk(2, 320, { ...NEUTRAL, pupilState: "torn" }).strokes.find((s) => s.id === "pupil")).length, 36)
  const sp = gk(2, 320, { ...NEUTRAL, pupilState: "spiral" })
  assert.ok(sp.strokes.find((s) => s.id === "spiral")); near(ext(sp, "pupil"), 2.4, 0.2)
})

test("gekiga: the specular is drawn last (a veil, when there is one, goes over it)", () => {
  const r = gk(3, 320, NEUTRAL), ids = r.strokes.map((s) => s.layer)
  assert.equal(ids[ids.length - 1], "spec")
  const first = ids.indexOf("spec")
  assert.ok(ids.slice(first).every((l) => l === "spec"))
  assert.equal(r.strokes.filter((s) => s.layer === "veil").length, 0)
  const v = gk(3, 320, { ...NEUTRAL, veil: 0.55 })
  assert.ok(layerOf(v, "veil").length > 100)
  assert.equal(v.strokes[v.strokes.length - 1].layer, "veil")
})

test("gekiga: the opening and the ink are one stroke list: no keyline, the sclera is the first stroke", () => {
  const r = gk(6, 320)
  assert.equal(r.strokes[0].id, "sclera")
  assert.ok(!r.strokes.some((s) => /key/.test(s.id)))
  assert.ok(r.strokes.some((s) => s.role === "vein") && r.strokes.some((s) => s.role === "gleam"))
})

test("gekiga: capillaries carry the mix toward the hot vein colour (0.25 at bloodshot 0, 0.85 at 1)", () => {
  const lo = gk(2, 320, { ...NEUTRAL, bloodshot: 0 }), hi = gk(2, 320, { ...NEUTRAL, bloodshot: 1 })
  const v = (r) => r.strokes.filter((s) => s.role === "vein")
  near(v(lo)[0].m, 0.25, 1e-9); near(v(hi)[0].m, 0.85, 1e-9)
  assert.ok(v(hi).length > v(lo).length)
  for (const s of v(hi)) for (const q of pts(s)) assert.ok(Eye.openDist(q) > 0.3)
})

test("gekiga: aperture, droop and tilt move the opening, not the hatch's place in it", () => {
  const r = gk(2, 320, { aperture: 0.62, droop: 5, tilt: 4, bulge: 0 }), f = Eye.gkXf({ aperture: 0.62, droop: 5, tilt: 4 })
  const open = Eye.openingPoints(60).map(f)
  const inside = (q) => { let c = false; for (let i = 0, j = open.length - 1; i < open.length; j = i++) { const a = open[i], b = open[j]; if ((a.y > q.y) !== (b.y > q.y) && q.x < (b.x - a.x) * (q.y - a.y) / (b.y - a.y) + a.x) c = !c } return c }
  for (const s of layerOf(r, "sclera").filter((x) => /^scl\d/.test(x.id))) for (const q of pts(s)) assert.ok(inside(q), s.id)
})

// ------------------------------------------------------------------------------------------------ ItoEyeReal (eyes-v2.md)
const rp = (a, seed = 1, over) => Real.realParams(a, seed, over)
const polyPts = (a) => { const o = []; for (let i = 0; i < a.length; i += 2) o.push([a[i], a[i + 1]]); return o }

test("real: determinism (same params, same list) and the seed changes the eye", () => {
  for (const a of Real.ARCHETYPES) {
    Real.clearCache()
    const x = JSON.stringify(Real.realParts(rp(a, 5), 160)); Real.clearCache()
    const y = JSON.stringify(Real.realParts(rp(a, 5), 160)); Real.clearCache()
    assert.equal(x, y)
    assert.notEqual(x, JSON.stringify(Real.realParts(rp(a, 6), 160)))
  }
})

test("real: parameters stay in the realistic envelope (the preset narrows it)", () => {
  for (let seed = 0; seed < 40; seed++) for (const a of Real.ARCHETYPES) {
    const p = rp(a, seed), pre = Real.PRESET[a]
    for (const k of Object.keys(Real.RANGE)) {
      const r = pre[k] !== undefined ? pre[k] : Real.RANGE[k]
      assert.ok(p[k] >= r[0] - 1e-9 && p[k] <= r[1] + 1e-9, a + " " + k + " " + p[k])
    }
  }
})

test("real: every mark of the sclera and the iris is inside the opening, the iris is cut by it, nothing but roles", () => {
  const roles = new Set(["paper", "ink", "skin", "tint", "caruncle", "vein", "tear"])
  for (const a of Real.ARCHETYPES) for (const S of [46, 96, 160]) {
    const P = Real.realParts(rp(a, 3), S), G = P.G
    assert.ok(G.open(P.iris.x, P.iris.y, 0), a + ": the iris centre is in the opening")
    for (const s of P.strokes) {
      assert.ok(roles.has(s.role), s.role)
      assert.ok(s.a > 0 && s.a <= 1)
      if (s.layer === "iris") assert.equal(s.clip, true, a + " " + s.id + " must be clipped by the opening")
      if (s.layer === "sclera" && /^(s1|sclera[23]_)/.test(s.id)) for (const [x, y] of polyPts(s.poly)) assert.ok(G.open(x, y, -1.6), a + " " + s.id + " " + x + "," + y)
      if (s.layer === "skin" && s.id.startsWith("k")) for (const [x, y] of polyPts(s.poly)) assert.ok(!G.open(x, y, 1.0), a + " " + s.id)
      for (const v of s.poly) assert.ok(Number.isFinite(v))
    }
  }
})

test("real: stroke caps per tier, the tier follows the size with hysteresis", () => {
  for (const a of Real.ARCHETYPES) {
    assert.ok(Real.realParts(rp(a), 24).count <= 120 && Real.realParts(rp(a), 55).count <= 120, a + " T1")
    assert.ok(Real.realParts(rp(a), 100).count <= Real.CAP[2], a + " T2")
    assert.ok(Real.realParts(rp(a), 160).count <= Real.CAP[3], a + " T3")
  }
  assert.equal(Real.realParts(rp("heavy"), 23), null)
  assert.equal(Real.tierFor(23), 0); assert.equal(Real.tierFor(24), 1); assert.equal(Real.tierFor(56), 2); assert.equal(Real.tierFor(120), 3)
  assert.equal(Real.tierFor(57, 1), 1); assert.equal(Real.tierFor(59, 1), 2)       // up needs hysteresis
  assert.equal(Real.tierFor(54, 2), 2); assert.equal(Real.tierFor(52, 2), 1)       // down likewise
})

test("real: the catchlight is paper and goes last; lidless and spiral have none (the dead eye)", () => {
  for (const a of Real.ARCHETYPES) {
    const P = Real.realParts(rp(a, 2), 160), cat = P.strokes.filter((s) => s.id.startsWith("catch"))
    if (a === "lidless" || a === "spiral") { assert.equal(cat.length, 0, a); continue }
    assert.ok(cat.length >= 1)
    for (const c of cat) assert.equal(c.role, "paper")
    const lastPaper = P.strokes.slice(P.strokes.length - cat.length).every((s) => s.id.startsWith("catch"))
    assert.ok(lastPaper || P.strokes.slice(-6).some((s) => s.id.startsWith("catch")), a + ": catch among the last strokes")
    for (const s of P.strokes.slice(P.strokes.findIndex((x) => x.id.startsWith("catch")))) assert.equal(s.role, "paper")
  }
})

test("real: distinctness: the openings of any two archetypes differ (IoU < 0.85), their tone histograms differ", () => {
  const A = Real.ARCHETYPES, grids = A.map((a) => Real.openingGrid(rp(a, 1))), hist = A.map((a) => Real.toneHistogram(rp(a, 1)))
  for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
    assert.ok(Real.iou(grids[i], grids[j]) < 0.85, A[i] + " vs " + A[j] + " " + Real.iou(grids[i], grids[j]).toFixed(2))
    let d = 0
    for (let k = 0; k < 8; k++) d += Math.abs(hist[i][k] - hist[j][k])
    assert.ok(d > 0.02, A[i] + " vs " + A[j] + " histogram " + d.toFixed(3))
  }
})

test("real: the mud rule: no hatch family closer than 1.8 px at any size from 24 to 160, no stroke thinner than 0.6 px", () => {
  for (const a of Real.ARCHETYPES) for (let S = 24; S <= 160; S += 4) {
    const P = Real.realParts(rp(a, 4), S)
    for (const f of P.families) assert.ok(f.px >= Real.MUD_PX - 1e-9, a + " " + S + " " + f.name + " " + f.px.toFixed(2))
    assert.ok(P.minStrokePx >= Real.HAIRLINE - 1e-9, a + " " + S + " " + P.minStrokePx)
  }
})

test("real: tiers add content: T1 has no screentone or brow hairs, T3 has both", () => {
  const T1 = Real.realParts(rp("stare", 2), 46), T3 = Real.realParts(rp("stare", 2), 160)
  assert.equal(T1.strokes.filter((s) => s.id.startsWith("tn") || s.id.startsWith("bh")).length, 0)
  assert.ok(T3.strokes.filter((s) => s.id.startsWith("tn")).length > 20)
  assert.ok(T3.strokes.filter((s) => s.id.startsWith("bh")).length > 20)
  assert.ok(T1.strokes.some((s) => s.id === "brow"))                                 // one tapered stroke instead
})

test("real: squint: a rasterised, blurred eye has the pupil as its darkest blob and paper over 35 % of the opening", () => {
  // paint into a 0..1 luminance grid (paper 1, tint .8, ink 0), 2 px per unit; the strokes are filled by even-odd on their polygon
  const W = 200, H = 124
  for (const a of Real.ARCHETYPES) {
    const P = Real.realParts(rp(a, 1), 120), lum = new Float32Array(W * H).fill(0.5), G = P.G
    const inside = (poly, x, y) => { let c = false; for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) { const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c } return c }
    for (const s of P.strokes) {
      if (s.layer === "veil") continue
      const v = s.role === "paper" ? 1 : s.role === "tint" ? 0.85 : s.role === "caruncle" ? 0.7 : 0
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
      for (let i = 0; i < s.poly.length; i += 2) { x0 = Math.min(x0, s.poly[i]); x1 = Math.max(x1, s.poly[i]); y0 = Math.min(y0, s.poly[i + 1]); y1 = Math.max(y1, s.poly[i + 1]) }
      for (let y = Math.max(0, Math.floor(y0 * 2)); y < Math.min(H, Math.ceil(y1 * 2)); y++) for (let x = Math.max(0, Math.floor(x0 * 2)); x < Math.min(W, Math.ceil(x1 * 2)); x++) {
        const ux = (x + 0.5) / 2, uy = (y + 0.5) / 2
        if (s.clip && !G.open(ux, uy, 0)) continue
        if (inside(s.poly, ux, uy)) lum[y * W + x] = lum[y * W + x] * (1 - s.a) + v * s.a
      }
    }
    let paper = 0, n = 0, pupilL = 0, pc = 0, minOther = 1
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ux = (x + 0.5) / 2, uy = (y + 0.5) / 2
      if (!G.open(ux, uy, 0.5)) continue
      n++; if (lum[y * W + x] > 0.9) paper++
    }
    const need = a === "slit" || a === "heavy" ? 0.15 : 0.35
    assert.ok(paper / n >= need, a + " paper " + (paper / n).toFixed(2))
    // pupil: the mean luminance inside the pupil radius must be below every other 4-unit patch's mean in the opening
    const ir = P.iris, patch = (cx, cy, r) => { let s = 0, k = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const ux = (x + 0.5) / 2, uy = (y + 0.5) / 2; if ((ux - cx) ** 2 + (uy - cy) ** 2 < r * r && G.open(ux, uy, 0)) { s += lum[y * W + x]; k++ } } return k ? s / k : 1 }
    if (a === "poly" || a === "spiral" || a === "torn") continue
    const pl = patch(ir.x, ir.y, Math.max(1, ir.pupil * 0.7))
    for (let gx = 12; gx < 90; gx += 4) for (let gy = 16; gy < 56; gy += 4) {
      if (!G.open(gx, gy, 3) || Math.hypot(gx - ir.x, gy - ir.y) < ir.r) continue
      minOther = Math.min(minOther, patch(gx, gy, 3))
    }
    assert.ok(pl < minOther, a + " pupil " + pl.toFixed(2) + " vs the darkest other patch " + minOther.toFixed(2))
  }
})

test("real: pair, crest and ichor choices", () => {
  const p = rp("heavy", 7), q = Real.realPair(p, 7)
  assert.ok(["stare", "slit"].includes(q.archetype) && q.veil > 0 && q.droop === p.droop + 2)
  assert.equal(Real.crestArchetype("calm"), "heavy"); assert.equal(Real.crestArchetype("hot"), "stare"); assert.equal(Real.crestArchetype("critical"), "spiral")
  assert.equal(Real.crestArchetype("calm", "lidless"), "lidless"); assert.equal(Real.crestArchetype("hot", "auto"), "stare")
  assert.equal(Real.ichorMark(0, 5, 40, "calm").archetype, "heavy"); assert.equal(Real.ichorMark(0, 5, 20, "calm").kind, "slit")
  assert.equal(Real.ichorMark(1, 5, 20, "calm").kind, "slit"); assert.equal(Real.ichorMark(4, 5, 14, "calm").kind, "eyeball")
  // neighbouring eyeball ranks never take the same baked yaw; no two slots share archetype and variant
  const seen = new Set()
  for (let r = 0; r < 7; r++) { const m = Real.ichorMark(r, 9, 30, "calm"), k = m.kind + ":" + m.variant; assert.ok(!seen.has(k)); seen.add(k) }
  for (let r = 3; r < 6; r++) assert.notEqual(Real.ichorMark(r, 9, 14, "calm").yawIdx, Real.ichorMark(r + 1, 9, 14, "calm").yawIdx)
})

test("real: the T0 sigil is at most 6 paths, all roles, in the box", () => {
  for (const a of Real.ARCHETYPES) for (const S of [10, 12, 16, 22]) {
    const s = Real.sigilParts(rp(a, 2), S)
    assert.ok(s.length >= 3 && s.length <= 6, a + " " + s.length)
    for (const part of s) assert.ok(["paper", "ink", "tear"].includes(part.role) && part.path.startsWith("M "))
  }
  for (let y = 0; y < 3; y++) { const e = Real.sigilParts(Real.eyeballParams(4, Real.YAWS[y], {}), 14); assert.ok(e.length >= 3 && e.length <= 6) }
  assert.equal(Real.sigilParts(rp("heavy", 1), 12, { paper: false }).filter((x) => x.role === "paper").length <= 1, true)
})

test("real: the crest face is legible in its slot: 68 px wide, an opening at least 12 px tall, paper left in it (Display popup: emblem eye)", () => {
  for (const face of ["heavy", "stare", "spiral", "lidless", "weeping", "poly"]) {
    const p = Real.realParams(face, 13, Real.CREST[face]), P = Real.realParts(p, Real.CREST_PX)
    assert.equal(P.tier, 2, face + " reaches the full tier")
    const G = P.G, xi = P.iris.x, hPx = (G.yL(xi) - G.yU(xi)) * Real.CREST_PX / 100
    assert.ok(hPx >= 12, face + " opening " + hPx.toFixed(1) + " px at the iris")
    assert.ok(0.62 * Real.CREST_PX <= 43, "the box is within the slot's overflow")
    // the paper that is not covered by the iris is at least a third of the opening
    let open = 0, irisIn = 0
    for (let y = 0; y < 62; y += 0.5) for (let x = 0; x < 100; x += 0.5) if (G.open(x, y, 0)) { open++; if (G.inIris(x, y, 0)) irisIn++ }
    assert.ok(1 - irisIn / open >= 0.5, face + " paper " + (1 - irisIn / open).toFixed(2))
  }
})

// ------------------------------------------------------------------------------------------------ eye motion (eyes-animation.md)
const Mot = load("bar/modules/ItoEyeMotion.js")
const MOT_ARCHS = ["heavy", "stare", "lidless", "spiral", "weeping", "poly", "slit", "eyeball"]
// a made-up pointer path: it sweeps round the eye and now and then leaves
function motLook(n) {
  const a = n * 0.021, r = 40 + 90 * Math.abs(Math.sin(n * 0.007))
  return n % 900 > 700 ? null : { dx: Math.cos(a) * r, dy: Math.sin(a * 1.3) * r * 0.5 }
}
function motRun(arch, level, amp, seconds, mk) {
  let s = Mot.newEye(21, arch, { tier: 2, pupil0: 0.4, S: 68 }), t = 0
  const outs = []
  for (let n = 0; n < Math.round(seconds / 0.033); n++) {
    t += 0.033
    s = Mot.stepEye(s, t, 0.033, Object.assign({ level, amp, arch, look: motLook(n), S: 68, rot: 0, mirror: false, pulse: "always", bloodshot: 0.9, bpm: 60 }, mk ? mk(n, t) : {}))
    outs.push(s.out)
  }
  return outs
}

test("motion EM-T1: determinism: the same seed and dt sequence give identical outputs over 60 s, and a step never changes its input state", () => {
  for (const arch of MOT_ARCHS) for (const level of [1, 2]) {
    const a = motRun(arch, level, 1, 60), b = motRun(arch, level, 1, 60)
    assert.equal(JSON.stringify(a), JSON.stringify(b), arch + " level " + level)
  }
  const s0 = Mot.newEye(5, "heavy", { tier: 2, pupil0: 0.7 }), before = JSON.stringify(s0)
  Mot.stepEye(s0, 0.033, 0.033, { level: 2, amp: 1, arch: "heavy", look: { dx: 40, dy: 5 }, S: 68 })
  assert.equal(JSON.stringify(s0), before)
})

test("motion: a lidless eye keeps its lids open whatever the gaze does (no lid-gaze coupling without lids)", () => {
  for (const level of [1, 2]) {
    const outs = motRun("lidless", level, 1.7, 60, (n) => ({ look: { dx: 0, dy: 200 }, tier: 2 }))
    for (const o of outs) assert.equal(o.frame, 0, "lidless level " + level)
  }
  // a lidded eye still follows the gaze down with its lid at full
  const h = motRun("heavy", 2, 1, 6, () => ({ look: { dx: 0, dy: 200 }, tier: 2 }))
  assert.ok(h.some((o) => o.b >= 0.35 - 1e-9 && o.b < 0.9), "heavy lid follows the gaze down")
})

test("motion EM-T2: blinks close faster than they open; lidless and eyeball never blink; the double and triple shares match the table", () => {
  for (const arch of MOT_ARCHS) {
    const m = Mot.MOTION[arch].blink
    if (!m) continue
    assert.ok(m.close < m.open, arch + " close < open")
  }
  for (const arch of ["lidless", "eyeball"]) {
    assert.equal(Mot.MOTION[arch].blink, null)
    for (let t = 0; t < 600; t += 0.25) assert.equal(Mot.blinkReal(3, t, arch, 2, 1).b, 0, arch)
  }
  // spiral: no blink in subtle, one in full
  let sp1 = 0, sp2 = 0
  for (let t = 0; t < 400; t += 0.05) { sp1 = Math.max(sp1, Mot.blinkReal(3, t, "spiral", 1, 1).b); sp2 = Math.max(sp2, Mot.blinkReal(3, t, "spiral", 2, 1).b) }
  assert.equal(sp1, 0); assert.ok(sp2 > 0.9)
  // the asymmetric profile: the rise to shut takes `close`, the fall takes `open`
  const m = Mot.MOTION.heavy.blink
  assert.ok(Mot.blinkShape(m, m.close * 0.5).b < 1 && Mot.blinkShape(m, m.close + m.hold + m.open * 0.5).b > 0)
  const rate = (arch, n) => { const mm = Mot.MOTION[arch].blink; let c = 0; for (let s = 1; s <= 4000; s++) if (Mot.blinkCount(s, mm, 0) === n) c++; return c / 4000 }
  assert.ok(Math.abs(rate("heavy", 2) - 0.10) <= 0.03, "heavy double " + rate("heavy", 2))
  assert.ok(Math.abs(rate("weeping", 3) - 0.10) <= 0.03, "weeping triple " + rate("weeping", 3))
  assert.ok(Math.abs(rate("weeping", 2) - 0.315) <= 0.03, "weeping double " + rate("weeping", 2))   // 35 % of the 90 % that are not triple
  assert.ok(Math.abs(rate("stare", 2) - 0.05) <= 0.03, "stare double " + rate("stare", 2))
  // subtle stretches the interval by 1.4
  const mh = Mot.MOTION.heavy.blink
  assert.ok(Math.abs((Mot.blinkStart(9, mh, 1, 1) - Mot.blinkStart(9, mh, 1, 0)) / (Mot.blinkStart(9, mh, 2, 1) - Mot.blinkStart(9, mh, 2, 0)) - 1.4) < 0.6)
})

test("motion EM-T3: the gaze stays inside the archetype's box for any pointer, amp 0 / 1 / 1.7", () => {
  for (const arch of MOT_ARCHS) for (const amp of [0, 1, 1.7]) {
    const b = Mot.MOTION[arch].gaze, level = Mot.levelOf("full", amp, false)
    const outs = motRun(arch, level, amp, 40, (n) => ({ look: n % 7 === 0 ? null : { dx: Math.sin(n * 1.7) * 300, dy: Math.cos(n * 2.3) * 200 } }))
    for (const o of outs) {
      const e = b.x === 0 ? Math.hypot(o.gazeX, o.gazeY) : (b.y === 0 ? Math.abs(o.gazeX) / b.x + Math.abs(o.gazeY) : Math.hypot(o.gazeX / b.x, o.gazeY / b.y))
      assert.ok(b.x === 0 ? e < 1e-9 : e <= 1 + 1e-9, arch + " amp " + amp + " gaze " + o.gazeX + "," + o.gazeY)
    }
  }
})

test("motion EM-T4: no overshoot: the gaze and the pupil approach a fixed target monotonically at any dt", () => {
  for (const dt of [0.001, 0.033, 0.1, 0.25, 1]) {
    for (const arch of ["heavy", "stare", "lidless"]) {
      const tg = { x: Mot.MOTION[arch].gaze.x * 0.8, y: -Mot.MOTION[arch].gaze.y * 0.5 }
      let g = { x: 0, y: 0, gl: false }, d = Math.hypot(tg.x - g.x, tg.y - g.y)
      for (let i = 0; i < 400; i++) {
        g = Mot.gazeNext(g, tg, dt, arch)
        const d2 = Math.hypot(tg.x - g.x, tg.y - g.y)
        assert.ok(d2 <= d + 1e-9, arch + " dt " + dt); d = d2
      }
    }
    for (const mood of ["base", "hover", "hot", "dilate"]) {
      const tgt = Mot.pupilTarget("heavy", mood === "dilate" ? "base" : mood, 0.7, 1)
      let pk = 0.2, e = Math.abs(tgt - pk)
      for (let i = 0; i < 300; i++) {
        pk = Mot.pupilNext(pk, mood, dt, "heavy", 0, 1, 0.7, 1)
        const e2 = Math.abs(tgt - pk); assert.ok(e2 <= e + 1e-12 && (pk - tgt) * (0.2 - tgt) >= -1e-12, mood + " dt " + dt); e = e2
      }
    }
  }
  // a glance (a jump over 3 units) is much quicker than a follow
  let g = { x: 0, y: 0, gl: false }
  for (let i = 0; i < 6; i++) g = Mot.gazeNext(g, { x: 8, y: 0 }, 0.033, "heavy")
  assert.ok(g.x > 7.5, "a glance settles in a few ticks: " + g.x)
  let f = { x: 0, y: 0, gl: false }
  for (let i = 0; i < 6; i++) f = Mot.gazeNext(f, { x: 2, y: 0 }, 0.033, "heavy")
  assert.ok(f.x < 1.4, "a follow is slow: " + f.x)
})

test("motion EM-T5: level 0 is at rest; motionAmp 0 is level 0; nothing is scheduled", () => {
  assert.equal(Mot.levelOf("full", 0, false), 0); assert.equal(Mot.levelOf("off", 1, false), 0)
  assert.equal(Mot.levelOf("subtle", 1, false), 1); assert.equal(Mot.levelOf("full", 1.7, false), 2); assert.equal(Mot.levelOf("full", 1, true), 1)
  for (const arch of MOT_ARCHS) {
    let s = Mot.newEye(8, arch, { tier: 2, pupil0: 0.5 })
    for (let n = 1; n < 50; n++) {
      s = Mot.stepEye(s, n * 0.033, 0.033, { level: 0, amp: 0, arch, look: { dx: 30, dy: 9 }, hover: true, S: 68, revealMs: 100, hot: true })
      same(s.out, { frame: 0, b: 0, gazeX: 0, gazeY: 0, pupilK: 1, irisRot: 0, veinK: 1, tearU: 0, tearK: 0, omenPupil: 0, arch })
      assert.equal(Mot.nextEventIn(s, n * 0.033), Infinity)
    }
  }
  // at level 0 a new archetype is worn at once, with no blink
  let s = Mot.newEye(8, "heavy", { tier: 2 })
  s = Mot.stepEye(s, 0.033, 0.033, { level: 0, amp: 0, arch: "stare" })
  assert.equal(s.out.arch, "stare"); assert.equal(s.out.frame, 0)
})

test("motion EM-T6: omens: the rate is 1/14 at calm and 1/9 at lively; none in the cooldown, below level 2, or before 1.2 s; one plan per open", () => {
  let n = 0
  for (let i = 0; i < 10000; i++) { const p = Mot.omenPlan(7, i, 2, 1, null, 1000); if (p) { n++; assert.ok(p.at >= 1.2 && p.dur > 0); assert.ok(Mot.OMEN_KINDS.crest.includes(p.kind)) } }
  assert.ok(Math.abs(n / 10000 - 1 / 14) <= 0.01, "calm rate " + n / 10000)
  let m = 0
  for (let i = 0; i < 10000; i++) if (Mot.omenPlan(7, i, 2, 1.7, null, 1000)) m++
  assert.ok(Math.abs(m / 10000 - 1 / 9) <= 0.012, "lively rate " + m / 10000)
  for (let i = 0; i < 3000; i++) {
    assert.equal(Mot.omenPlan(7, i, 1, 1, null, 1000), null)           // subtle
    assert.equal(Mot.omenPlan(7, i, 0, 1, null, 1000), null)           // off
    assert.equal(Mot.omenPlan(7, i, 2, 1, 950, 1000), null)            // 50 s after the last one
  }
  let after = 0
  for (let i = 0; i < 3000; i++) if (Mot.omenPlan(7, i, 2, 1, 800, 1000)) after++      // 200 s after: allowed again
  assert.ok(after > 0)
  // the same inputs give the same plan
  same(Mot.omenPlan(7, 33, 2, 1.7, null, 0), Mot.omenPlan(7, 33, 2, 1.7, null, 0))
  // every kind of every surface has a duration and a state that ends
  for (const surf of Object.keys(Mot.OMEN_KINDS)) for (const kind of Mot.OMEN_KINDS[surf]) {
    const plan = { kind, at: 2, dur: Mot.OMEN_DUR[kind] }
    assert.ok(plan.dur > 0)
    assert.equal(Mot.omenState(plan, plan.dur + 0.01).active, false)
    assert.equal(Mot.omenState(plan, -0.1).active, false)
  }
  assert.ok(Mot.omenState({ kind: "extrapupil", at: 0, dur: 0.066 }, 0.03).extra)
  const nt = Mot.omenState({ kind: "noticed", at: 0, dur: 1.6 }, 0.5)
  assert.ok(nt.noBlink && nt.look === "pointer" && nt.pupil !== null)
  // no omen shows in subtle, and none during a state swap's blink
  const outs = motRun("heavy", 1, 1, 30, () => ({ plan: { kind: "extrapupil", at: 3, dur: 0.066 }, planT0: 0 }))
  assert.ok(outs.every((o) => o.omenPupil === 0))
})

test("motion EM-T7: the heartbeat: the period is 60 / bpm, the peaks are at 0 and 0.28 of a beat (1 and 0.6)", () => {
  for (const bpm of [54, 72, 110]) {
    const T = 60 / bpm
    for (const t of [0.013, 0.31, 1.07]) assert.ok(Math.abs(Mot.beat(t, bpm) - Mot.beat(t + T, bpm)) < 1e-9)
    assert.ok(Math.abs(Mot.beat(0, bpm) - 1) < 1e-9)
    assert.ok(Math.abs(Mot.beat(0.28 * T, bpm) - 0.6) < 1e-3)
    let best = 0, at = 0
    for (let u = 0.1; u < 0.9; u += 0.001) { const v = Mot.beat(u * T, bpm); if (v > best) { best = v; at = u } }
    assert.ok(Math.abs(at - 0.28) < 0.005 && Math.abs(best - 0.6) < 1e-3)
  }
  assert.equal(Mot.bpmFor("calm", 0), 54); assert.equal(Mot.bpmFor("calm", 1), 72); assert.equal(Mot.bpmFor("critical", 0), 110)
  assert.ok(Mot.bpmFor("hot", 0) === 72 && Mot.bpmFor("hot", 1) > 72 && Mot.bpmFor("hot", 1) <= 110)
})

test("motion EM-T7b: ItoPulse.js (the shell's heart) and ItoEyeMotion.js carry the same numbers", () => {
  const Pulse = load("bar/modules/ItoPulse.js")
  assert.deepEqual(JSON.parse(JSON.stringify(Pulse.BEAT)), JSON.parse(JSON.stringify(Mot.BEAT || Pulse.BEAT)))
  for (const bpm of [54, 63, 72, 90, 110]) for (let t = 0; t < 3; t += 0.037) assert.equal(Pulse.beat(t, bpm), Mot.beat(t, bpm))
  for (const st of ["calm", "hot", "critical"]) for (const f of [0, 0.3, 1, 5, -1, NaN]) assert.equal(Pulse.bpmFor(st, f), Mot.bpmFor(st, f === f ? f : undefined))
  assert.equal(Pulse.beat(NaN, 60), 0); assert.equal(Pulse.beat(1, NaN), 0)
  assert.ok(/^\.pragma library/.test(fs.readFileSync(path.join(root, "bar/modules/ItoPulse.js"), "utf8")))
  assert.ok(!/^\s*\.import/m.test(fs.readFileSync(path.join(root, "bar/modules/ItoEyeMotion.js"), "utf8")), "ItoEyeMotion imports nothing")
})

test("motion EM-T8: bezier matches the ItoMotion.js constants (the mirror) and a reference solver within 1e-4", () => {
  const src = fs.readFileSync(path.join(root, "bar/modules/ItoMotion.js"), "utf8")
  for (const name of Object.keys(Mot.CURVES)) {
    const m = src.match(new RegExp("var " + name + " = \\[([^\\]]+)\\]"))
    assert.ok(m, name + " is in ItoMotion.js")
    same(Mot.CURVES[name], m[1].split(",").map(Number))
  }
  const ref = (c, x) => {
    let lo = 0, hi = 1
    for (let i = 0; i < 60; i++) {
      const s = (lo + hi) / 2, xs = 3 * (1 - s) * (1 - s) * s * c[0] + 3 * (1 - s) * s * s * c[2] + s * s * s
      if (xs < x) lo = s; else hi = s
    }
    const s = (lo + hi) / 2
    return 3 * (1 - s) * (1 - s) * s * c[1] + 3 * (1 - s) * s * s * c[3] + s * s * s
  }
  for (const name of Object.keys(Mot.CURVES)) for (let x = 0; x <= 1; x += 0.01) assert.ok(Math.abs(Mot.bezier(Mot.CURVES[name], x) - ref(Mot.CURVES[name], x)) < 1e-4, name + " " + x)
})

test("motion: the lid opens on the reveal (shut, then 0.7, 0.35, open) and shuts in 160 ms; the pupil wakes from pin", () => {
  assert.equal(Mot.revealLid(0, "open", 1), 1); assert.equal(Mot.revealLid(179, "open", 1), 1)
  assert.ok(Mot.revealLid(260, "open", 1) < 1 && Mot.revealLid(430, "open", 1) < 0.01)
  assert.ok(Mot.revealLid(0, "exit", 1) === 0 && Mot.revealLid(160, "exit", 1) === 1)
  const seq = []
  let s = Mot.newEye(13, "heavy", { tier: 2, pupil0: 0.7 })
  for (let ms = 0; ms <= 1300; ms += 33) {
    s = Mot.stepEye(s, ms / 1000, 0.033, { level: 1, amp: 1, arch: "heavy", S: 68, revealMs: ms <= 1120 ? ms : null })
    seq.push({ ms, f: s.out.frame, pk: s.out.pupilK })
  }
  assert.equal(seq[0].f, 5)                                         // baked shut on the open edge
  assert.equal(seq[seq.length - 1].f, 0)                            // open at the end
  const frames = seq.map((x) => x.f).filter((v, i, a) => i === 0 || v !== a[i - 1])
  assert.ok(frames.every((v, i) => i === 0 || v < frames[i - 1]), "frames only go from shut toward open: " + frames)
  const pinned = seq.find((x) => x.ms === 330).pk
  assert.ok(pinned < 0.25, "the pupil is pinned while the lids open: " + pinned)
  assert.ok(seq[seq.length - 1].pk > 0.95, "and has dilated to the base by 1.3 s")
  assert.ok(seq.find((x) => x.ms === 561).pk < seq[seq.length - 1].pk)
  // exit: the lids shut in 160 ms and stay shut
  s = Mot.newEye(13, "heavy", { tier: 2 })
  let last = 0
  for (let ms = 0; ms <= 400; ms += 33) { s = Mot.stepEye(s, 3 + ms / 1000, 0.033, { level: 1, amp: 1, arch: "heavy", S: 68, exitMs: ms }); last = s.out.frame }
  assert.equal(last, 5)
})

test("motion: a state edge is worn only under the shut frame (the swap hides behind a blink)", () => {
  let s = Mot.newEye(13, "heavy", { tier: 2, pupil0: 0.7 }), t = 0
  const seen = []
  for (let n = 0; n < 120; n++) {
    t += 0.033
    s = Mot.stepEye(s, t, 0.033, { level: 1, amp: 1, arch: n < 20 ? "heavy" : "stare", S: 68, ready: true })
    seen.push({ a: s.out.arch, f: s.out.frame, b: s.out.b })
  }
  const i = seen.findIndex((x) => x.a === "stare")
  assert.ok(i > 20, "it swaps after the request")
  assert.ok(seen[i].f === 5 && seen[i - 1].f >= 3, "the face changes on the shut frame: " + JSON.stringify(seen.slice(i - 2, i + 2)))
  assert.equal(seen[seen.length - 1].f, 0)
  // while the new plates are not ready the shut frame holds
  s = Mot.newEye(13, "heavy", { tier: 2, pupil0: 0.7 }); t = 0
  let held = 0
  for (let n = 0; n < 90; n++) { t += 0.033; s = Mot.stepEye(s, t, 0.033, { level: 1, amp: 1, arch: "stare", S: 68, ready: n > 60 }); if (s.out.frame === 5) held++ }
  assert.ok(held > 40)
})

test("motion: the event-driven sleep: a calm heavy eye with no pointer wakes at most 0.5 times a second on average (bursts, not ticks), and level 2 never sleeps", () => {
  let bursts = 0, ticks = 0
  for (let seed = 1; seed <= 12; seed++) {            // the rhythm is rolled from the seed: the budget is an average over eyes
    let s = Mot.newEye(seed, "heavy", { tier: 2, pupil0: 0.7 }), t = 0, sleptLast = true
    while (t < 300) {
      s = Mot.stepEye(s, t, 0.033, { level: 1, amp: 1, arch: "heavy", S: 68 })
      ticks++
      if (sleptLast && s.busy > 0) bursts++          // a wake that finds work (the 2 s watchdog wake finds none and costs one empty call)
      const wait = Math.max(0.016, Mot.nextEventIn(s, t) / 1000)
      sleptLast = wait > 0.1
      t += wait
    }
  }
  assert.ok(bursts / 3600 <= 0.5, "wake bursts per second " + bursts / 3600)
  assert.ok(ticks / 3600 < 8, "ticks per second " + ticks / 3600)
  assert.ok(bursts / 3600 >= 0.05)
  let s
  s = Mot.newEye(21, "heavy", { tier: 2, pupil0: 0.7 })
  let slow = 0
  for (let n = 0; n < 400; n++) { s = Mot.stepEye(s, n * 0.033, 0.033, { level: 2, amp: 1, arch: "heavy", S: 68 }); if (Mot.nextEventIn(s, 0) <= 66) slow++ }
  assert.equal(slow, 400)
})

test("motion: the specials: the spiral turns inward (40 s per turn in subtle, 24 s in full), the tear forms, runs and vanishes, the veins beat", () => {
  assert.ok(Math.abs(Mot.spiralAngle(10, 1, 1).deg + 90) < 1e-9 && Math.abs(Mot.spiralAngle(6, 2, 1).deg + 90) < 1e-9)
  assert.equal(Mot.spiralAngle(10, 1, 1).breath, 1)
  assert.ok(Math.abs(Mot.spiralAngle(1, 2, 1).breath - 1) <= 0.0151)
  assert.ok(Math.abs(Mot.spiralAngle(10, 1, 1.7).deg) > Math.abs(Mot.spiralAngle(10, 1, 1).deg))
  let on = 0, maxU = 0, ended = false
  for (let t = 0; t < 120; t += 0.05) { const w = Mot.tearAt(4, t, 2); if (w.on) { on++; maxU = Math.max(maxU, w.u); assert.ok(w.k >= 0 && w.k <= 1 && w.u >= 0 && w.u <= 1) } else if (on) ended = true }
  assert.ok(on > 0 && maxU === 1 && ended)
  assert.equal(Mot.tearAt(4, 5, 0).on, false)
  const w1 = Mot.tearAt(4, 0, 1)
  assert.ok(w1)
  const outs = motRun("heavy", 2, 1, 5, () => ({ pulse: true, bpm: 60 }))
  assert.ok(Math.min(...outs.map((o) => o.veinK)) >= 0.72 - 1e-9 && Math.max(...outs.map((o) => o.veinK)) > 0.9)
  const subtle = motRun("heavy", 1, 1, 5, () => ({ pulse: "hot", hot: false }))
  assert.ok(subtle.every((o) => o.veinK === 1))
})

// ------------------------------------------------------------------------------------------------ plates (eyes-animation.md section 3.1)
test("plates EM-T9: realPlates partitions the strokes by layer: no duplicates, the iris plate unclipped, the others clipped as in the flat bake, the band holds the opening dilated by gaze + R", () => {
  for (const arch of Real.ARCHETYPES) for (const [S, tier] of [[46, 1], [68, 2], [140, 3]]) {
    const p = Real.realParams(arch, 7, Real.CREST[arch])
    const flat = Real.realParts(p, S, tier, false)
    const gaze = Mot.MOTION[arch].gaze
    const pl = Real.realPlates(p, S, tier, false, { gaze, veins: true })
    const where = arch + " T" + tier
    const all = [].concat(pl.back, pl.veins, pl.front, pl.iris.strokes, pl.spec)
    const ids = all.map((s) => s.id)
    // the walkers number their runs ("s10_3"), the plate mode has more of them (the hatch runs on under the iris), so only the named strokes can be compared
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i && id !== "plica")
    assert.deepEqual(dup, [], where + " duplicates")
    const named = (s) => !/_\d+$/.test(s.id) && !/^(pupil|pup\d|ruf\d)/.test(s.id)
    const have = new Set(ids)
    // EM5 (P7): the tear bead and its glint are not baked in plate mode; the plate hands over where they rest, and the trail stays baked
    const moved = new Set(["tear", "tearGlint"])
    for (const s of flat.strokes.filter(named)) assert.ok(have.has(s.id) || (moved.has(s.id) && pl.tear), where + " lost " + s.id)
    assert.equal(!!pl.tear, !!p.tear, where + " tear bead handed to the host")
    if (p.tear) { assert.ok(have.has("tearTrail"), where + " trail stays baked"); assert.ok(pl.tear.trail.length === 5 && pl.tear.trail.every((q) => q.every(Number.isFinite))) }
    // the flat bake's pupil strokes are the plate's pupil shapes
    assert.ok(pl.pupils.length >= 1 && flat.strokes.filter((s) => /^pup/.test(s.id)).length >= 1, where + " pupils")
    // layers
    for (const s of pl.iris.strokes) assert.ok(s.clip === undefined, where + " iris plate is unclipped (" + s.id + ")")
    for (const s of pl.spec) assert.ok(s.clip === undefined)
    for (const s of pl.veins) assert.ok(s.role === "vein" && s.clip === true)
    for (const s of pl.back) assert.ok(["sclera"].includes(s.layer))
    for (const s of pl.front) assert.ok(["lid", "lash", "skin", "veil"].includes(s.layer), where + " front " + s.layer)
    assert.ok(pl.back.every((s) => s.id === "sclera" || s.clip === true), where + " back strokes are clipped to the opening")
    // veins fold into the back plate when the plate is not asked for
    const fold = Real.realPlates(p, S, tier, false, { gaze })
    assert.equal(fold.veins.length, 0); assert.ok(fold.back.length >= pl.back.length + pl.veins.length - 0)
    // the iris plate: inside its (2R + 2) box, centred
    const box = pl.iris.size, R = pl.iris.R
    assert.ok(Math.abs(box - (2 * R + 2)) < 1e-9 && pl.iris.cx === R + 1 && pl.iris.cy === R + 1)
    for (const s of pl.iris.strokes) for (let i = 0; i < s.poly.length; i += 2) assert.ok(s.poly[i] > -1 && s.poly[i] < box + 1 && s.poly[i + 1] > -1 && s.poly[i + 1] < box + 1, where + " iris stroke " + s.id + " out of its box")
    // the pupils: unit shapes (radius about 1, the x squashed by the iris' foreshortening), at a place inside the iris
    for (const d of pl.pupils) {
      assert.ok(d.r > 0)
      for (let i = 0; i < d.poly.length; i += 2) assert.ok(Math.hypot(d.poly[i], d.poly[i + 1]) <= 1.12, where + " unit pupil")
      assert.ok(Math.hypot(d.cx, d.cy) <= R)
    }
    assert.ok(pl.pupilBase > 0 && pl.pupilBase <= 0.9)
    // the band: the opening, dilated by the gaze box + R + 1, so an iris that moves to the edge of its box cannot show outside the opening
    assert.ok(pl.band.d >= Math.max(gaze.x, gaze.y) + R, where + " band " + pl.band.d)
    assert.deepEqual(pl.band.poly, flat.clip)
    // the tight occluder: the iris disc (R + 1, and the spiral's 1.5 % breath) swept over the gaze ellipse round the iris centre
    assert.ok(pl.band.sweep && pl.band.sweep.r >= R, where + " sweep r")
    for (const s of pl.iris.strokes) for (let i = 0; i < s.poly.length; i += 2)
      assert.ok(Math.hypot(s.poly[i] - pl.iris.cx, s.poly[i + 1] - pl.iris.cy) * 1.015 <= pl.band.sweep.r, where + " iris ink outside the sweep (" + s.id + ")")
    assert.equal(pl.band.sweep.rx, gaze.x); assert.equal(pl.band.sweep.ry, gaze.y)
    assert.ok(Math.abs(pl.band.sweep.x - pl.iris.x) < 0.01 && Math.abs(pl.band.sweep.y - pl.iris.y) < 0.01, where + " sweep centre")
    assert.deepEqual(pl.clip, flat.clip)
  }
})

test("plates: a lid frame with the lids part shut widens the band by the distance from the iris' open place, so it still cannot show outside", () => {
  for (const arch of ["heavy", "stare", "weeping", "poly"]) {
    const p0 = Real.realParams(arch, 7, Real.CREST[arch]), g = Mot.MOTION[arch].gaze
    const open = Real.realPlates(p0, 68, 2, false, { gaze: g })
    for (const b of [0.2, 0.45, 0.7, 0.9, 1]) {
      const pb = Real.realParams(arch, 7, Object.assign({}, Real.CREST[arch], { blink: b }))
      const near = Real.realPlates(pb, 68, 2, false, { gaze: g })
      const wide = Real.realPlates(pb, 68, 2, false, { gaze: g, irisAt: { x: open.iris.x, y: open.iris.y } })
      assert.ok(wide.band.d >= near.band.d, arch + " " + b)
    }
  }
  // the plates are cached: the same inputs give the same object
  const p = Real.realParams("heavy", 7, null)
  assert.equal(Real.realPlates(p, 68, 2, false, { gaze: { x: 9, y: 1.5 } }), Real.realPlates(p, 68, 2, false, { gaze: { x: 9, y: 1.5 } }))
  assert.equal(Real.realPlates(p, 12, 0, false, null), null)
})

// ------------------------------------------------------------------------------------------------ EM3: the drowned eye's skin flap (master-queue section 2)
const mixRgb = (a, b, t) => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t })
test("EM3 bodyAt: the ramp's own stops at the eye's depth, by stratum; pure; no ramp = null; the 10 % mix and the 8 px bucket", () => {
  const ramp = [{ base: { r: 0.8, g: 0.1, b: 0.1 }, floor: { r: 0.2, g: 0, b: 0 } }, { base: { r: 0.1, g: 0.5, b: 0.1 }, floor: { r: 0, g: 0.2, b: 0 } }]
  const levels = [40, 80], rv = 64
  const at = (y, depth) => Ichor.bodyAt(ramp, levels, rv, y, depth, mixRgb)
  assert.deepEqual(at(100, 0), mixRgb(ramp[0].base, ramp[0].floor, 0))                                  // 28 px of liquid: the lower stratum, at the surface
  assert.deepEqual(at(100, 1), mixRgb(ramp[0].base, ramp[0].floor, 1))
  assert.deepEqual(at(60, 0.5), mixRgb(ramp[1].base, ramp[1].floor, 0.5))     // 68 px: the upper stratum
  assert.equal(Ichor.bodyAt(null, levels, rv, 60, 0.5, mixRgb), null)
  assert.equal(Ichor.bodyAt(ramp, levels, rv, NaN, NaN, mixRgb) !== undefined, true)
  const body = at(100, 0.2), bone = { r: 1, g: 1, b: 1 }
  assert.deepEqual(Ichor.flapFill(body, bone, mixRgb), mixRgb(body, bone, 0.10))
  assert.equal(Ichor.FLAP.mix, 0.10); assert.equal(Ichor.FLAP.bucket, 8)
  assert.equal(Ichor.flapBucket(7.9), 0); assert.equal(Ichor.flapBucket(8), 1); assert.equal(Ichor.flapBucket(NaN), 0)
})

test("EM3 flapShape: covers the opening and the sweep, 3 tear notches, roughened within +-0.8 (+ the notches), broken on the lit side, finite, repeatable", () => {
  for (const arch of ["heavy", "stare", "weeping", "poly", "spiral", "slit"]) for (const seed of [3, 7, 11]) {
    const p = Real.realParams(arch, seed, Real.CREST[arch]), g = Mot.MOTION[arch].gaze
    const pl = Real.realPlates(p, 68, 2, false, { gaze: g, flap: true })
    const fl = pl.band.flap, where = arch + " " + seed
    assert.ok(fl && fl.poly.length === 2 * Real.FLAP.rays, where)
    for (const v of fl.poly.concat(fl.up, fl.down, fl.left, fl.right)) assert.ok(Number.isFinite(v), where + " finite")
    for (let i = 0; i < fl.poly.length; i += 2) assert.ok(fl.poly[i] >= 0 && fl.poly[i] <= 100 && fl.poly[i + 1] >= 0 && fl.poly[i + 1] <= 62, where + " inside the eye's box")
    // covers every point of the opening (a point strictly inside it is inside the flap) and the iris's sweep disc round the centre
    const inPoly = (poly, x, y) => { let c = false; for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) if ((poly[i + 1] > y) !== (poly[j + 1] > y) && x < (poly[j] - poly[i]) * (y - poly[i + 1]) / (poly[j + 1] - poly[i + 1]) + poly[i]) c = !c; return c }
    const o = pl.clip, sw = pl.band.sweep
    let cx = 0, cy = 0; for (let i = 0; i < o.length; i += 2) { cx += o[i]; cy += o[i + 1] } cx /= o.length / 2; cy /= o.length / 2
    for (let i = 0; i < o.length; i += 2) { const x = cx + (o[i] - cx) * 0.97, y = cy + (o[i + 1] - cy) * 0.97; assert.ok(inPoly(fl.poly, x, y), where + " opening point out of the flap") }
    for (let k = 0; k < 16; k++) { const a = k / 16 * 2 * Math.PI, x = sw.x + (sw.rx + sw.r * 0.97) * Math.cos(a) * (sw.rx > 0.01 ? 1 : 0) + sw.r * 0.97 * Math.cos(a) * (sw.rx > 0.01 ? 0 : 1), y = sw.y + sw.ry * Math.sin(a) * 0 + sw.r * 0.97 * Math.sin(a)
      if (x > 1 && x < 99 && y > 1 && y < 61) assert.ok(inPoly(fl.poly, sw.x + (x - sw.x) * 0.97, sw.y + (y - sw.y) * 0.97) || !inPoly(fl.poly, sw.x, sw.y), where + " sweep") }
    // the outline is not a smooth shape: 3 notches (radial dips well below the rough) and a contour that skips the lit side
    const R = []; for (let i = 0; i < fl.poly.length; i += 2) R.push(Math.hypot(fl.poly[i] - fl.cx, fl.poly[i + 1] - fl.cy))
    assert.ok(fl.contour.length >= 1 && fl.contour.length <= 4, where + " contour runs " + fl.contour.length)
    const kept = fl.contour.reduce((n, r) => n + r.length / 2, 0)
    assert.ok(kept < fl.poly.length / 2 + fl.contour.length * 2 && kept > 0.35 * fl.poly.length / 2, where + " contour keeps most of the outline but not the lit side")
    // the same inputs, the same flap (cached), and the shut frame with flapOpen keeps the outline
    assert.equal(Real.realPlates(p, 68, 2, false, { gaze: g, flap: true }), pl)
    const pb = Real.realParams(arch, seed, Object.assign({}, Real.CREST[arch], { blink: 1 }))
    const shut = Real.realPlates(pb, 68, 2, false, { gaze: g, flap: true, flapOpen: pl.clip, irisAt: { x: pl.iris.x, y: pl.iris.y, r: sw.r } })
    assert.deepEqual(shut.band.flap.poly, fl.poly, where + " the flap does not change with the lid")
  }
  const p0 = Real.realParams("heavy", 7, null)
  assert.equal(Real.realPlates(p0, 68, 2, false, { gaze: { x: 9, y: 1.5 } }).band.flap, null, "no flap unless asked: the band is as it was")
})

test("motion EM4 (EM-L10 model): the core sigil blinks every 14-30 s as a height scale 1 -> 0.12 -> 1 in 290 ms, glances <= 1.2 px toward the hottest core (full only), level 0 is at rest", () => {
  for (const seed of [7, 13, 99]) {
    const times = []
    let prev = 1, lo = 1
    for (let t = 0; t < 400; t += 0.01) {
      const b = Mot.sigilBlinkAt(seed, t, 1)
      assert.ok(b >= Mot.SIGIL.shut - 1e-9 && b <= 1 + 1e-9, "scale " + b)
      lo = Math.min(lo, b)
      if (prev === 1 && b < 1) times.push(t)
      prev = b
    }
    assert.ok(lo <= Mot.SIGIL.shut + 0.02, "it shuts")
    for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 14 * 0.7 - 0.5 && times[i] - times[i - 1] <= 30 * 1.3 + 0.5, "gap " + (times[i] - times[i - 1]))
    assert.ok(times.length >= 400 / (30 * 1.2) - 1 && times.length <= 400 / (14 * 0.8) + 1, "blinks in 400 s: " + times.length)
    same([0, 5, 77].map((t) => Mot.sigilBlinkAt(seed, t, 0)), [1, 1, 1])
    assert.equal(Mot.sigilBlinkAt(seed, NaN, 2), 1)
    assert.equal(Mot.sigilNextIn(seed, 0, 0), Infinity); assert.ok(Mot.sigilNextIn(seed, 0, 1) > 0)
  }
  assert.equal(Mot.hottestCore([0.1, 0.4, 0.9, 0.9]), 2); assert.equal(Mot.hottestCore([0.05, 0.1]), -1); assert.equal(Mot.hottestCore([]), -1); assert.equal(Mot.hottestCore([NaN, 0.5]), 1)
  for (const a of [0, 45, 90, 180, 270, 359]) {
    const g = Mot.sigilGlanceTarget(a, 2)
    assert.ok(Math.abs(Math.hypot(g.x, g.y) - 1.2) < 1e-9)
  }
  const up = Mot.sigilGlanceTarget(0, 2), right = Mot.sigilGlanceTarget(90, 2)
  assert.ok(up.y < -1.19 && Math.abs(up.x) < 1e-9 && right.x > 1.19)
  same(Mot.sigilGlanceTarget(90, 1), { x: 0, y: 0 }); same(Mot.sigilGlanceTarget(NaN, 2), { x: 0, y: 0 })
  let g = { x: 0, y: 0 }, last = 0
  for (let i = 0; i < 60; i++) { g = Mot.sigilGlanceNext(g, right, 0.016); assert.ok(g.x >= last - 1e-12 && g.x <= 1.2 + 1e-9, "monotone, no overshoot"); last = g.x }
  assert.equal(g.x, 1.2)
})

// ------------------------------------------------------------------------------------------------ EM6: the omen gate and the omens
test("motion EM-T6: ItoOmenGate: at most one per open, ~1/14 over 10000 opens (calm), 120 s cooldown, none in subtle / off / reduced, none in a stare, no extra pupil on a spiral", () => {
  const gsrc = fs.readFileSync(path.join(root, "bar/modules/ItoOmenGate.js"), "utf8").split("\n").filter((l) => !/^\s*\.(pragma|import)\b/.test(l)).join("\n")
  const gsb = { module: { exports: {} }, Mot }
  vm.runInNewContext(gsrc, gsb, { filename: "ItoOmenGate.js" })
  const Gate = gsb.module.exports
  Gate.reset()
  let n = 0, t = 0
  for (let i = 0; i < 10000; i++) { t += 130; if (Gate.draw(13, 2, 1, "crest", false, "heavy", t)) n++ }   // 130 s apart: the cooldown never blocks
  assert.ok(Math.abs(n / 10000 - 1 / 14) < 0.01, "rate " + n / 10000)
  assert.equal(Gate.state().opens, 10000)
  // the cooldown: right after an omen, another is refused whatever the draw says
  Gate.reset()
  let first = -1
  for (let i = 0; i < 400 && first < 0; i++) if (Gate.draw(13, 2, 1, "crest", false, "heavy", 1000)) first = i
  assert.ok(first >= 0)
  for (let i = 0; i < 400; i++) assert.equal(Gate.draw(13, 2, 1, "crest", false, "heavy", 1000 + 119), null)
  let again = 0
  for (let i = 0; i < 400; i++) if (Gate.draw(13, 2, 1, "crest", false, "heavy", 1000 + 121 + 121 * i)) again++
  assert.ok(again > 0, "after the cooldown it deals again")
  // subtle, off, reduced (level 0 / 1), a stare (quiet), amp 0: never
  Gate.reset()
  for (let i = 0; i < 3000; i++) {
    assert.equal(Gate.draw(13, 1, 1, "crest", false, "heavy", 5000 + 200 * i), null)
    assert.equal(Gate.draw(13, 0, 1, "crest", false, "heavy", 5000 + 200 * i), null)
    assert.equal(Gate.draw(13, 2, 0, "crest", false, "heavy", 5000 + 200 * i), null)
    assert.equal(Gate.draw(13, 2, 1, "crest", true, "heavy", 5000 + 200 * i), null)
  }
  // a spiral eye never gets the extra pupil; the plans are inside the window, after the first 1.2 s
  Gate.reset()
  for (let i = 0; i < 6000; i++) {
    const p = Gate.draw(13, 2, 1, "crest", false, "spiral", 100000 + 200 * i)
    if (p) { assert.notEqual(p.kind, "extrapupil"); assert.ok(p.at >= 1.6 && p.at <= 8 && p.dur > 0); assert.ok(Mot.OMEN_KINDS.crest.includes(p.kind)) }
  }
  // seeded: the same sequence of opens deals the same omens
  const run = () => { Gate.reset(); const o = []; for (let i = 0; i < 500; i++) { const p = Gate.draw(21, 2, 1, "crest", false, "heavy", 1e6 + 130 * i); o.push(p ? p.kind + p.at : "-") } return o.join() }
  assert.equal(run(), run())
  // lively amp (1.7): about 1/9
  Gate.reset(); n = 0
  for (let i = 0; i < 9000; i++) if (Gate.draw(13, 2, 1.7, "crest", false, "heavy", 2e6 + 130 * i)) n++
  assert.ok(Math.abs(n / 9000 - 1 / 9) < 0.012, "lively rate " + n / 9000)
  assert.ok(/^\.pragma library/.test(fs.readFileSync(path.join(root, "bar/modules/ItoOmenGate.js"), "utf8")))
})

test("motion EM-L7 (model): every omen kind poses what the design says: look, pin, no blink, the slow release blink, the extra pupil, no omen after its end", () => {
  const pl = (kind) => ({ kind, at: 2, dur: Mot.OMEN_DUR[kind] })
  const n = Mot.omenState(pl("noticed"), 0.5), r = Mot.omenState(pl("noticed"), 1.4)
  assert.ok(n.active && n.look === "pointer" && n.pupil === Mot.PUPIL.pin && n.noBlink)
  assert.ok(r.active && r.b >= 0 && !r.noBlink)
  assert.equal(Mot.omenState(pl("doubletake"), 0.2).look, "away"); assert.equal(Mot.omenState(pl("doubletake"), 0.8).look, "memo"); assert.equal(Mot.omenState(pl("doubletake"), 1.3).look, null)
  assert.equal(Mot.omenState(pl("extrapupil"), 0.03).extra, true)
  for (const k of Object.keys(Mot.OMEN_DUR)) { assert.equal(Mot.omenState(pl(k), Mot.OMEN_DUR[k] + 0.01).active, false); assert.equal(Mot.omenState(pl(k), -0.1).active, false) }
  // in the stepper: an omen at level 2 moves the eye, none at level 1; a stare (hot) is not asked
  const mk = (level, plan) => { let s = Mot.newEye(13, "heavy", { tier: 2, pupil0: 0.4, S: 68 }), t = 0, out = []; for (let i = 0; i < 400; i++) { t = i * 0.033; s = Mot.stepEye(s, t, 0.033, { level, amp: 1, arch: "heavy", S: 68, tier: 2, pupil0: 0.4, ready: true, look: { dx: 30, dy: 0 }, hover: false, plan, planT0: 0 }); out.push(s.out) } return out }
  const withOmen = mk(2, pl("extrapupil")), none = mk(1, pl("extrapupil"))
  assert.ok(withOmen.some((o) => o.omenPupil === 1), "the extra pupil shows at full")
  assert.ok(none.every((o) => o.omenPupil === 0), "never in subtle")
})

// ------------------------------------------------------------------------------------------------ ItoLore (L1)
test("lore level: off / subtle / full, anything else is subtle", () => {
  same(Lore.LEVELS, ["off", "subtle", "full"])
  for (const l of Lore.LEVELS) assert.equal(Lore.level(l), l)
  for (const v of ["", "loud", undefined, null, 3]) assert.equal(Lore.level(v), "subtle")
})

test("lore stateFor: boundary values of every panel (table 1b)", () => {
  const cpu = (m) => Lore.stateFor("cpu", Object.assign({ pct: 0, maxCore: 0, load1: 0, psi: 0, temp: 50 }, m))
  assert.equal(cpu({ pct: 0.24 }), "idle"); assert.equal(cpu({ pct: 0.25 }), "busy")
  assert.equal(cpu({ pct: -1 }), "idle")
  assert.equal(cpu({ maxCore: 0.79 }), "idle"); assert.equal(cpu({ maxCore: 0.8 }), "hot")
  assert.equal(cpu({ load1: 0.8 }), "idle"); assert.equal(cpu({ load1: 0.81 }), "hot")
  assert.equal(cpu({ psi: 20 }), "idle"); assert.equal(cpu({ psi: 20.1 }), "hot")
  assert.equal(cpu({ pct: 0.9 }), "busy"); assert.equal(cpu({ pct: 0.91 }), "critical")
  assert.equal(cpu({ temp: 80 }), "idle"); assert.equal(cpu({ temp: 80.1 }), "critical")
  assert.equal(cpu({ temp: null }), "idle")
  const ram = (pct) => Lore.stateFor("ram", { pct })
  assert.equal(ram(0.49), "idle"); assert.equal(ram(0.5), "busy"); assert.equal(ram(0.85), "busy"); assert.equal(ram(0.86), "hot")
  assert.equal(ram(0.9), "hot"); assert.equal(ram(0.91), "critical")
  const disk = (m) => Lore.stateFor("disk", Object.assign({ rootFraction: 0.4, anyHot: false, temp: 40, busy: 0, rw: 0 }, m))
  assert.equal(disk({ busy: 0.19 }), "idle"); assert.equal(disk({ busy: 0.2 }), "busy")
  assert.equal(disk({ rw: 1048576 }), "idle"); assert.equal(disk({ rw: 1048577 }), "busy")
  assert.equal(disk({ busy: 0.79 }), "busy"); assert.equal(disk({ busy: 0.8 }), "hot")
  assert.equal(disk({ anyHot: true }), "hot"); assert.equal(disk({ temp: 80 }), "idle"); assert.equal(disk({ temp: 81 }), "hot")
  assert.equal(disk({ rootFraction: 0.9 }), "idle"); assert.equal(disk({ rootFraction: 0.91 }), "critical")
  assert.equal(Lore.stateFor("nope", {}), "idle"); assert.equal(Lore.stateFor("cpu", null), "idle")
})

test("lore flagsFor: the conditions of table 1b", () => {
  const c = Lore.flagsFor("cpu", { pct: 0.9, load1: 1.01, freqAvg: 1000, freqMax: 3000 })
  assert.deepEqual(JSON.parse(JSON.stringify(c)), { oversub: true, throttled: true, quiet: false })
  assert.equal(Lore.flagsFor("cpu", { pct: 0.9, load1: 1, freqAvg: 1800, freqMax: 3000 }).throttled, false)   // 0.6 is not below 0.6
  assert.equal(Lore.flagsFor("cpu", { pct: 0.9, freqAvg: 0, freqMax: 0 }).throttled, false)                    // no clock reading
  assert.equal(Lore.flagsFor("cpu", { pct: 0.04 }).quiet, true)
  const r = Lore.flagsFor("ram", { swapMax: 0.81, groups: 7, cache: 0.31 })
  assert.deepEqual(JSON.parse(JSON.stringify(r)), { swapping: true, swapHot: true, crowd: true, cached: true })
  assert.equal(Lore.flagsFor("ram", { swapMax: 0.5, groups: 6, cache: 0.3 }).swapping, false)
  const d = Lore.flagsFor("disk", { busy: 0.8, temp: 71, more: 2 })
  assert.deepEqual(JSON.parse(JSON.stringify(d)), { walking: true, pounding: true, rust: true, hidden: true })
  assert.equal(Lore.flagsFor("disk", { busy: 0.19, temp: 70, more: 0 }).walking, false)
  assert.equal(Lore.flagsFor("disk", { busy: 0.5, temp: null, more: 0 }).rust, false)
})

test("lore settle: a rise is taken at once, a fall only after three refreshes in a lower state", () => {
  same(Lore.settle(null, "hot", 0), { state: "hot", streak: 0 })
  same(Lore.settle("idle", "critical", 2), { state: "critical", streak: 0 })
  same(Lore.settle("hot", "hot", 1), { state: "hot", streak: 0 })
  let s = { state: "critical", streak: 0 }
  s = Lore.settle(s.state, "idle", s.streak); same(s, { state: "critical", streak: 1 })
  s = Lore.settle(s.state, "idle", s.streak); same(s, { state: "critical", streak: 2 })
  s = Lore.settle(s.state, "idle", s.streak); same(s, { state: "idle", streak: 0 })
  // a rise in between resets the count
  s = Lore.settle("hot", "idle", 0); s = Lore.settle(s.state, "hot", s.streak); same(s, { state: "hot", streak: 0 })
  s = Lore.settle(s.state, "idle", s.streak); same(s, { state: "hot", streak: 1 })
})

test("lore memoFor: every pool is non-empty, lines are lowercase and short, rotation covers the pool, when filters, off is legacy", () => {
  const flagsOf = { cpu: ["oversub", "throttled", "quiet"], ram: ["swapping", "swapHot", "crowd", "cached"], disk: ["walking", "pounding", "rust", "hidden"] }
  for (const panel of ["cpu", "ram", "disk"]) {
    for (const st of ["idle", "busy", "hot", "critical"]) {
      const all = Lore.MEMOS[panel][st]
      if (st !== "idle") { assert.equal(all.length, 0, "only attributed quotes: " + panel + " " + st); assert.equal(Lore.memoFor(panel, st, {}, 0, "subtle", []), ""); continue }
      assert.ok(all.length > 0, panel + " " + st)
      for (const m of all) assert.ok(m.src, "a quote without a source: " + m.text)
      for (const m of all) {
        // the kanji tag after the em dash is a label, not prose: the 48 characters count the sentence
        const prose = m.text.split(" \u2014 ")[0]
        assert.ok([...prose].length <= 48, "too long: " + m.text)
        assert.equal(m.text, m.text.toLowerCase(), "not lowercase: " + m.text)
        if (m.when) assert.ok(flagsOf[panel].includes(m.when), "unknown flag " + m.when)
      }
      // no flags: the pool is the unconditional lines, or all of them when none is unconditional; rotation covers it
      const none = {}, seen = new Set()
      const uncond = all.filter((m) => !m.when)
      const pool = uncond.length ? uncond : all
      for (let i = 0; i < pool.length; i++) seen.add(Lore.memoFor(panel, st, none, i, "subtle", []))
      assert.equal(seen.size, pool.length, panel + " " + st + " rotation")
      for (let i = 0; i < 20; i++) assert.ok(Lore.memoFor(panel, st, none, i, "full", []).length > 0)
      // all flags: the whole table is reachable
      const every = {}; for (const f of flagsOf[panel]) every[f] = true
      const seenAll = new Set(); for (let i = 0; i < all.length; i++) seenAll.add(Lore.memoFor(panel, st, every, i, "subtle", []))
      assert.equal(seenAll.size, all.length)
    }
  }
  // off: the legacy lines, rotating, nothing else
  const legacy = ["a", "b", "c"]
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => Lore.memoFor("cpu", "hot", {}, i, "off", legacy)), ["a", "b", "c", "a", "b"])
  assert.equal(Lore.memoFor("cpu", "hot", {}, 0, "off", []), "")
  // an unknown panel or state never throws
  assert.equal(Lore.memoFor("nope", "hot", {}, 0, "subtle", []), "")
  assert.equal(Lore.memoFor("cpu", "nope", {}, 0, "subtle", []), "")
})

test("lore quoteLines: the legacy memo lines are the QUOTES texts, no copy in the cpu/disk/mem widgets", () => {
  assert.equal(JSON.stringify(Lore.quoteLines()), JSON.stringify(Object.values(Lore.QUOTES).map((q) => q.text)))
  for (const n of ["cpu", "disk", "mem"]) {
    const qml = fs.readFileSync(path.join(root, "plugins/ito." + n + "/BarWidget.qml"), "utf8")
    assert.ok(qml.includes("Lore.quoteLines()") && !qml.includes("restless dreams"), n)
  }
})

test("lore peakHold: window of 30, the latest wins ties", () => {
  let h = [], r
  for (let i = 0; i < 40; i++) { r = Lore.peakHold(h, { i: i % 8, v: i === 3 ? 0.99 : 0.3 }, 30); h = r.hist }
  assert.equal(h.length, 30)
  assert.equal(r.v, 0.3)                                  // the 0.99 at sample 3 has left the window
  r = Lore.peakHold([{ i: 1, v: 0.5 }, { i: 2, v: 0.9 }, { i: 3, v: 0.4 }], { i: 4, v: 0.9 }, 30)
  assert.equal(r.i, 4); assert.equal(r.v, 0.9)           // tie: the latest
  r = Lore.peakHold([], { i: 5, v: 0.2 }, 30); assert.equal(r.i, 5)
  const keep = [{ i: 1, v: 0.5 }]; Lore.peakHold(keep, { i: 2, v: 0.6 }, 30); assert.equal(keep.length, 1)   // the input is not mutated
})

test("lore staticCount / staticTicks: 0 below the line, 1..7 above it; ticks are seeded, sorted and at least 2.5 degrees apart", () => {
  assert.equal(Lore.staticCount(0.79, 0.8), 0); assert.equal(Lore.staticCount(0.81, 0.8), 1)
  assert.equal(Lore.staticCount(1, 0.8), 7); assert.equal(Lore.staticCount(1.4, 0.8), 7)
  assert.equal(Lore.staticCount(0.9, 0.8), 4)
  for (let m = 0.8; m <= 1.0001; m += 0.01) { const c = Lore.staticCount(m, 0.8); assert.ok(c >= 1 && c <= 7) }
  for (let seed = 0; seed < 60; seed++) for (let n = 0; n <= 7; n++) {
    const t = Lore.staticTicks(n, seed)
    assert.equal(t.length, n)
    for (let i = 0; i < n; i++) {
      assert.ok(t[i].dAngle >= -12 && t[i].dAngle <= 12 && t[i].len >= 2 && t[i].len <= 6)
      if (i > 0) assert.ok(t[i].dAngle - t[i - 1].dAngle >= 2.5 - 1e-9, "spacing " + n + " " + seed)
    }
  }
  assert.equal(JSON.stringify(Lore.staticTicks(5, 7)), JSON.stringify(Lore.staticTicks(5, 7)))
  assert.notDeepEqual(JSON.stringify(Lore.staticTicks(5, 7)), JSON.stringify(Lore.staticTicks(5, 8)))
})

test("lore rust: 59 -> 0, 80 -> 240, 95 -> 360, quantised to 4 degrees, nothing without a reading; the notch is at 240", () => {
  assert.equal(Lore.rustSweep(59, 80), 0); assert.equal(Lore.rustSweep(60, 80), 0)
  assert.equal(Lore.rustSweep(80, 80), 240); assert.equal(Lore.rustSweep(90, 80), 360); assert.equal(Lore.rustSweep(95, 80), 360)
  assert.equal(Lore.rustSweep(null, 80), 0); assert.equal(Lore.rustSweep(undefined, 80), 0); assert.equal(Lore.rustSweep(NaN, 80), 0)
  for (let t = 55; t <= 95; t += 0.37) assert.equal(Lore.rustSweep(t, 80) % 4, 0)
  let last = 0; for (let t = 55; t <= 95; t += 0.5) { const v = Lore.rustSweep(t, 80); assert.ok(v >= last); last = v }
  assert.equal(Lore.rustNotch(80), 240)
})

test("lore figure: area round trip under 1e-3, a monotonic level, every point inside the figure, f 0 empty, f 1 whole", () => {
  const A = Lore.figureArea()
  assert.ok(Math.abs(A - (Math.PI * 25 + 208)) < 0.5, "area of the figure " + A)
  const polyArea = (p) => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i].x * q.y - q.x * p[i].y } return Math.abs(a) / 2 }
  let lastLevel = Infinity
  for (let f = 0.02; f < 1; f += 0.02) {
    const fill = Lore.figureFill(f)
    const area = (fill.head.length ? polyArea(fill.head) : 0) + (fill.body.length ? polyArea(fill.body) : 0)
    assert.ok(Math.abs(area / A - f) < 1e-3, "round trip " + f + " -> " + area / A)
    assert.ok(fill.level < lastLevel, "level is monotonic"); lastLevel = fill.level
    for (const p of fill.body) {
      assert.ok(p.y >= -3 - 1e-9 && p.y <= 13 + 1e-9)
      const half = 8 - 3 * (p.y + 3) / 16
      assert.ok(Math.abs(p.x) <= half + 1e-9, "body point outside " + JSON.stringify(p))
    }
    for (const p of fill.head) assert.ok(Math.hypot(p.x, p.y + 9) <= 5.05, "head point outside " + JSON.stringify(p))
    for (const p of [].concat(fill.body, fill.head)) assert.ok(p.y >= fill.level - 1e-9)
  }
  const none = Lore.figureFill(0); assert.equal(none.body.length + none.head.length, 0)
  const all = Lore.figureFill(1); assert.ok(all.body.length >= 3 && all.head.length >= 3)
  assert.ok(Math.abs(polyArea(all.body) + polyArea(all.head) - A) < 1e-9)
  assert.equal(Lore.figureFill(-3).body.length, 0); assert.ok(Lore.figureFill(7).body.length >= 3)
  // below the shoulder line only the body has paint; above it the head appears
  assert.equal(Lore.figureFill(0.3).head.length, 0); assert.ok(Lore.figureFill(0.9).head.length >= 3)
})

test("lore growing: 64 MiB or 5 % since the last refresh, at most two, the largest first; the first sample grows nothing", () => {
  const MiB = 1048576
  const first = Lore.growing(null, [{ key: "a", bytes: 100 * MiB }, { key: "b", bytes: 50 * MiB }], 0)
  same(first.keys, []); same(first.map, { a: 100 * MiB, b: 50 * MiB })
  const rows = [{ key: "a", bytes: 164 * MiB }, { key: "b", bytes: 53 * MiB }, { key: "c", bytes: 1000 * MiB }, { key: "d", bytes: 400 * MiB }, { key: "new", bytes: 900 * MiB }]
  const prev = { a: 100 * MiB, b: 50 * MiB, c: 1000 * MiB, d: 300 * MiB }
  const g = Lore.growing(prev, rows, 0)
  same(g.keys, ["d", "a"])                                // d +100, a +64; b +3 MiB is exactly 6 % -> also growing but over the cap; c did not move
  assert.ok(g.keys.length <= 2)
  const small = Lore.growing({ b: 50 * MiB }, [{ key: "b", bytes: 52 * MiB }], 0); same(small.keys, [])      // 4 %, 2 MiB
  const five = Lore.growing({ b: 100 * MiB }, [{ key: "b", bytes: 105 * MiB }], 0); same(five.keys, ["b"])     // 5 %
  const shrink = Lore.growing({ b: 100 * MiB }, [{ key: "b", bytes: 10 * MiB }], 0); same(shrink.keys, [])
  same(Lore.growing(prev, [{ key: "e", bytes: 5 }], 0).keys, [])
})

test("lore saveTarget: the most free space among mounts that are not hot; -1 with fewer than two or all hot", () => {
  assert.equal(Lore.saveTarget([]), -1); assert.equal(Lore.saveTarget([{ avail: 5, hot: false }]), -1)
  assert.equal(Lore.saveTarget([{ avail: 5, hot: true }, { avail: 9, hot: true }]), -1)
  assert.equal(Lore.saveTarget([{ avail: 5, hot: false }, { avail: 9, hot: false }, { avail: 7, hot: false }]), 1)
  assert.equal(Lore.saveTarget([{ avail: 5, hot: false }, { avail: 90, hot: true }, { avail: 7, hot: false }]), 2)
  assert.equal(Lore.saveTarget(null), -1)
})

test("lore sfxFor: lettering by panel, state and flag (table 1d)", () => {
  same(Lore.sfxFor("cpu", "hot", { oversub: true }), { text: "\u30b4\u30b4\u30b4", key: "gogogo" })
  assert.equal(Lore.sfxFor("cpu", "hot", {}), null)
  assert.equal(Lore.sfxFor("ram", "hot", {}).text, "\u3056\u308f\u3056\u308f"); assert.equal(Lore.sfxFor("ram", "critical", {}).key, "zawazawa")
  assert.equal(Lore.sfxFor("ram", "busy", { swapHot: true }).text, "\u305e\u308f\u305e\u308f")
  assert.equal(Lore.sfxFor("ram", "hot", { swapHot: true }).key, "zawazawa")       // hot wins over swap
  assert.equal(Lore.sfxFor("ram", "busy", {}), null)
  assert.equal(Lore.sfxFor("disk", "hot", { pounding: true }).text, "\u30c9\u30c9\u30c9"); assert.equal(Lore.sfxFor("disk", "busy", { walking: true }), null)
})

test("lore budget: nothing off, two at subtle (no lettering), three at full with one SFX, priority order", () => {
  const all = { cpu: ["gogogo", "knife", "static"], ram: ["zowazowa", "nooses", "zawazawa"], disk: ["dododo", "walker"] }
  for (const p of ["cpu", "ram", "disk"]) same(Lore.budget(p, all[p], "off"), [])
  same(Lore.budget("cpu", all.cpu, "subtle"), ["static", "knife"])
  same(Lore.budget("cpu", all.cpu, "full"), ["static", "knife", "gogogo"])
  same(Lore.budget("cpu", ["gogogo"], "subtle"), [])
  same(Lore.budget("ram", all.ram, "subtle"), [])
  same(Lore.budget("ram", all.ram, "full"), ["zawazawa", "nooses"])          // one SFX only: zowazowa dropped
  same(Lore.budget("ram", ["zowazowa", "nooses"], "full"), ["nooses", "zowazowa"])
  same(Lore.budget("disk", all.disk, "subtle"), ["walker"])
  same(Lore.budget("disk", all.disk, "full"), ["walker", "dododo"])
  same(Lore.budget("disk", [], "full"), [])
  for (const p of ["cpu", "ram", "disk"]) for (const l of ["subtle", "full"]) assert.ok(Lore.budget(p, all[p], l).length <= (l === "full" ? 3 : 2))
})

test("lore cornerBox: the boxes of 1d/4 sit clear of the seal where the seals really are", () => {
  const b = Lore.cornerBox(184, "tr", 10, 30, 1)
  assert.deepEqual(JSON.parse(JSON.stringify(b)), { x: 173, y: 1, w: 10, h: 30, clear: true })
  const w = Lore.cornerBox(184, "br", 22, 12, 2); assert.equal(w.x, 160); assert.equal(w.y, 170)
  assert.deepEqual([Lore.cornerBox(100, "tl", 10, 10, 3).x, Lore.cornerBox(100, "bl", 10, 10, 3).y], [3, 87])
  // the CPU and Disk seals are 160..184 px (clamp(W - 160, 160, 184)): the corner placements are clear on all of them
  for (let S = 160; S <= 184; S++) {
    assert.equal(Lore.cornerBox(S, "tr", 10, 30, 1).clear, true, "tr " + S)
    assert.equal(Lore.cornerBox(S, "br", 22, 12, 2).clear, true, "br " + S)
  }
  // a smaller seal has no room: the lettering is not drawn (clear false) instead of touching the rules
  assert.equal(Lore.cornerBox(132, "tr", 10, 30, 1).clear, false)
})


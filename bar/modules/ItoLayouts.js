.pragma library

// Whole-bar designs: which shape the bar takes, and which widgets sit where. Applying one rewrites the
// arrangement and switches widgets on or off to match; the look (plate, effects, colours) is left alone,
// so a design can be worn in any material.
//
// `hidden` widgets keep their place in the state and are only switched off, so going back to Classic
// brings them all back exactly where they were.

var all = ["ito.spiral", "ito.workspaces", "ito.clock", "ito.tomie", "ito.date", "ito.weather", "ito.tray",
           "ito.notifications", "ito.awake", "ito.nightlight", "ito.recording", "ito.media",
           "ito.network", "ito.bluetooth", "ito.audio", "ito.display", "ito.power",
           "ito.ai", "ito.cpu", "ito.mem", "ito.disk"]

// Every design keeps the same four in the middle: the weather, the time, the seal and the date, the seal exactly at the
// centre of the bar. What changes from one design to the next is what stands either side of them.
var MIDDLE = ["ito.weather", "ito.clock", "ito.tomie", "ito.date"]

var designs = [
  {
    key: "classic", name: "Classic", form: "shibumi",
    note: "The default: menu, workspaces and the AI on the left, the readings on the right.",
    left: ["ito.spiral", "ito.workspaces", "ito.ai"],
    center: MIDDLE,
    right: ["ito.tray", "ito.audio", "ito.mem", "ito.cpu", "ito.disk", "ito.network", "ito.display",
            "ito.bluetooth", "ito.power", "ito.notifications", "ito.awake", "ito.nightlight", "ito.recording", "ito.media"]
  },
  {
    key: "cluster", name: "Cluster", form: "fit",
    note: "Menu and workspaces on the left, the everyday few on the right, in one tight block.",
    left: ["ito.spiral", "ito.workspaces"],
    center: MIDDLE,
    right: ["ito.tray", "ito.network", "ito.audio", "ito.power"]
  },
  {
    key: "compact", name: "Compact", form: "fit",
    note: "One tight block the width of what is in it: the AI and the machine's load beside the everyday readings.",
    left: ["ito.spiral", "ito.workspaces"],
    center: MIDDLE,
    right: ["ito.tray", "ito.network", "ito.audio", "ito.ai", "ito.cpu", "ito.mem"]
  },
  {
    key: "dock", name: "Floating dock", form: "dock",
    note: "A small floating pill: the menu, the workspaces, the middle four and sound and network.",
    left: ["ito.spiral", "ito.workspaces"],
    center: MIDDLE,
    right: ["ito.audio", "ito.network"]
  },
  {
    key: "monitor", name: "Monitor", form: "shibumi",
    note: "The machine first: load, memory, disk and the AI quota get the right-hand side to themselves.",
    left: ["ito.spiral", "ito.workspaces"],
    center: MIDDLE,
    right: ["ito.ai", "ito.cpu", "ito.mem", "ito.disk", "ito.network", "ito.power"]
  },
  {
    key: "minimal", name: "Minimal", form: "shibumi",
    note: "Only what is needed: workspaces on the left, sound and network on the right.",
    left: ["ito.workspaces"],
    center: MIDDLE,
    right: ["ito.tray", "ito.network", "ito.audio"]
  },
  {
    key: "zen", name: "Zen", form: "dock",
    note: "The middle four and nothing else.",
    left: [],
    center: MIDDLE,
    right: []
  }
]

function get(key) {
  for (var i = 0; i < designs.length; i++)
    if (designs[i].key === key) return designs[i]
  return designs[0]
}


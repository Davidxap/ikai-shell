// Loads the whole manga icon set (bar/modules/ItoIconSet.js and the kind files it imports) in node, as the bake sees it.
import fs from "node:fs"
import path from "node:path"
import { loadInk, loadQmlJs, root } from "./icon-raster.mjs"

export function loadSet() {
  const { Ink } = loadInk()
  const Real = loadQmlJs("bar/modules/ItoIconReal.js", { Ink })
  const deps = { Ink, Real }
  for (const n of ["ItoIconReal2", "ItoIconReal3"]) if (fs.existsSync(path.join(root, "bar/modules/" + n + ".js"))) deps[n.replace("ItoIcon", "")] = loadQmlJs("bar/modules/" + n + ".js", { Real })
  if (!fs.existsSync(path.join(root, "bar/modules/ItoIconSet.js"))) return Real
  return loadQmlJs("bar/modules/ItoIconSet.js", deps)
}

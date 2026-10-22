#!/usr/bin/env bash
# Style contract (docs/STYLE_CONTRACT.md) SC-1..SC-8 plus the motion, palette and layering model tests. Source only, no QML runtime.
set -euo pipefail
cd "$(dirname "$0")/../.."
node scripts/qa/style-contract.mjs
[[ -f scripts/qa/visual-systems.test.mjs ]] && node --test scripts/qa/visual-systems.test.mjs >/dev/null
echo "style contract: green"

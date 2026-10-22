#!/usr/bin/env bash
# The clock/calendar model tests under the four time zones that break naive date code:
# UTC, Sao Paulo (midnight DST), Samoa (skipped 2011-12-30), Lord Howe (30 min DST).
set -euo pipefail
cd "$(dirname "$0")/../.."
for tz in UTC America/Sao_Paulo Pacific/Apia Australia/Lord_Howe; do
  echo "TZ=$tz"
  TZ=$tz node --test scripts/qa/time.test.mjs 2>&1 | grep -E "^ℹ (pass|fail)|^✖" || true
  TZ=$tz node --test scripts/qa/time.test.mjs >/dev/null 2>&1 || { echo "FAILED under $tz" >&2; exit 1; }
done

#!/usr/bin/env bash
# Lock theme sync gate: tone_sync, eye accent, cache keys, rollback. Lab only (arrays and temp files); nothing live, nothing locked.
exec python3 -I "$(dirname "${BASH_SOURCE[0]}")/test-lock-tone.py" "$@"

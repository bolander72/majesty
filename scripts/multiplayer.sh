#!/bin/bash
set -euo pipefail
MAJESTY_WORKSPACE="$(cd "$(dirname "$0")/.." && pwd)"
exec "$MAJESTY_WORKSPACE/upstream/majesty-recomp/.venv/bin/python" \
  "$MAJESTY_WORKSPACE/scripts/room_relay.py" "$@"

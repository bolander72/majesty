#!/bin/bash
set -euo pipefail
MAJESTY_WORKSPACE="$(cd "$(dirname "$0")/.." && pwd)"
MAJESTY_PROJECT="$MAJESTY_WORKSPACE/upstream/majesty-recomp"
cd "$MAJESTY_PROJECT"
.venv/bin/python kit/tools/web_launcher.py \
  --game-dir "$MAJESTY_PROJECT" \
  --out "$MAJESTY_PROJECT/build/web-site" \
  --web-build "majesty=$MAJESTY_PROJECT/build/web/recomp"
.venv/bin/python "$MAJESTY_WORKSPACE/scripts/stage-world.py"
exec .venv/bin/python "$MAJESTY_WORKSPACE/scripts/serve-web.py" "${1:-8000}"

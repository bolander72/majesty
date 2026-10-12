#!/bin/bash
set -euo pipefail
MAJESTY_WORKSPACE="$(cd "$(dirname "$0")/.." && pwd)"
MAJESTY_PROJECT="$MAJESTY_WORKSPACE/upstream/majesty-recomp"
export EMSDK_QUIET=1
source "$MAJESTY_WORKSPACE/.tools/emsdk/emsdk_env.sh"
export PATH="$MAJESTY_PROJECT/.venv/bin:$PATH"
cd "$MAJESTY_PROJECT"
.venv/bin/python tools/build.py --target web --jobs 8 "$@"
.venv/bin/python "$MAJESTY_WORKSPACE/scripts/stage-world.py"

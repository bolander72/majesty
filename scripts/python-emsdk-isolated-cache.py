#!/usr/bin/env python3
"""Keep Emscripten's bundled Python bytecode cache inside its owned build trial."""
import os
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
cache = Path(os.environ['MAJESTY_EMSDK_PYCACHE']).resolve()
if not cache.is_relative_to(root / 'output') or not cache.parent.name.startswith('private-resume073-wasm-'):
    raise SystemExit('Require an owned private WASM build cache')
cache.mkdir(exist_ok=True)
python = Path(os.environ.get('MAJESTY_EMSDK_PYTHON',
                            str(root / '.tools/emsdk/python/3.13.3_64bit/bin/python3')))
os.execv(str(python), [str(python), '-X', 'pycache_prefix=' + str(cache), *sys.argv[1:]])

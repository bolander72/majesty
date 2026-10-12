#!/usr/bin/env python3
"""Serve the already-staged launcher, game and world experiment."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'upstream/majesty-recomp/kit/tools'))
from web_launcher import serve

if __name__ == '__main__':
    serve(ROOT / 'upstream/majesty-recomp/build/web-site', int(sys.argv[1]) if len(sys.argv) > 1 else 8000)

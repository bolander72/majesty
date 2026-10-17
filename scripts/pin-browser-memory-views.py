#!/usr/bin/env python3
"""Retain production's fixed shared-memory views in a private browser bundle.

Growable shared views are not accepted by Chrome's synchronous OPFS writer.
Keep Emscripten's existing view-refresh fallback for memory growth. This changes
platform glue only; the WASM and original translated game remain byte-identical.
"""
import argparse
from pathlib import Path
import re

PINNED = 'function getMemoryBuffer() {\n  return wasmMemory.buffer;\n}'


def pin_views(text):
    matches = list(re.finditer(r'^function getMemoryBuffer\(\) \{.*?^\}', text, re.M | re.S))
    if len(matches) != 1:
        raise ValueError('Require one audited Emscripten memory-view selector')
    match = matches[0]
    body = match[0]
    if body == PINNED:
        return text
    if (len(body) > 4096 or body.count('wasmMemory.toResizableBuffer()') != 1 or
            body.count('return wasmMemory.buffer;') != 1 or
            body.count('growMemViews = () => {};') != 1):
        raise ValueError('Memory-view selector changed; review the SDK before packaging')
    return text[:match.start()] + PINNED + text[match.end():]


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--js', type=Path, required=True)
    args = parser.parse_args()
    try:
        original = args.js.read_text()
        changed = pin_views(original)
        if original != changed:
            temporary = args.js.with_suffix('.js.memory-views.tmp')
            temporary.write_text(changed)
            temporary.replace(args.js)
    except (ValueError, OSError) as error:
        parser.exit(1, 'Browser memory-view policy refused: ' + str(error) + '\n')
    print('Production fixed-view policy applied; WASM unchanged')

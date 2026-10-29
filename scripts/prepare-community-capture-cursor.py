#!/usr/bin/env python3
"""Restore the Zoo preview in the shadowing native cursor table, without new art."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'scripts'), str(ROOT / 'third_party/majesty-mod-manager/src')]
from majesty_cam.cam import read_cam
from lib.community_expansion_media import repair_capture_cursor_archive

PRIOR = '74837f9a1b17e18bfd34b7d12f750d0aea0f4bfe96b1d8b3b287f28a55cbdccf'
COMPLETE = 'b7185b4213432bee4c0bfb199ab87a0ead65a5adcd8ec89a75e59e5e4d4197a5'
PATHS = ('Data/alchemist_interfacedata.cam', 'DataMX/alchemist_interfacedata.cam')


def digest(raw):
    return dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())


def stage(args):
    if args.out.exists():
        raise ValueError('Preserve earlier cursor repair stages')
    payloads = []
    for path, expected in [(args.interface, PRIOR), (args.complete, COMPLETE)]:
        if not path.is_file() or path.stat().st_size > 16 * 1024 * 1024:
            raise ValueError('Unavailable bounded cursor archive')
        raw = path.read_bytes()
        if digest(raw)['sha256'] != expected:
            raise ValueError('Cursor source differs from the published resource')
        payloads.append(raw)
    archive, proof = repair_capture_cursor_archive(*(read_cam(raw) for raw in payloads))
    raw = archive.to_bytes()
    args.out.mkdir(parents=True)
    for name in PATHS:
        path = args.out / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)
    proof.update(format='majesty-capture-cursor-resource-stage-v1',
                 inputs=[digest(value) for value in payloads],
                 files={name: digest(raw) for name in PATHS},
                 engineChanged=False, gameplayScriptsChanged=False, playerProfilesAccessed=False)
    (args.out / 'cursor-stage.json').write_text(json.dumps(proof, indent=2) + '\n')
    return proof


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('interface', 'complete', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    print(json.dumps(stage(parser.parse_args())))

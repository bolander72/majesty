#!/usr/bin/env python3
"""Prepare the reviewed live building-scale update privately; never install it."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'third_party/majesty-mod-manager/src'), str(ROOT / 'scripts')]
from majesty_cam.cam import read_cam
from lib.community_building_scale import scale_building_cam
from lib.native_sprite_art import animation_sets

SOURCE_SHA256 = '9a392451bbd208b4623f06172b1eca0ec6814e0056ca2be46dd02b41aa0e84ed'
SCALES = ((90, (b'NDG1', b'NDG2', b'NDG3')),
          (78, (b'BDG1', b'BDG2', b'BDG3')),
          (78, (b'ALB1', b'ALB2', b'ALB3')))


def prepare(source, out):
    if out.exists() or out.is_symlink():
        raise ValueError('Choose a fresh output; previous candidates are preserved')
    if source.is_symlink() or not source.is_file() or source.stat().st_size > 128 * 1024 * 1024:
        raise ValueError('Require the bounded resident original live CAM')
    raw = source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != SOURCE_SHA256:
        raise ValueError('Live baseline changed or already resized; reconcile the release first')
    result, steps = raw, []
    for percent, family in SCALES:
        result, step = scale_building_cam(result, percent, families=[family])
        steps.append(step)
    before, after = (read_cam(b) for b in (raw, result))
    targets = {name for _, family in SCALES for name in family}
    for a, b in zip(before.sections, after.sections, strict=True):
        if a.extension != b.extension:
            raise ValueError('Section identity changed')
        if a.extension == b'TILE':
            # Repacking moves payload offsets; identity and payload bytes stay fixed.
            if [(e.name, e.data) for e in a.entries] != [(e.name, e.data) for e in b.entries[:len(a.entries)]]:
                raise ValueError('Original TILE slots changed')
            continue
        for old, new in zip(a.entries, b.entries, strict=True):
            if old.name != new.name:
                raise ValueError('Original resource identity changed')
            if a.extension == b'IMAG' and old.name[:4] in targets:
                ui = lambda data: {sid: data[start:end] for sid, start, end in animation_sets(data)
                                   if sid & 0xffff in (1000, 1001, 1002)}
                if ui(old.data) != ui(new.data):
                    raise ValueError('Sidebar artwork changed')
            elif old.data != new.data:
                raise ValueError('Unrelated resource changed')
    proof = dict(sourceSha256=SOURCE_SHA256, outputSha256=hashlib.sha256(result).hexdigest(),
                 sourceBytes=len(raw), outputBytes=len(result), steps=steps,
                 originalSlotsAndUnrelatedResourcesPreserved=True, sidebarArtPreserved=True,
                 adventurersAndZooUnchanged=True, sourceUnaffected=source.read_bytes() == raw,
                 nativeRuntimeQualified=False, installed=False, published=False)
    if not proof['sourceUnaffected']:
        raise ValueError('Source changed during staging')
    out.mkdir(parents=True)
    (out / 'Community-main.cam').write_bytes(result)
    (out / 'scale-receipt.json').write_text(json.dumps(proof, indent=2) + '\n')
    return proof


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    a = p.parse_args()
    print(json.dumps(prepare(a.source, a.out)))

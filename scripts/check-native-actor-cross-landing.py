#!/usr/bin/env python3
"""Qualify original in-bounds class rectangle queries in actual Scions."""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import struct

ROOT = Path(__file__).resolve().parents[1]


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def verify(manifest):
    invalidation = load('invalidation', 'check-native-actor-cross-path-invalidate.py')
    populated = load('populated', 'check-native-actor-populated-stage.py')
    landing = load('landing', 'audit-native-landing.py')
    report = invalidation.verify(manifest)
    meta = report['fixture']
    if meta.get('landingProbe') is not True:
        raise ValueError('Missing actual original landing query fixture')
    audit = landing.audit()
    text = Path(meta['log']).read_text()
    rows = re.findall(
        r'^\[streaming\] Cross landing trial=(\d+) centre=(-?\d+),(-?\d+) '
        r'first=(-?\d+),(-?\d+) second=(-?\d+),(-?\d+) shape=0,0 '
        r'rectangle=(-?\d+),(-?\d+),(-?\d+),(-?\d+) selector=0 flags=512,1024 '
        r'queried=(\d+) admitted=2 unchanged=1 unit-same=1 grid-same=1 '
        r'search-same=1 actors-same=1 traits-same=1 shape-same=1 heap-same=1 result=pass$', text, re.M)
    if len(rows) != 64:
        raise ValueError('Missing all original nonempty rectangle query cycles')
    offsets = [(8, 0), (8, 8), (-8, 0), (-8, 8), (0, 8), (-8, -8),
               (8, -8), (0, -8), (12, 0), (12, 8), (-12, 0), (-12, 8),
               (0, 12), (8, 12), (-8, 12), (0, -12)]
    calls, cases = 0, []
    for index, raw in enumerate(rows):
        trial, cx, cy, ax, ay, bx, by, left, top, right, bottom, queried = map(int, raw)
        if trial != index % 16 or not (-16 <= left < right <= 16 and -16 <= top < bottom <= 16):
            raise ValueError('Invalid trial or empty/oversize fallback rectangle')
        first, second = (ax, ay), (bx, by)
        candidates = [(cx + x, cy + y) for x, y in offsets
                      if 16 <= cx + x < 240 and 16 <= cy + y < 240]
        if (first not in candidates or second not in candidates or first == second or
                candidates.index(first) >= candidates.index(second) or
                queried != 2 * (candidates.index(second) + 1)):
            raise ValueError('Landing observations do not match bounded candidate order')
        calls += queried
        case = dict(centre=[cx, cy], admitted=[list(first), list(second)],
                    rectangle=[left, top, right, bottom], callsPerCycle=queried)
        if trial == 0:
            cases.append(case)
        elif case != cases[-1]:
            raise ValueError('Class collision result changed across identical stopped cycles')
    warm = re.findall(
        r'^\[streaming\] Cross class warm actor=(\d+) description=(\d+) ready-before=(\d+) '
        r'shape=0,0 cache-flags=(\d+),(\d+) retained-bytes=(\d+) retained-blocks=(\d+) '
        r'destroyed=1 result=pass$', text, re.M)
    data = (Path(meta['profile']) / 'Populated_Order_Stage.bin').read_bytes()
    cursor = 8
    expected = []
    for _ in range(4):
        identity, size, requests, payload, *_ = struct.unpack_from('<7I', data, cursor)
        cursor += 28
        description, = struct.unpack_from('<I', data, cursor + 48)
        expected.append((identity, description))
        cursor += size + requests * 20 + payload + 4 + 3 * 32 + 4 + 2 * 20
    if len(warm) != 4:
        raise ValueError('Missing explicit per-class warmup')
    for raw, pair in zip(warm, expected):
        identity, description, ready, before, after, retained_bytes, retained_blocks = map(int, raw)
        if ((identity, description) != pair or ready != int(before & 5 == 5) or
                after & 5 != 5 or retained_bytes != 0 or retained_blocks != 0):
            raise ValueError('Unexpected class cache warmup or retained heap growth')
    report.update(scope='64 private restored actor cycles in actual Scions, with original '
                  'nonempty class rectangle collision queries admitting two grid positions '
                  'per cycle after explicit zero-growth original class cache warmup; no '
                  'actor repositioning, terrain-height placement, fresh search or activation',
                  originalInBoundsClassQueriesQualified=True, classQueryCycles=64,
                  originalInBoundsPointCollisionCalls=calls, admittedGridPoints=128,
                  landingCases=cases, originalClassCacheWarmups=4,
                  classWarmupRetainedHeapBytes=0, classWarmupRetainedHeapBlocks=0,
                  originalRectangleFallbackUsed=True, maskedFootprintBranchQualified=False,
                  noQueryEntersInBoundsFootprintBranch=False,
                  viableDestinationLandingQualified=False, actorPositionEdited=False,
                  actorActivationQualified=False, freshDestinationRouteQualified=False,
                  originalLandingInstructionAnchors=audit['verifiedInstructionAnchors'])
    for name in ['scripts/check-native-actor-cross-landing.py', 'scripts/audit-native-landing.py']:
        report['sourceSha256'][name] = populated.sha(ROOT / name)
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Preserve prior qualification')
    result = verify(args.manifest)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k: result[k] for k in ['qualified', 'classQueryCycles',
                     'originalInBoundsPointCollisionCalls', 'classWarmupRetainedHeapBytes',
                     'freshDestinationRouteQualified']}))

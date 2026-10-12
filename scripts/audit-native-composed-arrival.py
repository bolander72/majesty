#!/usr/bin/env python3
"""Pin the original Path goal setter, route storage reader and scalar writer."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
RANGES = [('path-goal-setter', 0x5e1aa0, 0x5e1ab1),
          ('path-reader', 0x5e0d40, 0x5e0e85),
          ('path-writer', 0x5e0e90, 0x5e0f4b)]
ANCHORS = [
    (0x5e1aa0, 'mov', 'eax, dword ptr [esp + 4]'),
    (0x5e1aa4, 'mov', 'edx, dword ptr [esp + 8]'),
    (0x5e1aa8, 'mov', 'dword ptr [ecx + 0x3c], eax'),
    (0x5e1aab, 'mov', 'dword ptr [ecx + 0x40], edx'),
    (0x5e1aae, 'ret', '8'),
    (0x5e0d78, 'lea', 'ecx, [esi + 0x3c]'),
    (0x5e0d96, 'lea', 'edx, [esi + 0x48]'),
    (0x5e0de3, 'lea', 'ebx, [esi + 0x5c]'),
    (0x5e0de9, 'call', '0x4ef790'),
    (0x5e0e1f, 'lea', 'ebp, [esi + 0x4c]'),
    (0x5e0e25, 'call', '0x4ef790'),
    (0x5e0e2a, 'mov', 'ebx, dword ptr [ebx]'),
    (0x5e0e2c, 'lea', 'edx, [ebx*8]'),
    (0x5e0e34, 'call', '0x64c616'),
    (0x5e0e49, 'mov', 'dword ptr [esi + 0x44], eax'),
    (0x5e0e64, 'lea', 'ecx, [eax + ebx*8]'),
    (0x5e0e67, 'call', '0x660930'),
    (0x5e0e70, 'cmp', 'ebx, eax'),
    (0x5e0e82, 'ret', '4'),
    (0x5e0ec1, 'lea', 'ecx, [esi + 0x3c]'),
    (0x5e0ec4, 'call', '0x660960'),
    (0x5e0edf, 'mov', 'ecx, dword ptr [esi + 0x48]'),
    (0x5e0ef5, 'mov', 'eax, dword ptr [esi + 0x5c]'),
    (0x5e0f0b, 'mov', 'edx, dword ptr [esi + 0x4c]'),
    (0x5e0f2a, 'mov', 'eax, dword ptr [esi + 0x44]'),
    (0x5e0f2e, 'lea', 'ecx, [eax + ebx*8]'),
    (0x5e0f31, 'call', '0x660960'),
    (0x5e0f3a, 'cmp', 'ebx, eax'),
    (0x5e0f48, 'ret', '4'),
]


def audit():
    raw = (ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    if hashlib.sha256(raw).hexdigest() != PIN:
        raise ValueError('Composed arrival audit requires the pinned executable')
    pe = pefile.PE(data=raw); base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    ranges, rows = [], {}
    for label, start, end in RANGES:
        instructions = list(decoder.disasm(pe.get_data(start - base, end - start), start))
        if sum(i.size for i in instructions) != end - start:
            raise ValueError('Incomplete composed arrival instruction range')
        values = [dict(address=i.address, mnemonic=i.mnemonic, operands=i.op_str, bytes=i.bytes.hex()) for i in instructions]
        rows.update({v['address']: v for v in values})
        ranges.append(dict(label=label, start=start, end=end, instructions=values))
    for at, mnemonic, operands in ANCHORS:
        if at not in rows or (rows[at]['mnemonic'], rows[at]['operands']) != (mnemonic, operands):
            raise ValueError(f'Path layout/setter anchor changed at {at:08x}')
    if struct.unpack('<3I', pe.get_data(0x68add8 - base, 12)) != (0x5e0d00, 0x5e0d40, 0x5e0e90):
        raise ValueError('Original Path read/write dispatch changed')
    setter = ranges[0]['instructions']
    if len(setter) != 5:
        raise ValueError('Original goal setter has unexpected side effects')
    return dict(qualified=True, executableSha256=PIN, verifiedInstructionAnchors=len(ANCHORS), ranges=ranges,
                nativeGoalOffsets=[0x3c, 0x40], nativePathBufferOffset=0x44,
                nativeCursorOffset=0x48, nativeCountOffset=0x4c, nativeCapacityOffset=0x5c,
                serializedGoalOffsets=[104, 108], serializedCursorOffset=120,
                serializedCapacityOffset=128, serializedCountOffset=136, serializedPointsOffset=140,
                readerAllocatesCapacityTimesEight=True, writerWritesCountPointsOnly=True,
                goalSetterWritesTwoFieldsOnly=True, browserUsed=False, gameLaunches=0,
                scope='Original goal/storage layout; native observations still required, no live scheduling or entity continuity')


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__); p.add_argument('--output', type=Path, required=True)
    args = p.parse_args(); result = audit()
    with args.output.open('x') as f:
        json.dump(result, f, indent=2); f.write('\n')
    print(json.dumps(dict(qualified=True, anchors=result['verifiedInstructionAnchors'])))

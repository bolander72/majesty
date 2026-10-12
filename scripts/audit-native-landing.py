#!/usr/bin/env python3
"""Pin original class footprint selection and rectangle cache initialization."""
import argparse
import hashlib
import json
from pathlib import Path
import struct

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
RANGES = [
    ('class-footprint-getter', 0x42c6b0, 0x42c704),
    ('point-collision', 0x5b8eb0, 0x5b8f4b),
    ('rectangle-bounds', 0x5b85e0, 0x5b862c),
    ('bounds-initializer', 0x5ba280, 0x5ba353),
    ('movement-point-queries', 0x5e1507, 0x5e1556),
]
ANCHORS = [
    (0x42c6b0, 'mov', 'eax, dword ptr [esp + 4]'),
    (0x42c6b9, 'jne', '0x42c6d8'),
    (0x42c6c4, 'test', 'byte ptr [esi + 0x3c], 1'),
    (0x42c6cc, 'call', '0x5ba390'),
    (0x42c6d1, 'mov', 'eax, dword ptr [esi + 0x2c]'),
    (0x5b8eea, 'mov', 'ebx, dword ptr [esp + 0x24]'),
    (0x5b8ef4, 'push', 'ebx'),
    (0x5b8ef7, 'call', 'dword ptr [eax + 0xc0]'),
    (0x5b8eff, 'je', '0x5b8f26'),
    (0x5b8f26, 'mov', 'eax, dword ptr [esp + 0x20]'),
    (0x5b8f3f, 'call', '0x5b8bc0'),
    (0x5b85e9, 'mov', 'esi, dword ptr [eax + 0x14]'),
    (0x5b85ef, 'shr', 'eax, 2'),
    (0x5b85f8, 'call', '0x5ba280'),
    (0x5b85fd, 'mov', 'edx, dword ptr [esi + 0x14]'),
    (0x5b860c, 'mov', 'edx, dword ptr [esi + 0x1c]'),
    (0x5b8618, 'mov', 'edx, dword ptr [esi + 0x18]'),
    (0x5b8620, 'mov', 'edx, dword ptr [esi + 0x20]'),
    (0x5ba34c, 'or', 'al, 4'),
    (0x5ba34e, 'mov', 'dword ptr [esi + 0x3c], eax'),
    (0x5e1507, 'push', '0'),
    (0x5e1509, 'or', 'ch, 4'),
    (0x5e150c, 'push', '0'),
    (0x5e1525, 'call', '0x5b8eb0'),
    (0x5e1532, 'push', '0'),
    (0x5e1534, 'or', 'ebp, 0x200'),
    (0x5e153a, 'push', '0'),
    (0x5e154f, 'call', '0x5b8eb0'),
]


def audit():
    executable = ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    data = executable.read_bytes()
    if hashlib.sha256(data).hexdigest() != PIN:
        raise ValueError('Landing audit requires the pinned executable')
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    if struct.unpack('<I', pe.get_data(0x68098c + 0xc0 - base, 4))[0] != 0x42c6b0:
        raise ValueError('Original actor footprint slot changed')
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    records, addresses = [], {}
    for label, start, end in RANGES:
        rows = []
        for instruction in decoder.disasm(pe.get_data(start - base, end - start), start):
            row = dict(address=f'{instruction.address:08x}', mnemonic=instruction.mnemonic,
                       operands=instruction.op_str, bytes=instruction.bytes.hex())
            addresses[instruction.address] = row
            rows.append(row)
        records.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}', instructions=rows))
    for address, mnemonic, operands in ANCHORS:
        row = addresses.get(address)
        if not row or (row['mnemonic'], row['operands']) != (mnemonic, operands):
            raise ValueError(f'Pinned landing instruction changed at {address:08x}')
    return dict(executableSha256=PIN, verifiedInstructionAnchors=len(ANCHORS), ranges=records,
                pointArguments=['actor', 'gridX', 'gridY', 'collisionFlags',
                                'footprintSelector', 'callback'],
                movementFootprintSelector=0, movementCollisionFlags=[512, 1024],
                zeroSelectorUsesSharedClassFootprint=True,
                nullFootprintUsesOriginalRectangle=True,
                rectangleBoundsCacheFlag=4, rectangleBoundsInitializer='005ba280',
                rectangleBoundsOffsets=[0x14, 0x18, 0x1c, 0x20],
                browserUsed=False, newGameProcessesLaunched=0,
                limitations='Pinned ABI and cache path only; native observations are required '
                            'for point admission. Does not prove terrain height placement, '
                            'world association, fresh search, activation or continuous paging.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Preserve prior audit')
    result = audit()
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(dict(passed=True, anchors=result['verifiedInstructionAnchors'], browserUsed=False)))

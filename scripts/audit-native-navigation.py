#!/usr/bin/env python3
"""Read-only pinned movement/collision and temporary path-state evidence."""
import argparse
import hashlib
import json
from pathlib import Path

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
RANGES = [
    ('script-path-cost', 0x005a8ad0, 0x005a8cd5),
    ('path-cost-bridge', 0x005adf50, 0x005adf8f),
    ('path-cost', 0x005eb2a0, 0x005eb40c),
    ('path-search', 0x005eaf50, 0x005eb146),
    ('path-neighbours', 0x005eb850, 0x005eb954),
    ('neighbour-eligibility', 0x005eb7b0, 0x005eb847),
    ('path-pool-constructor', 0x005ebfc0, 0x005ec071),
    ('path-pool-destructor', 0x005ec0f0, 0x005ec15b),
    ('path-node', 0x005eaf10, 0x005eaf47),
    ('grid-scratch-write', 0x005b8040, 0x005b80d6),
    ('grid-scratch-clear', 0x005b7e30, 0x005b7e94),
    ('point-collision', 0x005b8eb0, 0x005b8f4b),
    ('actor-clearance-bounds', 0x005b85e0, 0x005b862c),
    ('rectangle-collision', 0x005b8bc0, 0x005b8d41),
    ('masked-collision', 0x005b8d50, 0x005b8ea1),
    ('default-actor-collision', 0x005f0db0, 0x005f0e4e),
    ('optional-ground-spawn', 0x004b20a8, 0x004b20f9),
    ('placement-coordinate-wrapper', 0x005a1480, 0x005a14c7),
    ('placement-initialization', 0x005a1350, 0x005a1471),
    ('descriptor-index-lookup', 0x004665f0, 0x0046661d),
    ('class-footprint-getter', 0x0042c6b0, 0x0042c704),
    ('original-order-bank-writer', 0x005e4e20, 0x005e4ea4),
    ('original-path-goal-writer', 0x005e0e90, 0x005e0f4b),
    ('original-world-point-writer', 0x00660960, 0x0066098d),
    ('original-world-to-grid', 0x0043c640, 0x0043c66b),
]


def audit(executable):
    data = executable.read_bytes()
    if hashlib.sha256(data).hexdigest() != PIN:
        raise ValueError('Navigation audit requires the pinned executable')
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    records, addresses = [], {}
    for label, start, end in RANGES:
        rows = []
        for i in decoder.disasm(pe.get_data(start-base, end-start), start):
            row = dict(address=f'{i.address:08x}', mnemonic=i.mnemonic,
                       operands=i.op_str, bytes=i.bytes.hex())
            rows.append(row)
            addresses[i.address] = row
        records.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}', instructions=rows))
    anchors = [
        (0x005e4e2f, 'mov', 'edi, dword ptr [esi + 0x10]'),
        (0x005e4e4b, 'mov', 'eax, dword ptr [esi + 0xc]'),
        (0x005e0ec1, 'lea', 'ecx, [esi + 0x3c]'),
        (0x005e0ec4, 'call', '0x660960'),
        (0x005e0f0b, 'mov', 'edx, dword ptr [esi + 0x4c]'),
        (0x0043c645, 'mov', 'eax, dword ptr [esi + 4]'),
        (0x0043c650, 'mov', 'eax, dword ptr [esi]'),
        (0x0043c65d, 'sar', 'ecx, 4'),
        (0x0043c660, 'sar', 'edx, 4'),
        (0x005a8c98, 'call', '0x5adf50'),
        (0x005adf82, 'call', '0x5ebfc0'),
        (0x005adf89, 'call', '0x5eb2a0'),
        (0x005eb2b7, 'mov', 'ebx, dword ptr [esi + 0x88]'),
        (0x005eb32e, 'call', '0x5eaf50'),
        (0x005eaf66, 'mov', 'edi, dword ptr [ebp + 0x88]'),
        (0x005eafb5, 'call', '0x5b7e30'),
        (0x005eafd6, 'call', '0x5b8fd0'),
        (0x005eb121, 'call', '0x5eb850'),
        (0x005eb7d7, 'mov', 'ecx, dword ptr [ecx + 0x88]'),
        (0x005eb7dd, 'call', '0x5b8eb0'),
        (0x005eb7e2, 'test', 'al, al'),
        (0x005eb7e6, 'xor', 'al, al'),
        (0x005b8ec6, 'cmp', 'eax, dword ptr [edi + 0x48]'),
        (0x005b8ecb, 'cmp', 'ecx, dword ptr [edi + 0x4c]'),
        (0x005b8ed0, 'mov', 'al, 1'),
        (0x005b8ee1, 'mov', 'ebp, 0x5f0db0'),
        (0x005b8ef7, 'call', 'dword ptr [eax + 0xc0]'),
        (0x005b8f1a, 'call', '0x5b8d50'),
        (0x005b8f3f, 'call', '0x5b8bc0'),
        (0x005b85e9, 'mov', 'esi, dword ptr [eax + 0x14]'),
        (0x005b85f8, 'call', '0x5ba280'),
        (0x005b85fd, 'mov', 'edx, dword ptr [esi + 0x14]'),
        (0x005b860c, 'mov', 'edx, dword ptr [esi + 0x1c]'),
        (0x005b8618, 'mov', 'edx, dword ptr [esi + 0x18]'),
        (0x005b8620, 'mov', 'edx, dword ptr [esi + 0x20]'),
        (0x005b8629, 'ret', '0x10'),
        (0x004b20ce, 'push', '2'),
        (0x004b20d0, 'call', 'dword ptr [ebx + 0x64]'),
        (0x004b20d3, 'mov', 'edi, eax'),
        (0x004b20d5, 'test', 'edi, edi'),
        (0x004b20d7, 'je', '0x4b20f6'),
        (0x005a14bf, 'call', 'dword ptr [edi + 0x68]'),
        (0x005a14c4, 'ret', '0x20'),
        (0x005a146e, 'ret', '0x24'),
        (0x004665f0, 'mov', 'eax, dword ptr [ecx + 4]'),
        (0x00466601, 'mov', 'esi, dword ptr [esp + 8]'),
        (0x00466607, 'cmp', 'dword ptr [ecx + 0xc], esi'),
        (0x0046661a, 'ret', '4'),
        (0x0042c6c4, 'test', 'byte ptr [esi + 0x3c], 1'),
        (0x0042c6cc, 'call', '0x5ba390'),
        (0x0042c6d1, 'mov', 'eax, dword ptr [esi + 0x2c]'),
        (0x005b8e0c, 'cmp', 'dword ptr [edx + ecx*4], -0x10'),
        (0x005b8e14, 'mov', 'edx, dword ptr [esi + 0x18]'),
        (0x005b8e38, 'call', 'dword ptr [esp + 0x2c]'),
        (0x005b8e4c, 'cmp', 'esi, 8'),
        (0x005eaf21, 'mov', 'dword ptr [ecx + 0x10], eax'),
        (0x005eaf2c, 'lea', 'esi, [esi + edx*4]'),
        (0x005eaf3c, 'call', '0x5b8040'),
        (0x005b8066, 'mov', 'edi, dword ptr [ecx + 0x14]'),
        (0x005b7e63, 'mov', 'ecx, dword ptr [esi + 0x14]'),
        (0x005b7e74, 'call', '0x501850'),
        (0x005ebfd6, 'mov', 'eax, dword ptr [0x71ca10]'),
        (0x005ebffb, 'push', '0x38000'),
        (0x005ec007, 'mov', 'dword ptr [esi + 0x14], 0x400'),
        (0x005ec016, 'mov', 'dword ptr [esi + 0xc], 0x2000'),
        (0x005ec02c, 'mov', 'edx, 0x2000'),
        (0x005ec045, 'add', 'ecx, 0x1c'),
        (0x005ec05c, 'mov', 'dword ptr [0x71ca10], eax'),
        (0x005ec134, 'call', '0x645bc0'),
        (0x005ec13a, 'call', '0x645bc0'),
    ]
    for address, mnemonic, operands in anchors:
        row = addresses.get(address)
        if not row or (row['mnemonic'], row['operands']) != (mnemonic, operands):
            raise ValueError(f'Pinned navigation anchor changed at {address:08x}')
    return dict(executableSha256=PIN, verifiedInstructionAnchors=len(anchors), ranges=records,
        worldSpatialGridOffset=0x88,
        gridTables=[dict(offset=0x14, role='Temporary path-node pointers and exclusion markers'),
                    dict(offset=0x18, role='Pooled actor lists, at most eight slots per grid bucket')],
        pointOutsideGridBlocked=True, maskedOutsideGridBlocked=True,
        pathPool=dict(globalPointer='0071ca10', nodeStride=28, initialCapacity=8192,
                      initialNodeArrayBytes=229376, initialSearchIterationLimit=1024,
                      interpretation='Constructor defaults, not a proof of total search memory or all caller limits.'),
        scratchReset=dict(target='005b7e30', affected='Dirty rectangle in table +0x14 only; actor table +0x18 retained'),
        navigationGraphRebuildIdentified=False, heightMutationCallerOrderingQualified=False,
        browserUsed=False, newGameProcessesLaunched=0,
        limitations='Pinned static movement/collision paths only. Local grid dependencies and default search storage identified; no original-engine multi-region query, height-to-movement independence, native paging, live actor crossing or complete memory bound qualification.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path, default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output', type=Path, default=ROOT/'output/native-navigation-instruction-audit.json')
    args = parser.parse_args()
    report = audit(args.exe)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(dict(passed=True, verifiedInstructionAnchors=report['verifiedInstructionAnchors'],
                         spatialGridUsedByMovement=True, browserUsed=False)))


if __name__ == '__main__':
    main()

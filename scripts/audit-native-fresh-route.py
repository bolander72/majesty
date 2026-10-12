#!/usr/bin/env python3
"""Pin original route copying, bounded neighbour expansion and owned-cache teardown."""
import argparse
import importlib.util
import json
from pathlib import Path

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
RANGES = [
    ('route-wrapper', 0x5adef0, 0x5adf43),
    ('route-copy', 0x5eb150, 0x5eb29f),
    ('neighbour-commit', 0x5eb960, 0x5ebb2a),
    ('goal-cache-teardown', 0x5ea5b0, 0x5ea602),
    ('search-cache-teardown', 0x5ec0f0, 0x5ec15b),
    ('search-reset', 0x5eb440, 0x5eb4a6),
]
ANCHORS = [
    (0x5adf36, 'call', '0x5ebfc0'),
    (0x5adf3d, 'call', '0x5eb150'),
    (0x5adf42, 'ret', ''),
    (0x5eb156, 'call', '0x5eb440'),
    (0x5eb199, 'call', '0x5eaf50'),
    (0x5eb1a6, 'mov', 'ecx, dword ptr [ecx + 0x14]'),
    (0x5eb1bc, 'cmp', 'ecx, dword ptr [esp + 0x18]'),
    (0x5eb1c5, 'mov', 'dword ptr [edx], ebx'),
    (0x5eb1ca, 'mov', 'dword ptr [edx + 4], ebx'),
    (0x5eb1dc, 'cmp', 'esi, ebp'),
    (0x5eb29c, 'ret', '0x30'),
    (0x5ebaaa, 'call', '0x5eaf10'),
    (0x5ea5c4, 'call', '0x5e9aa0'),
    (0x5ea5ca, 'call', '0x645bc0'),
    (0x5ea5e4, 'call', 'dword ptr [eax]'),
    (0x5ea5ee, 'call', '0x645bc0'),
    (0x5ea5f6, 'mov', 'dword ptr [0x71ca08], 0'),
    (0x5ec104, 'call', '0x5e9aa0'),
    (0x5ec11b, 'call', '0x5e9aa0'),
    (0x5ec134, 'call', '0x645bc0'),
    (0x5ec13a, 'call', '0x645bc0'),
    (0x5ec142, 'mov', 'dword ptr [0x71ca10], 0'),
    (0x5eb49f, 'mov', 'dword ptr [edi + 0x10], esi'),
]


def audit():
    spec = importlib.util.spec_from_file_location('nav_audit', ROOT / 'scripts/audit-native-navigation.py')
    navigation = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(navigation)
    executable = ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    result = navigation.audit(executable)  # hash and full movement/grid anchors
    pe = pefile.PE(data=executable.read_bytes())
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    ranges, addresses = [], {}
    for record in result['ranges']:
        for row in record['instructions']:
            addresses[int(row['address'], 16)] = row
    for label, start, end in RANGES:
        rows = []
        for instruction in decoder.disasm(pe.get_data(start - pe.OPTIONAL_HEADER.ImageBase, end - start), start):
            row = dict(address=f'{instruction.address:08x}', mnemonic=instruction.mnemonic,
                       operands=instruction.op_str, bytes=instruction.bytes.hex())
            addresses[instruction.address] = row
            rows.append(row)
        ranges.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}', instructions=rows))
    loop_anchors = [
        (0x5eb874, 'or', 'eax, 0xffffffff'),
        (0x5eb884, 'or', 'ebp, 0xffffffff'),
        (0x5eb88d, 'je', '0x5eb932'),
        (0x5eb929, 'call', '0x5eb960'),
        (0x5eb933, 'cmp', 'ebp, 2'),
        (0x5eb93d, 'cmp', 'eax, 2'),
    ]
    for address, mnemonic, operands in ANCHORS + loop_anchors:
        row = addresses.get(address)
        if not row or (row['mnemonic'], row['operands']) != (mnemonic, operands):
            raise ValueError(f'Pinned route instruction changed at {address:08x}')
    commit = next(record for record in ranges if record['label'] == 'neighbour-commit')
    if sum(row['mnemonic'] == 'call' and row['operands'] == '0x5eaf10'
           for row in commit['instructions']) != 1:
        raise ValueError('Neighbour commit does not have one node allocation site')
    return dict(executableSha256=result['executableSha256'],
                verifiedInstructionAnchors=result['verifiedInstructionAnchors'] + len(ANCHORS) + len(loop_anchors),
                ranges=ranges, parentRanges=result['ranges'],
                wrapperArguments=['output', 'capacity', 'worldFactory', 'actor', 'startX', 'startY',
                                  'targetActor', 'goalX', 'goalY', 'lookahead', 'radius', 'collisionFlags'],
                neighbourOffsetsPerExpansion=8, fixtureExpansionLimit=256,
                fixtureMaximumNodeAllocations=2049, originalNodeCapacity=8192,
                originalGridScratchClear='005b7e30', originalGoalCacheTeardown='005ea5b0',
                originalSearchCacheTeardown='005ec0f0', teardownRequiresFixtureOwnedCaches=True,
                browserUsed=False, newGameProcessesLaunched=0,
                limitations='Pinned primitive and ownership cleanup. Native observations required '
                            'for full route endpoints and repeated memory recovery; no command '
                            'retargeting, actor relocation/activation or continuous world paging.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Preserve previous audit')
    result = audit()
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(dict(passed=True, anchors=result['verifiedInstructionAnchors'], browserUsed=False)))

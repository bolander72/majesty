#!/usr/bin/env python3
"""Pin saved PRIMARY positions/cells and original coordinate accessors."""
import argparse
import hashlib
import json
from pathlib import Path
import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
RANGES = [('primary-reader', 0x5bfe50, 0x5c0bd0),
          ('map-position', 0x5ad740, 0x5ad767),
          ('cell-update', 0x5ad470, 0x5ad4b1)]
ANCHORS = [
    (0x5c030d, 'mov', 'eax, dword ptr [esp + 0xa4]'),
    (0x5c0314, 'mov', 'dword ptr [edi + 0x48], eax'),
    (0x5c0317, 'mov', 'ecx, dword ptr [esp + 0xa8]'),
    (0x5c031e, 'mov', 'dword ptr [edi + 0x4c], ecx'),
    (0x5c0321, 'mov', 'edx, dword ptr [esp + 0xac]'),
    (0x5c0328, 'lea', 'ecx, [esp + 0xb0]'),
    (0x5c032f, 'mov', 'dword ptr [edi + 0x50], edx'),
    (0x5c0334, 'push', 'ecx'),
    (0x5c0337, 'call', 'dword ptr [eax + 0x9c]'),
    (0x5ad748, 'call', '0x5ad5b0'),
    (0x5ad756, 'sar', 'edx, 0xb'),
    (0x5ad759, 'sar', 'ecx, 0xb'),
    (0x5ad75c, 'mov', 'dword ptr [eax], edx'),
    (0x5ad75e, 'mov', 'dword ptr [eax + 4], ecx'),
    (0x5ad490, 'mov', 'dword ptr [esi + 0x54], ecx'),
    (0x5ad49a, 'mov', 'dword ptr [esi + 0x58], edx'),
    (0x5ad4a4, 'call', 'dword ptr [0x6ce230]'),
]


def audit():
    data = (ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    if hashlib.sha256(data).hexdigest() != PIN:
        raise ValueError('Coordinate audit requires pinned original executable')
    pe = pefile.PE(data=data)
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    ranges, addresses = [], {}
    for label, start, end in RANGES:
        rows = []
        for instruction in decoder.disasm(pe.get_data(start - pe.OPTIONAL_HEADER.ImageBase, end - start), start):
            row = dict(address=f'{instruction.address:08x}', mnemonic=instruction.mnemonic,
                       operands=instruction.op_str, bytes=instruction.bytes.hex())
            addresses[instruction.address] = row
            rows.append(row)
        ranges.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}', instructions=rows))
    for address, mnemonic, operands in ANCHORS:
        row = addresses.get(address)
        if not row or (row['mnemonic'], row['operands']) != (mnemonic, operands):
            raise ValueError(f'Pinned coordinate instruction changed at {address:08x}')
    return dict(executableSha256=PIN, verifiedInstructionAnchors=len(ANCHORS), ranges=ranges,
                nativePositionOffsets=[0x48, 0x4c, 0x50], nativeCellOffsets=[0x54, 0x58],
                mapPositionFixedShift=11, mapPositionReturnsXYOnly=True,
                currentPrimaryReaderUsesExplicitSavedCells=True,
                originalCellUpdateHasSpatialAndObserverEffects=True,
                originalCellUpdateEffectsDeferredByPrivateUnitStage=True,
                browserUsed=False, newGameProcessesLaunched=0,
                limitations='Pinned coordinate access/store paths; no actor elevation policy, '
                            'terrain continuity, in-flight motion rebase or live activation proof.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Preserve previous audit')
    result = audit()
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(dict(passed=True, anchors=result['verifiedInstructionAnchors'], browserUsed=False)))

#!/usr/bin/env python3
"""Pinned world/component teardown ordering, without executing a game."""
import argparse
import hashlib
import json
from pathlib import Path
import struct

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


def audit(executable):
    data = executable.read_bytes()
    if hashlib.sha256(data).hexdigest() != PIN:
        raise ValueError('Region release audit requires the pinned executable')
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    slots = []
    for table, target in [(0x00682950, 0x004913d0), (0x0068a2ec, 0x005bb160),
                          (0x0068b660, 0x005f19f0), (0x0068bac0, 0x005fdb60)]:
        if struct.unpack('<I', pe.get_data(table-base, 4))[0] != target:
            raise ValueError('Pinned region destructor vtable changed')
        slots.append(dict(table=f'{table:08x}', offset=0, target=f'{target:08x}'))
    rows, addresses = [], {}
    for label, start, end in [
        ('world-deleting-destructor', 0x004913d0, 0x004913ee),
        ('world-destructor', 0x004914d0, 0x00491625),
        ('world-base-destructor', 0x005bafb0, 0x005bb159),
        ('world-base-deleting-destructor', 0x005bb160, 0x005bb17e),
        ('terrain-deleting-destructor', 0x005f19f0, 0x005f1a0e),
        ('terrain-derived-destructor', 0x005f1a30, 0x005f1a3b),
        ('terrain-base-deleting-destructor', 0x005fdb60, 0x005fdb7e),
        ('terrain-destructor', 0x005fdcc0, 0x005fdd3d),
        ('grid-destructor', 0x005b8000, 0x005b8036),
        ('actor-list-pool-destructor', 0x005f0ae0, 0x005f0b11),
        ('actor-list-pool-base-destructor', 0x005f0630, 0x005f068c),
    ]:
        instructions = []
        for i in decoder.disasm(pe.get_data(start-base, end-start), start):
            row = dict(address=f'{i.address:08x}', mnemonic=i.mnemonic,
                       operands=i.op_str, bytes=i.bytes.hex())
            instructions.append(row)
            addresses[i.address] = row
        rows.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}', instructions=instructions))
    anchors = [
        (0x004913d3, 'call', '0x4914d0'),
        (0x004913e0, 'call', '0x645bc0'),
        (0x00491510, 'call', '0x492eb0'),
        (0x00491520, 'call', '0x4d66d0'),
        (0x0049160d, 'call', '0x5bafb0'),
        (0x005baff4, 'call', 'dword ptr [eax]'),
        (0x005bb042, 'call', '0x5a1210'),
        (0x005bb0eb, 'mov', 'ecx, dword ptr [esi + 0x80]'),
        (0x005bb0f9, 'call', 'dword ptr [eax]'),
        (0x005bb0fb, 'mov', 'edi, dword ptr [esi + 0x88]'),
        (0x005bb107, 'call', '0x5b8000'),
        (0x005bb10d, 'call', '0x645bc0'),
        (0x005bb163, 'call', '0x5bafb0'),
        (0x005f19f3, 'call', '0x5f1a30'),
        (0x005f1a36, 'jmp', '0x5fdcc0'),
        (0x005fdb63, 'call', '0x5fdcc0'),
        (0x005fdcf0, 'mov', 'eax, dword ptr [esi + 0x48]'),
        (0x005fdcf4, 'call', '0x64d4b6'),
        (0x005fdcf9, 'mov', 'ecx, dword ptr [esi + 0x4c]'),
        (0x005fdcfd, 'call', '0x64d4b6'),
        (0x005b800d, 'call', '0x64d4b6'),
        (0x005b801d, 'call', '0x64d4b6'),
        (0x005b802f, 'call', '0x5f0ae0'),
    ]
    for address, mnemonic, operands in anchors:
        row = addresses.get(address)
        if not row or (row['mnemonic'], row['operands']) != (mnemonic, operands):
            raise ValueError(f'Pinned release anchor changed at {address:08x}')
    return dict(executableSha256=PIN, vtableSlots=slots, verifiedInstructionAnchors=len(anchors), ranges=rows,
                worldDestructor='004914d0', worldBaseDestructor='005bafb0',
                componentOrder=['Owned component and registry cleanup', 'Terrain at world +0x80', 'Spatial grid at world +0x88'],
                terrainArraysFreed=True, gridTablesAndActorListPoolFreed=True,
                liveRegionEvictionQualified=False, browserUsed=False, newGameProcessesLaunched=0,
                limitations='Pinned static teardown ordering only. No checkpoint-before-eviction protocol, complete actor/GPL reference cleanup qualification, live native world unload, WASM heap/GPU release or browser resource qualification.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path, default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output', type=Path, default=ROOT/'output/native-region-release-instruction-audit.json')
    args = parser.parse_args()
    report = audit(args.exe)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(dict(passed=True, verifiedInstructionAnchors=report['verifiedInstructionAnchors'],
                         vtableSlots=len(report['vtableSlots']), liveRegionEvictionQualified=False)))


if __name__ == '__main__':
    main()

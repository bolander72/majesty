#!/usr/bin/env python3
"""Pinned cell-update paths; this does not qualify a live terrain hook."""
import hashlib
import json
from pathlib import Path
import struct

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
# Established original routine boundaries, including each final return.
RANGES = [
    (0x005cc330, 0x005cc3c8), (0x004f6730, 0x004f6771),
    (0x004f6690, 0x004f66d2), (0x005cb8b0, 0x005cc073),
    (0x005cae10, 0x005cb860), (0x0054c3c0, 0x0054c3d1),
    (0x005ca880, 0x005caa87), (0x005ca270, 0x005ca343),
    (0x004fa940, 0x004fa97c), (0x0054d9d0, 0x0054d9ed),
    (0x005caaf0, 0x005cae0a), (0x004fa8f0, 0x004fa934),
    (0x005ca070, 0x005ca10c), (0x004fcb40, 0x004fcba8),
    (0x004fa750, 0x004fa76c), (0x0054d940, 0x0054d971),
    (0x005cc0e0, 0x005cc12f),
]


def audit(executable):
    data = executable.read_bytes()
    if hashlib.sha256(data).hexdigest() != PIN:
        raise ValueError('Cell audit requires the pinned executable')
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    records, addresses, calls, branch_boundaries = [], {}, [], []
    for start, end in RANGES:
        instructions = []
        for i in decoder.disasm(pe.get_data(start-base, end-start), start):
            row = dict(address=f'{i.address:08x}', bytes=i.bytes.hex(),
                       mnemonic=i.mnemonic, operands=i.op_str)
            instructions.append(row)
            addresses[i.address] = row
            if i.mnemonic == 'call':
                calls.append(dict(caller=f'{start:08x}', **row))
            if i.mnemonic.startswith('j'):
                if i.op_str.startswith('0x'):
                    target = int(i.op_str, 16)
                    if not any(begin <= target < stop for begin, stop in RANGES):
                        branch_boundaries.append(dict(caller=f'{start:08x}', **row))
                else:
                    branch_boundaries.append(dict(caller=f'{start:08x}', **row))
        records.append(dict(start=f'{start:08x}', end=f'{end:08x}', instructions=instructions))
    anchors = [
        (0x005cc34f, 'mov', 'ecx, dword ptr [esi + 0x48]'),
        (0x005cc354, 'mov', 'dl, byte ptr [ecx + eax*8 + 6]'),
        (0x005cc35a, 'jne', '0x5cc3b1'),
        (0x005cc365, 'call', '0x4f6690'),
        (0x005cc397, 'call', '0x5cb8b0'),
        (0x005cc3ac, 'call', '0x5cae10'),
        (0x005cb8f3, 'mov', 'ecx, dword ptr [ebx + 0x48]'),
        (0x005cbf9e, 'mov', 'byte ptr [esi + 5], dl'),
        (0x005cbfa1, 'mov', 'byte ptr [esi + 6], al'),
        (0x005cbfa4, 'mov', 'byte ptr [esi + 4], cl'),
        (0x005cbfa7, 'mov', 'byte ptr [esi + 7], bl'),
        (0x005cbf82, 'call', '0x4fcb40'),
        (0x005ca27d, 'mov', 'ebx, dword ptr [ecx + 0x48]'),
        (0x005cab2c, 'mov', 'ecx, dword ptr [ebp + 0x48]'),
        (0x004fa96b, 'mov', 'eax, dword ptr [eax + 0x20]'),
        (0x0054d9df, 'mov', 'edx, dword ptr [ecx + 4]'),
        (0x004f66be, 'mov', 'dword ptr [ecx + 4], eax'),
        (0x004fcb65, 'mov', 'dword ptr [eax], esi'),
        (0x004fcb6f, 'mov', 'dword ptr [eax + 8], edx'),
        (0x004fcba7, 'ret', ''),
        (0x005cc10b, 'call', '0x5cb8b0'),
        (0x005cc123, 'call', '0x5cae10'),
        (0x005caece, 'cmp', 'eax, 0x10'),
        (0x005caed1, 'ja', '0x5cb856'),
        (0x005cb9bc, 'shr', 'eax, 4'),
        (0x005cb9c1, 'shl', 'ecx, 4'),
        (0x005cb9c4, 'add', 'eax, ecx'),
        (0x005cc05a, 'mov', 'eax, dword ptr [esp + 0x24]'),
    ]
    for at, mnemonic, operands in anchors:
        row = addresses.get(at)
        if not row or (row['mnemonic'], row['operands']) != (mnemonic, operands):
            raise ValueError(f'Pinned cell anchor changed at {at:08x}')
    entries = {start for start, _ in RANGES}
    switch_targets = struct.unpack('<17I', pe.get_data(0x005cb860-base, 17*4))
    if any(target not in addresses or not 0x005cae10 <= target < 0x005cb860 for target in switch_targets):
        raise ValueError('Propagation switch target escapes audited instructions')
    if any('0x4c' in row['operands'] and '[esp' not in row['operands'] for row in addresses.values()):
        raise ValueError('Unexpected non-stack +0x4c access in cell paths')
    external = []
    for row in calls:
        operand = row['operands']
        if operand.startswith('0x'):
            target = int(operand, 16)
            if target not in entries:
                if target not in (0x0064cb50, 0x0064d06b, 0x0064d074):
                    raise ValueError('Unexpected cell direct-call closure')
                external.append(row)
        elif row['caller'] != '0054c3c0' or operand != 'dword ptr [0x67f400]':
            raise ValueError('Unexpected cell indirect call')
        else:
            external.append(row)
    return dict(executableSha256=PIN, verifiedInstructionAnchors=len(anchors),
                ranges=records, calls=calls, externalBoundaries=external,
                outgoingOrIndirectBranches=branch_boundaries,
                completeControlFlowClosureQualified=False,
                propagationSwitch=dict(table='005cb860', unsignedMaximumIndex=16,
                                       targets=[f'{target:08x}' for target in switch_targets],
                                       allTargetsInsideAuditedRoutine=True),
                noNonStackOffset4cAccessInAuditedInstructions=True,
                affectedRectangleHelper='004fcb40', affectedRectangleIsActorCallback=False,
                postGenerationReadsNativeCellKindByte=6,
                cellArrayOffset=0x48, nativeCellRecordBytes=8,
                safeBorderMutationHookQualified=False,
                limitations='Static cell paths only; no actor-placement closure or proof of safe height mutation. Original RNG initialization and assertion-library boundaries remain external. No browser/game/build launch.')


if __name__ == '__main__':
    report = audit(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    (ROOT/'output/native-terrain-cells-instruction-audit.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(dict(passed=True, routines=len(RANGES),
                         verifiedInstructionAnchors=report['verifiedInstructionAnchors'],
                         externalBoundaries=len(report['externalBoundaries']), gameLaunches=0)))

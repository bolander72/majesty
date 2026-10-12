#!/usr/bin/env python3
"""Pin original terrain interpolation and direct actor ground-height stores."""
import argparse
import hashlib
import json
from pathlib import Path
import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
RANGES = [('ground', 0x5af220, 0x5af404), ('vertex', 0x5af410, 0x5af42a),
          ('vector', 0x5b01e0, 0x5b01ff), ('multiply', 0x4f6ba0, 0x4f6bb9),
          ('actor-ground-placement', 0x5adb60, 0x5adc93)]
ANCHORS = [
    (0x5af233, 'sar', 'esi, 0x10'), (0x5af236, 'sar', 'edi, 0x10'),
    (0x5af24d, 'mov', 'ebp, dword ptr [ecx + 0x30]'),
    (0x5af255, 'jge', '0x5af3f0'),
    (0x5af25b, 'mov', 'ebp, dword ptr [ecx + 0x34]'),
    (0x5af263, 'jge', '0x5af3f0'),
    (0x5af289, 'call', '0x5af410'), (0x5af2b8, 'call', '0x5af410'),
    (0x5af2e9, 'call', '0x5af410'), (0x5af31b, 'call', '0x5af410'),
    (0x5af336, 'xor', 'ecx, esi'), (0x5af338, 'test', 'cl, 1'),
    (0x5af347, 'jle', '0x5af366'), (0x5af388, 'jge', '0x5af39c'),
    (0x5af3c8, 'call', '0x4f6ba0'), (0x5af3d5, 'call', '0x4f6ba0'),
    (0x5af3e7, 'mov', 'dword ptr [eax], ecx'),
    (0x5af3f7, 'mov', 'dword ptr [eax], 0'),
    (0x5af410, 'mov', 'eax, dword ptr [ecx + 0x38]'),
    (0x5af41c, 'mov', 'ecx, dword ptr [ecx + 0x4c]'),
    (0x5af424, 'lea', 'eax, [ecx + eax*8]'),
    (0x4f6baa, 'imul', 'edx'), (0x4f6bac, 'shr', 'eax, 0x10'),
    (0x4f6baf, 'shl', 'edx, 0x10'), (0x4f6bb2, 'or', 'eax, edx'),
    (0x5adb79, 'mov', 'ebp, 0x200000'),
    (0x5adb81, 'mov', 'edi, dword ptr [eax + 0x80]'),
    (0x5adc29, 'call', '0x5af220'),
    (0x5adc2e, 'mov', 'eax, dword ptr [eax]'),
    (0x5adc40, 'mov', 'ebp, eax'),
    (0x5adc42, 'mov', 'eax, dword ptr [esi + 0x74]'),
    (0x5adc63, 'mov', 'dword ptr [esi + 0x50], ebp'),
    (0x5adc70, 'call', '0x5ad540'),
]


def audit(executable=None):
    executable = executable or ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    raw = executable.read_bytes()
    if hashlib.sha256(raw).hexdigest() != PIN:
        raise ValueError('Ground audit requires pinned executable before decoding')
    pe = pefile.PE(data=raw)
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    ranges, rows = [], {}
    for label, start, end in RANGES:
        block = pe.get_data(start - pe.OPTIONAL_HEADER.ImageBase, end - start)
        instructions = list(decoder.disasm(block, start))
        if sum(i.size for i in instructions) != len(block):
            raise ValueError('Incomplete original ground instruction range')
        values = []
        for i in instructions:
            row = dict(address=f'{i.address:08x}', bytes=i.bytes.hex(), mnemonic=i.mnemonic, operands=i.op_str)
            rows[i.address] = row
            values.append(row)
        ranges.append(dict(label=label, start=start, end=end, instructions=values))
    for at, mnemonic, operands in ANCHORS:
        if at not in rows or (rows[at]['mnemonic'], rows[at]['operands']) != (mnemonic, operands):
            raise ValueError(f'Original ground anchor changed at {at:08x}')
    return dict(qualified=True, executableSha256=PIN, verifiedInstructionAnchors=len(ANCHORS), ranges=ranges,
                heightFractionBits=16, nativeVertexBytes=24, alternatingDiagonal=True,
                groundQueryMutatesWorld=False, parentlessGroundPlacementWritesHeightDirectlyToActorZ=True,
                completePlacementHasNotificationsAndWorldRefresh=True,
                actorPrivatePlacementSafe=False, actorMovementElevationPolicyQualified=False,
                gameLaunches=0, browserLaunches=0)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = audit()
    with args.output.open('x') as f:
        json.dump(result, f, indent=2)
        f.write('\n')
    print(json.dumps(dict(qualified=True, anchors=result['verifiedInstructionAnchors'])))

#!/usr/bin/env python3
"""Verify the pinned complete vehicle record without activating an actor."""
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
        raise ValueError('The secondary-unit audit requires the pinned DirectDraw executable')
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    records, decoded = [], {}
    for label, start, end in [
        ('reader-context-constructor', 0x005c1da0, 0x005c1de5),
        ('writer-context-constructor', 0x005c21f0, 0x005c220d),
        ('unit-component-dispatch', 0x005c1f30, 0x005c1fe9),
        ('unit-envelope-write', 0x005c22b0, 0x005c234a),
        ('vehicle-secondary-read-callback', 0x00435060, 0x00435071),
        ('vehicle-secondary-write-callback', 0x00435080, 0x0043508f),
        ('vehicle-secondary-read', 0x004338f0, 0x00433a4f),
        ('vehicle-secondary-write', 0x004336a0, 0x00433778),
        ('vehicle-secondary-destruction', 0x00433620, 0x00433691),
    ]:
        raw = pe.get_data(start-base, end-start)
        instructions = [dict(address=f'{i.address:08x}', bytes=i.bytes.hex(),
                             mnemonic=i.mnemonic, operands=i.op_str)
                        for i in decoder.disasm(raw, start)]
        if sum(len(bytes.fromhex(i['bytes'])) for i in instructions) != len(raw):
            raise ValueError(f'Incomplete decoding: {label}')
        if instructions[-1]['mnemonic'] != 'ret':
            raise ValueError(f'Incomplete method boundary: {label}')
        decoded.update({i['address']: i for i in instructions})
        records.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}', instructions=instructions))
    checks = [
        ('primary-reader-descriptor', '005c1fa8', 'mov', 'eax, dword ptr [ecx + 8]'),
        ('secondary-reader-descriptor', '005c1fb0', 'mov', 'eax, dword ptr [edx + 0xc]'),
        ('read-three-cdecl-args', '005c1fc4', 'add', 'esp, 0xc'),
        ('read-dispatch-return', '005c1fe6', 'ret', '0xc'),
        ('write-two-cdecl-args', '005c231d', 'add', 'esp, 8'),
        ('write-dispatch-return', '005c2347', 'ret', '8'),
        ('secondary-read-receiver', '00435069', 'mov', 'ecx, dword ptr [ecx]'),
        ('secondary-read-method', '0043506b', 'call', '0x4338f0'),
        ('secondary-write-method', '00435089', 'call', '0x4336a0'),
        ('secondary-tag', '004336b4', 'push', '0x44434553'),
        ('secondary-version-two', '004336db', 'push', '2'),
        ('secondary-write-name', '00433703', 'call', '0x4e6540'),
        ('secondary-write-count', '00433708', 'mov', 'eax, dword ptr [ebx + 0x15c]'),
        ('secondary-read-name', '004339b2', 'call', '0x4e68d0'),
        ('secondary-read-map', '00433a1d', 'call', '0x426790'),
        ('secondary-map-destruction', '0043366c', 'call', '0x426be0'),
    ]
    for label, address, mnemonic, operands in checks:
        actual = decoded[address]
        if (actual['mnemonic'], actual['operands']) != (mnemonic, operands):
            raise ValueError(f'Unexpected secondary-unit instruction: {label}')
    reader = struct.unpack('<4I', pe.get_data(0x006bd760-base, 16))
    writer = struct.unpack('<5I', pe.get_data(0x006bd874-base, 20))
    if reader != (0x4c434856, 0x005c0b00, 0x005bfe50, 0x00435060):
        raise ValueError('Unexpected original vehicle reader descriptor')
    if writer != (0x4c434856, 0x005c0df0, 0x005c0bd0, 0x00435080, 1):
        raise ValueError('Unexpected original vehicle writer descriptor')
    return dict(executableSha256=PIN, ranges=records,
                readerDescriptor=[f'{x:08x}' for x in reader],
                writerDescriptor=[f'{x:08x}' for x in writer],
                checkedInstructions=[dict(label=label, **decoded[address]) for label,address,_,_ in checks],
                limitations='UNIT includes primary and vehicle secondary name/map state. '
                'Orders, containers and global GPL agent state are separate. '
                'No family post-load activation or cross-region transfer is established.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path, default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output', type=Path, default=ROOT/'output/native-unit-secondary-audit.json')
    args = parser.parse_args()
    result = audit(args.exe)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2)+'\n')
    print(f'Pinned vehicle secondary boundary verified; {sum(len(r["instructions"]) for r in result["ranges"])} instructions')


if __name__ == '__main__':
    main()

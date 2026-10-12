#!/usr/bin/env python3
"""Audit the pinned original primary-unit stream constructors and lifecycle."""
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
        raise ValueError('The primary-unit audit requires the pinned DirectDraw executable')
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    records, decoded = [], {}
    for label, start, end in [
        ('primary-unit-read', 0x005bfe50, 0x005c0aff),
        ('primary-unit-write', 0x005c0bd0, 0x005c0ded),
        ('output-file-wrapper', 0x004ee910, 0x004eeb0f),
        ('output-file-destruction', 0x004eeb10, 0x004eeb46),
        ('input-file-wrapper', 0x004ef470, 0x004ef672),
        ('input-file-destruction', 0x004ef680, 0x004ef6b6),
        ('chunk-header-read', 0x004ee840, 0x004ee881),
        ('original-registration', 0x005a12e0, 0x005a1347),
        ('original-removal', 0x005baf20, 0x005baf66),
        ('spatial-removal', 0x005ad400, 0x005ad420),
        ('primary-spatial-placement', 0x005ad470, 0x005ad4b1),
        ('attribute-node-allocation', 0x00413c50, 0x00413c6b),
        ('base-unit-construction', 0x005a1d20, 0x005a1e2f),
        ('vehicle-helper-construction', 0x005b3380, 0x005b344c),
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
        ('writer-stream-wrapper', '005c0be1', 'mov', 'edi, dword ptr [eax + 0x18]'),
        ('writer-primary-tag', '005c0be8', 'push', '0x4d495250'),
        ('writer-version-nine', '005c0c1d', 'mov', 'dword ptr [esp + 0x40], 9'),
        ('writer-sixty-byte-header', '005c0c9d', 'push', '0x3c'),
        ('writer-attributes', '005c0d14', 'call', '0x4f0630'),
        ('reader-sixty-byte-header', '005c04b6', 'push', '0x3c'),
        ('reader-factory', '005c04d9', 'call', 'dword ptr [edx + 0x60]'),
        ('reader-registration', '005c0539', 'call', 'dword ptr [edx + 0x6c]'),
        ('reader-resolve-description', '005c0543', 'call', '0x5a2120'),
        ('reader-attributes', '005c05e8', 'call', '0x4f06d0'),
        ('reader-output', '005c04ab', 'mov', 'dword ptr [edx], edi'),
        ('output-ctor-ret', '004eeb0c', 'ret', '0xc'),
        ('input-ctor-ret', '004ef66f', 'ret', '0xc'),
        ('output-owned-dtor', '004eeb2d', 'call', 'dword ptr [eax]'),
        ('input-owned-dtor', '004ef69d', 'call', 'dword ptr [eax]'),
        ('allocate-primary-id', '005a12fd', 'call', 'dword ptr [eax + 0x48]'),
        ('removal-original-destructor', '005baf5d', 'call', 'dword ptr [edx]'),
        ('primary-placement', '005c0567', 'call', 'dword ptr [eax + 0x9c]'),
        ('placement-removes-previous', '005ad484', 'call', 'dword ptr [eax + 0x98]'),
        ('spatial-removal-grid', '005ad419', 'call', '0x5b88a0'),
        ('separate-attribute-header', '005a1d8d', 'call', '0x413c50'),
        ('separate-helper-allocation', '005b3411', 'call', '0x64c616'),
        ('separate-helper-construction', '005b3429', 'call', '0x5ef3e0'),
        ('unit-helper-field', '005b342e', 'mov', 'dword ptr [esi + 0x18], eax'),
    ]
    for label, address, mnemonic, operands in checks:
        actual = decoded[address]
        if (actual['mnemonic'], actual['operands']) != (mnemonic, operands):
            raise ValueError(f'Unexpected primary-unit instruction: {label}')
    table = [struct.unpack('<I', pe.get_data(0x0067f744+slot-base, 4))[0] for slot in [0, 4, 8, 12]]
    if table != [0x004ee750, 0x004ee7b0, 0x004ee810, 0x004ee840]:
        raise ValueError('Unexpected original chunk-stream methods')
    for slot, expected in [(0x98, 0x005ad400), (0x9c, 0x005ad470)]:
        actual, = struct.unpack('<I', pe.get_data(0x0068098c+slot-base, 4))
        if actual != expected:
            raise ValueError('Unexpected vehicle spatial lifecycle')
    return dict(executableSha256=PIN, ranges=records,
                checkedInstructions=[dict(label=label, **decoded[address]) for label,address,_,_ in checks],
                limitations='Primary restoration is not family post-load activation. Only the saved unit ID is normalized; '
                'external IDs, orders, containers, inventory and GPL state need remapping before regional transfer.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path, default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output', type=Path, default=ROOT/'output/native-unit-primary-audit.json')
    args = parser.parse_args()
    result = audit(args.exe)
    args.output.write_text(json.dumps(result, indent=2)+'\n')
    print(f'Pinned primary-unit boundary verified; {sum(len(r["instructions"]) for r in result["ranges"])} instructions')


if __name__ == '__main__':
    main()

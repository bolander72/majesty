#!/usr/bin/env python3
"""Verify the pinned GPL agent envelopes and native-unit association boundary."""
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
        raise ValueError('The agent-state audit requires the pinned DirectDraw executable')
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    records, decoded = [], {}
    for label, start, end in [
        ('runtime-state-write', 0x00623870, 0x006238fa),
        ('manager-state-write', 0x006336f0, 0x00633891),
        ('manager-state-read', 0x006338a0, 0x00633c29),
        ('agent-state-write', 0x00626740, 0x006268e1),
        ('agent-state-read', 0x006269b0, 0x00626bf4),
        ('envelope-write-begin', 0x00665e20, 0x00665e51),
        ('envelope-write-end', 0x00665e60, 0x00665ec4),
        ('agent-native-object', 0x00626310, 0x0062633c),
        ('agent-native-object-id', 0x006263c0, 0x006263c4),
        ('native-unit-primary-write', 0x005c0bd0, 0x005c0ded),
        ('native-unit-attribute-write', 0x004f0630, 0x004f06cb),
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
        ('runtime-version-three', '0062388c', 'push', '3'),
        ('runtime-manager', '006238bc', 'call', '0x6336f0'),
        ('manager-version-two', '00633716', 'push', '2'),
        ('manager-agent-count', '0063378e', 'mov', 'eax, dword ptr [edi + 0x34]'),
        ('manager-agent-key', '006337a6', 'mov', 'ecx, dword ptr [eax + 0xc]'),
        ('manager-agent-record', '006337b9', 'call', '0x626740'),
        ('agent-own-number', '0062684d', 'mov', 'eax, dword ptr [edi + 0x10]'),
        ('agent-name', '00626859', 'lea', 'ecx, [edi + 0x14]'),
        ('agent-native-unit-id', '00626861', 'mov', 'ecx, dword ptr [edi + 0x20]'),
        ('agent-deleted', '0062686c', 'mov', 'dl, byte ptr [edi + 0x28]'),
        ('agent-counter', '00626877', 'mov', 'eax, dword ptr [edi + 0x2c]'),
        ('agent-tail-first-byte', '00626882', 'mov', 'cl, byte ptr [edi + 0x30]'),
        ('agent-tail-second-byte', '0062688d', 'mov', 'dl, byte ptr [edi + 0x32]'),
        ('envelope-first-marker', '00665e69', 'push', '0'),
        ('envelope-second-marker', '00665e72', 'push', '-1'),
        ('envelope-total-bytes', '00665e96', 'sub', 'eax, edx'),
        ('native-unit-optional-state', '005c0caf', 'mov', 'edx, dword ptr [esi + 0x7c]'),
        ('optional-state-version', '005c0cdd', 'push', '1'),
        ('unit-attribute-map', '005c0d14', 'call', '0x4f0630'),
    ]
    for label, address, mnemonic, operands in checks:
        actual = decoded[address]
        if (actual['mnemonic'], actual['operands']) != (mnemonic, operands):
            raise ValueError(f'Unexpected agent-state instruction: {label}')
    for table, expected in [(0x006ce640, 0x0063a410), (0x006ce69c, 0x0063a440)]:
        tag, callback = struct.unpack('<2I', pe.get_data(table-base, 8))
        if (tag, callback) != (0x204c5047, expected):
            raise ValueError('Unexpected native GPL root descriptor')
    return dict(executableSha256=PIN, ranges=records,
                checkedInstructions=[dict(label=label, **decoded[address]) for label,address,_,_ in checks],
                limitations='Read-only saved record ranges and world-local IDs. Attribute values, '
                'function identities, queues, live activation and cross-region remapping are not qualified.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path, default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output', type=Path, default=ROOT/'output/native-agent-state-audit.json')
    args = parser.parse_args()
    result = audit(args.exe)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2)+'\n')
    print(f'Pinned GPL state boundary verified; {sum(len(r["instructions"]) for r in result["ranges"])} instructions')


if __name__ == '__main__':
    main()

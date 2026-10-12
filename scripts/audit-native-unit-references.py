#!/usr/bin/env python3
"""Verify pinned saved-ID, container and inventory boundaries for region travel."""
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
        raise ValueError('The unit-reference audit requires the pinned DirectDraw executable')
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    ranges = [
        ('saved-id-registry-lookup', 0x005a10d0, 0x005a110c),
        ('order-read', 0x005b1cb0, 0x005b1ce8),
        ('order-list-read', 0x005b1cf0, 0x005b1dc8),
        ('order-write', 0x005b1dd0, 0x005b1e46),
        ('order-list-write', 0x005b1e50, 0x005b1f4b),
        ('container-read', 0x005bfb30, 0x005bfb59),
        ('container-list-read', 0x005bfb60, 0x005bfc38),
        ('container-write', 0x005bfc40, 0x005bfcc7),
        ('container-list-write', 0x005bfcd0, 0x005bfdc9),
        ('container-state-read', 0x00599460, 0x005995bb),
        ('container-state-write', 0x005995c0, 0x00599729),
        ('container-group-read', 0x005986c0, 0x005987bc),
        ('container-group-write', 0x005987c0, 0x00598896),
        ('inventory-owner-query', 0x004d6f10, 0x004d6f7f),
        ('inventory-read', 0x004d6f80, 0x004d70a0),
        ('inventory-write', 0x004d70a0, 0x004d7117),
        ('global-write', 0x00436200, 0x00436540),
        ('global-reference-set-write', 0x00491df0, 0x00491e63),
        ('four-byte-integer-write', 0x004eecc0, 0x004eed10),
        ('original-owner-getter', 0x005a2660, 0x005a2664),
        ('original-owner-setter', 0x005a2670, 0x005a2689),
        ('gpl-owner-getter', 0x00423ec0, 0x00423ef6),
        ('physical-parent-getter', 0x005a2260, 0x005a227a),
        ('gpl-gameplay-parent-getter', 0x004215f0, 0x004216af),
        ('gpl-parent-container-resolution', 0x004318a0, 0x004318d9),
        ('fixed-position-resolution', 0x005ad5b0, 0x005ad64f),
        ('map-position-resolution', 0x005ad740, 0x005ad767),
    ]
    records, decoded = [], {}
    for label, start, end in ranges:
        instructions = [dict(address=f'{i.address:08x}', bytes=i.bytes.hex(),
                             mnemonic=i.mnemonic, operands=i.op_str)
                        for i in decoder.disasm(pe.get_data(start-base, end-start), start)]
        if not instructions or instructions[-1]['mnemonic'] != 'ret':
            # Some ranges include alignment NOPs after their final return.
            meaningful = [i for i in instructions if i['mnemonic'] != 'nop']
            if not meaningful or meaningful[-1]['mnemonic'] != 'ret':
                raise ValueError(f'Incomplete instruction range: {label}')
        decoded.update({i['address']: i for i in instructions})
        records.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}', instructions=instructions))
    checks = [
        ('order-prefix-id', '005b1ef9', 'mov', 'ecx, dword ptr [esi + 0x60]'),
        ('order-prefix-write', '005b1f00', 'call', '0x4eec70'),
        ('container-prefix-id', '005bfd75', 'mov', 'eax, dword ptr [esi + 0x60]'),
        ('container-prefix-write', '005bfd7c', 'call', '0x4eec70'),
        ('container-owner-to-id', '005995e0', 'mov', 'ecx, dword ptr [eax + 0x60]'),
        ('container-member-to-id', '005995f9', 'mov', 'edx, dword ptr [eax + 0x60]'),
        ('container-owner-resolve', '00599552', 'call', '0x5a10d0'),
        ('container-member-resolve', '0059956c', 'call', '0x5a10d0'),
        ('inventory-owner-id', '004d6f1a', 'mov', 'edi, dword ptr [eax + 0x60]'),
        ('inventory-item-write', '004d70ca', 'call', '0x4eec70'),
        ('inventory-owner-write', '004d70d5', 'call', '0x4eed10'),
        ('integer-width', '004eecdd', 'push', '4'),
        ('owner-field', '005a2660', 'mov', 'eax, dword ptr [ecx + 0x70]'),
        ('owner-gpl-virtual-getter', '00423ee5', 'call', 'dword ptr [edx + 0x1c]'),
        ('map-x-fixed-shift', '005ad756', 'sar', 'edx, 0xb'),
        ('map-y-fixed-shift', '005ad759', 'sar', 'ecx, 0xb'),
        ('physical-parent-field', '005ad5b6', 'mov', 'eax, dword ptr [esi + 0x74]'),
        ('physical-parent-position-flag', '005ad5bd', 'test', 'byte ptr [esi + 0x64], 0x80'),
        ('gameplay-parent-container-kind', '004318a1', 'push', '0x65'),
    ]
    for label, address, mnemonic, operands in checks:
        i = decoded[address]
        if (i['mnemonic'], i['operands']) != (mnemonic, operands):
            raise ValueError(f'Unexpected pinned reference instruction: {label}')
    prefix_calls = [i for i in decoded.values() if 0x0043632c <= int(i['address'], 16) < 0x00436421
                    and i['mnemonic'] == 'call' and i['operands'] in ('0x4eed10', '0x4eec70')]
    if len(prefix_calls) != 19:
        raise ValueError('Unexpected global prefix before reference set and inventory')
    descriptors = []
    for tag, reader, writer, expected_read, expected_write in [
        ('ORDR', 0x006bd7c0, 0x006bd8ec, (0x005b1cf0, 0x005b1cb0), (0x005b1e50, 0x005b1dd0)),
        ('CONT', 0x006bd7d0, 0x006bd900, (0x005bfb60, 0x005bfb30), (0x005bfcd0, 0x005bfc40)),
        ('GSGL', 0x006bd7e0, 0x006bd914, (0x004350b0, 0), (0x00435140, 0)),
    ]:
        read_words = struct.unpack('<4I', pe.get_data(reader-base, 16))
        write_words = struct.unpack('<5I', pe.get_data(writer-base, 20))
        if (struct.pack('<I', read_words[0]).decode('ascii') != tag or
                struct.pack('<I', write_words[0]).decode('ascii') != tag or
                read_words[1:3] != expected_read or write_words[1:3] != expected_write):
            raise ValueError(f'Unexpected reference descriptor: {tag}')
        descriptors.append(dict(tag=tag, readerAddress=f'{reader:08x}', writerAddress=f'{writer:08x}',
                                readerWords=[f'{word:08x}' for word in read_words],
                                writerWords=[f'{word:08x}' for word in write_words]))
    owner_slots = []
    for table in (0x0067f96c, 0x0067fe6c, 0x0068098c):
        for slot, expected in ((0x1c, 0x005a2660), (0x20, 0x005a2670)):
            target, = struct.unpack('<I', pe.get_data(table + slot - base, 4))
            if target != expected:
                raise ValueError('Unexpected observed building/ground/vehicle owner method')
            owner_slots.append(dict(table=f'{table:08x}', slot=slot, target=f'{target:08x}'))
    return dict(executableSha256=PIN, referenceDescriptors=descriptors, ownerVtableSlots=owner_slots,
                checkedInstructions=[dict(label=label, **decoded[address]) for label, address, _, _ in checks],
                globalPrefixFourByteWords=len(prefix_calls), ranges=records,
                limitations='Saved IDs are scoped to one native world. Order targets, GPL state, '
                            'navigation and cross-region reference remapping remain unimplemented.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path, default=ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output', type=Path, default=ROOT / 'output/native-unit-reference-audit.json')
    args = parser.parse_args()
    result = audit(args.exe)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(f'Pinned reference boundaries verified; {sum(len(r["instructions"]) for r in result["ranges"])} instructions -> {args.output}')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Verify the pinned original unit factory, registration and post-load boundary."""
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
        raise ValueError('The unit-lifecycle audit requires the pinned DirectDraw executable')
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    ranges = [
        # End before the factory's embedded switch table: those bytes are data.
        ('unit-factory', 0x0042c3d0, 0x0042c435),
        ('unit-registration', 0x005a12e0, 0x005a1347),
        ('registry-registration-broadcast', 0x00596a40, 0x00596a70),
        ('registered-unit-lookup', 0x005a10d0, 0x005a110c),
        ('family-read-and-finalization', 0x005c0b00, 0x005c0bc7),
        ('primary-unit-read', 0x005bfe50, 0x005c0b00),
        ('map-position', 0x005ad740, 0x005ad767),
        ('primary-id-allocation', 0x005bad20, 0x005bad39),
        ('registered-unit-removal', 0x005baf20, 0x005baf66),
        ('vehicle-scalar-deleting-destructor', 0x00433600, 0x0043361e),
    ]
    records, decoded = [], {}
    for label, start, end in ranges:
        raw = pe.get_data(start-base, end-start)
        instructions = [dict(address=f'{i.address:08x}', bytes=i.bytes.hex(),
                             mnemonic=i.mnemonic, operands=i.op_str)
                        for i in decoder.disasm(raw, start)]
        if sum(len(bytes.fromhex(i['bytes'])) for i in instructions) != len(raw):
            raise ValueError(f'Incomplete instruction decoding: {label}')
        meaningful = [i for i in instructions if i['mnemonic'] != 'nop']
        if not meaningful or meaningful[-1]['mnemonic'] != 'ret':
            raise ValueError(f'Incomplete method range: {label}')
        decoded.update({i['address']: i for i in instructions})
        records.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}',
                            instructions=instructions))
    checks = [
        ('primary-factory-dispatch', '005c092b', 'call', 'dword ptr [eax + 0x60]'),
        ('primary-registration-dispatch', '005c0977', 'call', 'dword ptr [edx + 0x6c]'),
        ('restore-saved-id', '005a1329', 'mov', 'dword ptr [esi + 0x60], eax'),
        ('allocate-primary-id', '005a12fd', 'call', 'dword ptr [eax + 0x48]'),
        ('allocate-secondary-id', '005a1315', 'call', 'dword ptr [edx + 0x54]'),
        ('unit-world-registry', '005a1330', 'mov', 'dword ptr [esi + 0x84], edi'),
        ('registration-broadcast', '005a133d', 'call', '0x596a40'),
        ('post-load-required', '005c0b91', 'call', 'dword ptr [edx + 0x1b4]'),
        ('failed-unit-cleanup', '005c0ba5', 'call', 'dword ptr [eax + 0x30]'),
        ('factory-ret-two-args', '0042c432', 'ret', '8'),
        ('registration-ret-three-args', '005a1344', 'ret', '0xc'),
        ('lookup-ret-one-arg', '005a1109', 'ret', '4'),
        ('position-ret-one-output', '005ad764', 'ret', '4'),
        ('increment-original-counter', '005bad23', 'inc', 'eax'),
        ('allocator-counter-field', '005bad29', 'mov', 'dword ptr [ecx + 0x28], eax'),
        ('removal-broadcast-id', '005baf42', 'call', 'dword ptr [edx + 4]'),
        ('removal-deleting-flag', '005baf59', 'push', '1'),
        ('removal-original-destructor', '005baf5d', 'call', 'dword ptr [edx]'),
        ('removal-ret-one-arg', '005baf63', 'ret', '4'),
        ('vehicle-original-free', '00433610', 'call', '0x645bc0'),
    ]
    for label, address, mnemonic, operands in checks:
        actual = decoded[address]
        if (actual['mnemonic'], actual['operands']) != (mnemonic, operands):
            raise ValueError(f'Unexpected lifecycle instruction: {label}')
    slots = []
    for slot, expected in [(0x48, 0x005bad20), (0x54, 0x005bad60),
                           (0x60, 0x0042c3d0), (0x6c, 0x005a12e0)]:
        actual, = struct.unpack('<I', pe.get_data(0x00682950+slot-base, 4))
        if actual != expected:
            raise ValueError(f'Unexpected original factory slot: {slot:x}')
        slots.append(dict(table='00682950', slot=slot, target=f'{actual:08x}'))
    destructor, = struct.unpack('<I', pe.get_data(0x0068098c-base, 4))
    if destructor != 0x00433600:
        raise ValueError('Unexpected original vehicle destructor')
    return dict(executableSha256=PIN, factorySlots=slots, ranges=records,
                vehicleDestructor=dict(table='0068098c', slot=0, target=f'{destructor:08x}'),
                checkedInstructions=[dict(label=label, **decoded[address])
                                     for label, address, _, _ in checks],
                limitations='The primary reader alone skips required family post-load processing. '
                            'Registration with a zero saved ID allocates an ID, but cross-region '
                            'reference remapping and actor handoff are not implemented.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path,
                        default=ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output', type=Path, default=ROOT / 'output/native-unit-lifecycle-audit.json')
    args = parser.parse_args()
    result = audit(args.exe)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(f'Pinned unit lifecycle verified; '
          f'{sum(len(r["instructions"]) for r in result["ranges"])} instructions -> {args.output}')


if __name__ == '__main__':
    main()

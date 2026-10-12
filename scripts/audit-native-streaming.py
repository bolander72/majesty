#!/usr/bin/env python3
"""Decode the pinned native save/unit boundary without changing game inputs."""
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
        raise ValueError('The streaming audit requires the pinned DirectDraw executable')
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    # These ranges include the full original save/load wrappers, the recovered
    # unit-state body and an independently listed description-key resolver.
    ranges = [
        ('named-load-lifecycle', 0x004354d0, 0x00435610),
        ('native-save-writer', 0x00435610, 0x0043583d),
        ('unit-state-body', 0x005bfe50, 0x005c0b00),
        ('primary-unit-write', 0x005c0bd0, 0x005c0ded),
        ('primary-unit-read-dispatch', 0x005c1f30, 0x005c1fe9),
        ('description-key-resolution', 0x005a2120, 0x005a219b),
    ]
    records = []
    for label, start, end in ranges:
        instructions = [dict(address=f'{i.address:08x}', bytes=i.bytes.hex(),
                             mnemonic=i.mnemonic, operands=i.op_str)
                        for i in decoder.disasm(pe.get_data(start-base, end-start), start)]
        records.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}',
                            instructions=instructions))
    slots = []
    for offset, expected in [(4, 0x00435610), (0x0c, 0x004354d0), (0x44, 0x004359c0)]:
        address = 0x00680c60 + offset
        actual, = struct.unpack('<I', pe.get_data(address-base, 4))
        if actual != expected:
            raise ValueError(f'Unexpected original serializer slot {offset:x}')
        slots.append(dict(table='00680c60', offset=offset,
                          address=f'{address:08x}', target=f'{actual:08x}'))
    descriptors = []
    for index, tag in enumerate(('BLDG', 'VHCL', 'GRND', 'RWRD', 'MSGF', 'OFMP')):
        reader = 0x006bd750 + index * 16
        writer = 0x006bd860 + index * 20
        read_words = struct.unpack('<4I', pe.get_data(reader-base, 16))
        write_words = struct.unpack('<5I', pe.get_data(writer-base, 20))
        if (struct.pack('<I', read_words[0]).decode('ascii') != tag or
                struct.pack('<I', write_words[0]).decode('ascii') != tag or
                read_words[2] != 0x005bfe50 or write_words[2] != 0x005c0bd0):
            raise ValueError(f'Unexpected primary unit descriptor {tag}')
        descriptors.append(dict(tag=tag, readerAddress=f'{reader:08x}',
                                readerWords=[f'{word:08x}' for word in read_words],
                                writerAddress=f'{writer:08x}',
                                writerWords=[f'{word:08x}' for word in write_words]))
    return dict(executableSha256=PIN, imageBase=f'{base:08x}', slots=slots,
                unitDescriptors=descriptors,
                ranges=records,
                limitations='Instruction evidence and callback observation; no actor export, '
                            'reference remapping or cross-region hero transfer is implemented.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path, default=ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output', type=Path, default=ROOT / 'output/native-streaming-instruction-audit.json')
    args = parser.parse_args()
    result = audit(args.exe)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(f'Pinned serializer slots verified; decoded {sum(len(r["instructions"]) for r in result["ranges"])} instructions -> {args.output}')


if __name__ == '__main__':
    main()

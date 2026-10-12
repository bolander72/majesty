#!/usr/bin/env python3
"""Read-only pinned executable evidence for compact saved terrain records."""
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
        raise ValueError('Terrain audit requires the pinned DirectDraw executable')
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    descriptors = []
    for tag, reader, writer, read_fn, write_fn in [
        ('MAP ', 0x006ce610, 0x006ce660, 0x005f3570, 0x005f3690),
        ('MTER', 0x006ce630, 0x006ce688, 0x005f2a80, 0x005f2fa0),
    ]:
        for address, callback in [(reader, read_fn), (writer, write_fn)]:
            words = struct.unpack('<4I', pe.get_data(address-base, 16))
            if struct.pack('<I', words[0]).decode('ascii') != tag or words[2] != callback:
                raise ValueError('Pinned terrain descriptor changed')
            descriptors.append(dict(tag=tag, address=f'{address:08x}',
                                    callback=f'{callback:08x}'))
    scale, = struct.unpack('<f', pe.get_data(0x006801bc-base, 4))
    if scale != 1/65536:
        raise ValueError('Pinned vertex height write scale changed')
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    ranges = []
    for label, start, end in [
        ('terrain-read', 0x005f2a80, 0x005f2e20),
        ('terrain-write', 0x005f2fa0, 0x005f3140),
        ('map-read', 0x005f3570, 0x005f3670),
        ('map-write', 0x005f3690, 0x005f3770),
    ]:
        instructions = [dict(address=f'{i.address:08x}', bytes=i.bytes.hex(),
                             mnemonic=i.mnemonic, operands=i.op_str)
                        for i in decoder.disasm(pe.get_data(start-base, end-start), start)]
        ranges.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}',
                           instructions=instructions))
    return dict(executableSha256=PIN, descriptors=descriptors,
                vertexWriteHeightScale=scale, ranges=ranges,
                layout=dict(mapPrimaryVersion=2, mapPrimaryBytes=40,
                            vertexPrimaryVersion=2, vertexRecordBytes=9,
                            cellPrimaryVersion=5, cellRecordBytes=5),
                limitations='Pinned instruction evidence and read-only layout. '
                            'Material/flag semantics, navigation reconstruction and '
                            'live terrain replacement are not qualified.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path,
                        default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output', type=Path,
                        default=ROOT/'output/native-terrain-instruction-audit.json')
    args = parser.parse_args()
    result = audit(args.exe)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2)+'\n')
    print(f'Pinned map/terrain descriptors verified; compact vertex=9/cell=5 -> {args.output}')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Read-only pinned terrain publication, derived fields and allocation evidence."""
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
        raise ValueError('Terrain lifecycle audit requires the pinned executable')
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    descriptors = []
    for address, tag, finish, reader in [
        (0x006ce610, b'MAP ', 0x005f3670, 0x005f3570),
        (0x006ce630, b'MTER', 0x005f2e20, 0x005f2a80),
    ]:
        words = struct.unpack('<4I', pe.get_data(address-base, 16))
        if words != (struct.unpack('<I', tag)[0], finish, reader, 0):
            raise ValueError('Pinned terrain descriptor changed')
        descriptors.append(dict(tag=tag.decode(), address=f'{address:08x}',
                                finish=f'{finish:08x}', reader=f'{reader:08x}'))
    slots = []
    for table, offset, target in [(0x0068b2ec, 0, 0x005ec370),
                                  (0x00682950, 0x10, 0x005bbc00),
                                  (0x0068b660, 0x10, 0x005aebe0)]:
        word, = struct.unpack('<I', pe.get_data(table+offset-base, 4))
        if word != target:
            raise ValueError('Pinned terrain vtable changed')
        slots.append(dict(table=f'{table:08x}', offset=offset, target=f'{target:08x}'))
    records, by_address = [], {}
    for label, start, end in [
        ('map-factory', 0x005ec370, 0x005ec390),
        ('map-publisher', 0x005f3670, 0x005f3690),
        ('terrain-publisher', 0x005f2e20, 0x005f2fa0),
        ('vertex-allocation', 0x005fda30, 0x005fda70),
        ('terrain-finalize', 0x005aebe0, 0x005af010),
        ('triangle-normals', 0x005af010, 0x005af1cc),
        ('cross-product-normalize', 0x005685b0, 0x00568653),
        ('terrain-destructor', 0x005fdcc0, 0x005fdd40),
    ]:
        instructions = []
        for instruction in decoder.disasm(pe.get_data(start-base, end-start), start):
            record = dict(address=f'{instruction.address:08x}', bytes=instruction.bytes.hex(),
                          mnemonic=instruction.mnemonic, operands=instruction.op_str)
            by_address[instruction.address] = record
            instructions.append(record)
        records.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}',
                            instructions=instructions))
    anchors = [
        (0x005ec384, 'call', '0x491c70'),
        (0x005f2f29, 'mov', 'eax, dword ptr [ebx + 0x80]'),
        (0x005f2f49, 'mov', 'dword ptr [ecx + 0x48], edx'),
        (0x005f2f6d, 'mov', 'dword ptr [ecx + 0x4c], edx'),
        (0x005f2f76, 'lea', 'edx, [ebx + 0x5c]'),
        (0x005f2f7c, 'call', 'dword ptr [eax + 0x10]'),
        (0x005f2f85, 'call', '0x5aeb60'),
        (0x005aecab, 'lea', 'edi, [eax + eax*2]'),
        (0x005aecae, 'shl', 'edi, 3'),
        (0x005aecb1, 'lea', 'eax, [edi + edi]'),
        (0x005aecb5, 'call', '0x64d59f'),
        (0x005aed0a, 'call', '0x5af010'),
        (0x005aed75, 'call', '0x5af010'),
        (0x005aef23, 'lea', 'eax, [eax + edx*8 + 8]'),
        (0x005aef39, 'fstp', 'dword ptr [eax]'),
        (0x005aef3d, 'fstp', 'dword ptr [eax + 4]'),
        (0x005aef40, 'fst', 'dword ptr [eax + 8]'),
        (0x005aefa6, 'mov', 'byte ptr [eax + edx*8 + 0x14], 0xff'),
        (0x005aefca, 'mov', 'byte ptr [edx + ecx*8 + 0x14], al'),
        (0x005aeff7, 'call', '0x64d4b6'),
        (0x005fdcf0, 'mov', 'eax, dword ptr [esi + 0x48]'),
        (0x005fdcf9, 'mov', 'ecx, dword ptr [esi + 0x4c]'),
    ]
    for address, mnemonic, operands in anchors:
        record = by_address.get(address)
        if not record or (record['mnemonic'], record['operands']) != (mnemonic, operands):
            raise ValueError(f'Pinned terrain lifecycle anchor changed at {address:08x}')
    if pe.get_data(0x005aeb60-base, 1) != b'\xc3':
        raise ValueError('Pinned post-finalization method is no longer a no-op')
    return dict(executableSha256=PIN, descriptors=descriptors, vtableSlots=slots,
                verifiedInstructionAnchors=len(anchors), ranges=records,
                terrainObject=dict(worldPointerOffset=0x80, cellsPointerOffset=0x48,
                                   verticesPointerOffset=0x4c, vertexStride=24, cellStride=8),
                vertexFields=[dict(nativeOffset=0, savedOffset=0, bytes=4, meaning='signed Q16 height saved as float32'),
                              dict(nativeOffset=4, savedOffset=5, bytes=4, meaning='opaque saved word; do not copy as a derived cache'),
                              dict(nativeOffset=8, savedOffset=None, bytes=12, meaning='recomputed normalized vertex vector'),
                              dict(nativeOffset=20, savedOffset=4, bytes=1, meaning='recomputed shading byte from normalized vector and configured light')],
                finalize=dict(target='005aebe0', workspaceBytesPerAffectedCellColumn=48,
                              workspaceAt128Columns=6144, workspaceAt1024Columns=49152,
                              interpretation='Two rolling rows of two triangle normals per cell; not a whole-map normal array.',
                              subsequentNoOp='005aeb60', navigationRebuildQualified=False),
                limitations='Pinned static instruction evidence only. No new native hook, in-engine mutation/reload, navigation rebuild, continuous terrain, actor crossing or browser memory qualification.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path, default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output', type=Path, default=ROOT/'output/native-terrain-lifecycle-instruction-audit.json')
    args = parser.parse_args()
    result = audit(args.exe)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(dict(passed=True, verifiedInstructionAnchors=result['verifiedInstructionAnchors'],
                          vertexShadingRecomputed=True, workspaceAt128Columns=6144,
                          navigationRebuildQualified=False, browserUsed=False)))


if __name__ == '__main__':
    main()

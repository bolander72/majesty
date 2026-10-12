#!/usr/bin/env python3
"""Verify the pinned common UNIT construction path without loading game tools.

This is a static baseline for content extensions, not a custom-hero installer.
It uses resident original bytes; it never hydrates placeholder Ghidra listings.
"""
import hashlib
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


def audit():
    path = ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != PIN:
        raise ValueError('Content extension audit requires the pinned executable')
    pe = struct.unpack_from('<I', data, 0x3c)[0]
    if data[:2] != b'MZ' or data[pe:pe + 4] != b'PE\0\0':
        raise ValueError('Invalid original PE')
    machine, count = struct.unpack_from('<HH', data, pe + 4)
    optional_bytes = struct.unpack_from('<H', data, pe + 20)[0]
    optional = pe + 24
    if machine != 0x14c or struct.unpack_from('<H', data, optional)[0] != 0x10b:
        raise ValueError('Expected pinned 32-bit PE')
    base = struct.unpack_from('<I', data, optional + 28)[0]
    if base != 0x400000:
        raise ValueError('Unexpected guest image base')
    sections = []
    for i in range(count):
        header = optional + optional_bytes + i * 40
        _, rva, size, offset = struct.unpack_from('<IIII', data, header + 8)
        sections.append((rva, size, offset))

    def read(address, length):
        rva = address - base
        for start, size, offset in sections:
            if start <= rva and rva + length <= start + size:
                return data[offset + rva - start:offset + rva - start + length]
        raise ValueError('Address is not backed by original file bytes')

    def anchor(address, expected):
        if read(address, len(expected)) != expected:
            raise ValueError(f'Changed original anchor {address:08x}')

    def call(address, target):
        anchor(address, b'\xe8' + struct.pack('<i', target - address - 5))

    # The original stores the class kind and description ID on its new UNIT.
    anchor(0x42c3e4, b'\xff\x24\xb5' + struct.pack('<I', 0x42c438))
    anchor(0x42c41c, b'\x89\x70\x5c')
    anchor(0x42c41f, b'\x89\x48\x6c')
    anchor(0x42c423, b'\xc2\x08\x00')
    anchor(0x42c432, b'\xc2\x08\x00')
    call(0x42c3f4, 0x433af0)
    # The existing Vehicle baseline allocates its full original class.
    anchor(0x433b07, b'\x68' + struct.pack('<I', 0x164))
    call(0x433b0c, 0x64c616)
    anchor(0x433b2a, b'\x6a\x01')
    call(0x433b2f, 0x42ff80)
    anchor(0x433b4d, b'\xc7\x06' + struct.pack('<I', 0x68098c))
    anchor(0x433b64, b'\xc3')
    anchor(0x433b76, b'\xc3')
    jump = struct.unpack('<8I', read(0x42c438, 32))
    if jump != (0x42c3eb, 0x42c3f3, 0x42c3fb, 0x42c426,
                0x42c403, 0x42c426, 0x42c426, 0x42c3eb):
        raise ValueError('Changed original factory class dispatch')
    ranges = [('common-unit-factory', 0x42c3d0, 0x42c435),
              ('vehicle-constructor', 0x433af0, 0x433b77),
              ('description-resolver', 0x426600, 0x426668)]
    return dict(executableSha256=PIN, staticBaselineVerified=True,
                nativeBytesChanged=False, nativeBuildRequired=False,
                classKind=1, originalObjectBytes=0x164,
                originalObjectTable='0068098c', descriptionIdField='006c',
                classKindField='005c',
                factoryBranches=[dict(kind=i, address=f'{v:08x}') for i, v in enumerate(jump)],
                ranges=[dict(name=n, start=f'{a:08x}', end=f'{b:08x}',
                             sha256=hashlib.sha256(read(a, b-a)).hexdigest())
                        for n, a, b in ranges],
                newHeroOrBuildingQualified=False,
                missing=['description registration and resource loading',
                         'gameplay agent factory and autonomous behavior',
                         'native building placement and paid recruitment routing',
                         'custom-type original save/reload and paired state'])


if __name__ == '__main__':
    result = audit()
    result['auditSourceSha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    (ROOT / 'output/content082-extension-path-audit.json').write_text(
        json.dumps(result, indent=2) + '\n')
    print(json.dumps(dict(staticBaselineVerified=True, originalObjectBytes=0x164,
                          newHeroOrBuildingQualified=False, nativeBytesChanged=False)))

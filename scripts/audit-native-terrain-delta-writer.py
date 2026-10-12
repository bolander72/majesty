#!/usr/bin/env python3
"""Pin the complete original terrain +20 virtual height-delta writer."""
import argparse
import hashlib
import json
from pathlib import Path
import struct

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


def audit():
    raw = (ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    if hashlib.sha256(raw).hexdigest() != PIN:
        raise ValueError('Require the pinned original executable')
    pe = pefile.PE(data=raw)
    base = pe.OPTIONAL_HEADER.ImageBase
    start, end = 0x005f1a40, 0x005f1ae0
    instructions = list(capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32).disasm(
        pe.get_data(start - base, end - start), start))
    if len(instructions) != 52 or instructions[-1].address + instructions[-1].size != end:
        raise ValueError('Incomplete original delta writer')
    rows = [dict(address=f'{i.address:08x}', bytes=i.bytes.hex(), mnemonic=i.mnemonic,
                 operands=i.op_str) for i in instructions]
    indexed = {r['address']: r for r in rows}
    anchors = [('005f1a40', 'mov', 'edx, dword ptr [esp + 4]'),
               ('005f1a44', 'mov', 'eax, dword ptr [ecx + 0x38]'),
               ('005f1a47', 'mov', 'ecx, dword ptr [ecx + 0x4c]'),
               ('005f1a51', 'mov', 'edx, dword ptr [esp + 0x10]'),
               ('005f1a5a', 'fild', 'dword ptr [ecx + eax*8]'),
               ('005f1a60', 'fmul', 'dword ptr [0x6801bc]'),
               ('005f1a66', 'fild', 'dword ptr [esp + 0xc]'),
               ('005f1a6a', 'fdiv', 'dword ptr [edx + 8]'),
               ('005f1a6d', 'fsubr', 'st(1)'),
               ('005f1a97', 'mov', 'dword ptr [esi], eax'),
               ('005f1a9a', 'ret', '0xc'),
               ('005f1ada', 'mov', 'dword ptr [esi], eax'),
               ('005f1add', 'ret', '0xc')]
    for address, mnemonic, operands in anchors:
        if (indexed[address]['mnemonic'], indexed[address]['operands']) != (mnemonic, operands):
            raise ValueError(f'Original delta writer differs: {address}')
    if struct.unpack('<I', pe.get_data(0x0068b680 - base, 4))[0] != start:
        raise ValueError('Original terrain virtual target differs')
    if struct.unpack('<f', pe.get_data(0x006801bc - base, 4))[0] != 1 / 65536:
        raise ValueError('Original fixed-point scale differs')
    return dict(version=1, staticQualified=True, executableSha256=PIN,
                entry=f'{start:08x}', end=f'{end:08x}', terrainVtable='0068b660',
                virtualSlot=32, argumentBytes=12, pointArgument=1, deltaArgument=2,
                coefficientArgument=3, coefficientOffset=8, vertexBytes=24,
                instructions=rows, checkedInstructions=[indexed[a] for a, _, _ in anchors],
                directHeightStores=['005f1a97', '005f1ada'],
                browserUsed=False, nativeProcessesStarted=0,
                scope='Complete original method and virtual identity only. Actual native '
                      'boundary/interior calls and historical seam causes require separate evidence.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    report = audit()
    with args.output.open('x') as f:
        json.dump(report, f, indent=2)
        f.write('\n')
    print(json.dumps(dict(staticQualified=True, instructions=len(report['instructions']))))

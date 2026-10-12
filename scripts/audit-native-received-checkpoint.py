#!/usr/bin/env python3
"""Check incoming-save CRC and receiver boundaries against the pinned image."""
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
    raw = (ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    if hashlib.sha256(raw).hexdigest() != PIN:
        raise ValueError('Require the pinned original executable')
    pe = pefile.PE(data=raw, fast_load=True)
    base = pe.OPTIONAL_HEADER.ImageBase
    table = pe.get_data(0x006c65b0-base, 1024)
    expected = []
    for value in range(256):
        for _ in range(8):
            value = (value >> 1) ^ (0xedb88320 if value & 1 else 0)
        expected.append(value)
    if table != struct.pack('<256I', *expected):
        raise ValueError('Original reflected CRC table differs')
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    rows = {}
    for start, end in [(0x00512b90, 0x00512c52), (0x004588d0, 0x00458cd5)]:
        instructions = list(decoder.disasm(pe.get_data(start-base, end-start), start))
        if not instructions or instructions[-1].address + instructions[-1].size != end:
            raise ValueError('Incomplete original function')
        rows.update({i.address: {'address': f'{i.address:08x}', 'mnemonic': i.mnemonic,
                                'operands': i.op_str} for i in instructions})
    anchors = [(0x00512bd2, 'or', 'esi, 0xffffffff'),
               (0x00512c0e, 'mov', 'eax, dword ptr [eax*4 + 0x6c65b0]'),
               (0x00512c48, 'not', 'eax'),
               (0x004589e5, 'call', '0x512b90'),
               (0x004589f3, 'cmp', 'eax, ecx'),
               (0x004589f5, 'je', '0x458a1e'),
               (0x00458a16, 'call', '0x4dec70'),
               (0x00458a1b, 'add', 'esp, 4'),
               (0x00458b26, 'call', 'dword ptr [edx + 0x24]'),
               (0x00458b29, 'cmp', 'ebp, ebx')]
    for address, mnemonic, operands in anchors:
        if (rows[address]['mnemonic'], rows[address]['operands']) != (mnemonic, operands):
            raise ValueError(f'Original incoming-save anchor differs: {address:08x}')
    return dict(version=1, executableSha256=PIN, crcTableEntries=256,
                crcTableSha256=hashlib.sha256(table).hexdigest(), originalCrcFunction='00512b90',
                polynomial='edb88320', initial='ffffffff', finalComplement=True,
                originalChecksumMismatchIsWarning=True, originalWriteResultNotChecked=True,
                anchors=[rows[a] for a, _, _ in anchors], browserUsed=False,
                scope='Static original CRC/receiver boundaries only; staged writer engine integration '
                      'and session-level failure rejection are not qualified.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    report = audit()
    with args.output.open('x') as file:
        json.dump(report, file, indent=2)
        file.write('\n')
    print(json.dumps({'crcTableEntries': report['crcTableEntries'], 'anchors': len(report['anchors'])}))

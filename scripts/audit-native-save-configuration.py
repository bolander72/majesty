#!/usr/bin/env python3
"""Bind saved freestyle configuration restoration to the pinned original ABI."""
import argparse
import hashlib
import json
from pathlib import Path

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


def audit():
    raw = (ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    if hashlib.sha256(raw).hexdigest() != PIN:
        raise ValueError('Configuration ABI requires the pinned original executable')
    pe = pefile.PE(data=raw)
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)

    def decode(start, size):
        body = pe.get_data(start - pe.OPTIONAL_HEADER.ImageBase, size)
        rows = list(md.disasm(body, start))
        if sum(i.size for i in rows) != size:
            raise ValueError('Configuration ABI range is incompletely decoded')
        return body, rows

    ranges = [('readerConfigurationBranch', 0x00435597, 0x004355d2 - 0x00435597),
              ('freestyleClassifier', 0x004d2dd1, 0x004d2df3 - 0x004d2dd1),
              ('owningConfigurationCopy', 0x004ad0f0, 0x004ad189 - 0x004ad0f0)]
    methods = {}
    decoded = {}
    for name, start, size in ranges:
        body, rows = decode(start, size)
        decoded[name] = {(i.mnemonic, i.op_str) for i in rows}
        methods[name] = dict(address=f'{start:08x}', bytes=size,
            sha256=hashlib.sha256(body).hexdigest(), instructions=len(rows),
            listing=[dict(address=f'{i.address:08x}', mnemonic=i.mnemonic,
                          operands=i.op_str) for i in rows])
    required = {
        'readerConfigurationBranch': [('call', '0x4d2d80'), ('test', 'eax, eax'),
            ('jne', '0x4355df'), ('call', '0x4372d0'),
            ('lea', 'ecx, [eax + 0x268]'), ('call', '0x4ad0f0')],
        'freestyleClassifier': [('cmp', 'edi, dword ptr [esi + 0x264]'),
            ('cmp', 'dword ptr [esi + 0x29c], 1'), ('mov', 'eax, 2'),
            ('ret', '4')],
        'owningConfigurationCopy': [('call', '0x4e4180'),
            ('lea', 'ecx, [esi + 0x3c]'), ('lea', 'ecx, [esi + 0x48]'),
            ('mov', 'eax, esi'), ('ret', '4')],
    }
    for name, expected in required.items():
        if not set(expected) <= decoded[name]:
            raise ValueError(f'Pinned original {name} differs')
    _, rows = decode(0x0043571a, 0x0043572f - 0x0043571a)
    if ('add', 'eax, 0x268') not in {(i.mnemonic, i.op_str) for i in rows}:
        raise ValueError('Writer does not consult the live owning configuration')
    return dict(originalSavedConfigurationAbiQualified=True,
        originalExecutableSha256=PIN, metadata='006d7ce0',
        metadataKindOffset=0x1c, metadataConfigurationOffset=0x60,
        gameConfigurationOffset=0x268, originalOwningCopy='004ad0f0',
        previousMultiplayerConfigurationSkipsOriginalReaderCopy=True,
        methods=methods,
        scope='Pinned reader condition, classifier, and owning-copy ABI only; exact restoration requires actual original save comparisons.')


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output', type=Path, required=True)
    args = p.parse_args()
    result = audit()
    with args.output.open('x') as f:
        json.dump(result, f, indent=2)
        f.write('\n')
    print(json.dumps(dict(originalSavedConfigurationAbiQualified=True,
                         methods=len(result['methods']))))

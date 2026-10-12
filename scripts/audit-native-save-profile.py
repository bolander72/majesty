#!/usr/bin/env python3
"""Verify the original solo display-name source and owning string-copy ABI."""
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
        raise ValueError('Saved profile requires the pinned original executable')
    pe = pefile.PE(data=raw)
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    def decode(start, size):
        data = pe.get_data(start - pe.OPTIONAL_HEADER.ImageBase, size)
        rows = list(md.disasm(data, start))
        if sum(i.size for i in rows) != size:
            raise ValueError('Original profile method is not completely decoded')
        return data, rows
    _, names = decode(0x00436f52, 0x27)
    expected = [('mov', 'eax, dword ptr [esp + 0x10]'),
        ('mov', 'dword ptr [eax + 0x34], 1'), ('mov', 'ecx, dword ptr [0x71c634]'),
        ('mov', 'edx, dword ptr [ebx + 8]'), ('add', 'ecx, 4'),
        ('push', 'ecx'), ('push', '1'), ('push', 'edx'), ('mov', 'ecx, ebx'),
        ('call', '0x437410'), ('jmp', '0x43718a')]
    if [(i.mnemonic, i.op_str) for i in names] != expected:
        raise ValueError('Original solo name source differs')
    data, copy = decode(0x004e4180, 232)
    returns = [i for i in copy if i.mnemonic == 'ret']
    if not returns or any(i.op_str != '4' for i in returns):
        raise ValueError('Owning string-copy RET4 differs')
    if not any(i.mnemonic == 'call' and i.op_str == '0x5018cb' for i in copy):
        raise ValueError('Original owning byte copy is missing')
    _, desktop = decode(0x004ba120, 137)
    if not (any(i.mnemonic == 'push' and i.op_str == '0x4c' for i in desktop) and
            any(i.mnemonic == 'call' and i.op_str == '0x594450' for i in desktop) and
            any(i.mnemonic == 'mov' and i.op_str.endswith(', 0x6832b8') for i in desktop)):
        raise ValueError('Original derived desktop profile differs')
    methods = {}
    for name, start, size in [('nameCollector', 0x00436ef0, 691),
                              ('metadataReader', 0x00436770, 1168),
                              ('owningStringCopy', 0x004e4180, 232),
                              ('desktopProfileFactory', 0x004ba120, 137)]:
        body, rows = decode(start, size)
        methods[name] = dict(address=f'{start:08x}', bytes=size,
            sha256=hashlib.sha256(body).hexdigest(), instructions=len(rows))
    return dict(originalSoloProfileSourceQualified=True, originalExecutableSha256=PIN,
        profileGlobal='0071c634', profileStringOffset=4, owningStringCopy='004e4180',
        argumentBytes=4, desktopProfileVtable='006832b8', desktopProfileBytes=76, methods=methods,
        soloSource=[dict(address=f'{i.address:08x}', mnemonic=i.mnemonic, operands=i.op_str) for i in names],
        scope='Pinned original solo profile source and owning-copy ABI; runtime preservation requires original-game save comparisons.')

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output', type=Path, required=True)
    args = p.parse_args()
    result = audit()
    with args.output.open('x') as f:
        json.dump(result, f, indent=2); f.write('\n')
    print(json.dumps(dict(originalSoloProfileSourceQualified=True, methods=len(result['methods']))))

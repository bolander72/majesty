#!/usr/bin/env python3
"""Pin common dispatch and its three actual-game leaf method boundaries."""
import hashlib
import json
from pathlib import Path
import struct

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
RANGES = [('common-dispatch', 0x5e53c0, 0x5e53f6, '4'),
          ('game-move-update', 0x4ab8a0, 0x4ab8b7, '0xc'),
          ('path-update', 0x5e1330, 0x5e188b, '0xc'),
          ('queue-update', 0x5e2ef0, 0x5e2fd6, '0xc')]
ANCHORS = [(0x5e53c0, 'mov', 'eax, dword ptr [esp + 4]'),
           (0x5e53c4, 'mov', 'edx, dword ptr [eax + 0x10]'),
           (0x5e53cb, 'mov', 'edx, dword ptr [0x71c6a8]'),
           (0x5e53d2, 'mov', 'esi, dword ptr [eax + 8]'),
           (0x5e53d5, 'sub', 'edx, esi'),
           (0x5e53d7, 'mov', 'esi, dword ptr [eax + 0xc]'),
           (0x5e53dd, 'ja', '0x5e53f3'),
           (0x5e53df, 'test', 'byte ptr [eax + 0x18], 1'),
           (0x5e53e9, 'push', 'ecx'),
           (0x5e53ea, 'mov', 'ecx, dword ptr [ecx + 4]'),
           (0x5e53f0, 'call', 'dword ptr [edx + 0x18]'),
           (0x4ab8af, 'call', '0x5b7490')]
SLOTS = [(0x683148, 0x50, 0x5e53c0), (0x6830d8, 0x18, 0x4ab8a0),
         (0x68add8, 0x18, 0x5e1330), (0x68ae74, 0x18, 0x5e2ef0)]


def main():
    raw = (ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    if hashlib.sha256(raw).hexdigest() != PIN:
        raise ValueError('The clock audit requires the pinned game executable')
    pe = pefile.PE(data=raw)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    decoder.detail = True
    rows, methods = {}, []
    for name, start, end, ret_bytes in RANGES:
        body = pe.get_data(start - base, end - start)
        code = list(decoder.disasm(body, start))
        if sum(i.size for i in code) != len(body) or code[-1].mnemonic != 'ret':
            raise ValueError('Incomplete method: ' + name)
        addresses = {i.address for i in code}
        for i in code:
            if i.mnemonic.startswith('j'):
                if not i.op_str.startswith('0x') or int(i.op_str, 16) not in addresses:
                    raise ValueError('Unclosed direct control flow: ' + name)
            if i.mnemonic == 'ret' and i.op_str != ret_bytes:
                raise ValueError('Inconsistent return stack size: ' + name)
        rows.update({i.address: i for i in code})
        methods.append(dict(name=name, start=f'{start:08x}', end=f'{end:08x}',
                            instructions=len(code), sha256=hashlib.sha256(body).hexdigest()))
    for pc, mnemonic, operands in ANCHORS:
        if (rows[pc].mnemonic, rows[pc].op_str) != (mnemonic, operands):
            raise ValueError(f'Changed instruction {pc:08x}')
    for table, offset, wanted in SLOTS:
        if struct.unpack('<I', pe.get_data(table + offset - base, 4))[0] != wanted:
            raise ValueError('Changed original dispatch slot')
    report = dict(qualified=True, staticAuditOnly=True, executableSha256=PIN,
                  methods=methods, anchors=len(ANCHORS), virtualSlots=len(SLOTS),
                  actualGameMoveLeaf='004ab8a0', libraryMoveUpdate='005b7490',
                  commonClock='0071c6a8', leafGameplayQualified=False, browserUsed=False,
                  sourceSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
    (ROOT / 'output/native-order-clock-probe-audit.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(dict(qualified=True, methods=len(methods), anchors=len(ANCHORS),
                          virtualSlots=len(SLOTS), staticAuditOnly=True)))


if __name__ == '__main__':
    main()

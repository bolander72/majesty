#!/usr/bin/env python3
"""Pin the actual game's factory override and its kind-2 allocation lineage."""
import hashlib
import json
from pathlib import Path
import struct

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


def main():
    path = ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != PIN:
        raise ValueError('Game order factory audit requires the pinned executable')
    pe = pefile.PE(data=raw)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    methods = []
    instructions = {}
    for name, start, end in [
        ('game-factory-getter', 0x4a8e90, 0x4a8f05),
        ('game-factory-reset', 0x4a8f60, 0x4a8fee),
        ('game-factory-create', 0x4a8ff0, 0x4a930e),
        ('game-kind2-constructor', 0x4ab850, 0x4ab862),
    ]:
        code = pe.get_data(start - base, end - start)
        rows = list(decoder.disasm(code, start))
        if sum(i.size for i in rows) != len(code) or rows[-1].mnemonic != 'ret':
            raise ValueError('Incomplete method: ' + name)
        instructions.update({i.address: i for i in rows})
        methods.append(dict(name=name, start=f'{start:08x}', end=f'{end:08x}',
                            sha256=hashlib.sha256(code).hexdigest()))
    anchors = [
        (0x4a8ea6, 'mov', 'eax, dword ptr [0x71c950]'),
        (0x4a8ed3, 'push', '0x6c1fd8'),
        (0x4a8edf, 'mov', 'dword ptr [esi], 0x682ed0'),
        (0x4a8ee5, 'call', '0x5da0a0'),
        (0x4a8ef1, 'mov', 'dword ptr [0x71c950], eax'),
        (0x4a8fb6, 'mov', 'dword ptr [esi], 0x682ed0'),
        (0x4a8fc1, 'mov', 'dword ptr [0x71c950], esi'),
        (0x4a902d, 'sub', 'edx, 2'), (0x4a9030, 'je', '0x4a90ad'),
        (0x4a90ad, 'push', '0x5c'), (0x4a90af, 'call', '0x64c616'),
        (0x4a90b4, 'add', 'esp, 4'), (0x4a90cd, 'call', '0x4ab850'),
        (0x4a92f8, 'call', '0x5da510'),
        (0x4ab853, 'call', '0x5b6c70'),
        (0x4ab858, 'mov', 'dword ptr [esi], 0x6830d8'),
    ]
    for pc, mnemonic, operands in anchors:
        row = instructions[pc]
        if (row.mnemonic, row.op_str) != (mnemonic, operands):
            raise ValueError(f'Changed game factory instruction {pc:08x}')
    slots = [(0x682ed0, 12, 0x4a8ff0), (0x68ac14, 12, 0x5da510)]
    for table, offset, wanted in slots:
        if struct.unpack('<I', pe.get_data(table + offset - base, 4))[0] != wanted:
            raise ValueError('Changed factory virtual slot')
    report = dict(qualified=True, staticAuditOnly=True, executableSha256=PIN,
                  methods=methods, instructionSites=len(anchors), virtualSlots=len(slots),
                  gameTable='00682ed0', libraryTable='0068ac14',
                  sharedSingleton='0071c950', gameKind2AllocationReturn='004a90b4',
                  gameKind2RequestedBytes=92, gameKind2Constructor='004ab850',
                  gameKind2Table='006830d8', gameKind2BaseConstructor='005b6c70',
                  libraryFallback='005da510', browserUsed=False,
                  otherGameKindsQualified=False,
                  sourceSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
    (ROOT / 'output/native-game-order-factory-audit.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(dict(qualified=True, methods=len(methods), instructionSites=len(anchors),
                          gameKind2RequestedBytes=92, staticAuditOnly=True)))


if __name__ == '__main__':
    main()

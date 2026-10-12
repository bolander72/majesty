#!/usr/bin/env python3
"""Pin the original private UNIT bank getter, writer and clearing boundary."""
import hashlib
import json
from pathlib import Path

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


def sha(path):
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def main():
    path = ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    assert sha(path) == PIN
    pe = pefile.PE(str(path))
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    ranges = [('bank-owner-construction', 0x5e4c60, 0x5e4c96),
              ('bank-construction', 0x4abcc0, 0x4abcd9),
              ('unit-get-bank', 0x4300e0, 0x43014f),
              ('unit-get-nonempty-bank', 0x5b2b80, 0x5b2ba7),
              ('unit-bank-presence', 0x5b2f40, 0x5b2f55),
              ('unit-write-banks', 0x5b1be0, 0x5b1c3c),
              ('unit-clear-bank', 0x5b2de0, 0x5b2e09)]
    methods, decoded = [], {}
    for name, start, end in ranges:
        raw = pe.get_data(start - base, end - start)
        rows = list(decoder.disasm(raw, start))
        assert sum(row.size for row in rows) == len(raw)
        assert rows[-1].mnemonic == 'ret'
        decoded.update({row.address: row for row in rows})
        methods.append(dict(name=name, start=f'{start:08x}', end=f'{end:08x}',
                            instructions=len(rows), sha256=hashlib.sha256(raw).hexdigest()))
    checks = [(0x5e4c8d, 'mov', 'dword ptr [esi + 4], ecx'),
              (0x4300fd, 'mov', 'eax, dword ptr [esi + edi*4 + 0x88]'),
              (0x430106, 'jne', '0x430135'),
              (0x430125, 'call', '0x4abcc0'),
              (0x43012e, 'mov', 'dword ptr [esi + edi*4 + 0x88], eax'),
              (0x5b1bf8, 'call', 'dword ptr [eax + 0x190]'),
              (0x5b1c07, 'call', 'dword ptr [edx + 8]'),
              (0x5b1c20, 'call', '0x4eed10'),
              (0x5b1c29, 'cmp', 'esi, 3'),
              (0x5b2df7, 'call', 'dword ptr [eax]'),
              (0x5b2df9, 'mov', 'dword ptr [esi + edi*4 + 0x88], 0')]
    for pc, mnemonic, operand in checks:
        assert (decoded[pc].mnemonic, decoded[pc].op_str) == (mnemonic, operand)
    slots = {0x160: 0x4300e0, 0x164: 0x5b2de0, 0x16c: 0x5b2b80,
             0x190: 0x5b2f40, 0x1b0: 0x5b1be0}
    for offset, target in slots.items():
        assert int.from_bytes(pe.get_data(0x68098c + offset - base, 4), 'little') == target
    report = dict(qualified=True, executableSha256=PIN, methods=methods,
                  instructionSites=len(checks), unitTable='0068098c',
                  bankPointerOffsets=[0x88, 0x8c, 0x90],
                  initialSlots={f'{offset:03x}': f'{target:08x}' for offset, target in slots.items()},
                  staticAuditOnly=True, completeUnitConstructionQualified=False,
                  worldActorPublicationQualified=False, browserUsed=False,
                  sourceSha256={str(Path(__file__).relative_to(ROOT)): sha(Path(__file__))})
    (ROOT / 'output/native-order-unit-attachment-sites-audit.json').write_text(
        json.dumps(report, indent=2) + '\n')
    print(json.dumps(dict(qualified=True, methods=len(methods), instructionSites=len(checks))))


if __name__ == '__main__':
    main()

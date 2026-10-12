#!/usr/bin/env python3
"""Pin the original order-drain and bank-deletion distinction; no game launch."""
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
    exe = ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    assert sha(exe) == PIN
    pe = pefile.PE(str(exe))
    base = pe.OPTIONAL_HEADER.ImageBase
    cs = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    ranges = [('unit-bank-delete', 0x5b2de0, 0x5b2e09),
              ('bank-node-destructor', 0x5e4cc0, 0x5e4d13),
              ('bank-order-drain', 0x5e4ff0, 0x5e5012),
              ('bank-base-remove', 0x5e4f90, 0x5e4fe7),
              ('bank-derived-remove', 0x5e5350, 0x5e5390)]
    methods, decoded, bodies = [], {}, {}
    for name, start, end in ranges:
        raw = pe.get_data(start - base, end - start)
        rows = list(cs.disasm(raw, start))
        assert sum(row.size for row in rows) == len(raw)
        assert rows[-1].mnemonic == 'ret'
        bodies[name] = rows
        decoded.update({row.address: row for row in rows})
        methods.append(dict(name=name, start=f'{start:08x}', end=f'{end:08x}',
                            sha256=hashlib.sha256(raw).hexdigest(), instructions=len(rows)))
    anchors = [(0x5b2df7, 'call', 'dword ptr [eax]'),
               (0x5e4ce8, 'call', '0x645bc0'),
               (0x5e4cff, 'call', '0x645bc0'),
               (0x5e4ffc, 'mov', 'eax, dword ptr [eax + 8]'),
               (0x5e5004, 'call', 'dword ptr [edx + 0x48]'),
               (0x5e4fde, 'call', 'dword ptr [eax]'),
               (0x5e5367, 'call', 'dword ptr [eax + 0x44]'),
               (0x5e5388, 'call', 'dword ptr [edx + 0x58]')]
    for pc, mnemonic, operand in anchors:
        assert (decoded[pc].mnemonic, decoded[pc].op_str) == (mnemonic, operand)
    destructor_calls = [row.op_str for row in bodies['bank-node-destructor']
                        if row.mnemonic == 'call']
    assert destructor_calls == ['0x645bc0', '0x645bc0']
    table_slots = [(0x68098c, 0x164, 0x5b2de0),
                   (0x683148, 0x48, 0x5e5350),
                   (0x683148, 0x58, 0x5e4f90)]
    for table, offset, expected in table_slots:
        assert int.from_bytes(pe.get_data(table + offset - base, 4), 'little') == expected
    report = dict(qualified=True, scope='static drain-before-bank-deletion lineage',
                  executableSha256=PIN, methods=methods, instructionSites=len(anchors),
                  tableSlots=[dict(table=f'{t:08x}', offset=f'{o:x}', target=f'{v:08x}')
                              for t, o, v in table_slots],
                  bankNodeDestructorFreeCalls=destructor_calls,
                  bankDeletionAloneDoesNotDestroyOrders=True,
                  derivedRemovalInvokesCallbackDispatcher=True,
                  activeCallbackSemanticsQualified=False,
                  staticAuditOnly=True, nativeCleanupExecuted=False,
                  browserUsed=False, goalCompleted=False,
                  sourceSha256={str(Path(__file__).relative_to(ROOT)): sha(Path(__file__))})
    (ROOT / 'output/native-order-unit-handoff-cleanup-audit.json').write_text(
        json.dumps(report, indent=2) + '\n')
    print(json.dumps(dict(qualified=True, methods=len(methods), instructionSites=len(anchors),
                         bankDeletionAloneDoesNotDestroyOrders=True)))


if __name__ == '__main__':
    main()

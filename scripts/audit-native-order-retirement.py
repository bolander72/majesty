#!/usr/bin/env python3
"""Pin original bank removal/deletion and order deleting-vtable entries."""
import hashlib
import json
from pathlib import Path
import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def main():
    path = ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    assert sha(path) == PIN
    pe = pefile.PE(str(path))
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    checks = [(0x5e4fc0, 5, 'call', '0x645bc0'),
              (0x5e4fde, 2, 'call', 'dword ptr [eax]'),
              (0x4abce3, 5, 'call', '0x4abd00'),
              (0x4abcf0, 5, 'call', '0x645bc0'),
              (0x645bc4, 5, 'call', '0x64d4b6')]
    sites = []
    for pc, size, mnemonic, operand in checks:
        instructions = list(decoder.disasm(pe.get_data(pc - base, size), pc))
        assert len(instructions) == 1
        insn = instructions[0]
        assert (insn.size, insn.mnemonic, insn.op_str) == (size, mnemonic, operand)
        sites.append(dict(pc=f'{pc:08x}', mnemonic=mnemonic, operand=operand))
    tables = [(1, 0x68ad74, 0x5df280), (2, 0x68a224, 0x5b6ce0),
              (4, 0x68add8, 0x5e0d00), (5, 0x689d74, 0x5ab6e0),
              (6, 0x68ae44, 0x5e2290), (7, 0x68ae74, 0x5e2b80),
              (10, 0x689e80, 0x5b2460), (11, 0x68af24, 0x5e4030)]
    for kind, table, target in tables:
        assert int.from_bytes(pe.get_data(table - base, 4), 'little') == target
    assert int.from_bytes(pe.get_data(0x683148 - base, 4), 'little') == 0x4abce0
    report = dict(qualified=True, executableSha256=PIN, sites=sites,
                  deletingVtables=[dict(kind=k, table=f'{v:08x}', target=f'{t:08x}')
                                   for k, v, t in tables],
                  bankDeleteTarget='004abce0', staticAuditOnly=True, browserUsed=False,
                  sourceSha256={str(Path(__file__).relative_to(ROOT)): sha(Path(__file__))})
    (ROOT / 'output/native-order-retirement-sites-audit.json').write_text(
        json.dumps(report, indent=2) + '\n')
    print(json.dumps(dict(qualified=True, instructionSites=len(sites), deletingVtables=8)))


if __name__ == '__main__':
    main()

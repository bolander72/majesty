#!/usr/bin/env python3
"""Pin original order-factory singleton setup, registry and teardown paths."""
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
    checks = [(0x5da28e, 5, 'mov', 'eax, dword ptr [0x71c950]'),
              (0x5da2a2, 6, 'jne', '0x5da4a3'),
              (0x5da2a9, 2, 'push', '0x14'),
              (0x5da2ab, 5, 'call', '0x64c616'),
              (0x5da2d9, 5, 'mov', 'ebp, 0x6ce960'),
              (0x5da2e5, 6, 'mov', 'dword ptr [ebx], 0x68ac14'),
              (0x5da373, 5, 'call', '0x64c616'),
              (0x5da49d, 5, 'mov', 'dword ptr [0x71c950], eax'),
              (0x5da4f0, 6, 'mov', 'ecx, dword ptr [0x71c950]'),
              (0x5da4fe, 2, 'call', 'dword ptr [eax]'),
              (0x5da500, 10, 'mov', 'dword ptr [0x71c950], 0')]
    sites = []
    for pc, size, mnemonic, operand in checks:
        rows = list(decoder.disasm(pe.get_data(pc - base, size), pc))
        assert len(rows) == 1
        insn = rows[0]
        assert (insn.size, insn.mnemonic, insn.op_str) == (size, mnemonic, operand)
        sites.append(dict(pc=f'{pc:08x}', mnemonic=mnemonic, operand=operand))
    assert int.from_bytes(pe.get_data(0x68ac14 - base, 4), 'little') == 0x5d9fd0
    assert int.from_bytes(pe.get_data(0x71c950 - base, 4), 'little') == 0
    registry = []
    for index in range(17):
        raw = pe.get_data(0x6ce960 + 8 * index - base, 8)
        key, target = int.from_bytes(raw[:4], 'little'), int.from_bytes(raw[4:], 'little')
        if index == 16:
            assert key == 0
            break
        assert key and 0x400000 <= target < 0x670000
        registry.append(dict(key=key, target=f'{target:08x}'))
    assert len({row['key'] for row in registry}) == 16
    report = dict(qualified=True, executableSha256=PIN, sites=sites, registry=registry,
                  staticAuditOnly=True, browserUsed=False,
                  sourceSha256={str(Path(__file__).relative_to(ROOT)): sha(Path(__file__))})
    (ROOT / 'output/native-order-manager-sites-audit.json').write_text(
        json.dumps(report, indent=2) + '\n')
    print(json.dumps(dict(qualified=True, instructionSites=len(sites), registryEntries=16)))


if __name__ == '__main__':
    main()

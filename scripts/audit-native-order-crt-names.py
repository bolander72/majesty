#!/usr/bin/env python3
"""Pin original CRT/name paths used by the bounded native lifecycle probe."""
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
    checks = [(0x654681, 6, 'call', 'dword ptr [0x67f22c]'),
              (0x654690, 5, 'call', '0x654528'),
              (0x654698, 5, 'mov', 'dword ptr [0x723a8c], eax'),
              (0x6546a4, 5, 'call', '0x654847'),
              (0x64d605, 3, 'cmp', 'eax, 3'),
              (0x64d626, 5, 'call', '0x654be3'),
              (0x64d6c4, 6, 'call', 'dword ptr [0x67f1d8]'),
              (0x64d4e9, 3, 'cmp', 'eax, 3'),
              (0x64d4fb, 5, 'call', '0x65488f'),
              (0x64d50a, 5, 'call', '0x6548ba'),
              (0x64d58a, 6, 'call', 'dword ptr [0x67f1d4]'),
              (0x523430, 5, 'call', '0x64d4b6'),
              (0x523480, 5, 'call', '0x64d59f')]
    sites = []
    for pc, size, mnemonic, operand in checks:
        instructions = list(decoder.disasm(pe.get_data(pc - base, size), pc))
        assert len(instructions) == 1
        insn = instructions[0]
        assert (insn.size, insn.mnemonic, insn.op_str) == (size, mnemonic, operand)
        sites.append(dict(pc=f'{pc:08x}', mnemonic=mnemonic, operand=operand))
    imports = {item.address: item.name.decode() for entry in pe.DIRECTORY_ENTRY_IMPORT
               for item in entry.imports if item.name}
    assert imports[0x67f22c] == 'HeapCreate'
    assert imports[0x67f1d8] == 'HeapAlloc'
    assert imports[0x67f1d4] == 'HeapFree'
    assert int.from_bytes(pe.get_data(0x723a8c - base, 4), 'little') == 0
    report = dict(qualified=True, scope='static original CRT/name instruction paths',
                  executableSha256=PIN, sites=sites, browserUsed=False,
                  nativeCallsExecuted=False,
                  sourceSha256={str(Path(__file__).relative_to(ROOT)): sha(Path(__file__))})
    (ROOT / 'output/native-order-crt-name-sites-audit.json').write_text(
        json.dumps(report, indent=2) + '\n')
    print(json.dumps(dict(qualified=True, instructionSites=len(sites), browserUsed=False)))


if __name__ == '__main__':
    main()

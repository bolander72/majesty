#!/usr/bin/env python3
"""Pin empty-name allocation and typed field sites without a game launch."""
import hashlib
import json
from pathlib import Path
import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


def sha(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def main():
    path = ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    assert sha(path) == PIN
    pe = pefile.PE(str(path))
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    checks = [
        (0x523480, 5, 'call', '0x64d59f'),
        (0x5ab7b4, 3, 'lea', 'ecx, [edi + 0x48]'),
        (0x5b6dd5, 3, 'lea', 'ecx, [edi + 0x4c]'),
        (0x5e236f, 3, 'lea', 'ecx, [edi + 0x4c]'),
        (0x5e4077, 5, 'call', '0x5ab760'),
        (0x5deea7, 3, 'lea', 'ecx, [edi + 4]'),
        (0x5deae6, 3, 'lea', 'ecx, [esi + 0x20]'),
    ]
    verified = []
    for pc, n, mnemonic, operand in checks:
        instructions = list(decoder.disasm(pe.get_data(pc - base, n), pc))
        assert len(instructions) == 1
        instruction = instructions[0]
        assert (instruction.size, instruction.mnemonic, instruction.op_str) == (n, mnemonic, operand)
        verified.append(dict(pc=f'{pc:08x}', mnemonic=mnemonic, operand=operand))
    assert int.from_bytes(pe.get_data(0x68acf8 + 4 - base, 4), 'little') == 0x5dea70
    sources = ['scripts/audit-native-order-empty-names.py',
               'upstream/majesty-recomp/native_order_storage.h',
               'upstream/majesty-recomp/native_order_storage.cpp',
               'upstream/majesty-recomp/native_order_allocation.h',
               'upstream/majesty-recomp/native_order_allocation.cpp',
               'upstream/majesty-recomp/tests/native_order_bank_read_hook_tests.cpp']
    report = dict(qualified=True, executableSha256=PIN, sites=verified,
                  mallocReturnPc='00523485', baseNameFieldOffset=36,
                  leafNameFieldOffsets={'2': 76, '5': 72, '6': 76, '11': 72},
                  staticAuditOnly=True, browserLaunches=0,
                  sourceSha256={name: sha(ROOT / name) for name in sources})
    (ROOT / 'output/native-order-empty-name-sites-audit.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(dict(qualified=True, instructionSites=len(verified), browserLaunches=0)))


if __name__ == '__main__':
    main()

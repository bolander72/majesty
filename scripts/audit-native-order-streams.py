#!/usr/bin/env python3
"""Pin the original fixed-span stream construction, transfer and lifetime paths."""
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
    ranges = [
        ('fixed-buffer-constructor', 0x64a97f, 0x64aa1e),
        ('fixed-buffer-destructor', 0x64aa1e, 0x64aa70),
        ('fixed-buffer-overflow', 0x64aba6, 0x64ac1d),
        ('fixed-buffer-underflow', 0x64ac1d, 0x64ac5a),
        ('buffer-write', 0x64bf14, 0x64bf6a),
        ('buffer-read', 0x64bf6a, 0x64c001),
        ('input-constructor', 0x64b68a, 0x64b700),
        ('output-constructor', 0x6497f3, 0x649858),
        ('input-destructor', 0x64b65f, 0x64b68a),
        ('output-destructor', 0x6497c8, 0x6497f3),
        ('input-status', 0x4ef6c0, 0x4ef6e2),
        ('output-status', 0x4eeb50, 0x4eeb72),
    ]
    methods = []
    decoded = {}
    for name, start, end in ranges:
        raw = pe.get_data(start - base, end - start)
        instructions = list(decoder.disasm(raw, start))
        assert sum(row.size for row in instructions) == len(raw), name
        if name == 'buffer-read':
            assert (instructions[-1].mnemonic, instructions[-1].op_str) == ('jmp', '0x64bfc5')
            assert any(row.mnemonic == 'ret' and row.op_str == '8' for row in instructions)
        else:
            assert instructions[-1].mnemonic == 'ret', name
        decoded.update({row.address: row for row in instructions})
        methods.append(dict(name=name, start=f'{start:08x}', end=f'{end:08x}',
                            instructions=len(instructions), sha256=hashlib.sha256(raw).hexdigest()))
    checks = [
        (0x64a99e, 'and', 'dword ptr [esi + 0x4c], 0'),
        (0x64a9ad, 'mov', 'dword ptr [esi + 0x58], 1'),
        (0x64a9d5, 'call', '0x64c063'),
        (0x64a9e4, 'mov', 'dword ptr [esi + 0x28], edi'),
        (0x64a9f3, 'mov', 'dword ptr [esi + 0x1c], eax'),
        (0x64abb1, 'cmp', 'dword ptr [esi + 0x4c], 0'),
        (0x64abb5, 'je', '0x64abc1'),
        (0x64abc1, 'or', 'eax, 0xffffffff'),
        (0x64ac4b, 'cmp', 'esi, dword ptr [ecx + 0x2c]'),
        (0x64ac50, 'or', 'eax, 0xffffffff'),
        (0x64aa39, 'cmp', 'dword ptr [esi + 0x4c], 0'),
        (0x64aa3d, 'je', '0x64aa58'),
        (0x64b6b0, 'call', '0x649ec8'),
        (0x649818, 'call', '0x649ec8'),
        (0x4ef6c0, 'mov', 'eax, dword ptr [ecx]'),
        (0x4ef6c2, 'mov', 'edx, dword ptr [eax]'),
        (0x4ef6c4, 'mov', 'edx, dword ptr [edx + 4]'),
        (0x4ef6c7, 'mov', 'eax, dword ptr [edx + eax + 8]'),
        (0x4ef6cf, 'mov', 'eax, dword ptr [ecx + 4]'),
        (0x4ef6d3, 'and', 'al, 1'),
        (0x4ef6d5, 'neg', 'al'),
        (0x4ef6d7, 'sbb', 'eax, eax'),
        (0x4ef6d9, 'and', 'eax, 0x1fffffec'),
        (0x4ef6de, 'add', 'eax, 0x1e'),
    ]
    for pc, mnemonic, operand in checks:
        assert (decoded[pc].mnemonic, decoded[pc].op_str) == (mnemonic, operand)
    allocation = list(decoder.disasm(pe.get_data(0x4ef4eb - base, 2), 0x4ef4eb))
    assert len(allocation) == 1 and (allocation[0].mnemonic, allocation[0].op_str) == ('push', '0x5c')
    vtable = {0x14: 0x64bf14, 0x18: 0x64bf6a, 0x1c: 0x64aba6, 0x20: 0x64ac1d}
    for offset, target in vtable.items():
        assert int.from_bytes(pe.get_data(0x68c8a0 + offset - base, 4), 'little') == target
    imports = {item.address: item.name.decode() for dll in pe.DIRECTORY_ENTRY_IMPORT
               for item in dll.imports if item.name}
    assert imports[0x67f0a0] == 'InitializeCriticalSection'
    assert imports[0x67f094] == 'EnterCriticalSection'
    assert imports[0x67f098] == 'LeaveCriticalSection'
    report = dict(qualified=True, executableSha256=PIN, methods=methods,
                  instructionSites=len(checks) + 1, fixedBufferBytes=100,
                  inputObjectBytes=92, outputObjectBytes=88,
                  fixedBufferVtable={f'{offset:02x}': f'{target:08x}'
                                     for offset, target in vtable.items()},
                  staticAuditOnly=True, browserUsed=False,
                  sourceSha256={str(Path(__file__).relative_to(ROOT)): sha(Path(__file__))})
    (ROOT / 'output/native-order-stream-sites-audit.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(dict(qualified=True, methods=len(methods), instructionSites=len(checks) + 1)))


if __name__ == '__main__':
    main()

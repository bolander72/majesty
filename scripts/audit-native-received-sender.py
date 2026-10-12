#!/usr/bin/env python3
"""Verify pinned source ID, XOR protocol and deferred lobby-exit ABI."""
import argparse
import hashlib
import json
from pathlib import Path
import struct

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


def audit():
    path = ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    with path.open('rb') as stream:
        if hashlib.file_digest(stream, 'sha256').hexdigest() != PIN:
            raise ValueError('Require pinned original executable')
    pe = pefile.PE(str(path), fast_load=True)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    tables = [(0x00689190, 4, 0x00588420),
              (0x00689190, 8, 0x00588470),
              (0x00689190, 0x38, 0x00588260),
              (0x00689190, 0x44, 0x00588370),
              (0x00689190, 0x48, 0x00588390),
              (0x006895e0, 0x10, 0x00593960),
              (0x00689308, 0x38, 0x0058be40),
              (0x00456284, 8, 0x0045523c)]
    for table, slot, target in tables:
        actual, = struct.unpack('<I', pe.get_data(table + slot - base, 4))
        if actual != target:
            raise ValueError(f'Vtable mismatch {table:08x}+{slot:x}')
    anchors = [(0x00588470, 'lea', 'eax, [ecx + 4]'),
               (0x00593960, 'mov', 'eax, dword ptr [ecx + 0x1c]'),
               (0x00592829, 'mov', 'dword ptr [ebx + 0x1c], ecx'),
               (0x005884ce, 'call', 'dword ptr [eax + 4]'),
               (0x00588504, 'mov', 'dword ptr [esi + 4], ecx'),
               (0x0059382a, 'call', 'dword ptr [edx + 0x3c]'),
               (0x0059383a, 'call', 'dword ptr [edx + 4]'),
               (0x0058963c, 'call', 'dword ptr [edx + 8]'),
               (0x0058964a, 'call', 'dword ptr [edx + 0x10]'),
               (0x004546da, 'mov', 'eax, dword ptr [eax + 0x4f0]'),
               (0x004546e0, 'mov', 'dword ptr [esi + 0x48], eax'),
               (0x00588341, 'mov', 'dword ptr [esi + 0x48], ecx'),
               (0x00588378, 'mov', 'cl, byte ptr [ecx + 0x48]'),
               (0x00588382, 'xor', 'bl, cl'),
               (0x00588398, 'mov', 'cl, byte ptr [ecx + 0x48]'),
               (0x005883a2, 'xor', 'bl, cl'),
               (0x0058823f, 'call', 'dword ptr [edx + 0x44]'),
               (0x005882dd, 'call', 'dword ptr [edx + 0x48]'),
               (0x00455df9, 'call', '0x4588d0'),
               (0x0045671f, 'call', '0x454560'),
               (0x00456749, 'call', 'dword ptr [eax]'),
               (0x00454943, 'call', 'dword ptr [edx + 0x38]'),
               (0x0045494f, 'jmp', 'dword ptr [eax*4 + 0x456284]'),
               (0x00455241, 'call', '0x4de6d0'),
               (0x00455249, 'jmp', '0x4560d0'),
               (0x00456f97, 'call', '0x456930'),
               (0x00456f9c, 'call', '0x456670'),
               (0x00456fa1, 'mov', 'eax, dword ptr [0x6d7ff0]'),
               (0x00456faa, 'jne', '0x458150'),
               (0x00458162, 'call', '0x4bbad0'),
               (0x00458167, 'call', '0x4ba850'),
               (0x0045816c, 'mov', 'dword ptr [0x6d7ff0], ebx')]
    rows = []
    for address, mnemonic, operands in anchors:
        instruction = next(decoder.disasm(pe.get_data(address - base, 16), address))
        if (instruction.mnemonic, instruction.op_str) != (mnemonic, operands):
            raise ValueError(f'Instruction mismatch {address:08x}')
        rows.append(dict(address=f'{address:08x}', mnemonic=mnemonic, operands=operands))
    return dict(version=2, executableSha256=PIN, browserUsed=False,
                tables=[dict(table=f'{table:08x}', slot=f'{slot:x}',
                             target=f'{target:08x}') for table, slot, target in tables],
                anchors=rows, sourceReferenceGetter='packet virtual +8',
                sourcePlayerIdGetter='source virtual +10',
                protocolField='packet +48: XOR key, overwritten by manager +4f0',
                systemLoss='category 3, kind 2: original handler only logs',
                deferredLobbyExit='006d7ff0 is read after queue drain; original leave branch clears it',
                scope='Static pinned ABI only; no runtime transfer or peer match qualification.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    report = audit()
    with args.output.open('x') as stream:
        json.dump(report, stream, indent=2)
        stream.write('\n')
    print(json.dumps(dict(anchors=len(report['anchors']), tables=len(report['tables']))))

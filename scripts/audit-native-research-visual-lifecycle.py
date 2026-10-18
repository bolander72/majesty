#!/usr/bin/env python3
"""Validate Old-edition research visual lifecycle bindings from the pinned PE."""
import argparse
import hashlib
import json
from pathlib import Path
import struct

import capstone
import pefile

PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


def audit(path):
    raw = Path(path).read_bytes()
    if hashlib.sha256(raw).hexdigest() != PIN:
        raise ValueError('Expected the qualified original Old executable')
    pe = pefile.PE(data=raw)
    base = pe.OPTIONAL_HEADER.ImageBase
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    ranges = [('entry-dispatch', 0x415e40, 0x415edf),
              ('world-ready', 0x416c30, 0x417096),
              ('building-stage-setter', 0x431130, 0x4311e0),
              ('owner-setter', 0x5a2670, 0x5a2689)]
    decoded = {}
    bodies = []
    for label, start, end in ranges:
        code = pe.get_data(start-base, end-start)
        rows = [{'address': f'{i.address:08x}', 'mnemonic': i.mnemonic, 'operands': i.op_str}
                for i in md.disasm(code, start)]
        decoded.update({int(i['address'], 16): i for i in rows})
        bodies.append(dict(role=label, start=f'{start:08x}', end=f'{end:08x}',
                           sha256=hashlib.sha256(code).hexdigest()))
    expected = [(0x415e7a, 'call', '0x416c30'),
                (0x416c48, 'mov', 'eax, dword ptr [0x71c68c]'),
                (0x417055, 'call', 'dword ptr [edx + 4]'),
                (0x417062, 'call', 'dword ptr [edx + 0xc]'),
                (0x41706a, 'push', '3'),
                (0x417072, 'call', '0x416050'),
                (0x417095, 'ret', ''),
                (0x5a2674, 'mov', 'edx, dword ptr [ecx + 0x70]'),
                (0x5a267b, 'mov', 'dword ptr [ecx + 0x70], eax'),
                (0x5a2680, 'call', 'dword ptr [eax + 0xb8]')]
    for address, mnemonic, operands in expected:
        row = decoded.get(address)
        if not row or (row['mnemonic'], row['operands']) != (mnemonic, operands):
            raise ValueError(f'Unexpected original lifecycle instruction {address:08x}')
    slots = [(0x67f96c+0x124, 0x431130), (0x67f96c+0x20, 0x5a2670),
             (0x67f96c+0x120, 0x5b46c0)]
    for address, target in slots:
        if struct.unpack('<I', pe.get_data(address-base, 4))[0] != target:
            raise ValueError(f'Unexpected original building vtable slot {address:08x}')
    return dict(format='majesty-old-research-visual-lifecycle-audit-v1',
                originalExecutableSha256=PIN, bodies=bodies,
                verifiedInstructions=[decoded[a] for a, _, _ in expected],
                worldReady='00416c30', buildingStageSetter='00431130', ownerSetter='005a2670',
                ownershipOffset='70', unitFamilyOffset='6c',
                note='Original world-ready requests phase3; reconcile after it returns and the next original frame commits that phase. No modern-edition RVA is used.',
                instructionsExecuted=False)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    result = audit(args.exe)
    args.out.write_text(json.dumps(result, indent=2)+'\n')
    print('Pinned Old research lifecycle: world-ready, stage and ownership bindings verified')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Verify the original zero-mask reveal path used during saved initialization."""
import argparse
import hashlib
import json
from pathlib import Path

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


def audit():
    raw = (ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    if hashlib.sha256(raw).hexdigest() != PIN:
        raise ValueError('Saved reveal requires the pinned executable')
    pe = pefile.PE(data=raw)
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    start, end = 0x005afe20, 0x005b0003
    instructions = list(decoder.disasm(pe.get_data(start - pe.OPTIONAL_HEADER.ImageBase,
                                                  end - start), start))
    if not instructions or instructions[-1].address + instructions[-1].size != end:
        raise ValueError('Incomplete original reveal routine')
    rows = [dict(address=f'{i.address:08x}', bytes=i.bytes.hex(), mnemonic=i.mnemonic,
                 operands=i.op_str) for i in instructions]
    indexed = {r['address']: r for r in rows}
    anchors = [('005aff25', 'mov', 'eax, dword ptr [esp + 0x40]'),
               ('005aff2b', 'mov', 'edx, eax'),
               ('005aff2d', 'and', 'edx, ebx'),
               ('005aff2f', 'cmp', 'edx, eax'),
               ('005aff31', 'je', '0x5affb8'),
               ('005aff74', 'mov', 'dword ptr [edi], eax'),
               ('005affa4', 'or', 'dword ptr [edi], 0x80000000'),
               ('005b0000', 'ret', '0xc')]
    for address, mnemonic, operands in anchors:
        if (indexed[address]['mnemonic'], indexed[address]['operands']) != (mnemonic, operands):
            raise ValueError(f'Original reveal instruction differs: {address}')
    caller = list(decoder.disasm(pe.get_data(0x005b649b - pe.OPTIONAL_HEADER.ImageBase, 5),
                                 0x005b649b))
    if len(caller) != 1 or (caller[0].mnemonic, caller[0].op_str) != ('call', '0x5afe20'):
        raise ValueError('Original visibility rebuild caller differs')
    return dict(version=1, staticQualified=True, executableSha256=PIN,
                entry=f'{start:08x}', callerReturn='005b64a0', argumentBytes=12,
                maskArgument=2, instructions=rows,
                checkedInstructions=[indexed[a] for a, _, _ in anchors],
                zeroMaskSkipsVertexWrite=True, primaryFieldsIgnored=False,
                browserUsed=False, nativeProcessesStarted=0,
                scope='Original mask predicate and RET only. Safe saved-state restoration '
                      'and subsequent ordinary visibility require runtime evidence.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    report = audit()
    with args.output.open('x') as f:
        json.dump(report, f, indent=2)
        f.write('\n')
    print(json.dumps(dict(staticQualified=True, checkedInstructions=len(report['checkedInstructions']))))

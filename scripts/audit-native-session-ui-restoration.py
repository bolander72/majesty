#!/usr/bin/env python3
"""Pin the original calls and scalar writes scoped by saved-region UI restore."""
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
        raise ValueError('Require the pinned original executable')
    pe = pefile.PE(data=raw)
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    ranges, decoded = [], {}
    for label, start, end in [
        ('selection-setter', 0x005b6a80, 0x005b6ac7),
        ('selected-unit-reset', 0x005ba870, 0x005ba8cc),
        ('camera-target-rebind', 0x0043a5a0, 0x0043a6e4),
        ('view-target-change', 0x00438ac0, 0x00438cbd),
        ('view-state-export', 0x00438140, 0x004381a4),
    ]:
        instructions = list(decoder.disasm(
            pe.get_data(start - pe.OPTIONAL_HEADER.ImageBase, end - start), start))
        if not instructions or instructions[-1].address + instructions[-1].size != end:
            raise ValueError(f'Incomplete original method: {label}')
        if instructions[-1].mnemonic != 'ret':
            raise ValueError(f'Missing original return: {label}')
        rows = [dict(address=f'{i.address:08x}', bytes=i.bytes.hex(),
                     mnemonic=i.mnemonic, operands=i.op_str) for i in instructions]
        ranges.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}',
                           instructions=rows))
        decoded.update({i['address']: i for i in rows})
    anchors = [
        ('005b6a81', 'mov', 'bl, byte ptr [esp + 0xc]'),
        ('005b6a94', 'mov', 'al, byte ptr [esp + 0xc]'),
        ('005b6a9f', 'or', 'al, 1'),
        ('005b6aa3', 'and', 'al, 0xfe'),
        ('005b6aa7', 'mov', 'dword ptr [esi + 0x64], eax'),
        ('005b6ac4', 'ret', '8'),
        ('005ba88b', 'test', 'byte ptr [esi + 0x64], 1'),
        ('005ba8a1', 'push', '1'),
        ('005ba8a3', 'push', '0'),
        ('005ba8a7', 'call', 'dword ptr [eax + 0x5c]'),
        ('005ba8c9', 'ret', '4'),
        ('0043a5c2', 'mov', 'esi, dword ptr [ebx + 0x50]'),
        ('0043a5c8', 'call', '0x438ac0'),
        ('00438afe', 'mov', 'dword ptr [esi + 0x18], ebx'),
        ('00438b01', 'mov', 'byte ptr [esi + 0x31], bl'),
        ('00438b0d', 'mov', 'byte ptr [esi + 0x32], bl'),
        ('00438b10', 'mov', 'byte ptr [esi + 0x30], bl'),
        ('00438b8e', 'mov', 'dword ptr [esi + 0x20], ebp'),
        ('00438b91', 'mov', 'dword ptr [esi + 0x24], eax'),
        ('00438b9f', 'mov', 'dword ptr [esi + 0x20], 0x656e6f6e'),
        ('00438ba6', 'mov', 'dword ptr [esi + 0x24], ecx'),
        ('00438ba9', 'mov', 'dword ptr [esi + 0x28], eax'),
        ('00438bae', 'mov', 'dword ptr [esi + 0x1c], ebp'),
        ('0043814d', 'mov', 'eax, dword ptr [ecx + 0x20]'),
        ('0043816a', 'mov', 'al, byte ptr [ecx + 0x30]'),
    ]
    for address, mnemonic, operands in anchors:
        if (decoded[address]['mnemonic'], decoded[address]['operands']) != (mnemonic, operands):
            raise ValueError(f'Original UI instruction differs: {address}')
    return dict(version=1, staticQualified=True, executableSha256=PIN, ranges=ranges,
                checkedInstructions=[decoded[address] for address, _, _ in anchors],
                selectionCaller='005ba8aa', selectionArgument=1, notificationArgument=2,
                redundantTargetCaller='0043a5cd',
                retainedDwordOffsets=[0x18, 0x20, 0x24, 0x28],
                retainedByteOffsets=[0x30, 0x31, 0x32],
                primaryFieldsIgnored=False, browserUsed=False, nativeProcessesStarted=0,
                scope='Original methods and caller/field identities only; actual native '
                      'load/save comparisons and rendered UI behavior require separate evidence.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    report = audit()
    with args.output.open('x') as f:
        json.dump(report, f, indent=2)
        f.write('\n')
    print(json.dumps(dict(staticQualified=True, instructions=len(report['checkedInstructions']),
                          nativeProcessesStarted=0)))

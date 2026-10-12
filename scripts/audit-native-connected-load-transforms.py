#!/usr/bin/env python3
"""Pin original UI target and player terrain-reveal methods for cold region loads."""
import argparse
import hashlib
import json
from pathlib import Path
import struct

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


def audit(executable):
    data = executable.read_bytes()
    if hashlib.sha256(data).hexdigest() != PIN:
        raise ValueError('Require the pinned DirectDraw executable')
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    ranges = []
    decoded = {}
    for label, start, end in [
        ('unit-selection-setter', 0x005b6a80, 0x005b6ac7),
        ('unit-selection-toggle', 0x005b6ad0, 0x005b6afc),
        ('unit-position-reveal', 0x005ad4c0, 0x005ad518),
        ('terrain-player-reveal', 0x005afe20, 0x005b0003),
        ('unit-visibility-rebuild', 0x005b6330, 0x005b6586),
        ('view-target-export', 0x00438140, 0x004381a4),
        ('view-target-change', 0x00438ac0, 0x00438cbd),
        ('global-writer', 0x00436200, 0x00436540),
    ]:
        ins = list(decoder.disasm(pe.get_data(start - base, end - start), start))
        if not ins or ins[-1].address + ins[-1].size != end:
            raise ValueError(f'Incomplete pinned range: {label}')
        meaningful = [i for i in ins if i.mnemonic != 'nop']
        if meaningful[-1].mnemonic != 'ret':
            raise ValueError(f'Missing final return: {label}')
        records = [dict(address=f'{i.address:08x}', mnemonic=i.mnemonic,
                        operands=i.op_str, bytes=i.bytes.hex()) for i in ins]
        decoded.update({i['address']: i for i in records})
        ranges.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}', instructions=records))
    checks = [
        ('selection-state-input', '005b6a94', 'mov', 'al, byte ptr [esp + 0xc]'),
        ('selection-clear-bit-one', '005b6aa3', 'and', 'al, 0xfe'),
        ('selection-state-write', '005b6aa7', 'mov', 'dword ptr [esi + 0x64], eax'),
        ('toggle-flag-one', '005b6ae0', 'xor', 'ecx, 1'),
        ('toggle-write', '005b6ae5', 'mov', 'dword ptr [esi + 0x64], ecx'),
        ('toggle-notification', '005b6aea', 'call', 'dword ptr [edx + 0xc4]'),
        ('position-unit-in-esi', '005ad4c4', 'mov', 'esi, dword ptr [esp + 0x1c]'),
        ('position-owner', '005ad4ee', 'call', 'dword ptr [eax + 0x1c]'),
        ('position-owner-mask', '005ad4f8', 'shl', 'edx, cl'),
        ('position-reveal', '005ad50e', 'call', '0x5afe20'),
        ('visibility-unit-in-esi', '005b6335', 'mov', 'esi, ecx'),
        ('visibility-owner-mask', '005b648f', 'shl', 'eax, cl'),
        ('visibility-reveal', '005b649b', 'call', '0x5afe20'),
        ('vertex-reveal-mask', '005aff69', 'or', 'eax, esi'),
        ('vertex-reveal-write', '005aff74', 'mov', 'dword ptr [edi], eax'),
        ('vertex-notification', '005aff9f', 'call', '0x447550'),
        ('vertex-notification-pending', '005affa4', 'or', 'dword ptr [edi], 0x80000000'),
        ('previous-view-target-export', '0043814d', 'mov', 'eax, dword ptr [ecx + 0x20]'),
        ('view-target-resolve', '00438b79', 'call', '0x5a10d0'),
        ('previous-view-target-change', '00438b8e', 'mov', 'dword ptr [esi + 0x20], ebp'),
        ('current-view-target-change', '00438bae', 'mov', 'dword ptr [esi + 0x1c], ebp'),
        ('global-collector-previous-target', '00436375', 'mov', 'ecx, dword ptr [esi + 0x24]'),
        ('global-previous-target-write', '0043637b', 'call', '0x4eec70'),
    ]
    for label, address, mnemonic, operands in checks:
        if (decoded[address]['mnemonic'], decoded[address]['operands']) != (mnemonic, operands):
            raise ValueError(f'Unexpected instruction: {label}')
    tables = []
    for table in (0x0067f96c, 0x0067fe6c, 0x0068098c):
        for slot, expected in ((0x5c, 0x005b6a80), (0x60, 0x005b6ad0)):
            target, = struct.unpack('<I', pe.get_data(table + slot - base, 4))
            if target != expected:
                raise ValueError('Unexpected original selection virtual method')
            tables.append(dict(table=f'{table:08x}', slot=slot, target=f'{target:08x}'))
    return dict(version=1, executableSha256=PIN, ranges=ranges,
                checkedInstructions=[dict(label=label, **decoded[address]) for label, address, _, _ in checks],
                observedUnitSelectionSlots=tables,
                finding='GSGL payload DWORD 24 is exported from previous mini-view target. '
                        'The original reveal method ORs a player mask into terrain vertex +4 '
                        'and sets bit31 when scheduling a notification. These are distinct fields.',
                primaryFieldsIgnored=False, nativeProcessesStarted=0, browserUsed=False,
                limitations='Static methods do not prove the complete cold-load caller chain, '
                            'equivalent gameplay or safe normalization of selection, visibility '
                            'or the notification bit. Original loaded world observations remain required.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path, default=ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--output', type=Path)
    mode.add_argument('--verify-report', type=Path)
    args = parser.parse_args()
    result = audit(args.exe)
    if args.verify_report:
        if args.verify_report.stat().st_size > 262144 or json.loads(args.verify_report.read_text()) != result:
            raise ValueError('Saved audit differs from the pinned original instructions')
    else:
        with args.output.open('x') as out:
            json.dump(result, out, indent=2)
            out.write('\n')
    print(f'Pinned {len(result["checkedInstructions"])} load-transform instructions; no primary fields ignored.')


if __name__ == '__main__':
    main()

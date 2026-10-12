#!/usr/bin/env python3
"""Pin the original auxiliary terrain RNG and undefined new-view fields."""
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
    if not any(i.address == 0x0067f400 and i.name == b'timeGetTime'
               for module in pe.DIRECTORY_ENTRY_IMPORT for i in module.imports):
        raise ValueError('Original time import identity differs')
    cs = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    cs.detail = True
    decoded = {}
    ranges = []
    for label, start, end in [
        ('terrain-rng-getter', 0x004f6730, 0x004f6768),
        ('time-derived-seed', 0x0054c3c0, 0x0054c3d1),
        ('original-rng-setter', 0x004f6710, 0x004f6729),
        ('gameplay-rng-getter', 0x00601760, 0x00601799),
        ('terrain-cell-update', 0x005cb8b0, 0x005cc073),
        ('view-constructor', 0x004384b0, 0x0043874b),
        ('view-state-export', 0x00438140, 0x004381a4),
        ('saved-view-reconstruction', 0x00437910, 0x00437b09),
        ('global-state-constructor', 0x00435e10, 0x00435e48),
    ]:
        instructions = list(cs.disasm(pe.get_data(start - 0x400000, end-start), start))
        if not instructions or instructions[-1].address + instructions[-1].size != end:
            raise ValueError(f'Incomplete pinned range: {label}')
        if [i for i in instructions if i.mnemonic != 'nop'][-1].mnemonic != 'ret':
            raise ValueError(f'Incomplete original return: {label}')
        rows = [dict(address=f'{i.address:08x}', mnemonic=i.mnemonic,
                     operands=i.op_str, bytes=i.bytes.hex()) for i in instructions]
        decoded.update({r['address']: r for r in rows})
        if label == 'view-constructor':
            stores = []
            for i in instructions:
                for op in i.operands:
                    if (op.type == capstone.x86.X86_OP_MEM and
                            op.access & capstone.CS_AC_WRITE and
                            op.mem.base == capstone.x86.X86_REG_ESI):
                        stores.append((op.mem.disp, op.size))
            for missing in [0x18, 0x38, 0x3c, 0x40, 0x44]:
                if any(at < missing+4 and missing < at+size for at,size in stores):
                    raise ValueError('Original constructor already writes a proposed default')
        ranges.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}', instructions=rows))
    anchors = [
        ('004f6746', 'call', '0x54c3c0'),
        ('0054c3c0', 'call', 'dword ptr [0x67f400]'),
        ('004f6750', 'mov', 'dword ptr [0x6d8e80], eax'),
        ('004f6755', 'mov', 'dword ptr [0x6d8e84], eax'),
        ('004f6762', 'mov', 'eax, 0x6d8e80'),
        ('004f6720', 'mov', 'dword ptr [esi], eax'),
        ('004f6722', 'mov', 'dword ptr [esi + 4], eax'),
        ('005cbfc1', 'call', '0x4f6730'),
        ('005cbfc8', 'call', '0x4f6690'),
        ('005cbfcd', 'mov', 'byte ptr [esi + 4], al'),
        ('00438185', 'mov', 'eax, dword ptr [ecx + 0x38]'),
        ('0043818e', 'mov', 'edx, dword ptr [ecx + 0x3c]'),
        ('00438198', 'mov', 'eax, dword ptr [ecx + 0x44]'),
        ('0043799d', 'call', '0x4384b0'),
        ('00437a4e', 'mov', 'dword ptr [esi + 0x38], edx'),
        ('00437a5d', 'mov', 'dword ptr [esi + 0x3c], ebp'),
        ('00437a71', 'mov', 'dword ptr [esi + 0x18], eax'),
        ('00437a79', 'mov', 'dword ptr [esi + 0x40], edi'),
        ('00437a7c', 'mov', 'dword ptr [esi + 0x44], ecx'),
    ]
    for at, mnemonic, operands in anchors:
        if (decoded[at]['mnemonic'], decoded[at]['operands']) != (mnemonic, operands):
            raise ValueError(f'Original anchor differs: {at}')
    gameplay = next(r for r in ranges if r['label'] == 'gameplay-rng-getter')
    if not any(i['mnemonic']=='mov' and i['operands']=='eax, 0x71fc70' for i in gameplay['instructions']):
        raise ValueError('Separate gameplay RNG identity differs')
    return dict(version=1, executableSha256=PIN, ranges=ranges,
                checkedInstructions=[decoded[a] for a,_,_ in anchors],
                terrainRng='006d8e80', gameplayRng='0071fc70',
                originalTerrainRngTimeInitialized=True,
                omittedNewViewWordOffsets=[24,56,60,64,68],
                originalSavedViewRestoresAfterConstructor=True,
                browserUsed=False, nativeProcessesStarted=0,
                fullWorldEqualityQualified=False,
                scope='Pinned original ownership/writer/reader evidence. Defaults apply only to new view construction; auxiliary RNG seeding must apply only to admitted cooperative fresh generation. Actual cross-role full saves still require qualification. No serialized fields are ignored.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = audit()
    with args.output.open('x') as out:
        json.dump(result, out, indent=2)
        out.write('\n')
    print(json.dumps(dict(pinned=True, ranges=len(result['ranges']), anchors=len(result['checkedInstructions']))))

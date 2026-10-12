#!/usr/bin/env python3
"""Pin original script-queue pointer membership and removal count fields."""
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
        raise ValueError('Script queue audit requires the pinned executable')
    pe = pefile.PE(data=raw)
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    start, end = 0x6332c0, 0x633362
    rows = [dict(address=i.address, mnemonic=i.mnemonic, operands=i.op_str, bytes=i.bytes.hex())
            for i in decoder.disasm(pe.get_data(start - pe.OPTIONAL_HEADER.ImageBase, end - start), start)]
    if sum(len(bytes.fromhex(i['bytes'])) for i in rows) != end - start or rows[-1]['mnemonic'] != 'ret':
        raise ValueError('Incomplete original queue-removal method')
    by_address = {i['address']: i for i in rows}
    anchors = [(0x6332d9, 'lea', 'edi, [esi + 0x10]'), (0x6332ec, 'mov', 'ecx, dword ptr [esi + 0x14]'),
               (0x6332f3, 'cmp', 'dword ptr [eax + 8], ebx'), (0x6332fe, 'mov', 'ecx, dword ptr [esi + 0x20]'),
               (0x633307, 'cmp', 'dword ptr [eax + 8], ebx'), (0x633334, 'mov', 'dword ptr [edi + 8], eax'),
               (0x633359, 'mov', 'dword ptr [esi + 0x24], eax'), (0x63335f, 'ret', '4')]
    for address, mnemonic, operands in anchors:
        if (by_address[address]['mnemonic'], by_address[address]['operands']) != (mnemonic, operands):
            raise ValueError('Changed original script queue field')
    getter = [dict(address=i.address, mnemonic=i.mnemonic, operands=i.op_str, bytes=i.bytes.hex())
              for i in decoder.disasm(pe.get_data(0x633fc0 - pe.OPTIONAL_HEADER.ImageBase, 14), 0x633fc0)]
    if (sum(len(bytes.fromhex(i['bytes'])) for i in getter) != 14 or getter[-1]['mnemonic'] != 'ret' or
            (getter[0]['mnemonic'], getter[0]['operands']) != ('mov', 'eax, dword ptr [ecx + 4]') or
            (getter[1]['mnemonic'], getter[1]['operands']) != ('mov', 'ecx, dword ptr [eax]')):
        raise ValueError('Changed original sentinel-based queue begin getter')
    return dict(qualified=True, executableSha256=PIN, instructions=rows, getterInstructions=getter, verifiedInstructionAnchors=len(anchors) + 2,
                activeQueueOffset=0x10, waitingQueueOffset=0x1c, sentinelOffset=4, countOffset=8, nodeOwnerOffset=8,
                scope='Original pointer-based queue removal fields only; live membership and persistence require actual native observations',
                browserUsed=False, nativeProcessesStarted=0)


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output', type=Path, required=True)
    a = p.parse_args()
    result = audit()
    with a.output.open('x') as f:
        json.dump(result, f, indent=2)
        f.write('\n')
    print(json.dumps(dict(qualified=True, anchors=result['verifiedInstructionAnchors'])))

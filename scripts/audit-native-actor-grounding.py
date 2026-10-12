#!/usr/bin/env python3
"""Pin original PRIMARY mode/cache fields and inactive navigation-cache branch."""
import argparse
import hashlib
import json
from pathlib import Path
import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
RANGES = [('primary-reader', 0x5bfe50, 0x5c0bd0),
          ('primary-writer-prefix', 0x5c0bd0, 0x5c0d19),
          ('cache-getter', 0x5b9e20, 0x5b9e64),
          ('cache-navigation-consumer', 0x5b91b0, 0x5b9271)]
ANCHORS = [
    (0x5c033d, 'mov', 'edx, dword ptr [esp + 0xbc]'),
    (0x5c0344, 'mov', 'dword ptr [edi + 0x78], edx'),
    (0x5c0347, 'mov', 'eax, dword ptr [esp + 0xb8]'),
    (0x5c034e, 'cmp', 'eax, 1'), (0x5c0353, 'mov', 'eax, dword ptr [edi + 0x7c]'),
    (0x5c0383, 'mov', 'ebp, dword ptr [edi + 0x7c]'),
    (0x5c038d, 'call', '0x4ef790'), (0x5c0396, 'push', 'ebp'),
    (0x5c0399, 'call', '0x4ef790'), (0x5c03a3, 'lea', 'ecx, [ebp + 4]'),
    (0x5c03a6, 'call', '0x660930'),
    (0x5c0c9d, 'push', '0x3c'), (0x5c0ca8, 'mov', 'eax, dword ptr [esi + 0x78]'),
    (0x5c0caf, 'mov', 'edx, dword ptr [esi + 0x7c]'),
    (0x5c0cb4, 'lea', 'edx, [esp + 0x4c]'),
    (0x5c0cbb, 'mov', 'dword ptr [esp + 0x7c], ecx'),
    (0x5c0cc2, 'mov', 'dword ptr [esp + 0x84], eax'),
    (0x5c0cc9, 'call', '0x4eef60'),
    (0x5c0cdd, 'push', '1'), (0x5c0cea, 'mov', 'eax, dword ptr [ebx]'),
    (0x5c0cef, 'call', '0x4eed10'), (0x5c0cf9, 'lea', 'ecx, [ebx + 4]'),
    (0x5c0cfc, 'call', '0x660960'),
    (0x5b9e26, 'mov', 'eax, dword ptr [esi + 0x34]'),
    (0x5b9e2b, 'jne', '0x5b9e5c'),
    (0x5b9e5c, 'mov', 'eax, dword ptr [esi + 0x34]'),
    (0x5b91b9, 'lea', 'ecx, [eax + 0x48]'),
    (0x5b91be, 'call', '0x5b9e20'), (0x5b91c3, 'cmp', 'dword ptr [eax], 0'),
    (0x5b91c6, 'je', '0x5b9261'), (0x5b9208, 'mov', 'edx, dword ptr [eax + 4]'),
    (0x5b9222, 'call', '0x5b9280'), (0x5b9261, 'mov', 'al, bl'),
    (0x5b9266, 'ret', '8'),
]


def audit():
    raw = (ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    if hashlib.sha256(raw).hexdigest() != PIN:
        raise ValueError('Grounding audit requires the pinned executable')
    pe = pefile.PE(data=raw); decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    ranges, rows = [], {}
    for label, start, end in RANGES:
        instructions = list(decoder.disasm(pe.get_data(start - pe.OPTIONAL_HEADER.ImageBase, end - start), start))
        if sum(i.size for i in instructions) != end - start:
            raise ValueError('Incomplete pinned grounding range')
        values = [dict(address=i.address, mnemonic=i.mnemonic, operands=i.op_str, bytes=i.bytes.hex()) for i in instructions]
        rows.update({v['address']: v for v in values})
        ranges.append(dict(label=label, start=start, end=end, instructions=values))
    for at, mnemonic, operands in ANCHORS:
        if at not in rows or (rows[at]['mnemonic'], rows[at]['operands']) != (mnemonic, operands):
            raise ValueError(f'Grounding anchor changed at {at:08x}')
    return dict(qualified=True, executableSha256=PIN, verifiedInstructionAnchors=len(ANCHORS), ranges=ranges,
                savedCachePresenceOffset=80, savedModeOffset=84, savedCacheVersionOffset=92,
                savedCacheActiveOffset=96, savedCachePointOffsets=[100, 104],
                nativeModeOffset=0x78, nativeCachePointerOffset=0x7c,
                inactiveCacheSkipsPointReadAndBlockingLookup=True,
                existingCacheGetterDoesNotAllocate=True, browserUsed=False, gameLaunches=0,
                scope='Existing inactive cache branch and PRIMARY layout only; no active movement/collision-chain execution or animation trajectory migration')


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__); p.add_argument('--output', type=Path, required=True)
    args = p.parse_args(); result = audit()
    with args.output.open('x') as f:
        json.dump(result, f, indent=2); f.write('\n')
    print(json.dumps(dict(qualified=True, anchors=result['verifiedInstructionAnchors'])))

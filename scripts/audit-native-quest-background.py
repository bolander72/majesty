#!/usr/bin/env python3
"""Verify the original quest callback ABI and native window invalidation slot."""
import argparse
import hashlib
import json
from pathlib import Path
import struct

import capstone

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
FRAGMENTS = {
    'callbackMessageAndWidget': (0x0044f430, 0x0044f467, {
        0x0044f436: ('push', '-1'),
        0x0044f438: ('push', '0x66a7e8'),
        0x0044f43d: ('push', 'eax'),
        0x0044f43e: ('mov', 'eax, dword ptr [esp + 0x14]'),
        0x0044f449: ('sub', 'esp, 0x34'),
        0x0044f44c: ('cmp', 'eax, 0x51'),
        0x0044f44f: ('push', 'ebx'),
        0x0044f450: ('push', 'ebp'),
        0x0044f451: ('push', 'esi'),
        0x0044f452: ('push', 'edi'),
        0x0044f45e: ('mov', 'esi, dword ptr [esp + 0x54]'),
    }),
    'ownerWindowGetter': (0x0044f4b0, 0x0044f4c9, {
        0x0044f4b0: ('mov', 'eax, dword ptr [esi]'),
        0x0044f4b2: ('mov', 'ecx, esi'),
        0x0044f4b4: ('call', 'dword ptr [eax + 0x14]'),
        0x0044f4bb: ('mov', 'edx, dword ptr [eax]'),
    }),
    'callbackReturn': (0x0044f85b, 0x0044f870, {
        0x0044f85b: ('mov', 'eax, edi'),
        0x0044f86c: ('add', 'esp, 0x40'),
        0x0044f86f: ('ret', ''),
    }),
    'windowInvalidation': (0x004e01f0, 0x004e01fa, {
        0x004e01f2: ('mov', 'esi, ecx'),
        0x004e01f5: ('mov', 'eax, dword ptr [esi]'),
        0x004e01f7: ('call', 'dword ptr [eax + 0x54]'),
    }),
}


def decode(data, start, required):
    rows = list(capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32).disasm(data, start))
    if sum(row.size for row in rows) != len(data):
        raise ValueError('Incomplete original instruction decode')
    actual = {row.address: (row.mnemonic, row.op_str) for row in rows}
    for address, expected in required.items():
        if actual.get(address) != expected:
            raise ValueError(f'Original quest ABI differs at {address:08x}: {actual.get(address)}')
    return len(rows)


def audit(executable):
    if executable.stat().st_flags & 0x40000000:
        raise ValueError('Original executable is a cloud placeholder')
    data = executable.read_bytes()
    if hashlib.sha256(data).hexdigest() != PIN:
        raise ValueError('Pinned original executable differs')
    pe = struct.unpack_from('<I', data, 60)[0]
    count = struct.unpack_from('<H', data, pe + 6)[0]
    optional = struct.unpack_from('<H', data, pe + 20)[0]
    base = struct.unpack_from('<I', data, pe + 52)[0]
    if base != 0x400000 or count > 16:
        raise ValueError('Original PE layout differs')
    sections = [struct.unpack_from('<IIII', data, pe + 24 + optional + 40 * i + 8)
                for i in range(count)]
    evidence, controls = {}, []
    for name, (start, end, required) in FRAGMENTS.items():
        section = next(s for s in sections if s[1] <= start - base and end - base <= s[1] + s[2])
        offset = section[3] + start - base - section[1]
        raw = data[offset:offset + end - start]
        evidence[name] = dict(instructions=decode(raw, start, required), sha256=hashlib.sha256(raw).hexdigest())
        changed = bytearray(raw)
        changed[next(iter(required)) - start] ^= 1
        try:
            decode(changed, start, required)
        except ValueError:
            controls.append(name)
        else:
            raise ValueError('Changed original instruction was accepted')
    return dict(abiQualified=True, originalExecutableSha256=PIN, fragments=evidence,
                changedInstructionControls=controls, widgetArgumentOffset=4, messageArgumentOffset=8,
                ownerGetterSlot=0x14, invalidationSlot=0x54, browserUsed=False,
                compiled=False, renderingFixQualified=False,
                scope='Original callback stack and vtable ABI only; no repaint, browser or lifecycle qualification')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError('Preserve prior evidence')
    result = audit(ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({key: result[key] for key in ['abiQualified', 'compiled', 'renderingFixQualified']}))

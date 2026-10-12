#!/usr/bin/env python3
"""Pin original Ping/Pong ownership, timestamp and packet construction."""
import argparse
import hashlib
import json
from pathlib import Path

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


def audit():
    raw = (ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    assert hashlib.sha256(raw).hexdigest() == PIN
    pe = pefile.PE(data=raw)
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    decoded, ranges = {}, []
    for label, start, end, full in [
        ('original-ping-producer', 0x498360, 0x49847e, True),
        ('original-pong-dispatch-fragment', 0x498a34, 0x498a73, False),
        ('original-packet-constructor', 0x58b6d0, 0x58b75c, True),
    ]:
        code = list(md.disasm(pe.get_data(start-0x400000, end-start), start))
        assert code[-1].address+code[-1].size == end
        if full: assert code[-1].mnemonic == 'ret'
        rows = [dict(address=f'{i.address:08x}', mnemonic=i.mnemonic,
                     operands=i.op_str, bytes=i.bytes.hex()) for i in code]
        decoded.update({r['address']: r for r in rows})
        ranges.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}',
                           fullFunction=full, instructions=rows))
    anchors = [
        ('00498381', 'call', 'dword ptr [eax + 0x34]'),
        ('00498384', 'mov', 'dword ptr [esp + 0x18], eax'),
        ('00498388', 'call', 'dword ptr [0x67f400]'),
        ('00498390', 'mov', 'dword ptr [esp + 0x20], eax'),
        ('004983b0', 'push', '8'),
        ('004983b3', 'push', '0x12'),
        ('004983b7', 'call', '0x58b6d0'),
        ('00498a3d', 'call', 'dword ptr [edx + 0x38]'),
        ('00498a40', 'mov', 'ecx, dword ptr [ebp + 0x8c]'),
        ('00498a4c', 'mov', 'dword ptr [eax], ecx'),
        ('00498a67', 'push', '8'),
        ('00498a6a', 'push', '0x13'),
        ('00498a6e', 'call', '0x58b6d0'),
        ('0058b70c', 'mov', 'dword ptr [ebx + 0x2c], eax'),
        ('0058b73d', 'mov', 'dword ptr [ebx + 0x28], ebp'),
    ]
    for address, mnemonic, operands in anchors:
        assert (decoded[address]['mnemonic'], decoded[address]['operands']) == (mnemonic, operands), address
    imports = [i for entry in pe.DIRECTORY_ENTRY_IMPORT for i in entry.imports
               if i.address == 0x67f400]
    assert len(imports) == 1 and imports[0].name == b'timeGetTime'
    return dict(version=1, executableSha256=PIN, ranges=ranges,
                checkedInstructions=[decoded[a] for a, _, _ in anchors],
                pingKind=18, pongKind=19, bodyBytes=8,
                timestampSource='original imported timeGetTime',
                originalReplyReplacesOwnerAndPreservesTimestamp=True,
                scope='Original Ping is latency traffic. Replay preserves actual bytes; the original recipient generates its own Pong. No fabricated game inputs or simulation timestamp substitutions.',
                browserUsed=False, nativeProcessesStarted=0)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = audit()
    with args.output.open('x') as sink:
        json.dump(result, sink, indent=2); sink.write('\n')
    print(json.dumps(dict(pinned=True, ranges=len(result['ranges']),
                          anchors=len(result['checkedInstructions']))))

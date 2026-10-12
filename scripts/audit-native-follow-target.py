#!/usr/bin/env python3
"""Pinned static provenance for the Follow Unit target; no engine execution."""
import hashlib
import json
from pathlib import Path
import struct

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
OUTPUT = ROOT / 'output/native-follow-target-audit.json'
RANGES = [
    ('writer', 0x5e2390, 0x5e2400),
    ('target-debug-label', 0x5e25eb, 0x5e25fd),
    ('target-consumer-prefix', 0x5e2680, 0x5e26aa),
    ('target-producer', 0x5e2830, 0x5e28bb),
    ('action-target-producer', 0x5e29a0, 0x5e2a92),
    ('unit-registry-lookup', 0x5a10d0, 0x5a110c),
]
ANCHORS = [
    (0x5e23b4, 'mov', 'ecx, dword ptr [edi + 0x38]'),
    (0x5e23b7, 'push', 'ecx'),
    (0x5e23ba, 'call', '0x4eec70'),
    (0x5e25eb, 'mov', 'ecx, dword ptr [esi + 0x38]'),
    (0x5e25f1, 'push', 'ecx'),
    (0x5e25f2, 'push', '0x6c22f0'),
    (0x5e25f8, 'call', '0x4de240'),
    (0x5e2693, 'mov', 'ebp, dword ptr [edi + 0x84]'),
    (0x5e269f, 'mov', 'eax, dword ptr [esi + 0x38]'),
    (0x5e26a2, 'mov', 'ecx, ebp'),
    (0x5e26a4, 'push', 'eax'),
    (0x5e26a5, 'call', '0x5a10d0'),
    (0x5e2882, 'mov', 'eax, dword ptr [edx + 0x60]'),
    (0x5e2887, 'mov', 'dword ptr [esi + 0x38], eax'),
    (0x5e2a40, 'mov', 'ecx, dword ptr [eax + 0x60]'),
    (0x5e2a44, 'mov', 'dword ptr [esi + 0x38], ecx'),
    (0x5a10d1, 'mov', 'esi, dword ptr [esp + 8]'),
    (0x5a10d5, 'test', 'esi, esi'),
    (0x5a10d7, 'je', '0x5a1106'),
    (0x5a10e5, 'push', '3'),
    (0x5a10e7, 'call', '0x5969a0'),
    (0x5a10ee, 'push', 'esi'),
    (0x5a10f1, 'call', 'dword ptr [edx + 0x28]'),
]


def main():
    OUTPUT.unlink(missing_ok=True)
    raw = (ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    if hashlib.sha256(raw).hexdigest() != PIN:
        raise ValueError('Requires the pinned original Majesty executable')
    pe = pefile.PE(data=raw)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    decoded, ranges = {}, []
    for label, start, end in RANGES:
        code = pe.get_data(start-base, end-start)
        rows = list(decoder.disasm(code, start))
        if sum(i.size for i in rows) != end-start:
            raise ValueError('Incomplete pinned range: ' + label)
        decoded.update({i.address: (i.mnemonic, i.op_str) for i in rows})
        ranges.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}',
                           sha256=hashlib.sha256(code).hexdigest(), instructions=len(rows)))
    for address, mnemonic, operands in ANCHORS:
        if decoded.get(address) != (mnemonic, operands):
            raise ValueError(f'Unexpected reference instruction: {address:08x}')
    for address, expected in [(0x68ae44+8, 0x5e2390), (0x68ae44+0x14, 0x5e25c0),
                              (0x68ae44+0x18, 0x5e2680)]:
        if struct.unpack('<I', pe.get_data(address-base, 4))[0] != expected:
            raise ValueError('Unexpected Follow Unit virtual slot')
    for address, expected in [(0x6ceec0, b'\r\nOrder Follow Unit'),
                              (0x6c22f0, b'\r\n _targetID: %d')]:
        if pe.get_data(address-base, 128).split(b'\0', 1)[0] != expected:
            raise ValueError('Unexpected Follow Unit debug label')
    writer_path = ROOT / 'output/native-order-writers-emulated-observed.json'
    evidence = json.loads(writer_path.read_text())
    if not evidence['qualified'] or evidence['completedCalls'] != 20:
        raise ValueError('Missing original writer qualification')
    for name, digest in evidence['sourceSha256'].items():
        if hashlib.sha256((ROOT/name).read_bytes()).hexdigest() != digest:
            raise ValueError('Stale original writer evidence')
    replays = [r for r in evidence['replays'] if r['kind'] == 6]
    if len(replays) != 2 or any(r['fixedBytes'] != 176 or r['words'][25] != 0x11000038 for r in replays):
        raise ValueError('Original writer does not reproduce the target word mapping')
    report = dict(qualified=True, scope='kind 6 target field provenance only', executableSha256=PIN,
                  ranges=ranges, anchors=len(ANCHORS), virtualSlots=3, labels=2,
                  originalWriterReplayChecks=len(replays), unitObjectOffset=0x60,
                  orderObjectOffset=0x38, serializedBodyWord=25, serializedBodyByte=100,
                  zeroLookupReturnsNullStaticallyObserved=True,
                  writerEvidenceSha256=hashlib.sha256(writer_path.read_bytes()).hexdigest(),
                  sourceSha256={'scripts/audit-native-follow-target.py': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},
                  allOrderReferencesQualified=False, callbackReferencesQualified=False,
                  destinationRemappingQualified=False, orderReaderRestoreQualified=False,
                  gameLaunched=False, browserUsed=False, nativeBuildRun=False, crashResolved=False)
    OUTPUT.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({k: report[k] for k in ['qualified', 'scope', 'anchors', 'originalWriterReplayChecks', 'gameLaunched']}))


if __name__ == '__main__':
    main()

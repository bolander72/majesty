#!/usr/bin/env python3
"""Bind the crossing Explore flag's saved class to the pinned native factory."""
import argparse
import hashlib
import json
import struct
from pathlib import Path

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(4096), b''):
            h.update(block)
    return h.hexdigest()


def audit():
    executable = ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    if sha(executable) != PIN:
        raise ValueError('Explore flag audit requires the pinned executable')
    pe = pefile.PE(str(executable))
    base = pe.OPTIONAL_HEADER.ImageBase
    word = lambda address: struct.unpack('<I', pe.get_data(address - base, 4))[0]
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    methods, decoded = [], {}
    for label, start, end in [
        ('factory', 0x42c3d0, 0x42c435),
        ('flag-allocation', 0x4331e0, 0x43323a),
        ('shared-constructor', 0x42ff80, 0x430007),
        ('flag-deleting-destructor', 0x433170, 0x43318e),
        ('component-reader', 0x5c1f30, 0x5c1fe9),
        ('component-writer', 0x5c22b0, 0x5c234a),
        ('primary-writer', 0x5c0bd0, 0x5c0ded),
        ('parent-navigation', 0x5ad420, 0x5ad465),
        ('order-reader', 0x5b1b90, 0x5b1bd8),
        ('bank-getter', 0x4300e0, 0x43014f),
        ('description-resolution', 0x5a2120, 0x5a218f),
    ]:
        code = pe.get_data(start - base, end - start)
        rows = list(decoder.disasm(code, start))
        if sum(i.size for i in rows) != len(code) or rows[-1].mnemonic != 'ret':
            raise ValueError(f'Incomplete method: {label}')
        decoded.update({i.address: (i.mnemonic, i.op_str) for i in rows})
        methods.append(dict(label=label, start=start, end=end,
                            sha256=hashlib.sha256(code).hexdigest(), instructions=len(rows)))
    anchors = {
        0x42c404: ('call', '0x4331e0'),
        0x42c41c: ('mov', 'dword ptr [eax + 0x5c], esi'),
        0x42c41f: ('mov', 'dword ptr [eax + 0x6c], ecx'),
        0x4331f7: ('push', '0x150'),
        0x4331fc: ('call', '0x64c616'),
        0x433218: ('push', '4'),
        0x43321d: ('call', '0x42ff80'),
        0x433222: ('mov', 'dword ptr [esi], 0x68071c'),
        0x433180: ('call', '0x645bc0'),
        0x5c1fc2: ('call', 'eax'),
        0x5c230b: ('mov', 'edx, dword ptr [edi + 8]'),
        0x5c230e: ('mov', 'ecx, dword ptr [edx + esi]'),
        0x5c231b: ('call', 'ecx'),
        0x5c0c96: ('call', '0x5ad420'),
        0x5ad423: ('mov', 'eax, dword ptr [esi + 0x74]'),
        0x5ad42a: ('test', 'byte ptr [esi + 0x64], 0x80'),
        0x5ad437: ('call', '0x5a10d0'),
        0x5ad447: ('call', '0x5ad420'),
        0x5b1b9c: ('call', 'dword ptr [eax + 0x164]'),
        0x5b1bb3: ('call', 'dword ptr [edx + 0x160]'),
        0x430108: ('push', '0x14'),
        0x43010a: ('call', '0x64c616'),
        0x43012e: ('mov', 'dword ptr [esi + edi*4 + 0x88], eax'),
        0x5a217f: ('mov', 'dword ptr [ebx + 0x80], eax'),
    }
    for address, expected in anchors.items():
        if decoded.get(address) != expected:
            raise ValueError(f'Changed instruction at {address:08x}')
    if word(0x42c438 + 4 * 4) != 0x42c403:
        raise ValueError('Changed kind4 factory dispatch')
    slots = {0: 0x433170, 0x94: 0x5ad3e0, 0x98: 0x5ad400, 0x9c: 0x5ad470, 0xa4: 0x5b66f0,
             0x160: 0x4300e0, 0x164: 0x5b2de0, 0x1ac: 0x5b1b90,
             0x1b0: 0x5b1be0, 0x1b4: 0x5a2370, 0x1b8: 0x5a2420}
    for offset, target in slots.items():
        if word(0x68071c + offset) != target:
            raise ValueError(f'Changed flag slot {offset:x}')
    serializer = [word(0x6bd89c + offset) for offset in range(0, 20, 4)]
    if serializer != [0x44525752, 0x5c0df0, 0x5c0bd0, 0, 4]:
        raise ValueError('Changed original RWRD serialization table')
    manifest_path = ROOT / 'output/native-halo-crossing-generation-233/manifest.json'
    manifest = json.loads(manifest_path.read_text())
    if not manifest['nativeOriginalActorCoreCrossingQualified'] or manifest['nativeExitCode'] != 0:
        raise ValueError('Unqualified crossing producer')
    record = next(r for r in manifest['evidence'] if r['original'].endswith('/Halo_Hero_Crossed.GMP'))
    checkpoint = Path(record['preserved'])
    if sha(checkpoint) != record['sha256'] or checkpoint.stat().st_size != record['bytes']:
        raise ValueError('Changed frozen crossing checkpoint')
    with checkpoint.open('rb') as f:
        f.seek(320414)
        flag = f.read(146)
    words = struct.unpack('<24I', flag[:96])
    if words[:15] != (0x54494e55, 130, 0, 1, 0x4d495250, 114, 9, 0,
                      4, 492, 545, 0, 0x34415241, 0, 0):
        raise ValueError('Changed original single-component flag record')
    return dict(version=1, qualified=True, scope='static original Explore flag class and saved record',
                executableSha256=PIN, methods=methods, checkedInstructions=len(anchors),
                factoryKind=4, factory=0x42c3d0, constructorFactory=0x4331e0,
                objectBytes=336, table=0x68071c, components=1, primaryVersion=9,
                description=0x34415241, flags=545, parent=0,
                slots=[dict(offset=o, target=t) for o, t in slots.items()],
                bankFields=0x88, bankAllocateReturn=0x43010f, bankBytes=20,
                serializerTable=0x6bd89c, serializerWords=serializer,
                checkpoint=dict(path=str(checkpoint), sha256=record['sha256'],
                                recordOffset=320414, recordBytes=146,
                                recordSha256=hashlib.sha256(flag).hexdigest()),
                producerManifestSha256=sha(manifest_path),
                sourceSha256={'scripts/audit-native-explore-flag.py': sha(Path(__file__))},
                nativeFlagReaderExecuted=False, nativeActivationQualified=False,
                browserUsed=False, gameLaunched=False)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Preserve prior evidence')
    result = audit()
    with args.output.open('x') as f:
        json.dump(result, f, indent=2)
        f.write('\n')
    print(json.dumps({k: result[k] for k in ['qualified', 'objectBytes', 'components',
                                           'checkedInstructions', 'gameLaunched']}))

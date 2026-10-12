#!/usr/bin/env python3
"""Private NBO2 input consuming real-name JavaScript reservation descriptors."""
import hashlib
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
ROLES = {'bank': 0, 'head': 1, 'order': 2, 'path': 3, 'node': 4,
         'baseName': 5, 'leafName': 6}
COPIES = {'scions.GMP': '6e6a2ee125b68ce00ec25a46f205904e7cdd8f83ca009c10cf29e8e9ab76e2d1',
          'brashnard.GMP': '31059d44ebf165c25bf1fd91f8ef00d5c5e3733d2d6177ca8e05956026650e13'}


def sha(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def evidence(name):
    p = ROOT / 'output' / name
    assert p.stat().st_size <= 1024 * 1024
    value = json.loads(p.read_text())
    assert value['qualified']
    for name, wanted in value['sourceSha256'].items():
        assert sha(ROOT / name) == wanted, name
    for name, wanted in value.get('dependencyEvidenceSha256', {}).items():
        assert sha(ROOT / name) == wanted, name
    return value


def main():
    assert sha(ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe') == PIN
    source = evidence('native-order-real-name-reservation-cases.json')
    writers = evidence('native-order-writers-emulated-observed.json')
    assert source['literalPayloadsMatched'] and writers['executableSha256'] == PIN
    assert source['allocationProfile'] == 'real-empty-name-v1'
    files = {}
    for report in source['reports']:
        assert report['filename'] in COPIES and report['filename'] not in files
        p = ROOT / 'output/checkpoint-unit-reference-browser' / report['filename']
        assert p.stat().st_size == report['fileBytes']
        assert sha(p) == report['sha256'] == COPIES[report['filename']]
        files[report['filename']] = p
    assert set(files) == set(COPIES)
    cases = list(source['cases'])
    assert len(cases) == 89
    for case in cases:
        assert case['normalizations'] == []
        with files[case['filename']].open('rb') as f:
            for bank in case['banks']:
                raw = struct.pack('<' + 'I' * len(bank['words']), *bank['words'])
                assert len(raw) == bank['payloadBytes'] <= 2048
                assert hashlib.sha256(raw).hexdigest() == bank['payloadSha256']
                f.seek(bank['sourceOffset'])
                assert f.read(len(raw)) == raw
    sample = next(r for r in writers['replays'] if r['kind'] == 1)
    cases.append({'banks': [{'words': [1, 1, 1, 1, *sample['words']]},
                           {'words': [1, 0]}, {'words': [1, 0]}],
                  'requests': [dict(role=role, bank=b, index=None, kind=None, bytes=n)
                               for b in range(3) for role, n in [('bank', 20), ('head', 12)]] +
                              [dict(role=role, bank=0, index=0, kind=1, bytes=n)
                               for role, n in [('order', 88), ('baseName', 1), ('node', 12)]],
                  'allocationRequestBytes': 197})
    # Copied profiles pass through without additions. The synthetic missing-kind
    # control has explicit names too; it is identified separately in the report.
    out = bytearray(b'NBO2' + struct.pack('<I', len(cases)))
    for case in cases:
        requests = case['requests']
        assert len(case['banks']) == 3 and 6 <= len(requests) <= 32
        assert sum(r['bytes'] for r in requests) == case['allocationRequestBytes'] <= 2048
        out += struct.pack('<I', len(requests))
        for r in requests:
            out += struct.pack('<5I', ROLES[r['role']], r['bank'],
                               0xffffffff if r['index'] is None else r['index'],
                               0 if r['kind'] is None else r['kind'], r['bytes'])
        for bank in case['banks']:
            assert 2 <= len(bank['words']) <= 512
            out += struct.pack('<I', len(bank['words']) * 4)
            out += struct.pack('<' + 'I' * len(bank['words']), *bank['words'])
    assert len(out) <= 128 * 1024
    # Keep NBO1 and its old evidence intact for historical qualification.
    path = ROOT / 'output/native-order-real-name-hook-fixtures.bin'
    path.write_bytes(out)
    report = {'scope': 'private compiled native bank hook fixture input',
              'copiedActors': 89, 'syntheticKindOneActors': 1, 'bytes': len(out),
              'format': 'NBO2', 'allocationProfile': source['allocationProfile'],
              'copiedDescriptorsPassedThrough': True,
              'fixtureSha256': hashlib.sha256(out).hexdigest(), 'executableSha256': PIN,
              'sourceSha256': {str(Path(__file__).relative_to(ROOT)): sha(Path(__file__))},
              'dependencyEvidenceSha256': {n: sha(ROOT / 'output' / n) for n in
                                          ['native-order-real-name-reservation-cases.json',
                                           'native-order-writers-emulated-observed.json']},
              'copiedFilesUnchanged': {n: sha(p) for n, p in files.items()},
              'nativeChecksExecuted': False, 'browserUsed': False}
    (ROOT / 'output/native-order-real-name-hook-fixtures-prepared.json').write_text(
        json.dumps(report, indent=2) + '\n')
    print(json.dumps({'cases': len(cases), 'bytes': len(out), 'copiedFilesUnchanged': True}))


if __name__ == '__main__':
    main()

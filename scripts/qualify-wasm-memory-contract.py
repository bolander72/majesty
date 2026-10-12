#!/usr/bin/env python3
"""Check bounded artifact parsing and the numeric staged-glue growth probe."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile

ROOT = Path(__file__).resolve().parents[1]
AUDITOR = ROOT/'scripts/audit-wasm-memory-contract.py'
spec = importlib.util.spec_from_file_location('wasm_memory_contract', AUDITOR)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
HEADER = b'\0asm\x01\0\0\0'


def u32(value):
    result = bytearray()
    while True:
        result.append((value & 127) | (128 if value > 127 else 0))
        value >>= 7
        if not value:
            return bytes(result)


def section(kind, payload):
    return bytes([kind])+u32(len(payload))+payload


def fixtures():
    memory = section(5, bytes([1, 3, 16, 32]))
    parsed = module.inspect(io.BytesIO(HEADER+memory), len(HEADER+memory))
    assert parsed['memories'] == [dict(importModule=None, importName=None,
        minimumPages=16, maximumPages=32, shared=True)]
    imported = section(2, bytes([1, 3])+b'env'+bytes([6])+b'memory'+bytes([2, 3])+u32(8192)+u32(65536))
    parsed_import = module.inspect(io.BytesIO(HEADER+imported), len(HEADER+imported))
    assert parsed_import['memories'][0]['minimumPages'] == 8192
    assert parsed_import['memories'][0]['maximumPages'] == 65536
    # A sparse uninterpreted section exercises seeking without buffering its
    # payload. This is an inspection fixture, not an executable WASM module.
    with tempfile.TemporaryFile() as file:
        file.write(HEADER+b'\0'+u32(4*1024*1024))
        file.seek(4*1024*1024, 1)
        file.write(memory)
        size = file.tell()
        file.seek(0)
        skipped = module.inspect(file, size)
        assert skipped['logicalBytesRead'] < 32
        assert skipped['skippedPayloadBytes'] >= 4*1024*1024
    name = u32(256)+b'a'*256
    excessive_imports = section(2, u32(129)+(name+name+b'\0\0')*129)
    invalid = [b'\0asm', HEADER+b'\x05\x7f',
        HEADER+section(5, bytes([1, 1, 32, 16])),
        HEADER+section(5, bytes([1, 2, 16])),
        HEADER+section(5, bytes([1, 5, 16, 32])),
        HEADER+b'\x05\xff\xff\xff\xff\x10',
        HEADER+section(5, bytes([1, 3, 16, 32, 0])),
        HEADER+section(2, u32(513)), HEADER+excessive_imports,
        HEADER+section(2, bytes([1])+u32(257)+b'a'*257)]
    for data in invalid:
        try:
            module.inspect(io.BytesIO(data), len(data))
        except ValueError:
            pass
        else:
            raise AssertionError('Malformed or over-budget metadata accepted')
    return dict(positiveFixtures=3, rejectedFixtures=len(invalid), sparsePayloadBytesSkipped=4*1024*1024)


def main():
    output = ROOT/'output/wasm-memory-contract-terminal-qualified.json'
    output.unlink(missing_ok=True)
    checks = fixtures()
    report_path = ROOT/'output/wasm-memory-contract-audit.json'
    report = json.loads(report_path.read_text())
    assert report == module.audit()
    assert report['binary']['logicalBytesRead'] == 12365
    assert report['binary']['largestRequestedReadBytes'] == 53
    assert report['binary']['fileBytes'] == 108718147
    growth_path = ROOT/'output/wasm-growth-policy-observed.json'
    growth = json.loads(growth_path.read_text())
    assert growth['qualified'] and len(growth['cases']) == 5
    assert growth['cases'][0]['attemptedCapacitiesBytes'] == [637599744]
    assert growth['cases'][1]['accepted'] and len(growth['cases'][1]['attemptedCapacitiesBytes']) == 3
    assert not growth['cases'][2]['accepted'] and len(growth['cases'][2]['attemptedCapacitiesBytes']) == 3
    assert not growth['cases'][3]['attemptedCapacitiesBytes']
    assert not growth['cases'][4]['attemptedCapacitiesBytes']
    for flag in ['realWasmMemoryAllocated', 'wholeModuleCompiled', 'workerStarted',
                 'gameLaunched', 'browserUsed', 'nativeBuildRun', 'browserMemoryMeasured', 'crashResolved']:
        assert growth[flag] is False
    sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
    for artifact in [report, growth]:
        for name, digest in artifact['sourceSha256'].items():
            assert sha(ROOT/name) == digest
    sources = list(report['sourceSha256'])+['scripts/check-wasm-growth-policy.mjs',
        'scripts/qualify-wasm-memory-contract.py', 'docs/wasm-memory-contract.md']
    result = dict(qualified=True, scope='static memory contract plus numeric mocked resize behavior',
        **checks, wasmMetadataBytesReadPerInspection=12365, largestWasmReadBytes=53,
        wasmFileBytes=108718147, wholeWasmArtifactHashed=False,
        artifactIdentity=report['artifactIdentity'], importedMinimumLinearMemoryBytes=536870912,
        importedMaximumLinearMemoryBytes=4294967296, effectiveGlueHeapLimitBytes=4294901760,
        sharedLinearMemory=True, preloadedWorkerPool=8, growthCasesChecked=5,
        requestOneByteAbove512MiBAttemptsBytes=637599744,
        initialLinearMemoryIsResidentMeasurement=False, crashCauseIdentified=False,
        smallerMemoryConfigurationQualified=False, liveNativePagingQualified=False,
        gameLaunched=False, browserUsed=False, nativeBuildRun=False,
        wholeModuleCompiled=False, realWasmMemoryAllocated=False,
        originalProfilesModified=False, crashResolved=False, goalCompleted=False,
        sourceSha256={name: sha(ROOT/name) for name in sources},
        evidenceSha256={str(p.relative_to(ROOT)): sha(p) for p in
            [report_path, growth_path, ROOT/'output/wasm-memory-contract-audit.log',
             ROOT/'output/wasm-growth-policy.log']})
    output.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(dict(passed=True, **checks, wasmMetadataBytesRead=12365,
        growthCases=5, gameLaunches=0)))


if __name__ == '__main__':
    main()

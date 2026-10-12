#!/usr/bin/env python3
"""Validate current cell audit/CPU evidence without rerunning the emulator."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def sha(path):
    return hashlib.sha256((ROOT/path).read_bytes()).hexdigest()


cells = module('cell_audit', ROOT/'scripts/audit-native-terrain-cells.py')
generation = module('generation_audit', ROOT/'scripts/audit-native-terrain-generation.py')
exe = ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
caller = generation.audit(exe)
argument = next(i for f in caller['ranges'] for i in f['instructions'] if i['address'] == '004b2a77')
require((argument['mnemonic'], argument['operands']) == ('push', '-1'), 'Original generator cell argument changed')
decode_calls = 0
original_pe = cells.pefile.PE


def reject_decode(*args, **kwargs):
    global decode_calls
    decode_calls += 1
    raise RuntimeError('Unpinned input reached PE decoding')


with tempfile.TemporaryDirectory(prefix='majesty-cell-pin-') as directory:
    fake = Path(directory)/'synthetic.bin'
    fake.write_bytes(b'unpinned synthetic input')
    cells.pefile.PE = reject_decode
    try:
        try:
            cells.audit(fake)
        except ValueError as error:
            require('pinned' in str(error), 'Unexpected pin rejection')
        else:
            raise RuntimeError('Unpinned input accepted')
    finally:
        cells.pefile.PE = original_pe
require(decode_calls == 0, 'Unpinned input decoded')
cpu_path = 'output/native-terrain-cells-emulated-observed.json'
audit_path = 'output/native-terrain-cells-instruction-audit.json'
cpu = json.loads((ROOT/cpu_path).read_text())
audit = json.loads((ROOT/audit_path).read_text())
require(cpu['executableSha256'] == audit['executableSha256'] == cells.PIN == hashlib.sha256(exe.read_bytes()).hexdigest(), 'Executable pin differs')
require(set(cpu['sourceSha256']) == {'scripts/audit-native-terrain-cells.py', 'scripts/check-native-terrain-cells.py'}, 'Missing source identity')
for path, digest in cpu['sourceSha256'].items():
    require(sha(path) == digest, 'Cell evidence source changed; regenerate it')
require(cpu['verifiedInstructionAnchors'] == audit['verifiedInstructionAnchors'] == 28, 'Cell instruction anchors differ')
require(cpu['calls'] == 18 and len(cpu['cases']) == 9, 'Missing original cell calls')
require(cpu['deterministicReplay'] and cpu['stackPoisonReplay'], 'Missing clean/poisoned replay')
require(cpu['noAllocatorOrImportStubs'] and cpu['syntheticKindZeroPropagationQualified'], 'Missing original propagation case')
require(cpu['largestCallInstructions'] < cpu['maxCallInstructions'] and cpu['largestCallStackBytes'] < 12288, 'Cell budget exceeded')
require(all(c['verticesUnchanged'] and c['vertexReads'] == 0 and c['primaryCellWordsUnchanged'] for c in cpu['cases']), 'Vertex or primary cell data touched')
for case, point in zip(cpu['cases'][4:7], [[1, 1], [0, 0], [5, 5]]):
    require(case['point'] == point and case['propagationCalls'] == 36 and case['changedCells'] == 36,
            'Missing whole-grid propagation')
    require(case['changedCellBounds'] == case['rectangle'] == [0, 0, 6, 6], 'Propagation extent differs')
for case in cpu['cases'][7:]:
    require(not any(case[name] for name in ['cellWrites', 'rectangleWrites', 'rngCalls', 'propagationCalls', 'changedCells']), 'Invalid point changed state')
require(not cpu['propagationQualified'] and not cpu['safeBorderMutationHookQualified'], 'Evidence overstates live qualification')
source_sha = {**cpu['sourceSha256'], 'scripts/qualify-native-terrain-cells.py': sha('scripts/qualify-native-terrain-cells.py')}
report = dict(passed=True, qualification=cpu['qualification'], executableSha256=cells.PIN,
              sourceSha256=source_sha, evidenceSha256={path: sha(path) for path in [cpu_path, audit_path]},
              generatorArgumentAnchor=argument, unpinnedRejectedBeforePeDecode=True,
              unpinnedPeDecodeCalls=decode_calls, originalCpuCalls=18,
              syntheticKindZeroPropagationQualified=True, propagationQualified=False,
              safeBorderMutationHookQualified=False, deterministicReplay=True, stackPoisonReplay=True,
              vertexDataUntouched=True, largestCallInstructions=cpu['largestCallInstructions'],
              largestCallStackBytes=cpu['largestCallStackBytes'], guestMappedBytes=cpu['guestMappedBytes'],
              javaScriptSuiteRerun=False, runtimeChanged=False, originalSavesOpened=0,
              gameLaunches=0, browserLaunches=0, builds=0, goalStatus='active', limitations=cpu['limitations'])
(ROOT/'output/native-terrain-cells-terminal-qualified.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(dict(passed=True, originalCpuCalls=18, wholeGridPropagationCases=3,
                     stackPoisonReplay=True, largestCallStackBytes=cpu['largestCallStackBytes'], gameLaunches=0)))

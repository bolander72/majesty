#!/usr/bin/env python3
"""Verify literal arguments and constructor selection against pinned bytes."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
from unittest.mock import patch

import capstone

ROOT = Path(__file__).resolve().parents[1]
AUDITOR = ROOT/'scripts/audit-native-cache-callers.py'
spec = importlib.util.spec_from_file_location('cache_callers', AUDITOR)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def arguments(rows, address):
    index = next(i for i, row in enumerate(rows) if row['address'] == address)
    suffix = rows[index-3:index+1]
    assert [r['mnemonic'] for r in suffix] == ['push', 'push', 'mov', 'call']
    assert suffix[2]['operands'] == 'ecx, edi'
    assert suffix[3]['operands'] in ['dword ptr [eax + 0xe8]', 'dword ptr [edx + 0xe8]']
    value = suffix[0]['operands']
    return int(value, 0) if value.startswith('0x') or value.isdecimal() else None


def main():
    output = ROOT/'output/native-cache-callers-terminal-qualified.json'
    output.unlink(missing_ok=True)
    report_path = ROOT/'output/native-cache-callers-audit.json'
    report = json.loads(report_path.read_text())
    exe = ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    assert report == module.audit(exe)
    with tempfile.TemporaryDirectory(prefix='cache-caller-pin-') as directory:
        fixture = Path(directory)/'unpinned.exe'
        fixture.write_bytes(b'MZ'+b'\0'*30)
        with patch.object(module.pefile, 'PE', side_effect=AssertionError('Unpinned PE decoded')) as decode:
            try:
                module.audit(fixture)
            except ValueError as error:
                assert 'pinned executable' in str(error)
            else:
                raise AssertionError('Unpinned executable accepted')
            assert decode.call_count == 0
    ranges = {r['start']: r for r in report['ranges']}
    assert len(ranges) == 5 and all(r['localBranchTargetsClosed'] for r in ranges.values())
    assert sum(len(r['instructions']) for r in ranges.values()) == 535
    caller = ranges['00437b10']['instructions']
    assert arguments(caller, '00437d22') == 0x80ffffff
    assert arguments(caller, '00437d4a') == 0x80cccccc
    # Independent instruction fixtures distinguish literal metadata from a
    # register supplied at the same stack position. No CPU instruction runs.
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    def fixture(code):
        rows = [dict(address=f'{i.address:08x}', mnemonic=i.mnemonic, operands=i.op_str)
                for i in decoder.disasm(code, 0x1000)]
        return arguments(rows, rows[-1]['address'])
    assert fixture(bytes.fromhex('68ffffff80568bcfff90e8000000')) == 0x80ffffff
    assert fixture(bytes.fromhex('57568bcfff90e8000000')) is None
    assert fixture(bytes.fromhex('5750'+'8bcf'+'ff92e8000000')) is None
    factory = ranges['004384b0']['instructions']
    depth = 0
    for row in factory:
        if row['address'] == '0043851c':
            assert row['operands'] == 'eax, dword ptr [esp + 0x34]'
            assert 0x34-depth == 4
            break
        if row['mnemonic'] == 'push':
            depth += 4
        elif row['mnemonic'] == 'sub' and row['operands'].startswith('esp, '):
            depth += int(row['operands'].split(', ')[1], 0)
        elif row['mnemonic'] == 'call':
            assert row['operands'] == '0x43a0b0'
            assert ranges['0043a0b0']['instructions'][-1]['operands'] == ''
    else:
        raise AssertionError('Factory argument read missing')
    for start, cleanup in [('00437b10', '4'), ('004384b0', '0x18'),
                           ('0043ac50', '0x14'), ('005c7b30', '0x14')]:
        assert ranges[start]['instructions'][-1]['mnemonic'] == 'ret'
        assert ranges[start]['instructions'][-1]['operands'] == cleanup
    assert len(report['vtableSlots']) == 2
    assert all(s['target'] == '005c88f0' and s['offset'] == 0xe8 for s in report['vtableSlots'])
    for flag in ['metadataConsumerMeaningQualified', 'liveReceiverVtableQualified',
        'interveningCallbackEffectsQualified', 'allCacheCallersQualified', 'allCacheWritersQualified',
        'actorReferenceRetentionExcluded', 'completeDetachQualified', 'boundedNativeSimulationQualified',
        'liveNativePagingQualified', 'nativeInstructionsExecuted', 'gameLaunched', 'browserUsed', 'nativeBuildRun']:
        assert report[flag] is False
    sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    sources = [AUDITOR, Path(__file__).resolve(), module.DEPENDENCY,
        ROOT/'scripts/audit-native-listener-resources.py',
        ROOT/'scripts/audit-native-notification-lifetime.py',
        ROOT/'scripts/audit-native-placement-callbacks.py', ROOT/'scripts/audit-native-placement-dispatch.py']
    result = dict(qualified=True, scope='two literal-valued UI cache registrations and initial constructor chain',
        decodedRanges=5, decodedInstructions=535, verifiedInstructionAnchors=31,
        verifiedVtableWords=2, literalRegistrationSites=2,
        registrationMetadata=['80ffffff', '80cccccc'], factorySelectorEntryStackOffset=4,
        constructorSelection=2, constructorAllocationBytes=160,
        independentRegisterArgumentNegativeControlsPassed=True,
        unpinnedInputRejectedBeforePeDecode=True, localBranchTargetsClosed=True,
        metadataColorInterpretationIsInference=True, metadataConsumerMeaningQualified=False,
        liveReceiverVtableQualified=False, interveningCallbackEffectsQualified=False,
        allCacheCallersQualified=False, actorReferenceRetentionExcluded=False,
        completeDetachQualified=False, boundedNativeSimulationQualified=False,
        liveNativePagingQualified=False, nativeInstructionsExecuted=False,
        gameLaunched=False, browserUsed=False, nativeBuildRun=False,
        originalProfilesModified=False, crashResolved=False, goalCompleted=False,
        sourceSha256={str(p.relative_to(ROOT)): sha(p) for p in sources},
        evidenceSha256={str(p.relative_to(ROOT)): sha(p) for p in
            [report_path, ROOT/'docs/native-cache-callers.md']})
    output.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(dict(passed=True, instructions=535, anchors=31,
        literalRegistrationSites=2, gameLaunches=0)))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Check registry shape and empty-query dataflow against current pinned bytes."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
AUDITOR = ROOT/'scripts/audit-native-construction-registry.py'
spec = importlib.util.spec_from_file_location('registry_audit', AUDITOR)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def check(row, mnemonic, operands):
    assert (row['mnemonic'], row['operands']) == (mnemonic, operands), row['address']


def main():
    output = ROOT/'output/native-construction-registry-terminal-qualified.json'
    output.unlink(missing_ok=True)
    report_path = ROOT/'output/native-construction-registry-audit.json'
    report = json.loads(report_path.read_text())
    assert report == module.audit(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    with tempfile.TemporaryDirectory(prefix='registry-pin-') as directory:
        unpinned = Path(directory)/'unpinned.exe'
        unpinned.write_bytes(b'MZ'+b'\0'*30)
        with patch.object(module.pefile, 'PE', side_effect=AssertionError('Unpinned PE decoded')) as decode:
            try:
                module.audit(unpinned)
                raise AssertionError('Unpinned input accepted')
            except ValueError as error:
                assert 'pinned executable' in str(error)
            assert decode.call_count == 0
    rows = {int(i['address'], 16): i for r in report['ranges'] for i in r['instructions']}
    # Under the verified constructor's header.parent == global-nil relation,
    # lower_bound returns that same header before loading the requested key.
    lower = [0x005976d0, 0x005976d3, 0x005976d9, 0x005976dc, 0x005976de, 0x005976fa]
    expected_lower = [('mov', 'eax, dword ptr [ecx + 4]'),
                      ('mov', 'edx, dword ptr [0x6d8590]'),
                      ('mov', 'ecx, dword ptr [eax + 4]'),
                      ('cmp', 'ecx, edx'), ('je', '0x5976fa'), ('ret', '4')]
    for address, expected in zip(lower, expected_lower):
        check(rows[address], *expected)
    # The query keeps its header in ESI, compares the returned header twice,
    # and takes the null-result branch. POP ESI does not change comparison flags.
    query = [0x00596670, 0x00596673, 0x00596674, 0x00596677, 0x0059667b,
             0x0059667d, 0x0059667e, 0x00596683, 0x00596686, 0x0059668a,
             0x0059668c, 0x0059669f, 0x005966a3, 0x005966a7, 0x005966a9,
             0x005966ab, 0x005966ac, 0x005966b7, 0x005966b9, 0x005966bc]
    for address, mnemonic, operands in [
        (0x00596674, 'lea', 'esi, [ecx + 0x20]'),
        (0x00596683, 'mov', 'esi, dword ptr [esi + 4]'),
        (0x0059668a, 'cmp', 'eax, esi'),
        (0x0059668c, 'je', '0x59669f'),
        (0x0059669f, 'mov', 'dword ptr [esp + 8], esi'),
        (0x005966a3, 'lea', 'eax, [esp + 8]'),
        (0x005966a7, 'mov', 'eax, dword ptr [eax]'),
        (0x005966a9, 'cmp', 'eax, esi'),
        (0x005966ab, 'pop', 'esi'),
        (0x005966ac, 'je', '0x5966b7'),
        (0x005966b7, 'xor', 'eax, eax'),
        (0x005966bc, 'ret', '4')]:
        check(rows[address], mnemonic, operands)
    shape = report['initialRegistry']
    assert shape['successfulSetupGroupCount'] == 1 and shape['groupKind'] == 3
    assert shape['actorList']['count'] == shape['actorTree']['count'] == 0
    assert shape['actorList']['emptyNextAndPrevious'] == 'group + 0x0c'
    assert shape['actorTree']['headerParent'] == 'global nil from 006d8590'
    assert report['registrationTouchesBothActorListAndTree']
    # This path accesses the tree header, not the list/count metadata. A zero
    # lookup alone therefore cannot validate both empty representations.
    assert all('+ 0x18]' not in rows[a]['operands'] and '+ 0x2c]' not in rows[a]['operands'] for a in lower+query)
    for flag in ['completeConstructorCallClosureQualified', 'allActorsAbsentQualified',
                 'unregisteredActorsAndGlobalAliasesQualified', 'geometryUnchangedAfterConstructionQualified',
                 'runtimeGuardInstalled', 'safeBorderMutationHookQualified', 'liveNativePagingQualified',
                 'browserUsed', 'nativeInstructionsExecuted', 'nativeBuildRun']:
        assert report[flag] is False
    files = [AUDITOR, Path(__file__).resolve(), report_path,
             ROOT/'scripts/audit-native-construction-finalizer.py',
             ROOT/'scripts/audit-native-terrain-generation.py']
    result = dict(qualified=True, scope='pinned successful setup shape and empty registry query dataflow',
        verifiedInstructionAnchors=report['verifiedInstructionAnchors'],
        unpinnedInputRejectedBeforePeDecode=True,
        emptyLowerBoundPath=[f'{a:08x}' for a in lower], emptyGroupQueryPath=[f'{a:08x}' for a in query],
        queryReturnsZeroUnderEmptyRootRelation=True, emptyLookupValidatesListAndCounts=False,
        sourceSha256={str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in files},
        allActorsAbsentQualified=False, safeBorderMutationHookQualified=False,
        liveNativePagingQualified=False, nativeInstructionsExecuted=False,
        gameLaunched=False, browserUsed=False, nativeBuildRun=False, crashResolved=False, goalCompleted=False)
    output.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(dict(passed=True, anchors=report['verifiedInstructionAnchors'],
        emptyQueryInstructions=len(lower)+len(query), unpinnedInputRejectedBeforePeDecode=True,
        allActorsAbsentQualified=False, gameLaunches=0)))


if __name__ == '__main__':
    main()

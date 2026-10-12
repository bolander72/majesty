#!/usr/bin/env python3
"""Qualify local callback inventory, without promoting it to call-graph closure."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
AUDITOR = ROOT/'scripts/audit-native-placement-callbacks.py'
spec = importlib.util.spec_from_file_location('callback_audit', AUDITOR)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def check_flow_boundaries():
    def row(at, mnemonic, operand=''):
        return dict(address=f'{at:08x}', mnemonic=mnemonic, operands=operand)
    fixture = [row(0x1000, 'jne', '0x1000'), row(0x1002, 'call', '0x9000'),
        row(0x1007, 'call', 'dword ptr [eax + 8]'), row(0x100a, 'ret')]
    inventory = module.inspect_flow(fixture)
    assert inventory['localBranchTargetsClosed']
    assert inventory['calls'] == [
        dict(address='00001002', operands='0x9000', direct=True, target='00009000'),
        dict(address='00001007', operands='dword ptr [eax + 8]', direct=False, target=None)]
    # A complete local branch inventory deliberately permits unknown callees.
    # Reject an escaping tail jump, a jump into the middle of an instruction,
    # an unresolved indirect jump, and a missing terminal return.
    invalid = [
        [row(0x1000, 'jmp', '0x9000'), row(0x1005, 'ret')],
        [row(0x1000, 'je', '0x1001'), row(0x1002, 'ret')],
        [row(0x1000, 'jmp', 'eax'), row(0x1002, 'ret')],
        [row(0x1000, 'nop')],
    ]
    for fixture in invalid:
        try:
            module.inspect_flow(fixture)
        except ValueError:
            continue
        raise AssertionError('Incomplete local flow accepted')
    return 5


def main():
    output = ROOT/'output/native-placement-callbacks-terminal-qualified.json'
    output.unlink(missing_ok=True)
    report_path = ROOT/'output/native-placement-callbacks-audit.json'
    report = json.loads(report_path.read_text())
    assert report == module.audit(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    with tempfile.TemporaryDirectory(prefix='callback-pin-') as directory:
        fixture = Path(directory)/'unpinned.exe'
        fixture.write_bytes(b'MZ'+b'\0'*30)
        with patch.object(module.pefile, 'PE', side_effect=AssertionError('Unpinned input decoded')) as decode:
            try:
                module.audit(fixture)
            except ValueError as error:
                assert 'pinned executable' in str(error)
            else:
                raise AssertionError('Unpinned input accepted')
            assert decode.call_count == 0
    flow_checks = check_flow_boundaries()
    ranges = {r['start']: r for r in report['ranges']}
    assert len(ranges) == 17
    assert all(r['localBranchTargetsClosed'] for r in ranges.values())
    for start in report['callFreeRanges']:
        assert not ranges[start]['calls']
    def direct_targets(start):
        return {c['target'] for c in ranges[start]['calls'] if c['direct']}
    for recursive in report['hierarchyDependencies']['recursiveMethods']:
        assert recursive in direct_targets(recursive)
    assert '005ad7a0' in direct_targets('005a22c0')
    assert '005b8630' in direct_targets('005ad3e0')
    assert '005b88a0' in direct_targets('005ad400')
    assert '005a10d0' in direct_targets('005ad420') & direct_targets('005ad5b0')
    notify = report['globalNotification']
    assert notify['actorPassedAsArgument'] and notify['targetResolved'] is False
    assert notify['managerPointerOffset'] == 0x1c and notify['managerVirtualSlot'] == 8
    assert ranges['005b3550']['calls'] == [dict(address='005b3561',
        operands='dword ptr [edx + 8]', direct=False, target=None)]
    assert len(report['supplementalVtableSlots']) == 30
    tables = {s['table'] for s in report['supplementalVtableSlots']}
    assert len(tables) == 5
    assert report['directDependenciesOutsideRanges'] and report['indirectCallSites']
    for flag in ['fullCallbackCallClosureQualified', 'globalManagerLifetimeQualified',
                 'allLaterGeometryEditsExcluded', 'safeBorderMutationHookQualified',
                 'liveNativePagingQualified', 'nativeInstructionsExecuted', 'browserUsed', 'nativeBuildRun']:
        assert report[flag] is False
    sources = [AUDITOR, Path(__file__).resolve(), module.DISPATCH_PATH, report_path]
    result = dict(qualified=True, scope='pinned local callback instructions, branches and initial table targets only',
        verifiedInstructionAnchors=report['verifiedInstructionAnchors'], decodedRanges=17,
        decodedInstructions=sum(len(r['instructions']) for r in ranges.values()),
        inventoriedCallSites=sum(len(r['calls']) for r in ranges.values()),
        supplementalVtableSlots=30, flowInventorySyntheticChecks=flow_checks,
        unpinnedInputRejectedBeforePeDecode=True,
        sourceSha256={str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sources},
        fullCallbackCallClosureQualified=False, globalManagerLifetimeQualified=False,
        allLaterGeometryEditsExcluded=False, safeBorderMutationHookQualified=False,
        liveNativePagingQualified=False, nativeInstructionsExecuted=False,
        gameLaunched=False, browserUsed=False, nativeBuildRun=False, crashResolved=False, goalCompleted=False)
    output.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(dict(passed=True, anchors=result['verifiedInstructionAnchors'],
        decodedInstructions=result['decodedInstructions'], inventoriedCallSites=result['inventoriedCallSites'],
        flowInventoryChecks=flow_checks, globalManagerLifetimeQualified=False, gameLaunches=0)))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Qualify pinned dispatcher/base-listener paths, without claiming live release."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
from unittest.mock import patch

import capstone

ROOT = Path(__file__).resolve().parents[1]
AUDITOR = ROOT/'scripts/audit-native-notification-lifetime.py'
spec = importlib.util.spec_from_file_location('notification_audit', AUDITOR)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def memory_writes(instructions):
    """Inspect explicit instruction destinations; called-method effects excluded."""
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    decoder.detail = True
    writes = []
    for row in instructions:
        decoded = list(decoder.disasm(bytes.fromhex(row['bytes']), int(row['address'], 16)))
        assert len(decoded) == 1
        for operand in decoded[0].operands:
            if operand.type == capstone.x86.X86_OP_MEM and operand.access & capstone.CS_AC_WRITE:
                writes.append(row['address'])
    return writes


def main():
    output = ROOT/'output/native-notification-lifetime-terminal-qualified.json'
    output.unlink(missing_ok=True)
    report_path = ROOT/'output/native-notification-lifetime-audit.json'
    report = json.loads(report_path.read_text())
    assert report == module.audit(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    with tempfile.TemporaryDirectory(prefix='notification-pin-') as directory:
        fixture = Path(directory)/'unpinned.exe'
        fixture.write_bytes(b'MZ'+b'\0'*30)
        with patch.object(module.pefile, 'PE', side_effect=AssertionError('Unpinned PE decoded')) as decode:
            try:
                module.audit(fixture)
            except ValueError as error:
                assert 'pinned executable' in str(error)
            else:
                raise AssertionError('Unpinned input accepted')
            assert decode.call_count == 0
    ranges = {r['start']: r for r in report['ranges']}
    write_fixture = [dict(address='00001000', bytes='8908'),
        dict(address='00001002', bytes='8b08'), dict(address='00001004', bytes='50')]
    assert memory_writes(write_fixture) == ['00001000']
    assert len(ranges) == 26
    tail = ranges['004bdc30']
    assert tail['qualifiedTailDependency'] == '00597980'
    assert not tail['localBranchTargetsClosed'] and tail['instructions'][-1]['mnemonic'] == 'jmp'
    assert all(r['localBranchTargetsClosed'] for r in ranges.values() if r is not tail)
    for start in ['005c33d0', '005c3430']:
        assert memory_writes(ranges[start]['instructions']) == []
        assert len(ranges[start]['calls']) == 1 and not ranges[start]['calls'][0]['direct']
    registration_calls = ranges['005c3650']['calls']
    assert len(registration_calls) == 1 and registration_calls[0]['target'] == '0064c616'
    assert all(b['target'] > b['address'] for b in ranges['005c3650']['localBranches'])
    # The comparison searches for the listener pointer; once found, node unlink,
    # free and count decrement flow straight into the remainder of destruction.
    listener = {r['address']: r for r in ranges['005c2760']['instructions']}
    assert listener['005c2816']['operands'] == 'dword ptr [eax + 8], esi'
    assert listener['005c2819']['operands'] == '0x5c2827'
    assert listener['005c2859']['operands'] == 'dword ptr [edi + 8], eax'
    matching_remove = [r for r in ranges['005c2760']['instructions']
        if '005c2827' <= r['address'] <= '005c2859']
    assert not any(r['mnemonic'].startswith('j') for r in matching_remove)
    assert ranges['005c3190']['instructions'][-1]['mnemonic'] == 'ret'
    assert report['registration']['checksExistingMembership'] is False
    assert report['destruction']['genericDetachByListRemovalQualified'] is False
    variants = report['derivedListenerInitialTargets']
    assert len(variants) == 3
    for variant in variants:
        assert any(c['target'] == '005c2630' for c in ranges[variant['constructor']]['calls'])
    noop_targets = {'005c2b60', '005c2b70'}
    for target in noop_targets:
        assert len(ranges[target]['instructions']) == 1
        assert ranges[target]['instructions'][0]['mnemonic'] == 'ret'
        assert ranges[target]['instructions'][0]['operands'] == '8'
    overrides = {v[k] for v in variants for k in ['slot20', 'slot24']} - noop_targets
    assert overrides == {'005c49d0', '005c4ab0', '005c85d0', '005c8620'}
    assert not overrides & ranges.keys()
    for flag in ['liveDispatcherIdentityQualified', 'derivedNotificationBodiesQualified',
                 'fullListenerDestructionClosureQualified', 'globalManagerLifetimeQualified',
                 'actorReferenceRetentionExcluded', 'boundedNativeSimulationQualified',
                 'allLaterGeometryEditsExcluded', 'safeBorderMutationHookQualified',
                 'liveNativePagingQualified', 'nativeInstructionsExecuted', 'browserUsed', 'nativeBuildRun']:
        assert report[flag] is False
    sources = [AUDITOR, Path(__file__).resolve(), module.DEPENDENCY,
        ROOT/'scripts/audit-native-placement-dispatch.py', report_path]
    result = dict(qualified=True, scope='pinned constructor dispatcher and base listener ownership paths only',
        verifiedInstructionAnchors=report['verifiedInstructionAnchors'], decodedRanges=len(ranges),
        decodedInstructions=sum(len(r['instructions']) for r in ranges.values()),
        vtableSlots=len(report['vtableSlots']), constructorVariants=len(variants),
        explicitBroadcastMemoryDestinations=0, implicitStackWritesExcludedFromInventory=True,
        explicitMemoryDestinationClassifierChecked=True, unpinnedInputRejectedBeforePeDecode=True,
        duplicateMembershipPrevented=False, scopedListenerDetachQualified=False,
        derivedNotificationBodiesQualified=False, globalManagerLifetimeQualified=False,
        actorReferenceRetentionExcluded=False, boundedNativeSimulationQualified=False,
        liveNativePagingQualified=False, gameLaunched=False, nativeInstructionsExecuted=False,
        browserUsed=False, nativeBuildRun=False, crashResolved=False, goalCompleted=False,
        sourceSha256={str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sources})
    output.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(dict(passed=True, anchors=result['verifiedInstructionAnchors'],
        instructions=result['decodedInstructions'], slots=result['vtableSlots'],
        constructorVariants=len(variants), liveActorRetentionExcluded=False, gameLaunches=0)))


if __name__ == '__main__':
    main()

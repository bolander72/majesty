#!/usr/bin/env python3
"""Qualify local rectangle ownership evidence; live/native paging stays open."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
from unittest.mock import patch

import capstone

ROOT = Path(__file__).resolve().parents[1]
AUDITOR = ROOT/'scripts/audit-native-listener-rectangles.py'
spec = importlib.util.spec_from_file_location('rectangle_audit', AUDITOR)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def destination_bases(rows):
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    decoder.detail = True
    destinations = []
    for row in rows:
        decoded = list(decoder.disasm(bytes.fromhex(row['bytes']), int(row['address'], 16)))
        assert len(decoded) == 1
        for operand in decoded[0].operands:
            if operand.type == capstone.x86.X86_OP_MEM and operand.access & capstone.CS_AC_WRITE:
                destinations.append(dict(address=row['address'], base=decoded[0].reg_name(operand.mem.base),
                    index=decoded[0].reg_name(operand.mem.index), displacement=operand.mem.disp))
    return destinations


def main():
    output = ROOT/'output/native-listener-rectangles-terminal-qualified.json'
    output.unlink(missing_ok=True)
    report_path = ROOT/'output/native-listener-rectangles-audit.json'
    report = json.loads(report_path.read_text())
    assert report == module.audit(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    with tempfile.TemporaryDirectory(prefix='rectangle-pin-') as directory:
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
    fixtures = [dict(address='00001000', bytes='896c2410'),
        dict(address='00001004', bytes='8908'), dict(address='00001006', bytes='8b08')]
    assert destination_bases(fixtures) == [
        dict(address='00001000', base='esp', index=None, displacement=16),
        dict(address='00001004', base='eax', index=None, displacement=0)]
    ranges = {r['start']: r for r in report['ranges']}
    assert len(ranges) == 14 and all(r['localBranchTargetsClosed'] for r in ranges.values())
    callback_entries = ['005c49d0', '005c4ab0', '005c85d0', '005c8620']
    destination_inventory = {start: destination_bases(ranges[start]['instructions']) for start in callback_entries}
    assert all(w['base'] == 'esp' and w['index'] is None
        for destinations in destination_inventory.values() for w in destinations)
    assert destination_inventory['005c49d0'] and destination_inventory['005c4ab0']
    assert not destination_inventory['005c85d0'] and not destination_inventory['005c8620']
    assert len(ranges['005c8620']['instructions']) == 1 and not ranges['005c8620']['calls']
    assert report['drawingBufferConstructor']['allocatedBytesPerBuffer'] == 50*16
    assert report['drawingBufferConstructor']['totalRectanglePayloadBytes'] == 2*50*16
    collector = ranges['00505860']
    assert '00505860' in {c['target'] for c in collector['calls']}
    assert '00505db0' in {c['target'] for c in collector['calls']}
    assert '00505db0' in report['directDependenciesOutsideRanges']
    rows = {i['address']: i for i in collector['instructions']}
    assert rows['00505911']['mnemonic'] == 'cmp'
    assert rows['00505914']['mnemonic'] == 'jne'
    assert rows['00505916']['operands'] == 'dword ptr [ebp + eax*4 + 0x34], 1'
    for flag in ['fullNotificationCallClosureQualified', 'liveCollectorInputInvariantsQualified',
                 'actorReferenceRetentionExcluded', 'allLaterGeometryEditsExcluded',
                 'safeBorderMutationHookQualified', 'boundedNativeSimulationQualified',
                 'liveNativePagingQualified', 'nativeInstructionsExecuted', 'browserUsed', 'nativeBuildRun']:
        assert report[flag] is False
    sources = [AUDITOR, Path(__file__).resolve(), module.DEPENDENCY, module.FLOW_SOURCE,
        ROOT/'scripts/audit-native-placement-dispatch.py', report_path]
    result = dict(qualified=True, scope='pinned local rectangle copies and constructor payload size only',
        verifiedInstructionAnchors=report['verifiedInstructionAnchors'], decodedRanges=14,
        decodedInstructions=sum(len(r['instructions']) for r in ranges.values()),
        callbackExplicitDestinations=destination_inventory, explicitDestinationClassifierChecked=True,
        implicitStackWritesAndCalleeEffectsExcluded=True,
        constructorRectanglePayloadBytes=1600, unpinnedInputRejectedBeforePeDecode=True,
        fullNotificationCallClosureQualified=False, liveCollectorBoundsQualified=False,
        actorReferenceRetentionExcluded=False, allLaterGeometryEditsExcluded=False,
        boundedNativeSimulationQualified=False, liveNativePagingQualified=False,
        nativeInstructionsExecuted=False, gameLaunched=False, browserUsed=False,
        nativeBuildRun=False, crashResolved=False, goalCompleted=False,
        sourceSha256={str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sources})
    output.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(dict(passed=True, anchors=result['verifiedInstructionAnchors'],
        instructions=result['decodedInstructions'], callbackDirectDestinations='stack only',
        constructorRectanglePayloadBytes=1600, liveCollectorBoundsQualified=False, gameLaunches=0)))


if __name__ == '__main__':
    main()

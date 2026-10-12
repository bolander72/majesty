#!/usr/bin/env python3
"""Qualify local listener resource evidence; no original CPU execution."""
import copy
import hashlib
import json
from pathlib import Path
import tempfile
from unittest.mock import patch

import capstone

import importlib.util

ROOT = Path(__file__).resolve().parents[1]
AUDITOR = ROOT/'scripts/audit-native-listener-resources.py'
spec = importlib.util.spec_from_file_location('listener_resources', AUDITOR)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def writes(rows):
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    decoder.detail = True
    result = []
    for row in rows:
        decoded = list(decoder.disasm(bytes.fromhex(row['bytes']), int(row['address'], 16)))
        assert len(decoded) == 1
        if any(op.type == capstone.x86.X86_OP_MEM and op.access & capstone.CS_AC_WRITE
               for op in decoded[0].operands):
            result.append(row['address'])
    return result


def main():
    output = ROOT/'output/native-listener-resources-terminal-qualified.json'
    output.unlink(missing_ok=True)
    report_path = ROOT/'output/native-listener-resources-audit.json'
    report = json.loads(report_path.read_text())
    exe = ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    assert report == module.audit(exe)
    assert hashlib.sha256(exe.read_bytes()).hexdigest() == module.PIN
    with tempfile.TemporaryDirectory(prefix='listener-resource-pin-') as directory:
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
    assert len(ranges) == 13 and all(r['localBranchTargetsClosed'] for r in ranges.values())
    instruction_count = sum(len(r['instructions']) for r in ranges.values())
    assert instruction_count == 374
    assert len(report['vtableSlots']) == 4 and len(report['indirectCallSites']) == 9
    assert report['directDependenciesOutsideRanges'] == ['0050aa20', '005c2760', '005f0630', '00645bc0', '0064c616', '0064d4b6']
    assert writes([dict(address='00001000', bytes='8908'), dict(address='00001002', bytes='8b08'),
        dict(address='00001004', bytes='50'), dict(address='00001005', bytes='8d4808')]) == ['00001000']
    assert writes(ranges['00505490']['instructions']) == ['005054a9']
    drawing = report['drawingCleanup']
    assert drawing['pointerOffsets'] == [0x3c, 0x40] and drawing['iterations'] == 2
    assert drawing['pointerFieldsCleared'] and not drawing['rectangleCountsResetByThisBody']
    for start, body in [('005c3ae0', '005c3b00'), ('005c4220', '005c4570'), ('005c7c20', '005c7c40')]:
        part = ranges[start]
        assert [c['target'] for c in part['calls']] == [body, '00645bc0']
        assert part['instructions'][-1]['operands'] == '4'
        assert any(i['mnemonic'] == 'test' and i['operands'] == 'byte ptr [esp + 8], 1' for i in part['instructions'])
    for body in ['005c3b00', '005c4570', '005c7c40']:
        assert ranges[body]['calls'][-1]['target'] == '005c2760'
    for body in ['005c4570', '005c7c40']:
        targets = [c['target'] for c in ranges[body]['calls']]
        assert targets[targets.index('00505490')+1] == '00645bc0'
    rows = {i['address']: i for i in ranges['005c7c40']['instructions']}
    assert rows['005c7ce1']['mnemonic'] == 'lea' and rows['005c7ce1']['operands'] == 'ecx, [esi + 8]'
    assert rows['005c7ce7']['operands'] == 'edx, dword ptr [ecx]'
    assert rows['005c7ce9']['operands'] == 'dword ptr [edx]'
    assert rows['005c7cd3']['operands'] == '0'
    assert int(rows['005c7ce9']['address'], 16) < int(rows['005c7cec']['address'], 16)
    collection = report['listenerCCollection']
    assert collection['valueThisIsNodePlusEight'] and not collection['valueThisIsDereferencedPayloadPointer']
    assert collection['nodeFreeAfterEmbeddedValueCleanup'] and collection['headAndCountCleared']
    assert collection['valueDeletionFlag'] == 0
    assert collection['nodeAllocationBytes'] == 36 and collection['copiedValueBytes'] == 28
    assert collection['insertedValueInitialTargetQualified'] and not collection['embeddedValueLiveVtableQualified']
    assert not collection['insertionChecksMaximumCount'] and not collection['opaqueWordOwnershipQualified']
    assert collection['opaqueCopiedValueWordOffsets'] == [0x14, 0x18]
    assert writes(ranges['005c7810']['instructions']) == ['005c7819']
    assert writes(ranges['005c7830']['instructions']) == ['005c7830']
    assert ranges['005c7830']['calls'] == []
    value_rows = {i['address']: i for i in ranges['005c7810']['instructions']}
    assert value_rows['005c7817']['operands'] == 'al, 1'
    assert value_rows['005c781f']['operands'] == '0x5c782a'
    zero_tail = [i for i in ranges['005c7810']['instructions'] if i['address'] >= '005c782a']
    assert all(i['mnemonic'] != 'call' for i in zero_tail)
    assert zero_tail[-1]['mnemonic'] == 'ret'
    assert [c['target'] for c in ranges['005c7930']['calls']] == ['0064c616', '005c9d10']
    assert ranges['005c9d10']['calls'] == []
    assert len(writes(ranges['005c9d10']['instructions'])) == 7
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    decoder.detail = True
    count_accesses = []
    for row in ranges['005c7930']['instructions']:
        instruction = next(decoder.disasm(bytes.fromhex(row['bytes']), int(row['address'], 16)))
        for operand in instruction.operands:
            if operand.type == capstone.x86.X86_OP_MEM and operand.mem.base == capstone.x86.X86_REG_EBX and operand.mem.disp == 0xc:
                count_accesses.append((row['address'], operand.access))
    assert count_accesses == [('005c79d7', capstone.CS_AC_READ), ('005c79e0', capstone.CS_AC_WRITE)]
    assert not any(i['mnemonic'].startswith('j') for i in ranges['005c7930']['instructions'] if i['address'] >= '005c79d7')
    # Ensure the shared flow checker rejects missing returns and escaping or
    # unresolved branches, rather than silently recording incomplete methods.
    flow = module.load(module.FLOW_SOURCE, 'listener_resource_flow_check')
    valid = ranges['00505490']['instructions']
    failures = [valid[:-1]]
    for target in ['0x1000', 'eax']:
        changed = copy.deepcopy(valid)
        next(i for i in changed if i['mnemonic'] == 'jne')['operands'] = target
        failures.append(changed)
    for fixture in failures:
        try:
            flow.inspect_flow(fixture)
        except ValueError:
            pass
        else:
            raise AssertionError('Incomplete or escaping flow accepted')
    for flag in ['fullListenerDestructionClosureQualified', 'actorReferenceRetentionExcluded',
                 'liveListenerSetQualified', 'scopedListenerDetachQualified', 'boundedNativeSimulationQualified',
                 'liveNativePagingQualified', 'nativeInstructionsExecuted', 'browserUsed', 'nativeBuildRun', 'gameLaunched']:
        assert report[flag] is False
    sources = [AUDITOR, Path(__file__).resolve(), module.DEPENDENCY, module.FLOW_SOURCE,
        ROOT/'scripts/audit-native-placement-dispatch.py']
    sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
    result = dict(qualified=True, scope='pinned derived listener resource cleanup bodies and local flow only',
        verifiedInstructionAnchors=report['verifiedInstructionAnchors'], decodedRanges=13, decodedInstructions=instruction_count,
        vtableSlots=4, openIndirectCallSites=9, originalFreeUsedForDrawingPointers=True,
        drawingPointerFieldsCleared=True, drawingCountsResetByDestructor=False,
        embeddedValueThisIsNodePlusEight=True, embeddedValueDeletionFlag=0,
        nodeFreeFollowsEmbeddedValueCleanup=True, unpinnedInputRejectedBeforePeDecode=True,
        insertedValueInitialTargetQualified=True, initialValueFlagZeroCleanupIsVtableResetOnly=True,
        collectionNodeBytes=36, collectionHasInsertionCountCap=False, opaqueCopiedWordOwnershipQualified=False,
        explicitMemoryDestinationClassifierChecked=True, incompleteFlowFixturesRejected=3,
        sourceSha256={str(p.relative_to(ROOT)): sha(p) for p in sources},
        evidenceSha256={str(p.relative_to(ROOT)): sha(p) for p in
            [report_path, ROOT/'docs/native-listener-resources.md']},
        fullListenerDestructionClosureQualified=False, actorReferenceRetentionExcluded=False,
        liveListenerSetQualified=False, scopedListenerDetachQualified=False, boundedNativeSimulationQualified=False,
        liveNativePagingQualified=False, nativeInstructionsExecuted=False, gameLaunched=False,
        browserUsed=False, nativeBuildRun=False, originalProfilesModified=False, crashResolved=False, goalCompleted=False)
    output.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(dict(passed=True, anchors=result['verifiedInstructionAnchors'], instructions=instruction_count,
        indirectCallsStillOpen=9, embeddedValueThis='node+8', gameLaunches=0)))


if __name__ == '__main__':
    main()

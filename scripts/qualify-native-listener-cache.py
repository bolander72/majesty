#!/usr/bin/env python3
"""Check cache argument origins and peer cleanup against fresh pinned bytes."""
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import tempfile
from unittest.mock import patch

import capstone

ROOT = Path(__file__).resolve().parents[1]
AUDITOR = ROOT/'scripts/audit-native-listener-cache.py'
spec = importlib.util.spec_from_file_location('listener_cache', AUDITOR)
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


def stack_origins(rows, callee_bytes):
    """Symbolic ESP displacement for this wrapper's supported x86 operations."""
    delta, origins = 0, {}
    for row in rows:
        mnemonic, operands = row['mnemonic'], row['operands']
        match = re.search(r'dword ptr \[esp \+ (0x[0-9a-f]+|\d+)\]', operands)
        if match:
            origins[row['address']] = int(match[1], 0)-delta
        if mnemonic == 'sub' and operands.startswith('esp, '):
            delta += int(operands.split(', ')[1], 0)
        elif mnemonic == 'add' and operands.startswith('esp, '):
            delta -= int(operands.split(', ')[1], 0)
        elif mnemonic == 'push':
            delta += 4
        elif mnemonic == 'pop':
            delta -= 4
        elif mnemonic == 'call':
            delta -= callee_bytes[row['address']]
        elif mnemonic == 'ret':
            assert delta == 0, 'Wrapper did not restore its entry stack'
    return origins


def main():
    output = ROOT/'output/native-listener-cache-terminal-qualified.json'
    output.unlink(missing_ok=True)
    report_path = ROOT/'output/native-listener-cache-audit.json'
    report = json.loads(report_path.read_text())
    exe = ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    assert report == module.audit(exe)
    assert hashlib.sha256(exe.read_bytes()).hexdigest() == module.PIN
    with tempfile.TemporaryDirectory(prefix='listener-cache-pin-') as directory:
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
    assert len(ranges) == 10 and all(r['localBranchTargetsClosed'] for r in ranges.values())
    assert sum(len(r['instructions']) for r in ranges.values()) == 438
    assert len(report['vtableSlots']) == 7 and len(report['indirectCallSites']) == 4
    wrapper = ranges['005c88f0']
    assert wrapper['localBranches'] == []
    assert [c['target'] for c in wrapper['calls']] == ['005c2d70', None, None, '005c7930']
    assert [c['operands'] for c in wrapper['calls'][1:3]] == ['dword ptr [eax + 0x58]', 'dword ptr [edx + 0x98]']
    for target in ['005c2d70', '005c3020', '005c8230']:
        assert ranges[target]['instructions'][-1]['operands'] == '4'
    resources = module.load(module.DEPENDENCY, 'listener_cache_resource_check')
    insertion = next(r for r in resources.audit(exe)['ranges'] if r['start'] == '005c7930')
    assert insertion['instructions'][-1]['operands'] == '0xc'
    origins = stack_origins(wrapper['instructions'], {'005c88fc': 4, '005c890a': 4,
        '005c8916': 4, '005c8930': 12})
    assert origins == {'005c88f5': 4, '005c891c': 8}
    assert wrapper['instructions'][-1]['operands'] == '8'
    constructor_prefix = [i for i in ranges['005c2630']['instructions'] if i['address'] <= '005c2678']
    assert stack_origins(constructor_prefix, {'005c2658': 0})['005c2678'] == 4
    # Independent displacement control: a third caller argument is distinct
    # from the return address after a local stack reservation and register push.
    fixture = [dict(address='00001000', mnemonic='sub', operands='esp, 0x10'),
        dict(address='00001003', mnemonic='push', operands='esi'),
        dict(address='00001004', mnemonic='mov', operands='eax, dword ptr [esp + 0x20]'),
        dict(address='00001008', mnemonic='pop', operands='esi'),
        dict(address='00001009', mnemonic='add', operands='esp, 0x10'),
        dict(address='0000100c', mnemonic='ret', operands='')]
    assert stack_origins(fixture, {}) == {'00001004': 12}
    assert writes([dict(address='00001000', bytes='8908'), dict(address='00001002', bytes='8b08'),
        dict(address='00001004', bytes='50'), dict(address='00001005', bytes='8d4808')]) == ['00001000']
    assert writes(ranges['005c2d70']['instructions']) == []
    assert writes(ranges['005c2dd0']['instructions']) == ['005c2e2a', '005c2e5f', '005c2e66', '005c2e75']
    assert [c['target'] for c in ranges['005c2dd0']['calls']] == ['005c3850', '005c3850', '00645bc0']
    assert ranges['005c3850']['calls'] == []
    assert writes(ranges['005c7a00']['instructions']) == ['005c7a2a', '005c7a30', '005c7a36', '005c7a3c']
    assert writes(ranges['005c7a50']['instructions']) == ['005c7a7b', '005c7a80', '005c7a86', '005c7a8c']
    assert ranges['005c7a00']['calls'] == ranges['005c7a50']['calls'] == []
    update = {i['address']: i for i in ranges['005c7a00']['instructions']}
    read = {i['address']: i for i in ranges['005c7a50']['instructions']}
    assert update['005c7a1f']['operands'] == '0x5c7a48'
    assert read['005c7a6f']['operands'] == '0x5c7a98'
    assert update['005c7a28']['operands'] == read['005c7a79']['operands'] == 'al, 1'
    assert report['peerList']['nodeValueIsRawPeerPointer']
    assert report['peerList']['linkingAndUnlinkingSwapEndpoints']
    lineage = report['cacheRecordLineage']
    assert lineage['metadataSource'] == 'second stack argument to 005c88f0'
    assert lineage['metadataMayBePointer'] and not lineage['secondaryWordIsReturnAddress']
    assert lineage['unconditionalAppendAfterPeerLinkReturns'] and not lineage['wrapperChecksExistingCacheKey']
    assert not report['peerUnlinkLocallyMutatesCache']
    for flag in ['actorReferenceRetentionExcluded', 'allCacheWritersQualified', 'completeDetachQualified',
                 'fullListenerDestructionClosureQualified', 'boundedNativeSimulationQualified',
                 'liveNativePagingQualified', 'nativeInstructionsExecuted', 'gameLaunched', 'browserUsed', 'nativeBuildRun']:
        assert report[flag] is False
    sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
    sources = [AUDITOR, Path(__file__).resolve(), module.DEPENDENCY,
        ROOT/'scripts/audit-native-notification-lifetime.py', ROOT/'scripts/audit-native-placement-callbacks.py',
        ROOT/'scripts/audit-native-placement-dispatch.py']
    result = dict(qualified=True, scope='pinned listener peer and keyed-record local paths and initial ABI',
        verifiedInstructionAnchors=report['verifiedInstructionAnchors'], decodedRanges=10, decodedInstructions=438,
        verifiedVtableWords=7, openIndirectCallSites=4, metadataEntryStackOffset=8,
        metadataSourceIsSecondCallerArgument=True, metadataMeaningAndOwnershipQualified=False,
        rawPeerPointerMembershipIdentified=True, reciprocalEndpointSwapsIdentified=True,
        peerUnlinkLocallyMutatesCache=False, registrationUnconditionallyAppendsCacheAfterPeerLink=True,
        keyedReadAndUpdateSelectFirstMatch=True, missingKeyReadLeavesOutputUntouched=True,
        independentStackDisplacementFixturePassed=True, explicitMemoryDestinationClassifierChecked=True,
        unpinnedInputRejectedBeforePeDecode=True,
        sourceSha256={str(p.relative_to(ROOT)): sha(p) for p in sources},
        evidenceSha256={str(p.relative_to(ROOT)): sha(p) for p in
            [report_path, ROOT/'docs/native-listener-cache.md']},
        liveInputAndReceiverIdentitiesQualified=False, allCacheWritersQualified=False,
        actorReferenceRetentionExcluded=False, completeDetachQualified=False,
        boundedNativeSimulationQualified=False, liveNativePagingQualified=False,
        nativeInstructionsExecuted=False, gameLaunched=False, browserUsed=False, nativeBuildRun=False,
        originalProfilesModified=False, crashResolved=False, goalCompleted=False)
    output.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(dict(passed=True, anchors=51, instructions=438,
        metadataEntryStackOffset=8, peerCacheMembershipsDistinct=True, gameLaunches=0)))


if __name__ == '__main__':
    main()

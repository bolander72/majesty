#!/usr/bin/env python3
"""Qualify dispatch-table and reference-scan scope, without native execution."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
AUDITOR = ROOT/'scripts/audit-native-placement-dispatch.py'
spec = importlib.util.spec_from_file_location('placement_audit', AUDITOR)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def main():
    output = ROOT/'output/native-placement-dispatch-terminal-qualified.json'
    output.unlink(missing_ok=True)
    report_path = ROOT/'output/native-placement-dispatch-audit.json'
    report = json.loads(report_path.read_text())
    assert report == module.audit(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    with tempfile.TemporaryDirectory(prefix='placement-pin-') as directory:
        unpinned = Path(directory)/'unpinned.exe'
        unpinned.write_bytes(b'MZ'+b'\0'*30)
        with patch.object(module.pefile, 'PE', side_effect=AssertionError('Unpinned PE decoded')) as decode:
            try:
                module.audit(unpinned)
                raise AssertionError('Unpinned input accepted')
            except ValueError as error:
                assert 'pinned executable' in str(error)
            assert decode.call_count == 0
    slots = report['vtableSlots']
    actors = [s for s in slots if 'callSite' in s]
    assert len(actors) == 35 and len({s['table'] for s in actors}) == 5
    for callback in report['actorCallbacks']:
        matches = [s for s in actors if s['offset'] == callback['slot']]
        assert len(matches) == 5 and all(s['target'] == callback['target'] for s in matches)
    assert report['wrapperStackArgumentBytes'] == 32 and report['initializationStackArgumentBytes'] == 36
    assert report['registeredBeforeActorInitializationCallbacks']
    assert report['factorySwitchAndFallbackQualified'] and report['factoryFallbackReturnsNull']
    assert report['actorSlot20UpdatesOffset'] == 0x70
    assert report['actorSlot20ConditionallyInvokesSlotB8']
    assert report['sevenDirectSitesBoundAllActorCallbackEffects'] is False
    point, bulk = report['heightReferenceInventory']
    assert point['target'] == '005f1a40' and point['fourByteLittleEndianWords'] == ['0068b680']
    assert bulk['target'] == '005f1ae0' and bulk['fourByteLittleEndianWords'] == []
    assert all(not r['e8e9Rel32CandidatesInExecutableSections'] and not r['callersProvenAbsent'] for r in [point, bulk])
    # Check scan arithmetic independently with synthetic PE-section adapters.
    # These are encodings, not decoded/qualified caller instructions.
    class Section:
        VirtualAddress = 0x1000
        Characteristics = 0x20000000
        def __init__(self, data):
            self.data = data
        def get_data(self):
            return self.data
    class Image:
        def __init__(self, data):
            self.sections = [Section(data)]
    import struct
    target, base = 0x005f1ae0, 0x00400000
    address = base+Section.VirtualAddress
    fixture = struct.pack('<I', target)+b'\xe8'+struct.pack('<i', target-(address+9))
    inventory = module.encoded_references(Image(fixture), base, target)
    assert inventory['fourByteLittleEndianWords'] == ['00401000']
    assert inventory['e8e9Rel32CandidatesInExecutableSections'] == [dict(address='00401004', opcode=0xe8)]
    assert inventory['callersProvenAbsent'] is False
    backward_target = 0x00400010
    backward = module.encoded_references(Image(b'\xe9'+struct.pack('<i', backward_target-(address+5))), base, backward_target)
    assert backward['e8e9Rel32CandidatesInExecutableSections'] == [dict(address='00401000', opcode=0xe9)]
    truncated = module.encoded_references(Image(b'\xe8\x00\xe9'), base, target)
    assert truncated['e8e9Rel32CandidatesInExecutableSections'] == []
    for flag in ['factoryConstructorAndCallbackClosureQualified', 'heightWriterCallerOrderingQualified',
                 'allLaterGeometryEditsExcluded', 'safeBorderMutationHookQualified', 'liveNativePagingQualified',
                 'nativeInstructionsExecuted', 'browserUsed', 'nativeBuildRun']:
        assert report[flag] is False
    files = [AUDITOR, Path(__file__).resolve(), report_path]
    result = dict(qualified=True, scope='pinned placement dispatch and encoded-reference scan only',
        verifiedInstructionAnchors=report['verifiedInstructionAnchors'], vtableSlots=len(slots),
        initialFactoryTables=5, sharedDirectActorInitializationSites=7,
        factorySwitchAndNullFallbackQualified=True, actorSlot20MayInvokeAdditionalInitialization=True,
        referenceScannerSyntheticPositiveAndTruncatedInputsChecked=True,
        unpinnedInputRejectedBeforePeDecode=True,
        sourceSha256={str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in files},
        callbackClosureQualified=False, allLaterGeometryEditsExcluded=False,
        safeBorderMutationHookQualified=False, liveNativePagingQualified=False,
        nativeInstructionsExecuted=False, gameLaunched=False, browserUsed=False,
        nativeBuildRun=False, crashResolved=False, goalCompleted=False)
    output.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(dict(passed=True, anchors=report['verifiedInstructionAnchors'],
        factoryTables=5, sharedDirectCallbacks=7, referenceScanChecks=3,
        safeBorderMutationHookQualified=False, gameLaunches=0)))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Qualify pinned construction ABI evidence without running native code."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
AUDITOR = ROOT/'scripts/audit-native-construction-finalizer.py'
spec = importlib.util.spec_from_file_location('construction_audit', AUDITOR)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def frame_for(rows, prefix):
    # Abstract stack accounting over the verified instruction paths. Calls
    # are not executed: their verified RET 4 contracts consume the pushed arg.
    stack = {0: 'outer-return', 4: 'description'}
    sp, esi = 0, 'saved-esi'
    path = prefix + [0x005bb328, 0x005bb32e, 0x005bb331,
                     0x005bb333, 0x005bb334, 0x005bb336]
    for address in path:
        row = rows[address]
        mnemonic, operands = row['mnemonic'], row['operands']
        if mnemonic == 'mov' and operands == 'esi, ecx':
            esi = 'world'
        elif mnemonic == 'add' and operands == 'esi, 0x5c':
            assert esi == 'world'
            esi = 'world+0x5c'
        elif mnemonic == 'push':
            sp -= 4
            stack[sp] = {'esi': esi, 'eax': 'description', '0': 'null'}[operands]
        elif mnemonic == 'call':
            if address == 0x005bb336:
                sp -= 4
                stack[sp] = 'immediate-return'
            else:
                # The call's own pushed return is removed by RET; its one
                # argument is removed by RET 4. Verify both callee contracts.
                if address == 0x005bb313:
                    assert rows[0x005d9966]['operands'] == rows[0x005d996f]['operands'] == '4'
                elif address == 0x005bb323:
                    assert rows[0x005c9e5e]['operands'] == '4'
                else:
                    raise AssertionError('Unexpected initializer call')
                del stack[sp]
                sp += 4
    return {str(offset): stack[sp+offset] for offset in range(0, 24, 4)}


def main():
    output = ROOT/'output/native-construction-finalizer-terminal-qualified.json'
    output.unlink(missing_ok=True)
    report_path = ROOT/'output/native-construction-finalizer-audit.json'
    report = json.loads(report_path.read_text())
    exe = ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    assert report == module.audit(exe), 'Saved construction audit differs from current pinned instructions'
    with tempfile.TemporaryDirectory(prefix='construction-pin-') as directory:
        invalid = Path(directory)/'unpinned.exe'
        invalid.write_bytes(b'MZ'+b'\0'*30)
        with patch.object(module.pefile, 'PE', side_effect=AssertionError('Unpinned PE decoded')) as decode:
            try:
                module.audit(invalid)
                raise AssertionError('Unpinned input accepted')
            except ValueError as error:
                assert 'pinned executable' in str(error)
            assert decode.call_count == 0
    rows = {int(row['address'], 16): row for r in report['ranges'] for row in r['instructions']}
    start = [0x005bb300, 0x005bb304, 0x005bb305, 0x005bb307, 0x005bb309]
    null_branch = [0x005bb318, 0x005bb31e, 0x005bb320, 0x005bb323]
    paths = {'zero': start+null_branch,
             'minus-one': start+[0x005bb30b, 0x005bb30e]+null_branch,
             'description': start+[0x005bb30b, 0x005bb30e, 0x005bb310,
                                   0x005bb312, 0x005bb313, 0x005bb316]}
    frames = {name: frame_for(rows, path) for name, path in paths.items()}
    expected = {'0': 'immediate-return', '4': 'world+0x5c', '8': 'null',
                '12': 'saved-esi', '16': 'outer-return', '20': 'description'}
    assert all(frame == expected for frame in frames.values())
    context = report['firstNormalFinalizer']
    assert context['entryStackOffsets']['outerInitializerReturn'] == 16
    assert context['entryFrameBytesToCheck'] == 24
    assert context['beforeGeneratorWorldAssignment'] and context['beforeSpatialGridConstruction']
    for flag in ['heightWriterCallerOrderingQualified', 'completeConstructorCallClosureQualified',
                 'allActorsAbsentQualified', 'safeBorderMutationHookQualified', 'generatedBorderQualified',
                 'liveNativePagingQualified', 'browserUsed', 'nativeBuildRun']:
        assert report[flag] is False
    digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    files = [AUDITOR, Path(__file__).resolve(), report_path,
             ROOT/'scripts/audit-native-terrain-generation.py']
    result = dict(qualified=True, scope='pinned local construction ordering and first-finalizer ABI only',
        constructionInstructionAnchors=report['constructionInstructionAnchors'],
        priorGenerationAnchorsRechecked=report['priorGenerationAnchorsRechecked'],
        unpinnedInputRejectedBeforePeDecode=True, abstractEntryFrames=frames,
        sourceSha256={str(path.relative_to(ROOT)): digest(path) for path in files},
        nativeInstructionsExecuted=False, gameLaunched=False, browserUsed=False, nativeBuildRun=False,
        safeBorderMutationHookQualified=False, allActorsAbsentQualified=False,
        heightWriterCallerOrderingQualified=False, liveNativePagingQualified=False,
        crashResolved=False, goalCompleted=False)
    output.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(dict(passed=True, constructionAnchors=report['constructionInstructionAnchors'],
        abstractStackBranches=len(frames), unpinnedInputRejectedBeforePeDecode=True,
        safeBorderMutationHookQualified=False, gameLaunches=0)))


if __name__ == '__main__':
    main()

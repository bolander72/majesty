#!/usr/bin/env python3
"""Verify cache stores, drawing argument provenance and outline branch paths."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import tempfile
from unittest.mock import patch

import capstone

ROOT = Path(__file__).resolve().parents[1]
AUDITOR = ROOT/'scripts/audit-native-cache-consumers.py'
spec = importlib.util.spec_from_file_location('cache_consumers', AUDITOR)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def outline_paths(rows):
    """Track only stack ownership of argument five across this bounded CFG.

    Callee stack cleanup and nonvolatile registers follow the audited ABI;
    numeric geometry and surface callback effects are intentionally unknown.
    """
    lookup = {int(r['address'], 16): r for r in rows}
    paths = []
    pending = [(min(lookup), 0, {20: 'metadata'}, {}, [], 0)]
    while pending:
        address, depth, stack, registers, calls, steps = pending.pop()
        assert steps < 150 and len(pending) < 16
        row = lookup[address]
        mnemonic, operands = row['mnemonic'], row['operands']
        following = address+len(bytes.fromhex(row['bytes']))
        parts = operands.split(', ')
        def value(operand):
            match = re.fullmatch(r'dword ptr \[esp \+ (0x[0-9a-f]+|\d+)\]', operand)
            return stack.get(int(match[1], 0)-depth) if match else registers.get(operand)
        if mnemonic == 'push':
            argument = value(operands)
            depth += 4
            stack[-depth] = argument
        elif mnemonic == 'pop':
            registers[operands] = stack.pop(-depth, None)
            depth -= 4
        elif mnemonic == 'mov':
            assert '[' not in parts[0]
            registers[parts[0]] = value(parts[1])
        elif mnemonic == 'lea' or mnemonic == 'dec':
            registers[parts[0]] = None
        elif mnemonic == 'add' and parts[0] == 'esp':
            count = int(parts[1], 0)
            for offset in range(-depth, -depth+count, 4):
                stack.pop(offset, None)
            depth -= count
        elif mnemonic == 'call':
            if operands == '0x500330':
                assert stack.get(-depth+16) == 'metadata', 'Outline fill lost metadata argument'
                calls.append(row['address'])
            else:
                assert operands in ['dword ptr [eax + 0xc0]', 'dword ptr [edx + 0xc4]']
                if operands.endswith('0xc0]'):
                    stack.pop(-depth, None)
                    depth -= 4
            for register in ['eax', 'ecx', 'edx']:
                registers[register] = None
        elif mnemonic == 'ret':
            assert depth == 0 and len(calls) == 4
            paths.append(calls)
            continue
        elif mnemonic == 'jmp':
            following = int(operands, 0)
        elif mnemonic.startswith('j'):
            pending.append((int(operands, 0), depth, stack.copy(), registers.copy(), calls.copy(), steps+1))
        else:
            assert mnemonic == 'cmp'
        pending.append((following, depth, stack, registers, calls, steps+1))
    assert len(paths) == 4
    assert len({address for path in paths for address in path}) == 6
    return paths


def writes(rows):
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    decoder.detail = True
    result = []
    for row in rows:
        instructions = list(decoder.disasm(bytes.fromhex(row['bytes']), int(row['address'], 16)))
        assert len(instructions) == 1
        if any(op.type == capstone.x86.X86_OP_MEM and op.access & capstone.CS_AC_WRITE
               for op in instructions[0].operands):
            result.append(row)
    return result


def main():
    output = ROOT/'output/native-cache-consumers-terminal-qualified.json'
    output.unlink(missing_ok=True)
    report_path = ROOT/'output/native-cache-consumers-audit.json'
    report = json.loads(report_path.read_text())
    exe = ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    assert report == module.audit(exe)
    with tempfile.TemporaryDirectory(prefix='cache-consumer-pin-') as directory:
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
    assert len(ranges) == 6 and all(r['localBranchTargetsClosed'] for r in ranges.values())
    assert sum(len(r['instructions']) for r in ranges.values()) == 586
    update = ranges['005c8630']['instructions']
    node_writes = [r['address'] for r in writes(update) if not r['operands'].startswith('dword ptr [esp ')]
    assert node_writes == ['005c8724', '005c872b', '005c8732', '005c8739']
    assert not any(c['direct'] and c['target'] in ['00645bc0', '0064c616'] for c in ranges['005c8630']['calls'])
    paint = ranges['005c8760']['instructions']
    assert all(r['operands'].startswith('dword ptr [esp ') for r in writes(paint))
    assert not any('+ 0x1c]' in r['operands'] and 'esp' not in r['operands'] for r in paint)
    for address in ['005c8812', '005c88c5']:
        index = next(i for i, row in enumerate(paint) if row['address'] == address)
        suffix = paint[index-6:index+1]
        assert suffix[0]['operands'] == 'edx, dword ptr [eax + 0x20]'
        assert [r['mnemonic'] for r in suffix] == ['mov', 'push', 'push', 'push', 'push', 'push', 'call']
        assert [r['operands'] for r in suffix[1:]] == ['edx', 'ecx', 'ebx', 'ebp', 'edi', '0x5004b0']
    paths = outline_paths(ranges['005004b0']['instructions'])
    wrong = copy.deepcopy(ranges['005004b0']['instructions'])
    next(r for r in wrong if r['address'] == '005004cc')['operands'] = 'edi, dword ptr [esp + 0x20]'
    try:
        outline_paths(wrong)
    except AssertionError as error:
        assert 'metadata argument' in str(error)
    else:
        raise AssertionError('Wrong stack argument accepted as metadata')
    assert ranges['005004b0']['instructions'][-1]['operands'] == ''
    assert ranges['00500330']['instructions'][-1]['operands'] == ''
    assert ranges['005c8760']['instructions'][-1]['operands'] == '0xc'
    assert ranges['005c9d00']['calls'] == []
    for flag in ['metadataIsAlphaQualified', 'completeDrawingCalleesQualified',
        'liveReceiverVtableQualified', 'allCacheConsumersQualified', 'allCacheWritersQualified',
        'actorReferenceRetentionExcluded', 'completeDetachQualified', 'boundedNativeSimulationQualified',
        'liveNativePagingQualified', 'nativeInstructionsExecuted', 'gameLaunched', 'browserUsed', 'nativeBuildRun']:
        assert report[flag] is False
    sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    sources = [AUDITOR, Path(__file__).resolve(), module.DEPENDENCY,
        ROOT/'scripts/audit-native-listener-cache.py', ROOT/'scripts/audit-native-listener-resources.py',
        ROOT/'scripts/audit-native-notification-lifetime.py',
        ROOT/'scripts/audit-native-placement-callbacks.py', ROOT/'scripts/audit-native-placement-dispatch.py']
    result = dict(qualified=True, scope='local cached-rectangle update and numeric outline metadata use',
        decodedRanges=6, decodedInstructions=586, verifiedInstructionAnchors=39,
        verifiedInitialVtableWords=2, metadataOutlineArgument=5,
        outlineBranchPaths=len(paths), fillsPerOutlinePath=4, staticFillCallSites=6,
        metadataForwardedOnEveryAuditedOutlinePath=True,
        wrongStackArgumentNegativeControlPassed=True, unpinnedInputRejectedBeforePeDecode=True,
        cacheUpdateExplicitNodeWrites=[12,16,20,24], cacheUpdateRemovesRecords=False,
        cachedOutlineExplicitWritesOnlyStack=True, metadataUsedAsNumericPixelValue=True,
        metadataIsAlphaQualified=False, completeDrawingCalleesQualified=False,
        liveReceiverVtableQualified=False, allCacheConsumersQualified=False,
        actorReferenceRetentionExcluded=False, completeDetachQualified=False,
        boundedNativeSimulationQualified=False, liveNativePagingQualified=False,
        nativeInstructionsExecuted=False, gameLaunched=False, browserUsed=False, nativeBuildRun=False,
        originalProfilesModified=False, crashResolved=False, goalCompleted=False,
        sourceSha256={str(p.relative_to(ROOT)): sha(p) for p in sources},
        evidenceSha256={str(p.relative_to(ROOT)): sha(p) for p in
            [report_path, ROOT/'docs/native-cache-consumers.md']})
    output.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(dict(passed=True, instructions=586, anchors=39,
        outlineBranchPaths=4, metadataDrawingArgument=5, gameLaunches=0)))


if __name__ == '__main__':
    main()

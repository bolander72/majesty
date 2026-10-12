#!/usr/bin/env python3
"""Verify original full-context ownership branches before cooperative attachment."""
import argparse
import hashlib
import json
from pathlib import Path
import struct

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


def audit():
    data = (ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    assert hashlib.sha256(data).hexdigest() == PIN
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    ranges = [
        ('attachment', 0x00415f30, 0x00416005),
        ('registry-virtual-setter', 0x004bdcc0, 0x004bdce3),
        ('context-setter', 0x005979f0, 0x005979fa),
        ('registry-setter', 0x00597a00, 0x00597a0a),
        ('phase-setter', 0x00416050, 0x00416131),
        ('original-rebuild', 0x00416c30, 0x00417096),
        ('original-fresh-gpl-initialization', 0x00417140, 0x0041764b),
        ('original-outer-dispatcher', 0x00415e40, 0x00415eeb),
    ]
    decoded, records = {}, []
    for label, start, end in ranges:
        instructions = list(decoder.disasm(pe.get_data(start - base, end - start), start))
        assert instructions[-1].address + instructions[-1].size == end
        assert instructions[-1].mnemonic == 'ret'
        rows = [dict(address=f'{i.address:08x}', mnemonic=i.mnemonic, operands=i.op_str)
                for i in instructions]
        decoded.update({i.address: i for i in instructions})
        records.append(dict(label=label, instructions=rows))
    table = struct.unpack('<4I', pe.get_data(0x00416008 - base, 16))
    assert table[0] == table[3] == 0x00415fa9 and table[2] == 0x00415fdd
    virtual = struct.unpack('<I', pe.get_data(0x0067f85c + 4 - base, 4))[0]
    assert virtual == 0x004bdcc0
    phases = struct.unpack('<9I', pe.get_data(0x00416134 - base, 36))
    assert phases[1] == 0x004160a0
    anchors = [
        (0x00415fb2, 'call', 'dword ptr [eax + 4]'),
        (0x00415fbc, 'call', '0x5979f0'),
        (0x00415fe6, 'call', 'dword ptr [eax + 4]'),
        (0x004bdcc6, 'call', '0x597a00'),
        (0x005979f4, 'mov', 'dword ptr [ecx + 4], eax'),
        (0x00597a04, 'mov', 'dword ptr [ecx + 0x10], eax'),
        (0x00415fe9, 'push', '2'),
        (0x00415fed, 'call', '0x416050'),
        (0x004160a0, 'dec', 'eax'),
        (0x004160a7, 'sub', 'eax, 4'),
        (0x004160ac, 'sub', 'eax, 2'),
        (0x004160b1, 'mov', 'esi, 5'),
        (0x004160b6, 'mov', 'dword ptr [edi + 4], esi'),
    ]
    for address, mnemonic, operands in anchors:
        assert (decoded[address].mnemonic, decoded[address].op_str) == (mnemonic, operands)
    dispatcher_anchors = [
        (0x00415e4d, 'mov', 'eax, dword ptr [esi + 4]'),
        (0x00415e54, 'mov', 'dword ptr [esi], eax'),
        (0x00415e56, 'mov', 'dword ptr [esi + 4], 0'),
        (0x00415e7a, 'call', '0x416c30'),
        (0x00415ee2, 'jne', '0x415e4d'),
        (0x00415eea, 'ret', ''),
    ]
    for address, mnemonic, operands in dispatcher_anchors:
        assert (decoded[address].mnemonic, decoded[address].op_str) == (mnemonic, operands)
    assert struct.unpack('<I', pe.get_data(0x00415eec + 4 - base, 4))[0] == 0x00415e78
    # The constructor's one-byte initialization flag is separate from phase.
    initial_flag = next(decoder.disasm(pe.get_data(0x00415cb1 - base, 4), 0x00415cb1))
    assert (initial_flag.mnemonic, initial_flag.op_str) == ('mov', 'byte ptr [esi + 0x4c], 1')
    fresh_anchors = [
        (0x00416fd5, 'mov', 'al, byte ptr [ebx + 0x4c]'),
        (0x00416fda, 'je', '0x416fe5'),
        (0x00416fde, 'call', '0x417140'),
        (0x0041706e, 'mov', 'byte ptr [ebx + 0x4c], 0'),
        (0x00417163, 'push', '0x6baeb8'),
        (0x0041719f, 'call', '0x629c40'),
    ]
    for address, mnemonic, operands in fresh_anchors:
        assert (decoded[address].mnemonic, decoded[address].op_str) == (mnemonic, operands)
    assert pe.get_string_at_rva(0x006baeb8 - base) == b'InitializeGpl'
    # Saved travel must follow the original front-end script preparation,
    # after the old interface/world teardown and before the full file reader.
    for label, start, end in [
        ('saved-load-preparation', 0x00463c44, 0x00463c65),
        ('source-teardown', 0x004170a0, 0x00417140),
        ('saved-reader-wrapper', 0x00435940, 0x004359ba),
        ('saved-reader-body', 0x004354d0, 0x00435610),
        ('startup-mode1-selector', 0x004bbcf5, 0x004bbd01),
        ('startup-mode2-selector', 0x004bbf8e, 0x004bbf94),
        ('startup-mode3-selector', 0x004bc02e, 0x004bc038),
        ('startup-mode-to-manager', 0x004bc185, 0x004bc193),
        ('outer-tick-call', 0x00415e83, 0x00415e88),
        ('outer-rebuild-call', 0x00415e7a, 0x00415e7f),
        ('outer-tick-normal-return', 0x00417be8, 0x00417be9),
        ('outer-tick-early-return', 0x00417c1a, 0x00417c1b),
    ]:
        instructions = list(decoder.disasm(pe.get_data(start - base, end - start), start))
        assert sum(i.size for i in instructions) == end - start
        decoded.update({i.address: i for i in instructions})
        records.append(dict(label=label, instructions=[
            dict(address=f'{i.address:08x}', mnemonic=i.mnemonic, operands=i.op_str)
            for i in instructions]))
    saved_anchors = [
        (0x00463c51, 'mov', 'ebx, 1'),
        (0x00463c56, 'mov', 'dword ptr [esi + 0x6c], ebx'),
        (0x00463c59, 'call', '0x623b20'),
        (0x00463c60, 'call', '0x623a70'),
        (0x004170a3, 'call', '0x48f320'),
        (0x004170e8, 'call', '0x623a70'),
        (0x00417116, 'call', '0x597ad0'),
        (0x00417129, 'call', '0x416050'),
        (0x00435980, 'call', 'dword ptr [eax + 0x48]'),
        (0x00435995, 'call', 'dword ptr [eax + 0xc]'),
        (0x00435578, 'call', '0x5c1830'),
        (0x004bbcf8, 'cmp', 'ecx, 1'),
        (0x004bbf8e, 'cmp', 'dword ptr [eax + 0x6c], 2'),
        (0x004bc02e, 'cmp', 'dword ptr [eax + 0x6c], 3'),
        (0x004bc185, 'mov', 'esi, dword ptr [eax + 0x6c]'),
        (0x004bc18d, 'mov', 'dword ptr [eax + 0x218], esi'),
    ]
    for address, mnemonic, operands in saved_anchors:
        assert (decoded[address].mnemonic, decoded[address].op_str) == (mnemonic, operands)
    assert (decoded[0x00415e83].mnemonic, decoded[0x00415e83].op_str) == ('call', '0x417730')
    assert decoded[0x00415e83].address + decoded[0x00415e83].size == 0x00415e88
    for address in (0x00417be8, 0x00417c1a):
        assert (decoded[address].mnemonic, decoded[address].op_str) == ('ret', '')
    assert (decoded[0x00415e7a].mnemonic, decoded[0x00415e7a].op_str) == ('call', '0x416c30')
    assert decoded[0x00415e7a].address + decoded[0x00415e7a].size == 0x00415e7f
    assert (decoded[0x00417095].mnemonic, decoded[0x00417095].op_str) == ('ret', '')
    assert struct.unpack('<I', pe.get_data(0x00680c60 + 0x40 - base, 4))[0] == 0x00435940
    assert struct.unpack('<I', pe.get_data(0x00680c60 + 0xc - base, 4))[0] == 0x004354d0
    timer_anchors = [
        (0x00416cb3, 'call', 'dword ptr [edx + 4]'),
        (0x00416cbb, 'mov', 'eax, dword ptr [eax + 0x80]'),
        (0x00416cc1, 'mov', 'dword ptr [ebx + 0x28], eax'),
        (0x00416cd7, 'call', '0x497990'),
        (0x00416cdc, 'mov', 'eax, dword ptr [eax + 0xc8]'),
        (0x00416ce2, 'test', 'eax, eax'),
        (0x00416ce4, 'je', '0x416ed5'),
        (0x00416ed5, 'call', '0x4ba7e0'),
        (0x00416f30, 'call', '0x59b1f0'),
        (0x00416f43, 'call', '0x59b1f0'),
        (0x00416f4e, 'mov', 'eax, dword ptr [0x71c6a8]'),
        (0x00416f5a, 'call', '0x59b1b0'),
        (0x00416f64, 'mov', 'edx, dword ptr [0x71c6a8]'),
        (0x00416f71, 'call', '0x59b1b0'),
        (0x0041706a, 'push', '3'),
        (0x00417072, 'call', '0x416050'),
    ]
    for address, mnemonic, operands in timer_anchors:
        assert (decoded[address].mnemonic, decoded[address].op_str) == (mnemonic, operands)
    for start, end in [(0x0059b1b0, 0x0059b1c3), (0x0059b1f0, 0x0059b1fa)]:
        instructions = list(decoder.disasm(pe.get_data(start - base, end - start), start))
        assert instructions[-1].mnemonic == 'ret' and instructions[-1].op_str == '4'
        records.append(dict(label=f'original-timer-{start:08x}', instructions=[
            dict(address=f'{i.address:08x}', mnemonic=i.mnemonic, operands=i.op_str)
            for i in instructions]))
    assert next(decoder.disasm(pe.get_data(0x0059b1be - base, 2), 0x0059b1be)).op_str == 'dword ptr [ecx], eax'
    assert next(decoder.disasm(pe.get_data(0x0059b1f4 - base, 3), 0x0059b1f4)).op_str == 'dword ptr [ecx + 4], eax'
    kind0 = [i for at, i in decoded.items() if 0x00415fa9 <= at < 0x00415fc3]
    kind2 = [i for at, i in decoded.items() if 0x00415fdd <= at < 0x00415fe9]
    assert sum(i.mnemonic == 'call' for i in kind0) == 2
    assert sum(i.mnemonic == 'call' for i in kind2) == 1
    return dict(executableSha256=PIN, checkedInstructionAnchors=len(anchors),
                attachmentKinds=list(table), registryVirtualSetter=virtual, ranges=records,
                kinds0And3PublishContextAndRegistry=True, kind2PublishesRegistryOnly=True,
                request2FromPaused7QueuesExitLoad5=True,
                originalPhase2SetterRetained=True, browserUsed=False, nativeProcessesStarted=0,
                freshInitializationByte=0x4c,
                freshInitializationAnchorsVerified=len(fresh_anchors) + 1,
                constructorSetsFreshByteAndOriginalRebuildClearsIt=True,
                freshByteSelectsOriginalInitializeGpl=True,
                savedPreparationAnchorsVerified=len(saved_anchors),
                savedLoadPreparationSetsLoadingAndResetsGpl=True,
                preparationFieldIsStartupSelectorRatherThanBoolean=True,
                startupModeCopiedIntoMatchManager=True,
                originalRebuildTimerAnchorsVerified=len(timer_anchors) + 2,
                rebuildSetsBothContextTimersFromGlobalClock=True,
                rebuildFrameUsesOriginalManagerFrame=True,
                rebuildTerminalRequest3ReturnAddress='00417077',
                originalLoadingConnectionReadReturnAddress='00416cdc',
                originalLoadingBlockSkippedOnlyWhenConnectionAbsent=True,
                originalLoadingBlockExitSettingsReturnAddress='00416eda',
                originalOuterTickReturnAddress='00415e88',
                originalOuterTickUsesPlainReturn=True,
                originalOuterTickReturnAnchorsVerified=3,
                originalOuterRebuildReturnAddress='00415e7f',
                originalOuterRebuildUsesPlainReturn=True,
                originalOuterRebuildReturnAnchorsVerified=2,
                originalDispatcherConsumesPendingBeforeRebuild=True,
                originalDispatcherPhase2Entry='00415e78',
                originalDispatcherRepeatsPendingTransition=True,
                originalDispatcherInstructionAnchorsVerified=len(dispatcher_anchors),
                sourceTeardownRetiresUiScriptsAndWorldBeforeFinalPhaseRequest=True,
                savedSharedReaderExecuted=False,
                scope='Pinned original ownership and load lifecycle only. Shared rebuild/resume/return still requires actual gameplay.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = audit()
    with args.output.open('x') as output:
        json.dump(result, output, indent=2)
        output.write('\n')
    print(json.dumps({key: result[key] for key in ['checkedInstructionAnchors',
          'kinds0And3PublishContextAndRegistry', 'kind2PublishesRegistryOnly']}))

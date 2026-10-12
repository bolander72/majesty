#!/usr/bin/env python3
"""Pinned initial actor-registry shape and original empty-ID-query branch."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import struct

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
RANGES = [
    ('base-world-setup', 0x005bb180, 0x005bb2fc),
    ('world-configuration', 0x005baf70, 0x005bafab),
    ('typed-registry-group-constructor', 0x005ba670, 0x005ba695),
    ('registry-group-constructor', 0x00596420, 0x005964f3),
    ('registry-group-container-insertion', 0x00596770, 0x005967be),
    ('registry-group-by-kind', 0x005969a0, 0x005969e6),
    ('registry-container-first', 0x00596c10, 0x00596c1e),
    ('registered-actor-lookup', 0x005a10d0, 0x005a110c),
    ('group-actor-lookup-wrapper', 0x005ba8d0, 0x005ba8dd),
    ('group-actor-tree-query', 0x00596670, 0x005966bf),
    ('actor-tree-lower-bound', 0x005976d0, 0x005976fd),
    ('group-actor-registration', 0x00596570, 0x005965ef),
    ('registry-registration-broadcast', 0x00596a40, 0x00596a70),
]
ANCHORS = [
    (0x005bb20c, 'mov', 'dword ptr [edi + 8], ebx'),
    (0x005bb213, 'mov', 'dword ptr [esi + 0x84], edi'),
    (0x005bb274, 'push', 'ebx'),
    (0x005bb275, 'push', '1'),
    (0x005bb277, 'push', '3'),
    (0x005bb27b, 'call', '0x5ba670'),
    (0x005bb280, 'mov', 'dword ptr [edi], 0x68a3a4'),
    (0x005bb2b6, 'mov', 'ecx, dword ptr [esi + 0x84]'),
    (0x005bb2bc, 'push', 'edi'),
    (0x005bb2bd, 'call', '0x596770'),
    (0x005ba684, 'call', '0x596420'),
    (0x0059643a, 'xor', 'ebx, ebx'),
    (0x00596441, 'lea', 'eax, [esi + 0xc]'),
    (0x00596444, 'mov', 'dword ptr [eax], ebx'),
    (0x00596446, 'mov', 'dword ptr [eax + 4], eax'),
    (0x00596449, 'mov', 'dword ptr [eax + 8], eax'),
    (0x0059644c, 'mov', 'dword ptr [eax + 0xc], ebx'),
    (0x005964a0, 'mov', 'edi, dword ptr [0x6d8590]'),
    (0x005964af, 'mov', 'dword ptr [eax + 4], edi'),
    (0x005964b9, 'mov', 'dword ptr [esi + 0x24], eax'),
    (0x005964bc, 'mov', 'dword ptr [esi + 0x2c], ebx'),
    (0x005964bf, 'mov', 'dword ptr [eax], eax'),
    (0x005964c7, 'mov', 'dword ptr [eax + 8], eax'),
    (0x005964ce, 'mov', 'dword ptr [esi + 4], eax'),
    (0x005967b3, 'inc', 'eax'),
    (0x005967b5, 'mov', 'dword ptr [ebx + 8], eax'),
    (0x005a10d9, 'mov', 'ecx, dword ptr [ecx + 0x84]'),
    (0x005a10e5, 'push', '3'),
    (0x005a10e7, 'call', '0x5969a0'),
    (0x005a10f1, 'call', 'dword ptr [edx + 0x28]'),
    (0x005ba8d5, 'call', '0x596670'),
    (0x005976d0, 'mov', 'eax, dword ptr [ecx + 4]'),
    (0x005976d3, 'mov', 'edx, dword ptr [0x6d8590]'),
    (0x005976d9, 'mov', 'ecx, dword ptr [eax + 4]'),
    (0x005976de, 'je', '0x5976fa'),
    (0x0059667e, 'call', '0x5976d0'),
    (0x00596683, 'mov', 'esi, dword ptr [esi + 4]'),
    (0x0059668a, 'cmp', 'eax, esi'),
    (0x0059668c, 'je', '0x59669f'),
    (0x005966ac, 'je', '0x5966b7'),
    (0x005966b7, 'xor', 'eax, eax'),
    (0x00596595, 'lea', 'ecx, [esi + 0x20]'),
    (0x005965a0, 'call', '0x596c80'),
    (0x005965b1, 'add', 'esi, 0xc'),
    (0x005965cd, 'call', '0x596ba0'),
    (0x00596a57, 'mov', 'ecx, dword ptr [esi + 8]'),
    (0x00596a5e, 'call', 'dword ptr [eax]'),
    (0x005baf7b, 'lea', 'eax, [ebx + 0x5c]'),
    (0x005baf7e, 'mov', 'ecx, 9'),
    (0x005baf8f, 'lea', 'esi, [ebx + 0x70]'),
]


def audit(executable):
    data = executable.read_bytes()
    if hashlib.sha256(data).hexdigest() != PIN:
        raise ValueError('Construction registry audit requires the pinned executable')
    context_path = ROOT/'scripts/audit-native-construction-finalizer.py'
    spec = importlib.util.spec_from_file_location('construction_context', context_path)
    context = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(context)
    first = context.audit(executable)
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    rows, ranges = {}, []
    for label, start, end in RANGES:
        decoded = [dict(address=f'{i.address:08x}', bytes=i.bytes.hex(),
                        mnemonic=i.mnemonic, operands=i.op_str)
                   for i in decoder.disasm(pe.get_data(start-base, end-start), start)]
        if sum(len(bytes.fromhex(i['bytes'])) for i in decoded) != end-start:
            raise ValueError(f'Incomplete registry range {label}')
        if decoded[-1]['mnemonic'] != 'ret':
            raise ValueError(f'Registry range does not end at return: {label}')
        rows.update({int(i['address'], 16): i for i in decoded})
        ranges.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}', instructions=decoded))
    for at, mnemonic, operands in ANCHORS:
        row = rows.get(at)
        if not row or (row['mnemonic'], row['operands']) != (mnemonic, operands):
            raise ValueError(f'Construction registry anchor changed at {at:08x}')
    slots = []
    for table, offset, target in [(0x0068a3a4, 0, 0x00596570),
                                  (0x0068a3a4, 0x28, 0x005ba8d0),
                                  (0x0068a2ec, 0x40, 0x005baf70),
                                  (0x0068a2ec, 0x6c, 0x005a12e0)]:
        if struct.unpack('<I', pe.get_data(table+offset-base, 4))[0] != target:
            raise ValueError('Construction registry vtable changed')
        slots.append(dict(table=f'{table:08x}', offset=offset, target=f'{target:08x}'))
    return dict(executableSha256=PIN, verifiedInstructionAnchors=len(ANCHORS), ranges=ranges,
        vtableSlots=slots, firstFinalizerContext=first['firstNormalFinalizer'],
        constructionContextSourceSha256=hashlib.sha256(context_path.read_bytes()).hexdigest(),
        initialRegistry=dict(worldPointerOffset=0x84, containerSentinelOffset=4, containerCountOffset=8,
            successfulSetupGroupCount=1, groupKindOffset=4, groupKind=3, groupVtable='0068a3a4',
            actorList=dict(embeddedHeadOffset=0x0c, headValue=0, nextOffset=0x10,
                previousOffset=0x14, emptyNextAndPrevious='group + 0x0c', countOffset=0x18, count=0),
            actorTree=dict(headerOffset=0x24, headerLeftAndRight='header',
                headerParent='global nil from 006d8590', countOffset=0x2c, count=0)),
        emptyActorIdQuery=dict(lowerBoundEntry='005976d0', lowerBoundEmptyReturn='005976fa',
            groupQueryEntry='00596670', groupQueryEmptyReturn='005966b7',
            returnsZeroWithoutReadingKeyWhenHeaderParentIsGlobalNil=True),
        registrationTouchesBothActorListAndTree=True,
        runtimeGuardRequirements=['Require a valid registry container with one well-linked group-3 node and the expected group vtable.',
            'Require both actor-list links/count and actor-tree header/root/count to match the empty shape.',
            'Also require the earlier exact construction frame and fresh-generation scope; empty lookup or spatial-grid pointer alone is insufficient.'],
        completeConstructorCallClosureQualified=False, allActorsAbsentQualified=False,
        unregisteredActorsAndGlobalAliasesQualified=False, geometryUnchangedAfterConstructionQualified=False,
        runtimeGuardInstalled=False, safeBorderMutationHookQualified=False, liveNativePagingQualified=False,
        browserUsed=False, nativeInstructionsExecuted=False, nativeBuildRun=False,
        limitations='Pinned successful-allocation setup shape and local registry paths only. Does not prove shape still holds at a live callback, close all constructor/math/resource helpers, prove no unregistered actors or global aliases, or execute actor insertion/removal.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path, default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output', type=Path, default=ROOT/'output/native-construction-registry-audit.json')
    args = parser.parse_args()
    args.output.unlink(missing_ok=True)
    report = audit(args.exe)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(dict(passed=True, anchors=report['verifiedInstructionAnchors'],
        initialGroupCount=1, initialActorListAndTreeCounts=0,
        allActorsAbsentQualified=False, browserUsed=False, gameLaunches=0)))


if __name__ == '__main__':
    main()

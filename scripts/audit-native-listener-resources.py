#!/usr/bin/env python3
"""Pin derived listener cleanup and embedded-value ownership without execution."""
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
DEPENDENCY = ROOT/'scripts/audit-native-notification-lifetime.py'
FLOW_SOURCE = ROOT/'scripts/audit-native-placement-callbacks.py'
RANGES = [
    ('listener-a-deleting-wrapper', 0x005c3ae0, 0x005c3afe),
    ('listener-a-destructor', 0x005c3b00, 0x005c3b70),
    ('listener-b-deleting-wrapper', 0x005c4220, 0x005c423e),
    ('listener-b-destructor', 0x005c4570, 0x005c4640),
    ('listener-c-deleting-wrapper', 0x005c7c20, 0x005c7c3e),
    ('listener-c-destructor', 0x005c7c40, 0x005c7d51),
    ('drawing-buffer-destructor', 0x00505490, 0x005054b8),
    ('listener-b-embedded-cleanup', 0x005f1290, 0x005f1302),
    ('listener-c-embedded-cleanup', 0x0050aa00, 0x0050aa19),
    ('embedded-value-deleting-wrapper', 0x005c7810, 0x005c7830),
    ('embedded-value-vtable-reset', 0x005c7830, 0x005c7837),
    ('listener-c-collection-insertion', 0x005c7930, 0x005c79f2),
    ('embedded-value-copy', 0x005c9d10, 0x005c9d4c),
]
SLOTS = [(0x0068a678, 0, 0x005c3ae0), (0x0068a784, 0, 0x005c4220),
    (0x0068a8f0, 0, 0x005c7c20), (0x0068a8e0, 0, 0x005c7810)]
ANCHORS = [
    (0x005c3ae3, 'call', '0x5c3b00'),
    (0x005c3b38, 'mov', 'ecx, dword ptr [esi + 0x58]'),
    (0x005c3b45, 'mov', 'ecx, dword ptr [esi + 0x54]'),
    (0x005c3b48, 'mov', 'edx, dword ptr [esi + 0x60]'),
    (0x005c3b4e, 'call', 'dword ptr [eax + 0x2c]'),
    (0x005c3b5b, 'call', '0x5c2760'),
    (0x005c4223, 'call', '0x5c4570'),
    (0x005c45ac, 'cmp', 'ecx, dword ptr [0x7191b4]'),
    (0x005c4597, 'xor', 'ebx, ebx'),
    (0x005c45b6, 'call', 'dword ptr [eax + 0xc]'),
    (0x005c45b9, 'mov', 'dword ptr [esi + 0x5c], ebx'),
    (0x005c45bd, 'mov', 'edi, dword ptr [esi + 0xe8]'),
    (0x005c45c9, 'call', '0x505490'),
    (0x005c45cf, 'call', '0x645bc0'),
    (0x005c45dd, 'mov', 'dword ptr [esi + 0xe8], ebx'),
    (0x005c45e8, 'mov', 'ecx, dword ptr [0x71c81c]'),
    (0x005c45f1, 'call', 'dword ptr [edx + 0x2c]'),
    (0x005c45fa, 'mov', 'dword ptr [esi + 0x138], ebx'),
    (0x005c4608, 'call', 'dword ptr [eax + 8]'),
    (0x005c460b, 'lea', 'ecx, [esi + 0xf4]'),
    (0x005c4611, 'mov', 'dword ptr [esi + 0x13c], ebx'),
    (0x005c461b, 'call', '0x5f1290'),
    (0x005c462a, 'call', '0x5c2760'),
    (0x005c7c23, 'call', '0x5c7c40'),
    (0x005c7c66, 'mov', 'ecx, dword ptr [edi + 0x90]'),
    (0x005c7c6c, 'xor', 'esi, esi'),
    (0x005c7c7c, 'call', 'dword ptr [eax + 0xc]'),
    (0x005c7c7f, 'mov', 'dword ptr [edi + 0x90], esi'),
    (0x005c7c85, 'mov', 'ebx, dword ptr [edi + 0x98]'),
    (0x005c7c91, 'call', '0x505490'),
    (0x005c7c97, 'call', '0x645bc0'),
    (0x005c7ca2, 'mov', 'dword ptr [edi + 0x98], esi'),
    (0x005c7cb0, 'call', 'dword ptr [edx + 8]'),
    (0x005c7cbd, 'mov', 'ebx, dword ptr [edi + 0x88]'),
    (0x005c7cd3, 'push', '0'),
    (0x005c7cda, 'mov', 'dword ptr [eax], ecx'),
    (0x005c7ce1, 'lea', 'ecx, [esi + 8]'),
    (0x005c7ce4, 'mov', 'dword ptr [edx + 4], eax'),
    (0x005c7ce7, 'mov', 'edx, dword ptr [ecx]'),
    (0x005c7ce9, 'call', 'dword ptr [edx]'),
    (0x005c7cec, 'call', '0x645bc0'),
    (0x005c7cfd, 'mov', 'dword ptr [edi + 0x8c], ecx'),
    (0x005c7d0e, 'call', '0x645bc0'),
    (0x005c7d16, 'lea', 'ecx, [edi + 0x7c]'),
    (0x005c7d19, 'mov', 'dword ptr [edi + 0x88], esi'),
    (0x005c7d1f, 'mov', 'dword ptr [edi + 0x8c], esi'),
    (0x005c7d2a, 'call', '0x50aa00'),
    (0x005c7d39, 'call', '0x5c2760'),
    (0x00505492, 'lea', 'esi, [ecx + 0x3c]'),
    (0x00505495, 'mov', 'edi, 2'),
    (0x005054a1, 'call', '0x64d4b6'),
    (0x005054a9, 'mov', 'dword ptr [esi], 0'),
    (0x005054af, 'add', 'esi, 4'),
    (0x005054b3, 'jne', '0x50549a'),
    (0x005c7810, 'mov', 'al, byte ptr [esp + 4]'),
    (0x005c7817, 'test', 'al, 1'),
    (0x005c7819, 'mov', 'dword ptr [esi], 0x68a8e0'),
    (0x005c781f, 'je', '0x5c782a'),
    (0x005c7822, 'call', '0x645bc0'),
    (0x005c7830, 'mov', 'dword ptr [ecx], 0x68a8e0'),
    (0x005c7984, 'mov', 'esi, dword ptr [ebx + 8]'),
    (0x005c7987, 'push', '0x24'),
    (0x005c7994, 'call', '0x64c616'),
    (0x005c79b9, 'lea', 'ecx, [eax + 8]'),
    (0x005c79d2, 'call', '0x5c9d10'),
    (0x005c79d7, 'mov', 'eax, dword ptr [ebx + 0xc]'),
    (0x005c79de, 'inc', 'eax'),
    (0x005c79e0, 'mov', 'dword ptr [ebx + 0xc], eax'),
    (0x005c9d39, 'mov', 'dword ptr [eax + 0x14], edx'),
    (0x005c9d3f, 'mov', 'dword ptr [eax + 0x18], ecx'),
    (0x005c9d42, 'mov', 'dword ptr [eax], 0x68a8e0'),
]


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def audit(executable):
    data = executable.read_bytes()
    if hashlib.sha256(data).hexdigest() != PIN:
        raise ValueError('Listener resource audit requires the pinned executable')
    prior = load(DEPENDENCY, 'listener_lifetime').audit(executable)
    flow = load(FLOW_SOURCE, 'listener_flow')
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    ranges, rows = [], {}
    for label, start, end in RANGES:
        instructions = [dict(address=f'{i.address:08x}', bytes=i.bytes.hex(),
            mnemonic=i.mnemonic, operands=i.op_str)
            for i in decoder.disasm(pe.get_data(start-base, end-start), start)]
        if sum(len(bytes.fromhex(i['bytes'])) for i in instructions) != end-start:
            raise ValueError(f'Incomplete listener resource range: {label}')
        ranges.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}',
            instructions=instructions, **flow.inspect_flow(instructions)))
        rows.update({int(i['address'], 16): i for i in instructions})
    for at, mnemonic, operands in ANCHORS:
        row = rows.get(at)
        if not row or (row['mnemonic'], row['operands']) != (mnemonic, operands):
            raise ValueError(f'Listener resource anchor changed at {at:08x}')
    slots = []
    for table, offset, target in SLOTS:
        if struct.unpack('<I', pe.get_data(table+offset-base, 4))[0] != target:
            raise ValueError('Listener resource vtable target changed')
        slots.append(dict(table=f'{table:08x}', offset=offset, target=f'{target:08x}'))
    starts = {r['start'] for r in ranges}
    outside = sorted({c['target'] for r in ranges for c in r['calls']
        if c['direct'] and c['target'] not in starts})
    indirect = [dict(range=r['start'], **c) for r in ranges for c in r['calls'] if not c['direct']]
    return dict(executableSha256=PIN, precedingLifetimeAnchors=prior['verifiedInstructionAnchors'],
        verifiedInstructionAnchors=len(ANCHORS), ranges=ranges, vtableSlots=slots,
        dependencySourceSha256={str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in [DEPENDENCY, FLOW_SOURCE]},
        directDependenciesOutsideRanges=outside, indirectCallSites=indirect,
        derivedDestructors=[dict(table='0068a678', wrapper='005c3ae0', body='005c3b00'),
            dict(table='0068a784', wrapper='005c4220', body='005c4570', drawingObjectOffset=0xe8),
            dict(table='0068a8f0', wrapper='005c7c20', body='005c7c40', drawingObjectOffset=0x98)],
        commonBaseCleanup='005c2760',
        drawingCleanup=dict(target='00505490', pointerOffsets=[0x3c, 0x40], iterations=2,
            originalFree='0064d4b6', pointerFieldsCleared=True, rectangleCountsResetByThisBody=False,
            enclosingDrawingObjectFree='00645bc0'),
        listenerCCollection=dict(headOffset=0x88, countOffset=0x8c, nodeNextOffset=0,
            nodePreviousOffset=4, embeddedValueOffset=8, valueThisIsNodePlusEight=True,
            valueThisIsDereferencedPayloadPointer=False, valueVirtualSlot=0, valueDeletionFlag=0,
            nodeFreeAfterEmbeddedValueCleanup=True, sentinelFreed=True, headAndCountCleared=True,
            insertion='005c7930', nodeAllocationBytes=36, valueCopy='005c9d10',
            copiedValueBytes=28, initialValueVtable='0068a8e0', initialValueDeletingTarget='005c7810',
            initialValueFlagZeroCleanupIsVtableResetOnly=True, insertionChecksMaximumCount=False,
            opaqueCopiedValueWordOffsets=[0x14, 0x18], opaqueWordOwnershipQualified=False,
            insertedValueInitialTargetQualified=True,
            embeddedValueLiveVtableQualified=False, embeddedValueTypeQualified=False),
        cleanupOrder=['Derived resources and embedded collections', 'Base listener links and resources',
            'Optional listener object free in deleting wrapper'],
        scopedDetachRequirements=['Identify live overrides and references before any actor or resource is unloaded.',
            'Unlink membership and back-pointer without destroying unrelated listeners.',
            'Embedded collection values use the address node+8; do not treat them as a pointer stored there.',
            'Resolve virtual cleanup recipients and embedded value type before reusing this destruction path.',
            'Bound collection node count externally and establish ownership of both opaque copied words.',
            'Drawing destructor clears pointers, not counts; it is not a reusable buffer reset operation.'],
        localDerivedResourcePathsQualified=True, fullListenerDestructionClosureQualified=False,
        actorReferenceRetentionExcluded=False, liveListenerSetQualified=False,
        scopedListenerDetachQualified=False, boundedNativeSimulationQualified=False,
        liveNativePagingQualified=False, nativeInstructionsExecuted=False, browserUsed=False,
        nativeBuildRun=False, gameLaunched=False,
        limitations='Pinned initial derived listener cleanup bodies and local branch targets only. Indirect recipients, embedded value type, transitive dependencies, live identity/membership, callback mutation and all actor references remain unqualified. No destructor, allocator or native instruction executes.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path, default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output', type=Path, default=ROOT/'output/native-listener-resources-audit.json')
    args = parser.parse_args()
    args.output.unlink(missing_ok=True)
    report = audit(args.exe)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(dict(passed=True, anchors=report['verifiedInstructionAnchors'],
        ranges=len(report['ranges']), instructions=sum(len(r['instructions']) for r in report['ranges']),
        embeddedValueThis='node+8', gameLaunches=0)))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Pinned actor initialization dependencies; no native instruction execution."""
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
DISPATCH_PATH = ROOT/'scripts/audit-native-placement-dispatch.py'
RANGES = [
    ('descriptor-index-query', 0x005a1960, 0x005a19aa),
    ('descriptor-selection', 0x005a1a00, 0x005a1a26),
    ('actor-field-update', 0x005a2670, 0x005a2689),
    ('descriptor-rebind-and-position', 0x005a22c0, 0x005a2361),
    ('optional-agent-setup', 0x005a2430, 0x005a24bf),
    ('global-manager-notification', 0x005b3550, 0x005b3565),
    ('zero-result', 0x005a2250, 0x005a2253),
    ('descriptor-value-query', 0x005a1920, 0x005a195e),
    ('actor-position-update', 0x005ad7a0, 0x005ad84e),
    ('actor-cell-update', 0x005ad470, 0x005ad4b1),
    ('recursive-position-refresh', 0x005ad540, 0x005ad5aa),
    ('recursive-parent-position', 0x005ad5b0, 0x005ad64f),
    ('attached-actor-notification', 0x005adca0, 0x005adcf3),
    ('spatial-grid-insertion-wrapper', 0x005ad3e0, 0x005ad400),
    ('spatial-grid-removal-wrapper', 0x005ad400, 0x005ad420),
    ('recursive-parent-cell', 0x005ad420, 0x005ad465),
    ('actor-bounds-refresh', 0x005b36c0, 0x005b37bb),
]
SLOTS = [(0x3c, 0x005a1920), (0x9c, 0x005ad470), (0xbc, 0x005adca0),
         (0x94, 0x005ad3e0), (0x98, 0x005ad400), (0xc4, 0x005b36c0)]
ANCHORS = [
    (0x005a1960, 'mov', 'eax, dword ptr [ecx + 0x80]'),
    (0x005a1987, 'jge', '0x5a19a5'),
    (0x005a1998, 'mov', 'dword ptr [edx], esi'),
    (0x005a19a2, 'ret', '8'),
    (0x005a1a0b, 'call', 'dword ptr [eax + 0x3c]'),
    (0x005a1a12, 'mov', 'dword ptr [esi + 0x78], edi'),
    (0x005a1a15, 'mov', 'dword ptr [esi + 0x44], eax'),
    (0x005a267b, 'mov', 'dword ptr [ecx + 0x70], eax'),
    (0x005a2680, 'call', 'dword ptr [eax + 0xb8]'),
    (0x005a22c9, 'mov', 'edi, dword ptr [0x71c6c8]'),
    (0x005a22e5, 'call', '0x42c770'),
    (0x005a22fc, 'mov', 'dword ptr [esi + 0x6c], ebp'),
    (0x005a22ff, 'mov', 'dword ptr [esi + 0x80], eax'),
    (0x005a2330, 'call', 'dword ptr [edx]'),
    (0x005a2350, 'call', '0x5ad7a0'),
    (0x005a2460, 'call', '0x426b10'),
    (0x005a2499, 'call', '0x628010'),
    (0x005a24aa, 'call', '0x628c60'),
    (0x005a24b1, 'call', '0x628410'),
    (0x005b3550, 'mov', 'eax, dword ptr [0x71c68c]'),
    (0x005b3557, 'je', '0x5b3564'),
    (0x005b3559, 'mov', 'eax, dword ptr [eax + 0x1c]'),
    (0x005b355c, 'push', 'ecx'),
    (0x005b355d, 'mov', 'ecx, eax'),
    (0x005b3561, 'call', 'dword ptr [edx + 8]'),
    (0x005a2250, 'xor', 'eax, eax'),
    (0x005a2252, 'ret', ''),
    (0x005a194e, 'cmp', 'ecx, 8'),
    (0x005a1951, 'jl', '0x5a1946'),
    (0x005ad7bb, 'call', 'dword ptr [eax + 0xb8]'),
    (0x005ad7c5, 'call', 'dword ptr [edx + 0xbc]'),
    (0x005ad7d1, 'mov', 'dword ptr [esi + 0x48], ecx'),
    (0x005ad7db, 'mov', 'dword ptr [esi + 0x4c], edx'),
    (0x005ad7e4, 'mov', 'dword ptr [esi + 0x50], eax'),
    (0x005ad7e7, 'call', '0x5ad5b0'),
    (0x005ad81e, 'call', 'dword ptr [edx + 0x9c]'),
    (0x005ad82e, 'call', '0x5ad540'),
    (0x005ad837, 'call', 'dword ptr [edx + 0xb8]'),
    (0x005ad841, 'call', 'dword ptr [eax + 0xbc]'),
    (0x005ad484, 'call', 'dword ptr [eax + 0x98]'),
    (0x005ad490, 'mov', 'dword ptr [esi + 0x54], ecx'),
    (0x005ad49a, 'mov', 'dword ptr [esi + 0x58], edx'),
    (0x005ad49d, 'call', 'dword ptr [eax + 0x94]'),
    (0x005ad4a4, 'call', 'dword ptr [0x6ce230]'),
    (0x005ad549, 'call', 'dword ptr [eax + 0xc4]'),
    (0x005ad584, 'call', '0x5ad540'),
    (0x005ad594, 'mov', 'edx, dword ptr [ebp + 0x84]'),
    (0x005ad59a, 'mov', 'ecx, dword ptr [edx + 0x30]'),
    (0x005ad5a4, 'call', 'dword ptr [eax + 0x18]'),
    (0x005ad5ca, 'call', '0x5a10d0'),
    (0x005ad5ed, 'call', '0x5ad5b0'),
    (0x005ad60b, 'call', '0x5ad5b0'),
    (0x005adcdb, 'call', 'dword ptr [edx + 0xb8]'),
    (0x005ad3f3, 'mov', 'ecx, dword ptr [eax + 0x88]'),
    (0x005ad3f9, 'call', '0x5b8630'),
    (0x005ad413, 'mov', 'ecx, dword ptr [eax + 0x88]'),
    (0x005ad419, 'call', '0x5b88a0'),
    (0x005ad437, 'call', '0x5a10d0'),
    (0x005ad447, 'call', '0x5ad420'),
    (0x005b36d6, 'call', '0x5ef6b0'),
    (0x005b36f3, 'call', '0x5b3570'),
    (0x005b3701, 'call', 'dword ptr [eax + 0xcc]'),
    (0x005b3726, 'call', 'dword ptr [edx + 0xd0]'),
]


def inspect_flow(instructions):
    """Inventory calls and require all local jumps to decoded boundaries."""
    boundaries = {i['address'] for i in instructions}
    calls, branches = [], []
    for row in instructions:
        mnemonic, operand = row['mnemonic'], row['operands']
        if mnemonic == 'call':
            direct = operand.startswith('0x')
            calls.append(dict(address=row['address'], operands=operand,
                direct=direct, target=f'{int(operand, 16):08x}' if direct else None))
        elif mnemonic.startswith('j') or mnemonic.startswith('loop'):
            if not operand.startswith('0x'):
                raise ValueError('Indirect local branch requires separate closure')
            target = f'{int(operand, 16):08x}'
            if target not in boundaries:
                raise ValueError('Local branch leaves range or misses instruction boundary')
            branches.append(dict(address=row['address'], target=target))
    if not instructions or instructions[-1]['mnemonic'] != 'ret':
        raise ValueError('Callback range must end at a return')
    return dict(calls=calls, localBranches=branches, localBranchTargetsClosed=True)


def audit(executable):
    data = executable.read_bytes()
    if hashlib.sha256(data).hexdigest() != PIN:
        raise ValueError('Placement callback audit requires the pinned executable')
    spec = importlib.util.spec_from_file_location('dispatch_dependency', DISPATCH_PATH)
    dispatch = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(dispatch)
    prior = dispatch.audit(executable)
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    ranges, rows = [], {}
    for label, start, end in RANGES:
        decoded = [dict(address=f'{i.address:08x}', bytes=i.bytes.hex(),
            mnemonic=i.mnemonic, operands=i.op_str)
            for i in decoder.disasm(pe.get_data(start-base, end-start), start)]
        if sum(len(bytes.fromhex(i['bytes'])) for i in decoded) != end-start:
            raise ValueError(f'Incomplete callback range {label}')
        flow = inspect_flow(decoded)
        ranges.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}',
            instructions=decoded, **flow))
        rows.update({int(i['address'], 16): i for i in decoded})
    for at, mnemonic, operands in ANCHORS:
        row = rows.get(at)
        if not row or (row['mnemonic'], row['operands']) != (mnemonic, operands):
            raise ValueError(f'Placement callback anchor changed at {at:08x}')
    slots = []
    for _, _, _, table in dispatch.FACTORIES:
        for offset, target in SLOTS:
            if struct.unpack('<I', pe.get_data(table+offset-base, 4))[0] != target:
                raise ValueError('Nested actor vtable target changed')
            slots.append(dict(table=f'{table:08x}', offset=offset, target=f'{target:08x}'))
    pure = ['005a1960', '005a1920', '005a2250']
    if any(r['calls'] for r in ranges if r['start'] in pure):
        raise ValueError('Previously call-free descriptor/zero method gained a call')
    starts = {r['start'] for r in ranges}
    external = sorted({c['target'] for r in ranges for c in r['calls']
        if c['direct'] and c['target'] not in starts})
    indirect = [dict(range=r['start'], **c) for r in ranges for c in r['calls'] if not c['direct']]
    return dict(executableSha256=PIN, dispatchDependencySourceSha256=hashlib.sha256(DISPATCH_PATH.read_bytes()).hexdigest(),
        precedingDispatchAnchors=prior['verifiedInstructionAnchors'], verifiedInstructionAnchors=len(ANCHORS),
        ranges=ranges, supplementalVtableSlots=slots, callFreeRanges=pure,
        directDependenciesOutsideRanges=external, indirectCallSites=indirect,
        globalNotification=dict(globalPointerAddress='0071c68c', managerPointerOffset=0x1c,
            managerVirtualSlot=8, actorPassedAsArgument=True, targetResolved=False),
        hierarchyDependencies=dict(parentIdOffset=0x74, registryLookup='005a10d0',
            attachedActorContainerOffset=0x94, recursiveMethods=['005ad540', '005ad5b0', '005ad420'],
            recursionDepthAndCyclesQualified=False),
        positionUpdateTouchesSpatialGrid=True, worldSpatialGridOffset=0x88,
        spatialInsertTarget='005b8630', spatialRemoveTarget='005b88a0',
        dynamicFunctionPointerAddress='006ce230', dynamicFunctionTargetResolved=False,
        worldObserverPointerOffset=0x30, worldObserverVirtualSlot=0x18, worldObserverTargetResolved=False,
        localInstructionAndBranchInventoryQualified=True, fullCallbackCallClosureQualified=False,
        globalManagerLifetimeQualified=False, allLaterGeometryEditsExcluded=False,
        safeBorderMutationHookQualified=False, liveNativePagingQualified=False,
        nativeInstructionsExecuted=False, browserUsed=False, nativeBuildRun=False,
        limitations='Pinned local instruction and branch inventory only. Supplemental tables are initial factory values. External callees, global manager, component dispatch, observer, dynamic function pointer and recursive hierarchy lifetime are not closed. No actor construction, memory release or live border mutation is qualified.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path, default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output', type=Path, default=ROOT/'output/native-placement-callbacks-audit.json')
    args = parser.parse_args()
    args.output.unlink(missing_ok=True)
    report = audit(args.exe)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(dict(passed=True, ranges=len(report['ranges']), anchors=report['verifiedInstructionAnchors'],
        supplementalSlots=len(report['supplementalVtableSlots']), spatialGridDependency=True,
        globalManagerLifetimeQualified=False, gameLaunches=0)))


if __name__ == '__main__':
    main()

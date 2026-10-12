#!/usr/bin/env python3
"""Pinned notification dispatcher/listener ownership, without native execution."""
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
DEPENDENCY = ROOT/'scripts/audit-native-placement-callbacks.py'
RANGES = [
    ('actor-global-notification', 0x005b3550, 0x005b3565),
    ('global-owner-constructor', 0x005978c0, 0x00597955),
    ('global-owner-deleting-wrapper', 0x00597960, 0x0059797e),
    ('global-owner-destructor', 0x00597980, 0x005979d7),
    ('global-owner-clear', 0x00597ad0, 0x00597aeb),
    ('global-owner-replacement', 0x00597af0, 0x00597b16),
    ('derived-owner-deleting-wrapper', 0x00416020, 0x0041603e),
    ('derived-owner-destructor-tail', 0x004bdc30, 0x004bdc3b),
    ('dispatcher-constructor', 0x005c3550, 0x005c357f),
    ('dispatcher-deleting-wrapper', 0x005c3580, 0x005c359e),
    ('dispatcher-destructor', 0x005c35a0, 0x005c3647),
    ('listener-registration', 0x005c3650, 0x005c369f),
    ('actor-notification-broadcast', 0x005c33d0, 0x005c3421),
    ('alternate-actor-broadcast', 0x005c3430, 0x005c3481),
    ('listener-base-constructor', 0x005c2630, 0x005c2739),
    ('listener-deleting-wrapper', 0x005c2740, 0x005c275e),
    ('listener-base-destructor', 0x005c2760, 0x005c28d1),
    ('listener-base-slot20', 0x005c2b60, 0x005c2b63),
    ('listener-base-slot24', 0x005c2b70, 0x005c2b73),
    ('list-remove-first-matching-value', 0x005c3190, 0x005c31d6),
    ('list-node-unlink', 0x005c37b0, 0x005c37e4),
    ('list-first-iterator', 0x005c3850, 0x005c385e),
    ('list-iterator-postincrement', 0x005c3860, 0x005c386f),
    ('derived-listener-constructor-a', 0x005c3890, 0x005c3ade),
    ('derived-listener-constructor-b', 0x005c4040, 0x005c421f),
    ('derived-listener-constructor-c', 0x005c7b30, 0x005c7c15),
]
SLOTS = [
    (0x00689834, 0, 0x00597960), (0x0067f85c, 0, 0x00416020),
    (0x0068a640, 0, 0x005c3580), (0x0068a640, 4, 0x005c3650),
    (0x0068a640, 8, 0x005c33d0), (0x0068a640, 0x0c, 0x005c3430),
    (0x0068a54c, 0, 0x005c2740), (0x0068a54c, 0x20, 0x005c2b60),
    (0x0068a54c, 0x24, 0x005c2b70),
    (0x0068a678, 0x20, 0x005c2b60), (0x0068a678, 0x24, 0x005c2b70),
    (0x0068a784, 0x20, 0x005c49d0), (0x0068a784, 0x24, 0x005c4ab0),
    (0x0068a8f0, 0x20, 0x005c85d0), (0x0068a8f0, 0x24, 0x005c8620),
]
ANCHORS = [
    (0x005b3559, 'mov', 'eax, dword ptr [eax + 0x1c]'),
    (0x005b3561, 'call', 'dword ptr [edx + 8]'),
    (0x005978ef, 'push', '0x14'),
    (0x0059791f, 'call', '0x5c3550'),
    (0x00597932, 'mov', 'dword ptr [esi + 0x1c], eax'),
    (0x005979c4, 'mov', 'ecx, dword ptr [esi + 0x1c]'),
    (0x005979cf, 'call', 'dword ptr [edx]'),
    (0x005979d1, 'mov', 'dword ptr [esi + 0x1c], edi'),
    (0x00597ade, 'call', 'dword ptr [eax]'),
    (0x00597ae0, 'mov', 'dword ptr [0x71c68c], 0'),
    (0x00597afe, 'call', 'dword ptr [eax]'),
    (0x00597b04, 'mov', 'dword ptr [0x71c68c], ecx'),
    (0x00597b0f, 'mov', 'dword ptr [0x71c68c], edx'),
    (0x00416023, 'call', '0x4bdc30'),
    (0x004bdc30, 'mov', 'dword ptr [ecx], 0x67f85c'),
    (0x004bdc36, 'jmp', '0x597980'),
    (0x005c355d, 'call', '0x64c616'),
    (0x005c3565, 'mov', 'dword ptr [eax], eax'),
    (0x005c3567, 'mov', 'dword ptr [eax + 4], eax'),
    (0x005c356a, 'mov', 'dword ptr [esi + 8], eax'),
    (0x005c356d, 'mov', 'dword ptr [esi + 0xc], 0'),
    (0x005c3574, 'mov', 'dword ptr [esi], 0x68a640'),
    (0x005c365d, 'call', '0x64c616'),
    (0x005c3682, 'mov', 'ecx, dword ptr [esp + 0x10]'),
    (0x005c368d, 'mov', 'dword ptr [eax], ecx'),
    (0x005c3695, 'mov', 'dword ptr [ebx + 0xc], eax'),
    (0x005c3698, 'mov', 'dword ptr [ecx + 4], ebx'),
    (0x005c33de, 'mov', 'esi, dword ptr [ecx + 8]'),
    (0x005c33e9, 'mov', 'ecx, dword ptr [0x71c670]'),
    (0x005c33f1, 'push', 'ecx'),
    (0x005c33f2, 'push', 'ebx'),
    (0x005c33f5, 'call', 'dword ptr [eax + 0x20]'),
    (0x005c3406, 'cmp', 'edx, esi'),
    (0x005c3455, 'call', 'dword ptr [eax + 0x24]'),
    (0x005c35e1, 'call', 'dword ptr [eax]'),
    (0x005c35e3, 'jmp', '0x5c35cd'),
    (0x005c3608, 'call', '0x645bc0'),
    (0x005c361f, 'call', '0x645bc0'),
    (0x005c362b, 'mov', 'dword ptr [edi + 8], 0'),
    (0x005c3632, 'mov', 'dword ptr [edi + 0xc], 0'),
    (0x005c268d, 'mov', 'dword ptr [esi], 0x68a54c'),
    (0x005c2718, 'mov', 'dword ptr [esi + 4], ebx'),
    (0x005c2743, 'call', '0x5c2760'),
    (0x005c27f1, 'mov', 'ebp, dword ptr [esi + 4]'),
    (0x005c2816, 'cmp', 'dword ptr [eax + 8], esi'),
    (0x005c2843, 'mov', 'dword ptr [ecx], edx'),
    (0x005c284a, 'mov', 'dword ptr [ecx + 4], edx'),
    (0x005c284d, 'call', '0x645bc0'),
    (0x005c2858, 'dec', 'eax'),
    (0x005c2859, 'mov', 'dword ptr [edi + 8], eax'),
    (0x005c285c, 'mov', 'edi, dword ptr [esi + 0x4c]'),
    (0x005c2b60, 'ret', '8'),
    (0x005c2b70, 'ret', '8'),
    (0x005c31a4, 'cmp', 'dword ptr [eax + 8], edx'),
    (0x005c31c3, 'call', '0x645bc0'),
    (0x005c31cf, 'mov', 'dword ptr [esi + 0xc], eax'),
    (0x005c37ca, 'call', '0x645bc0'),
    (0x005c38d8, 'call', '0x5c2630'),
    (0x005c38ec, 'mov', 'dword ptr [esi], 0x68a678'),
    (0x005c407b, 'call', '0x5c2630'),
    (0x005c40b5, 'mov', 'dword ptr [esi], 0x68a784'),
    (0x005c7b69, 'call', '0x5c2630'),
    (0x005c7bb9, 'mov', 'dword ptr [esi], 0x68a8f0'),
]


def audit(executable):
    data = executable.read_bytes()
    if hashlib.sha256(data).hexdigest() != PIN:
        raise ValueError('Notification lifetime audit requires the pinned executable')
    spec = importlib.util.spec_from_file_location('callback_dependency', DEPENDENCY)
    callbacks = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(callbacks)
    preceding = callbacks.audit(executable)
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    rows, ranges = {}, []
    for label, start, end in RANGES:
        instructions = [dict(address=f'{i.address:08x}', bytes=i.bytes.hex(),
            mnemonic=i.mnemonic, operands=i.op_str)
            for i in decoder.disasm(pe.get_data(start-base, end-start), start)]
        if sum(len(bytes.fromhex(i['bytes'])) for i in instructions) != end-start:
            raise ValueError(f'Incomplete notification range {label}')
        if start == 0x004bdc30:
            if [(i['mnemonic'], i['operands']) for i in instructions] != [
                ('mov', 'dword ptr [ecx], 0x67f85c'), ('jmp', '0x597980')]:
                raise ValueError('Derived owner tail dependency changed')
            flow = dict(calls=[], localBranches=[], localBranchTargetsClosed=False,
                qualifiedTailDependency='00597980')
        else:
            flow = callbacks.inspect_flow(instructions)
        ranges.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}',
            instructions=instructions, **flow))
        rows.update({int(i['address'], 16): i for i in instructions})
    for at, mnemonic, operands in ANCHORS:
        row = rows.get(at)
        if not row or (row['mnemonic'], row['operands']) != (mnemonic, operands):
            raise ValueError(f'Notification lifetime anchor changed at {at:08x}')
    slots = []
    for table, offset, target in SLOTS:
        if struct.unpack('<I', pe.get_data(table+offset-base, 4))[0] != target:
            raise ValueError('Notification lifetime vtable target changed')
        slots.append(dict(table=f'{table:08x}', offset=offset, target=f'{target:08x}'))
    return dict(executableSha256=PIN, precedingCallbackAnchors=preceding['verifiedInstructionAnchors'],
        callbackDependencySourceSha256=hashlib.sha256(DEPENDENCY.read_bytes()).hexdigest(),
        verifiedInstructionAnchors=len(ANCHORS), ranges=ranges, vtableSlots=slots,
        constructorChainDispatcherTarget='005c33d0', liveDispatcherIdentityQualified=False,
        derivedListenerInitialTargets=[
            dict(constructor='005c3890', table='0068a678', slot20='005c2b60', slot24='005c2b70'),
            dict(constructor='005c4040', table='0068a784', slot20='005c49d0', slot24='005c4ab0'),
            dict(constructor='005c7b30', table='0068a8f0', slot20='005c85d0', slot24='005c8620')],
        derivedNotificationBodiesQualified=False,
        dispatcherShape=dict(size=0x14, vtable='0068a640', listHeadOffset=8, countOffset=0x0c,
            nodeBytes=12, nodeNextOffset=0, nodePreviousOffset=4, nodeValueOffset=8,
            nodeValues='listener objects, not notified actors', initialCount=0),
        registration=dict(target='005c3650', storesListenerBackPointerAtOffset=4,
            addsNodeBeforeSentinel=True, checksExistingMembership=False),
        broadcast=dict(target='005c33d0', listenerVirtualSlot=0x20,
            argumentWords=['notified object', 'global word from 0071c670'],
            rechecksListAfterEachCallback=True, directBodyStoresActorInDispatcherList=False,
            listenersMayRetainActor=True, liveListenerTargetsQualified=False),
        destruction=dict(dispatcherDeletesListenersThroughSlotZero=True,
            listenerBaseDestructorRemovesFirstMatchingManagerNode=True,
            managerDestructionProgressDependsOnListenerCallbacks=True,
            listRemoveHelperDoesNotClearListenerBackPointer=True,
            genericDetachByListRemovalQualified=False),
        requiredPagingInvariants=['Each listener must belong to at most one dispatcher and have exactly one membership node.',
            'A detach operation must account for both the dispatcher node and the listener back-pointer.',
            'Whole-dispatcher destruction owns listeners; it is not a scoped region detach operation.',
            'Qualify live listener overrides and any actor references they retain before unloading actors.'],
        dispatcherAndListenerLocalOwnershipQualified=True,
        fullListenerDestructionClosureQualified=False, globalManagerLifetimeQualified=False,
        actorReferenceRetentionExcluded=False, boundedNativeSimulationQualified=False,
        allLaterGeometryEditsExcluded=False, safeBorderMutationHookQualified=False,
        liveNativePagingQualified=False, nativeInstructionsExecuted=False,
        browserUsed=False, nativeBuildRun=False,
        limitations='Pinned constructor-installed dispatcher and base listener paths only. Global replacement accepts other objects; derived listener overrides, actor retention, callback mutation, allocation failures, duplicate membership and complete resource destruction remain unqualified. No lifetime operation is executed.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path, default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output', type=Path, default=ROOT/'output/native-notification-lifetime-audit.json')
    args = parser.parse_args()
    args.output.unlink(missing_ok=True)
    report = audit(args.exe)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(dict(passed=True, anchors=report['verifiedInstructionAnchors'],
        ranges=len(report['ranges']), slots=len(report['vtableSlots']),
        dispatcherValues='listeners', actorRetentionExcluded=False, gameLaunches=0)))


if __name__ == '__main__':
    main()

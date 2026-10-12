#!/usr/bin/env python3
"""Pin listener peer links and cache argument lineage without native execution."""
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
DEPENDENCY = ROOT/'scripts/audit-native-listener-resources.py'
RANGES = [
    ('base-listener-constructor', 0x005c2630, 0x005c2739),
    ('reciprocal-peer-link', 0x005c2d70, 0x005c2dca),
    ('reciprocal-peer-unlink', 0x005c2dd0, 0x005c2e8e),
    ('peer-list-node-append', 0x005c31e0, 0x005c322c),
    ('peer-list-first-iterator', 0x005c3850, 0x005c385e),
    ('listener-rectangle-query', 0x005c3020, 0x005c3094),
    ('cache-first-key-update', 0x005c7a00, 0x005c7a4e),
    ('cache-first-key-read', 0x005c7a50, 0x005c7a9e),
    ('listener-c-rectangle-transform', 0x005c8230, 0x005c82a8),
    ('listener-c-peer-and-cache-registration', 0x005c88f0, 0x005c893d),
]
SLOTS = [(0x0068a62c, 4, 0x005c31e0),
    *[(table, 0x58, 0x005c3020) for table in [0x0068a54c, 0x0068a678, 0x0068a784, 0x0068a8f0]],
    (0x0068a8f0, 0x98, 0x005c8230), (0x0068a8f0, 0xe8, 0x005c88f0)]
ANCHORS = [
    (0x005c2664, 'mov', 'dword ptr [esi + 0x10], eax'),
    (0x005c2667, 'mov', 'dword ptr [esi + 0x14], ebx'),
    (0x005c266d, 'mov', 'dword ptr [esi + 8], 0x68a62c'),
    (0x005c2678, 'mov', 'ecx, dword ptr [esp + 0x20]'),
    (0x005c2693, 'mov', 'dword ptr [esi + 0x1c], ecx'),
    (0x005c2d7e, 'mov', 'esi, dword ptr [ebp + 0x10]'),
    (0x005c2d81, 'lea', 'ecx, [ebp + 8]'),
    (0x005c2d91, 'cmp', 'edx, edi'),
    (0x005c2d93, 'je', '0x5c2dc3'),
    (0x005c2db6, 'call', 'dword ptr [eax + 4]'),
    (0x005c2db9, 'mov', 'eax, ebp'),
    (0x005c2dbb, 'mov', 'ebp, edi'),
    (0x005c2dbd, 'mov', 'edi, eax'),
    (0x005c2dc1, 'jne', '0x5c2d7e'),
    (0x005c2de3, 'lea', 'ebx, [edi + 0xc]'),
    (0x005c2df6, 'mov', 'ecx, dword ptr [edi + 0x10]'),
    (0x005c2e4c, 'cmp', 'dword ptr [eax + 8], ebp'),
    (0x005c2e69, 'call', '0x645bc0'),
    (0x005c2e75, 'mov', 'dword ptr [edi + 0x14], eax'),
    (0x005c2e78, 'mov', 'eax, edi'),
    (0x005c2e7a, 'mov', 'edi, ebp'),
    (0x005c2e7c, 'mov', 'ebp, eax'),
    (0x005c2e80, 'jne', '0x5c2de3'),
    (0x005c31e8, 'push', '0xc'),
    (0x005c31ed, 'call', '0x64c616'),
    (0x005c3219, 'mov', 'edx, dword ptr [esp + 0x10]'),
    (0x005c321d, 'mov', 'dword ptr [eax], edx'),
    (0x005c3225, 'mov', 'dword ptr [ebx + 0xc], eax'),
    (0x005c3023, 'lea', 'edx, [ecx + 0x24]'),
    (0x005c3063, 'call', 'dword ptr [edx + 0x88]'),
    (0x005c7a21, 'cmp', 'dword ptr [edx + 0x1c], edi'),
    (0x005c7a28, 'mov', 'al, 1'),
    (0x005c7a2a, 'mov', 'dword ptr [edx + 0xc], ebx'),
    (0x005c7a3c, 'mov', 'dword ptr [edx + 0x10], ebx'),
    (0x005c7a71, 'cmp', 'dword ptr [edx + 0x1c], edi'),
    (0x005c7a79, 'mov', 'al, 1'),
    (0x005c7a7b, 'mov', 'dword ptr [esi], ebx'),
    (0x005c7a8c, 'mov', 'dword ptr [esi + 4], ebx'),
    (0x005c823f, 'mov', 'ecx, dword ptr [edi + 0x5c]'),
    (0x005c8283, 'mov', 'dword ptr [esi + 8], ebx'),
    (0x005c88f5, 'mov', 'edi, dword ptr [esp + 0x1c]'),
    (0x005c88fc, 'call', '0x5c2d70'),
    (0x005c890a, 'call', 'dword ptr [eax + 0x58]'),
    (0x005c8916, 'call', 'dword ptr [edx + 0x98]'),
    (0x005c891c, 'mov', 'ecx, dword ptr [esp + 0x20]'),
    (0x005c8920, 'mov', 'eax, dword ptr [edi + 0x1c]'),
    (0x005c8927, 'push', 'ecx'),
    (0x005c8928, 'push', 'edx'),
    (0x005c8929, 'push', 'eax'),
    (0x005c892a, 'lea', 'ecx, [esi + 0x80]'),
    (0x005c8930, 'call', '0x5c7930'),
]


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def audit(executable):
    data = executable.read_bytes()
    if hashlib.sha256(data).hexdigest() != PIN:
        raise ValueError('Listener cache audit requires the pinned executable')
    resources = load(DEPENDENCY, 'listener_resources')
    previous = resources.audit(executable)
    flow = resources.load(resources.FLOW_SOURCE, 'listener_cache_flow')
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    ranges, rows = [], {}
    for label, start, end in RANGES:
        instructions = [dict(address=f'{i.address:08x}', bytes=i.bytes.hex(),
            mnemonic=i.mnemonic, operands=i.op_str)
            for i in decoder.disasm(pe.get_data(start-base, end-start), start)]
        if sum(len(bytes.fromhex(i['bytes'])) for i in instructions) != end-start:
            raise ValueError(f'Incomplete listener cache range: {label}')
        ranges.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}',
            instructions=instructions, **flow.inspect_flow(instructions)))
        rows.update({int(i['address'], 16): i for i in instructions})
    for at, mnemonic, operands in ANCHORS:
        row = rows.get(at)
        if not row or (row['mnemonic'], row['operands']) != (mnemonic, operands):
            raise ValueError(f'Listener cache anchor changed at {at:08x}')
    slots = []
    for table, offset, target in SLOTS:
        if struct.unpack('<I', pe.get_data(table+offset-base, 4))[0] != target:
            raise ValueError('Listener cache vtable word changed')
        slots.append(dict(table=f'{table:08x}', offset=offset, target=f'{target:08x}'))
    starts = {r['start'] for r in ranges}
    outside = sorted({c['target'] for r in ranges for c in r['calls']
        if c['direct'] and c['target'] not in starts})
    return dict(executableSha256=PIN, precedingResourceAnchors=previous['verifiedInstructionAnchors'],
        dependencySourceSha256=hashlib.sha256(DEPENDENCY.read_bytes()).hexdigest(),
        verifiedInstructionAnchors=len(ANCHORS), ranges=ranges, vtableSlots=slots,
        directDependenciesOutsideRanges=outside,
        indirectCallSites=[dict(range=r['start'], **c) for r in ranges for c in r['calls'] if not c['direct']],
        peerList=dict(embeddedListOffset=8, headOffset=0x10, countOffset=0x14,
            nodeBytes=12, nodeValueOffset=8, nodeValueIsRawPeerPointer=True,
            linking='005c2d70', unlinking='005c2dd0', append='005c31e0',
            linkingChecksExistingPointer=True, linkingAndUnlinkingSwapEndpoints=True,
            missingMembershipCanReturnBeforeCheckingReverseLink=True,
            duplicateOrAsymmetricMembershipSafetyQualified=False),
        cacheRecordLineage=dict(wrapper='005c88f0', receiverCollectionOffset=0x80,
            keySource='first input object +0x1c', keyValueOffset=0x14, keyNodeOffset=0x1c,
            keyConstructorSource='first base listener constructor argument, conditional on input identity',
            recordSource='input virtual slot +0x58 output, transformed by receiver virtual slot +0x98',
            metadataSource='second stack argument to 005c88f0', metadataValueOffset=0x18,
            secondaryWordIsReturnAddress=False, wrapperCopiesFirstObjectPointerIntoRecord=False,
            metadataMayBePointer=True,
            metadataMeaningAndOwnershipQualified=False, inputLiveTypeQualified=False,
            queryHasOpenVirtualSlot=0x88, transformHasOpenMathDependency='004f6bb9',
            unconditionalAppendAfterPeerLinkReturns=True, wrapperChecksExistingCacheKey=False),
        cacheLookup=dict(update='005c7a00', read='005c7a50', keyNodeOffset=0x1c,
            fourWordNodeOffsets=[0x0c, 0x10, 0x14, 0x18], operatesOnFirstMatchingKey=True,
            missingReadLeavesOutputUntouched=True, neitherMethodChangesKeyMetadataOrNodeMembership=True),
        peerUnlinkLocallyMutatesCache=False, peerUnlinkCompleteCalleeEffectsQualified=False,
        requiredDetachInvariants=['Distinguish dispatcher membership, reciprocal peer pointers and keyed cache records.',
            'Check both peer endpoints; the helpers can exit early on missing or already-present membership.',
            'Retiring a peer must account separately for cache records and caller-owned metadata.',
            'Do not deduplicate cached keys without checking caller semantics: lookups choose the first record.',
            'Bound cache registration at its caller; peer-pointer duplicate suppression does not suppress the later cache append.'],
        localPeerAndCacheLineageQualified=True, actorReferenceRetentionExcluded=False,
        allCacheWritersQualified=False, completeDetachQualified=False,
        fullListenerDestructionClosureQualified=False, boundedNativeSimulationQualified=False,
        liveNativePagingQualified=False, nativeInstructionsExecuted=False, gameLaunched=False,
        browserUsed=False, nativeBuildRun=False,
        limitations='Pinned initial vtable words, argument lineage, local peer links and first-key cache operations only. Dynamic object identities, all callers/writers, metadata ownership, malformed lists, virtual/mathematical dependencies and complete scoped detach remain unqualified. No native instruction or lifetime operation executes.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path, default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output', type=Path, default=ROOT/'output/native-listener-cache-audit.json')
    args = parser.parse_args()
    args.output.unlink(missing_ok=True)
    report = audit(args.exe)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(dict(passed=True, anchors=report['verifiedInstructionAnchors'],
        ranges=len(report['ranges']), instructions=sum(len(r['instructions']) for r in report['ranges']),
        metadataSource='second caller argument', gameLaunches=0)))


if __name__ == '__main__':
    main()

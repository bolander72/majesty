#!/usr/bin/env python3
"""Pin cached rectangle updates and numeric outline-drawing metadata use."""
import hashlib
import importlib.util
import json
from pathlib import Path
import struct

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
DEPENDENCY = ROOT/'scripts/audit-native-cache-callers.py'
RANGES = [
    ('cached-rectangle-update', 0x005c8630, 0x005c8752),
    ('cached-outline-drawing', 0x005c8760, 0x005c88f0),
    ('cache-first-iterator', 0x005c9d00, 0x005c9d0e),
    ('derived-cached-rectangle-update', 0x0043bf90, 0x0043c127),
    ('rectangle-outline', 0x005004b0, 0x00500564),
    ('rectangle-fill', 0x00500330, 0x005004a1),
]
ANCHORS = [
    (0x005c8645, 'mov', 'ebp, dword ptr [edi + 0x1c]'),
    (0x005c866e, 'cmp', 'dword ptr [eax + 0x1c], ebp'),
    (0x005c8676, 'mov', 'bl, 1'),
    (0x005c8700, 'mov', 'edi, dword ptr [edi + 0x1c]'),
    (0x005c8719, 'cmp', 'dword ptr [eax + 0x1c], edi'),
    (0x005c8722, 'mov', 'cl, 1'),
    (0x005c8724, 'mov', 'dword ptr [eax + 0xc], edx'),
    (0x005c872b, 'mov', 'dword ptr [eax + 0x14], edx'),
    (0x005c8732, 'mov', 'dword ptr [eax + 0x18], edx'),
    (0x005c8739, 'mov', 'dword ptr [eax + 0x10], edx'),
    (0x005c87b5, 'mov', 'eax, dword ptr [esi + 0x8c]'),
    (0x005c87cd, 'call', '0x5c9d00'),
    (0x005c87d6, 'mov', 'ecx, dword ptr [esi + 0x88]'),
    (0x005c880a, 'mov', 'edx, dword ptr [eax + 0x20]'),
    (0x005c880d, 'push', 'edx'),
    (0x005c8812, 'call', '0x5004b0'),
    (0x005c8821, 'add', 'esp, 0x14'),
    (0x005c8824, 'mov', 'eax, dword ptr [eax]'),
    (0x005c88bd, 'mov', 'edx, dword ptr [eax + 0x20]'),
    (0x005c88c0, 'push', 'edx'),
    (0x005c88c5, 'call', '0x5004b0'),
    (0x005c88d4, 'add', 'esp, 0x14'),
    (0x005c88d7, 'mov', 'eax, dword ptr [eax]'),
    (0x0043bf9a, 'mov', 'eax, dword ptr [ebx + 0x1c]'),
    (0x0043bfa6, 'lea', 'ecx, [edi + 0x80]'),
    (0x0043bfb0, 'call', '0x5c7a50'),
    (0x0043c10b, 'mov', 'eax, dword ptr [ebx + 0x1c]'),
    (0x0043c118, 'call', '0x5c7a00'),
    (0x005004cc, 'mov', 'edi, dword ptr [esp + 0x24]'),
    (0x005004e0, 'call', '0x500330'),
    (0x0050050b, 'call', '0x500330'),
    (0x00500549, 'call', '0x500330'),
    (0x005003de, 'mov', 'ebx, dword ptr [esp + 0x24]'),
    (0x005003e2, 'test', 'ebx, 0x80000000'),
    (0x005003f1, 'call', '0x5071b0'),
    (0x0050040b, 'and', 'ebx, 0xff'),
    (0x00500432, 'and', 'ebx, 0xffff'),
    (0x00500476, 'push', 'ebx'),
    (0x00500479, 'call', 'dword ptr [edx + 0x4c]'),
]


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def audit(executable):
    data = executable.read_bytes()
    if hashlib.sha256(data).hexdigest() != PIN:
        raise ValueError('Cache consumer audit requires the pinned executable')
    callers = load(DEPENDENCY, 'cache_consumer_callers')
    preceding = callers.audit(executable)
    lineage = callers.load(callers.DEPENDENCY, 'cache_consumer_lineage')
    resources = lineage.load(lineage.DEPENDENCY, 'cache_consumer_resources')
    flow = resources.load(resources.FLOW_SOURCE, 'cache_consumer_flow')
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    ranges, rows = [], {}
    for label, start, end in RANGES:
        instructions = [dict(address=f'{i.address:08x}', bytes=i.bytes.hex(),
            mnemonic=i.mnemonic, operands=i.op_str)
            for i in decoder.disasm(pe.get_data(start-base, end-start), start)]
        if sum(len(bytes.fromhex(i['bytes'])) for i in instructions) != end-start:
            raise ValueError(f'Incomplete cache consumer range: {label}')
        ranges.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}',
            instructions=instructions, **flow.inspect_flow(instructions)))
        rows.update({int(i['address'], 16): i for i in instructions})
    for at, mnemonic, operands in ANCHORS:
        row = rows.get(at)
        if not row or (row['mnemonic'], row['operands']) != (mnemonic, operands):
            raise ValueError(f'Cache consumer anchor changed at {at:08x}')
    slots = []
    for table in [0x00680f6c, 0x0068a8f0]:
        target = struct.unpack('<I', pe.get_data(table+0x4c-base, 4))[0]
        if target != 0x005c8760:
            raise ValueError('Initial cached-outline slot changed')
        slots.append(dict(table=f'{table:08x}', offset=0x4c, target=f'{target:08x}'))
    return dict(executableSha256=PIN, ranges=ranges, verifiedInstructionAnchors=len(ANCHORS),
        vtableSlots=slots, precedingCallerAnchors=preceding['verifiedInstructionAnchors'],
        cacheUpdate=dict(selectsFirstMatchingKey=True, explicitNodeWrites=[12,16,20,24],
            keyNodeOffset=28, metadataNodeOffset=32, explicitNodeMembershipWrites=False,
            removesRecords=False, updatesAllDuplicateKeys=False),
        cacheDrawing=dict(iteratesToSentinel=True, processesDuplicateKeys=True,
            metadataNodeOffset=32, metadataOutlineArgument=5,
            outline='005004b0', fill='00500330', metadataUsedAsNumericPixelValue=True,
            metadataHighBitSelectsConversionCall='005071b0',
            outputFormatsExplicitlyPacked=[8,16], explicitWritesOnlyStack=True,
            collectionConsumedOrCleared=False, entryCountResidencyBoundQualified=False),
        requiredDetachInvariants=['Peer unlink and rectangle updates do not remove cached records.',
            'Rendering traverses every cached node, including duplicate keys; define cache residency separately.',
            'The audited drawing path treats metadata numerically; do not infer owned-pointer release from it.',
            'Qualify dynamic recipients and all writers before installing scoped record retirement.'],
        localMetadataDrawingUseQualified=True, metadataIsAlphaQualified=False,
        completeDrawingCalleesQualified=False, liveReceiverVtableQualified=False,
        allCacheConsumersQualified=False, allCacheWritersQualified=False,
        actorReferenceRetentionExcluded=False, completeDetachQualified=False,
        boundedNativeSimulationQualified=False, liveNativePagingQualified=False,
        nativeInstructionsExecuted=False, gameLaunched=False, browserUsed=False, nativeBuildRun=False,
        limitations='Initial cached-outline target and local update/drawing data flow only. '
            'Surface virtual methods, conversion, pixel writes and other callees remain open. '
            'No live receiver identity, exhaustive writer/consumer closure or safe actor unload proof.')


def main():
    output = ROOT/'output/native-cache-consumers-audit.json'
    output.unlink(missing_ok=True)
    executable = ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    report = audit(executable)
    output.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(dict(passed=True, ranges=len(report['ranges']),
        instructions=sum(len(r['instructions']) for r in report['ranges']),
        anchors=report['verifiedInstructionAnchors'], metadataDrawingArgument=5, gameLaunches=0)))


if __name__ == '__main__':
    main()

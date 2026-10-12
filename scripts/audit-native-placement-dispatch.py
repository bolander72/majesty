#!/usr/bin/env python3
"""Pinned placement initialization dispatch and height-writer reference scope."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import struct

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
FACTORIES = [
    (0x00429480, 0x004294d9, 0x004294c1, 0x0067f96c),
    (0x00433af0, 0x00433b77, 0x00433b4d, 0x0068098c),
    (0x0042c980, 0x0042c9da, 0x0042c9c2, 0x0067fe6c),
    (0x004331e0, 0x0043323a, 0x00433222, 0x0068071c),
    (0x004321c0, 0x0043221d, 0x00432205, 0x00680444),
]
RANGES = [
    ('placement-coordinate-wrapper', 0x005a1480, 0x005a14c7),
    ('placement-initialization', 0x005a1350, 0x005a1471),
    ('actor-factory-dispatch', 0x0042c3d0, 0x0042c435),
    ('actor-factory-fallback', 0x005a12d0, 0x005a12d5),
    ('actor-slot20-field-update', 0x005a2670, 0x005a2689),
    ('point-height-adjustment', 0x005f1a40, 0x005f1ae0),
    ('bulk-row-height-adjustment', 0x005f1ae0, 0x005f1c27),
] + [(f'factory-{start:08x}', start, end) for start, end, _, _ in FACTORIES]
CALLBACKS = [(0x005a13de, 0x40, 0x005a1960), (0x005a13ee, 0x48, 0x005a1a00),
             (0x005a142f, 0x20, 0x005a2670), (0x005a143b, 4, 0x005a22c0),
             (0x005a1444, 0x10, 0x005a2430), (0x005a144b, 0xb8, 0x005b3550),
             (0x005a1455, 0x34, 0x005a2250)]
ANCHORS = [
    (0x005a149d, 'call', '0x42ff70'),
    (0x005a14a4, 'call', '0x42f060'),
    (0x005a14bf, 'call', 'dword ptr [edi + 0x68]'),
    (0x005a14c4, 'ret', '0x20'),
    (0x005a1364, 'call', 'dword ptr [eax + 0x60]'),
    (0x005a1367, 'mov', 'esi, eax'),
    (0x005a1380, 'call', '0x5a2120'),
    (0x005a13d0, 'call', 'dword ptr [edx + 0x6c]'),
    (0x005a13dc, 'mov', 'ecx, esi'),
    (0x005a141d, 'mov', 'dword ptr [esi + 0x48], ecx'),
    (0x005a1424, 'mov', 'dword ptr [esi + 0x4c], edx'),
    (0x005a1427, 'mov', 'dword ptr [esi + 0x50], eax'),
    (0x005a142d, 'mov', 'ecx, esi'),
    (0x005a142f, 'call', 'dword ptr [eax + 0x20]'),
    (0x005a145e, 'ret', '0x24'),
    (0x005a1465, 'call', 'dword ptr [eax + 0x30]'),
    (0x005a146e, 'ret', '0x24'),
    (0x0042c3e4, 'jmp', 'dword ptr [esi*4 + 0x42c438]'),
    (0x0042c3d5, 'cmp', 'esi, 0x4647534d'),
    (0x0042c3db, 'jg', '0x42c426'),
    (0x0042c3dd, 'je', '0x42c40b'),
    (0x0042c3df, 'cmp', 'esi, 7'),
    (0x0042c3e2, 'ja', '0x42c426'),
    (0x0042c3ec, 'call', '0x429480'),
    (0x0042c3f4, 'call', '0x433af0'),
    (0x0042c3fc, 'call', '0x42c980'),
    (0x0042c404, 'call', '0x4331e0'),
    (0x0042c40c, 'call', '0x4321c0'),
    (0x0042c42c, 'call', '0x5a12d0'),
    (0x005a12d0, 'xor', 'eax, eax'),
    (0x005a12d2, 'ret', '8'),
    (0x005a267b, 'mov', 'dword ptr [ecx + 0x70], eax'),
    (0x005a2679, 'je', '0x5a2686'),
    (0x005a2680, 'call', 'dword ptr [eax + 0xb8]'),
    (0x005f1b1b, 'mov', 'edx, dword ptr [ebx + 0x4c]'),
    (0x005f1b0f, 'inc', 'eax'),
    (0x005f1b20, 'imul', 'ecx, dword ptr [esp + 0x1c]'),
    (0x005f1b2e, 'add', 'ecx, edi'),
    (0x005f1b39, 'lea', 'ebp, [edx + ecx*8]'),
    (0x005f1b73, 'call', '0x64cc94'),
    (0x005f1bf6, 'mov', 'dword ptr [ebp], eax'),
    (0x005f1bff, 'jl', '0x5f1b18'),
    (0x005f1c17, 'jl', '0x5f1afe'),
] + [(store, 'mov', f'dword ptr [esi], 0x{table:x}') for _, _, store, table in FACTORIES]


def encoded_references(pe, base, target):
    words, branches = [], []
    for section in pe.sections:
        data = section.get_data()
        for match in re.finditer(re.escape(struct.pack('<I', target)), data):
            words.append(f'{base+section.VirtualAddress+match.start():08x}')
        if section.Characteristics & 0x20000000:
            for match in re.finditer(b'[\xe8\xe9]', data):
                at = match.start()
                if at+5 > len(data):
                    continue
                address = base+section.VirtualAddress+at
                candidate = (address+5+struct.unpack_from('<i', data, at+1)[0]) & 0xffffffff
                if candidate == target:
                    branches.append(dict(address=f'{address:08x}', opcode=data[at]))
    return dict(target=f'{target:08x}', fourByteLittleEndianWords=words,
        e8e9Rel32CandidatesInExecutableSections=branches,
        callersProvenAbsent=False, computedIndirectTargetsAndExternalDataNotCovered=True)


def audit(executable):
    data = executable.read_bytes()
    if hashlib.sha256(data).hexdigest() != PIN:
        raise ValueError('Placement dispatch audit requires the pinned executable')
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    ranges, rows = [], {}
    for label, start, end in RANGES:
        instructions = [dict(address=f'{i.address:08x}', bytes=i.bytes.hex(), mnemonic=i.mnemonic, operands=i.op_str)
                        for i in decoder.disasm(pe.get_data(start-base, end-start), start)]
        if sum(len(bytes.fromhex(i['bytes'])) for i in instructions) != end-start:
            raise ValueError(f'Incomplete placement range {label}')
        ranges.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}', instructions=instructions))
        rows.update({int(i['address'], 16): i for i in instructions})
    for at, mnemonic, operands in ANCHORS:
        row = rows.get(at)
        if not row or (row['mnemonic'], row['operands']) != (mnemonic, operands):
            raise ValueError(f'Placement anchor changed at {at:08x}')
    slots = []
    for offset, expected in [(0x60, 0x0042c3d0), (0x64, 0x005a1480), (0x68, 0x005a1350), (0x6c, 0x005a12e0)]:
        actual, = struct.unpack('<I', pe.get_data(0x00682950+offset-base, 4))
        if actual != expected:
            raise ValueError('Placement world vtable changed')
        slots.append(dict(table='00682950', offset=offset, target=f'{expected:08x}'))
    for _, _, _, table in FACTORIES:
        for site, offset, target in CALLBACKS:
            actual, = struct.unpack('<I', pe.get_data(table+offset-base, 4))
            if actual != target:
                raise ValueError('Actor initialization vtable changed')
            if rows[site]['mnemonic'] != 'call' or f'+ {offset:#x}]' not in rows[site]['operands']:
                # Capstone renders small offsets in decimal.
                if offset != 4 or '+ 4]' not in rows[site]['operands']:
                    raise ValueError('Actor initialization call site changed')
            slots.append(dict(table=f'{table:08x}', offset=offset, target=f'{target:08x}', callSite=f'{site:08x}'))
    switches = list(struct.unpack('<8I', pe.get_data(0x0042c438-base, 32)))
    expected_switches = [0x0042c3eb, 0x0042c3f3, 0x0042c3fb, 0x0042c426,
                         0x0042c403, 0x0042c426, 0x0042c426, 0x0042c3eb]
    if switches != expected_switches:
        raise ValueError('Placement factory switch table changed')
    point = encoded_references(pe, base, 0x005f1a40)
    bulk = encoded_references(pe, base, 0x005f1ae0)
    if point['fourByteLittleEndianWords'] != ['0068b680'] or point['e8e9Rel32CandidatesInExecutableSections']:
        raise ValueError('Pinned point-height reference inventory changed')
    if bulk['fourByteLittleEndianWords'] or bulk['e8e9Rel32CandidatesInExecutableSections']:
        raise ValueError('Pinned bulk-height reference inventory changed')
    return dict(executableSha256=PIN, verifiedInstructionAnchors=len(ANCHORS), ranges=ranges, vtableSlots=slots,
        placementReceiver='new actor from world slot +0x60, retained in ESI',
        registeredBeforeActorInitializationCallbacks=True,
        wrapperStackArgumentBytes=32, initializationStackArgumentBytes=36,
        actorCallbacks=[dict(callSite=f'{site:08x}', slot=slot, target=f'{target:08x}') for site, slot, target in CALLBACKS],
        allFiveAuditedFactoryTablesShareTheseSevenCallbacks=True,
        factorySwitchTargets=[f'{address:08x}' for address in switches],
        factoryFallbackReturnsNull=True, factorySwitchAndFallbackQualified=True,
        actorSlot20IsTerrainHeightMethod=False,
        actorSlot20UpdatesOffset=0x70, actorSlot20ConditionallyInvokesSlotB8=True,
        sevenDirectSitesBoundAllActorCallbackEffects=False,
        bulkHeightWriteFootprint=dict(vertexRows='1..cellHeight', vertexColumns='0..cellWidth-1',
            includesLeftAndBottomEdges=True, excludesTopAndRightEdges=True,
            writesOnlyHeightWordAtSelectedVertices=True, conditionalWrites=True,
            numericOperationQualified=False),
        heightReferenceInventory=[point, bulk],
        factoryConstructorAndCallbackClosureQualified=False, heightWriterCallerOrderingQualified=False,
        allLaterGeometryEditsExcluded=False, safeBorderMutationHookQualified=False,
        liveNativePagingQualified=False, nativeInstructionsExecuted=False, browserUsed=False, nativeBuildRun=False,
        limitations='Pinned local placement dispatch, switch/fallback and encoded-reference inventory only. Actor constructor and virtual callback bodies, indirect or computed height callers, external scripts/mods, and later geometry changes are not closed. No actor or terrain is created or changed.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path, default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output', type=Path, default=ROOT/'output/native-placement-dispatch-audit.json')
    args = parser.parse_args()
    args.output.unlink(missing_ok=True)
    report = audit(args.exe)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(dict(passed=True, anchors=report['verifiedInstructionAnchors'],
        vtableSlots=len(report['vtableSlots']), sharedActorCallbacks=7,
        laterGeometryPreservationQualified=False, gameLaunches=0)))


if __name__ == '__main__':
    main()

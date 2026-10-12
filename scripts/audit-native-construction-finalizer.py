#!/usr/bin/env python3
"""Pinned first-normal-finalizer context before generator world publication."""
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
    ('world-factory', 0x00491c70, 0x00491cde),
    ('derived-world-constructor', 0x004911c0, 0x004913c8),
    ('base-world-setup', 0x005bb180, 0x005bb2fc),
    ('terrain-constructor', 0x005f19c0, 0x005f19e5),
    ('terrain-array-constructor', 0x005fda70, 0x005fdb60),
    ('terrain-description-binding', 0x005c9e20, 0x005c9e61),
    ('world-terrain-description-selection', 0x005d9910, 0x005d9972),
    ('first-world-terrain-initializer', 0x005bb300, 0x005bb33f),
]
ANCHORS = [
    (0x00491cb9, 'call', '0x4911c0'),
    (0x004911ee, 'mov', 'ecx, esi'),
    (0x004911f4, 'call', '0x5bb6e0'),
    (0x004912c7, 'mov', 'dword ptr [esi], 0x682950'),
    (0x005bb19b, 'mov', 'esi, ecx'),
    (0x005bb1ab, 'xor', 'ebx, ebx'),
    (0x005bb223, 'mov', 'dword ptr [esi + 0x88], ebx'),
    (0x005bb250, 'mov', 'dword ptr [esi + 0x80], ebx'),
    (0x005bb730, 'mov', 'dword ptr [ebp], 0x68a2ec'),
    (0x005bb737, 'call', '0x5bb180'),
    (0x005bb748, 'lea', 'eax, [ebp + 0x5c]'),
    (0x005bb74d, 'mov', 'ecx, 9'),
    (0x005bb754, 'mov', 'esi, 0x6cce28'),
    (0x005bb75c, 'rep movsd', 'dword ptr es:[edi], dword ptr [esi]'),
    (0x005bb7da, 'call', '0x5f19c0'),
    (0x005bb7f0, 'mov', 'ecx, ebp'),
    (0x005bb7f2, 'push', 'eax'),
    (0x005bb7fe, 'mov', 'esi, dword ptr [ebp + 0x88]'),
    (0x005bb818, 'push', '0x50'),
    (0x005bb88b, 'call', '0x5b7f00'),
    (0x005bb894, 'mov', 'dword ptr [ebp + 0x88], eax'),
    (0x005bb328, 'mov', 'ecx, dword ptr [esi + 0x80]'),
    (0x005bb304, 'push', 'esi'),
    (0x005bb312, 'push', 'eax'),
    (0x005bb313, 'call', 'dword ptr [edx + 0x44]'),
    (0x005bb31e, 'push', '0'),
    (0x005bb323, 'call', '0x5c9e20'),
    (0x005bb32e, 'add', 'esi, 0x5c'),
    (0x005bb331, 'push', '0'),
    (0x005bb333, 'push', 'esi'),
    (0x005bb334, 'mov', 'eax, dword ptr [ecx]'),
    (0x005bb336, 'call', 'dword ptr [eax + 0x10]'),
    (0x005bb339, 'mov', 'al, 1'),
    (0x005bb33c, 'ret', '4'),
    (0x005c9e5e, 'ret', '4'),
    (0x005d994b, 'mov', 'ecx, dword ptr [edi + 0x80]'),
    (0x005d9954, 'add', 'ecx, 4'),
    (0x005d995b, 'call', '0x5c9e20'),
    (0x005d9966, 'ret', '4'),
    (0x005d996f, 'ret', '4'),
    (0x005f19d4, 'call', '0x5fda70'),
    (0x005f19d9, 'mov', 'dword ptr [esi], 0x68b660'),
    (0x005f19df, 'mov', 'eax, esi'),
    (0x005fdb0c, 'mov', 'dword ptr [esi + 0x48], eax'),
    (0x005fdb34, 'mov', 'dword ptr [esi + 0x4c], eax'),
    (0x005fdb46, 'call', '0x5aeb70'),
    (0x004b2979, 'call', '0x491c70'),
    (0x004b297e, 'mov', 'dword ptr [esi + 0x84], eax'),
    (0x004b2a57, 'call', '0x4b2160'),
]


def audit(executable):
    data = executable.read_bytes()
    if hashlib.sha256(data).hexdigest() != PIN:
        raise ValueError('Construction finalizer audit requires the pinned executable')
    # Recheck the previous call-order proof instead of trusting its saved JSON.
    path = ROOT/'scripts/audit-native-terrain-generation.py'
    spec = importlib.util.spec_from_file_location('terrain_generation', path)
    generation = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(generation)
    previous = generation.audit(executable)
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    rows = {int(row['address'], 16): row for r in previous['ranges'] for row in r['instructions']}
    ranges = []
    for label, start, end in RANGES:
        decoded = [dict(address=f'{i.address:08x}', bytes=i.bytes.hex(),
                        mnemonic=i.mnemonic, operands=i.op_str)
                   for i in decoder.disasm(pe.get_data(start-base, end-start), start)]
        if not decoded or int(decoded[-1]['address'], 16)+len(bytes.fromhex(decoded[-1]['bytes'])) != end:
            raise ValueError(f'Incomplete construction range {label}')
        ranges.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}', instructions=decoded))
        rows.update({int(row['address'], 16): row for row in decoded})
    for at, mnemonic, operands in ANCHORS:
        row = rows.get(at)
        if not row or (row['mnemonic'], row['operands']) != (mnemonic, operands):
            raise ValueError(f'Construction finalizer anchor changed at {at:08x}')
    slots = []
    for table, offset, target in [(0x0068a2ec, 0x98, 0x005bb300),
                                  (0x0068a2ec, 0x44, 0x005d9910),
                                  (0x00682950, 0x44, 0x005d9910),
                                  (0x0068b660, 0x10, 0x005aebe0)]:
        if struct.unpack('<I', pe.get_data(table+offset-base, 4))[0] != target:
            raise ValueError('Construction finalizer vtable changed')
        slots.append(dict(table=f'{table:08x}', offset=offset, target=f'{target:08x}'))
    return dict(executableSha256=PIN, generationAuditSourceSha256=hashlib.sha256(path.read_bytes()).hexdigest(),
        priorGenerationAnchorsRechecked=previous['verifiedInstructionAnchors'],
        constructionInstructionAnchors=len(ANCHORS), ranges=ranges, vtableSlots=slots,
        firstNormalFinalizer=dict(entry='005aebe0', immediateReturn='005bb339',
            receiver='terrain = world[+0x80]', firstStackArgument='configuration = world + 0x5c',
            secondStackArgument='null rectangle', outerInitializerReturn='005bb7fe',
            entryStackOffsets=dict(immediateReturn=0,configuration=4,rectangle=8,
                savedInitializerEsi=12,outerInitializerReturn=16,descriptionArgument=20),
            entryFrameBytesToCheck=24,
            baseWorldVtable='0068a2ec', terrainVtable='0068b660',
            arraysInitializedBeforeCall=True, beforeSpatialGridConstruction=True,
            beforeDerivedWorldVtableInstalled=True, beforeGeneratorWorldAssignment=True,
            beforeExplicitGenerationPlacementStages=True),
        guardImplications=['Derive the constructing world from the configuration pointer, not generator+0x84.',
            'The constructing world still uses the base vtable, not the later derived-world vtable.',
            'Require the exact immediate and outer caller contexts, matching terrain receiver, null rectangle, valid dimensions/buffers and an empty spatial-grid pointer.',
            'Require an independently scoped opted-in fresh-generation context; these ABI observations alone cannot authorize mutation.'],
        heightWriterCallerOrderingQualified=False, completeConstructorCallClosureQualified=False,
        allActorsAbsentQualified=False, safeBorderMutationHookQualified=False,
        generatedBorderQualified=False, liveNativePagingQualified=False,
        browserUsed=False, newGameProcessesLaunched=0, nativeBuildRun=False,
        limitations='Pinned local call order and ABI only. Calls outside these ranges, indirect callbacks, global aliases, later geometry edits and actor presence are not closed. No hook or border mutation is installed or executed.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path, default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output', type=Path, default=ROOT/'output/native-construction-finalizer-audit.json')
    args = parser.parse_args()
    args.output.unlink(missing_ok=True)
    result = audit(args.exe)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(dict(passed=True, constructionAnchors=len(ANCHORS),
        priorGenerationAnchorsRechecked=result['priorGenerationAnchorsRechecked'],
        beforeGeneratorWorldAssignment=True, safeBorderMutationHookQualified=False,
        browserUsed=False, gameLaunches=0)))


if __name__ == '__main__':
    main()

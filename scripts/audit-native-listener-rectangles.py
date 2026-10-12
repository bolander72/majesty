#!/usr/bin/env python3
"""Pinned notification rectangle copies and drawing-buffer layout; no execution."""
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
    ('actor-bounds-notification', 0x005c49d0, 0x005c4aa6),
    ('alternate-bounds-notification', 0x005c4ab0, 0x005c4b84),
    ('point-bounds-notification', 0x005c85d0, 0x005c8620),
    ('alternate-noop', 0x005c8620, 0x005c8623),
    ('base-rectangle-submit', 0x005c2a10, 0x005c2ab2),
    ('visible-rectangle-submit', 0x005c47c0, 0x005c486f),
    ('point-rectangle-submit', 0x005c7fc0, 0x005c8062),
    ('point-to-rectangle', 0x005c84b0, 0x005c84f9),
    ('actor-to-point', 0x005ad740, 0x005ad767),
    ('rectangle-offset', 0x00505600, 0x00505634),
    ('rectangle-clip-and-submit', 0x005057d0, 0x0050584a),
    ('rectangle-collector', 0x00505860, 0x00505dae),
    ('rectangle-intersection', 0x004fcbe0, 0x004fcc33),
    ('rectangle-buffer-constructor', 0x005051a0, 0x00505217),
]
SLOTS = [
    (0x0068a54c, 0x18, 0x005c2a10), (0x0068a678, 0x18, 0x005c2a10),
    (0x0068a784, 0x18, 0x005c47c0), (0x0068a8f0, 0x18, 0x005c7fc0),
    (0x0068a8f0, 0x40, 0x005c84b0), (0x0068a784, 0x30, 0x00438300),
    (0x0068a8f0, 0x94, 0x005c81f0),
]
ANCHORS = [
    (0x005c49d3, 'mov', 'eax, dword ptr [esp + 0x14]'),
    (0x005c49d9, 'add', 'eax, 0x98'),
    (0x005c49f0, 'fcomp', 'qword ptr [0x6801c8]'),
    (0x005c4a15, 'fcomp', 'qword ptr [0x6801c0]'),
    (0x005c4a9a, 'call', 'dword ptr [edx + 0x18]'),
    (0x005c4ab8, 'add', 'eax, 0x28'),
    (0x005c4b78, 'call', 'dword ptr [edx + 0x18]'),
    (0x005c85d0, 'mov', 'al, byte ptr [0x71c82e]'),
    (0x005c85e8, 'push', '0'),
    (0x005c85ec, 'call', 'dword ptr [eax + 0x18]'),
    (0x005c8604, 'call', 'dword ptr [edx + 0x40]'),
    (0x005c8616, 'call', 'dword ptr [edx + 0x18]'),
    (0x005c8620, 'ret', '8'),
    (0x005c47c8, 'call', 'dword ptr [eax + 0x30]'),
    (0x005c482e, 'call', '0x4fcbe0'),
    (0x005c4845, 'call', '0x505600'),
    (0x005c4857, 'call', '0x5057d0'),
    (0x005c4863, 'call', '0x505600'),
    (0x005c804a, 'call', '0x5057d0'),
    (0x005c84bf, 'call', '0x5ad740'),
    (0x005c84cd, 'call', 'dword ptr [edx + 0x94]'),
    (0x005ad748, 'call', '0x5ad5b0'),
    (0x00505612, 'mov', 'dword ptr [ecx + 4], eax'),
    (0x00505626, 'mov', 'dword ptr [ecx], edx'),
    (0x0050583c, 'call', '0x505860'),
    (0x005058d0, 'mov', 'eax, dword ptr [esp + 0x8c]'),
    (0x005058d7, 'mov', 'esi, dword ptr [ebp + eax*4 + 0x34]'),
    (0x005058e3, 'mov', 'ecx, dword ptr [ebp + eax*4 + 0x3c]'),
    (0x00505911, 'cmp', 'esi, dword ptr [ebp + 0x10]'),
    (0x00505914, 'jne', '0x50594f'),
    (0x00505916, 'mov', 'dword ptr [ebp + eax*4 + 0x34], 1'),
    (0x00505d50, 'call', '0x505860'),
    (0x00505d7b, 'shl', 'ecx, 4'),
    (0x00505d84, 'mov', 'dword ptr [edx], ecx'),
    (0x00505d98, 'mov', 'dword ptr [edx + 0xc], ecx'),
    (0x00505da0, 'mov', 'dword ptr [ebp + eax*4 + 0x34], ecx'),
    (0x005051ab, 'mov', 'ebp, 2'),
    (0x005051c8, 'push', '0x320'),
    (0x005051cd, 'call', '0x64d59f'),
    (0x005051d7, 'add', 'edi, 4'),
    (0x005051db, 'jne', '0x5051b9'),
    (0x005051df, 'mov', 'dword ptr [esi + 0x10], 0x32'),
    (0x005051ed, 'mov', 'dword ptr [esi + 0x34], edx'),
    (0x005051f0, 'mov', 'dword ptr [esi + 0x38], edx'),
]


def load_source(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def audit(executable):
    data = executable.read_bytes()
    if hashlib.sha256(data).hexdigest() != PIN:
        raise ValueError('Listener rectangle audit requires the pinned executable')
    preceding = load_source(DEPENDENCY, 'notification_dependency').audit(executable)
    flow = load_source(FLOW_SOURCE, 'callback_flow')
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    ranges, rows = [], {}
    for label, start, end in RANGES:
        decoded = [dict(address=f'{i.address:08x}', bytes=i.bytes.hex(), mnemonic=i.mnemonic, operands=i.op_str)
            for i in decoder.disasm(pe.get_data(start-base, end-start), start)]
        if sum(len(bytes.fromhex(i['bytes'])) for i in decoded) != end-start:
            raise ValueError(f'Incomplete listener rectangle range {label}')
        ranges.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}', instructions=decoded,
            **flow.inspect_flow(decoded)))
        rows.update({int(i['address'], 16): i for i in decoded})
    for at, mnemonic, operands in ANCHORS:
        row = rows.get(at)
        if not row or (row['mnemonic'], row['operands']) != (mnemonic, operands):
            raise ValueError(f'Listener rectangle anchor changed at {at:08x}')
    slots = []
    for table, offset, target in SLOTS:
        if struct.unpack('<I', pe.get_data(table+offset-base, 4))[0] != target:
            raise ValueError('Listener rectangle slot changed')
        slots.append(dict(table=f'{table:08x}', offset=offset, target=f'{target:08x}'))
    constants = [struct.unpack('<d', pe.get_data(a-base, 8))[0] for a in [0x006801c0, 0x006801c8]]
    if constants != [0.5, 1.0]:
        raise ValueError('Listener rectangle scale constants changed')
    starts = {r['start'] for r in ranges}
    external = sorted({c['target'] for r in ranges for c in r['calls'] if c['direct'] and c['target'] not in starts})
    return dict(executableSha256=PIN, precedingNotificationAnchors=preceding['verifiedInstructionAnchors'],
        notificationSourceSha256=hashlib.sha256(DEPENDENCY.read_bytes()).hexdigest(),
        verifiedInstructionAnchors=len(ANCHORS), ranges=ranges, vtableSlots=slots,
        scaleConstants=constants, directDependenciesOutsideRanges=external,
        derivedNotificationBodiesInventoried=True, fullNotificationCallClosureQualified=False,
        notificationRectangles=dict(actorBoundsOffset=0x98, alternateInputBoundsOffset=0x28,
            rectangleBytes=16, copiedToStackBeforeSubmission=True,
            primaryActorPointerPassedToRectangleSubmit=False, pointQueryStillReceivesActor=True),
        drawingBufferConstructor=dict(bufferCount=2, rectangleCapacityPerBuffer=50,
            rectangleBytes=16, allocatedBytesPerBuffer=800, totalRectanglePayloadBytes=1600,
            countOffsets=[0x34, 0x38], pointerOffsets=[0x3c, 0x40], capacityOffset=0x10),
        collector=dict(indexArgumentIsIntegerBankIndex=True, indexBoundsChecked=False,
            fullCountComparison='equal, not greater-or-equal', fullCountBranchResetsCountToOne=True,
            recursivelyProcessesSplitRectangles=True, recursionBoundQualified=False,
            allBranchesAndNumericGeometryQualified=False),
        liveCollectorInputInvariantsQualified=False, actorReferenceRetentionExcluded=False,
        allLaterGeometryEditsExcluded=False, safeBorderMutationHookQualified=False,
        boundedNativeSimulationQualified=False, liveNativePagingQualified=False,
        nativeInstructionsExecuted=False, browserUsed=False, nativeBuildRun=False,
        limitations='Pinned local callback rectangles and constructor buffer sizes only. Stack/output and drawing fields are written. Alias safety, live bank/count/capacity state, split-helper semantics, recursion, virtual visibility/point conversion and live actor retention remain unqualified. 1600 bytes covers this constructor rectangle payload only, not total drawing or simulation memory.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path, default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output', type=Path, default=ROOT/'output/native-listener-rectangles-audit.json')
    args = parser.parse_args()
    args.output.unlink(missing_ok=True)
    report = audit(args.exe)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(dict(passed=True, anchors=report['verifiedInstructionAnchors'],
        ranges=len(report['ranges']), drawingRectanglePayloadBytes=1600,
        liveCollectorBoundsQualified=False, gameLaunches=0)))


if __name__ == '__main__':
    main()

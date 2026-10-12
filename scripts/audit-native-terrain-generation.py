#!/usr/bin/env python3
"""Pinned static generation ordering and terrain/spatial-grid ownership."""
import argparse
import hashlib
import json
from pathlib import Path
import struct

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


def audit(executable):
    data = executable.read_bytes()
    if hashlib.sha256(data).hexdigest() != PIN:
        raise ValueError('Terrain generation audit requires the pinned executable')
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    slots = []
    for table, offset, target in [
        (0x00682950, 0x44, 0x005d9910),
        (0x00682950, 0x64, 0x005a1480),
        (0x00682950, 0x88, 0x005d97b0),
        (0x00682950, 0x98, 0x005bb300),
        (0x0068a2ec, 0x98, 0x005bb300),
        (0x0068b660, 0x10, 0x005aebe0),
        (0x0068b660, 0x14, 0x005cc330),
        (0x0068b660, 0x20, 0x005f1a40),
    ]:
        if struct.unpack('<I', pe.get_data(table+offset-base, 4))[0] != target:
            raise ValueError('Pinned generation vtable changed')
        slots.append(dict(table=f'{table:08x}', offset=offset, target=f'{target:08x}'))
    records, addresses = [], {}
    # Start only at established function boundaries. Exploratory linear scans
    # and decoded suffixes from arbitrary byte offsets are not audit evidence.
    for label, start, end in [
        ('generation', 0x004b23d0, 0x004b2b70),
        ('actor-placement-a', 0x004b1780, 0x004b1a5c),
        ('actor-placement-b', 0x004b1ec0, 0x004b2124),
        ('actor-placement-c', 0x004b1b00, 0x004b1e8c),
        ('world-constructor', 0x005bb6e0, 0x005bb8b5),
        ('world-terrain-initialize', 0x005bb300, 0x005bb33f),
        ('spatial-grid-constructor', 0x005b7f00, 0x005b7fd1),
        ('spatial-grid-destructor', 0x005b8000, 0x005b8036),
        ('spatial-grid-actor-reader', 0x005b81b0, 0x005b835b),
        ('post-generation-terrain', 0x005cc330, 0x005cc3c8),
        ('terrain-height-mutation', 0x005f1a40, 0x005f1ae0),
        ('terrain-initial-heights', 0x005aeb70, 0x005aeb9b),
    ]:
        instructions = []
        for i in decoder.disasm(pe.get_data(start-base, end-start), start):
            row = dict(address=f'{i.address:08x}', bytes=i.bytes.hex(),
                       mnemonic=i.mnemonic, operands=i.op_str)
            instructions.append(row)
            addresses[i.address] = row
        records.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}', instructions=instructions))
    anchors = [
        (0x004b2971, 'shl', 'ecx, 5'),
        (0x004b2974, 'shl', 'edx, 5'),
        (0x004b2979, 'call', '0x491c70'),
        (0x004b297e, 'mov', 'dword ptr [esi + 0x84], eax'),
        (0x004b2a57, 'call', '0x4b2160'),
        (0x004b2a5e, 'call', '0x4b1780'),
        (0x004b2a65, 'call', '0x4b1ec0'),
        (0x004b2a6c, 'call', '0x4b1b00'),
        (0x004b2a79, 'mov', 'ecx, dword ptr [eax + 0x80]'),
        (0x004b2a81, 'call', 'dword ptr [edx + 0x14]'),
        (0x004b2a8c, 'call', 'dword ptr [eax + 0x88]'),
        (0x004b18f9, 'call', 'dword ptr [ebp + 0x64]'),
        (0x004b1fbc, 'call', '0x5cc0e0'),
        (0x004b2043, 'call', 'dword ptr [ebx + 0x64]'),
        (0x004b20d0, 'call', 'dword ptr [ebx + 0x64]'),
        (0x004b1d36, 'call', 'dword ptr [esi + 0x64]'),
        (0x005bb7e6, 'mov', 'dword ptr [ebp + 0x80], eax'),
        (0x005bb7f8, 'call', 'dword ptr [edx + 0x98]'),
        (0x005bb861, 'sar', 'eax, 4'),
        (0x005bb88b, 'call', '0x5b7f00'),
        (0x005bb894, 'mov', 'dword ptr [ebp + 0x88], eax'),
        (0x005bb313, 'call', 'dword ptr [edx + 0x44]'),
        (0x005bb328, 'mov', 'ecx, dword ptr [esi + 0x80]'),
        (0x005bb32e, 'add', 'esi, 0x5c'),
        (0x005bb336, 'call', 'dword ptr [eax + 0x10]'),
        (0x005b7f1c, 'mov', 'dword ptr [esi + 0x48], eax'),
        (0x005b7f1f, 'mov', 'dword ptr [esi + 0x4c], ecx'),
        (0x005b7f32, 'call', '0x64d59f'),
        (0x005b7f3a, 'mov', 'dword ptr [esi + 0x14], eax'),
        (0x005b7f9d, 'imul', 'edi, dword ptr [esi + 0x4c]'),
        (0x005b7fb1, 'call', '0x64d59f'),
        (0x005b7fb9, 'mov', 'dword ptr [esi + 0x18], eax'),
        (0x005b800d, 'call', '0x64d4b6'),
        (0x005b801d, 'call', '0x64d4b6'),
        (0x005cc354, 'mov', 'dl, byte ptr [ecx + eax*8 + 6]'),
        (0x005cc35e, 'call', '0x4f6730'),
        (0x005cc397, 'call', '0x5cb8b0'),
        (0x005cc3ac, 'call', '0x5cae10'),
        (0x005f1a47, 'mov', 'ecx, dword ptr [ecx + 0x4c]'),
        (0x005f1a5a, 'fild', 'dword ptr [ecx + eax*8]'),
        (0x005f1a60, 'fmul', 'dword ptr [0x6801bc]'),
        (0x005f1a97, 'mov', 'dword ptr [esi], eax'),
        (0x005f1ada, 'mov', 'dword ptr [esi], eax'),
    ]
    for address, mnemonic, operands in anchors:
        row = addresses.get(address)
        if not row or (row['mnemonic'], row['operands']) != (mnemonic, operands):
            raise ValueError(f'Pinned generation anchor changed at {address:08x}')
    samples = []
    for cells in (128, 1024):
        # Square world dimensions arrive in pixels/cell*32; the actor grid
        # constructor receives ceil(pixel extent/16) along each axis.
        grid_side = cells*2
        terrain_bytes = 8*cells*cells+24*(cells+1)*(cells+1)
        grid_bytes = 8*grid_side*grid_side
        samples.append(dict(terrainCellSide=cells, spatialGridSide=grid_side,
                            terrainArrayBytes=terrain_bytes, spatialGridPointerTableBytes=grid_bytes,
                            combinedArrayBytes=terrain_bytes+grid_bytes))
    return dict(executableSha256=PIN, verifiedInstructionAnchors=len(anchors), vtableSlots=slots,
        ranges=records,
        generationStages=['004b2160', '004b1780', '004b1ec0', '004b1b00'],
        constructionReturn='004b297e', terrainPostGeneration='005cc330',
        constructionBeforeExplicitPlacementStages=True, returnFromGeneratorAfterPlacement=True,
        postGenerationTerrainIsPureNormalFinalizer=False,
        postGenerationTerrainUsesRngAndCellUpdates=True,
        terrainHeightMutationMethod='005f1a40', heightMutationCallerOrderingQualified=False,
        worldPointers=dict(terrain=0x80, spatialActorGrid=0x88),
        spatialGrid=dict(widthOffset=0x48, heightOffset=0x4c,
                         tableOffsets=[0x14, 0x18], tableBytesPerGridCell=8,
                         pixelExtentPerGridCell=16, pooledActorListsNotIncluded=True),
        arrayBudgetSamples=samples, safeBorderMutationHookQualified=False,
        navigationRebuildQualified=False, browserUsed=False, newGameProcessesLaunched=0,
        limitations='Pinned static paths only. A construction return precedes explicit generation placement stages but does not prove all actors absent or prevent subsequent terrain edits. Spatial actor indexing is not a proven navigation graph. No native hook, engine reload, generated borders, live crossing or whole-process memory qualification.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path, default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output', type=Path, default=ROOT/'output/native-terrain-generation-instruction-audit.json')
    args = parser.parse_args()
    report = audit(args.exe)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(dict(passed=True, verifiedInstructionAnchors=report['verifiedInstructionAnchors'],
                         vtableSlots=len(report['vtableSlots']), constructionBeforeExplicitPlacementStages=True,
                         safeBorderMutationHookQualified=False, browserUsed=False)))


if __name__ == '__main__':
    main()

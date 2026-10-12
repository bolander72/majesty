#!/usr/bin/env python3
"""Pin exposure routes that precede complete original actor restoration."""
import argparse
import hashlib
import json
from pathlib import Path
import struct

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
RANGES = [
    ('primary-component-reader', 0x5bfe50, 0x5c0b00),
    ('complete-unit-component-reader', 0x5c1f30, 0x5c1fe9),
    ('world-unit-registration', 0x5a12e0, 0x5a1347),
    ('registry-group-broadcast', 0x596a40, 0x596a70),
    ('actor-group-tree-and-list-insert', 0x596570, 0x5965ef),
    ('registered-unit-lookup', 0x5a10d0, 0x5a110c),
    ('original-primary-writer', 0x5c0bd0, 0x5c0ded),
    ('parent-resolving-cell-getter', 0x5ad420, 0x5ad465),
    ('unit-cell-update', 0x5ad470, 0x5ad4b1),
    ('unit-spatial-insert', 0x5ad3e0, 0x5ad400),
    ('unit-spatial-remove', 0x5ad400, 0x5ad420),
    ('family-load-finalization', 0x5c0b00, 0x5c0bc7),
]
ANCHORS = [
    (0x5c024f, 'cmp', 'eax, 9'),
    (0x5c0252, 'jne', '0x5c0adf'),
    (0x5c0264, 'call', '0x4ef700'),
    (0x5c0286, 'call', 'dword ptr [edx + 0x60]'),
    (0x5c029a, 'mov', 'dword ptr [edi + 0x64], ecx'),
    (0x5c02e6, 'mov', 'dword ptr [edi + 0x74], eax'),
    (0x5c02fb, 'call', 'dword ptr [edx + 0x6c]'),
    (0x5c0308, 'call', '0x5a2120'),
    (0x5c0314, 'mov', 'dword ptr [edi + 0x48], eax'),
    (0x5c031e, 'mov', 'dword ptr [edi + 0x4c], ecx'),
    (0x5c032f, 'mov', 'dword ptr [edi + 0x50], edx'),
    (0x5c0337, 'call', 'dword ptr [eax + 0x9c]'),
    (0x5a1303, 'mov', 'dword ptr [esi + 0x60], eax'),
    (0x5a1318, 'mov', 'dword ptr [esi + 0x60], eax'),
    (0x5a1329, 'mov', 'dword ptr [esi + 0x60], eax'),
    (0x5a1330, 'mov', 'dword ptr [esi + 0x84], edi'),
    (0x5a133d, 'call', '0x596a40'),
    (0x596a5e, 'call', 'dword ptr [eax]'),
    (0x596595, 'lea', 'ecx, [esi + 0x20]'),
    (0x5965a0, 'call', '0x596c80'),
    (0x5965b1, 'add', 'esi, 0xc'),
    (0x5965cd, 'call', '0x596ba0'),
    (0x5a10e7, 'call', '0x5969a0'),
    (0x5a10f1, 'call', 'dword ptr [edx + 0x28]'),
    (0x5c0c96, 'call', '0x5ad420'),
    (0x5ad423, 'mov', 'eax, dword ptr [esi + 0x74]'),
    (0x5ad42a, 'test', 'byte ptr [esi + 0x64], 0x80'),
    (0x5ad430, 'mov', 'ecx, dword ptr [esi + 0x84]'),
    (0x5ad437, 'call', '0x5a10d0'),
    (0x5ad447, 'call', '0x5ad420'),
    (0x5ad456, 'mov', 'ecx, dword ptr [esi + 0x54]'),
    (0x5ad45b, 'mov', 'edx, dword ptr [esi + 0x58]'),
    (0x5ad473, 'mov', 'eax, dword ptr [esi + 0x74]'),
    (0x5ad478, 'je', '0x5ad480'),
    (0x5ad47a, 'test', 'byte ptr [esi + 0x64], 0x80'),
    (0x5ad47e, 'je', '0x5ad4ad'),
    (0x5ad484, 'call', 'dword ptr [eax + 0x98]'),
    (0x5ad490, 'mov', 'dword ptr [esi + 0x54], ecx'),
    (0x5ad49a, 'mov', 'dword ptr [esi + 0x58], edx'),
    (0x5ad49d, 'call', 'dword ptr [eax + 0x94]'),
    (0x5ad4a4, 'call', 'dword ptr [0x6ce230]'),
    (0x5ad3ed, 'mov', 'eax, dword ptr [esi + 0x84]'),
    (0x5ad3f3, 'mov', 'ecx, dword ptr [eax + 0x88]'),
    (0x5ad3f9, 'call', '0x5b8630'),
    (0x5ad40d, 'mov', 'eax, dword ptr [esi + 0x84]'),
    (0x5ad413, 'mov', 'ecx, dword ptr [eax + 0x88]'),
    (0x5ad419, 'call', '0x5b88a0'),
    (0x5c0b91, 'call', 'dword ptr [edx + 0x1b4]'),
]
SLOTS = [(0x682950, 0x60, 0x42c3d0), (0x682950, 0x6c, 0x5a12e0),
         (0x68098c, 0x94, 0x5ad3e0), (0x68098c, 0x98, 0x5ad400),
         (0x68098c, 0x9c, 0x5ad470), (0x68098c, 0x1b4, 0x5a2370),
         (0x68a3a4, 0, 0x596570)]


def audit(path):
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != PIN:
        raise ValueError('Actor publication audit requires the pinned DirectDraw executable')
    pe = pefile.PE(data=raw)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    rows, methods = {}, []
    for name, start, end in RANGES:
        body = pe.get_data(start - base, end - start)
        code = list(decoder.disasm(body, start))
        meaningful = [i for i in code if i.mnemonic != 'nop']
        if sum(i.size for i in code) != len(body) or not meaningful or meaningful[-1].mnemonic != 'ret':
            raise ValueError('Incomplete original method: ' + name)
        rows.update({i.address: i for i in code})
        methods.append(dict(name=name, start=f'{start:08x}', end=f'{end:08x}',
                            instructions=len(code), sha256=hashlib.sha256(body).hexdigest()))
    for pc, mnemonic, operands in ANCHORS:
        row = rows[pc]
        if (row.mnemonic, row.op_str) != (mnemonic, operands):
            raise ValueError(f'Changed publication instruction {pc:08x}')
    for table, slot, target in SLOTS:
        if struct.unpack('<I', pe.get_data(table + slot - base, 4))[0] != target:
            raise ValueError(f'Changed publication slot {table:08x}+{slot:x}')
    # The version-9 branch always dispatches the cell method. That method
    # skips mutation only for a parented actor without the 0x80 state flag.
    sequence = [0x5c0264, 0x5c0286, 0x5c02fb, 0x5c0308, 0x5c0314, 0x5c0337]
    return dict(qualified=True, staticAuditOnly=True, executableSha256=PIN,
                methods=methods, instructionSites=len(ANCHORS), vtableSlots=len(SLOTS),
                checkedInstructions=[dict(pc=f'{pc:08x}', mnemonic=m, operands=o)
                                     for pc, m, o in ANCHORS],
                version9PrimarySequence=[f'{pc:08x}' for pc in sequence],
                registryExposureBeforeDescriptionAndPosition=True,
                registryBroadcastTouchesActorTreeAndList=True,
                version9AlwaysDispatchesCellMethod=True,
                cellMutationSkippedForParentedActorsWithoutFlag80=True,
                parentlessOrFlag80ActorsCanMutateSpatialMembership=True,
                cellUpdateCanInvokeGlobalObserver=True,
                primaryWriterCallsParentResolvingCellGetter=True,
                parentedCellGetterReadsWorldAssociation=True,
                privateParentedSerializationNeedsQualifiedContext=True,
                sourceTableCoverage=['00682950', '0068098c', '0068a3a4'],
                spatialInsertImplementationClosed=False,
                globalObserverRuntimeTargetQualified=False,
                allPrimaryVersionsQualified=False,
                unregisteredFullActorRestoreQualified=False,
                publicationDeferralImplemented=False,
                completeActorRollbackQualified=False,
                nativeCodeExecuted=False, browserUsed=False,
                limitations='Static evidence for the selected original tables and version-9 path. '
                'A paused frame does not undo directory/spatial exposure. Zero identity/world fields '
                'are necessary private-loader checks, not proof of absent aliases. A full staged '
                'actor loader must defer registry and spatial publication, preserve original '
                'description/secondary state and qualify cleanup before publishing or activating.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path,
                        default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output', type=Path, default=ROOT/'output/native-actor-publication-audit.json')
    args = parser.parse_args()
    result = audit(args.exe)
    result['sourceSha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(dict(qualified=True, methods=len(result['methods']),
                          instructionSites=result['instructionSites'],
                          vtableSlots=result['vtableSlots'], staticAuditOnly=True)))


if __name__ == '__main__':
    main()

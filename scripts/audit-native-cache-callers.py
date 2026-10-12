#!/usr/bin/env python3
"""Trace two UI registration literals through initial listener construction."""
import hashlib
import importlib.util
import json
from pathlib import Path
import struct

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
DEPENDENCY = ROOT/'scripts/audit-native-listener-cache.py'
RANGES = [
    ('ui-registration-caller', 0x00437b10, 0x00437d67),
    ('ui-listener-factory', 0x004384b0, 0x0043874b),
    ('derived-cache-listener-constructor', 0x0043ac50, 0x0043ac86),
    ('factory-embedded-initializer', 0x0043a0b0, 0x0043a118),
    ('base-cache-listener-constructor', 0x005c7b30, 0x005c7c15),
]
ANCHORS = [
    (0x00437cc5, 'push', '5'), (0x00437cc7, 'push', '2'),
    (0x00437ccb, 'call', '0x4384b0'), (0x00437cd0, 'mov', 'ebx, eax'),
    (0x00437cea, 'mov', 'edi, dword ptr [ebx + 8]'),
    (0x00437d18, 'mov', 'eax, dword ptr [edi]'),
    (0x00437d1a, 'push', '0x80ffffff'), (0x00437d1f, 'push', 'ecx'),
    (0x00437d20, 'mov', 'ecx, edi'), (0x00437d22, 'call', 'dword ptr [eax + 0xe8]'),
    (0x00437d40, 'mov', 'edx, dword ptr [edi]'),
    (0x00437d42, 'push', '0x80cccccc'), (0x00437d47, 'push', 'eax'),
    (0x00437d48, 'mov', 'ecx, edi'), (0x00437d4a, 'call', 'dword ptr [edx + 0xe8]'),
    (0x0043851c, 'mov', 'eax, dword ptr [esp + 0x34]'),
    (0x00438527, 'dec', 'eax'), (0x0043852e, 'je', '0x4385d3'),
    (0x00438534, 'dec', 'eax'), (0x00438535, 'je', '0x438593'),
    (0x00438593, 'push', '0xa0'), (0x004385c2, 'mov', 'ecx, eax'),
    (0x004385c4, 'call', '0x43ac50'),
    (0x004385ce, 'mov', 'dword ptr [esi + 8], eax'),
    (0x0043ac6e, 'call', '0x5c7b30'),
    (0x0043ac7a, 'mov', 'dword ptr [esi], 0x680f6c'),
    (0x0043a117, 'ret', ''),
    (0x005c7b69, 'call', '0x5c2630'),
    (0x005c7b9e, 'mov', 'dword ptr [esi + 0x88], eax'),
    (0x005c7ba4, 'mov', 'dword ptr [esi + 0x8c], edi'),
    (0x005c7bb9, 'mov', 'dword ptr [esi], 0x68a8f0'),
]


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def audit(executable):
    data = executable.read_bytes()
    if hashlib.sha256(data).hexdigest() != PIN:
        raise ValueError('Cache caller audit requires the pinned executable')
    lineage = load(DEPENDENCY, 'cache_caller_lineage')
    preceding = lineage.audit(executable)
    resources = lineage.load(lineage.DEPENDENCY, 'cache_caller_resources')
    flow = resources.load(resources.FLOW_SOURCE, 'cache_caller_flow')
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    ranges, rows = [], {}
    for label, start, end in RANGES:
        instructions = [dict(address=f'{i.address:08x}', bytes=i.bytes.hex(),
            mnemonic=i.mnemonic, operands=i.op_str)
            for i in decoder.disasm(pe.get_data(start-base, end-start), start)]
        if sum(len(bytes.fromhex(i['bytes'])) for i in instructions) != end-start:
            raise ValueError(f'Incomplete cache caller range: {label}')
        ranges.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}',
            instructions=instructions, **flow.inspect_flow(instructions)))
        rows.update({int(i['address'], 16): i for i in instructions})
    for at, mnemonic, operands in ANCHORS:
        row = rows.get(at)
        if not row or (row['mnemonic'], row['operands']) != (mnemonic, operands):
            raise ValueError(f'Cache caller anchor changed at {at:08x}')
    slots = []
    for table in [0x00680f6c, 0x0068a8f0]:
        target = struct.unpack('<I', pe.get_data(table+0xe8-base, 4))[0]
        if target != 0x005c88f0:
            raise ValueError('Initial cache registration slot changed')
        slots.append(dict(table=f'{table:08x}', offset=0xe8, target=f'{target:08x}'))
    return dict(executableSha256=PIN, ranges=ranges, verifiedInstructionAnchors=len(ANCHORS),
        vtableSlots=slots, precedingLineageAnchors=preceding['verifiedInstructionAnchors'],
        registrations=[dict(call='00437d22', metadata='80ffffff', firstArgument='[ebp+8]'),
            dict(call='00437d4a', metadata='80cccccc', firstArgument='[005c3490 result +0x50]+8')],
        constructorChain=['004384b0 selector 2', '0043ac50', '005c7b30', '005c2630'],
        cacheMetadataEntryStackOffset=8, scalarLiteralsAtTwoCallerSitesQualified=True,
        metadataColorInterpretationIsInference=True, metadataConsumerMeaningQualified=False,
        initialDerivedRegistrationTargetQualified=True, liveReceiverVtableQualified=False,
        interveningCallbackEffectsQualified=False, allCacheCallersQualified=False,
        allCacheWritersQualified=False, actorReferenceRetentionExcluded=False,
        completeDetachQualified=False, boundedNativeSimulationQualified=False,
        liveNativePagingQualified=False, nativeInstructionsExecuted=False,
        gameLaunched=False, browserUsed=False, nativeBuildRun=False,
        limitations='Two pinned caller sites and initial constructor selection only. '
            'The literals resemble display colors, but consumers are not qualified. '
            'Intervening callbacks may change live receiver identity or state. '
            'No exhaustive caller inventory, actor-reference exclusion or scoped detach proof.')


def main():
    output = ROOT/'output/native-cache-callers-audit.json'
    output.unlink(missing_ok=True)
    executable = ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    report = audit(executable)
    output.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(dict(passed=True, ranges=len(report['ranges']),
        instructions=sum(len(r['instructions']) for r in report['ranges']),
        anchors=report['verifiedInstructionAnchors'], literalRegistrationSites=2,
        gameLaunches=0)))


if __name__ == '__main__':
    main()

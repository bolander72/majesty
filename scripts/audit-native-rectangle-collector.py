#!/usr/bin/env python3
"""Close pinned collector/splitter instruction targets for isolated CPU checks."""
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
DEPENDENCY = ROOT/'scripts/audit-native-listener-rectangles.py'
RANGES = [(0x00505860, 0x00505dae), (0x00505db0, 0x00506322)]
ANCHORS = [
    (0x005058d7, 'mov', 'esi, dword ptr [ebp + eax*4 + 0x34]'),
    (0x00505911, 'cmp', 'esi, dword ptr [ebp + 0x10]'),
    (0x00505916, 'mov', 'dword ptr [ebp + eax*4 + 0x34], 1'),
    (0x005058f2, 'mov', 'edx, dword ptr [esp + 0x24]'),
    (0x005058f6, 'mov', 'dword ptr [ecx + 8], edx'),
    (0x005058f9, 'mov', 'edx, dword ptr [esp + 0x28]'),
    (0x005058fd, 'mov', 'dword ptr [ecx + 0xc], edx'),
    (0x00505c8c, 'call', '0x505860'),
    (0x00505ce7, 'call', '0x505db0'),
    (0x00505d50, 'call', '0x505860'),
    (0x00505e33, 'cmp', 'eax, 0xf'),
    (0x00505e36, 'ja', '0x50631b'),
    (0x00505e3c, 'jmp', 'dword ptr [eax*4 + 0x506324]'),
]


def audit(executable):
    data = executable.read_bytes()
    if hashlib.sha256(data).hexdigest() != PIN:
        raise ValueError('Rectangle collector audit requires the pinned executable')
    spec = importlib.util.spec_from_file_location('rectangle_dependency', DEPENDENCY)
    dependency = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(dependency)
    preceding = dependency.audit(executable)
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    ranges, rows, calls = [], {}, []
    for start, end in RANGES:
        decoded = [dict(address=f'{i.address:08x}', bytes=i.bytes.hex(), mnemonic=i.mnemonic, operands=i.op_str)
            for i in decoder.disasm(pe.get_data(start-base, end-start), start)]
        if sum(len(bytes.fromhex(i['bytes'])) for i in decoded) != end-start or decoded[-1]['mnemonic'] != 'ret':
            raise ValueError('Incomplete rectangle collector range')
        ranges.append(dict(start=f'{start:08x}', end=f'{end:08x}', instructions=decoded))
        rows.update({int(i['address'], 16): i for i in decoded})
        calls += [dict(caller=f'{start:08x}', **i) for i in decoded if i['mnemonic'] == 'call']
    for at, mnemonic, operands in ANCHORS:
        row = rows.get(at)
        if not row or (row['mnemonic'], row['operands']) != (mnemonic, operands):
            raise ValueError(f'Collector instruction anchor changed at {at:08x}')
    switch = list(struct.unpack('<16I', pe.get_data(0x00506324-base, 64)))
    if any(t not in rows or not 0x00505db0 <= t < 0x00506322 for t in switch):
        raise ValueError('Splitter switch target misses audited instruction boundary')
    for row in rows.values():
        if row['mnemonic'].startswith('j'):
            operand = row['operands']
            if operand.startswith('0x'):
                if int(operand, 16) not in rows:
                    raise ValueError('Collector direct branch escapes instruction closure')
            elif row['address'] != '00505e3c':
                raise ValueError('Unqualified collector indirect branch')
    if any(c['operands'] not in ['0x505860', '0x505db0'] for c in calls):
        raise ValueError('Collector calls an external routine')
    return dict(executableSha256=PIN, precedingRectangleAnchors=preceding['verifiedInstructionAnchors'],
        dependencySourceSha256=hashlib.sha256(DEPENDENCY.read_bytes()).hexdigest(),
        verifiedInstructionAnchors=len(ANCHORS), ranges=ranges, calls=calls,
        splitterSwitch=dict(table='00506324', unsignedMaximumIndex=15,
            targets=[f'{t:08x}' for t in switch]), instructionTargetClosureQualified=True,
        allocatorAndImportCallSites=0, allNumericGeometryQualified=False,
        recursionBoundQualified=False, liveBufferBoundsQualified=False,
        liveNativePagingQualified=False, browserUsed=False, nativeBuildRun=False)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path, default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output', type=Path, default=ROOT/'output/native-rectangle-collector-audit.json')
    args = parser.parse_args()
    args.output.unlink(missing_ok=True)
    report = audit(args.exe)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(dict(passed=True, anchors=report['verifiedInstructionAnchors'],
        switchTargets=16, allocatorCalls=0, gameLaunches=0)))


if __name__ == '__main__':
    main()

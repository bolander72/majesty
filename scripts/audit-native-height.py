#!/usr/bin/env python3
"""Pinned height reader/writer conversion and delta-method instruction evidence."""
import argparse
import hashlib
import json
from pathlib import Path
import struct

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
RANGES = [('terrain-reader', 0x005f2a80, 0x005f2e20),
          ('terrain-writer', 0x005f2fa0, 0x005f3140),
          ('height-delta', 0x005f1a40, 0x005f1ae0),
          ('height-clear', 0x005aeb70, 0x005aeb9b)]


def audit(executable):
    data = executable.read_bytes()
    if hashlib.sha256(data).hexdigest() != PIN:
        raise ValueError('Native height audit requires the pinned executable')
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    if struct.unpack('<f', pe.get_data(0x006801bc-base, 4))[0] != 1/65536:
        raise ValueError('Pinned Q16 serialization scale changed')
    if struct.unpack('<d', pe.get_data(0x0067f940-base, 8))[0] != 1/65536:
        raise ValueError('Pinned height zero threshold changed')
    if struct.unpack('<I', pe.get_data(0x0068b660+0x20-base, 4))[0] != 0x005f1a40:
        raise ValueError('Pinned terrain delta method changed')
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    rows, addresses = [], {}
    for label, start, end in RANGES:
        decoded = []
        for insn in decoder.disasm(pe.get_data(start-base, end-start), start):
            row = dict(address=f'{insn.address:08x}', size=insn.size,
                       bytes=insn.bytes.hex(), mnemonic=insn.mnemonic, operands=insn.op_str)
            addresses[insn.address] = row
            decoded.append(row)
        rows.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}', instructions=decoded))
    anchors = [
        (0x005f2b4b, 'mov', 'edx, ecx'),
        (0x005f2b53, 'and', 'eax, 0x7fffffff'),
        (0x005f2b60, 'fcomp', 'qword ptr [0x67f940]'),
        (0x005f2b6d, 'xor', 'eax, eax'),
        (0x005f2b73, 'mov', 'ecx, 0x86'),
        (0x005f2b80, 'sub', 'ecx, eax'),
        (0x005f2b8d, 'or', 'eax, 0x800000'),
        (0x005f2b92, 'sar', 'eax, cl'),
        (0x005f2ba2, 'shl', 'eax, cl'),
        (0x005f2ba4, 'test', 'edx, 0x80000000'),
        (0x005f2bac, 'neg', 'eax'),
        (0x005f2bb6, 'mov', 'dword ptr [edi], eax'),
        (0x005f3045, 'fild', 'dword ptr [esi]'),
        (0x005f304e, 'fmul', 'dword ptr [0x6801bc]'),
        (0x005f3054, 'fstp', 'dword ptr [esp + 0x18]'),
        (0x005f1a47, 'mov', 'ecx, dword ptr [ecx + 0x4c]'),
        (0x005f1a66, 'fild', 'dword ptr [esp + 0xc]'),
        (0x005f1a6a, 'fdiv', 'dword ptr [edx + 8]'),
        (0x005f1a6d, 'fsubr', 'st(1)'),
        (0x005f1a97, 'mov', 'dword ptr [esi], eax'),
        (0x005f1ada, 'mov', 'dword ptr [esi], eax'),
        (0x005aeb84, 'mov', 'dword ptr [edx + esi], 0'),
    ]
    for at, mnemonic, operands in anchors:
        row = addresses.get(at)
        if not row or (row['mnemonic'], row['operands']) != (mnemonic, operands):
            raise ValueError(f'Pinned native height anchor changed at {at:08x}')
    # These are verified instruction blocks inside established reader/writer
    # functions, not claimed function entries or arbitrary suffix decodings.
    blocks = [('reader-height', 0x005f2b4b, 0x005f2bae),
              ('writer-height', 0x005f3045, 0x005f3058)]
    for _, start, end in blocks:
        if start not in addresses or end not in addresses:
            raise ValueError('Native height block is not on instruction boundaries')
        for row in addresses.values():
            at = int(row['address'], 16)
            if not start <= at < end:
                continue
            if row['mnemonic'].startswith('j'):
                target = int(row['operands'], 16)
                if not start <= target <= end or target not in addresses:
                    raise ValueError('Native height branch leaves its verified block')
            if row['mnemonic'] == 'call':
                raise ValueError('Native height block unexpectedly calls another function')
    return dict(executableSha256=PIN, verifiedInstructionAnchors=len(anchors), ranges=rows,
                inlineBlocks=[dict(label=label, start=f'{start:08x}', end=f'{end:08x}') for label, start, end in blocks],
                nativeFractionBits=16, zeroThreshold=1/65536, serializedHeight='float32',
                readerConversion='truncate magnitude toward zero; x86 shifts can wrap out-of-range values',
                deltaMethod='height -= integerDelta / configuration[+8]; result converted back to signed Q16',
                coordinateValidationInsideDeltaMethod=False,
                safeBorderMutationHookQualified=False, nativeWorldUsed=False, browserUsed=False)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path, default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output', type=Path, default=ROOT/'output/native-height-instruction-audit.json')
    args = parser.parse_args()
    result = audit(args.exe)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(dict(passed=True, anchors=result['verifiedInstructionAnchors'], inlineBlocks=len(result['inlineBlocks']), gameLaunches=0)))


if __name__ == '__main__':
    main()

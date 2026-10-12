#!/usr/bin/env python3
"""Audit the pinned per-agent restore/ownership boundary before isolated trials."""
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


def audit(executable):
    data = executable.read_bytes()
    if hashlib.sha256(data).hexdigest() != PIN:
        raise ValueError('The agent-restore audit requires the pinned DirectDraw executable')
    spec = importlib.util.spec_from_file_location('agent_state', Path(__file__).with_name('audit-native-agent-state.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    state = module.audit(executable)
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    records, decoded = [], {}
    for label, start, end in [
        ('agent-constructor', 0x00625e70, 0x00625f9d),
        ('agent-destructor', 0x00625fa0, 0x00626105),
        ('runtime-getter', 0x00623b20, 0x00623b29),
        ('agent-lookup', 0x006236b0, 0x006236c0),
        ('manager-lookup', 0x00633090, 0x006330df),
        ('agent-id-allocation', 0x00623b30, 0x00623b3a),
        ('attribute-value-read', 0x00626c10, 0x00626c51),
        ('pooled-value-allocation', 0x0062a810, 0x0062a88d),
        ('pooled-value-return', 0x0062aa20, 0x0062abdc),
        ('native-attribute-lookup', 0x00426700, 0x00426768),
    ]:
        raw = pe.get_data(start-base, end-start)
        instructions = [dict(address=f'{i.address:08x}', bytes=i.bytes.hex(),
                             mnemonic=i.mnemonic, operands=i.op_str)
                        for i in decoder.disasm(raw, start)]
        if sum(len(bytes.fromhex(i['bytes'])) for i in instructions) != len(raw):
            raise ValueError(f'Incomplete decoding: {label}')
        if instructions[-1]['mnemonic'] != 'ret':
            raise ValueError(f'Incomplete method boundary: {label}')
        decoded.update({i['address']: i for i in instructions})
        records.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}', instructions=instructions))
    checks = [
        ('native-attribute-return', '00426765', 'ret', '8'),
        ('constructor-allocate-functions', '00625ea9', 'mov', 'dword ptr [edi + 8], eax'),
        ('constructor-allocate-id', '00625ee1', 'call', '0x6285a0'),
        ('constructor-id', '00625ee6', 'mov', 'dword ptr [edi + 0x10], eax'),
        ('constructor-attribute-map', '00625f79', 'mov', 'dword ptr [edi], esi'),
        ('constructor-native-cache', '00625f7b', 'mov', 'dword ptr [edi + 0x24], ebx'),
        ('constructor-native-id', '00625f84', 'mov', 'dword ptr [edi + 0x20], ebx'),
        ('destructor-return-value', '00625fe2', 'call', '0x62aa20'),
        ('destructor-attribute-tree', '00626037', 'call', '0x627220'),
        ('destructor-name', '00626081', 'call', '0x4e3820'),
        ('destructor-function-head', '006260e2', 'call', '0x645bc0'),
        ('runtime-field', '00623b25', 'mov', 'eax, dword ptr [eax + 0x10]'),
        ('lookup-manager', '006236b4', 'mov', 'ecx, dword ptr [ecx + 4]'),
        ('lookup-original', '006236b8', 'call', '0x633090'),
        ('id-counter-read', '00623b30', 'mov', 'eax, dword ptr [ecx + 0x34]'),
        ('id-counter-write', '00623b36', 'mov', 'dword ptr [ecx + 0x34], edx'),
        ('read-value-from-pool', '00626c3a', 'call', '0x62a810'),
        ('read-typed-payload', '00626c4a', 'call', 'dword ptr [edx + 0x24]'),
    ]
    for label, address, mnemonic, operands in checks:
        actual = decoded[address]
        if (actual['mnemonic'], actual['operands']) != (mnemonic, operands):
            raise ValueError(f'Unexpected agent-restore instruction: {label}')
    reader = struct.unpack('<I', pe.get_data(0x0068c100-base, 4))[0]
    if reader != 0x00626c10:
        raise ValueError('Unexpected original agent attribute-value reader')
    return dict(executableSha256=PIN, stateBoundaryInstructionCount=sum(len(r['instructions']) for r in state['ranges']),
                ranges=records, checkedInstructions=[dict(label=label, **decoded[address]) for label,address,_,_ in checks],
                limitations='Same-world unregistered agent round trip only. Constructor consumes a fresh ID, '
                'reader restores the saved source ID without manager insertion. Pool warming can retain a batch; '
                'no external-reference/queue/timer remapping, activation, hero classification or regional transfer.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path, default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output', type=Path, default=ROOT/'output/native-agent-restore-audit.json')
    args = parser.parse_args()
    result = audit(args.exe)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2)+'\n')
    print(f'Pinned per-agent restoration boundary verified; {sum(len(r["instructions"]) for r in result["ranges"])} additional instructions')


if __name__ == '__main__':
    main()

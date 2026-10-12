#!/usr/bin/env python3
"""Verify original raw timer serialization and unsigned cross-world clock arithmetic."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


def dependency(name, executable):
    spec = importlib.util.spec_from_file_location(name, ROOT/'scripts'/f'{name}.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.audit(executable)


def audit(executable):
    data = executable.read_bytes()
    if hashlib.sha256(data).hexdigest() != PIN:
        raise ValueError('Arrival audit requires the pinned DirectDraw executable')
    live = dependency('audit-native-actor-live', executable)
    typed = dependency('audit-native-script-values', executable)
    refs = dependency('audit-native-unit-references', executable)
    pe = pefile.PE(data=data)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    ranges = []
    for label, start, end in [('raw-four-byte-state-writer', 0x4eecc0, 0x4eed0d),
                              ('original-scheduler-clock-argument', 0x5d8d50, 0x5d8d67)]:
        raw = pe.get_data(start-base, end-start)
        rows = [dict(address=f'{i.address:08x}', bytes=i.bytes.hex(), mnemonic=i.mnemonic, operands=i.op_str)
                for i in decoder.disasm(raw, start)]
        if sum(len(bytes.fromhex(i['bytes'])) for i in rows) != len(raw) or rows[-1]['mnemonic'] != 'ret':
            raise ValueError('Incomplete original arrival method: '+label)
        ranges.append(dict(label=label, start=f'{start:08x}', end=f'{end:08x}', instructions=rows))
    decoded = {i['address']: i for r in ranges + live['ranges'] + typed['ranges'] + refs['ranges'] for i in r['instructions']}
    checks = [
        ('state-start-delay', '006394ea', 'lea', 'ecx, [esi + 0x34]'),
        ('serialize-delay-bits', '00644948', 'mov', 'eax, dword ptr [esi]'),
        ('serialize-stamp-bits', '00644952', 'mov', 'ecx, dword ptr [esi + 4]'),
        ('raw-four-byte-width', '004eecdd', 'push', '4'),
        ('raw-four-byte-source', '004eecd9', 'lea', 'eax, [esp + 8]'),
        ('raw-four-byte-write', '004eece0', 'call', '0x64b4e7'),
        ('context-clock-read', '00639268', 'mov', 'edi, dword ptr [esp + 0x10]'),
        ('elapsed-subtract', '00639271', 'sub', 'ecx, edx'),
        ('unsigned-delay-compare', '00639276', 'cmp', 'ecx, edx'),
        ('unsigned-delay-branch', '00639278', 'jb', '0x6392d8'),
        ('zero-stamp-special-case', '00639291', 'cmp', 'ecx, ebx'),
        ('zero-stamp-branch', '00639293', 'je', '0x6392ad'),
        ('scheduler-global-clock', '005d8d55', 'mov', 'ecx, dword ptr [0x71c6a8]'),
        ('scheduler-clock-argument', '005d8d5e', 'push', 'ecx'),
        ('scheduler-update', '005d8d61', 'call', '0x633430'),
        ('resume-delay', '00626e81', 'mov', 'esi, dword ptr [eax + 0x34]'),
        ('resume-remainder', '00626e84', 'mov', 'edx, dword ptr [eax + 0x40]'),
        ('resume-subtract-delay', '00626e8a', 'sub', 'ecx, esi'),
        ('resume-add-remainder', '00626e8d', 'add', 'ecx, edx'),
    ]
    for label, address, mnemonic, operands in checks:
        if (decoded[address]['mnemonic'], decoded[address]['operands']) != (mnemonic, operands):
            raise ValueError('Unexpected original arrival instruction: '+label)
    return dict(executableSha256=PIN, ranges=ranges,
                checkedInstructions=[dict(label=label, **decoded[address]) for label, address, _, _ in checks],
                liveInstructions=sum(len(r['instructions']) for r in live['ranges']),
                typedInstructions=sum(len(r['instructions']) for r in typed['ranges']),
                referenceInstructions=sum(len(r['instructions']) for r in refs['ranges']),
                timerWords=['delay-ms:uint32', 'stamp-ms:uint32', 'flags:uint32', 'paused-remainder-ms:uint32'],
                limitations='Read-only arrival preparation audit. Clocks must come from stopped snapshot inputs; '
                'the saved GPL runtime prefix is not assumed to be the scheduler clock. No allocation, '
                'destination function resolution, container activation or transactional actor crossing.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path, default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    parser.add_argument('--output', type=Path, default=ROOT/'output/native-actor-arrival-audit.json')
    args = parser.parse_args()
    result = audit(args.exe)
    args.output.write_text(json.dumps(result, indent=2)+'\n')
    print('Pinned arrival timer operations verified;', sum(len(r['instructions']) for r in result['ranges']), 'additional instructions')


if __name__ == '__main__':
    main()

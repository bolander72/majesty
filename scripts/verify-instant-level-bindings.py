#!/usr/bin/env python3
"""Audit the original stat IDs/value ABI and emulate its bounded HP random draws."""
import argparse
import hashlib
import json
from pathlib import Path
import struct

import capstone
import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_ESP

PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
# Static constructors register precisely these four-byte property IDs.
REGISTRATIONS = {0x41b940: 0, 0x41b9c0: 1, 0x41ba40: 2, 0x41bac0: 3,
                 0x41bb40: 4, 0x41bbc0: 5, 0x41bc40: 6, 0x41bcc0: 7,
                 0x41bdc0: 9, 0x41c3c0: 11, 0x41c540: 14}


def audit(filename):
    data = filename.read_bytes()
    if hashlib.sha256(data).hexdigest() != PIN:
        raise ValueError('Requires the pinned DirectDraw executable')
    pe = pefile.PE(data=data)
    image = pe.get_memory_mapped_image()
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    decoder.detail = True
    for address, index in REGISTRATIONS.items():
        pushes, found = [], False
        for instruction in decoder.disasm(pe.get_data(address - 0x400000, 128), address):
            if instruction.mnemonic == 'push' and instruction.operands[0].type == capstone.x86.X86_OP_IMM:
                pushes.append(instruction.operands[0].imm)
            if instruction.mnemonic == 'call' and instruction.op_str == '0x59a100':
                found = pushes[-4:] == [index, 0x56, 0x50, 0x41]
                break
        if not found:
            raise ValueError(f'Attribute registration changed at {address:08x}')
    # Native int&, bool&, string& conversion slots on the original value ABI.
    if struct.unpack_from('<III', image, 0x67f540 - 0x400000 + 0x28) != (
            0x624850, 0x6248b0, 0x624910):
        raise ValueError('Original GPL value reference slots changed')
    wrapper = pe.get_data(0x623710 - 0x400000, 16)
    if (wrapper[:8] != bytes.fromhex('8b44240483c12050') or
            wrapper[8] != 0xe8 or wrapper[13:16] != bytes.fromhex('c20400') or
            0x62371d + struct.unpack_from('<i', wrapper, 9)[0] != 0x4f6690):
        raise ValueError('Original GPL random-state wrapper changed')
    cpu = Uc(UC_ARCH_X86, UC_MODE_32)
    cpu.mem_map(0x4f6000, 4096); cpu.mem_write(0x4f6690, pe.get_data(0xf6690, 64))
    for page in [0x100000, 0x200000, 0x300000]: cpu.mem_map(page, 4096)
    count = 0
    for initial in [0, 1, 0x12345678, 0x7fffffff, 0x80000000, 0xffffffff]:
        for bound in [1, 2, 3, 5, 19, 500, 0x7fffffff]:
            seed = initial
            cpu.mem_write(0x100004, struct.pack('<I', seed))
            for _ in range(32):
                x = (seed * 0x19660d + 0xae135d3) & 0xffffffff
                signed = x if x < 0x80000000 else x - 0x100000000
                seed = (((signed >> 16) + x) ^ 0x6d25) & 0x7fffffff
                expected = 0 if bound < 2 else seed % bound
                cpu.reg_write(UC_X86_REG_ECX, 0x100000)
                cpu.reg_write(UC_X86_REG_ESP, 0x200800)
                cpu.mem_write(0x200800, struct.pack('<II', 0x300000, bound))
                cpu.emu_start(0x4f6690, 0x300000, count=128, timeout=100000)
                if cpu.reg_read(UC_X86_REG_EAX) != expected or struct.unpack(
                        '<I', cpu.mem_read(0x100004, 4))[0] != seed:
                    raise ValueError('Bulk HP PRNG differs from original instructions')
                count += 1
    return dict(executableSha256=PIN, attributeRegistrations=len(REGISTRATIONS),
                nativeValueSlotsVerified=True, originalRandomCases=count,
                originalRandomStateOffset=0x24, passed=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('executable', type=Path)
    args = parser.parse_args()
    print(json.dumps(audit(args.executable)))

#!/usr/bin/env python3
"""Run the original Path cursor/count branch only; no search or gameplay leaf."""
import hashlib
import json
from pathlib import Path
import struct

import capstone
import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE, UC_HOOK_MEM_READ, UC_HOOK_MEM_WRITE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EDX, UC_X86_REG_ESI, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


def main():
    output = ROOT / 'output/native-order-replan-branch-observed.json'
    if output.exists():
        raise ValueError('Preserve earlier evidence')
    executable = ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    raw = executable.read_bytes()
    if hashlib.sha256(raw).hexdigest() != PIN:
        raise ValueError('Requires pinned executable before CPU construction')
    pe = pefile.PE(data=raw)
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    start, end, reuse = 0x5e1425, 0x5e1441, 0x5e14d4
    native = pe.get_data(start - base, end - start)
    instructions = list(decoder.disasm(native, start))
    if sum(i.size for i in instructions) != len(native):
        raise ValueError('Incomplete branch range')
    rows = {i.address: (i.mnemonic, i.op_str) for i in instructions}
    for at, expected in {0x5e1427: ('mov', 'ecx, dword ptr [esi + 0x48]'),
                         0x5e142e: ('inc', 'ecx'),
                         0x5e1436: ('mov', 'eax, dword ptr [esi + 0x4c]'),
                         0x5e1439: ('cmp', 'ecx, eax'),
                         0x5e143b: ('jl', '0x5e14d4')}.items():
        if rows.get(at) != expected:
            raise ValueError('Changed original cursor/count branch')
    # Serialized body bytes and native allocation bytes differ. Capacity used
    # by the original reader is +5c; +50 is a different saved scalar.
    allocation = list(decoder.disasm(pe.get_data(0x5da5de - base, 7), 0x5da5de))
    if [(i.mnemonic, i.op_str) for i in allocation] != [('push', '0x64'), ('call', '0x64c616')]:
        raise ValueError('Changed native Path allocation')
    observations = []
    data, stack = 0x100000, 0x200000
    for poison in [0x5a, 0xc3]:
        for cursor, count, selected in [(8, 10, 'reuse'), (9, 10, 'replan'),
                                        (10, 10, 'replan'), (0, 0, 'replan'), (0, 10, 'reuse')]:
            cpu = Uc(UC_ARCH_X86, UC_MODE_32)
            pages = [data, stack, start & ~4095]
            hooks = []
            steps = 0
            reached = None
            try:
                for page in pages:
                    cpu.mem_map(page, 4096)
                cpu.mem_write(start, native)
                cpu.mem_write(data, bytes([poison]) * 4096)
                cpu.mem_write(stack, bytes([poison]) * 4096)
                cpu.mem_write(data + 0x48, struct.pack('<2I', cursor, count))
                cpu.mem_write(data + 256, struct.pack('<2i', 147, 371))
                before = bytes(cpu.mem_read(data, 4096))
                sp = stack + 2048
                cpu.reg_write(UC_X86_REG_ESI, data)
                cpu.reg_write(UC_X86_REG_EAX, data + 256)
                cpu.reg_write(UC_X86_REG_ESP, sp)

                def code(uc, at, size, context):
                    nonlocal steps, reached
                    if at in [end, reuse]:
                        reached = 'replan' if at == end else 'reuse'
                        uc.emu_stop()
                        return
                    if at not in rows:
                        raise ValueError('Unexpected original branch instruction')
                    steps += 1
                    if steps > 12:
                        raise ValueError('Branch instruction budget exceeded')

                def read(uc, access, at, size, value, context):
                    if not (data <= at and at + size <= data + 4096):
                        raise ValueError('Unexpected branch data read')

                def write(uc, access, at, size, value, context):
                    if not (sp + 0x24 <= at and at + size <= sp + 0x2c):
                        raise ValueError('Unexpected branch data write')

                hooks = [cpu.hook_add(UC_HOOK_CODE, code), cpu.hook_add(UC_HOOK_MEM_READ, read),
                         cpu.hook_add(UC_HOOK_MEM_WRITE, write)]
                cpu.emu_start(start, 0, timeout=100000, count=16)
                if (reached != selected or bytes(cpu.mem_read(data, 4096)) != before or
                        cpu.reg_read(UC_X86_REG_ESP) != sp):
                    raise ValueError('Wrong original branch or changed private order state')
                observations.append(dict(cursor=cursor, count=count, branch=reached,
                                         stackPoison=poison, originalInstructions=steps))
            finally:
                for hook in hooks:
                    cpu.hook_del(hook)
                for page in pages:
                    cpu.mem_unmap(page, 4096)
                if list(cpu.mem_regions()):
                    raise ValueError('Branch guest mappings retained')
    if hashlib.sha256(executable.read_bytes()).hexdigest() != PIN:
        raise ValueError('Executable changed during branch checks')
    report = dict(qualified=True, executableSha256=PIN, scope='original Path cursor+1<count branch only',
                  observations=observations, nativeOrderBytes=100, serializedPathBodyBytes=140,
                  nativeCapacityOffset=0x5c, mappedGuestBytesPeak=12288, mappedGuestBytesAfterCleanup=0,
                  originalInstructions=sum(r['originalInstructions'] for r in observations),
                  originalPathSearchExecuted=False, originalGameplayLeafExecuted=False,
                  destinationLandingQualified=False, browserUsed=False, gameLaunched=False,
                  sourceSha256={'scripts/check-native-order-replan-branch.py': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},
                  branchBytesSha256=hashlib.sha256(native).hexdigest())
    output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ['qualified', 'originalInstructions', 'mappedGuestBytesPeak',
                                          'originalPathSearchExecuted']}))


if __name__ == '__main__':
    main()

"""Execute the original terrain RNG setter without changing other owners."""
import hashlib
from pathlib import Path
import struct

import pefile
import pytest
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE, UC_HOOK_MEM_WRITE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


@pytest.fixture(scope='module')
def original_cpu():
    raw = (ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    assert hashlib.sha256(raw).hexdigest() == PIN
    pe = pefile.PE(data=raw)
    cpu = Uc(UC_ARCH_X86, UC_MODE_32)
    size = (pe.OPTIONAL_HEADER.SizeOfImage+4095)//4096*4096
    assert size <= 4*1024*1024
    cpu.mem_map(0x400000, size)
    cpu.mem_write(0x400000, pe.get_memory_mapped_image())
    cpu.mem_map(0x2000000, 32768)
    cpu.mem_map(0x3000000, 4096)
    return cpu


def call(cpu, address, owner=0, argument=None):
    sp = 0x2004000
    cpu.mem_write(sp, struct.pack('<I', 0x3000000))
    if argument is not None:
        cpu.mem_write(sp+4, struct.pack('<I', argument))
    cpu.reg_write(UC_X86_REG_ESP, sp)
    cpu.reg_write(UC_X86_REG_ECX, owner)
    cpu.emu_start(address, 0x3000000, timeout=100000, count=100)
    assert cpu.reg_read(UC_X86_REG_ESP) == sp+4+(4 if argument is not None else 0)
    return cpu.reg_read(UC_X86_REG_EAX)


@pytest.mark.parametrize('seed', [1, 494276409, 1589138072])
def test_original_auxiliary_rng_repeats_despite_prior_local_state(original_cpu, seed):
    cpu = original_cpu
    allowed = [(0x4f6730,0x4f6768),(0x4f6710,0x4f6729),(0x4f6690,0x4f66d2)]
    def code(cpu, address, size, context):
        assert any(start<=address<end for start,end in allowed)
    def write(cpu, access, address, size, value, context):
        assert (0x2000000<=address and address+size<=0x2008000) or (0x6d8e80<=address and address+size<=0x6d8e88)
    hook1 = cpu.hook_add(UC_HOOK_CODE, code)
    hook2 = cpu.hook_add(UC_HOOK_MEM_WRITE, write)
    results = []
    try:
        for previous in [0x33333333, 0x77777777, 0x11111111]:
            cpu.mem_write(0x6d8e88, b'\x01')
            cpu.mem_write(0x6d8e80, struct.pack('<II', previous, previous))
            cpu.mem_write(0x71fc70, struct.pack('<II', 98123, 98124))
            assert call(cpu, 0x4f6730) == 0x6d8e80
            call(cpu, 0x4f6710, 0x6d8e80, seed)
            assert bytes(cpu.mem_read(0x6d8e80,8)) == struct.pack('<II', seed, seed)
            draws = [call(cpu, 0x4f6690, 0x6d8e80, limit) for limit in [2,3,16,35]]
            assert all(0<=v<limit for v,limit in zip(draws,[2,3,16,35]))
            assert bytes(cpu.mem_read(0x71fc70,8)) == struct.pack('<II',98123,98124)
            results.append((draws, bytes(cpu.mem_read(0x6d8e80,8))))
        assert results[0] == results[1] == results[2]
    finally:
        cpu.hook_del(hook1)
        cpu.hook_del(hook2)

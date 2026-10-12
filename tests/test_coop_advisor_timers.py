"""Execute the unmodified original local advisor below its timeout."""
import hashlib
from pathlib import Path
import struct
import pefile
import pytest
from unicorn import Uc,UC_ARCH_X86,UC_MODE_32,UC_HOOK_CODE,UC_HOOK_MEM_WRITE
from unicorn.x86_const import UC_X86_REG_ECX,UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'

@pytest.mark.parametrize('clock',[500,1000,1450,1550])
@pytest.mark.parametrize('function,end',[(0x492080,0x4921b9),(0x4921c0,0x4922f9)])
def test_original_advisor_only_observes_local_clock_before_timeout(function,end,clock):
    raw=(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    assert hashlib.sha256(raw).hexdigest()==PIN;pe=pefile.PE(data=raw)
    cpu=Uc(UC_ARCH_X86,UC_MODE_32);size=(pe.OPTIONAL_HEADER.SizeOfImage+4095)//4096*4096
    assert size<=4*1024*1024;cpu.mem_map(0x400000,size);cpu.mem_write(0x400000,pe.get_memory_mapped_image())
    cpu.mem_map(0,4096);cpu.mem_map(0x2000000,32768);cpu.mem_map(0x3000000,4096)
    cpu.mem_map(0x2800000,4096);owner=0x2800000
    # Version1 saves object+8,+c,+10,+14. The unsaved last notification
    # clock+4 is still0; each admitted clock is below the actual20000 timeout.
    cpu.mem_write(owner,struct.pack('<6I',0,0,20000,0,0,1))
    cpu.mem_write(owner+32,struct.pack('<6I',0,0,20000,0,0,1))
    cpu.mem_write(0x71c6a8,struct.pack('<I',clock));cpu.mem_write(0x71fc70,struct.pack('<II',98123,98124))
    sp=0x2004000;cpu.mem_write(sp,struct.pack('<I',0x3000000));cpu.reg_write(UC_X86_REG_ESP,sp);cpu.reg_write(UC_X86_REG_ECX,owner)
    writes=[]
    def instruction(c,address,size,user):assert function<=address<end,'No helper, import or gameplay routine may run'
    def write(c,access,address,size,value,user):
        assert (0x2000000<=address and address+size<=0x2008000)or(address==0 and size==4)or(address==owner+16 and size==4)
        if address==owner+16:writes.append(value)
    cpu.hook_add(UC_HOOK_CODE,instruction);cpu.hook_add(UC_HOOK_MEM_WRITE,write)
    cpu.emu_start(function,0x3000000,timeout=100000,count=100)
    assert cpu.reg_read(UC_X86_REG_ESP)==sp+4;assert writes==[clock]
    assert bytes(cpu.mem_read(owner,24))==struct.pack('<6I',0,0,20000,0,clock,1)
    assert bytes(cpu.mem_read(owner+32,24))==struct.pack('<6I',0,0,20000,0,0,1)
    assert bytes(cpu.mem_read(0x71fc70,8))==struct.pack('<II',98123,98124)
    assert bytes(cpu.mem_read(0x71c6a8,4))==struct.pack('<I',clock)

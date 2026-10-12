#!/usr/bin/env python3
"""Run the pinned three-bank writer with null banks and modeled stream I/O."""
import hashlib
import json
from pathlib import Path
import struct

import capstone
import pefile
from unicorn import Uc,UC_ARCH_X86,UC_MODE_32,UC_HOOK_CODE,UC_HOOK_MEM_READ,UC_HOOK_MEM_WRITE,UC_PROT_READ,UC_PROT_EXEC
from unicorn.x86_const import (UC_X86_REG_EAX,UC_X86_REG_EBX,UC_X86_REG_ECX,UC_X86_REG_EDX,
    UC_X86_REG_ESI,UC_X86_REG_EDI,UC_X86_REG_EBP,UC_X86_REG_ESP,UC_X86_REG_EIP,UC_X86_REG_EFLAGS)

ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
OUTPUT=ROOT/'output/native-empty-orders-emulated-observed.json'
DATA,STACK,STOP=0x100000,0x200000,0x300000
TABLE,STREAM=DATA+512,DATA+2304
RANGES=[(0x5b1be0,0x5b1c3c),(0x5b2b80,0x5b2ba7),(0x5b2f40,0x5b2f55)]
WRITE,CLOSE=0x4eed10,0x4eeb50
PRESERVED=[UC_X86_REG_EBX,UC_X86_REG_ESI,UC_X86_REG_EDI,UC_X86_REG_EBP]


def main():
    OUTPUT.unlink(missing_ok=True)
    executable=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    data=executable.read_bytes()
    if hashlib.sha256(data).hexdigest()!=PIN:raise ValueError('Requires the pinned Majesty executable')
    pe=pefile.PE(data=data);base=pe.OPTIONAL_HEADER.ImageBase
    expected_slots={0x16c:0x5b2b80,0x190:0x5b2f40,0x1b0:0x5b1be0}
    for table in [0x67f96c,0x67fe6c,0x68098c]:
        for offset,target in expected_slots.items():
            assert struct.unpack('<I',pe.get_data(table+offset-base,4))[0]==target
    # Trace the vehicle's initial bank class without executing construction or
    # populated-bank callbacks. Entry kinds dispatch through another vtable.
    assert struct.unpack('<I',pe.get_data(0x68098c+0x160-base,4))[0]==0x4300e0
    bank_slots={offset:struct.unpack('<I',pe.get_data(0x683148+offset-base,4))[0] for offset in [4,8,0x54]}
    assert bank_slots=={4:0x5e4d20,8:0x5e4e20,0x54:0x5e4f50}
    decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32);raw_code={};boundaries=set()
    static_rows={}
    for start,end in [(0x4abcc0,0x4abcd9),(0x5e4e20,0x5e4ea4)]:
        instructions=list(decoder.disasm(pe.get_data(start-base,end-start),start))
        assert sum(i.size for i in instructions)==end-start
        static_rows.update({i.address:(i.mnemonic,i.op_str) for i in instructions})
    for at,expected in {
        0x4abcc8:('call','0x5e4c60'),0x4abccd:('mov','dword ptr [esi], 0x683148'),
        0x5e4e2b:('push','1'),0x5e4e2f:('mov','edi, dword ptr [esi + 0x10]'),
        0x5e4e62:('mov','ebx, dword ptr [esi + 0x10]'),
        0x5e4e87:('call','dword ptr [eax + 8]')}.items():assert static_rows[at]==expected
    for start,end in RANGES:
        raw=pe.get_data(start-base,end-start);instructions=list(decoder.disasm(raw,start))
        assert sum(i.size for i in instructions)==end-start
        raw_code[start]=raw;boundaries.update(i.address for i in instructions)
    pages=[DATA,STACK,STOP,0x5b1000,0x5b2000,0x4ee000]
    outcomes=[];total_instructions=0
    for poison in [0x5a,0xc3]:
        cpu=Uc(UC_ARCH_X86,UC_MODE_32);hooks=[]
        try:
            for page in pages:cpu.mem_map(page,4096)
            assert sum(end-start+1 for start,end,_ in cpu.mem_regions())==24576
            for at,raw in raw_code.items():cpu.mem_write(at,raw)
            for page in [0x5b1000,0x5b2000,0x4ee000]:cpu.mem_protect(page,4096,UC_PROT_READ|UC_PROT_EXEC)
            cpu.mem_write(DATA,bytes([poison])*4096);cpu.mem_write(STACK,bytes([poison])*4096)

            def word(at,value=None):
                if value is not None:cpu.mem_write(at,struct.pack('<I',value&0xffffffff))
                return struct.unpack('<I',cpu.mem_read(at,4))[0]

            word(DATA,TABLE)
            for bank in range(3):word(DATA+0x88+bank*4,0)
            for offset,target in expected_slots.items():word(TABLE+offset,target)
            before=bytes(cpu.mem_read(DATA,4096));emitted=[];closed=0;steps=0;original=0

            def code(uc,at,size,context):
                nonlocal closed,steps,original,total_instructions
                steps+=1
                if steps>512:raise RuntimeError('Writer instruction budget exceeded')
                sp=uc.reg_read(UC_X86_REG_ESP)
                if not STACK+512<=sp<=STACK+3584:raise RuntimeError('Writer stack escaped bounds')
                if at in [WRITE,CLOSE]:
                    assert uc.reg_read(UC_X86_REG_ECX)==STREAM
                    if at==WRITE:
                        if len(emitted)>=6:raise RuntimeError('Too many empty-bank words')
                        emitted.append(word(sp+4))
                    else:closed+=1;assert closed==1 and len(emitted)==6
                    # Model only the stream ABI, including volatile clobbers.
                    uc.reg_write(UC_X86_REG_EAX,0);uc.reg_write(UC_X86_REG_ECX,0xcccccccc);uc.reg_write(UC_X86_REG_EDX,0xdddddddd)
                    uc.reg_write(UC_X86_REG_EIP,word(sp));uc.reg_write(UC_X86_REG_ESP,sp+(8 if at==WRITE else 4))
                    return
                if at not in boundaries:raise RuntimeError('Writer escaped original instruction boundaries')
                original+=1;total_instructions+=1
                if total_instructions>1024:raise RuntimeError('Writer total instruction budget exceeded')

            def read(uc,access,at,size,value,context):
                ranges=[(STACK,4096),(DATA,256),(TABLE,512)]
                if not any(start<=at and at+size<=start+length for start,length in ranges):
                    raise RuntimeError('Writer read outside owned fixture')

            def write(uc,access,at,size,value,context):
                if not (STACK<=at and at+size<=STACK+4096):raise RuntimeError('Writer write outside stack')

            hooks=[cpu.hook_add(UC_HOOK_CODE,code),cpu.hook_add(UC_HOOK_MEM_READ,read),cpu.hook_add(UC_HOOK_MEM_WRITE,write)]
            sp=STACK+3072;word(sp,STOP);word(sp+4,STREAM)
            for reg in PRESERVED:cpu.reg_write(reg,poison*0x01010101)
            cpu.reg_write(UC_X86_REG_ECX,DATA);cpu.reg_write(UC_X86_REG_ESP,sp);cpu.reg_write(UC_X86_REG_EFLAGS,0x202)
            cpu.emu_start(0x5b1be0,STOP,timeout=1000000,count=512)
            assert cpu.reg_read(UC_X86_REG_EIP)==STOP and cpu.reg_read(UC_X86_REG_ESP)==sp+8
            for reg in PRESERVED:assert cpu.reg_read(reg)==poison*0x01010101
            assert emitted==[1,0,1,0,1,0] and closed==1
            assert bytes(cpu.mem_read(DATA,4096))==before
            outcomes.append(dict(stackPoison=poison,bankWords=emitted,originalInstructions=original,hookSteps=steps))
        finally:
            for hook in hooks:cpu.hook_del(hook)
            for page in pages:cpu.mem_unmap(page,4096)
            assert list(cpu.mem_regions())==[]
            cpu=None
    sources=['web/world/orders.mjs','web/world/arrival.mjs','tests/checkpoint-orders.test.mjs',
        'tests/checkpoint-arrival.test.mjs','scripts/check-native-empty-orders.py']
    report=dict(qualified=True,scope='pinned writer plus original bank presence predicates with all three bank pointers null; modeled integer stream I/O',
        executableSha256=PIN,canonicalBankWords=[1,0,1,0,1,0],replays=outcomes,
        completedCalls=2,originalInstructions=total_instructions,
        mappedGuestBytesPeak=24576,mappedGuestBytesAfterCleanup=0,
        initialVtableSlotsVerified=9,realFileIoExecuted=False,allocatedEmptyBankPathQualified=False,
        vehicleBankClass=dict(initialTable='00683148',reader='005e4d20',writer='005e4e20',
            emptyPredicate='005e4f50',populatedBankVersion=1,bankCountOffset=16,
            entryKindOffset=16,entryWriterVirtualSlot=8),
        populatedOrderEntryLayoutQualified=False,
        activeOrderMigrationQualified=False,nativeOrderRestoreQualified=False,
        liveHeroCrossingQualified=False,liveNativePagingQualified=False,
        gameLaunched=False,browserUsed=False,nativeBuildRun=False,crashResolved=False,goalCompleted=False,
        sourceSha256={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in sources})
    OUTPUT.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(dict(passed=True,calls=2,originalInstructions=total_instructions,bankWords=report['canonicalBankWords'],mappedGuestBytesPeak=24576)))


if __name__=='__main__':main()

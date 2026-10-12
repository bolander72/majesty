#!/usr/bin/env python3
"""Bounded original UNIT empty-bank loading/replacement and failure controls."""
import hashlib
import json
from pathlib import Path
import struct
import capstone
import pefile
from unicorn import (Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE,
                     UC_HOOK_MEM_READ, UC_HOOK_MEM_WRITE, UC_PROT_READ, UC_PROT_EXEC)
from unicorn.x86_const import (UC_X86_REG_EAX, UC_X86_REG_EBX, UC_X86_REG_ECX,
                              UC_X86_REG_EDX, UC_X86_REG_ESI, UC_X86_REG_EDI,
                              UC_X86_REG_EBP, UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_EFLAGS)
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
OUTPUT=ROOT/'output/native-unit-order-loading-emulated-observed.json'
DATA,STACK,STOP=0x100000,0x200000,0x300000
UNIT,STREAM=DATA+2048,DATA+3072
UNIT_TABLE,BANK_TABLE=0x68098c,0x683148
READ,WRITE,GET,CLEAR=0x5b1b90,0x5b1be0,0x4300e0,0x5b2de0
SCALAR,STATUS,EMIT,CLOSE,ALLOC,FREE=0x4ef790,0x4ef6c0,0x4eed10,0x4eeb50,0x64c616,0x645bc0
RANGES=[(READ,0x5b1bd8),(WRITE,0x5b1c3c),(GET,0x43014f),(CLEAR,0x5b2e09),
        (0x5b2b80,0x5b2ba7),(0x5b2f40,0x5b2f55),(0x4abcc0,0x4abcd9),
        (0x5e4c60,0x5e4c96),(0x5e4d20,0x5e4e1b),(0x5e4f50,0x5e4f5b),
        (0x4abce0,0x4abcfe),(0x4abd00,0x4abd0b),(0x5e4cc0,0x5e4d13)]
PRESERVED=[UC_X86_REG_EBX,UC_X86_REG_ESI,UC_X86_REG_EDI,UC_X86_REG_EBP]
SEH=0x34567890


class NullStorageAccess(RuntimeError):
    """A data null access, distinct from the fixture's four-byte FS:[0]."""


def main():
    OUTPUT.unlink(missing_ok=True)
    raw=(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    if hashlib.sha256(raw).hexdigest()!=PIN:raise ValueError('Requires pinned executable')
    pe=pefile.PE(data=raw);base=pe.OPTIONAL_HEADER.ImageBase
    decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
    slots={0x160:GET,0x164:CLEAR,0x16c:0x5b2b80,0x190:0x5b2f40,0x1ac:READ,0x1b0:WRITE}
    for offset,target in slots.items():assert struct.unpack('<I',pe.get_data(UNIT_TABLE+offset-base,4))[0]==target
    assert struct.unpack('<3I',pe.get_data(BANK_TABLE-base,12))==(0x4abce0,0x5e4d20,0x5e4e20)
    assert struct.unpack('<I',pe.get_data(BANK_TABLE+0x54-base,4))[0]==0x5e4f50
    code_bytes={};boundaries=set();rows={}
    for start,end in RANGES:
        code=pe.get_data(start-base,end-start);decoded=list(decoder.disasm(code,start))
        assert sum(i.size for i in decoded)==len(code)
        code_bytes[start]=code;boundaries.update(i.address for i in decoded)
        rows.update({i.address:(i.mnemonic,i.op_str) for i in decoded})
    for at,expected in {0x5b1b9c:('call','dword ptr [eax + 0x164]'),
                        0x5b1bb3:('call','dword ptr [edx + 0x160]'),
                        0x5b1bb9:('mov','edx, dword ptr [eax]'),
                        0x5b1bbe:('call','dword ptr [edx + 4]'),
                        0x5b2df7:('call','dword ptr [eax]')}.items():assert rows[at]==expected
    stubs={SCALAR,STATUS,EMIT,CLOSE,ALLOC,FREE}
    pages=sorted({0,DATA,STACK,STOP,*[a&~4095 for a in code_bytes],*[a&~4095 for a in stubs],
                  UNIT_TABLE&~4095,BANK_TABLE&~4095})
    assert len(pages)*4096<=96*1024
    payload=struct.pack('<6I',1,0,1,0,1,0)
    outcomes=[];total=calls=0
    for poison in [0x5a,0xc3]:
        for mode in ['load-replace','populated-replacement','interrupt-first','interrupt-second','bank-null','sentinel-null']:
            cpu=Uc(UC_ARCH_X86,UC_MODE_32);hooks=[]
            try:
                for page in pages:cpu.mem_map(page,4096)
                for at,code in code_bytes.items():cpu.mem_write(at,code)
                cpu.mem_write(UNIT_TABLE,pe.get_data(UNIT_TABLE-base,0x1b4))
                cpu.mem_write(BANK_TABLE,pe.get_data(BANK_TABLE-base,0x5c))
                for at in stubs:cpu.mem_write(at,b'\xc3')
                for page in pages:
                    if page not in [0,DATA,STACK]:cpu.mem_protect(page,4096,UC_PROT_READ|UC_PROT_EXEC)
                cpu.mem_write(DATA,bytes([poison])*4096);cpu.mem_write(STACK,bytes([poison])*4096)
                live={};events=[];freed=[];bump=peak=steps=cursor=status=closed=0
                emitted=[];phase='load';observations=[];failure=None;fail_used=False
                def inside(at,n,start,size):return start<=at and at+n<=start+size
                def owned(at,n):return any(inside(at,n,a,r['bytes']) for a,r in live.items())
                def word(at,value=None):
                    if value is not None:cpu.mem_write(at,struct.pack('<I',value&0xffffffff))
                    return struct.unpack('<I',cpu.mem_read(at,4))[0]
                word(0,SEH);word(UNIT,UNIT_TABLE)
                for bank in range(3):word(UNIT+0x88+bank*4,0)
                def returned(sp,argc,value=0,cdecl=False):
                    cpu.reg_write(UC_X86_REG_EAX,value);cpu.reg_write(UC_X86_REG_ECX,0xcccccccc);cpu.reg_write(UC_X86_REG_EDX,0xdddddddd)
                    cpu.reg_write(UC_X86_REG_EIP,word(sp));cpu.reg_write(UC_X86_REG_ESP,sp+4+(0 if cdecl else argc*4))
                def code(uc,at,n,context):
                    nonlocal steps,total,cursor,status,closed,bump,peak,fail_used
                    steps+=1;sp=uc.reg_read(UC_X86_REG_ESP)
                    assert steps<=2048 and STACK+512<=sp<=STACK+3584
                    if at in stubs:
                        if at==ALLOC:
                            size,caller=word(sp+4),word(sp)
                            assert phase in ['seed-bank','load','replace']
                            role='bank' if caller==0x43010f else 'head'
                            assert (role=='bank' and size==20) or (caller==0x5e4c71 and size==12)
                            reject=not fail_used and ((mode=='bank-null' and role=='bank') or (mode=='sentinel-null' and role=='head'))
                            if reject:address=0;fail_used=True
                            else:
                                address=DATA+bump;bump+=(size+7)//8*8;assert bump<=1024
                                live[address]={'bytes':size,'role':role}
                            assert len(events)<16;events.append(dict(address=address,bytes=size,role=role,rejected=reject))
                            peak=max(peak,sum(r['bytes'] for r in live.values()));assert peak<=256
                            returned(sp,1,address,cdecl=True)
                        elif at==FREE:
                            assert phase in ['replace','cleanup'] or (phase=='load' and mode=='populated-replacement')
                            address=word(sp+4)
                            assert address in live;freed.append(dict(address=address,**live.pop(address)));assert len(freed)<=16
                            returned(sp,1,cdecl=True)
                        elif at==SCALAR:
                            assert phase in ['load','replace'] and uc.reg_read(UC_X86_REG_ECX)==STREAM
                            limit=0 if mode=='interrupt-first' else 12 if mode=='interrupt-second' else len(payload)
                            if status or cursor+4>limit:status=7
                            else:
                                address=word(sp+4);assert inside(address,4,STACK,4096)
                                cpu.mem_write(address,payload[cursor:cursor+4]);cursor+=4
                            returned(sp,1,status)
                        elif at==STATUS:assert phase in ['load','replace'];returned(sp,0,status)
                        elif at==EMIT:
                            assert phase=='write' and uc.reg_read(UC_X86_REG_ECX)==STREAM and len(emitted)<6
                            emitted.append(word(sp+4));returned(sp,1)
                        else:
                            assert at==CLOSE and phase=='write' and len(emitted)==6;closed+=1;assert closed==1;returned(sp,0)
                        return
                    assert at in boundaries,'Escaped pinned empty-order instructions'
                    total+=1;assert total<=20000
                def read(uc,access,at,n,value,context):
                    if at==0 and uc.reg_read(UC_X86_REG_EIP)!=GET:raise NullStorageAccess('null read')
                    assert inside(at,n,STACK,4096) or inside(at,n,0,4) or inside(at,n,UNIT,0x164) or owned(at,n) or \
                        inside(at,n,UNIT_TABLE,0x1b4) or inside(at,n,BANK_TABLE,0x5c)
                def write(uc,access,at,n,value,context):
                    if at==0 and uc.reg_read(UC_X86_REG_EIP) not in [0x4300ee,0x430141]:raise NullStorageAccess('null write')
                    assert inside(at,n,STACK,4096) or (phase!='write' and (inside(at,n,0,4) or
                        inside(at,n,UNIT+0x88,12) or owned(at,n)))
                hooks=[cpu.hook_add(UC_HOOK_CODE,code),cpu.hook_add(UC_HOOK_MEM_READ,read),cpu.hook_add(UC_HOOK_MEM_WRITE,write)]
                def invoke(entry,arg):
                    nonlocal steps,calls
                    steps=0;before=total;sp=STACK+3072;word(sp,STOP);word(sp+4,arg)
                    for reg in PRESERVED:cpu.reg_write(reg,poison*0x01010101)
                    cpu.reg_write(UC_X86_REG_ECX,UNIT);cpu.reg_write(UC_X86_REG_ESP,sp);cpu.reg_write(UC_X86_REG_EFLAGS,0x202)
                    cpu.emu_start(entry,STOP,timeout=1000000,count=2048)
                    assert cpu.reg_read(UC_X86_REG_EIP)==STOP and cpu.reg_read(UC_X86_REG_ESP)==sp+8
                    assert all(cpu.reg_read(r)==poison*0x01010101 for r in PRESERVED) and word(0)==SEH
                    calls+=1;result=cpu.reg_read(UC_X86_REG_EAX)
                    observations.append(dict(phase=phase,originalInstructions=total-before,returnValue=result));return result
                def banks():
                    result=[]
                    for i in range(3):
                        address=word(UNIT+0x88+i*4)
                        if address:
                            assert address in live and live[address]['role']=='bank'
                            assert word(address)==BANK_TABLE and word(address+4)==UNIT and word(address+16)==0
                            head=word(address+12);assert head in live and live[head]['role']=='head'
                            assert word(head)==head and word(head+4)==head
                        result.append(address)
                    return result
                seeded_order=None
                if mode=='populated-replacement':
                    phase='seed-bank';bank=invoke(GET,0);head=word(bank+12)
                    # Seed one opaque list member; its order fields are never
                    # read. This tests UNIT/bank ownership, not order creation.
                    for size,role in [(88,'seeded-order'),(12,'node')]:
                        address=DATA+bump;bump+=(size+7)//8*8;assert bump<=1024
                        live[address]={'bytes':size,'role':role}
                        events.append(dict(address=address,bytes=size,role=role,rejected=False,fixtureSeeded=True))
                        if role=='seeded-order':seeded_order=address
                        else:node=address
                    word(head,node);word(head+4,node);word(node,head);word(node+4,head)
                    word(node+8,seeded_order);word(bank+16,1)
                    peak=max(peak,sum(r['bytes'] for r in live.values()));phase='load'
                if mode in ['bank-null','sentinel-null']:
                    try:invoke(READ,STREAM)
                    except NullStorageAccess as error:
                        fault=cpu.reg_read(UC_X86_REG_EIP)
                        assert fail_used and (fault==0x5b1bb9 if mode=='bank-null' else fault==0x5e4c78),f'{mode}: {fault:08x}'
                        failure=dict(instruction=f'{fault:08x}',access=str(error),fixtureGuardStoppedBeforeNullDataAccess=True)
                    else:raise AssertionError('Unchecked allocation failure unexpectedly returned')
                    assert all(word(UNIT+0x88+i*4)==0 for i in range(3))
                    # A failed constructor never publishes its allocated bank.
                    assert sum(r['bytes'] for r in live.values())==(20 if mode=='sentinel-null' else 0)
                else:
                    expected=7 if mode.startswith('interrupt') else 0
                    assert invoke(READ,STREAM)==expected;first=banks()
                    assert sum(bool(a) for a in first)==(1 if mode=='interrupt-first' else 2 if mode=='interrupt-second' else 3)
                    if mode=='load-replace':
                        phase='write';before=bytes(cpu.mem_read(DATA,4096));assert invoke(WRITE,STREAM)==0
                        assert emitted==[1,0,1,0,1,0] and bytes(cpu.mem_read(DATA,4096))==before
                        phase='replace';cursor=status=0;assert invoke(READ,STREAM)==0
                        assert all(a!=b for a,b in zip(first,banks())) and len(freed)==6
                    phase='cleanup'
                    for bank in range(3):invoke(CLEAR,bank)
                    assert banks()==[0,0,0]
                    if mode=='populated-replacement':
                        assert set(live)=={seeded_order} and live[seeded_order]['bytes']==88
                    else:assert not live
                outcomes.append(dict(mode=mode,stackPoison=poison,completedPhases=observations,
                    allocations=events,frees=freed,allocationRequestBytesPeak=peak,
                    allocationBytesBeforeFixtureTeardown=sum(r['bytes'] for r in live.values()),
                    controlledFault=failure,streamBytesConsumed=cursor,streamStatus=status,
                    opaqueOrderListMemberSeeded=seeded_order is not None,
                    bankPointersNullAtEnd=all(word(UNIT+0x88+i*4)==0 for i in range(3))))
            finally:
                for hook in hooks:cpu.hook_del(hook)
                for page in pages:cpu.mem_unmap(page,4096)
                assert list(cpu.mem_regions())==[];cpu=None
    report=dict(qualified=True,scope='original UNIT empty-order attachment/load/replacement/clear under bounded allocation and stream models',
        executableSha256=PIN,outcomes=outcomes,completedCalls=calls,originalInstructions=total,
        mappedGuestBytesPeak=len(pages)*4096,mappedGuestBytesAfterCleanup=0,
        unitSlotsVerified={f'{offset:x}':f'{target:08x}' for offset,target in slots.items()},
        unitBankPointersOffset=0x88,bankCount=3,initialEmptyOrderRequestBytes=96,
        uncheckedBankAllocationNullFaultQualified=True,uncheckedSentinelAllocationNullFaultQualified=True,
        populatedReplacementLeavesSeededOrderAllocated=True,
        populatedActorOrderLoadingQualified=False,completeActorRollbackQualified=False,
        nativeImportFixtureChanged=False,realAllocatorExecuted=False,gameLaunched=False,browserUsed=False,
        nativeBuildRun=False,crashResolved=False,goalCompleted=False,
        sourceSha256={'scripts/check-native-unit-order-loading.py':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()})
    document=json.dumps(report,indent=2)+'\n';assert len(document.encode())<=64*1024;OUTPUT.write_text(document)
    print(json.dumps({k:report[k] for k in ['qualified','completedCalls','originalInstructions','mappedGuestBytesPeak','gameLaunched']}))


if __name__=='__main__':main()

#!/usr/bin/env python3
"""Original factory/fresh constructors/destructors; allocation/free are modeled."""
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import capstone
import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE, UC_HOOK_MEM_READ, UC_HOOK_MEM_WRITE, UC_PROT_READ, UC_PROT_EXEC
from unicorn.x86_const import (UC_X86_REG_EAX, UC_X86_REG_EBX, UC_X86_REG_ECX, UC_X86_REG_EDX,
                              UC_X86_REG_ESI, UC_X86_REG_EDI, UC_X86_REG_EBP, UC_X86_REG_ESP,
                              UC_X86_REG_EIP, UC_X86_REG_EFLAGS)
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
OUTPUT=ROOT/'output/native-order-lifecycle-emulated-observed.json'
DATA,STACK,STOP,PATH=0x100000,0x200000,0x300000,0x100200
ALLOC,FREE,FACTORY=0x64c616,0x645bc0,0x5da510
JUMP_TABLE,SEH_MARKER=0x5da870,0x12345678
PRESERVED=[UC_X86_REG_EBX,UC_X86_REG_ESI,UC_X86_REG_EDI,UC_X86_REG_EBP]
# Kind: constructor end, deleting destructor range, concrete destructor range.
LIFECYCLE={
    1:(0x5df27f,0x5df280,0x5df29e,0x5df2a0,0x5df2ab),
    2:(0x5b6cd9,0x5b6ce0,0x5b6cfe,0x5b6d00,0x5b6d5a),
    4:(0x5e0cf8,0x5e0d00,0x5e0d1e,0x5e0d20,0x5e0d3e),
    5:(0x5ab6d9,0x5ab6e0,0x5ab6fe,0x5ab700,0x5ab75a),
    6:(0x5e2289,0x5e2290,0x5e22ae,0x5e22b0,0x5e230a),
    7:(0x5e2b79,0x5e2b80,0x5e2b9e,0x5e2ba0,0x5e2bbe),
    10:(0x5b2458,0x5b2460,0x5b247e,0x5b2480,0x5b248b),
    11:(0x5e4025,0x5e4030,0x5e404e,0x5e4050,0x5e405b)}
SHARED=[(FACTORY,0x5da870),(0x5dee20,0x5dee50),(0x5dee70,0x5dee8c),
        (0x5ae500,0x5ae510),(0x501850,0x5018ab)]


def main():
    OUTPUT.unlink(missing_ok=True)
    writer_name='scripts/check-native-order-writers.py';writer_path=ROOT/writer_name
    writer_evidence=ROOT/'output/native-order-writers-emulated-observed.json';writers=json.loads(writer_evidence.read_text())
    assert writers['qualified'] and writers['completedCalls']==20
    for name,digest in writers['sourceSha256'].items():assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest
    spec=importlib.util.spec_from_file_location('order_writers',writer_path)
    writer=importlib.util.module_from_spec(spec);spec.loader.exec_module(writer)
    raw=(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    if hashlib.sha256(raw).hexdigest()!=PIN:raise ValueError('Requires pinned Majesty executable')
    pe=pefile.PE(data=raw);base=pe.OPTIONAL_HEADER.ImageBase
    decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
    ranges=list(SHARED);sizes={}
    for kind,leaf in writer.LEAVES.items():
        ctor_end,delete_start,delete_end,dtor_start,dtor_end=LIFECYCLE[kind]
        ranges.extend([(leaf[1],ctor_end),(delete_start,delete_end),(dtor_start,dtor_end)])
        assert struct.unpack('<I',pe.get_data(leaf[2]-base,4))[0]==delete_start
        assert struct.unpack('<I',pe.get_data(JUMP_TABLE+(kind-1)*4-base,4))[0]==leaf[0]
        first=next(decoder.disasm(pe.get_data(leaf[0]-base,8),leaf[0]))
        assert first.mnemonic=='push';sizes[kind]=int(first.op_str,16)
        assert 52<=sizes[kind]<=128
    code_bytes={};boundaries=set();range_reports=[]
    for start,end in ranges:
        code=pe.get_data(start-base,end-start);decoded=list(decoder.disasm(code,start))
        assert sum(i.size for i in decoded)==len(code), f'Incomplete range {start:08x}'
        code_bytes[start]=code;boundaries.update(i.address for i in decoded)
        range_reports.append(dict(start=f'{start:08x}',end=f'{end:08x}',instructions=len(decoded),sha256=hashlib.sha256(code).hexdigest()))
    pages=sorted({0,DATA,STACK,STOP,ALLOC&~4095,FREE&~4095,*[at&~4095 for at in code_bytes]})
    assert len(pages)*4096<=80*1024
    cases=[dict(kind=k,mode='normal',deleteFlag=1) for k in LIFECYCLE]
    cases += [dict(kind=7,mode='normal',deleteFlag=0)]
    cases += [dict(kind=k,mode='outer-null',deleteFlag=1) for k in LIFECYCLE]
    cases += [dict(kind=7,mode='path-null',deleteFlag=1)]
    total=calls=0;outcomes=[];allocated_peak=0
    for poison in [0x5a,0xc3]:
        for case in cases:
            kind,mode,flag=case['kind'],case['mode'],case['deleteFlag']
            cpu=Uc(UC_ARCH_X86,UC_MODE_32);hooks=[]
            try:
                for page in pages:cpu.mem_map(page,4096)
                assert sum(end-start+1 for start,end,_ in cpu.mem_regions())==len(pages)*4096
                for at,code in code_bytes.items():cpu.mem_write(at,code)
                cpu.mem_write(JUMP_TABLE,pe.get_data(JUMP_TABLE-base,64))
                for at in [ALLOC,FREE]:cpu.mem_write(at,b'\xc3')
                for page in pages:
                    if page not in [0,DATA,STACK]:cpu.mem_protect(page,4096,UC_PROT_READ|UC_PROT_EXEC)
                cpu.mem_write(DATA,bytes([poison])*4096);cpu.mem_write(STACK,bytes([poison])*4096)
                cpu.mem_write(0,struct.pack('<I',SEH_MARKER))
                live={};allocations=[];frees=[];steps=peak=0
                def inside(at,size,start,length):return start<=at and at+size<=start+length
                def owned(at,size):return any(inside(at,size,start,length) for start,length in live.items())
                def word(at,value=None):
                    if value is not None:cpu.mem_write(at,struct.pack('<I',value&0xffffffff))
                    return struct.unpack('<I',cpu.mem_read(at,4))[0]
                def code(uc,at,size,context):
                    nonlocal steps,total,peak,allocated_peak
                    steps+=1;assert steps<=1024
                    sp=uc.reg_read(UC_X86_REG_ESP);assert STACK+512<=sp<=STACK+3584
                    if at in [ALLOC,FREE]:
                        assert inside(sp,8,STACK,4096)
                        argument=word(sp+4);result=0
                        if at==ALLOC:
                            assert len(allocations)<2
                            if not allocations:
                                assert argument==sizes[kind]
                                result=0 if mode=='outer-null' else DATA
                            else:
                                assert kind==7 and argument==80
                                result=0 if mode=='path-null' else PATH
                            allocations.append(dict(bytes=argument,address=result))
                            if result:
                                assert result not in live
                                live[result]=argument;peak=max(peak,sum(live.values()));allocated_peak=max(allocated_peak,peak)
                                assert peak<=192
                        else:
                            if argument:
                                assert argument in live, 'Unknown or duplicate modeled free'
                                del live[argument]
                            frees.append(argument);assert len(frees)<=2
                        uc.reg_write(UC_X86_REG_EAX,result);uc.reg_write(UC_X86_REG_ECX,0xcccccccc);uc.reg_write(UC_X86_REG_EDX,0xdddddddd)
                        uc.reg_write(UC_X86_REG_EIP,word(sp));uc.reg_write(UC_X86_REG_ESP,sp+4);return
                    assert at in boundaries, 'Fresh lifecycle escaped pinned functions'
                    total+=1;assert total<=25000
                def read(uc,access,at,size,value,context):
                    assert inside(at,size,STACK,4096) or inside(at,size,0,4) or inside(at,size,JUMP_TABLE,64) or owned(at,size)
                def write(uc,access,at,size,value,context):
                    assert inside(at,size,STACK,4096) or inside(at,size,0,4) or owned(at,size)
                hooks=[cpu.hook_add(UC_HOOK_CODE,code),cpu.hook_add(UC_HOOK_MEM_READ,read),cpu.hook_add(UC_HOOK_MEM_WRITE,write)]
                def invoke(entry,receiver,argument):
                    nonlocal steps,calls
                    steps=0;sp=STACK+3072;word(sp,STOP);word(sp+4,argument)
                    for reg in PRESERVED:cpu.reg_write(reg,poison*0x01010101)
                    cpu.reg_write(UC_X86_REG_ECX,receiver);cpu.reg_write(UC_X86_REG_ESP,sp);cpu.reg_write(UC_X86_REG_EFLAGS,0x202)
                    cpu.emu_start(entry,STOP,timeout=1000000,count=1024)
                    assert cpu.reg_read(UC_X86_REG_EIP)==STOP and cpu.reg_read(UC_X86_REG_ESP)==sp+8
                    assert word(0)==SEH_MARKER and all(cpu.reg_read(r)==poison*0x01010101 for r in PRESERVED)
                    calls+=1;return cpu.reg_read(UC_X86_REG_EAX)
                result=invoke(FACTORY,0,kind);delta=None;path_pointer=None;table=None
                if mode=='outer-null':
                    assert result==0 and live=={} and len(allocations)==1 and not frees
                else:
                    assert result==DATA and live[DATA]==sizes[kind]
                    table=word(DATA);assert table==writer.LEAVES[kind][2] and word(DATA+4)==0x68acf8
                    # Fresh inactive fields. The base constructor leaves +c
                    # untouched; enqueue or a successful reader must supply it.
                    assert all(word(DATA+off)==0 for off in [8,16,20,24,28,32,36,40,44,48])
                    delta=word(DATA+12);assert delta==poison*0x01010101
                    if kind==7:
                        path_pointer=word(DATA+56);assert path_pointer==(0 if mode=='path-null' else PATH)
                        assert len(allocations)==2 and word(DATA+64)==0
                    delete_result=invoke(LIFECYCLE[kind][1],DATA,flag)
                    assert delete_result==DATA
                    expected_frees=([0 if mode=='path-null' else PATH] if kind==7 else [0] if kind==4 else [])
                    if flag:expected_frees.append(DATA)
                    assert frees==expected_frees
                    assert live==({} if flag else {DATA:sizes[kind]})
                outcomes.append(dict(kind=kind,mode=mode,deleteFlag=flag,stackPoison=poison,objectBytes=sizes[kind],
                                     factoryResult=result,initialTable=table,uninitializedDelta=delta,pathPointer=path_pointer,
                                     allocationRequests=allocations,freeArguments=frees,liveAllocationBytesAfter=sum(live.values()),
                                     modeledAllocationBytesPeak=peak,sehChainRestored=True))
            finally:
                for hook in hooks:cpu.hook_del(hook)
                for page in pages:cpu.mem_unmap(page,4096)
                assert list(cpu.mem_regions())==[]
                cpu=None
    assert calls==56 and len(outcomes)==36
    report=dict(qualified=True,scope='pinned factory and eight fresh inactive constructor/destructor chains; modeled allocation/free; normal SEH registration only',
                executableSha256=PIN,completedCalls=calls,originalInstructions=total,ranges=range_reports,outcomes=outcomes,
                objectSizes=sizes,mappedGuestBytesPeak=len(pages)*4096,mappedGuestBytesAfterCleanup=0,modeledAllocationBytesPeak=allocated_peak,
                sourceSha256={'scripts/check-native-order-lifecycle.py':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                              writer_name:hashlib.sha256(writer_path.read_bytes()).hexdigest()},
                writerEvidenceSha256=hashlib.sha256(writer_evidence.read_bytes()).hexdigest(),
                originalFactoryExecuted=True,originalConstructorsExecuted=True,originalDeletingDestructorsExecuted=True,
                loadedOrderCleanupQualified=False,positiveNameCleanupQualified=False,exceptionUnwindQualified=False,
                realAllocationFailureQualified=False,completeBankRollbackQualified=False,activeOrderMigrationQualified=False,
                liveHeroCrossingQualified=False,liveNativePagingQualified=False,
                gameLaunched=False,browserUsed=False,nativeBuildRun=False,crashResolved=False)
    OUTPUT.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ['qualified','completedCalls','originalInstructions','mappedGuestBytesPeak','modeledAllocationBytesPeak','gameLaunched']}))


if __name__=='__main__':main()

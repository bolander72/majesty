#!/usr/bin/env python3
"""Original bank control flow with modeled factory, leaves, stream and allocator."""
import hashlib
import json
from pathlib import Path
import struct
import capstone
import pefile
from unicorn import Uc, UcError, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE, UC_HOOK_MEM_READ, UC_HOOK_MEM_WRITE, UC_HOOK_MEM_WRITE_UNMAPPED, UC_PROT_READ, UC_PROT_EXEC
from unicorn.x86_const import (UC_X86_REG_EAX, UC_X86_REG_EBX, UC_X86_REG_ECX, UC_X86_REG_EDX,
                              UC_X86_REG_ESI, UC_X86_REG_EDI, UC_X86_REG_EBP, UC_X86_REG_ESP,
                              UC_X86_REG_EIP, UC_X86_REG_EFLAGS)
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
OUTPUT=ROOT/'output/native-order-bank-failures-emulated-observed.json'
DATA,STACK,STOP=0x100000,0x200000,0x300000
HEAD,MANAGER,MANAGER_TABLE,STREAM=DATA+32,DATA+64,DATA+80,DATA+96
FACTORY,LEAF_READ,LEAF_WRITE=STOP+16,STOP+32,STOP+48
READS={0x4ef790,0x4ef740};READ_STATUS=0x4ef6c0
WRITES={0x4eed10,0x4eec70};WRITE_STATUS=0x4eeb50
GET_MANAGER,ALLOC=0x5da280,0x64c616
STUBS=READS|WRITES|{READ_STATUS,WRITE_STATUS,GET_MANAGER,ALLOC,FACTORY,LEAF_READ,LEAF_WRITE}
SUPPORTED=[1,2,4,5,6,7,10,11]
PRESERVED=[UC_X86_REG_EBX,UC_X86_REG_ESI,UC_X86_REG_EDI,UC_X86_REG_EBP]


def main():
    OUTPUT.unlink(missing_ok=True)
    raw=(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    if hashlib.sha256(raw).hexdigest()!=PIN:raise ValueError('Requires pinned Majesty executable')
    pe=pefile.PE(data=raw);base=pe.OPTIONAL_HEADER.ImageBase
    decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
    ranges=[(0x5e4d20,0x5e4e1b),(0x5e4e20,0x5e4ea4)]
    code_bytes={};rows={}
    for start,end in ranges:
        code=pe.get_data(start-base,end-start);decoded=list(decoder.disasm(code,start))
        assert sum(i.size for i in decoded)==len(code)
        code_bytes[start]=code;rows.update({i.address:(i.mnemonic,i.op_str) for i in decoded})
    anchors={0x5e4d36:('call','0x4ef790'),0x5e4d4a:('call','0x4ef790'),
             0x5e4d80:('call','0x4ef790'),0x5e4d90:('call','0x4ef740'),
             0x5e4da7:('call','dword ptr [edx + 0xc]'),0x5e4dae:('je','0x5e4df7'),
             0x5e4db5:('call','dword ptr [edx + 4]'),0x5e4db8:('mov','eax, dword ptr [esp + 0x10]'),
             0x5e4dbc:('push','0xc'),0x5e4dc4:('call','0x64c616'),
             0x5e4dd6:('mov','dword ptr [eax], ecx'),0x5e4dee:('mov','dword ptr [eax], edi'),
             0x5e4df4:('inc','dword ptr [eax + 0x10]'),0x5e4e0c:('call','0x4ef6c0'),
             0x5e4e62:('mov','ebx, dword ptr [esi + 0x10]'),0x5e4e87:('call','dword ptr [eax + 8]')}
    assert all(rows[at]==pair for at,pair in anchors.items())
    assert struct.unpack('<2I',pe.get_data(0x683148+4-base,8))==(0x5e4d20,0x5e4e20)
    assert struct.unpack('<I',pe.get_data(0x68ac14+12-base,4))[0]==0x5da510
    factory=list(decoder.disasm(pe.get_data(0x5da510-base,0x2c),0x5da510))
    frows={i.address:(i.mnemonic,i.op_str) for i in factory}
    assert sum(i.size for i in factory)==0x2c
    assert frows[0x5da522]==('xor','eax, eax') and frows[0x5da52f]==('ja','0x5da85f')
    pages=sorted({DATA,STACK,STOP,*[at&~4095 for at in STUBS],*[at&~4095 for at in code_bytes]})
    assert len(pages)*4096==32768
    cases=[dict(name='empty',bankVersion=1,entries=[]),
           dict(name='eight-supported-discriminators',bankVersion=1,entries=[(1,k,100+i) for i,k in enumerate(SUPPORTED)]),
           dict(name='unchecked-bank-version',bankVersion=999,entries=[(1,2,42)]),
           dict(name='unchecked-entry-version',bankVersion=1,entries=[(999,2,42)]),
           dict(name='unknown-kind-with-no-body',bankVersion=1,entries=[(1,99,None),(1,2,42)]),
           dict(name='ignored-leaf-error',bankVersion=1,entries=[(1,2,42),(1,6,43)],leafError=True),
           dict(name='sticky-stream-error',bankVersion=1,entries=[(1,2,42),(1,6,43)],stickyError=True),
           dict(name='null-node-allocation',bankVersion=1,entries=[(1,2,42)],nullNode=True)]
    outcomes=[];total=calls=0
    for poison in [0x5a,0xc3]:
        for case in cases:
            input_words=[case['bankVersion'],len(case['entries'])]
            for version,kind,marker in case['entries']:
                input_words.extend([version,kind])
                if marker is not None:input_words.append(marker)
            assert len(input_words)<=26
            cpu=Uc(UC_ARCH_X86,UC_MODE_32);hooks=[]
            try:
                for page in pages:cpu.mem_map(page,4096)
                assert sum(end-start+1 for start,end,_ in cpu.mem_regions())==32768
                for at,code in code_bytes.items():cpu.mem_write(at,code)
                for at in STUBS:cpu.mem_write(at,b'\xc3')
                for page in pages:
                    if page not in [DATA,STACK]:cpu.mem_protect(page,4096,UC_PROT_READ|UC_PROT_EXEC)
                cpu.mem_write(DATA,bytes([poison])*4096);cpu.mem_write(STACK,bytes([poison])*4096)
                owned=[(DATA,20),(HEAD,12),(MANAGER,4),(MANAGER_TABLE,16)]
                objects=[];nodes=[];factory_kinds=[];leaf_returns=[];allocation_requests=[]
                position=status=steps=0;output_words=[];unmapped_writes=[]
                def inside(at,size,start,length):return start<=at and at+size<=start+length
                def allowed(at,size):return inside(at,size,STACK,4096) or any(inside(at,size,s,n) for s,n in owned)
                def word(at,value=None):
                    assert allowed(at,4), 'Modeled primitive escaped controlled ownership'
                    if value is not None:cpu.mem_write(at,struct.pack('<I',value&0xffffffff))
                    return struct.unpack('<I',cpu.mem_read(at,4))[0]
                word(DATA,0x683148);word(DATA+4,0x12345678);word(DATA+12,HEAD);word(DATA+16,0)
                word(HEAD,HEAD);word(HEAD+4,HEAD);word(MANAGER,MANAGER_TABLE);word(MANAGER_TABLE+12,FACTORY)
                def next_word():
                    nonlocal position,status
                    if position>=len(input_words):status=9;return None
                    value=input_words[position];position+=1;return value
                def code(uc,at,size,context):
                    nonlocal steps,total,status
                    steps+=1;assert steps<=1024
                    sp=uc.reg_read(UC_X86_REG_ESP);assert STACK+512<=sp<=STACK+3584
                    if at not in STUBS:
                        assert at in rows, 'Bank fixture escaped original ranges'
                        total+=1;assert total<=10000;return
                    argc=0;result=0
                    if at in READS:
                        assert uc.reg_read(UC_X86_REG_ECX)==STREAM
                        value=next_word();argc=1
                        if value is None:result=status
                        else:word(word(sp+4),value)
                    elif at in [READ_STATUS,WRITE_STATUS]:
                        assert uc.reg_read(UC_X86_REG_ECX)==STREAM;result=status
                    elif at in WRITES:
                        assert uc.reg_read(UC_X86_REG_ECX)==STREAM
                        output_words.append(word(sp+4));assert len(output_words)<=26;argc=1
                    elif at==GET_MANAGER:result=MANAGER
                    elif at==FACTORY:
                        assert uc.reg_read(UC_X86_REG_ECX)==MANAGER
                        kind=word(sp+4);factory_kinds.append(kind);assert len(factory_kinds)<=8;argc=1
                        if kind in SUPPORTED:
                            i=len(objects);assert i<8
                            address=DATA+1024+i*128;table=DATA+256+i*16
                            owned.extend([(address,56),(table,12)]);objects.append(address)
                            word(address,table);word(address+16,kind);word(table+4,LEAF_READ);word(table+8,LEAF_WRITE)
                            result=address
                    elif at==LEAF_READ:
                        address=uc.reg_read(UC_X86_REG_ECX);assert address in objects and word(sp+4)==STREAM
                        marker=next_word();assert marker is not None
                        word(address+52,marker);argc=1
                        result=7 if case.get('leafError') else 0;leaf_returns.append(result)
                        if case.get('stickyError'):status=4;result=4;leaf_returns[-1]=result
                    elif at==LEAF_WRITE:
                        address=uc.reg_read(UC_X86_REG_ECX);assert address in objects and word(sp+4)==STREAM
                        output_words.append(word(address+52));assert len(output_words)<=26;argc=1
                    elif at==ALLOC:
                        assert word(sp+4)==12;allocation_requests.append(12)
                        if not case.get('nullNode'):
                            assert len(nodes)<8
                            result=DATA+2048+len(nodes)*12;owned.append((result,12));nodes.append(result)
                        # Original allocator is cdecl: caller removes its arg.
                    else:raise AssertionError('Unexpected model')
                    uc.reg_write(UC_X86_REG_EAX,result);uc.reg_write(UC_X86_REG_ECX,0xcccccccc);uc.reg_write(UC_X86_REG_EDX,0xdddddddd)
                    uc.reg_write(UC_X86_REG_EIP,word(sp));uc.reg_write(UC_X86_REG_ESP,sp+4+argc*4)
                def read(uc,access,at,size,value,context):assert allowed(at,size)
                def write(uc,access,at,size,value,context):
                    if case.get('nullNode') and at==0 and uc.reg_read(UC_X86_REG_EIP)==0x5e4dd6:
                        return # Let the unmapped hook record and reject this access.
                    assert allowed(at,size)
                def unmapped_write(uc,access,at,size,value,context):
                    assert case.get('nullNode') and at==0 and size==4 and uc.reg_read(UC_X86_REG_EIP)==0x5e4dd6
                    unmapped_writes.append(dict(address=at,size=size,instruction='005e4dd6'))
                    return False
                hooks=[cpu.hook_add(UC_HOOK_CODE,code),cpu.hook_add(UC_HOOK_MEM_READ,read),cpu.hook_add(UC_HOOK_MEM_WRITE,write),
                       cpu.hook_add(UC_HOOK_MEM_WRITE_UNMAPPED,unmapped_write)]
                def invoke(entry):
                    nonlocal steps,calls
                    steps=0;sp=STACK+3072;word(sp,STOP);word(sp+4,STREAM)
                    for reg in PRESERVED:cpu.reg_write(reg,poison*0x01010101)
                    cpu.reg_write(UC_X86_REG_ECX,DATA);cpu.reg_write(UC_X86_REG_ESP,sp);cpu.reg_write(UC_X86_REG_EFLAGS,0x202)
                    cpu.emu_start(entry,STOP,timeout=1000000,count=1024)
                    assert cpu.reg_read(UC_X86_REG_EIP)==STOP and cpu.reg_read(UC_X86_REG_ESP)==sp+8
                    assert all(cpu.reg_read(r)==poison*0x01010101 for r in PRESERVED)
                    calls+=1;return cpu.reg_read(UC_X86_REG_EAX)
                fault=False
                try:read_result=invoke(0x5e4d20)
                except UcError:
                    assert case.get('nullNode') and len(unmapped_writes)==1 and cpu.reg_read(UC_X86_REG_EAX)==0
                    fault=True;read_result=None
                assert fault==bool(case.get('nullNode'))
                count=word(DATA+16);members=[];node=word(HEAD);previous=HEAD
                while node!=HEAD:
                    assert node in nodes and node not in [n for n,_ in members] and len(members)<8
                    assert word(node+4)==previous
                    members.append((node,word(node+8)));previous=node;node=word(node)
                assert word(HEAD+4)==previous and count==len(members)
                expected_count=0 if fault else 1 if case.get('stickyError') or case['name']=='unknown-kind-with-no-body' else len(case['entries'])
                assert count==expected_count and read_result==(None if fault else 4 if case.get('stickyError') else 0)
                if not case.get('stickyError'):assert position==len(input_words)
                if not fault:
                    before=bytes(cpu.mem_read(DATA,4096));status=0;write_result=invoke(0x5e4e20)
                    assert write_result==0 and bytes(cpu.mem_read(DATA,4096))==before
                    expected_words=[1,count]
                    for _,address in members:expected_words.extend([1,word(address+16),word(address+52)])
                    assert output_words==expected_words
                outcomes.append(dict(name=case['name'],stackPoison=poison,inputWordCount=len(input_words),inputBankWords=input_words,
                                     consumedWords=position,
                                     declaredCount=len(case['entries']),linkedCount=count,factoryKinds=factory_kinds,
                                     leafReturnValues=leaf_returns,readerReturn=read_result,nullNodeWriteCaught=fault,
                                     modeledObjects=len(objects),unlinkedModeledObjects=len(objects)-count,
                                     nodeAllocationRequests=allocation_requests,rewrittenWords=output_words,
                                     unmappedWrites=unmapped_writes,readerCompleted=not fault,
                                     bankRoundTripIdentical=not fault and output_words==input_words))
            finally:
                for hook in hooks:cpu.hook_del(hook)
                for page in pages:cpu.mem_unmap(page,4096)
                assert list(cpu.mem_regions())==[]
                cpu=None
    assert calls==28
    for case in cases:
        pair=[o for o in outcomes if o['name']==case['name']]
        assert len(pair)==2
        assert [{k:v for k,v in o.items() if k!='stackPoison'} for o in pair][0]=={k:v for k,v in pair[1].items() if k!='stackPoison'}
    report=dict(qualified=True,scope='original bank control flow and list linking only; synthetic leaf bodies; modeled factory/leaves/I/O/allocation',
                executableSha256=PIN,anchors=len(anchors),completedCalls=calls,controlledFaultCases=2,originalInstructionVisits=total,
                mappedGuestBytesPeak=32768,mappedGuestBytesAfterCleanup=0,outcomes=outcomes,
                sourceSha256={'scripts/check-native-order-bank-failures.py':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},
                originalFactoryExecuted=False,originalLeafReadersExecuted=False,originalConstructorsExecuted=False,
                actualCheckpointBankRestorationQualified=False,realAllocationFailureQualified=False,rollbackQualified=False,
                activeOrderMigrationQualified=False,liveHeroCrossingQualified=False,liveNativePagingQualified=False,
                gameLaunched=False,browserUsed=False,nativeBuildRun=False,crashResolved=False)
    OUTPUT.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ['qualified','completedCalls','controlledFaultCases','originalInstructionVisits','mappedGuestBytesPeak','gameLaunched']}))


if __name__=='__main__':main()

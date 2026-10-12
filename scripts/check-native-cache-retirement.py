#!/usr/bin/env python3
"""Check retirement plans with bounded original lookup/update/value destruction."""
import hashlib
import json
from pathlib import Path
import struct

import capstone
import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE, UC_HOOK_MEM_READ, UC_HOOK_MEM_WRITE, UC_PROT_READ, UC_PROT_EXEC
from unicorn.x86_const import (UC_X86_REG_EAX, UC_X86_REG_EBX, UC_X86_REG_ECX, UC_X86_REG_EDX,
    UC_X86_REG_ESI, UC_X86_REG_EDI, UC_X86_REG_EBP, UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_EFLAGS)

ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
OUTPUT=ROOT/'output/native-cache-retirement-emulated-observed.json'
RANGES=[(0x5c7810,0x5c7830),(0x5c7880,0x5c78af),(0x5c7a00,0x5c7a4e),(0x5c7a50,0x5c7a9e)]
STACK=0x200000
DATA=0x100000
STOP=0x300000
REGISTERS=[UC_X86_REG_EBX,UC_X86_REG_ESI,UC_X86_REG_EDI,UC_X86_REG_EBP]


def main():
    OUTPUT.unlink(missing_ok=True)
    exe=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    data=exe.read_bytes()
    if hashlib.sha256(data).hexdigest()!=PIN:raise ValueError('Requires the pinned Majesty executable')
    pe=pefile.PE(data=data);base=pe.OPTIONAL_HEADER.ImageBase
    assert struct.unpack('<I',pe.get_data(0x68a8e0-base,4))[0]==0x5c7810
    decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
    code={};boundaries=set()
    for start,end in RANGES:
        raw=pe.get_data(start-base,end-start);instructions=list(decoder.disasm(raw,start))
        assert sum(i.size for i in instructions)==end-start
        code[start]=raw;boundaries.update(i.address for i in instructions)
        if start==0x5c7880:
            rows={i.address:(i.mnemonic,i.op_str) for i in instructions}
            assert rows[0x5c7888]==('push','0x24')
            assert rows[0x5c78a4]==('mov','dword ptr [esi], 0x68a8e8')
    fixture_path=ROOT/'output/native-cache-retirement-fixtures.json'
    fixture=json.loads(fixture_path.read_text());assert fixture['synthetic'] and len(fixture['cases'])==3
    metrics=dict(completedCalls=0,originalInstructions=0,maxCallInstructions=0,modeledNodeDisposals=0,
        mappedGuestBytesPeak=16384,mappedGuestBytesAfterCleanup=0,caseReplays=0)
    for poison in [0x5a,0xc3]:
        for case in fixture['cases']:
            cpu=Uc(UC_ARCH_X86,UC_MODE_32);hooks=[]
            try:
                for address in [DATA,STACK,STOP,0x5c7000]:cpu.mem_map(address,4096)
                assert sum(end-start+1 for start,end,_ in cpu.mem_regions())==16384
                for at,raw in code.items():cpu.mem_write(at,raw)
                cpu.mem_protect(0x5c7000,4096,UC_PROT_READ|UC_PROT_EXEC)
                original=struct.pack('<128I',*case['memoryWords']);cpu.mem_write(DATA,original)
                collection=case['plan']['collectionAddress'];head=case['plan']['head']
                live=set(case['addresses']);allowed_writes=[];call_steps=0

                def word(address,value=None):
                    if value is not None:cpu.mem_write(address,struct.pack('<I',value&0xffffffff))
                    return struct.unpack('<I',cpu.mem_read(address,4))[0]

                def inside(address,size,start,length):return start<=address and address+size<=start+length

                def access_read(uc,access,address,size,value,context):
                    ranges=[(STACK,4096),(collection,16),(head,8),(DATA+768,16)]
                    ranges += [(address,36) for address in live]
                    if not any(inside(address,size,start,length) for start,length in ranges):
                        raise RuntimeError('Read outside live fixture ownership')

                def access_write(uc,access,address,size,value,context):
                    if inside(address,size,STACK,4096):return
                    if not any(inside(address,size,start,length) for start,length in allowed_writes):
                        raise RuntimeError('Write outside expected original operation')

                def instruction(uc,address,size,context):
                    nonlocal call_steps
                    call_steps+=1
                    if address not in boundaries or call_steps>256:raise RuntimeError('Original instruction boundary/budget exceeded')
                    metrics['originalInstructions']+=1
                    if metrics['originalInstructions']>20000:raise RuntimeError('Total instruction budget exceeded')

                hooks=[cpu.hook_add(UC_HOOK_CODE,instruction),cpu.hook_add(UC_HOOK_MEM_READ,access_read),cpu.hook_add(UC_HOOK_MEM_WRITE,access_write)]

                def call(function,receiver,args,writes):
                    nonlocal call_steps,allowed_writes
                    allowed_writes=writes;call_steps=0
                    cpu.mem_write(STACK,bytes([poison])*4096);sp=STACK+3072
                    word(sp,STOP)
                    for i,arg in enumerate(args):word(sp+4+4*i,arg)
                    for reg in REGISTERS:cpu.reg_write(reg,poison*0x01010101)
                    cpu.reg_write(UC_X86_REG_EAX,0xdeadbe00);cpu.reg_write(UC_X86_REG_EDX,0xcccccccc)
                    cpu.reg_write(UC_X86_REG_ECX,receiver);cpu.reg_write(UC_X86_REG_ESP,sp);cpu.reg_write(UC_X86_REG_EFLAGS,0x202)
                    cpu.emu_start(function,STOP,timeout=1000000,count=256)
                    assert cpu.reg_read(UC_X86_REG_EIP)==STOP
                    assert cpu.reg_read(UC_X86_REG_ESP)==sp+4+4*len(args)
                    for reg in REGISTERS:assert cpu.reg_read(reg)==poison*0x01010101
                    metrics['completedCalls']+=1;metrics['maxCallInstructions']=max(metrics['maxCallInstructions'],call_steps)
                    return cpu.reg_read(UC_X86_REG_EAX)&255

                # The Node plan is applied only to this private synthetic image.
                for item in case['plan']['capture']:
                    assert list(struct.unpack('<'+'I'*len(item['words']),cpu.mem_read(item['address'],len(item['words'])*4)))==item['words']
                for patch in case['plan']['writes']:
                    assert word(patch['address'])==patch['expected'];word(patch['address'],patch['value'])
                survivors=[address for address,key in zip(case['addresses'],case['keys']) if key not in case['retiringKeys']]
                assert case['plan']['survivingAddresses']==survivors
                for retired in case['plan']['retiring']:
                    at=retired['address'];before=bytes(cpu.mem_read(at,36))
                    call(0x5c7810,at+8,[0],[(at+8,4)])
                    assert bytes(cpu.mem_read(at,36))==before
                    # This is explicit modeled disposal, not the game's CRT free.
                    live.remove(at);cpu.mem_write(at,b'\xdd'*36);metrics['modeledNodeDisposals']+=1
                for key in [1,2,3,99]:
                    candidates=[address for address,k in zip(case['addresses'],case['keys']) if address in survivors and k==key]
                    first=candidates[0] if candidates else None;output=DATA+768
                    cpu.mem_write(output,b'\xa5'*16);before=bytes(cpu.mem_read(DATA,512))
                    found=call(0x5c7a50,collection,[key,output],[(output,16)])
                    assert found==bool(first);assert bytes(cpu.mem_read(DATA,512))==before
                    expected=bytes(cpu.mem_read(first+12,16)) if first else b'\xa5'*16
                    assert bytes(cpu.mem_read(output,16))==expected
                    replacement=struct.pack('<4I',101,202,303,404);cpu.mem_write(output,replacement)
                    found=call(0x5c7a00,collection,[key,output],[(first+12,16)] if first else [])
                    assert found==bool(first)
                    after=bytearray(before)
                    if first:after[first-DATA+12:first-DATA+28]=replacement
                    assert bytes(cpu.mem_read(DATA,512))==bytes(after)
                assert word(collection+12)==len(survivors)
                current=word(head);previous=head
                for address in survivors:
                    assert current==address and word(address+4)==previous
                    previous=current;current=word(address)
                assert current==head and word(head+4)==previous
                metrics['caseReplays']+=1
            finally:
                for hook in hooks:cpu.hook_del(hook)
                for address in [DATA,STACK,STOP,0x5c7000]:cpu.mem_unmap(address,4096)
                assert list(cpu.mem_regions())==[]
                cpu=None
    sources=['web/world/native-cache-retirement.mjs','tests/native-cache-retirement.test.mjs',
        'scripts/prepare-native-cache-retirement-fixtures.mjs','scripts/check-native-cache-retirement.py']
    report=dict(qualified=True,scope='synthetic retirement plans and original first-key read/update plus embedded value flag-zero destruction',
        **metrics,executableSha256=PIN,fixtureSha256=hashlib.sha256(fixture_path.read_bytes()).hexdigest(),
        sourceSha256={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in sources},
        valueDeletingSlotVerified=True,constructorSentinelAllocationVerified=True,
        constructorExecuted=False,gameLaunched=False,browserUsed=False,nativeBuildRun=False,
        actualCrtFreeExecuted=False,liveCacheRetirementQualified=False,regionKeyOwnershipQualified=False,
        completeDetachQualified=False,liveNativePagingQualified=False,crashResolved=False,goalCompleted=False)
    OUTPUT.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(dict(passed=True,**metrics,gameLaunched=False)))


if __name__=='__main__':main()

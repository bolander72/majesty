#!/usr/bin/env python3
"""Pinned path coordinate provenance and bounded original signed grid conversion."""
import hashlib
import json
from pathlib import Path
import struct
import capstone
import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE, UC_HOOK_MEM_READ, UC_HOOK_MEM_WRITE, UC_PROT_READ, UC_PROT_EXEC
from unicorn.x86_const import (UC_X86_REG_EAX, UC_X86_REG_EBX, UC_X86_REG_ECX, UC_X86_REG_ESI,
                              UC_X86_REG_EDI, UC_X86_REG_EBP, UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_EFLAGS)
ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
OUTPUT = ROOT / 'output/native-order-navigation-emulated-observed.json'
RANGES = [(0x43c640,0x43c66b),(0x5e0e90,0x5e0f4b),(0x5e2c40,0x5e2cbb),
          (0x5e1220,0x5e1328),(0x5e2e50,0x5e2ee8),(0x5e13fd,0x5e1425),
          (0x5e1425,0x5e1441),(0x5e14d4,0x5e14f5),(0x5e2ef0,0x5e2fd6),
          (0x5e27f0,0x5e2828),(0x5e19c0,0x5e1aa0),(0x5e1aa0,0x5e1ab1)]
ANCHORS = {
    0x5e0ec1:('lea','ecx, [esi + 0x3c]'),0x5e0ec4:('call','0x660960'),
    0x5e0edf:('mov','ecx, dword ptr [esi + 0x48]'),0x5e0f2a:('mov','eax, dword ptr [esi + 0x44]'),
    0x5e0f2e:('lea','ecx, [eax + ebx*8]'),0x5e0f31:('call','0x660960'),
    0x5e2c65:('mov','ecx, dword ptr [esi + 0x3c]'),0x5e2c9a:('mov','ecx, dword ptr [esi + 0x38]'),
    0x5e2c9e:('lea','ecx, [ecx + ebx*8]'),0x5e2ca1:('call','0x660960'),
    0x5e125e:('mov','edx, dword ptr [esi + 0x40]'),0x5e1261:('mov','eax, dword ptr [esi + 0x3c]'),
    0x5e1269:('push','0x6ceda4'),0x5e1274:('mov','ecx, dword ptr [esi + 0x48]'),
    0x5e127b:('push','0x6ced94'),0x5e2e7c:('mov','ecx, dword ptr [esi + 0x3c]'),
    0x5e2e83:('push','0x6ced94'),0x5e1402:('lea','ecx, [esi + 0x3c]'),
    0x5e140e:('call','0x43c640'),0x5e1427:('mov','ecx, dword ptr [esi + 0x48]'),
    0x5e142e:('inc','ecx'),0x5e1436:('mov','eax, dword ptr [esi + 0x4c]'),
    0x5e143b:('jl','0x5e14d4'),0x5e14d4:('mov','eax, dword ptr [esi + 0x48]'),
    0x5e14da:('mov','edx, dword ptr [ecx + eax*8]'),0x5e14dd:('mov','ebp, dword ptr [ecx + eax*8 + 4]'),
    0x5e2f38:('mov','eax, dword ptr [esi + 0x3c]'),0x5e2f3b:('mov','ecx, dword ptr [esi + 0x40]'),
    0x5e2f3e:('cmp','eax, ecx'),0x5e2f40:('jge','0x5e2f9f'),
    0x5e2f46:('mov','edx, dword ptr [ecx + eax*8 - 8]'),
    0x5e2f51:('mov','ecx, dword ptr [ecx + eax*8 - 4]'),0x5e2f55:('mov','dword ptr [esi + 0x3c], eax'),
    0x5e2f74:('call','0x5e27f0'),0x5e2822:('call','dword ptr [edi + 0x50]'),
    0x5e1a2a:('call','0x5e1aa0'),0x5e1aa8:('mov','dword ptr [ecx + 0x3c], eax'),
    0x5e1aab:('mov','dword ptr [ecx + 0x40], edx')}


def main():
    OUTPUT.unlink(missing_ok=True)
    raw = (ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    if hashlib.sha256(raw).hexdigest() != PIN: raise ValueError('Requires pinned Majesty executable')
    pe=pefile.PE(data=raw);base=pe.OPTIONAL_HEADER.ImageBase
    decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
    rows={};ranges=[]
    for start,end in RANGES:
        code=pe.get_data(start-base,end-start);instructions=list(decoder.disasm(code,start))
        assert sum(i.size for i in instructions)==len(code), f'Incomplete range {start:08x}'
        rows.update({i.address:(i.mnemonic,i.op_str) for i in instructions})
        ranges.append(dict(start=f'{start:08x}',end=f'{end:08x}',instructions=len(instructions),sha256=hashlib.sha256(code).hexdigest()))
    assert all(rows[at]==pair for at,pair in ANCHORS.items())
    for at,label in [(0x6ceda4,b'\r\n _dst: (%d,%d)'),(0x6ced94,b'\r\n _index: %d'),(0x6ced14,b'\r\n Path (%d):')]:
        assert pe.get_data(at-base,32).split(b'\0',1)[0]==label
    for table,offset,value in [(0x68add8,0x18,0x5e1330),(0x68ae74,0x18,0x5e2ef0),(0x68ac14,0x50,0x5e19c0)]:
        assert struct.unpack('<I',pe.get_data(table+offset-base,4))[0]==value
    writer_path=ROOT/'output/native-order-writers-emulated-observed.json';writers=json.loads(writer_path.read_text())
    assert writers['qualified'] and writers['completedCalls']==20 and writers['executableSha256']==PIN
    for name,digest in writers['sourceSha256'].items():assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest
    writer_checks=0
    for replay in writers['replays']:
        if replay['kind']==4:
            assert replay['words'][26:28]==[0x1100003c,0x11000040] and replay['words'][30]==0x11000048
        elif replay['kind']==7:assert replay['words'][25]==0x1100003c
        else:continue
        writer_checks+=1
    assert writer_checks==8

    DATA,STACK,STOP,START,END=0x100000,0x200000,0x300000,0x43c640,0x43c66b
    pages=[DATA,STACK,STOP,START&~4095];native=pe.get_data(START-base,END-START)
    boundaries={i.address for i in decoder.disasm(native,START)}
    preserved=[UC_X86_REG_EBX,UC_X86_REG_ESI,UC_X86_REG_EDI,UC_X86_REG_EBP]
    samples=[(0,15),(16,17),(-1,-15),(-16,-17),(-2147483648,2147483647),
             (1872,2064),(2160,2048),(1680,1680),(-33,33),(2147483632,-2147483632)]
    total=0;observations=[]
    for poison in [0x5a,0xc3]:
        for x,y in samples:
            cpu=Uc(UC_ARCH_X86,UC_MODE_32);hooks=[]
            try:
                for page in pages:cpu.mem_map(page,4096)
                assert sum(end-start+1 for start,end,_ in cpu.mem_regions())==16384
                cpu.mem_write(START,native);cpu.mem_protect(START&~4095,4096,UC_PROT_READ|UC_PROT_EXEC)
                cpu.mem_write(DATA,bytes([poison])*4096);cpu.mem_write(STACK,bytes([poison])*4096)
                cpu.mem_write(DATA,struct.pack('<2i',x,y));before=bytes(cpu.mem_read(DATA,4096));steps=0
                def inside(at,size,start,length):return start<=at and at+size<=start+length
                def code(uc,at,size,context):
                    nonlocal total,steps
                    assert at in boundaries
                    steps+=1;total+=1
                    assert steps<=32 and total<=1024
                    assert STACK+512<=uc.reg_read(UC_X86_REG_ESP)<=STACK+3584
                def read(uc,access,at,size,value,context):
                    assert inside(at,size,DATA,8) or inside(at,size,STACK,4096)
                def write(uc,access,at,size,value,context):
                    assert inside(at,size,DATA+16,8) or inside(at,size,STACK,4096)
                hooks=[cpu.hook_add(UC_HOOK_CODE,code),cpu.hook_add(UC_HOOK_MEM_READ,read),cpu.hook_add(UC_HOOK_MEM_WRITE,write)]
                sp=STACK+3072;cpu.mem_write(sp,struct.pack('<3I',STOP,DATA+16,DATA))
                for reg in preserved:cpu.reg_write(reg,poison*0x01010101)
                cpu.reg_write(UC_X86_REG_ECX,0);cpu.reg_write(UC_X86_REG_ESP,sp);cpu.reg_write(UC_X86_REG_EFLAGS,0x202)
                cpu.emu_start(START,STOP,timeout=1000000,count=32)
                assert cpu.reg_read(UC_X86_REG_EIP)==STOP and cpu.reg_read(UC_X86_REG_ESP)==sp+12
                assert cpu.reg_read(UC_X86_REG_EAX)==DATA+16 and all(cpu.reg_read(r)==poison*0x01010101 for r in preserved)
                after=bytes(cpu.mem_read(DATA,4096));result=list(struct.unpack('<2i',after[16:24]))
                expected=[abs(n)//16*(-1 if n<0 else 1) for n in [x,y]]
                assert result==expected and after[:16]==before[:16] and after[24:]==before[24:]
                observations.append(dict(x=x,y=y,gridX=result[0],gridY=result[1],stackPoison=poison,instructions=steps))
            finally:
                for hook in hooks:cpu.hook_del(hook)
                for page in pages:cpu.mem_unmap(page,4096)
                assert list(cpu.mem_regions())==[]
                cpu=None
    report=dict(qualified=True,scope='kind 4/7 coordinate and cursor provenance; isolated world-to-grid conversion only',
                executableSha256=PIN,ranges=ranges,anchors=len(ANCHORS),writerFieldChecks=writer_checks,
                completedCalls=len(observations),originalInstructions=total,observations=observations,
                mappedGuestBytesPeak=16384,mappedGuestBytesAfterCleanup=0,
                sourceSha256={'scripts/check-native-order-navigation.py':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},
                writerEvidenceSha256=hashlib.sha256(writer_path.read_bytes()).hexdigest(),
                nativePathConsumersExecuted=False,destinationWalkabilityQualified=False,completeCoordinateClosureQualified=False,
                activeOrderMigrationQualified=False,liveHeroCrossingQualified=False,liveNativePagingQualified=False,
                gameLaunched=False,browserUsed=False,nativeBuildRun=False,crashResolved=False)
    OUTPUT.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ['qualified','anchors','writerFieldChecks','completedCalls','originalInstructions','mappedGuestBytesPeak','gameLaunched']}))


if __name__=='__main__':main()

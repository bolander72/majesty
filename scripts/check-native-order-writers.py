#!/usr/bin/env python3
"""Bounded original order writers with modeled scalar/raw stream operations."""
import hashlib
import json
from pathlib import Path
import struct
import capstone
import pefile
from unicorn import Uc,UC_ARCH_X86,UC_MODE_32,UC_HOOK_CODE,UC_HOOK_MEM_READ,UC_HOOK_MEM_WRITE,UC_PROT_READ,UC_PROT_EXEC
from unicorn.x86_const import (UC_X86_REG_EAX,UC_X86_REG_EBX,UC_X86_REG_ECX,UC_X86_REG_EDX,UC_X86_REG_ESI,
    UC_X86_REG_EDI,UC_X86_REG_EBP,UC_X86_REG_ESP,UC_X86_REG_EIP,UC_X86_REG_EFLAGS)

ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
OUTPUT=ROOT/'output/native-order-writers-emulated-observed.json'
DATA,STACK,STOP=0x100000,0x200000,0x300000
STREAM=DATA+512
LEAVES={1:(0x5da53c,0x5df250,0x68ad74,0x5df370,0x5df3e0,132),
        2:(0x5da572,0x5b6c70,0x68a224,0x5b6df0,0x5b6e4c,176),
        4:(0x5da5de,0x5e0cc0,0x68add8,0x5e0e90,0x5e0f4b,140),
        5:(0x5da614,0x5ab670,0x689d74,0x5ab7e0,0x5ab850,176),
        6:(0x5da64a,0x5e2220,0x68ae44,0x5e2390,0x5e2400,176),
        7:(0x5da680,0x5e2b20,0x68ae74,0x5e2c40,0x5e2cbb,112),
        10:(0x5da6ec,0x5b2430,0x689e80,0x5b24f0,0x5b254a,120),
        11:(0x5da722,0x5e4000,0x68af24,0x5e40c0,0x5e410f,200)}
CASES=[(1,0),(2,0),(4,0),(4,3),(5,0),(6,0),(7,0),(7,3),(10,0),(11,0)]
SHARED=[(0x5deec0,0x5deee7),(0x5deb00,0x5deb73),(0x5ae440,0x5ae48f),
        (0x4f6a90,0x4f6acd),(0x501850,0x5018ab),(0x660960,0x66098d)]
SCALARS={0x4eed10,0x4eec70,0x4eecc0,0x4eee50}
RAW,CLOSE=0x4eef60,0x4eeb50
PRESERVED=[UC_X86_REG_EBX,UC_X86_REG_ESI,UC_X86_REG_EDI,UC_X86_REG_EBP]


def main():
    OUTPUT.unlink(missing_ok=True)
    exe=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe';data=exe.read_bytes()
    if hashlib.sha256(data).hexdigest()!=PIN:raise ValueError('Requires the pinned Majesty executable')
    pe=pefile.PE(data=data);base=pe.OPTIONAL_HEADER.ImageBase
    assert struct.unpack('<I',pe.get_data(0x68acf8+8-base,4))[0]==0x5deb00
    decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32);raw_code={};boundaries=set()
    for kind,(case,constructor,table,start,end,length) in LEAVES.items():
        assert struct.unpack('<I',pe.get_data(0x5da870+(kind-1)*4-base,4))[0]==case
        rows=list(decoder.disasm(pe.get_data(case-base,54),case))
        assert any(i.mnemonic=='call' and i.op_str==hex(constructor) for i in rows)
        ctor=list(decoder.disasm(pe.get_data(constructor-base,112),constructor))
        assert any(i.mnemonic=='mov' and i.op_str=='dword ptr [esi], '+hex(table) for i in ctor)
        assert any(i.mnemonic=='call' and i.op_str==('0x5ab670' if kind in [11,13] else '0x5dee20') for i in ctor)
        assert struct.unpack('<I',pe.get_data(table+8-base,4))[0]==start
    base_ctor=list(decoder.disasm(pe.get_data(0x5dee20-base,48),0x5dee20))
    assert any(i.mnemonic=='mov' and i.op_str=='dword ptr [esi + 4], 0x68acf8' for i in base_ctor)
    ranges=SHARED+[(leaf[3],leaf[4]) for leaf in LEAVES.values()]
    for start,end in ranges:
        raw=pe.get_data(start-base,end-start);instructions=list(decoder.disasm(raw,start))
        assert sum(i.size for i in instructions)==end-start
        raw_code[start]=raw;boundaries.update(i.address for i in instructions)
    pages=sorted({DATA,STACK,STOP,0x4ee000,*[start&~4095 for start in raw_code]})
    outcomes=[];instructions_total=0
    for poison in [0x5a,0xc3]:
        for kind,waypoint_count in CASES:
            leaf=LEAVES[kind]
            cpu=Uc(UC_ARCH_X86,UC_MODE_32);hooks=[]
            try:
                for page in pages:cpu.mem_map(page,4096)
                mapped=sum(end-start+1 for start,end,_ in cpu.mem_regions());assert mapped==len(pages)*4096 and mapped<=65536
                for at,raw in raw_code.items():cpu.mem_write(at,raw)
                # Bound decoder lookahead at modeled entry points. Hooks redirect
                # these calls before the sentinel RET instruction can execute.
                for at in SCALARS|{RAW,CLOSE}:cpu.mem_write(at,b'\xc3')
                for page in pages:
                    if page not in [DATA,STACK,STOP]:cpu.mem_protect(page,4096,UC_PROT_READ|UC_PROT_EXEC)
                cpu.mem_write(DATA,bytes([poison])*4096);cpu.mem_write(STACK,bytes([poison])*4096)
                image=bytearray(128)
                for off in range(8,128,4):struct.pack_into('<I',image,off,0x11000000+off)
                struct.pack_into('<I',image,0,leaf[2]);struct.pack_into('<I',image,4,DATA+256)
                struct.pack_into('<I',image,0x10,kind)
                # No external token pointer is used; retain its two scalar words.
                struct.pack_into('<I',image,0x24,0)
                if kind in [2,5,6,11,13]:struct.pack_into('<I',image,0x4c if kind in [2,6] else 0x48,0)
                if kind==4:
                    struct.pack_into('<I',image,0x44,DATA+1024 if waypoint_count else 0)
                    struct.pack_into('<I',image,0x4c,waypoint_count)
                if kind==7:
                    struct.pack_into('<I',image,0x38,DATA+1024 if waypoint_count else 0)
                    struct.pack_into('<I',image,0x40,waypoint_count)
                cpu.mem_write(DATA,bytes(image));cpu.mem_write(DATA+256,b'\0'*16)
                point_words=[value for index in range(waypoint_count) for value in [0x12300001+index,0xfedc0002+index]]
                if point_words:cpu.mem_write(DATA+1024,struct.pack('<'+'I'*len(point_words),*point_words))

                def word(at,value=None):
                    if value is not None:cpu.mem_write(at,struct.pack('<I',value&0xffffffff))
                    return struct.unpack('<I',cpu.mem_read(at,4))[0]

                word(DATA+264,0x5deb00)
                before=bytes(cpu.mem_read(DATA,4096));payload=bytearray();steps=0;original=0;closes=0

                def inside(at,size,start,length):return start<=at and at+size<=start+length

                def code(uc,at,size,context):
                    nonlocal steps,original,closes,instructions_total
                    steps+=1
                    if steps>1024:raise RuntimeError('Order writer step budget exceeded')
                    sp=uc.reg_read(UC_X86_REG_ESP)
                    if not STACK+512<=sp<=STACK+3584:raise RuntimeError('Order writer stack escaped bounds')
                    if at in SCALARS|{RAW,CLOSE}:
                        assert uc.reg_read(UC_X86_REG_ECX)==STREAM
                        if at in SCALARS:payload.extend(struct.pack('<I',word(sp+4)));argc=1
                        elif at==RAW:
                            address,length=word(sp+4),word(sp+8)
                            if length not in [12,56] or not inside(address,length,STACK,4096):raise RuntimeError('Unbounded raw writer input')
                            payload.extend(cpu.mem_read(address,length));argc=2
                        else:closes+=1;argc=0
                        if len(payload)>200:raise RuntimeError('Order payload bound exceeded')
                        uc.reg_write(UC_X86_REG_EAX,0);uc.reg_write(UC_X86_REG_ECX,0xcccccccc);uc.reg_write(UC_X86_REG_EDX,0xdddddddd)
                        uc.reg_write(UC_X86_REG_EIP,word(sp));uc.reg_write(UC_X86_REG_ESP,sp+4+4*argc);return
                    if at not in boundaries:raise RuntimeError('Order writer escaped original ranges')
                    original+=1;instructions_total+=1
                    if instructions_total>6000:raise RuntimeError('Total original instruction budget exceeded')

                def read(uc,access,at,size,value,context):
                    if not any(inside(at,size,start,length) for start,length in [(STACK,4096),(DATA,128),(DATA+256,16),(DATA+1024,waypoint_count*8)]):
                        raise RuntimeError('Order writer read outside controlled ownership')

                def write(uc,access,at,size,value,context):
                    if not inside(at,size,STACK,4096):raise RuntimeError('Order writer mutation outside stack')

                hooks=[cpu.hook_add(UC_HOOK_CODE,code),cpu.hook_add(UC_HOOK_MEM_READ,read),cpu.hook_add(UC_HOOK_MEM_WRITE,write)]
                sp=STACK+3072;word(sp,STOP);word(sp+4,STREAM)
                for reg in PRESERVED:cpu.reg_write(reg,poison*0x01010101)
                cpu.reg_write(UC_X86_REG_ECX,DATA);cpu.reg_write(UC_X86_REG_ESP,sp);cpu.reg_write(UC_X86_REG_EFLAGS,0x202)
                try:cpu.emu_start(leaf[3],STOP,timeout=1000000,count=1024)
                except Exception as error:
                    raise RuntimeError(f'Order kind {kind} stopped at {cpu.reg_read(UC_X86_REG_EIP):08x}, steps={steps}') from error
                assert cpu.reg_read(UC_X86_REG_EIP)==STOP and cpu.reg_read(UC_X86_REG_ESP)==sp+8
                for reg in PRESERVED:assert cpu.reg_read(reg)==poison*0x01010101
                assert bytes(cpu.mem_read(DATA,4096))==before and len(payload)==leaf[5]+waypoint_count*8
                emitted=list(struct.unpack('<'+'I'*(len(payload)//4),payload))
                base_word=4 if kind in [11,13] else 3
                assert emitted[:base_word+1]==([1,1,1,2,kind] if kind in [11,13] else [5 if kind==4 else 2 if kind in [1,2] else 1,1,2,kind])
                expected_base=[word(DATA+off) for off in [0x10,0x14,8,12,0x18,0x1c,0x20]]
                assert emitted[base_word:base_word+7]==expected_base
                if kind==4:assert emitted[34]==waypoint_count and emitted[35:]==point_words
                if kind==7:assert emitted[27]==waypoint_count and emitted[28:]==point_words
                outcomes.append(dict(kind=kind,waypointCount=waypoint_count,fixedBytes=leaf[5],stackPoison=poison,payloadBytes=len(payload),words=emitted,
                    originalInstructions=original,hookSteps=steps,closeCalls=closes))
            finally:
                for hook in hooks:cpu.hook_del(hook)
                for page in pages:cpu.mem_unmap(page,4096)
                assert list(cpu.mem_regions())==[]
                cpu=None
    for kind,count in CASES:
        matches=[r for r in outcomes if r['kind']==kind and r['waypointCount']==count];assert matches[0]['words']==matches[1]['words']
    report=dict(qualified=True,scope='eight pinned leaf writers, original shared serializers, point writer and memset; null external token pointers; modeled stream primitives',
        executableSha256=PIN,completedCalls=20,originalInstructions=instructions_total,mappedGuestBytesPeak=len(pages)*4096,
        mappedGuestBytesAfterCleanup=0,replays=outcomes,
        sourceSha256={'scripts/check-native-order-writers.py':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},
        externalTokenPointerPathQualified=False,liveTypeQualified=False,orderReferenceSemanticsQualified=False,
        originalOrderReadExecuted=False,realFileIoExecuted=False,activeOrderMigrationQualified=False,
        liveHeroCrossingQualified=False,liveNativePagingQualified=False,gameLaunched=False,browserUsed=False,nativeBuildRun=False,
        crashResolved=False,goalCompleted=False)
    OUTPUT.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(dict(passed=True,calls=20,originalInstructions=instructions_total,fixedPayloadBytes={k:v[5] for k,v in LEAVES.items()},mappedGuestBytesPeak=len(pages)*4096)))


if __name__=='__main__':main()

#!/usr/bin/env python3
"""Original construct/read/write/delete lifecycle for literal copied entries."""
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
OUTPUT=ROOT/'output/native-loaded-order-lifecycle-emulated-observed.json'
DATA,STACK,STOP,PATH,STREAM=0x100000,0x200000,0x300000,0x100400,0x100900
EMBEDDED_TABLE,SEH_MARKER=0x68acf8,0x12345678
PRESERVED=[UC_X86_REG_EBX,UC_X86_REG_ESI,UC_X86_REG_EDI,UC_X86_REG_EBP]


def module(name):
    spec=importlib.util.spec_from_file_location(name.replace('/','_'),ROOT/name)
    value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value


def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def evidence(name):
    path=ROOT/name
    if path.stat().st_size>1024*1024:raise ValueError('Unbounded lifecycle evidence')
    value=json.loads(path.read_text());assert value['qualified']
    for source,sha in value['sourceSha256'].items():assert digest(ROOT/source)==sha
    return value


def main():
    OUTPUT.unlink(missing_ok=True)
    reader_name='scripts/check-native-order-readers.py';writer_name='scripts/check-native-order-writers.py'
    life_name='scripts/check-native-order-lifecycle.py'
    reader,writer,life=module(reader_name),module(writer_name),module(life_name)
    fresh_name='output/native-order-lifecycle-emulated-observed.json';fresh=evidence(fresh_name)
    writer_name_evidence='output/native-order-writers-emulated-observed.json';writers=evidence(writer_name_evidence)
    previous_name='output/native-checkpoint-order-readers-emulated-observed.json';previous=evidence(previous_name)
    capture_name='output/native-order-reader-cases.json';capture=evidence(capture_name)
    assert fresh['completedCalls']==56 and writers['completedCalls']==20
    assert previous['completedCalls']==308 and previous['capturedCheckpointEntryReadQualified']
    assert previous['captureEvidenceSha256']==digest(ROOT/capture_name)
    assert fresh['writerEvidenceSha256']==previous['writerEvidenceSha256']==digest(ROOT/writer_name_evidence)
    cases=list(reader.validate_captured_cases(capture))
    assert len(cases)==154
    # Kind 1 is absent in the copied saves; retain two explicit synthetic cases.
    for replay in writers['replays']:
        if replay['kind']==1:
            cases.append(dict(kind=1,count=0,poison=replay['stackPoison'],words=replay['words'],normalizations=[],syntheticKindOne=True))
    assert len(cases)==156
    complete_cases=list(cases)
    for kind in writer.LEAVES:
        sample=next(c for c in complete_cases if c['kind']==kind)
        for poison in [0x5a,0xc3]:
            for limit in [0,len(sample['words'])*4-4]:
                cases.append({**sample,'poison':poison,'injectedStreamFailure':True,'failAtBytes':limit})
    assert len(cases)==188
    raw=(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    if hashlib.sha256(raw).hexdigest()!=PIN:raise ValueError('Requires pinned Majesty executable')
    pe=pefile.PE(data=raw);base=pe.OPTIONAL_HEADER.ImageBase
    decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
    ranges=writer.SHARED+reader.SHARED_READERS+list(life.SHARED)
    for kind,leaf in writer.LEAVES.items():
        ctor_end,delete_start,delete_end,dtor_start,dtor_end=life.LIFECYCLE[kind]
        ranges.extend([(reader.READERS[kind],leaf[3]),(leaf[3],leaf[4]),(leaf[1],ctor_end),
                       (delete_start,delete_end),(dtor_start,dtor_end)])
        assert struct.unpack('<3I',pe.get_data(leaf[2]-base,12))==(delete_start,reader.READERS[kind],leaf[3])
    assert struct.unpack('<2I',pe.get_data(EMBEDDED_TABLE+4-base,8))==(0x5dea70,0x5deb00)
    code_bytes={};boundaries=set()
    for start,end in ranges:
        code=pe.get_data(start-base,end-start);rows=list(decoder.disasm(code,start))
        assert sum(i.size for i in rows)==len(code)
        code_bytes[start]=code;boundaries.update(i.address for i in rows)
    stubs=reader.READ_SCALARS|writer.SCALARS|{reader.RAW_READ,reader.STATUS,reader.CLEAR,reader.NAME_COPY,
                                         life.ALLOC,life.FREE,writer.RAW,writer.CLOSE}
    pages=sorted({0,DATA,STACK,STOP,EMBEDDED_TABLE&~4095,*[at&~4095 for at in stubs],*[at&~4095 for at in code_bytes]})
    assert len(pages)*4096<=96*1024
    total=calls=peak_allocated=0;replays=[]
    for case in cases:
        kind,count,poison=case['kind'],case['count'],case['poison'];object_bytes=int(fresh['objectSizes'][str(kind)])
        path_bytes=case['words'][32]*8 if kind==4 else 80 if kind==7 else 0
        assert count<=10 and path_bytes<=80 and (kind not in [4,7] or count*8<=path_bytes)
        payload=struct.pack('<'+'I'*len(case['words']),*case['words']);assert len(payload)<=512
        cpu=Uc(UC_ARCH_X86,UC_MODE_32);hooks=[]
        try:
            for page in pages:cpu.mem_map(page,4096)
            assert sum(end-start+1 for start,end,_ in cpu.mem_regions())==len(pages)*4096
            for at,code in code_bytes.items():cpu.mem_write(at,code)
            cpu.mem_write(life.JUMP_TABLE,pe.get_data(life.JUMP_TABLE-base,64))
            cpu.mem_write(EMBEDDED_TABLE,pe.get_data(EMBEDDED_TABLE-base,12))
            for at in stubs:cpu.mem_write(at,b'\xc3')
            for page in pages:
                if page not in [0,DATA,STACK]:cpu.mem_protect(page,4096,UC_PROT_READ|UC_PROT_EXEC)
            cpu.mem_write(DATA,bytes([poison])*4096);cpu.mem_write(STACK,bytes([poison])*4096)
            cpu.mem_write(0,struct.pack('<I',SEH_MARKER))
            live={};allocations=[];frees=[];emitted=bytearray();observations=[]
            cursor=steps=original=clear_calls=name_calls=allocation_peak=stream_error=0;phase='construct'
            injected=case.get('injectedStreamFailure',False);delete_path_pointer=None
            def inside(at,size,start,length):return start<=at and at+size<=start+length
            def owned(at,size):return any(inside(at,size,start,n) for start,n in live.items())
            def word(at,value=None):
                if value is not None:cpu.mem_write(at,struct.pack('<I',value&0xffffffff))
                return struct.unpack('<I',cpu.mem_read(at,4))[0]
            def destination(at,data):
                assert owned(at,len(data)) or inside(at,len(data),STACK,4096)
                cpu.mem_write(at,data)
            def take(n):
                nonlocal cursor,stream_error
                assert n>=0 and cursor+n<=len(payload)
                if injected and (stream_error or cursor+n>case['failAtBytes']):
                    stream_error=7;return None
                value=payload[cursor:cursor+n];cursor+=n;return value
            def returned(sp,argc,value=0,cdecl=False):
                cpu.reg_write(UC_X86_REG_EAX,value);cpu.reg_write(UC_X86_REG_ECX,0xcccccccc);cpu.reg_write(UC_X86_REG_EDX,0xdddddddd)
                cpu.reg_write(UC_X86_REG_EIP,word(sp));cpu.reg_write(UC_X86_REG_ESP,sp+4+(0 if cdecl else argc*4))
            def code(uc,at,size,context):
                nonlocal steps,original,total,clear_calls,name_calls,allocation_peak,peak_allocated
                steps+=1;sp=uc.reg_read(UC_X86_REG_ESP)
                assert steps<=1024 and STACK+512<=sp<=STACK+3584
                if at in stubs:
                    if at in reader.READ_SCALARS|{reader.RAW_READ,reader.STATUS}|writer.SCALARS|{writer.RAW,writer.CLOSE}:
                        assert uc.reg_read(UC_X86_REG_ECX)==STREAM
                    if at in reader.READ_SCALARS:
                        assert phase=='read';value=take(4)
                        if value is not None:destination(word(sp+4),value)
                        returned(sp,1,stream_error)
                    elif at==reader.RAW_READ:
                        assert phase=='read';n=word(sp+8);assert n in [12,56];value=take(n)
                        if value is not None:destination(word(sp+4),value)
                        returned(sp,2,stream_error)
                    elif at==reader.STATUS:assert phase=='read';returned(sp,0,stream_error)
                    elif at==reader.CLEAR:
                        target=word(sp+4);assert phase=='read' and owned(target,16) and word(target)==0
                        destination(target,b'\0'*4);clear_calls+=1;returned(sp,1,cdecl=True)
                    elif at==reader.NAME_COPY:
                        target,address=word(sp+4),word(sp+8)
                        assert phase=='read' and owned(target,16) and inside(address,32,STACK,4096)
                        assert bytes(cpu.mem_read(address,32))==b'\0'*32
                        destination(target,b'\0'*4);name_calls+=1;returned(sp,2,cdecl=True)
                    elif at==life.ALLOC:
                        n=word(sp+4);assert len(allocations)<2
                        if phase=='construct' and not allocations:
                            assert n==object_bytes;address=DATA
                        else:
                            assert (phase=='construct' and kind==7) or (phase=='read' and kind==4)
                            expected=word(DATA+92)*8 if kind==4 else path_bytes
                            assert n==expected and n<=80
                            if not injected:assert n==path_bytes
                            address=PATH if n else 0
                        assert not address or address not in live
                        if address:live[address]=n
                        allocations.append(dict(phase=phase,bytes=n,address=address))
                        allocation_peak=max(allocation_peak,sum(live.values()));peak_allocated=max(peak_allocated,allocation_peak)
                        assert allocation_peak<=192
                        returned(sp,1,address,cdecl=True)
                    elif at==life.FREE:
                        assert phase=='delete';address=word(sp+4)
                        if address:assert address in live;del live[address]
                        frees.append(address);assert len(frees)<=2;returned(sp,1,cdecl=True)
                    elif at in writer.SCALARS:
                        assert phase=='write';emitted.extend(struct.pack('<I',word(sp+4)));returned(sp,1)
                    elif at==writer.RAW:
                        assert phase=='write';address,n=word(sp+4),word(sp+8)
                        assert n in [12,56] and inside(address,n,STACK,4096)
                        emitted.extend(cpu.mem_read(address,n));returned(sp,2)
                    elif at==writer.CLOSE:assert phase=='write';returned(sp,0)
                    else:raise AssertionError('Unexpected lifecycle model')
                    assert len(emitted)<=512;return
                assert at in boundaries, 'Loaded order lifecycle escaped pinned functions'
                original+=1;total+=1;assert total<=250000
            def read(uc,access,at,size,value,context):
                assert inside(at,size,STACK,4096) or inside(at,size,0,4) or owned(at,size) or \
                    inside(at,size,life.JUMP_TABLE,64) or inside(at,size,EMBEDDED_TABLE,12)
            def write(uc,access,at,size,value,context):
                assert inside(at,size,STACK,4096) or (phase in ['construct','read','delete'] and (inside(at,size,0,4) or owned(at,size)))
            hooks=[cpu.hook_add(UC_HOOK_CODE,code),cpu.hook_add(UC_HOOK_MEM_READ,read),cpu.hook_add(UC_HOOK_MEM_WRITE,write)]
            phases=[('construct',life.FACTORY,0,kind),('read',reader.READERS[kind],DATA,STREAM)]
            if not injected:phases.append(('write',writer.LEAVES[kind][3],DATA,STREAM))
            phases.append(('delete',life.LIFECYCLE[kind][1],DATA,1))
            for phase,entry,receiver,arg in phases:
                steps=0;before=original;sp=STACK+3072;word(sp,STOP);word(sp+4,arg)
                if phase=='write':before_write=bytes(cpu.mem_read(DATA,4096))
                if phase=='delete':
                    assert word(DATA+36)==0
                    if kind in [2,6]:assert word(DATA+76)==0
                    if kind in [5,11]:assert word(DATA+72)==0
                    if kind in [4,7]:
                        delete_path_pointer=word(DATA+(68 if kind==4 else 56))
                        assert delete_path_pointer in [0,PATH]
                        assert bool(delete_path_pointer)==(PATH in live)
                for reg in PRESERVED:cpu.reg_write(reg,poison*0x01010101)
                cpu.reg_write(UC_X86_REG_ECX,receiver);cpu.reg_write(UC_X86_REG_ESP,sp);cpu.reg_write(UC_X86_REG_EFLAGS,0x202)
                try:cpu.emu_start(entry,STOP,timeout=1000000,count=1024)
                except Exception as error:raise RuntimeError(f'Order {kind} {phase} stopped at {cpu.reg_read(UC_X86_REG_EIP):08x}, steps={steps}') from error
                assert cpu.reg_read(UC_X86_REG_EIP)==STOP and cpu.reg_read(UC_X86_REG_ESP)==sp+8
                assert all(cpu.reg_read(r)==poison*0x01010101 for r in PRESERVED) and word(0)==SEH_MARKER
                assert cpu.reg_read(UC_X86_REG_EAX)==(DATA if phase in ['construct','delete'] else 7 if injected and phase=='read' else 0)
                if phase=='construct':
                    assert word(DATA)==writer.LEAVES[kind][2] and word(DATA+4)==EMBEDDED_TABLE
                    assert word(DATA+12)==poison*0x01010101
                    if kind==7:assert word(DATA+56)==PATH and PATH in live
                elif phase=='read':
                    if injected:assert stream_error==7 and cursor<=case['failAtBytes']
                    else:
                        assert cursor==len(payload) and word(DATA+16)==kind
                        assert word(DATA+12)==case['words'][7 if kind==11 else 6]
                elif phase=='write':assert bytes(emitted)==payload and bytes(cpu.mem_read(DATA,4096))==before_write
                else:assert live=={} and frees==([delete_path_pointer] if kind in [4,7] else [])+[DATA]
                calls+=1;observations.append(dict(phase=phase,originalInstructions=original-before,hookSteps=steps))
            if not injected:
                assert clear_calls==name_calls==(2 if kind in [2,5,6,11] else 1)
                assert len(allocations)==(2 if kind in [4,7] else 1)
            replays.append(dict(kind=kind,waypointCount=count,poison=poison,payloadBytes=len(payload),payloadSha256=hashlib.sha256(payload).hexdigest(),
                                roundTripIdentical=not injected,syntheticKindOne=case.get('syntheticKindOne',False),normalizations=[],
                                injectedStreamFailure=injected,failAtBytes=case.get('failAtBytes'),readCursor=cursor,readStatus=stream_error,
                                objectStorageBytes=object_bytes,sourcePathStorageBytes=path_bytes,allocationRequests=allocations,
                                freeArguments=frees,liveAllocationBytesAfter=0,modeledAllocationBytesPeak=allocation_peak,
                                emptyNameCopyCalls=name_calls,phases=observations,
                                **({k:case[k] for k in ['filename','snapshotSha256','unitId','bank','index','sourceOffset']} if not case.get('syntheticKindOne') else {})))
        finally:
            for hook in hooks:cpu.hook_del(hook)
            for page in pages:cpu.mem_unmap(page,4096)
            assert list(cpu.mem_regions())==[];cpu=None
    assert calls==720 and len(replays)==188
    report=dict(qualified=True,scope='original lifecycle of 154 copied entries, two synthetic kind-1 cases and 32 injected stream failures; modeled allocation/free/I/O/empty-name copy',
                executableSha256=PIN,completedCalls=calls,capturedEntries=154,syntheticEntries=2,injectedFailureCases=32,originalInstructions=total,replays=replays,
                mappedGuestBytesPeak=len(pages)*4096,mappedGuestBytesAfterCleanup=0,modeledAllocationBytesPeak=peak_allocated,
                sourceSha256={n:digest(ROOT/n) for n in ['scripts/check-native-loaded-order-lifecycle.py',reader_name,writer_name,life_name]},
                dependencyEvidenceSha256={n:digest(ROOT/n) for n in [fresh_name,writer_name_evidence,previous_name,capture_name]},
                loadedEmptyNameOrderCleanupQualified=True,positiveNameCleanupQualified=False,originalBankReaderExecuted=False,
                realAllocatorExecuted=False,realFileIoExecuted=False,completeBankRollbackQualified=False,
                allOrderReferencesQualified=False,activeOrderMigrationQualified=False,liveHeroCrossingQualified=False,liveNativePagingQualified=False,
                gameLaunched=False,browserUsed=False,nativeBuildRun=False,crashResolved=False,goalCompleted=False)
    document=json.dumps(report,indent=2)+'\n';assert len(document.encode())<=1024*1024
    OUTPUT.write_text(document)
    print(json.dumps({k:report[k] for k in ['qualified','completedCalls','capturedEntries','syntheticEntries','injectedFailureCases','originalInstructions','mappedGuestBytesPeak','modeledAllocationBytesPeak','gameLaunched']}))


if __name__=='__main__':main()

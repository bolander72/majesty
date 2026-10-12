#!/usr/bin/env python3
"""Tiny original reader/writer round trips with controlled path storage and I/O."""
import argparse
import hashlib
import importlib.util
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
OUTPUT=ROOT/'output/native-order-readers-emulated-observed.json'
DATA,STACK,STOP=0x100000,0x200000,0x300000
TABLE,PATH,STREAM=DATA+256,DATA+1024,DATA+2304
READERS={1:0x5df2b0,2:0x5b6d60,4:0x5e0d40,5:0x5ab760,
         6:0x5e2310,7:0x5e2bc0,10:0x5b2490,11:0x5e4060,13:0x5f9410}
READ_SCALARS={0x4ef790,0x4ef740,0x4ef880,0x4ef920}
RAW_READ,STATUS,CLEAR,NAME_COPY,ALLOC=0x4ef700,0x4ef6c0,0x523420,0x523450,0x64c616
PRESERVED=[UC_X86_REG_EBX,UC_X86_REG_ESI,UC_X86_REG_EDI,UC_X86_REG_EBP]
SHARED_READERS=[(0x5dee90,0x5deeba),(0x5dea70,0x5deafa),(0x5ae490,0x5ae4f1),
                (0x4f6ad0,0x4f6b15),(0x660930,0x66095b)]


def validate_captured_cases(capture):
    if not isinstance(capture,dict) or capture.get('qualified') is not True or capture.get('literalPayloadsMatched') is not True:
        raise ValueError('Unqualified literal entry capture')
    cases=capture.get('cases');reports=capture.get('reports')
    if not isinstance(cases,list) or not 1<=len(cases)<=256 or not isinstance(reports,list) or not 1<=len(reports)<=4:
        raise ValueError('Captured case/file budget exceeded')
    files={}
    for report in reports:
        name=report.get('filename');size=report.get('fileBytes');sha=report.get('sha256')
        if not isinstance(name,str) or not name or len(name)>128 or Path(name).name!=name or name in files:
            raise ValueError('Invalid captured file identity')
        if type(size) is not int or not 0<size<=64*1024*1024 or not isinstance(sha,str) or len(sha)!=64:
            raise ValueError('Invalid captured file range')
        if report.get('fileIdentityUnchanged') is not True or report.get('previousFixtureHashMatched') is not True:
            raise ValueError('Captured source changed')
        files[name]=report
    seen=set();counts={name:0 for name in files}
    lengths={1:132,2:176,4:140,5:176,6:176,7:112,10:120,11:200,13:188}
    for case in cases:
        kind=case.get('kind');count=case.get('count');words=case.get('words');name=case.get('filename');offset=case.get('sourceOffset')
        if type(kind) is not int or kind not in lengths or type(count) is not int or not 0<=count<=10:
            raise ValueError('Unsupported captured kind/path count')
        if not isinstance(words,list) or not words or len(words)>128 or any(type(v) is not int or not 0<=v<=0xffffffff for v in words):
            raise ValueError('Invalid captured payload words')
        prefix=[1,1,1,2,kind] if kind in [11,13] else [5 if kind==4 else 2 if kind in [1,2] else 1,1,2,kind]
        if words[:len(prefix)]!=prefix:raise ValueError('Unsupported captured writer version')
        if kind not in [4,7] and count!=0:raise ValueError('Unexpected captured path')
        if len(words)*4!=lengths[kind]+count*8 or case.get('payloadBytes')!=len(words)*4:
            raise ValueError('Invalid captured payload length')
        if kind==4 and (words[34]!=count or not count<=words[32]<=10):
            raise ValueError('Captured kind four capacity exceeds tiny fixture')
        if kind==7 and words[27]!=count:raise ValueError('Captured path count mismatch')
        if name not in files or case.get('snapshotSha256')!=files[name]['sha256'] or type(offset) is not int or offset<0 or offset+len(words)*4>files[name]['fileBytes']:
            raise ValueError('Captured entry has no checked file range')
        key=(name,offset,case.get('poison'))
        if key in seen:raise ValueError('Duplicate captured entry range')
        seen.add(key);counts[name]+=1
        if case.get('normalizations')!=[] or type(case.get('poison')) is not int or case['poison'] not in [0x5a,0xc3]:
            raise ValueError('Captured entry normalization or invalid stack fill')
        raw=struct.pack('<'+'I'*len(words),*words)
        if hashlib.sha256(raw).hexdigest()!=case.get('payloadSha256'):raise ValueError('Captured payload digest mismatch')
    if any(counts[name]!=report.get('entries') for name,report in files.items()):raise ValueError('Captured file entry count mismatch')
    return cases


def main(checkpoint_cases=None,output_override=None,inherited_audit=None,writer_evidence=None):
    output=ROOT/'output/native-checkpoint-order-readers-emulated-observed.json' if checkpoint_cases else OUTPUT
    if output_override:
        output=output_override
        if output.exists():raise ValueError('Preserve previous reader evidence')
    else:output.unlink(missing_ok=True)
    capture=None
    if checkpoint_cases:
        with checkpoint_cases.open('rb') as handle:
            capture_bytes=handle.read(1024*1024+1)
        if len(capture_bytes)>1024*1024:raise ValueError('Captured entry artifact exceeds one MiB')
        capture=json.loads(capture_bytes)
        names={'web/world/checkpoint.mjs','web/world/order-entries.mjs','web/world/order-read-bounds.mjs','scripts/prepare-native-order-reader-cases.mjs'}
        if set(capture.get('sourceSha256',{}))!=names:raise ValueError('Unexpected capture source bindings')
        for name,digest in capture['sourceSha256'].items():
            if hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=digest:raise ValueError('Stale literal capture source')
        validate_captured_cases(capture)
        if any(c['kind']==13 for c in capture['cases']):
            if not inherited_audit:raise ValueError('Kind13 requires independently pinned inherited writer evidence')
            script=ROOT/'scripts/capture-native-selected-halo-orders.mjs'
            if capture.get('captureScriptSha256')!=hashlib.sha256(script.read_bytes()).hexdigest():
                raise ValueError('Stale selected halo literal capture script')
    writer_source=ROOT/'scripts/check-native-order-writers.py'
    spec=importlib.util.spec_from_file_location('original_writers',writer_source)
    writer=importlib.util.module_from_spec(spec);spec.loader.exec_module(writer)
    if inherited_audit:
        if not checkpoint_cases:raise ValueError('Inherited reader qualification requires literal checkpoint cases')
        audit=json.loads(inherited_audit.read_text())
        assert audit['qualified'] and audit['inheritedFramingQualified'] and audit['objectBytes']==100
        assert audit['executableSha256']==PIN and audit['originalCallbackTokenReplayChecks']==4
        for name,digest in audit['sourceSha256'].items():
            if hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=digest:raise ValueError('Stale inherited writer audit')
        writer.LEAVES[13]=(0x5da78e,0x5f93c0,0x68b8ec,0x5f9460,0x5f94a3,188)
        writer.SHARED.append((0x5ab7e0,0x5ab850))
    evidence_path=writer_evidence or ROOT/'output/native-order-writers-emulated-observed.json'
    evidence=json.loads(evidence_path.read_text())
    if not evidence['qualified'] or evidence['completedCalls']!=20:raise ValueError('Missing original writer evidence')
    for name,digest in evidence['sourceSha256'].items():
        if hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=digest:raise ValueError('Stale original writer source')
    raw=(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    if hashlib.sha256(raw).hexdigest()!=PIN:raise ValueError('Requires the pinned Majesty executable')
    pe=pefile.PE(data=raw);base=pe.OPTIONAL_HEADER.ImageBase
    decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32);code_bytes={};boundaries=set();decoded={}
    ranges=writer.SHARED+SHARED_READERS+[(leaf[3],leaf[4]) for leaf in writer.LEAVES.values()]+[(READERS[k],v[3]) for k,v in writer.LEAVES.items()]
    for start,end in ranges:
        code=pe.get_data(start-base,end-start);rows=list(decoder.disasm(code,start))
        if sum(i.size for i in rows)!=end-start:raise ValueError(f'Incomplete original range {start:08x}')
        code_bytes[start]=code;boundaries.update(i.address for i in rows);decoded.update({i.address:(i.mnemonic,i.op_str) for i in rows})
    for kind,leaf in writer.LEAVES.items():
        if struct.unpack('<I',pe.get_data(leaf[2]+4-base,4))[0]!=READERS[kind]:raise ValueError('Unexpected original reader slot')
    if struct.unpack('<I',pe.get_data(0x68acf8+4-base,4))[0]!=0x5dea70:raise ValueError('Unexpected embedded reader slot')
    ctor=list(decoder.disasm(pe.get_data(0x5e2b20-base,0x5b),0x5e2b20))
    ctor_map={i.address:(i.mnemonic,i.op_str) for i in ctor}
    assert ctor_map[0x5e2b44]==('push','0x50') and ctor_map[0x5e2b5c]==('call','0x64c616')
    assert ctor_map[0x5e2b68]==('mov','dword ptr [esi + 0x38], eax')
    for at,value in {0x5e0de3:('lea','ebx, [esi + 0x5c]'),0x5e0e2a:('mov','ebx, dword ptr [ebx]'),
        0x5e0e2c:('lea','edx, [ebx*8]'),0x5e0e34:('call','0x64c616'),
        0x5e2c1e:('mov','ecx, dword ptr [edi + 0x38]'),0x5e2c22:('lea','ecx, [ecx + ebx*8]'),
        0x5e2c25:('call','0x660930')}.items():assert decoded[at]==value
    stubs=READ_SCALARS|writer.SCALARS|{RAW_READ,STATUS,CLEAR,NAME_COPY,ALLOC,writer.RAW,writer.CLOSE}
    pages=sorted({DATA,STACK,STOP,*[at&~4095 for at in stubs],*[at&~4095 for at in code_bytes]})
    assert len(pages)*4096<=96*1024
    # The old scalar writer fixture intentionally used arbitrary capacity bits.
    # Normalize only kind 4's capacity before executing an allocating reader.
    cases=[]
    for replay in evidence['replays']:
        words=list(replay['words']);normalizations=[]
        if replay['kind']==4:
            normalizations.append(dict(word=32,before=words[32],after=replay['waypointCount']))
            words[32]=replay['waypointCount']
        cases.append(dict(kind=replay['kind'],count=replay['waypointCount'],poison=replay['stackPoison'],words=words,normalizations=normalizations))
    for poison in [0x5a,0xc3]:
        sample=next(r for r in evidence['replays'] if r['kind']==7 and r['waypointCount']==3)
        words=list(sample['words'][:28]);words[27]=10
        words.extend(value for i in range(10) for value in [0x12300001+i,0xfedc0002+i])
        cases.append(dict(kind=7,count=10,poison=poison,words=words,normalizations=[],syntheticTenPointBoundary=True))
    if capture:cases=validate_captured_cases(capture)
    replays=[];instructions_total=0;calls=0
    for case in cases:
        kind,count,poison=case['kind'],case['count'],case['poison']
        assert count<=10 and (kind not in [4,7] or (case['words'][32] if kind==4 else 10)>=count)
        cpu=Uc(UC_ARCH_X86,UC_MODE_32);hooks=[]
        try:
            for page in pages:cpu.mem_map(page,4096)
            assert sum(end-start+1 for start,end,_ in cpu.mem_regions())==len(pages)*4096
            for at,code in code_bytes.items():cpu.mem_write(at,code)
            for at in stubs:cpu.mem_write(at,b'\xc3')
            for page in pages:
                if page not in [DATA,STACK,STOP]:cpu.mem_protect(page,4096,UC_PROT_READ|UC_PROT_EXEC)
            cpu.mem_write(DATA,bytes([poison])*4096);cpu.mem_write(STACK,bytes([poison])*4096)
            def word(at,value=None):
                if value is not None:cpu.mem_write(at,struct.pack('<I',value&0xffffffff))
                return struct.unpack('<I',cpu.mem_read(at,4))[0]
            word(DATA,writer.LEAVES[kind][2]);word(DATA+4,TABLE);word(TABLE+4,0x5dea70);word(TABLE+8,0x5deb00)
            word(DATA+0x24,0)
            if kind in [2,6]:word(DATA+0x4c,0)
            if kind in [5,11,13]:word(DATA+0x48,0)
            if kind==4:word(DATA+0x44,0)
            if kind==7:word(DATA+0x38,PATH)
            path_bytes=case['words'][32]*8 if kind==4 else 80 if kind==7 else 0
            payload=struct.pack('<'+'I'*len(case['words']),*case['words']);cursor=0;emitted=bytearray()
            allocation_requests=[];clear_calls=0;name_calls=0;steps=0;original=0;phase='read'
            def inside(at,size,start,length):return start<=at and at+size<=start+length
            def owned_destination(at,size):return inside(at,size,DATA,128) or inside(at,size,STACK,4096) or inside(at,size,PATH,path_bytes)
            def destination(at,data):
                if not owned_destination(at,len(data)):raise RuntimeError('Reader output exceeds controlled ownership')
                cpu.mem_write(at,data)
            def take(n):
                nonlocal cursor
                if n<0 or cursor+n>len(payload):raise RuntimeError('Original reader exceeded payload')
                data=payload[cursor:cursor+n];cursor+=n;return data
            def returned(sp,argc,value=0,cdecl=False):
                cpu.reg_write(UC_X86_REG_EAX,value);cpu.reg_write(UC_X86_REG_ECX,0xcccccccc);cpu.reg_write(UC_X86_REG_EDX,0xdddddddd)
                cpu.reg_write(UC_X86_REG_EIP,word(sp));cpu.reg_write(UC_X86_REG_ESP,sp+4+(0 if cdecl else argc*4))
            def code(uc,at,size,context):
                nonlocal steps,original,instructions_total,clear_calls,name_calls
                steps+=1;sp=uc.reg_read(UC_X86_REG_ESP)
                if steps>1024 or not STACK+512<=sp<=STACK+3584:raise RuntimeError('Original order call escaped step/stack bounds')
                if at in stubs:
                    if at in READ_SCALARS|{RAW_READ,STATUS}|writer.SCALARS|{writer.RAW,writer.CLOSE}:
                        assert uc.reg_read(UC_X86_REG_ECX)==STREAM
                    if at in READ_SCALARS:
                        assert phase=='read';destination(word(sp+4),take(4));returned(sp,1)
                    elif at==RAW_READ:
                        assert phase=='read';n=word(sp+8);assert n in [12,56];destination(word(sp+4),take(n));returned(sp,2)
                    elif at==STATUS:assert phase=='read';returned(sp,0)
                    elif at==CLEAR:
                        assert phase=='read';target=word(sp+4);assert inside(target,16,DATA,128) and word(target)==0
                        destination(target,b'\0'*4);clear_calls+=1;returned(sp,1,cdecl=True)
                    elif at==NAME_COPY:
                        assert phase=='read';target,address=word(sp+4),word(sp+8)
                        assert inside(target,16,DATA,128) and inside(address,32,STACK,4096)
                        assert bytes(cpu.mem_read(address,32))==b'\0'*32
                        destination(target,b'\0'*4);name_calls+=1;returned(sp,2,cdecl=True)
                    elif at==ALLOC:
                        assert phase=='read' and kind==4 and not allocation_requests
                        n=word(sp+4)
                        if n!=path_bytes or n>80:raise RuntimeError('Reader allocation request exceeds fixture budget')
                        allocation_requests.append(n);returned(sp,1,PATH if n else 0,cdecl=True)
                    elif at in writer.SCALARS:
                        assert phase=='write';emitted.extend(struct.pack('<I',word(sp+4)));returned(sp,1)
                    elif at==writer.RAW:
                        assert phase=='write';address,n=word(sp+4),word(sp+8)
                        assert n in [12,56] and inside(address,n,STACK,4096)
                        emitted.extend(cpu.mem_read(address,n));returned(sp,2)
                    elif at==writer.CLOSE:assert phase=='write';returned(sp,0)
                    if len(emitted)>512:raise RuntimeError('Unbounded serialized output')
                    return
                if at not in boundaries:raise RuntimeError('Order call escaped original instruction ranges')
                original+=1;instructions_total+=1
                if instructions_total>(350000 if capture else 15000):raise RuntimeError('Total original instruction budget exceeded')
            def read(uc,access,at,size,value,context):
                if not any(inside(at,size,start,n) for start,n in [(STACK,4096),(DATA,128),(TABLE,16),(PATH,path_bytes)]):
                    raise RuntimeError('Order read outside fixture ownership')
            def write(uc,access,at,size,value,context):
                if not inside(at,size,STACK,4096) and (phase!='read' or not owned_destination(at,size)):
                    raise RuntimeError('Order mutation outside fixture ownership')
            hooks=[cpu.hook_add(UC_HOOK_CODE,code),cpu.hook_add(UC_HOOK_MEM_READ,read),cpu.hook_add(UC_HOOK_MEM_WRITE,write)]
            observations=[]
            for phase,entry in [('read',READERS[kind]),('write',writer.LEAVES[kind][3])]:
                steps=0;before_original=original;sp=STACK+3072;word(sp,STOP);word(sp+4,STREAM)
                if phase=='write':before_write=bytes(cpu.mem_read(DATA,4096))
                for reg in PRESERVED:cpu.reg_write(reg,poison*0x01010101)
                cpu.reg_write(UC_X86_REG_ECX,DATA);cpu.reg_write(UC_X86_REG_ESP,sp);cpu.reg_write(UC_X86_REG_EFLAGS,0x202)
                try:cpu.emu_start(entry,STOP,timeout=1000000,count=1024)
                except Exception as error:raise RuntimeError(f'Order {kind} {phase} stopped at {cpu.reg_read(UC_X86_REG_EIP):08x}, steps={steps}') from error
                assert cpu.reg_read(UC_X86_REG_EIP)==STOP and cpu.reg_read(UC_X86_REG_ESP)==sp+8
                for reg in PRESERVED:assert cpu.reg_read(reg)==poison*0x01010101
                if phase=='read':assert cursor==len(payload)
                else:assert bytes(cpu.mem_read(DATA,4096))==before_write and bytes(emitted)==payload
                calls+=1;observations.append(dict(phase=phase,originalInstructions=original-before_original,hookSteps=steps))
            assert clear_calls==name_calls==(2 if kind in [2,5,6,11,13] else 1)
            assert allocation_requests==([path_bytes] if kind==4 else [])
            replays.append(dict(kind=kind,waypointCount=count,poison=poison,payloadBytes=len(payload),payloadSha256=hashlib.sha256(payload).hexdigest(),
                roundTripIdentical=True,normalizations=case['normalizations'],syntheticTenPointBoundary=case.get('syntheticTenPointBoundary',False),
                pathStorageBytes=path_bytes,modeledAllocationRequests=allocation_requests,emptyNameCopyCalls=name_calls,phases=observations,
                **({key:case[key] for key in ['filename','snapshotSha256','unitId','bank','index','sourceOffset']} if capture else {})))
        finally:
            for hook in hooks:cpu.hook_del(hook)
            for page in pages:cpu.mem_unmap(page,4096)
            assert list(cpu.mem_regions())==[];cpu=None
    assert calls==len(cases)*2 and len(replays)==len(cases)
    if not capture:assert calls==44 and len(replays)==22
    report=dict(qualified=True,scope='captured original entry reader/writer round trips with modeled dependencies' if capture else 'eight original leaf reader/writer round trips; modeled stream, empty-name lifecycle and bounded path allocation',
        executableSha256=PIN,completedCalls=calls,roundTrips=len(replays),originalInstructions=instructions_total,
        mappedGuestBytesPeak=len(pages)*4096,mappedGuestBytesAfterCleanup=0,replays=replays,
        writerEvidenceSha256=hashlib.sha256(evidence_path.read_bytes()).hexdigest(),
        sourceSha256={'scripts/check-native-order-readers.py':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                      'scripts/check-native-order-writers.py':hashlib.sha256(writer_source.read_bytes()).hexdigest()},
        capturedCheckpointEntryReadQualified=bool(capture),
        captureEvidenceSha256=hashlib.sha256(capture_bytes).hexdigest() if capture else None,
        inheritedWriterAuditSha256=hashlib.sha256(inherited_audit.read_bytes()).hexdigest() if inherited_audit else None,
        positiveNameRestorationQualified=False,actualCheckpointReadQualified=False,constructorExecuted=False,
        realAllocatorExecuted=False,realFileIoExecuted=False,completeOrderRestorationQualified=False,
        allOrderReferencesQualified=False,activeOrderMigrationQualified=False,liveHeroCrossingQualified=False,
        liveNativePagingQualified=False,gameLaunched=False,browserUsed=False,nativeBuildRun=False,crashResolved=False,goalCompleted=False)
    output.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ['qualified','completedCalls','roundTrips','originalInstructions','mappedGuestBytesPeak','gameLaunched']}))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkpoint-cases',type=Path)
    parser.add_argument('--inherited-audit',type=Path)
    parser.add_argument('--output',type=Path)
    parser.add_argument('--writer-evidence',type=Path)
    args=parser.parse_args()
    main(args.checkpoint_cases,args.output,args.inherited_audit,args.writer_evidence)

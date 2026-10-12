#!/usr/bin/env python3
"""Original copied-bank loading and low-level cleanup; bounded helper models."""
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
OUTPUT=ROOT/'output/native-order-bank-rollback-emulated-observed.json'
DATA,STACK,STOP,MANAGER,STREAM=0x100000,0x200000,0x300000,0x100f00,0x100f20
OWNER,SEH_MARKER=0x12345678,0x34567890
BANK_TABLE,MANAGER_TABLE,EMBEDDED_TABLE=0x683148,0x68ac14,0x68acf8
GET_MANAGER=0x5da280
BANK_CTOR,BANK_READ,BANK_WRITE,REMOVE,BANK_DELETE=0x4abcc0,0x5e4d20,0x5e4e20,0x5e4f90,0x4abce0
BANK_RANGES=[(0x4abcc0,0x4abcd9),(0x4abce0,0x4abcfe),(0x4abd00,0x4abd0b),
             (0x5e4c60,0x5e4c96),(0x5e4cc0,0x5e4d13),(BANK_READ,0x5e4e1b),
             (BANK_WRITE,0x5e4ea4),(REMOVE,0x5e4fe7)]
PRESERVED=[UC_X86_REG_EBX,UC_X86_REG_ESI,UC_X86_REG_EDI,UC_X86_REG_EBP]


def module(name):
    spec=importlib.util.spec_from_file_location(name.replace('/','_'),ROOT/name)
    value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def evidence(name):
    path=ROOT/name;assert path.stat().st_size<=1024*1024
    value=json.loads(path.read_text());assert value['qualified']
    for source,digest in value['sourceSha256'].items():assert sha(ROOT/source)==digest
    return value


def main():
    OUTPUT.unlink(missing_ok=True)
    source_names=['scripts/check-native-order-bank-rollback.py','scripts/check-native-order-readers.py',
                  'scripts/check-native-order-writers.py','scripts/check-native-order-lifecycle.py']
    reader,writer,life=[module(n) for n in source_names[1:]]
    bank_name='output/native-order-bank-cases.json';capture=evidence(bank_name)
    entry_name='output/native-order-reader-cases.json';old=evidence(entry_name)
    loaded_name='output/native-loaded-order-lifecycle-emulated-observed.json';loaded=evidence(loaded_name)
    fresh_name='output/native-order-lifecycle-emulated-observed.json';fresh=evidence(fresh_name)
    writer_name='output/native-order-writers-emulated-observed.json';writers=evidence(writer_name)
    assert loaded['completedCalls']==720 and loaded['loadedEmptyNameOrderCleanupQualified']
    assert loaded['dependencyEvidenceSha256'][entry_name]==sha(ROOT/entry_name)
    assert capture['literalPayloadsMatched'] and len(capture['cases'])==89
    reference=reader.validate_captured_cases(old);cases=[];identities=set();entries=0
    files={r['filename']:r for r in old['reports']}
    for item in capture['cases']:
        name,unit=item['filename'],item['unitId'];key=(name,unit)
        assert key not in identities and name in files and item['snapshotSha256']==files[name]['sha256']
        identities.add(key);assert item['normalizations']==[] and len(item['banks'])==3
        count=0;last_end=None
        for bank_index,bank in enumerate(item['banks']):
            expected=[c for c in reference if c['filename']==name and c['unitId']==unit and c['bank']==bank_index]
            expected.sort(key=lambda c:c['index']);values=[1,len(expected)]
            for index,c in enumerate(expected):
                assert c['index']==index;values.extend([1,c['kind'],*c['words']])
            assert bank['bank']==bank_index and bank['words']==values and bank['count']==len(expected)<=4
            assert bank['payloadBytes']==len(values)*4<=2048
            payload=struct.pack('<'+'I'*len(values),*values)
            assert hashlib.sha256(payload).hexdigest()==bank['payloadSha256']
            assert type(bank['sourceOffset']) is int and 0<=bank['sourceOffset'] and bank['sourceOffset']+len(payload)<=files[name]['fileBytes']
            if last_end is not None:assert bank['sourceOffset']==last_end
            if expected:assert expected[0]['sourceOffset']==bank['sourceOffset']+16
            last_end=bank['sourceOffset']+len(payload);count+=len(expected)
        assert count==item['entryCount']<=8;entries+=count;cases.append(item)
    assert entries==154
    sample=next(r for r in writers['replays'] if r['kind']==1)
    synthetic=dict(filename=None,unitId=None,entryCount=1,syntheticKindOne=True,banks=[
        dict(bank=0,count=1,words=[1,1,1,1,*sample['words']]),dict(bank=1,count=0,words=[1,0]),dict(bank=2,count=0,words=[1,0])])
    cases.append(synthetic)
    # Interrupt a real path-bearing bank after discriminator or near its end.
    interrupted=next(c for c in capture['cases'] if any(r['filename']==c['filename'] and r['unitId']==c['unitId'] and r['kind']==4 for r in reference))
    target_index=next(r['bank'] for r in reference if r['filename']==interrupted['filename'] and r['unitId']==interrupted['unitId'] and r['kind']==4)
    target=interrupted['banks'][target_index]
    for limit in [16,len(target['words'])*4-4]:cases.append({**interrupted,'interruptBank':target['bank'],'failAtBytes':limit})
    cases.append({**synthetic,'bankDestructorOnlyControl':True})
    assert len(cases)==93
    raw=(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    if hashlib.sha256(raw).hexdigest()!=PIN:raise ValueError('Requires pinned Majesty executable')
    pe=pefile.PE(data=raw);base=pe.OPTIONAL_HEADER.ImageBase
    decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
    ranges=writer.SHARED+reader.SHARED_READERS+life.SHARED+BANK_RANGES
    for kind,leaf in writer.LEAVES.items():
        ctor_end,delete_start,delete_end,dtor_start,dtor_end=life.LIFECYCLE[kind]
        ranges.extend([(reader.READERS[kind],leaf[3]),(leaf[3],leaf[4]),(leaf[1],ctor_end),
                       (delete_start,delete_end),(dtor_start,dtor_end)])
        assert struct.unpack('<3I',pe.get_data(leaf[2]-base,12))==(delete_start,reader.READERS[kind],leaf[3])
    assert struct.unpack('<3I',pe.get_data(BANK_TABLE-base,12))==(BANK_DELETE,BANK_READ,BANK_WRITE)
    assert struct.unpack('<I',pe.get_data(BANK_TABLE+0x58-base,4))[0]==REMOVE
    assert struct.unpack('<I',pe.get_data(MANAGER_TABLE+12-base,4))[0]==life.FACTORY
    code_bytes={};boundaries=set();rows={}
    for start,end in ranges:
        code=pe.get_data(start-base,end-start);decoded=list(decoder.disasm(code,start))
        assert sum(i.size for i in decoded)==len(code)
        code_bytes[start]=code;boundaries.update(i.address for i in decoded)
        rows.update({i.address:(i.mnemonic,i.op_str) for i in decoded})
    assert rows[0x5e4fc0]==('call','0x645bc0') and rows[0x5e4fde]==('call','dword ptr [eax]')
    tables=[(BANK_TABLE,0x5c),(MANAGER_TABLE,16),(EMBEDDED_TABLE,12),*[(v[2],12) for v in writer.LEAVES.values()]]
    stubs=reader.READ_SCALARS|writer.SCALARS|{reader.RAW_READ,reader.STATUS,reader.CLEAR,reader.NAME_COPY,
                                         life.ALLOC,life.FREE,GET_MANAGER,writer.RAW,writer.CLOSE}
    pages=sorted({0,DATA,STACK,STOP,*[at&~4095 for at in stubs],*[at&~4095 for at in code_bytes],*[at&~4095 for at,_ in tables]})
    assert len(pages)*4096<=128*1024
    total=calls=peak_allocated=0;outcomes=[]
    factory_returns={v[0]+7:k for k,v in writer.LEAVES.items()}
    for poison in [0x5a,0xc3]:
        for case in cases:
            cpu=Uc(UC_ARCH_X86,UC_MODE_32);hooks=[]
            try:
                for page in pages:cpu.mem_map(page,4096)
                assert sum(end-start+1 for start,end,_ in cpu.mem_regions())==len(pages)*4096
                for at,code in code_bytes.items():cpu.mem_write(at,code)
                for at,n in tables:cpu.mem_write(at,pe.get_data(at-base,n))
                cpu.mem_write(life.JUMP_TABLE,pe.get_data(life.JUMP_TABLE-base,64))
                for at in stubs:cpu.mem_write(at,b'\xc3')
                for page in pages:
                    if page not in [0,DATA,STACK]:cpu.mem_protect(page,4096,UC_PROT_READ|UC_PROT_EXEC)
                cpu.mem_write(DATA,bytes([poison])*4096);cpu.mem_write(STACK,bytes([poison])*4096)
                cpu.mem_write(0,struct.pack('<I',SEH_MARKER));cpu.mem_write(MANAGER,struct.pack('<I',MANAGER_TABLE))
                live={};allocation_events=[];free_events=[];bank_addresses=[];observations=[];bump=0;peak=0
                phase='constructbank';bank_index=0;steps=cursor=status=0;payload=b'';emitted=bytearray();failed=False
                def inside(at,size,start,n):return start<=at and at+size<=start+n
                def owned(at,size):return any(inside(at,size,a,r['bytes']) for a,r in live.items())
                def word(at,value=None):
                    if value is not None:cpu.mem_write(at,struct.pack('<I',value&0xffffffff))
                    return struct.unpack('<I',cpu.mem_read(at,4))[0]
                def allocate(n,role,kind=None):
                    nonlocal bump,peak,peak_allocated
                    assert 0<=n<=128 and len(allocation_events)<32
                    address=DATA+bump if n else 0
                    if n:
                        bump+=(n+7)//8*8;assert bump<=2048 and address not in live
                        live[address]=dict(bytes=n,role=role,kind=kind,bank=bank_index)
                    allocation_events.append(dict(address=address,bytes=n,role=role,kind=kind,bank=bank_index))
                    peak=max(peak,sum(r['bytes'] for r in live.values()));peak_allocated=max(peak_allocated,peak);assert peak<=2048
                    return address
                def take(n):
                    nonlocal cursor,status
                    assert n>=0 and cursor+n<=len(payload)
                    if case.get('interruptBank')==bank_index and (status or cursor+n>case['failAtBytes']):status=7;return None
                    value=payload[cursor:cursor+n];cursor+=n;return value
                def destination(at,data):
                    assert owned(at,len(data)) or inside(at,len(data),STACK,4096);cpu.mem_write(at,data)
                def returned(sp,argc,value=0,cdecl=False):
                    cpu.reg_write(UC_X86_REG_EAX,value);cpu.reg_write(UC_X86_REG_ECX,0xcccccccc);cpu.reg_write(UC_X86_REG_EDX,0xdddddddd)
                    cpu.reg_write(UC_X86_REG_EIP,word(sp));cpu.reg_write(UC_X86_REG_ESP,sp+4+(0 if cdecl else argc*4))
                def code(uc,at,size,context):
                    nonlocal total,steps
                    steps+=1;sp=uc.reg_read(UC_X86_REG_ESP);assert steps<=2048 and STACK+512<=sp<=STACK+3584
                    if at in stubs:
                        if at in reader.READ_SCALARS|{reader.RAW_READ,reader.STATUS}|writer.SCALARS|{writer.RAW,writer.CLOSE}:
                            assert uc.reg_read(UC_X86_REG_ECX)==STREAM
                        if at in reader.READ_SCALARS:
                            assert phase=='readbank';value=take(4)
                            if value is not None:destination(word(sp+4),value)
                            returned(sp,1,status)
                        elif at==reader.RAW_READ:
                            assert phase=='readbank';n=word(sp+8);assert n in [12,56];value=take(n)
                            if value is not None:destination(word(sp+4),value)
                            returned(sp,2,status)
                        elif at==reader.STATUS:assert phase=='readbank';returned(sp,0,status)
                        elif at in [reader.CLEAR,reader.NAME_COPY]:
                            assert phase=='readbank';target=word(sp+4);assert owned(target,16) and word(target)==0
                            if at==reader.NAME_COPY:
                                address=word(sp+8);assert inside(address,32,STACK,4096) and bytes(cpu.mem_read(address,32))==b'\0'*32
                            destination(target,b'\0'*4);returned(sp,2 if at==reader.NAME_COPY else 1,cdecl=True)
                        elif at==GET_MANAGER:assert phase=='readbank';returned(sp,0,MANAGER)
                        elif at==life.ALLOC:
                            n,caller=word(sp+4),word(sp)
                            if caller==0x5e4c71:assert phase=='constructbank' and n==12;role,kind='head',None
                            elif caller==0x5e4dc9:assert phase=='readbank' and n==12;role,kind='node',None
                            elif caller in factory_returns:
                                kind=factory_returns[caller];assert phase=='readbank' and n==int(fresh['objectSizes'][str(kind)]);role='order'
                            else:
                                assert phase=='readbank' and caller in [0x5e2b61,0x5e0e39] and n<=80
                                receiver=uc.reg_read(UC_X86_REG_ESI);assert receiver in live and live[receiver]['role']=='order'
                                kind=live[receiver]['kind'];assert (kind==7 and n==80) or (kind==4 and n==word(receiver+92)*8);role='path'
                            returned(sp,1,allocate(n,role,kind),cdecl=True)
                        elif at==life.FREE:
                            assert phase in ['remove','deletebank','deleteorphan'];address=word(sp+4)
                            if address:
                                assert address in live, 'Unknown or duplicate bank cleanup free'
                                item=live.pop(address);free_events.append(dict(address=address,**item))
                            else:free_events.append(dict(address=0,bytes=0,role='null',kind=None,bank=bank_index))
                            assert len(free_events)<=32;returned(sp,1,cdecl=True)
                        elif at in writer.SCALARS:
                            assert phase=='writebank';emitted.extend(struct.pack('<I',word(sp+4)));returned(sp,1)
                        elif at==writer.RAW:
                            assert phase=='writebank';address,n=word(sp+4),word(sp+8);assert n in [12,56] and inside(address,n,STACK,4096)
                            emitted.extend(cpu.mem_read(address,n));returned(sp,2)
                        elif at==writer.CLOSE:assert phase=='writebank';returned(sp,0)
                        else:raise AssertionError('Unexpected bank helper')
                        assert len(emitted)<=2048;return
                    assert at in boundaries, 'Bank rollback escaped pinned functions (callbacks are unavailable)'
                    total+=1;assert total<=1000000
                def read(uc,access,at,size,value,context):
                    assert inside(at,size,STACK,4096) or inside(at,size,0,4) or owned(at,size) or inside(at,size,MANAGER,4) or \
                        inside(at,size,life.JUMP_TABLE,64) or any(inside(at,size,a,n) for a,n in tables)
                def write(uc,access,at,size,value,context):
                    assert inside(at,size,STACK,4096) or (phase!='writebank' and (inside(at,size,0,4) or owned(at,size)))
                hooks=[cpu.hook_add(UC_HOOK_CODE,code),cpu.hook_add(UC_HOOK_MEM_READ,read),cpu.hook_add(UC_HOOK_MEM_WRITE,write)]
                def invoke(entry,receiver,arg=None):
                    nonlocal steps,calls
                    steps=0;before=total;sp=STACK+3072;word(sp,STOP)
                    if arg is not None:word(sp+4,arg)
                    for reg in PRESERVED:cpu.reg_write(reg,poison*0x01010101)
                    cpu.reg_write(UC_X86_REG_ECX,receiver);cpu.reg_write(UC_X86_REG_ESP,sp);cpu.reg_write(UC_X86_REG_EFLAGS,0x202)
                    try:cpu.emu_start(entry,STOP,timeout=1000000,count=2048)
                    except Exception as error:raise RuntimeError(f'Bank {bank_index} {phase} stopped at {cpu.reg_read(UC_X86_REG_EIP):08x}, steps={steps}') from error
                    assert cpu.reg_read(UC_X86_REG_EIP)==STOP and cpu.reg_read(UC_X86_REG_ESP)==sp+(8 if arg is not None else 4)
                    assert all(cpu.reg_read(r)==poison*0x01010101 for r in PRESERVED) and word(0)==SEH_MARKER
                    calls+=1;result=cpu.reg_read(UC_X86_REG_EAX)
                    observations.append(dict(phase=phase,bank=bank_index,originalInstructions=total-before,hookSteps=steps,returnValue=result));return result
                def members(address):
                    assert address in live and live[address]['role']=='bank'
                    head=word(address+12);assert head in live and live[head]['role']=='head'
                    node=word(head);previous=head;result=[];seen=set()
                    while node!=head:
                        assert node in live and live[node]['role']=='node' and node not in seen and len(result)<8
                        seen.add(node);assert word(node+4)==previous
                        order=word(node+8);assert order in live and live[order]['role']=='order' and live[order]['bank']==live[address]['bank']
                        assert order not in result;result.append(order);previous=node;node=word(node)
                    assert word(head+4)==previous and word(address+16)==len(result);return result
                for bank_index in range(3):
                    phase='constructbank';address=allocate(20,'bank');bank_addresses.append(address)
                    assert invoke(BANK_CTOR,address,OWNER)==address and word(address)==BANK_TABLE and word(address+4)==OWNER
                    assert members(address)==[]
                for bank_index,bank in enumerate(case['banks']):
                    phase='readbank';payload=struct.pack('<'+'I'*len(bank['words']),*bank['words']);cursor=status=0
                    result=invoke(BANK_READ,bank_addresses[bank_index],STREAM)
                    current=members(bank_addresses[bank_index])
                    if result:
                        assert result==7 and case.get('interruptBank')==bank_index;failed=True;break
                    assert cursor==len(payload) and len(current)==bank['count']
                assert failed==('interruptBank' in case)
                all_members=[p for address in bank_addresses for p in members(address)]
                assert len(all_members)==len(set(all_members))
                assert set(all_members)=={a for a,r in live.items() if r['role']=='order'}
                for address in all_members:
                    assert word(address+36)==0
                    if live[address]['kind'] in [2,6]:assert word(address+76)==0
                    if live[address]['kind'] in [5,11]:assert word(address+72)==0
                if not failed and not case.get('bankDestructorOnlyControl'):
                    for bank_index,bank in enumerate(case['banks']):
                        phase='writebank';emitted=bytearray();payload=struct.pack('<'+'I'*len(bank['words']),*bank['words']);before_write=bytes(cpu.mem_read(DATA,4096))
                        assert invoke(BANK_WRITE,bank_addresses[bank_index],STREAM)==0
                        assert bytes(emitted)==payload and bytes(cpu.mem_read(DATA,4096))==before_write
                orphan_count=0
                for bank_index,address in enumerate(bank_addresses):
                    if not case.get('bankDestructorOnlyControl'):
                        phase='remove'
                        for order in list(members(address)):
                            invoke(REMOVE,address,order);assert order not in live
                            members(address)
                        assert members(address)==[]
                    phase='deletebank';assert invoke(BANK_DELETE,address,1)==address and address not in live
                if case.get('bankDestructorOnlyControl'):
                    orphans=[(a,r['kind']) for a,r in live.items() if r['role']=='order'];orphan_count=len(orphans);assert orphan_count==1
                    phase='deleteorphan'
                    for address,kind in orphans:assert invoke(life.LIFECYCLE[kind][1],address,1)==address
                assert live=={}
                detail=len(outcomes)<8 or failed or case.get('bankDestructorOnlyControl',False)
                allocation_roles={r:sum(e['role']==r for e in allocation_events) for r in ['bank','head','order','node','path']}
                outcomes.append(dict(filename=case['filename'],unitId=case['unitId'],stackPoison=poison,
                                     syntheticKindOne=case.get('syntheticKindOne',False),injectedStreamFailure=failed,
                                     failAtBytes=case.get('failAtBytes'),bankDestructorOnlyControl=case.get('bankDestructorOnlyControl',False),
                                     bankDestructorOrphans=orphan_count,sourceEntryCount=case['entryCount'],loadedEntries=len(all_members),
                                     bankRoundTripIdentical=not failed and not case.get('bankDestructorOnlyControl'),
                                     allocationEvents=allocation_events if detail else None,freeEvents=free_events if detail else None,
                                     allocationEventCount=len(allocation_events),freeEventCount=len(free_events),allocationRoles=allocation_roles,
                                     allocationEventsSha256=hashlib.sha256(json.dumps(allocation_events,sort_keys=True).encode()).hexdigest(),
                                     freeEventsSha256=hashlib.sha256(json.dumps(free_events,sort_keys=True).encode()).hexdigest(),liveAllocationBytesAfter=0,
                                     modeledAllocationBytesPeak=peak,phases=observations))
            finally:
                for hook in hooks:cpu.hook_del(hook)
                for page in pages:cpu.mem_unmap(page,4096)
                assert list(cpu.mem_regions())==[];cpu=None
    assert len(outcomes)==186
    report=dict(qualified=True,scope='literal initial-type copied bank construct/read/write/low-level removal/delete with helper models; unpublished empty-name state only',
                executableSha256=PIN,completedCalls=calls,originalInstructions=total,copiedActorsPerFill=89,copiedBanksPerFill=267,copiedEntriesPerFill=154,
                injectedFailureCases=4,bankDestructorOwnershipControls=2,outcomes=outcomes,
                mappedGuestBytesPeak=len(pages)*4096,mappedGuestBytesAfterCleanup=0,modeledAllocationBytesPeak=peak_allocated,
                sourceSha256={n:sha(ROOT/n) for n in source_names},
                dependencyEvidenceSha256={n:sha(ROOT/n) for n in [bank_name,entry_name,loaded_name,fresh_name,writer_name]},
                unpublishedInitialBankCleanupQualified=True,bankDestructorReleasesOrders=False,callbacksExecuted=False,
                positiveNameCleanupQualified=False,realAllocatorExecuted=False,worldManagerGetterExecuted=False,
                completeActorRollbackQualified=False,activeOrderMigrationQualified=False,liveHeroCrossingQualified=False,liveNativePagingQualified=False,
                gameLaunched=False,browserUsed=False,nativeBuildRun=False,crashResolved=False,goalCompleted=False)
    document=json.dumps(report,indent=2)+'\n';assert len(document.encode())<=1024*1024
    OUTPUT.write_text(document)
    print(json.dumps({k:report[k] for k in ['qualified','completedCalls','originalInstructions','copiedActorsPerFill','injectedFailureCases','mappedGuestBytesPeak','modeledAllocationBytesPeak','gameLaunched']}))


if __name__=='__main__':main()

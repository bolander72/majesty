#!/usr/bin/env python3
"""Original peer methods on guarded synthetic lists; no game/renderer/OPFS."""
import hashlib
import importlib.util
import json
from pathlib import Path
import struct

import pefile
from unicorn import (Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE, UC_HOOK_MEM_READ,
    UC_HOOK_MEM_WRITE, UC_PROT_READ, UC_PROT_EXEC)
from unicorn.x86_const import (UC_X86_REG_EAX, UC_X86_REG_EBX, UC_X86_REG_ECX,
    UC_X86_REG_EDX, UC_X86_REG_ESI, UC_X86_REG_EDI, UC_X86_REG_EBP,
    UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_EFLAGS)

ROOT = Path(__file__).resolve().parents[1]
AUDITOR = ROOT/'scripts/audit-native-listener-cache.py'
spec = importlib.util.spec_from_file_location('peer_audit', AUDITOR)
audit_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit_module)
EXE = ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
OUTPUT = ROOT/'output/native-listener-peers-emulated-observed.json'
OUTPUT.unlink(missing_ok=True)
audit = audit_module.audit(EXE)
audit_path = ROOT/'output/native-listener-cache-audit.json'
assert audit == json.loads(audit_path.read_text())
data = EXE.read_bytes()
assert hashlib.sha256(data).hexdigest() == audit_module.PIN
pe = pefile.PE(data=data)
base = pe.OPTIONAL_HEADER.ImageBase
STATE, HEAP, STACK, STOP = 0x01000000, 0x02000000, 0x03000000, 0x04000000
LINK, UNLINK, APPEND, FIRST = 0x005c2d70, 0x005c2dd0, 0x005c31e0, 0x005c3850
ALLOCATE, FREE, TABLE = 0x0064c616, 0x00645bc0, 0x0068a62c
OBJECTS = [STATE+0x100+i*0x200 for i in range(4)]
HEADS = [STATE+0x900+i*0x100 for i in range(4)]
CACHES = [STATE+0xd00+i*0x80 for i in range(4)]
MAPPINGS = [(0x005c2000, 8192), (0x0068a000, 4096), (0x0064c000, 4096),
    (0x00645000, 4096), (STATE, 4096), (HEAP, 4096), (STACK, 4096), (STOP, 4096)]
MAX_CALL_INSTRUCTIONS, MAX_TOTAL_INSTRUCTIONS, TIME_MICROS = 5000, 500000, 200000
selected = [r for r in audit['ranges'] if int(r['start'], 16) in [LINK, UNLINK, APPEND, FIRST]]
instructions = {int(i['address'], 16): i for r in selected for i in r['instructions']}
returns = {at for at, row in instructions.items() if row['mnemonic'] == 'ret'}
metrics = dict(originalInstructions=0, maxCallInstructions=0, completedCalls=0,
    modeledAllocatorCalls=0, modeledFreeCalls=0, positiveOwnedBytesHighWater=0,
    maximumStackBytesUsed=0, fixtureDisposedNegativeNodes=0,
    liveMappedGuestBytes=0, peakMappedGuestBytes=0, fixturesCreated=0, fixturesClosed=0)


def inside(at, size, start, length):
    return start <= at and at+size <= start+length


class Fixture:
    def __init__(self, poison):
        assert metrics['liveMappedGuestBytes']==0, 'Only one fixture may own mapped CPU pages'
        self.poison=poison;self.cpu=Uc(UC_ARCH_X86, UC_MODE_32)
        for at, length in MAPPINGS:
            self.cpu.mem_map(at, length)
        metrics['liveMappedGuestBytes']=sum(length for _,length in MAPPINGS)
        metrics['peakMappedGuestBytes']=max(metrics['peakMappedGuestBytes'],metrics['liveMappedGuestBytes'])
        metrics['fixturesCreated']+=1
        for at, length in MAPPINGS[:2]:
            self.cpu.mem_write(at, pe.get_data(at-base, length))
            self.cpu.mem_protect(at, length, UC_PROT_READ | UC_PROT_EXEC)
        for at in [ALLOCATE, FREE]:
            self.cpu.mem_write(at, b'\xc3')
            self.cpu.mem_protect(at & ~4095, 4096, UC_PROT_READ | UC_PROT_EXEC)
        self.cpu.mem_write(STATE, b'\xa5'*4096)
        self.cpu.mem_write(HEAP, b'\xb7'*4096)
        self.live={};self.allocations=0;self.frees=0;self.peak=0
        for i, (obj, head, cache) in enumerate(zip(OBJECTS, HEADS, CACHES)):
            self.cpu.mem_write(obj, bytes([0x30+i])*256)
            self.word(obj+8, TABLE);self.word(obj+0x10, head);self.word(obj+0x14, 0)
            self.word(head, head);self.word(head+4, head);self.word(head+8, 0)
            # Guarded opaque cache state: one embedded record and its sentinel.
            node=cache+36
            self.cpu.mem_write(cache, bytes(72))
            self.word(cache, node);self.word(cache+4, node)
            self.word(node, cache);self.word(node+4, cache);self.word(node+8, 0x0068a8e0)
            for field in range(3, 9):self.word(node+field*4, 1000+i*100+field)
            self.word(obj+0x80, 0x0068a8e8);self.word(obj+0x88, cache);self.word(obj+0x8c, 1)
        self.fixed=[bytes(self.cpu.mem_read(obj,256)) for obj in OBJECTS]
        self.cache_images=[bytes(self.cpu.mem_read(at,72)) for at in CACHES]
        self.hooks=[self.cpu.hook_add(UC_HOOK_CODE, self.code),
            self.cpu.hook_add(UC_HOOK_MEM_READ, self.read),
            self.cpu.hook_add(UC_HOOK_MEM_WRITE, self.write)]

    def word(self, at, value=None):
        if value is not None:self.cpu.mem_write(at, struct.pack('<I', value & 0xffffffff))
        return struct.unpack('<I', self.cpu.mem_read(at,4))[0]

    def allocate(self, size):
        if size != 12:raise RuntimeError('Unexpected peer allocation size')
        for slot in range(16):
            pointer=HEAP+slot*48+16
            if pointer not in self.live:
                self.live[pointer]=size;self.allocations+=1
                self.cpu.mem_write(pointer, bytes([self.poison])*size)
                self.peak=max(self.peak,len(self.live)*12)
                return pointer
        raise RuntimeError('Controlled peer arena exhausted')

    def code(self, cpu, at, size, context):
        self.call_steps+=1
        if self.call_steps > MAX_CALL_INSTRUCTIONS:raise RuntimeError('Peer call instruction limit exceeded')
        sp=cpu.reg_read(UC_X86_REG_ESP)
        if not STACK+512 <= sp <= STACK+4096-256:raise RuntimeError('Peer stack boundary exceeded')
        self.lowest_stack=min(self.lowest_stack,sp)
        if at in [ALLOCATE,FREE]:
            argument=self.word(sp+4)
            if at==ALLOCATE:
                cpu.reg_write(UC_X86_REG_EAX,self.allocate(argument));metrics['modeledAllocatorCalls']+=1
            else:
                if argument not in self.live:raise RuntimeError('Peer free outside live modeled nodes')
                del self.live[argument];self.frees+=1;metrics['modeledFreeCalls']+=1
                self.cpu.mem_write(argument,b'\xdd'*12);cpu.reg_write(UC_X86_REG_EAX,0xcccccccc)
            # Model cdecl caller-volatile clobbers as well as its return.
            cpu.reg_write(UC_X86_REG_ECX,0xcccccccc);cpu.reg_write(UC_X86_REG_EDX,0xdddddddd)
            cpu.reg_write(UC_X86_REG_EIP,self.word(sp));cpu.reg_write(UC_X86_REG_ESP,sp+4)
            return
        if at not in instructions:raise RuntimeError('Peer execution escaped original instruction boundaries')
        metrics['originalInstructions']+=1
        if metrics['originalInstructions'] > MAX_TOTAL_INSTRUCTIONS:raise RuntimeError('Peer total instruction limit exceeded')

    def read(self, cpu, access, at, size, value, context):
        ranges=[(STACK,4096),(TABLE+4,4)]
        ranges += [(obj,256) for obj in OBJECTS]+[(head,12) for head in HEADS]
        ranges += list(self.live.items())
        if not any(inside(at,size,start,length) for start,length in ranges):
            raise RuntimeError('Peer read outside live fixture ownership')

    def write(self, cpu, access, at, size, value, context):
        if inside(at,size,STACK,4096):return
        if at in [obj+0x14 for obj in OBJECTS] and size==4:
            if not 0 <= value <= 16:raise RuntimeError('Peer fixture count exceeded node budget')
            return
        if any(inside(at,size,start,12) for start in HEADS):return
        if any(inside(at,size,start,length) for start,length in self.live.items()):return
        raise RuntimeError('Peer write outside links, counts or live nodes')

    def call(self, function, receiver, peer):
        self.call_steps=0;sp=STACK+3072;self.lowest_stack=sp
        self.cpu.mem_write(STACK,bytes([self.poison])*4096)
        self.word(sp,STOP);self.word(sp+4,peer)
        pattern=self.poison*0x01010101
        preserved=[UC_X86_REG_EBX,UC_X86_REG_EBP,UC_X86_REG_ESI,UC_X86_REG_EDI]
        for reg in [UC_X86_REG_EAX,UC_X86_REG_EBX,UC_X86_REG_EDX,UC_X86_REG_ESI,UC_X86_REG_EDI,UC_X86_REG_EBP]:
            self.cpu.reg_write(reg,pattern)
        self.cpu.reg_write(UC_X86_REG_EFLAGS,0x202)
        self.cpu.reg_write(UC_X86_REG_ECX,receiver);self.cpu.reg_write(UC_X86_REG_ESP,sp)
        self.cpu.emu_start(function,STOP,timeout=TIME_MICROS,count=MAX_CALL_INSTRUCTIONS)
        if self.cpu.reg_read(UC_X86_REG_EIP)!=STOP:raise RuntimeError('Peer call did not finish within CPU/time limit')
        assert self.cpu.reg_read(UC_X86_REG_ESP)==sp+8
        assert all(self.cpu.reg_read(reg)==pattern for reg in preserved)
        metrics['completedCalls']+=1;metrics['maxCallInstructions']=max(metrics['maxCallInstructions'],self.call_steps)
        metrics['maximumStackBytesUsed']=max(metrics['maximumStackBytesUsed'],sp-self.lowest_stack)
        self.unchanged();self.fences()

    def unchanged(self):
        for obj,before in zip(OBJECTS,self.fixed):
            after=bytes(self.cpu.mem_read(obj,256))
            assert after[:0x14]==before[:0x14] and after[0x18:]==before[0x18:]
        assert [bytes(self.cpu.mem_read(at,72)) for at in CACHES]==self.cache_images

    def fences(self):
        for slot in range(16):
            start=HEAP+slot*48
            assert bytes(self.cpu.mem_read(start,16))==b'\xb7'*16
            assert bytes(self.cpu.mem_read(start+28,20))==b'\xb7'*20

    def peers(self, index):
        obj,head=OBJECTS[index],HEADS[index];node=self.word(head);previous=head;values=[]
        while node!=head:
            assert node in self.live and len(values)<16
            assert self.word(node+4)==previous
            values.append(self.word(node+8));previous=node;node=self.word(node)
        assert self.word(head+4)==previous and self.word(obj+0x14)==len(values)
        return values

    def graph(self):return [self.peers(index) for index in range(4)]

    def expect(self, edges):
        actual=self.graph()
        assert [sorted(v) for v in actual]==[sorted(OBJECTS[j] for j in peers) for peers in edges]
        assert len(self.live)==sum(len(v) for v in actual)
        return [[OBJECTS.index(value) for value in row] for row in actual]

    def dispose_negative(self):
        # Fixture disposal is not an original cleanup operation or evidence of a free.
        metrics['fixtureDisposedNegativeNodes']+=len(self.live)
        self.live.clear()

    def close(self):
        assert not self.live, 'Residual ownership requires explicit fixture disposal'
        for hook in self.hooks:self.cpu.hook_del(hook)
        self.hooks.clear()
        for at,length in MAPPINGS:self.cpu.mem_unmap(at,length)
        self.cpu=None;metrics['liveMappedGuestBytes']=0;metrics['fixturesClosed']+=1


traces=[]
for poison in [0,0xd3]:
    fixture=Fixture(poison);trace=[]
    for cycle in range(32):
        fixture.call(LINK,OBJECTS[0],OBJECTS[1]);trace.append(fixture.expect([[1],[0],[],[]]))
        fixture.call(LINK,OBJECTS[0],OBJECTS[2]);trace.append(fixture.expect([[1,2],[0],[0],[]]))
        fixture.call(LINK,OBJECTS[1],OBJECTS[2]);trace.append(fixture.expect([[1,2],[0,2],[0,1],[]]))
        before=fixture.allocations
        for _ in range(2):
            fixture.call(LINK,OBJECTS[0],OBJECTS[1]);trace.append(fixture.expect([[1,2],[0,2],[0,1],[]]))
        assert fixture.allocations==before
        fixture.call(UNLINK,OBJECTS[0],OBJECTS[1]);trace.append(fixture.expect([[2],[2],[0,1],[]]))
        fixture.call(UNLINK,OBJECTS[0],OBJECTS[2]);trace.append(fixture.expect([[],[2],[1],[]]))
        fixture.call(UNLINK,OBJECTS[1],OBJECTS[2]);trace.append(fixture.expect([[],[],[],[]]))
        assert len(fixture.live)==0
    assert fixture.allocations==fixture.frees==192 and fixture.peak==72
    metrics['positiveOwnedBytesHighWater']=max(metrics['positiveOwnedBytesHighWater'],fixture.peak)
    traces.append(trace)
    fixture.close()
assert traces[0]==traces[1]

negatives=[]
for operation in [LINK,UNLINK]:
    fixture=Fixture(0x71)
    if operation==LINK:
        fixture.call(APPEND,OBJECTS[0]+8,OBJECTS[1]);fixture.call(LINK,OBJECTS[0],OBJECTS[1])
        fixture.expect([[1],[],[],[]]);label='existing-forward-link-does-not-repair-reverse'
    else:
        fixture.call(APPEND,OBJECTS[1]+8,OBJECTS[0]);fixture.call(UNLINK,OBJECTS[0],OBJECTS[1])
        fixture.expect([[],[0],[],[]]);label='missing-forward-unlink-leaves-reverse'
    assert len(fixture.live)==1 and fixture.frees==0
    negatives.append(dict(label=label,remainingModeledNodes=1,asymmetricMembershipRemains=True))
    fixture.dispose_negative()
    fixture.close()
fixture=Fixture(0x71)
for _ in range(3):fixture.call(APPEND,OBJECTS[0]+8,OBJECTS[1])
fixture.call(APPEND,OBJECTS[1]+8,OBJECTS[0]);fixture.call(UNLINK,OBJECTS[0],OBJECTS[1])
fixture.expect([[1],[],[],[]]);assert fixture.frees==3 and len(fixture.live)==1
negatives.append(dict(label='three-forward-one-reverse-duplicate-unlink-leaves-forward',
    remainingModeledNodes=1,asymmetricMembershipRemains=True))
fixture.dispose_negative()
fixture.close()
fixture=Fixture(0xa9)
for method in [LINK,UNLINK]:fixture.call(method,OBJECTS[0],0);fixture.expect([[],[],[],[]])
assert fixture.allocations==fixture.frees==0
fixture.close()
assert metrics['fixturesCreated']==metrics['fixturesClosed']==6
assert metrics['liveMappedGuestBytes']==0 and metrics['peakMappedGuestBytes']==36864
assert hashlib.sha256(EXE.read_bytes()).hexdigest()==audit_module.PIN
sources=[Path(__file__).resolve(),AUDITOR,ROOT/'scripts/audit-native-listener-resources.py',
    ROOT/'scripts/audit-native-notification-lifetime.py',ROOT/'scripts/audit-native-placement-callbacks.py',
    ROOT/'scripts/audit-native-placement-dispatch.py']
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
report=dict(qualified=True,scope='original peer link/unlink on guarded synthetic lists with modeled allocator',
    executableSha256=audit_module.PIN,instructionAuditSha256=sha(audit_path),
    mappings=[dict(address=f'{at:08x}',bytes=length) for at,length in MAPPINGS],
    mappedGuestBytesPerFixture=sum(length for _,length in MAPPINGS),peakMappedGuestBytes=36864,
    finalMappedGuestBytes=0,fixturesExplicitlyClosed=6,cyclesPerReplay=32,poisonReplays=2,
    positiveCalls=512,positiveNodeAllocations=384,positiveNodeFrees=384,
    repeatedLinkDoesNotAllocateAnotherPeerNode=True,unrelatedPeersPreserved=True,
    opaqueCacheImagesPreserved=True,allOtherObjectFieldsPreserved=True,allocatorFencesPreserved=True,
    poisonReplayLogicalGraphsMatch=True,nullPeerCalls=2,negativeControls=negatives,
    allocatorModel='16 fixed slots, 12-byte nodes, 16-byte leading and 20-byte trailing fences; deterministic reuse',
    allocatorFailureQualified=False,negativeCasesAreNotAutomaticallyRepaired=True,
    metrics=metrics,maxCallInstructions=MAX_CALL_INSTRUCTIONS,maxTotalInstructions=MAX_TOTAL_INSTRUCTIONS,
    maxCallTimeMicros=TIME_MICROS,sourceSha256={str(p.relative_to(ROOT)):sha(p) for p in sources},
    originalInstructionsExecuted=True,fullListenerDestructionClosureQualified=False,
    actorReferenceRetentionExcluded=False,liveNativePagingQualified=False,
    browserUsed=False,gameLaunched=False,nativeBuildRun=False,originalProfilesModified=False,
    browserMemoryMeasured=False,crashResolved=False,goalCompleted=False,
    limitations='Synthetic four-object peer lists only. CRT allocation/free are modeled; negative residual nodes are disposed by the fixture, not original cleanup. Cache images are preserved opaque state, not live records or metadata ownership qualification. No dispatcher/world/actor/GPL cleanup, native engine load, worker/GPU/browser resource or live paging qualification.')
OUTPUT.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(dict(passed=True,completedOriginalCalls=metrics['completedCalls'],
    originalInstructions=metrics['originalInstructions'],peakMappedGuestBytes=report['peakMappedGuestBytes'],
    positiveOwnedBytesHighWater=72,negativeCasesWithResidualNodes=3,gameLaunches=0)))

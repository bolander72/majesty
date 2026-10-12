#!/usr/bin/env python3
"""Pinned UNIT target provenance for kinds 2,4,6,11; no native execution."""
import hashlib
import json
from pathlib import Path
import struct
import capstone
import pefile
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
OUTPUT=ROOT/'output/native-order-unit-targets-audit.json'
RANGES=[('move-writer',0x5b6df0,0x5b6e4c),('path-writer',0x5e0e90,0x5e0f4b),
        ('follow-writer',0x5e2390,0x5e2400),('action-writer',0x5e40c0,0x5e410f),
        ('move-debug',0x5b701b,0x5b702d),('path-debug',0x5e124c,0x5e125e),
        ('follow-debug',0x5e25eb,0x5e25fd),('action-debug',0x5e426b,0x5e427d),
        ('move-target-consumer',0x5b7430,0x5b7488),('path-world-prefix',0x5e1330,0x5e134d),
        ('path-target-consumer',0x5e13ca,0x5e13db),('follow-target-consumer',0x5e2680,0x5e26aa),
        ('action-order-argument',0x5e42e1,0x5e42f1),('action-target-consumer',0x5e4344,0x5e4355),
        ('unit-lookup',0x5a10d0,0x5a110c)]
ANCHORS=[(0x5b6e14,'mov','ecx, dword ptr [edi + 0x38]'),
         (0x5e0eb5,'mov','ecx, dword ptr [esi + 0x38]'),
         (0x5e23b4,'mov','ecx, dword ptr [edi + 0x38]'),
         (0x5e40e4,'mov','ecx, dword ptr [edi + 0x60]'),
         (0x5b7441,'mov','eax, dword ptr [esi + 0x38]'),(0x5b7448,'push','eax'),(0x5b7449,'call','0x5a10d0'),
         (0x5e133d,'mov','eax, dword ptr [edi + 0x84]'),(0x5e1343,'mov','dword ptr [esp + 0x40], eax'),
         (0x5e13ca,'mov','eax, dword ptr [esi + 0x38]'),(0x5e13d1,'mov','ecx, dword ptr [esp + 0x40]'),
         (0x5e13d5,'push','eax'),(0x5e13d6,'call','0x5a10d0'),
         (0x5e269f,'mov','eax, dword ptr [esi + 0x38]'),(0x5e26a4,'push','eax'),(0x5e26a5,'call','0x5a10d0'),
         (0x5e42e6,'mov','edi, dword ptr [esp + 0x20]'),
         (0x5e4344,'mov','eax, dword ptr [edi + 0x60]'),(0x5e434b,'mov','ecx, dword ptr [esp + 0x14]'),
         (0x5e434f,'push','eax'),(0x5e4350,'call','0x5a10d0'),
         (0x5a10d1,'mov','esi, dword ptr [esp + 8]'),(0x5a10d5,'test','esi, esi'),(0x5a10d7,'je','0x5a1106'),
         (0x5a10ee,'push','esi'),(0x5a10f1,'call','dword ptr [edx + 0x28]')]
LABEL_FIELDS=[(0x5b701b,0x38),(0x5e124c,0x38),(0x5e25eb,0x38),(0x5e426b,0x60)]


def main():
    OUTPUT.unlink(missing_ok=True)
    raw=(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    if hashlib.sha256(raw).hexdigest()!=PIN:raise ValueError('Requires pinned original Majesty executable')
    pe=pefile.PE(data=raw);base=pe.OPTIONAL_HEADER.ImageBase
    decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32);rows={};ranges=[]
    for label,start,end in RANGES:
        code=pe.get_data(start-base,end-start);instructions=list(decoder.disasm(code,start))
        if sum(i.size for i in instructions)!=end-start:raise ValueError('Incomplete target range: '+label)
        rows.update({i.address:i for i in instructions})
        ranges.append(dict(label=label,start=f'{start:08x}',end=f'{end:08x}',instructions=len(instructions),sha256=hashlib.sha256(code).hexdigest()))
    for address,mnemonic,operands in ANCHORS:
        i=rows[address]
        if (i.mnemonic,i.op_str)!=(mnemonic,operands):raise ValueError(f'Unexpected target anchor {address:08x}')
    for address,offset in LABEL_FIELDS:
        i=rows[address]
        if (i.mnemonic,i.op_str)!=('mov',f'ecx, dword ptr [esi + {hex(offset)}]'):raise ValueError('Unexpected labeled field')
        sequence=[];at=address
        for _ in range(6):sequence.append((rows[at].mnemonic,rows[at].op_str));at+=rows[at].size
        if sequence[2:]!=[('push','ecx'),('push','0x6c22f0'),('push','edi'),('call','0x4de240')]:raise ValueError('Unexpected target debug flow')
    if pe.get_data(0x6c22f0-base,128).split(b'\0',1)[0]!=b'\r\n _targetID: %d':raise ValueError('Unexpected target label')
    slots=[(0x68a224+0x1c,0x5b7430),(0x68add8+0x18,0x5e1330),
           (0x68ae44+0x18,0x5e2680),(0x68af24+0x18,0x5abad0)]
    for address,value in slots:
        if struct.unpack('<I',pe.get_data(address-base,4))[0]!=value:raise ValueError('Unexpected target consumer slot')
    if struct.unpack('<2I',pe.get_data(0x6ce960-base,8))!=(0x1000,0x5e42d0):raise ValueError('Unexpected action procedure registration')
    path=ROOT/'output/native-order-writers-emulated-observed.json';writers=json.loads(path.read_text())
    if not writers['qualified'] or writers['completedCalls']!=20:raise ValueError('Missing original writer evidence')
    for name,digest in writers['sourceSha256'].items():
        if hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=digest:raise ValueError('Stale original writer source')
    checks=0
    for replay in writers['replays']:
        kind=replay['kind']
        if kind not in [2,4,6,11]:continue
        word,offset=(46,0x60) if kind==11 else (25,0x38)
        if replay['words'][word]!=0x11000000+offset:raise ValueError('Original target word mapping differs')
        checks+=1
    if checks!=10:raise ValueError('Incomplete target writer coverage')
    report=dict(qualified=True,scope='UNIT target fields of kinds 2,4,6,11 only',executableSha256=PIN,
        ranges=ranges,anchors=len(ANCHORS),labels=len(LABEL_FIELDS),consumerSlots=len(slots),actionProcedure=0x1000,
        originalWriterFieldChecks=checks,fields=[dict(kind=k,bodyWord=46 if k==11 else 25,objectOffset=0x60 if k==11 else 0x38) for k in [2,4,6,11]],
        writerEvidenceSha256=hashlib.sha256(path.read_bytes()).hexdigest(),
        sourceSha256={'scripts/audit-native-order-unit-targets.py':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},
        completeReferenceClosureQualified=False,destinationBindingsQualified=False,activeOrderMigrationQualified=False,
        nativeConsumersExecuted=False,gameLaunched=False,browserUsed=False,nativeBuildRun=False,crashResolved=False)
    OUTPUT.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ['qualified','scope','anchors','labels','originalWriterFieldChecks','gameLaunched']}))


if __name__=='__main__':main()

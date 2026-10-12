#!/usr/bin/env python3
"""Pinned Queue/cProc4099 userData UNIT provenance; preserve historical audits."""
import hashlib,json,struct
from pathlib import Path
import capstone,pefile
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
OUT=ROOT/'output/native-queue-entry-target-001-audit.json'
def sha(p):
    with Path(p).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def main():
    if OUT.exists():raise ValueError('Preserve existing queue target audit')
    original=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    assert sha(original)==PIN
    pe=pefile.PE(str(original));base=pe.OPTIONAL_HEADER.ImageBase
    decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32);rows={};ranges=[]
    for label,start,end in [('embedded-writer',0x5deb00,0x5deb73),
        ('embedded-reader',0x5dea70,0x5deafa),('queue-processor',0x5e2ef0,0x5e2fd6),
        ('entry-procedure',0x5e3c70,0x5e3d0f),('queue-builder',0x5e3d10,0x5e3e01)]:
        code=pe.get_data(start-base,end-start);instructions=list(decoder.disasm(code,start))
        assert sum(i.size for i in instructions)==end-start
        rows.update({i.address:(i.mnemonic,i.op_str) for i in instructions})
        ranges.append(dict(label=label,start=f'{start:08x}',end=f'{end:08x}',
            instructions=len(instructions),sha256=hashlib.sha256(code).hexdigest()))
    anchors=[(0x5deb53,'mov','eax, dword ptr [edi + 0x1c]'),(0x5deb59,'call','0x4eed10'),
        (0x5deada,'lea','edx, [esi + 0x1c]'),(0x5deae0,'call','0x4ef790'),
        (0x5e2fa3,'or','ecx, 4'),(0x5e2fa6,'mov','dword ptr [esi + 0x18], ecx'),
        (0x5e3c77,'cmp','eax, 2'),(0x5e3c86,'mov','ecx, dword ptr [eax + 0x18]'),
        (0x5e3c89,'shr','ecx, 2'),(0x5e3c91,'mov','eax, dword ptr [eax + 0x20]'),
        (0x5e3c98,'push','eax'),(0x5e3c99,'call','0x5a10d0'),
        (0x5e3cca,'cmp','eax, dword ptr [0x6cefd4]'),(0x5e3cd6,'push','2'),
        (0x5e3cda,'lea','ecx, [esi + 0x94]'),(0x5e3ce0,'call','0x598e20'),
        (0x5e3dc3,'mov','ecx, dword ptr [ebp + 0x60]'),
        (0x5e3dc8,'mov','dword ptr [esi + 0x20], ecx'),
        (0x5e3dcb,'mov','dword ptr [esi + 0x2c], 0x1003')]
    for address,mnemonic,operands in anchors:assert rows[address]==(mnemonic,operands),hex(address)
    assert struct.unpack('<2I',pe.get_data(0x6ce978-base,8))==(4099,0x5e3c70)
    assert struct.unpack('<I',pe.get_data(0x68ae74+0x18-base,4))[0]==0x5e2ef0
    writers_name=ROOT/'output/native-order-writers-emulated-observed.json'
    writers=json.loads(writers_name.read_text());assert writers['qualified'] and writers['completedCalls']==20
    for name,h in writers['sourceSha256'].items():assert sha(ROOT/name)==h
    checks=0
    for replay in writers['replays']:
        if replay['kind']!=7:continue
        assert replay['words'][9]==0x11000020
        checks+=1
    assert checks==4
    result=dict(version=1,queueEntryTargetProvenanceQualified=True,executableSha256=PIN,
        kind=7,cProcId=4099,bodyWord=9,objectOffset=32,embeddedOffset=28,
        builderCopiesNativeUnitId=True,callbackUsesNativeUnitLookup=True,
        completedRouteSetsAdmissionFlag=True,physicalContainerKind=2,
        ranges=ranges,anchors=len(anchors),originalWriterFieldChecks=checks,
        writerEvidenceSha256=sha(writers_name),
        sourceSha256={'scripts/audit-native-queue-entry-target.py':sha(__file__)},
        destinationBindingsQualified=False,liveOrderMigrationQualified=False,
        nativeConsumerExecuted=False,browserUsed=False,nativeBuildRun=False)
    with OUT.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps({k:result[k] for k in ['queueEntryTargetProvenanceQualified','anchors','originalWriterFieldChecks','nativeConsumerExecuted']}))
if __name__=='__main__':main()

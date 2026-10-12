#!/usr/bin/env python3
"""Pinned queued-home callback reference provenance; no engine/browser launch."""
import hashlib,json,struct,sys
from pathlib import Path
import capstone,pefile
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
def main():
    assert len(sys.argv)==2
    output=Path(sys.argv[1]);assert not output.exists()
    raw=(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    assert hashlib.sha256(raw).hexdigest()==PIN
    pe=pefile.PE(data=raw);base=pe.OPTIONAL_HEADER.ImageBase
    decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
    rows={};ranges=[]
    for label,start,end in [('embedded-writer',0x5deb00,0x5deb73),
        ('home-callback',0x5e3c70,0x5e3d0f),('user-data-label',0x5deddf,0x5dedf1)]:
        code=pe.get_data(start-base,end-start);instructions=list(decoder.disasm(code,start))
        assert sum(i.size for i in instructions)==end-start
        rows.update({i.address:(i.mnemonic,i.op_str) for i in instructions})
        ranges.append(dict(label=label,start=start,end=end,instructions=len(instructions),sha256=hashlib.sha256(code).hexdigest()))
    anchors=[(0x5deb53,'mov','eax, dword ptr [edi + 0x1c]'),
        (0x5deb58,'push','eax'),(0x5deb59,'call','0x4eed10'),
        (0x5deddf,'mov','eax, dword ptr [esi + 0x1c]'),(0x5dede6,'push','0x6ceaa4'),
        (0x5e3c77,'cmp','eax, 2'),(0x5e3c86,'mov','ecx, dword ptr [eax + 0x18]'),
        (0x5e3c89,'shr','ecx, 2'),(0x5e3c8c,'test','cl, 1'),
        (0x5e3c91,'mov','eax, dword ptr [eax + 0x20]'),
        (0x5e3c98,'push','eax'),(0x5e3c99,'call','0x5a10d0')]
    for address,mnemonic,operands in anchors:assert rows[address]==(mnemonic,operands)
    assert struct.unpack('<II',pe.get_data(0x6ce960+3*8-base,8))==(0x1003,0x5e3c70)
    label=pe.get_data(0x6ceaa4-base,64).split(b'\0')[0].decode('ascii')
    assert label=='\r\n_userData: %d'
    writers_path=ROOT/'output/native-order-writers-emulated-observed.json'
    writers=json.loads(writers_path.read_text());assert writers['qualified'] and writers['executableSha256']==PIN
    for n,h in writers['sourceSha256'].items():assert hashlib.sha256((ROOT/n).read_bytes()).hexdigest()==h
    replays=[r for r in writers['replays'] if r['kind']==7]
    assert len(replays)==4 and all(r['words'][9]==0x11000020 for r in replays)
    report=dict(qualified=True,scope='Kind7 procedure1003 common user data is a native UNIT reference at completion; remote native home needs interception before lookup.',
        executableSha256=PIN,kind=7,procedureId=0x1003,procedureAddress=0x5e3c70,
        savedBodyWord=9,nativeObjectOffset=0x20,label=label,ranges=ranges,anchors=len(anchors),
        writerChecks=len(replays),writerEvidenceSha256=hashlib.sha256(writers_path.read_bytes()).hexdigest(),
        sourceSha256={'scripts/audit-native-hero-home-order.py':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},
        callbackExecuted=False,remoteHomeInterceptionQualified=False,nativeActivationQualified=False,
        browserUsed=False,nativeProcessesStarted=0,goalComplete=False)
    with output.open('x') as f:json.dump(report,f,indent=2);f.write('\n')
    print(json.dumps({k:report[k] for k in ['qualified','savedBodyWord','nativeObjectOffset','anchors','writerChecks','callbackExecuted']}))
if __name__=='__main__':main()

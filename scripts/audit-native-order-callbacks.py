#!/usr/bin/env python3
"""Static callback layouts and base script-agent provenance; no game execution."""
import hashlib
import json
from pathlib import Path
import struct
import capstone
import pefile

ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
OUTPUT=ROOT/'output/native-order-callbacks-audit.json'
RANGES=[('embedded-writer',0x5deb00,0x5deb73),('token-writer',0x5ae440,0x5ae48f),
        ('token-reader',0x5ae490,0x5ae4f1),('base-debug',0x5ded60,0x5dee20),
        ('move-debug',0x5b6ff0,0x5b70b0),('animate-debug',0x5aba10,0x5abac1),
        ('follow-debug',0x5e25c0,0x5e2671),('base-script-stop',0x5def50,0x5def70),
        ('runtime-getter',0x623b20,0x623b29),('script-stop',0x623850,0x62386c),
        ('agent-lookup',0x6236b0,0x6236c0),('manager-lookup',0x633090,0x6330df),
        ('bank-cproc-dispatch',0x5e5300,0x5e534a),('cproc-lookup',0x5da070,0x5da094)]
ANCHORS=[(0x5deb5f,'lea','ecx, [edi + 0x20]'),(0x5deb62,'call','0x5ae440'),
         (0x5ae44f,'call','0x501850'),(0x5ae454,'mov','ecx, dword ptr [esi + 8]'),
         (0x5ae457,'mov','edx, dword ptr [esi + 0xc]'),(0x5ae45a,'mov','esi, dword ptr [esi]'),
         (0x5ae45c,'mov','dword ptr [esp + 4], ecx'),(0x5ae462,'mov','dword ptr [esp + 8], edx'),
         (0x5ae468,'push','0x20'),(0x5ae46a,'lea','eax, [esp + 0x20]'),
         (0x5ae470,'call','0x5231f0'),(0x5ae478,'lea','ecx, [esp + 4]'),
         (0x5ae47c,'push','0x38'),(0x5ae483,'call','0x4eef60'),
         (0x5ae4bd,'push','0x38'),(0x5ae4c0,'call','0x4ef700'),
         (0x5ae4d7,'mov','dword ptr [esi + 8], ecx'),(0x5ae4dc,'mov','dword ptr [esi + 0xc], edx'),
         (0x5def50,'cmp','dword ptr [esp + 0xc], 1'),
         (0x5def57,'mov','eax, dword ptr [ecx + 0x30]'),(0x5def5e,'push','eax'),
         (0x5def5f,'call','0x623b20'),(0x5def64,'mov','ecx, eax'),(0x5def66,'call','0x623850'),
         (0x623b25,'mov','eax, dword ptr [eax + 0x10]'),
         (0x623854,'mov','ecx, dword ptr [ecx + 4]'),(0x623858,'call','0x633090'),
         (0x623861,'mov','byte ptr [eax + 0x30], 0'),(0x623865,'mov','byte ptr [eax + 0x31], 1'),
         (0x6236b4,'mov','ecx, dword ptr [ecx + 4]'),(0x6236b8,'call','0x633090'),
         (0x6330ce,'mov','eax, dword ptr [eax + 0x10]'),
         (0x5e5308,'mov','eax, dword ptr [edi + 8]'),(0x5e530f,'call','0x5da280'),
         (0x5e5314,'mov','ecx, dword ptr [edi + 8]'),(0x5e531c,'call','dword ptr [edx + 4]'),
         (0x5e5339,'call','eax'),(0x5da07e,'cmp','dword ptr [eax], edx'),
         (0x5da08e,'mov','eax, dword ptr [eax + 4]')]
LABELS=[(0x5dedf1,0x28,0x6cea8c,b'\r\n_callback.cProcID: %d'),
        (0x5dee03,0x2c,0x6cea70,b'\r\n_callback.scriptID: %d'),
        (0x5b7081,0x54,0x6ce3c0,b'\r\n _missileCallback.cProcID: %d'),
        (0x5b7093,0x58,0x6ce39c,b'\r\n _missileCallback.scriptID: %d'),
        (0x5aba83,0x50,0x6ce158,b'\r\n _markerCallback.cProcID: %d'),
        (0x5aba95,0x54,0x6ce138,b'\r\n _markerCallback.scriptID: %d'),
        (0x5e2645,0x54,0x6cee74,b'\r\n _followCallback.cProcID: %d'),
        (0x5e2657,0x58,0x6cee54,b'\r\n _followCallback.scriptID: %d')]


def main():
    OUTPUT.unlink(missing_ok=True)
    raw=(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    if hashlib.sha256(raw).hexdigest()!=PIN:raise ValueError('Requires pinned Majesty executable')
    pe=pefile.PE(data=raw);base=pe.OPTIONAL_HEADER.ImageBase
    decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32);rows={};ranges=[]
    for label,start,end in RANGES:
        code=pe.get_data(start-base,end-start);instructions=list(decoder.disasm(code,start))
        if sum(i.size for i in instructions)!=end-start:raise ValueError('Incomplete range: '+label)
        rows.update({i.address:i for i in instructions})
        ranges.append(dict(label=label,start=f'{start:08x}',end=f'{end:08x}',instructions=len(instructions),sha256=hashlib.sha256(code).hexdigest()))
    for address,mnemonic,operands in ANCHORS:
        i=rows[address]
        if (i.mnemonic,i.op_str)!=(mnemonic,operands):raise ValueError(f'Unexpected callback anchor {address:08x}')
    for address,offset,fmt,expected in LABELS:
        i=rows[address]
        if i.mnemonic!='mov' or not i.op_str.endswith(f'dword ptr [esi + {hex(offset)}]'):
            raise ValueError('Unexpected callback debug field')
        # Verify field -> pushed register -> format -> stream -> formatter flow.
        start=address;sequence=[]
        for _ in range(6):sequence.append(rows[start]);start+=rows[start].size
        register=i.op_str.split(',')[0]
        if [(i.mnemonic,i.op_str) for i in sequence[2:]]!=[('push',register),('push',hex(fmt)),('push','edi'),('call','0x4de240')]:
            raise ValueError('Unexpected callback debug formatting flow')
        if pe.get_data(fmt-base,128).split(b'\0',1)[0]!=expected:raise ValueError('Unexpected callback label')
    slots=[(0x68acf8+0x14,0x5ded60),(0x68a224+0x14,0x5b6ff0),
           (0x689d74+0x14,0x5aba10),(0x68ae44+0x14,0x5e25c0),
           (0x683148+0x44,0x5e5300),(0x68ac14+4,0x5da070)]
    for at,value in slots:
        if struct.unpack('<I',pe.get_data(at-base,4))[0]!=value:raise ValueError('Unexpected callback virtual slot')
    writer_path=ROOT/'output/native-order-writers-emulated-observed.json';writers=json.loads(writer_path.read_text())
    if not writers['qualified'] or writers['completedCalls']!=20:raise ValueError('Missing original writer evidence')
    for name,digest in writers['sourceSha256'].items():
        if hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=digest:raise ValueError('Stale writer source')
    checks=0
    for replay in writers['replays']:
        kind=replay['kind'];parts=[(11 if kind==11 else 10,0x2c,0x30)]
        if kind in [2,6]:parts.append((30,0x54,0x58))
        if kind==5:parts.append((29,0x50,0x54))
        if kind==11:parts.append((30,0x50,0x54))
        for word,proc,script in parts:
            token=replay['words'][word:word+14]
            if token!=[0x11000000+proc,0x11000000+script]+[0]*12:
                raise ValueError('Original token layout differs from reader')
            checks+=1
    if checks!=28:raise ValueError('Incomplete original token replay coverage')
    report=dict(qualified=True,scope='callback layouts and base script-agent field only',executableSha256=PIN,
        ranges=ranges,anchors=len(ANCHORS),labels=len(LABELS),virtualSlots=len(slots),originalTokenReplayChecks=checks,
        baseScriptAgentProvenanceQualified=True,leafScriptAgentProvenanceQualified=False,
        writerEvidenceSha256=hashlib.sha256(writer_path.read_bytes()).hexdigest(),
        sourceSha256={'scripts/audit-native-order-callbacks.py':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},
        allOrderReferencesQualified=False,activeOrderMigrationQualified=False,orderReaderRestoreQualified=False,
        positiveNameCopyExecuted=False,gameLaunched=False,browserUsed=False,nativeBuildRun=False,crashResolved=False)
    OUTPUT.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ['qualified','scope','anchors','labels','originalTokenReplayChecks','gameLaunched']}))


if __name__=='__main__':main()

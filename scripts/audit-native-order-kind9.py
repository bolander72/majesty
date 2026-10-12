#!/usr/bin/env python3
"""Pinned kind9 base-only writer and two bounded CPU replays; no game launch."""
import contextlib,hashlib,importlib.util,io,json,struct
from pathlib import Path
import capstone,pefile
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
OUT=ROOT/'output/native-order-kind9-audit-observed.json'
def main():
    if OUT.exists():raise ValueError('Preserve prior kind9 audit')
    raw=(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
    if hashlib.sha256(raw).hexdigest()!=PIN:raise ValueError('Require pinned executable')
    pe=pefile.PE(data=raw);base=pe.OPTIONAL_HEADER.ImageBase;decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
    ranges=[];instructions={}
    for label,start,end in [('factory',0x5da6b6,0x5da6ec),('constructor',0x5df030,0x5df042),
        ('writer',0x5df0b0,0x5df0d5),('base-writer',0x5deec0,0x5deee7),('embedded-writer',0x5deb00,0x5deb73)]:
        code=pe.get_data(start-base,end-start);rows=list(decoder.disasm(code,start))
        assert sum(i.size for i in rows)==end-start
        instructions.update({i.address:(i.mnemonic,i.op_str) for i in rows})
        ranges.append(dict(label=label,start=f'{start:08x}',end=f'{end:08x}',sha256=hashlib.sha256(code).hexdigest(),instructions=len(rows)))
    anchors=[(0x5da6b6,'push','0x34'),(0x5da6d6,'call','0x5df030'),(0x5df033,'call','0x5dee20'),
      (0x5df038,'mov','dword ptr [esi], 0x68ad44'),(0x5df0b8,'push','1'),(0x5df0bc,'call','0x4eed10'),
      (0x5df0c4,'call','0x5deec0'),(0x5df0cb,'call','0x4eeb50'),(0x5df0d2,'ret','4')]
    for at,mnemonic,operands in anchors:assert instructions[at]==(mnemonic,operands)
    assert struct.unpack('<I',pe.get_data(0x5da870+8*4-base,4))[0]==0x5da6b6
    assert struct.unpack('<I',pe.get_data(0x68ad44+8-base,4))[0]==0x5df0b0
    label=pe.get_data(0x6ceb30-base,128).split(b'\0',1)[0].decode('ascii')
    # Reuse the existing bounded sandbox with a kind9-only case configuration.
    # Its old hardcoded summary counts are diagnostic only; normalize from the
    # actual two replays below and bind BOTH harness and audit source hashes.
    path=ROOT/'scripts/check-native-order-writers.py';spec=importlib.util.spec_from_file_location('writers',path)
    writers=importlib.util.module_from_spec(spec);spec.loader.exec_module(writers)
    writers.LEAVES={9:(0x5da6b6,0x5df030,0x68ad44,0x5df0b0,0x5df0d5,96)};writers.CASES=[(9,0)]
    writers.OUTPUT=ROOT/'output/native-order-kind9-writer-raw-observed.json'
    if writers.OUTPUT.exists():raise ValueError('Preserve prior kind9 replays')
    with contextlib.redirect_stdout(io.StringIO()):writers.main()
    replay=json.loads(writers.OUTPUT.read_text());rows=replay['replays']
    assert len(rows)==2 and {r['stackPoison'] for r in rows}=={0x5a,0xc3}
    assert rows[0]['words']==rows[1]['words'] and all(r['kind']==9 and r['fixedBytes']==96 and r['payloadBytes']==96 and r['words'][:4]==[1,1,2,9] for r in rows)
    assert replay['mappedGuestBytesAfterCleanup']==0 and replay['mappedGuestBytesPeak']<=65536
    result=dict(qualified=True,scope='Kind9 writer serializes leaf version1 plus only the shared base/embedded command body; no leaf UNIT target field. Null external token pointer replays; general opaque/callback reference closure unqualified.',
      executableSha256=PIN,kind=9,label=label,objectBytes=52,table='0068ad44',writer='005df0b0',fixedBodyBytes=96,leafVersion=1,
      completedCalls=len(rows),originalInstructions=sum(r['originalInstructions'] for r in rows),mappedGuestBytesPeak=replay['mappedGuestBytesPeak'],mappedGuestBytesAfterCleanup=0,
      ranges=ranges,anchors=len(anchors),replays=rows,noLeafUnitTargetField=True,completeReferenceClosureQualified=False,
      sourceSha256={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [Path(__file__),path]},
      gameLaunched=False,browserUsed=False,nativeBuildRun=False)
    with OUT.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps({k:result[k] for k in ['qualified','kind','label','fixedBodyBytes','completedCalls','originalInstructions','mappedGuestBytesPeak','gameLaunched']}))
if __name__=='__main__':main()

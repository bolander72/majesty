#!/usr/bin/env python3
"""Check pinned original ORDR attachment ownership, independent of record ordinal."""
import argparse,hashlib,json,struct
from pathlib import Path
import capstone
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
READER=(0x5b1cf0,0x5b1dc8)
WRITER=(0x5b1ee8,0x5b1f1c)
def reader(raw):
    decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
    rows=list(decoder.disasm(raw,READER[0]));assert len(rows)==71 and sum(i.size for i in rows)==len(raw)==216
    instructions={i.address:(i.mnemonic,i.op_str) for i in rows}
    required={0x5b1d31:('mov','ecx, dword ptr [edi + 4]'),0x5b1d34:('lea','edx, [esp + 0x14]'),
      0x5b1d38:('push','edx'),0x5b1d39:('call','0x4ef740'),0x5b1d42:('mov','eax, dword ptr [esp + 0x14]'),
      0x5b1d46:('mov','ecx, ebp'),0x5b1d48:('push','eax'),0x5b1d49:('call','0x5a10d0'),
      0x5b1d4e:('mov','ebp, eax'),0x5b1d9a:('push','ebp'),0x5b1d9f:('call','0x5c1f30')}
    for address,value in required.items():assert instructions[address]==value
    assert [i.op_str for i in rows if i.mnemonic=='call']==['0x4ef740','0x5a10d0','0x4ee840','0x5c1f30']
    return [{'address':hex(at),'mnemonic':value[0],'operands':value[1]} for at,value in required.items()]
def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    if args.output.exists():raise ValueError('Preserve previous static audit')
    path=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe';before=path.stat();h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(4096),b''):h.update(b)
        assert h.hexdigest()==PIN;f.seek(0);header=f.read(4096)
        assert header[:2]==b'MZ';pe=struct.unpack_from('<I',header,60)[0];assert header[pe:pe+4]==b'PE\0\0'
        count=struct.unpack_from('<H',header,pe+6)[0];opt=struct.unpack_from('<H',header,pe+20)[0]
        assert struct.unpack_from('<H',header,pe+4)[0]==0x14c and struct.unpack_from('<H',header,pe+24)[0]==0x10b
        base=struct.unpack_from('<I',header,pe+52)[0];assert base==0x400000 and count<=16
        sections=[struct.unpack_from('<IIII',header,pe+24+opt+40*i+8) for i in range(count)]
        def code(start,end):
            for virtual_size,rva,size,offset in sections:
                if rva<=start-base and end-base<=rva+size:
                    f.seek(offset+start-base-rva);raw=f.read(end-start);assert len(raw)==end-start;return raw
            raise ValueError('Instruction range escaped original section')
        raw=code(*READER);evidence=reader(raw);writer_raw=code(*WRITER)
        decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
        ins={i.address:(i.mnemonic,i.op_str) for i in decoder.disasm(writer_raw,WRITER[0])}
        assert ins[0x5b1ef9]==('mov','ecx, dword ptr [esi + 0x60]')
        assert ins[0x5b1efc]==('push','ecx') and ins[0x5b1f00]==('call','0x4eec70')
    after=path.stat();assert (before.st_ino,before.st_size,before.st_mtime_ns)==(after.st_ino,after.st_size,after.st_mtime_ns)
    controls=[]
    for name,at,value in [('wrong lookup key register',0x5b1d48,0x51),('wrong resolved owner',0x5b1d9a,0x50),('changed unit getter target',0x5b1d4a,raw[0x5b1d4a-READER[0]]^1)]:
        bad=bytearray(raw);bad[at-READER[0]]=value
        try:reader(bad)
        except AssertionError:controls.append(name)
        else:raise AssertionError('Contradictory attachment keying accepted')
    result=dict(qualified=True,version=1,scope='Static pinned original ORDR root-reader resolves each saved Unit+60 ID with005a10d0 and passes that resolved unit to005c1f30. The ordinal only bounds iteration. This is keying evidence, not a complete emulation of command readers or browser residency.',
      originalExecutableSha256=PIN,reader=dict(start=READER[0],end=READER[1],instructions=71,sha256=hashlib.sha256(raw).hexdigest(),keyingInstructions=evidence),
      writer=dict(start=WRITER[0],end=WRITER[1],sha256=hashlib.sha256(writer_raw).hexdigest()),contradictoryInstructionControls=controls,
      scriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),largestRead=4096,browserUsed=False,nativeProcessesStarted=0)
    with args.output.open('x') as f:f.write(json.dumps(result,indent=2)+'\n')
    print(json.dumps(dict(qualified=True,readerInstructions=71,controls=len(controls),largestRead=4096)))
if __name__=='__main__':main()

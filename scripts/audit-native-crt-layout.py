#!/usr/bin/env python3
"""Audit the pinned original CRT small-block page and boundary-tag walk."""
import argparse,hashlib,json,struct
from pathlib import Path
import capstone
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
FRAGMENTS={
 'originalSmallBlockPageWalk':(0x655524,0x6555d7,{
  0x655529:('lea','edx, [eax + 0xffc]'),0x655536:('lea','esi, [edx - 0xff0]'),
  0x655542:('cmp','dword ptr [edx], -1'),0x65554b:('mov','ecx, dword ptr [esi]'),
  0x65554d:('test','cl, 1'),0x655554:('dec','ecx'),0x655555:('cmp','ecx, 0x400'),
  0x655561:('inc','dword ptr [ebp - 4]'),0x655582:('cmp','ecx, 0x10'),
  0x65558b:('test','cl, 0xf'),0x655594:('cmp','ecx, 0xff0'),
  0x6555a0:('cmp','dword ptr [ecx + esi - 4], edi'),0x6555ad:('mov','esi, eax'),
  0x6555af:('cmp','esi, edx'),0x6555b9:('add','edx, 0x1000'),0x6555c0:('cmp','ebx, 8'),
  0x6555cf:('cmp','dword ptr [esi], eax')}),
}

def audit(raw,start,required):
 rows=list(capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32).disasm(raw,start))
 assert sum(i.size for i in rows)==len(raw)
 decoded={i.address:(i.mnemonic,i.op_str) for i in rows}
 for address,value in required.items():assert decoded[address]==value,(hex(address),decoded.get(address),value)
 return dict(start=start,end=start+len(raw),instructions=len(rows),sha256=hashlib.sha256(raw).hexdigest(),
   requiredInstructions=[dict(address=hex(at),mnemonic=v[0],operands=v[1]) for at,v in required.items()])
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 if a.output.exists():raise ValueError('Preserve earlier audit')
 path=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe';before=path.stat();h=hashlib.sha256();evidence={};controls=[]
 with path.open('rb') as f:
  for chunk in iter(lambda:f.read(4096),b''):h.update(chunk)
  assert h.hexdigest()==PIN;f.seek(0);header=f.read(4096);assert header[:2]==b'MZ'
  pe=struct.unpack_from('<I',header,60)[0];assert header[pe:pe+4]==b'PE\0\0'
  count=struct.unpack_from('<H',header,pe+6)[0];opt=struct.unpack_from('<H',header,pe+20)[0]
  assert struct.unpack_from('<H',header,pe+4)[0]==0x14c and struct.unpack_from('<H',header,pe+24)[0]==0x10b
  base=struct.unpack_from('<I',header,pe+52)[0];assert base==0x400000 and count<=16
  sections=[struct.unpack_from('<IIII',header,pe+24+opt+40*i+8) for i in range(count)]
  for name,(start,end,required) in FRAGMENTS.items():
   section=next(s for s in sections if s[1]<=start-base and end-base<=s[1]+s[2]);f.seek(section[3]+start-base-section[1]);raw=f.read(end-start)
   assert len(raw)==end-start;evidence[name]=audit(raw,start,required)
   for label,at in [('allocation-size ceiling',0x655557),('size alignment',0x65558d),('boundary footer',0x6555a0),('page stride',0x6555bb)]:
    bad=bytearray(raw);bad[at-start]^=1
    try:audit(bad,start,required)
    except AssertionError:controls.append(dict(fragment=name,condition=label,changedAddress=hex(at),refused=True))
    else:raise AssertionError('Changed page-layout instruction accepted')
 after=path.stat();assert (before.st_ino,before.st_size,before.st_mtime_ns)==(after.st_ino,after.st_size,after.st_mtime_ns)
 result=dict(qualified=True,version=1,scope='Pinned original0065545f walks eight4KiB pages per committed32KiB group, starts blocks at page+c, checks allocated bit,16-byte size alignment, allocation size<=1024, matching boundary tags, and group allocation count. This is layout evidence, not a complete free-list audit or safe trim.',
   originalExecutableSha256=PIN,fragments=evidence,contradictoryInstructionControls=controls,largestRead=4096,
   scriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),browserUsed=False,nativeProcessesStarted=0)
 with a.output.open('x') as f:f.write(json.dumps(result,indent=2)+'\n')
 print(json.dumps(dict(qualified=True,fragments=len(evidence),controls=len(controls))))
if __name__=='__main__':main()

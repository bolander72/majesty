#!/usr/bin/env python3
"""Audit original idle TILE release, manager arguments and policy refusal."""
import argparse,hashlib,json,struct
from pathlib import Path
import capstone
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
FRAGMENTS={
 'arrayCookie':(0x55a433,0x55a469,{0x55a433:('lea','eax, [ebx + ebx*2]'),0x55a436:('shl','eax, 4'),0x55a439:('add','eax, 4'),0x55a43d:('call','0x64c616'),0x55a45b:('lea','esi, [eax + 4]'),0x55a462:('mov','dword ptr [eax], ebx'),0x55a464:('call','0x64d2c1')}),
 'idleGuard':(0x5274be,0x5274ef,{
  0x5274c4:('mov','eax, dword ptr [esi + 0x10]'),0x5274cb:('mov','eax, dword ptr [esi + 0x14]'),
  0x5274d0:('jne','0x5274e8'),0x5274dd:('push','2'),0x5274e5:('call','dword ptr [edx + 0x64]'),0x5274ec:('ret','0xc')}),
 'releaseArguments':(0x527c60,0x527c9d,{
  0x527c7c:('mov','edi, dword ptr [eax]'),0x527c7e:('mov','ebx, dword ptr [eax + 8]'),
  0x527c8e:('push','2'),0x527c90:('push','esi'),0x527c91:('push','ecx'),
  0x527c92:('push','edi'),0x527c93:('push','ebx'),0x527c96:('call','dword ptr [edx + 0x64]')}),
 'managerDispatch':(0x4f73a0,0x4f7415,{
  0x4f73a5:('mov','edi, dword ptr [esp + 0x14]'),0x4f73ac:('call','dword ptr [eax + 0x54]'),
  0x4f73c3:('call','dword ptr [0x67f094]'),0x4f73ec:('call','dword ptr [edx + 0x1c]'),
  0x4f73ff:('call','dword ptr [0x67f098]'),0x4f740a:('ret','0x1c')}),
 'tilePolicy':(0x52a116,0x52a17d,{
  0x52a11d:('cmp','dword ptr [edi + 0x10], ebx'),0x52a129:('mov','esi, dword ptr [edx + 0xc]'),
  0x52a139:('push','1'),0x52a13f:('call','dword ptr [eax + 0x48]'),
  0x52a142:('cmp','eax, 1'),0x52a147:('cmp','eax, 2'),0x52a14e:('jmp','0x52a201')}),
 'tileDestroy':(0x52a18c,0x52a1eb,{
  0x52a1ab:('mov','dword ptr [ebp + 4], ebx'),0x52a1b7:('call','dword ptr [eax + 8]'),
  0x52a1de:('call','0x527a40'),0x52a1e3:('mov','dword ptr [esp + 0x14], 1')})}

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
   at=next(iter(required))
   bad=bytearray(raw);bad[at-start]^=1
   try:audit(bad,start,required)
   except AssertionError:controls.append(dict(fragment=name,changedAddress=hex(at),refused=True))
   else:raise AssertionError('Changed buffer ownership instruction accepted')

 after=path.stat();assert (before.st_ino,before.st_size,before.st_mtime_ns)==(after.st_ino,after.st_size,after.st_mtime_ns)
 result=dict(qualified=True,version=1,scope='Pinned original zero-reference idle guard, manager action2 dispatch, original TILE policy refusal and destructor/reset path. Static byte evidence does not qualify live resource release or memory bounds.', originalExecutableSha256=PIN,fragments=evidence,contradictoryInstructionControls=controls,largestRead=4096,scriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),browserUsed=False,nativeProcessesStarted=0)
 with a.output.open('x') as f:f.write(json.dumps(result,indent=2)+'\n')
 print(json.dumps(dict(qualified=True,fragments=len(evidence),controls=len(controls))))
if __name__=='__main__':main()

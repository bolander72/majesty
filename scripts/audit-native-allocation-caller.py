#!/usr/bin/env python3
"""Audit the pinned original large allocation and outer caller stack layout."""
import argparse,hashlib,json,struct
from pathlib import Path
import capstone
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
FRAGMENTS={
 'operatorNew':(0x64c616,0x64c624,{
  0x64c616:('push','1'),0x64c618:('push','dword ptr [esp + 8]'),
  0x64c61c:('call','0x64d5b1'),0x64c623:('ret','')}),
 'newHandlerMalloc':(0x64d5b1,0x64d5dd,{
  0x64d5b8:('push','dword ptr [esp + 4]'),0x64d5bc:('call','0x64d5dd'),
  0x64d5c1:('test','eax, eax'),0x64d5c6:('cmp','dword ptr [esp + 8], eax'),
  0x64d5d0:('call','0x656005'),0x64d5dc:('ret','')}),
 'originalHeapAlloc':(0x64d5dd,0x64d6d9,{
  0x64d600:('mov','eax, dword ptr [0x723a8c]'),0x64d605:('cmp','eax, 3'),
  0x64d60a:('mov','esi, dword ptr [ebp + 8]'),0x64d626:('call','0x654be3'),
  0x64d6ac:('mov','eax, dword ptr [ebp + 8]'),0x64d6b6:('add','eax, 0xf'),
  0x64d6b9:('and','al, 0xf0'),0x64d6bb:('push','eax'),0x64d6bc:('push','0'),
  0x64d6be:('push','dword ptr [0x723a88]'),0x64d6c4:('call','dword ptr [0x67f1d8]'),
  0x64d6d8:('ret','')})}

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
   at={'operatorNew':0x64c61d,'newHandlerMalloc':0x64d5bd,'originalHeapAlloc':0x64d6b8}[name]
   bad=bytearray(raw);bad[at-start]^=1
   try:audit(bad,start,required)
   except AssertionError:controls.append(dict(fragment=name,changedAddress=hex(at),refused=True))
   else:raise AssertionError('Changed allocation/caller instruction accepted')

 after=path.stat();assert (before.st_ino,before.st_size,before.st_mtime_ns)==(after.st_ino,after.st_size,after.st_mtime_ns)
 result=dict(qualified=True,version=1,scope='Pinned operator_new pushes size and new-handler flag, _nh_malloc calls _heap_alloc, and large mode3 allocations round up to16 before HeapAlloc. Caller at entry stack+20 is identified only when wrapper return PCs and all three size arguments match. This does not identify ownership, realloc/calloc paths or safe freeing.',
   originalExecutableSha256=PIN,fragments=evidence,contradictoryInstructionControls=controls,largestRead=4096,
   scriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),browserUsed=False,nativeProcessesStarted=0)
 with a.output.open('x') as f:f.write(json.dumps(result,indent=2)+'\n')
 print(json.dumps(dict(qualified=True,fragments=len(evidence),controls=len(controls))))
if __name__=='__main__':main()

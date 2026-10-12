#!/usr/bin/env python3
"""Audit pinned original nullable script registries and batch/value distinction."""
import argparse,hashlib,json,struct
from pathlib import Path
import capstone
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
FRAGMENTS={
 'registryReconstruction':(0x62868d,0x6287cb,{
  0x62868d:('mov','eax, dword ptr [esi + 0x10]'),
  0x62869b:('call','dword ptr [edx]'),0x6286ab:('call','dword ptr [edx]'),
  0x6286bb:('call','dword ptr [edx]'),0x6286cb:('call','dword ptr [edx]'),0x6286db:('call','dword ptr [edx]'),
  0x6286f9:('call','0x631860'),0x62870e:('mov','dword ptr [ecx + 8], eax'),
  0x62872b:('call','0x63ffa0'),0x62873d:('mov','dword ptr [edx + 0xc], eax'),
  0x62875a:('call','0x61bc30'),0x62876c:('mov','dword ptr [ecx + 0x10], eax'),
  0x628789:('call','0x63d9f0'),0x62879b:('mov','dword ptr [edx + 0x14], eax'),
  0x6287b8:('call','0x62c080'),0x6287c8:('mov','dword ptr [ecx + 0x18], eax')}),
 'registryInitialization':(0x628a96,0x628adf,{
  0x628a96:('call','0x623b20'),0x628a9e:('xor','esi, esi'),
  0x628aaa:('call','dword ptr [edx]'),0x628aac:('call','0x623b20'),
  0x628ab1:('mov','dword ptr [eax + 0x10], esi'),0x628ab4:('call','0x623b20'),
  0x628ac6:('call','dword ptr [edx]'),0x628ac8:('call','0x623b20'),
  0x628acf:('mov','dword ptr [eax + 0xc], esi')}),
 'typeOneBatchCreation':(0x62ac80,0x62ad0e,{
  0x62ac8b:('call','0x64c616'),0x62aca9:('lea','ebp, [eax + 4]'),
  0x62acac:('push','esi'),0x62acad:('push','0xc'),0x62acb0:('mov','dword ptr [eax], esi'),
  0x62acb2:('call','0x64d2c1'),0x62acc1:('mov','ebx, ebp'),
  0x62accd:('push','1'),0x62acd2:('mov','dword ptr [esp + 0x74], ebx'),
  0x62acd6:('call','0x62bc80'),0x62acdb:('add','ebx, 0xc'),
  0x62acf4:('jl','0x62acc5'),0x62acf6:('mov','dword ptr [esp + 0x14], ebp'),
  0x62ad03:('push','1'),0x62ad05:('mov','edx, dword ptr [ecx + 8]'),0x62ad09:('call','0x62bc80')})}
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
   at={'registryInitialization':0x628ab3,'typeOneBatchCreation':0x62acb1,'registryReconstruction':0x628710}[name]
   bad=bytearray(raw);bad[at-start]^=1
   try:audit(bad,start,required)
   except AssertionError:controls.append(dict(fragment=name,changedAddress=hex(at),refused=True))
   else:raise AssertionError('Changed allocation/zeroing instruction accepted')
 after=path.stat();assert (before.st_ino,before.st_size,before.st_mtime_ns)==(after.st_ino,after.st_size,after.st_mtime_ns)
 result=dict(qualified=True,version=1,scope='Pinned original00628670 deletes and reconstructs runtime+8 through+18 while leaving+1c intact;006289e0 deletes and zeros runtime+c and+10. The type1 allocation inserts each12-byte value in its free list, but inserts the batch base once in the master vector. This does not measure all pool storage or qualify safe trimming.',
   originalExecutableSha256=PIN,fragments=evidence,contradictoryInstructionControls=controls,largestRead=4096,
   scriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),browserUsed=False,nativeProcessesStarted=0)
 with a.output.open('x') as f:f.write(json.dumps(result,indent=2)+'\n')
 print(json.dumps(dict(qualified=True,fragments=len(evidence),controls=len(controls))))
if __name__=='__main__':main()

#!/usr/bin/env python3
"""Audit original queue frame and empty-buffer installation for page context."""
import argparse,hashlib,json,struct
from pathlib import Path
import capstone
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
FRAGMENTS={
 'queuePrologue':(0x49ff10,0x49ff39,{
  0x49ff10:('sub','esp, 0x10'),0x49ff13:('push','ebx'),0x49ff14:('push','esi'),
  0x49ff15:('mov','esi, ecx'),0x49ff17:('push','edi'),
  0x49ff18:('mov','eax, dword ptr [esi + 0x2c]'),0x49ff1d:('je','0x4a0090'),
  0x49ff2b:('je','0x4a0090')}),
 'queueEmptyAllocation':(0x4a0090,0x4a0108,{
  0x4a0090:('push','0x1000'),0x4a0095:('call','0x64c616'),
  0x4a009a:('mov','edi, eax'),0x4a009c:('mov','eax, dword ptr [esi + 0x2c]'),
  0x4a00a6:('push','8'),0x4a00a8:('mov','dword ptr [esi + 0x28], 2'),
  0x4a00af:('call','0x64c616'),0x4a00b4:('mov','dword ptr [esi + 0x24], eax'),
  0x4a00b7:('mov','dword ptr [eax + 4], edi'),0x4a00c3:('add','edi, 0x800'),
  0x4a00e9:('mov','dword ptr [ebx], eax'),0x4a00f7:('mov','dword ptr [esi + 0x14], eax')})}

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
   at=next(iter(required))+1
   bad=bytearray(raw);bad[at-start]^=1
   try:audit(bad,start,required)
   except AssertionError:controls.append(dict(fragment=name,changedAddress=hex(at),refused=True))
   else:raise AssertionError('Changed buffer ownership instruction accepted')

 after=path.stat();assert (before.st_ino,before.st_size,before.st_mtime_ns)==(after.st_ino,after.st_size,after.st_mtime_ns)
 result=dict(qualified=True,version=1,scope='Pinned original0049ff10 saves16 local bytes and12 register bytes, moves ECX to ESI, and allocates4096 bytes on its empty/full queue path at004a0095. With the independently audited28-byte CRT frame, its active caller return is at heap hook stack+56. Queue lifetime after return and safe retirement remain unqualified',
   originalExecutableSha256=PIN,queueFunction=0x49ff10,queueCallerStackOffset=56,queueLocalBytes=16,queueSavedRegisterBytes=12,crtFrameBytes=28,fragments=evidence,contradictoryInstructionControls=controls,largestRead=4096,
   scriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),browserUsed=False,nativeProcessesStarted=0)
 with a.output.open('x') as f:f.write(json.dumps(result,indent=2)+'\n')
 print(json.dumps(dict(qualified=True,fragments=len(evidence),controls=len(controls))))
if __name__=='__main__':main()

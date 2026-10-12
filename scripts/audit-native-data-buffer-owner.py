#!/usr/bin/env python3
"""Audit the pinned original data buffer install/replacement/destruction path."""
import argparse,hashlib,json,struct
from pathlib import Path
import capstone
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
FRAGMENTS={
 'dataLoadInstall':(0x529e59,0x529eb1,{
  0x529e59:('mov','eax, dword ptr [esi + 0x14]'),0x529e5c:('push','ebp'),
  0x529e62:('je','0x529e6b'),0x529e6b:('call','0x64d59f'),
  0x529e70:('mov','edi, eax'),0x529e9c:('push','eax'),0x529e9d:('push','ebp'),
  0x529e9e:('push','-1'),0x529ea0:('call','0x5273e0'),0x529ea7:('jne','0x529ec9'),
  0x529ea9:('push','edi'),0x529eaa:('mov','ecx, esi'),0x529eac:('call','0x558d80')}),
 'dataSetter':(0x558d80,0x558dc7,{
  0x558d83:('mov','eax, dword ptr [esi + 0x24]'),0x558d8d:('push','eax'),
  0x558d94:('je','0x558da9'),0x558da9:('call','0x64d4b6'),
  0x558db5:('mov','dword ptr [esi + 0x24], eax'),
  0x558dc0:('mov','dword ptr [esi + 0x24], ecx'),0x558dc4:('ret','4')}),
 'scalarDestructor':(0x5588a0,0x558924,{
  0x5588a7:('mov','dword ptr [esi], 0x688a70'),0x5588c2:('call','0x52ef40'),
  0x5588de:('call','0x55c080'),0x5588e3:('mov','eax, dword ptr [esi + 0x24]'),
  0x5588ed:('push','eax'),0x5588f4:('je','0x5588fd'),0x5588fd:('call','0x64d4b6'),
  0x558909:('mov','dword ptr [esi + 0x24], 0'),0x558915:('call','0x645bc0'),0x558921:('ret','4')})}

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
   at={'dataLoadInstall':0x529ead,'dataSetter':0x558db7,'scalarDestructor':0x5588fe}[name]
   bad=bytearray(raw);bad[at-start]^=1
   try:audit(bad,start,required)
   except AssertionError:controls.append(dict(fragment=name,changedAddress=hex(at),refused=True))
   else:raise AssertionError('Changed buffer ownership instruction accepted')

 after=path.stat();assert (before.st_ino,before.st_size,before.st_mtime_ns)==(after.st_ino,after.st_size,after.st_mtime_ns)
 result=dict(qualified=True,version=1,scope='Pinned original00529c30 loads ordinary malloc-backed data at00529e6b, reads through005273e0, then installs the buffer into the owning object through00558d80. The setter frees the previous ordinary buffer and writes owner+24; scalar destructor005588a0 frees and zeros owner+24. This is static ownership layout, not proof that an actual retained owner is live/referenced or can safely be evicted.',
   originalExecutableSha256=PIN,ownerVtable=0x688a70,bufferOffset=0x24,fragments=evidence,contradictoryInstructionControls=controls,largestRead=4096,
   scriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),browserUsed=False,nativeProcessesStarted=0)
 with a.output.open('x') as f:f.write(json.dumps(result,indent=2)+'\n')
 print(json.dumps(dict(qualified=True,fragments=len(evidence),controls=len(controls))))
if __name__=='__main__':main()

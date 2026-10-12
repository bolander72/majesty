#!/usr/bin/env python3
"""Audit original message queue destruction before releasing an orphan descriptor."""
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
   0x4a00e9:('mov','dword ptr [ebx], eax'),0x4a00f7:('mov','dword ptr [esi + 0x14], eax')}),
 'operatorNew':(0x64c616,0x64c624,{
  0x64c616:('push','1'),0x64c618:('push','dword ptr [esp + 8]'),0x64c61c:('call','0x64d5b1'),0x64c623:('ret','')}),
 'heapWrapper':(0x64d5b1,0x64d5dd,{
  0x64d5b8:('push','dword ptr [esp + 4]'),0x64d5bc:('call','0x64d5dd')}),
 'messageDispatch':(0x5a4d80,0x5a4e29,{
  0x5a4d9b:('mov','esi, ecx'),0x5a4dc5:('call','dword ptr [0x67f094]'),
  0x5a4dcb:('mov','ecx, dword ptr [esi + 0x5c]'),0x5a4de6:('call','0x4a1ec0'),
  0x5a4df6:('mov','ebx, dword ptr [eax + 0x10]'),0x5a4df9:('lea','edi, [esi + 0x138]'),
  0x5a4e0a:('mov','ecx, ebx'),0x5a4e0d:('call','0x49ff10')}),
 'managerCreation':(0x497990,0x4979fd,{
  0x4979a6:('mov','eax, dword ptr [0x6d8568]'),0x4979af:('push','0x2b0'),
  0x4979ce:('call','0x497a00'),0x4979d3:('mov','dword ptr [0x6d8568], eax')}),
 'managerVtable':(0x497aef,0x497afe,{
  0x497af5:('mov','dword ptr [ebp], 0x682c64')}),
 'managerFinalVtable':(0x497c1b,0x497c22,{
  0x497c1b:('mov','dword ptr [ebp], 0x682bc4')}),
 'recipientTreeCount':(0x4a0455,0x4a0466,{
  0x4a0455:('mov','dword ptr [esi + 4], eax'),0x4a0458:('mov','dword ptr [esi + 0xc], ebx')}),
 'recipientLookup':(0x4a1ec0,0x4a1f12,{
  0x4a1ec1:('mov','ecx, dword ptr [ecx + 4]'),0x4a1eca:('mov','eax, dword ptr [ecx + 4]'),
  0x4a1ecd:('mov','esi, dword ptr [0x6d857c]'),0x4a1edc:('cmp','dword ptr [eax + 0xc], edi'),
  0x4a1ee1:('mov','eax, dword ptr [eax + 8]'),0x4a1ee8:('mov','eax, dword ptr [eax]')}),
 'recipientReplacement':(0x499618,0x499658,{
  0x499622:('lea','ecx, [ebp + 0x4c]'),0x49962d:('call','0x4a2d00'),
  0x499655:('mov','dword ptr [eax + 0x10], ecx')}),
 'messageQueueClear':(0x497cf0,0x497def,{
  0x497d07:('mov','esi, ecx'),0x497d09:('mov','eax, dword ptr [esi + 0x2c]'),
  0x497d22:('mov','dword ptr [esi + 0xc], eax'),0x497d32:('call','0x5d9cf0'),
  0x497d45:('call','dword ptr [eax]'),0x497d51:('call','0x5d9cd0'),
  0x497d5a:('mov','dword ptr [esi + 0x2c], eax'),0x497d75:('call','0x645bc0'),
  0x497dad:('call','0x645bc0'),0x497dee:('ret','')}),
 'originalQueueDescriptorDelete':(0x49a09d,0x49a0a6,{
  0x49a09d:('push','esi'),0x49a09e:('call','0x645bc0'),0x49a0a3:('add','esp, 4')})}

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
 result=dict(qualified=True,version=4,scope='Pinned original00497cf0 consumes smart message references, invokes original message deleting destructors when appropriate, releases4096-byte storage/map and zeroes iterators when empty. Original descriptor-deletion call follows queue draining in00499fc0. Orphan identification, guarded use, gameplay preservation and actual resource release require dynamic qualification.',
   originalExecutableSha256=PIN,queueFunction=0x49ff10,queueCallerStackOffset=56,queueLocalBytes=16,queueSavedRegisterBytes=12,crtFrameBytes=28,fragments=evidence,contradictoryInstructionControls=controls,largestRead=4096,
   savedCallerEsiOffset=32,savedCallerEdiOffset=28,messageReferenceOffset=60,managerFinalVtable=0x682bc4,recipientTreeCountOffset=0x58,
   recipientTreeHeadOffset=0x50,treeRootOffset=4,treeNodeBytes=24,nodeKeyOffset=12,nodeQueueOffset=16,leafGlobal=0x6d857c,
   originalMessageQueueDestructor=0x497cf0,originalDescriptorDelete=0x645bc0,
   scriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),browserUsed=False,nativeProcessesStarted=0)
 with a.output.open('x') as f:f.write(json.dumps(result,indent=2)+'\n')
 print(json.dumps(dict(qualified=True,fragments=len(evidence),controls=len(controls))))
if __name__=='__main__':main()

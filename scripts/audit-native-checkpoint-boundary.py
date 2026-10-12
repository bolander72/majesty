#!/usr/bin/env python3
"""Audit the original completed-tick checkpoint and pending-exit dispatch path."""
import argparse,hashlib,json,struct
from pathlib import Path
import capstone
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
FRAGMENTS={
 'dispatcher':(0x415e40,0x415eeb,{
  0x415e4d:('mov','eax, dword ptr [esi + 4]'),0x415e54:('mov','dword ptr [esi], eax'),
  0x415e56:('mov','dword ptr [esi + 4], 0'),0x415e65:('jmp','dword ptr [eax*4 + 0x415eec]'),
  0x415e83:('call','0x417730'),0x415e88:('jmp','0x415edf'),
  0x415e8c:('call','0x4170a0'),0x415ee2:('jne','0x415e4d')}),
 'phaseRequest':(0x416050,0x4160a0,{
  0x416051:('mov','esi, dword ptr [esp + 8]'),0x416056:('cmp','esi, 7'),
  0x416066:('mov','eax, dword ptr [edi]'),0x416070:('lea','ecx, [esi - 1]'),
  0x41607c:('jmp','dword ptr [ecx*4 + 0x416134]'),
  0x41608c:('jmp','dword ptr [eax*4 + 0x416158]'),
  0x416093:('mov','esi, 4'),0x416098:('mov','dword ptr [edi + 4], esi'),
  0x41609d:('ret','4')}),
 'originalTick':(0x417730,0x417be9,{
  0x4178e6:('mov','dword ptr [0x71c6a8], eax'),
  0x417924:('mov','dword ptr [edi + 0x28], eax'),0x41794c:('call','0x492430'),
  0x4179a4:('call','0x415dd0'),0x417a8d:('call','0x5a4600'),
  0x417a99:('call','0x49a700'),0x417b2f:('call','0x416590'),
  0x417be5:('add','esp, 0x38'),0x417be8:('ret','')})}

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
   at={'dispatcher':0x415e8d,'phaseRequest':0x416099,'originalTick':0x4178e8}[name]
   bad=bytearray(raw);bad[at-start]^=1
   try:audit(bad,start,required)
   except AssertionError:controls.append(dict(fragment=name,changedAddress=hex(at),refused=True))
   else:raise AssertionError('Changed boundary instruction accepted')
  tables={}
  for name,start,expected in [
   ('dispatcher',0x415eec,[0x415e6c,0x415e78,0x415e81,0x415e8a,0x415e93,0x415e8a,0x415e81,0x415e81]),
   ('request',0x416134,[0x416083,0x4160a0,0x4160be,0x41612c,0x41612c,0x41612c,0x4160fc,0x416114,0x4160e5]),
   ('currentPhase',0x416158,[0x416129,0x41612c,0x41612c,0x416093,0x416129,0x41612c,0x41612c,0x416093,0x416129])]:
   section=next(s for s in sections if s[1]<=start-base and start-base+len(expected)*4<=s[1]+s[2])
   f.seek(section[3]+start-base-section[1]);raw=f.read(len(expected)*4)
   assert list(struct.unpack('<'+'I'*len(expected),raw))==expected
   tables[name]=dict(start=start,targets=expected,sha256=hashlib.sha256(raw).hexdigest())
   index={'dispatcher':3,'request':0,'currentPhase':3}[name];bad=bytearray(raw);bad[index*4]^=1
   try:assert list(struct.unpack('<'+'I'*len(expected),bad))==expected
   except AssertionError:controls.append(dict(table=name,changedIndex=index,refused=True))
   else:raise AssertionError('Changed dispatch table accepted')

 after=path.stat();assert (before.st_ino,before.st_size,before.st_mtime_ns)==(after.st_ino,after.st_size,after.st_mtime_ns)
 result=dict(qualified=True,version=1,scope='Pinned original dispatcher consumes pending phase before selecting tick/exit. Request1 from phase3 reaches a call-free path writing only pending4. The complete original tick returns after its clock, world, queues, drawing and late message work. This proves the boundary location, not save payload purity or whole-browser residency.',
   originalExecutableSha256=PIN,fragments=evidence,jumpTables=tables,contradictoryInstructionControls=controls,largestRead=4096,
   scriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),browserUsed=False,nativeProcessesStarted=0)
 with a.output.open('x') as f:f.write(json.dumps(result,indent=2)+'\n')
 print(json.dumps(dict(qualified=True,fragments=len(evidence),controls=len(controls))))
if __name__=='__main__':main()

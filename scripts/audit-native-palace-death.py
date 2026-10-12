#!/usr/bin/env python3
"""Pin the original HP/death-script/DeclareLoss path; this is not gameplay evidence."""
import argparse,hashlib,json,struct
from pathlib import Path
import capstone
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
FRAGMENTS={
 'hpAttribute':(0x41dfc0,0x41e02a,{0x41dfe8:('push','0x55'),0x41dfea:('push','0x50'),0x41dff0:('push','0x41'),0x41dffb:('call','0x59a100')}),
 'palaceLookup':(0x42ceb0,0x42cf2b,{0x42ceb5:('mov','eax, dword ptr [ebx + 0x40]'),0x42cee7:('cmp','dword ptr [eax + 0x70], edi'),0x42cef5:('cmp','ecx, 0x4a4241'),0x42cefd:('cmp','ecx, 0x6d4241'),0x42cf18:('call','0x5a10d0'),0x42cf25:('mov','dword ptr [ebx + 0x40], ecx')}),
 'attributeRead':(0x5a1c40,0x5a1c61,{0x5a1c4a:('add','ecx, 4'),0x5a1c4d:('call','0x4f08b0'),0x5a1c5e:('ret','8')}),
 'hpDeathScript':(0x431130,0x4313a5,{0x43116d:('call','0x5b46a0'),0x4311b4:('cmp','ebx, 0x555041'),0x4311e0:('cmp','edi, 1'),0x431238:('call','0x4267a0'),0x431257:('push','0x6bd5ac'),0x431276:('call','0x629910'),0x431297:('call','0x629a20'),0x4312a0:('call','0x629c40'),0x4313a2:('ret','8')}),
 'declareLoss':(0x426590,0x4265e9,{0x4265e0:('call','0x482c50'),0x4265e5:('add','esp, 0x10'),0x4265e8:('ret','')})}
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
   first=next(iter(required));decoded=list(capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32).disasm(raw,start));instruction=next(i for i in decoded if i.address==first)
   at=first-start+instruction.size-1;bad=bytearray(raw);bad[at]^=1
   try:audit(bad,start,required)
   except AssertionError:controls.append(dict(fragment=name,changedAddress=hex(start+at),refused=True))
   else:raise AssertionError('Changed original instruction accepted')
  sdk={}
  for relative in ['GPL/Building_Deaths.gpl','GPLMx/mx_Building_Deaths.gpl']:
   source=ROOT/'upstream/majesty-recomp/original/gog/SDK/OriginalQuests'/relative
   text=source.read_text();body=text.split('function Palace_Death',1)[1].split('\nend',1)[0]
   assert '$declareloss' in body.lower();sdk[relative]=dict(sha256=hashlib.sha256(source.read_bytes()).hexdigest(),declaresLoss=True)
   if relative.startswith('GPLMx'):
    assert '$SetPalace (Outpost' in body and '$Transfer_Palace_Data' in body and 'Else' in body
    sdk[relative]['outpostCanPreventLoss']=True
 after=path.stat();assert (before.st_ino,before.st_size,before.st_mtime_ns)==(after.st_ino,after.st_size,after.st_mtime_ns)
 report=dict(version=1,pinnedExecutableSha256=PIN,qualified=True,fragments=evidence,controls=controls,originalSdk=sdk,declareLossCallsOutcomeDirectly=True,declareLossOutcomeReturnPc='004265e5',palaceGameplayQualified=False,cooperativePalaceLossQualified=False,browserUsed=False,nativeProcessesStarted=0,scriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
 with a.output.open('x') as f:json.dump(report,f,indent=2);f.write('\n')
 print(json.dumps(dict(qualified=True,fragments=len(evidence),refusalControls=len(controls),cooperativePalaceLossQualified=False)))
if __name__=='__main__':main()

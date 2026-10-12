#!/usr/bin/env python3
"""Pin kind13's inherited command framing without launching the game."""
import argparse,contextlib,hashlib,importlib.util,io,json,struct,tempfile
from pathlib import Path
import capstone,pefile
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
def audit():
 raw=(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
 assert hashlib.sha256(raw).hexdigest()==PIN
 pe=pefile.PE(data=raw);base=pe.OPTIONAL_HEADER.ImageBase;d=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
 ranges=[];decoded={}
 for label,start,end in [('factory',0x5da78e,0x5da7c4),('constructor',0x5f93c0,0x5f93da),
   ('reader',0x5f9410,0x5f9456),('writer',0x5f9460,0x5f94a3)]:
  code=pe.get_data(start-base,end-start);rows=list(d.disasm(code,start));assert sum(i.size for i in rows)==len(code)
  decoded.update({i.address:(i.mnemonic,i.op_str)for i in rows})
  ranges.append(dict(label=label,start=start,end=end,sha256=hashlib.sha256(code).hexdigest(),
    instructions=[dict(address=i.address,mnemonic=i.mnemonic,operands=i.op_str)for i in rows]))
 anchors={0x5da78e:('push','0x64'),0x5da7ae:('call','0x5f93c0'),0x5f93c3:('call','0x5ab670'),
  0x5f93ca:('mov','dword ptr [esi], 0x68b8ec'),0x5f9427:('call','0x5ab760'),
  0x5f9474:('call','0x5ab7e0'),0x5f947d:('mov','eax, dword ptr [edi + 0x5c]'),
  0x5f948c:('mov','ecx, dword ptr [edi + 0x60]')}
 assert all(decoded[at]==value for at,value in anchors.items())
 assert struct.unpack('<I',pe.get_data(0x5da870+12*4-base,4))[0]==0x5da78e
 for offset,target in [(4,0x5f9410),(8,0x5f9460)]:assert struct.unpack('<I',pe.get_data(0x68b8ec+offset-base,4))[0]==target
 spec=importlib.util.spec_from_file_location('original_writer',ROOT/'scripts/check-native-order-writers.py');writer=importlib.util.module_from_spec(spec);spec.loader.exec_module(writer)
 writer.LEAVES={13:(0x5da78e,0x5f93c0,0x68b8ec,0x5f9460,0x5f94a3,188)};writer.CASES=[(13,0)]
 writer.SHARED.append((0x5ab7e0,0x5ab850))
 with tempfile.TemporaryDirectory(prefix='majesty-inherited-order-')as directory:
  writer.OUTPUT=Path(directory)/'writer.json'
  with contextlib.redirect_stdout(io.StringIO()):writer.main()
  replay=json.loads(writer.OUTPUT.read_text())
 assert len(replay['replays'])==2 and replay['mappedGuestBytesAfterCleanup']==0
 for row in replay['replays']:
  assert row['payloadBytes']==188 and row['words'][:5]==[1,1,1,2,13]
  assert row['words'][45:47]==[0x1100005c,0x11000060]
  assert row['words'][5:11]==[0x11000014,0x11000008,0x1100000c,0x11000018,0x1100001c,0x11000020]
  for word,proc,script in [(11,0x2c,0x30),(30,0x50,0x54)]:
   assert row['words'][word:word+14]==[0x11000000+proc,0x11000000+script]+[0]*12
 replay.update(completedCalls=2,scope='Kind13 original188-byte inherited writer with modeled stream primitives; additional fields remain opaque',
  staticRanges=ranges,verifiedInstructionAnchors=len(anchors),objectBytes=100,leafVersion=1,parentVersion=1,fixedBytes=188,
  inheritedFramingQualified=True,originalOrderReadExecuted=False,nativeActivationQualified=False,
  commonDispatchWords=dict(rate=5,when=6,delta=7,info=8),callbackWords=dict(base=11,marker=30),
  originalCommonHeaderReplayChecks=2,originalCallbackTokenReplayChecks=4,
  sourceSha256={**replay['sourceSha256'],'scripts/audit-native-inherited-order.py':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()})
 return replay
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 if a.output.exists():p.error('Preserve previous evidence')
 result=audit()
 with a.output.open('x')as f:json.dump(result,f,indent=2);f.write('\n')
 print(json.dumps(dict(qualified=True,writerReplays=2,fixedBytes=188,gameLaunched=False)))

#!/usr/bin/env python3
"""Pin the original coordinate Move entry before native homeward integration."""
import hashlib,json,struct,sys
from pathlib import Path
import capstone,pefile
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
def main():
 assert len(sys.argv)==2
 output=Path(sys.argv[1]);assert not output.exists()
 raw=(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
 assert hashlib.sha256(raw).hexdigest()==PIN
 pe=pefile.PE(data=raw);base=pe.OPTIONAL_HEADER.ImageBase;decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
 rows={};ranges=[]
 for label,start,end in [('script-coordinate-move',0x5a7392,0x5a73de),('native-coordinate-move',0x5b4870,0x5b48b1),
  ('coordinate-copy',0x420c50,0x420c63),('original-command-creation',0x5b48c0,0x5b48f6)]:
  code=pe.get_data(start-base,end-start);instructions=list(decoder.disasm(code,start))
  assert sum(i.size for i in instructions)==end-start
  rows.update({i.address:(i.mnemonic,i.op_str) for i in instructions})
  ranges.append(dict(label=label,start=start,end=end,instructions=len(instructions),sha256=hashlib.sha256(code).hexdigest()))
 anchors=[(0x5a73c1,'push','0'),(0x5a73c5,'call','dword ptr [edi + 0x114]'),
  (0x5b4871,'mov','esi, ecx'),(0x5b4879,'call','dword ptr [eax + 0xf0]'),
  (0x5b4893,'call','0x420c50'),(0x5b48a5,'call','0x5b48c0'),(0x5b48ae,'ret','0x14'),
  (0x420c58,'mov','dword ptr [eax], edx'),(0x420c5d,'mov','dword ptr [eax + 4], ecx'),
  (0x5b48c2,'call','0x5da280'),(0x5b48f0,'call','dword ptr [edi + 0x30]')]
 for address,mnemonic,operands in anchors:assert rows[address]==(mnemonic,operands),(hex(address),rows[address])
 assert struct.unpack('<I',pe.get_data(0x68098c+0x114-base,4))[0]==0x5b4870
 report=dict(version=1,pinnedCoordinateMoveQualified=True,executableSha256=PIN,virtualSlot=0x114,
  nativeEntry=0x5b4870,stackArgumentBytes=20,coordinateWords=2,coordinateUnits='integer world units',
  commandCreationEntry=0x5b48c0,ranges=ranges,anchors=len(anchors),
  sourceSha256={'scripts/audit-native-home-leg.py':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},
  nativeMovementExecuted=False,browserUsed=False,nativeProcessesStarted=0,goalComplete=False)
 with output.open('x') as f:json.dump(report,f,indent=2);f.write('\n')
 print(json.dumps({k:report[k]for k in ['pinnedCoordinateMoveQualified','nativeEntry','stackArgumentBytes','anchors','nativeMovementExecuted']}))
if __name__=='__main__':main()

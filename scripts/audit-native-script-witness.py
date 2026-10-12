#!/usr/bin/env python3
"""Pin original reference serialization's lazy cache population for namespace witnesses."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import capstone
import pefile
ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
RANGES = [('agent-reference-writer',0x625d10,0x625d5b),('agent-native-cache-getter',0x626310,0x62633c)]
ANCHORS = [
 (0x625d18,'mov','eax, dword ptr [esi + 8]'),(0x625d1e,'call','0x4eed10'),
 (0x625d26,'mov','dword ptr [esi + 0xc], 0'),(0x625d2e,'call','0x623b20'),
 (0x625d35,'call','0x6236b0'),(0x625d3c,'mov','dword ptr [esi + 0xc], eax'),
 (0x625d41,'mov','cl, byte ptr [eax + 0x28]'),(0x625d46,'jne','0x625d4f'),
 (0x625d4a,'call','0x626310'),(0x625d58,'ret','4'),
 (0x626313,'mov','eax, dword ptr [esi + 0x24]'),(0x626318,'jne','0x626337'),
 (0x62631a,'mov','ecx, dword ptr [0x71c68c]'),(0x626324,'mov','eax, dword ptr [esi + 0x20]'),
 (0x626329,'jle','0x626337'),(0x62632b,'mov','ecx, dword ptr [ecx + 0x10]'),
 (0x62632f,'call','0x5a10d0'),(0x626334,'mov','dword ptr [esi + 0x24], eax'),
 (0x626337,'mov','eax, dword ptr [esi + 0x24]'),(0x62633b,'ret',''),
]

def audit():
 raw=(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
 if hashlib.sha256(raw).hexdigest()!=PIN:raise ValueError('Script witness requires pinned executable')
 pe=pefile.PE(data=raw);decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
 ranges=[];rows={}
 for label,start,end in RANGES:
  instructions=list(decoder.disasm(pe.get_data(start-pe.OPTIONAL_HEADER.ImageBase,end-start),start))
  if sum(i.size for i in instructions)!=end-start:raise ValueError('Incomplete script cache range')
  values=[dict(address=i.address,mnemonic=i.mnemonic,operands=i.op_str,bytes=i.bytes.hex())for i in instructions]
  rows.update({v['address']:v for v in values});ranges.append(dict(label=label,instructions=values))
 for at,mnemonic,operands in ANCHORS:
  if at not in rows or (rows[at]['mnemonic'],rows[at]['operands'])!=(mnemonic,operands):raise ValueError(f'Script cache anchor changed at {at:08x}')
 return dict(qualified=True,executableSha256=PIN,verifiedInstructionAnchors=len(ANCHORS),ranges=ranges,
  referenceWriterRefreshesAgentPointerCache=True,referenceWriterInvokesLazyNativeGetter=True,
  agentNativeGetterHeaderWriteOffset=0x24,rawCacheRestorationPerformed=False,
  browserUsed=False,gameLaunches=0,scope='Lazy cache provenance only; no exhaustive live alias retirement or cross-region activation')

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True);args=p.parse_args();result=audit()
 with args.output.open('x')as f:json.dump(result,f,indent=2);f.write('\n')
 print(json.dumps(dict(qualified=True,anchors=result['verifiedInstructionAnchors'])))

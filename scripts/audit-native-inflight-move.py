#!/usr/bin/env python3
"""Pin cached Move point serialization, target refresh, pure setter and grid buckets."""
import argparse,hashlib,json,struct
from pathlib import Path
import capstone,pefile
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
RANGES=[('common-original-dispatch',0x5e53c0,0x5e53f6),('game-Move-delegate',0x4ab8a0,0x4ab8b7),('cached-point-refresh',0x5b7430,0x5b7488),('pure-three-coordinate-setter',0x5b7990,0x5b79a8),('Move-base-serialization',0x5b6d60,0x5b6dec),('three-DWORD-vector-serialization',0x4f6ad0,0x4f6b15),('original-position-vector',0x5ad5b0,0x5ad64f),('physical-cell-bucket-removal',0x5b88a0,0x5b8b1d)]
ANCHORS=[(0x5e53ea,'mov','ecx, dword ptr [ecx + 4]'),(0x5e53f0,'call','dword ptr [edx + 0x18]'),(0x4ab8af,'call','0x5b7490'),(0x5b7441,'mov','eax, dword ptr [esi + 0x38]'),(0x5b7449,'call','0x5a10d0'),(0x5b7471,'mov','dword ptr [esi + 0x3c], ecx'),(0x5b7477,'mov','dword ptr [esi + 0x40], edx'),(0x5b747d,'mov','dword ptr [esi + 0x44], eax'),(0x5b7998,'mov','dword ptr [ecx + 0x3c], eax'),(0x5b799f,'mov','dword ptr [ecx + 0x40], edx'),(0x5b79a2,'mov','dword ptr [ecx + 0x44], eax'),(0x5b79a5,'ret','0xc'),(0x5b6d9b,'lea','edx, [edi + 0x38]'),(0x5b6da7,'lea','ecx, [edi + 0x3c]'),(0x5b6daa,'call','0x4f6ad0'),(0x5b895e,'mov','edx, dword ptr [ebp + 0x18]'),(0x5b897e,'cmp','eax, 8'),(0x5b8aaf,'cmp','eax, 8')]
def audit():
 raw=(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
 if hashlib.sha256(raw).hexdigest()!=PIN:raise ValueError('Original Move audit requires pinned executable')
 pe=pefile.PE(data=raw);base=pe.OPTIONAL_HEADER.ImageBase;d=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32);ranges=[];decoded={}
 for name,start,end in RANGES:
  values=[dict(address=i.address,mnemonic=i.mnemonic,operands=i.op_str,bytes=i.bytes.hex())for i in d.disasm(pe.get_data(start-base,end-start),start)]
  if sum(len(bytes.fromhex(v['bytes']))for v in values)!=end-start or values[-1]['mnemonic']!='ret':raise ValueError('Incomplete original method '+name)
  decoded.update({v['address']:v for v in values});ranges.append(dict(label=name,start=start,end=end,instructions=values))
 for at,mnemonic,operands in ANCHORS:
  if(decoded[at]['mnemonic'],decoded[at]['operands'])!=(mnemonic,operands):raise ValueError(f'Changed original Move anchor {at:08x}')
 slots=[(0x6830d8,0x18,0x4ab8a0),(0x6830d8,0x1c,0x5b7430),(0x6830d8,0x20,0x5b70b0),(0x6830d8,0x2c,0x5e1bb0)]
 for table,offset,target in slots:
  if struct.unpack('<I',pe.get_data(table+offset-base,4))[0]!=target:raise ValueError('Move vtable changed')
 return dict(qualified=True,scope='Static original Move point/dispatch/serialization/physical bucket boundaries; coordinate/elevation repair and natural Path continuation unqualified',executableSha256=PIN,verifiedInstructionAnchors=len(ANCHORS),ranges=ranges,slots=[dict(table=t,offset=o,target=f)for t,o,f in slots],cachedGoalNativeOffsets=[0x3c,0x40,0x44],nativeTargetIdOffset=0x38,pureSetterWritesOnlyThreeCoordinates=True,physicalCellBucketSlots=8,browserUsed=False,nativeProcessesStarted=0)
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True);a=p.parse_args();r=audit()
 with a.output.open('x')as f:json.dump(r,f,indent=2);f.write('\n')
 print(json.dumps(dict(qualified=True,anchors=len(ANCHORS),nativeProcessesStarted=0)))

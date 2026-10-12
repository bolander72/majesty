#!/usr/bin/env python3
"""Pin command12 animation fields and replay its original bounded writer."""
import argparse,contextlib,hashlib,importlib.util,io,json,struct,tempfile
from pathlib import Path
import capstone,pefile
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
def audit():
 raw=(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
 if hashlib.sha256(raw).hexdigest()!=PIN:raise ValueError('Frame order requires pinned executable')
 pe=pefile.PE(data=raw);base=pe.OPTIONAL_HEADER.ImageBase;decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
 ranges=[];decoded={}
 for label,start,end in [('factory',0x5da758,0x5da78e),('constructor',0x5e37e0,0x5e3803),
   ('reader',0x5e3840,0x5e389f),('writer',0x5e38a0,0x5e38fc),('frame-update',0x5e3add,0x5e3b4b)]:
  code=pe.get_data(start-base,end-start);rows=list(decoder.disasm(code,start))
  assert sum(i.size for i in rows)==len(code)
  decoded.update({i.address:(i.mnemonic,i.op_str)for i in rows})
  ranges.append(dict(label=label,start=start,end=end,sha256=hashlib.sha256(code).hexdigest(),
    instructions=[dict(address=i.address,mnemonic=i.mnemonic,operands=i.op_str)for i in rows]))
 anchors={0x5da758:('push','0x48'),0x5da75a:('call','0x64c616'),0x5da778:('call','0x5e37e0'),
  0x5e37ea:('mov','dword ptr [esi], 0x68aee4'),0x5e38b4:('call','0x5deec0'),
  0x5e38b9:('mov','eax, dword ptr [edi + 0x34]'),0x5e38c4:('mov','ecx, dword ptr [edi + 0x38]'),
  0x5e38cf:('mov','edx, dword ptr [edi + 0x3c]'),0x5e38da:('mov','eax, dword ptr [edi + 0x40]'),
  0x5e38e5:('mov','ecx, dword ptr [edi + 0x44]'),0x5e3add:('mov','eax, dword ptr [esi + 0x40]'),
  0x5e3ae0:('mov','ecx, dword ptr [esi + 0x3c]'),0x5e3afc:('dec','edx'),
  0x5e3aff:('mov','dword ptr [esi + 0x44], edx'),0x5e3b45:('test','bl, bl'),
  0x5e3b47:('mov','dword ptr [esi + 0x40], eax')}
 assert all(decoded[at]==value for at,value in anchors.items())
 assert struct.unpack('<I',pe.get_data(0x5da870+11*4-base,4))[0]==0x5da758
 for offset,target in [(4,0x5e3840),(8,0x5e38a0),(24,0x5e3ab0)]:
  assert struct.unpack('<I',pe.get_data(0x68aee4+offset-base,4))[0]==target
 spec=importlib.util.spec_from_file_location('original_writer',ROOT/'scripts/check-native-order-writers.py')
 writer=importlib.util.module_from_spec(spec);spec.loader.exec_module(writer)
 writer.LEAVES={12:(0x5da758,0x5e37e0,0x68aee4,0x5e38a0,0x5e38fc,116)};writer.CASES=[(12,0)]
 with tempfile.TemporaryDirectory(prefix='majesty-frame-writer-')as directory:
  writer.OUTPUT=Path(directory)/'writer.json'
  with contextlib.redirect_stdout(io.StringIO()):writer.main()
  replay=json.loads(writer.OUTPUT.read_text())
 assert len(replay['replays'])==2 and replay['mappedGuestBytesAfterCleanup']==0
 for row in replay['replays']:
  assert row['payloadBytes']==116 and row['words'][24:29]==[0x11000034,0x11000038,0x1100003c,0x11000040,0x11000044]
 replay.update(completedCalls=len(replay['replays']),scope='command12 fixed116-byte writer and five frame-state DWORDs; modeled stream primitives',
  staticRanges=ranges,verifiedInstructionAnchors=len(anchors),objectBytes=72,factoryAllocateReturn=0x5da75f,
  nativeFrameStateOffsets=[0x34,0x38,0x3c,0x40,0x44],savedFrameStateWordIndices=[24,25,26,27,28],
  frameStatePreservationQualified=True,originalOrderReadExecuted=False,nativeActivationQualified=False,
  sourceSha256={**replay['sourceSha256'],'scripts/audit-native-frame-order.py':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()})
 return replay
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 if a.output.exists():p.error('Preserve previous evidence')
 result=audit()
 with a.output.open('x')as f:json.dump(result,f,indent=2);f.write('\n')
 print(json.dumps(dict(qualified=True,writerReplays=result['completedCalls'],fixedBytes=116,objectBytes=72,
  originalInstructions=result['originalInstructions'],mappedGuestBytesPeak=result['mappedGuestBytesPeak'],gameLaunched=False)))

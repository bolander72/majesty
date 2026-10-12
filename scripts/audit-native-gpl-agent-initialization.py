#!/usr/bin/env python3
"""Audit pinned GPL construction/save/load; never start a game/browser."""
import argparse, hashlib, json
from pathlib import Path
import capstone
from capstone import x86_const as x
import pefile
ROOT=Path(__file__).resolve().parents[1]
GAME=ROOT/'upstream/majesty-recomp'
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
def sha(p):
 h=hashlib.sha256()
 with p.open('rb')as f:
  for b in iter(lambda:f.read(4096),b''):h.update(b)
 return h.hexdigest()
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 if a.output.exists():p.error('Preserve earlier audits')
 binary=GAME/'original/gog/MajestyHD - Old.exe';assert sha(binary)==PIN
 pe=pefile.PE(str(binary),fast_load=True);md=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32);md.detail=True
 def decode(lo,hi):
  data=pe.get_data(lo-0x400000,hi-lo);rows=list(md.disasm(data,lo));assert rows and rows[0].address==lo and rows[-1].address+rows[-1].size==hi
  return rows
 ctor=decode(0x625e70,0x625f9d)
 assert ctor[-1].mnemonic=='ret' and not ctor[-1].op_str
 assert any(i.mnemonic=='mov' and i.op_str=='edi, ecx' for i in ctor)
 assert any(i.mnemonic=='mov' and i.op_str=='eax, edi' for i in ctor)
 assert any(i.mnemonic=='xor' and i.op_str=='ebx, ebx' for i in ctor)
 stores=[]
 for i in ctor:
  if i.mnemonic=='mov' and i.operands[0].type==x.X86_OP_MEM and i.operands[0].mem.base==x.X86_REG_EDI:
   o=i.operands[0];stores.append(dict(at=hex(i.address),offset=o.mem.disp,bytes=o.size,value=i.op_str.split(', ',1)[1]))
 assert not any(r['offset']<=0x2c<r['offset']+r['bytes'] for r in stores)
 for offset,size in [(0x20,4),(0x24,4),(0x28,1),(0x30,1),(0x31,1),(0x32,1)]:
  assert any(r['offset']==offset and r['bytes']==size and r['value'] in ['ebx','bl'] for r in stores)
 writer=decode(0x626877,0x626882);assert [(i.mnemonic,i.op_str)for i in writer]==[('mov','eax, dword ptr [edi + 0x2c]'),('mov','ecx, esi'),('push','eax'),('call','0x4eed10')]
 reader=decode(0x626b89,0x626b94);assert [(i.mnemonic,i.op_str)for i in reader]==[('lea','ecx, [edi + 0x2c]'),('push','ecx'),('mov','ecx, esi'),('call','0x4ef790')]
 header=(GAME/'browser_overrides.h').read_text();code=(GAME/'browser_network.cpp').read_text()
 assert '#define FN_00625e70 majesty_browser_gpl_agent_construct' in header
 body=code.split('extern "C" void majesty_browser_gpl_agent_construct(X86 *c) {',1)[1].split('\n}',1)[0]
 assert body.index('fn_00625e70(c);')<body.index('wr32(agent + 0x2c, 0);')
 assert body.count('wr32(')==1 and 'agent != self' in body and 'gm_valid(agent, 0x34)' in body
 asm={}
 for name in ['00625e70','00626740','006269b0','00632e60','006338a0']:
  fn=GAME/f'analysis/decompiled/MajestyHD - Old.exe/functions/{name}.asm';asm[str(fn.relative_to(ROOT))]=sha(fn)
 result=dict(version=1,pinnedExecutableSha256=PIN,constructor=hex(ctor[0].address),constructorLeavesSerializedWordUndefined=True,constructorReturnsSelf=True,newAgentWordInitializedAtOffset=44,newAgentInitialValue=0,originalSavedReaderPreserved=True,ctorStores=stores,writer=[dict(at=hex(i.address),instruction=i.mnemonic+' '+i.op_str)for i in writer],reader=[dict(at=hex(i.address),instruction=i.mnemonic+' '+i.op_str)for i in reader],originalAsmSha256=asm,sourceSha256={str((GAME/f).relative_to(ROOT)):sha(GAME/f)for f in ['browser_network.cpp','browser_overrides.h']},nativeProcessesStarted=0,browserUsed=False,runtimeEqualityQualified=False,scope='Pinned original constructor/save/load instruction audit and narrow game override. Actual new-object determinism and existing-saved-value preservation require stopped native save/load evidence.')
 with a.output.open('x')as f:json.dump(result,f,indent=2);f.write('\n')
 print(json.dumps(dict(pinnedConstructorSaveLoadAudited=True,constructorUndefinedWord=44,savedReaderPreserved=True)))
if __name__=='__main__':main()

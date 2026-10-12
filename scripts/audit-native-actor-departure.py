#!/usr/bin/env python3
"""Pin original native actor removal and typed script roster operations."""
import argparse,hashlib,importlib.util,json,struct
from pathlib import Path
import capstone,pefile
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
def audit(executable):
 data=executable.read_bytes()
 if hashlib.sha256(data).hexdigest()!=PIN:raise ValueError('Actor departure audit requires the pinned DirectDraw executable')
 spec=importlib.util.spec_from_file_location('actor_import',ROOT/'scripts/audit-native-actor-import.py');prior=importlib.util.module_from_spec(spec);spec.loader.exec_module(prior);previous=prior.audit(executable)
 pe=pefile.PE(data=data);base=pe.OPTIONAL_HEADER.ImageBase;decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
 ranges=[];decoded={}
 for label,start,end,last in [
  ('original-agent-attribute-lookup',0x6263d0,0x626434,'ret'),
  ('original-list-operator-dispatch',0x639bb0,0x639d5e,'call'),
  ('original-agent-reference-constructor',0x6254c0,0x62551d,'ret'),
  ('original-complete-unit-removal',0x5a21b0,0x5a224a,'ret'),
  ('original-unit-agent-removal',0x5a24c0,0x5a253f,'ret'),
  ('original-runtime-agent-removal-wrapper',0x6236d0,0x6236e0,'ret'),
  ('original-manager-agent-removal',0x633160,0x6332b6,'ret'),
  ('original-manager-deferred-destruction',0x633370,0x6333c6,'ret'),
 ]:
  raw=pe.get_data(start-base,end-start);rows=[dict(address=f'{i.address:08x}',bytes=i.bytes.hex(),mnemonic=i.mnemonic,operands=i.op_str)for i in decoder.disasm(raw,start)]
  if sum(len(bytes.fromhex(r['bytes']))for r in rows)!=len(raw)or rows[-1]['mnemonic']!=last:raise ValueError('Incomplete pinned method: '+label)
  ranges.append(dict(label=label,start=f'{start:08x}',end=f'{end:08x}',instructions=rows));decoded.update({r['address']:r for r in rows})
 switch=list(struct.unpack('<11I',pe.get_data(0x639d60-base,44)))
 if switch[5]!=0x639c5b:raise ValueError('Unexpected original list removal operator')
 slots=[]
 for table,slot,target in [(0x68098c,0x14,0x5a24c0),(0x68098c,0x1dc,0x5a22b0),(0x68098c,0xb8,0x5b3550),(0x68098c,0x98,0x5ad400),(0x68098c,0x1e0,0x5a21a0),(0x68c2e0,4,0x639bb0)]:
  if struct.unpack('<I',pe.get_data(table+slot-base,4))[0]!=target:raise ValueError('Unexpected departure virtual dispatch')
  slots.append(dict(table=f'{table:08x}',slot=slot,target=f'{target:08x}'))
 checks=[
  ('attribute-borrowed-return','00626417','mov','eax, dword ptr [eax + 0x18]'),
  ('list-operation-argument','00639bbe','mov','eax, dword ptr [esp + 0x14]'),
  ('list-operand-context','00639c5b','mov','ecx, dword ptr [esp + 0x44]'),
  ('list-operand-slot','00639c62','mov','edx, dword ptr [ecx + 0x18]'),
  ('list-value-comparison','00639c77','call','dword ptr [eax + 0x14]'),
  ('list-value-pool-return','00639c8c','call','0x62aa20'),
  ('list-node-free','00639ca1','call','0x645bc0'),
  ('list-size-decrement','00639cad','mov','dword ptr [edi + 0x10], eax'),
  ('list-two-argument-return','00639ccf','ret','8'),
  ('normal-unit-agent-dispatch','005a21be','call','dword ptr [eax + 0x14]'),
  ('normal-unit-container-dispatch','005a21f0','call','dword ptr [edx + 0x1dc]'),
  ('normal-unit-factory-remove','005a2243','call','0x5baf20'),
  ('native-ea-delete','005a2525','call','0x628530'),
  ('native-ea-clear','005a2533','call','0x4efeb0'),
  ('manager-removed-flag','00633216','mov','byte ptr [esi + 0x28], 1'),
  ('manager-deferred-count','0063325c','mov','dword ptr [edi + 0x48], eax'),
  ('manager-remove-id-tree','0063327f','call','0x6346a0'),
  ('manager-remove-queues','0063328b','call','0x6332c0'),
  ('deferred-agent-destructor','0063338a','call','0x625fa0'),
  ('deferred-agent-free','00633390','call','0x645bc0'),
  ('deferred-node-free','006333ae','call','0x645bc0'),
 ]
 for label,address,mnemonic,operands in checks:
  if(decoded[address]['mnemonic'],decoded[address]['operands'])!=(mnemonic,operands):raise ValueError('Unexpected departure instruction: '+label)
 return dict(executableSha256=PIN,ranges=ranges,slots=slots,listOperatorSwitch=switch,importAuditInstructions=sum(len(r['instructions'])for r in previous['ranges']),checkedInstructions=[dict(label=label,**decoded[address])for label,address,_,_ in checks],
  contracts={'listRemove':'this=original GPL list; args=(operand context,operation 5); RET 8; returns matched pooled values and nodes',
             'unitRemoval':'this=original unit; no args; includes EA, containers, orders, rendering/spatial/factory lifecycle',
             'agentRemoval':'normal EA removal marks agent, erases manager ID/queues, and defers destructor; drain only an owned pending removal'},
  limitations='Pinned native source departure contract. Separate owned-world mutation, full original checkpoint save/reload and destination insertion must be verified; not a two-world atomic commit, browser travel, hero movement or multiplayer handoff.')
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--exe',type=Path,default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe');p.add_argument('--output',type=Path,default=ROOT/'output/native-actor-departure-audit.json');a=p.parse_args();result=audit(a.exe);a.output.write_text(json.dumps(result,indent=2)+'\n');print('Pinned source departure verified;',sum(len(r['instructions'])for r in result['ranges']),'instructions')
if __name__=='__main__':main()

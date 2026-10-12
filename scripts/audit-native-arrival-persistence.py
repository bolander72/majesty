#!/usr/bin/env python3
"""Pin original typed roster insertion before durable destination arrival."""
import argparse,hashlib,importlib.util,json,struct
from pathlib import Path
import capstone,pefile
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
def audit(executable):
 data=executable.read_bytes()
 if hashlib.sha256(data).hexdigest()!=PIN:raise ValueError('Arrival persistence requires the pinned DirectDraw executable')
 spec=importlib.util.spec_from_file_location('departure',ROOT/'scripts/audit-native-actor-departure.py');prior=importlib.util.module_from_spec(spec);spec.loader.exec_module(prior);previous=prior.audit(executable)
 pe=pefile.PE(data=data);base=pe.OPTIONAL_HEADER.ImageBase;decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32);ranges=[];decoded={}
 for label,start,end in [('original-list-node-insertion',0x63a310,0x63a367),('original-agent-reference-copy',0x6258d0,0x6258ee)]:
  raw=pe.get_data(start-base,end-start);rows=[dict(address=f'{i.address:08x}',bytes=i.bytes.hex(),mnemonic=i.mnemonic,operands=i.op_str)for i in decoder.disasm(raw,start)]
  if sum(len(bytes.fromhex(r['bytes']))for r in rows)!=len(raw)or rows[-1]['mnemonic']!='ret':raise ValueError('Incomplete pinned roster method')
  ranges.append(dict(label=label,start=f'{start:08x}',end=f'{end:08x}',instructions=rows));decoded.update({r['address']:r for r in rows})
 switch=list(struct.unpack('<11I',pe.get_data(0x639d60-base,44)))
 if switch[4]!=0x639c06:raise ValueError('Unexpected list append operation')
 if struct.unpack('<I',pe.get_data(0x68c054+0x18-base,4))[0]!=0x6258d0:raise ValueError('Unexpected type-5 value copy')
 for address,mnemonic,operands in [('0063a31e','call','0x64c616'),('0063a33b','mov','dword ptr [esi + 4], eax'),('0063a341','mov','dword ptr [ecx], eax'),('0063a358','mov','dword ptr [ebx + 8], ecx'),('0063a364','ret','0xc'),('006258df','mov','dword ptr [esi + 8], ecx'),('006258e5','mov','dword ptr [esi + 0xc], edx'),('006258eb','ret','4')]:
  if(decoded[address]['mnemonic'],decoded[address]['operands'])!=(mnemonic,operands):raise ValueError('Unexpected roster instruction '+address)
 return dict(executableSha256=PIN,ranges=ranges,listAppendOperation=4,listOperatorSwitch=switch,type5CopyVirtualSlot=dict(table='0068c054',slot=24,target='006258d0'),previousDepartureInstructions=sum(len(r['instructions'])for r in previous['ranges']),contracts={'append':'Original GPL list operator 4 allocates a new pooled value of operand type, copies it through virtual +18, and inserts a node before its sentinel. Each destination roster owns a separate value; caller returns only its independent operand.'},limitations='Native trusted destination persistence diagnostic; runtime ownership, original full checkpoint reload and two-world recovery remain separate qualification requirements.')
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--exe',type=Path,default=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe');p.add_argument('--output',type=Path,default=ROOT/'output/native-arrival-persistence-audit.json');a=p.parse_args();r=audit(a.exe);a.output.write_text(json.dumps(r,indent=2)+'\n');print('Pinned arrival roster insertion;',sum(len(x['instructions'])for x in r['ranges']),'additional instructions')
if __name__=='__main__':main()

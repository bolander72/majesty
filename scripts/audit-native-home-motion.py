#!/usr/bin/env python3
"""Pin the original per-owner command-dispatch gate without modifying orders."""
import argparse,hashlib,json,struct
from pathlib import Path
import capstone,pefile
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
def audit():
 raw=(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
 if hashlib.sha256(raw).hexdigest()!=PIN:raise ValueError('Pinned executable required')
 pe=pefile.PE(data=raw);base=pe.OPTIONAL_HEADER.ImageBase;d=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
 start,end=0x5e53c0,0x5e53f6;ins=list(d.disasm(pe.get_data(start-base,end-start),start))
 if sum(i.size for i in ins)!=end-start or ins[-1].mnemonic!='ret' or ins[-1].op_str!='4':raise ValueError('Incomplete original dispatch')
 rows=[dict(address=f'{i.address:08x}',mnemonic=i.mnemonic,operands=i.op_str,bytes=i.bytes.hex())for i in ins];by={r['address']:r for r in rows}
 checks=[('005e53c0','mov','eax, dword ptr [esp + 4]'),('005e53cb','mov','edx, dword ptr [0x71c6a8]'),('005e53d2','mov','esi, dword ptr [eax + 8]'),('005e53d5','sub','edx, esi'),('005e53e9','push','ecx'),('005e53ea','mov','ecx, dword ptr [ecx + 4]'),('005e53f0','call','dword ptr [edx + 0x18]'),('005e53f3','ret','4')]
 for a,m,o in checks:
  if (by[a]['mnemonic'],by[a]['operands'])!=(m,o):raise ValueError('Changed dispatch anchor '+a)
 if struct.unpack('<I',pe.get_data(0x683148+0x50-base,4))[0]!=start:raise ValueError('Changed processor virtual slot')
 return dict(version=1,executableSha256=PIN,instructions=rows,checkedInstructions=[by[a]for a,_,_ in checks],processorTable='00683148',dispatchSlot=80,ownerUnitOffset=4,stackArgumentBytes=4,finding='Common command dispatch receives the order on its stack and the owner unit through processor+4. A per-owner void return can hold dispatch without clearing banks or resetting a GPL task. Absolute command ages still advance with the shared world clock; arbitrary-duration suspension or migration requires separate clock coordination.',browserUsed=False,nativeProcessesStarted=0,remoteTravelQualified=False)
def main():
 p=argparse.ArgumentParser(description=__doc__);g=p.add_mutually_exclusive_group(required=True);g.add_argument('--output',type=Path);g.add_argument('--verify-report',type=Path);a=p.parse_args();r=audit()
 if a.verify_report:
  if a.verify_report.stat().st_size>16384 or json.loads(a.verify_report.read_text())!=r:raise ValueError('Audit differs')
 else:
  with a.output.open('x')as f:json.dump(r,f,indent=2);f.write('\n')
 print('Pinned original per-owner command dispatch and RET4.')
if __name__=='__main__':main()

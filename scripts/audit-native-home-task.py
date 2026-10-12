#!/usr/bin/env python3
"""Pin the original per-agent scheduler and typed home-task read layouts."""
import argparse,hashlib,json
from pathlib import Path
import capstone,pefile
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
def audit():
 b=(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
 if hashlib.sha256(b).hexdigest()!=PIN:raise ValueError('Pinned executable required')
 p=pefile.PE(data=b);base=p.OPTIONAL_HEADER.ImageBase;d=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32);ranges=[];decoded={}
 for label,start,end in [('agent-script-invocation',0x626cf0,0x626daf),('function-dispatch',0x6381b0,0x6381c9),('context-execution',0x639220,0x6392eb),('attribute-tree-lookup',0x627d10,0x627d6a),('string-value-constructor',0x629e50,0x629ed8)]:
  ins=list(d.disasm(p.get_data(start-base,end-start),start))
  if not ins or ins[-1].address+ins[-1].size!=end or ins[-1].mnemonic!='ret':raise ValueError('Incomplete range '+label)
  rows=[dict(address=f'{i.address:08x}',mnemonic=i.mnemonic,operands=i.op_str,bytes=i.bytes.hex()) for i in ins];decoded.update({r['address']:r for r in rows});ranges.append(dict(label=label,start=f'{start:08x}',end=f'{end:08x}',instructions=rows))
 checks=[('00626cf4','mov','al, byte ptr [edi + 0x30]'),('00626d05','mov','dword ptr [0x720304], edi'),('00626d3c','mov','ecx, dword ptr [esi + 0x14]'),('00626d4d','call','0x639220'),('00626dac','ret','8'),('006381bb','add','eax, 0x14'),('006381c0','call','dword ptr [ecx + 0x14]'),('006381c6','ret','4'),('0063927a','mov','byte ptr [esi + 0x44], 1'),('006392c4','mov','ecx, dword ptr [esi + 8]'),('006392c7','lea','eax, [esi + 0x10]'),('006392cb','call','0x6381b0'),('006392d0','mov','dword ptr [esi + 0x38], edi'),('006392d3','mov','byte ptr [esi + 0x44], bl'),('00629e76','lea','edi, [esi + 8]'),('00629e9c','mov','dword ptr [esi + 4], 3')]
 for a,mnemonic,ops in checks:
  if (decoded[a]['mnemonic'],decoded[a]['operands'])!=(mnemonic,ops):raise ValueError('Instruction changed '+a)
 return dict(version=2,executableSha256=PIN,ranges=ranges,checkedInstructions=[decoded[a] for a,_,_ in checks],finding='Dispatch receives the current registry function and returns with four argument bytes. Skipping that body allows the original context caller to update last tick and clear its running flag. After this cleanup, whole agent invocations can be held with the original eight-byte return before subsequent context execution. This establishes a script gate, not a physical actor freeze or remote travel.',browserUsed=False,nativeProcessesStarted=0,remoteTravelQualified=False)
def main():
 p=argparse.ArgumentParser(description=__doc__);m=p.add_mutually_exclusive_group(required=True);m.add_argument('--output',type=Path);m.add_argument('--verify-report',type=Path);a=p.parse_args();r=audit()
 if a.verify_report:
  if a.verify_report.stat().st_size>65536 or json.loads(a.verify_report.read_text())!=r:raise ValueError('Audit differs')
 else:
  with a.output.open('x') as f:json.dump(r,f,indent=2);f.write('\n')
 print('Pinned original hero script hold and resume boundary.')
if __name__=='__main__':main()

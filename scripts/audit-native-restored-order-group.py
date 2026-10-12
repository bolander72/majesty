#!/usr/bin/env python3
"""Pin original restored-bank admission and normal update dispatch."""
import argparse,hashlib,json,struct
from pathlib import Path
import capstone,pefile
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
def audit():
 b=(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes()
 if hashlib.sha256(b).hexdigest()!=PIN:raise ValueError('Pinned executable required')
 p=pefile.PE(data=b);base=p.OPTIONAL_HEADER.ImageBase;d=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
 ranges=[];by={}
 for name,start,end in [('unit-group-notification',0x5b66f0,0x5b670f),('registry-specific-refresh',0x596a70,0x596acd),
                       ('orders-membership-predicate',0x5f2920,0x5f294a),('unit-bank-dispatch',0x5b2ee0,0x5b2f18),
                       ('orders-group-frame-update',0x5d9740,0x5d9784),('all-bank-update',0x5b2f20,0x5b2f3a)]:
  ins=list(d.disasm(p.get_data(start-base,end-start),start))
  if sum(i.size for i in ins)!=end-start or ins[-1].mnemonic!='ret':raise ValueError('Incomplete '+name)
  rows=[dict(address=f'{i.address:08x}',mnemonic=i.mnemonic,operands=i.op_str,bytes=i.bytes.hex()) for i in ins]
  by.update({r['address']:r for r in rows});ranges.append(dict(name=name,start=f'{start:08x}',end=f'{end:08x}',instructions=rows))
 checks=[('005b6707','call','0x596a70'),('005f2929','call','dword ptr [eax + 0x194]'),
         ('005f2933','mov','ecx, dword ptr [esi + 0x40]'),('005f293d','mov','dword ptr [esi + 0x40], ecx'),
         ('005d975b','call','dword ptr [edx + 0x19c]'),('005b2f2b','call','dword ptr [eax + 0x198]'),
         ('005b2efb','call','dword ptr [edx + 0x1c]')]
 for a,m,o in checks:
  if (by[a]['mnemonic'],by[a]['operands'])!=(m,o):raise ValueError('Changed original instruction '+a)
 slots=[]
 for table,slot,target in [(0x68098c,0xa4,0x5b66f0),(0x68098c,0x198,0x5b2ee0),(0x68098c,0x19c,0x5b2f20),(0x683148,0x1c,0x5e5250)]:
  if struct.unpack('<I',p.get_data(table+slot-base,4))[0]!=target:raise ValueError('Changed original virtual slot')
  slots.append(dict(table=f'{table:08x}',slot=slot,target=f'{target:08x}'))
 return dict(version=1,executableSha256=PIN,ranges=ranges,checkedInstructions=[by[a] for a,_,_ in checks],slots=slots,
  finding='Original unit group notification refreshes one registry kind. ORDR membership tests nonempty banks and sets the derived UNIT+40 marker. Normal group frame update dispatches all bank updates through original virtual methods. Reading serialized banks alone does not establish runtime group membership. Live execution and effect retirement require separate observed evidence.',browserUsed=False,nativeProcessesStarted=0)
def main():
 p=argparse.ArgumentParser(description=__doc__);g=p.add_mutually_exclusive_group(required=True);g.add_argument('--output',type=Path);g.add_argument('--verify-report',type=Path);a=p.parse_args();r=audit()
 if a.verify_report:
  if a.verify_report.stat().st_size>65536 or json.loads(a.verify_report.read_text())!=r:raise ValueError('Audit differs')
 else:
  with a.output.open('x') as f:json.dump(r,f,indent=2);f.write('\n')
 print('Pinned restored command-group notification and normal dispatch.')
if __name__=='__main__':main()

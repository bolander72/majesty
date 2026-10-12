#!/usr/bin/env python3
"""Pin original GPL validity and the SDK home-task rejection boundary."""
import argparse,hashlib,json,struct
from pathlib import Path
import capstone,pefile
ROOT=Path(__file__).resolve().parents[1]
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
def audit():
 game=ROOT/'upstream/majesty-recomp/original/gog';data=(game/'MajestyHD - Old.exe').read_bytes()
 if hashlib.sha256(data).hexdigest()!=PIN:raise ValueError('Pinned executable required')
 pe=pefile.PE(data=data);base=pe.OPTIONAL_HEADER.ImageBase;decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
 ranges=[];decoded={}
 for label,start,end in [('reference-constructor',0x6254c0,0x62551d),('reference-gamepiece-validity',0x625580,0x6255d5),('agent-native-association',0x626310,0x62633c),('builtin-is-valid-gamepiece',0x5a8a80,0x5a8aac),('reference-self',0x625e40,0x625e43)]:
  ins=list(decoder.disasm(pe.get_data(start-base,end-start),start))
  if not ins or ins[-1].address+ins[-1].size!=end or ins[-1].mnemonic!='ret':raise ValueError(f'Incomplete original method {label}')
  records=[dict(address=f'{i.address:08x}',mnemonic=i.mnemonic,operands=i.op_str,bytes=i.bytes.hex()) for i in ins];decoded.update({i['address']:i for i in records});ranges.append(dict(label=label,start=f'{start:08x}',end=f'{end:08x}',instructions=records))
 checks=[('006254ea','mov','dword ptr [esi], 0x68c054'),('006254f0','mov','dword ptr [esi + 4], 5'),('006254ff','mov','ecx, eax'),('0062558e','call','0x6236b0'),('0062559a','mov','cl, byte ptr [eax + 0x28]'),('006255c1','call','0x626310'),('006255c8','je','0x6255d1'),('006255d1','xor','eax, eax'),('00626324','mov','eax, dword ptr [esi + 0x20]'),('00626329','jle','0x626337'),('0062632f','call','0x5a10d0'),('005a8a94','call','dword ptr [eax + 0x5c]'),('005a8a99','call','0x625580')]
 for addr,mnemonic,operands in checks:
  if (decoded[addr]['mnemonic'],decoded[addr]['operands'])!=(mnemonic,operands):raise ValueError('Original instruction differs '+addr)
 slot=struct.unpack('<I',pe.get_data(0x68c054+0x5c-base,4))[0]
 if slot!=0x625e40:raise ValueError('Original reference virtual slot differs')
 # Registration must map the original name to the exact callback above.
 raw=pe.get_data(0x5aa98c-base,0x33)
 ins=list(decoder.disasm(raw,0x5aa98c))
 if not any(i.mnemonic=='push' and i.op_str=='0x5a8a80' for i in ins) or pe.get_data(0x6cdf28-base,17)!=b'IsValidGamePiece\0':raise ValueError('Builtin registration differs')
 sdk={}
 for path in ['SDK/OriginalQuests/GPLMx/mx_LowLevel.gpl','SDK/OriginalQuests/GPL/LowLevel.gpl','SDK/OriginalQuests/GPLMx/DecisionTrees/Modules/mx_go_home.gpl','SDK/OriginalQuests/GPLMx/TaskModules/Characters/mx_Use_Building.gpl']:
  b=(game/path).read_bytes();s=b.decode('utf8').lower();sdk[path]=dict(sha256=hashlib.sha256(b).hexdigest(),bytes=len(b))
  if path.endswith('LowLevel.gpl'):
   f=s[s.index('function isdead('):];f=f[:f.index('\nend')]
   if f.index('$isvalidgamepiece')>f.index('return true'):raise ValueError('IsDead rejection order differs')
  elif 'go_home.gpl' in path:
   if '"activescript" = $use_building' not in s or '"target" = thisagent\'s "home"' not in s:raise ValueError('Go-home task binding differs')
  elif '$isdead(target)' not in s or '$reset_tasks(thisagent)' not in s:raise ValueError('Use-building rejection differs')
 return dict(version=1,executableSha256=PIN,ranges=ranges,checkedInstructions=[decoded[a] for a,_,_ in checks],referenceVirtualSlot=dict(table='0068c054',slot=92,target='00625e40'),sdk=sdk,finding='A positive registered GPL identity with no native object fails original IsValidGamePiece. Original SDK IsDead then returns true, and use_building resets the task. A remote home requires a travel-aware script boundary before this rejection; a pure GPL alias alone is insufficient.',nativeProcessesStarted=0,browserUsed=False,remoteHomeQualified=False)
def main():
 p=argparse.ArgumentParser(description=__doc__);m=p.add_mutually_exclusive_group(required=True);m.add_argument('--output',type=Path);m.add_argument('--verify-report',type=Path);a=p.parse_args();r=audit()
 if a.verify_report:
  if a.verify_report.stat().st_size>65536 or json.loads(a.verify_report.read_text())!=r:raise ValueError('Audit differs')
 else:
  with a.output.open('x') as f:json.dump(r,f,indent=2);f.write('\n')
 print('Pinned original validity boundary and SDK task guards; remote home remains unqualified.')
if __name__=='__main__':main()

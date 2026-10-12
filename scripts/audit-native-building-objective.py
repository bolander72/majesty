#!/usr/bin/env python3
"""Pin original registry, ownership, construction and attribute readers."""
import argparse,hashlib,json,runpy,struct
from pathlib import Path
import capstone
ROOT=Path(__file__).resolve().parents[1]
previous=runpy.run_path(str(ROOT/'scripts/audit-native-palace-death.py'))
audit=previous['audit'];PIN=previous['PIN']
FRAGMENTS={key:previous['FRAGMENTS'][key] for key in ['palaceLookup','attributeRead','hpDeathScript']}
FRAGMENTS['palaceLookup'][2][0x42ceec]=('mov','ecx, dword ptr [eax + 0x6c]')
FRAGMENTS['constructionAttribute']=(0x419dc0,0x419e2a,{0x419de6:('push','1'),0x419de8:('push','0x42'),0x419dea:('push','0x50'),0x419df0:('push','0x41'),0x419dfb:('call','0x59a100'),0x419e09:('mov','dword ptr [0x6d77b8], eax')})
FRAGMENTS['registryLookup']=(0x5969a0,0x5969e6,{0x5969b0:('call','0x596c10'),0x5969bb:('mov','ecx, dword ptr [esi + 4]'),0x5969c6:('mov','esi, dword ptr [eax + 8]'),0x5969c9:('cmp','dword ptr [esi + 4], edx'),0x5969ce:('mov','eax, dword ptr [eax]'),0x5969db:('mov','eax, dword ptr [eax + 8]'),0x5969de:('ret','8')})
FRAGMENTS['attributePacking']=(0x59a17b,0x59a19f,{0x59a17b:('mov','esi, dword ptr [esp + 0x4c]'),0x59a183:('shl','esi, 8'),0x59a18a:('or','esi, ecx'),0x59a191:('shl','esi, 8'),0x59a194:('or','esi, ebx'),0x59a19a:('shl','esi, 8'),0x59a19d:('or','esi, edx')})
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for block in iter(lambda:f.read(4096),b''):h.update(block)
 return h.hexdigest()
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 if a.output.exists():raise ValueError('Preserve previous audit')
 image=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
 assert sha(image)==PIN
 evidence={};controls=[]
 with image.open('rb') as f:
  header=f.read(4096);pe=struct.unpack_from('<I',header,60)[0]
  assert header[:2]==b'MZ' and header[pe:pe+4]==b'PE\0\0'
  count=struct.unpack_from('<H',header,pe+6)[0];opt=struct.unpack_from('<H',header,pe+20)[0]
  assert struct.unpack_from('<H',header,pe+4)[0]==0x14c and count<=16
  sections=[struct.unpack_from('<IIII',header,pe+24+opt+40*i+8) for i in range(count)]
  for name,(start,end,required) in FRAGMENTS.items():
   section=next(s for s in sections if s[1]<=start-0x400000 and end-0x400000<=s[1]+s[2]);f.seek(section[3]+start-0x400000-section[1]);raw=f.read(end-start)
   assert len(raw)==end-start;evidence[name]=audit(raw,start,required)
   instructions={i.address:i for i in capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32).disasm(raw,start)}
   for address in required:
    changed=bytearray(raw);at=address-start+instructions[address].size-1;changed[at]^=1
    try:audit(changed,start,required)
    except AssertionError:controls.append({'fragment':name,'address':hex(address),'refused':True})
    else:raise AssertionError('Altered instruction accepted')
 xml=ROOT/'upstream/majesty-recomp/original/gog/SDK/OriginalQuests/Data/M_Buildings.xml'
 assert xml.stat().st_size<=1024*1024
 text=xml.read_text();assert 'ID="ABV1" Name="Warriors_Guild"' in text and 'ID="ABP1" Name="Temple_Dauros1"' in text
 report={'version':1,'qualified':True,'pinnedExecutableSha256':PIN,'fragments':evidence,'controls':controls,
  'buildingData':{'filename':str(xml),'sha256':sha(xml),'guildTag':'ABV','templeTag':'ABP'},
  'constructionAttribute':'01425041','nativeGameplayQualified':False,'cooperativeChapterQualified':False,
  'scriptSha256':sha(Path(__file__))}
 with a.output.open('x') as f:json.dump(report,f,indent=2);f.write('\n')
 print(json.dumps({'qualified':True,'fragments':len(evidence),'controls':len(controls)}))
if __name__=='__main__':main()

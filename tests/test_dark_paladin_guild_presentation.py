from pathlib import Path
import struct,sys,unittest
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'scripts'),str(ROOT/'third_party/majesty-mod-manager/src')]
from majesty_cam.cam import CamArchive,CamSection,CamEntry
from majesty_cam.strt import StrtTable,StrtRecord,parse_strt
from lib.dark_paladin_guild_presentation import LEVEL_NAMES,label_levels,label_descriptions,label_panels
from lib.community_more_heroes_retirement import chunk
from lib.legacy_description_wire import unit_parts,unpack_chunk

def entry(name,data):return CamEntry(name.ljust(20,b'\0'),data)
class GuildPresentation(unittest.TestCase):
 def test_full_literal_tier_names_and_stock_strings(self):
  records=[StrtRecord(int.from_bytes(k,'little'),b'old label')for k in LEVEL_NAMES]+[StrtRecord(7,b'Blacksmith Level 3')]
  a=CamArchive((CamSection(b'STRT',(entry(b'UNTN',StrtTable(b'\0\0',tuple(records)).to_bytes()),)),))
  out=parse_strt(label_levels(a).sections[0].entries[0].data).records
  self.assertEqual([r.text for r in out[:3]],[b"Dark Paladin's Guild",b"Dark Paladin's Guild Level 2",b"Dark Paladin's Guild Level 3"]);self.assertEqual(out[-1],records[-1])
 def test_descriptor_rename_preserves_internal_ids_attributes_and_callbacks(self):
  units=[]
  for key in LEVEL_NAMES:
   head=key+struct.pack('<I',2)+b'legacy_internal_domain\0old label\0'
   body=chunk(b'HEAD',0,0,head)+chunk(b'PRIM',4,0,b'unchanged native image/audio')+chunk(b'SECD',5,0,b'unchanged stats/costs/callbacks')
   units.append(entry(key,chunk(b'DUNT',0,1,chunk(b'DATA',0,3,body))))
  a=CamArchive((CamSection(b'DUNT',tuple(units)),));b=label_descriptions(a)
  for x,y in zip(a.sections[0].entries,b.sections[0].entries):
   self.assertEqual(unit_parts(x.data)[1:],unit_parts(y.data)[1:]);h=unpack_chunk(unit_parts(y.data)[0])[3];self.assertEqual(h[8:].split(b'\0')[0],b'legacy_internal_domain');self.assertEqual(h[8:].split(b'\0')[1],LEVEL_NAMES[x.name[:4]])
 def test_native_panel_commands_and_unrelated_help_are_unchanged(self):
  records=(StrtRecord(0,b"DARK PALADIN'S DOMAIN"),StrtRecord(1,b'RECRUIT Dark Paladin'),StrtRecord(3,b'Destroy this Domain.'))
  text=entry(b'CGDP',StrtTable(b'\0\0',records).to_bytes());commands=entry(b'CGDP',b'safe existing AP06 Heroes controls')
  a=CamArchive((CamSection(b'STRT',(text,)),CamSection(b'SMNU',(commands,))))
  b=label_panels(a);self.assertEqual(a.sections[1],b.sections[1]);out=parse_strt(b.sections[0].entries[0].data).records;self.assertEqual(out[0].text,b"DARK PALADIN'S GUILD");self.assertEqual(out[1],records[1])
if __name__=='__main__':unittest.main()

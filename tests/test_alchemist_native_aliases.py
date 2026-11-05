import importlib.util
from pathlib import Path
import struct
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('native_aliases',ROOT/'scripts/alias-alchemist-native-buildings.py')
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
from majesty_cam.cam import CamArchive,CamSection,CamEntry,read_cam
from majesty_cam.strt import StrtRecord,StrtTable,parse_strt
from lib.legacy_description_wire import unit_parts

class NativeAliasesTests(unittest.TestCase):
 def descriptor(self):
  def block(tag,payload,count=0):return struct.pack('<4sIII',tag,len(payload),0,count)+payload
  head=block(b'HEAD',b'ALB1'+struct.pack('<I',2)+b'AlchemistsLaboratory1\0Alchemy Lab\0')
  primary=block(b'PRIM',b'ALB1 original art/audio/geometry')
  secondary=block(b'SECD',b'CG01'+struct.pack('<I',1400)+b'ALB2'+bytes(44)+struct.pack('<IIII',1,0,1,1)+b'ALC1')
  return block(b'DUNT',block(b'DATA',head+primary+secondary,3),1)
 def test_retired_lodge_ids_are_not_reused(self):
  self.assertTrue(set(a.ALIASES.values()).isdisjoint({b'ABs1',b'ABs2',b'ABs3'}))
 def test_changes_only_identity_and_upgrade_links(self):
  raw=self.descriptor();updated=a.unit(raw,b'ALB1');old=unit_parts(raw);new=unit_parts(updated)
  self.assertEqual(new[0][16:20],b'ABx1');self.assertEqual(new[0][20:],old[0][20:])
  self.assertEqual(new[1],old[1]);self.assertEqual(new[2][24:28],b'ABx2')
  self.assertEqual(new[2][:24],old[2][:24]);self.assertEqual(new[2][28:],old[2][28:])
 def test_stock_rogues_descriptor_is_preserved(self):
  stock=CamEntry(b'ABX1'.ljust(20,b'\0'),b'original stock Rogues Guild')
  authored=CamEntry(b'ALB1'.ljust(20,b'\0'),self.descriptor())
  raw,changed=a.archive(CamArchive((CamSection(b'DUNT',(stock,authored)),)))
  entries=read_cam(raw).sections[0].entries
  self.assertEqual((entries[0].name,entries[0].data),(stock.name,stock.data))
  self.assertEqual(entries[1].name[:4],b'ABx1')
  self.assertEqual(changed,['ALB1'])
 def test_occupied_native_alias_refused(self):
  archive=CamArchive((CamSection(b'DUNT',(CamEntry(b'ABx1'.ljust(20,b'\0'),b'occupied'),)),))
  with self.assertRaisesRegex(ValueError,'occupied'):a.archive(archive)
 def test_text_alias_preserves_authored_label_and_stock_rows(self):
  table=StrtTable(b'\0 ',(StrtRecord(1,b'Palace'),StrtRecord(int.from_bytes(b'ALB1','little'),b'Alchemy Lab')))
  archive=CamArchive((CamSection(b'STRT',(CamEntry(b'UNTN'.ljust(20,b'\0'),table.to_bytes()),)),))
  raw,_=a.archive(archive);rows=parse_strt(read_cam(raw).sections[0].entries[0].data).records
  self.assertEqual([(r.string_id,r.text)for r in rows],[(1,b'Palace'),(int.from_bytes(b'ABx1','little'),b'Alchemy Lab')])
 def test_dependency_alias_changes_only_authored_key(self):
  body=b'ABJ2 : ABJ1\r\nALB1 : ABJ2 ABJ3 NOT NOT ||\r\n\r\n'
  archive=CamArchive((CamSection(b'DATA',(CamEntry(b'BDEP'.ljust(20,b'\0'),body),)),))
  raw,_=a.archive(archive);self.assertEqual(read_cam(raw).sections[0].entries[0].data,body.replace(b'ALB1 :',b'ABx1 :'))

if __name__=='__main__':unittest.main()

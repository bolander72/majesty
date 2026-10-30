from pathlib import Path
import struct
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'scripts'),str(ROOT/'third_party/majesty-mod-manager/src')]
from majesty_cam.cam import CamArchive,CamSection,CamEntry
from majesty_cam.strt import StrtTable,StrtRecord,parse_strt
from lib.dark_paladin_tier_presentation import label_levels,label_descriptions,additive_upgrades,LEVEL_NAMES
from lib.legacy_description_wire import unit_parts,unpack_chunk
from lib.community_more_heroes_retirement import chunk


def entry(name,data):return CamEntry(name.ljust(20,b'\0'),data)


class TierPresentation(unittest.TestCase):
    def test_labels_identify_every_tier_and_leave_stock_names_and_panel_text_unchanged(self):
        stock=StrtRecord(int.from_bytes(b'ABK3','little'),b'Blacksmith Level 3')
        records=(stock,*[StrtRecord(int.from_bytes(k,'little'),b"Dark Paladin's Domain")for k in LEVEL_NAMES])
        table=StrtTable(b'\0\0',records).to_bytes();panel=entry(b'CGDP',b'unchanged native guild panel')
        old=CamArchive((CamSection(b'STRT',(entry(b'UNTN',table),panel)),))
        new=label_levels(old);result=parse_strt(new.sections[0].entries[0].data)
        self.assertEqual(result.records[0],stock)
        self.assertEqual(new.sections[0].entries[1],panel)
        self.assertEqual([r.text for r in result.records[1:]],[b"Dark Paladin's Domain",b'Dark Paladin Level 2',b'Dark Paladin Level 3'])
        self.assertEqual(parse_strt(old.sections[0].entries[0].data).records,records)

    def test_build_menu_descriptions_change_without_touching_ids_stats_or_engine_bindings(self):
        entries=[]
        for key in [b'AB21',b'AB22',b'AB23',b'ABP3']:
            head=key+struct.pack('<I',2)+b'internal_native_name\0'+(b"Dark Paladin's Domain"if key!=b'ABP3'else b'Temple to Dauros Level 3')+b'\0'
            parts=chunk(b'HEAD',0,0,head)+chunk(b'PRIM',4,0,b'unchanged image and sound')+chunk(b'SECD',5,0,b'unchanged price, health and capacity')
            entries.append(entry(key,chunk(b'DUNT',0,1,chunk(b'DATA',0,3,parts))))
        before=CamArchive((CamSection(b'DUNT',tuple(entries)),));after=label_descriptions(before)
        for old,new in zip(before.sections[0].entries,after.sections[0].entries):
            key=old.name[:4]
            self.assertEqual(unit_parts(old.data)[1:],unit_parts(new.data)[1:])
            if key in [b'AB21',b'ABP3']:self.assertEqual(old,new)
            else:
                head=unpack_chunk(unit_parts(new.data)[0])[3]
                self.assertEqual(head[:8],unpack_chunk(unit_parts(old.data)[0])[3][:8])
                self.assertEqual(head[8:].split(b'\0')[1],LEVEL_NAMES[key])

    def test_upgrade_frames_keep_previous_completed_building_and_native_flags(self):
        # Independent consumer contract: stages 80/81 retain the old completed
        # tier; stage 82 reveals the enlarged target. Initial construction stays.
        controls=b'native animation controls'
        images=[];refs={}
        for n in [1,2,3]:
            key=f'NDG{n}'.encode();body=controls+struct.pack('<4I',0x12000001,0x12000002,0x12000003,0x12000000+n*10)
            refs[key]=[SimpleNamespace(set_id=s,offset=len(controls)+i*4,flag_bits=0x12000000,tile_index=t)for i,(s,t)in enumerate([(80,1),(81,2),(82,3),(96,n*10)])]
            images.append(entry(key,body))
        tiles=CamSection(b'TILE',tuple(entry(struct.pack('<I',n),b'original pixels')for n in range(40)))
        old=CamArchive((CamSection(b'IMAG',tuple(images)),tiles))
        def parse(body,**kw):return SimpleNamespace(references=refs[kw['entry_name']])
        with patch('lib.dark_paladin_tier_presentation.parse_best_imag_tile_references',side_effect=parse):new=additive_upgrades(old)
        self.assertEqual(new.sections[1],tiles)
        self.assertEqual(new.sections[0].entries[0],images[0])
        for n in [2,3]:
            body=new.sections[0].entries[n-1].data
            self.assertEqual(body[:len(controls)],controls)
            self.assertEqual(struct.unpack_from('<4I',body,len(controls)),(0x12000000+(n-1)*10,0x12000000+(n-1)*10,0x12000000+n*10,0x12000000+n*10))


if __name__=='__main__':unittest.main()

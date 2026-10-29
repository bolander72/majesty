import sys, struct, unittest
from pathlib import Path
from types import SimpleNamespace as NS
from dataclasses import dataclass
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'scripts'),str(ROOT/'third_party/majesty-mod-manager/src')]
from lib.community_more_heroes_retirement import HERO_KEYS,BUILDING_KEYS,chunk,retire_buildings,restore_random_pool
from lib.legacy_description_wire import unit_parts,unpack_chunk
from lib.community_guild_source_resolutions import random_hero_function,STOCK_HEROES
from lib.community_expansion_source_resolutions import EXTRA_HEROES
@dataclass(frozen=True)
class Entry: name:bytes; data:bytes
@dataclass(frozen=True)
class Section: extension:bytes; entries:tuple
@dataclass(frozen=True)
class Archive: sections:tuple

def building(key,produces=(),flags=266):
    header=bytearray(56);struct.pack_into('<I',header,40,flags)
    sec=chunk(b'SECD',5,0,header+struct.pack('<IIII',1,0,1,len(produces))+b''.join(p.encode()for p in produces))
    return Entry(key.encode(),chunk(b'DUNT',0,1,chunk(b'DATA',0,3,
        chunk(b'HEAD',0,0,b'preserved-name')+chunk(b'PRIM',0,0,b'preserved-art')+sec)))

class RetirementTests(unittest.TestCase):
    def test_only_admissions_change_and_all_records_remain(self):
        keys=sorted(BUILDING_KEYS);heroes=sorted(HERO_KEYS)
        entries=tuple(building(k,[heroes[i%13]])for i,k in enumerate(keys))
        stock=building('ABx1',['ALC1']);embassy=building('ABr1',['ALC1',*heroes])
        a=Archive((Section(b'DUNT',(*entries,stock,embassy)),))
        result,proof=retire_buildings(a)
        self.assertEqual(len(result.sections[0].entries),len(a.sections[0].entries))
        self.assertEqual(result.sections[0].entries[-2],stock)
        for old,new in zip(entries,result.sections[0].entries):
            x,y=unit_parts(old.data),unit_parts(new.data)
            self.assertEqual(x[:2],y[:2])
            payload=unpack_chunk(y[2],b'SECD')[3]
            self.assertEqual(struct.unpack_from('<I',payload,40)[0],267)
            self.assertEqual(struct.unpack_from('<I',payload,68)[0],0)
        payload=unpack_chunk(unit_parts(result.sections[0].entries[-1].data)[2],b'SECD')[3]
        self.assertEqual(payload[72:],b'ALC1')
        self.assertEqual(set(proof['blockedBuildings']),BUILDING_KEYS)
        with self.assertRaisesRegex(ValueError, "all 13 retired hero"):
            retire_buildings(result)
    def test_incomplete_retirement_is_rejected(self):
        with self.assertRaisesRegex(ValueError,'Missing retired buildings'):
            retire_buildings(Archive((Section(b'DUNT',(building('AB01',['AV01']),)),)))
    def test_pool_restores_earlier_community_guards_and_leaves_other_bodies(self):
        active=(*STOCK_HEROES,'Phantom','Alchemist')
        old=random_hero_function((*active,*EXTRA_HEROES));base=random_hero_function(active,tuple(t for t in active if t!='Paladin'))
        old+=old.replace('Function Random_Hero_Type','Function MJC_Random_Hero_Type')
        base+=base.replace('Function Random_Hero_Type','Function MJC_Random_Hero_Type')
        tail='\nfunction Existing_Hero_AI(agent Hero)\ndeclare\nbegin\nreturn;\nend\n'
        out=restore_random_pool(old+tail,base)
        self.assertIn(tail,out);self.assertNotIn('"Necromancer"',out)
        self.assertIn('"Phantom"',out);self.assertIn('"Alchemist"',out)
        self.assertIn('$Phantom_Player_Has_Placed_Haunt',out)

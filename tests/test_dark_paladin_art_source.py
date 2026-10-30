import importlib.util
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('dark_paladin_source',ROOT/'scripts/prepare-dark-paladin-gpl.py')
policy=importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)


def fixture():
    birth='''function Dark_Paladin_Birth(agent ThisAgent)
declare
begin
    $SetDrawEffects (ThisAgent, "gray", 0);
    $hero_birth(ThisAgent);
end
'''
    building='''function MHB_Birth(agent ThisAgent)
declare
begin
    if ( ThisAgent's "Title" == "Necromancer_Abode")
        begin $SetDrawEffects (ThisAgent, "gray", 0); end
    else if ( ThisAgent's "Title" == "Dark_Paladin_Domain")
        begin $SetDrawEffects (ThisAgent, "gray", 0); $guild_birth(ThisAgent); end
end
'''
    morph='''function Morph_Begin(agent ThisAgent)
declare
    string title;
begin
    if ( title == "Dark_Paladin")
        begin
            $SetAttribute(ThisAgent, #ATTRIB_WeaponTypeIndex, 6);
            $SetDrawEffects (ThisAgent, "gray", 0);
            $LearnSpell(ThisAgent, "Vortex");
        end
end
'''
    status='''function GetProperUnitArt(agent ThisAgent)
declare
    string theColor;
begin
    $ClearDrawEffects(ThisAgent);
    if ($getattribute(ThisAgent, #ATTRIB_HasEffectPetrify) == 1)
        theColor = "gray";
    else if ($getattribute(ThisAgent, #ATTRIB_HasEffectCamouflage) == 1)
        theColor = "green";
    else if ( ThisAgent's "Title" == "Dark_Paladin")
        theColor = "gray";
    else if ( ThisAgent's "Title" == "Necromancer")
        theColor = "gray";
    else theColor = "none";
    $SetDrawEffects(ThisAgent, theColor, 0);
end
'''
    return birth+building+morph+status+status.replace('function GetProperUnitArt','function MJC_GetProperUnitArt')


class DarkPaladinSourceTests(unittest.TestCase):
    def test_only_five_class_cosmetic_values_change(self):
        original=fixture()
        updated,names=policy.remove_tint(original)
        self.assertEqual(len(names),5)
        self.assertEqual(updated.count('"none"')-original.count('"none"'),5)
        self.assertEqual(updated.replace('"none"','"gray"'),original.replace('"none"','"gray"'))
        self.assertIn('$SetAttribute(ThisAgent, #ATTRIB_WeaponTypeIndex, 6);',updated)
        self.assertIn('$LearnSpell(ThisAgent, "Vortex");',updated)
        for text in ['#ATTRIB_HasEffectPetrify) == 1)\n        theColor = "gray";',
                     '#ATTRIB_HasEffectCamouflage) == 1)\n        theColor = "green";',
                     '"Necromancer")\n        theColor = "gray";']:
            self.assertIn(text,updated)

    def test_unexpected_or_already_removed_tint_is_rejected(self):
        text=fixture().replace('$SetDrawEffects (ThisAgent, "gray", 0);',
                               '$SetDrawEffects (ThisAgent, "red", 0);',1)
        with self.assertRaisesRegex(ValueError,'exactly one Dark Paladin cosmetic tint'):
            policy.remove_tint(text)
        updated,_=policy.remove_tint(fixture())
        with self.assertRaises(ValueError):
            policy.remove_tint(updated)


if __name__=='__main__':unittest.main()

"""Recovery must preserve the observed mechanisms and reject another source shape."""
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'scripts'), str(ROOT / 'third_party/majesty-mod-manager/src')]
from lib.phantom_workshop_source import recover

PUBLIC = '''function Phantom_Icy_Touch_In_Range(agent thisagent, agent target) is boolean
declare begin
\tIf (
\t\ttarget's "attacktype" == 1 &&
\t\ttarget's "attack_action" == "basic_attack"
\t)
\t\treturn True;
\treturn False;
end
Function Phantom_Priestess_Assigned_To(agent Phantom) is boolean
Declare
\tlist Priestesses;
\tagent Priestess;
Begin
\tForeach Priestess in Priestesses do
\t\tIf ($IsDead(Priestess) == False)
\t\t\treturn True;
\treturn False;
End
'''
HERO = '[Phantom]\n\t{Hero\n\t\t(Friend\txx)\n\t}\n[end]\n'
PROTOTYPE = 'prototype Hero()\ndeclare\n\tstring title;\nbegin\nend\n'
GUILD = '''function Guild_Title(agent ThisAgent) is string
declare begin
 if (ThisAgent's "title" == "Paladin") return "Warriors_Guild";
 else if (ThisAgent's "title" == "Priestess") return "Temple_Krypta";
 return "No guild type found...";
end
'''
PROJECT = 'source="Phantom.gpl"\n'


class WorkshopRecoveryTests(unittest.TestCase):
    def test_original_kiting_and_guild_mechanisms_are_restored(self):
        files = recover(PUBLIC, HERO, PROTOTYPE, GUILD, PROJECT)
        main = files['Phantom.gpl'].decode()
        self.assertIn('return "Phantoms_Haunt";', main)
        self.assertIn('Should_Kite true', files['Phantom_Hero_Data.dat'].decode())
        self.assertIn('KitingTime 0', files['Phantom_Hero_Data.dat'].decode())
        self.assertIn('{Phantom_Hero', files['Phantom_Hero_Data.dat'].decode())
        self.assertIn('boolean Should_Kite;', files['Phantom_Hero_Prototype.gpl'].decode())
        self.assertIn('integer KitingTime;', files['Phantom_Hero_Prototype.gpl'].decode())
        self.assertIn('source="Phantom_Hero_Prototype.gpl"', files['Phantom.gplproj'].decode())

    def test_missing_attributes_are_guarded_before_access_and_foreach_has_no_return(self):
        main = recover(PUBLIC, HERO, PROTOTYPE, GUILD, PROJECT)['Phantom.gpl'].decode()
        self.assertLess(main.index('$HasAttribute("attacktype", target)'),
                        main.index('target\'s "attacktype"'))
        self.assertLess(main.index('$HasAttribute("attack_action", target)'),
                        main.index('target\'s "attack_action"'))
        priestess = main[main.index('Function Phantom_Priestess_Assigned_To'):main.index('function Guild_Title')]
        self.assertIn('Is_Assigned = False;', priestess)
        self.assertIn('Is_Assigned = True;', priestess)
        self.assertNotIn('return True;', priestess)
        self.assertIn('return Is_Assigned;', priestess)

    def test_already_changed_source_cannot_be_patched_blindly(self):
        changed = PUBLIC.replace('target\'s "attacktype" == 1 &&', 'target\'s "attacktype" == 2 &&')
        with self.assertRaisesRegex(ValueError, 'Unreviewed Phantom source shape'):
            recover(changed, HERO, PROTOTYPE, GUILD, PROJECT)


if __name__ == '__main__':
    unittest.main()

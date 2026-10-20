from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'scripts'), str(ROOT / 'third_party/majesty-mod-manager/src')]
from lib.community_fire_balm import fire_balm_support, patch_fire_balm_sources


class FireBalmTests(unittest.TestCase):
    def stock(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        (root / 'GPLMx').mkdir()
        text = '\n'.join(f'[{title}]\n {{Hero (special_attack_action {action})}}\n[end]'
            for title, action in [('Ranger', 'Fire_Ranger_Arrow'), ('Rogue', 'Fire_Bolt'),
                                  ('Elf', 'Fire_Elf_Arrow')])
        (root / 'GPLMx/mx_Hero_Data.dat').write_text(text)
        return root

    def test_uses_original_class_actions_and_initializes_only_a_missing_or_empty_field(self):
        support = fire_balm_support(self.stock(), set())
        self.assertEqual(support['scope'], 'Any')
        self.assertEqual(support['actions'], {'Ranger': 'Fire_Ranger_Arrow',
            'Rogue': 'Fire_Bolt', 'Elf': 'Fire_Elf_Arrow'})
        text = support['source']
        self.assertIn('$HasAttribute("Special_Attack_Action", ThisAgent) == False', text)
        self.assertIn('$AddAttribute(ThisAgent, "Special_Attack_Action", "string", Action)', text)
        self.assertIn('$GetAttribute(ThisAgent, #ATTRIB_HasEffectFireBalm) != 0', text)
        self.assertNotIn('prototype Hero', text)
        self.assertNotIn('"Healer"', text)
        self.assertNotIn('"Alchemist"', text)

    def test_changed_sdk_binding_and_helper_collision_are_refused(self):
        root = self.stock()
        with self.assertRaisesRegex(ValueError, 'occupied'):
            fire_balm_support(root, {'mcr_prepare_fire_balm'})
        path = root / 'GPLMx/mx_Hero_Data.dat'
        path.write_text(path.read_text().replace('Fire_Ranger_Arrow', 'ranger_arrow'))
        with self.assertRaisesRegex(ValueError, 'binding differs'):
            fire_balm_support(root, set())

    def sources(self):
        effects = ['Fire_balm_effect', 'Alchemist_Fire_Balm_Effect', 'MJC_Fire_balm_effect']
        validators = ['MM_BP_Validate_41303235', 'MM_BP_Validate_41505333']
        text = '\n'.join(f'function {name}(agent ThisAgent, agent Target) declare begin '
            'if ($MM_BP_Eligibility(ThisAgent, #Bazaar_Item_Two) == 0) return; '
            '$UnchangedOriginalEffect(ThisAgent); end' for name in effects)
        text += '\n' + '\n'.join(f'function {name}(agent ThisAgent) is integer declare begin '
            'if ($MM_BP_Eligibility(ThisAgent, #Bazaar_Item_Two) == 0) return 0; return 1; end'
            for name in validators)
        text += '\nfunction Other() declare begin $UnchangedOriginalEffect(a); end'
        return {'Any/Merged.gpl': text.encode(), 'Majesty/Other.gpl': b'// preserved'}

    def test_patches_original_and_aliased_entries_without_changing_effect_bodies(self):
        original = self.sources()
        updated, rows = patch_fire_balm_sources(original)
        self.assertEqual(len(rows), 5)
        self.assertEqual(updated['Majesty/Other.gpl'], original['Majesty/Other.gpl'])
        text = updated['Any/Merged.gpl'].decode()
        self.assertEqual(text.count('$UnchangedOriginalEffect(ThisAgent)'), 3)
        self.assertEqual(text.count('$MCR_Prepare_Fire_Balm(ThisAgent)'), 3)
        self.assertEqual(text.count('$MCR_Fire_Balm_Eligible(ThisAgent)'), 2)
        self.assertTrue(all(row['sha256'] != row['priorSha256'] for row in rows))
        self.assertIn('function Other() declare begin $UnchangedOriginalEffect(a); end', text)

    def test_missing_or_changed_entry_gate_is_refused(self):
        original = self.sources()
        with self.assertRaisesRegex(ValueError, 'entry gate differs'):
            patch_fire_balm_sources({k: v.replace(b'== 0', b'== 1') for k, v in original.items()})
        with self.assertRaisesRegex(ValueError, 'Incomplete'):
            patch_fire_balm_sources({'Any/Merged.gpl': b'function Other() declare begin end'})


if __name__ == '__main__':
    unittest.main()

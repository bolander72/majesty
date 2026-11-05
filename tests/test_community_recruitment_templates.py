import importlib.util
from pathlib import Path
import tomllib
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('recruitment_templates',
    ROOT / 'scripts/prepare-community-recruitment-templates.py')
templates = importlib.util.module_from_spec(spec)
spec.loader.exec_module(templates)
resources_spec = importlib.util.spec_from_file_location('guild_native_resources',
    ROOT / 'scripts/stage-community-guild-native-resources.py')
resources = importlib.util.module_from_spec(resources_spec)
resources_spec.loader.exec_module(resources)


class RecruitmentTemplateTests(unittest.TestCase):
    def test_actor_remapping_preserves_the_creators_recruitment_indices(self):
        heroes = ['BDT1', 'BDS1', 'BDD1']
        self.assertEqual(resources.verify_hero_order(heroes, resources.ACTOR_IDS),
                         ['BDD1', 'BDS1', 'BDT1'])
        self.assertEqual([resources.ACTOR_IDS[key] for key in ['BDD1', 'BDS1', 'BDT1']],
                         ['AVt1', 'AVu1', 'AVv1'])
        wrong = dict(resources.ACTOR_IDS, BDT1='AVt1', BDD1='AVv1')
        with self.assertRaisesRegex(ValueError, 'recruitment index order'):
            resources.verify_hero_order(heroes, wrong)

    def instructions(self):
        return {**templates.INDEX_ROLES, **templates.CONTROL_ROLES,
                0x00465AE5: 'cmp edi, 0x1f48'}

    def test_all_three_bindings_preserve_native_control_and_index_roles(self):
        for index, command, price in [(0, '0x1f48', '0x1752'), (1, '0x1389', '0x1f51'), (2, '0x1388', '0x7301')]:
            patches = templates.private_patches(self.instructions(), index, 29441)
            self.assertEqual(len(patches), 17)
            for patch in patches:
                if patch['role'] == 'native-produced-index':
                    self.assertEqual(patch['text'], f'PUSH 0x{index:x}')
                elif patch['role'] == 'native-price-control':
                    self.assertEqual(patch['text'], 'PUSH ' + price)
                elif patch['role'] == 'native-recruit-command':
                    self.assertEqual(patch['text'], 'PUSH ' + command)

    def test_changed_or_extra_original_roles_are_refused(self):
        wrong = self.instructions()
        wrong[0x00465923] = 'push ebx'
        with self.assertRaisesRegex(ValueError, 'index role'):
            templates.private_patches(wrong, 1, 29441)
        wrong = self.instructions()
        wrong[0x0046555B] = wrong.pop(0x0046555A)
        with self.assertRaisesRegex(ValueError, 'control set'):
            templates.private_patches(wrong, 1, 29441)
        for index in (-1, 3, True):
            with self.assertRaisesRegex(ValueError, 'binding'):
                templates.private_patches(self.instructions(), index, 29441)

    def test_curation_changes_only_private_patch_list_and_refuses_collisions(self):
        patches = templates.private_patches(self.instructions(), 2, 29441)
        text = '[translate]\ninstruction_patches = []\nother="preserved"\n'
        updated = templates.append_patches(text, patches)
        config = tomllib.loads(updated)
        self.assertEqual(config['translate']['other'], 'preserved')
        self.assertEqual(len(config['translate']['instruction_patches']), 17)
        with self.assertRaisesRegex(ValueError, 'collides'):
            templates.append_patches(updated, patches)

    def test_private_counts_and_no_call_to_arms_keep_native_base_delegates(self):
        original = {0x0047E8F0 + i: text for i, text in enumerate(
            ['push ebx', 'push ebp', 'push esi', 'push edi', 'call 0x481ec0'])}
        original.update({0x0047F1B0: 'push esi', 0x0047F55A: 'call 0x415b40'})
        patches = templates.common_patches(original)
        self.assertEqual(patches[4]['text'], 'RET 0x8')
        self.assertEqual(patches[5]['text'], 'JMP 0x00465aa0')
        self.assertEqual(patches[6]['text'], 'JMP 0x0047f60a')
        original[0x0047E8F1] = 'push edi'
        with self.assertRaisesRegex(ValueError, 'availability'):
            templates.common_patches(original)


if __name__ == '__main__':
    unittest.main()

import sys
from pathlib import Path
import unittest
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from lib.community_campaign_contract import audit_stage, validate

STOCK = '''prototype Guild()
declare
 integer max_members;
 list members;
begin
end
prototype hero()
declare
 float Enemy_estimation;
 agent target;
 function deathScript;
begin
end
'''
PRIVATE = (STOCK.replace('Guild()', 'Bards_Hall_Prototype()')
           .replace('hero()', 'Bards_Support_Hero()')
           + 'prototype Phantom_Hero()' + STOCK.split('prototype hero()', 1)[1])
XML = b'''<Majesty><Description Name="ActualAbility" Description="Readable text">
<Engine><Script cProc="0" GPLFunction="Ability_Effect"/></Engine>
<Game><ValidationScript value="Ability_Validate"/></Game>
</Description></Majesty>'''


class CampaignContractTests(unittest.TestCase):
    def check_valid(self, text=PRIVATE, functions=('Ability_Effect', 'Ability_Validate'), xml=XML):
        return validate(text, STOCK, functions, xml)

    def test_complete_contract_and_case_insensitive_callbacks(self):
        result = self.check_valid(functions=('ability_effect', 'ABILITY_VALIDATE'))
        self.assertEqual(len(result['prototypes']), 3)
        self.assertEqual(len(result['callbacks']), 2)
        self.assertTrue(result['originalCampaignContractPassed'])
        self.assertFalse(result['runtimeQualified'])

    def test_missing_legacy_capacity_is_rejected_even_when_commented(self):
        with self.assertRaisesRegex(ValueError, 'max_members'):
            self.check_valid(PRIVATE.replace('integer max_members;', '//integer max_members;'))

    def test_hero_missing_field_and_wrong_scalar_type_are_rejected(self):
        for before, after in [('agent target;', 'agent spare;'),
                              ('float Enemy_estimation;', 'integer Enemy_estimation;')]:
            with self.subTest(before=before), self.assertRaisesRegex(ValueError, 'prototype mismatch'):
                self.check_valid(PRIVATE.replace(before, after, 1))

    def test_unresolved_engine_callback_and_validator_are_both_rejected(self):
        for names in [('Ability_Effect',), ('Ability_Validate',)]:
            with self.subTest(names=names), self.assertRaisesRegex(ValueError, 'Unresolved'):
                self.check_valid(functions=names)

    def test_prose_does_not_become_callback_and_native_callback_is_not_gpl(self):
        xml = XML.replace(b'<Engine>', b'<Engine><Script cProc="1" GPLFunction="native_proc"/>')
        self.assertEqual(len(self.check_valid(xml=xml)['callbacks']), 2)

    def test_duplicate_prototype_and_duplicate_field_are_rejected(self):
        for text in [PRIVATE + PRIVATE, PRIVATE.replace('list members;', 'list members;\n list members;')]:
            with self.subTest(text=text), self.assertRaisesRegex(ValueError, 'prototype|duplicate'):
                self.check_valid(text)

    def test_unsafe_or_oversized_description_input_is_rejected(self):
        for xml in [b'<!DOCTYPE Majesty><Majesty/>', b'<!ENTITY foo "bar"><Majesty/>', b'x' * (2 * 1024 * 1024 + 1)]:
            with self.assertRaisesRegex(ValueError, 'bounded plain'):
                self.check_valid(xml=xml)

    def test_expansion_only_function_cannot_satisfy_base_callback(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            stock = root / 'stock/SDK/OriginalQuests/Gpl'
            stock.mkdir(parents=True)
            (stock / 'prototype.gpl').write_text(STOCK)
            source = root / 'stage'
            for scope in ('Any', 'Majesty', 'MajestyExpansion'):
                (source / 'sources' / scope).mkdir(parents=True)
            common = source / 'sources/Any/Merged.gpl'
            common.write_text(PRIVATE)
            callbacks = '''
function Ability_Effect(agent hero)
declare
begin
end
function Ability_Validate(agent hero) is integer
declare
begin
 return 1;
end
'''
            (source / 'sources/MajestyExpansion/Callbacks.gpl').write_text(callbacks)
            with self.assertRaisesRegex(ValueError, 'Unresolved'):
                audit_stage(source, root / 'stock', XML)
            common.write_text(PRIVATE + callbacks)
            result = audit_stage(source, root / 'stock', XML)
            self.assertEqual(len(result['callbacks']), 2)


if __name__ == '__main__':
    unittest.main()

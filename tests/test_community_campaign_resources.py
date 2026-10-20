"""Resource closure and private callback routing without retail game fixtures."""
from pathlib import Path
import struct
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'scripts'), str(ROOT / 'third_party/majesty-mod-manager/src')]
from lib import community_campaign_resources as policy
from lib.legacy_description_engine import block
from lib.legacy_description_wire import unit_parts
from lib.legacy_description_action import action_descriptor, action_parts
from majesty_cam.gpl import parse_gpl


def unit(name, callback='Expire', identity='ZZ01'):
    head = block(b'HEAD', identity.encode() + struct.pack('<I', 4) + name.encode() + b'\0\0')
    engine = block(b'PRIM', struct.pack('<9I', 4, 0, 0, 11, 0, 0, 0, 0, 0) +
                   callback.encode() + b'\0' + struct.pack('<II', 0, 0))
    game = block(b'SECD', b'unchanged game fields', version=1)
    return block(b'DUNT', block(b'DATA', head + engine + game, count=3), count=1)


class CallbackWireTests(unittest.TestCase):
    def test_unit_changes_only_the_typed_callback(self):
        raw = unit('Original Name')
        changed = policy.route_native_callbacks(raw, b'DUNT', {'Expire': 'MCR_Expire'})
        old_head, old_engine, old_game = unit_parts(raw)
        head, engine, game = unit_parts(changed)
        self.assertEqual((head, game), (old_head, old_game))
        self.assertEqual(engine[16:], old_engine[16:].replace(b'Expire\0', b'MCR_Expire\0'))
        self.assertEqual(len(changed), len(raw) + 4)
        self.assertEqual(struct.unpack_from('<I', engine, 4)[0], len(engine) - 16)

    def test_action_preserves_fixed_engine_size_and_native_fields(self):
        xml = ET.fromstring('<Description type="Action" subType="Standard" ID="ZZ01" Name="Example">'
            '<Engine version="1"><ImageSet value="Cast"/>'
            '<Script type="0" cProc="0" GPLFunction="Expire"/></Engine>'
            '<Game version="1"><Flags value="IsSpell"/><TimeoutDuration value="15000"/>'
            '<SpellType value="Attack"/><CharacterLevel value="1"/></Game></Description>')
        raw = action_descriptor(xml, {'Sound': {}, 'Unit': {}})
        changed = policy.route_native_callbacks(raw, b'DACT', {'Expire': 'MCR_Expire'})
        old_head, old_engine, old_game = action_parts(raw)
        head, engine, game = action_parts(changed)
        self.assertEqual((head, game), (old_head, old_game))
        self.assertEqual(engine, old_engine.replace(b'Expire\0', b'MCR_Expire\0'))
        self.assertEqual(struct.unpack_from('<I', engine, 4)[0], 64)

    def test_unrelated_callback_and_already_private_names_are_preserved(self):
        for name in ['Other_Expire', 'MCR_Expire', 'Different']:
            raw = unit('Example', name)
            self.assertEqual(policy.route_native_callbacks(raw, b'DUNT', {'Expire': 'MCR_Expire'}), raw)

    def test_no_callback_does_not_rewrite_a_display_name(self):
        raw = unit('Expire', '')
        self.assertEqual(policy.route_native_callbacks(raw, b'DUNT', {'Expire': 'MCR_Expire'}), raw)

    def test_ambiguous_callback_field_is_refused(self):
        raw = unit('Example', 'Expire\0Expire')
        with self.assertRaisesRegex(ValueError, 'Ambiguous'):
            policy.route_native_callbacks(raw, b'DUNT', {'Expire': 'MCR_Expire'})

    def test_sound_payloads_are_unmodified(self):
        self.assertEqual(policy.route_native_callbacks(b'sound', b'DSND', {'Expire': 'MCR_Expire'}), b'sound')


class ResourcePlanTests(unittest.TestCase):
    def fixture(self, source='$CreateEffector(a,"new_icon",0);', xml=None,
                base=None, northern=None, available=None, helpers=None, fire_balm=False):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        for name in ['sources/Any', 'sources/Majesty', 'stock/DataMX']:
            (root / name).mkdir(parents=True)
        (root / 'sources/Any/Merged.gpl').write_text(source)
        (root / 'stock/DataMX/test.xml').write_text(xml or '<Majesty><Description type="Unit" '
            'ID="ZZ01" Name="new_icon"><Engine><Script cProc="0" GPLFunction="Expire"/>'
            '</Engine></Description></Majesty>')
        if helpers is None:
            helpers = {i.normalized_name: i for i in parse_gpl('function Expire(agent a) declare begin end').items}
        self.catalogs = patch.object(policy, 'native_catalog', side_effect=[base or {}, northern or {
            ('Unit', 'new_icon'): [('ZZ01', SimpleNamespace(data=b'native'), b'DUNT')]}])
        self.symbols = patch.object(policy, 'symbols', side_effect=[available or {}, helpers])
        with self.catalogs, self.symbols, patch.object(policy, 'native_symbols', return_value=set()):
            return policy.plan(root, root, root / 'stock', fire_balm=fire_balm)

    def test_potion_helpers_are_shared_while_imported_native_callbacks_remain_base_only(self):
        support = dict(source='function MCR_Prepare_Fire_Balm(agent a) declare begin end',
                       actions={}, functions=['MCR_Prepare_Fire_Balm'], scope='Any')
        with patch('lib.community_fire_balm.fire_balm_support', return_value=support):
            result = self.fixture(fire_balm=True)
        self.assertEqual(result['commonSource'], support['source'])
        self.assertNotIn('MCR_Prepare_Fire_Balm', result['callbackSource'])
        self.assertIn('function MCR_Expire', result['callbackSource'])
        self.assertEqual(result['report']['fireBalmCompatibility']['scope'], 'Any')

    def test_dependency_callback_is_private_without_changing_original_body(self):
        r = self.fixture()
        self.assertEqual(r['report']['privateBaseCallbackRoutes'], {'Expire': 'MCR_Expire'})
        self.assertIn('function MCR_Expire(agent a)', r['callbackSource'])
        self.assertEqual(r['report']['functions'][0]['name'], 'Expire')

    def test_missing_shared_expression_is_imported_from_original_northern_source(self):
        helpers = {i.normalized_name: i for i in parse_gpl(
            'expression #FireBalmDamageBonus 5').items}
        r = self.fixture(source='hero\'s "damage" = #FireBalmDamageBonus;', helpers=helpers)
        self.assertEqual(r['report']['expressions'], ['#FireBalmDamageBonus'])
        self.assertIn('expression #FireBalmDamageBonus 5', r['callbackSource'])

    def test_unknown_shared_expression_is_refused(self):
        with self.assertRaisesRegex(ValueError, 'Unresolved script constant'):
            self.fixture(source='hero\'s "damage" = #NoSuchConstant;')

    def test_native_attribute_expression_is_not_a_script_import(self):
        r = self.fixture(source='hero\'s "damage" = #ATTRIB_DAMAGE;')
        self.assertFalse(r['report']['expressions'])

    def test_missing_named_resource_is_refused(self):
        with self.assertRaisesRegex(ValueError, 'Unresolved native resource'):
            self.fixture(source='$CreateEffector(a,"Missing",0);')

    def test_native_and_sdk_names_must_match(self):
        with self.assertRaisesRegex(ValueError, 'binding differs'):
            self.fixture(xml='<Majesty><Description type="Unit" ID="ZZ01" Name="Other"/></Majesty>')

    def test_existing_identity_cannot_be_replaced(self):
        with self.assertRaisesRegex(ValueError, 'replace an original'):
            self.fixture(base={('Unit', 'original'): [('ZZ01', SimpleNamespace(data=b'native'), b'DUNT')]})

    def test_unexpected_duplicate_name_is_refused(self):
        with self.assertRaisesRegex(ValueError, 'duplicate native resource'):
            self.fixture(northern={('Unit', 'new_icon'): [('ZZ01', object(), b'DUNT'),
                                                        ('ZZ02', object(), b'DUNT')]})

    def test_retail_speed_icon_uses_first_native_identity(self):
        r = self.fixture(source='$CreateEffector(a,"Speed_Tonic_Icon",0);',
            xml='<Majesty><Description type="Unit" ID="XR01" Name="Speed_Tonic_Icon"/>'
                '<Description type="Unit" ID="XS01" Name="Speed_Tonic_Icon"/></Majesty>',
            northern={('Unit', 'speed_tonic_icon'): [('XS01', object(), b'DUNT'),
                                                     ('XR01', object(), b'DUNT')]})
        self.assertEqual(r['report']['descriptions'][0]['ids'], ['XR01'])

    def test_deferred_impact_name_is_a_resource_dependency(self):
        r = self.fixture(source='hero\'s "special_splat" = "new_icon"; '
                        '$CreateEffector(target, hero\'s "special_splat", 0);')
        self.assertEqual(r['report']['finiteDynamicAttributeNames'], {'special_splat': ['new_icon']})
        self.assertIn(('Unit', 'new_icon'), r['imports'])

    def test_unknown_dynamic_expression_remains_explicit(self):
        r = self.fixture(source='$CreateEffector(a,hero\'s "special_splat",0);')
        self.assertFalse(r['imports'])
        self.assertEqual(len(r['report']['dynamicResourceCalls']), 1)

    def test_missing_optional_sound_is_reported_without_inventing_an_asset(self):
        r = self.fixture(source='$PlaySound(a,"completed_reward","begin");')
        self.assertFalse(r['imports'])
        self.assertEqual(r['report']['unresolvedOptionalSoundCalls'][0]['name'], 'completed_reward')

    def test_absent_building_capability_does_not_import_a_northern_building(self):
        r = self.fixture(source='$DisableUnitType("Embassy");')
        self.assertFalse(r['imports'])
        self.assertEqual(r['report']['absentUnitCapabilityCalls'][0]['name'], 'Embassy')

    def test_unknown_active_unit_creation_is_refused(self):
        with self.assertRaisesRegex(ValueError, 'Unresolved native resource'):
            self.fixture(source='$CreateSpellUnit(a,"missing_impact",t);')

    def test_private_callback_name_collision_is_refused(self):
        available = {i.normalized_name: i for i in parse_gpl(
            'function MCR_Expire(agent a) declare begin end').items}
        with self.assertRaisesRegex(ValueError, 'name is occupied'):
            self.fixture(available=available)

    def test_antimagic_alias_requires_equal_native_engine_and_game(self):
        base_raw = unit('anitmagic_shield_icon', '', 'WRD2')
        north_raw = unit('antimagic_shield_icon', '', 'WRD2')
        kwargs = dict(source='$CreateEffector(a,"antimagic_shield_icon",0);',
            base={('Unit', 'anitmagic_shield_icon'): [('WRD2', SimpleNamespace(data=base_raw), b'DUNT')]},
            northern={('Unit', 'antimagic_shield_icon'): [('WRD2', SimpleNamespace(data=north_raw), b'DUNT')]})
        r = self.fixture(**kwargs)
        self.assertFalse(r['imports'])
        self.assertEqual(r['report']['baseOnlyResourceAliases'],
                         {'antimagic_shield_icon': 'anitmagic_shield_icon'})
        kwargs['northern'] = {('Unit', 'antimagic_shield_icon'): [
            ('WRD2', SimpleNamespace(data=unit('antimagic_shield_icon', 'Changed', 'WRD2')), b'DUNT')]}
        with self.assertRaisesRegex(ValueError, 'Unproven'):
            self.fixture(**kwargs)


class EditionScopeTests(unittest.TestCase):
    def items(self, text):
        return {i.normalized_name: i for i in parse_gpl(text).items}

    def test_base_callbacks_dat_and_bridge_roots_close_calls_and_aliases(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'Data').mkdir()
            (root / 'Data/bytecode.bcd').write_bytes(b'Root\0')
            (root / 'sources/Any').mkdir(parents=True)
            (root / 'sources/Any/Test.dat').write_text('[Hero] {(birthscript Born)} [end]')
            rows = self.items('function Root() declare begin $Helper(); end\n'
                'function Helper() declare begin end\n'
                'function MJC_Helper() declare begin end\n'
                'function Born() declare begin end\n'
                'function MM_Direct() declare begin end\n'
                'function UnusedNorthern() declare begin $UnusedNorthern(); end')
            reached = policy.base_function_reachability(root, root, rows, {})
            self.assertEqual(reached, {'root', 'helper', 'mjc_helper', 'born', 'mm_direct'})

    def test_northern_fortress_spawn_exclusion_requires_every_guard_and_caller(self):
        rows = self.items('function Damage() declare begin '
            'if (defender\'s "title" == "GoblinFortress") begin $GoblinFortHitSpawn(defender); end end\n'
            'function MJC_Damage() declare begin '
            'if (defender\'s "title" == "GoblinFortress") begin $GoblinFortHitSpawn(defender); end end\n'
            'function GoblinFortHitSpawn() declare begin $Goblin_Spawn(a); end\n'
            'function MJC_GoblinFortHitSpawn() declare begin $Goblin_Spawn(a); end')
        self.assertTrue(policy.northern_goblin_spawn_guard(rows, {}))
        self.assertFalse(policy.northern_goblin_spawn_guard(rows, {('Unit', 'goblinfortress'): []}))
        extra = self.items('function Other() declare begin $Goblin_Spawn(a); end')
        self.assertFalse(policy.northern_goblin_spawn_guard({**rows, **extra}, {}))
        bad = self.items('function Damage() declare begin $GoblinFortHitSpawn(defender); end')
        self.assertFalse(policy.northern_goblin_spawn_guard({**rows, **bad}, {}))


class ActorTemplateTests(unittest.TestCase):
    ORIGINAL = '[Critical_Hit]\n {Spell (type spell) (subtype spell) (title Critical_Hit)}\n[end]'

    def setup_template(self, original=None, existing=''):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        for folder in ['sources/Any', 'sources/Majesty', 'stock/GPLMx']:
            (root / folder).mkdir(parents=True)
        (root / 'stock/GPLMx/Spell.dat').write_text(original or self.ORIGINAL)
        (root / 'sources/Any/Existing.dat').write_text(existing)
        return root

    def test_native_spell_prototype_and_original_critical_data_are_both_required(self):
        root = self.setup_template()
        with patch.object(policy, 'native_template_symbols', return_value={'spell'}):
            text, records = policy.template_dependencies(root, root, root / 'stock', {'critical_hit'})
        self.assertIn(self.ORIGINAL, text)
        self.assertEqual(records[0]['name'], 'Critical_Hit')
        with patch.object(policy, 'native_template_symbols', return_value=set()):
            with self.assertRaisesRegex(ValueError, 'Spell prototype'):
                policy.template_dependencies(root, root, root / 'stock', {'critical_hit'})

    def test_existing_actor_template_is_never_replaced(self):
        root = self.setup_template(existing=self.ORIGINAL)
        with patch.object(policy, 'native_template_symbols', return_value={'spell'}):
            self.assertEqual(policy.template_dependencies(root, root, root / 'stock',
                                                         {'critical_hit'}), ('', []))

    def test_modified_or_unknown_actor_template_is_refused(self):
        root = self.setup_template(original=self.ORIGINAL.replace('title Critical_Hit', 'title Other'))
        with patch.object(policy, 'native_template_symbols', return_value={'spell'}):
            with self.assertRaisesRegex(ValueError, 'Unreviewed'):
                policy.template_dependencies(root, root, root / 'stock', {'critical_hit'})
            with self.assertRaisesRegex(ValueError, 'Unresolved'):
                policy.template_dependencies(root, root, root / 'stock', {'missing_actor'})


if __name__ == '__main__':
    unittest.main()

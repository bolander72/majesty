import importlib.util
from pathlib import Path
import sys
import unittest

PATH = Path(__file__).resolve().parents[1] / 'scripts/lib/community_resource_closure.py'
SPEC = importlib.util.spec_from_file_location('community_resource_closure', PATH)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class ResourceClosureTests(unittest.TestCase):
    def calls(self, text):
        return list(MODULE.resource_calls(text))

    def test_native_names_and_argument_order(self):
        rows = self.calls('$CreateEffector(a,"Frost_Field_Hit_Effector",0); '
                          '$GetSpellAttribute("ice_lance","effector_duration"); '
                          '$LearnSpell(a,"Item_Healing",FALSE);')
        self.assertEqual([(r.namespace, r.name) for r in rows],
                         [('Unit', 'Frost_Field_Hit_Effector'), ('Action', 'ice_lance'),
                          ('Action', 'Item_Healing')])

    def test_attribute_expression_is_dynamic(self):
        rows = self.calls('$CreateEffector(target, hero\'s "special_splat", 0);')
        self.assertIsNone(rows[0].name)

    def test_creation_and_sound_calls_are_typed_but_default_sound_flags_are_not(self):
        rows = self.calls('$SpawnUnit(a,"Phantoms_Haunt",point); '
                          '$CreateSpellUnit(a,"cloud",target); '
                          '$CreateMissile("missile",a,target); '
                          '$EnableUnitType("Paladin"); '
                          '$PlaySound(a,"spell_hit","Attack"); '
                          '$PlaySound(a,"VFX_CAST_SPELL1");')
        self.assertEqual([(r.namespace, r.name) for r in rows],
            [('Unit', 'Phantoms_Haunt'), ('Unit', 'cloud'), ('Unit', 'missile'),
             ('Unit', 'Paladin'), ('Sound', 'spell_hit')])

    def test_nested_calls_and_quoted_punctuation(self):
        rows = self.calls('$CreateEffector($Pick(a,b), "icon", '
                          '$GetSpellAttribute("spell,()", "duration"));')
        self.assertEqual([r.name for r in rows], ['icon', 'spell,()'])

    def test_comments_and_strings_do_not_create_calls(self):
        self.assertEqual(self.calls('// $LearnSpell(a,"bad");\n'
                                    '/* $Cast(a,"bad"); */ " $Cast(a,word) ";'), [])

    def test_comment_markers_in_literal_are_preserved(self):
        self.assertEqual(self.calls('$Cast(a,"a//b",t,"");')[0].name, 'a//b')

    def test_function_value_is_not_call(self):
        self.assertEqual(self.calls('a\'s "work" = $CreateEffector;'), [])

    def test_case_and_line_number(self):
        r = self.calls('\n\n$IsSpElLaVaIlAbLe(a,"turn_undead_healer",1);')[0]
        self.assertEqual((r.name, r.line), ('turn_undead_healer', 3))

    def test_dynamic_name_is_explicit(self):
        self.assertIsNone(self.calls('$ForgetSpell(a,spell);')[0].name)

    def test_invalid_call_is_refused(self):
        for text in ['$Cast(a,"spell"', '$GetSpellAttribute();', '$LearnSpell(a,"");']:
            with self.subTest(text=text), self.assertRaises(ValueError):
                self.calls(text)

    def test_attribute_writer_tracks_complete_literal_and_dynamic_names(self):
        text = 'hero\'s "special_splat" = "fire_balm_hit"; '               'hero\'s "special_splat" = "prefix" + variable; '               'hero\'s "special_splat" = variable;'
        rows = list(MODULE.literal_attribute_writes(text, 'special_splat'))
        self.assertEqual([name for name, _ in rows], ['fire_balm_hit', None, None])

    def test_attribute_writer_ignores_comments_and_comparisons(self):
        text = '// hero\'s "special_splat" = "missing";\n'               '/* hero\'s "special_splat" = "missing"; */'               'if (hero\'s "special_splat" == "missing") return;'
        self.assertEqual(list(MODULE.literal_attribute_writes(text, 'special_splat')), [])

    def test_size_bound(self):
        with self.assertRaises(ValueError):
            self.calls(' ' * (2 * 1024 * 1024 + 1))

    def test_symbol_references_ignore_strings_and_comments(self):
        refs = list(MODULE.script_references('$Work(a,#Cost); // $No #Wrong\n'
                                             '"$No #Wrong" /* #Wrong */ #ATTRIB_HP'))
        self.assertEqual(refs, [('Function', 'work'), ('Expression', '#cost'),
                                ('Expression', '#attrib_hp')])


if __name__ == '__main__':
    unittest.main()

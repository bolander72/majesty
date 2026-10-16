import importlib.util
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'third_party/majesty-mod-manager/src')]
spec = importlib.util.spec_from_file_location('community_legacy',
    ROOT / 'scripts/prepare-community-guild-legacy-functions.py')
legacy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(legacy)


class LegacyExportTests(unittest.TestCase):
    def test_only_stock_collisions_gain_aliases_without_changing_body_or_calls(self):
        source = '''function Public_Heal(agent a) is integer
declare begin
 // Public_Heal and $Public_Heal in this comment stay untouched.
 $Private_Potion(a);
 return $Public_Heal(a);
end
function Private_Potion(agent a)
declare begin $Public_Heal(a); end
'''
        body, routes = legacy.aliases_for_source(source, {'public_heal'},
                                                 {'public_heal', 'private_potion'})
        self.assertEqual(routes, {'Public_Heal': 'MJC_Public_Heal'})
        self.assertIn('function MJC_Public_Heal(agent a) is integer', body)
        self.assertIn('return $Public_Heal(a);', body)
        self.assertIn('// Public_Heal and $Public_Heal in this comment', body)
        self.assertNotIn('function MJC_Private_Potion', body)

    def test_alias_cannot_replace_a_preexisting_private_export(self):
        source = 'function Heal(agent a) declare begin end'
        with self.assertRaisesRegex(ValueError, 'collision'):
            legacy.aliases_for_source(source, {'heal'}, {'mjc_heal'})

    def test_private_functions_are_left_without_duplicate_alias_code(self):
        body, routes = legacy.aliases_for_source(
            'function Only_Private(agent a) declare begin end', {'stock'}, set())
        self.assertEqual(routes, {})
        self.assertEqual(body.strip(), '')


if __name__ == '__main__':
    unittest.main()

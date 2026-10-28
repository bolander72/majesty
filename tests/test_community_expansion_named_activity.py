import sys
from pathlib import Path
import unittest
ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'scripts'), str(ROOT / 'third_party/majesty-mod-manager/src')]
from lib.community_named_activity import calls, private_id, rewrite


class NamedActivityTests(unittest.TestCase):
    def test_only_real_activity_argument_changes(self):
        source = '// $SpecifyIntent(A,"UNKNOWN");\n$SpecifyIntent($ListMember(L, 1), "FAPATROL");\n$DebugOut("FAPATROL");\n$SpecifyIntent(A, #Intent_Thinking);'
        result, counts = rewrite(source, {'FAPATROL':dict(id=0x61234567)})
        self.assertEqual(result, source.replace('1), "FAPATROL"', '1), #MMM_AITX_61234567'))
        self.assertEqual(counts, {'FAPATROL':1})

    def test_unknown_text_and_malformed_call_are_rejected(self):
        for source in ('$SpecifyIntent(A,"UNKNOWN");', '$SpecifyIntent(A,"KNOWN",7);', '$SpecifyIntent(A,"KNOWN";'):
            with self.assertRaises(ValueError): rewrite(source, {})

    def test_private_ids_are_stable_and_package_scoped(self):
        first = private_id('{PACKAGE}', 'FAPATROL')
        self.assertEqual(first, private_id('{package}', 'fapatrol'))
        self.assertNotEqual(first, private_id('{other}', 'FAPATROL'))
        self.assertTrue(0x60000000 <= first <= 0x6fffffff)

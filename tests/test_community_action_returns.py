import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'scripts'), str(ROOT / 'third_party/majesty-mod-manager/src')]
from lib.community_action_returns import adapt
from majesty_cam.action_callback_bridge import bridge_source, bridge_symbol
from majesty_cam.gpl import DefinitionKind, parse_gpl


class ActionReturns(unittest.TestCase):
    def body(self, text, name):
        return parse_gpl(text).require(DefinitionKind.FUNCTION, name)

    def test_void_action_runs_once_without_boolean_conversion(self):
        name = 'Tame'
        callback = self.body('function Tame(agent Beast)\ndeclare\nbegin\nreturn;\nend', name)
        wrapper = self.body(bridge_source(name), bridge_symbol(name))
        fixed = adapt(wrapper, callback)
        self.assertEqual(fixed.count('$Tame(Subject)'), 1)
        self.assertNotIn('if (', fixed)
        self.assertIn('return 1;', fixed)
        self.assertEqual(adapt(self.body(fixed, bridge_symbol(name)), callback), fixed)

    def test_boolean_action_keeps_its_result(self):
        name = 'Refresh'
        callback = self.body('function Refresh(agent Guild) is boolean\ndeclare\nbegin\nreturn FALSE;\nend', name)
        wrapper = self.body(bridge_source(name), bridge_symbol(name))
        self.assertEqual(adapt(wrapper, callback), wrapper.text)

    def test_altered_bridge_and_unknown_callback_type_are_rejected(self):
        name = 'Tame'
        callback = self.body('function Tame(agent Beast)\ndeclare\nbegin\nend', name)
        wrapper = self.body(bridge_source(name).replace('return 1;', 'return 2;'), bridge_symbol(name))
        with self.assertRaisesRegex(ValueError, 'body requires review'):
            adapt(wrapper, callback)
        callback = self.body('function Tame(agent Beast) is integer\ndeclare\nbegin\nreturn 2;\nend', name)
        wrapper = self.body(bridge_source(name), bridge_symbol(name))
        with self.assertRaisesRegex(ValueError, 'Unsupported action return'):
            adapt(wrapper, callback)


if __name__ == '__main__':
    unittest.main()

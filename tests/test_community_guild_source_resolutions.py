"""Exercise compatibility refusals without private game/source/media fixtures."""
import copy
from pathlib import Path
import re
import sys
from types import SimpleNamespace
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'third_party/majesty-mod-manager/src'))
sys.path.insert(0, str(ROOT / 'scripts'))
from lib.community_guild_source_resolutions import (CONFIDENCE, STOCK_HEROES,
                                                    random_hero_function, resolve)


def source(text):
    return SimpleNamespace(text=text)


class GuildSourceResolutionTests(unittest.TestCase):
    def setUp(self):
        helper = ('Function NAME(agent ThisAgent) is integer\n'
                  'Declare Begin return 0; End')
        prefix = ('function spell_extra_value(agent thisagent) is integer\n'
                  'declare integer value; begin\n')
        branch = 'if (thisagent\'s "Title" == "Phantom") begin\n'
        canonical, literals, expressions = [], [], []
        for spell, (value, constant) in CONFIDENCE.items():
            condition = f'if ($isspellavailable(thisagent,"{spell}",1)) value += '
            canonical.append(condition + '#' + constant + ';')
            literals.append(condition + value + ';')
            expressions.append('expression #' + constant + ' ' + value)
        self.alchemist = {
            'alchemist_compat_phantom_max_haunt_level': source(helper.replace(
                'NAME', 'Alchemist_Compat_Phantom_Max_Haunt_Level')),
            'spell_extra_value': source(prefix + branch + '\n'.join(literals)
                + '\nend\nif (thisagent\'s "Title" == "Alchemist") value += 9;\nreturn value; end'),
            'random_hero_type': source(random_hero_function((*STOCK_HEROES, 'Alchemist'))),
        }
        restricted = tuple(t for t in STOCK_HEROES if t != 'Paladin')
        self.phantom = {
            'phantom_player_max_completed_haunt_level': source(helper.replace(
                'NAME', 'Phantom_Player_Max_Completed_Haunt_Level')),
            'spell_extra_value': source(prefix + branch + '\n'.join(canonical)
                + '\nend\nreturn value; end'),
            'random_hero_type': source(random_hero_function(
                (*STOCK_HEROES, 'Phantom'), (*restricted, 'Phantom'))),
        }
        self.full = '\n'.join(expressions)

    def test_confidence_keeps_each_guild_branch_once(self):
        resolved = resolve(self.alchemist, self.phantom, self.full)['spell_extra_value']
        self.assertEqual(resolved.count('"Phantom"'), 1)
        self.assertEqual(resolved.count('"Alchemist"'), 1)
        for _, constant in CONFIDENCE.values():
            self.assertEqual(resolved.count('#' + constant), 1)

    def test_pool_contains_both_custom_heroes_and_preserves_undead_guard(self):
        resolved = resolve(self.alchemist, self.phantom, self.full)['random_hero_type']
        self.assertIn('$RandomNumber(17)', resolved)  # Restricted: no Paladin.
        self.assertIn('$RandomNumber(18)', resolved)
        self.assertEqual(re.findall(r'return "([^"]+)"', resolved),
            [t for t in STOCK_HEROES if t != 'Paladin'] + ['Phantom', 'Alchemist']
            + list(STOCK_HEROES) + ['Phantom', 'Alchemist'])
        self.assertEqual(resolved.count('return "Paladin"'), 1)
        self.assertIn('$Phantom_Player_Has_Placed_Haunt(ThisAgent)', resolved)

    def test_changed_confidence_requires_review(self):
        with self.assertRaisesRegex(ValueError, 'confidence constant changed'):
            resolve(self.alchemist, self.phantom, self.full.replace('Confidence 10', 'Confidence 11'))

    def test_different_haunt_query_requires_review(self):
        changed = copy.deepcopy(self.phantom)
        changed['phantom_player_max_completed_haunt_level'].text = changed[
            'phantom_player_max_completed_haunt_level'].text.replace('return 0', 'return 1')
        with self.assertRaisesRegex(ValueError, 'Haunt query changed'):
            resolve(self.alchemist, changed, self.full)

    def test_hidden_pool_side_effect_is_not_silently_discarded(self):
        changed = copy.deepcopy(self.phantom)
        changed['random_hero_type'].text = changed['random_hero_type'].text.replace(
            '\nBegin\n', '\nBegin\n $SpendGold(ThisAgent,100);\n')
        with self.assertRaisesRegex(ValueError, 'hero pool or undead guard changed'):
            resolve(self.alchemist, changed, self.full)


if __name__ == '__main__':
    unittest.main()

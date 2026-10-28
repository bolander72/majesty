import sys
from pathlib import Path
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from lib.community_guild_composition import merge_shared_function_routes

class RouteUnionTests(unittest.TestCase):
    def test_case_fold_keeps_exact_export(self):
        header = b'majesty-community-shared-gpl-v2\n'
        self.assertEqual(merge_shared_function_routes([
            header + b'BuildingReachedMaxHP\tMJC_BuildingReachedMaxHP\n',
            header + b'buildingreachedmaxhp\tMJC_BuildingReachedMaxHP\n']),
            header + b'BuildingReachedMaxHP\tMJC_BuildingReachedMaxHP\n')

    def test_changed_identity_or_conflicting_export_is_refused(self):
        header = b'majesty-community-shared-gpl-v2\n'
        for rows in [[header + b'heal\tMJC_damage\n'],
                     [header + b'heal\tMJC_heal\n', header + b'HEAL\tMJC_HEAL\n'],
                     [header + b'heal\tMJC_heal\textra\n']]:
            with self.assertRaises(ValueError): merge_shared_function_routes(rows)

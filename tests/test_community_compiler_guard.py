import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('community_compiler',
    Path(__file__).resolve().parents[1] / 'scripts/compile-community-guild-gpl.py')
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)


class CompilerGuardTests(unittest.TestCase):
    def test_detached_wine_processes_count_towards_the_trial_budget(self):
        rows = [['10', '1', '1024', '/tools/wine'],
                ['11', '1', '2048', 'C:\\windows\\Gplbcc.exe'],
                ['12', '1', '4096', '/tools/wineserver'],
                ['13', '12', '1024', '/tools/helper']]
        self.assertEqual(policy.trial_rss_mib(rows, 10, set()), 8)

    def test_preexisting_wine_and_unrelated_processes_are_excluded(self):
        rows = [['10', '1', '1024', '/tools/wine'],
                ['11', '10', '2048', '/tools/helper'],
                ['20', '1', '8192', '/user/wineserver'],
                ['21', '20', '8192', 'C:\\user\\Other.exe'],
                ['30', '1', '8192', '/unrelated/browser']]
        self.assertEqual(policy.trial_rss_mib(rows, 10, {20, 21}), 3)

    def test_reparented_pe_process_can_trigger_the_existing_limit(self):
        rows = [['10', '1', '1024', '/tools/wine'],
                ['11', '1', str(2048 * 1024), 'Z:\\Gplbcc.exe']]
        self.assertGreater(policy.trial_rss_mib(rows, 10, set()), 2048)

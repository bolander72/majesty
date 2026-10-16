import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from lib.community_activity_reentrancy import restore_activity_root


SOURCE = '''function Before()
declare
begin
end
function MM_AD_Change(string Identity, agent Owner, integer Key, integer Action) is integer
declare
    agent Root;
begin
    Root = $MM_AD_Root();
    Root's "MM_ActivityRecords_v1" = Kept;
    Root's "MM_ActivityBusy_v1" = False;
    if (Action == 0)
        begin
            $MM_AD_Notify(Identity, Owner, Subject, Context, Key, 1);
            $MM_AD_StopIfEmpty(Root);
        end
    return 1;
end
function After(agent Root)
declare
begin
    $MM_AD_StopIfEmpty(Root);
end
'''


class ActivityRootCompatibilityTests(unittest.TestCase):
    def test_only_post_callback_root_expression_changes(self):
        actual = restore_activity_root(SOURCE)
        expected = SOURCE.replace('$MM_AD_StopIfEmpty(Root);',
                                  '$MM_AD_StopIfEmpty($MM_AD_Root());', 1)
        self.assertEqual(actual, expected)
        self.assertEqual(actual.replace('$MM_AD_StopIfEmpty($MM_AD_Root());',
                                        '$MM_AD_StopIfEmpty(Root);', 1), SOURCE)

    def test_refuses_reapplication_and_unknown_callback(self):
        for value in [restore_activity_root(SOURCE),
                      SOURCE.replace('Context, Key, 1);', 'Context, Key, 2);'),
                      SOURCE.replace('MM_AD_Notify', 'Other_Notify'),
                      SOURCE.replace('integer Action)', 'boolean Action)'),
                      SOURCE.replace('    return 1;', '    return 2;')]:
            with self.subTest(value=value[-60:]):
                with self.assertRaises(ValueError):
                    restore_activity_root(value)

    def test_requires_unique_dispatcher(self):
        for value in ['', SOURCE.replace('MM_AD_Change', 'Other_Change'), SOURCE + SOURCE]:
            with self.subTest(length=len(value)):
                with self.assertRaises(ValueError):
                    restore_activity_root(value)


if __name__ == '__main__':
    unittest.main()

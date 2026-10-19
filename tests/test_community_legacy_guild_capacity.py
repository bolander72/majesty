import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from lib.community_legacy_guild_capacity import restore_legacy_capacity, SYNC


SOURCE = '''prototype Bards_Hall_Prototype()
declare
    //integer max_members;
begin
end
function Bards_Hall_Birth(agent thisagent)
declare
begin
    $SetAttribute(ThisAgent, #ATTRIB_MaxGuildMembers, 1);
\tthisagent's "in_danger" = FALSE;
    $check_strays(thisagent, "Spellsinger", #MyPlayer);
end
function building_upgraded(agent thisagent)
declare
begin
    $SetAttribute(ThisAgent, #ATTRIB_MaxGuildMembers, ThisAgent's "BardsCompletedCapacity");
\t$runthread ( thisagent's "upgradescript", 1, thisagent );
end
function BuildingReachedMaxHP(agent theBuilding)
declare
begin
    $UpgradeAgentAttributes(theBuilding);
    $SetAttribute(theBuilding, #ATTRIB_MaxGuildMembers, 1);
\t\t\t\tIf ( TheBuilding's "Title" == "Palace" )
        $PalaceNotification(theBuilding);
end
function MM_KR_61f71999deb595c08a9e9fd4ad74ab25_Visual(agent Building) is integer
declare
begin
    if ($MM_KR_Live(Building) == False) return 0;
    $ExistingVisual(Building);
    return 1;
end
function UntouchedStockGuild(agent Building)
declare
begin
    $OriginalCallback(Building);
end
'''


class LegacyGuildCapacityTests(unittest.TestCase):
    def test_only_private_declaration_and_lifecycle_insertions_change(self):
        result = restore_legacy_capacity(SOURCE)
        original = result.removesuffix('\n\n' + SYNC)
        original = original.replace('integer max_members;', '//integer max_members;', 1)
        original = '\n'.join(line for line in original.split('\n')
                             if '$Bards_Sync_Legacy_Guild_Capacity(' not in line)
        # The completion insertion adds one separating blank line.
        original = original.replace('\n\n\t\t\t\tIf', '\n\t\t\t\tIf')
        self.assertEqual(original.rstrip(), SOURCE.rstrip())

    def test_capacity_sync_precedes_adoption_and_follows_quest_capacity(self):
        result = restore_legacy_capacity(SOURCE)
        self.assertLess(result.index('#ATTRIB_MaxGuildMembers, 1);'),
                        result.index('$Bards_Sync_Legacy_Guild_Capacity(thisagent);'))
        self.assertLess(result.index('$Bards_Sync_Legacy_Guild_Capacity(thisagent);'),
                        result.index('$check_strays('))
        self.assertIn('Guild\'s "Title" != "Bards_Hall"', SYNC)
        self.assertIn('$HasAttribute("max_members", Guild) == FALSE', SYNC)
        self.assertNotIn('$SetAttribute(', SYNC)

    def test_refuses_reapplication_or_changed_source(self):
        for source in [restore_legacy_capacity(SOURCE), '', SOURCE + SOURCE,
                       SOURCE.replace('//integer max_members;', 'integer max_members;'),
                       SOURCE.replace('MM_KR_Live(Building)', 'OtherLive(Building)'),
                       SOURCE.replace('function Bards_Hall_Birth(', 'function DifferentBirth(')]:
            with self.subTest(source=source[:35]), self.assertRaises(ValueError):
                restore_legacy_capacity(source)


if __name__ == '__main__':
    unittest.main()

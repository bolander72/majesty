#!/usr/bin/env python3
"""Prepare guild usability source changes for the official SDK compiler."""
from pathlib import Path
import argparse,json,hashlib,shutil,sys
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'third_party/majesty-mod-manager/src')]
from majesty_cam.gpl import parse_gpl,DefinitionKind

def digest(raw):return {'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
def prepare(a):
 assert not a.out.exists();proof=json.loads((a.source/'source-stage.json').read_text());a.out.mkdir(parents=True)
 for name,expected in proof['files'].items():
  raw=(a.source/'sources'/name).read_bytes();assert digest(raw)==expected
  if name=='Any/Merged.gpl':
   text=raw.decode('cp1252');doc=parse_gpl(text);old=doc.require(DefinitionKind.FUNCTION,'Adventurer_Guild_Is_Open')
   replacement='''function Adventurer_Guild_Is_Open(agent Guild) is boolean
declare
begin
    if ($IsValidGamePiece(Guild) == False) return False;
    if ($IsDead(Guild)) return False;
    // Keep saved guilds open too; there is no player-facing close state now.
    $SetAttribute(Guild, #ATTRIB_EmbassyActiveFlag, 1);
    return True;
end'''
   text=text[:old.span.start]+replacement+text[old.span.end:]
   text+='''\n\nfunction Guild_Usability_Completed_Zoo(agent Palace) is agent
declare
    agent Zoo;
begin
    if ($IsValidGamePiece(Palace) == False) return $NullAgent();
    if ($IsDead(Palace)) return $NullAgent();
    Zoo = $Restore_Find_Completed_Zoo(Palace);
    return Zoo;
end\n'''
   doc=parse_gpl(text)
   for symbol in ['Adventurer_Guild_Birth','Adventurer_Guild_Ensure_Guild_State']:
    definition=doc.require(DefinitionKind.FUNCTION,symbol);body=definition.text
    if symbol=='Adventurer_Guild_Birth':body=body.replace('$SetAttribute(ThisAgent, #ATTRIB_EmbassyActiveFlag, 0);','$SetAttribute(ThisAgent, #ATTRIB_EmbassyActiveFlag, 1);')
    else:body=body.replace('begin','begin\n    $SetAttribute(Guild, #ATTRIB_EmbassyActiveFlag, 1);',1)
    text=text[:definition.span.start]+body+text[definition.span.end:];doc=parse_gpl(text)
   definition=doc.require(DefinitionKind.FUNCTION,'Restore_Stock_Zoo_Flag_Check')
   body=definition.text
   begin=body.index('\t\t\tcash =');finish=body.index('\n\t\t\tif (( $RandomNumber',begin)
   body=body[:begin]+"\t\t\t// A Capture Flag buys a nonlethal bounty, not an undisclosed lottery.\n\t\t\tcharm_percentage = 100;"+body[finish:]
   body=body.replace('if (( $RandomNumber ( 100 ) + 1 ) < charm_percentage )','if ( charm_percentage == 100 )')
   body=body.replace('$GetUnitPlayerNumber ( hero ) == #Player_1','$GetUnitPlayerNumber ( hero ) == $GetUnitPlayerNumber ( zoo_agent )')
   text=text[:definition.span.start]+body+text[definition.span.end:]
   doc=parse_gpl(text);definition=doc.require(DefinitionKind.FUNCTION,'Restore_Begin_Stock_Zoo_Control')
   body=definition.text.replace('\t$Control_Monster ( hero, thisagent );','\t// A single powerful hit can already have set native death bookkeeping.\n\t$ClearEngineDeathFlags ( thisagent );\n\t$Control_Monster ( hero, thisagent );')
   body=body.replace('\t$DeleteGamePiece ( flag );','\t// Pay the funded bounty once, using the normal native reward distribution.\n\t$MM_Event_AttackGold ( flag, $GetAttribute ( flag, #ATTRIB_RewardCost ));\n\tflag\'s \"gavereward\" = TRUE;\n\t$DeleteGamePiece ( flag );')
   text=text[:definition.span.start]+body+text[definition.span.end:]
   text+='\n\nfunction Guild_Usability_Capture_Eligible(agent Monster) is integer\ndeclare\nbegin\n    if ($IsValidGamePiece(Monster) == False) return 0;\n    if ($IsDead(Monster)) return 0;\n    if ($GetUnitPlayerNumber(Monster) != #Monster_Player) return 0;\n    if (Monster\'s "Type" != "Monster") return 0;\n    if (Monster\'s "Familiar" == True) return 0;\n    if (Monster\'s "Title" == "Rrongol") return 0;\n    if ($ValidFunction(Monster\'s "IGDeathScript") == False) return 0;\n    if ((Monster\'s "IGDeathScript" == $Monster_GraveStone) ||\n        (Monster\'s "IGDeathScript" == $MJC_Monster_GraveStone) ||\n        (Monster\'s "IGDeathScript" == $Sleeper_Death)) return 1;\n    return 0;\nend\n'
   raw=text.encode('cp1252')
  p=a.out/'sources'/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw)
 for name in ['resources','stock-fixture']:(a.out/name).symlink_to((a.source/name).resolve(),target_is_directory=True)
 shutil.copytree(a.source/'routes',a.out/'routes')
 proof.update(files={name:digest((a.out/'sources'/name).read_bytes())for name in proof['files']},guildUsability={'adventurersAlwaysOpen':True,'palaceCaptureLookup':True,'reliableCapture':True,'captureEligibility':True,'overkillDeathFlagsCleared':True},compiled=False,published=False)
 (a.out/'source-stage.json').write_text(json.dumps(proof,indent=2)+'\n');print('Staged always-open guild and palace capture lookup.')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--out',type=Path,required=True);prepare(p.parse_args())

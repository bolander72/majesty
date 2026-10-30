import importlib.util,json,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('guild_release',ROOT/'scripts/lib/dark_paladin_guild_release.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
KEYS=['opaqueHeroQualified','guildNamesQualified','scaffoldUpgradesQualified','guildScaleQualified','nativeRecruitCombatQualified','scopedOpacityRepairQualified','saveReloadQualified','ownedBrowserClosed','engineUnchanged','unitStatsUnchanged']
class GuildReleaseGate(unittest.TestCase):
 def test_every_qualified_native_contract_is_required(self):
  for key in KEYS:
   with self.subTest(key=key),tempfile.TemporaryDirectory()as temp:
    root=Path(temp);(root/'deploy').mkdir();out=root/'output';out.mkdir();proof={**dict.fromkeys(KEYS,True),'sourcePolicies':{}};proof[key]=False;raw=json.dumps(proof).encode();(root/'deploy/dark-paladin-guild-verification.json').write_bytes(raw)
    (root/'deploy/dark-paladin-guild-release.json').write_text(json.dumps({'format':'majesty-dark-paladin-guild-release-v1','qualification':m.digest(raw)}))
    with self.assertRaisesRegex(ValueError,'Guild presentation qualification'):m.install(root,out)
if __name__=='__main__':unittest.main()

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    'alchemist_campaign_functions', ROOT / 'scripts/prepare-alchemist-campaign-functions.py')
campaign = importlib.util.module_from_spec(spec)
spec.loader.exec_module(campaign)


class CampaignFunctionsTest(unittest.TestCase):
    def fixture(self, root):
        source = root / 'source'
        source.mkdir()
        files = dict(zip(campaign.FILES, [
            b'Function Alchemist_birth(agent Hero)\nDeclare\n agent Palace;\nBegin\n'
            b' Palace = $GetTruePalace(Hero);\n $UseItem(#Bazaar_Item_Five);\nEnd\n',
            b'[Alchemist]\n[end]\n', b'source="Alchemist_Composed.gpl"\n',
            b'majesty-alchemist-shared-gpl-v1\nAlchemist_birth\tMJA_Alchemist_birth\n']))
        for name, raw in files.items():
            (source / name).write_bytes(raw)
        report = dict(format='majesty-alchemist-source-composition-v1',
                      sourcePoliciesApplied=True,
                      legacyFunctionAliases={'Alchemist_birth': 'MJA_Alchemist_birth'},
                      files={n: dict(bytes=len(b), sha256=campaign.sha(b)) for n, b in files.items()})
        (source / 'source-composition.json').write_text(json.dumps(report))
        (root / 'SDK/GPL').mkdir(parents=True)
        (root / 'SDK/GPLMx').mkdir()
        (root / 'SDK/GPLMx/mx_QItems.gpl').write_text('expression #Bazaar_Item_Five 24\n')
        sdk = root / 'SDK/GPLMx/mx_LowLevel.gpl'
        sdk.write_text('Function GetTruePalace(agent Hero) is agent\nDeclare\nBegin\n'
                       ' return $NullAgent();\nEnd\n')
        return source, sdk, files

    def test_campaign_birth_dependency_is_local_without_changing_hero_or_routes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, sdk, files = self.fixture(root)
            campaign.prepare(source, sdk, root / 'out')
            text = (root / 'out' / campaign.FILES[0]).read_text()
            from majesty_cam.gpl import DefinitionKind, parse_gpl
            functions = {i.normalized_name: i.text for i in parse_gpl(text, 'out').items
                         if i.kind == DefinitionKind.FUNCTION}
            self.assertIn('gettruepalace', functions)
            self.assertEqual(functions['gettruepalace'].strip(), sdk.read_text().strip())
            self.assertIn(files[campaign.FILES[0]].decode(), text)
            self.assertIn('expression #Bazaar_Item_Five 24', text)
            for name in campaign.FILES[1:]:
                self.assertEqual((root / 'out' / name).read_bytes(), files[name])

    def test_wrong_return_type_cannot_reintroduce_void_to_agent_crash(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, sdk, _ = self.fixture(root)
            sdk.write_text(sdk.read_text().replace(' is agent', ''))
            with self.assertRaisesRegex(ValueError, 'agent return type'):
                campaign.prepare(source, sdk, root / 'out')
            self.assertFalse((root / 'out').exists())

    def test_nested_bazaar_helper_dependencies_are_closed_recursively(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, sdk, _ = self.fixture(root)
            sdk.write_text(sdk.read_text().replace('return $NullAgent();',
                           '$Researched_Item();\n return $NullAgent();'))
            nested = sdk.parent / 'TaskModules/Buildings'
            nested.mkdir(parents=True)
            (nested / 'Magic_Bazaar.gpl').write_text(
                'Function Researched_Item() is list\nDeclare\n list Found;\nBegin\n'
                ' $Bazaar_Dependency(#Bazaar_Extra);\n return Found;\nEnd\n'
                'Function Bazaar_Dependency(integer Item)\nBegin\n return;\nEnd\n'
                'expression #Bazaar_Extra 25\n')
            report = campaign.prepare(source, sdk, root / 'out')
            self.assertEqual({item['name'] for item in report['campaignHelperImports']},
                             {'GetTruePalace', 'Researched_Item', 'Bazaar_Dependency'})
            self.assertIn('#Bazaar_Extra', {item['name'] for item in report['campaignExpressionImports']})

    def test_changed_hero_source_is_not_silently_rebound(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, sdk, _ = self.fixture(root)
            (source / campaign.FILES[0]).write_text('Changed')
            with self.assertRaisesRegex(ValueError, 'Source binding differs'):
                campaign.prepare(source, sdk, root / 'out')
            self.assertFalse((root / 'out').exists())


if __name__ == '__main__':
    unittest.main()

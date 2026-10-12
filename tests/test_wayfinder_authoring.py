"""SDK integration/refusal checks; these do not qualify native gameplay."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
loader = importlib.util.spec_from_file_location('wayfinder_authoring', ROOT / 'scripts/prepare-wayfinder-pack.py')
author = importlib.util.module_from_spec(loader)
loader.loader.exec_module(author)


class AuthoringChecks(unittest.TestCase):
    def test_linked_sdk_resources_and_originals_preserved(self):
        watched = [author.SDK / name for name in ['Data/M_Characters.xml', 'Data/M_Buildings.xml',
                   'GPLMx/mx_Hero_Data.dat', 'GPLMx/mx_Building_Data.dat']]
        before = {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in watched}
        files, report = author.prepare()
        hero = ET.fromstring(files['Data/Wayfinder_Characters.xml']).find('Description')
        lodge = ET.fromstring(files['Data/Wayfinder_Buildings.xml']).find('Description')
        self.assertEqual((hero.get('ID'), lodge.get('ID')), ('AVz1', 'ABs1'))
        self.assertEqual(lodge.find('Game/Produces/Unit').get('ID'), hero.get('Name'))
        self.assertEqual(hero.find('Engine/CanUse').get('value'), 'HumanPlayer')
        self.assertEqual(hero.find('Game/Cost').get('value'), '425')
        self.assertEqual(lodge.find('Game/DialogID').get('value'), 'APw1')
        self.assertEqual(hero.find('Game/SightRange').get('value'), '320')
        data = files['GPL/Wayfinder_Data.dat'].decode()
        self.assertIn('(member_title Wayfinder)', ' '.join(data.split()))
        self.assertIn('(member_basicscript wayfinder_tree)', ' '.join(data.split()))
        self.assertIn('[Wayfinder]', data)
        self.assertIn('[Trail_Lodge]', data)
        project = files['GPL/Wayfinder.gplproj'].decode()
        self.assertEqual(project.splitlines(), ['data="Wayfinder_Data.dat"', 'source="Wayfinder.gpl"'])
        for name, raw in files.items():
            self.assertEqual(report['files'][name]['sha256'], hashlib.sha256(raw).hexdigest())
        self.assertFalse(report['nativeIntegrationQualified'])
        self.assertFalse(report['installed'])
        self.assertFalse(report['bytecodeCompiled'])
        dependencies = report['scriptDependencies']
        self.assertEqual(dependencies['scope'], 'direct-decision-tree-symbols-only')
        self.assertEqual(dependencies['nativeBuiltins'], ['SpecifyIntent'])
        for dataset in ['GPL', 'GPLMx']:
            self.assertIn('$explore_map', dependencies['datasets'][dataset])
            self.assertIn('#intent_wandering', dependencies['datasets'][dataset])
            self.assertIn('$hero_wander', dependencies['datasets'][dataset])
        self.assertEqual(before, {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in watched})

    def refused_spec(self, edit, message):
        with tempfile.TemporaryDirectory(prefix='majesty-authoring-check-') as temp:
            source = Path(temp)
            spec = json.loads((author.SOURCE / 'spec.json').read_text())
            edit(spec)
            (source / 'spec.json').write_text(json.dumps(spec))
            (source / 'Wayfinder.gpl').write_bytes((author.SOURCE / 'Wayfinder.gpl').read_bytes())
            with self.assertRaisesRegex(ValueError, message):
                author.prepare(source=source)

    def test_existing_description_id_refused(self):
        self.refused_spec(lambda s: s['hero'].update(id='AVH1'), 'collides with SDK')

    def test_existing_name_case_variant_refused(self):
        self.refused_spec(lambda s: s['hero'].update(name='rAnGeR'), 'collides with SDK')

    def test_draft_cannot_claim_native_qualification(self):
        self.refused_spec(lambda s: s.update(nativeIntegrationQualified=True), 'unqualified drafts')

    def test_missing_runtime_expression_refused(self):
        source = (author.SOURCE / 'Wayfinder.gpl').read_bytes()
        source = source.replace(b'#intent_wandering', b'#wayfinder_missing_intent')
        with self.assertRaisesRegex(ValueError, 'Unresolved GPL expression: wayfinder_missing_intent'):
            author.script_dependencies(author.SDK, source)

    def test_missing_task_function_refused(self):
        source = (author.SOURCE / 'Wayfinder.gpl').read_bytes()
        source = source.replace(b'$hero_wander', b'$wayfinder_missing_task')
        with self.assertRaisesRegex(ValueError, 'Unresolved GPL function: wayfinder_missing_task'):
            author.script_dependencies(author.SDK, source)

    def test_commented_symbols_do_not_create_dependencies(self):
        source = (author.SOURCE / 'Wayfinder.gpl').read_bytes()
        source += b'\n// $wayfinder_missing_task and #wayfinder_missing_intent are comments.\n'
        result = author.script_dependencies(author.SDK, source)
        self.assertNotIn('$wayfinder_missing_task', result['datasets']['GPL'])
        self.assertNotIn('#wayfinder_missing_intent', result['datasets']['GPL'])

    def test_existing_draft_is_preserved(self):
        with tempfile.TemporaryDirectory(prefix='majesty-authoring-existing-') as temp:
            output = Path(temp)
            old = output / 'Wayfinder.bcd'
            old.write_bytes(b'prior draft bytes')
            with self.assertRaises(FileExistsError):
                author.write_draft(output, {'new.txt': b'new draft'}, {})
            self.assertEqual(old.read_bytes(), b'prior draft bytes')
            self.assertFalse((output / 'new.txt').exists())


if __name__ == '__main__':
    unittest.main()

"""Exercise source safety and real installed Alchemist potion/capability composition."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('alchemist_composition', ROOT / 'scripts/compose-alchemist-gameplay.py')
composer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(composer)


class CompositionInputTests(unittest.TestCase):
    def test_traversal_and_linked_sources_are_rejected(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            (root / 'original.gpl').write_text('function Original() begin end')
            (root / 'linked.gpl').symlink_to(root / 'original.gpl')
            for path in ('../original.gpl', '/original.gpl', r'C:\original.gpl', 'linked.gpl'):
                with self.subTest(path=path), self.assertRaises(ValueError):
                    composer.capture(root, path, {})

    def test_windows_project_casing_is_preserved_and_changes_rejected(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            path = root / 'Original.gpl'
            path.write_text('function Original() begin end')
            hashes = {}
            raw, actual = composer.capture(root, 'original.GPL', hashes)
            self.assertEqual(actual, 'Original.gpl')
            self.assertEqual(raw, path.read_bytes())
            path.write_text('changed')
            with self.assertRaisesRegex(ValueError, 'changed while capturing'):
                composer.capture(root, 'original.GPL', hashes)

    def test_existing_output_is_preserved_before_reading_inputs(self):
        with tempfile.TemporaryDirectory() as name:
            output = Path(name)
            (output / 'original').write_text('preserve')
            with self.assertRaisesRegex(ValueError, 'Preserve existing'):
                composer.compose(Path('/missing'), Path('/missing'), output)
            self.assertEqual((output / 'original').read_text(), 'preserve')


@unittest.skipUnless(os.environ.get('MAJESTY_ALCHEMIST_PACKAGE') and os.environ.get('MAJESTY_GAME_SOURCE'),
                     'Full private Workshop package and installed SDK required')
class AuthenticCompositionTests(unittest.TestCase):
    def test_authored_gameplay_and_paired_potion_cleanup(self):
        package = Path(os.environ['MAJESTY_ALCHEMIST_PACKAGE'])
        sdk = Path(os.environ['MAJESTY_GAME_SOURCE'])
        with tempfile.TemporaryDirectory() as name:
            output = Path(name) / 'composition'
            report = composer.compose(package, sdk, output)
            from majesty_cam.gpl import parse_gpl, DefinitionKind
            from majesty_cam.gpl_function_merge import same_function_instructions
            from majesty_cam.descriptions import parse_descriptions
            parsed = parse_gpl((output / 'Alchemist_Composed.gpl').read_text(encoding='cp1252'))
            functions = {i.normalized_name: i for i in parsed.items if i.kind is DefinitionKind.FUNCTION}
            hashes = {}
            originals = composer.project_sources(package, 'GPL/Alchemist.gplproj', hashes)
            effects = {a['effect'].casefold() for a in report['potionActions']}
            for source in originals:
                for item in source.items:
                    if item.kind is DefinitionKind.FUNCTION and item.normalized_name not in effects:
                        self.assertTrue(same_function_instructions(item.text, functions[item.normalized_name].text),
                                        'Unrelated authored gameplay changed: ' + item.name)
            # Actual upstream composition preserves inverse stat adjustments on expiry.
            effect = functions['alchemist_shapeshift_potion_effect'].text.casefold()
            cleanup = functions['shapeshift_potion_end'].text.casefold()
            self.assertIn('"giant_spider"', effect)
            self.assertIn('#attrib_strength, 18', effect)
            self.assertIn('#attrib_strength, -18', cleanup)
            self.assertIn('#attrib_maxhp, 30', effect)
            self.assertIn('#attrib_maxhp, -30', cleanup)
            eligibility = functions['mm_bp_eligibility'].text.casefold()
            self.assertIn('item == #bazaar_item_two) return 0', eligibility)
            self.assertIn('item == #bazaar_item_three) return 1', eligibility)
            for number in ('one', 'two', 'three', 'four', 'five', 'six'):
                body = functions['purchase_bazaar_item_' + number].text.casefold()
                self.assertIn('$mm_bp_eligibility', body)
                self.assertIn('$done_purchasing_market_stuff', body)
            records = parse_descriptions((output / 'Alchemist_Composed.xml').read_bytes()).index
            for action in report['potionActions']:
                matches = [r.to_element() for r in records.values()
                           if r.to_element().get('Name') == action['name']]
                self.assertEqual(len(matches), 1)
                self.assertEqual(matches[0].find('./Game/ValidationScript').get('value'), action['validator'])
                self.assertIn(action['validator'].casefold(), functions)
            self.assertIn('alchemist_dispatch_hero_capability', functions)
            for field in ('compilerInvoked', 'legacyDescriptionsConverted', 'nativeHooksQualified',
                          'browserPlayable', 'published', 'stockSourceBytecodeEquivalenceQualified'):
                self.assertIs(report[field], False)
            self.assertEqual(report, json.loads((output / 'source-composition.json').read_text()))


if __name__ == '__main__':
    unittest.main()

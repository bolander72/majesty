"""Newer inventory metadata must remain source-bound and never masquerade as runtime support."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import struct
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from lib.legacy_inventory_description import plan, encode_game, MODERN_SHA
from lib.legacy_description_wire import unit_parts, unpack_chunk

spec = importlib.util.spec_from_file_location('alchemist_inventory_stager', ROOT / 'scripts/stage-alchemist-native-descriptions.py')
stager = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stager)


class InventoryDescriptionSafetyTests(unittest.TestCase):
    def test_other_executable_cannot_supply_source_flag_encoding(self):
        import xml.etree.ElementTree as ET
        with self.assertRaisesRegex(ValueError, 'audited modern'):
            plan(ET.Element('Description'), b'not the audited executable')


@unittest.skipUnless(os.environ.get('MAJESTY_ALCHEMIST_PACKAGE') and os.environ.get('MAJESTY_GAME_SOURCE'),
                     'Authentic package and installed audited executables required')
class AuthenticInventoryDescriptionTests(unittest.TestCase):
    def test_actual_inventory_metadata_preserved_without_wrong_legacy_map_insertion(self):
        package = Path(os.environ['MAJESTY_ALCHEMIST_PACKAGE'])
        game = Path(os.environ['MAJESTY_GAME_SOURCE'])
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            stager.helpers().compose(package, game, root / 'composition')
            report = stager.stage(root / 'composition', game, package, root / 'native', game)
            self.assertEqual(report['privateUnitCount'], 26)
            self.assertEqual(report['pending'], [])
            self.assertTrue(report['inventoryRuntimeRequired'])
            extensions = json.loads((root / 'native/inventory-description-extensions.json').read_text())
            extension, = extensions
            self.assertEqual(extension['sourceExecutableSha256'], MODERN_SHA)
            self.assertEqual(extension['numericInventoryIndex'], 113)
            self.assertEqual(extension['storedInventoryId'], 0x71564e49)
            values = {item['name']: item for item in extension['attributes']}
            self.assertEqual(set(values), {'CanDropItem', 'PhoenixPhial'})
            self.assertEqual(values['CanDropItem']['canonicalName'], 'ATTRIB_CanDropItem')
            self.assertEqual(values['PhoenixPhial']['canonicalName'], 'PhoenixPhial')
            self.assertEqual([item['value'] for item in extension['attributes']], [0, 0])
            self.assertTrue(extension['runtimeRequired'])
            self.assertFalse(extension['nativeRuntimeQualified'])
            parts = unit_parts((root / 'native/PXF1.dunt').read_bytes())
            head = unpack_chunk(parts[0])[3]
            self.assertEqual(head[8:].split(b'\0')[0], b'PhoenixPhial')
            engine = unpack_chunk(parts[1])[3]
            self.assertEqual(engine[16:20], b'PXF1')
            body = unpack_chunk(parts[2])[3]
            self.assertEqual(struct.unpack_from('<I', body, 96)[0], 0x412)
            self.assertEqual(struct.unpack_from('<II', body, 108), (1, 0))
            self.assertFalse(report['completeNativeDescriptors'])
            self.assertFalse(report['nativeHooksQualified'])
            self.assertFalse(report['browserPlayable'])
            from majesty_cam.descriptions import parse_descriptions
            element = next(r.to_element() for r in parse_descriptions(
                (root / 'composition/Alchemist_Composed.xml').read_bytes()).records if r.description_id == 'PXF1')
            for mutation in ('source', 'attributes', 'flag', 'claim'):
                changed = copy.deepcopy(extension)
                if mutation == 'source': changed['sourceGameSha256'] = 'bad'
                elif mutation == 'attributes': changed['attributes'][0]['value'] = 1
                elif mutation == 'flag': changed['flag']['mask'] = 0
                else: changed['nativeRuntimeQualified'] = True
                with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                    encode_game(element.find('Game'), {}, {}, changed)


if __name__ == '__main__':
    unittest.main()

"""Legacy conversion must preserve authored semantics and expose incomplete bindings."""
import importlib.util
import os
from pathlib import Path
import struct
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from lib.legacy_description_game import encode_character, encode_building, encode_overlay
from lib.legacy_description_wire import unpack_chunk, children, unit_parts

spec = importlib.util.spec_from_file_location('alchemist_game_parts', ROOT / 'scripts/stage-alchemist-game-parts.py')
stager = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stager)


class LegacyGamePartTests(unittest.TestCase):
    def test_unknown_fields_flags_and_unresolved_attributes_cannot_be_dropped(self):
        sources = [('<Game version="1"><Unknown value="5"/></Game>', 'field'),
                   ('<Game version="1"><Flags value="IsInventoryItem"/></Game>', 'flag'),
                   ('<Game version="1"><Flags value="NotFlaggable"/></Game>', 'paired'),
                   ('<Game version="1"><Attributes><Attribute ID="PhoenixPhial" Value="0"/></Attributes></Game>', 'binding')]
        for source, reason in sources:
            with self.subTest(reason=reason), self.assertRaisesRegex(ValueError, reason):
                encode_character(ET.fromstring(source), {})

    def test_unresolved_or_ambiguous_spell_and_upgrade_identities_are_refused(self):
        source = ET.fromstring('<Game version="1"><AllowedSpells><Spell ID="0" Value="new_spell"/></AllowedSpells></Game>')
        for names in ({}, {'new_spell': None}):
            with self.assertRaises(ValueError):
                encode_character(source, names)
        source = ET.fromstring('<Game version="1"><UpgradeTo value="NewLab2"/></Game>')
        with self.assertRaisesRegex(ValueError, 'Unresolved'):
            encode_building(source, {})

    def test_duplicate_spell_keys_and_unknown_equipment_cannot_be_encoded(self):
        source = ET.fromstring('<Game version="1"><AllowedSpells><Spell ID="0" Value="a"/><Spell ID="0" Value="b"/></AllowedSpells></Game>')
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            encode_character(source, {'a': 'ASs1', 'b': 'AFa1'})
        source = ET.fromstring('<Game version="1"><AllowedWeapon value="Unknown"/></Game>')
        with self.assertRaisesRegex(ValueError, 'equipment'):
            encode_character(source, {})

    def test_bounds_duplicate_scalars_and_nonfinite_multiplier_are_refused(self):
        for source in ('<Game version="1"><Cost value="4294967296"/></Game>',
                       '<Game version="1"><Cost value="5"/><Cost value="6"/></Game>'):
            with self.assertRaises(ValueError):
                encode_character(ET.fromstring(source), {})
        with self.assertRaisesRegex(ValueError, 'multiplier'):
            encode_building(ET.fromstring('<Game version="1"><Multiplier value="nan"/></Game>'), {})

    def test_inconsistent_wire_lengths_and_child_counts_are_refused(self):
        actual = encode_overlay(ET.fromstring('<Game version="1"/>'))
        with self.assertRaises(ValueError):
            unpack_chunk(actual[:-1])
        with self.assertRaises(ValueError):
            children(actual, 2)
        with self.assertRaises(ValueError):
            unit_parts(actual)

    def test_existing_stage_preserved_before_reading_inputs(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            (root / 'preserve').write_text('original')
            with self.assertRaisesRegex(ValueError, 'Preserve existing'):
                stager.stage(Path('/missing'), Path('/missing'), root)
            self.assertEqual((root / 'preserve').read_text(), 'original')


@unittest.skipUnless(os.environ.get('MAJESTY_ALCHEMIST_PACKAGE') and os.environ.get('MAJESTY_GAME_SOURCE'),
                     'Authentic private package and installed original game required')
class AuthenticLegacyGamePartsTests(unittest.TestCase):
    def test_real_stock_byte_equality_and_authored_stats_spells_and_three_lab_stages(self):
        helper = stager.source_helper()
        package = Path(os.environ['MAJESTY_ALCHEMIST_PACKAGE'])
        game = Path(os.environ['MAJESTY_GAME_SOURCE'])
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            helper.compose(package, game, root / 'composed')
            report = stager.stage(root / 'composed', game, root / 'parts')
            self.assertEqual(report['exactStockGameParts'], dict(Building=114, Character=85, Overlay=205))
            self.assertEqual(len(report['stockDiscrepancies']), 13)
            for row in report['stockDiscrepancies']:
                self.assertEqual(row['originalBytes'], row['generatedBytes'])
                self.assertTrue(row['differences'])
                for difference in row['differences']:
                    self.assertIn(difference['payloadOffset'], (88, 92))
                    self.assertEqual(difference['original'], 0xcdcdcdcd)
            hero = unpack_chunk((root / 'parts/ALC1.secd').read_bytes(), b'SECD')
            self.assertEqual(hero[1:3], (8, 0))
            payload = hero[3]
            self.assertEqual(struct.unpack_from('<II', payload, 4), (600, 1157))
            self.assertEqual(struct.unpack_from('<III', payload, 12), (11, 260, 2))
            self.assertEqual(struct.unpack_from('<II', payload, 24), (1, 1))
            self.assertEqual(struct.unpack_from('<I', payload, 60)[0], 45)
            self.assertEqual(struct.unpack_from('<I', payload, 64)[0], 55)
            self.assertEqual(payload[92:96], b'NM18')
            self.assertEqual(payload[100:104], b'hAL0')
            at, maps = 108, []
            for _ in range(4):
                version, count = struct.unpack_from('<II', payload, at)
                self.assertEqual(version, 1)
                at += 8
                maps.append([struct.unpack_from('<II', payload, at + i * 8) for i in range(count)])
                at += count * 8
            self.assertEqual(at, len(payload))
            self.assertEqual(maps[1:3], [[(0, 3)], [(0, 1)]])  # actual Dagger and Leather families
            self.assertEqual(maps[3], [(i, int.from_bytes(key, 'little'))
                                     for i, key in enumerate((b'ASs1', b'AFa1', b'AMa1'))])
            for tier, cost in [(1, 1400), (2, 1800), (3, 2200)]:
                lab = unpack_chunk((root / f'parts/ALB{tier}.secd').read_bytes(), b'SECD')[3]
                self.assertEqual(lab[:4], b'CG01')
                self.assertEqual(struct.unpack_from('<I', lab, 4)[0], cost)
                self.assertEqual(lab[-4:], b'ALC1')
            self.assertNotIn('PXF1.secd', report['files'])
            self.assertTrue(any(p['id'] == 'PXF1' and 'IsInventoryItem' in p['reason'] for p in report['pending']))
            for key in ('completeNativeDescriptors', 'stockCorpusFullyRoundTripped', 'nativeHooksQualified',
                        'browserPlayable', 'installed', 'published'):
                self.assertIs(report[key], False)


if __name__ == '__main__':
    unittest.main()

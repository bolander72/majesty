"""Verify real authored native resources and prevent silent attachment/sound substitution."""
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
from lib.legacy_description_engine import encode_engine, descriptor
from lib.legacy_description_wire import unit_parts, unpack_chunk, children, cam_payloads

spec = importlib.util.spec_from_file_location('alchemist_native_descriptions', ROOT / 'scripts/stage-alchemist-native-descriptions.py')
stager = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stager)


class EnginePartSafetyTests(unittest.TestCase):
    def setUp(self):
        self.resources = {'Unit': {}, 'Action': {}, 'Sound': {}, 'Movement': {}}

    def unit(self, body, subtype='Character'):
        return ET.fromstring('<Description type="Unit" subType="' + subtype +
                             '" ID="ALC1" Name="Alchemist"><Engine version="1">' + body + '</Engine></Description>')

    def test_unresolved_movement_and_sound_cannot_inherit_a_stock_actor(self):
        for body in ('<Attachment kind="Movement" type="Walk" ID="Missing"/>',
                     '<DefaultSound value="Missing"/>'):
            with self.assertRaisesRegex(ValueError, 'Unresolved'):
                encode_engine(self.unit(body), self.resources)

    def test_unsupported_fields_script_routes_and_attachment_types_refused(self):
        for body in ('<Unknown value="1"/>',
                     '<Script type="1" cProc="3" GPLFunction="Callback"/>',
                     '<Attachment kind="Weapon" type="Attack" ID="Missing"/>',
                     '<AttachmentPointID value="2"/>'):
            with self.assertRaises(ValueError):
                encode_engine(self.unit(body), self.resources)

    def test_duplicate_fields_and_sound_override_keys_refused(self):
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            encode_engine(self.unit('<Menu value="6"/><Menu value="7"/>'), self.resources)
        resources = dict(self.resources, Action={'attack': 'A008'}, Sound={'sound': 'AXH1'})
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            encode_engine(self.unit('<SoundOverride type="attack" ID="sound"/>' * 2), resources)

    def test_complete_game_part_required_for_character(self):
        with self.assertRaisesRegex(ValueError, 'Complete authored'):
            descriptor(self.unit(''), self.resources)
        projectile = self.unit('', subtype='Projectile')
        projectile.append(ET.Element('Game', version='1'))
        with self.assertRaisesRegex(ValueError, 'Unsupported authored Game'):
            descriptor(projectile, self.resources)

    def test_existing_output_preserved(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            (root / 'preserve').write_text('original')
            with self.assertRaisesRegex(ValueError, 'Preserve existing'):
                stager.stage(Path('/missing'), Path('/missing'), Path('/missing'), root)
            self.assertEqual((root / 'preserve').read_text(), 'original')


@unittest.skipUnless(os.environ.get('MAJESTY_ALCHEMIST_PACKAGE') and os.environ.get('MAJESTY_GAME_SOURCE'),
                     'Authentic Workshop package and installed stock files required')
class AuthenticNativeDescriptionTests(unittest.TestCase):
    def test_actual_art_voices_callbacks_movement_and_archive_preserve_full_names(self):
        package = Path(os.environ['MAJESTY_ALCHEMIST_PACKAGE'])
        game = Path(os.environ['MAJESTY_GAME_SOURCE'])
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            stager.helpers().compose(package, game, root / 'composition')
            report = stager.stage(root / 'composition', game, package, root / 'native')
            self.assertEqual(report['privateUnitCount'], 25)
            self.assertEqual(report['exactStockHeaders'], 556)
            self.assertEqual(report['exactStockEngineParts'],
                             dict(Building=113, Character=96, Overlay=202, ParticleSystem=22, Projectile=37, General=78))
            self.assertEqual(len(report['stockExceptions']), 8)
            self.assertEqual({p['id'] for p in report['pending']}, {'PXF1'})
            archive = cam_payloads((root / 'native/alchemist-native-unittype.cam').read_bytes())
            self.assertEqual(len(archive), 25)
            parts = unit_parts(archive[b'DUNT', b'ALC1'])
            head = unpack_chunk(parts[0])[3]
            self.assertEqual(head[8:].split(b'\0')[0], b'Alchemist')
            prim = unpack_chunk(parts[1])[3]
            self.assertEqual(prim[16:20], b'ALC1')
            self.assertEqual(prim[-12:-8], b'AXH1')
            start = prim.index(0, 32) + 1
            tag, size, version, count = struct.unpack_from('<4sIII', prim, start)
            self.assertEqual(tag, b'ATCH')
            move = unpack_chunk(children(prim[start + 16:start + 16 + size], count)[1])[3]
            self.assertEqual(move[:8], struct.pack('<I', 1) + b'CL01')
            for tier in (1, 2, 3):
                parts = unit_parts(archive[b'DUNT', f'ALB{tier}'.encode()])
                self.assertEqual(unpack_chunk(parts[0])[3][8:].split(b'\0')[0],
                                 f'AlchemistsLaboratory{tier}'.encode())
                self.assertEqual(unpack_chunk(parts[1])[3][16:20], f'ALB{tier}'.encode())
                self.assertEqual(unpack_chunk(parts[1])[3][-12:-8], b'AXL1')
            parts = unit_parts(archive[b'DUNT', b'AMM2'])
            self.assertEqual(len(parts), 2)
            prim = unpack_chunk(parts[1])[3]
            self.assertEqual(prim[32:prim.index(0, 32)].decode(), 'Alchemist_Miasma_Mist_Missile_Hit')
            prim = unpack_chunk(unit_parts(archive[b'DUNT', b'ASO1'])[1])[3]
            self.assertEqual(struct.unpack_from('<I', prim, 24)[0], 2)
            self.assertEqual(prim[36:prim.index(0, 36)].decode(), 'Alchemy_Paralytic_Oil_End')
            self.assertTrue(report['soundBindingVerified'])
            self.assertTrue(report['particleConverted'])
            for key in ('actionPartsConverted', 'completeNativeDescriptors',
                        'nativeHooksQualified', 'browserPlayable', 'installed', 'published',
                        'completeSoundBodyCompatibilityQualified'):
                self.assertIs(report[key], False)


if __name__ == '__main__':
    unittest.main()

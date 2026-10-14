"""Authored cast/validation/cooldown and complete Miasma parameters must survive conversion."""
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
from lib.legacy_description_action import action_descriptor, action_parts, encode_action_game
from lib.legacy_description_wire import cam_payloads, unit_parts, unpack_chunk
from lib.legacy_description_particle import real, vector, encode_particle_engine

spec = importlib.util.spec_from_file_location('alchemist_action_stage', ROOT / 'scripts/stage-alchemist-native-actions.py')
stager = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stager)


class ActionParticleSafetyTests(unittest.TestCase):
    def test_bad_external_script_and_parent_lengths_are_refused(self):
        source = ET.fromstring('<Description type="Action" subType="Standard" ID="APS1" Name="Potion"><Engine version="1"><Script type="0" cProc="0" GPLFunction="Effect"/></Engine></Description>')
        raw = action_descriptor(source, {'Unit': {}, 'Sound': {}})
        head, engine, game = action_parts(raw)
        self.assertEqual(struct.unpack_from('<I', engine, 4)[0], 64)
        self.assertGreater(len(engine), 80)
        for cut in (1, 5, 16, 40):
            with self.assertRaises(ValueError):
                action_parts(raw[:-cut])

    def test_combined_spell_types_preserved_but_unknown_game_fields_rejected(self):
        game = ET.fromstring('<Game version="1"><Flags value="IsSpell"/><SpellType value="Attack"/><SpellType value="CombatUtility"/></Game>')
        self.assertEqual(struct.unpack_from('<I', encode_action_game(game), 28)[0], 3)
        game.append(ET.Element('Unknown', value='1'))
        with self.assertRaisesRegex(ValueError, 'Unsupported'):
            encode_action_game(game)

    def test_nonfinite_and_wrong_dimension_particle_values_refused(self):
        for value in ('nan', 'inf', '1e100'):
            with self.assertRaises(ValueError):
                real(value)
        with self.assertRaisesRegex(ValueError, 'dimension'):
            vector('1,2', 3)

    def test_existing_stage_is_preserved(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            (root / 'preserve').write_text('original')
            with self.assertRaisesRegex(ValueError, 'Preserve existing'):
                stager.stage(Path('/missing'), Path('/missing'), Path('/missing'), root)
            self.assertEqual((root / 'preserve').read_text(), 'original')


@unittest.skipUnless(os.environ.get('MAJESTY_ALCHEMIST_PACKAGE') and os.environ.get('MAJESTY_GAME_SOURCE'),
                     'Authentic private package and installed game required')
class AuthenticActionParticleTests(unittest.TestCase):
    def test_authored_spell_timing_validation_sound_and_miasma_parameters(self):
        package = Path(os.environ['MAJESTY_ALCHEMIST_PACKAGE'])
        game = Path(os.environ['MAJESTY_GAME_SOURCE'])
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            dependency = stager.module()
            dependency.helpers().compose(package, game, root / 'composition')
            report = stager.stage(root / 'composition', game, package, root / 'actions')
            self.assertEqual(report['authoredActionCount'], 13)
            self.assertEqual(report['exactStockActions'], 127)
            self.assertEqual(len(report['stockExceptions']), 5)
            archive = cam_payloads((root / 'actions/alchemist-native-action.cam').read_bytes())
            for key, level, rank, duration, timeout, image, sound, callback in (
                ('ASs1', 5, 5, 5000, 45000, 128, b'AXC1', 'Alchemist_Stun_Serum_Begin'),
                ('AFa1', 3, 4, 30000, 45000, 64, bytes(4), 'Alchemist_Flash_Flask_Begin'),
                ('AMa1', 8, 4, 21000, 60000, 128, b'AXC1', 'Alchemist_Miasma_Mist_Hit')):
                head, engine, part = action_parts(archive[b'DACT', key.encode()])
                self.assertEqual(struct.unpack_from('<I', engine, 20)[0], image)
                self.assertEqual(engine[24:28], sound)
                self.assertEqual(engine[88:engine.index(0, 88)].decode(), callback)
                values = struct.unpack_from('<7I', part, 16)
                self.assertEqual(values, (1, duration, timeout, 1, level, rank, 0))
            for binding in report['callbackBindings']:
                if binding['id'].startswith('APS') or binding['id'] in ('A020', 'A021', 'A022', 'A023', 'A024', 'A025'):
                    self.assertTrue(binding['validation'].startswith('MM_BP_Validate_'))
            units = dependency.stage(root / 'composition', game, package, root / 'units')
            self.assertTrue(units['particleConverted'])
            self.assertEqual(units['exactStockEngineParts']['ParticleSystem'], 22)
            raw = (root / 'units/AMM4.dunt').read_bytes()
            parts = unit_parts(raw)
            self.assertEqual(len(parts), 2)
            version = unpack_chunk(parts[1])[1]
            self.assertEqual(version, 5)
            body = unpack_chunk(parts[1])[3]
            self.assertEqual(body[16:20], b'AMm4')
            self.assertEqual(struct.unpack_from('<III', body, 20), (2, 1, 10))
            self.assertEqual(struct.unpack_from('<6f', body, 32), (-1000., -1000., -1000., 1000., 1000., 1000.))
            self.assertEqual(struct.unpack_from('<I', body, 56)[0], 10)
            self.assertEqual(struct.unpack_from('<f', body, 120)[0], 8.)
            self.assertEqual(struct.unpack_from('<I', body, 124)[0], 0xffffffff)
            self.assertEqual(struct.unpack_from('<I', body, 136)[0], 1000)
            self.assertEqual(struct.unpack_from('<4f', body, 180), (0., 0., 0., 1.))
            self.assertEqual(struct.unpack_from('<f', body, 216)[0], 7.)
            for key in ('nativeActionExecutionQualified', 'nativeHooksQualified', 'browserPlayable', 'installed', 'published'):
                self.assertIs(report[key], False)


if __name__ == '__main__':
    unittest.main()

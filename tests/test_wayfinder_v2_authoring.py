"""Private original-SDK checks; these do not qualify live gameplay."""
import importlib.util
import os
from pathlib import Path
import struct
import unittest

ROOT = Path(__file__).resolve().parents[1]
SDK = Path(os.environ.get('MAJESTY_SDK_ROOT', str(ROOT / 'upstream/majesty-recomp/original/gog/SDK/OriginalQuests')))


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / file)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


author = module('v2_author', 'scripts/prepare-wayfinder-pack.py')
native = module('v2_native', 'scripts/prepare-wayfinder-native-resources.py')


@unittest.skipUnless(SDK.is_dir(), 'Requires the privately owned original SDK')
class WayfinderV2(unittest.TestCase):
    def test_distinct_melee_equipment_and_art_keep_the_original_descriptor_shape(self):
        files, report = author.prepare(sdk=SDK, source=ROOT / 'content/wayfinder-trail-lodge/v2')
        original = native.resident(SDK.parents[1] / 'Data/unittype.cam')
        base = native.cam_records(original)[b'DUNT', b'AVH1']
        old = native.description(native.resident(SDK / 'Data/M_Characters.xml'), 'AVH1')
        new = native.description(files['Data/Wayfinder_Characters.xml'], 'AVz1')
        encoded = native.legacy_descriptor(base, old, new, True)
        data = native.children(native.chunk(encoded)[3], 1)[0]
        head, prim, sec = native.children(native.chunk(data)[3], 3)
        game = native.chunk(sec)[3]
        self.assertEqual(len(game), 156)
        self.assertEqual(struct.unpack_from('<II', game, 24), (1, 1))
        self.assertEqual(struct.unpack_from('<I', game, 128)[0], 8) # SDK Staff family
        self.assertEqual(struct.unpack_from('<I', game, 152)[0], 0) # No inherited Adept spell
        self.assertIn(b'AVz1', native.chunk(prim)[3])
        self.assertNotIn(b'AVH1', native.chunk(prim)[3])
        source = files['GPL/Wayfinder.gpl'].decode()
        data_text = files['GPL/Wayfinder_Data.dat'].decode()
        self.assertIn('prototype WayfinderSupportPrototype', source)
        self.assertIn('integer counter;', source)
        self.assertIn('{WayfinderSupportPrototype', data_text)
        self.assertNotIn('$AddAttribute', source)
        for dataset in ['GPL', 'GPLMx']:
            self.assertIn('$CreateAgent', report['scriptDependencies']['datasets'][dataset])

    def test_unknown_equipment_baseline_is_rejected(self):
        files, _ = author.prepare(sdk=SDK, source=ROOT / 'content/wayfinder-trail-lodge/v2')
        original = native.cam_records(native.resident(SDK.parents[1] / 'Data/unittype.cam'))
        damaged = bytearray(original[b'DUNT', b'AVH1'])
        offset = damaged.index(b'SECD') + 16 + 128
        struct.pack_into('<I', damaged, offset, 999)
        old = native.description(native.resident(SDK / 'Data/M_Characters.xml'), 'AVH1')
        new = native.description(files['Data/Wayfinder_Characters.xml'], 'AVz1')
        with self.assertRaisesRegex(ValueError, 'weapon family'):
            native.legacy_descriptor(damaged, old, new, True)

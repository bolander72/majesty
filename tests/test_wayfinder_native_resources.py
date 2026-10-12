"""Legacy resource integrity checks; native gameplay is qualified separately."""
import importlib.util
from pathlib import Path
import struct
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]


def module(name, filename):
    loader = importlib.util.spec_from_file_location(name, ROOT / filename)
    value = importlib.util.module_from_spec(loader)
    loader.loader.exec_module(value)
    return value


native = module('wayfinder_native', 'scripts/prepare-wayfinder-native-resources.py')
author = module('wayfinder_draft', 'scripts/prepare-wayfinder-pack.py')


def parts(raw):
    _, _, _, data = native.chunk(raw, b'DUNT')
    _, _, count, payload = native.chunk(native.children(data, 1)[0], b'DATA')
    return native.children(payload, count)


class NativeResourceChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original = native.resident(native.UNIT_CAM)
        cls.records = native.cam_records(cls.original)
        cls.draft, _ = author.prepare()

    def descriptors(self):
        result = {}
        for old, new, source, draft, hero in [('AVH1', 'AVz1', 'M_Characters.xml', 'Wayfinder_Characters.xml', True), ('ABW1', 'ABs1', 'M_Buildings.xml', 'Wayfinder_Buildings.xml', False)]:
            base = native.description(native.resident(native.SDK / source), old)
            proposed = native.description(self.draft['Data/' + draft], new)
            result[new.encode()] = native.legacy_descriptor(self.records[b'DUNT', old.encode()], base, proposed, hero)
        return result

    def test_new_identities_and_original_rendering_remain_separate(self):
        additions = self.descriptors()
        loaded = native.cam_records(native.encode_cam(additions))
        self.assertEqual(set(loaded), {(b'DUNT', b'AVz1'), (b'DUNT', b'ABs1')})
        for old, new, kind in [(b'AVH1', b'AVz1', 3), (b'ABW1', b'ABs1', 2)]:
            head, prim, _ = parts(loaded[b'DUNT', new])
            self.assertEqual(prim, parts(self.records[b'DUNT', old])[1])
            self.assertEqual(native.chunk(head)[3][:8], new + struct.pack('<I', kind))
        self.assertEqual(native.resident(native.UNIT_CAM), self.original)

    def test_paid_stats_and_new_recruitment_link(self):
        additions = self.descriptors()
        hero = native.chunk(parts(additions[b'AVz1'])[2])[3]
        lodge = native.chunk(parts(additions[b'ABs1'])[2])[3]
        self.assertEqual(struct.unpack_from('<I', hero, 4)[0], 425)
        self.assertEqual(struct.unpack_from('<I', hero, 12)[0], 22)
        self.assertEqual(struct.unpack_from('<I', hero, 16)[0], 320)
        self.assertEqual(struct.unpack_from('<I', hero, 88)[0], 12000)
        self.assertEqual(struct.unpack_from('<I', lodge, 4)[0], 900)
        self.assertEqual(struct.unpack_from('<I', lodge, 28)[0], 300)
        self.assertEqual(lodge[:4], b'APw1')
        self.assertEqual(lodge[72:], b'AVz1')

    def test_native_directory_filenames_include_prototype_names(self):
        cam = native.encode_cam(self.descriptors(), {b'AVz1': 'Wayfinder', b'ABs1': 'Trail_Lodge'})
        self.assertEqual(struct.unpack_from('<20s', cam, 36)[0].rstrip(b'\0'), b'AVz1Wayfinder')
        self.assertEqual(struct.unpack_from('<20s', cam, 64)[0].rstrip(b'\0'), b'ABs1Trail_Lodge')
        self.assertEqual(set(native.cam_records(cam)), {(b'DUNT', b'AVz1'), (b'DUNT', b'ABs1')})
        with self.assertRaises(ValueError):
            native.encode_cam(self.descriptors(), {b'AVz1': 'x' * 17})

    def test_forged_count_and_outside_payload_refused(self):
        cam = native.encode_cam(self.descriptors())
        for at, value in [(28, 0xffffffff), (56, len(cam) + 1)]:
            raw = bytearray(cam)
            struct.pack_into('<I', raw, at, value)
            with self.subTest(at=at), self.assertRaises(ValueError):
                native.cam_records(raw)

    def test_duplicate_resource_and_overlapping_payload_refused(self):
        cam = native.encode_cam(self.descriptors())
        duplicate = bytearray(cam)
        duplicate[64:68] = duplicate[36:40]
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            native.cam_records(duplicate)
        overlap = bytearray(cam)
        struct.pack_into('<I', overlap, 84, struct.unpack_from('<I', cam, 56)[0])
        with self.assertRaisesRegex(ValueError, 'overlap'):
            native.cam_records(overlap)

    def test_altered_inherited_game_baseline_refused(self):
        raw = bytearray(self.records[b'DUNT', b'AVH1'])
        at = raw.index(b'SECD') + 16 + 4
        struct.pack_into('<I', raw, at, 1)
        base = native.description(native.resident(native.SDK / 'M_Characters.xml'), 'AVH1')
        proposed = native.description(self.draft['Data/Wayfinder_Characters.xml'], 'AVz1')
        with self.assertRaisesRegex(ValueError, 'Cost differs'):
            native.legacy_descriptor(raw, base, proposed, True)

    def test_truncated_descriptor_and_changed_membership_refused(self):
        raw = self.records[b'DUNT', b'ABW1']
        base = native.description(native.resident(native.SDK / 'M_Buildings.xml'), 'ABW1')
        proposed = native.description(self.draft['Data/Wayfinder_Buildings.xml'], 'ABs1')
        with self.assertRaisesRegex(ValueError, 'declared shape'):
            native.legacy_descriptor(raw[:-1], base, proposed)
        proposed.find('Game/Produces/Unit').set('ID', 'Ranger')
        with self.assertRaisesRegex(ValueError, 'does not produce'):
            native.legacy_descriptor(raw, base, proposed)


if __name__ == '__main__':
    unittest.main()

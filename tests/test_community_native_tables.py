"""Native table coexistence: IDs, positional inventory, voices and saved labels."""
from dataclasses import replace
from pathlib import Path
import struct
import sys
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'third_party/majesty-mod-manager/src'))
sys.path.insert(0, str(ROOT / 'scripts'))
from majesty_cam.cam import read_cam
from majesty_cam.strt import StrtRecord, StrtTable
from lib.community_native_tables import (merge_catalog, merge_dependencies, merge_strings,
    name_binding, native_titles, phantom_name_descriptor, troubadour_sound_descriptor,
    troubadour_sound_unit)
from lib.legacy_description_wire import encode_description_cam, unit_parts
from lib.legacy_description_sound import selection_sound, sound_parts
from lib.legacy_description_engine import descriptor
from lib.legacy_description_game import encode_character


def integer(tag):
    return int.from_bytes(tag.encode('ascii'), 'little')


def unit(identity='AVp1', name='Phantom', sound='0'):
    element = ET.fromstring(f'<Description type="Unit" subType="Character" ID="{identity}" Name="{name}">'
        f'<Engine version="1"><ImageIDBase value="{identity}"/><DefaultSound value="{sound}"/></Engine>'
        '<Game version="1"><NameGenType value="NM11"/><MaxHP value="18"/></Game></Description>')
    return descriptor(element, {'Movement': {}, 'Sound': {'troubv': 'BT01'}, 'Action': {}},
                      encode_character(element.find('Game'), {}))


def archive(rows):
    return read_cam(encode_description_cam(rows, b'DUNT'))


class NativeTablesTests(unittest.TestCase):
    def table(self, *rows):
        return StrtTable(b'\x01\x00', tuple(StrtRecord(key, text) for key, text in rows))

    def test_catalog_preserves_stock_and_allows_only_owned_same_name_change(self):
        one, other = unit(), unit('AVq1', 'Other')
        changed = bytearray(one)
        changed[-4] ^= 1
        stock, private = archive({'AVp1': one, 'AVq1': other}), archive({'AVp1': bytes(changed)})
        with self.assertRaisesRegex(ValueError, 'Unowned'):
            merge_catalog(stock, [private], b'DUNT')
        merged, report = merge_catalog(stock, [private], b'DUNT', {b'AVp1'})
        self.assertEqual(merged.sections[0].entries[1], stock.sections[0].entries[1])
        self.assertEqual(report['replaced'], ['AVp1'])
        self.assertTrue(report['unrelatedPayloadsPreserved'])

    def test_owned_identity_does_not_authorize_replacing_its_character(self):
        with self.assertRaisesRegex(ValueError, 'Unowned'):
            merge_catalog(archive({'AVp1': unit()}),
                          [archive({'AVp1': unit(name='Renamed stock substitute')})], b'DUNT', {b'AVp1'})

    def test_two_overlays_cannot_claim_one_descriptor(self):
        overlay = archive({'AVq1': unit('AVq1', 'Other')})
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            merge_catalog(archive({'AVp1': unit()}), [overlay, overlay], b'DUNT')

    def test_string_changes_require_explicit_authored_permission(self):
        old = self.table((1, b'stock'), (2, b'old help'))
        new = self.table((2, b'authored help'), (3, b'new'))
        with self.assertRaisesRegex(ValueError, 'Conflicting'):
            merge_strings(old, new)
        self.assertEqual(merge_strings(old, new, allowed_overrides={2}).records,
                         self.table((1, b'stock'), (2, b'authored help'), (3, b'new')).records)

    def test_positional_inventory_keeps_unused_slots_and_accepts_duplicate_ids(self):
        old = self.table((0, b'stock'), (0, b''))
        new = self.table((0, b'stock'), (0, b'Unknown Item'), (2, b'new item'))
        self.assertEqual(merge_strings(old, new, True).records,
                         old.records + (StrtRecord(2, b'new item'),))

    def test_positional_inventory_refuses_moved_or_changed_owned_items(self):
        old = self.table((0, b'weapon'), (1, b'Phoenix Phial'))
        for new in [self.table((1, b'Phoenix Phial'), (0, b'weapon')),
                    self.table((0, b'weapon')),
                    self.table((0, b'weapon'), (1, b'other item'))]:
            with self.subTest(new=new), self.assertRaises(ValueError):
                merge_strings(old, new, True)

    def test_alias_titles_keep_deployed_level_labels(self):
        old = self.table(*[(integer('ABx' + str(i)), b'Alchemy Lab' +
            (b' Level ' + str(i).encode() if i > 1 else b'')) for i in range(1, 4)])
        bindings = {'ABx' + str(i): {'display': 'Alchemy Lab'} for i in range(1, 4)}
        bindings['AVp1'] = {'display': 'Phantom'}
        rows = native_titles(self.table((10, b'stock')), bindings, old).records
        self.assertEqual(rows[1:4], old.records)
        self.assertEqual(rows[-1], StrtRecord(integer('AVp1'), b'Phantom'))

    def test_alias_titles_refuse_occupied_identity_and_changed_deployed_labels(self):
        with self.assertRaises(ValueError):
            native_titles(self.table((integer('AVp1'), b'Other')),
                          {'AVp1': {'display': 'Phantom'}}, self.table())
        with self.assertRaises(ValueError):
            native_titles(self.table(), {'ABx2': {'display': 'Alchemy Lab'}},
                          self.table((integer('ABx2'), b'Alchemy Lab')))

    def test_prerequisites_keep_stock_rules_and_authored_postfix_logic(self):
        old = b'# stock\r\nABJ1\r\nABx1 : ABJ2 ABJ3 NOT NOT ||\r\n\r\n'
        source = b'ALB1 : ABJ2 ABJ3 NOT NOT ||\nBDG1\nPHG1 : ABJ2 ABJ3 NOT NOT ||\n\n'
        merged = merge_dependencies(old, source,
            {'ALB1': 'ABx1', 'BDG1': 'ABt1', 'PHG1': 'ABu1'})
        self.assertTrue(merged.startswith(old.rstrip(b'\r\n') + b'\r\n'))
        self.assertEqual(merged.count(b'ABx1'), 1)
        self.assertIn(b'ABt1\r\n', merged)
        self.assertTrue(merged.endswith(b'ABu1 : ABJ2 ABJ3 NOT NOT ||\r\n\r\n'))

    def test_prerequisites_refuse_changed_existing_or_duplicate_keys(self):
        for old in [b'ABt1 : ABJ3\n\n', b'ABJ1\nABJ1\n\n']:
            with self.assertRaises(ValueError):
                merge_dependencies(old, b'BDG1\n\n', {'BDG1': 'ABt1'})

    def test_phantom_name_relocation_changes_only_generator_reference(self):
        raw = unit()
        adapted = phantom_name_descriptor(raw)
        parts = unit_parts(raw)
        at = 32 + len(parts[0]) + len(parts[1]) + 16 + 92
        self.assertEqual(adapted, raw[:at] + b'NMPH' + raw[at + 4:])
        with self.assertRaises(ValueError):
            phantom_name_descriptor(unit('AVq1', 'Other'))

    def test_troubadour_relocation_keeps_original_waveforms_and_phase_parameters(self):
        element = ET.fromstring('<Description type="Sound" subType="Standard" ID="BT01" Name="TroubV">'
            '<Engine version="1"><Category value="0"/><Phase ID="Select"><Wave value="TV01"/>'
            '<DistanceModifier value="10000.0"/></Phase></Engine></Description>')
        raw = selection_sound(element)
        adapted = troubadour_sound_descriptor(raw)
        self.assertEqual(adapted, raw[:48] + b'BTV1' + raw[52:])
        self.assertEqual(sound_parts(adapted)[1], sound_parts(raw)[1])
        hero = unit('AVv1', 'Troubadour', 'TroubV')
        changed = troubadour_sound_unit(hero)
        parts = unit_parts(hero)
        at = 32 + len(parts[0]) + len(parts[1]) - 12
        self.assertEqual(changed, hero[:at] + b'BTV1' + hero[at + 4:])

    def test_name_alias_manifest_preserves_original_suffix_sources(self):
        raw = name_binding()
        self.assertEqual(raw[:12], b'MNB1' + struct.pack('<II', 1, 1))
        self.assertEqual(raw[12:], b'NM11NMPHHNP0HNP1HN43HN44')


if __name__ == '__main__':
    unittest.main()

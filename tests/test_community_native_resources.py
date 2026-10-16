"""Guard native conversion boundaries without stock game or creator media fixtures."""
import hashlib
from pathlib import Path
import struct
import sys
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from lib import legacy_inventory_description as inventory
from lib.legacy_description_sound import selection_sound, clone_selection_sound, sound_parts
from lib.legacy_description_wire import encode_description_cam, cam_payloads
from lib.legacy_description_game import encode_character


class PrivateEquipmentWireTests(unittest.TestCase):
    def game(self, weapon):
        return ET.fromstring('<Game version="1"><AllowedWeapon value="' + weapon + '"/></Game>')

    def test_private_type_uses_original_integer_map_without_stock_substitution(self):
        registry = {'AllowedWeapon': {'MME_D82AF6': 0xD82AF6}}
        private = encode_character(self.game('MME_D82AF6'), {}, equipment_ids=registry)
        stock = encode_character(self.game('Staff'), {})
        self.assertEqual(struct.unpack_from('<IIII', private, 132), (1, 1, 0, 0xD82AF6))
        expected = bytearray(stock)
        struct.pack_into('<I', expected, 144, 0xD82AF6)
        self.assertEqual(private, expected)

    def test_unregistered_family_remains_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Unsupported equipment family'):
            encode_character(self.game('MME_D82AF6'), {})

    def test_private_identity_cannot_relabel_stock_or_overflow_native_range(self):
        for registry in [{'AllowedWeapon': {'Staff': 0xD82AF6}},
                         {'AllowedWeapon': {'MME_D82AF6': 8}},
                         {'AllowedWeapon': {'MME_1000000': 0x1000000}},
                         {'AllowedWeapon': {'MME_D82AF6': True}},
                         {'UnknownSlot': {}}]:
            with self.subTest(registry=registry), self.assertRaises(ValueError):
                encode_character(self.game('Staff'), {}, equipment_ids=registry)


class SelectionSoundTests(unittest.TestCase):
    def sound(self, identity='TS01', wave='TW01', name='Fixture'):
        return ET.fromstring(f'<Description type="Sound" subType="Standard" ID="{identity}" Name="{name}">'
            f'<Engine version="1"><Category value="0"/><Phase ID="Select"><Wave value="{wave}"/>'
            '<DistanceModifier value="10000.0"/></Phase></Engine></Description>')

    def test_selection_adaptation_changes_only_identity_name_and_wave(self):
        ancestor, target = self.sound(), self.sound('TS02', 'TW02', 'Different name length')
        original = selection_sound(ancestor)
        changed = clone_selection_sound(target, ancestor, original, {b'TW02'})
        first, second = sound_parts(original)[1], sound_parts(changed)[1]
        self.assertEqual(first[:36] + first[40:], second[:36] + second[40:])
        self.assertEqual(second[36:40], b'TW02')
        packed = encode_description_cam({'TS02': changed}, b'DSND')
        self.assertEqual(cam_payloads(packed), {(b'DSND', b'TS02'): changed})

    def test_missing_audio_refuses_conversion(self):
        element = self.sound()
        with self.assertRaisesRegex(ValueError, 'unavailable original audio'):
            clone_selection_sound(element, element, selection_sound(element), set())

    def test_changed_ancestor_bytes_cannot_be_used(self):
        element = self.sound()
        changed = bytearray(selection_sound(element))
        changed[-1] ^= 1
        with self.assertRaisesRegex(ValueError, 'does not reproduce native bytes'):
            clone_selection_sound(element, element, bytes(changed), {b'TW01'})

    def test_frequency_policy_is_not_dropped(self):
        element = self.sound()
        ET.SubElement(element.find('Engine/Phase'), 'FrequencyVariation', {'up': '500', 'down': '500'})
        with self.assertRaisesRegex(ValueError, 'phase field'):
            selection_sound(element)

    def test_distance_policy_cannot_change_during_adaptation(self):
        ancestor, target = self.sound(), self.sound('TS02', 'TW02')
        target.find('Engine/Phase/DistanceModifier').set('value', '9999.0')
        with self.assertRaisesRegex(ValueError, 'beyond identity/WAVE'):
            clone_selection_sound(target, ancestor, selection_sound(ancestor), {b'TW02'})


class NumericInventoryTests(unittest.TestCase):
    def setUp(self):
        self.element = ET.fromstring('<Description type="Unit" subType="Character" ID="LongItemFixture" '
            'Name="LongItemFixture" Description="Original display"><Game version="1">'
            '<DialogID value="APb1"/><MaxHP value="10"/><Flags value="NotFlaggable"/>'
            '<Flags value="NotSpellTarget"/><Flags value="IsInventoryItem"/>'
            '<Attributes><Attribute ID="CanDropItem" Value="0"/>'
            '<Attribute ID="LongItemAttributeFixture" Value="0"/></Attributes></Game></Description>')
        self.mock_source = b'unit-test executable fixture; no game behavior is mocked'
        self.source_patch = patch.object(inventory, 'MODERN_SHA', hashlib.sha256(self.mock_source).hexdigest())
        self.source_patch.start()
        self.addCleanup(self.source_patch.stop)

    def plan(self, index=80):
        return inventory.plan_legacy_item(self.element, self.mock_source, index, 'LongItemAttributeFixture')

    def test_numeric_wire_preserves_metadata_without_wrong_attribute_map(self):
        plan = self.plan()
        self.assertEqual(plan['canonicalUnit'], 'LongItemFixture')
        self.assertEqual(plan['unit'], 'INVP')
        self.assertEqual(plan['storedInventoryId'], int.from_bytes(b'INVP', 'little'))
        self.assertEqual(plan['attributes'][1]['name'], 'LongItemAttributeFixture')
        raw = inventory.encode_legacy_item_game(self.element, {}, {}, plan)
        self.assertEqual(struct.unpack_from('<I', raw, 16 + 96)[0], 0x412)
        self.assertEqual(struct.unpack_from('<II', raw, 16 + 108), (1, 0))
        self.assertFalse(plan['nativeRuntimeQualified'])

    def test_every_phantom_slot_retains_exact_native_index(self):
        for index in range(80, 113):
            plan = self.plan(index)
            self.assertEqual(plan['storedInventoryId'], 0x00564e49 | (index << 24))
        self.assertNotIn(113, range(80, 113))

    def test_tampered_inventory_metadata_is_rejected(self):
        for field in ('unit', 'canonicalUnit', 'storedInventoryId', 'sourceGameSha256', 'nativeRuntimeQualified'):
            plan = self.plan()
            plan[field] = True if field == 'nativeRuntimeQualified' else 'changed'
            with self.subTest(field=field), self.assertRaises(ValueError):
                inventory.encode_legacy_item_game(self.element, {}, {}, plan)

    def test_unknown_named_attribute_is_not_truncated_or_dropped(self):
        ET.SubElement(self.element.find('Game/Attributes'), 'Attribute', {'ID': 'Unexpected', 'Value': '1'})
        with self.assertRaisesRegex(ValueError, 'Unreviewed inventory attribute'):
            self.plan()

    def test_another_executable_cannot_supply_flag_semantics(self):
        with self.assertRaisesRegex(ValueError, 'audited modern source'):
            inventory.plan_legacy_item(self.element, b'other binary', 80, 'LongItemAttributeFixture')


if __name__ == '__main__':
    unittest.main()

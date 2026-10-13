import importlib.util
import hashlib
from pathlib import Path
import struct
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    'lost_trail_native', ROOT / 'scripts/prepare-lost-trail-native.py')
MISSION = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MISSION)
from lib import lost_trail_menu as QUEST_MENU
from lib.wayfinder_interface import string_entries


class NativeMissionTests(unittest.TestCase):
    def template(self, version=b'RGM6', name=b'FERTILE_PLAIN'):
        return (version + b'\0' * 4) * 2 + name + b'\0' + bytes(range(128))

    def config(self):
        return (b'<XmlDataRoot><DataGroups><LoadData>' + b''.join(
            ('<' + n + '><LoadGPL>MX_Task.bcd</LoadGPL>'
             '<LoadGPL>Wayfinder.bcd</LoadGPL></' + n + '>').encode()
            for n in MISSION.LOAD_GROUPS) +
            b'<Rel1><LoadGPL>untouched.bcd</LoadGPL></Rel1>'
            b'</LoadData><UnloadData><Relp><LoadGPL>MDL1.bcd</LoadGPL></Relp>'
            b'</UnloadData></DataGroups></XmlDataRoot>')

    def test_initializer_change_preserves_complete_template_payload(self):
        for version in (b'RGM6', b'RGMa'):
            raw = self.template(version)
            changed = MISSION.rename_initializer(raw, 'FERTILE_PLAIN', 'TheLostTrail')
            self.assertEqual(MISSION.initializer(changed)[0], 'TheLostTrail')
            self.assertEqual(changed[:16], raw[:16])
            self.assertEqual(changed[29:], raw[30:])

    def test_rejects_wrong_version_identity_and_unterminated_name(self):
        for bad in (self.template(b'RGM9'), self.template().replace(b'RGM6', b'BAD!', 1),
                    self.template(name=b'x' * 80)):
            with self.assertRaises(ValueError):
                MISSION.rename_initializer(bad, 'FERTILE_PLAIN', 'TheLostTrail')
        with self.assertRaises(ValueError):
            MISSION.rename_initializer(self.template(), 'OTHER_QUEST', 'TheLostTrail')
        with self.assertRaises(ValueError):
            MISSION.rename_initializer(self.template(), 'FERTILE_PLAIN', 'invalid name')

    def test_reload_keeps_existing_order_and_unrelated_groups(self):
        old, new = ET.fromstring(self.config()), ET.fromstring(
            MISSION.bind_scripts(self.config()))
        for n in MISSION.LOAD_GROUPS:
            before = old.find('.//LoadData/' + n)
            after = new.find('.//LoadData/' + n)
            self.assertEqual([x.text for x in after],
                             [x.text for x in before] + ['TheLostTrail.bcd'] +
                             ([QUEST_MENU.MENU_FILENAME] if n == 'MajXCommonData' else []))
        for path in ('.//LoadData/Rel1', './/UnloadData'):
            self.assertEqual(ET.tostring(old.find(path)), ET.tostring(new.find(path)))
        with self.assertRaises(ValueError):
            MISSION.bind_scripts(ET.tostring(new))
        with self.assertRaises(ValueError):
            MISSION.bind_scripts(self.config().replace(b'Wayfinder.bcd', b'wrong.bcd'))

    def test_catalog_uses_native_identity_and_refuses_delimiter_injection(self):
        text = MISSION.quest_catalog('TheLostTrail', 'Build two Lodges.', 'Keep the Palace.').decode()
        self.assertIn('Name =\r\n[TheLostTrail]', text)
        self.assertIn('Short Description =\r\n[Build two Lodges.]', text)
        with self.assertRaises(ValueError):
            MISSION.quest_catalog('TheLostTrail', 'bad] text', 'description')

    def test_reserved_quest_rule_preserves_existing_requirements(self):
        original = b'# Original quests\r\nQU11 : HARD QU04 QU03 &&\r\nXQD1 : HARD NONE\r\n\r\n'
        added = MISSION.quest_dependencies(original)
        self.assertTrue(added.startswith(original))
        self.assertIn(b'XQD2 : MEDM NONE\r\n', added)
        with self.assertRaises(ValueError):
            MISSION.quest_dependencies(added)

    def test_title_changes_only_reserved_slot_and_preserves_all_other_strings(self):
        values = [b'Original entry ' + str(i).encode() for i in range(85)]
        values[2] = b'Bonus Quest 2'
        values[84] = b'Bonus Downloadable Quest 2 Trigger'
        offsets, data = [], bytearray()
        for i, value in enumerate(values):
            offsets.append(4 + len(values) * 4 + len(data))
            data.extend(struct.pack('<I', i) + value + b'\0')
        source = struct.pack('<I', 0x02000000 + len(values)) + struct.pack('<85I', *offsets) + data
        updated = string_entries(QUEST_MENU.reserved_title(source))[1]
        self.assertEqual(updated[2], b'The Lost Trail')
        self.assertEqual(updated[:2] + updated[3:], values[:2] + values[3:])
        with self.assertRaises(ValueError):
            QUEST_MENU.reserved_title(QUEST_MENU.reserved_title(source))

    def test_art_clone_preserves_numeric_tile_directory_and_every_payload_byte(self):
        directory_bytes = 16 + 9 * 28
        start = 36 + directory_bytes
        source = bytearray(b'CYLBPC  \x01\0\x01\0' + struct.pack('<II', 2, directory_bytes))
        source.extend(struct.pack('<4sI4sI', b'IMAG', 36, b'TILE', 36 + 8 + 4 * 28))
        payload = bytearray()
        changed = set()
        for kind, ids, mode in ((b'IMAG', list(QUEST_MENU.IMAGE_IDS), 0),
                                (b'TILE', [struct.pack('<I', i) for i in range(5)], 1)):
            source.extend(struct.pack('<II', len(ids), mode))
            for key in ids:
                if kind == b'IMAG':
                    changed.update(range(len(source), len(source) + 4))
                source.extend(struct.pack('<20sII', key, start + len(payload), 4))
                payload.extend(b'opaque'[:4])
        source.extend(payload)
        raw = bytes(source)
        with patch.object(QUEST_MENU, 'ART_SHA256', hashlib.sha256(raw).hexdigest()):
            updated = QUEST_MENU.reserved_art(raw)
            self.assertEqual(len(updated), len(raw))
            self.assertTrue(all(a == b for i, (a, b) in enumerate(zip(raw, updated))
                                if i not in changed))
            self.assertEqual(updated[start:], raw[start:])
            with self.assertRaises(ValueError):
                QUEST_MENU.reserved_art(raw[:-1] + b'!')

    def test_quest_heading_preserves_other_campaign_identities_and_names(self):
        entries = [b'XQD1Balance of Twilight\0', b'XQD2Bonus Quest 2\0',
                   b'XQD3Bonus Quest 3\0']
        offsets, payload = [], bytearray()
        for entry in entries:
            offsets.append(16 + len(payload))
            payload.extend(entry)
        raw = struct.pack('<I3I', 0x02000003, *offsets) + payload
        updated = QUEST_MENU.quest_title(raw)
        new_offsets = struct.unpack_from('<3I', updated, 4)
        actual = [updated[a:b] for a, b in zip(new_offsets, new_offsets[1:] + (len(updated),))]
        self.assertEqual(actual, [entries[0], b'XQD2The Lost Trail\0', entries[2]])
        for bad in (updated, raw[:-1], raw.replace(b'XQD2', b'XQD1'), raw[:7]):
            with self.assertRaises(ValueError):
                QUEST_MENU.quest_title(bad)


if __name__ == '__main__':
    unittest.main()

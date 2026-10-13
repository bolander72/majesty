import importlib.util
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    'lost_trail_native', ROOT / 'scripts/prepare-lost-trail-native.py')
MISSION = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MISSION)


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
                             [x.text for x in before] + ['TheLostTrail.bcd'])
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


if __name__ == '__main__':
    unittest.main()

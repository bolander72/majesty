import importlib.util
from pathlib import Path
import sys
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'third_party/majesty-mod-manager/src'))
from lib.native_sprite_art import encode_cam
from majesty_cam.cam import read_cam

spec = importlib.util.spec_from_file_location('community_native_candidate',
    ROOT / 'scripts/prepare-community-native-candidate.py')
candidate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(candidate)


class NativeCandidateTests(unittest.TestCase):
    def test_collection_paths_cannot_escape_the_owned_game(self):
        for name in ['', '.', '../saved.gmp', '/tmp/saved.gmp', 'Data/../../saved.gmp', 'Data\\..\\saved.gmp']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                candidate.relative(name)
        self.assertEqual(candidate.relative('Data/Community-main.cam'), Path('Data/Community-main.cam'))
    def test_merge_keeps_quest_resources_and_stock_name_fragments(self):
        stock = read_cam(encode_cam([(b'STRT', [(b'HN41', b'stock names')]),
                                    (b'DATA', [(b'QUST', b'existing demo')])]))
        overlay = read_cam(encode_cam([(b'STRT', [(b'HNP0', b'authored phantom names')]),
                                      (b'SMNU', [(b'CGBD', b'authored UI')])]))
        merged = candidate.merge_archive(stock, overlay)
        payloads = {(s.extension, e.name[:4]): e.data for s in merged.sections for e in s.entries}
        self.assertEqual(payloads[b'STRT', b'HN41'], b'stock names')
        self.assertEqual(payloads[b'DATA', b'QUST'], b'existing demo')
        self.assertEqual(payloads[b'SMNU', b'CGBD'], b'authored UI')
        self.assertEqual(payloads[b'STRT', b'HNP0'], b'authored phantom names')

    def test_positional_art_is_never_merged_as_named_resources(self):
        stock = read_cam(encode_cam([(b'STRT', [(b'HN41', b'stock names')])]))
        overlay = read_cam(encode_cam([(b'TILE', [(b'0001', b'positional art')])]))
        with self.assertRaisesRegex(ValueError, 'text and widget'):
            candidate.merge_archive(stock, overlay)

    def groups(self):
        return b'<Majesty><DataGroups><LoadData>' + b''.join(
            b'<' + name + b'><LoadGPL>Stock.bcd</LoadGPL><LoadCAM>alchemist_audio.cam</LoadCAM>'
            b'<LoadGPL>Alchemist_Composed.bcd</LoadGPL><LoadGPL>VampiricRevengeBridge.bcd</LoadGPL>'
            b'<LoadCAM>VampiricRevenge-menu.cam</LoadCAM></' + name + b'>'
            for name in [b'MajestyCommonData', b'MajXCommonData', b'Rel1', b'Rel2', b'Rel3']) + \
            b'</LoadData></DataGroups></Majesty>'

    def test_new_authored_library_precedes_preserved_mja_continuations(self):
        raw, proof = candidate.activate_groups(self.groups())
        root = ET.fromstring(raw)
        group = root.find('./DataGroups/LoadData/MajestyCommonData')
        self.assertEqual([c.text for c in group if c.tag == 'LoadGPL'],
            ['Stock.bcd', 'Community_Common.bcd', 'Community_Base.bcd',
             'Alchemist_Composed.bcd', 'VampiricRevengeBridge.bcd'])
        self.assertIn('VampiricRevenge-menu.cam', [c.text for c in group])
        self.assertNotIn('alchemist_audio.cam', [c.text for c in group])
        self.assertEqual(proof['MajXCommonData']['edition'], 'Expansion')

    def test_base_and_northern_classifications_get_their_own_compiled_code(self):
        raw, _ = candidate.activate_groups(self.groups())
        root = ET.fromstring(raw)
        for name, edition in [('MajestyCommonData','Base'), ('Rel2','Base'),
                              ('MajXCommonData','Expansion'), ('Rel3','Expansion')]:
            names = [c.text for c in root.find('./DataGroups/LoadData/' + name)]
            self.assertIn('Community_' + edition + '.bcd', names)
            other = 'Base' if edition == 'Expansion' else 'Expansion'
            self.assertNotIn('Community_' + other + '.bcd', names)

    def test_unrelated_classification_remains_unchanged(self):
        before = ET.fromstring(self.groups()).find('./DataGroups/LoadData/Rel1')
        raw, proof = candidate.activate_groups(self.groups())
        after = ET.fromstring(raw).find('./DataGroups/LoadData/Rel1')
        self.assertEqual(ET.tostring(after), ET.tostring(before))
        self.assertNotIn('Rel1', proof)

    def test_entity_declarations_refused(self):
        with self.assertRaisesRegex(ValueError, 'entities'):
            candidate.activate_groups(b'<!DOCTYPE Majesty><Majesty/>')


if __name__ == '__main__':
    unittest.main()

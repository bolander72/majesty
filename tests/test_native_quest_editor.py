import importlib.util
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    'quest_editor', ROOT / 'scripts/prepare-native-quest-editor.py')
EDITOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(EDITOR)


class EditorDatasetTests(unittest.TestCase):
    def setUp(self):
        self.definition = b'''<Majesty><Dataset base="Majesty"><Load>
          <CAM>mx_maindata.cam</CAM><CAM>mx_unittype.cam</CAM>
          <CAM>mx_tilesetdata.cam</CAM><CAM>mx_sounddesc.cam</CAM>
          <CAM>mx_voices.cam</CAM><CAM>mx_cinedata1.cam</CAM>
          <GPL>MX_Data.bcd</GPL><GPLSource>OriginalQuests/GplMx</GPLSource>
          <Constants>mx_constants.rgs</Constants><Strings>InterfaceStrings.xml</Strings>
        </Load><Unload><CAM>mx_voices.cam</CAM><GPL/></Unload></Dataset></Majesty>'''

    def test_default_loader_preserves_original_bytes(self):
        data, omitted = EDITOR.editor_dataset(self.definition)
        self.assertEqual(data, self.definition)
        self.assertEqual(omitted, [])

    def test_lean_loader_preserves_map_and_script_dependencies(self):
        data, omitted = EDITOR.editor_dataset(self.definition, True)
        original, lean = ET.fromstring(self.definition), ET.fromstring(data)
        self.assertEqual([n.text for n in lean.findall('.//Load/CAM')],
                         ['mx_maindata.cam', 'mx_unittype.cam',
                          'mx_tilesetdata.cam', 'mx_sounddesc.cam'])
        for tag in ['GPL', 'GPLSource', 'Constants', 'Strings']:
            self.assertEqual(ET.tostring(lean.find('.//Load/' + tag)),
                             ET.tostring(original.find('.//Load/' + tag)))
        self.assertEqual(ET.tostring(lean.find('.//Unload')),
                         ET.tostring(original.find('.//Unload')))
        self.assertEqual(omitted, ['mx_voices.cam', 'mx_cinedata1.cam'])


if __name__ == '__main__':
    unittest.main()

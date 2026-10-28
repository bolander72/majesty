import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'scripts'), str(ROOT / 'third_party/majesty-mod-manager/src')]
from lib.community_follower_markers import validate
from majesty_cam.descriptions import parse_descriptions

NAME = 'MCF2419816A7F251'
XML = f'''<Majesty><Description type="Unit" subType="Overlay" ID="MF00" Name="{NAME}">
<Engine version="1"><Info value="Directionless"/><Info value="DontBlock"/>
<Info value="NotVisibleInISOView"/><Menu value="11"/><ImageIDBase value="CRB2"/>
<DefaultSound value="0"/></Engine><Game version="1"><DialogID value="0"/>
<StackPriority value="0"/></Game></Description></Majesty>'''.encode()


class FollowerMarkers(unittest.TestCase):
    def test_missing_native_definition_rejected_before_launch(self):
        with self.assertRaisesRegex(ValueError, 'missing='):
            validate(parse_descriptions(b'<Majesty/>'), [f'CheckEffector(agent,"{NAME}")'])

    def test_persistent_hidden_stock_shape_accepted(self):
        self.assertEqual(validate(parse_descriptions(XML), [f'CreateEffector(agent,"{NAME}")']), [NAME])

    def test_callback_or_visible_state_rejected(self):
        for raw in (XML.replace(b'<Menu', b'<Script value="Tick"/><Menu'),
                    XML.replace(b'NotVisibleInISOView', b'Visible')):
            with self.assertRaisesRegex(ValueError, 'persistent overlay'):
                validate(parse_descriptions(raw), [NAME])

    def test_unreferenced_marker_rejected(self):
        with self.assertRaisesRegex(ValueError, 'orphaned='):
            validate(parse_descriptions(XML), [])


if __name__ == '__main__':
    unittest.main()

from pathlib import Path
import struct,sys,unittest
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'scripts'),str(ROOT/'third_party/majesty-mod-manager/src')]
from majesty_cam.cam import CamArchive,CamSection,CamEntry
from lib.dark_paladin_panel_safety import single_choice_panel

def record(name,words):return CamEntry(name.ljust(20,b'\0'),struct.pack('<'+str(len(words))+'i',*words))
class SingleChoicePanel(unittest.TestCase):
    def test_unsupported_spell_command_is_removed_while_other_native_controls_are_preserved(self):
        w=[17]*893;w[756:762]=[0,2,7,162,93,26];w[775:777]=[13,1004];w[805:811]=[0,2,103,162,93,26];w[824:826]=[13,1009];w[853]=-1
        stock=record(b'AP05',w);panel=record(b'CGDP',w);other=CamEntry(b'UNTN'.ljust(20,b'\0'),b'unchanged names')
        before=CamArchive((CamSection(b'SMNU',(stock,panel)),CamSection(b'STRT',(other,))))
        after=single_choice_panel(before);expected=w[:];expected[758]=53;expected=expected[:805]+expected[854:]
        self.assertEqual(after.sections[0].entries[0],stock)
        self.assertEqual(after.sections[1],before.sections[1])
        self.assertEqual(after.sections[0].entries[1],record(b'CGDP',expected))
        self.assertEqual(before.sections[0].entries[1],panel)
    def test_missing_private_panel_is_rejected(self):
        with self.assertRaisesRegex(ValueError,'private CGDP panel'):single_choice_panel(CamArchive(()))
if __name__=='__main__':unittest.main()

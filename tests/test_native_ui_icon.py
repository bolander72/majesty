import struct
import unittest
from PIL import Image
from lib.native_ui_icon import framed_building_icon

class NativeUIIcon(unittest.TestCase):
    def test_native_border_is_preserved_and_old_emblem_is_replaced(self):
        header=bytearray(26);struct.pack_into('<4H',header,0,1,25,25,25)
        palette=bytearray(1032);palette[12:16]=bytes([235,180,40,0]);palette[16:20]=bytes([255,0,255,0])
        indices=bytes(1 if x<2 or y<2 or x>=23 or y>=23 else 2 for y in range(25)for x in range(25))
        emblem=Image.new('RGBA',(50,40),(20,100,70,255))
        icon=framed_building_icon(emblem,bytes(header)+indices,bytes(palette))
        self.assertEqual(icon.size,(25,25))
        for y in range(25):
            for x in range(25):
                self.assertEqual(icon.getpixel((x,y))[3],255)
                if x<2 or y<2 or x>=23 or y>=23:self.assertEqual(icon.getpixel((x,y)),(235,180,40,255))
                else:self.assertNotEqual(icon.getpixel((x,y)),(255,0,255,255))
        self.assertEqual(icon.getpixel((2,2)),(9,18,13,255))

    def test_invalid_native_frame_is_rejected(self):
        with self.assertRaisesRegex(ValueError,'Unsupported'):
            framed_building_icon(Image.new('RGBA',(10,10)),b'bad',b'bad')

if __name__=='__main__':unittest.main()

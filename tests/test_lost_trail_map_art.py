import hashlib
import importlib.util
from pathlib import Path
import struct
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('map_art', ROOT/'scripts/prepare-lost-trail-map-art.py')
art = importlib.util.module_from_spec(spec)
spec.loader.exec_module(art)

class LostTrailMapArt(unittest.TestCase):
    def test_reserved_image_controls_and_other_tiles_survive_encoding(self):
        # Synthetic directory follows the five positional native tile contracts;
        # the packer must preserve every control and only replace map states.
        from lib.native_sprite_art import encode_cam
        from PIL import Image
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);src=p/'source.cam';png=p/'art.png'
            header=bytearray(26);struct.pack_into('<H',header,0,3)
            records=[(b'DX32',b'control'),(b'IXD2',b'marker'),(b'IXR2',b'round'),(b'IXS2',b'briefing')]
            tiles=[(struct.pack('<I',n),bytes(header)+bytes([n]))for n in range(5)]
            src.write_bytes(encode_cam([(b'IMAG',records),(b'TILE',tiles)]))
            Image.new('RGBA',(20,20),(50,100,30,255)).save(png)
            original=(art.BASE_SHA,art.ART_SHA,art.campaign_map)
            try:
                art.BASE_SHA=hashlib.sha256(src.read_bytes()).hexdigest();art.ART_SHA=hashlib.sha256(png.read_bytes()).hexdigest()
                art.campaign_map=lambda _: Image.new('RGBA',(1398,1611),(70,80,60,255))
                art.prepare(src,png,p/'result',p/'map')
            finally:art.BASE_SHA,art.ART_SHA,art.campaign_map=original
            result=list(art.CAM.read_records((p/'result/LostTrail-menu-art.cam').read_bytes()))
            self.assertEqual([(k,b)for kind,k,b in result if kind==b'IMAG'],records)
            packed=[b for kind,k,b in result if kind==b'TILE']
            self.assertEqual(packed[2:],[b for k,b in tiles[2:]])
            self.assertNotEqual(packed[0],packed[1])
            self.assertEqual(struct.unpack_from('<3H',packed[0]),(3,160,160))
            # Every top/bottom row must contain no pixels: the scene cannot
            # paint a rectangular ocean/shore patch across map boundaries.
            for y in [0,1,74,155,159]:
                off=26+struct.unpack_from('<I',packed[1],26+y*4)[0]
                self.assertEqual(struct.unpack_from('<HH',packed[1],off),(0,32768))

    def test_hover_keeps_transparent_edges_and_the_landmark_pixels(self):
        from PIL import Image
        normal=Image.new('RGBA',(160,160))
        normal.putpixel((80,110),(25,90,45,255))
        background=Image.new('RGBA',(1398,1611),(70,80,60,255))
        before=normal.tobytes()
        hover=art.hover_landmark(normal,background)
        self.assertEqual(normal.tobytes(),before)
        self.assertEqual(hover.getpixel((80,110)),normal.getpixel((80,110)))
        for n in range(160):
            for xy in [(n,0),(n,159),(0,n),(159,n)]:
                self.assertEqual(hover.getpixel(xy)[3],0)
        self.assertGreater(hover.getpixel((89,118))[0],70)
        self.assertEqual(hover.getpixel((89,118))[3],255)

    def test_changed_artwork_is_refused(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);(p/'source').write_bytes(b'bad');(p/'art').write_bytes(b'bad')
            with self.assertRaisesRegex(ValueError,'baseline differs'):
                art.prepare(p/'source',p/'art',p/'result',p/'map')
            self.assertFalse((p/'result').exists())

if __name__=='__main__':unittest.main()

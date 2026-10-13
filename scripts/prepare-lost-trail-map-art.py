#!/usr/bin/env python3
"""Pack original transparent map art, preserving native quest controls and IDs."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
from PIL import Image, ImageOps
from lib.native_sprite_art import encode_cam, encode_tile

SPEC = importlib.util.spec_from_file_location('sprite_art', Path(__file__).with_name('prepare-wayfinder-v2-art.py'))
CAM = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CAM)
BASE_SHA = 'd507fdb71c25ac323584f6d832ec0252be7aedf534ffe30b22b2fed985eac0c9'
MAP_SHA = '0add127748f24762cd3bc3eefe979c20d86556802cfeb8d3cf1b2a1f2874290e'
ART_SHA = '11612f4e1bea6b063e384fa9641b5f638170acfca86f6d842a67e5ee3e85dddb'


def campaign_map(archive):
    raw = archive.read_bytes()
    if hashlib.sha256(raw).hexdigest() != MAP_SHA:
        raise ValueError('Original campaign map differs')
    body = next(body for kind,key,body in CAM.read_records(raw)
                if (kind,key)==(b'TILE',struct.pack('<I',65)))
    version,height,width = struct.unpack_from('<3H',body)
    if (version,width,height)!=(1,1398,1611):
        raise ValueError('Unsupported native campaign map raster')
    offset = struct.unpack_from('<I',body,22)[0]
    palette = body[offset+8:offset+1032]
    image = Image.frombytes('P',(width,height),body[26:26+width*height])
    image.putpalette(bytes(c for i in range(256) for c in palette[i*4:i*4+3]))
    return image.convert('RGBA')


def hover_landmark(normal, background):
    # A native UI lighting state. Sample the original map under the glow so
    # its coast/grid/texture survive the game's binary-alpha tile encoding.
    # Tile 0 is mouse-over; original DX32 direction 0 uses normal tile 1.
    hover = Image.new('RGBA',normal.size)
    for y in range(1,159):
        for x in range(1,159):
            distance = ((x-89)/61)**2 + ((y-118)/38)**2
            if distance >= 1: continue
            amount = .70 * (1-distance)**1.2
            if amount < .008: continue
            base = background.getpixel((1171+x,335+y))
            rgb = tuple(round(a+(b-a)*amount) for a,b in zip(base[:3],(255,216,85)))
            hover.putpixel((x,y),(*rgb,255))
    hover.alpha_composite(normal)
    return hover


def prepare(original, artwork, output, map_archive):
    if output.exists():
        raise ValueError('Preserve earlier candidates')
    raw, art = original.read_bytes(), artwork.read_bytes()
    if hashlib.sha256(raw).hexdigest() != BASE_SHA or hashlib.sha256(art).hexdigest() != ART_SHA:
        raise ValueError('Map artwork or native baseline differs')
    records = list(CAM.read_records(raw))
    imag = [(key, body) for kind, key, body in records if kind == b'IMAG']
    tiles = [(key, body) for kind, key, body in records if kind == b'TILE']
    if len(imag) != 4 or [int.from_bytes(k, 'little') for k, _ in tiles] != list(range(5)):
        raise ValueError('Reserved quest image directory differs')
    image = Image.open(artwork).convert('RGBA')
    bounds = image.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
    if bounds is None:
        raise ValueError('Empty artwork')
    # Native trigger origin is 1171,335. This packs the lodge onto the existing
    # pine-covered Krolm peninsula at 1221..1321,410..490, not over open water.
    # Transparent margins expose the exact original terrain/coast/map grid.
    landmark = ImageOps.contain(image.crop(bounds), (100, 80), Image.Resampling.LANCZOS)
    tile = Image.new('RGBA', (160, 160))
    tile.alpha_composite(landmark, (50, 75))
    hover = hover_landmark(tile, campaign_map(map_archive))
    normal_bytes = encode_tile(tile, tiles[2][1][:26], (0, 0))
    hover_bytes = encode_tile(hover, tiles[2][1][:26], (0, 0))
    replacements = [(key, hover_bytes if n == 0 else normal_bytes if n == 1 else body)
                    for n, (key, body) in enumerate(tiles)]
    result = encode_cam([(b'IMAG', imag), (b'TILE', replacements)])
    output.mkdir(parents=True)
    (output / 'LostTrail-menu-art.cam').write_bytes(result)
    tile.save(output / 'native-map-landmark.png')
    hover.save(output / 'native-map-landmark-hover.png')
    proof = dict(format='majesty-original-map-art-v1', bytes=len(result), sha256=hashlib.sha256(result).hexdigest(),
        sourceSha256=ART_SHA, baselineSha256=BASE_SHA, canvas=[160,160], anchor=[0,0],
        packedArtBox=[50,75,landmark.width,landmark.height], nativeTriggerOrigin=[1171,335],
        transparentCanvas=True, originalImageControlsUnchanged=True,
        nativeHoverTile=0, nativeNormalTile=1, originalMapSha256=MAP_SHA,
        preservedTiles=[2,3,4], changedTiles=[0,1], terrainUnchanged=True)
    (output / 'artwork-candidate.json').write_text(json.dumps(proof, indent=2)+'\n')
    return proof


if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('original', type=Path);p.add_argument('artwork', type=Path);p.add_argument('output', type=Path);p.add_argument('map_archive', type=Path)
    args=p.parse_args(); print(json.dumps(prepare(args.original,args.artwork,args.output,args.map_archive),indent=2))

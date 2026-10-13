#!/usr/bin/env python3
"""Encode reviewed original sprite atlases into a separate private native CAM."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
from PIL import Image, ImageOps
from lib.native_sprite_art import encode_tile, replace_animation_tiles, encode_cam


def read_records(raw):
    if raw[:12] != b'CYLBPC  \x01\0\x01\0':
        raise ValueError('Unsupported original CAM')
    count, directory_bytes = struct.unpack_from('<II', raw, 12)
    end_directory = 20 + count * 8 + directory_bytes
    if not 0 < count <= 128 or end_directory > len(raw):
        raise ValueError('Invalid original CAM directory')
    for n in range(count):
        kind, off = struct.unpack_from('<4sI', raw, 20 + n * 8)
        entries, flags = struct.unpack_from('<II', raw, off)
        if flags not in [0, 1] or off + 8 + entries * 28 > end_directory:
            raise ValueError('Unsupported CAM section indexing or bounds')
        for i in range(entries):
            name, pos, size = struct.unpack_from('<20sII', raw, off + 8 + i * 28)
            if pos < end_directory or pos + size > len(raw):
                raise ValueError('Original CAM record exceeds bounds')
            yield kind, name[:4], raw[pos:pos + size]


def prepare(original, source, output):
    if output.exists():
        raise ValueError('Preserve earlier artwork candidates')
    meta = json.loads((source / 'artwork.json').read_text())
    images = {}
    for name, record in meta['sheets'].items():
        data = (source / 'artwork' / name).read_bytes()
        if len(data) != record['bytes'] or hashlib.sha256(data).hexdigest() != record['sha256']:
            raise ValueError('Reviewed artwork source changed')
        image = Image.open(source / 'artwork' / name).convert('RGBA')
        cols, rows = record['layout']
        if image.width < cols or image.height < rows:
            raise ValueError('Sprite atlas is smaller than its cell layout')
        images[name] = image
    raw = original.read_bytes()
    templates, headers = {}, {}
    for kind, key, body in read_records(raw):
        if kind == b'IMAG' and key in [b'AVA1', b'ABW1']:
            templates[key] = body
        if kind == b'TILE' and key in [struct.pack('<I', 3611), struct.pack('<I', 1740)]:
            headers[struct.unpack('<I', key)[0]] = body[:26]
    if len(templates) != 2 or len(headers) != 2:
        raise ValueError('Required verified animation templates absent')
    tile_images = [Image.new('RGBA', (1, 1))]
    tile_headers = [(headers[3611], (0, 0))]
    hero_tiles = {}
    sheet = images['wayfinder-actions.png']
    cw, ch = sheet.width / 8, sheet.height / 8
    for row in range(8):
        for col in range(8):
            image = sheet.crop(tuple(round(v) for v in
                (col * cw, row * ch, (col + 1) * cw, (row + 1) * ch)))
            hero_tiles[row, col] = len(tile_images)
            tile_images.append(image.resize((64, 64), Image.Resampling.LANCZOS))
            tile_headers.append((headers[3611], (32, 55)))
    lodge_tiles = []
    sheet = images['trail-lodge-states.png']
    cw, ch = sheet.width // 2, sheet.height // 2
    for row in range(2):
        for col in range(2):
            image = sheet.crop((col * cw, row * ch, (col + 1) * cw, (row + 1) * ch))
            target = Image.new('RGBA', (250, 192))
            image = ImageOps.contain(image, target.size, Image.Resampling.LANCZOS)
            target.alpha_composite(image, ((250 - image.width) // 2, 192 - image.height))
            lodge_tiles.append(len(tile_images))
            tile_images.append(target)
            tile_headers.append((headers[1740], (132, 63)))
    # Portraits and building previews also use original art. No Adept/Ranger
    # tiles survive in either new IMAG resource, including extra cast streams.
    hero_portrait = len(tile_images)
    face_width = images['wayfinder-actions.png'].width / 8
    face = images['wayfinder-actions.png'].crop((round(2 * face_width), 0,
        round(3 * face_width), round(images['wayfinder-actions.png'].height / 8)))
    tile_images.append(face.resize((100, 100), Image.Resampling.LANCZOS))
    tile_headers.append((headers[3611], (50, 86)))
    lodge_portrait = len(tile_images)
    tile_images.append(tile_images[lodge_tiles[1]].resize((100, 77), Image.Resampling.LANCZOS))
    tile_headers.append((headers[1740], (50, 25)))
    minimap = len(tile_images)
    tile_images.append(Image.new('RGBA', (3, 3), (232, 176, 65, 255)))
    tile_headers.append((headers[3611], (2, 1)))

    def hero(sid, direction, frame, stream, total):
        if stream:
            return 0
        base = sid & 65535
        if base in [1000, 1001, 1002]:
            return hero_portrait
        if base == 300:
            return minimap
        row = {8: 0, 400: 0, 64: 5, 128: 5, 224: 7}.get(base, 0)
        if base == 1:
            row = 1 + ((frame // 2) % 2)
        elif base == 16:
            row = 3 if frame < total // 2 else 4
        elif base == 96:
            row = 0 if frame == 0 else (6 if frame < total - 1 else 7)
        return hero_tiles[row, direction]

    def lodge(sid, direction, frame, stream, total):
        if stream:
            return 0
        base = sid & 65535
        if sid != base:
            return 0  # Original debris/effect streams must not show Ranger art.
        if base in [1000, 1001, 1002]:
            return lodge_portrait
        if base in [80, 81, 82]:
            return lodge_tiles[0]
        if base in [96, 97, 98, 99, 100, 101, 224, 240]:
            return lodge_tiles[3]
        return lodge_tiles[2 if base == 192 else 1]

    hero_imag, hero_refs = replace_animation_tiles(templates[b'AVA1'], hero)
    lodge_imag, lodge_refs = replace_animation_tiles(templates[b'ABW1'], lodge)
    tiles = [(struct.pack('<I', i), encode_tile(image, header, anchor))
             for i, (image, (header, anchor)) in enumerate(zip(tile_images, tile_headers))]
    data = encode_cam([(b'IMAG', [(b'AVz1Wayfinder', hero_imag), (b'ABs1Trail_Lodge', lodge_imag)]),
                       (b'TILE', tiles)])
    output.mkdir(parents=True)
    (output / 'Wayfinder-art.cam').write_bytes(data)
    # Debug previews are private and show exactly the pixels sent to encoding.
    tile_images[hero_tiles[0, 2]].save(output / 'wayfinder-native-scale.png')
    tile_images[lodge_tiles[1]].save(output / 'trail-lodge-native-scale.png')
    report = dict(nativeIntegrationQualified=False, originalArtwork=True, borrowedDisplayedTiles=0,
        sourceMainCAMSha256=hashlib.sha256(raw).hexdigest(), artworkSource=meta,
        templateIMAGSha256={key.decode(): hashlib.sha256(value).hexdigest() for key, value in templates.items()},
        tileCount=len(tiles), reboundHeroReferences=hero_refs, reboundLodgeReferences=lodge_refs,
        artifact=dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest()))
    (output / 'artwork-candidate.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    for name in ['original', 'source', 'output']:
        p.add_argument('--' + name, type=Path, required=True)
    a = p.parse_args()
    result = prepare(a.original, a.source, a.output)
    print(json.dumps({k: result[k] for k in ['tileCount', 'reboundHeroReferences', 'reboundLodgeReferences']}))

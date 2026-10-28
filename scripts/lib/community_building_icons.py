"""Frame the creator's Palace emblems with the original native guild border."""
import hashlib
from pathlib import Path
import struct

from lib.native_ui_icon import framed_building_icon
from lib.vampiric_revenge import decode_tile

GUILD_IMAGES = {b'BDG1', b'BDG2', b'BDG3', b'PHG1', b'PHG2', b'PHG3'}
FRAME_TILE_SHA = '29844aca8c95ac4066e14c3acc7e00ef0102f075132d6b4d7ffda40e29807432'
FRAME_PALETTE_SHA = 'a1bf60ce906beb8a46589f8065bd149ee127364acbcf682548ddc204aee2be1e'


def native_frame(stock_main):
    """Read only the pinned Warriors Guild frame and palette, not the full CAM."""
    path = Path(stock_main)
    if getattr(path.stat(), 'st_flags', 0) & 0x40000000:
        raise ValueError('Require a resident native frame source')
    with path.open('rb') as stream:
        header = stream.read(20)
        if header[:12] != b'CYLBPC  \x01\0\x01\0':
            raise ValueError('Unsupported native frame archive')
        count = struct.unpack_from('<I', header, 12)[0]
        if not 1 <= count <= 128:
            raise ValueError('Unsupported native frame directory')
        sections = dict(struct.unpack('<4sI', stream.read(8)) for _ in range(count))
        def record(kind, index):
            stream.seek(sections[kind])
            size = struct.unpack('<I', stream.read(4))[0]
            if index >= size:
                raise ValueError('Native frame index out of range')
            stream.seek(sections[kind] + 8 + index * 28)
            _, offset, length = struct.unpack('<20sII', stream.read(28))
            if not 0 < length <= 4096:
                raise ValueError('Unsupported native frame record')
            stream.seek(offset)
            return stream.read(length)
        tile = record(b'TILE', 1734)
        palette = record(b'SPLT', struct.unpack_from('<I', tile, 22)[0])
    if (hashlib.sha256(tile).hexdigest() != FRAME_TILE_SHA or
            hashlib.sha256(palette).hexdigest() != FRAME_PALETTE_SHA):
        raise ValueError('Native Warriors Guild border source differs')
    return tile, palette


def frame_emblem(source, tile, palette):
    """Preserve all original inset pixels; change only the native two-pixel rim."""
    from PIL import Image
    if source.size != (25, 25):
        raise ValueError('Palace emblems require the native 25-by-25 contract')
    framed = framed_building_icon(source, tile, palette)
    inset = Image.new('RGBA', (21, 21), (9, 18, 13, 255))
    inset.alpha_composite(source.convert('RGBA').crop((2, 2, 23, 23)))
    framed.paste(inset, (2, 2))
    return framed


def pack_emblem(image, original_header):
    """Reserve exact native rim colors; quantize only the creator's inset.

    Engine control indices247..255 stay unused, as in the normal art packer.
    No source pixels move or resize during this palette conversion.
    """
    from PIL import Image
    if (image.size != (25, 25) or len(original_header) != 26 or
            image.convert('RGBA').getchannel('A').getextrema() != (255, 255)):
        raise ValueError('Native packed emblem must be opaque and 25-by-25')
    rgb = image.convert('RGB')
    border = sorted({rgb.getpixel((x, y)) for y in range(25) for x in range(25)
                     if x < 2 or y < 2 or x >= 23 or y >= 23})
    if not 0 < len(border) < 247:
        raise ValueError('Native emblem border exceeds palette budget')
    inset = rgb.crop((2, 2, 23, 23)).quantize(
        colors=247 - len(border), method=Image.Quantize.MEDIANCUT)
    palette_values = inset.getpalette()
    palette_values += [0] * max(0, (247 - len(border)) * 3 - len(palette_values))
    colors = border + [tuple(palette_values[i:i + 3])
                       for i in range(0, (247 - len(border)) * 3, 3)]
    colors += [(0, 0, 0)] * (256 - len(colors))
    indices = bytearray()
    for y in range(25):
        for x in range(25):
            if x < 2 or y < 2 or x >= 23 or y >= 23:
                indices.append(border.index(rgb.getpixel((x, y))))
            else:
                indices.append(len(border) + inset.getpixel((x - 2, y - 2)))
    header = bytearray(original_header)
    struct.pack_into('<4H', header, 0, 1, 25, 25, 25)
    struct.pack_into('<HI', header, 20, 1, 651)
    palette = struct.pack('<II', 16777216, 0) + b''.join(bytes(c) + b'\0' for c in colors)
    return bytes(header) + indices + palette


def frame_guild_icons(raw, stock_main, images=None):
    from majesty_cam.cam import read_cam, CamArchive, CamSection, CamEntry
    from majesty_cam.art import parse_best_imag_tile_references
    wanted = GUILD_IMAGES if images is None else set(images)
    if not wanted or any(not isinstance(key, bytes) or len(key) != 4 for key in wanted):
        raise ValueError('Require explicit four-character Palace emblem images')
    cam = read_cam(raw)
    sections = {s.extension: s for s in cam.sections}
    tiles = list(sections[b'TILE'].entries)
    palettes = sections[b'SPLT'].entries
    frame, frame_palette = native_frame(stock_main)
    targets, found = {}, set()
    for image in sections[b'IMAG'].entries:
        key = image.name[:4]
        if key not in wanted:
            continue
        parsed = parse_best_imag_tile_references(image.data, tile_count=len(tiles), entry_name=image.name)
        refs = [r for r in parsed.references if r.set_id == 1002]
        if len(refs) != 1 or not refs[0].tile_index:
            raise ValueError('Unsupported Palace emblem frame binding: ' + key.decode())
        targets.setdefault(refs[0].tile_index, []).append(key.decode())
        found.add(key)
    if found != wanted:
        raise ValueError('Require all selected guild image bindings')
    proof = []
    for index, images in sorted(targets.items()):
        original = tiles[index].data
        if len(original) < 26 or struct.unpack_from('<3H', original) != (1, 25, 25):
            raise ValueError('Unsupported original guild emblem tile')
        mode, palette = struct.unpack_from('<HI', original, 20)
        body = original
        if mode == 0:
            header = bytearray(original[:26])
            struct.pack_into('<HI', header, 20, 1, len(original))
            body = bytes(header) + original[26:] + palettes[palette].data
        elif mode != 1:
            raise ValueError('Unsupported original guild emblem palette')
        source = decode_tile(body)
        framed = frame_emblem(source, frame, frame_palette)
        replacement = pack_emblem(framed, original[:26])
        decoded = decode_tile(replacement)
        if any(decoded.getpixel((x, y)) != framed.getpixel((x, y))
               for y in range(25) for x in range(25)
               if x < 2 or y < 2 or x >= 23 or y >= 23):
            raise ValueError('Native emblem palette would alter its original border')
        tiles[index] = CamEntry(tiles[index].name, replacement)
        proof.append(dict(images=images, tile=index, nativeSize=[25, 25],
                          originalSha256=hashlib.sha256(original).hexdigest(),
                          framedSha256=hashlib.sha256(replacement).hexdigest(),
                          creatorArtworkRetained=True, pixelScaling=False,
                          insetPaletteQuantized=True, nativeBorderPixelsExact=True, opaque=True))
    output = CamArchive(tuple(CamSection(s.extension, tuple(tiles), padding=s.padding)
                             if s.extension == b'TILE' else s for s in cam.sections))
    return output.to_bytes(), dict(frameTileSha256=FRAME_TILE_SHA,
                                  framePaletteSha256=FRAME_PALETTE_SHA, emblems=proof)

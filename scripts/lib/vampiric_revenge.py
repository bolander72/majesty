"""Legacy selector binding for Cyberlore's original Vampiric Revenge demo.

Only the template's initializer name changes. The bridge calls the original
VAMPIRIC_REVENGE function; terrain, forces, events and objectives are retained.
The third reserved slot avoids both shipped bonus quests and retired XQD2 saves.
"""
import struct

from lib.native_sprite_art import encode_cam, encode_tile


def records(raw):
    if raw[:12] != b'CYLBPC  \x01\0\x01\0' or len(raw) < 28:
        raise ValueError('Unsupported native CAM')
    count, size = struct.unpack_from('<II', raw, 12)
    end = 20 + count * 8 + size
    if not 0 < count <= 128 or end > len(raw):
        raise ValueError('Invalid native CAM directory')
    seen = set()
    for i in range(count):
        kind, index = struct.unpack_from('<4sI', raw, 20 + i * 8)
        entries, flags = struct.unpack_from('<II', raw, index)
        if flags not in (0, 1) or index + 8 + entries * 28 > end:
            raise ValueError('Unsupported native CAM section')
        for j in range(entries):
            label, at, length = struct.unpack_from('<20sII', raw, index + 8 + j * 28)
            key = kind, label[:4]
            if key in seen or at < end or not length or at + length > len(raw):
                raise ValueError('Duplicate or invalid native CAM record')
            seen.add(key)
            yield kind, label[:4], raw[at:at + length]


def replace_records(raw, changes):
    original = list(records(raw))
    if not set(changes) <= {(kind, key) for kind, key, _ in original}:
        raise ValueError('Replacement resource absent')
    sections = [(kind, [(key, changes.get((k, key), body))
                       for k, key, body in original if k == kind])
                for kind in dict.fromkeys(k for k, _, _ in original)]
    result = encode_cam(sections)
    if list(records(result)) != [(k, key, changes.get((k, key), body))
                                 for k, key, body in original]:
        raise ValueError('Unrelated native resource changed')
    return result


def string_table(raw, key, value):
    if len(raw) < 8 or b'\0' in value:
        raise ValueError('Invalid string table replacement')
    word = struct.unpack_from('<I', raw)[0]
    count = word & 0xffffff
    if word >> 24 != 2 or not 0 < count <= 1024 or 4 + count * 4 > len(raw):
        raise ValueError('Unsupported native string table')
    offsets = struct.unpack_from(f'<{count}I', raw, 4)
    if offsets[0] != 4 + count * 4:
        raise ValueError('Unexpected string table directory')
    rows, matched = [], 0
    for i, at in enumerate(offsets):
        end = offsets[i + 1] if i + 1 < count else len(raw)
        if not 4 + count * 4 <= at < end - 4 < len(raw):
            raise ValueError('Invalid string bounds')
        row = raw[at:end]
        if row[-1:] != b'\0' or b'\0' in row[4:-1]:
            raise ValueError('Invalid string termination')
        if row[:4] == key:
            row = key + value + b'\0'
            matched += 1
        rows.append(row)
    if matched != 1:
        raise ValueError('Missing or duplicate string identity')
    cursor, starts = 4 + count * 4, []
    for row in rows:
        starts.append(cursor)
        cursor += len(row)
    return struct.pack('<I', word) + struct.pack(f'<{count}I', *starts) + b''.join(rows)


def legacy_template(raw):
    expected = b'RGM6\0\0\0\0' * 2 + b'VAMPIRIC_REVENGE\0'
    if not raw.startswith(expected):
        raise ValueError('Require the original demo template')
    return raw[:16] + b'DOWNLOADABLE_QUEST_3\0' + raw[len(expected):]


def decode_tile(raw):
    """Read the two self-paletted native formats used by the bonus UI."""
    from PIL import Image
    version, height, width = struct.unpack_from('<HHH', raw)
    palette_at = struct.unpack_from('<I', raw, 22)[0]
    palette = raw[palette_at + 8:palette_at + 1032]
    if not 0 < width <= 2047 or not 0 < height <= 2047 or len(palette) != 1024:
        raise ValueError('Invalid native tile')
    image = Image.new('RGBA', (width, height))
    def color(index):
        return (*palette[index * 4:index * 4 + 3], 255)
    if version == 1:
        for y in range(height):
            for x in range(width):
                image.putpixel((x, y), color(raw[26 + y * width + x]))
    elif version == 3:
        for y in range(height):
            at = 26 + struct.unpack_from('<I', raw, 26 + y * 4)[0]
            for _ in range(width + 1):
                end, flags = struct.unpack_from('<HH', raw, at)
                at += 4
                length = flags & 0x7fff
                if end > width or length > end or at + length > palette_at:
                    raise ValueError('Invalid native tile run')
                for x, index in enumerate(raw[at:at + length], end - length):
                    image.putpixel((x, y), color(index))
                at += length
                if flags & 0x8000:
                    break
            else:
                raise ValueError('Unterminated native tile row')
    else:
        raise ValueError('Unsupported native tile version')
    return image


def bonus_art(intro, interface):
    """Reuse native bonus medallion/glow and generic Ardania scenery.

    Transparent margins preserve the map underneath. No other quest's terrain,
    landmark, title image or narration is substituted for the demo mission.
    """
    from PIL import Image
    original = list(records(intro))
    tiles = [body for kind, _, body in records(interface) if kind == b'TILE']
    if len(tiles) != 5 or sum(k == b'IMAG' for k, _, _ in original) != 4:
        raise ValueError('Original bonus artwork differs')
    result = []
    for index in (2, 0):
        image = decode_tile(tiles[index])
        canvas = Image.new('RGBA', (160, 160))
        canvas.alpha_composite(image, ((160 - image.width) // 2, (160 - image.height) // 2))
        result.append(encode_tile(canvas, tiles[index][:26], (0, 0)))
    result.append(tiles[1])
    image = decode_tile(tiles[0])
    canvas = Image.new('RGBA', (200, 200))
    canvas.alpha_composite(image, ((200 - image.width) // 2, (200 - image.height) // 2))
    result.append(encode_tile(canvas, tiles[0][:26], (0, 0)))
    result.append(tiles[4])
    return encode_cam([
        (b'IMAG', [(key[:3] + b'3', body) for kind, key, body in original if kind == b'IMAG']),
        (b'TILE', [(struct.pack('<I', i), body) for i, body in enumerate(result)]),
    ])

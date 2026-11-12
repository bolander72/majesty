"""Scale world art and its native geometry; leave portraits and original slots intact."""
from array import array
from dataclasses import replace
import struct

from lib.native_sprite_art import animation_sets


def scaled(value, percent):
    """Round signed coordinates symmetrically, without floating point."""
    if not 1 <= percent <= 100:
        raise ValueError('World scale must be 1..100 percent')
    return (1 if value >= 0 else -1) * ((abs(value) * percent + 50) // 100)


def scale_tile(raw, percent):
    """Resize indexed RLE pixels without changing palette or engine shadow indices."""
    from PIL import Image
    if len(raw) < 26:
        raise ValueError('Truncated TILE')
    version, height, width = struct.unpack_from('<3H', raw)
    mode, palette = struct.unpack_from('<HI', raw, 20)
    if version != 3 or not 0 < width <= 2047 or not 0 < height <= 2047 or mode not in (0, 1):
        raise ValueError('Require bounded indexed TILE-v3')
    stop = palette if mode else len(raw)
    if mode and (palette < 26 + height * 4 or palette + 1032 != len(raw)):
        raise ValueError('Invalid embedded palette')
    pixels = array('H', [256]) * (width * height)  # 256 is transparency, never a color.
    for y in range(height):
        at = 26 + struct.unpack_from('<I', raw, 26 + 4 * y)[0]
        if at < 26 + 4 * height or at >= stop:
            raise ValueError('Invalid TILE row offset')
        previous = 0
        for _ in range(width + 1):
            if at + 4 > stop:
                raise ValueError('Truncated TILE run')
            # The source encoder writes a 15-bit length and terminal bit,
            # including >255-pixel runs in the shipped Dark Paladin sprites.
            # Output uses short runs so both native and tooling readers agree.
            end, control = struct.unpack_from('<HH', raw, at)
            size, terminal = control & 0x7fff, bool(control & 0x8000)
            at += 4
            # Retail effect TILEs can leave x_end uninitialized for the empty
            # terminal row (e.g. stock997 uses0xcdcd). No pixels consume it.
            if size == 0 and terminal:
                break
            start = end - size
            if not previous <= start <= end <= width or at + size > stop:
                raise ValueError('Invalid TILE run bounds')
            pixels[y * width + start:y * width + end] = array('H', list(raw[at:at + size]))
            previous = end
            at += size
            if terminal:
                break
        else:
            raise ValueError('Unterminated TILE row')
    # Nearest preserves every palette/control index exactly, including shadows.
    image = Image.new('I', (width, height))
    image.putdata(pixels)
    width, height = max(1, scaled(width, percent)), max(1, scaled(height, percent))
    image = image.resize((width, height), Image.Resampling.NEAREST)
    values = list(image.getdata())
    offsets, runs = [], bytearray()
    for y in range(height):
        offsets.append(height * 4 + len(runs))
        row, x = [], 0
        while x < width:
            if values[y * width + x] == 256:
                x += 1
                continue
            start = x
            shadow = 247 <= values[y * width + x] <= 250
            while (x < width and values[y * width + x] != 256 and x - start < 80
                   and (247 <= values[y * width + x] <= 250) == shadow):
                x += 1
            row.append((x, bytes(values[y * width + start:y * width + x])))
        for n, (end, data) in enumerate(row or [(0, b'')]):
            runs += struct.pack('<HBB', end, len(data), 0x80 if n == len(row or [0]) - 1 else 0) + data
    header = bytearray(raw[:26])
    struct.pack_into('<HH', header, 2, height, width)
    struct.pack_into('<H', header, 6, width)
    anchor = struct.unpack_from('<hh', header, 10)
    struct.pack_into('<hh', header, 10, *(scaled(x, percent) for x in anchor))
    tail = raw[palette:] if mode else b''
    if mode:
        struct.pack_into('<I', header, 22, 26 + 4 * height + len(runs))
    return bytes(header) + struct.pack('<' + 'I' * height, *offsets) + runs + tail


def scale_imag(raw, percent, tile_map):
    """Native v4: signed XY, rectangle masks, polygon pairs and grouped frames.

    See the manager's documented v4/v5 serialized contract. No integer scanning:
    every coordinate comes from a checked count/mask and exact direction bounds.
    v5/events and unknown auxiliary types are refused rather than approximated.
    """
    if struct.unpack_from('<I', raw)[0] != 4:
        raise ValueError('Only audited version-4 building IMAG is supported')
    out, changes, world_refs = bytearray(raw), 0, []

    def coordinates(at, fmt):
        nonlocal changes
        values = struct.unpack_from(fmt, raw, at)
        struct.pack_into(fmt, out, at, *(scaled(x, percent) for x in values))
        changes += len(values)

    for sid, off, end in animation_sets(raw):
        if sid & 0xffff in (1000, 1001, 1002):
            continue  # Native UI sizes remain byte-identical.
        count = struct.unpack_from('<I', raw, off)[0]
        if not 1 <= count <= 32 or off + 64 + count * 4 > end:
            raise ValueError('Invalid IMAG direction table')
        starts = [off + struct.unpack_from('<I', raw, off + 64 + 4 * n)[0] for n in range(count)]
        if starts != sorted(set(starts)) or starts[0] < off + 64 + count * 4 or starts[-1] >= end:
            raise ValueError('Invalid IMAG direction offsets')
        for n, start in enumerate(starts):
            limit = starts[n + 1] if n + 1 < count else end
            if start + 20 > limit:
                raise ValueError('Truncated IMAG direction')
            streams, frames, rectangles, auxiliary, timing, groups = struct.unpack_from('<HHIIHH', raw, start + 4)
            if rectangles & ~7 or auxiliary & ~3 or groups != 1 or not 1 <= streams * frames <= 256:
                raise ValueError('Unsupported building masks/groups')
            coordinates(start, '<2h')
            cursor = start + 20
            for _ in range(rectangles.bit_count()):
                if cursor + 8 > limit:
                    raise ValueError('Truncated IMAG rectangle')
                coordinates(cursor, '<4h')
                cursor += 8
            for _ in range(auxiliary.bit_count()):
                if cursor + 4 > limit:
                    raise ValueError('Truncated polygon count')
                points = struct.unpack_from('<I', raw, cursor)[0]
                cursor += 4
                if points > 256 or cursor + points * 8 > limit:
                    raise ValueError('Invalid IMAG polygon')
                for _ in range(points):
                    coordinates(cursor, '<2i')
                    cursor += 8
            cursor += 4  # Preserve the frame-group tag.
            if cursor + frames * streams * 8 + (20 if timing else 0) != limit:
                raise ValueError('IMAG geometry/frame boundary disagrees')
            for _ in range(frames * streams):
                coordinates(cursor, '<2h')
                at = cursor + 4
                ref = struct.unpack_from('<I', raw, at)[0]
                index = ref & 0xffff
                if index != 0xffff:
                    world_refs.append((at, index))
                    if tile_map is not None:
                        struct.pack_into('<I', out, at, (ref & 0xffff0000) | tile_map[index])
                cursor += 8
    return bytes(out), world_refs, changes


def scale_building_cam(raw, percent, stock_raw=None, families=None):
    """Append private scaled tiles; protect all original art and non-Bards records."""
    from majesty_cam.cam import read_cam, CamEntry
    cam = read_cam(raw)
    sections = {s.extension: s for s in cam.sections}
    if len(sections) != len(cam.sections) or b'IMAG' not in sections or b'TILE' not in sections:
        raise ValueError('Require unique IMAG/TILE sections')
    images, tiles = sections[b'IMAG'].entries, list(sections[b'TILE'].entries)
    stock_tiles = None
    if stock_raw is not None:
        stock = read_cam(stock_raw)
        stock_tiles = next(s.entries for s in stock.sections if s.extension == b'TILE')
    found = {e.name[:4] for e in images}
    if families is None:
        families = [(b'BDG1', b'BDG2', b'BDG3'), (b'ABt1', b'ABt2', b'ABt3')]
    families = [set(f) for f in families if set(f) <= found]
    if len(families) != 1:
        raise ValueError('Require exactly one complete requested building tier family')
    targets = families[0]
    references = set()
    for e in images:
        if e.name[:4] in targets:
            _, refs, _ = scale_imag(e.data, percent, None)
            references.update(index for _, index in refs)
    if not references or len(tiles) + len(references) >= 65535:
        raise ValueError('Scaled TILE allocation exceeds bounds')
    mapping = {}
    for index in sorted(references):
        if index >= len(sections[b'TILE'].entries):
            raise ValueError('Missing original world TILE')
        mapping[index] = len(tiles)
        tile = tiles[index]
        if not tile.data:
            if stock_tiles is None or index >= len(stock_tiles) or tile.name != stock_tiles[index].name:
                raise ValueError('Require matching stock lineage for inherited TILE ' + str(index))
            tile = stock_tiles[index]
        try:
            data = scale_tile(tile.data, percent)
        except ValueError as error:
            raise ValueError('World TILE ' + str(index) + ': ' + str(error)) from error
        tiles.append(CamEntry(struct.pack('<I', len(tiles)) + bytes(16), data))
    changed, coords = [], 0
    for e in images:
        if e.name[:4] in targets:
            data, _, count = scale_imag(e.data, percent, mapping)
            coords += count
            changed.append(replace(e, data=data))
        else:
            changed.append(e)
    result = replace(cam, sections=tuple(
        replace(s, entries=tuple(tiles)) if s.extension == b'TILE' else
        replace(s, entries=tuple(changed)) if s.extension == b'IMAG' else s for s in cam.sections)).to_bytes()
    return result, dict(percent=percent, buildings=sorted(x.decode() for x in targets),
                        newWorldTiles=len(mapping), geometryCoordinates=coords,
                        originalTileSlotsPreserved=True, sidebarArtPreserved=True,
                        paletteAndShadowIndicesPreserved=True, nativeRuntimeQualified=False)


def scale_bards_cam(raw, percent=78, stock_raw=None):
    return scale_building_cam(raw, percent, stock_raw)

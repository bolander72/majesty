"""Encode original RGBA art into the game's indexed TILE-v3 / IMAG resources.

Requires Pillow for deterministic atlas slicing and palette conversion. Native
animation control blocks come from a verified template; all displayed tiles,
including interface and minimap images, come from the new art.
"""
import struct


def encode_tile(image, template_header, anchor=None):
    from PIL import Image
    image = image.convert('RGBA')
    width, height = image.size
    if not 0 < width <= 2047 or not 0 < height <= 2047 or len(template_header) != 26:
        raise ValueError('Invalid tile shape or template')
    if struct.unpack_from('<H', template_header)[0] != 3:
        raise ValueError('Require a TILE-v3 template')
    # Leave engine control indices 247..255 unused. True transparency is
    # represented by gaps between RLE runs, not a palette-key color.
    indexed = image.convert('RGB').quantize(colors=247, method=Image.Quantize.MEDIANCUT)
    indices = bytes(indexed.getdata())
    alpha = bytes(image.getchannel('A').getdata())
    offsets, runs = [], bytearray()
    for y in range(height):
        offsets.append(height * 4 + len(runs))
        row = []
        x = 0
        while x < width:
            if alpha[y * width + x] < 128:
                x += 1
                continue
            start = x
            while x < width and alpha[y * width + x] >= 128:
                x += 1
            row.append((x, indices[y * width + start:y * width + x]))
        if not row:
            row = [(0, b'')]
        for n, (end, values) in enumerate(row):
            flags = len(values) | (0x8000 if n == len(row) - 1 else 0)
            runs.extend(struct.pack('<HH', end, flags) + values)
    palette = indexed.getpalette()
    colors = bytearray(struct.pack('<II', 16777216, 0))
    for i in range(256):
        rgb = palette[i * 3:i * 3 + 3]
        colors.extend(bytes(rgb if len(rgb) == 3 else [0, 0, 0]) + b'\0')
    header = bytearray(template_header)
    struct.pack_into('<HHH', header, 0, 3, height, width)
    if anchor is not None:
        struct.pack_into('<hh', header, 10, *anchor)
    palette_start = 26 + height * 4 + len(runs)
    struct.pack_into('<HI', header, 20, 1, palette_start)
    return bytes(header) + struct.pack(f'<{height}I', *offsets) + runs + colors


def animation_sets(raw):
    if len(raw) < 24:
        raise ValueError('Truncated IMAG')
    count = struct.unpack_from('<I', raw, 20)[0]
    if not 0 < count <= 256 or 24 + count * 8 > len(raw):
        raise ValueError('Invalid IMAG set directory')
    sets = [struct.unpack_from('<II', raw, 24 + i * 8) for i in range(count)]
    offsets = [o for _, o in sets]
    if offsets != sorted(set(offsets)) or offsets[0] < 24 + count * 8 or offsets[-1] >= len(raw):
        raise ValueError('Invalid IMAG set bounds')
    return [(sid, off, sets[n + 1][1] if n + 1 < count else len(raw))
            for n, (sid, off) in enumerate(sets)]


def replace_animation_tiles(raw, choose):
    out = bytearray(raw)
    changed = 0
    for sid, off, end in animation_sets(raw):
        directions = struct.unpack_from('<I', raw, off)[0]
        if not 0 < directions <= 8 or off + 64 + directions * 4 > end:
            raise ValueError('Unsupported directional IMAG')
        pointers = list(struct.unpack_from(f'<{directions}I', raw, off + 64))
        for d, ptr in enumerate(pointers):
            start = off + ptr
            stop = off + pointers[d + 1] if d + 1 < directions else end
            word = struct.unpack_from('<I', raw, start + 4)[0]
            frames, streams = word >> 16, word & 65535
            table = stop - frames * streams * 8
            if not 0 < frames <= 128 or not 0 < streams <= 256 or table < start + 8:
                raise ValueError('Invalid IMAG frame table')
            for stream in range(streams):
                for frame in range(frames):
                    at = table + (stream * frames + frame) * 8 + 4
                    ref = struct.unpack_from('<I', raw, at)[0]
                    tile = choose(sid, d, frame, stream, frames)
                    if not 0 <= tile <= 65535:
                        raise ValueError('New tile reference exceeds native bounds')
                    struct.pack_into('<I', out, at, (ref & 0xffff0000) | tile)
                    changed += 1
    if not changed:
        raise ValueError('No IMAG frames rebound')
    return bytes(out), changed


def encode_cam(sections):
    """Keep TILE record order; its binary four-byte labels are positional IDs."""
    count = len(sections)
    directory_bytes = sum(8 + len(entries) * 28 for _, entries in sections)
    directory_start = 20 + count * 8
    payload_start = directory_start + directory_bytes
    index, directory, payload = bytearray(), bytearray(), bytearray()
    for kind, entries in sections:
        index.extend(struct.pack('<4sI', kind, directory_start + len(directory)))
        directory.extend(struct.pack('<II', len(entries), 1 if kind in [b'TILE', b'SPLT'] else 0))
        for label, raw in entries:
            if len(label) > 20:
                raise ValueError('Native record label exceeds bounds')
            directory.extend(struct.pack('<20sII', label, payload_start + len(payload), len(raw)))
            payload.extend(raw)
    return b'CYLBPC  \x01\0\x01\0' + struct.pack('<II', count, directory_bytes) + index + directory + payload

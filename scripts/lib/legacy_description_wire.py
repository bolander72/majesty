"""Bounded readers for original native CAM/DUNT inputs; no actor templates or mutation."""
import struct


def unpack_chunk(raw, expected=None):
    if len(raw) < 16:
        raise ValueError('Truncated legacy descriptor chunk')
    tag, size, version, count = struct.unpack_from('<4sIII', raw)
    if size != len(raw) - 16 or expected is not None and tag != expected:
        raise ValueError('Legacy descriptor shape differs')
    return tag, version, count, raw[16:]


def children(raw, count):
    if not 0 <= count <= 1024:
        raise ValueError('Legacy descriptor child count exceeds bounds')
    parts, at = [], 0
    for _ in range(count):
        if at + 16 > len(raw):
            raise ValueError('Truncated legacy descriptor child')
        end = at + 16 + struct.unpack_from('<I', raw, at + 4)[0]
        if end > len(raw):
            raise ValueError('Legacy descriptor child exceeds parent')
        parts.append(raw[at:end])
        at = end
    if at != len(raw):
        raise ValueError('Unaccounted legacy descriptor bytes')
    return parts


def unit_parts(raw):
    tag, version, count, payload = unpack_chunk(raw, b'DUNT')
    if (version, count) != (0, 1):
        raise ValueError('Unsupported legacy descriptor root')
    tag, version, count, payload = unpack_chunk(children(payload, count)[0], b'DATA')
    if version != 0 or count not in (2, 3):
        raise ValueError('Unsupported legacy descriptor body')
    parts = children(payload, count)
    unpack_chunk(parts[0], b'HEAD')
    unpack_chunk(parts[1], b'PRIM')
    if count == 3:
        unpack_chunk(parts[2], b'SECD')
    return parts


def cam_payloads(raw):
    if len(raw) < 28 or raw[:12] != b'CYLBPC  \x01\x00\x01\x00':
        raise ValueError('Unsupported native descriptor CAM')
    count, directory_bytes = struct.unpack_from('<II', raw, 12)
    end_directory = 20 + count * 8 + directory_bytes
    if not 0 < count <= 128 or end_directory > len(raw):
        raise ValueError('Native CAM directory exceeds bounds')
    next_index, records, spans = 20 + count * 8, {}, []
    for i in range(count):
        tag, index = struct.unpack_from('<4sI', raw, 20 + i * 8)
        if index != next_index or index + 8 > end_directory:
            raise ValueError('Unsupported native CAM directory shape')
        entries = struct.unpack_from('<Q', raw, index)[0]
        next_index = index + 8 + entries * 28
        if entries > 200000 or next_index > end_directory:
            raise ValueError('Native CAM entries exceed bounds')
        for j in range(entries):
            label, offset, size = struct.unpack_from('<20sII', raw, index + 8 + j * 28)
            key = (tag, label[:4])
            if key in records or offset < end_directory or not size or offset + size > len(raw):
                raise ValueError('Duplicate or invalid native CAM payload')
            records[key] = raw[offset:offset + size]
            spans.append((offset, offset + size))
    if next_index != end_directory:
        raise ValueError('Unaccounted native CAM directory')
    cursor = end_directory
    for start, end in sorted(spans):
        if start != cursor:
            raise ValueError('Native CAM payload overlap or gap')
        cursor = end
    if cursor != len(raw):
        raise ValueError('Unaccounted native CAM payload')
    return records

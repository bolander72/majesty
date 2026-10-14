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


def resource_name(raw, expected):
    """Read only a bounded native HEAD name, without claiming to decode its PRIM.

DSND DATA bodies have additional phase data beyond their nominal child count;
this reader deliberately bounds the first HEAD independently.
"""
    tag, version, count, payload = unpack_chunk(raw, expected)
    if (version, count) != (0, 1):
        raise ValueError('Unsupported named native resource root')
    tag, version, count, payload = unpack_chunk(children(payload, 1)[0], b'DATA')
    if version != 0 or count < 1 or len(payload) < 16:
        raise ValueError('Unsupported named native resource data')
    end = 16 + struct.unpack_from('<I', payload, 4)[0]
    if end > len(payload):
        raise ValueError('Named native resource HEAD exceeds bounds')
    tag, version, count, head = unpack_chunk(payload[:end], b'HEAD')
    if version or count or len(head) < 9:
        raise ValueError('Unsupported named native resource HEAD')
    terminator = head.find(b'\0', 8)
    if terminator < 0:
        raise ValueError('Unterminated named native resource')
    return head[:4].decode('ascii'), head[8:terminator].decode('cp1252')


def encode_unit_cam(descriptions):
    return encode_description_cam(descriptions, b'DUNT')


def encode_description_cam(descriptions, kind):
    """Pack DUNT resources using the original 20-byte prototype filename field."""
    if kind not in (b'DUNT', b'DACT'):
        raise ValueError('Unsupported native description archive kind')
    if not descriptions or len(descriptions) > 1024:
        raise ValueError('Invalid native description archive count')
    directory_bytes = 8 + len(descriptions) * 28
    offset = 28 + directory_bytes
    directory = struct.pack('<Q', len(descriptions))
    payloads, expected = [], {}
    for key in sorted(descriptions):
        if not isinstance(key, str) or len(key) != 4:
            raise ValueError('Four-character native description identity required')
        key_bytes = key.encode('ascii')
        raw = descriptions[key]
        if kind == b'DUNT':
            parts = unit_parts(raw)
        else:
            from .legacy_description_action import action_parts
            parts = action_parts(raw)
        head = unpack_chunk(parts[0], b'HEAD')[3]
        if head[:4] != key_bytes:
            raise ValueError('Description header/archive identity disagreement')
        end = head.find(b'\0', 8)
        if end < 0:
            raise ValueError('Unterminated native prototype name')
        # Only the bounded directory filename is shortened. HEAD preserves the
        # complete authored name and is what the native description registry reads.
        label = key_bytes + head[8:end][:16]
        directory += struct.pack('<20sII', label, offset, len(raw))
        offset += len(raw)
        payloads.append(raw)
        expected[kind, key_bytes] = raw
    result = (b'CYLBPC  \x01\x00\x01\x00' + struct.pack('<II4sI', 1, directory_bytes, kind, 28) +
              directory + b''.join(payloads))
    if cam_payloads(result) != expected:
        raise ValueError('Native descriptor CAM round trip differs')
    return result

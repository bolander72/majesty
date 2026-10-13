"""Private reserved-slot menu resources; purchased art remains a prototype.

The original expansion AP30 already contains XQD2's marker and trigger. Its
manager requests DX32, IXD2, IXR2 and IXS2, which are absent in the installation.
Clone XQD1's archive under those independent image IDs, retaining its numeric
TILE directory and payload verbatim. This does not create original artwork.
"""
import hashlib
import struct

from lib.wayfinder_interface import string_entries

ART_SHA256 = '1e6b742a9250ff0affa406feb484c9bc231d51d4b7fbec4b3cfa898ae6ae3d8b'
MENU_SHA256 = '60ab851f56c563025ad8db0814436c50c34594ee396e27ab77c057e4b47e0b1f'
QUEST_TEXT_SHA256 = '723e3aa30fc0413f63640a6d53443697b3f53e95532a0e3a713d08901fd78918'
IMAGE_IDS = {b'DX31': b'DX32', b'IXD1': b'IXD2', b'IXR1': b'IXR2', b'IXS1': b'IXS2'}
MENU_FILENAME = 'LostTrail-menu-art.cam'


def reserved_art(raw):
    if hashlib.sha256(raw).hexdigest() != ART_SHA256:
        raise ValueError('Purchased downloadable quest artwork differs')
    if raw[:12] != b'CYLBPC  \x01\0\x01\0':
        raise ValueError('Unsupported downloadable artwork archive')
    count, directory_bytes = struct.unpack_from('<II', raw, 12)
    if count != 2:
        raise ValueError('Unexpected downloadable artwork sections')
    end = 36 + directory_bytes
    result = bytearray(raw)
    changed, seen = set(), set()
    for i, expected in enumerate(((b'IMAG', 4, 0), (b'TILE', 5, 1))):
        kind, index = struct.unpack_from('<4sI', raw, 20 + i * 8)
        items, mode = struct.unpack_from('<II', raw, index)
        if (kind, items, mode) != expected or index + 8 + items * 28 > end:
            raise ValueError('Downloadable artwork directory differs')
        if kind != b'IMAG':
            continue
        for j in range(items):
            at = index + 8 + j * 28
            old = raw[at:at + 4]
            if old not in IMAGE_IDS or old in seen:
                raise ValueError('Downloadable artwork identity differs')
            seen.add(old)
            result[at:at + 4] = IMAGE_IDS[old]
            changed.update(range(at, at + 4))
    if seen != set(IMAGE_IDS) or any(
            a != b and i not in changed for i, (a, b) in enumerate(zip(raw, result))):
        raise ValueError('Artwork changed outside the four image identities')
    return bytes(result)


def reserved_title(raw):
    word, values = string_entries(raw)
    if values[2] != b'Bonus Quest 2' or values[84] != b'Bonus Downloadable Quest 2 Trigger':
        raise ValueError('Reserved quest menu text differs')
    values[2] = b'The Lost Trail'
    base = 4 + len(values) * 4
    offsets, payload = [], bytearray()
    for i, value in enumerate(values):
        offsets.append(base + len(payload))
        payload.extend(struct.pack('<I', i) + value + b'\0')
    result = struct.pack('<I', word) + struct.pack(f'<{len(offsets)}I', *offsets) + payload
    if string_entries(result)[1] != values:
        raise ValueError('Reserved quest text serialization failed')
    return result


def quest_title(raw):
    """QUES uses CYID keys, unlike AP30's ordinal string identities.

    Original004d1390 looks up QUES/XQD2 for the actual heading. Preserve all
    existing quest IDs and names, especially the independent XQD1 campaign.
    """
    if len(raw) < 8:
        raise ValueError('Truncated quest name table')
    word = struct.unpack_from('<I', raw)[0]
    count = word & 0xffffff
    base = 4 + count * 4
    if word >> 24 != 2 or not 1 <= count <= 128 or base > len(raw):
        raise ValueError('Unsupported quest name table')
    offsets = struct.unpack_from(f'<{count}I', raw, 4)
    if offsets[0] != base:
        raise ValueError('Quest name directory differs')
    entries, seen = [], set()
    for i, start in enumerate(offsets):
        end = offsets[i + 1] if i + 1 < count else len(raw)
        if not base <= start < end - 4 <= len(raw) - 4:
            raise ValueError('Quest name bounds differ')
        key, value = raw[start:start + 4], raw[start + 4:end]
        if key in seen or value[-1:] != b'\0' or b'\0' in value[:-1]:
            raise ValueError('Quest name identity or termination differs')
        key.decode('ascii')
        value[:-1].decode('ascii')
        seen.add(key)
        if key == b'XQD2':
            if value != b'Bonus Quest 2\0':
                raise ValueError('Reserved quest name differs')
            value = b'The Lost Trail\0'
        entries.append(key + value)
    if b'XQD2' not in seen:
        raise ValueError('Reserved quest name absent')
    offsets, payload = [], bytearray()
    for entry in entries:
        offsets.append(base + len(payload))
        payload.extend(entry)
    return struct.pack('<I', word) + struct.pack(f'<{count}I', *offsets) + payload

"""Clone the purchased Ranger panel under a separate Trail Lodge identity.

The pinned native STRT table stores a format/count word, entry offsets, then
an integer string ID and a terminated ASCII string per entry. Preserve every
widget/action binding in SMNU and every unrelated string. No installation is
modified; the caller includes this small CAM in its private content pack.
"""
import hashlib
import struct

INTERFACE_ID = b'APw1'
SOURCE_ID = b'AP47'
SOURCE_HASHES = {
    b'SMNU': '5928b2f93711592eb17d6bf6174a1bbd3a9faeab560445dc4e47750b1683e475',
    b'STRT': '96dfaa011e8566ead160963ee7bd76753cde0a8da9d87c23e929eefa9ccc3a0f',
}
TEXT_EDITS = {
    0: (b'RANGERS GUILD', b'TRAIL LODGE'),
    1: (b'RECRUIT Ranger ', b'RECRUIT Wayfinder'),
    2: (b'Recruit a Ranger ', b'Recruit a Wayfinder'),
    4: (b'Move this Rangers Camp to another location.', b'Move this Trail Lodge to another location.'),
    6: (b'Destroy this Rangers Guild.', b'Destroy this Trail Lodge.'),
}


def string_entries(raw):
    if len(raw) < 4:
        raise ValueError('Truncated interface string table')
    word = struct.unpack_from('<I', raw)[0]
    count = word & 0xffffff
    if word >> 24 != 2 or not 0 < count <= 1024 or 4 + count * 4 > len(raw):
        raise ValueError('Unsupported interface string table')
    offsets = list(struct.unpack_from(f'<{count}I', raw, 4))
    if offsets[0] != 4 + count * 4:
        raise ValueError('Interface string directory differs')
    entries = []
    for i, start in enumerate(offsets):
        end = offsets[i + 1] if i + 1 < count else len(raw)
        if end <= start + 4 or end > len(raw):
            raise ValueError('Interface string bounds differ')
        value = raw[start + 4:end]
        if struct.unpack_from('<I', raw, start)[0] != i or value[-1:] != b'\0' or b'\0' in value[:-1]:
            raise ValueError('Interface string identity or termination differs')
        value[:-1].decode('ascii')
        entries.append(value[:-1])
    return word, entries


def clone_interface(records, other_ids=()):
    if any(key[1] == INTERFACE_ID for key in records) or INTERFACE_ID in other_ids:
        raise ValueError('New interface identity already exists')
    for kind, digest in SOURCE_HASHES.items():
        if hashlib.sha256(records.get((kind, SOURCE_ID), b'')).hexdigest() != digest:
            raise ValueError('Purchased Ranger interface baseline differs')
    word, entries = string_entries(records[b'STRT', SOURCE_ID])
    for index, (original, updated) in TEXT_EDITS.items():
        if entries[index] != original:
            raise ValueError('Inherited interface text differs')
        entries[index] = updated
    cursor = 4 + len(entries) * 4
    offsets, payload = [], bytearray()
    for i, value in enumerate(entries):
        offsets.append(cursor + len(payload))
        payload.extend(struct.pack('<I', i) + value + b'\0')
    text = struct.pack('<I', word) + struct.pack(f'<{len(offsets)}I', *offsets) + payload
    assert string_entries(text)[1] == entries
    return {(b'SMNU', INTERFACE_ID): records[b'SMNU', SOURCE_ID], (b'STRT', INTERFACE_ID): bytes(text)}


def encode_interface_cam(records):
    kinds = (b'SMNU', b'STRT')
    if set(records) != {(kind, INTERFACE_ID) for kind in kinds}:
        raise ValueError('Require the two independent interface resources')
    header = b'CYLBPC  \x01\0\x01\0' + struct.pack('<II', 2, 72)
    indices, directory, payload = bytearray(), bytearray(), bytearray()
    for i, kind in enumerate(kinds):
        data = records[kind, INTERFACE_ID]
        indices.extend(struct.pack('<4sI', kind, 36 + 36 * i))
        directory.extend(struct.pack('<Q20sII', 1, INTERFACE_ID, 108 + len(payload), len(data)))
        payload.extend(data)
    return header + indices + directory + payload

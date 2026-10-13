"""Separate v2 waystation panel: recruit/support, with no Ranger relocation."""
import struct
from lib.wayfinder_interface import clone_interface, string_entries, INTERFACE_ID


def stationary_lodge_interface(original_records, other_ids=()):
    records = clone_interface(original_records, other_ids)
    raw = records[b'SMNU', INTERFACE_ID]
    if len(raw) != 3116:
        raise ValueError('Original Lodge panel shape differs')
    words = struct.unpack('<779i', raw)
    # Original AP47 leaf widgets: relocation button1005 and its live cost1016.
    # Delete both complete -1-terminated records. Keep the root terminator,
    # recruitment, hero roster, tracking and demolition bindings verbatim.
    if (words[134:140] != (0, 2, 7, 219, 139, 21)
            or words[153:155] != (13, 1005) or words[178] != -1
            or words[738:744] != (5, 2, 112, 221, 33, 17)
            or words[756:758] != (13, 1016) or words[777:] != (-1, -1)):
        raise ValueError('Original relocation widget bindings differ')
    if raw.count(b'AVH1') != 1 or raw[2180:2184] != b'AVH1':
        raise ValueError('Original recruitment portrait binding differs')
    raw = raw[:2180] + b'AVz1' + raw[2184:]
    records[b'SMNU', INTERFACE_ID] = raw[:134 * 4] + raw[179 * 4:738 * 4] + raw[778 * 4:]
    word, entries = string_entries(records[b'STRT', INTERFACE_ID])
    entries[2] = (b'Recruit a melee scout. Lantern Survey improves exploration. From level 2, Field Aid heals nearby companions. '
                  b'Completed Trail Lodges supply nearby outdoor heroes with healing.')
    entries[4] = b'Field Supply: completed Trail Lodges restore 2 HP to nearby outdoor heroes every 8 seconds. Overlapping Lodges do not stack.'
    cursor = 4 + len(entries) * 4
    offsets, payload = [], bytearray()
    for i, entry in enumerate(entries):
        offsets.append(cursor + len(payload))
        payload.extend(struct.pack('<I', i) + entry + b'\0')
    records[b'STRT', INTERFACE_ID] = struct.pack('<I', word) + struct.pack(f'<{len(offsets)}I', *offsets) + payload
    if string_entries(records[b'STRT', INTERFACE_ID])[1] != entries:
        raise ValueError('New Lodge text does not round-trip')
    return records

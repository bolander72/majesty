"""Merge authentic guild tables without replacing unrelated native records."""
from dataclasses import replace
import re
import struct

from majesty_cam.cam import CamArchive
from majesty_cam.strt import StrtRecord, StrtTable, parse_strt
from .legacy_description_wire import resource_name, unit_parts

PHANTOM_NAMES = {b'HN41': b'HNP0', b'HN42': b'HNP1'}
PHANTOM_GENERATOR = b'NMPH'
TROUBADOUR_SOUND = b'BTV1'


def unique(entries, key):
    result = {}
    for entry in entries:
        identity = key(entry)
        if identity in result:
            raise ValueError('Duplicate native table identity')
        result[identity] = entry
    return result


def merge_catalog(stock, overlays, kind, allowed=()):
    """Only explicitly owned, same-name descriptors may change in place."""
    sections = [s for s in stock.sections if s.extension == kind]
    if len(sections) != 1:
        raise ValueError('Require one original native descriptor section')
    original = sections[0]
    before = unique(original.entries, lambda e: e.name[:4])
    new = unique((e for archive in overlays for s in archive.sections
                  if s.extension == kind for e in s.entries), lambda e: e.name[:4])
    for key in before.keys() & new.keys():
        if before[key].data == new[key].data:
            continue
        if key not in allowed or resource_name(before[key].data, kind) != resource_name(new[key].data, kind):
            raise ValueError('Unowned native descriptor replacement: ' + repr(key))
    rows = tuple(new.get(e.name[:4], e) for e in original.entries)
    rows += tuple(e for key, e in new.items() if key not in before)
    result = CamArchive(tuple(replace(s, entries=rows) if s == original else s for s in stock.sections))
    return result, dict(added=len(new.keys() - before.keys()),
                       replaced=[k.decode('ascii') for k in before.keys() & new.keys()
                                 if before[k].data != new[k].data],
                       unrelatedPayloadsPreserved=True)


def merge_strings(original, authored, index_keyed=False, allowed_overrides=()):
    if original.version != authored.version:
        raise ValueError('Native string versions differ')
    if index_keyed:
        # QITM is addressed by row position, including unused inventory slots.
        if len(authored.records) < len(original.records):
            raise ValueError('Native positional strings would shrink')
        rows = list(authored.records)
        for i, old in enumerate(original.records):
            new = rows[i]
            if old.string_id != new.string_id or (old != new and not (
                    old.text == b'' and new.text == b'Unknown Item')):
                raise ValueError('Native positional strings would move or change')
            rows[i] = old
        return StrtTable(original.version, tuple(rows))
    before = unique(original.records, lambda r: r.string_id)
    after = unique(authored.records, lambda r: r.string_id)
    for key in before.keys() & after.keys():
        if before[key] != after[key] and key not in allowed_overrides:
            raise ValueError('Conflicting native string: ' + str(key))
    return StrtTable(original.version, tuple(after.get(r.string_id, r)
        if r.string_id in allowed_overrides else r for r in original.records) + tuple(
        r for r in authored.records if r.string_id not in before))


def native_titles(table, bindings, existing):
    rows = list(table.records)
    positions = {r.string_id: i for i, r in enumerate(rows)}
    if len(positions) != len(rows):
        raise ValueError('Duplicate authored unit title')
    old = unique(existing.records, lambda r: r.string_id)
    for identity, binding in bindings.items():
        if len(identity) != 4:
            raise ValueError('Four-character native title required')
        key = int.from_bytes(identity.encode('ascii'), 'little')
        text = binding['display'].encode('cp1252')
        # Preserve the user's deployed, explicit Alchemy Lab stage labels.
        if identity in ('ABx1', 'ABx2', 'ABx3'):
            expected = b'Alchemy Lab' + (b' Level ' + identity[-1].encode() if identity[-1] != '1' else b'')
            if key not in old or old[key].text != expected:
                raise ValueError('Qualified Alchemy Lab stage labels changed')
            text = expected
        if key in positions:
            if rows[positions[key]].text != text:
                raise ValueError('Native title identity occupied')
        else:
            positions[key] = len(rows)
            rows.append(StrtRecord(key, text))
    return StrtTable(table.version, tuple(rows))


def merge_dependencies(original, composed, aliases):
    def lines(raw):
        return [(line.split(b':', 1)[0].strip(), line.strip()) for line in raw.splitlines()
                if line.strip() and not line.lstrip().startswith(b'#')]
    occupied = unique(lines(original), lambda row: row[0])
    source = unique(lines(composed), lambda row: row[0])
    additions = []
    for old, target in aliases.items():
        old, target = old.encode('ascii'), target.encode('ascii')
        if old not in source:
            raise ValueError('Missing authored building prerequisite')
        tokens = re.split(rb'(\s+|:)', source[old][1])
        adapted = b''.join(aliases.get(t.decode('ascii'), t.decode('ascii')).encode('ascii') for t in tokens)
        if target in occupied:
            if occupied[target][1] != adapted:
                raise ValueError('Native building prerequisite conflict')
        else:
            additions.append(adapted)
    return original.rstrip(b'\r\n') + b'\r\n' + b'\r\n'.join(additions) + b'\r\n\r\n'


def phantom_name_descriptor(raw):
    parts = unit_parts(raw)
    if len(parts) != 3 or resource_name(raw, b'DUNT') != ('AVp1', 'Phantom'):
        raise ValueError('Require the authentic native Phantom descriptor')
    offset = 32 + len(parts[0]) + len(parts[1]) + 16 + 92
    if raw[offset:offset + 4] != b'NM11':
        raise ValueError('Phantom name generator differs from acquired source')
    result = bytearray(raw)
    result[offset:offset + 4] = PHANTOM_GENERATOR
    return bytes(result)


def troubadour_sound_descriptor(raw):
    if resource_name(raw, b'DSND') != ('BT01', 'TroubV'):
        raise ValueError('Require the acquired Troubadour voice descriptor')
    result = bytearray(raw)
    result[48:52] = TROUBADOUR_SOUND
    return bytes(result)


def troubadour_sound_unit(raw):
    parts = unit_parts(raw)
    if resource_name(raw, b'DUNT') != ('AVv1', 'Troubadour') or parts[1][-12:-8] != b'BT01':
        raise ValueError('Require the acquired Troubadour default voice binding')
    result = bytearray(raw)
    offset = 32 + len(parts[0]) + len(parts[1]) - 12
    result[offset:offset + 4] = TROUBADOUR_SOUND
    return bytes(result)


def name_binding():
    # Original Old NM11 reads HN41..44. The mod replaces the first two tables;
    # move only those fragments and keep the original third/fourth references.
    return b'MNB1' + struct.pack('<II', 1, 1) + b'NM11' + PHANTOM_GENERATOR + b'HNP0HNP1HN43HN44'

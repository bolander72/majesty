"""Retire More Heroes admissions while retaining saved actor definitions."""
from dataclasses import replace
import struct
from lib.legacy_description_wire import unit_parts, unpack_chunk
from majesty_cam.gpl import parse_gpl, DefinitionKind

HERO_KEYS = frozenset(('AV01','AV11','AV21','AV31','AV41','AV51','AV61',
                      'AV71','AV81','AV91','AVP1','AVQ1','AVR1'))
BUILDING_KEYS = frozenset(('AB01','AB11','AB21','AB31','AB41','AB51','AB61',
                          'AB71','AB81','AB91','ABI1','ABK1','ABZ1','ABi1','ABy1'))


def chunk(tag, version, count, payload):
    return struct.pack('<4sIII', tag, len(payload), version, count) + payload


def retire_buildings(archive):
    """Only set NotBuildable and remove retired heroes from native production."""
    changed, blocked, removed = [], set(), {}
    sections = []
    for section in archive.sections:
        entries = []
        for entry in section.entries:
            key = entry.name[:4].decode('ascii')
            if section.extension != b'DUNT':
                entries.append(entry); continue
            parts = unit_parts(entry.data)
            if len(parts) != 3:
                entries.append(entry); continue
            _, version, count, payload = unpack_chunk(parts[2], b'SECD')
            if version != 5:
                entries.append(entry); continue
            if count or len(payload) < 72 or struct.unpack_from('<III', payload, 56) != (1, 0, 1):
                raise ValueError('Unsupported building production map: ' + key)
            length = struct.unpack_from('<I', payload, 68)[0]
            if len(payload) != 72 + 4 * length:
                raise ValueError('Building production span changed: ' + key)
            produces = [payload[i:i+4] for i in range(72, len(payload), 4)]
            kept = [p for p in produces if p.decode('ascii') not in HERO_KEYS]
            flags = struct.unpack_from('<I', payload, 40)[0]
            header = bytearray(payload[:68])
            if key in BUILDING_KEYS:
                struct.pack_into('<I', header, 40, flags | 1)  # native NotBuildable
                blocked.add(key)
            if key in BUILDING_KEYS or kept != produces:
                parts[2] = chunk(b'SECD', version, count,
                    bytes(header) + struct.pack('<I', len(kept)) + b''.join(kept))
                raw = chunk(b'DUNT', 0, 1, chunk(b'DATA', 0, len(parts), b''.join(parts)))
                entry = replace(entry, data=raw)
                changed.append(key)
                removed[key] = [p.decode('ascii') for p in produces if p not in kept]
            entries.append(entry)
        sections.append(replace(section, entries=tuple(entries)))
    if blocked != BUILDING_KEYS:
        raise ValueError('Missing retired buildings: ' + repr(sorted(BUILDING_KEYS - blocked)))
    if set().union(*(set(v) for v in removed.values())) != HERO_KEYS:
        raise ValueError('Require all 13 retired hero production identities')
    return replace(archive, sections=tuple(sections)), {'blockedBuildings':sorted(blocked),
        'removedProduction':removed, 'changedRecords':changed}


def restore_random_pool(expansion, original):
    """Use the unchanged original-edition pool, retaining Phantom/Alchemist guards."""
    doc, baseline = parse_gpl(expansion), parse_gpl(original)
    edits = []
    for name in ['Random_Hero_Type', 'MJC_Random_Hero_Type']:
        old = doc.require(DefinitionKind.FUNCTION, name)
        new = baseline.require(DefinitionKind.FUNCTION, name)
        if '"Necromancer"' not in old.text or '"Necromancer"' in new.text:
            raise ValueError('Unexpected random-hero retirement baseline')
        if '"Phantom"' not in new.text or '"Alchemist"' not in new.text:
            raise ValueError('Preserve existing community heroes in random selection')
        edits.append((old.span.start, old.span.end, new.text))
    for start, end, text in sorted(edits, reverse=True):
        expansion = expansion[:start] + text + expansion[end:]
    return expansion

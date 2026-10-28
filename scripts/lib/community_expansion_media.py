"""Append new art while retaining the deployed collection's complete native slots."""
from dataclasses import replace
import hashlib
import struct

from majesty_cam.cam import CamEntry, CamSection
from majesty_cam.art import (parse_best_imag_tile_references,
    parse_tile_palette_reference, validate_external_palette_closure)


def image_sets(entry, sections):
    """Compare complete set payloads after resolving their typed references."""
    data = entry.data
    if len(data) < 24:
        raise ValueError('Truncated image set directory')
    count = struct.unpack_from('<I', data, 20)[0]
    end = 24 + count * 8
    if not 0 < count <= 256 or end > len(data):
        raise ValueError('Invalid image set directory')
    rows = [struct.unpack_from('<II', data, 24 + index * 8) for index in range(count)]
    offsets = sorted(offset for _, offset in rows)
    if len(set(offsets)) != count or offsets[0] < end or offsets[-1] >= len(data):
        raise ValueError('Invalid image set boundaries')
    ends = dict(zip(offsets, offsets[1:] + [len(data)]))
    parsed = parse_best_imag_tile_references(data, tile_count=len(sections[b'TILE'].entries),
                                             entry_name=entry.name)
    result = {}
    for set_id, start in rows:
        if set_id in result:
            raise ValueError('Duplicate image set identity')
        body = bytearray(data[start:ends[start]])
        tiles = []
        for reference in parsed.references:
            if reference.set_id != set_id:
                continue
            struct.pack_into('<I', body, reference.offset - start, reference.flag_bits)
            index = reference.tile_index
            tile = bytearray(sections[b'TILE'].entries[index].data) if index else bytearray()
            palette = b''
            if tile:
                ref = parse_tile_palette_reference(tile, tile_index=index)
                if ref:
                    palette = sections[b'SPLT'].entries[ref.palette_index].data
                    struct.pack_into('<I', tile, 22, 0)
            tiles.append((reference.direction, reference.frame, reference.layout,
                          bytes(tile), palette))
        result[set_id] = (bytes(body), tuple(tiles))
    return data[:20], result


def append_art(original, authored, image_ids, extend_cursor=False):
    """Relocate only selected new IMAG/TILE/SPLT records into an existing CAM."""
    old = {section.extension: section for section in original.sections}
    source = {section.extension: section for section in authored.sections}
    if not {b'IMAG', b'TILE'} <= old.keys() & source.keys():
        raise ValueError('Require complete art archive domains')
    had_palettes = b'SPLT' in old
    old.setdefault(b'SPLT', CamSection(b'SPLT', ()))
    source.setdefault(b'SPLT', CamSection(b'SPLT', ()))
    images = list(old[b'IMAG'].entries)
    tiles = list(old[b'TILE'].entries)
    palettes = list(old[b'SPLT'].entries)
    have = {entry.name[:4] for entry in images}
    selected = [entry for entry in source[b'IMAG'].entries if entry.name[:4] in image_ids]
    if {entry.name[:4] for entry in selected} != set(image_ids) or len(selected) != len(image_ids):
        raise ValueError('Missing or duplicate selected expansion art')
    overlaps = have & set(image_ids)
    if overlaps and (not extend_cursor or overlaps != {b'CUR1'}):
        raise ValueError('New art would replace a deployed image')
    if overlaps:
        prior_cursor = next(entry for entry in images if entry.name[:4] == b'CUR1')
        new_cursor = next(entry for entry in selected if entry.name[:4] == b'CUR1')
        header, sets = image_sets(prior_cursor, old)
        new_header, new_sets = image_sets(new_cursor, source)
        if header != new_header or any(new_sets.get(key) != payload for key, payload in sets.items()):
            raise ValueError('Expansion cursor changes a deployed cursor set')
    palette_hashes = {hashlib.sha256(entry.data).digest(): index
                      for index, entry in enumerate(palettes) if entry.data}
    tile_hashes = {hashlib.sha256(entry.data).digest(): index
                  for index, entry in enumerate(tiles) if entry.data}
    palette_map, tile_map = {}, {0: 0}

    def palette(index):
        if index not in palette_map:
            if index >= len(source[b'SPLT'].entries):
                raise ValueError('Expansion palette exceeds its own archive')
            entry = source[b'SPLT'].entries[index]
            key = hashlib.sha256(entry.data).digest()
            if key not in palette_hashes:
                palette_hashes[key] = len(palettes)
                palettes.append(CamEntry(struct.pack('<I', len(palettes)).ljust(20, b'\0'), entry.data))
            palette_map[index] = palette_hashes[key]
        return palette_map[index]

    def tile(index):
        if index not in tile_map:
            if index >= len(source[b'TILE'].entries):
                raise ValueError('Expansion tile exceeds its own archive')
            data = bytearray(source[b'TILE'].entries[index].data)
            if not data:
                raise ValueError('Expansion image references an empty tile')
            reference = parse_tile_palette_reference(data, tile_index=index)
            if reference:
                struct.pack_into('<I', data, 22, palette(reference.palette_index))
            data = bytes(data)
            key = hashlib.sha256(data).digest()
            if key not in tile_hashes:
                if len(tiles) >= 65535:
                    raise ValueError('Native art tile range exhausted')
                tile_hashes[key] = len(tiles)
                tiles.append(CamEntry(struct.pack('<I', len(tiles)).ljust(20, b'\0'), data))
            tile_map[index] = tile_hashes[key]
        return tile_map[index]

    for entry in selected:
        parsed = parse_best_imag_tile_references(entry.data,
            tile_count=len(source[b'TILE'].entries), entry_name=entry.name)
        data = bytearray(entry.data)
        for reference in parsed.references:
            struct.pack_into('<I', data, reference.offset,
                             reference.flag_bits | tile(reference.tile_index))
        restored = bytearray(data)
        for reference in parsed.references:
            struct.pack_into('<I', restored, reference.offset, reference.encoded_value)
        if bytes(restored) != entry.data:
            raise ValueError('Art relocation changed non-reference bytes')
        entry = replace(entry, data=bytes(data))
        if entry.name[:4] in overlaps:
            index = next(index for index, old_entry in enumerate(images)
                         if old_entry.name[:4] == entry.name[:4])
            images[index] = entry
        else:
            images.append(entry)
    replacements = {b'IMAG': tuple(images), b'TILE': tuple(tiles), b'SPLT': tuple(palettes)}
    result = replace(original, sections=tuple(replace(section, entries=replacements[section.extension])
        if section.extension in replacements else section for section in original.sections))
    if palettes and not had_palettes:
        result = replace(result, sections=(*result.sections, CamSection(b'SPLT', tuple(palettes))))
    result_sections = {section.extension: section for section in result.sections}
    validate_external_palette_closure(result_sections[b'TILE'],
                                      result_sections.get(b'SPLT', old[b'SPLT']))
    if any(new_entry.data != old_entry.data or new_entry.name != old_entry.name
           for kind, section in old.items() if kind in replacements
           for old_entry, new_entry in zip(section.entries, result_sections.get(kind, section).entries)
           if not (kind == b'IMAG' and old_entry.name[:4] in overlaps)):
        raise ValueError('Deployed art slots changed during expansion import')
    return result, dict(imagesAdded=len(selected) - len(overlaps),
        tilesAdded=len(tiles) - len(old[b'TILE'].entries),
        palettesAdded=len(palettes) - len(old[b'SPLT'].entries),
        deployedSlotsByteIdenticalExceptCursorExtension=True,
        deployedCursorSetsIdentical=True, cursorExtended=bool(overlaps))


def append_waves(original, authored, wave_ids):
    sections = [section for section in original.sections if section.extension == b'WAVE']
    if len(sections) != 1:
        raise ValueError('Require one deployed waveform section')
    section = sections[0]
    have = {entry.name[:4] for entry in section.entries}
    additions = tuple(entry for part in authored.sections if part.extension == b'WAVE'
                      for entry in part.entries if entry.name[:4] in wave_ids)
    if (have & set(wave_ids) or {entry.name[:4] for entry in additions} != set(wave_ids)
            or len(additions) != len(wave_ids)):
        raise ValueError('Missing, duplicate or occupied new waveform')
    return replace(original, sections=tuple(replace(part, entries=part.entries + additions)
        if part == section else part for part in original.sections))


def repair_zoo_foundation_preview(archive):
    """Use the acquired Zoo foundation for its empty native placement set."""
    sections = {part.extension: part for part in archive.sections}
    images = sections[b'IMAG'].entries
    matches = [entry for entry in images if entry.name[:4] == b'ABn1']
    if len(matches) != 1:
        raise ValueError('Require one acquired Zoo image')
    entry = matches[0]
    parsed = parse_best_imag_tile_references(entry.data,
        tile_count=len(sections[b'TILE'].entries), entry_name=entry.name)
    preview = [ref for ref in parsed.references if ref.set_id == 0x50]
    foundation = [ref for ref in parsed.references if ref.set_id == 0x51]
    if (len(preview) != 1 or preview[0].tile_index != 0 or len(foundation) != 1
            or not foundation[0].tile_index):
        raise ValueError('Require an empty Zoo preview and an authored visible foundation')
    before = image_sets(entry, sections)[1]
    count = struct.unpack_from('<I', entry.data, 20)[0]
    directory_end = 24 + count * 8
    rows = [struct.unpack_from('<II', entry.data, 24 + i * 8) for i in range(count)]
    offsets = sorted(offset for _, offset in rows)
    if offsets[0] != directory_end:
        raise ValueError('Unexpected Zoo image directory padding')
    ends = dict(zip(offsets, offsets[1:] + [len(entry.data)]))
    bodies = {key: entry.data[start:ends[start]] for key, start in rows}
    bodies[0x50] = bodies[0x51]
    raw = bytearray(entry.data[:directory_end])
    for i, (key, _) in enumerate(rows):
        struct.pack_into('<II', raw, 24 + i * 8, key, len(raw))
        raw.extend(bodies[key])
    repaired = replace(entry, data=bytes(raw))
    after = image_sets(repaired, sections)[1]
    if after[0x50] != before[0x51] or any(
            after[key] != value for key, value in before.items() if key != 0x50):
        raise ValueError('Zoo repair changed an unrelated image set')
    result = replace(archive, sections=tuple(replace(part,
        entries=tuple(repaired if value is entry else value for value in part.entries))
        if part.extension == b'IMAG' else part for part in archive.sections))
    return result, dict(image='ABn1', nativePlacementSet=0x50, authoredFoundationSet=0x51,
        authoredPixelsReused=True, otherImageSetsUnchanged=True,
        tilesAndPalettesUnchanged=True)

"""Import selected retail art/audio while preserving every existing native slot.

Uses the pinned manager's proven retail IMAG parser. Retail animation references
are relocated, and their original pixel/palette bytes remain unchanged. No game
process or generated translation is needed.
"""
from dataclasses import replace
import hashlib
import mmap
import struct
from majesty_cam.cam import read_cam, CamEntry
from majesty_cam.art import parse_stock_imag_tile_references, parse_tile_palette_reference, validate_external_palette_closure

class IndexedCam:
    """Read only bounded CAM directory entries and selected payloads through mmap."""

    def __init__(self, path):
        self.path = path
        self.file = path.open('rb')
        try:
            self.map = mmap.mmap(self.file.fileno(), 0, access=mmap.ACCESS_READ)
            r = self.map
            if not r[:12] == b'CYLBPC  \x01\x00\x01\x00':
                raise ValueError('Unproven retail resource boundary')
            n, size = struct.unpack_from('<II', r, 12)
            end = 20 + n * 8 + size
            if not (n < 128 and end <= len(r)):
                raise ValueError('Unproven retail resource boundary')
            self.entries = {}
            self.counts = {}
            for i in range(n):
                kind, off = struct.unpack_from('<4sI', r, 20 + i * 8)
                count = struct.unpack_from('<I', r, off)[0]
                if not (off >= 20 + n * 8 and off + 8 + count * 28 <= end):
                    raise ValueError('Unproven retail resource boundary')
                rows = []
                for k in range(count):
                    name, at, length = struct.unpack_from('<20sII', r, off + 8 + k * 28)
                    if not (at >= end and at + length <= len(r)):
                        raise ValueError('Unproven retail resource boundary')
                    rows.append((name, at, length))
                self.entries[kind] = rows
                self.counts[kind] = count
        except BaseException:
            if hasattr(self, 'map'):
                self.map.close()
            self.file.close()
            raise

    def get(self, kind, index):
        rows = self.entries.get(kind, [])
        if isinstance(index, bytes):
            found = [r for r in rows if r[0][:4] == index]
            if not found:
                return None
            if not len(found) == 1:
                raise ValueError('Unproven retail resource boundary')
            name, at, n = found[0]
        else:
            if index >= len(rows):
                return None
            name, at, n = rows[index]
        return CamEntry(name, bytes(self.map[at:at + n])) if n else None

    def close(self):
        self.map.close()
        self.file.close()

def merge_media(mirror, plan):
    """Append required retail resources and prove existing art slots unchanged."""
    indices = []

    def indexed(path):
        if path.stat().st_size > 128 * 1024 * 1024:
            raise ValueError('Original art/audio archive exceeds its bound')
        index = IndexedCam(path)
        indices.append(index)
        return index
    imports, xml = (plan['imports'], plan['xml'])
    try:
        original = indexed(mirror / 'Data/maindata.cam')
        northern = indexed(mirror / 'DataMX/mx_maindata.cam')
        target = read_cam((mirror / 'Data/Community-main.cam').read_bytes())
        sections = {x.extension: x for x in target.sections}
        images = list(sections[b'IMAG'].entries)
        tiles = list(sections[b'TILE'].entries)
        palettes = list(sections[b'SPLT'].entries)
        old_counts = (len(images), len(tiles), len(palettes))
        palette_map = {}
        tile_map = {}
        palette_hash = {hashlib.sha256(e.data).digest(): i for i, e in enumerate(palettes) if e.data}
        tile_hash = {hashlib.sha256(e.data).digest(): i for i, e in enumerate(tiles) if e.data}
        image_ids = {e.name[:4] for e in images}
        stock_count = max(original.counts[b'TILE'], northern.counts[b'TILE'])
        art_rows = []

        def stock(kind, index):
            return northern.get(kind, index) or original.get(kind, index)

        def palette(index):
            if index not in palette_map:
                e = stock(b'SPLT', index)
                if not e is not None:
                    raise ValueError('Unproven retail resource boundary')
                h = hashlib.sha256(e.data).digest()
                if h not in palette_hash:
                    palette_hash[h] = len(palettes)
                    palettes.append(CamEntry(struct.pack('<I', len(palettes)).ljust(20, b'\x00'), e.data))
                palette_map[index] = palette_hash[h]
            return palette_map[index]

        def tile(index):
            if index not in tile_map:
                e = stock(b'TILE', index)
                if not e is not None:
                    raise ValueError('Unproven retail resource boundary')
                raw = bytearray(e.data)
                ref = parse_tile_palette_reference(raw, tile_index=index)
                if ref:
                    struct.pack_into('<I', raw, 22, palette(ref.palette_index))
                raw = bytes(raw)
                h = hashlib.sha256(raw).digest()
                if h not in tile_hash:
                    if not len(tiles) < 65535:
                        raise ValueError('Unproven retail resource boundary')
                    tile_hash[h] = len(tiles)
                    tiles.append(CamEntry(struct.pack('<I', len(tiles)).ljust(20, b'\x00'), raw))
                tile_map[index] = tile_hash[h]
            return tile_map[index]
        for name in sorted(plan['images']):
            key = name.encode('ascii')
            if original.get(b'IMAG', key):
                continue
            if not key not in image_ids:
                raise ValueError('Unproven retail resource boundary')
            entry = stock(b'IMAG', key)
            if not entry is not None:
                raise ValueError(name)
            parsed = parse_stock_imag_tile_references(entry.data, tile_count=stock_count, entry_name=entry.name)
            raw = bytearray(entry.data)
            for ref in parsed.references:
                struct.pack_into('<I', raw, ref.offset, ref.flag_bits | tile(ref.tile_index))
            check = bytearray(raw)
            for ref in parsed.references:
                struct.pack_into('<I', check, ref.offset, ref.encoded_value)
            if not bytes(check) == entry.data:
                raise ValueError('Unproven retail resource boundary')
            images.append(replace(entry, data=bytes(raw)))
            image_ids.add(key)
            art_rows.append(dict(image=name, references=len(parsed.references)))
        new_sections = {b'IMAG': tuple(images), b'TILE': tuple(tiles), b'SPLT': tuple(palettes)}
        art = replace(target, sections=tuple((replace(x, entries=new_sections[x.extension]) if x.extension in new_sections else x for x in target.sections)))
        validate_external_palette_closure(next((x for x in art.sections if x.extension == b'TILE')), next((x for x in art.sections if x.extension == b'SPLT')))
        art_bytes = art.to_bytes()
        audio = read_cam((mirror / 'Data/Community-audio.cam').read_bytes())
        waves = next((x for x in audio.sections if x.extension == b'WAVE'))
        have = {e.name[:4]: e for e in waves.entries}
        base_sound = indexed(mirror / 'Data/soundfx.cam')
        north_sound = indexed(mirror / 'DataMX/mx_soundfx.cam')
        new = []
        wave_ids = set()
        for (ns, name), rows in imports.items():
            if ns != 'Sound':
                continue
            for identity, entry, kind in rows:
                for el in xml[ns, identity].findall('.//Wave'):
                    key = el.get('value').encode('ascii')
                    if not len(key) == 4:
                        raise ValueError('Unproven retail resource boundary')
                    wave_ids.add(key)
        for key in sorted(wave_ids):
            if base_sound.get(b'WAVE', key):
                continue
            source = north_sound.get(b'WAVE', key)
            if not source is not None:
                raise ValueError(key)
            if key in have:
                if not have[key].data == source.data:
                    raise ValueError('Unproven retail resource boundary')
            else:
                new.append(source)
                have[key] = source
        new_audio = replace(audio, sections=tuple((replace(x, entries=x.entries + tuple(new)) if x == waves else x for x in audio.sections)))
        audio_bytes = new_audio.to_bytes()
        return ({'Community-main.cam': art_bytes, 'Community-audio.cam': audio_bytes}, dict(newArt=art_rows, oldArtCounts=old_counts, newArtCounts=(len(images), len(tiles), len(palettes)), newWaveCount=len(new), allExistingRecordsPreserved=True, originalAnimationAndPixelPayloadsPreserved=True, sourceArchives={str(x.path): dict(bytes=len(x.map), sha256=hashlib.sha256(x.map).hexdigest()) for x in indices}))
    finally:
        for index in indices:
            index.close()

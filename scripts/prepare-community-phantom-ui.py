#!/usr/bin/env python3
"""Adapt the creator's frost glyphs to original AP78's static icon contract.

This changes presentation only. It does not edit acquired packages, compiled
GPL, native actions or hero statistics. Tooltips describe the acquired GPL.
"""
import argparse
from dataclasses import replace
import hashlib
import json
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'third_party/majesty-mod-manager/src'))
sys.path.insert(0, str(ROOT / 'scripts'))
from lib.vampiric_revenge import decode_tile

# Each row binds a real source description to an existing creator glyph.
# These compatibility descriptions are ours, derived from the original GPL;
# they are not represented as creator-authored HeroInfo declarations.
ROWS = (
    ('spell', 'WRa2', 'ice_lance', 'Ice Lance', 'PHo4', 0,
     'Launches an icy projectile that chills a living target.'),
    ('spell', 'WRa3', 'frost_armor', 'Frost Armor', 'WRa3', 6,
     'Forms protective frost armor in combat. Spent armor recharges while resting at an inn or guild.'),
    ('spell', 'WRa4', 'icy_touch', 'Icy Touch', 'PHg1', 0,
     'A close-range attack deals magical damage and inflicts Chill and Gravechill.'),
    ('spell', 'WRa5', 'endless_winter', 'Endless Winter', 'PHc3', 0,
     'Calls a winter storm around the Phantom, damaging and chilling nearby enemies.'),
    ('spell', 'WRa6', 'call_to_grave', 'Call to Grave', 'PHg1', 0,
     'Returns to the original recruiting Haunt when it remains a valid friendly destination.'),
    ('spell', 'WRa7', 'eternal_soul', 'Eternal Soul', 'PHe1', 0,
     'Temporarily increases maximum health, parry and magic resistance.'),
    ('enchantment', 'PHo4', 'ice_lance_chill_icon', 'Chilled', 'PHo4', 0,
     'Chill slows movement and actions. Further hits can refresh its duration.'),
    ('enchantment', 'PH11', 'ice_lance_empowered_chill_icon', 'Empowered Chill', 'PHc3', 0,
     'Chill strengthened by Eternal Soul slows movement and actions.'),
    ('enchantment', 'PHg1', 'gravechill_icon', 'Gravechill', 'PHg1', 0,
     'Gravechill weakens this target after an Icy Touch.'),
    ('enchantment', 'PHo2', 'frost_armor_icon', 'Frost Armor', 'WRa3', 6,
     'Protective frost armor is ready.'),
    ('enchantment', 'PHo6', 'frost_armor_spent', 'Frost Armor Spent', 'WRa3', 6,
     'The frost armor must recharge while resting at an inn or guild.'),
    ('enchantment', 'PHe1', 'eternal_soul_icon', 'Eternal Soul', 'PHe1', 0,
     'Maximum health, parry and magic resistance are temporarily increased.'),
)


def digest(path):
    if path.is_symlink() or getattr(path.stat(), 'st_flags', 0) & 0x40000000:
        raise ValueError('Require a resident ordinary source file')
    raw = path.read_bytes()
    return dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())


def static_tile(image, template, side):
    """Keep native indexed geometry, palette budget and an opaque row inset."""
    from PIL import Image, ImageOps
    if len(template) < 26 or struct.unpack_from('<H', template)[0] != 1:
        raise ValueError('Require the native static TILE-v1 template')
    bounds = image.getchannel('A').getbbox()
    if bounds is None:
        raise ValueError('Empty creator glyph')
    glyph = ImageOps.contain(image.crop(bounds), (side - 4, side - 4), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 255))
    canvas.alpha_composite(glyph, ((side - glyph.width) // 2, (side - glyph.height) // 2))
    indexed = canvas.convert('RGB').quantize(colors=247, method=Image.Quantize.MEDIANCUT)
    palette = indexed.getpalette()
    palette += [0] * (768 - len(palette))
    header = bytearray(template[:26])
    struct.pack_into('<4H', header, 0, 1, side, side, side)
    struct.pack_into('<hh', header, 10, 0, 0)
    struct.pack_into('<HI', header, 20, 1, 26 + side * side)
    colors = struct.pack('<II', 16777216, 0) + b''.join(
        bytes(palette[i:i + 3]) + b'\0' for i in range(0, 768, 3))
    return bytes(header) + indexed.tobytes() + colors


def prepare(args):
    proof_path = args.source / 'source-stage.json'
    proof = json.loads(proof_path.read_text())
    if subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=args.manager, text=True).strip() != proof['managerCommit']:
        raise ValueError('Creator manager revision differs')
    sys.path.insert(0, str(args.manager / 'src'))
    from majesty_cam.cam import read_cam, CamEntry
    from majesty_cam.art import parse_best_imag_tile_references
    from majesty_cam.hero_info import HeroInfoRow
    from majesty_cam.runtime_features import encode_runtime_feature_registry
    if args.out.exists():
        raise ValueError('Choose a fresh private output')
    media_path = args.media / 'media-stage.json'
    media_proof = json.loads(media_path.read_text())
    if media_proof['sourceStage'] != digest(proof_path) or not proof['finalResourceContext']:
        raise ValueError('Media and original source binding differ')
    package = args.source / 'phantom-source-package'
    for name, expected in proof['preparedPhantomFiles'].items():
        if digest(package / name) != expected:
            raise ValueError('Creator package changed: ' + name)
    descriptions = {}
    for name in ['phantom_actions.xml', 'phantom_overlays.xml']:
        for element in ET.fromstring((package / 'Data' / name).read_bytes()):
            descriptions[element.get('ID')] = element
    source_cam = read_cam(package / 'Data/phantom_maindata.cam')
    source_sections = {s.extension: s for s in source_cam.sections}
    source_tiles = source_sections[b'TILE'].entries
    source_images = {e.name[:4].decode('ascii'): e for e in source_sections[b'IMAG'].entries}
    interface = args.media / 'merged_interface.cam'
    if digest(interface) != media_proof['files'][interface.name]:
        raise ValueError('Original merged interface differs')
    cam = read_cam(interface)
    sections = {s.extension: s for s in cam.sections}
    tiles, images = list(sections[b'TILE'].entries), list(sections[b'IMAG'].entries)
    templates = {kind: next(e for e in images if e.name[:4] == key)
                 for kind, key in [('spell', b'BS01'), ('enchantment', b'BX01')]}
    rows, ancestry = [], []
    for n, (kind, subject, name, label, glyph_id, frame, text) in enumerate(ROWS):
        description = descriptions.get(subject)
        if description is None or description.get('Name') != name or description.get('Description') != label:
            raise ValueError('Source description differs: ' + subject)
        if kind == 'spell' and not any('IsSpell' in e.get('value', '') for e in description.findall('./Game/Flags')):
            raise ValueError('Source action is not a spell')
        image = source_images[glyph_id]
        refs = parse_best_imag_tile_references(image.data, tile_count=len(source_tiles), entry_name=image.name).references
        ref = refs[frame]
        raw = source_tiles[ref.tile_index].data
        mode, palette = struct.unpack_from('<HI', raw, 20)
        if mode == 0:
            header = bytearray(raw[:26]);struct.pack_into('<HI', header, 20, 1, len(raw))
            raw = bytes(header) + raw[26:] + source_sections[b'SPLT'].entries[palette].data
        elif mode != 1:
            raise ValueError('Unsupported creator palette')
        template = templates[kind]
        if len(template.data) != 132:
            raise ValueError('Native static row image shape changed')
        template_ref = parse_best_imag_tile_references(template.data, tile_count=len(tiles), entry_name=template.name).references
        if len(template_ref) != 1 or template_ref[0].set_id != 1019:
            raise ValueError('Native row template set differs')
        tile = static_tile(decode_tile(raw), tiles[template_ref[0].tile_index].data, 24 if kind == 'spell' else 25)
        key = 'PU' + format(n, '02X')
        if any(e.name[:4] == key.encode() for e in images):
            raise ValueError('Compatibility image identity collides')
        data = bytearray(template.data);struct.pack_into('<I', data, 128, len(tiles))
        images.append(CamEntry((key + label).encode('ascii')[:20].ljust(20, b'\0'), bytes(data)))
        tiles.append(CamEntry(('Phantom UI ' + key).encode().ljust(20, b'\0'), tile))
        rows.append(HeroInfoRow('phantom-' + name.replace('_', '-'), kind, subject, 0, label, text, key, 1019))
        ancestry.append(dict(subject=subject, glyph=glyph_id, frame=frame, tileIndex=ref.tile_index,
                             originalTileSha256=hashlib.sha256(source_tiles[ref.tile_index].data).hexdigest(), image=key))
    args.out.mkdir(parents=True)
    for name in media_proof['files']:
        shutil.copyfile(args.media / name, args.out / name)
    changed = replace(cam, sections=tuple(replace(s, entries=tuple(tiles if s.extension == b'TILE' else images))
        if s.extension in [b'TILE', b'IMAG'] else s for s in cam.sections))
    (args.out / 'merged_interface.cam').write_bytes(changed.to_bytes())
    (args.out / 'hero-info-compat.bin').write_bytes(encode_runtime_feature_registry(rows))
    media_proof['priorMediaStage'] = digest(media_path)
    media_proof['files']['merged_interface.cam'] = digest(args.out / 'merged_interface.cam')
    (args.out / 'media-stage.json').write_text(json.dumps(media_proof, indent=2) + '\n')
    base_path = args.collection / 'candidate.json'
    candidate = json.loads(base_path.read_text())
    if candidate['sourceStage'] != digest(proof_path) or candidate['mediaStage'] != digest(media_path):
        raise ValueError('Original native collection/media binding differs')
    for name, expected in candidate['files'].items():
        if digest(args.collection / 'game' / name) != expected:
            raise ValueError('Original native collection changed: ' + name)
    target = args.out / 'candidate'
    (target / 'game').mkdir(parents=True)
    shutil.copytree(args.collection / 'runtime', target / 'runtime')
    for path in (args.collection / 'game').rglob('*'):
        if not path.is_file():
            continue
        relative = path.relative_to(args.collection / 'game')
        dest = target / 'game' / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        if relative.as_posix() in ['Data/Community-interface.cam', 'DataMX/Community-interface.cam']:
            shutil.copyfile(args.out / 'merged_interface.cam', dest)
            candidate['files'][relative.as_posix()] = digest(dest)
        else:
            dest.symlink_to(path)
    candidate['priorCandidate'] = digest(base_path)
    candidate['mediaStage'] = digest(args.out / 'media-stage.json')
    candidate['browserPlayable'] = False
    candidate['originalSaveCompatibilityQualified'] = False
    (target / 'candidate.json').write_text(json.dumps(candidate, indent=2) + '\n')
    report = dict(format='majesty-phantom-ui-compat-v1', sourceStage=digest(proof_path),
        originalMediaStage=digest(media_path), mediaStage=digest(args.out / 'media-stage.json'),
        features=digest(args.out / 'hero-info-compat.bin'), sourceActionsUnchanged=True,
        candidate=digest(target / 'candidate.json'), priorCandidate=digest(base_path),
        compiledGplUnchanged=True, creatorGlyphs=ancestry, rows=len(rows),
        sourceScript=digest(Path(__file__)), browserPlayable=False, published=False)
    (args.out / 'phantom-ui-stage.json').write_text(json.dumps(report, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['source', 'manager', 'media', 'collection', 'out']:
        parser.add_argument('--' + name, type=Path, required=True)
    try:
        prepare(parser.parse_args())
    except (ValueError, KeyError, OSError) as error:
        parser.exit(1, 'Phantom presentation preparation refused: ' + str(error) + '\n')
    print('Creator glyphs adapted to native rows; gameplay unchanged, live checks required')

#!/usr/bin/env python3
"""Adapt authentic Lab identities to the audited Old AB-only construction namespace."""
import argparse
from dataclasses import replace
import hashlib
import json
from pathlib import Path
import shutil
import struct
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'third_party/majesty-mod-manager/src'))
sys.path.insert(0, str(ROOT / 'scripts'))
from majesty_cam.cam import read_cam, CamArchive
from majesty_cam.strt import parse_strt, StrtTable
from majesty_cam.stock_controller_registry import decode_stock_controller_registry, encode_stock_controller_registry
from lib.legacy_description_wire import unit_parts

# ABs1..ABs3 belong to the retired Trail Lodge. Keep their identities reserved
# even though the currently active stock catalogs no longer contain that pack.
ALIASES = {b'ALB1': b'ABx1', b'ALB2': b'ABx2', b'ALB3': b'ABx3'}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def unit(raw, original):
    parts = unit_parts(raw)
    if (len(parts) != 3 or parts[0][16:20] != original
            or struct.unpack_from('<I', parts[0], 20)[0] != 2):
        raise ValueError('Complete authored Laboratory descriptor required')
    changed = bytearray(raw)
    # The original HEAD's identity and the two SECD upgrade references are
    # the only descriptor fields adapted. PRIM (art/audio/geometry), names,
    # prices, HP, membership, income and produced Alchemist remain intact.
    head = 32
    secondary = head + len(parts[0]) + len(parts[1])
    changed[head + 16:head + 20] = ALIASES[original]
    for field in (8, 12):
        at = secondary + 16 + field
        value = bytes(changed[at:at + 4])
        if value in ALIASES:
            changed[at:at + 4] = ALIASES[value]
    updated = unit_parts(bytes(changed))
    if updated[1] != parts[1] or updated[0][20:] != parts[0][20:]:
        raise ValueError('Authored artwork/audio or naming changed')
    return bytes(changed)


def archive(original):
    sections, changed_ids = [], []
    for section in original.sections:
        entries = []
        ids = {e.name[:4] for e in section.entries}
        if section.extension == b'DUNT' and ids & set(ALIASES.values()):
            raise ValueError('Native building alias already occupied')
        for entry in section.entries:
            key, raw, name = entry.name[:4], entry.data, entry.name
            if section.extension == b'DUNT' and key in ALIASES:
                raw = unit(raw, key)
                name = ALIASES[key] + name[4:]
                changed_ids.append(key.decode('ascii'))
            elif section.extension == b'STRT' and key == b'UNTN':
                table = parse_strt(raw)
                old = {r.string_id for r in table.records}
                converted = {int.from_bytes(k, 'little'): int.from_bytes(v, 'little')
                             for k, v in ALIASES.items()}
                if old & set(converted.values()):
                    raise ValueError('Native title alias already occupied')
                raw = StrtTable(table.version, tuple(replace(r, string_id=converted.get(r.string_id, r.string_id))
                                                    for r in table.records)).to_bytes()
            elif section.extension == b'DATA' and key == b'BDEP':
                lines = raw.splitlines(keepends=True)
                for i, line in enumerate(lines):
                    if line.startswith(b'ALB1 : '):
                        lines[i] = b'ABx1' + line[4:]
                raw = b''.join(lines)
            entries.append(replace(entry, name=name, data=raw))
        sections.append(replace(section, entries=tuple(entries)))
    result = CamArchive(tuple(sections)).to_bytes()
    read_cam(result)
    return result, changed_ids


def registry(raw):
    original = decode_stock_controller_registry(raw)
    if (sum(p.building_family_id == 'ALB' for p in original.panels) != 1
            or any(p.building_family_id == 'ABx' for p in original.panels)):
        raise ValueError('Require an unoccupied native alias and one authored Laboratory owner')
    panels = tuple(replace(p, building_family_id='ABx') if p.building_family_id == 'ALB' else p
                   for p in original.panels)
    if sum(p.building_family_id == 'ABx' for p in panels) != 1:
        raise ValueError('Exactly one authentic Laboratory panel owner required')
    adapted = replace(original, panels=panels)
    encoded = encode_stock_controller_registry(adapted)
    if encoded[:8] != raw[:8] or decode_stock_controller_registry(encoded) != adapted:
        raise ValueError('Controller version or semantic round trip changed')
    return encoded


def stage(candidate, controllers, output):
    if output.exists() or output.parent.resolve() != candidate.parent.resolve():
        raise ValueError('Fresh sibling private candidate required')
    report = json.loads((candidate / 'candidate.json').read_text())
    if report.get('published') is not False or not report.get('packageVerified'):
        raise ValueError('Verified private authentic candidate required')
    game = candidate / 'game'
    changes = {}
    for group in ('Data', 'DataMX'):
        for file in (game / group).iterdir():
            if file.suffix.lower() != '.cam' or file.name.lower() not in (
                    'unittype.cam', 'mx_unittype.cam', 'alchemist-native-units.cam',
                    'textdata.cam', 'mx_textdata.cam', 'alchemist-native-interface-text.cam',
                    'miscdata.cam', 'mx_miscdata.cam'):
                continue
            raw, ids = archive(read_cam(file))
            changes[str(file.relative_to(game))] = raw, ids
    converted = registry(controllers.read_bytes())
    output.mkdir(parents=True)
    shutil.copytree(game, output / 'game', symlinks=True)
    for relative, (raw, _) in changes.items():
        path = output / 'game' / relative
        if path.is_symlink():
            path.unlink()
        path.write_bytes(raw)
    (output / 'controllers.bin').write_bytes(converted)
    report.update(game=str((output / 'game').resolve()), previousCandidate=str(candidate.resolve()),
                  nativeBuildingAliases={k.decode(): v.decode() for k, v in ALIASES.items()},
                  aliasReason='Original AP03 filter468a80..468a97 requires AB prefix',
                  canonicalArtworkNamesStatsScriptsPreserved=True,
                  nativeControllerRegistrySha256=sha(converted),
                  allCapabilitiesQualified=False, browserPlayable=False, published=False)
    (output / 'candidate.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    for name in ('candidate', 'controllers', 'out'):
        p.add_argument('--' + name, required=True, type=Path)
    args = p.parse_args()
    try:
        stage(args.candidate, args.controllers, args.out)
    except (ValueError, OSError) as error:
        p.exit(1, f'Native identity adaptation refused: {error}\n')
    print('Actual Laboratory adapted to unused native construction identities; no stock actor substituted')

#!/usr/bin/env python3
"""Merge the authentic Lab prerequisite into private native tables, preserving stock rows."""
import argparse
from dataclasses import replace
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'third_party/majesty-mod-manager/src'))
from majesty_cam.cam import read_cam, CamArchive
from majesty_cam.strt import parse_strt, StrtTable
sys.path.insert(0, str(ROOT / 'scripts'))
from lib.legacy_description_wire import resource_name

RESOURCE_FILES = ('Alchemist-native-interface-text.cam', 'alchemist_maindata.cam',
                  'alchemist_interfacedata.cam', 'alchemist_audio.cam',
                  'alchemist_sounddesc.cam', 'Alchemist-native-units.cam',
                  'Alchemist-native-actions.cam')
LOAD_GROUPS = ('MajestyCommonData', 'MajXCommonData', 'Rel0', 'Relp', 'Rel2', 'Rel3')
AUTHORED_POTION_ACTIONS = {b'A020': 'Speed_Tonic', b'A021': 'Strength_Potion',
                          b'A022': 'Shapeshift_Potion', b'A023': 'Regeneration_Elixer',
                          b'A024': 'Invisibility_Brew', b'A025': 'Fire_Balm'}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def dependency(archive):
    entries = [e for s in archive.sections if s.extension == b'DATA'
               for e in s.entries if e.name[:4] == b'BDEP']
    if len(entries) != 1:
        raise ValueError('Exactly one native BDEP table required')
    return entries[0]


def authored_rule(raw):
    rules = [line for line in raw.splitlines() if re.match(rb'\s*ALB1\s*:', line)]
    if rules != [b'ALB1 : ABJ2 ABJ3 NOT NOT ||']:
        raise ValueError('Require the acquired Palace-level-2 Alchemist rule')
    return rules[0]


def merge(archive, rule):
    authored_rule(rule)
    original = dependency(archive)
    if any(re.match(rb'\s*ALB1\s*:', line) for line in original.data.splitlines()):
        raise ValueError('Preserve an occupied native dependency key')
    # Native BDEP explicitly requires a blank final line. Preserve every stock
    # byte and add the acquired expression, rather than a newer full stock table.
    raw = original.data + b'\r\n' + rule + b'\r\n\r\n'
    result = CamArchive(tuple(replace(section, entries=tuple(
        replace(entry, data=raw) if section.extension == b'DATA' and entry == original
        else entry for entry in section.entries)) for section in archive.sections))
    encoded = result.to_bytes()
    restored = read_cam(encoded)
    for old_section, new_section in zip(archive.sections, restored.sections):
        if old_section.extension != new_section.extension:
            raise ValueError('Native section identity changed')
        for old, new in zip(old_section.entries, new_section.entries):
            if old.name != new.name or (old != original and old.data != new.data):
                raise ValueError('Unrelated native resource changed')
    if dependency(restored).data != raw:
        raise ValueError('Native dependency round trip differs')
    return encoded, dict(stockSha256=sha(original.data), mergedSha256=sha(raw),
                         stockBytes=len(original.data), stockBytesPreserved=True,
                         authoredRule=rule.decode('ascii'), finalBlankLine=True)


def load_groups(raw, required=LOAD_GROUPS):
    if b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper():
        raise ValueError('Native load groups may not declare entities')
    root = ET.fromstring(raw)
    proof = {}
    for name in required:
        groups = root.findall('./DataGroups/LoadData/' + name)
        if len(groups) != 1:
            raise ValueError('Require one native classification group: ' + name)
        group = groups[0]
        original = [ET.tostring(child) for child in group]
        added = []
        for resource in RESOURCE_FILES:
            entries = [child for child in group if child.tag == 'LoadCAM' and child.text == resource]
            if len(entries) > 1:
                raise ValueError('Duplicate native resource in classification: ' + name)
            if not entries:
                ET.SubElement(group, 'LoadCAM').text = resource
                added.append(resource)
        if [ET.tostring(child) for child in list(group)[:len(original)]] != original:
            raise ValueError('Existing native load order changed')
        proof[name] = dict(added=added, existingLoadOrderPreserved=True)
    return ET.tostring(root, encoding='utf-8'), proof


def merge_load_groups(archive, required=LOAD_GROUPS):
    entries = [e for s in archive.sections if s.extension == b'DATA'
               for e in s.entries if e.name[:4] == b'XML1']
    if len(entries) != 1:
        raise ValueError('Exactly one native XML1 load-group resource required')
    original = entries[0]
    raw, proof = load_groups(original.data, required)
    result = CamArchive(tuple(replace(section, entries=tuple(
        replace(entry, data=raw) if section.extension == b'DATA' and entry == original
        else entry for entry in section.entries)) for section in archive.sections))
    encoded = result.to_bytes()
    restored = read_cam(encoded)
    for before, after in zip(archive.sections, restored.sections):
        for old, new in zip(before.entries, after.entries):
            if old.name != new.name or (old != original and old.data != new.data):
                raise ValueError('Unrelated resource changed during load-group merge')
    return encoded, proof


def merge_catalog(stock, private, kind, allowed_overrides=None):
    originals = [s for s in stock.sections if s.extension == kind]
    additions = [s for s in private.sections if s.extension == kind]
    if len(originals) != 1 or len(additions) != 1:
        raise ValueError('Require one original and one authored native catalog')
    original, addition = originals[0], additions[0]
    old_ids = {e.name[:4] for e in original.entries}
    new_ids = {e.name[:4] for e in addition.entries}
    occupied = old_ids & new_ids
    allowed = allowed_overrides or {}
    if len(new_ids) != len(addition.entries) or occupied - set(allowed):
        raise ValueError('Preserve occupied native description identities')
    replacements = {e.name[:4]: e for e in addition.entries if e.name[:4] in occupied}
    for old in original.entries:
        key = old.name[:4]
        if key in replacements:
            if kind != b'DACT' or resource_name(old.data, kind) != (
                    key.decode('ascii'), allowed[key]) or resource_name(replacements[key].data, kind) != (
                    key.decode('ascii'), allowed[key]):
                raise ValueError('Authored potion override/name binding differs')
    entries = tuple(replacements.get(e.name[:4], e) for e in original.entries)
    entries += tuple(e for e in addition.entries if e.name[:4] not in occupied)
    result = CamArchive(tuple(replace(s, entries=entries)
                              if s == original else s for s in stock.sections))
    encoded = result.to_bytes()
    restored = next(s for s in read_cam(encoded).sections if s.extension == kind)
    if [(e.name, e.data) for e in restored.entries[:len(original.entries)] if e.name[:4] not in occupied] != [
            (e.name, e.data) for e in original.entries if e.name[:4] not in occupied]:
        raise ValueError('Original native description payload changed')
    return encoded, dict(stockCount=len(original.entries), addedCount=len(new_ids - occupied),
                         stockPayloadsPreserved=not occupied, unrelatedStockPayloadsPreserved=True,
                         authoredOverrideIds=sorted(k.decode('ascii') for k in occupied),
                         authoredIds=sorted(k.decode('ascii') for k in new_ids))


def merge_text(stock, overlay):
    tables = {e.name[:4]: parse_strt(e.data) for s in overlay.sections
              if s.extension == b'STRT' for e in s.entries
              if e.name[:4] in (b'UNTN', b'HPTX', b'AITX', b'QITM')}
    proof = {}
    sections = []
    for section in stock.sections:
        entries = []
        for entry in section.entries:
            if section.extension != b'STRT' or entry.name[:4] not in tables:
                entries.append(entry)
                continue
            original, authored = parse_strt(entry.data), tables[entry.name[:4]]
            if original.version != authored.version:
                raise ValueError('Native text table versions differ')
            ids = {r.string_id for r in original.records}
            added = tuple(r for r in authored.records if r.string_id not in ids)
            merged = StrtTable(original.version, original.records + added)
            raw = merged.to_bytes()
            if parse_strt(raw).records[:len(original.records)] != original.records:
                raise ValueError('Stock semantic text rows changed')
            entries.append(replace(entry, data=raw))
            proof[entry.name[:4].decode('ascii')] = dict(stockRows=len(original.records),
                                                       addedRows=len(added), stockRowsPreserved=True)
        sections.append(replace(section, entries=tuple(entries)))
    return CamArchive(tuple(sections)).to_bytes(), proof


def stage(candidate, package, output):
    if (output.exists() or output.resolve().is_relative_to(candidate.resolve())
            or output.parent.resolve() != candidate.parent.resolve()):
        raise ValueError('Choose a fresh sibling candidate; preserve the existing collection')
    report = json.loads((candidate / 'candidate.json').read_text())
    if not report.get('packageVerified') or report.get('published') is not False:
        raise ValueError('Require the private verified authentic candidate')
    contract = json.loads((ROOT / 'content/community-mods/alchemist/source-contract.json').read_text())
    relative = 'Data/alchemist_miscdata.cam'
    file = package / relative
    if file.is_symlink() or not file.is_file():
        raise ValueError('Regular acquired prerequisite source required')
    raw = file.read_bytes()
    expected = contract['workshopPackageFiles'][relative]
    if len(raw) != expected['bytes'] or sha(raw) != expected['sha256']:
        raise ValueError('Acquired prerequisite source binding differs')
    rule = authored_rule(dependency(read_cam(raw)).data)
    game = candidate / 'game'
    exe = (game / 'MajestyHD - Old.exe').read_bytes()
    if sha(exe) != contract['guestExecutableSha256']:
        raise ValueError('Pinned original guest differs')
    changes = {}
    for name in ('Data/miscdata.cam', 'DataMX/mx_miscdata.cam'):
        path = game / name
        if path.is_symlink():
            raise ValueError('Require owned native prerequisite tables')
        raw, detail = merge(read_cam(path), rule)
        required = ('MajestyCommonData', 'Rel0', 'Rel2') if name.startswith('Data/') else LOAD_GROUPS
        raw, group_proof = merge_load_groups(read_cam(raw), required)
        detail['loadGroups'] = group_proof
        changes[name] = raw, detail
    for group in ('Data', 'DataMX'):
        for resource in RESOURCE_FILES:
            if not (game / group / resource).is_file():
                raise ValueError('Native classification resource missing: ' + group + '/' + resource)
    catalog_proof, text_proof = {}, {}
    for group, prefix in (('Data', ''), ('DataMX', 'mx_')):
        directory = game / group
        for kind, filename, private_name in (
                (b'DUNT', prefix + 'unittype.cam', 'Alchemist-native-units.cam'),
                (b'DACT', prefix + 'action.cam', 'Alchemist-native-actions.cam')):
            paths = [p for p in directory.iterdir() if p.name.casefold() == filename.casefold()]
            if len(paths) != 1:
                raise ValueError('Native catalog filename missing or ambiguous')
            name = str(paths[0].relative_to(game))
            raw, detail = merge_catalog(read_cam(paths[0]), read_cam(directory / private_name), kind,
                                        AUTHORED_POTION_ACTIONS if kind == b'DACT' else None)
            changes[name] = raw, detail
            catalog_proof[name] = detail
        overlay = read_cam(directory / 'Alchemist-native-interface-text.cam')
        for filename in (prefix + 'textdata.cam', prefix + 'gpltext.cam'):
            paths = [p for p in directory.iterdir() if p.name.casefold() == filename.casefold()]
            if len(paths) != 1:
                raise ValueError('Native text filename missing or ambiguous')
            name = str(paths[0].relative_to(game))
            raw, detail = merge_text(read_cam(paths[0]), overlay)
            changes[name] = raw, detail
            text_proof[name] = detail
    # All validation precedes copying; the previous candidate and player data
    # are never modified. Other purchased/media links retain their identity.
    output.mkdir(parents=True)
    shutil.copytree(game, output / 'game', symlinks=True)
    for name, (raw, _) in changes.items():
        path = output / 'game' / name
        # Purchased stock catalogs are linked in the input. Replace only the
        # new candidate's link before writing; never follow it into originals.
        if path.is_symlink():
            path.unlink()
        path.write_bytes(raw)
    report.update(game=str((output / 'game').resolve()), previousCandidate=str(candidate.resolve()),
                  nativeDependencyMerge={name: detail for name, (_, detail) in changes.items()
                                         if name.endswith('miscdata.cam')},
                  nativeCatalogMerge=catalog_proof, nativeTextMerge=text_proof,
                  dependencySourceSha256=expected['sha256'], browserPlayable=False,
                  allCapabilitiesQualified=False, published=False)
    (output / 'candidate.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('candidate', 'package', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    try:
        stage(args.candidate, args.package, args.out)
    except (OSError, ValueError, KeyError) as error:
        parser.exit(1, f'Native dependency merge refused: {error}\n')
    print('Authored Laboratory dependency merged privately; gameplay remains unqualified')

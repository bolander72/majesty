#!/usr/bin/env python3
"""Stage source-bound native guild catalogs/text/prerequisites; never activate them."""
import argparse
from dataclasses import replace
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'third_party/majesty-mod-manager/src'))
sys.path.insert(0, str(ROOT / 'scripts'))
from majesty_cam.cam import CamArchive, read_cam
from majesty_cam.strt import parse_strt
from lib.community_native_tables import (PHANTOM_NAMES, merge_catalog, merge_dependencies,
    merge_strings, name_binding, native_titles, phantom_name_descriptor, unique,
    TROUBADOUR_SOUND, troubadour_sound_descriptor, troubadour_sound_unit)


def digest(raw):
    return dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())


def resident(path, expected=None):
    if not path.is_file() or getattr(path.stat(), 'st_flags', 0) & 0x40000000:
        raise ValueError('Require a resident native table input: ' + str(path))
    raw = path.read_bytes()
    if expected is not None and digest(raw) != expected:
        raise ValueError('Native table binding changed: ' + str(path))
    return raw


def prepare(args):
    if args.out.exists() or args.out.is_symlink():
        raise ValueError('Preserve earlier collections; choose a fresh output')
    release_raw = resident(ROOT / 'deploy/alchemist-release.json')
    release = json.loads(release_raw)
    demo_raw = resident(ROOT / 'deploy/vampiric-revenge-release.json')
    demo = json.loads(demo_raw)
    if demo.get('storageId') != 'majesty-alchemist-demo-v1' or demo.get('nativeId') != 'XQD3':
        raise ValueError('Require the current qualified demo collection')
    # Start with the effective deployed collection, including its demo overlay.
    # Merging against the earlier Lab alone would silently lose XQD3's XML
    # load entries when the complete miscdata.cam is installed later.
    effective = {item['path'].casefold(): item for item in release['patches']}
    effective.update({item['path'].casefold(): item for item in demo['patches']})
    baseline = {}
    for key, item in effective.items():
        if Path(item['path']).is_absolute() or '..' in Path(item['path']).parts:
            raise ValueError('Unsafe release path')
        expected = {k: item[k] for k in ['bytes', 'sha256']}
        for folder in [args.demo, args.game]:
            path = folder / item['path']
            if path.is_file() and not getattr(path.stat(), 'st_flags', 0) & 0x40000000:
                if digest(resident(path)) == expected:
                    baseline[key] = path
                    break
        if key not in baseline:
            raise ValueError('Missing qualified collection input: ' + item['path'])

    def input_file(name):
        return baseline.get(name.casefold(), args.game / name)
    source_raw = resident(args.source / 'source-stage.json')
    source = json.loads(source_raw)
    native_raw = resident(args.native / 'native-resource-stage.json')
    native = json.loads(native_raw)
    if (not source.get('finalResourceContext') or
            native['finalResourceContext']['sourceStage'] != digest(source_raw)):
        raise ValueError('Native descriptions differ from final source context')
    overlays = {}
    for name, expected in native['files'].items():
        if Path(name).name != name:
            raise ValueError('Unsafe native resource path')
        raw = resident(args.native / name, expected)
        if name.endswith('.cam'):
            archive = read_cam(raw)
            if name == 'phantoms-haunt-native-unittype.cam':
                archive = CamArchive(tuple(replace(s, entries=tuple(replace(e,
                    data=phantom_name_descriptor(e.data)) if e.name[:4] == b'AVp1'
                    else e for e in s.entries)) for s in archive.sections))
            if name == 'bards-hall-native-unittype.cam':
                archive = CamArchive(tuple(replace(s, entries=tuple(replace(e,
                    data=troubadour_sound_unit(e.data)) if e.name[:4] == b'AVv1'
                    else e for e in s.entries)) for s in archive.sections))
            if name == 'bards-hall-native-sounddesc.cam':
                archive = CamArchive(tuple(replace(s, entries=tuple(replace(e,
                    name=TROUBADOUR_SOUND + e.name[4:],
                    data=troubadour_sound_descriptor(e.data)) if e.name[:4] == b'BT01'
                    else e for e in s.entries)) for s in archive.sections))
            overlays[name] = archive
    titles = json.loads(resident(args.native / 'native-title-bindings.json',
        native['files']['native-title-bindings.json']))
    prepared = {}
    for name in ['merged_textdata.cam', 'merged_gpltext.cam', 'merged_miscdata.cam']:
        prepared[name] = read_cam(resident(args.source / 'resources' / name,
                                         source['resourceFiles'][name]))
    # Expansion text archives are deltas; UNTN still comes from base data.
    base_titles = next(parse_strt(e.data) for s in read_cam(resident(
        input_file('Data/textdata.cam'))).sections if s.extension == b'STRT'
        for e in s.entries if e.name[:4] == b'UNTN')
    changes, proof = {}, {}
    for directory, prefix in [('Data', ''), ('DataMX', 'mx_')]:
        def read(name):
            matches = [p for p in (args.game / directory).iterdir() if p.name.casefold() == name.casefold()]
            if len(matches) != 1:
                raise ValueError('Missing or ambiguous native table: ' + name)
            return matches[0].name, read_cam(resident(input_file(directory + '/' + matches[0].name)))
        owned_units = read_cam(resident(args.game / directory / 'Alchemist-native-units.cam'))
        owned_actions = read_cam(resident(args.game / directory / 'Alchemist-native-actions.cam'))
        owned_sounds = read_cam(resident(args.game / directory / 'alchemist_sounddesc.cam'))
        for kind, filename, suffix, owned in [
                (b'DUNT', 'unittype.cam', '-unittype.cam', owned_units),
                (b'DACT', 'action.cam', '-action.cam', owned_actions),
                (b'DSND', 'sounddesc.cam', '-sounddesc.cam', owned_sounds)]:
            name, stock = read(prefix + filename)
            allowed = {e.name[:4] for s in owned.sections if s.extension == kind for e in s.entries}
            if kind == b'DACT':
                allowed.update(b'A0' + str(i).encode() for i in range(20, 26))
                # Phantom ships the stock meteor_storm descriptor. The final
                # creator composition wraps its original cast/validation with
                # Countermelody suppression; its name must still match.
                allowed.add(b'WRg1')
            result, detail = merge_catalog(stock, [v for k, v in overlays.items() if k.endswith(suffix)], kind, allowed)
            changes[directory + '/' + name] = result.to_bytes()
            proof[directory + '/' + name] = detail
        for filename, composed in [('textdata.cam', 'merged_textdata.cam'), ('gpltext.cam', 'merged_gpltext.cam')]:
            name, stock = read(prefix + filename)
            old = unique(((s.extension, e.name[:4], e) for s in stock.sections for e in s.entries), lambda row: row[:2])
            rows = []
            for section in prepared[composed].sections:
                entries = []
                for entry in section.entries:
                    key = entry.name[:4]
                    if section.extension == b'STRT':
                        target = PHANTOM_NAMES.get(key, key)
                        table = parse_strt(entry.data)
                        previous = old.get((b'STRT', target))
                        if key == b'UNTN':
                            table = native_titles(table, titles,
                                parse_strt(previous[2].data) if previous else base_titles)
                        if previous:
                            # The acquired Phantom mod explicitly documents its
                            # undead interactions in these five stock hero cards.
                            allowed = {int.from_bytes(k, 'little') for k in
                                [b'h011', b'h013', b'h018', b'h021', b'h022']} if target == b'HPTX' else ()
                            table = merge_strings(parse_strt(previous[2].data), table,
                                                  target == b'QITM', allowed)
                        entries.append(replace(entry, name=target + entry.name[4:], data=table.to_bytes()))
                    else:
                        entries.append(entry)
                rows.append(replace(section, entries=tuple(entries)))
            # Overlay tables contain complete merged STRT payloads. Stock-only
            # sections stay in the original CAM and are never overwritten here.
            changes[directory + '/Community-' + filename] = CamArchive(tuple(rows)).to_bytes()
        name, stock = read(prefix + 'miscdata.cam')
        authored = next(e.data for s in prepared['merged_miscdata.cam'].sections for e in s.entries
                        if s.extension == b'DATA' and e.name[:4] == b'BDEP')
        count = 0
        sections = []
        for section in stock.sections:
            entries = []
            for entry in section.entries:
                if section.extension == b'DATA' and entry.name[:4] == b'BDEP':
                    count += 1
                    entry = replace(entry, data=merge_dependencies(entry.data, authored,
                        {'ALB1': 'ABx1', 'BDG1': 'ABt1', 'PHG1': 'ABu1'}))
                entries.append(entry)
            sections.append(replace(section, entries=tuple(entries)))
        if count != 1:
            raise ValueError('Require one native prerequisite table')
        changes[directory + '/' + name] = CamArchive(tuple(sections)).to_bytes()
    changes['community-name-bindings.bin'] = name_binding()
    args.out.mkdir(parents=True)
    for name, raw in changes.items():
        target = args.out / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
    result = dict(format='majesty-community-native-tables-stage-v1',
        baseRelease=digest(release_raw), baseDemoRelease=digest(demo_raw),
        verifiedEffectiveBaseFiles=len(baseline), sourceStage=digest(source_raw), nativeStage=digest(native_raw),
        files={k:digest(v) for k,v in changes.items()}, catalogs=proof,
        phantomNames=dict(sourceGenerator='NM11', nativeGenerator='NMPH',
            sourceTables=['HN41', 'HN42'], nativeTables=['HNP0', 'HNP1'],
            retainedStockTables=['HN43', 'HN44'], stockNamesUnchanged=True),
        troubadourSound=dict(source='BT01', native='BTV1', stockFervisTempleSoundPreserved=True,
            waveformsAndPhaseParametersUnchanged=True),
        preservesAlchemyLevelLabels=True, prerequisitesMerged=True,
        authoredStockHelpOverrides=['h011', 'h013', 'h018', 'h021', 'h022'],
        originalLoadGroupsUnchanged=True, needsLoadGroupActivation=True,
        existingDemoLoadGroupsPreserved=True,
        needsNameRuntimeBinding=True, needsNativeControllerAudit=['CGPH', 'AP78'],
        guildGameplayQualified=False, browserPlayable=False, published=False)
    (args.out / 'native-tables-stage.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['game', 'demo', 'source', 'native', 'out']:
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    try:
        result = prepare(args)
    except (OSError, ValueError, KeyError, StopIteration) as error:
        parser.exit(1, f'Native guild table preparation refused: {error}\n')
    print(json.dumps(dict(files=len(result['files']), guildGameplayQualified=False, published=False)))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Assemble private expansion patches against the exact deployed collection."""
import argparse
from dataclasses import replace
import importlib.util
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'scripts'), str(ROOT / 'third_party/majesty-mod-manager/src')]
from lib.community_guild_composition import digest
from lib.community_expansion_media import append_art, append_waves
from lib.community_native_tables import merge_catalog, merge_dependencies, merge_strings
from lib.legacy_description_wire import cam_payloads, encode_description_cam
from lib.legacy_description_sound import sound_parts
from majesty_cam.cam import read_cam, CamArchive
from majesty_cam.strt import parse_strt, StrtRecord

PANELS = {b'CGAG', b'CGAQ', b'CGZM', b'CGZC', b'CGZT'}
MAIN_IMAGES = {b'AGB1', b'AGE0', b'ZCA2', b'ABn1', b'ABn2', b'ABn3'}
INTERFACE_IMAGES = {b'AGTI', b'AGBG', b'AGBA', b'IX92', b'IX94', b'ZOTI',
                    b'ZOBG', b'ZCIC', b'ZCBB', b'ZTBB', b'CUR1'}


def read(path, expected=None):
    if (not path.is_file() or getattr(path.stat(), 'st_flags', 0) & 0x40000000
            or path.stat().st_size > 64 * 1024 * 1024):
        raise ValueError('Unavailable bounded resource: ' + path.name)
    raw = path.read_bytes()
    if expected is not None and digest(raw) != expected:
        raise ValueError('Resource binding changed: ' + path.name)
    return raw


def table(archive, key):
    rows = [entry for section in archive.sections if section.extension == b'STRT'
            for entry in section.entries if entry.name[:4] == key]
    if len(rows) != 1:
        raise ValueError('Require one native string table: ' + repr(key))
    return parse_strt(rows[0].data)


def update_table(archive, key, additions, allowed=()):
    existing = table(archive, key)
    overlay = replace(existing, records=tuple(StrtRecord(identity, text)
                                              for identity, text in additions.items()))
    updated = merge_strings(existing, overlay, allowed_overrides=allowed)
    return replace(archive, sections=tuple(replace(section, entries=tuple(
        replace(entry, data=updated.to_bytes()) if entry.name[:4] == key else entry
        for entry in section.entries)) if section.extension == b'STRT' else section
        for section in archive.sections))


def prepare(args):
    if args.out.exists() or args.out.is_symlink():
        raise ValueError('Preserve previous private patch sets')
    source_raw = read(args.source / 'source-stage.json')
    source = json.loads(source_raw)
    creator_raw = read(args.creator / 'source-stage.json')
    creator = json.loads(creator_raw)
    native_raw = read(args.native / 'native-resource-stage.json')
    native = json.loads(native_raw)
    media_raw = read(args.media / 'media-stage.json')
    media = json.loads(media_raw)
    compiler_raw = read(args.compiled / 'compiler-proof.json')
    compiler = json.loads(compiler_raw)
    if (not source.get('communityExpansions', {}).get('moreHeroesQuestParticipation')
            or native['sourceStage'] != digest(source_raw) or native['pending']
            or native['creatorStage'] != digest(creator_raw)
            or media['sourceStage'] != digest(creator_raw)
            or not media.get('expansionMedia') or compiler['sourceStage'] != digest(source_raw)
            or compiler['compiled'] is not True):
        raise ValueError('Require one complete source/native/media/compiler selection')
    for name, expected in source['files'].items():
        read(args.source / 'sources' / name, expected)
    native_files = {name: read(args.native / name, expected) for name, expected in native['files'].items()}
    media_files = {name: read(args.media / name, expected) for name, expected in media['files'].items()}
    release_raw = read(ROOT / 'deploy/community-guilds-release.json')
    release = json.loads(release_raw)
    expected = {row['path']: {key: row[key] for key in ('bytes', 'sha256')} for row in release['patches']}
    inputs = {}
    def current(name):
        if name in expected:
            raw = read(args.current / name, expected[name])
        else:
            raw = read(args.fixture / name, source['stockFixture']['camArchives'][name])
        inputs[name] = digest(raw)
        return raw
    outputs, catalogs = {}, {}
    for name, kind, overlay, allowed in [
            ('Data/unittype.cam', b'DUNT', 'Any-unittype.cam', ()),
            ('DataMX/mx_unittype.cam', b'DUNT', 'MajestyExpansion-unittype.cam', (b'ABr1',)),
            ('DataMX/mx_action.cam', b'DACT', 'MajestyExpansion-action.cam', (b'NRj1',))]:
        archive, catalogs[name] = merge_catalog(read_cam(current(name)),
            [read_cam(native_files[overlay])], kind, allowed)
        outputs[name] = archive.to_bytes()
    # Preserve all current voice corrections. Add only the new guild's native
    # sound descriptor; its original WAVE is appended without transcoding.
    sound = cam_payloads(media_files['merged_sounddesc.cam'])[b'DSND', b'AGS1']
    sound_parts(sound)
    archive, catalogs['Data/sounddesc.cam'] = merge_catalog(read_cam(current('Data/sounddesc.cam')),
        [read_cam(encode_description_cam({'AGS1': sound}, b'DSND'))], b'DSND')
    outputs['Data/sounddesc.cam'] = archive.to_bytes()
    art = {}
    for target, authored, images in [('main', 'merged_main.cam', MAIN_IMAGES),
                                     ('interface', 'merged_interface.cam', INTERFACE_IMAGES)]:
        archive, art[target] = append_art(read_cam(current('Data/Community-' + target + '.cam')),
            read_cam(media_files[authored]), images, extend_cursor=target == 'interface')
        raw = archive.to_bytes()
        for folder in ('Data', 'DataMX'):
            outputs[folder + '/Community-' + target + '.cam'] = raw
    archive = append_waves(read_cam(current('Data/Community-audio.cam')),
                           read_cam(media_files['merged_audio.cam']), {b'AGW1'})
    for folder in ('Data', 'DataMX'):
        outputs[folder + '/Community-audio.cam'] = archive.to_bytes()
    def prepared(name):
        return read_cam(read(args.creator / 'resources' / name, creator['resourceFiles'][name]))
    text = prepared('merged_textdata.cam')
    panel_overlay = replace(text, sections=tuple(replace(section,
        entries=tuple(entry for entry in section.entries if entry.name[:4] in PANELS))
        for section in text.sections))
    seen_panels = {(section.extension, entry.name[:4]) for section in panel_overlay.sections
                   for entry in section.entries}
    if not all((kind, key) in seen_panels for key in PANELS for kind in (b'STRT', b'SMNU')):
        raise ValueError('Missing native panel text/widget resources')
    spec = importlib.util.spec_from_file_location('expansion_archive_merge',
        ROOT / 'scripts/prepare-community-native-candidate.py')
    merge = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(merge)
    titles = json.loads(native_files['native-title-bindings.json'])
    helps = json.loads(native_files['help-text-bindings.json'])
    extra_help = {row.string_id: row.text for row in table(prepared('merged_gpltext.cam'), b'HPTX').records}
    new_help = {int.from_bytes(key.encode('ascii'), 'little'): value['nativeText'].encode('cp1252')
                for key, value in helps.items()}
    if any(key in extra_help for key in new_help):
        raise ValueError('Standard help alias collides with composed help')
    from majesty_cam.descriptions import parse_descriptions
    # Source-bound actor names already include all Unit records; actions keep
    # the acquired spelling and display label under their native aliases.
    action_names = {}
    contract = json.loads((ROOT / 'content/community-expansions/more-heroes/source-contract.json').read_text())
    action_file = 'Data/MoreHeroes_Actions.xml'
    action_xml = read(args.more_heroes_package / action_file, contract['packageFiles'][action_file])
    for record in parse_descriptions(action_xml).records:
        element = record.to_element()
        alias = native['resourceAliases']['Action'][record.description_id]
        action_names[int.from_bytes(alias.encode('ascii'), 'little')] = element.get('Description', element.get('Name')).encode('cp1252')
    for folder, prefix in [('Data', ''), ('DataMX', 'mx_')]:
        names = {int.from_bytes(key.encode('ascii'), 'little'): value['display'].encode('cp1252')
                 for key, value in titles.items() if value['dataset'] == 'Any' or folder == 'DataMX'}
        for filename in ('textdata.cam', 'Community-textdata.cam'):
            name = folder + '/' + (prefix + filename if filename == 'textdata.cam' else filename)
            archive = merge.merge_archive(read_cam(current(name)), panel_overlay)
            archive = update_table(archive, b'UNTN', names, (int.from_bytes(b'ABr1', 'little'),))
            if folder == 'DataMX':
                archive = update_table(archive, b'ACTN', action_names, (int.from_bytes(b'NRj1', 'little'),))
            outputs[name] = archive.to_bytes()
        for filename in ('gpltext.cam', 'Community-gpltext.cam'):
            name = folder + '/' + (prefix + filename if filename == 'gpltext.cam' else filename)
            archive = update_table(read_cam(current(name)), b'HPTX', extra_help)
            if folder == 'DataMX':
                archive = update_table(archive, b'HPTX', new_help)
            outputs[name] = archive.to_bytes()
        name = folder + '/' + prefix + 'miscdata.cam'
        archive = read_cam(current(name))
        dependencies = next(entry.data for section in prepared('merged_miscdata.cam').sections
            if section.extension == b'DATA' for entry in section.entries if entry.name[:4] == b'BDEP')
        archive = replace(archive, sections=tuple(replace(section, entries=tuple(replace(entry,
            data=merge_dependencies(entry.data, dependencies, {'AGB1': 'ABv1', 'ZOO1': 'ABw1'}))
            if entry.name[:4] == b'BDEP' else entry for entry in section.entries))
            if section.extension == b'DATA' else section for section in archive.sections))
        outputs[name] = archive.to_bytes()
        for slug, label in [('common', 'Common'), ('base', 'Base'), ('expansion', 'Expansion')]:
            record = compiler['outputs'][slug]
            outputs[folder + '/Community_' + label + '.bcd'] = read(args.compiled / (slug + '.bcd'),
                {key: record[key] for key in ('bytes', 'sha256')})
    args.out.mkdir()
    for name, raw in outputs.items():
        target = args.out / 'game' / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
    proof = dict(format='majesty-community-expansion-native-patches-v1',
        sourceStage=digest(source_raw), creatorStage=digest(creator_raw), nativeStage=digest(native_raw),
        mediaStage=digest(media_raw), compilerProof=digest(compiler_raw), priorRelease=digest(release_raw),
        policy=digest(Path(__file__).read_bytes()), sourceInputs=inputs, catalogs=catalogs, art=art,
        mediaPolicy=digest((ROOT / 'scripts/lib/community_expansion_media.py').read_bytes()),
        artCodec=digest((ROOT / 'third_party/majesty-mod-manager/src/majesty_cam/art.py').read_bytes()),
        existingPhantomUiAndCampaignArtPreserved=True, moreHeroesResourcesExpansionOnly=True,
        files={name: digest(raw) for name, raw in outputs.items()},
        nativeGameplayQualified=False, controllerLifecyclesQualified=False,
        saveReloadQualified=False, browserPlayable=False, published=False)
    (args.out / 'native-patches-stage.json').write_text(json.dumps(proof, indent=2) + '\n')
    return dict(files=len(outputs), art=art, browserPlayable=False, published=False)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('source', 'creator', 'native', 'media', 'compiled', 'current', 'fixture',
                 'more-heroes-package', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    print(json.dumps(prepare(parser.parse_args())))

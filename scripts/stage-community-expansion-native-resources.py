#!/usr/bin/env python3
"""Encode acquired expansion descriptors privately, preserving native identities."""
import argparse
import copy
import importlib.util
import json
import mmap
from pathlib import Path
import re
import struct
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'scripts'), str(ROOT / 'third_party/majesty-mod-manager/src')]
from lib.community_guild_composition import digest
from lib.legacy_description_wire import cam_payloads, encode_description_cam
from lib.legacy_description_engine import descriptor
from lib.legacy_description_game import encode_character, encode_building, encode_overlay
from lib.legacy_description_action import action_descriptor
from majesty_cam.descriptions import parse_descriptions
from lib.community_follower_markers import validate as validate_follower_markers

# IDs are separate from the creator's artwork IDs and GPL titles. These slots
# were checked against both retail editions and the complete current collection.
# Keep retired AVz1/ABs* and every installed guild identity reserved.
ACTORS = {
    'AGB1': 'ABv1', 'ZOO1': 'ABw1', 'ZOO2': 'ABw2', 'ZOO3': 'ABw3',
    'necrERV3': 'AV01', 'fiwiERV3': 'AV11', 'dapaERV3': 'AV21',
    'MHcuhe1': 'AV31', 'MHwimo1': 'AV41', 'liloER': 'AV51', 'dragER': 'AV61',
    'mhassassin1': 'AV71', 'mhfallenangel1': 'AV81', 'mhminstrel1': 'AV91',
    'mhshapeshifter1': 'AVP1', 'erv5_mystic': 'AVQ1', 'mh_timewalker1': 'AVR1',
    'ERV4Portal1': 'AVS1',
    'neabERV3': 'AB01', 'teflERV3': 'AB11', 'dapado1': 'AB21',
    'MHtemoag1': 'AB31', 'MHwimoga1': 'AB41', 'liloshMH': 'AB51',
    'drsaMH': 'AB61', 'MHcebuilding': 'AB71', 'mhspiritshrine1': 'AB81',
    'mhangelicgateway1': 'AB91', 'mhassassinhideout1': 'ABI1',
    'mhtavern1': 'ABK1', 'mhlabyrinth1': 'ABZ1',
    'erv5_mystic_keep': 'ABi1', 'mh_time_sphere1': 'ABy1',
}
RESERVED = {'AVz1', 'ABs1', 'ABs2', 'ABs3', 'ALC1', 'ABx1', 'ABx2', 'ABx3',
            'AVp1', 'AVt1', 'AVu1', 'AVv1', 'ABt1', 'ABt2', 'ABt3',
            'ABu1', 'ABu2', 'ABu3'}


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def checked(path, expected):
    if path.is_symlink() or path.stat().st_size > 16 * 1024 * 1024:
        raise ValueError('Unavailable source input: ' + path.name)
    raw = path.read_bytes()
    if digest(raw) != expected:
        raise ValueError('Source input changed: ' + path.name)
    return raw


def native_help_text(text):
    """Translate only the acquired XML's newline and RGB color markup."""
    colors, result, at = [], [], 0
    for match in re.finditer(r'\[[^\]]*\]', text):
        result.append(text[at:match.start()])
        tag = match.group()
        if tag == '[newline]':
            result.append('\n')
        elif re.fullmatch(r'\[color:[0-9a-fA-F]{6}\]', tag):
            colors.append(tag[7:-1].upper())
            result.append('\x01' + colors[-1])
        elif tag == '[/color]' and colors:
            colors.pop()
            result.append('\x01' + (colors[-1] if colors else 'FFFFFF'))
        else:
            raise ValueError('Unsupported or unpaired authored help markup')
        at = match.end()
    if colors or '\x00' in text or '\x01' in text:
        raise ValueError('Unclosed or invalid authored help markup')
    result.append(text[at:])
    return ''.join(result)


def allocate_aliases(records, occupied):
    aliases = {kind: {} for kind in ('Unit', 'Action')}
    counters = {'Action': 0, 'Overlay': 0, 'Projectile': 0}
    for (kind, identity), record in sorted(records.items()):
        if kind not in aliases:
            raise ValueError('Unexpected new description namespace: ' + kind)
        element = record.to_element()
        target = ACTORS.get(identity, identity)
        if len(target) != 4:
            subtype = element.get('subType') if kind == 'Unit' else 'Action'
            if subtype not in counters:
                raise ValueError('Unassigned native actor identity: ' + identity)
            index = counters[subtype]
            counters[subtype] += 1
            if index >= 100:
                raise ValueError('Native resource namespace exhausted')
            target = {'Action': 'MH', 'Overlay': 'MO', 'Projectile': 'MP'}[subtype] + f'{index:02}'
        if target != identity and (target in occupied[kind] or target in aliases[kind].values()):
            raise ValueError('Native resource alias is occupied: ' + target)
        aliases[kind][identity] = target
    if any(len(set(rows.values())) != len(rows) for rows in aliases.values()):
        raise ValueError('Native aliases collide within a resource namespace')
    return aliases


def stage(args):
    if args.out.exists() or args.out.is_symlink():
        raise ValueError('Preserve prior stages; choose a fresh output')
    source_raw = (args.source / 'source-stage.json').read_bytes()
    source = json.loads(source_raw)
    if not source.get('communityExpansions', {}).get('standardSourceCompletion'):
        raise ValueError('Require complete expansion-scoped Standard sources')
    creator_raw = (args.creator / 'source-stage.json').read_bytes()
    creator = json.loads(creator_raw)
    if source['communityExpansions']['creatorStage'] != digest(creator_raw):
        raise ValueError('Creator and legacy source selection differ')
    prior_raw = (args.prior / 'source-stage.json').read_bytes()
    prior = json.loads(prior_raw)
    if source['communityExpansions']['priorStage'] != digest(prior_raw):
        raise ValueError('Prior collection source differs')
    original = parse_descriptions(checked(args.prior / 'resources/merged_descriptions.xml',
        prior['resourceFiles']['merged_descriptions.xml'])).index
    composed = parse_descriptions(checked(args.creator / 'resources/merged_descriptions.xml',
        creator['resourceFiles']['merged_descriptions.xml'])).index
    follower_markers = validate_follower_markers(
        parse_descriptions(checked(args.creator / 'resources/merged_descriptions.xml',
            creator['resourceFiles']['merged_descriptions.xml'])),
        [checked(args.source / 'sources' / name, expected).decode('cp1252')
         for name, expected in source['files'].items() if name.endswith('.gpl')])
    if not original.keys() <= composed.keys() or any(
            ET.tostring(record.to_element()) != ET.tostring(composed[key].to_element())
            for key, record in original.items()):
        raise ValueError('Prior community descriptions changed; require a reviewed resource merge')
    common = {key: record for key, record in composed.items() if key not in original}
    inspector = module('expansion_native_inspection', ROOT / 'scripts/inspect-community-expansion-package.py')
    inspected = {}
    for identity, package in [('adventurers-guild', args.adventurers_package),
                              ('royal-menagerie', args.menagerie_package),
                              ('more-heroes', args.more_heroes_package)]:
        contract = json.loads((ROOT / 'content/community-expansions' / identity / 'source-contract.json').read_text())
        inspected[identity] = inspector.inspect(package, contract)
        if inspected[identity] != creator['packageInspections'][identity]:
            raise ValueError('Package selection differs from composed source')
    expansion = {}
    for path in sorted((args.more_heroes_package / 'Data').glob('*.xml')):
        if path.name == 'MoreHeroes_Text.xml':
            continue
        for record in parse_descriptions(path.read_bytes(), source=path.name).records:
            if record.key in expansion or record.key in common:
                raise ValueError('Duplicate acquired description')
            expansion[record.key] = record
    records = {**common, **expansion}
    helpers = module('expansion_native_names', ROOT / 'scripts/stage-alchemist-native-descriptions.py')
    stock, native, inputs = {}, {}, {}
    for folder, units, sounds, actions in [('Data', 'unittype.cam', 'sounddesc.cam', 'action.cam'),
            ('DataMX', 'mx_unittype.cam', 'mx_sounddesc.cam', 'mx_action.cam')]:
        for filename in (units, sounds, actions):
            path = args.fixture / folder / filename
            raw = checked(path, prior['stockFixture']['camArchives'][folder + '/' + filename])
            inputs[folder + '/' + filename] = digest(raw)
            native.update(cam_payloads(raw))
        for path in sorted((args.fixture / 'SDK/OriginalQuests' / folder).glob('*.xml')):
            name = path.relative_to(args.fixture).as_posix()
            raw = checked(path, prior['stockFixture']['inputs'][name])
            inputs[name] = digest(raw)
            stock.update(parse_descriptions(raw, source=path.name).index)
    release = json.loads((ROOT / 'deploy/community-guilds-release.json').read_text())
    for filename in ('unittype.cam', 'action.cam', 'sounddesc.cam'):
        name = 'Data/' + filename
        patch = next(row for row in release['patches'] if row['path'] == name)
        raw = checked(args.current_native / name, {key: patch[key] for key in ('bytes', 'sha256')})
        inputs['current/' + name] = digest(raw)
        native.update(cam_payloads(raw))
    occupied = {kind: {key.decode('ascii') for tag, key in native if tag == wire}
                for kind, wire in [('Unit', b'DUNT'), ('Action', b'DACT')]}
    occupied['Unit'].update(RESERVED)
    image_ids = set()
    for name in ('Data/maindata.cam', 'Data/interfacedata.cam',
                 'DataMX/mx_maindata.cam', 'DataMX/mx_interfacedata.cam'):
        with (args.fixture / name).open('rb') as stream, mmap.mmap(
                stream.fileno(), 0, access=mmap.ACCESS_READ) as raw:
            image_ids.update(key[:4] for kind, key in inspector.PRIMITIVES.cam_index(raw)
                             if kind == b'IMAG')
            count, header = struct.unpack_from('<II', raw, 12)
            inputs[name] = dict(archiveBytes=len(raw),
                directory=digest(raw[:20 + count * 8 + header]))
            if digest(raw) != prior['stockFixture']['camArchives'][name]:
                raise ValueError('Retail art ancestry differs from composed source')
    if any(identity.encode('ascii') in image_ids for identity in ACTORS.values()):
        raise ValueError('Native actor identity collides with retail art')
    aliases = allocate_aliases(records, occupied)
    # ABr1 and NRj1 are the Standard mod's two explicit retail replacements.
    allowed = {('Unit', 'ABr1'), ('Action', 'NRj1')}
    for key in records:
        if key[1] in occupied[key[0]] and key not in allowed:
            raise ValueError('Unreviewed retail identity replacement: ' + repr(key))
    tables = helpers.name_tables({**stock, **composed, **expansion}.values())
    for kind in aliases:
        tables[kind] = {name: aliases[kind].get(identity, identity)
                        for name, identity in tables[kind].items()}
    helpers.native_names(tables['Movement'], native, b'DMOV')
    tables['Sound'] = {}
    helpers.native_names(tables['Sound'], native, b'DSND')
    for package in (args.adventurers_package, args.menagerie_package):
        for path in sorted((package / 'Data').glob('*sounddesc.cam')):
            raw = path.read_bytes()
            inputs[path.name] = digest(raw)
            helpers.native_names(tables['Sound'], cam_payloads(raw), b'DSND')
    text_root = ET.fromstring((args.more_heroes_package / 'Data/MoreHeroes_Text.xml').read_bytes())
    texts = {row.get('id'): row.text or '' for row in text_root.findall('.//Language[@id="en_US"]/Text')}
    help_ids = {identity: f'MT{index:02}' for index, identity in enumerate(sorted(texts))}
    if len(help_ids) > 100:
        raise ValueError('Native help namespace exhausted')
    payloads, pending, counts, titles = {}, [], {}, {}
    for scope, rows in [('Any', common), ('MajestyExpansion', expansion)]:
        units, actions = {}, {}
        for (kind, identity), record in rows.items():
            element = copy.deepcopy(record.to_element())
            target = aliases[kind][identity]
            element.set('ID', target)
            game = element.find('Game')
            try:
                if kind == 'Action':
                    actions[target] = action_descriptor(element, tables)
                else:
                    subtype = element.get('subType')
                    part = None
                    if subtype == 'Character':
                        part = encode_character(game, tables['Action'], remap=help_ids)
                    elif subtype == 'Building':
                        part = encode_building(game, tables['Unit'], remap=help_ids)
                    elif subtype == 'Overlay':
                        part = encode_overlay(game)
                    units[target] = descriptor(element, tables, part)
                    titles[target] = dict(canonical=identity, name=element.get('Name'),
                        display=element.get('Description', element.get('Name')), dataset=scope)
            except ValueError as error:
                pending.append(dict(scope=scope, kind=kind, id=identity, reason=str(error)))
        for suffix, wire, rows in [('unittype', b'DUNT', units), ('action', b'DACT', actions)]:
            if rows:
                payloads[scope + '-' + suffix + '.cam'] = encode_description_cam(rows, wire)
        counts[scope] = dict(units=len(units), actions=len(actions))
    payloads['native-title-bindings.json'] = (json.dumps(titles, indent=2) + '\n').encode()
    payloads['help-text-bindings.json'] = (json.dumps({help_ids[key]: dict(canonical=key, text=value,
        nativeText=native_help_text(value))
        for key, value in texts.items()}, indent=2) + '\n').encode()
    receipt = dict(format='majesty-community-expansion-native-resource-stage-v1',
        policy=digest(Path(__file__).read_bytes()),
        sourceStage=digest(source_raw), creatorStage=digest(creator_raw), packages=inspected,
        sourceInputs=inputs, actorIdentities=ACTORS, resourceAliases=aliases,
        preservedPriorDescriptions=len(original), scopedStockReplacements=[list(k) for k in sorted(allowed)],
        counts=counts, pending=pending, files={name: digest(raw) for name, raw in payloads.items()},
        controlledFollowerMarkers=follower_markers,
        nativeRuntimeQualified=False, mediaQualified=False, browserPlayable=False, published=False)
    args.out.mkdir()
    for name, raw in payloads.items():
        (args.out / name).write_bytes(raw)
    (args.out / 'native-resource-stage.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return {key: receipt[key] for key in ('counts', 'pending', 'browserPlayable')}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('source', 'creator', 'prior', 'fixture', 'current-native',
                 'adventurers-package', 'menagerie-package', 'more-heroes-package', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    print(json.dumps(stage(parser.parse_args())))

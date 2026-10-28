#!/usr/bin/env python3
"""Restore the pinned manager's omitted follower overlays without changing GPL."""
import argparse
import copy
import importlib.util
import json
from pathlib import Path
import shutil
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from lib.community_guild_composition import digest
from lib.community_follower_markers import validate


def checked(path, expected):
    raw = path.read_bytes()
    if digest(raw) != expected:
        raise ValueError('Follower correction input changed: ' + str(path))
    return raw


def stage(a):
    if a.out.exists() or a.out.is_symlink():
        raise ValueError('Preserve previous stages')
    spec = importlib.util.spec_from_file_location('follower_manager_policy',
        ROOT / 'scripts/prepare-community-guild-gpl.py')
    policy = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(policy)
    policy.verified_git(a.manager, policy.MANAGER_COMMIT)
    sys.path.insert(0, str(a.manager / 'src'))
    from majesty_cam import compose as c
    from majesty_cam.descriptions import parse_descriptions, merge_descriptions
    cr = (a.creator / 'source-stage.json').read_bytes()
    sr = (a.source / 'source-stage.json').read_bytes()
    creator, source = json.loads(cr), json.loads(sr)
    if (source['communityExpansions']['creatorStage'] != digest(cr)
            or not source.get('namedActivityTextPort') or source.get('followerMarkerRepair')):
        raise ValueError('Require the complete reviewed source/creator pair')
    contract = json.loads((ROOT / 'content/community-expansions/royal-menagerie/source-contract.json').read_text())
    definition = json.loads(checked(a.package / 'mod-definition.json',
        contract['packageFiles']['mod-definition.json']))
    features = [row for row in definition['runtime_features']
                if row['type'] == 'stock.controlled-follower-speed-sync.v1']
    if len(features) != 1:
        raise ValueError('Require the acquired follower-speed feature')
    markers = c._controlled_follower_markers(c._normalized_mod_uuid(contract['canonicalGuid']),
                                           features[0]['feature_key'])
    xml = checked(a.creator / 'resources/merged_descriptions.xml',
                  creator['resourceFiles']['merged_descriptions.xml'])
    original = parse_descriptions(xml)
    stock = c._load_effective_stock_descriptions(a.source / 'stock-fixture')
    result = c._add_controlled_follower_marker_descriptions(merge_descriptions(original, ()),
        markers, reserved_description_keys=tuple(stock),
        reserved_description_names=tuple(record[0].to_element().get('Name', '')
                                         for record in stock.values()))
    for key, record in original.index.items():
        if ET.tostring(record.to_element()) != ET.tostring(result.document.index[key].to_element()):
            raise ValueError('An existing description changed')
    texts = [checked(a.source / 'sources' / name, expected).decode('cp1252')
             for name, expected in source['files'].items() if name.endswith('.gpl')]
    if validate(result.document, texts) != sorted(markers):
        raise ValueError('Authored feature and generated GPL disagree')
    proof = dict(format='majesty-controlled-follower-marker-repair-v1',
        priorCreatorStage=digest(cr), priorSourceStage=digest(sr),
        acquiredDefinition=contract['packageFiles']['mod-definition.json'],
        managerCommit=policy.MANAGER_COMMIT, markers=list(markers),
        originalDescriptionsUnchanged=True, originalSdkSourcesUnchanged=True,
        policy=digest(Path(__file__).read_bytes()))
    a.out.mkdir()
    cp, sp = a.out / 'creator', a.out / 'source'
    (cp / 'resources').mkdir(parents=True)
    (cp / 'sources').symlink_to((a.creator / 'sources').resolve(), target_is_directory=True)
    for name, expected in creator['resourceFiles'].items():
        raw = checked(a.creator / 'resources' / name, expected)
        if name == 'merged_descriptions.xml':
            raw = result.payload
        (cp / 'resources' / name).write_bytes(raw)
        creator['resourceFiles'][name] = digest(raw)
    creator['followerMarkerRepair'] = copy.deepcopy(proof)
    new_cr = (json.dumps(creator, indent=2) + '\n').encode()
    (cp / 'source-stage.json').write_bytes(new_cr)
    for name, expected in source['files'].items():
        path = sp / 'sources' / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(checked(a.source / 'sources' / name, expected))
    shutil.copytree(a.source / 'routes', sp / 'routes')
    (sp / 'stock-fixture').symlink_to((a.source / 'stock-fixture').resolve(), target_is_directory=True)
    (sp / 'resources').symlink_to((cp / 'resources').resolve(), target_is_directory=True)
    source.update(resourceFiles=creator['resourceFiles'], followerMarkerRepair=proof,
                  compiled=False, targetNativeABIQualified=False, browserPlayable=False, published=False)
    source['communityExpansions']['creatorStage'] = digest(new_cr)
    (sp / 'source-stage.json').write_text(json.dumps(source, indent=2) + '\n')
    return dict(markers=list(markers), existingDescriptionsUnchanged=True,
                sdkSourcesUnchanged=True, published=False)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('creator', 'source', 'package', 'manager', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    print(json.dumps(stage(parser.parse_args())))

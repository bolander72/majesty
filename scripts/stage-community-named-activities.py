#!/usr/bin/env python3
"""Port acquired More Heroes activity labels without changing its behavior."""
import argparse
import copy
import importlib.util
import json
from pathlib import Path
import shutil
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'scripts'), str(ROOT / 'third_party/majesty-mod-manager/src')]
from lib.community_guild_composition import digest


def checked(path, expected):
    raw = path.read_bytes()
    if digest(raw) != expected:
        raise ValueError('Named-activity source binding changed: ' + str(path))
    return raw


def stage(a):
    if a.out.exists() or a.out.is_symlink():
        raise ValueError('Preserve prior activity stages')
    contract = json.loads((ROOT / 'content/community-expansions/more-heroes/source-contract.json').read_text())
    creator_raw = (a.creator / 'source-stage.json').read_bytes()
    source_raw = (a.source / 'source-stage.json').read_bytes()
    creator, source = json.loads(creator_raw), json.loads(source_raw)
    if (source['communityExpansions']['creatorStage'] != digest(creator_raw)
            or not source['communityExpansions'].get('moreHeroesQuestParticipation')
            or source.get('namedActivityTextPort')):
        raise ValueError('Require the complete reviewed expansion source/creator pair')
    policy_path = ROOT / 'scripts/prepare-community-guild-gpl.py'
    spec = importlib.util.spec_from_file_location('named_activity_policy', policy_path)
    policy = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(policy)
    policy.verified_git(a.manager, policy.MANAGER_COMMIT)
    sys.path.insert(0, str(a.manager / 'src'))
    from majesty_cam.intent_text import decode_intent_registry, encode_intent_registry, PrivateLiteralTextRecord
    from lib.community_named_activity import calls, private_id, rewrite
    # Bind the original text and every original GPL input, not guessed labels.
    originals = {}
    references = set()
    for name, expected in contract['packageFiles'].items():
        if name == 'Data/MoreHeroes_Text.xml' or name.startswith('GPL/') and name.endswith('.gpl'):
            raw = checked(a.package / name, expected)
            originals[name] = expected
            if name.endswith('.gpl'):
                references.update(name for name, _, _ in calls(raw.decode('cp1252')))
    raw = checked(a.package / 'Data/MoreHeroes_Text.xml', originals['Data/MoreHeroes_Text.xml'])
    labels = {}
    for row in ET.fromstring(raw).findall('.//Text'):
        name = row.get('id')
        if name in references:
            if name in labels or not row.text or list(row):
                raise ValueError('Ambiguous acquired named activity')
            labels[name] = row.text
    if set(labels) != references or not references:
        raise ValueError('An authored named activity has no exact acquired text')
    bindings = {name:dict(id=private_id(contract['canonicalGuid'], name), text=labels[name])
                for name in sorted(labels)}
    registry = checked(a.creator / 'resources/MMMIntentText.bin', creator['resourceFiles']['MMMIntentText.bin'])
    old = decode_intent_registry(registry)
    ids = [row['id'] for row in bindings.values()]
    if len(set(ids)) != len(ids) or set(ids) & {identity for identity, _ in old}:
        raise ValueError('Named activity identity collision')
    records = [PrivateLiteralTextRecord(identity, text) for identity, text in old]
    records += [PrivateLiteralTextRecord(row['id'], row['text'].encode('cp1252')) for row in bindings.values()]
    registry = encode_intent_registry(records)
    changed, outputs = {}, {}
    for name, expected in source['files'].items():
        body = checked(a.source / 'sources' / name, expected)
        if name.endswith('.gpl'):
            text, counts = rewrite(body.decode('cp1252'), bindings)
            if counts:
                if not name.startswith('MajestyExpansion/'):
                    raise ValueError('More Heroes named activity escaped its edition')
                changed[name] = counts
                body = text.encode('cp1252')
        outputs[name] = body
    if set().union(*(set(row) for row in changed.values())) != references:
        raise ValueError('Prepared source omitted a named activity')
    name = 'MajestyExpansion/Merged.gpl'
    definitions = ''.join('expression #MMM_AITX_%08X %d\n' % (row['id'], row['id'])
                          for row in bindings.values()).encode('ascii')
    outputs[name] = definitions + b'\n' + outputs[name]
    proof = dict(format='majesty-more-heroes-named-activity-port-v1',
        originalInputs=originals, priorCreatorStage=digest(creator_raw), priorSourceStage=digest(source_raw),
        bindings=bindings, callSites=changed, stockAndExistingPrivateTextUnchanged=True,
        sourcePolicy=digest((ROOT / 'scripts/lib/community_named_activity.py').read_bytes()),
        stagePolicy=digest(Path(__file__).read_bytes()))
    a.out.mkdir()
    c, s = a.out / 'creator', a.out / 'source'
    (c / 'resources').mkdir(parents=True)
    (c / 'sources').symlink_to((a.creator / 'sources').resolve(), target_is_directory=True)
    for name, expected in creator['resourceFiles'].items():
        body = checked(a.creator / 'resources' / name, expected)
        if name == 'MMMIntentText.bin': body = registry
        (c / 'resources' / name).write_bytes(body)
        creator['resourceFiles'][name] = digest(body)
    creator['namedActivityTextPort'] = copy.deepcopy(proof)
    creator['privateActivityTexts'] += len(bindings)
    new_creator = (json.dumps(creator, indent=2) + '\n').encode()
    (c / 'source-stage.json').write_bytes(new_creator)
    for name, body in outputs.items():
        path = s / 'sources' / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
    shutil.copytree(a.source / 'routes', s / 'routes')
    (s / 'stock-fixture').symlink_to((a.source / 'stock-fixture').resolve(), target_is_directory=True)
    (s / 'resources').symlink_to((c / 'resources').resolve(), target_is_directory=True)
    source.update(files={name:digest(body) for name,body in outputs.items()},
        resourceFiles=creator['resourceFiles'], privateActivityTexts=creator['privateActivityTexts'],
        namedActivityTextPort=proof, compiled=False, targetNativeABIQualified=False,
        browserPlayable=False, published=False)
    source['communityExpansions']['creatorStage'] = digest(new_creator)
    (s / 'source-stage.json').write_text(json.dumps(source, indent=2) + '\n')
    return dict(bindings=bindings, callSites=changed, textRecords=len(records), published=False)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('creator', 'source', 'package', 'manager', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    print(json.dumps(stage(parser.parse_args())))

#!/usr/bin/env python3
"""Package the qualified single-guild preview without changing the live release."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import importlib.util

ROOT = Path(__file__).resolve().parents[1]
BASE_ENGINE = 'a3f869eeb7d24fd27013a27c012f7ece717dcf5b03be2ac891c0e8bbde3694cd'
ASSET_PREFIX = 'assets/content/dark-paladin-v1/'


def digest(path):
    raw = path.read_bytes()
    return {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}


def prepare(a):
    if a.out.exists() or not re.fullmatch('[0-9a-f]{40}', a.asset_commit):
        raise ValueError('Require a fresh output and immutable asset commit')
    proof = json.loads(a.qualification.read_text())
    checks = ['nativeConstructRecruitCombatQualified', 'freshLevel1000SaveReloadQualified',
              'nativeUiQualified', 'otherRetiredAdmissionsDisabled',
              'stockResourcesPreserved', 'existingSaveHashesPreserved',
              'engineProducerReproducesCompiledInputs', 'ownedBrowsersClosed']
    if (proof.get('format') != 'majesty-dark-paladin-preview-qualification-v1'
            or proof.get('baselineEngineSha256') != BASE_ENGINE
            or any(proof.get(k) is not True for k in checks)):
        raise ValueError('Require the complete isolated guild qualification')
    for name, expected in proof['sourcePolicies'].items():
        path = Path(name)
        if path.is_absolute() or '..' in path.parts or digest(ROOT / path)['sha256'] != expected:
            raise ValueError('Qualified guild source changed: ' + name)
    baseline = json.loads((a.baseline / 'hosting/automatic-assets.json').read_text())
    patches = baseline['games']['majesty-community-guilds-v1']['patches']
    before = {p['path']: dict(p) for p in patches}
    if len(before) != 56 or len(patches) != 56 or not proof['resources'].keys() <= before.keys():
        raise ValueError('Unexpected original resource collection')
    release = json.loads((ROOT / 'deploy/community-guilds-release.json').read_text())
    if release['engineSha256'] != BASE_ENGINE or release['patches'] != patches:
        raise ValueError('Preview must extend the unchanged qualified live release')
    files = json.loads((a.resources / 'prototype-stage.json').read_text())['files']
    inputs = {name: a.resources / name for name in files}
    for folder in ['Data', 'DataMX']:
        for role in ['common', 'base', 'expansion']:
            inputs[f'{folder}/Community_{role.title()}.bcd'] = a.compiled / (role + '.bcd')
    changed = {name: digest(path) for name, path in inputs.items()
               if digest(path) != {k: before[name][k] for k in ['bytes', 'sha256']}}
    if changed != proof['resources']:
        raise ValueError('Preview resources differ from the played candidate')
    if any(name.endswith('Community_Common.bcd') for name in changed):
        # The three-level revision needs one tightly scoped saved-guild repair.
        # Verify its actual source delta and original compiler receipt; unrelated
        # shared callbacks must remain byte-identical to the qualified prior source.
        if not a.source or not a.prior_source or proof.get('nativeUpgradeChainQualified') is not True:
            raise ValueError('Shared bytecode requires qualified Domain upgrades and source inputs')
        spec=importlib.util.spec_from_file_location('domain_upgrades',ROOT/'scripts/prepare-dark-paladin-upgrades-gpl.py')
        policy=importlib.util.module_from_spec(spec);spec.loader.exec_module(policy)
        before_source=(a.prior_source/'sources/Any/Merged.gpl').read_bytes()
        after_source=(a.source/'sources/Any/Merged.gpl').read_bytes()
        if policy.upgrade_workers(before_source.decode('cp1252')).encode('cp1252')!=after_source:
            raise ValueError('Shared source differs beyond the two scoped Domain worker branches')
        for p in (a.prior_source/'sources/Any').iterdir():
            if p.is_file() and p.name!='Merged.gpl' and p.read_bytes()!=(a.source/'sources/Any'/p.name).read_bytes():
                raise ValueError('Unrelated shared source input changed')
        receipt=json.loads((a.compiled/'compiler-proof.json').read_text())
        if (receipt.get('sourceStage')!=digest(a.source/'source-stage.json')
                or receipt.get('compilerSourceDefinitionsQualified') is not True
                or receipt.get('compilerSha256')!='8cfbf6fff1cf90d7aaf334392352515eb0f989a35a16bc99f225e52af38820c4'
                or receipt['outputs']['common']['sha256']!=digest(a.compiled/'common.bcd')['sha256']):
            raise ValueError('Original compiler receipt does not bind the upgraded source')
    if not re.fullmatch(r'assets/content/dark-paladin-v[1-9][0-9]*/',a.asset_prefix):
        raise ValueError('Require a versioned private guild asset prefix')
    engine = a.engine / 'build/web/recomp'
    for name, expected in proof['engine'].items():
        if digest(engine / name) != expected:
            raise ValueError('Played engine input changed: ' + name)
    if digest(engine / 'MajestyRecomp.wasm.br') != proof['compressedEngine']:
        raise ValueError('Verified compressed engine changed')
    static = a.out / '.vercel/output/static'
    static.parent.mkdir(parents=True)
    shutil.copytree(a.baseline, static)
    shutil.copyfile(a.config, static.parent / 'config.json')
    for patch in patches:
        name = patch['path']
        if name in changed:
            patch.update(changed[name], url='https://raw.githubusercontent.com/bolander72/majesty/' +
                         a.asset_commit + '/' + a.asset_prefix + name)
    (static / 'hosting/automatic-assets.json').write_text(json.dumps(baseline, indent=2) + '\n')
    module = static / 'content/community-files.mjs'
    text = module.read_text()
    for name, field in [('FILES', 'sha256'), ('SIZES', 'bytes')]:
        text, count = re.subn(r'(export const COMMUNITY_' + name + r' = Object.freeze\()[\s\S]*?(\);)',
            lambda m: m[1] + json.dumps({p['path']: p[field] for p in patches}, indent=2) + m[2], text, count=1)
        if count != 1:
            raise ValueError('Unexpected native resource binding module')
    module.write_text(text)
    updates = static / 'hosting/community-updates.mjs'
    text = updates.read_text()
    previous = json.loads(text.split('const PREVIOUS = Object.freeze(', 1)[1].split(');', 1)[0])
    for name in changed:
        previous[name] = list(dict.fromkeys(previous.get(name, []) + [before[name]['sha256']]))
    text, count = re.subn(r'(const PREVIOUS = Object.freeze\()[\s\S]*?(\);)',
        lambda m: m[1] + json.dumps(previous, indent=2) + m[2], text, count=1)
    if count != 1:
        raise ValueError('Unexpected native update history module')
    updates.write_text(text)
    # The original production route serves .wasm.br with native WASM MIME and
    # Brotli encoding. Keep that route and every frontend/player behavior.
    raw = static / 'majesty/MajestyRecomp.wasm'
    if raw.exists() or raw.is_symlink():
        raw.unlink()
    for name in ['MajestyRecomp.js', 'MajestyRecomp.data', 'MajestyRecomp.wasm.br']:
        shutil.copyfile(engine / name, static / 'majesty' / name)
    games = json.loads((static / 'games.json').read_text())
    for game in games:
        game['engineSha256'] = proof['engine']['MajestyRecomp.wasm']['sha256']
    (static / 'games.json').write_text(json.dumps(games, indent=2) + '\n')
    report = {'format': 'majesty-dark-paladin-preview-build-v1', 'productionChanged': False,
              'qualification': digest(a.qualification), 'assetCommit': a.asset_commit,
              'changedResources': changed, 'engine': proof['engine'],
              'compressedEngine': proof['compressedEngine'], 'sourcePolicies': proof['sourcePolicies']}
    (a.out / 'preview-build.json').write_text(json.dumps(report, indent=2) + '\n')
    print('Single-guild preview packaged; the production descriptors are unchanged.')


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    for n in ['baseline', 'config', 'resources', 'compiled', 'engine', 'qualification', 'out']:
        p.add_argument('--' + n, type=Path, required=True)
    p.add_argument('--asset-commit', required=True)
    p.add_argument('--asset-prefix',default=ASSET_PREFIX)
    p.add_argument('--source',type=Path)
    p.add_argument('--prior-source',type=Path)
    prepare(p.parse_args())

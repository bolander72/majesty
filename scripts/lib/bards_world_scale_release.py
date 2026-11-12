"""Bind the qualified Bards-only art update without touching player startup."""
import hashlib
import json
from pathlib import Path
import re

CAM_PATHS = ('Data/Community-main.cam', 'DataMX/Community-main.cam')
BINDINGS = ('content/community-files.mjs', 'hosting/automatic-assets.json',
            'hosting/community-updates.mjs')


def digest(raw):
    return dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())


def object_literal(text, name):
    matches = list(re.finditer(r'\bconst ' + name + r' = Object.freeze\((\{.*?\})\);', text, re.S))
    if len(matches) != 1:
        raise ValueError('Review the published binding object: ' + name)
    match = matches[0]
    return match, json.loads(match[1])


def replace_object(text, name, change):
    match, value = object_literal(text, name)
    change(value)
    return text[:match.start(1)] + json.dumps(value, indent=2) + text[match.end(1):]


def prepare_bindings(inputs, release):
    """Also used to stage the private native trial before qualification."""
    if set(inputs) != set(BINDINGS):
        raise ValueError('Require exactly the three published content bindings')
    for name, raw in inputs.items():
        if digest(raw) != release['priorBindings'][name]:
            raise ValueError('Published content binding changed: ' + name)
    before, after = release['sourceCam'], release['cam']
    commit = release['assetCommit']
    priors = release['previousCamHashes']
    if (not re.fullmatch('[a-f0-9]{40}', commit) or before['sha256'] not in priors
            or any(not re.fullmatch('[a-f0-9]{64}', h) for h in priors)
            or not re.fullmatch('[a-f0-9]{64}', after['sha256'])
            or type(after['bytes']) is not int or not 0 < after['bytes'] <= 64 * 1024 * 1024
            or release['percent'] != 70):
        raise ValueError('Invalid source-bound Bards scale release')
    catalog = inputs[BINDINGS[0]].decode()
    for name, field in [('COMMUNITY_FILES', 'sha256'), ('COMMUNITY_SIZES', 'bytes')]:
        def update(values, field=field):
            for path in CAM_PATHS:
                if values.get(path) != before[field]:
                    raise ValueError('Unexpected current community CAM binding')
                values[path] = after[field]
        catalog = replace_object(catalog, name, update)
    recipe = json.loads(inputs[BINDINGS[1]])
    patches = recipe['games']['majesty-community-guilds-v1']['patches']
    for path in CAM_PATHS:
        found = [p for p in patches if p['path'] == path]
        if len(found) != 1 or {k: found[0][k] for k in ('bytes', 'sha256')} != before:
            raise ValueError('Unexpected automatic CAM recipe')
        found[0].update(after, url=f'https://raw.githubusercontent.com/bolander72/majesty/{commit}/assets/content/bards-scale-v1/{path}')
    def accept_published_versions(values):
        for path in CAM_PATHS:
            if path not in values:
                raise ValueError('Missing native art update history')
            for sha in priors:
                if sha not in values[path]:
                    values[path].append(sha)
    updater = replace_object(inputs[BINDINGS[2]].decode(), 'PREVIOUS', accept_published_versions)
    return dict(zip(BINDINGS, (catalog.encode(), (json.dumps(recipe, indent=2) + '\n').encode(), updater.encode())))


def install(root, output):
    release = json.loads((root / 'deploy/bards-world-scale-release.json').read_text())
    proof_raw = (root / 'deploy/bards-world-scale-verification.json').read_bytes()
    proof = json.loads(proof_raw)
    if (release.get('format') != 'majesty-bards-world-scale-release-v1'
            or proof.get('format') != 'majesty-bards-world-scale-qualification-v1'
            or digest(proof_raw) != release['qualification']
            or proof.get('sourceCam') != release['sourceCam'] or proof.get('cam') != release['cam']
            or proof.get('percent') != release['percent']
            or any(proof.get(k) is not True for k in (
                'onlyBardsWorldArtChanged', 'originalTileSlotsPreserved', 'sidebarArtPreserved',
                'nativePlacementQualified', 'nativeUpgradeChainQualified',
                'existingSaveQualified', 'freshReloadQualified', 'ownedBrowsersClosed'))):
        raise ValueError('Require completed Bards placement and saved-world qualification')
    for name, expected in proof['sourcePolicies'].items():
        p = Path(name)
        if p.is_absolute() or '..' in p.parts or digest((root / p).read_bytes()) != expected:
            raise ValueError('Qualified Bards source policy changed')
    static = output / 'static'
    result = prepare_bindings({n: (static / n).read_bytes() for n in BINDINGS}, release)
    if {n: digest(raw) for n, raw in result.items()} != release['bindings']:
        raise ValueError('Bards release differs from the tested content bindings')
    for name, raw in result.items():
        (static / name).write_bytes(raw)

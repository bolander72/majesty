"""Install the source-bound, natively qualified community guild usability release."""
import hashlib
import json
from pathlib import Path
import re
import urllib.request


def digest(raw):
    return {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}


def inventory(root):
    return {p.relative_to(root).as_posix(): digest(p.read_bytes())
            for p in root.rglob('*') if p.is_file()}


PAYLOADS = {'config.json', 'static/index.html', 'static/games.json',
            'static/content/community-files.mjs', 'static/hosting/automatic-assets.json',
            'static/hosting/community-updates.mjs', 'static/majesty/MajestyRecomp.js',
            'static/majesty/MajestyRecomp.wasm.br'}


def install(root, output):
    path = root / 'deploy/guild-usability-release.json'
    if not path.exists():
        return
    release = json.loads(path.read_text())
    proof_raw = (root / 'deploy/guild-usability-verification.json').read_bytes()
    proof = json.loads(proof_raw)
    required = ['nativeCaptureQualified', 'palaceCaptureQualified', 'guildAlwaysOpenQualified',
                'retiredConstructionQualified', 'buildingScaleQualified', 'nativeHelpQualified',
                'playerSavesPreserved', 'ownedBrowsersClosed', 'officialSdkCompiled',
                'officialEngineBuilt', 'darkPaladinArtUnchanged']
    if (release.get('format') != 'majesty-guild-usability-release-v1'
            or digest(proof_raw) != release['qualification']
            or any(proof.get(k) is not True for k in required)):
        raise ValueError('Require completed native guild usability qualification')
    if digest(Path(__file__).read_bytes()) != release['installer']:
        raise ValueError('Guild usability installer changed')
    for name, sha in proof['sourcePolicies'].items():
        p = Path(name)
        if p.is_absolute() or '..' in p.parts or digest((root / p).read_bytes())['sha256'] != sha:
            raise ValueError('Qualified guild usability source changed: ' + name)
    if inventory(output) != release['baselineFiles']:
        raise ValueError('Review current production baseline')
    if set(release['payloads']) != PAYLOADS:
        raise ValueError('Unexpected guild usability payload set')
    for name, expected in release['payloads'].items():
        if not re.fullmatch(r'https://raw\.githubusercontent\.com/bolander72/majesty/[a-f0-9]{40}/assets/[A-Za-z0-9_./-]+', expected['url']):
            raise ValueError('Require immutable project assets')
        if not 0 < expected['bytes'] <= 64 * 1024 * 1024:
            raise ValueError('Oversized guild usability payload')
        with urllib.request.urlopen(expected['url'], timeout=90) as response:
            raw = response.read(expected['bytes'] + 1)
        if digest(raw) != {k: expected[k] for k in ['bytes', 'sha256']}:
            raise ValueError('Guild usability payload failed integrity verification: ' + name)
        (output / name).write_bytes(raw)
    if inventory(output) != release['productionFiles']:
        raise ValueError('Guild usability release differs from qualified artifact')
    print('Applied reliable Zoo capture, native rewards/help, guild scale and retirement enforcement.')

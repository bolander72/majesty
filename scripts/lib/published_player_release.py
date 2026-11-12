"""Keep Git deployments on the already published, qualified root-player release."""
import hashlib
import json
from pathlib import Path
import re
import urllib.request


def digest(raw):
    return dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())


def inventory(folder):
    return {p.relative_to(folder).as_posix(): digest(p.read_bytes())
            for p in folder.rglob('*') if p.is_file()}


def local_file(root, name):
    path = Path(name)
    if path.is_absolute() or '..' in path.parts:
        raise ValueError('Invalid published release path')
    return root / path


def install(root, output):
    # Required: omitting a later release used to silently deploy the older
    # collection. Returning players then failed the custom-content safeguard.
    published = json.loads((root / 'deploy/published-player-release.json').read_text())
    if published.get('format') != 'majesty-published-player-release-v1':
        raise ValueError('Invalid published player release')
    bound = {}
    for key in ('sourceRelease', 'productionVerification'):
        record = published[key]
        raw = local_file(root, record['path']).read_bytes()
        if digest(raw) != {k: record[k] for k in ('bytes', 'sha256')}:
            raise ValueError('Published release provenance changed: ' + key)
        bound[key] = json.loads(raw)
    release, production = bound['sourceRelease'], bound['productionVerification']
    qualification_raw = (root / 'deploy/guild-usability-verification.json').read_bytes()
    qualification = json.loads(qualification_raw)
    if (release.get('format') != 'majesty-guild-usability-release-v1'
            or production.get('releaseDescriptor') != digest(local_file(root, published['sourceRelease']['path']).read_bytes())
            or production.get('sourceQualification') != digest(qualification_raw)
            or release.get('qualification') != digest(qualification_raw)
            or any(production.get(k) is not True for k in (
                'ready', 'mainDomainVerified', 'allFilesMatchStagedProduction',
                'otherMoreHeroesAdmissionsDisabled', 'sourceBuildAll149FilesExact'))
            or production.get('rollout', {}).get('playerSaveMigrationRequired') is not False
            or any(qualification.get(k) is not True for k in (
                'nativeCaptureQualified', 'palaceCaptureQualified', 'guildAlwaysOpenQualified',
                'retiredConstructionQualified', 'buildingScaleQualified', 'nativeHelpQualified',
                'playerSavesPreserved', 'officialSdkCompiled', 'officialEngineBuilt',
                'darkPaladinArtUnchanged', 'ownedBrowsersClosed'))):
        raise ValueError('Require the previously published, save-compatible player qualification')
    before, after = published['baselineFiles'], release['productionFiles']
    if inventory(output) != before:
        raise ValueError('Review the baseline before advancing the published player')
    changed = {name for name in after if before.get(name) != after[name]}
    if set(before) != set(after) or set(release['payloads']) != changed:
        raise ValueError('Published player payloads do not match the qualified artifact delta')
    staged = {}
    for name, record in release['payloads'].items():
        local_file(output, name)
        if (not (name.startswith('static/') or name == 'config.json')
                or {k: record[k] for k in ('bytes', 'sha256')} != after[name]
                or type(record['bytes']) is not int or not 0 < record['bytes'] <= 64 * 1024 * 1024
                or not re.fullmatch(r'https://raw\.githubusercontent\.com/bolander72/majesty/[a-f0-9]{40}/assets/[A-Za-z0-9_./-]+', record['url'])):
            raise ValueError('Invalid immutable published player payload: ' + name)
        with urllib.request.urlopen(record['url'], timeout=90) as response:
            raw = response.read(record['bytes'] + 1)
        if digest(raw) != after[name]:
            raise ValueError('Published player payload failed integrity verification: ' + name)
        staged[name] = raw
    # Verify all downloads before replacing any build output. Player storage is
    # never accessed here; the published updater retains its known-hash checks.
    for name, raw in staged.items():
        local_file(output, name).write_bytes(raw)
    if inventory(output) != after:
        raise ValueError('Build differs from the qualified published player')
    print('Applied published guild-usability player; root launch and cached content agree.')

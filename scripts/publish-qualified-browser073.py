#!/usr/bin/env python3
"""Publish the verified stopped-session co-op release through reversible routes."""
import hashlib
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIVE = ROOT / 'upstream/majesty-recomp/build/web-site'
OUTPUT = ROOT / 'output/browser-coop073-publication'


def sha(path):
    assert not path.stat().st_flags & 0x40000000, f'Cloud-evicted input: {path.name}'
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def read(path):
    return json.loads(path.read_text())


def stamp(path):
    s = path.stat()
    return dict(bytes=s.st_size, inode=s.st_ino, mtimeNs=s.st_mtime_ns)


def main():
    assert not OUTPUT.exists(), 'Preserve previous publication'
    package_path = ROOT / 'output/resume073-qualified-site.json'
    package = read(package_path)
    cold = read(ROOT / 'output/coop-resume073-browser-cold-cycle-qualified.json')
    native = read(ROOT / 'output/player-backup-native073-gameplay-qualified.json')
    public = read(ROOT / 'output/coop-resume073-published-pair-qualified.json')
    build = read(ROOT / package['buildReport'])
    assert package['privateSitePrepared'] and package['diagnosticFixtureExcluded']
    assert build['wasmBuildQualified'] and build['sourceInputsUnchanged']
    assert cold['pairedColdCycleQualified'] and cold['ownedTabsClosed']
    assert native['nativeBackupGameplayQualified'] and native['sourceBackupUnchanged']
    assert native['ownedNativeAndRelayStopped'] and native['ownedBrowserTabsClosed']
    assert public['qualified'] and public['ownedTabsClosed']
    assert public['bothOriginalReadersAdmitted'] and public['continuedCheckpointCommitted']
    assert public['wasmSha256'] == package['engineSha256'] == cold['wasmSha256']
    assert '\u2139 fail 0' in (ROOT / 'output/coop-resume073-published-js.log').read_text()
    for name, digest in build['sourceInputs'].items():
        assert sha(ROOT / name) == digest, f'Compiled source changed: {name}'
    site = Path(package['site']).resolve()
    assert site.is_relative_to(ROOT / 'upstream/majesty-recomp/build')
    for name, expected in package['files'].items():
        assert not Path(name).is_absolute() and '..' not in Path(name).parts
        assert sha(site / name) == expected['sha256'], f'Package changed: {name}'
    assert sha(site / 'majesty/MajestyRecomp.wasm') == package['engineSha256']
    release = LIVE / 'releases/wasm073'
    assert release.is_symlink() and release.resolve() == site
    routes = [name for name in package['files'] if name == 'index.html' or name.endswith('/index.html')]
    originals = {name: (LIVE / name).read_bytes() if (LIVE / name).exists() else None for name in routes}
    protected = [LIVE / 'games.json', *[LIVE / 'majesty' / name for name in
                 ['MajestyRecomp.js', 'MajestyRecomp.wasm', 'MajestyRecomp.data']]]
    before = {str(path.relative_to(LIVE)): stamp(path) for path in protected}
    OUTPUT.mkdir()
    for name, data in originals.items():
        if data is not None:
            backup = OUTPUT / 'previous-entrypoints' / name
            backup.parent.mkdir(parents=True, exist_ok=True)
            backup.write_bytes(data)
    changed = []
    try:
        for name in routes:
            destination = '/releases/wasm073/' + name.removesuffix('index.html')
            html = '<!doctype html><meta charset="utf-8"><title>Majesty</title>'
            html += '<p>Opening Majesty… <a href="' + destination + '">Continue</a></p>'
            html += '<script>const next=new URL(' + json.dumps(destination) + ',location.href);'
            html += 'next.search=location.search;next.hash=location.hash;location.replace(next.href);</script>\n'
            target = LIVE / name
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary = target.with_name(target.name + '.wasm073-next')
            temporary.write_text(html)
            os.replace(temporary, target)
            changed.append(name)
        assert before == {str(path.relative_to(LIVE)): stamp(path) for path in protected}
    except BaseException:
        for name in changed:
            target = LIVE / name
            if originals[name] is None:
                target.unlink()
            else:
                temporary = target.with_name(target.name + '.wasm073-rollback')
                temporary.write_bytes(originals[name])
                os.replace(temporary, target)
        raise
    report = dict(version=1, published=True, engineSha256=package['engineSha256'],
                  releaseUrl='http://localhost:8000/releases/wasm073/', routes=routes,
                  siteReportSha256=sha(package_path), packageFilesVerified=len(package['files']),
                  pairedColdCycleQualified=True, nativeBackupGameplayQualified=True,
                  publishedPairQualified=True, legacyProtectedFiles=before,
                  legacyEngineFilesAndMetadataUnchanged=True, originalProfilesPreserved=True,
                  previousEntrypoints=str(OUTPUT / 'previous-entrypoints'),
                  internetPlayQualified=False, sustainedResourceBoundsQualified=False,
                  scope='Local versioned release and reversible entrypoint redirects. Existing releases, imported assets and profiles retained.')
    (OUTPUT / 'publication.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({key: report[key] for key in ['published', 'releaseUrl', 'packageFilesVerified']}))


if __name__ == '__main__':
    main()

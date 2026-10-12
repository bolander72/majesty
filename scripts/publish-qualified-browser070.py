#!/usr/bin/env python3
"""Publish the qualified 070 package through reversible, versioned entry routes."""
import hashlib
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIVE = ROOT / 'upstream/majesty-recomp/build/web-site'
OUTPUT = ROOT / 'output/browser-coop070-publication'


def resident(path):
    assert not path.stat().st_flags & 0x40000000, f'Cloud-evicted input: {path.name}'


def sha(path):
    resident(path)
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def read(path):
    resident(path)
    return json.loads(path.read_text())


def stamp(path):
    stat = path.stat()
    return {'bytes': stat.st_size, 'inode': stat.st_ino, 'mtimeNs': stat.st_mtime_ns}


def main():
    assert not OUTPUT.exists(), 'Preserve previous publication'
    package_path = ROOT / 'output/wasm-session-candidate-070-site.json'
    package = read(package_path)
    public = read(ROOT / 'output/browser-coop070-public-travel-qualified.json')
    victory = read(ROOT / 'output/browser-coop070-five-trips-qualification.json')
    assert package['privateSitePrepared'] and public['qualified']
    assert public['testEnginesReleased'] and public['ownedTunnelAbsent']
    assert public['completedTransfers'] == 16 and public['sharedDefeatQualified']
    # Preserve and require the separately qualified actual browser victory evidence.
    assert victory['sharedChapterVictoryQualified'] and victory['fiveTransfersQualified']
    site = Path(package['site'])
    for filename, expected in package['files'].items():
        assert sha(site / filename) == expected['sha256'], f'Changed package: {filename}'
    immutable = LIVE / 'releases/wasm070'
    assert not immutable.exists() and not immutable.is_symlink()
    routes = [name for name in package['files'] if name.endswith('/index.html') or name == 'index.html']
    for name in routes:
        resident(LIVE / name)
    originals = {name: (LIVE / name).read_bytes() for name in routes}
    protected = [LIVE / 'games.json', *[LIVE / 'majesty' / name for name in
                 ['MajestyRecomp.js', 'MajestyRecomp.wasm', 'MajestyRecomp.data']]]
    before = {str(path.relative_to(LIVE)): stamp(path) for path in protected}
    OUTPUT.mkdir()
    backup = OUTPUT / 'previous-entrypoints'
    for name, data in originals.items():
        target = backup / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    immutable.parent.mkdir(exist_ok=True)
    immutable.symlink_to(site, target_is_directory=True)
    changed = []
    try:
        for name in routes:
            destination = '/releases/wasm070/' + name.removesuffix('index.html')
            html = '<!doctype html><meta charset="utf-8"><title>Majesty</title>'
            html += '<p>Opening Majesty… <a href="' + destination + '">Continue</a></p>'
            html += '<script>const next=new URL(' + json.dumps(destination) + ',location.href);'
            html += 'next.search=location.search;next.hash=location.hash;location.replace(next.href);</script>\n'
            target = LIVE / name
            temporary = target.with_name(target.name + '.wasm070-next')
            temporary.write_text(html)
            os.replace(temporary, target)
            changed.append(name)
        assert before == {str(path.relative_to(LIVE)): stamp(path) for path in protected}
    except BaseException:
        for name in changed:
            target = LIVE / name
            temporary = target.with_name(target.name + '.wasm070-rollback')
            temporary.write_bytes(originals[name])
            os.replace(temporary, target)
        immutable.unlink()
        raise
    report = {'version': 1, 'published': True, 'engineSha256': package['engineSha256'],
              'packageReport': str(package_path), 'packageReportSha256': sha(package_path),
              'releasePath': str(immutable), 'releaseUrl': 'http://localhost:8000/releases/wasm070/',
              'routes': routes, 'previousEntrypoints': str(backup),
              'legacyEngineFilesAndMetadataUnchanged': True, 'legacyProtectedFiles': before,
              'packageFilesVerified': len(package['files']), 'browserPublicationVerified': False,
              'scope': 'Versioned, byte-identical qualified package with reversible HTML entry redirects. '
                       'Old engine files/metadata and user/browser profiles are untouched.'}
    (OUTPUT / 'publication.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({key: report[key] for key in ['published', 'releaseUrl',
                     'packageFilesVerified', 'legacyEngineFilesAndMetadataUnchanged']}))


if __name__ == '__main__':
    main()

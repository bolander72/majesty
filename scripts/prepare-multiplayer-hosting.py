#!/usr/bin/env python3
"""Prepare a checked static release and relay bundle; never deploy or include saves."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    if getattr(path.stat(), 'st_flags', 0) & 0x40000000:
        raise ValueError(f'Cloud-evicted input: {path.name}')
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def prepare(report_path, destination):
    report = json.loads(report_path.read_text())
    site = Path(report['site']).resolve()
    if not site.is_relative_to(ROOT / 'upstream/majesty-recomp/build'):
        raise ValueError('Use an owned staged release')
    files = report['files']
    if not 1 <= len(files) <= 512:
        raise ValueError('Invalid bounded package')
    required = {'index.html', 'games.json', 'majesty/index.html', 'multiplayer/index.html',
                'majesty/MajestyRecomp.wasm', 'majesty/MajestyRecomp.js', 'majesty/MajestyRecomp.data'}
    if not required.issubset(files):
        raise ValueError('The static launcher/engine package is incomplete')
    for name, record in files.items():
        relative = Path(name)
        if (relative.is_absolute() or '..' in relative.parts or
                relative.suffix.lower() in {'.gmp', '.sav', '.zip', '.exe'} or
                relative.name == 'registry.json' or
                any(part in {'original', 'profile', 'profiles', 'exports'} for part in relative.parts)):
            raise ValueError('Private game assets or profiles are not hosting inputs')
        source = site / relative
        if source.is_symlink() or not source.resolve().is_relative_to(site):
            raise ValueError('Package path escaped the staged release')
        if source.stat().st_size != record['bytes'] or sha(source) != record['sha256']:
            raise ValueError(f'Package changed: {name}')
    if files.get('majesty/MajestyRecomp.wasm', {}).get('sha256') != report['engineSha256']:
        raise ValueError('Engine identity does not match its package')
    destination.mkdir()  # Exclusive: retain previous packages and partial evidence.
    for name in files:
        target = destination / 'site' / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(site / name, target)
        if sha(target) != files[name]['sha256']:
            raise ValueError('Copied hosting bytes changed')
    templates = ROOT / 'deploy/multiplayer'
    for name in ['Caddyfile', 'compose.yaml', 'Dockerfile.relay', '.env.example', '.dockerignore']:
        shutil.copyfile(templates / name, destination / name)
    for name in ['room_relay.py', 'requirements-multiplayer.txt']:
        shutil.copyfile(ROOT / 'scripts' / name, destination / name)
    shutil.copyfile(ROOT / 'docs/internet-multiplayer.md', destination / 'README.md')
    shutil.copyfile(ROOT / 'docs/co-op-campaign-continuation.md', destination / 'co-op-campaign-continuation.md')
    manifest = dict(version=1, prepared=True, deploymentStarted=False,
                    packageReportSha256=sha(report_path), engineSha256=report['engineSha256'],
                    files={str(p.relative_to(destination)): dict(bytes=p.stat().st_size, sha256=sha(p))
                           for p in sorted(destination.rglob('*')) if p.is_file()},
                    importedAssetsIncluded=False, profilesIncluded=False,
                    independentInternetGameplayQualified=False)
    (destination / 'hosting-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('site_report', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    result = prepare(args.site_report, args.output)
    print(json.dumps({key: result[key] for key in ['prepared', 'deploymentStarted', 'engineSha256']}))

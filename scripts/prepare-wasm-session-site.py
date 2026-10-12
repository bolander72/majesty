#!/usr/bin/env python3
"""Package a qualified private WASM candidate without serving or launching it."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'upstream/majesty-recomp'


def sha(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def stamp(path):
    st = path.stat()
    return dict(sha256=sha(path), bytes=st.st_size, inode=st.st_ino, mtimeNs=st.st_mtime_ns)


def copy(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    with source.open('rb') as source_file, target.open('xb') as target_file:
        while chunk := source_file.read(4096):
            target_file.write(chunk)
    assert sha(source) == sha(target)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('build_report', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Preserve the previous site preparation report')
    m = json.loads(args.build_report.read_text())
    assert m['buildQualified'] and m['buildTerminal'] and m['exitCode'] == 0
    assert m['stopReason'] is None and m['servedUnchanged'] and m['sourcesUnchanged']
    assert not m['browserUsed'] and m['gameProcessesStarted'] == 0
    assert not subprocess.run(['ps', '-p', str(m['buildPid']), '-o', 'pid='],
                              capture_output=True, text=True, check=False).stdout.strip()
    candidate = Path(m['candidate']).resolve()
    assert candidate.parent == GAME / 'build'
    assert candidate.name.startswith('actor-arrival-fixture-wasm-session-candidate-')
    for name, artifact in m['artifacts'].items():
        assert Path(artifact['filename']) == candidate / name
        assert sha(candidate / name) == artifact['sha256']
    for name, digest in m['sourceSha256'].items():
        assert sha(ROOT / name) == digest
    site = candidate / 'site'
    assert not site.exists(), 'Preserve the previous private site'
    live = GAME / 'build/web-site'
    protected = [live / 'games.json'] + [live / 'majesty' / name for name in m['artifacts']]
    before = {str(path): stamp(path) for path in protected}
    frontends = [ROOT / 'scripts/stage-world.py', Path(__file__).resolve(),
                 GAME / 'kit/tools/web_launcher.py', GAME / 'kit/tools/game_config.py',
                 GAME / 'kit/web/player/index.html']
    for directory in [GAME / 'kit/web/launcher', ROOT / 'web/world',
                      ROOT / 'web/campaign', ROOT / 'web/multiplayer']:
        frontends.extend(sorted(path for path in directory.rglob('*') if path.is_file()))
    frontend_hashes = {str(path.relative_to(ROOT)): sha(path) for path in frontends}
    report = dict(version=1, privateSitePrepared=False, browserQualified=False,
                  browserUsed=False, gameProcessesStarted=0, serverStarted=False,
                  buildReport=str(args.build_report.resolve()), buildReportSha256=sha(args.build_report),
                  candidate=str(candidate), site=str(site), frontendSourceSha256=frontend_hashes)
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    commands = [
        [str(GAME / '.venv/bin/python'), 'kit/tools/web_launcher.py', '--game-dir', str(GAME),
         '--out', str(site), '--web-build', 'majesty=' + str(candidate)],
        [str(GAME / '.venv/bin/python'), str(ROOT / 'scripts/stage-world.py'), '--site', str(site)],
    ]
    for command in commands:
        result = subprocess.run(command, cwd=GAME, capture_output=True, text=True, check=True)
        assert len(result.stdout) < 8192 and len(result.stderr) < 8192
    games = json.loads((site / 'games.json').read_text())
    assert len(games) == 1 and games[0]['id'] == 'majesty'
    assert games[0]['engineSha256'] == m['artifacts']['MajestyRecomp.wasm']['sha256']
    assert games[0]['sha256'] == '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
    for name in ['MajestyRecomp.wasm', 'MajestyRecomp.js', 'MajestyRecomp.data']:
        assert sha(site / 'majesty' / name) == m['artifacts'][name]['sha256']
    player = (site / 'majesty/index.html').read_text()
    for module in ['world/native.mjs', 'world/resources.mjs', 'campaign/session.mjs',
                   'multiplayer/session.mjs']:
        assert f'src="../{module}"' in player and (site / module).is_file()
    assert 'const {ContentHasher} = await import("../world/content-hash.mjs");' in player
    assert 'const startupController = new AbortController();' in player
    assert before == {str(path): stamp(path) for path in protected}
    assert all(sha(ROOT / name) == digest for name, digest in frontend_hashes.items())
    archived = {}
    for name, digest in {**m['sourceSha256'], **frontend_hashes}.items():
        path = candidate / 'inputs' / name
        copy(ROOT / name, path)
        archived[name] = dict(filename=str(path), sha256=digest)
    files = {str(path.relative_to(site)): dict(sha256=sha(path), bytes=path.stat().st_size)
             for path in sorted(site.rglob('*')) if path.is_file()}
    report.update(privateSitePrepared=True, launchMetadataMatchesEngine=True,
                  servedArtifactsUnchanged=True, files=files, archivedInputs=archived,
                  engineSha256=games[0]['engineSha256'], playerSha256=sha(site / 'majesty/index.html'),
                  scope='Private launcher/engine/extension package and exact inputs; no HTTP service, '
                        'WASM instantiation, browser/gameplay or OPFS publication qualification.')
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(dict(privateSitePrepared=True, files=len(files),
                          archivedInputs=len(archived), servedArtifactsUnchanged=True)))


if __name__ == '__main__':
    main()

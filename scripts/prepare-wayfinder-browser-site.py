#!/usr/bin/env python3
"""Stage an isolated content-edition launcher using an existing browser engine."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]


def replace_once(source, old, new):
    if source.count(old) != 1:
        raise ValueError('Player template changed; review the edition integration before staging')
    return source.replace(old, new, 1)


def edition_player(source):
    source = replace_once(source, 'const id = await gameId();', '''const id = await gameId();
  const {editionFor} = await import("../content/edition-session.mjs");
  const edition = editionFor(location.search);
  const dataId = edition ? edition.storageId : id;''')
    source = replace_once(source, 'for (const p of [id, "game"])', 'for (const p of [dataId, "game"])')
    source = replace_once(source, 'const exe = `/opfs/${id}/game/${game.executable}`;',
                          'const exe = `/opfs/${dataId}/game/${game.executable}`;')
    return replace_once(source, ': start()).catch(',
                         ': import("../content/edition-session.mjs").then(({startEditionPlayer}) => startEditionPlayer(start))).catch(')


def edition_launcher(source):
    return replace_once(source, 'const url = new URL(`${game.id}/`, location.href);',
                         'const url = new URL(game.playURL || `${game.id}/`, location.href);')


def sha(path):
    if getattr(path.stat(), 'st_flags', 0) & 0x40000000:
        raise ValueError(f'Cloud-evicted source: {path.name}')
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def prepare(source, output):
    if output.exists():
        raise ValueError('Preserve existing content sites; choose a new output directory')
    player = edition_player((source / 'majesty/index.html').read_text())
    launcher = edition_launcher((source / 'app.js').read_text())
    games = json.loads((source / 'games.json').read_text())
    original = next(game for game in games if game['id'] == 'majesty')
    if any(game['id'] == 'majesty-wayfinder' for game in games):
        raise ValueError('Content edition is already present')
    edition = dict(original, id='majesty-wayfinder', title='Majesty: Wayfinder & Trail Lodge',
                   playURL='majesty/?edition=wayfinder-v1&profile=wayfinder&RECOMP_RULE_INVENTORY_COMPAT=1')
    games.append(edition)
    engine = {name: sha(source / 'majesty' / name)
              for name in ['MajestyRecomp.js', 'MajestyRecomp.wasm', 'MajestyRecomp.data']}
    output.mkdir(parents=True)
    files = {}
    for file in source.rglob('*'):
        if not file.is_file():
            continue
        name = file.relative_to(source).as_posix()
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        if name in {'majesty/index.html', 'app.js', 'games.json'}:
            continue
        if name.startswith('majesty/MajestyRecomp.'):
            target.symlink_to(file.resolve())
        else:
            shutil.copyfile(file, target)
        files[name] = dict(bytes=target.stat().st_size, sha256=sha(target))
    changes = {'majesty/index.html': player, 'app.js': launcher,
               'games.json': json.dumps(games, indent=2) + '\n',
               'content/edition-session.mjs': (ROOT / 'web/content/edition-session.mjs').read_text()}
    for name, text in changes.items():
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)
        files[name] = dict(bytes=target.stat().st_size, sha256=sha(target))
    # The original import and its executable path retain the original logical
    # game ID. Edition data has a separate OPFS root; saves use a bound profile
    # under Majesty so the existing backup format includes them.
    assert engine == {name: sha(output / 'majesty' / name) for name in engine}
    report = dict(version=1, site=str(output.resolve()), sourceSite=str(source.resolve()),
                  privateSitePrepared=True, published=False, browserQualified=False,
                  engineUnchanged=True, engineSha256=engine['MajestyRecomp.wasm'],
                  files=files, contentSet='wayfinder-v1', importGameId='majesty-wayfinder',
                  defaultContentProfile='wayfinder', existingProfileRootPreserved=True,
                  scope='Private content-edition launcher; no default route or original game import changed')
    (output.parent / (output.name + '-edition.json')).write_text(json.dumps(report, indent=2) + '\n')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    report = prepare(args.source, args.output)
    print(json.dumps({key: report[key] for key in ['site', 'contentSet', 'engineUnchanged', 'browserQualified']}))


if __name__ == '__main__':
    main()

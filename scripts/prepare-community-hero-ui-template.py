#!/usr/bin/env python3
"""Stage original AP78 bodies with two read-only presentation adapters."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import shutil
import struct
import tomllib

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
ENTRIES = (0x00470c00, 0x00471030)
SIZES = (1068, 2161)
PATCHES = {0x00470cae: bytes.fromhex('8a4810'),
           0x00470feb: bytes.fromhex('8b4e14'),
           0x00471112: bytes.fromhex('8b4104')}


def digest(path):
    if not path.is_file() or path.stat().st_flags & 0x40000000:
        raise ValueError('Require a resident input: ' + str(path))
    raw = path.read_bytes()
    return dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())


def bindings(identities, required):
    rows = []
    for source in sorted(required):
        native = identities.get(source)
        if not native or len(source) != 4 or len(native) != 4 or not native.startswith('AV'):
            raise ValueError('Require a source-bound native hero alias')
        rows.append((int.from_bytes(native.encode('ascii'), 'little'),
                     int.from_bytes(source.encode('ascii'), 'little')))
    rows.sort()
    if not rows or len(rows) > 64 or len({a for a, _ in rows}) != len(rows):
        raise ValueError('Ambiguous native hero presentation subjects')
    return b'MHB1' + struct.pack('<II', 1, len(rows)) + b''.join(
        struct.pack('<II', *r) for r in rows)


def prepare(args):
    if args.out.exists():
        raise ValueError('Preserve earlier views; choose a fresh output')
    import pefile
    import sys
    sys.path.insert(0, str(ROOT / 'third_party/majesty-mod-manager/src'))
    from majesty_cam.runtime_features import decode_runtime_feature_registry
    text = (args.game / 'game.toml').read_text()
    config = tomllib.loads(text)
    exe = args.game / config['game']['developer_exe']
    if config['game']['sha256'] != PIN or digest(exe)['sha256'] != PIN:
        raise ValueError('Require the exact audited Old executable')
    pe = pefile.PE(str(exe))
    for at, expected in PATCHES.items():
        if pe.get_data(at - 0x400000, len(expected)) != expected:
            raise ValueError('Original AP78 presentation instruction differs')
    source = json.loads((args.source / 'source-stage.json').read_text())
    feature = args.source / 'resources/features.bin'
    if digest(feature) != source['resourceFiles']['features.bin']:
        raise ValueError('Original feature declaration changed')
    tables = json.loads((args.tables / 'native-tables-stage.json').read_text())
    native_path = args.native_resources / 'native-resource-stage.json'
    if digest(native_path) != tables['nativeStage']:
        raise ValueError('Native resource aliases differ from compiled table binding')
    native = json.loads(native_path.read_text())
    registry = decode_runtime_feature_registry(feature.read_bytes())
    alias_bytes = bindings(native['actorIdentities'],
                           {r.subject_id for r in registry.hero_info_rows if r.kind == 'passive'})
    inherited = config['translate'].get('instruction_patches', [])
    if any(any(start <= p['at'] < start + size for start, size in zip(ENTRIES, SIZES))
           for p in inherited):
        raise ValueError('Existing curation collides with private AP78 bodies')
    match = re.search(r'^instruction_patches\s*=\s*\[(?:[ \t]*\]|.*?^\])', text, re.M | re.S)
    if not match:
        raise ValueError('Require one original instruction patch table')
    isolated = text[:match.start()] + 'instruction_patches = [\n]' + text[match.end():]
    spec = importlib.util.spec_from_file_location('ap78_patches', ROOT / 'scripts/prepare-community-recruitment-templates.py')
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    changed = helper.append_patches(isolated, [dict(at=at, text='CALL 0x005b7360') for at in PATCHES])
    args.out.mkdir(parents=True)
    (args.out / 'game.toml').write_text(changed)
    shutil.copyfile(args.game / 'globals.toml', args.out / 'globals.toml')
    for name in ['kit', 'analysis', 'original']:
        (args.out / name).symlink_to((args.game / name).resolve(), target_is_directory=True)
    for name in [config['translate']['native']['header'], *config['translate']['native']['sources']]:
        path = args.game / name
        digest(path)
        (args.out / name).symlink_to(path.resolve())
    (args.out / 'hero-info-bindings.bin').write_bytes(alias_bytes)
    report = dict(format='majesty-private-hero-ui-template-v1', originalExeSha256=PIN,
                  sourceStage=digest(args.source / 'source-stage.json'),
                  featureRegistry=digest(feature), nativeStage=digest(native_path),
                  subjectBindings=digest(args.out / 'hero-info-bindings.bin'),
                  originalFunctions={f'{a:08x}':dict(bytes=n, sha256=hashlib.sha256(
                      pe.get_data(a - 0x400000, n)).hexdigest()) for a, n in zip(ENTRIES, SIZES)},
                  entries=[f'{a:08x}' for a in ENTRIES], moduleName='majesty_private_hero_ui',
                  patchSites={f'{a:08x}':b.hex() for a, b in PATCHES.items()},
                  generatedSourcesEdited=False, publishingAllowed=False)
    (args.out / 'hero-ui-template-stage.json').write_text(json.dumps(report, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['game', 'source', 'tables', 'native-resources', 'out']:
        parser.add_argument('--' + name, type=Path, required=True)
    try:
        prepare(parser.parse_args())
    except (ValueError, KeyError, OSError) as error:
        parser.exit(1, 'Private AP78 template refused: ' + str(error) + '\n')
    print('Original AP78 template staged; official generation and native UI qualification required')

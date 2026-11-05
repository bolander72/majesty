#!/usr/bin/env python3
"""Stage one private native movement template for the official translator.

The original engine and its translations remain unchanged. Only this collected
template replaces the audited cached-step load with a zero-argument adapter.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import shutil
import tomllib
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from lib.community_movement_frame import audit_frame
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
RANGES = {
    'execute': (0x005b7490, 848, 'b44e27260c3e5dc12e2997afceaccfc705ea1f3f7b5448a1faff387aa65e734f'),
    'lookup': (0x005b4570, 21, 'a4107c3a586e040e75232bb16884ea51c9f9430003836ecc74d31455353901b2'),
    'step': (0x005b7360, 206, 'fedd4be869a32d1477b74ef2ac6331a5eaa02a35540b71935d7d0c9ff423b3f3'),
}


def digest(path):
    if not path.is_file() or getattr(path.stat(), 'st_flags', 0) & 0x40000000:
        raise ValueError('Require a resident input: ' + str(path))
    raw = path.read_bytes()
    return dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())


def prepare(args):
    if args.out.exists() or args.out.is_symlink():
        raise ValueError('Preserve earlier templates; choose a fresh output')
    text = (args.game / 'game.toml').read_text()
    config = tomllib.loads(text)
    exe = args.game / config['game']['developer_exe']
    if config['game']['sha256'] != PIN or digest(exe)['sha256'] != PIN:
        raise ValueError('Require the pinned Old executable')
    import pefile
    pe = pefile.PE(str(exe))
    for name, (address, size, expected) in RANGES.items():
        if hashlib.sha256(pe.get_data(address - 0x400000, size)).hexdigest() != expected:
            raise ValueError('Original movement ABI differs: ' + name)
    if pe.get_data(0x1b75a2, 2) != bytes.fromhex('8b0b'):
        raise ValueError('Original cached-step load differs')
    frame = audit_frame(pe.get_data(0x1b7490, 848))
    source = json.loads((args.source / 'source-stage.json').read_text())
    feature = args.source / 'resources/features.bin'
    if digest(feature) != source['resourceFiles']['features.bin']:
        raise ValueError('Feature registry source binding differs')
    spec = importlib.util.spec_from_file_location('movement_patches', ROOT / 'scripts/prepare-community-recruitment-templates.py')
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    inherited = config['translate'].get('instruction_patches', [])
    if any(0x005b7490 <= row['at'] < 0x005b77e0 for row in inherited):
        raise ValueError('Private movement patch collides with existing movement curation')
    # A one-function module must not carry unrelated whole-game patches: the
    # official translator correctly refuses patches outside its emitted code.
    # External calls still dispatch through the qualified original host.
    match = re.search(r'^instruction_patches\s*=\s*\[(?:[ \t]*\]|.*?^\])', text, re.M | re.S)
    if not match:
        raise ValueError('Require the original bounded patch declaration')
    isolated = text[:match.start()] + 'instruction_patches = [\n]' + text[match.end():]
    patch = dict(at=0x005b75a2, text='CALL 0x005b7360')
    changed = helper.append_patches(isolated, [patch])
    args.out.mkdir(parents=True)
    (args.out / 'game.toml').write_text(changed)
    shutil.copyfile(args.game / 'globals.toml', args.out / 'globals.toml')
    for name in ['kit', 'analysis', 'original']:
        (args.out / name).symlink_to((args.game / name).resolve(), target_is_directory=True)
    for name in [config['translate']['native']['header'], *config['translate']['native']['sources']]:
        original = args.game / name
        digest(original)
        output = args.out / name
        output.parent.mkdir(parents=True, exist_ok=True)
        if not output.exists():
            output.symlink_to(original.resolve())
    report = dict(format='majesty-private-movement-template-v1', originalExeSha256=PIN,
                  originalFunctions={k: dict(address=f'{a:08x}', bytes=n, sha256=h)
                                     for k, (a, n, h) in RANGES.items()},
                  sourceStage=digest(args.source / 'source-stage.json'), featureRegistry=digest(feature),
                  moduleName='majesty_private_movement', entries=['005b7490'], patches=[patch],
                  frameLoanOffset=frame['loanOffset'], nativeFrameAudit=frame,
                  originalGameConfig=digest(args.game / 'game.toml'),
                  unrelatedWholeGamePatchesExcluded=inherited,
                  requiredRegistrationRedirect='recomp_module_register=majesty_collect_private_movement',
                  requiredRawFunctionRename='fn_005b7490=majesty_template_movement_fn_005b7490',
                  gameConfig=digest(args.out / 'game.toml'), generatedSourcesEdited=False,
                  cachedStepWritten=False, nativeQualified=False, browserQualified=False, published=False)
    (args.out / 'movement-template-stage.json').write_text(json.dumps(report, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['game', 'source', 'out']:
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    try:
        prepare(args)
    except (OSError, ValueError, KeyError) as error:
        parser.exit(1, f'Movement template refused: {error}\n')
    print('Private movement source staged; requires official translation and gameplay verification')

#!/usr/bin/env python3
"""Prepare complete retail resource dependencies in a separate private stage."""
import argparse
from dataclasses import replace
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]


def digest(raw):
    return dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())


def prepare(args):
    if args.out.exists() or args.out.is_symlink():
        raise ValueError('Preserve prior stages; choose a fresh output')
    spec = importlib.util.spec_from_file_location('campaign_resource_source_policy',
        ROOT / 'scripts/prepare-community-guild-gpl.py')
    policy = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(policy)
    policy.verified_git(args.manager, policy.MANAGER_COMMIT)
    sys.path.insert(0, str(args.manager / 'src'))
    from majesty_cam.cam import read_cam
    from lib.community_campaign_resources import plan, route_native_callbacks, verify_retail_descriptions
    from lib.community_campaign_media import merge_media
    proof_raw = (args.source / 'source-stage.json').read_bytes()
    proof = json.loads(proof_raw)
    if (proof.get('format') != 'majesty-community-combined-creator-gpl-stage-v1'
            or not proof.get('legacyFunctionAliases') or proof.get('campaignResourceClosure')):
        raise ValueError('Require the current aliased source without a prior resource extension')
    payloads = {}
    for name, expected in proof['files'].items():
        parts = Path(name).parts
        if (len(parts) != 2 or parts[0] not in ('Any', 'Majesty', 'MajestyExpansion')
                or Path(name).suffix not in ('.gpl', '.dat')):
            raise ValueError('Unsupported source inventory')
        path = args.source / 'sources' / name
        if path.is_symlink() or path.stat().st_size > 2 * 1024 * 1024:
            raise ValueError('Unavailable source input')
        raw = path.read_bytes()
        if digest(raw) != expected:
            raise ValueError('Source differs from compiler input')
        payloads[name] = raw
    compiler_raw = (args.compiled / 'compiler-proof.json').read_bytes()
    compiler = json.loads(compiler_raw)
    if (not compiler.get('compiled') or compiler.get('sourceStage') != digest(proof_raw)
            or compiler.get('compilerSha256') !=
                '8cfbf6fff1cf90d7aaf334392352515eb0f989a35a16bc99f225e52af38820c4'):
        raise ValueError('Require the original SDK compiler binding to this source')
    # A published extension changes the current release's hashes. Retain an
    # explicit original baseline so this preparation remains reproducible.
    release_path = getattr(args, 'prior_release', None) or ROOT / 'deploy/community-guilds-release.json'
    release_raw = release_path.read_bytes()
    release = json.loads(release_raw)
    inputs = {}
    for patch in release['patches']:
        name = patch['path']
        if Path(name).is_absolute() or '..' in Path(name).parts:
            raise ValueError('Unsafe resource path')
        # The preserved native mirror predates only the two Common bytecodes.
        # Verify their effective bytes against the SDK output instead.
        path = (args.compiled / 'common.bcd' if name in
                ('Data/Community_Common.bcd', 'DataMX/Community_Common.bcd') else args.game / name)
        raw = path.read_bytes()
        if digest(raw) != {k: patch[k] for k in ('bytes', 'sha256')}:
            raise ValueError('Effective game input differs from the release: ' + name)
        inputs[name] = digest(raw)
    ancestry_raw = (args.ancestry / 'source-stage.json').read_bytes()
    if proof.get('legacyOriginalStage') != digest(ancestry_raw):
        raise ValueError('Require the exact pre-alias source ancestry')
    original_inputs = {}
    for name, expected in proof['stockFixture']['inputs'].items():
        is_script = name.startswith(('SDK/OriginalQuests/GPLMx/',
                                     'SDK/OriginalQuests/DataMX/', 'SDK/OriginalQuests/Data/'))
        if name in ('Data/bytecode.bcd', 'Data/MDL1.bcd'):
            path = args.game / name
        elif is_script or name == 'SDK/OriginalQuests/Data/M_Characters.xml':
            path = args.ancestry / 'stock-fixture' / name
        else:
            continue
        if (Path(name).is_absolute() or '..' in Path(name).parts
                or path.stat().st_size > 16 * 1024 * 1024):
            raise ValueError('Unsupported original dependency input')
        actual = digest(path.read_bytes())
        if actual != expected:
            raise ValueError('Original dependency differs from source ancestry: ' + name)
        original_inputs[name] = actual
    if not all(name in original_inputs for name in ('Data/bytecode.bcd', 'Data/MDL1.bcd',
            'SDK/OriginalQuests/Data/M_Characters.xml')):
        raise ValueError('Original dependency ancestry is incomplete')
    closure = plan(args.game, args.source,
                   args.ancestry / 'stock-fixture/SDK/OriginalQuests', fire_balm=True)
    from lib.community_fire_balm import patch_fire_balm_sources
    payloads, fire_changes = patch_fire_balm_sources(payloads)
    # Both original and Northern load Common; only original loads Base.
    name = 'Any/NorthernResourceCompatibility.gpl'
    if not closure['commonSource'] or name in payloads:
        raise ValueError('Require a fresh shared Fire Balm compatibility module')
    payloads[name] = closure['commonSource'].encode('cp1252')
    if not closure['report']['functions'] or not closure['imports']:
        raise ValueError('No unresolved dependencies; do not prepare an empty release')
    retail_proof = verify_retail_descriptions(closure, args.game)
    modified = {}
    for kind, file, namespace in [(b'DUNT', 'unittype.cam', 'Unit'),
                                   (b'DACT', 'action.cam', 'Action'),
                                   (b'DSND', 'sounddesc.cam', 'Sound')]:
        archive = read_cam((args.game / 'Data' / file).read_bytes())
        sections = [section for section in archive.sections if section.extension == kind]
        if len(sections) != 1:
            raise ValueError('Require one native descriptor namespace')
        section = sections[0]
        additions = tuple(replace(entry, data=route_native_callbacks(
                              entry.data, kind, closure['callbackRoutes']))
                          for (ns, _), rows in closure['imports'].items()
                          if ns == namespace for _, entry, _ in rows)
        updated = replace(archive, sections=tuple(replace(s, entries=s.entries + additions)
                          if s == section else s for s in archive.sections))
        modified['Data/' + file] = updated.to_bytes()
    media, media_proof = merge_media(args.game, closure)
    modified.update({'Data/' + name: raw for name, raw in media.items()})
    for path, actual in media_proof['sourceArchives'].items():
        relative = Path(path).relative_to(args.game).as_posix()
        if proof['stockFixture']['camArchives'].get(relative) != actual:
            raise ValueError('Original art/audio ancestry differs: ' + relative)
    name = 'Majesty/NorthernResourceCallbacks.gpl'
    if name in payloads:
        raise ValueError('Preserve an existing callback file')
    payloads[name] = closure['callbackSource'].encode('cp1252')
    if closure['templateSource']:
        name = 'Majesty/NorthernResourceTemplates.dat'
        if name in payloads:
            raise ValueError('Preserve an existing data template file')
        payloads[name] = closure['templateSource'].encode('cp1252')
    args.out.mkdir()
    for name, raw in payloads.items():
        path = args.out / 'sources' / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)
    for name, raw in modified.items():
        path = args.out / 'native' / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)
    for name in ('stock-fixture', 'resources', 'phantom-source-package'):
        (args.out / name).symlink_to((args.ancestry / name).resolve(), target_is_directory=True)
    shutil.copytree(args.source / 'routes', args.out / 'routes')
    receipt = dict(plan=closure['report'], media=media_proof, retail=retail_proof,
        priorRelease=digest(release_raw),
        priorSourceStage=digest(proof_raw), priorCompilerProof=digest(compiler_raw),
        effectiveInputs=inputs, files={name: digest(raw) for name, raw in modified.items()},
        originalDependencyInputs=original_inputs,
        policies={name: digest((ROOT / name).read_bytes()) for name in [
            'scripts/prepare-community-campaign-resources.py',
            'scripts/lib/community_resource_closure.py',
            'scripts/lib/community_campaign_resources.py',
            'scripts/lib/community_fire_balm.py',
            'scripts/lib/community_campaign_media.py']},
        compiled=False, browserPlayable=False, published=False)
    receipt['fireBalmSourceChanges'] = fire_changes
    proof.update(campaignResourceClosure=receipt,
                 originalExportsAndFunctionBodiesPreserved=False,
                 originalExportsPreserved=True,
                 files={name: digest(raw) for name, raw in payloads.items()},
                 compiled=False, targetNativeABIQualified=False,
                 browserPlayable=False, published=False)
    (args.out / 'source-stage.json').write_text(json.dumps(proof, indent=2) + '\n')
    (args.out / 'resource-stage.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('source', 'ancestry', 'compiled', 'manager', 'game', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--prior-release', type=Path,
                        help='Preserved pre-extension release descriptor for reproducible inputs')
    report = prepare(parser.parse_args())
    print('Prepared', len(report['plan']['descriptions']),
          'resource dependencies and', len(report['plan']['functions']),
          'base-only callbacks; original SDK compilation and gameplay required')

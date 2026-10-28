#!/usr/bin/env python3
"""Reuse the qualified SDK outputs only when every GPL/DAT input is unchanged."""
import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from lib.community_guild_composition import digest


def checked(path, expected):
    if not path.is_file() or path.stat().st_size > 64 * 1024 * 1024:
        raise ValueError('Unavailable bounded compiler input')
    raw = path.read_bytes()
    if digest(raw) != expected:
        raise ValueError('Compiler/source binding changed: ' + path.name)
    return raw


def prepare(args):
    if args.out.exists() or args.out.is_symlink():
        raise ValueError('Preserve prior compiler stages')
    old_raw = (args.prior_source / 'source-stage.json').read_bytes()
    new_raw = (args.source / 'source-stage.json').read_bytes()
    old, new = json.loads(old_raw), json.loads(new_raw)
    compiled_raw = (args.compiled / 'compiler-proof.json').read_bytes()
    compiled = json.loads(compiled_raw)
    bound = json.loads((ROOT / 'content/community-expansions/source-integration-verification.json').read_text())
    qualified = [bound.get(name) for name in ('compiler', 'preIntentCompiler')]
    if (compiled not in qualified or compiled.get('compiled') is not True
            or compiled.get('sourceStage') != digest(old_raw)
            or compiled.get('compilerSha256') != '8cfbf6fff1cf90d7aaf334392352515eb0f989a35a16bc99f225e52af38820c4'
            or old['files'] != new['files'] or old['legacyRoutes'] != new['legacyRoutes']
            or not new.get('communityExpansions', {}).get('moreHeroesQuestParticipation')):
        raise ValueError('Require the tracked qualified compile and identical source/routes')
    for scope, expected in new['legacyRoutes'].items():
        if scope not in ('Majesty', 'MajestyExpansion'):
            raise ValueError('Unexpected edition route scope')
        name = Path('routes') / scope / 'shared-overrides.tsv'
        if checked(args.prior_source / name, expected) != checked(args.source / name, expected):
            raise ValueError('Edition route bytes differ')
    payloads = {}
    slugs = {'Any': 'common', 'Majesty': 'base', 'MajestyExpansion': 'expansion'}
    for name, expected in new['files'].items():
        path = Path(name)
        if len(path.parts) != 2 or path.parts[0] not in slugs or path.suffix not in ('.gpl', '.dat'):
            raise ValueError('Unsafe compiler source inventory')
        raw = checked(args.source / 'sources' / path, expected)
        if raw != checked(args.prior_source / 'sources' / path, expected):
            raise ValueError('GPL/DAT source bytes differ')
        compiler_name = slugs[path.parts[0]] + '-' + path.name
        if raw != checked(args.compiled / compiler_name, expected):
            raise ValueError('Prior SDK compiler did not receive these exact bytes')
        payloads[compiler_name] = raw
    for slug, record in compiled['outputs'].items():
        if slug not in slugs.values() or record.get('exitCode') != 0 or not record.get('headerValid'):
            raise ValueError('Unqualified original compiler output')
        payloads[slug + '.bcd'] = checked(args.compiled / (slug + '.bcd'),
            {key: record[key] for key in ('bytes', 'sha256')})
    args.out.mkdir()
    for name, raw in payloads.items():
        (args.out / name).write_bytes(raw)
    compiled['sourceStage'] = digest(new_raw)
    compiled['resourceOnlyRebind'] = dict(priorCompilerProof=digest(compiled_raw),
        priorSourceStage=digest(old_raw), originalSdkSourceFilesByteIdentical=True,
        editionRoutesByteIdentical=True, compilerRerun=False,
        metricsFromOriginalCompilation=True, policy=digest(Path(__file__).read_bytes()))
    (args.out / 'compiler-proof.json').write_text(json.dumps(compiled, indent=2) + '\n')
    return dict(compilerRerun=False, originalSdkSourceFilesByteIdentical=True,
                sourceStage=digest(new_raw), published=False)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('prior-source', 'source', 'compiled', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    print(json.dumps(prepare(parser.parse_args())))

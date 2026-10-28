#!/usr/bin/env python3
"""Carry current game fixes into the privately composed expansion sources."""
import argparse
import copy
import importlib.util
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'scripts'), str(ROOT / 'third_party/majesty-mod-manager/src')]
from lib.community_guild_composition import digest
from majesty_cam.gpl import DefinitionKind, parse_gpl, parse_dat
from majesty_cam.gpl_function_merge import merge_function, same_function_instructions

SCOPES = ('Any', 'Majesty', 'MajestyExpansion')


def load(stage):
    raw = (stage / 'source-stage.json').read_bytes()
    proof = json.loads(raw)
    payloads, items = {}, {}
    for name, expected in proof['files'].items():
        if (len(Path(name).parts) != 2 or Path(name).parts[0] not in SCOPES
                or Path(name).suffix not in ('.gpl', '.dat')):
            raise ValueError('Unexpected source stage path')
        body = (stage / 'sources' / name).read_bytes()
        if digest(body) != expected:
            raise ValueError('Source stage changed: ' + name)
        payloads[name] = body
        for item in (parse_dat if name.endswith('.dat') else parse_gpl)(body.decode('cp1252'), name).items:
            key = (Path(name).parts[0], item.key)
            if key in items:
                raise ValueError('Duplicate scoped source definition')
            items[key] = item
    return raw, proof, payloads, items


def renamed(text, name):
    updated, count = re.subn(r'^(\s*function\s+)[A-Za-z_][A-Za-z0-9_]*',
        lambda match: match[1] + name, text, count=1, flags=re.I)
    if count != 1:
        raise ValueError('Unsupported function header')
    return updated


def carry_function(ancestor, current, proposed):
    """Combine only disjoint instructions; reject ambiguous gameplay choices."""
    if current == ancestor or same_function_instructions(current, ancestor):
        return proposed
    if proposed == ancestor or same_function_instructions(proposed, ancestor):
        return current
    return merge_function(ancestor, {'Current qualified game fixes': current,
                                     'Community expansion': proposed})


def complete_standard_sources(final, candidate, package, composed):
    """Materialize the Standard library beside the creator's merged exports.

    Creator composition emits only the Standard functions it needed to merge.
    Modern Majesty also loads the Standard package itself. Our single scoped
    library must include that package's remaining functions and DAT blocks.
    Never replace a merged export with the standalone package's earlier body.
    """
    if candidate.get('moreHeroesDatasetBases') != ['majestyexpansion']:
        raise ValueError('More Heroes must retain its original expansion-only scope')
    expected_files = candidate.get('moreHeroesNativeSources')
    if not expected_files or not candidate.get('moreHeroesCompatibility'):
        raise ValueError('Require source/bytecode-qualified Standard inputs')
    imported, retained, seen = [], [], set()
    for name, expected in expected_files.items():
        path = Path(name)
        if (len(path.parts) != 2 or path.parts[0] != 'GPL'
                or path.suffix not in ('.gpl', '.dat')):
            raise ValueError('Unexpected Standard source input')
        source = package / path
        if source.is_symlink():
            raise ValueError('Linked Standard source input')
        body = source.read_bytes()
        if digest(body) != expected:
            raise ValueError('Standard source changed: ' + name)
        for item in (parse_dat if path.suffix == '.dat' else parse_gpl)(
                body.decode('cp1252'), name).items:
            if item.key in seen:
                raise ValueError('Duplicate Standard definition: ' + item.name)
            seen.add(item.key)
            key = ('MajestyExpansion', item.key)
            if ('Any', item.key) in final:
                raise ValueError('Standard source requires a reviewed common scope split: ' + item.name)
            if key in final:
                if key not in composed:
                    raise ValueError('Standard source collides outside creator composition: ' + item.name)
                retained.append(item.name)
            else:
                final[key] = item.text
                imported.append(item.name)
    return dict(sourceFiles=expected_files, importedDefinitions=imported,
                preservedComposedDefinitions=retained,
                standaloneDefinitionCount=len(seen), dataset='MajestyExpansion')


def stage(args):
    if args.out.exists() or args.out.is_symlink():
        raise ValueError('Preserve prior source stages; choose a fresh output')
    ancestor_raw, ancestor, _, old = load(args.creator_baseline)
    qualified = json.loads((ROOT / 'content/community-mods/source-preparation-verification.json').read_text())
    if digest(ancestor_raw) != qualified['sourceStage']:
        raise ValueError('Creator baseline differs from the qualified original SDK source')
    current_raw, current, current_files, live = load(args.current)
    candidate_raw, candidate, _, new = load(args.candidate)
    if (not current.get('phantomResilience') or candidate.get('priorStage') != digest(current_raw)
            or candidate.get('sourceCompositionQualified') is not True):
        raise ValueError('Require a composed expansion based on the current corrected collection')
    final = {key: item.text for key, item in live.items()}
    aliases = copy.deepcopy(current['legacyFunctionAliases'])
    replacements, moved, added = [], [], []
    for old_key, item in old.items():
        if old_key in new:
            continue
        scope, identity = old_key
        if scope != 'Any' or any((edition, identity) not in new for edition in SCOPES[1:]):
            # A stock edition override may move to common, but must have an
            # exact replacement in every edition where it was previously used.
            if scope == 'Majesty' and ('Any', identity) in new:
                destinations = ('Any',)
            else:
                raise ValueError('Unreviewed source removal: ' + str(old_key))
        else:
            destinations = SCOPES[1:]
        alias_name = next((value for name, value in aliases[scope].items()
                           if name.casefold() == identity[1]), None)
        final.pop(old_key, None)
        if alias_name:
            final.pop((scope, (DefinitionKind.FUNCTION, alias_name.casefold())), None)
            aliases[scope] = {name: value for name, value in aliases[scope].items()
                              if name.casefold() != identity[1]}
        moved.append(dict(name=item.name, source=scope, destinations=list(destinations)))
    for key, item in new.items():
        scope, identity = key
        ancestor_key = key if key in old else ('Any', identity)
        previous = old.get(ancestor_key)
        if previous and item.text == previous.text and key in live:
            continue
        current_item = live.get(key) or live.get(ancestor_key)
        result = item.text
        if previous and current_item and identity[0] is DefinitionKind.FUNCTION:
            result = carry_function(previous.text, current_item.text, item.text)
        elif current_item and not previous and current_item.text != item.text:
            raise ValueError('Independent source additions collide: ' + item.name)
        if result != final.get(key):
            final[key] = result
            replacements.append(dict(scope=scope, kind=identity[0].value, name=item.name,
                preservedCurrentChanges=bool(current_item and previous and current_item.text != previous.text)))
        # Both public exports and their existing first-wins VM routes need
        # the same adaptation. Never leave the live alias on its old body.
        if identity[0] is DefinitionKind.FUNCTION:
            alias = next((value for name, value in current['legacyFunctionAliases'].get(
                ancestor_key[0], {}).items() if name.casefold() == identity[1]), None)
            if alias:
                old_alias = live.get((ancestor_key[0], (DefinitionKind.FUNCTION, alias.casefold())))
                alias_body = result
                if old_alias and previous:
                    alias_body = carry_function(previous.text,
                        renamed(old_alias.text, previous.name), item.text)
                final[scope, (DefinitionKind.FUNCTION, alias.casefold())] = renamed(alias_body, alias)
                aliases[scope][item.name] = alias
    standard = complete_standard_sources(final, candidate, args.standard_package, new)
    # Resolve newly imported stock symbols through the same original VM route
    # mechanism, without guessing any new native addresses.
    spec = importlib.util.spec_from_file_location('expansion_sdk_sources', ROOT / 'scripts/compose-alchemist-gameplay.py')
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    stock, captured = set(), {}
    for project in helper.PROJECTS:
        for parsed in helper.project_sources(args.current / 'stock-fixture',
                'SDK/OriginalQuests/' + project, captured):
            stock.update(item.normalized_name for item in parsed.items if item.kind is DefinitionKind.FUNCTION)
    if any(current['stockFixture']['inputs'].get(name) != record for name, record in captured.items()):
        raise ValueError('Original SDK source binding changed')
    for (scope, identity), body in list(final.items()):
        if identity[0] is not DefinitionKind.FUNCTION or identity[1] not in stock:
            continue
        if any(name.casefold() == identity[1] for name in aliases[scope]):
            continue
        item = parse_gpl(body).items[0]
        alias = 'MJC_' + item.name
        alias_key = (scope, (DefinitionKind.FUNCTION, alias.casefold()))
        if alias_key in final:
            raise ValueError('New stock function alias collides: ' + alias)
        final[alias_key] = renamed(final[scope, identity], alias)
        aliases[scope][item.name] = alias
        added.append(dict(scope=scope, function=item.name, alias=alias))
    routes = {}
    for edition in SCOPES[1:]:
        overlap = {name.casefold() for name in aliases['Any']} & {name.casefold() for name in aliases[edition]}
        if overlap:
            raise ValueError('Common and edition stock routes overlap: ' + str(sorted(overlap)))
        mapping = {**aliases['Any'], **aliases[edition]}
        if not 0 < len(mapping) <= 256:
            raise ValueError('Original route table exceeds its bounded contract')
        routes[edition] = ('majesty-community-shared-gpl-v2\n' + ''.join(
            name + '\t' + mapping[name] + '\n' for name in sorted(mapping, key=str.casefold))).encode('ascii')
    args.out.mkdir()
    files = {}
    for scope in SCOPES:
        for suffix in ('.gpl', '.dat'):
            bodies = [text for (owner, (kind, _)), text in final.items()
                      if owner == scope and (kind is DefinitionKind.DAT_BLOCK) == (suffix == '.dat')]
            if not bodies:
                continue
            raw = ('\n\n'.join(bodies) + '\n').encode('cp1252')
            name = scope + '/Merged' + suffix
            path = args.out / 'sources' / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
            files[name] = digest(raw)
    for edition, raw in routes.items():
        path = args.out / 'routes' / edition / 'shared-overrides.tsv'
        path.parent.mkdir(parents=True)
        path.write_bytes(raw)
    (args.out / 'stock-fixture').symlink_to((args.current / 'stock-fixture').resolve(), target_is_directory=True)
    (args.out / 'resources').symlink_to((args.candidate / 'resources').resolve(), target_is_directory=True)
    current.update(files=files, legacyFunctionAliases=aliases,
        resourceFiles=candidate['resourceFiles'], privateActivityTexts=candidate['privateActivityTexts'],
        legacyRoutes={edition: digest(raw) for edition, raw in routes.items()},
        communityExpansions=dict(priorStage=digest(current_raw), creatorStage=digest(candidate_raw),
            ancestorStage=digest(ancestor_raw), policy=digest(Path(__file__).read_bytes()),
            modifications=replacements, scopeMoves=moved, addedStockAliases=added,
            standardSourceCompletion=standard,
            existingLegacyAdaptationsReapplied=True, sourceCompositionQualified=True),
        compiled=False, targetNativeABIQualified=False, browserPlayable=False, published=False)
    (args.out / 'source-stage.json').write_text(json.dumps(current, indent=2) + '\n')
    return dict(modifications=len(replacements), scopeMoves=len(moved), addedStockAliases=len(added),
                routeCounts={scope:len(aliases['Any'])+len(aliases[scope]) for scope in SCOPES[1:]})


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('creator-baseline', 'current', 'candidate', 'standard-package', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    print(json.dumps(stage(parser.parse_args())))

#!/usr/bin/env python3
"""Compose private expansion source with all shipped guilds; never enable it."""
import argparse
from contextlib import contextmanager
from dataclasses import is_dataclass, replace
import importlib.util
import json
from pathlib import Path
import sys
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from lib.community_guild_composition import digest, json_value, stock_named_resources

PARENTS = dict(alchemist=b'CG01', bards=b'CGBD', phantom=b'CGPH', adventurers=b'CGAG', menagerie=b'CGZM')
CHILDREN = {('alchemist', 'brewing'): b'CG02', ('bards', 'bards_recruitment'): b'CGBC',
            ('adventurers', 'quest-board'): b'CGAQ', ('menagerie', 'capture-rewards'): b'CGZC',
            ('menagerie', 'taming'): b'CGZT'}


@contextmanager
def platform_compiler(runner):
    """Use the original proof algorithm through an explicit platform launcher."""
    from majesty_cam import standard_scripts
    original = standard_scripts.Providers
    class PlatformProviders(original):
        def __init__(self, inputs, stock_loader, compiler, *args, **kwargs):
            super().__init__(inputs, stock_loader, runner or compiler, *args, **kwargs)
    standard_scripts.Providers = PlatformProviders
    try:
        yield
    finally:
        standard_scripts.Providers = original


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    sys.modules[name] = result
    spec.loader.exec_module(result)
    return result


def preserve_namespace(controllers, inventories):
    """Retain all shipped guild dialog IDs and reserve separate quest-board IDs."""
    panels = {(panel.owner, panel.raw_panel_key): panel for panel in controllers.panels}
    if len(controllers.panels) != len(CHILDREN) or set(panels) != set(CHILDREN):
        raise ValueError('Require the reviewed expansion child panel inventory')
    reserved = set(PARENTS.values()) | set(CHILDREN.values())
    if len(reserved) != len(PARENTS) + len(CHILDREN):
        raise ValueError('Overlapping parent and child dialog namespace')
    # CG01/CG02 and the source parent dialogs already belong to the pinned
    # shipped guilds. Only newly allocated output IDs must be absent in inputs.
    for inventory in inventories:
        if any(row.key in {b'CGBC', b'CGAG', b'CGAQ', b'CGZM', b'CGZC', b'CGZT'} for row in inventory.resources):
            raise ValueError('Original resource occupies a reserved output dialog ID')
    remap = {panel.resolved_child_dialog_id: CHILDREN[key]
             for key, panel in panels.items()}
    if len(remap) != len(panels):
        raise ValueError('Overlapping child panel allocation')

    def relocate(value, field=''):
        if is_dataclass(value):
            return replace(value, **{name: relocate(item, name)
                                     for name, item in vars(value).items()})
        if isinstance(value, tuple):
            return tuple(relocate(item, field) for item in value)
        if field.endswith('dialog_id') and field != 'source_dialog_id':
            if isinstance(value, bytes):
                return remap.get(value, value)
            if isinstance(value, int):
                numbers = {int.from_bytes(a, 'little'): int.from_bytes(b, 'little')
                           for a, b in remap.items()}
                return numbers.get(value, value)
        return value

    return relocate(controllers)


def compose(fixture, inventories, texts, resolutions, standard_inputs=(), review=None):
    from majesty_cam import compose as c
    from majesty_cam.description_composition import prepare_description_views
    from majesty_cam.script_review import ScriptReviewSession
    from majesty_cam.spell_discovery import discover, transform_descriptions
    from majesty_cam.scoped_output import complete_observer_patches
    from majesty_cam.native_impact import resolve_bundle
    from majesty_cam.stock_controller_registry import (
        encode_stock_controller_registry, decode_stock_controller_registry)
    from majesty_cam.runtime_features import decode_runtime_feature_registry
    review = review or ScriptReviewSession()

    dialogs = c.resolve_building_dialogs(inventories)
    if len(dialogs) != len(PARENTS) or {row.owner for row in dialogs} != set(PARENTS):
        raise ValueError('Require the reviewed expansion building inventory')
    dialogs = tuple(replace(row, resolved_dialog_id=PARENTS[row.owner]) for row in dialogs)
    controllers = preserve_namespace(c.resolve_controller_registry(inventories,
        building_dialogs=dialogs, reserved_dialog_ids=(b'CG00',)), inventories)
    features = c.resolve_runtime_feature_registry(inventories)
    named = stock_named_resources(fixture, {row.key for inventory in inventories
        for row in inventory.resources if row.section == b'WAVE'})
    text = c.merge_text_resources(fixture, inventories, private_activity_texts=texts,
        dialog_resolutions=dialogs, controller_panels=controllers.panels,
        controller_registry=controllers.registry, hero_info_tooltips=bool(features.hero_info_rows),
        stock_named_resources=named)
    bdep = c.merge_bdep_resource(fixture, inventories)
    stock = {key: value[0] for key, value in c._load_effective_stock_descriptions(fixture).items()}
    descriptions, patches, external = prepare_description_views(fixture, inventories, standard_inputs,
        review, None, dialog_resolutions=dialogs)
    descriptions = c.filter_passthrough_descriptions(descriptions, inventories, stock_records=stock)
    c.validate_controller_stock_evidence(fixture, inventories, controllers.registry,
        controller_panels=controllers.panels, controller_toggles=controllers.toggles,
        runtime_feature_registry=features, description_stock_deltas=
        c.analyze_description_stock_deltas(fixture, inventories, descriptions=descriptions),
        external_building_keys=external)
    descriptions, potions = c.prepare_potion_descriptions(descriptions, stock, c.potion_policies(inventories))
    spells = discover(c._spell_policy_bindings(inventories),
        tuple(row.to_element() for row in descriptions.document.records))
    descriptions = transform_descriptions(descriptions, spells)
    bundle = c.prepare_gpl_bundle(fixture, inventories, private_activity_texts=texts,
        semantic_resolutions=resolutions, spell_policy_plan=spells,
        source_context_descriptions=descriptions, potion_plan=potions,
        standard_script_inputs=standard_inputs, script_review=review)
    interceptors = tuple(feature for inventory in inventories
        for feature in inventory.selected.package.definition.runtime_features
        if isinstance(feature, c.ProjectileInterception))
    if interceptors:
        bundle = complete_observer_patches(bundle, tuple(f.callback_symbol for f in interceptors))
    impacts = resolve_bundle(fixture, inventories, bundle, descriptions, patches)
    features, feature_bytes = c.finalize_script_runtime_feature_registry(features, bundle, stock, descriptions)
    controller_bytes = encode_stock_controller_registry(controllers.registry)
    if (decode_stock_controller_registry(controller_bytes) != controllers.registry
            or decode_runtime_feature_registry(feature_bytes) != features):
        raise ValueError('Controller/feature registry roundtrip failed')
    payloads = {'merged_textdata.cam': text.text_archive.to_bytes(),
        'merged_gpltext.cam': text.gpltext_archive.to_bytes(),
        'merged_miscdata.cam': bdep.archive.to_bytes(),
        'merged_descriptions.xml': descriptions.payload,
        'controllers.bin': controller_bytes, 'features.bin': feature_bytes}
    payloads.update({f'merged_descriptions-{scope}.xml': result.payload
                     for scope, result in patches.items()})
    contract = json_value(dict(dialogs=dialogs, controllers=controllers,
        features=features, projectileBindings=impacts))
    return bundle, payloads, contract


def prepare(args):
    if args.out.exists() or args.out.is_symlink():
        raise ValueError('Preserve prior stages; choose a fresh output')
    original = module('expansion_original_preparer', ROOT / 'scripts/prepare-community-guild-gpl.py')
    original.verified_git(args.manager, original.MANAGER_COMMIT)
    sys.path.insert(0, str(args.manager / 'src'))
    inspector = module('expansion_original_inspector', ROOT / 'scripts/inspect-community-expansion-package.py')
    inspections, contracts = {}, {}
    for identity, package in [('adventurers-guild', args.adventurers_package),
                              ('royal-menagerie', args.menagerie_package),
                              ('more-heroes', args.more_heroes_package)]:
        raw = (ROOT / 'content/community-expansions' / identity / 'source-contract.json').read_bytes()
        contracts[identity] = digest(raw)
        inspections[identity] = inspector.inspect(package, json.loads(raw))
    prior_raw = (args.prior / 'source-stage.json').read_bytes()
    prior = json.loads(prior_raw)
    if not prior.get('phantomResilience') or not prior.get('campaignResourceClosure'):
        raise ValueError('Require the current Phantom/campaign-compatible baseline')
    for name, expected in prior['files'].items():
        if Path(name).is_absolute() or '..' in Path(name).parts or '\\' in name:
            raise ValueError('Unsafe prior source path')
        if digest((args.prior / 'sources' / name).read_bytes()) != expected:
            raise ValueError('Qualified baseline source changed: ' + name)
    for name, expected in prior['preparedPhantomFiles'].items():
        if Path(name).is_absolute() or '..' in Path(name).parts or '\\' in name:
            raise ValueError('Unsafe prepared Phantom input path')
        if digest((args.prior / 'phantom-source-package' / name).read_bytes()) != expected:
            raise ValueError('Prepared Phantom input changed: ' + name)
    # Validate all three original inputs before the creator's composition code.
    guild_inspector = module('expansion_existing_inspector', ROOT / 'scripts/inspect-community-guild-package.py')
    guild_inspector.inspect(args.bards_package, json.loads((
        ROOT / 'content/community-mods/bards-hall/source-contract.json').read_text()))
    original_alchemist = module('expansion_alchemist_inspector', ROOT / 'scripts/inspect-alchemist-package.py')
    original_alchemist.inspect(args.alchemist_package)
    from majesty_cam.package import load_package, load_mod_definition
    from majesty_cam import compose as c
    from majesty_cam.gpl import DefinitionKind, parse_gpl
    from lib.community_guild_source_resolutions import resolve
    selected = (
        c.SelectedMod('alchemist', load_package(args.alchemist_package)),
        c.SelectedMod('bards', load_package(args.bards_package)),
        c.SelectedMod('phantom', load_package(args.prior / 'phantom-source-package',
            definition=load_mod_definition(args.manager / 'profiles/poc/phantoms-haunt.mod-definition.json'))),
        c.SelectedMod('adventurers', load_package(args.adventurers_package)),
        c.SelectedMod('menagerie', load_package(args.menagerie_package)),
    )
    inventories = tuple(map(c.inventory_package, selected))
    def functions(inventory):
        return {item.normalized_name: item for source in c._parse_inventory_gpl_sources(inventory)
                for item in source.items if item.kind is DefinitionKind.FUNCTION}
    phantom_text = (args.prior / 'phantom-source-package/GPL/Phantom.gpl').read_text()
    resolutions = resolve(functions(inventories[0]), functions(inventories[2]), phantom_text)
    resolutions = {item.key: c.ScopedSemanticResolution(item, frozenset(('alchemist', 'phantom')))
                   for text in resolutions.values() for item in parse_gpl(text).items}
    fixture = args.prior / 'stock-fixture'
    texts = c.discover_private_activity_texts(fixture, inventories)
    from majesty_cam.standard_scripts import read as read_standard
    more_package = args.more_heroes_package
    more_compatibility = None
    if args.more_heroes_compatible:
        compatible_raw = (args.more_heroes_compatible / 'compatibility-stage.json').read_bytes()
        compatible = json.loads(compatible_raw)
        if (compatible.get('format') != 'majesty-more-heroes-paired-shapeshift-stage-v1'
                or compatible.get('originalContract') != contracts['more-heroes']
                or compatible.get('candidateSourceBytecodeReproductionQualified') is not True):
            raise ValueError('More Heroes compatibility proof differs from the acquired original')
        for name, expected in compatible['files'].items():
            if Path(name).is_absolute() or '..' in Path(name).parts or '\\' in name:
                raise ValueError('Unsafe More Heroes compatibility path')
            if digest((args.more_heroes_compatible / name).read_bytes()) != expected:
                raise ValueError('More Heroes compatible source changed: ' + name)
        more_package = args.more_heroes_compatible
        more_compatibility = digest(compatible_raw)
    standard = read_standard(SimpleNamespace(package_root=more_package,
        manifest_path=more_package / 'MoreHeroes.mmxml',
        content_id='{B26120CB-8A16-4025-B72B-530AB0BE0300}', display_name='More Heroes'))
    from majesty_cam.script_review import ScriptReviewSession
    from majesty_cam.gpl import SemanticItem
    from lib.community_expansion_source_resolutions import resolve as resolve_expansion
    creator_raw = (args.creator_baseline / 'source-stage.json').read_bytes()
    qualified_creator = json.loads((ROOT / 'content/community-mods/source-preparation-verification.json').read_text())
    if digest(creator_raw) != qualified_creator['sourceStage']:
        raise ValueError('Require the compiler-qualified original three-guild source stage')
    creator = json.loads(creator_raw)
    old_raw = (args.creator_baseline / 'sources/Any/Merged.gpl').read_bytes()
    if digest(old_raw) != creator['files']['Any/Merged.gpl']:
        raise ValueError('Original creator source changed')
    old = parse_gpl(old_raw.decode('cp1252'))
    mh = {
        item.normalized_name: item for source in standard.parsed_sources for item in source.items
        if item.kind is DefinitionKind.FUNCTION}
    combined = resolve_expansion(old.require(DefinitionKind.FUNCTION, 'Random_Hero_Type').text,
        old.require(DefinitionKind.FUNCTION, 'Guild_Title').text,
        mh['random_hero_type'].text, mh['guild_title'].text)
    accepted = {}
    class ExpansionReview(ScriptReviewSession):
        def resolve(self, conflict):
            if conflict.dataset == 'majestyexpansion' and conflict.key[1] in combined:
                native = [candidate for candidate in conflict.candidates if candidate.label == 'More Heroes']
                if len(native) != 1 or native[0].item.text != mh[conflict.key[1]].text:
                    raise ValueError('Expansion conflict has an unexpected native provider')
                item = SemanticItem.resolved(conflict.key[0], conflict.name,
                    combined[conflict.key[1]], '<Reviewed additive community expansion resolution>')
                accepted[conflict.name] = dict(result=digest(item.text.encode('cp1252')),
                    candidates={candidate.owner: digest(candidate.item.text.encode('cp1252'))
                                for candidate in conflict.candidates})
                return conflict._validate_item(item)
            return super().resolve(conflict)
    review = ExpansionReview()
    try:
        with platform_compiler(args.sdk_runner):
            bundle, payloads, resolved = compose(fixture, inventories, texts, resolutions, (standard,), review)
    except Exception:
        if review.unresolved:
            failure = args.out.with_suffix('.conflicts.json')
            if not failure.exists():
                failure.write_text(json.dumps(json_value(tuple(review.unresolved)), indent=2) + '\n')
        raise
    payloads['resolved-contracts.json'] = (json.dumps(resolved, indent=2) + '\n').encode()
    args.out.mkdir()
    files = {}
    for scope, result in bundle.outputs:
        for name, text in result.source_set.files.items():
            relative = scope + '/' + name
            target = args.out / 'sources' / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            raw = text.encode('cp1252')
            target.write_bytes(raw)
            files[relative] = digest(raw)
    (args.out / 'resources').mkdir()
    for name, raw in payloads.items():
        (args.out / 'resources' / name).write_bytes(raw)
    result = dict(format='majesty-community-expansion-creator-source-stage-v1',
        managerCommit=original.MANAGER_COMMIT, packageInspections=inspections,
        sourceContracts=contracts, priorStage=digest(prior_raw),
        files=files, resourceFiles={name: digest(raw) for name, raw in payloads.items()},
        existingDialogIDsPreserved=True, privateActivityTexts=len(texts),
        sourceCompositionQualified=True, existingLegacyAdaptationsReapplied=False,
        moreHeroesDatasetBases=list(standard.bases),
        moreHeroesCompatibility=more_compatibility,
        moreHeroesNativeSources={str(path.relative_to(more_package.resolve())): digest(raw)
                                  for path, raw in standard.payloads},
        policy=digest(Path(__file__).read_bytes()),
        resolutionPolicy=digest((ROOT / 'scripts/lib/community_expansion_source_resolutions.py').read_bytes()),
        reviewedAdditiveResolutions=accepted,
        standardCompilerRunner=digest(args.sdk_runner.read_bytes()) if args.sdk_runner else None,
        compiled=False, targetNativeABIQualified=False, browserPlayable=False, published=False)
    (args.out / 'source-stage.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('manager', 'prior', 'creator-baseline', 'alchemist-package', 'bards-package', 'adventurers-package',
                 'menagerie-package', 'more-heroes-package', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--sdk-runner', type=Path,
        help='Optional executable launcher for the unchanged original SDK compiler proof')
    parser.add_argument('--more-heroes-compatible', type=Path,
        help='Verified private paired-cleanup candidate; original package is still required')
    args = parser.parse_args()
    result = prepare(args)
    print(json.dumps({key: result[key] for key in ('format', 'files',
        'sourceCompositionQualified', 'existingLegacyAdaptationsReapplied', 'browserPlayable')}))

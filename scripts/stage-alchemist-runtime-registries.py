#!/usr/bin/env python3
"""Stage the actual community's resolved data contracts; never install or claim playability."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys

CONTRACT = Path(__file__).resolve().parents[1] / 'content/community-mods/alchemist'
DEFAULT_MANAGER = CONTRACT.parents[2] / 'third_party/majesty-mod-manager'
CONTROLLER_TYPES = frozenset([
    'stock.ap10-ap69-secondary-panel.v1', 'stock.ap22-resource-meter.v1',
    'stock.ap99-research-row.v1', 'stock.ap17-upgrade-research-gate.v1',
    'stock.ap24-timed-rage-action.v1', 'stock.ap24-rage-command-action.v1',
    'stock.ap69-sovereign-target-action.v1', 'stock.ap69-sovereign-target-action.v2',
])


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def verified_source(manager):
    """Use only the pinned public community encoder and its transitive data modules."""
    contract = json.loads((CONTRACT / 'source-contract.json').read_text())
    manager = manager.resolve()
    for relative, expected in contract['managerDataModuleSha256'].items():
        path = manager / relative
        if path.is_symlink() or not path.is_file() or path.resolve().is_relative_to(manager) is False:
            raise ValueError(f'Missing or linked community encoder module: {relative}')
        if getattr(path.stat(), 'st_flags', 0) & 0x40000000 or path.stat().st_size > 1024 * 1024:
            raise ValueError(f'Unavailable or oversized community encoder module: {relative}')
        if sha(path.read_bytes()) != expected:
            raise ValueError(f'Community encoder differs from pinned source: {relative}')
    for name, module in tuple(sys.modules.items()):
        if name == 'majesty_cam' or name.startswith('majesty_cam.'):
            if not Path(module.__file__).resolve().is_relative_to(manager):
                raise ValueError('Another community encoder is already imported')
    sys.path.insert(0, str(manager / 'src'))
    return contract


def resolved_dialog(value):
    # Assigned by the eventual package composition step, never a package-owned RVA.
    if not isinstance(value, str) or not re.fullmatch(r'CG[A-Za-z0-9]{2}', value):
        raise ValueError('Resolved controller ID must be a four-character private CG ID')
    return int.from_bytes(value.encode('ascii'), 'little')


def stage(manager, parent, child, output):
    if output.exists():
        raise ValueError('Preserve existing staging output; choose a new directory')
    if parent == child:
        raise ValueError('Parent and child controller IDs must differ')
    mapping = (resolved_dialog(parent), resolved_dialog(child))
    contract = verified_source(manager)
    raw = (CONTRACT / 'mod-definition.json').read_bytes()
    if sha(raw) != contract['definitionSha256']:
        raise ValueError('Pinned Alchemist declaration differs from its source contract')
    definition = json.loads(raw)
    from majesty_cam.runtime_capabilities import encode_runtime_capability_manifest, decode_runtime_capability_manifest
    from majesty_cam.runtime_features import (NameGeneratorFeature, EnchantmentRowFeature,
        RuntimeFeatureRegistry, encode_runtime_feature_registry, decode_runtime_feature_registry,
        derive_feature_runtime_capabilities)
    from majesty_cam.stock_controller_features import parse_controller_feature
    from majesty_cam.stock_controller_registry import (resolve_stock_controller_registry,
        encode_stock_controller_registry, decode_stock_controller_registry)
    from majesty_cam.potion_policy import parse_feature as parse_potion, feature_mapping as potion_mapping
    from majesty_cam.typed_providers import parse_feature as parse_dispatch, feature_mapping as dispatch_mapping
    names, oils, controllers, source_policies = [], [], [], []
    for feature in definition['runtime_features']:
        kind = feature['type']
        if kind == 'stock.name-generator.v1':
            names.append(NameGeneratorFeature(feature['generator_id'], tuple(feature['name_tables'])))
        elif kind == 'stock.ap78-enchantment-row.v1':
            oils.append(EnchantmentRowFeature(feature['overlay_id'], feature['display_text']))
        elif kind in CONTROLLER_TYPES:
            controllers.append(parse_controller_feature(feature))
        elif kind == 'stock.bazaar-potion-policy.v1':
            source_policies.append(potion_mapping(parse_potion(feature)))
        elif kind == 'stock.typed-boolean-dispatch.v1':
            source_policies.append(dispatch_mapping(parse_dispatch(feature)))
        else:
            raise ValueError(f'Unimplemented authored feature: {kind}')
    feature_registry = RuntimeFeatureRegistry(tuple(names), tuple(oils))
    resolved = resolve_stock_controller_registry(controllers, {'brewing': mapping})
    capabilities = derive_feature_runtime_capabilities(
        ['expanded-building-slots.cg-prefix', 'stock.controller-recipes.v1'], feature_registry)
    payloads = {
        'majesty_mod_manager_capabilities.bin': encode_runtime_capability_manifest(capabilities),
        'majesty_mod_manager_features.bin': encode_runtime_feature_registry(feature_registry),
        'majesty_mod_manager_controllers.bin': encode_stock_controller_registry(resolved),
    }
    # Round trips use the actual community decoder before any output is created.
    if decode_runtime_capability_manifest(payloads['majesty_mod_manager_capabilities.bin']) != capabilities:
        raise ValueError('Community capability encoder round trip differs')
    if decode_runtime_feature_registry(payloads['majesty_mod_manager_features.bin']) != feature_registry:
        raise ValueError('Community feature encoder round trip differs')
    if decode_stock_controller_registry(payloads['majesty_mod_manager_controllers.bin']) != resolved:
        raise ValueError('Community controller encoder round trip differs')
    sections = ('panels', 'meters', 'research_rows', 'upgrade_gates', 'timed_rage_actions',
                'rage_command_actions', 'sovereign_target_actions')
    report = dict(format='majesty-alchemist-runtime-staging-v1',
                  sourceCommit=contract['source']['commit'], managerCommit=contract['managerSource']['commit'],
                  definitionSha256=sha(raw), controllerMapping={'brewing': {'parent': parent, 'child': child}},
                  controllerSectionCounts={key: len(getattr(resolved, key)) for key in sections},
                  capabilities=list(capabilities),
                  sourcePolicies=source_policies, sourcePoliciesApplied=False,
                  files={f'DataMX/{name}': {'bytes': len(data), 'sha256': sha(data)}
                         for name, data in payloads.items()},
                  requiredEnvironment={'RECOMP_RULE_INVENTORY_COMPAT': '1'},
                  packageResourcesBound=False, nativeHooksQualified=False,
                  browserPlayable=False, published=False,
                  scope='Private source-bound registries only; assigned IDs need CAM remapping and all native capabilities')
    (output / 'DataMX').mkdir(parents=True)
    for name, data in payloads.items():
        (output / 'DataMX' / name).write_bytes(data)
    (output / 'runtime-staging.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manager-source', default=DEFAULT_MANAGER, type=Path)
    parser.add_argument('--parent-dialog', required=True)
    parser.add_argument('--child-dialog', required=True)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    try:
        report = stage(args.manager_source, args.parent_dialog, args.child_dialog, args.out)
    except (OSError, ValueError) as error:
        parser.exit(1, f'Alchemist registry staging refused: {error}\n')
    print(json.dumps({'controllerSectionCounts': report['controllerSectionCounts'],
                      'browserPlayable': False, 'out': str(args.out)}))


if __name__ == '__main__':
    main()

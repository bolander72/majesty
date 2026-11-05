#!/usr/bin/env python3
"""Add source-identical, edition-scoped exports for the Old first-wins GPL VM."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SCOPES = ('Any', 'Majesty', 'MajestyExpansion')
PREFIX = 'MJC_'


def digest(raw):
    return dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())


def aliases_for_source(text, stock_functions, occupied):
    """Duplicate only public stock collisions; preserve all originals verbatim."""
    from majesty_cam.gpl import DefinitionKind, parse_gpl
    parsed = parse_gpl(text)
    bodies, routes = [], {}
    for item in parsed.items:
        if item.kind != DefinitionKind.FUNCTION or item.normalized_name not in stock_functions:
            continue
        if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]{0,99}', item.name):
            raise ValueError('Unsupported public function identifier')
        alias = PREFIX + item.name
        if alias.casefold() in occupied:
            raise ValueError('Legacy alias collision: ' + alias)
        occupied.add(alias.casefold())
        body, count = re.subn(r'^(\s*function\s+)' + re.escape(item.name) + r'\b',
                             lambda match: match[1] + alias, item.text, count=1, flags=re.I)
        if count != 1:
            raise ValueError('Unsupported authored function header')
        check = parse_gpl(body).require(DefinitionKind.FUNCTION, alias)
        reversed_body = re.sub(r'^(\s*function\s+)' + re.escape(alias) + r'\b',
                              lambda match: match[1] + item.name, check.text, count=1, flags=re.I)
        if reversed_body != item.text:
            raise ValueError('Legacy alias changed an authored function body')
        bodies.append(body)
        routes[item.name] = alias
    return '\n\n'.join(bodies) + '\n', routes


def prepare(source, manager, output):
    if output.exists() or output.is_symlink():
        raise ValueError('Preserve prior sources; choose a fresh output')
    path = ROOT / 'scripts/prepare-community-guild-gpl.py'
    spec = importlib.util.spec_from_file_location('community_original_policy', path)
    policy = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(policy)
    policy.verified_git(manager, policy.MANAGER_COMMIT)
    sys.path.insert(0, str(manager / 'src'))
    from majesty_cam.gpl import DefinitionKind, parse_gpl
    report_raw = (source / 'source-stage.json').read_bytes()
    report = json.loads(report_raw)
    if (report.get('format') != 'majesty-community-combined-creator-gpl-stage-v1'
            or report.get('managerCommit') != policy.MANAGER_COMMIT
            or report.get('legacyFunctionAliases')):
        raise ValueError('Require the unaliased authentic combined source')
    helper_spec = importlib.util.spec_from_file_location('community_original_sdk_sources',
        ROOT / 'scripts/compose-alchemist-gameplay.py')
    helpers = importlib.util.module_from_spec(helper_spec)
    helper_spec.loader.exec_module(helpers)
    stock, captured = set(), {}
    for project in helpers.PROJECTS:
        for parsed in helpers.project_sources(source / 'stock-fixture',
                'SDK/OriginalQuests/' + project, captured):
            stock.update(item.normalized_name for item in parsed.items
                         if item.kind == DefinitionKind.FUNCTION)
    if any(report['stockFixture']['inputs'].get(name) != value for name, value in captured.items()):
        raise ValueError('Original SDK source binding changed')
    payloads = {}
    names_by_scope = {}
    for name, expected in report['files'].items():
        parts = Path(name).parts
        if (len(parts) != 2 or parts[0] not in SCOPES
                or Path(name).suffix not in ('.gpl', '.dat')):
            raise ValueError('Unexpected combined source inventory')
        path = source / 'sources' / name
        if path.is_symlink() or path.stat().st_size > 2 * 1024 * 1024:
            raise ValueError('Unavailable source input')
        raw = path.read_bytes()
        if digest(raw) != expected:
            raise ValueError('Combined source changed: ' + name)
        payloads[name] = raw
        if name.endswith('.gpl'):
            names_by_scope.setdefault(parts[0], set()).update(
                item.normalized_name for item in parse_gpl(raw.decode('cp1252')).items)
    routes = {}
    all_originals = set().union(*names_by_scope.values())
    for scope in SCOPES:
        occupied = all_originals | {v.casefold() for v in routes.get('Any', {}).values()}
        bodies, mapping = [], {}
        for name, raw in sorted(payloads.items()):
            if Path(name).parts[0] != scope or not name.endswith('.gpl'):
                continue
            body, aliases = aliases_for_source(raw.decode('cp1252'), stock, occupied)
            if mapping.keys() & aliases.keys():
                raise ValueError('Duplicate scoped alias')
            bodies.append(body)
            mapping.update(aliases)
        routes[scope] = mapping
        payloads[scope + '/ZZ_LegacyAliases.gpl'] = '\n'.join(bodies).encode('cp1252')
    route_files = {}
    for edition in SCOPES[1:]:
        if {k.casefold() for k in routes['Any']} & {k.casefold() for k in routes[edition]}:
            raise ValueError('Common and edition aliases overlap')
        mapping = {**routes['Any'], **routes[edition]}
        if not 0 < len(mapping) <= 256:
            raise ValueError('Unsupported native route count')
        route_files[edition] = ('majesty-community-shared-gpl-v2\n' + ''.join(
            name + '\t' + mapping[name] + '\n' for name in sorted(mapping, key=str.casefold))).encode('ascii')
    output.mkdir(parents=True)
    for name, raw in payloads.items():
        path = output / 'sources' / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)
    for edition, raw in route_files.items():
        path = output / 'routes' / edition / 'shared-overrides.tsv'
        path.parent.mkdir(parents=True)
        path.write_bytes(raw)
    report.update(legacyFunctionAliases=routes, legacyOriginalStage=digest(report_raw),
        legacyRoutes={k: digest(v) for k, v in route_files.items()},
        originalExportsAndFunctionBodiesPreserved=True, stockCollisionAliasesOnly=True,
        files={name: digest(raw) for name, raw in payloads.items()},
        compiled=False, targetNativeABIQualified=False, browserPlayable=False, published=False)
    (output / 'source-stage.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('source', 'manager', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    report = prepare(args.source, args.manager, args.out)
    print(json.dumps({scope: len(values) for scope, values in report['legacyFunctionAliases'].items()}))

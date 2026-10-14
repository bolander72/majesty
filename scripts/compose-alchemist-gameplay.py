#!/usr/bin/env python3
"""Apply the community's real source policies in private staging, without installing content."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path, PureWindowsPath
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
PROJECTS = ('GPL/path.gplproj', 'GPLMx/Path_MajMisc.gplproj',
            'GPLMx/Path_Build.gplproj', 'GPLMx/Path_Data.gplproj',
            'GPLMx/Path_Decision.gplproj', 'GPLMx/Path_Task.gplproj')
ROW = re.compile(r'\s*(source|data)\s*=\s*"([^"]+)"\s*', re.I)


def helper(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def capture(root, relative, hashes):
    """Read explicit project inputs only; reject symlinks, traversal and unavailable files."""
    parts = PureWindowsPath(relative).parts
    if (not parts or PureWindowsPath(relative).is_absolute()
            or PureWindowsPath(relative).drive or any(x in ('.', '..') for x in parts)):
        raise ValueError('Unsafe source path: ' + relative)
    current = root
    for part in parts:
        # SDK project rows use Windows casing even on case-sensitive volumes.
        matches = [p for p in current.iterdir() if p.name.casefold() == part.casefold()]
        if len(matches) != 1 or matches[0].is_symlink():
            raise ValueError('Missing, ambiguous or linked source: ' + relative)
        current = matches[0]
    if (not current.is_file() or current.stat().st_size > 2 * 1024 * 1024
            or getattr(current.stat(), 'st_flags', 0) & 0x40000000):
        raise ValueError('Unavailable or oversized source: ' + relative)
    raw = current.read_bytes()
    name = current.relative_to(root).as_posix()
    digest = hashlib.sha256(raw).hexdigest()
    if name in hashes and hashes[name]['sha256'] != digest:
        raise ValueError('Source changed while capturing: ' + name)
    hashes[name] = dict(bytes=len(raw), sha256=digest)
    return raw, name


def project_sources(root, relative, hashes):
    from majesty_cam.gpl import parse_gpl, parse_dat
    raw, name = capture(root, relative, hashes)
    parsed = []
    for number, line in enumerate(raw.decode('cp1252').splitlines(), 1):
        if not line.strip():
            continue
        match = ROW.fullmatch(line)
        if not match:
            raise ValueError(f'Unsupported project row {name}:{number}')
        rowpath = PureWindowsPath(match[2])
        if rowpath.is_absolute() or rowpath.drive or '..' in rowpath.parts:
            raise ValueError('Unsafe project input')
        child = (Path(name).parent / Path(*rowpath.parts)).as_posix()
        raw, child = capture(root, child, hashes)
        expected = '.gpl' if match[1].casefold() == 'source' else '.dat'
        if Path(child).suffix.casefold() != expected:
            raise ValueError('Unexpected project input type: ' + child)
        parser = parse_gpl if expected == '.gpl' else parse_dat
        parsed.append(parser(raw.decode('cp1252'), child))
    return tuple(parsed)


def compose(package, sdk, output, manager=None):
    if output.exists():
        raise ValueError('Preserve existing staging output; choose a new directory')
    inspection = helper('alchemist_package_policy', 'inspect-alchemist-package.py')
    inspection.inspect(package)
    staging = helper('alchemist_registry_policy', 'stage-alchemist-runtime-registries.py')
    contract = staging.verified_source(manager or staging.DEFAULT_MANAGER)
    from majesty_cam.gpl import DefinitionKind, SemanticMergeResult
    from majesty_cam.descriptions import parse_descriptions, DescriptionMergeResult
    from majesty_cam.potion_policy import parse_feature as potion_feature, prepare_descriptions, compose as apply_potions
    from majesty_cam.typed_providers import parse_feature as typed_feature, compose_dispatches
    definition = json.loads((inspection.CONTRACT / 'mod-definition.json').read_text())
    potion = tuple(potion_feature(f) for f in definition['runtime_features']
                   if f['type'] == 'stock.bazaar-potion-policy.v1')
    typed = tuple(typed_feature(f) for f in definition['runtime_features']
                  if f['type'] == 'stock.typed-boolean-dispatch.v1')
    stock_hashes, package_hashes = {}, {}
    stock_sources = tuple(s for project in PROJECTS for s in
                          project_sources(sdk, 'SDK/OriginalQuests/' + project, stock_hashes))
    sources = project_sources(package, 'GPL/Alchemist.gplproj', package_hashes)
    stock = {item.key: item for source in stock_sources for item in source.items}
    owned = {}
    for source in sources:
        for item in source.items:
            if item.key in owned:
                raise ValueError('Duplicate package definition: ' + item.name)
            owned[item.key] = item
    # Includes all loaded sources when auditing literal capability installations.
    dispatch = compose_dispatches((('stock', (), stock_sources), ('Alchemist', typed, sources)))
    owned.update((item.key, item) for item in dispatch)
    stock_records = {}
    for directory in ('Data', 'DataMX'):
        for relative in sorted((sdk / 'SDK/OriginalQuests' / directory).glob('*.xml')):
            raw, name = capture(sdk, relative.relative_to(sdk).as_posix(), stock_hashes)
            document = parse_descriptions(raw, source=name)
            stock_records.update(document.index)
    records = {}
    for path in sorted((package / 'Data').glob('*.xml')):
        raw, name = capture(package, path.relative_to(package).as_posix(), package_hashes)
        document = parse_descriptions(raw, source=name)
        for record in document.records:
            if record.key in records:
                raise ValueError('Duplicate package description: ' + repr(record.key))
            records[record.key] = record
    root = ET.Element('Majesty')
    root[:] = [records[key].to_element() for key in sorted(records)]
    payload = ET.tostring(root, encoding='utf-8')
    descriptions = DescriptionMergeResult(parse_descriptions(payload), payload, (), ())
    descriptions, plan = prepare_descriptions(descriptions, stock_records, potion)
    def stock_loader(names):
        keys = [(DefinitionKind.FUNCTION, name.casefold()) for name in names]
        missing = [key[1] for key in keys if key not in stock]
        if missing:
            raise ValueError('Missing installed stock function: ' + ', '.join(missing))
        return {key: stock[key] for key in keys}
    result, events = apply_potions(SemanticMergeResult(tuple(owned.values()), ()), plan, stock_loader, {})
    payloads = {
        'Alchemist_Composed.gpl': result.render(kinds=(DefinitionKind.FUNCTION,
                                                     DefinitionKind.EXPRESSION,
                                                     DefinitionKind.PROTOTYPE)).encode('cp1252'),
        'Alchemist_Composed.dat': result.render(kinds=(DefinitionKind.DAT_BLOCK,)).encode('cp1252'),
        'Alchemist_Composed.xml': descriptions.payload,
        'Alchemist_Composed.gplproj': b'data="Alchemist_Composed.dat"\nsource="Alchemist_Composed.gpl"\n',
    }
    report = dict(format='majesty-alchemist-source-composition-v1',
                  managerCommit=contract['managerSource']['commit'],
                  definitionSha256=contract['definitionSha256'],
                  stockInputs=stock_hashes, packageInputs=package_hashes,
                  sourcePoliciesApplied=True, typedDispatchSymbols=[item.name for item in dispatch],
                  potionActions=[dict(name=action.name, effect=action.effect,
                                      validator=action.validator) for action in plan.actions],
                  definitionCount=len(result.items), descriptionCount=len(descriptions.document.records),
                  observerBaselines=sorted(events),
                  files={name: dict(bytes=len(raw), sha256=staging.sha(raw)) for name, raw in payloads.items()},
                  stockSourceBytecodeEquivalenceQualified=False, compilerInvoked=False,
                  legacyDescriptionsConverted=False, nativeHooksQualified=False,
                  browserPlayable=False, published=False)
    # Create no output until every source boundary and original community policy passed.
    output.mkdir(parents=True)
    for name, raw in payloads.items():
        (output / name).write_bytes(raw)
    (output / 'source-composition.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--package', type=Path, required=True)
    parser.add_argument('--game-source', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    try:
        report = compose(args.package, args.game_source, args.out)
    except (OSError, ValueError) as error:
        parser.exit(1, f'Alchemist source composition refused: {error}\n')
    print(json.dumps({key: report[key] for key in ('definitionCount', 'descriptionCount',
                                                 'sourcePoliciesApplied', 'browserPlayable')}))


if __name__ == '__main__':
    main()

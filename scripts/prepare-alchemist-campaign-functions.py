#!/usr/bin/env python3
"""Bind the Alchemist's expansion helper into its own compiled script library.

Original campaigns do not load all expansion helper functions or expressions.
Import their referenced official SDK definitions without changing the
community's callers, existing exports, compiled identities or gameplay rules.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'third_party/majesty-mod-manager/src'))
from majesty_cam.gpl import DefinitionKind, parse_gpl

FILES = ('Alchemist_Composed.gpl', 'Alchemist_Composed.dat',
         'Alchemist_Composed.gplproj', 'shared-overrides.tsv')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def read(path):
    if (path.is_symlink() or not path.is_file() or path.stat().st_size > 2 * 1024 * 1024
            or getattr(path.stat(), 'st_flags', 0) & 0x40000000):
        raise ValueError('Unavailable campaign compatibility input: ' + path.name)
    return path.read_bytes()


def prepare(source, sdk_helper, output):
    if output.exists():
        raise ValueError('Preserve existing output')
    prior = read(source / 'source-composition.json')
    report = json.loads(prior)
    if (report.get('format') != 'majesty-alchemist-source-composition-v1'
            or report.get('sourcePoliciesApplied') is not True
            or not report.get('legacyFunctionAliases') or report.get('campaignHelperImports')):
        raise ValueError('Require qualified shared-function source without prior helper imports')
    payloads = {name: read(source / name) for name in FILES}
    for name, raw in payloads.items():
        if report['files'].get(name) != dict(bytes=len(raw), sha256=sha(raw)):
            raise ValueError('Source binding differs: ' + name)
    original = payloads[FILES[0]].decode('cp1252')
    definitions = parse_gpl(original, FILES[0]).items
    if any(item.normalized_name == 'gettruepalace' for item in definitions):
        raise ValueError('Campaign helper already declared')
    stock_raw = read(sdk_helper)
    matches = [item for item in parse_gpl(stock_raw.decode('cp1252'), sdk_helper.name).items
               if item.kind == DefinitionKind.FUNCTION and item.normalized_name == 'gettruepalace']
    if len(matches) != 1:
        raise ValueError('Require official SDK GetTruePalace definition')
    helper = matches[0]
    if not re.search(r'function\s+GetTruePalace\s*\(\s*agent\s+\w+\s*\)\s+is\s+agent\b',
                     helper.text, re.I):
        raise ValueError('Require original palace agent return type')
    # Some expansion helpers live below TaskModules, and those helpers have
    # their own dependencies. Follow the complete SDK tree to a fixed point.
    # Missing item expressions become void values; missing helpers become
    # NullFunction. Both throw when assigned to the hero's typed locals/lists.
    sdk_root = sdk_helper.parent.parent
    stock = {}
    for directory in ('GPL', 'GPLMx'):
        if not (sdk_root / directory).is_dir():
            raise ValueError('Require original and expansion SDK libraries')
        entries = {}
        for path in sorted((sdk_root / directory).rglob('*.gpl')):
            raw = read(path)
            for item in parse_gpl(raw.decode('cp1252'), path.name).items:
                if item.kind in (DefinitionKind.EXPRESSION, DefinitionKind.FUNCTION):
                    entries[(item.kind, item.normalized_name)] = (item, path, raw)
        stock[directory] = entries
    local = {(item.kind, item.normalized_name) for item in definitions}
    selected = {}
    pending = original
    while True:
        referenced = {(DefinitionKind.EXPRESSION, '#' + name.casefold()) for name in
                      re.findall(r'#([A-Za-z_]\w*)', pending)}
        referenced.update((DefinitionKind.FUNCTION, name.casefold()) for name in
                          re.findall(r'\$([A-Za-z_]\w*)', pending))
        needed = referenced & stock['GPLMx'].keys() - stock['GPL'].keys() - local - selected.keys()
        if not needed:
            break
        for key in needed:
            selected[key] = stock['GPLMx'][key]
        pending = '\n'.join(selected[key][0].text for key in needed)
    imports = [selected[key] for key in sorted(selected, key=lambda key: (key[0].value, key[1]))]
    expressions = [entry for entry in imports if entry[0].kind == DefinitionKind.EXPRESSION]
    functions = [entry for entry in imports if entry[0].kind == DefinitionKind.FUNCTION]
    if not any(item.normalized_name == 'gettruepalace' for item, _, _ in functions):
        raise ValueError('Campaign palace dependency was not imported')
    extended = ('\n\n'.join(item.text for item, _, _ in expressions) + '\n\n' + original
                + '\n\n' + '\n\n'.join(item.text for item, _, _ in functions) + '\n')
    parsed = parse_gpl(extended, FILES[0]).items
    before = {(item.kind, item.normalized_name): item.text for item in definitions}
    after = {(item.kind, item.normalized_name): item.text for item in parsed}
    if any(after.get(key) != body for key, body in before.items()):
        raise ValueError('Existing authored definition changed')
    payloads[FILES[0]] = extended.encode('cp1252')
    report.update(campaignHelperImports=[dict(name=item.name,
                      sdkFile=path.relative_to(sdk_root).as_posix(),
                      sdkFileSha256=sha(raw), bodySha256=sha(item.text.encode('cp1252')))
                      for item, path, raw in functions],
                  campaignExpressionImports=[dict(name=item.name,
                      sdkFile=path.relative_to(sdk_root).as_posix(),
                      sdkFileSha256=sha(raw), bodySha256=sha(item.text.encode('cp1252')))
                      for item, path, raw in expressions],
                  campaignHelperPriorCompositionSha256=sha(prior),
                  originalExportsAndFunctionBodiesPreserved=True,
                  compilerInvoked=False, bytecodeCompiled=False, nativeHooksQualified=False,
                  browserPlayable=False, published=False)
    report['files'].update({name: dict(bytes=len(raw), sha256=sha(raw))
                            for name, raw in payloads.items()})
    output.mkdir(parents=True)
    for name, raw in payloads.items():
        (output / name).write_bytes(raw)
    (output / 'source-composition.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('source', 'sdk-helper', 'out'):
        parser.add_argument('--' + name, required=True, type=Path)
    args = parser.parse_args()
    try:
        prepare(args.source, args.sdk_helper, args.out)
    except (OSError, ValueError) as error:
        parser.exit(1, f'Alchemist campaign preparation refused: {error}\n')
    print('Official campaign helper staged; compilation and gameplay checks remain required')

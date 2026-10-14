#!/usr/bin/env python3
"""Add source-identical named ABI exports for the legacy first-wins GPL linker.

Original exports and gameplay bodies remain intact. Compile the resulting
project with the official SDK before enabling its separate runtime route map.
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

PREFIX = 'MJA_'
FILES = ('Alchemist_Composed.gpl', 'Alchemist_Composed.dat', 'Alchemist_Composed.gplproj')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def available(path):
    if (path.is_symlink() or not path.is_file() or path.stat().st_size > 2 * 1024 * 1024
            or getattr(path.stat(), 'st_flags', 0) & 0x40000000):
        raise ValueError('Unavailable source input: ' + path.name)
    return path.read_bytes()


def prepare(source, output):
    if output.exists():
        raise ValueError('Preserve existing output')
    report_raw = available(source / 'source-composition.json')
    report = json.loads(report_raw)
    if (report.get('format') != 'majesty-alchemist-source-composition-v1'
            or report.get('sourcePoliciesApplied') is not True or report.get('legacyFunctionAliases')):
        raise ValueError('Require original composed source policies without prior aliases')
    inputs = {name: available(source / name) for name in FILES}
    for name, raw in inputs.items():
        if report['files'].get(name) != dict(bytes=len(raw), sha256=sha(raw)):
            raise ValueError('Composed input changed: ' + name)
    original = inputs[FILES[0]].decode('cp1252')
    parsed = parse_gpl(original, FILES[0])
    functions = [item for item in parsed.items if item.kind == DefinitionKind.FUNCTION]
    if not 1 <= len(functions) <= 128:
        raise ValueError('Unsupported function count')
    occupied = {item.normalized_name for item in parsed.items}
    aliases, bodies = {}, []
    for item in functions:
        if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]{0,100}', item.name):
            raise ValueError('Unsupported function identifier')
        alias = PREFIX + item.name
        if alias.casefold() in occupied:
            raise ValueError('Alias collision: ' + alias)
        occupied.add(alias.casefold())
        pattern = re.compile(r'^(\s*function\s+)' + re.escape(item.name) + r'\b', re.I)
        body, count = pattern.subn(lambda match: match[1] + alias, item.text, count=1)
        if count != 1:
            raise ValueError('Unsupported function header: ' + item.name)
        aliases[item.name] = alias
        bodies.append(body)
    extended = original + '\n\n' + '\n\n'.join(bodies) + '\n'
    reparsed = parse_gpl(extended, FILES[0])
    by_name = {item.name.casefold(): item for item in reparsed.items
               if item.kind == DefinitionKind.FUNCTION}
    for item in functions:
        alias = aliases[item.name]
        reverse = re.sub(r'^(\s*function\s+)' + re.escape(alias) + r'\b',
                         lambda match: match[1] + item.name, by_name[alias.casefold()].text,
                         count=1, flags=re.I)
        if reverse != item.text or by_name[item.normalized_name].text != item.text:
            raise ValueError('Function body or original export changed')
    outputs = dict(inputs)
    outputs[FILES[0]] = extended.encode('cp1252')
    routes = ('majesty-alchemist-shared-gpl-v1\n' + ''.join(
        f'{name}\t{aliases[name]}\n' for name in sorted(aliases, key=str.casefold))).encode('ascii')
    outputs['shared-overrides.tsv'] = routes
    report['legacyFunctionAliases'] = aliases
    report['legacyAliasOriginalCompositionSha256'] = sha(report_raw)
    report['legacyAliasOriginalSourceSha256'] = sha(inputs[FILES[0]])
    report['originalExportsAndFunctionBodiesPreserved'] = True
    report['compilerInvoked'] = False
    report['bytecodeCompiled'] = False
    report['nativeHooksQualified'] = False
    report['browserPlayable'] = False
    report['published'] = False
    report['files'].update({name: dict(bytes=len(raw), sha256=sha(raw))
                            for name, raw in outputs.items()})
    output.mkdir(parents=True)
    for name, raw in outputs.items():
        (output / name).write_bytes(raw)
    (output / 'source-composition.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    try:
        result = prepare(args.source, args.out)
    except (OSError, ValueError, KeyError) as error:
        parser.exit(1, f'Shared-function ABI staging refused: {error}\n')
    print(f'Staged {len(result["legacyFunctionAliases"])} source-identical ABI exports; not compiled or installed')

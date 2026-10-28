#!/usr/bin/env python3
"""Pair More Heroes' existing magic forms with matching stock potion cleanup."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from lib.community_guild_composition import digest

MAGIC_HEROES = ('Necromancer', 'Fire_Witch', 'Lightning_Lord', 'Fallen_Angel',
                'Minstrel', 'Mystic', 'Timewalker')


def matching_cleanup(stock_effect, stock_cleanup, custom_effect):
    from majesty_cam.gameplay_events import _additive_title_reference
    from majesty_cam.gpl_function_merge import same_function_instructions
    proof = _additive_title_reference(stock_effect, custom_effect)
    expected = ((('"Priestess"', '"Wizard"', '"Healer"'),
                 tuple('"' + name + '"' for name in ('Priestess', 'Wizard', 'Healer', *MAGIC_HEROES))),)
    if (proof is None or proof[1] != expected
            or not same_function_instructions(proof[0], custom_effect)):
        raise ValueError('More Heroes shapeshift differs beyond the seven magic-title additions')
    pattern = r'title\s*==\s*"Priestess"\s*\|\|\s*title\s*==\s*"Wizard"\s*\|\|\s*title\s*==\s*"Healer"'
    replacement = ' || '.join('title == "' + name + '"'
                             for name in ('Priestess', 'Wizard', 'Healer', *MAGIC_HEROES))
    cleanup, count = re.subn(pattern, replacement, stock_cleanup)
    check = _additive_title_reference(stock_cleanup, cleanup)
    if count != 1 or check is None or check[1] != proof[1]:
        raise ValueError('Stock cleanup title branch differs')
    return cleanup


def stage(args):
    if args.out.exists() or args.out.is_symlink():
        raise ValueError('Preserve prior candidates; choose a fresh output')
    sys.path.insert(0, str(args.manager / 'src'))
    from majesty_cam.gpl import DefinitionKind, parse_gpl
    from majesty_cam.stock_gpl import load_stock_function_ancestors
    from majesty_cam.standard_scripts import read, verify
    spec = importlib.util.spec_from_file_location('more_heroes_inspection',
        ROOT / 'scripts/inspect-community-expansion-package.py')
    inspector = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(inspector)
    contract_raw = (ROOT / 'content/community-expansions/more-heroes/source-contract.json').read_bytes()
    contract = json.loads(contract_raw)
    inspector.inspect(args.package, contract)
    compiler = args.fixture / 'SDK/Gplbcc.exe'
    if hashlib.sha256(compiler.read_bytes()).hexdigest() != '8cfbf6fff1cf90d7aaf334392352515eb0f989a35a16bc99f225e52af38820c4':
        raise ValueError('Original SDK compiler changed')
    def entry(package):
        return SimpleNamespace(package_root=package, manifest_path=package / 'MoreHeroes.mmxml',
            content_id=contract['canonicalGuid'], display_name='More Heroes')
    original = read(entry(args.package))
    verify(original, args.sdk_runner)
    stock = load_stock_function_ancestors(args.fixture, ('Shapeshift_Potion_Effect', 'Shapeshift_Potion_End'))
    raw = (args.package / 'GPL/MoreHeroes.gpl').read_bytes()
    parsed = parse_gpl(raw.decode('cp1252'))
    custom = parsed.require(DefinitionKind.FUNCTION, 'Shapeshift_Potion_Effect')
    if any(item.normalized_name == 'shapeshift_potion_end' for source in original.parsed_sources for item in source.items):
        raise ValueError('The original package already defines a potion cleanup; review its version')
    cleanup = matching_cleanup(stock[DefinitionKind.FUNCTION, 'shapeshift_potion_effect'].text,
        stock[DefinitionKind.FUNCTION, 'shapeshift_potion_end'].text, custom.text)
    shutil.copytree(args.package, args.out)
    (args.out / 'GPL/MoreHeroes.gpl').write_bytes(raw + b'\r\n' + cleanup.encode('cp1252'))
    project = args.out / 'Compatibility.gplproj'
    project.write_text('source="GPL\\MoreHeroes.gpl"\n'
        'data="GPL\\MoreHeroes_Data.dat"\nsource="GPL\\MoreHeroes_DecisionTrees.gpl"\n')
    process = subprocess.run([str(args.sdk_runner), '-in', project.name, '-out',
        'Data/MoreHeroes.bcd', '-stdout'], cwd=args.out, capture_output=True, timeout=60)
    (args.out / 'compiler.log').write_bytes(process.stdout + process.stderr)
    if process.returncode:
        raise ValueError('Original SDK failed the paired cleanup candidate; inspect private compiler.log')
    verify(read(entry(args.out)), args.sdk_runner)
    files = {path.relative_to(args.out).as_posix(): digest(path.read_bytes())
             for path in sorted(args.out.rglob('*')) if path.is_file()}
    changed = [name for name, record in contract['packageFiles'].items() if files[name] != record]
    if changed != ['Data/MoreHeroes.bcd', 'GPL/MoreHeroes.gpl']:
        raise ValueError('Unexpected More Heroes adaptation scope')
    result = dict(format='majesty-more-heroes-paired-shapeshift-stage-v1',
        originalContract=digest(contract_raw), originalPackageInventorySha256=contract['packageInventorySha256'],
        originalSourceBytecodeReproductionQualified=True, candidateSourceBytecodeReproductionQualified=True,
        compilerSha256=hashlib.sha256(compiler.read_bytes()).hexdigest(),
        policy=digest(Path(__file__).read_bytes()), files=files, changedOriginalPaths=changed,
        magicHeroTitles=list(MAGIC_HEROES), originalEffectsAndRangedPrecedencePreserved=True,
        matchingCleanupAdded=True, nativeRoundTripQualified=False, browserPlayable=False, published=False)
    (args.out / 'compatibility-stage.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('package', 'manager', 'fixture', 'sdk-runner', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    result = stage(parser.parse_args())
    print(json.dumps({key: result[key] for key in ('format', 'changedOriginalPaths',
        'originalSourceBytecodeReproductionQualified', 'candidateSourceBytecodeReproductionQualified')}))

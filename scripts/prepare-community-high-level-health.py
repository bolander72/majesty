#!/usr/bin/env python3
"""Stage arithmetic-only high-level HP corrections without altering creator inputs."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'scripts'), str(ROOT / 'third_party/majesty-mod-manager/src')]
from majesty_cam.gpl import parse_gpl, DefinitionKind
from lib.community_creator_baseline import verify_compiled_baseline

# The deployed guild-usability-v1 libraries. Require all three, so an earlier
# recovered stage can never be mistaken for the current complete collection.
CURRENT_OUTPUTS = {
    'common': (37409957, 'd0902fa5653d87cd6c5e0d57eb02941ffa3c5c9c3a166d5aca74be8d04b5c741', 1108),
    'base': (946028, '85cbbbd1dd63fe3db48e25e5cfea97ecb1d8fe67e88c80c3656ea50d489521f1', 175),
    'expansion': (1738800, '9513523bf234bb7676c0bc846e3617b04f23a5c06ee9dc98632ceb01b1462190', 209),
}

CURRENT_STOCK = dict(bytes=46868, sha256='aa06163bdc5de6e68fa5d01bf50beb7c2154536a76386c6287ed29233212c064')
CURRENT_ROUTES = {
    'Majesty': dict(bytes=5780, sha256='683755f5ab24cf3216f37919cc2a2fffcfdf16b738f292993d6c9b6714609062'),
    'MajestyExpansion': dict(bytes=5748, sha256='213379d06fb0b0dd533d2105b6627885c61bf9a30efe9b8b089fc302152876c5'),
}


def digest(raw):
    return dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())


def adapt(raw, stock_low_hp):
    text = raw.decode('cp1252')
    if 'MJP_Health_Percent' in text or 'MJP_Scale_Living_HP' in text:
        raise ValueError('Health arithmetic adaptation already present; reconcile existing stage')
    parsed = parse_gpl(text)
    changes = []
    for name, replacements in {
        'Eternal_Soul_Begin': [
            ('bonus_max_hp = (base_max_hp * 30) / 100;',
             'bonus_max_hp = (base_max_hp / 100) * 30 + ((base_max_hp % 100) * 30) / 100;'),
            ('boosted_hp = ((current_hp * boosted_max_hp) + (base_max_hp / 2)) / base_max_hp;',
             'boosted_hp = $MJP_Scale_Living_HP(current_hp, base_max_hp, boosted_max_hp);')],
        'Eternal_Soul_End': [
            ('restored_hp = ((current_hp * base_max_hp) + (boosted_max_hp / 2)) / boosted_max_hp;',
             'restored_hp = $MJP_Scale_Living_HP(current_hp, boosted_max_hp, base_max_hp);')],
    }.items():
        item = parsed.require(DefinitionKind.FUNCTION, name)
        updated = item.text
        for before, after in replacements:
            if updated.count(before) != 1:
                raise ValueError('Unreviewed health expression: ' + name)
            updated = updated.replace(before, after, 1)
        changes.append((item.span.start, item.span.end, updated))
    item = parsed.require(DefinitionKind.FUNCTION, 'Eval_For_Healing')
    pattern = (r'\(\$GetAttribute\(Hero, #ATTRIB_HP\) \* 100\) /\s*'
               r'\$GetAttribute\(Hero, #ATTRIB_MaxHP\)')
    updated, count = re.subn(pattern,
        '$MJP_Health_Percent($GetAttribute(Hero, #ATTRIB_HP), $GetAttribute(Hero, #ATTRIB_MaxHP))', item.text)
    if count != 1:
        raise ValueError('Unreviewed healing-selection percentage')
    changes.append((item.span.start, item.span.end, updated))
    for start, end, updated in sorted(changes, reverse=True):
        text = text[:start] + updated + text[end:]
    # This shared stock rule protects every hero class, not only Phantoms.
    stock = parse_gpl(stock_low_hp).require(DefinitionKind.FUNCTION, 'haslowHP').text
    original = '((HP * 100) / maxHP)'
    if stock.count(original) != 1:
        raise ValueError('Unreviewed stock low-health rule')
    try:
        parsed.require(DefinitionKind.FUNCTION, 'haslowHP')
    except KeyError:
        pass
    else:
        raise ValueError('Source already overrides HasLowHP; review that policy first')
    text += '\n\n' + stock.replace(original, '$MJP_Health_Percent(HP, maxHP)') + '\n'
    return text.encode('cp1252')


def adapt_current(raw, stock_low_hp):
    text = raw.decode('cp1252')
    parsed = parse_gpl(text)
    if any(i.normalized_name in ('mjp_health_percent', 'haslowhp', 'mjc_haslowhp') for i in parsed.items):
        raise ValueError('Health percentage adaptation already present')
    # Preserve the already deployed Phantom resilience and proportional helper.
    parsed.require(DefinitionKind.FUNCTION, 'MJP_Scale_Living_HP')
    edits = []
    for name in ('Eval_For_Healing', 'MJC_Eval_For_Healing'):
        item = parsed.require(DefinitionKind.FUNCTION, name)
        updated, count = re.subn(
            r'\(\$GetAttribute\(Hero, #ATTRIB_HP\) \* 100\) /\s*\$GetAttribute\(Hero, #ATTRIB_MaxHP\)',
            '$MJP_Health_Percent($GetAttribute(Hero, #ATTRIB_HP), $GetAttribute(Hero, #ATTRIB_MaxHP))', item.text)
        if count != 1:
            raise ValueError('Unreviewed current healing-selection percentage: ' + name)
        edits.append((item.span.start, item.span.end, updated))
    for start, end, body in sorted(edits, reverse=True):
        text = text[:start] + body + text[end:]
    stock = parse_gpl(stock_low_hp).require(DefinitionKind.FUNCTION, 'haslowHP').text
    if stock.count('((HP * 100) / maxHP)') != 1:
        raise ValueError('Unreviewed stock low-health rule')
    rule = stock.replace('((HP * 100) / maxHP)', '$MJP_Health_Percent(HP, maxHP)')
    alias, count = re.subn(r'^(function\s+)haslowHP\b', r'\1MJC_haslowHP', rule, count=1, flags=re.I)
    if count != 1:
        raise ValueError('Unreviewed stock low-health header')
    return (text + '\n\n' + rule + '\n\n' + alias + '\n').encode('cp1252')


def prepare(source, out, compiled=None):
    if out.exists() or out.is_symlink():
        raise ValueError('Preserve earlier stages; choose a fresh output')
    proof_raw = (source / 'source-stage.json').read_bytes()
    proof = json.loads(proof_raw)
    if proof.get('format') != 'majesty-community-combined-creator-gpl-stage-v1':
        raise ValueError('Require a source-bound community stage')
    if 'Any/HighLevelHealth.gpl' in proof['files']:
        raise ValueError('Preserve existing HighLevelHealth module; reconcile that source first')
    files = {}
    for name, expected in proof['files'].items():
        path = Path(name)
        if len(path.parts) != 2 or path.parts[0] not in ('Any', 'Majesty', 'MajestyExpansion') or path.suffix not in ('.gpl', '.dat'):
            raise ValueError('Unexpected source file')
        p = source / 'sources' / name
        if p.is_symlink() or p.stat().st_size > 2 * 1024 * 1024:
            raise ValueError('Unavailable source')
        raw = p.read_bytes()
        if digest(raw) != expected:
            raise ValueError('Source changed: ' + name)
        files[name] = raw
    verification = None
    stock_name = 'SDK/OriginalQuests/GPL/LowLevel.gpl'
    if compiled is not None:
        reference = dict(compilerSha256='8cfbf6fff1cf90d7aaf334392352515eb0f989a35a16bc99f225e52af38820c4',
            outputs={scope: dict(bytes=size, sha256=sha, sourceDefinitions=count, compiledDefinitions=count)
                     for scope, (size, sha, count) in CURRENT_OUTPUTS.items()})
        verification = verify_compiled_baseline(source, reference, compiled)
        stock = source / 'stock-fixture' / stock_name
        expected_stock = CURRENT_STOCK
        if proof['stockFixture']['inputs'][stock_name] != expected_stock:
            raise ValueError('Current stock SDK source binding changed')
    else:
        stock = ROOT / '.tools/majesty-sdk' / stock_name
        sdk_manifest = json.loads((ROOT / 'output/recovery-2026-11-08/sdk-manifest.json').read_text())
        expected_stock = sdk_manifest['files'][stock_name]
    stock_raw = stock.read_bytes()
    if digest(stock_raw) != expected_stock:
        raise ValueError('Stock SDK health source differs from retained pin')
    adapter = adapt_current if compiled is not None else adapt
    files['Any/Merged.gpl'] = adapter(files['Any/Merged.gpl'], stock_raw.decode('cp1252'))
    resilience = parse_gpl((ROOT / 'content/community-mods/phantoms-haunt/resilience.gpl').read_text())
    scaler = resilience.require(DefinitionKind.FUNCTION, 'MJP_Scale_Living_HP').text
    files['Any/HighLevelHealth.gpl'] = ((scaler + '\n\n').encode('cp1252') if compiled is None else b'') + (ROOT / 'content/community-mods/high-level-health.gpl').read_bytes()
    route_files = {}
    if compiled is not None:
        aliases = proof['legacyFunctionAliases']
        if aliases['Any'].get('Eval_For_Healing') != 'MJC_Eval_For_Healing':
            raise ValueError('Current healing alias is not routed')
        if any(k.casefold() == 'haslowhp' or v.casefold() == 'mjc_haslowhp'
               for mapping in aliases.values() for k, v in mapping.items()):
            raise ValueError('Preserve existing low-health route')
        for scope in ('Majesty', 'MajestyExpansion'):
            raw = (source / 'routes' / scope / 'shared-overrides.tsv').read_bytes()
            if digest(raw) != proof['legacyRoutes'][scope] or digest(raw) != CURRENT_ROUTES[scope]:
                raise ValueError('Current legacy routes changed')
            mapping = {**aliases['Any'], **aliases[scope]}
            original = ('majesty-community-shared-gpl-v2\n' + ''.join(
                n + '\t' + mapping[n] + '\n' for n in sorted(mapping, key=str.casefold))).encode('ascii')
            if raw != original or len(mapping) >= 256:
                raise ValueError('Unreviewed current native route inventory')
            mapping['haslowHP'] = 'MJC_haslowHP'
            route_files[scope] = ('majesty-community-shared-gpl-v2\n' + ''.join(
                n + '\t' + mapping[n] + '\n' for n in sorted(mapping, key=str.casefold))).encode('ascii')
        aliases['Any']['haslowHP'] = 'MJC_haslowHP'
        proof['legacyRoutes'] = {scope: digest(raw) for scope, raw in route_files.items()}
    out.mkdir(parents=True)
    for name, raw in files.items():
        p = out / 'sources' / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(raw)
    if compiled is not None:
        for scope, raw in route_files.items():
            p = out / 'routes' / scope / 'shared-overrides.tsv'
            p.parent.mkdir(parents=True)
            p.write_bytes(raw)
        for name in ('stock-fixture', 'resources'):
            if (source / name).exists():
                (out / name).symlink_to((source / name).resolve(), target_is_directory=True)
    proof.update(files={n: digest(b) for n, b in files.items()},
                 highLevelHealth=dict(priorStage=digest(proof_raw), stockSource=digest(stock_raw),
                                      policy=digest(Path(__file__).read_bytes()),
                                      arithmeticOnly=True, heroStatBonusesChanged=False,
                                      currentBaselineVerification=verification,
                                      currentAliasesRouted=compiled is not None),
                 compiled=False, targetNativeABIQualified=False, browserPlayable=False, published=False)
    (out / 'source-stage.json').write_text(json.dumps(proof, indent=2) + '\n')
    return proof['highLevelHealth']


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    p.add_argument('--compiled', type=Path, help='Require byte-identical current deployed libraries before adapting their source')
    a = p.parse_args()
    print(json.dumps(prepare(a.source, a.out, a.compiled)))

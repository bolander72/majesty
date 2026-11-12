#!/usr/bin/env python3
"""Stage arithmetic-only high-level HP corrections without altering creator inputs."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'third_party/majesty-mod-manager/src'))
from majesty_cam.gpl import parse_gpl, DefinitionKind


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


def prepare(source, out):
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
    stock = ROOT / '.tools/majesty-sdk/SDK/OriginalQuests/GPL/LowLevel.gpl'
    sdk_manifest = json.loads((ROOT / 'output/recovery-2026-11-08/sdk-manifest.json').read_text())
    stock_raw = stock.read_bytes()
    if digest(stock_raw) != sdk_manifest['files']['SDK/OriginalQuests/GPL/LowLevel.gpl']:
        raise ValueError('Stock SDK health source differs from retained pin')
    files['Any/Merged.gpl'] = adapt(files['Any/Merged.gpl'], stock_raw.decode('cp1252'))
    resilience = parse_gpl((ROOT / 'content/community-mods/phantoms-haunt/resilience.gpl').read_text())
    scaler = resilience.require(DefinitionKind.FUNCTION, 'MJP_Scale_Living_HP').text
    files['Any/HighLevelHealth.gpl'] = (scaler + '\n\n').encode('cp1252') + (ROOT / 'content/community-mods/high-level-health.gpl').read_bytes()
    out.mkdir(parents=True)
    for name, raw in files.items():
        p = out / 'sources' / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(raw)
    proof.update(files={n: digest(b) for n, b in files.items()},
                 highLevelHealth=dict(priorStage=digest(proof_raw), stockSource=digest(stock_raw),
                                      policy=digest(Path(__file__).read_bytes()),
                                      arithmeticOnly=True, heroStatBonusesChanged=False),
                 compiled=False, targetNativeABIQualified=False, browserPlayable=False, published=False)
    (out / 'source-stage.json').write_text(json.dumps(proof, indent=2) + '\n')
    return proof['highLevelHealth']


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    a = p.parse_args()
    print(json.dumps(prepare(a.source, a.out)))

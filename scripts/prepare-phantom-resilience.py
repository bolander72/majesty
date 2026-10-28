#!/usr/bin/env python3
"""Stage the Phantom balance adaptation without editing original inputs."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'third_party/majesty-mod-manager/src')]


def digest(raw):
    return dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())


def adapt(raw):
    from majesty_cam.gpl import parse_gpl, DefinitionKind
    text = raw.decode('cp1252')
    if 'MJP_Phantom_Resilience' in text:
        raise ValueError('Phantom resilience already applied')
    parsed = parse_gpl(text)
    changes = []
    # Ensure covers births and the existing Palace reconciliation. Watch covers
    # saved heroes whose already-running function thread survives world reload.
    for name in ('Phantom_Ensure_Behavior_Watch', 'Phantom_Frost_Armor_Watch'):
        item = parsed.require(DefinitionKind.FUNCTION, name)
        import re
        updated, count = re.subn(r'(?im)^begin\s*$',
            'begin\n    $MJP_Phantom_Resilience(ThisAgent);' +
            ('\n    $MJP_Phantom_Retreat(ThisAgent);' if name == 'Phantom_Frost_Armor_Watch' else ''),
            item.text, count=1)
        if count != 1:
            raise ValueError('Phantom watcher entry differs: ' + name)
        changes.append((item.span.start, item.span.end, updated))
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
                raise ValueError('Eternal Soul health formula differs: ' + name)
            updated = updated.replace(before, after, 1)
        changes.append((item.span.start, item.span.end, updated))
    for start, end, updated in sorted(changes, reverse=True):
        text = text[:start] + updated + text[end:]
    return text.encode('cp1252')


def prepare(source, output):
    if output.exists() or output.is_symlink():
        raise ValueError('Preserve prior stages; choose a fresh output')
    proof_raw = (source / 'source-stage.json').read_bytes()
    proof = json.loads(proof_raw)
    if (proof.get('format') != 'majesty-community-combined-creator-gpl-stage-v1'
            or not proof.get('campaignResourceClosure') or proof.get('phantomResilience')):
        raise ValueError('Require the qualified campaign-resource source before resilience')
    payloads = {}
    for name, expected in proof['files'].items():
        parts = Path(name).parts
        if (len(parts) != 2 or parts[0] not in ('Any', 'Majesty', 'MajestyExpansion')
                or Path(name).suffix not in ('.gpl', '.dat')):
            raise ValueError('Unexpected source path')
        path = source / 'sources' / name
        if path.is_symlink() or path.stat().st_size > 2 * 1024 * 1024:
            raise ValueError('Unavailable source')
        raw = path.read_bytes()
        if digest(raw) != expected:
            raise ValueError('Source differs from its proof: ' + name)
        payloads[name] = raw
    payloads['Any/Merged.gpl'] = adapt(payloads['Any/Merged.gpl'])
    helper = ROOT / 'content/community-mods/phantoms-haunt/resilience.gpl'
    name = 'Any/PhantomResilience.gpl'
    if name in payloads:
        raise ValueError('Preserve existing resilience module')
    payloads[name] = helper.read_bytes()
    output.mkdir()
    for name, raw in payloads.items():
        target = output / 'sources' / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
    for name in ('stock-fixture', 'resources', 'phantom-source-package', 'native', 'routes'):
        if (source / name).exists():
            (output / name).symlink_to((source / name).resolve(), target_is_directory=True)
    proof.update(phantomResilience=dict(priorStage=digest(proof_raw),
        source=digest(helper.read_bytes()), policy=digest(Path(__file__).read_bytes()),
        savedMarker='MJPPhantomResilienceV1', existingHeroesSupported=True,
        creatorInputsUnchanged=True),
        files={name: digest(raw) for name, raw in payloads.items()}, compiled=False,
        targetNativeABIQualified=False, browserPlayable=False, published=False)
    (output / 'source-stage.json').write_text(json.dumps(proof, indent=2) + '\n')
    return proof['phantomResilience']


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(prepare(args.source, args.out)))

#!/usr/bin/env python3
"""Add Adventurers Guild decisions to the 13 acquired More Heroes trees."""
import argparse
import copy
import importlib.util
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from lib.community_guild_composition import digest

ANALOGUES = {
    'necromancer_tree_mh': 'mx_priestess', 'fire_witch_tree_mh': 'mx_wizard',
    'dark_paladin_tree_mh': 'mx_paladin', 'lightning_lord_tree_mh': 'mx_wizard',
    'dragoncaller_tree_mh': 'mx_cultist', 'assassin_tree_mh': 'mx_rogue',
    'minstrel_tree_mh': 'mx_elf', 'cultist_healer_tree_mh': 'mx_cultist',
    'wild_monk_tree_mh': 'mx_monk', 'shapeshifter_tree_mh': 'mx_cultist',
}
# These private trees omit stock entertainment or interpose training. Resume
# after their own combat check; consider only after their existing purchases.
PRIVATE_GAPS = {
    'fallen_angel_tree_mh': ('Check_Nearby(ThisAgent)', 'Purchase_Bazaar(ThisAgent,10)'),
    'mystic_tree': ('Check_Nearby(ThisAgent)', 'Pursue_Entertainment(ThisAgent)'),
    'timewalker_tree': ('Check_Nearby(ThisAgent)', 'Purchase_Bazaar(ThisAgent,55)'),
}
CALLBACKS = ('Adventurer_Guild_Hero_Decision', 'Adventurer_Guild_Hero_Consider')


def private_spans(item, calls):
    from majesty_cam.gpl_function_merge import _SourceParser, _tokens
    parser = _SourceParser(item.text)
    signature, _, body = parser.function()
    if signature != _tokens('function ' + item.name + '(agent ThisAgent)'):
        raise ValueError('Unexpected private hero signature')
    records = []
    def walk(nodes, ancestors=()):
        for node in nodes:
            records.append((node, ancestors))
            walk(node.body, (*ancestors, (node, 'body')))
            walk(node.otherwise, (*ancestors, (node, 'else')))
    walk(body)
    found = []
    for call in calls:
        head = _tokens('if ($' + call + ' == False)')
        matches = [(node, ancestors) for node, ancestors in records
                   if node.kind == 'if' and node.head == head]
        if len(matches) != 1 or not matches[0][0].body or any(
                node.kind != 'if' or branch != 'body' for node, branch in matches[0][1]):
            raise ValueError('Private hero continuation changed: ' + item.name)
        found.append(matches[0])
    if not any(node is found[0][0] for node, _ in found[1][1]):
        raise ValueError('Private quest consideration precedes combat/resume')
    return tuple(parser.body_spans[id(node)] for node, _ in found)


def add_quest_hooks(item):
    from majesty_cam.gpl import hero_quest_anchor_matches
    from majesty_cam.gpl_function_merge import _Parser, _tokens
    name = item.normalized_name
    if name in ANALOGUES:
        spans = hero_quest_anchor_matches(item, ANALOGUES[name])
    elif name in PRIVATE_GAPS:
        spans = private_spans(item, PRIVATE_GAPS[name])
    else:
        raise ValueError('Unreviewed private hero tree: ' + item.name)
    if any('$' + symbol.casefold() in item.text.casefold() for symbol in CALLBACKS):
        raise ValueError('Private hero quest hooks already exist')
    newline = '\r\n' if '\r\n' in item.text else '\n'
    insertions = {}
    for (start, end), symbol in zip(spans, CALLBACKS):
        line_start = item.text.rfind('\n', 0, start) + 1
        indent = re.match(r'[ \t]*', item.text[line_start:start]).group()
        insertions.setdefault(start, []).append('begin' + newline + indent +
            '\tif ($' + symbol + '(ThisAgent) == False)' + newline + indent + '\t')
        insertions.setdefault(end, []).append(newline + indent + 'end' + newline)
    text = item.text
    for position in sorted(insertions, reverse=True):
        text = text[:position] + ''.join(insertions[position]) + text[position:]
    # Independently unwrap just the new false guards and compare the complete
    # structured body, including original else ownership and task priorities.
    old_signature, old_locals, old_body = _Parser(item.text).function()
    signature, locals_, body = _Parser(text).function()
    heads = {_tokens('if ($' + symbol + '(ThisAgent) == False)') for symbol in CALLBACKS}
    seen = []
    from dataclasses import replace
    def strip(nodes):
        result = []
        for node in nodes:
            if node.kind == 'if' and node.head in heads:
                if node.otherwise:
                    raise ValueError('New quest branch acquired an else')
                seen.append(node.head)
                result.extend(strip(node.body))
            else:
                result.append(replace(node, body=strip(node.body), otherwise=strip(node.otherwise)))
        return tuple(result)
    if ((signature, locals_, strip(body)) != (old_signature, old_locals, old_body)
            or len(seen) != 2 or set(seen) != heads):
        raise ValueError('Quest adaptation changed original hero decisions')
    return text


def stage(args):
    if args.out.exists() or args.out.is_symlink():
        raise ValueError('Preserve prior source stages')
    spec = importlib.util.spec_from_file_location('quest_legacy_sources',
        ROOT / 'scripts/stage-community-expansion-legacy-gpl.py')
    legacy = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(legacy)
    legacy_policy = importlib.util.spec_from_file_location('quest_manager_policy',
        ROOT / 'scripts/prepare-community-guild-gpl.py')
    policy = importlib.util.module_from_spec(legacy_policy)
    legacy_policy.loader.exec_module(policy)
    policy.verified_git(args.manager, policy.MANAGER_COMMIT)
    sys.path.insert(0, str(args.manager / 'src'))
    from majesty_cam.gpl import DefinitionKind, parse_gpl
    from majesty_cam.gpl_function_merge import same_function_instructions
    raw, proof, files, final = legacy.load(args.source)
    completion = proof.get('communityExpansions', {}).get('standardSourceCompletion')
    if not completion or proof['communityExpansions'].get('moreHeroesQuestParticipation'):
        raise ValueError('Require complete standalone sources without prior quest adaptation')
    name = 'GPL/MoreHeroes_DecisionTrees.gpl'
    source = (args.standard_package / name).read_bytes()
    if digest(source) != completion['sourceFiles'][name]:
        raise ValueError('Private hero source differs from the reproduced Standard library')
    originals = {item.normalized_name: item for item in parse_gpl(source.decode('cp1252')).items}
    changes = {}
    for name in sorted(ANALOGUES.keys() | PRIVATE_GAPS.keys()):
        key = ('MajestyExpansion', (DefinitionKind.FUNCTION, name))
        item = final[key]
        if not same_function_instructions(item.text, originals[name].text):
            raise ValueError('Private hero has another source change: ' + name)
        changes[key] = add_quest_hooks(item)
    for symbol in CALLBACKS:
        if ('Any', (DefinitionKind.FUNCTION, symbol.casefold())) not in final:
            raise ValueError('Quest provider is missing from common source')
    args.out.mkdir()
    hashes = {}
    for name, body in files.items():
        if name.endswith('.gpl') and name.startswith('MajestyExpansion/'):
            parsed = parse_gpl(body.decode('cp1252'), name)
            body = ('\n\n'.join(changes.get(('MajestyExpansion', item.key), item.text)
                               for item in parsed.items) + '\n').encode('cp1252')
        path = args.out / 'sources' / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
        hashes[name] = digest(body)
    for name in ('stock-fixture', 'resources', 'routes'):
        (args.out / name).symlink_to((args.source / name).resolve(), target_is_directory=True)
    proof = copy.deepcopy(proof)
    proof['files'] = hashes
    proof['communityExpansions']['moreHeroesQuestParticipation'] = dict(
        priorStage=digest(raw), policy=digest(Path(__file__).read_bytes()),
        stockAnchorTrees=ANALOGUES, reviewedPrivateGaps=PRIVATE_GAPS,
        callbacks=CALLBACKS, heroTrees=len(changes), originalDecisionStructurePreserved=True,
        sharedResetAndDeathNotDuplicated=True, nativeGameplayQualified=False)
    (args.out / 'source-stage.json').write_text(json.dumps(proof, indent=2) + '\n')
    return dict(heroTrees=len(changes), originalDecisionStructurePreserved=True, published=False)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('source', 'standard-package', 'manager', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    print(json.dumps(stage(parser.parse_args())))

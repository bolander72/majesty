#!/usr/bin/env python3
"""Correct the generated void Zoo action bridge, preserving all creator bodies."""
import argparse
import json
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'scripts'), str(ROOT / 'third_party/majesty-mod-manager/src')]
from lib.community_guild_composition import digest
from lib.community_action_returns import adapt_scoped
from majesty_cam.gpl import parse_gpl, DefinitionKind


def stage(a):
    if a.out.exists() or a.out.is_symlink():
        raise ValueError('Preserve prior action stages')
    raw = (a.source / 'source-stage.json').read_bytes()
    source = json.loads(raw)
    if not source.get('followerMarkerRepair') or source.get('voidActionBridgeRepair'):
        raise ValueError('Require the complete reviewed expansion source with restored markers')
    files, documents, functions = {}, {}, {}
    for name, expected in source['files'].items():
        body = (a.source / 'sources' / name).read_bytes()
        if digest(body) != expected:
            raise ValueError('Action stage input changed: ' + name)
        files[name] = body
        if name.endswith('.gpl'):
            document = parse_gpl(body.decode('cp1252'), name)
            documents[name] = document
            for item in document.items:
                if item.kind is DefinitionKind.FUNCTION:
                    key = (Path(name).parts[0], item.key)
                    if key in functions:
                        raise ValueError('Duplicate scoped action definition')
                    functions[key] = item.text
    changes = adapt_scoped(functions)
    if (len(changes) != 1 or changes[0]['scope'] != 'Any'
            or changes[0]['callback'].casefold() != 'restore_zoo_tame_beast'):
        raise ValueError('Require the one source-identified void Zoo action bridge')
    rewritten = []
    for name, document in documents.items():
        text = files[name].decode('cp1252')
        for item in sorted(document.items, key=lambda row: row.span.start, reverse=True):
            key = (Path(name).parts[0], item.key)
            if item.kind is DefinitionKind.FUNCTION and functions[key] != item.text:
                if text[item.span.start:item.span.end] != item.text:
                    raise ValueError('Action replacement span differs')
                text = text[:item.span.start] + functions[key] + text[item.span.end:]
                rewritten.append(dict(file=name, name=item.name, before=digest(item.text.encode('cp1252')),
                                      after=digest(functions[key].encode('cp1252'))))
        files[name] = text.encode('cp1252')
    if len(rewritten) != 1:
        raise ValueError('Unexpected generated action changes')
    a.out.mkdir()
    for name, body in files.items():
        path = a.out / 'sources' / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
    shutil.copytree(a.source / 'routes', a.out / 'routes')
    for name in ['resources', 'stock-fixture']:
        (a.out / name).symlink_to((a.source / name).resolve(), target_is_directory=True)
    source.update(files={name:digest(body) for name, body in files.items()},
        voidActionBridgeRepair=dict(priorSourceStage=digest(raw), changes=changes,
            rewritten=rewritten, originalCallbackBodiesUnchanged=True,
            booleanActionBridgesUnchanged=True, routesAndDatUnchanged=True,
            policy=digest(Path(__file__).read_bytes()),
            returnPolicy=digest((ROOT / 'scripts/lib/community_action_returns.py').read_bytes())),
        compiled=False, targetNativeABIQualified=False, browserPlayable=False, published=False)
    (a.out / 'source-stage.json').write_text(json.dumps(source, indent=2) + '\n')
    return dict(changes=changes, originalCallbackBodiesUnchanged=True, published=False)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['source', 'out']:
        parser.add_argument('--' + name, type=Path, required=True)
    print(json.dumps(stage(parser.parse_args())))

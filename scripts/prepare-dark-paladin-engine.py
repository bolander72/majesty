#!/usr/bin/env python3
"""Stage the isolated guild-panel alias using official SDK build inputs."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def prepare(args):
    path = ROOT / 'scripts/prepare-community-campaign-browser-engine.py'
    spec = importlib.util.spec_from_file_location('campaign_stage', path)
    stage = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(stage)
    stage.prepare(args)
    report_path = args.out / 'campaign-core-stage.json'
    report = json.loads(report_path.read_text())
    support = {'BoundedMapQuery.cpp.o', 'IntentTextRegistry.cpp.o',
               'expansion_panel_runtime.cpp.o'}
    replaced = {name: value for name, value in report['retainedObjects'].items()
                if Path(name).name in support}
    if len(replaced) != len({Path(name).name for name in replaced}):
        raise ValueError('Ambiguous retained support object ownership')
    # The qualified base already contains these support objects. The original
    # producer recompiles their source, so remove only their old link inputs.
    cmake = args.out / 'tests/CMakeLists.txt'
    text = cmake.read_text()
    for name in replaced:
        line = '"' + name + '"\n'
        if text.count(line) != 1:
            raise ValueError('Unexpected support object link input')
        text = text.replace(line, '')
        del report['retainedObjects'][name]
    cmake.write_text(text)
    report.update(replacedSupportObjects=replaced,
        producerSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        inheritedProducerSha256=hashlib.sha256(path.read_bytes()).hexdigest())
    report_path.write_text(json.dumps(report, indent=2) + '\n')


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    for name in ('base-engine', 'core-engine', 'out'):
        p.add_argument('--' + name, type=Path, required=True)
    p.add_argument('--expected-engine-sha256', required=True)
    p.add_argument('--preset', default='alchemist1325-web')
    prepare(p.parse_args())
    print('Private guild engine staged; build through kit/tools/build.py.')

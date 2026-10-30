#!/usr/bin/env python3
"""Stage scoped construction/reward usability changes through official game tools.

Retain historical native sources and objects. Replace only the handwritten
community core and panel adapter in a fresh, isolated SDK build stage.
"""
import argparse,hashlib,importlib.util,json,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def prepare(a):
 path=ROOT/'scripts/prepare-dark-paladin-engine.py';spec=importlib.util.spec_from_file_location('prior',path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);m.prepare(a)
 core=a.out/'community-core';support=next(core.rglob('expansion_panel_runtime.cpp')).parent
 inputs={'native/community/guild_usability_probe.cpp':core/'alchemist_native_probe.cpp','native/community/guild_usability_panels.cpp':support/'expansion_panel_runtime.cpp','native/community/guild_usability_policy.h':core/'guild_usability_policy.h'}
 for name,dest in inputs.items():shutil.copyfile(ROOT/name,dest)
 report_path=a.out/'campaign-core-stage.json';report=json.loads(report_path.read_text());report['guildUsabilitySources']={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest()for name in inputs};report_path.write_text(json.dumps(report,indent=2)+'\n');print('Staged usability core; compile with kit/tools/build.py only.')
if __name__=='__main__':
 p=argparse.ArgumentParser()
 for name in ['base-engine','core-engine','out']:p.add_argument('--'+name,type=Path,required=True)
 p.add_argument('--expected-engine-sha256',required=True);p.add_argument('--preset',default='alchemist1325-web');prepare(p.parse_args())

#!/usr/bin/env python3
"""Qualify original gameplay/save/reload/gameplay continuity for one owned NPC."""
import argparse
import hashlib
import importlib.util
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for b in iter(lambda: f.read(4096), b''):
            h.update(b)
    return h.hexdigest()


def verify(first_name, second_name):
    proofs = []
    for name in [first_name, second_name]:
        proof = json.loads(name.read_text())
        checked = json.loads(subprocess.check_output([
            'node', str(ROOT/'scripts/check-native-npc-evolved.mjs'), proof['sourceManifest'], '--stdout',
        ]))
        if proof != checked:
            raise ValueError('Independent evolved-state capture differs')
        proofs.append(proof)
    first, second = proofs
    m = second['fixture']
    if (m.get('reloadEvolvedNpc') is not True or m['evolvedCheckpointReport'] != str(first_name) or
            m['evolvedCheckpointReportSha256'] != sha(first_name) or
            first['fixture']['profile'] == m['profile'] or first['fixture']['nativePid'] == m['nativePid']):
        raise ValueError('Require separate process/profile loading the exact first evolved state')
    for key in ['sha256','size','counts','actor','records','queues','activeQueue']:
        if first['after'][key] != second['before'][key]:
            raise ValueError('Evolved state changed before resumed gameplay: '+key)
    spec = importlib.util.spec_from_file_location('motion',ROOT/'scripts/check-native-joint-motion.py')
    motion = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(motion)
    resumed = motion.verify(Path(second['sourceManifest']))
    start = resumed['motionSamples'][0]
    position = first['after']['actor']['position']
    if (resumed.get('freshEvolvedWorldReloadQualified') is not True or
            start[1:4] != [first['clock'],position['x'],position['y']] or
            resumed['originalLoadedUnits'] != first['after']['counts']['units']):
        raise ValueError('Resumed original motion reset evolved clock, position or complete unit load')
    if second['clock'] != first['clock']+12000 or first['after']['sha256'] == second['after']['sha256']:
        raise ValueError('Second original gameplay interval did not advance and persist state')
    if len(first['changedActorWriters']) != 3 or len(second['changedActorWriters']) != 3:
        raise ValueError('Missing native/script/command evolution across both gameplay intervals')
    files = [first_name,second_name,Path(first['sourceManifest']),Path(second['sourceManifest'])]
    code = ['scripts/check-native-npc-evolved-continuity.py','scripts/check-native-npc-evolved.mjs',
            'scripts/prepare-native-evolved-writers.mjs','scripts/check-native-joint-reload.py',
            'scripts/check-native-joint-motion.py','scripts/run-native-joint-reload.py']
    return {
        'qualified':True,
        'scope':'One original NPC: published destination load, 240 original AI/movement ticks, original evolved full save, fresh evolved reload with exact actor writers/queues/position/clock and 240 more ticks, then a second changed full save. Cross-region return, repeated crossings and browser resource bounds remain unqualified.',
        'firstCapture':str(first_name),'secondCapture':str(second_name),
        'nativePids':[first['fixture']['nativePid'],m['nativePid']],
        'loadedUnits':resumed['originalLoadedUnits'],
        'worldCounts':[first['before']['counts'],first['after']['counts'],second['after']['counts']],
        'persistedClock':[first['clock'],second['clock']],
        'persistedPositions':[first['after']['actor']['position'],second['after']['actor']['position']],
        'originalAiActions':[first['originalContextActions'],second['originalContextActions']],
        'originalPathCalls':[first['originalPathCalls'],second['originalPathCalls']],
        'exactEvolvedWriterRecords':3,'originalGameplaySaveReloadContinuityQualified':True,
        'evolvedClockAndPositionPreservedQualified':True,'secondEvolvedFullSaveQualified':True,
        'repeatedGameplayCrossingsQualified':False,'wholeBrowserMemoryBoundQualified':False,
        'browserUsed':False,'nativeProcessesStarted':0,
        'evidenceSha256':{str(f.relative_to(ROOT)):sha(f) for f in files},
        'sourceSha256':{f:sha(ROOT/f) for f in code},
    }


if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('first_capture',type=Path)
    p.add_argument('second_capture',type=Path)
    p.add_argument('--output',type=Path,required=True)
    a=p.parse_args()
    result=verify(a.first_capture.resolve(),a.second_capture.resolve())
    with a.output.open('x') as f:
        json.dump(result,f,indent=2)
        f.write('\n')
    print(json.dumps({k:result[k] for k in ['qualified','loadedUnits','persistedClock','originalAiActions','originalGameplaySaveReloadContinuityQualified']}))

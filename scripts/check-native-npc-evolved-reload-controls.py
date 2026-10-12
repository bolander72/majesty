#!/usr/bin/env python3
"""Offline provenance/mode refusals for a fresh evolved-state native reload."""
import argparse
import copy
import importlib.util
import json
import tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('reload',ROOT/'scripts/check-native-joint-reload.py')
reload=importlib.util.module_from_spec(spec)
spec.loader.exec_module(reload)


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('manifest',type=Path)
    p.add_argument('--output',type=Path,required=True)
    a=p.parse_args()
    positive=reload.verify(a.manifest.resolve())
    m=positive['fixture']
    if m.get('reloadEvolvedNpc') is not True:
        p.error('Require qualified evolved-state reload')
    previous=json.loads(Path(m['evolvedCheckpointReport']).read_text())
    changes=[
        ('evolved-mode-disabled',lambda c:c.update(reloadEvolvedNpc=False)),
        ('wrong-evolved-proof-hash',lambda c:c.update(evolvedCheckpointReportSha256='f'*64)),
        ('evolved-producer-process-reused',lambda c:c.update(nativePid=previous['fixture']['nativePid'])),
        ('queue-reinsertion-mode',lambda c:c.update(scheduleNpc=True)),
        ('old-scheduled-snapshot-mode',lambda c:c.update(reloadScheduledNpc=True)),
        ('deletion-mode',lambda c:c.update(departNpc=True)),
        ('departed-actor-mode',lambda c:c.update(reloadDepartedNpc=True)),
        ('stale-selected-pair-provenance',lambda c:c.update(selectedPairExport=previous['fixture']['selectedPairExport'])),
        ('changed-evolved-unit-writer',lambda c:c['expectedEvolvedWriters']['Unit'].update(sha256='f'*64)),
        ('missing-evolved-script-writer',lambda c:c['expectedEvolvedWriters'].pop('GPL')),
    ]
    directory=Path(tempfile.mkdtemp(prefix='native-npc-evolved-reload-controls-',dir=ROOT/'output'))
    cases=[]
    for name,change in changes:
        c=copy.deepcopy(m)
        change(c)
        file=directory/(name+'.json')
        file.write_text(json.dumps(c)+'\n')
        try:
            reload.verify(file)
        except ValueError as e:
            cases.append({'name':name,'rejected':True,'reason':str(e)})
        else:
            raise AssertionError('Accepted corrupted evolved reload: '+name)
    result={'qualified':True,'rejected':len(cases),'cases':cases,'nativeProcessesStarted':0,'browserUsed':False}
    with a.output.open('x') as f:
        json.dump(result,f,indent=2)
        f.write('\n')
    print(json.dumps({k:result[k] for k in ['qualified','rejected','nativeProcessesStarted','browserUsed']}))


if __name__=='__main__':
    main()

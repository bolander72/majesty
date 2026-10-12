#!/usr/bin/env python3
"""Reject incomplete/corrupt original full-world reload evidence without game launches."""
import argparse, importlib.util, json, re, tempfile
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('manifest',type=Path);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
    spec=importlib.util.spec_from_file_location('joint_reload_checker',ROOT/'scripts/check-native-joint-reload.py');v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
    positive=v.verify(a.manifest.resolve());m=positive['fixture'];log=Path(m['log']).read_text();owned=Path(tempfile.mkdtemp(prefix='native-joint-reload-controls-',dir=ROOT/'output'));results=[]
    def refuse(name,manifest):
        try:v.verify(manifest)
        except ValueError as error:results.append(dict(control=name,rejected=True,reason=str(error)))
        else:raise ValueError('Invalid full-world reload evidence accepted: '+name)
    for name,field,bad in [('nonterminal','nativeSessionTerminal',False),('failed-process','nativeExitCode',6),('browser-run','browserUsed',True),('nonnative','nativeOnly',False),('wrong-unit','unitId',m['unitId']+1),('wrong-script','agentId',m['agentId']+1),('producer-process-reused','nativePid',positive['producerNativePid'])]:
        manifest=owned/f'{name}.json';manifest.write_text(json.dumps(dict(m,**{field:bad})));refuse(name,manifest)
    changes=[('missing-original-load',re.sub(r'^\[streaming\] Original load end .*\n','',log,flags=re.M)),('incomplete-original-load',re.sub(r'(Original load end result=00000000 visits=)\d+',r'\g<1>480',log)),('missing-joint-reload',re.sub(r'^\[streaming\] Joint reload .*\n','',log,flags=re.M)),('continuing-game-fault',log+'\nSIGSEGV\n')]
    for name,before,after in [('missing-backlink','links=1','links=0'),('missing-unit-writer','unit-written=1','unit-written=0'),('missing-script-writer','script-written=1','script-written=0'),('command-mismatch','commands-equal=1','commands-equal=0'),('scratch-leak','scratch-released=1','scratch-released=0')]:
        changed=re.sub(r'(^\[streaming\] Joint reload .*?)'+re.escape(before),lambda found:found[1]+after,log,count=1,flags=re.M);changes.append((name,changed))
    for name,changed in changes:
        if changed==log:raise ValueError('Control did not change evidence')
        file=owned/f'{name}.log';file.write_text(changed);manifest=owned/f'{name}.json';manifest.write_text(json.dumps(dict(m,log=str(file))));refuse(name,manifest)
    read=Path.read_bytes;profile=Path(m['profile'])
    for kind,offset in [('Unit',36),('GPL',None),('Orders',8)]:
        file=profile/f'Joint_Reload_{kind}.bin';raw=bytearray(file.read_bytes());offset=len(raw)-19 if offset is None else offset;raw[offset]^=1
        with patch.object(Path,'read_bytes',lambda path:bytes(raw) if path==file else read(path)):
            refuse('corrupt-actual-'+kind,a.manifest.resolve())
    output=dict(qualified=True,rejected=len(results),controls=results,nativeProcessesStarted=0,browserUsed=False,originalEvidenceModified=False,scope='Fresh original load, independent process, backlinks, complete UNIT/GPL/order writer bytes, continuing-game and cleanup evidence')
    with a.output.open('x') as f:json.dump(output,f,indent=2);f.write('\n')
    print(json.dumps(dict(rejected=len(results),nativeProcessesStarted=0)))
if __name__=='__main__':main()

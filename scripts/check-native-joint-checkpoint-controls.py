#!/usr/bin/env python3
"""Corrupt copied whole-world evidence and require refusal; no native games/browser."""
import argparse,json,shutil,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
GAME=ROOT/'upstream/majesty-recomp'
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('manifest',type=Path);p.add_argument('--output',type=Path,required=True);a=p.parse_args();m=json.loads(a.manifest.read_text())
    owned=Path(tempfile.mkdtemp(prefix='native-joint-checkpoint-controls-',dir=ROOT/'output'))
    run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-joint-controls-',dir=GAME/'build'));profile=run/'frontier_0_0';profile.mkdir();source=Path(m['profile'])
    files={}
    for name in ['Documents/My Games/MajestyHD/SaveGame/Joint_Actor_Before.GMP','Documents/My Games/MajestyHD/SaveGame/Joint_Actor_2101_0.GMP','Script_Composed_Unit_2101_0.bin','Script_Composed_GPL_2101_0.bin','Script_Composed_Orders_2101_0.bin']:
        file=profile/name;file.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source/name,file);files[name]=file.read_bytes()
    meta=dict(m,profile=str(profile),fixture=str(run));log=Path(m['log']).read_text();results=[]
    def check(name,fields=None,changed=None,badfile=None,offset=0):
        candidate=dict(meta,**(fields or {}));manifest=owned/f'{name}.json'
        if changed is not None:
            path=owned/f'{name}.log';path.write_text(changed);candidate['log']=str(path)
        if badfile:
            raw=bytearray(files[badfile]);raw[offset]^=1;(profile/badfile).write_bytes(raw)
        manifest.write_text(json.dumps(candidate))
        try:
            result=subprocess.run(['node',str(ROOT/'scripts/check-native-joint-checkpoint.mjs'),str(manifest),str(owned/f'{name}-report.json')],capture_output=True,text=True)
            if result.returncode==0:raise ValueError('Corrupted original checkpoint accepted: '+name)
            results.append(dict(control=name,rejected=True,reason=next((line for line in result.stderr.splitlines() if line.startswith('Error:')),'inspection refused')))
        finally:
            if badfile:(profile/badfile).write_bytes(files[badfile])
    for name,field,bad in [('nonterminal','nativeSessionTerminal',False),('failed-native','nativeExitCode',6),('nonnative','nativeOnly',False),('missing-checkpoint-mode','jointCheckpoint',False),('missing-native-identity','nativeIdentity',False),('browser-used','browserUsed',True)]:check(name,{field:bad})
    baseline='[streaming] Joint checkpoint baseline saved=1 result=pass\n'
    joint=next(line for line in log.splitlines() if line.startswith('[streaming] Joint checkpoint actor='))
    check('missing-baseline-writer',changed=log.replace(baseline,''))
    check('missing-joint-writer',changed=log.replace(joint+'\n',''))
    check('wrong-joint-unit',changed=log.replace(joint,joint.replace('unit=510','unit=511')))
    for kind in ['Unit','GPL','Orders']:
        name=f'Script_Composed_{kind}_2101_0.bin';check('corrupt-individual-'+kind,badfile=name,offset=36 if kind=='Unit' else len(files[name])-19 if kind=='GPL' else 8)
    saved='Documents/My Games/MajestyHD/SaveGame/Joint_Actor_2101_0.GMP';raw=files[saved]
    for kind,relative in [('Unit',36),('GPL',len(files['Script_Composed_GPL_2101_0.bin'])-19),('Orders',8)]:
        literal=files[f'Script_Composed_{kind}_2101_0.bin'];at=raw.find(literal)
        if at<0 or raw.find(literal,at+1)>=0:raise ValueError('Original record is not unique in saved world')
        check('corrupt-saved-'+kind,badfile=saved,offset=at+relative)
    # Obtain original typed record offsets rather than searching tag-like strings.
    code="""import {open} from 'node:fs/promises';import {checkpointUnits,checkpointAgents,checkpointAttachments} from './web/world/checkpoint.mjs';const h=await open(process.argv[1],'r');try{const s=await h.stat();const source={size:s.size,async readAt(at,n){const b=Buffer.alloc(n);await h.read(b,0,n,at);return b;}};const r={};for await(const u of checkpointUnits(source))if(u.primary.words[1]!==510){r.Unit=u.offset+60;break;}for await(const g of checkpointAgents(source))if(g.agentId!==79){r.GPL=g.offset+g.size-19;break;}for await(const o of checkpointAttachments(source))if(o.unitId!==510){r.Orders=o.primary.offset+16+8;break;}console.log(JSON.stringify(r));}finally{await h.close();}"""
    offsets=json.loads(subprocess.check_output(['node','--input-type=module','-e',code,str(profile/saved)],cwd=ROOT,text=True))
    for kind,at in offsets.items():check('changed-existing-'+kind,badfile=saved,offset=at)
    for name,raw in files.items():
        if (source/name).read_bytes()!=raw or (profile/name).read_bytes()!=raw:raise ValueError('Original evidence or restored control copy changed')
    output=dict(qualified=True,rejected=len(results),controls=results,nativeProcessesStarted=0,browserUsed=False,originalEvidenceModified=False,scope='Full-world identity associations, exact original UNIT/GPL/order payloads, all existing record preservation and original-writer/terminal-native evidence')
    with a.output.open('x') as f:json.dump(output,f,indent=2);f.write('\n')
    print(json.dumps(dict(rejected=len(results),nativeProcessesStarted=0)))
if __name__=='__main__':main()

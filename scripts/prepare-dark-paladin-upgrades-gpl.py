#!/usr/bin/env python3
"""Add the requested Domain levels to a preserved, compiled-art source stage."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sys
import re

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'third_party/majesty-mod-manager/src'))
from majesty_cam.gpl import parse_gpl,DefinitionKind

WORKER_BRANCH='''
    // Old prototype saves have no upgrade callback; queue native workers directly.
    if (thisagent's "title" == "Dark_Paladin_Domain")
        begin
            $basic_upgrade(thisagent);
            return;
        end
'''


def upgrade_workers(text):
    edits=[]
    for name in ['building_upgraded','MJC_building_upgraded']:
        item=parse_gpl(text).require(DefinitionKind.FUNCTION,name)
        if 'Dark_Paladin_Domain' in item.text:
            raise ValueError('Domain worker compatibility already applied')
        body,n=re.subn(r'(?i)\bbegin\b',lambda m:m[0]+WORKER_BRANCH,item.text,count=1)
        if n!=1:raise ValueError('Missing native upgrade function body')
        edits.append((item.span.start,item.span.end,body))
    for start,end,body in sorted(edits,reverse=True):text=text[:start]+body+text[end:]
    return text



def prepare(source, out):
    if out.exists():
        raise ValueError('Preserve previous source stages')
    proof=json.loads((source/'source-stage.json').read_text())
    for name,expected in proof['files'].items():
        raw=(source/'sources'/name).read_bytes()
        if len(raw)!=expected['bytes'] or hashlib.sha256(raw).hexdigest()!=expected['sha256']:
            raise ValueError('Prior source input changed: '+name)
    shutil.copytree(source,out,symlinks=True)
    for name in ['Majesty/Merged.dat','MajestyExpansion/Merged.dat']:
        path=out/'sources'/name
        text=path.read_text(encoding='cp1252')
        start=text.index('[Dark_Paladin_Domain]')
        end=text.index('[end]',start)+len('[end]')
        old=text[start:end]
        if '(Level' in old or '[dark_paladin_domain2]' in text:
            raise ValueError('Require original one-level Domain prototype')
        first=old.replace('(title','(Level 1)\n\t\t(max_members 3)\n\t\t(upgradescript basic_upgrade)\n\t\t(title',1)
        later=[first.replace('[Dark_Paladin_Domain]',f'[dark_paladin_domain{n}]')
               .replace('(Level 1)',f'(Level {n})').replace('(max_members 3)',f'(max_members {n+2})')
               for n in [2,3]]
        raw=(text[:start]+first+text[end:]+'\n\n'+'\n\n'.join(later)+'\n').encode('cp1252')
        path.write_bytes(raw)
        proof['files'][name]={'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
    path=out/'sources/Any/Merged.gpl'
    prior=path.read_bytes()
    updated=upgrade_workers(prior.decode('cp1252')).encode('cp1252')
    path.write_bytes(updated)
    proof['files']['Any/Merged.gpl']={'bytes':len(updated),'sha256':hashlib.sha256(updated).hexdigest()}
    proof['darkPaladinWorkerCompatibility']={'onlyFunctions':['building_upgraded','MJC_building_upgraded'],
        'before':hashlib.sha256(prior).hexdigest(),'after':hashlib.sha256(updated).hexdigest(),
        'stockBranchesPreserved':True}
    proof['darkPaladinUpgrades']={'levels':3,'capacities':[3,4,5],'upgradeCosts':[2000,3000],
        'nativeWorkerCallback':'basic_upgrade','priorSourceStage':hashlib.sha256((source/'source-stage.json').read_bytes()).hexdigest()}
    (out/'source-stage.json').write_text(json.dumps(proof,indent=2)+'\n')
    return proof['darkPaladinUpgrades']


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ['source','out']:parser.add_argument('--'+name,type=Path,required=True)
    args=parser.parse_args()
    print(json.dumps(prepare(args.source,args.out)))

#!/usr/bin/env python3
"""Repair saved cosmetic draw effects at the normal Dark Paladin decision entry."""
import argparse,hashlib,json,shutil,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'third_party/majesty-mod-manager/src'))
from majesty_cam.gpl import parse_gpl,DefinitionKind
GUARD='''\n    // Restore opaque class art when no native spell is controlling appearance.
    if ($getattribute(thisagent,#ATTRIB_HasEffectPetrify) == 0 &&
        $getattribute(thisagent,#ATTRIB_HasEffectCamouflage) == 0 &&
        $getattribute(thisagent,#ATTRIB_HasEffectInvisibility) == 0 &&
        $getattribute(thisagent,#ATTRIB_HasEffectIllusionaryHero) == 0)
    begin
        $ClearDrawEffects(thisagent);
        $SetDrawEffects(thisagent,"none",0);
    end
'''
def repair(text):
    item=parse_gpl(text).require(DefinitionKind.FUNCTION,'Dark_Paladin_tree_mh')
    old=item.text;needle='\nbegin';at=old.index(needle)+len(needle)
    new=old[:at]+GUARD+old[at:]
    return text[:item.span.start]+new+text[item.span.end:]
def digest(raw):return {'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
def prepare(a):
    if a.out.exists():raise ValueError('Preserve previous source stages')
    prior=json.loads((a.source/'source-stage.json').read_text());a.out.mkdir(parents=True)
    shutil.copytree(a.source/'sources',a.out/'sources')
    for folder in ['resources','routes','stock-fixture']:
        if(a.source/folder).exists():(a.out/folder).symlink_to((a.source/folder).resolve(),target_is_directory=True)
    changes=[]
    for scope in ['Majesty','MajestyExpansion']:
        name=scope+'/Merged.gpl';p=a.out/'sources'/name;raw=p.read_bytes();assert digest(raw)==prior['files'][name]
        before=raw.decode('cp1252');after=repair(before)
        old=parse_gpl(before);new=parse_gpl(after)
        changed=[(x.kind.value,x.name)for x,y in zip(old.items,new.items)if x.text!=y.text]
        assert len(old.items)==len(new.items)and len(changed)==1 and changed[0][1]=='Dark_Paladin_tree_mh'
        p.write_bytes(after.encode('cp1252'));prior['files'][name]=digest(p.read_bytes());changes.append(name)
    prior['darkPaladinOpacityRepair']={'changedSourceFiles':changes,'changedFunctions':['Dark_Paladin_tree_mh'],'preservesNativeSpellEffects':['Petrify','Camouflage','Invisibility','IllusionaryHero'],'nativeUncheckedCallbackAdded':False,'statsChanged':False}
    (a.out/'source-stage.json').write_text(json.dumps(prior,indent=2)+'\n');print('Prepared two scoped decision-entry repairs; shared sources and all attributes unchanged.')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--out',type=Path,required=True);prepare(p.parse_args())

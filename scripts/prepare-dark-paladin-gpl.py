#!/usr/bin/env python3
"""Remove the original Dark Paladin reskin tint; retain real status effects."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'third_party/majesty-mod-manager/src'))
from majesty_cam.gpl import parse_gpl,parse_dat,DefinitionKind

def digest(raw):
    return dict(bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())


def remove_tint(text):
    doc=parse_gpl(text)
    names=['Dark_Paladin_Birth','MHB_Birth','Morph_Begin','GetProperUnitArt','MJC_GetProperUnitArt']
    edits=[]
    for name in names:
        item=doc.require(DefinitionKind.FUNCTION,name)
        old=item.text
        if name=='Dark_Paladin_Birth':
            pattern=r'(\$SetDrawEffects\s*\(ThisAgent, )"gray"(, 0\);)'
        elif name in ['GetProperUnitArt','MJC_GetProperUnitArt']:
            pattern=r'(else if \( ThisAgent\x27s "Title" == "Dark_Paladin"\)\s*theColor = )"gray"(;)'
        else:
            title='Dark_Paladin_Domain' if name=='MHB_Birth' else 'Dark_Paladin'
            # Match the one class branch; never cross the next else-if block.
            pattern=r'((?:else if|if) \( (?:ThisAgent\x27s "Title"|title) == "'+title+r'"\)\s*begin(?:(?!else if).)*?\$SetDrawEffects\s*\(ThisAgent, )"gray"(, 0\);)'
        new,count=re.subn(pattern,r'\1"none"\2',old,flags=re.S)
        if count!=1 or new.count('"none"')!=old.count('"none"')+1:
            raise ValueError('Require exactly one Dark Paladin cosmetic tint: '+name)
        if new.replace('"none"','"gray"') != old.replace('"none"','"gray"'):
            raise ValueError('Non-cosmetic function bytes changed')
        edits.append((item.span.start,item.span.end,new))
    for start,end,new in sorted(edits,reverse=True):
        text=text[:start]+new+text[end:]
    return text,names


def prepare(a):
    if a.out.exists():raise ValueError('Preserve earlier source stages')
    old=(a.source/'source-stage.json').read_bytes();proof=json.loads(old)
    files={n:(a.source/'sources'/n).read_bytes()for n in proof['files']}
    if any(digest(b)!=proof['files'][n]for n,b in files.items()):
        raise ValueError('Retired source stage changed')
    name='MajestyExpansion/Merged.gpl'
    text,functions=remove_tint(files[name].decode('cp1252'))
    files[name]=text.encode('cp1252')
    # More Heroes Standard declares its actors and private callbacks only in
    # the Northern scope. Original campaigns load Base instead of Expansion.
    # Port only this guild's two prototypes and the callbacks it can execute.
    data=parse_dat(files['MajestyExpansion/Merged.dat'].decode('cp1252'))
    prototypes=['Dark_Paladin','Dark_Paladin_Domain']
    selected=[next(i for i in data.items if i.name.casefold()==n.casefold())
              for n in prototypes]
    existing={i.name.casefold() for i in parse_dat(files['Majesty/Merged.dat'].decode('cp1252')).items}
    if existing & {n.casefold() for n in prototypes}:raise ValueError('Original prototypes already exist')
    files['Majesty/Merged.dat']+=('\n'+'\n\n'.join(i.text for i in selected)+'\n').encode('cp1252')
    original_functions=['Dark_Paladin_Birth','Dark_Paladin_tree_mh','MHB_Birth',
                        'Exploding_Aura_Cast2','Exploding_Aura_Hit2']
    doc=parse_gpl(text)
    existing={i.name.casefold() for i in parse_gpl(files['Majesty/Merged.gpl'].decode('cp1252')).items}
    if existing & {n.casefold() for n in original_functions}:raise ValueError('Original callback already exists')
    files['Majesty/Merged.gpl']+=('\n'+'\n\n'.join(
        doc.require(DefinitionKind.FUNCTION,n).text for n in original_functions)+'\n').encode('cp1252')
    a.out.mkdir(parents=True)
    for n,b in files.items():
        p=a.out/'sources'/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
    shutil.copytree(a.source/'routes',a.out/'routes')
    for n in ['resources','stock-fixture']:(a.out/n).symlink_to((a.source/n).resolve(),target_is_directory=True)
    record=dict(priorSourceStage=digest(old),changedCosmeticFunctions=functions,
                originalCampaignPrototypes=prototypes,originalCampaignCallbacks=original_functions,
                existingSavedActorsReconciledOnce=False,legacySavedTintMayRemain=True,
                actualStatusEffectPrecedenceRetained=True,statsPricesSpellsUnchanged=True,
                otherRetiredClassesUnchanged=True,policy=digest(Path(__file__).read_bytes()))
    proof.update(files={n:digest(b)for n,b in files.items()},darkPaladinOriginalArt=record,
                 compiled=False,published=False)
    (a.out/'source-stage.json').write_text(json.dumps(proof,indent=2)+'\n')
    print(json.dumps(record))


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['source','out']:p.add_argument('--'+n,type=Path,required=True)
    prepare(p.parse_args())

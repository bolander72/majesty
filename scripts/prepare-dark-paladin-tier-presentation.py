#!/usr/bin/env python3
"""Stage only named tiers and expanded, additive Domain artwork."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'scripts'),str(ROOT/'third_party/majesty-mod-manager/src')]
from majesty_cam.cam import read_cam
from lib.community_expansion_media import append_art
from lib.legacy_description_wire import unit_parts
from lib.dark_paladin_tier_presentation import label_levels,label_descriptions,additive_upgrades


def digest(raw):return {'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}


def prepare(a):
    if a.out.exists():raise ValueError('Preserve prior art and qualification stages')
    prior=json.loads((a.baseline/'prototype-stage.json').read_text())
    if digest(a.base_art.read_bytes())!=prior['priorArt']:raise ValueError('Original community artwork changed')
    native=additive_upgrades(read_cam(a.art.read_bytes()))
    media,audit=append_art(read_cam(a.base_art.read_bytes()),native,{b'NDH1',b'NDG1',b'NDG2',b'NDG3'})
    result={}
    for n in ['Data/Community-main.cam','DataMX/Community-main.cam']:
        result[n]=media.to_bytes()
    for n in ['Data/textdata.cam','Data/Community-textdata.cam','DataMX/mx_textdata.cam','DataMX/Community-textdata.cam']:
        old=(a.baseline/n).read_bytes()
        if digest(old)!=prior['files'][n]:raise ValueError('Prior native interface changed')
        before=read_cam(old);after=label_levels(before)
        changed=[(x.extension,e.name[:4].decode())for x,y in zip(before.sections,after.sections)
                 for e,f in zip(x.entries,y.entries)if e.data!=f.data]
        if changed!=[(b'STRT','UNTN')]:raise ValueError('Unexpected native UI change')
        result[n]=after.to_bytes()
    for n in ['Data/unittype.cam','DataMX/mx_Unittype.cam']:
        old=(a.baseline/n).read_bytes()
        if digest(old)!=prior['files'][n]:raise ValueError('Prior unit definitions changed')
        before=read_cam(old);after=label_descriptions(before)
        for x,y in zip(before.sections,after.sections):
            for e,f in zip(x.entries,y.entries):
                if e.data!=f.data and (x.extension!=b'DUNT'or e.name[:4]not in [b'AB22',b'AB23']):
                    raise ValueError('Unexpected actor change')
                if e.data!=f.data and unit_parts(e.data)[1:]!=unit_parts(f.data)[1:]:
                    raise ValueError('Unit engine bindings or stats changed')
        result[n]=after.to_bytes()
    a.out.mkdir(parents=True)
    for n,b in result.items():
        p=a.out/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
    proof={'format':'majesty-dark-paladin-tier-presentation-v1','files':{n:digest(b)for n,b in result.items()},
        'before':{n:digest((a.baseline/n).read_bytes())for n in result},'artImport':audit,
        'changedStringIds':['AB21','AB22','AB23'],'upgradesPreservePreviousTier':True,
        'nativeImageControlsPreserved':True,'unitStatsAndScriptsUnchanged':True,
        'engineChanged':False,'nativeUiQualified':False,'published':False,
        'sourcePolicies':{n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest()for n in [
            'scripts/prepare-dark-paladin-tier-presentation.py','scripts/lib/dark_paladin_tier_presentation.py','scripts/artwork/dark_paladin_domain_tiers.py']}}
    (a.out/'tier-presentation-stage.json').write_text(json.dumps(proof,indent=2)+'\n')
    print('Staged eight native archives; names and Domain artwork only.')


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['baseline','base-art','art','out']:p.add_argument('--'+n,type=Path,required=True)
    prepare(p.parse_args())

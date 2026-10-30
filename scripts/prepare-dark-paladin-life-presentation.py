#!/usr/bin/env python3
"""Stage original guild animation and refined hero artwork without gameplay changes."""
import argparse,hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'scripts'),str(ROOT/'third_party/majesty-mod-manager/src')]
from majesty_cam.cam import read_cam
from lib.community_expansion_media import append_art

def digest(raw):return {'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
def prepare(a):
    if a.out.exists():raise ValueError('Preserve prior candidates')
    prior=json.loads((a.baseline/'guild-presentation-stage.json').read_text())['files']
    original=a.base_art.read_bytes()
    assert hashlib.sha256(original).hexdigest()=='29ca407ad666f2d26371904474464e16acbbcfc5507077a36894f06a1a304ac4'
    media,audit=append_art(read_cam(original),read_cam(a.art.read_bytes()),{b'NDH1',b'NDG1',b'NDG2',b'NDG3'})
    result={}
    for name,expected in prior.items():
        raw=(a.baseline/name).read_bytes();assert digest(raw)==expected
        result[name]=media.to_bytes()if name in ['Data/Community-main.cam','DataMX/Community-main.cam']else raw
    a.out.mkdir(parents=True)
    for name,raw in result.items():
        path=a.out/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw)
    sources=['scripts/artwork/dark_paladin_refined.py','scripts/artwork/dark_paladin_guild_life.py','scripts/prepare-dark-paladin-refined-art.py','scripts/prepare-dark-paladin-life-presentation.py']
    proof={'format':'majesty-dark-paladin-life-presentation-v1','files':{n:digest(r)for n,r in result.items()},'before':prior,'artImport':audit,'gameplayResourcesUnchanged':True,'sourcePolicies':{n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest()for n in sources}}
    (a.out/'life-presentation-stage.json').write_text(json.dumps(proof,indent=2)+'\n');print('Staged twelve resources; only two art archives changed.')
if __name__=='__main__':
    p=argparse.ArgumentParser()
    for n in ['baseline','base-art','art','out']:p.add_argument('--'+n,type=Path,required=True)
    prepare(p.parse_args())

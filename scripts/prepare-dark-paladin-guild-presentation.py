#!/usr/bin/env python3
"""Stage native enlarged/scaffold artwork and literal Guild tier names."""
import argparse,hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'scripts'),str(ROOT/'third_party/majesty-mod-manager/src')]
from majesty_cam.cam import read_cam
from lib.community_expansion_media import append_art
from lib.dark_paladin_guild_presentation import label_levels,label_descriptions,label_panels
from lib.legacy_description_wire import unit_parts

def digest(raw):return {'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
def prepare(a):
    if a.out.exists():raise ValueError('Preserve prior candidates')
    prior=json.loads((a.baseline/'tier-presentation-stage.json').read_text())['files']
    media,audit=append_art(read_cam(a.base_art.read_bytes()),read_cam(a.art.read_bytes()),{b'NDH1',b'NDG1',b'NDG2',b'NDG3'})
    result={n:media.to_bytes()for n in ['Data/Community-main.cam','DataMX/Community-main.cam']}
    for n in ['Data/textdata.cam','Data/Community-textdata.cam','DataMX/mx_textdata.cam','DataMX/Community-textdata.cam']:
        before=(a.baseline/n).read_bytes();assert digest(before)==prior[n]
        result[n]=label_panels(label_levels(read_cam(before))).to_bytes()
    for n in ['Data/unittype.cam','DataMX/mx_Unittype.cam']:
        before=read_cam((a.baseline/n).read_bytes());after=label_descriptions(before)
        for x,y in zip(before.sections,after.sections):
            for e,f in zip(x.entries,y.entries):
                if e.data!=f.data:
                    assert x.extension==b'DUNT'and e.name[:4]in [b'AB21',b'AB22',b'AB23']
                    assert unit_parts(e.data)[1:]==unit_parts(f.data)[1:]
        result[n]=after.to_bytes()
    manifest=json.loads(a.manifest.read_text())['games']['majesty-community-guilds-v1']['patches']
    if a.compiled:
        receipt=json.loads((a.compiled/'compiler-proof.json').read_text());assert receipt['compiled']and receipt['compilerSourceDefinitionsQualified']and receipt['compiledBytesExportedQualified']
        assert (a.compiled/'common.bcd').read_bytes()==(a.compiled_baseline/'common.bcd').read_bytes()
        for folder in ['Data','DataMX']:
            for label,slug in [('Base','base'),('Expansion','expansion')]:
                name=folder+'/Community_'+label+'.bcd';expected=next(x for x in manifest if x['path']==name)
                old=(a.compiled_baseline/(slug+'.bcd')).read_bytes();assert digest(old)=={k:expected[k]for k in ['bytes','sha256']}
                prior[name]=digest(old);result[name]=(a.compiled/(slug+'.bcd')).read_bytes()
    a.out.mkdir(parents=True)
    for n,raw in result.items():
        p=a.out/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw)
    sources=['scripts/artwork/dark_paladin_guild.py','scripts/prepare-dark-paladin-guild-art.py','scripts/prepare-dark-paladin-guild-presentation.py','scripts/lib/dark_paladin_guild_presentation.py','scripts/prepare-dark-paladin-opacity-gpl.py','scripts/compile-community-guild-gpl.py']
    proof={'format':'majesty-dark-paladin-guild-presentation-v1','files':{n:digest(raw)for n,raw in result.items()},'before':prior,'artImport':audit,'nativeScaffoldUpgradeFrames':True,'literalGuildNames':True,'unitStatsUnchanged':True,'scopedOpacityScriptRepair':bool(a.compiled),'compilerProof':digest((a.compiled/'compiler-proof.json').read_bytes())if a.compiled else None,'compiledSourceStage':json.loads((a.compiled/'compiler-proof.json').read_text())['sourceStage']if a.compiled else None,'sourcePolicies':{n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest()for n in sources}}
    (a.out/'guild-presentation-stage.json').write_text(json.dumps(proof,indent=2)+'\n');print('Staged '+str(len(result))+' Guild resources; attributes unchanged, opacity repair scoped to two decision functions.')
if __name__=='__main__':
    p=argparse.ArgumentParser()
    for n in ['baseline','base-art','art','out']:p.add_argument('--'+n,type=Path,required=True)
    p.add_argument('--compiled',type=Path);p.add_argument('--compiled-baseline',type=Path);p.add_argument('--manifest',type=Path,required=True)
    prepare(p.parse_args())

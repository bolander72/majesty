#!/usr/bin/env python3
"""Prepare a reversible resource-only More Heroes rollback from a qualified set."""
import argparse, hashlib, json, shutil, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT/'scripts'), str(ROOT/'third_party/majesty-mod-manager/src')]
from lib.community_more_heroes_retirement import retire_buildings, restore_random_pool
from majesty_cam.cam import read_cam

def digest(raw): return {'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}

def stage(a):
    if a.out.exists(): raise ValueError('Preserve earlier rollback stages')
    proof_raw=(a.source/'source-stage.json').read_bytes();proof=json.loads(proof_raw)
    files={n:(a.source/'sources'/n).read_bytes() for n in proof['files']}
    assert all(digest(b)==proof['files'][n] for n,b in files.items())
    assert proof.get('voidActionBridgeRepair') and proof.get('followerMarkerRepair')
    name='MajestyExpansion/Merged.gpl';files[name]=restore_random_pool(files[name].decode('cp1252'),files['Majesty/Merged.gpl'].decode('cp1252')).encode('cp1252')
    archive,record=retire_buildings(read_cam(a.units.read_bytes()))
    a.out.mkdir()
    for n,b in files.items():
        p=a.out/'sources'/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
    shutil.copytree(a.source/'routes',a.out/'routes')
    for n in ['resources','stock-fixture']:(a.out/n).symlink_to((a.source/n).resolve(),target_is_directory=True)
    record.update(priorSourceStage=digest(proof_raw),priorUnitCatalog=digest(a.units.read_bytes()),
        allActorDefinitionsRetained=True,allOtherSourceFilesByteIdentical=True,
        changedFunctions=['Random_Hero_Type','MJC_Random_Hero_Type'],
        policy=digest((ROOT/'scripts/lib/community_more_heroes_retirement.py').read_bytes()))
    proof.update(files={n:digest(b)for n,b in files.items()},moreHeroesRetirement=record,compiled=False,published=False)
    (a.out/'source-stage.json').write_text(json.dumps(proof,indent=2)+'\n')
    (a.out/'mx_Unittype.cam').write_bytes(archive.to_bytes())
    print(json.dumps(record))

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['source','units','out']:p.add_argument('--'+n,type=Path,required=True)
    stage(p.parse_args())

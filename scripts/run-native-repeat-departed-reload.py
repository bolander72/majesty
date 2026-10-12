#!/usr/bin/env python3
"""Fresh original reload/save of the actual outgoing removal snapshot."""
import argparse,json,os,shutil,struct,subprocess,tempfile,time,runpy
from pathlib import Path
_r=runpy.run_path(str(Path(__file__).with_name('run-native-repeat-return.py')))
ROOT,GAME,SOURCES,sha=(_r[k] for k in ['ROOT','GAME','SOURCES','sha'])
from native_entity_pair import selected_revision_input
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('departure_report',type=Path);p.add_argument('--attempt',type=int,required=True);a=p.parse_args()
    if a.attempt<=0:p.error('Attempt must be positive')
    out=ROOT/f'output/native-repeat-departed-reload-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
    if out.exists() or log.exists():p.error('Preserve prior native attempts')
    rows=subprocess.check_output(['ps','-axo','pid=,comm='],text=True).splitlines()
    if any(Path(r.split(None,1)[1]).name in ['pop_smoke','clang','clang++','ninja'] for r in rows if len(r.split(None,1))==2):p.error('Another native game/build is live')
    recorded=json.loads(a.departure_report.read_text());proof=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/check-native-repeat-departure.mjs'),recorded['sourceManifest'],'--stdout']))
    for r in [recorded,proof]:r['sourceSha256']={k:v for k,v in r['sourceSha256'].items() if not k.startswith('scripts/')}
    if recorded!=proof:p.error('Original outgoing removal proof changed')
    prior=proof['fixture'];source=Path(prior['profile']);identity=proof['identity'];capsule=json.loads(Path(prior['crossingCapsule']).read_text());plan=capsule['plan']
    executable=GAME/'build/recomp/pop_smoke';executable_hash=sha(executable);source_hashes={str(f.relative_to(ROOT)):sha(f) for f in SOURCES}
    if source_hashes!=prior['nativeSourceSha256'] or executable_hash!=prior['nativeExecutableSha256AtLaunch']:p.error('Current native generation differs from removal')
    run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-joint-reload-',dir=GAME/'build'));profile=run/'frontier_0_0';profile.mkdir();hashes={}
    for name in ['mod-settings.json','Documents/My Games/MajestyHD/MajXPrefs','Documents/My Games/MajestyHD/questdata_majx.sav']:
        if sha(source/name)!=prior['inputHashes'][name]:p.error('Removal settings changed')
        dest=profile/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source/name,dest);hashes[name]=sha(dest)
        if hashes[name]!=prior['inputHashes'][name]:p.error('Settings changed during copy')
    name='Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP';dest=profile/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(proof['after']['filename'],dest);hashes[name]=sha(dest)
    if hashes[name]!=proof['after']['sha256'] or dest.stat().st_size!=proof['after']['bytes']:p.error('Original removal snapshot changed')
    name='Joint_Reload_Expected.bin';(profile/name).write_bytes(struct.pack('<4I',0x31524a4e,2,identity['unitId'],identity['agentId']));hashes[name]=sha(profile/name)
    for name in ['user-mods','frames']:(run/name).mkdir()
    shutil.copy2(GAME/'smoke/frontier-fixed-load.script',run/'load.script')
    receipt_path=Path(plan['receipt']);receipt=json.loads(receipt_path.read_text())
    for side in [0,1]:selected_revision_input(receipt_path,side,receipt['worlds'][side]['sha256'])
    if source_hashes!={str(f.relative_to(ROOT)):sha(f) for f in SOURCES} or executable_hash!=sha(executable):p.error('Native generation changed before launch')
    meta=dict(nativeOnly=True,browserUsed=False,nativeSessionTerminal=False,nativeExitCode=None,repeatDepartedReload=True,
        reloadDepartedNpc=True,observeMotion=False,scheduleNpc=False,departNpc=False,reloadScheduledNpc=False,activateReturnedNpc=False,
        clockMode='pinned',physicalGridExtent=512,profile=str(profile),fixture=str(run),log=str(log),**identity,inputHashes=hashes,
        sourceDepartureReport=str(a.departure_report.resolve()),sourceDepartureReportSha256=sha(a.departure_report),
        nativeSourceSha256=source_hashes,nativeExecutableSha256AtLaunch=executable_hash)
    out.write_text(json.dumps(meta,indent=2)+'\n')
    env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')}
    env.update(RECOMP_PROFILE_DIR=str(profile),RECOMP_RULE_FRONTIER_REGION='0_0',RECOMP_RULE_INVENTORY_COMPAT='1',RECOMP_BROWSER_STREAMING_DEBUG='1',
        RECOMP_BROWSER_STREAMING_JOINT_RELOAD_FIXTURE='1',RECOMP_BROWSER_STREAMING_JOINT_DEPARTED_RELOAD_FIXTURE='1',RECOMP_PIN_CLOCK='1',
        RECOMP_GUEST_ARGS='-nointro -dochecksums',RECOMP_SMOKE_SECONDS='45',RECOMP_SMOKE_WINDOW_INPUT='1',RECOMP_SMOKE_DRAWABLE='800x600',
        RECOMP_CORE_MODS_DIR=str(GAME/'build/recomp/mods/core'),RECOMP_MODS_DIR=str(run/'user-mods'),RECOMP_HOST_DUMP_DIR=str(run/'frames'),RECOMP_SCRIPT=str(run/'load.script'))
    with log.open('x') as f:
        meta['startedAtMs']=time.time_ns()//1000000;process=subprocess.Popen([str(executable)],cwd=GAME/'kit',stdout=f,stderr=subprocess.STDOUT,env=env)
        meta['nativePid']=process.pid;out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps(dict(nativePid=process.pid,fixture=run.name)),flush=True);code=process.wait()
    meta.update(nativeSessionTerminal=True,nativeExitCode=code,finishedAtMs=time.time_ns()//1000000);out.write_text(json.dumps(meta,indent=2)+'\n')
    print(json.dumps(dict(nativeExitCode=code,nativeSessionTerminal=True)),flush=True);raise SystemExit(code)
if __name__=='__main__':main()

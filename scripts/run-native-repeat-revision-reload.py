#!/usr/bin/env python3
"""Load either committed revision6 world without insertion/removal, native only."""
import argparse,json,os,shutil,struct,subprocess,tempfile,time,runpy
from pathlib import Path
_r=runpy.run_path(str(Path(__file__).with_name('run-native-repeat-return.py')))
ROOT,GAME,SOURCES,sha=(_r[k] for k in ['ROOT','GAME','SOURCES','sha'])
from native_entity_pair import selected_revision_input
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('publication',type=Path);p.add_argument('receipt',type=Path);p.add_argument('build_report',type=Path)
    p.add_argument('--side',type=int,choices=[0,1],required=True);p.add_argument('--attempt',type=int,required=True);a=p.parse_args()
    if a.attempt<=0:p.error('Attempt must be positive')
    out=ROOT/f'output/native-repeat-revision-reload-side{a.side}-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
    if out.exists() or log.exists():p.error('Preserve prior committed reload attempts')
    rows=subprocess.check_output(['ps','-axo','pid=,comm='],text=True).splitlines()
    if any(Path(r.split(None,1)[1]).name in ['pop_smoke','clang','clang++','ninja'] for r in rows if len(r.split(None,1))==2):p.error('Another native game/build is live')
    checked=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/prepare-native-repeat-revision-inputs.mjs'),str(a.publication.resolve()),str(a.receipt.resolve()),str(a.side)]))
    prior=checked['producer'];source=Path(prior['profile']).resolve();active=checked['active'];identity=checked['identity']
    if not source.is_relative_to((GAME/'build').resolve()) or source.name!='frontier_0_0':p.error('Require owned original producer settings')
    build=json.loads(a.build_report.read_text());executable=GAME/'build/recomp/pop_smoke';executable_hash=sha(executable);source_hashes={str(f.relative_to(ROOT)):sha(f) for f in SOURCES}
    if build.get('nativeBuildQualified') is not True or build.get('exitCode')!=0 or source_hashes!=build['nativeSourceSha256'] or executable_hash!=build['nativeExecutableSha256']:p.error('Current build provenance differs')
    # Incoming producer used its preserved exact build. The new loader is the
    # current pinned build: unchanged game config/frontier, actual original save
    # and original writer equality must be qualified after this independent load.
    for f in [GAME/'browser_frontier.cpp',GAME/'game.toml']:
        if source_hashes[str(f.relative_to(ROOT))]!=prior['nativeSourceSha256'][str(f.relative_to(ROOT))]:p.error('Pinned configuration/frontier differs from producer')
    run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-joint-reload-',dir=GAME/'build'));profile=run/'frontier_0_0';profile.mkdir();hashes={}
    for name in ['mod-settings.json','Documents/My Games/MajestyHD/MajXPrefs','Documents/My Games/MajestyHD/questdata_majx.sav']:
        if sha(source/name)!=prior['inputHashes'][name]:p.error('Producer settings changed')
        dest=profile/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source/name,dest);hashes[name]=sha(dest)
        if hashes[name]!=prior['inputHashes'][name]:p.error('Settings changed during copy')
    selected=checked['selectedRevisionExport'];name='Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP';dest=profile/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(selected['filename'],dest);hashes[name]=sha(dest)
    if hashes[name]!=selected['sha256'] or dest.stat().st_size!=selected['bytes']:p.error('Current committed world changed')
    writers={}
    if active:
        with dest.open('rb') as f:
            for kind,r in checked['expectedRecords'].items():
                if not 0<r['size']<=2048:p.error('Writer exceeds bounded extent')
                f.seek(r['offset']);data=f.read(r['size']);name=f'Script_Composed_{kind}_2101_0.bin';(profile/name).write_bytes(data);hashes[name]=sha(profile/name)
                if len(data)!=r['size'] or hashes[name]!=r['sha256']:p.error('Actual committed writer changed')
                writers[kind]=dict(bytes=r['size'],sha256=r['sha256'])
    name='Joint_Reload_Expected.bin';(profile/name).write_bytes(struct.pack('<4I',0x31524a4e,1 if active else 2,identity['unitId'],identity['agentId']));hashes[name]=sha(profile/name)
    for name in ['user-mods','frames']:(run/name).mkdir()
    shutil.copy2(GAME/'smoke/frontier-fixed-load.script',run/'load.script')
    receipt=json.loads(a.receipt.read_text())
    for side in [0,1]:
        current=selected_revision_input(a.receipt,side,receipt['worlds'][side]['sha256'])
        if side==a.side and current!=selected:p.error('Committed current revision changed before launch')
    if json.loads(Path(checked['producerManifest']).read_text())!=prior or sha(Path(checked['producerManifest']))!=checked['producerManifestSha256']:p.error('Producer manifest changed')
    if source_hashes!={str(f.relative_to(ROOT)):sha(f) for f in SOURCES} or executable_hash!=sha(executable):p.error('Native generation changed before launch')
    meta=dict(nativeOnly=True,browserUsed=False,nativeSessionTerminal=False,nativeExitCode=None,repeatCommittedReload=True,side=a.side,active=active,
        reloadDepartedNpc=not active,observeMotion=active,reloadScheduledNpc=active,captureEvolvedNpc=active,scheduleNpc=False,departNpc=False,activateReturnedNpc=False,
        clockMode='monotonic' if active else 'pinned',physicalGridExtent=checked['physicalGridExtent'],profile=str(profile),fixture=str(run),log=str(log),**identity,inputHashes=hashes,expectedWriters=writers,
        publicationReport=str(a.publication.resolve()),publicationReportSha256=checked['publicationReportSha256'],selectedRevisionExport=selected,
        producerManifest=checked['producerManifest'],producerManifestSha256=checked['producerManifestSha256'],buildReport=str(a.build_report.resolve()),buildReportSha256=sha(a.build_report),
        nativeSourceSha256=source_hashes,nativeExecutableSha256AtLaunch=executable_hash)
    out.write_text(json.dumps(meta,indent=2)+'\n')
    env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')}
    env.update(RECOMP_PROFILE_DIR=str(profile),RECOMP_RULE_FRONTIER_REGION='0_0',RECOMP_RULE_INVENTORY_COMPAT='1',RECOMP_BROWSER_STREAMING_DEBUG='1',RECOMP_BROWSER_STREAMING_JOINT_RELOAD_FIXTURE='1',
        RECOMP_GUEST_ARGS='-nointro -dochecksums',RECOMP_SMOKE_SECONDS='45',RECOMP_SMOKE_WINDOW_INPUT='1',RECOMP_SMOKE_DRAWABLE='800x600',
        RECOMP_CORE_MODS_DIR=str(GAME/'build/recomp/mods/core'),RECOMP_MODS_DIR=str(run/'user-mods'),RECOMP_HOST_DUMP_DIR=str(run/'frames'),RECOMP_SCRIPT=str(run/'load.script'))
    if active:env.update(RECOMP_BROWSER_STREAMING_JOINT_SCHEDULE_RELOAD_FIXTURE='1',RECOMP_BROWSER_STREAMING_JOINT_MOTION_FIXTURE='1',RECOMP_BROWSER_STREAMING_JOINT_EVOLVED_CHECKPOINT_FIXTURE='1')
    else:env.update(RECOMP_PIN_CLOCK='1',RECOMP_BROWSER_STREAMING_JOINT_DEPARTED_RELOAD_FIXTURE='1')
    with log.open('x') as f:
        meta['startedAtMs']=time.time_ns()//1000000;process=subprocess.Popen([str(executable)],cwd=GAME/'kit',stdout=f,stderr=subprocess.STDOUT,env=env)
        meta['nativePid']=process.pid;out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps(dict(nativePid=process.pid,side=a.side,fixture=run.name)),flush=True);code=process.wait()
    meta.update(nativeSessionTerminal=True,nativeExitCode=code,finishedAtMs=time.time_ns()//1000000);out.write_text(json.dumps(meta,indent=2)+'\n')
    print(json.dumps(dict(nativeExitCode=code,nativeSessionTerminal=True,side=a.side)),flush=True);raise SystemExit(code)
if __name__=='__main__':main()

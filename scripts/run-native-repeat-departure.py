#!/usr/bin/env python3
"""Remove the current outgoing NPC through the original engine, native only."""
import argparse, json, os, shutil, struct, subprocess, tempfile, time, runpy
from pathlib import Path
_restore=runpy.run_path(str(Path(__file__).with_name('run-native-repeat-return.py')))
ROOT,GAME,SOURCES,sha=(_restore[k] for k in ['ROOT','GAME','SOURCES','sha'])
from native_entity_pair import selected_revision_input
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('capsule',type=Path);p.add_argument('build_report',type=Path)
    p.add_argument('--attempt',type=int,required=True);a=p.parse_args()
    if a.attempt<=0:p.error('Attempt must be positive')
    out=ROOT/f'output/native-repeat-departure-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
    if out.exists() or log.exists():p.error('Preserve previous native departure attempts')
    rows=subprocess.check_output(['ps','-axo','pid=,comm='],text=True).splitlines()
    if any(Path(r.split(None,1)[1]).name in ['pop_smoke','clang','clang++','ninja'] for r in rows if len(r.split(None,1))==2):p.error('Another native game/build is live')
    subprocess.check_call(['node',str(ROOT/'scripts/prepare-native-repeat-crossing.mjs'),'--verify',str(a.capsule.resolve())],stdout=subprocess.DEVNULL)
    capsule=json.loads(a.capsule.read_text());plan=capsule['plan'];identity=plan['sourceAlias']
    if plan['revision']!=5 or plan['sourceSide']!=0 or plan['destinationSide']!=1 or not plan['departure']['qualified']:p.error('Require current revision5 known-reference departure')
    capture_path=Path(plan['captureReport']);capture=json.loads(capture_path.read_text());prior=capture['fixture']
    if sha(capture_path)!=plan['captureReportSha256']:p.error('Source original capture changed')
    source=Path(prior['profile']).resolve()
    if not source.is_relative_to((GAME/'build').resolve()) or source.name!='frontier_0_0':p.error('Require owned original source settings')
    selected=selected_revision_input(Path(plan['receipt']),0,plan['sourceWorld'])
    if selected['owner']['unitId']!=identity['unitId'] or selected['owner']['agentId']!=identity['agentId']:p.error('Current outgoing owner differs')
    build=json.loads(a.build_report.read_text());source_hashes={str(f.relative_to(ROOT)):sha(f) for f in SOURCES};executable=GAME/'build/recomp/pop_smoke';executable_hash=sha(executable)
    if build.get('nativeBuildQualified') is not True or build.get('exitCode')!=0 or build['nativeSourceSha256']!=source_hashes or build['nativeExecutableSha256']!=executable_hash:p.error('Current build provenance differs')
    run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-joint-reload-',dir=GAME/'build'));profile=run/'frontier_0_0';profile.mkdir();hashes={}
    for name in ['mod-settings.json','Documents/My Games/MajestyHD/MajXPrefs','Documents/My Games/MajestyHD/questdata_majx.sav']:
        if sha(source/name)!=prior['inputHashes'][name]:p.error('Original source settings changed')
        dest=profile/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source/name,dest);hashes[name]=sha(dest)
        if hashes[name]!=prior['inputHashes'][name]:p.error('Settings changed during copy')
    name='Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP';dest=profile/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(selected['filename'],dest);hashes[name]=sha(dest)
    if hashes[name]!=selected['sha256'] or dest.stat().st_size!=selected['bytes']:p.error('Selected outgoing save changed')
    for kind,r in plan['records'].items():
        name=f'Script_Composed_{kind}_2101_0.bin';shutil.copy2(Path(capsule['directory'])/(kind+'.bin'),profile/name);hashes[name]=sha(profile/name)
        if (profile/name).stat().st_size!=r['size'] or hashes[name]!=r['sha256']:p.error('Current outgoing writers changed')
    name='Joint_Reload_Expected.bin';(profile/name).write_bytes(struct.pack('<4I',0x31524a4e,1,identity['unitId'],identity['agentId']));hashes[name]=sha(profile/name)
    for name in ['user-mods','frames']:(run/name).mkdir()
    shutil.copy2(GAME/'smoke/frontier-fixed-load.script',run/'load.script')
    receipt=json.loads(Path(plan['receipt']).read_text())
    for side in [0,1]:
        current=selected_revision_input(Path(plan['receipt']),side,receipt['worlds'][side]['sha256'])
        if side==0 and current!=selected:p.error('Outgoing current revision changed before launch')
    if source_hashes!={str(f.relative_to(ROOT)):sha(f) for f in SOURCES} or executable_hash!=sha(executable):p.error('Native generation changed before launch')
    meta=dict(nativeOnly=True,browserUsed=False,nativeSessionTerminal=False,nativeExitCode=None,repeatOutgoingDeparture=True,
        observeMotion=False,reloadScheduledNpc=True,activateReturnedNpc=False,departNpc=True,scheduleNpc=False,reloadDepartedNpc=False,
        clockMode='pinned',physicalGridExtent=512,profile=str(profile),fixture=str(run),log=str(log),**identity,inputHashes=hashes,
        crossingCapsule=str(a.capsule.resolve()),crossingCapsuleSha256=sha(a.capsule),selectedRevisionExport=selected,
        sourceCaptureReport=str(capture_path),sourceCaptureReportSha256=sha(capture_path),
        buildReport=str(a.build_report.resolve()),buildReportSha256=sha(a.build_report),nativeSourceSha256=source_hashes,nativeExecutableSha256AtLaunch=executable_hash)
    out.write_text(json.dumps(meta,indent=2)+'\n')
    env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')}
    env.update(RECOMP_PROFILE_DIR=str(profile),RECOMP_RULE_FRONTIER_REGION='0_0',RECOMP_RULE_INVENTORY_COMPAT='1',RECOMP_BROWSER_STREAMING_DEBUG='1',
        RECOMP_BROWSER_STREAMING_JOINT_RELOAD_FIXTURE='1',RECOMP_BROWSER_STREAMING_JOINT_SCHEDULE_RELOAD_FIXTURE='1',
        RECOMP_BROWSER_STREAMING_JOINT_DEPARTURE_FIXTURE='1',RECOMP_BROWSER_STREAMING_REPEAT_DEPARTURE_FIXTURE='1',RECOMP_PIN_CLOCK='1',
        RECOMP_GUEST_ARGS='-nointro -dochecksums',RECOMP_SMOKE_SECONDS='45',RECOMP_SMOKE_WINDOW_INPUT='1',RECOMP_SMOKE_DRAWABLE='800x600',
        RECOMP_CORE_MODS_DIR=str(GAME/'build/recomp/mods/core'),RECOMP_MODS_DIR=str(run/'user-mods'),RECOMP_HOST_DUMP_DIR=str(run/'frames'),RECOMP_SCRIPT=str(run/'load.script'))
    with log.open('x') as f:
        meta['startedAtMs']=time.time_ns()//1000000;process=subprocess.Popen([str(executable)],cwd=GAME/'kit',stdout=f,stderr=subprocess.STDOUT,env=env)
        meta['nativePid']=process.pid;out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps(dict(nativePid=process.pid,fixture=run.name)),flush=True);code=process.wait()
    meta.update(nativeSessionTerminal=True,nativeExitCode=code,finishedAtMs=time.time_ns()//1000000);out.write_text(json.dumps(meta,indent=2)+'\n')
    print(json.dumps(dict(nativeExitCode=code,nativeSessionTerminal=True)),flush=True);raise SystemExit(code)
if __name__=='__main__':main()

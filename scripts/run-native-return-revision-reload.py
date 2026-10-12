#!/usr/bin/env python3
"""Load a committed native return snapshot without inserting or deleting actors."""
import argparse, hashlib, json, os, shutil, struct, subprocess, tempfile, time
from pathlib import Path
from native_entity_pair import selected_revision_input
ROOT=Path(__file__).resolve().parents[1]
GAME=ROOT/'upstream/majesty-recomp'
def sha(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as f:
        for b in iter(lambda:f.read(4096),b''):h.update(b)
    return h.hexdigest()
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('publication',type=Path);p.add_argument('receipt',type=Path)
    p.add_argument('--side',type=int,choices=[0,1],required=True);p.add_argument('--attempt',type=int,required=True);a=p.parse_args()
    if a.attempt<=0:p.error('Attempt must be positive')
    out=ROOT/f'output/native-return-revision-reload-side{a.side}-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
    if out.exists() or log.exists():p.error('Preserve previous committed revision reload attempts')
    # Never run alongside another native game or resource-intensive build.
    processes=subprocess.check_output(['ps','-axo','pid=,comm='],text=True)
    if any(Path(row.split(None,1)[1]).name in ['pop_smoke','clang','clang++','ninja'] for row in processes.splitlines() if len(row.split(None,1))==2):
        p.error('Another native game or build is still live')
    checked=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/check-native-return-revision-reload.mjs'),'--inputs',
        str(a.publication.resolve()),str(a.receipt.resolve()),str(a.side)]))
    prior=checked['producer'];source=Path(prior['profile']).resolve()
    if not source.is_relative_to((GAME/'build').resolve()) or source.name!='frontier_0_0':p.error('Require owned verified producer settings')
    if sha(GAME/'build/recomp/pop_smoke')!=prior['nativeExecutableSha256AtLaunch']:p.error('Native executable differs from producer')
    run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-joint-reload-',dir=GAME/'build'));profile=run/'frontier_0_0';profile.mkdir()
    hashes={}
    for name in ['mod-settings.json','Documents/My Games/MajestyHD/MajXPrefs','Documents/My Games/MajestyHD/questdata_majx.sav']:
        if sha(source/name)!=prior['inputHashes'][name]:p.error('Producer settings changed')
        dest=profile/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source/name,dest);hashes[name]=sha(dest)
        if hashes[name]!=prior['inputHashes'][name]:p.error('Settings changed during copy')
    selected=checked['selectedRevisionExport'];name='Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP'
    dest=profile/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(selected['filename'],dest);hashes[name]=sha(dest)
    if hashes[name]!=selected['sha256'] or dest.stat().st_size!=selected['bytes']:p.error('Selected snapshot changed during copy')
    writers={}
    if a.side==0:
        with dest.open('rb') as f:
            for kind,r in checked['expectedRecords'].items():
                if not 0<r['size']<=2048:p.error('Writer exceeds bounded record extent')
                f.seek(r['offset']);data=f.read(r['size']);digest=hashlib.sha256(data).hexdigest()
                if len(data)!=r['size'] or digest!=r['sha256']:p.error('Selected expected writer changed')
                name=f'Script_Composed_{kind}_2101_0.bin';(profile/name).write_bytes(data);hashes[name]=digest;writers[kind]=dict(bytes=r['size'],sha256=digest)
    identity=checked['identity'];name='Joint_Reload_Expected.bin'
    (profile/name).write_bytes(struct.pack('<4I',0x31524a4e,2 if a.side else 1,identity['unitId'],identity['agentId']));hashes[name]=sha(profile/name)
    for name in ['user-mods','frames']:(run/name).mkdir()
    shutil.copy2(GAME/'smoke/frontier-fixed-load.script',run/'load.script')
    # Recheck BOTH current exports after copying; historical verification never
    # authorizes a fresh native launch.
    receipt=json.loads(a.receipt.read_text())
    for side in [0,1]:
        current=selected_revision_input(a.receipt,side,receipt['worlds'][side]['sha256'])
        if side==a.side and current!=selected:p.error('Selected revision changed before native launch')
    producer_manifest=Path(json.loads(a.publication.read_text())['preparation']['departedReloadReport' if a.side else 'incomingReloadReport'])
    producer_manifest=Path(json.loads(producer_manifest.read_text())['sourceManifest'])
    if json.loads(producer_manifest.read_text())!=prior:p.error('Producer manifest differs from requalified history')
    meta=dict(nativeOnly=True,browserUsed=False,nativeSessionTerminal=False,nativeExitCode=None,side=a.side,
        reloadCommittedReturn=True,clockMode='pinned' if a.side else 'monotonic',observeMotion=not a.side,reloadScheduledNpc=not a.side,
        scheduleNpc=False,departNpc=False,reloadDepartedNpc=bool(a.side),activateReturnedNpc=False,captureEvolvedNpc=not a.side,
        physicalGridExtent=256 if a.side else 512,profile=str(profile),fixture=str(run),log=str(log),**identity,
        publicationReport=str(a.publication.resolve()),publicationReportSha256=checked['publicationSha256'],selectedRevisionExport=selected,
        producerManifest=str(producer_manifest),producerManifestSha256=sha(producer_manifest),inputHashes=hashes,expectedWriters=writers,
        nativeSourceSha256={str(f.relative_to(ROOT)):sha(f) for f in [GAME/'browser_frontier.cpp',GAME/'browser_streaming.cpp',GAME/'game.toml']},
        nativeExecutableSha256AtLaunch=sha(GAME/'build/recomp/pop_smoke'))
    for name,digest in meta['nativeSourceSha256'].items():
        if digest!=prior['nativeSourceSha256'][name]:p.error('Native source changed before launch')
    out.write_text(json.dumps(meta,indent=2)+'\n')
    env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')}
    env.update(RECOMP_PROFILE_DIR=str(profile),RECOMP_RULE_FRONTIER_REGION='0_0',RECOMP_RULE_INVENTORY_COMPAT='1',
        RECOMP_BROWSER_STREAMING_DEBUG='1',RECOMP_BROWSER_STREAMING_JOINT_RELOAD_FIXTURE='1',
        RECOMP_GUEST_ARGS='-nointro -dochecksums',RECOMP_SMOKE_SECONDS='45',RECOMP_SMOKE_WINDOW_INPUT='1',RECOMP_SMOKE_DRAWABLE='800x600',
        RECOMP_CORE_MODS_DIR=str(GAME/'build/recomp/mods/core'),RECOMP_MODS_DIR=str(run/'user-mods'),RECOMP_HOST_DUMP_DIR=str(run/'frames'),RECOMP_SCRIPT=str(run/'load.script'))
    if a.side:env.update(RECOMP_PIN_CLOCK='1',RECOMP_BROWSER_STREAMING_JOINT_DEPARTED_RELOAD_FIXTURE='1')
    else:env.update(RECOMP_BROWSER_STREAMING_JOINT_SCHEDULE_RELOAD_FIXTURE='1',RECOMP_BROWSER_STREAMING_JOINT_MOTION_FIXTURE='1',RECOMP_BROWSER_STREAMING_JOINT_EVOLVED_CHECKPOINT_FIXTURE='1')
    with log.open('x') as f:
        meta['startedAtMs']=time.time_ns()//1000000
        process=subprocess.Popen([str(GAME/'build/recomp/pop_smoke')],cwd=GAME/'kit',stdout=f,stderr=subprocess.STDOUT,env=env)
        meta['nativePid']=process.pid;out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps(dict(nativePid=process.pid,side=a.side,fixture=run.name)),flush=True);code=process.wait()
    meta.update(nativeSessionTerminal=True,nativeExitCode=code,finishedAtMs=time.time_ns()//1000000)
    out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps(dict(nativeExitCode=code,nativeSessionTerminal=True,side=a.side)),flush=True);raise SystemExit(code)
if __name__=='__main__':main()

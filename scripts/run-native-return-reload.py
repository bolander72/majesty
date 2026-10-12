#!/usr/bin/env python3
"""Fresh native load and natural continuation of a qualified returned full save."""
import argparse, errno, hashlib, json, os, shutil, struct, subprocess, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
GAME=ROOT/'upstream/majesty-recomp'
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(65536),b''):h.update(b)
    return h.hexdigest()
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('return_report',type=Path);p.add_argument('--attempt',type=int,required=True);a=p.parse_args()
    if a.attempt<=0:p.error('Attempt must be positive')
    report=a.return_report.resolve()
    out=ROOT/f'output/native-return-reload-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
    if out.exists() or log.exists():p.error('Preserve previous returned-world reload attempts')
    proof=json.loads(report.read_text())
    checked=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/check-native-return-active.mjs'),proof['sourceManifest'],'--stdout']))
    if checked!=proof or proof.get('originalReturnedFullSaveQualified') is not True:p.error('Returned full-save qualification changed')
    prior=proof['fixture'];source=Path(prior['profile']).resolve()
    if not source.is_relative_to((GAME/'build').resolve()) or source.name!='frontier_0_0' or not source.parent.name.startswith('actor-arrival-fixture-original-source-'):
        p.error('Require the owned returned-save profile')
    try:os.kill(prior['nativePid'],0)
    except OSError as e:
        if e.errno!=errno.ESRCH:raise
    else:p.error('Return producer is still live')
    saved=Path(proof['after']['filename']).resolve()
    if saved!=source/'Documents/My Games/MajestyHD/SaveGame/Joint_Evolved.GMP' or sha(saved)!=proof['after']['sha256'] or saved.stat().st_size!=proof['after']['bytes']:
        p.error('Returned original evolved save changed')
    run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-return-reload-',dir=GAME/'build'));profile=run/'frontier_0_0';profile.mkdir()
    hashes={}
    for name in ['mod-settings.json','Documents/My Games/MajestyHD/MajXPrefs','Documents/My Games/MajestyHD/questdata_majx.sav']:
        if sha(source/name)!=prior['inputHashes'][name]:p.error('Copied return producer settings changed')
        dest=profile/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source/name,dest);hashes[name]=sha(dest)
        if hashes[name]!=prior['inputHashes'][name]:p.error('Settings changed while copying')
    name='Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP';dest=profile/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(saved,dest);hashes[name]=sha(dest)
    if hashes[name]!=proof['after']['sha256'] or dest.stat().st_size!=proof['after']['bytes']:p.error('Returned save changed while copying')
    expected=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/prepare-native-evolved-writers.mjs'),str(report),str(profile),'--returned']))
    for kind in expected:
        name=f'Script_Composed_{kind}_2101_0.bin';hashes[name]=sha(profile/name)
    unit_id,agent_id=proof['identity']['unitId'],proof['identity']['agentId']
    name='Joint_Reload_Expected.bin';(profile/name).write_bytes(struct.pack('<4I',0x31524a4e,1,unit_id,agent_id));hashes[name]=sha(profile/name)
    for name in ['user-mods','frames']:(run/name).mkdir()
    shutil.copy2(GAME/'smoke/frontier-fixed-load.script',run/'load.script')
    meta=dict(nativeOnly=True,browserUsed=False,nativeSessionTerminal=False,nativeExitCode=None,clockMode='monotonic',
        reloadReturnedNpc=True,observeMotion=True,reloadScheduledNpc=True,scheduleNpc=False,departNpc=False,reloadDepartedNpc=False,
        activateReturnedNpc=False,captureEvolvedNpc=True,physicalGridExtent=512,profile=str(profile),fixture=str(run),log=str(log),
        unitId=unit_id,agentId=agent_id,inputHashes=hashes,expectedReturnedWriters=expected,
        sourceReturnReport=str(report),sourceReturnReportSha256=sha(report),sourceManifest=proof['sourceManifest'],sourceManifestSha256=proof['sourceManifestSha256'],
        nativeSourceSha256={str(f.relative_to(ROOT)):sha(f) for f in [GAME/'browser_frontier.cpp',GAME/'browser_streaming.cpp',GAME/'game.toml']},
        nativeExecutableSha256AtLaunch=sha(GAME/'build/recomp/pop_smoke'))
    out.write_text(json.dumps(meta,indent=2)+'\n')
    env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')}
    env.update(RECOMP_PROFILE_DIR=str(profile),RECOMP_RULE_FRONTIER_REGION='0_0',RECOMP_RULE_INVENTORY_COMPAT='1',
        RECOMP_BROWSER_STREAMING_DEBUG='1',RECOMP_BROWSER_STREAMING_JOINT_RELOAD_FIXTURE='1',RECOMP_BROWSER_STREAMING_JOINT_SCHEDULE_RELOAD_FIXTURE='1',
        RECOMP_BROWSER_STREAMING_JOINT_MOTION_FIXTURE='1',RECOMP_BROWSER_STREAMING_JOINT_EVOLVED_CHECKPOINT_FIXTURE='1',
        RECOMP_GUEST_ARGS='-nointro -dochecksums',RECOMP_SMOKE_SECONDS='45',RECOMP_SMOKE_WINDOW_INPUT='1',RECOMP_SMOKE_DRAWABLE='800x600',
        RECOMP_CORE_MODS_DIR=str(GAME/'build/recomp/mods/core'),RECOMP_MODS_DIR=str(run/'user-mods'),RECOMP_HOST_DUMP_DIR=str(run/'frames'),RECOMP_SCRIPT=str(run/'load.script'))
    with log.open('x') as f:
        process=subprocess.Popen([str(GAME/'build/recomp/pop_smoke')],cwd=GAME/'kit',stdout=f,stderr=subprocess.STDOUT,env=env)
        meta['nativePid']=process.pid;out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps(dict(nativePid=process.pid,fixture=run.name)),flush=True);code=process.wait()
    meta.update(nativeSessionTerminal=True,nativeExitCode=code);out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps(dict(nativeExitCode=code,nativeSessionTerminal=True)),flush=True);raise SystemExit(code)
if __name__=='__main__':main()

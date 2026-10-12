#!/usr/bin/env python3
"""Restore the next current NPC in its real receiving map; isolated native only."""
import argparse, hashlib, json, os, shutil, struct, subprocess, tempfile, time
from pathlib import Path
from native_entity_pair import selected_revision_input
ROOT=Path(__file__).resolve().parents[1]
GAME=ROOT/'upstream/majesty-recomp'
SOURCES=[GAME/'browser_frontier.cpp',GAME/'browser_streaming.cpp',GAME/'game.toml']
def sha(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as f:
        for b in iter(lambda:f.read(4096),b''):h.update(b)
    return h.hexdigest()
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('capsule',type=Path);p.add_argument('build_report',type=Path)
    p.add_argument('--attempt',type=int,required=True);p.add_argument('--activate',action='store_true');a=p.parse_args()
    if a.attempt<=0:p.error('Attempt must be positive')
    mode='-active' if a.activate else ''
    out=ROOT/f'output/native-repeat-return{mode}-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
    if out.exists() or log.exists():p.error('Preserve previous repeated restore attempts')
    rows=subprocess.check_output(['ps','-axo','pid=,comm='],text=True).splitlines()
    if any(Path(r.split(None,1)[1]).name in ['pop_smoke','clang','clang++','ninja'] for r in rows if len(r.split(None,1))==2):
        p.error('Another native game or build is live')
    build=json.loads(a.build_report.read_text())
    source_hashes={str(f.relative_to(ROOT)):sha(f) for f in SOURCES}
    executable=GAME/'build/recomp/pop_smoke';executable_hash=sha(executable)
    if build.get('nativeBuildQualified') is not True or build.get('exitCode')!=0 or build['nativeSourceSha256']!=source_hashes or build['nativeExecutableSha256']!=executable_hash:
        p.error('Current native build is not bound to this source and executable')
    exporter=ROOT/'scripts/export-native-repeat-return-packet.mjs'
    checked=json.loads(subprocess.check_output(['node',str(exporter),str(a.capsule.resolve()),'--inputs']))
    prior=checked['producer'];source=Path(prior['profile']).resolve()
    if not source.is_relative_to((GAME/'build').resolve()) or source.name!='frontier_0_0':p.error('Require verified receiving settings')
    run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-joint-reload-',dir=GAME/'build'));profile=run/'frontier_0_0';profile.mkdir()
    hashes={}
    for name in ['mod-settings.json','Documents/My Games/MajestyHD/MajXPrefs','Documents/My Games/MajestyHD/questdata_majx.sav']:
        if sha(source/name)!=prior['inputHashes'][name]:p.error('Receiving settings changed')
        dest=profile/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source/name,dest);hashes[name]=sha(dest)
        if hashes[name]!=prior['inputHashes'][name]:p.error('Settings changed during copy')
    selected=checked['selectedRevisionExport'];name='Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP'
    dest=profile/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(selected['filename'],dest);hashes[name]=sha(dest)
    if hashes[name]!=selected['sha256'] or dest.stat().st_size!=selected['bytes']:p.error('Receiving snapshot changed during copy')
    retired=checked['retiredDestinationAlias'];name='Joint_Reload_Expected.bin'
    (profile/name).write_bytes(struct.pack('<4I',0x31524a4e,2,retired['unitId'],retired['agentId']));hashes[name]=sha(profile/name)
    packet=json.loads(subprocess.check_output(['node',str(exporter),str(a.capsule.resolve()),str(profile)]))
    hashes['Native_Return_Packet.bin']=sha(profile/'Native_Return_Packet.bin')
    if hashes['Native_Return_Packet.bin']!=packet['sha256']:p.error('Packet changed')
    for name in ['user-mods','frames']:(run/name).mkdir()
    shutil.copy2(GAME/'smoke/frontier-fixed-load.script',run/'load.script')
    # Both current exports are checked after copies. The preserved generation
    # supports historical evidence only and can never authorize a fresh launch.
    receipt=json.loads(Path(selected['receipt']).read_text())
    for side in [0,1]:
        current=selected_revision_input(Path(selected['receipt']),side,receipt['worlds'][side]['sha256'])
        if side==selected['side'] and current!=selected:p.error('Selected revision changed before launch')
    if source_hashes!={str(f.relative_to(ROOT)):sha(f) for f in SOURCES} or executable_hash!=sha(executable):p.error('Native build changed before launch')
    meta=dict(nativeOnly=True,browserUsed=False,nativeSessionTerminal=False,nativeExitCode=None,
        repeatReturn=True,restoreReturnCommands=True,activateReturnedNpc=a.activate,observeMotion=a.activate,observeReturnMotion=a.activate,captureReturnEvolved=a.activate,
        reloadDepartedNpc=True,clockMode='monotonic' if a.activate else 'pinned',physicalGridExtent=checked['physicalGridExtent'],
        profile=str(profile),fixture=str(run),log=str(log),inputHashes=hashes,privateReturnPacket=packet,
        selectedRevisionExport=selected,producerManifest=checked['producerManifest'],producerManifestSha256=checked['producerManifestSha256'],
        buildReport=str(a.build_report.resolve()),buildReportSha256=sha(a.build_report),
        nativeSourceSha256=source_hashes,nativeExecutableSha256AtLaunch=executable_hash)
    out.write_text(json.dumps(meta,indent=2)+'\n')
    env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')}
    env.update(RECOMP_PROFILE_DIR=str(profile),RECOMP_RULE_FRONTIER_REGION='0_0',RECOMP_RULE_INVENTORY_COMPAT='1',
        RECOMP_BROWSER_STREAMING_DEBUG='1',RECOMP_BROWSER_STREAMING_JOINT_RELOAD_FIXTURE='1',
        RECOMP_BROWSER_STREAMING_JOINT_DEPARTED_RELOAD_FIXTURE='1',RECOMP_BROWSER_STREAMING_PRIVATE_RETURN_FIXTURE='1',
        RECOMP_BROWSER_STREAMING_PRIVATE_RETURN_COMMANDS='1',RECOMP_BROWSER_STREAMING_REPEAT_RETURN_FIXTURE='1',
        RECOMP_GUEST_ARGS='-nointro -dochecksums',RECOMP_SMOKE_SECONDS='45',RECOMP_SMOKE_WINDOW_INPUT='1',RECOMP_SMOKE_DRAWABLE='800x600',
        RECOMP_CORE_MODS_DIR=str(GAME/'build/recomp/mods/core'),RECOMP_MODS_DIR=str(run/'user-mods'),RECOMP_HOST_DUMP_DIR=str(run/'frames'),RECOMP_SCRIPT=str(run/'load.script'))
    if a.activate:env.update(RECOMP_BROWSER_STREAMING_RETURN_ACTIVE_FIXTURE='1',RECOMP_BROWSER_STREAMING_JOINT_MOTION_FIXTURE='1',RECOMP_BROWSER_STREAMING_JOINT_EVOLVED_CHECKPOINT_FIXTURE='1')
    else:env.update(RECOMP_PIN_CLOCK='1')
    with log.open('x') as f:
        meta['startedAtMs']=time.time_ns()//1000000
        process=subprocess.Popen([str(executable)],cwd=GAME/'kit',stdout=f,stderr=subprocess.STDOUT,env=env)
        meta['nativePid']=process.pid;out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps(dict(nativePid=process.pid,fixture=run.name)),flush=True);code=process.wait()
    meta.update(nativeSessionTerminal=True,nativeExitCode=code,finishedAtMs=time.time_ns()//1000000)
    out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps(dict(nativeExitCode=code,nativeSessionTerminal=True)),flush=True);raise SystemExit(code)
if __name__=='__main__':main()

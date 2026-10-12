#!/usr/bin/env python3
"""Load a copied qualified joint full-world checkpoint in one fresh native process."""
import argparse, hashlib, json, os, shutil, struct, subprocess, tempfile
from pathlib import Path
from native_entity_pair import selected_pair_input, selected_revision_input
ROOT=Path(__file__).resolve().parents[1]
GAME=ROOT/'upstream/majesty-recomp'
def sha(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda:f.read(65536),b''): h.update(b)
    return h.hexdigest()
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('checkpoint_report',type=Path);p.add_argument('identity_report',type=Path)
    p.add_argument('--depart-npc',type=Path,metavar='TYPED_REFERENCE_PREFLIGHT')
    p.add_argument('--schedule-npc',action='store_true')
    p.add_argument('--reload-scheduled',type=Path,metavar='SCHEDULE_PROOF')
    p.add_argument('--reload-departed',type=Path,metavar='DEPARTURE_PROOF')
    p.add_argument('--selected-pair',type=Path,metavar='EXPORT_RECEIPT')
    p.add_argument('--selected-revision',type=Path,metavar='REVISION_RECEIPT')
    p.add_argument('--capture-evolved',action='store_true')
    p.add_argument('--reload-evolved',type=Path,metavar='EVOLVED_PROOF')
    p.add_argument('--observe-motion',action='store_true');p.add_argument('--attempt',type=int,required=True);a=p.parse_args()
    evolved_departure=bool(a.reload_evolved and a.depart_npc)
    if a.depart_npc and a.observe_motion:p.error('Departure and motion observations must run separately')
    if a.schedule_npc and (not a.observe_motion or a.depart_npc):p.error('Scheduling requires motion observation and a separate departure run')
    if a.reload_scheduled and (a.schedule_npc or a.observe_motion == bool(a.depart_npc)):p.error('Scheduled reload requires either motion or departure, without reinsertion')
    if a.reload_departed and (a.depart_npc or a.schedule_npc or a.reload_scheduled or a.observe_motion):p.error('Departed reload must run separately from insertion, removal and motion')
    if a.attempt<=0:p.error('Attempt must be positive')
    if a.selected_pair and (not a.reload_scheduled or not a.observe_motion or a.depart_npc):p.error('Selected pair requires scheduled destination motion reload')
    if a.reload_evolved and (a.observe_motion == bool(a.depart_npc) or a.reload_scheduled or a.schedule_npc or a.reload_departed or a.selected_pair):p.error('Evolved reload requires either motion or typed departure, without reinsertion or an old selected pair')
    if evolved_departure and not a.selected_revision:p.error('Evolved departure requires the current selected revision')
    if a.capture_evolved and (not a.observe_motion or not (a.reload_scheduled or a.reload_evolved) or a.depart_npc):p.error('Evolved capture requires scheduled motion reload')
    if a.selected_revision and (not a.reload_evolved or not (a.observe_motion or evolved_departure) or a.selected_pair):p.error('Selected revision requires evolved motion or typed departure reload')
    out=ROOT/f'output/native-joint-reload-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
    if out.exists() or log.exists():p.error('Preserve previous reload attempts')
    proof=json.loads(a.checkpoint_report.read_text());identity=json.loads(a.identity_report.read_text())
    if proof.get('qualified') is not True or identity.get('qualified') is not True or identity.get('naturalNativeRegistryResolutionQualified') is not True:
        p.error('Joint reload requires qualified full checkpoint and natural identity evidence')
    manifest=Path(proof['sourceManifest']);source_meta=json.loads(manifest.read_text())
    if sha(manifest)!=proof['sourceManifestSha256'] or source_meta.get('nativeSessionTerminal') is not True or source_meta.get('nativeExitCode')!=0 or source_meta.get('jointCheckpoint') is not True:
        p.error('Producer evidence is incomplete or changed')
    source=Path(source_meta['profile']).resolve()
    if not source.is_relative_to((GAME/'build').resolve()) or source.name!='frontier_0_0' or not source.parent.name.startswith('actor-arrival-fixture-') or identity['fixture']['profile']!=str(source):
        p.error('Evidence must refer to the same owned copied producer profile')
    saved=source/'Documents/My Games/MajestyHD/SaveGame/Joint_Actor_2101_0.GMP'
    if Path(proof['after']['filename']).resolve()!=saved or sha(saved)!=proof['after']['sha256'] or saved.stat().st_size!=proof['after']['bytes']:
        p.error('Original full-world checkpoint changed')
    unit_id,agent_id=proof['unitId'],proof['agentId']
    scheduled_proof=None
    departed_proof=None
    evolved_proof=None
    if a.reload_scheduled:
        scheduled_proof=json.loads(a.reload_scheduled.read_text())
        checked=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/check-native-npc-schedule.mjs'),scheduled_proof['sourceReloadReport'],'--stdout']))
        if (checked!=scheduled_proof or [checked['unitId'],checked['agentId']]!=[unit_id,agent_id] or
                checked['fixture']['sourceCheckpointReportSha256']!=sha(a.checkpoint_report) or
                checked['fixture']['sourceIdentityReportSha256']!=sha(a.identity_report)):
            p.error('Scheduled checkpoint proof changed or uses another actor/producer')
        saved=Path(checked['after']['filename'])
        if sha(saved)!=checked['after']['sha256']:p.error('Scheduled original checkpoint changed')
    if a.reload_departed:
        departed_proof=json.loads(a.reload_departed.read_text())
        checked=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/check-native-npc-departure.mjs'),departed_proof['sourceReloadReport'],'--stdout']))
        previous=checked['sourceManifest']
        if (checked!=departed_proof or [checked['after']['records'][kind].get(key) for kind,key in [('units',str(unit_id)),('agents',str(agent_id)),('attachments','ORDR:'+str(unit_id))]]!=[None]*3 or
                [checked['before']['records']['units'].get(str(unit_id)),checked['before']['records']['agents'].get(str(agent_id))].count(None) or
                [previous['unitId'],previous['agentId']]!=[unit_id,agent_id] or
                previous['sourceCheckpointReportSha256']!=sha(a.checkpoint_report) or previous['sourceIdentityReportSha256']!=sha(a.identity_report)):
            p.error('Departure proof changed or uses another actor/producer')
        saved=Path(checked['after']['filename'])
        if sha(saved)!=checked['after']['sha256']:p.error('Departed original checkpoint changed')
    if a.reload_evolved:
        evolved_proof=json.loads(a.reload_evolved.read_text())
        checked=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/check-native-npc-evolved.mjs'),evolved_proof['sourceManifest'],'--stdout']))
        if (checked!=evolved_proof or checked.get('originalEvolvedFullSaveQualified') is not True or
                [checked['unitId'],checked['agentId']]!=[unit_id,agent_id] or
                checked['fixture']['sourceCheckpointReportSha256']!=sha(a.checkpoint_report) or
                checked['fixture']['sourceIdentityReportSha256']!=sha(a.identity_report)):
            p.error('Evolved checkpoint proof changed or uses another actor/producer')
        saved=Path(checked['after']['filename'])
        if sha(saved)!=checked['after']['sha256']:p.error('Original evolved checkpoint changed')
    if [unit_id,agent_id]!=[identity['observations'][0]['unitId'],identity['observations'][0]['reservedAgentId']]:p.error('Joint identities differ')
    originals={}
    for name,digest in source_meta['sourceHashes'].items():
        if sha(Path(source_meta['source'])/name)!=digest:p.error('Original input changed')
    for name in ['mod-settings.json','Documents/My Games/MajestyHD/MajXPrefs','Documents/My Games/MajestyHD/questdata_majx.sav']:
        file=source/name
        if sha(file)!=source_meta['sourceHashes'][name]:p.error('Copied profile settings changed')
        originals[name]=file
    for kind in ['Unit','GPL','Orders']:
        name=f'Script_Composed_{kind}_2101_0.bin';file=source/name
        digest=identity['evidenceSha256'][str(file.relative_to(ROOT))]
        if file.stat().st_size>4096 or sha(file)!=digest:p.error('Original joint writer changed')
        if not a.reload_evolved:originals[name]=file
    selected=None
    if a.selected_pair:
        selected=selected_pair_input(a.selected_pair,1,scheduled_proof['after']['sha256']);saved=Path(selected['filename'])
    if a.selected_revision:
        selected=selected_revision_input(a.selected_revision,1,evolved_proof['after']['sha256']);saved=Path(selected['filename'])
    if a.depart_npc:
        preflight=json.loads(a.depart_npc.read_text())
        if (preflight.get('qualified') is not True or preflight.get('incoming')!=[] or preflight.get('unsupportedOrders')!=[] or
                [preflight.get('unitId'),preflight.get('agentId')]!=[unit_id,agent_id] or preflight.get('checkpointSha256')!=sha(saved) or
                preflight.get('largestRead',4097)>4096):p.error('Departure requires qualified known typed references in the exact copied NPC world')
        if evolved_departure:
            checked=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/inspect-native-npc-departure.mjs'),str(a.reload_evolved.resolve()),'--stdout','--evolved']))
            if checked!=preflight or preflight.get('evolvedSource') is not True or preflight.get('queuedActor')!=1:p.error('Evolved departure preflight changed or saved scheduling is absent')
    run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-joint-reload-',dir=GAME/'build'));profile=run/'frontier_0_0';profile.mkdir()
    input_hashes={}
    for name,file in originals.items():
        target=profile/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(file,target);input_hashes[name]=sha(target)
    name='Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP';target=profile/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(saved,target);input_hashes[name]=sha(target)
    if selected and (input_hashes[name]!=selected['sha256'] or target.stat().st_size!=selected['bytes']):p.error('Selected destination changed while copying')
    evolved_writers=None
    if a.reload_evolved:
        if input_hashes[name]!=evolved_proof['after']['sha256'] or target.stat().st_size!=evolved_proof['after']['size']:p.error('Evolved world changed while copying')
        evolved_writers=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/prepare-native-evolved-writers.mjs'),str(a.reload_evolved.resolve()),str(profile)]))
        for kind in evolved_writers:
            name=f'Script_Composed_{kind}_2101_0.bin';input_hashes[name]=sha(profile/name)
    (profile/'Joint_Reload_Expected.bin').write_bytes(struct.pack('<4I',0x31524a4e,2 if a.reload_departed else 1,unit_id,agent_id));input_hashes['Joint_Reload_Expected.bin']=sha(profile/'Joint_Reload_Expected.bin')
    for name in ['user-mods','frames']:(run/name).mkdir()
    shutil.copy2(GAME/'smoke/frontier-fixed-load.script',run/'load.script')
    meta=dict(clockMode="monotonic" if a.observe_motion else "pinned",observeMotion=a.observe_motion,nativeOnly=True,browserUsed=False,nativeSessionTerminal=False,fixture=str(run),profile=str(profile),log=str(log),unitId=unit_id,agentId=agent_id,sourceManifest=str(manifest),sourceManifestSha256=sha(manifest),sourceCheckpointReport=str(a.checkpoint_report.resolve()),sourceCheckpointReportSha256=sha(a.checkpoint_report),sourceIdentityReport=str(a.identity_report.resolve()),sourceIdentityReportSha256=sha(a.identity_report),inputHashes=input_hashes,nativeSourceSha256={str(f.relative_to(ROOT)):sha(f) for f in [GAME/'browser_frontier.cpp',GAME/'browser_streaming.cpp',GAME/'game.toml']},nativeExecutableSha256AtLaunch=sha(GAME/'build/recomp/pop_smoke'))
    meta['departNpc']=bool(a.depart_npc)
    meta['scheduleNpc']=a.schedule_npc
    meta['reloadScheduledNpc']=bool(a.reload_scheduled)
    meta['reloadDepartedNpc']=bool(a.reload_departed)
    if a.capture_evolved:meta['captureEvolvedNpc']=True
    if a.reload_evolved:meta.update(reloadEvolvedNpc=True,evolvedCheckpointReport=str(a.reload_evolved.resolve()),evolvedCheckpointReportSha256=sha(a.reload_evolved),expectedEvolvedWriters=evolved_writers)
    if evolved_departure:meta['departEvolvedNpc']=True
    if selected:meta['selectedRevisionExport' if a.selected_revision else 'selectedPairExport']=selected
    if a.reload_departed:
        meta.update(departedCheckpointReport=str(a.reload_departed.resolve()),departedCheckpointReportSha256=sha(a.reload_departed))
        if departed_proof.get('evolvedNpcDeparturePerformed') is True:meta['evolvedDepartedReload']=True
    if a.reload_scheduled:
        meta.update(scheduledCheckpointReport=str(a.reload_scheduled.resolve()),scheduledCheckpointReportSha256=sha(a.reload_scheduled))
    if a.depart_npc:
        meta.update(departurePreflight=str(a.depart_npc.resolve()),departurePreflightSha256=sha(a.depart_npc))
    out.write_text(json.dumps(meta,indent=2)+'\n')
    env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')}
    env.update(RECOMP_PROFILE_DIR=str(profile),RECOMP_RULE_FRONTIER_REGION='0_0',RECOMP_RULE_INVENTORY_COMPAT='1',RECOMP_BROWSER_STREAMING_DEBUG='1',RECOMP_BROWSER_STREAMING_JOINT_RELOAD_FIXTURE='1',RECOMP_PIN_CLOCK='1',RECOMP_GUEST_ARGS='-nointro -dochecksums',RECOMP_SMOKE_SECONDS='45',RECOMP_SMOKE_WINDOW_INPUT='1',RECOMP_SMOKE_DRAWABLE='800x600',RECOMP_CORE_MODS_DIR=str(GAME/'build/recomp/mods/core'),RECOMP_MODS_DIR=str(run/'user-mods'),RECOMP_HOST_DUMP_DIR=str(run/'frames'),RECOMP_SCRIPT=str(run/'load.script'))
    if a.observe_motion:
        env.pop('RECOMP_PIN_CLOCK',None)
        env['RECOMP_BROWSER_STREAMING_JOINT_MOTION_FIXTURE']='1'
    if a.depart_npc:
        env['RECOMP_BROWSER_STREAMING_JOINT_DEPARTURE_FIXTURE']='1'
    if a.schedule_npc:
        env['RECOMP_BROWSER_STREAMING_JOINT_SCHEDULE_FIXTURE']='1'
    if a.reload_scheduled or a.reload_evolved:
        env['RECOMP_BROWSER_STREAMING_JOINT_SCHEDULE_RELOAD_FIXTURE']='1'
    if a.capture_evolved:
        env['RECOMP_BROWSER_STREAMING_JOINT_EVOLVED_CHECKPOINT_FIXTURE']='1'
    if a.reload_departed:
        env['RECOMP_BROWSER_STREAMING_JOINT_DEPARTED_RELOAD_FIXTURE']='1'
    with log.open('x') as f:
        process=subprocess.Popen([str(GAME/'build/recomp/pop_smoke')],cwd=GAME/'kit',stdout=f,stderr=subprocess.STDOUT,env=env)
        meta['nativePid']=process.pid;out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps(dict(nativePid=process.pid,fixture=run.name)),flush=True);code=process.wait()
    meta.update(nativeExitCode=code,nativeSessionTerminal=True);out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps(dict(nativeExitCode=code,nativeSessionTerminal=True)),flush=True);raise SystemExit(code)
if __name__=='__main__':main()

#!/usr/bin/env python3
"""Remove one original NPC only in a fresh copied Brashnard native profile."""
import argparse, hashlib, json, os, shutil, struct, subprocess, tempfile
from pathlib import Path
from native_entity_pair import selected_pair_input, selected_revision_input
ROOT=Path(__file__).resolve().parents[1]
GAME=ROOT/'upstream/majesty-recomp'
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(65536),b''):h.update(b)
    return h.hexdigest()
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('preflight',type=Path);p.add_argument('--attempt',type=int,required=True);p.add_argument('--reload-after',type=Path,metavar='SOURCE_DEPARTURE_PROOF');p.add_argument('--selected-pair',type=Path,metavar='EXPORT_RECEIPT');p.add_argument('--selected-revision',type=Path,metavar='REVISION_RECEIPT');p.add_argument('--return-capsule',type=Path,metavar='PRIVATE_RETURN_CAPSULE');p.add_argument('--restore-return-commands',action='store_true');p.add_argument('--activate-return',action='store_true');a=p.parse_args()
    if a.attempt<=0:p.error('Attempt must be positive')
    if a.selected_pair and not a.reload_after:p.error('Selected pair requires departed source reload')
    if a.selected_revision and (not a.reload_after or a.selected_pair):p.error('Selected revision requires separate departed source reload')
    if a.return_capsule and not a.selected_revision:p.error('Private return capsule requires the current selected revision')
    if a.restore_return_commands and not a.return_capsule:p.error('Command restoration requires the verified return capsule')
    if a.activate_return and not a.restore_return_commands:p.error('Return activation requires current command restoration')
    output=ROOT/f'output/native-original-source-departure-attempt-{a.attempt:03}.json';log=output.with_suffix('.log')
    if output.exists() or log.exists():p.error('Preserve previous original-source attempts')
    pre=json.loads(a.preflight.read_text())
    checked=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/inspect-native-npc-departure.mjs'),pre['sourceProof'],'--stdout','--original-source']))
    if (checked!=pre or pre.get('qualified') is not True or pre.get('originalSource') is not True or pre['incoming'] or pre['unsupportedOrders'] or
            [pre['unitId'],pre['agentId'],pre['units'],pre['agents'],pre['queuedActor']]!=[2101,37,1960,71,1]):p.error('Require unchanged original-source typed preflight')
    baseline=json.loads(Path(pre['sourceProof']).read_text());original=Path(baseline['fixture']['source']).resolve()
    if not original.is_relative_to((GAME/'build').resolve()) or original.name!='frontier_0_0':p.error('Require owned source baseline')
    for name,digest in baseline['fixture']['sourceHashes'].items():
        if sha(original/name)!=digest:p.error('Original source baseline changed')
    saved=Path(pre['checkpoint'])
    if a.reload_after:
        departure=json.loads(a.reload_after.read_text())
        checked=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/check-native-npc-departure.mjs'),departure['sourceReloadReport'],'--stdout']))
        if checked!=departure or checked.get('originalBrashnardSourceDeparturePerformed') is not True or checked['sourceManifest']['preflightSha256']!=sha(a.preflight):
            p.error('Source departure proof changed or uses another source preflight')
        saved=Path(checked['after']['filename'])
        if sha(saved)!=checked['after']['sha256']:p.error('Departed source snapshot changed')
    selected=None
    if a.selected_pair:
        selected=selected_pair_input(a.selected_pair,0,checked['after']['sha256']);saved=Path(selected['filename'])
    if a.selected_revision:
        selected=selected_revision_input(a.selected_revision,0,checked['after']['sha256']);saved=Path(selected['filename'])
    run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-original-source-',dir=GAME/'build'));profile=run/'frontier_0_0';profile.mkdir()
    hashes={}
    for name in ['mod-settings.json','Documents/My Games/MajestyHD/MajXPrefs','Documents/My Games/MajestyHD/questdata_majx.sav']:
        dest=profile/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(original/name,dest);hashes[name]=sha(dest)
    name='Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP';dest=profile/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(saved,dest);hashes[name]=sha(dest)
    if selected and (hashes[name]!=selected['sha256'] or dest.stat().st_size!=selected['bytes']):p.error('Selected source changed while copying')
    return_packet=None
    if a.return_capsule:
        return_packet=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/export-native-entity-return-packet.mjs'),str(a.return_capsule.resolve()),str(profile)]))
        if return_packet['receipt']!=str(a.selected_revision.resolve()) or return_packet['destinationWorld']!=selected['sha256']:
            p.error('Return capsule does not match this loaded revision')
        name='Native_Return_Packet.bin';hashes[name]=sha(profile/name)
        if hashes[name]!=return_packet['sha256'] or (profile/name).stat().st_size!=return_packet['bytes']:p.error('Copied private return packet changed')
    expected=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/prepare-native-original-source-writers.mjs'),str(a.preflight.resolve()),str(profile)]))
    for kind in expected:
        name=f'Script_Composed_{kind}_2101_0.bin';hashes[name]=sha(profile/name)
    (profile/'Joint_Reload_Expected.bin').write_bytes(struct.pack('<4I',0x31524a4e,2 if a.reload_after else 1,2101,37));hashes['Joint_Reload_Expected.bin']=sha(profile/'Joint_Reload_Expected.bin')
    for name in ['user-mods','frames']:(run/name).mkdir()
    shutil.copy2(GAME/'smoke/frontier-fixed-load.script',run/'load.script')
    meta=dict(nativeOnly=True,browserUsed=False,nativeSessionTerminal=False,nativeExitCode=None,clockMode='pinned',observeMotion=False,departNpc=True,scheduleNpc=False,reloadScheduledNpc=False,originalSourceDeparture=True,
      profile=str(profile),fixture=str(run),log=str(log),unitId=2101,agentId=37,physicalGridExtent=512,
      preflight=str(a.preflight.resolve()),preflightSha256=sha(a.preflight),departurePreflight=str(a.preflight.resolve()),departurePreflightSha256=sha(a.preflight),sourceProof=pre['sourceProof'],sourceProofSha256=sha(Path(pre['sourceProof'])),inputHashes=hashes,expectedWriters=expected,
      nativeSourceSha256={str(f.relative_to(ROOT)):sha(f) for f in [GAME/'browser_frontier.cpp',GAME/'browser_streaming.cpp',GAME/'game.toml']},nativeExecutableSha256AtLaunch=sha(GAME/'build/recomp/pop_smoke'))
    meta.update(originalSourceWorld=True,reloadDepartedNpc=bool(a.reload_after),departNpc=not bool(a.reload_after),originalSourceDeparture=not bool(a.reload_after))
    if a.reload_after:meta.update(departedCheckpointReport=str(a.reload_after.resolve()),departedCheckpointReportSha256=sha(a.reload_after))
    if selected:meta['selectedRevisionExport' if a.selected_revision else 'selectedPairExport']=selected
    if return_packet:meta['privateReturnPacket']=return_packet
    if a.restore_return_commands:meta['restoreReturnCommands']=True
    if a.activate_return:meta.update(activateReturnedNpc=True,observeReturnMotion=True,captureReturnEvolved=True,clockMode='monotonic')
    output.write_text(json.dumps(meta,indent=2)+'\n')
    env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')}
    env.update(RECOMP_PROFILE_DIR=str(profile),RECOMP_RULE_FRONTIER_REGION='0_0',RECOMP_RULE_INVENTORY_COMPAT='1',RECOMP_BROWSER_STREAMING_DEBUG='1',RECOMP_BROWSER_STREAMING_JOINT_RELOAD_FIXTURE='1',RECOMP_BROWSER_STREAMING_JOINT_DEPARTURE_FIXTURE='1',RECOMP_BROWSER_STREAMING_ORIGINAL_SOURCE_DEPARTURE_FIXTURE='1',RECOMP_PIN_CLOCK='1',RECOMP_GUEST_ARGS='-nointro -dochecksums',RECOMP_SMOKE_SECONDS='45',RECOMP_SMOKE_WINDOW_INPUT='1',RECOMP_SMOKE_DRAWABLE='800x600',RECOMP_CORE_MODS_DIR=str(GAME/'build/recomp/mods/core'),RECOMP_MODS_DIR=str(run/'user-mods'),RECOMP_HOST_DUMP_DIR=str(run/'frames'),RECOMP_SCRIPT=str(run/'load.script'))
    if a.reload_after:
        env.pop('RECOMP_BROWSER_STREAMING_JOINT_DEPARTURE_FIXTURE');env.pop('RECOMP_BROWSER_STREAMING_ORIGINAL_SOURCE_DEPARTURE_FIXTURE')
        env['RECOMP_BROWSER_STREAMING_JOINT_DEPARTED_RELOAD_FIXTURE']='1'
    if return_packet:env['RECOMP_BROWSER_STREAMING_PRIVATE_RETURN_FIXTURE']='1'
    if a.restore_return_commands:env['RECOMP_BROWSER_STREAMING_PRIVATE_RETURN_COMMANDS']='1'
    if a.activate_return:
        # Pinned presentation time finishes the timed smoke script before the
        # original simulation can produce 240 ticks in this larger source map.
        # Match the existing natural-motion runner's advancing host clock.
        env.pop('RECOMP_PIN_CLOCK',None)
        env.update(RECOMP_BROWSER_STREAMING_RETURN_ACTIVE_FIXTURE='1',RECOMP_BROWSER_STREAMING_JOINT_MOTION_FIXTURE='1',RECOMP_BROWSER_STREAMING_JOINT_EVOLVED_CHECKPOINT_FIXTURE='1')
    with log.open('x') as f:
        process=subprocess.Popen([str(GAME/'build/recomp/pop_smoke')],cwd=GAME/'kit',stdout=f,stderr=subprocess.STDOUT,env=env)
        meta['nativePid']=process.pid;output.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps(dict(nativePid=process.pid,fixture=run.name)),flush=True);code=process.wait()
    meta.update(nativeSessionTerminal=True,nativeExitCode=code);output.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps(dict(nativeExitCode=code,nativeSessionTerminal=True)),flush=True);raise SystemExit(code)
if __name__=='__main__':main()

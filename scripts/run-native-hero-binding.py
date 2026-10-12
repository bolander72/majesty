#!/usr/bin/env python3
"""Qualify the production selected-hero binding in one isolated original engine."""
import argparse,asyncio,importlib.util,json,os,re,tempfile,time
from pathlib import Path
from lib.native_pair_guard import owned_rows,stop_owned,stop_reason

ROOT=Path(__file__).resolve().parents[1];GAME=ROOT/'upstream/majesty-recomp'
spec=importlib.util.spec_from_file_location('hero_binding_guard',ROOT/'scripts/run-native-regional-home.py')
guard=importlib.util.module_from_spec(spec);spec.loader.exec_module(guard)
sha=guard.sha
def record(path):return dict(filename=str(path),bytes=path.stat().st_size,sha256=sha(path))
def directory_hashes(path):
    return {str(f.relative_to(path)):sha(f) for f in sorted(path.rglob('*')) if f.is_file()}

def generation_report(path):
    # Eight original journeys produce more than256KiB of bounded evidence.
    # Keep ordinary control metadata on its smaller guard and give only this
    # owned aggregate a fixed512KiB cap. Never read an unbounded report.
    path=Path(path)
    if not path.is_file() or not 0<path.stat().st_size<=512*1024:
        raise RuntimeError('Generation report exceeds512KiB bound')
    return json.loads(path.read_text())

def public_departures(run,text):
    legs=[]
    for index,(serial,source,target,capture_name,pair_name) in enumerate([
        (1,'0_0','1_0','first-outward-input.json','publication.json'),
        (2,'1_0','0_0','second-publication.json','home-publication.json'),
        (4,'0_0','1_0','repeat-departure-publication.json','repeat-neighbor-publication.json'),
        (6,'1_0','0_0','repeat-return-publication.json','repeat-home-publication.json')],1):
        capture=guard.bounded_json(run/capture_name);pair=guard.bounded_json(run/pair_name)
        staged=capture['sourceRequest']['staged'] if serial==1 else guard.bounded_json(run/f'public-departure-{serial:03}.json')['request']
        assert staged['serial']==serial and staged['sourceRegion']==source and staged['targetRegion']==target
        consumed=f"[frontier] Hero departure request consumed serial={serial} source={source} target={target} bytes={staged['requestSize']} selected-owner-verified=1 crossing-verified=1 destination-input-verified=1 source-retired=1 phase=7 pending=0"
        release=f'[frontier] Session released serial={index} region={source} roots-freed=1,1,1,1,1,1,1,1'
        attached=f'[frontier] Session attached serial={index} region={target} mode=saved'
        ready=f"[frontier] Hero travel publication held receipt={pair['ready']} phase=7 pending=0 ordinary-ticks=0"
        p=pair['publicationReceipt']
        resumed=f"[frontier] Hero travel resumed serial={serial} region={target} unit={p['owner']['unitId']} agent={p['owner']['agentId']} home={p['home']['kind']}/{p['home']['unitId']}/{p['home']['agentId']} clock={p['clock']} manifest-sha256={p['ownerManifestSha256']} original-resume=1 fresh-binding=1 phase=3 pending=0"
        boundaries=[consumed,release,attached,ready,resumed]
        assert all(text.count(line)==1 for line in boundaries), f'Public departure {serial} boundaries missing'
        assert [text.index(line) for line in boundaries]==sorted(text.index(line) for line in boundaries)
        legs.append(dict(serial=serial,source=source,target=target,capture=record(run/capture_name),
            pair=record(run/pair_name),request=staged,sourceAlias=capture['crossing'],arrivalOwner=p['owner'],
            consumed=consumed,resumed=resumed))
    final=guard.bounded_json(run/'repeat-home-save-publication.json')
    assert final['nativeContinuedHeroRepeatHomeSavePublished'] and final['publicationReceipt']['region']=='0_0'
    assert final['publicationReceipt']['clock']==105200 and final['publicationReceipt']['ownerRevision']==11
    return dict(legs=legs,finalSave=record(run/'repeat-home-save-publication.json'),
        sourceRetirementUsesSharedConsumer=True,destinationUsesOwnedNativeTestDrivers=True,
        browserUsed=False,liveOPFSQualified=False,newBrowserPublisherReceiptConsumed=False,goalComplete=False)

async def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('build',type=Path);p.add_argument('startup',type=Path)
    p.add_argument('--attempt',type=int,required=True)
    p.add_argument('--wrong-hero',action='store_true',help='Controlled refusal of a nonexistent current native alias')
    p.add_argument('--save-journey',action='store_true',help='Request the production pause/checkpoint/resume handshake')
    p.add_argument('--publication-failed',action='store_true',help='Acknowledge failed publication after the native checkpoint')
    p.add_argument('--halo-motion',action='store_true',help='Observe production original movement using the checked saved layout capsule')
    p.add_argument('--wrong-halo',action='store_true',help='Refuse a capsule naming another saved checkpoint')
    p.add_argument('--initial-owner',action='store_true',help='Use the original pre-continuation owner, preserving its saved outdoor movement')
    p.add_argument('--crossing',action='store_true',help='Issue one original native move and qualify production automatic crossing capture')
    p.add_argument('--retire-source',action='store_true',help='Qualify shared original retirement after the actual held crossing; keep recovery capture intact')
    p.add_argument('--page-destination',type=Path,help='After retirement, unload the source and hold the saved neighbor from this original home preparation')
    p.add_argument('--arrival-preparation',type=Path,help='Import and activate this complete original arrival capsule in the held loaded neighbor')
    p.add_argument('--publish-arrival',action='store_true',help='Publish the actual pair in an owned journal, refuse stale receipts, then resume with fresh IDs')
    p.add_argument('--publish-second-capture',action='store_true',help='After resumed travel, publish the next actual held capture using the current proxy-home owner')
    p.add_argument('--retire-remote-source',action='store_true',help='After selecting the second capture, retire the active remote-home hero and end its original runtime binding')
    p.add_argument('--page-home',action='store_true',help='After remote retirement, unload that world and restore the selected saved home kingdom before its first tick')
    p.add_argument('--import-home',action='store_true',help='Restore the actual selected return capture and both registered guild rosters while the home is paused')
    p.add_argument('--activate-home',action='store_true',help='Activate the returned hero through original collision, drawing, postload and scheduling while home stays paused')
    p.add_argument('--publish-home',action='store_true',help='Publish the activated return pair, consume its acknowledgement and qualify six original home ticks')
    p.add_argument('--save-home',action='store_true',help='Select the original continued home checkpoint after six gameplay ticks and consume its receipt')
    p.add_argument('--repeat-departure',action='store_true',help='Resume the continued home save, cross outward again, publish recovery and retire the fresh native owner')
    p.add_argument('--public-travel',action='store_true',help='Stage each destination before retirement and consume all four ordinary source travel actions')
    p.add_argument('--generate-neighbor',action='store_true',help='Consume a captured source generation request, initialize with two original ticks and hold its fresh neighbor before hero import')
    p.add_argument('--arrive-generated-neighbor',action='store_true',help='Stage the real generated-neighbor arrival, publish ownership and verify resumed original gameplay')
    p.add_argument('--repeat-generated-neighbor',action='store_true',help='Continue the same hero north into a second genuinely new kingdom in the same bounded native process')
    p.add_argument('--generated-neighbor-journeys',type=int,choices=(1,2,3,4,5,6,7,8),help='Number of genuine new arrivals following original north and west movement commands')
    p.add_argument('--page-repeat-neighbor',action='store_true',help='After the second departure, unload the current home and load the selected dormant neighbor before any tick')
    p.add_argument('--import-repeat-neighbor',action='store_true',help='Import and activate the actual second departure capsule using the restored neighbor existing home')
    p.add_argument('--publish-repeat-neighbor',action='store_true',help='Select the second arrival pair, consume its native receipt and qualify two original neighbor ticks')
    p.add_argument('--save-repeat-neighbor',action='store_true',help='Select the actual resumed neighboring save and consume its fresh proxy owner receipt')
    p.add_argument('--repeat-return',action='store_true',help='Continue original proxy AI into another homeward crossing, publish recovery and retire its live owner')
    p.add_argument('--page-repeat-home',action='store_true',help='After the second homeward departure, unload the neighbor and restore the actual saved home before its first tick')
    p.add_argument('--import-repeat-home',action='store_true',help='Import the actual second return capsule into the restored native home guild')
    p.add_argument('--activate-repeat-home',action='store_true',help='Activate the second returned hero through the original native home methods')
    p.add_argument('--publish-repeat-home',action='store_true',help='Publish both second-return saved worlds and qualify six original home gameplay ticks')
    p.add_argument('--save-repeat-home',action='store_true',help='Select the actual continued second-return home checkpoint and consume its fresh owner receipt')
    a=p.parse_args();out=ROOT/f'output/native-hero-binding-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
    if a.arrive_generated_neighbor and not a.generate_neighbor:p.error('Generated arrival requires fresh generation')
    if a.repeat_generated_neighbor and not a.arrive_generated_neighbor:p.error('Repeated generation requires the first generated arrival')
    if a.generated_neighbor_journeys is None:a.generated_neighbor_journeys=2 if a.repeat_generated_neighbor else 1
    if a.generated_neighbor_journeys>1 and not a.repeat_generated_neighbor:p.error('Multiple generated journeys require repeated arrival qualification')
    if a.repeat_generated_neighbor and a.generated_neighbor_journeys<2:p.error('Repeated generation requires at least two journeys')
    if a.generated_neighbor_journeys>=3 and not a.generate_neighbor:p.error('Multiple generated journeys require fresh generation')
    if a.generate_neighbor:
        if a.page_destination or a.arrival_preparation or a.publish_arrival or a.public_travel or a.wrong_hero or a.wrong_halo or a.publication_failed:
            p.error('Fresh generation is a separate absent-neighbor trial')
        a.retire_source=True
    if a.public_travel and not a.save_repeat_home:p.error('Public travel qualification requires both complete round trips and final home save')
    if a.page_destination:a.retire_source=True
    if a.arrival_preparation and not a.page_destination:p.error('Connected arrival requires saved-neighbor paging')
    if a.publish_arrival and not a.arrival_preparation:p.error('Held publication requires connected arrival')
    if a.publish_second_capture and not a.publish_arrival:p.error('Second held capture requires published native arrival')
    if a.retire_remote_source and not a.publish_second_capture:p.error('Remote-source retirement requires the selected second capture')
    if a.page_home and not a.retire_remote_source:p.error('Home paging requires remote-source retirement')
    if a.import_home and not a.page_home:p.error('Home import requires the selected saved home paging')
    if a.activate_home and not a.import_home:p.error('Home activation requires the actual return import')
    if a.publish_home and not a.activate_home:p.error('Return publication requires native-home activation')
    if a.save_home and not a.publish_home:p.error('Continued home save requires the live home resume')
    if a.repeat_departure and not a.save_home:p.error('Repeated departure requires the continued selected home save')
    if a.page_repeat_neighbor and not a.repeat_departure:p.error('Repeated neighbor paging requires the current repeated departure')
    if a.import_repeat_neighbor and not a.page_repeat_neighbor:p.error('Repeated neighbor arrival requires the current selected saved neighbor')
    if a.publish_repeat_neighbor and not a.import_repeat_neighbor:p.error('Repeated neighbor publication requires the actual current import and activation')
    if a.save_repeat_neighbor and not a.publish_repeat_neighbor:p.error('Continued neighbor save requires its actual second arrival resume')
    if a.repeat_return and not a.save_repeat_neighbor:p.error('Repeated return requires the selected continued neighbor save')
    if a.page_repeat_home and not a.repeat_return:p.error('Second-home paging requires the actual second homeward capture and retirement')
    if a.import_repeat_home and not a.page_repeat_home:p.error('Second-home import requires its actual saved destination')
    if a.activate_repeat_home and not a.import_repeat_home:p.error('Second-home activation requires the actual returned hero')
    if a.publish_repeat_home and not a.activate_repeat_home:p.error('Second-return publication requires original native-home activation')
    if a.save_repeat_home and not a.publish_repeat_home:p.error('Continued second-return save requires its original resumed home gameplay')
    if a.retire_source:a.crossing=True
    if a.crossing:
        if a.wrong_halo or a.wrong_hero:p.error('Crossing is not a refusal trial')
        a.halo_motion=True;a.initial_owner=True;a.save_journey=True
    if a.attempt<1 or out.exists() or log.exists():p.error('Preserve previous attempts')
    if a.wrong_hero and a.save_journey or a.publication_failed and not a.save_journey:p.error('Invalid save trial flags')
    if a.wrong_halo and (not a.halo_motion or a.wrong_hero or a.save_journey):p.error('Wrong halo requires one motion refusal trial')
    guard.idle();build_path=a.build.resolve();build=guard.bounded_json(build_path)
    startup_path=a.startup.resolve();proof=guard.bounded_json(startup_path)
    preserved_source=proof.get('originalSelectedCrossingSourceStartupQualified') is True
    if preserved_source:
        if not (a.initial_owner and proof.get('sourceCheckpointUnchanged') and proof.get('independentlyEnrolled') and proof.get('originalHaloStartupLayoutQualified')):
            p.error('Preserved crossing source requires independently enrolled initial halo owner')
        for key in ['sourceCheckpoint','producerOriginalCheckpoint']:
            original=proof[key];path=Path(original['filename']).resolve()
            if not path.is_relative_to(ROOT/'output') and not path.is_relative_to(GAME/'build') or path.stat().st_size!=original['bytes'] or sha(path)!=original['sha256']:
                p.error('Preserved original crossing source changed')
        if proof['sourceCheckpoint']['sha256']!=proof['producerOriginalCheckpoint']['sha256'] or proof['receipt']['sha256']!=proof['sourceCheckpoint']['sha256']:
            p.error('Crossing receipt differs from original native source')
    elif not proof.get('originalCheckpointStartupProjectionQualified') or not proof.get('originalJournalUnchanged'):
        p.error('Verified original-save startup required')
    for name,digest in proof['sourceSha256'].items():
        if sha(ROOT/name)!=digest:p.error('Startup source changed')
    compiled={}
    for group in ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256']:
        for name,digest in build[group].items():
            if name in compiled:p.error('Duplicate compiled input')
            compiled[name]=digest
    exe=GAME/'build/recomp/pop_smoke'
    if not build.get('nativeBuildQualified') or build['exitCode']!=0 or len(compiled)!=54 or any(sha(ROOT/n)!=h for n,h in compiled.items()):
        p.error('Current official native build required')
    if sha(exe)!=build['nativeExecutableSha256'] or sha(GAME/'build/recomp/gen/symbols.json')!=build['nativeSymbolsSha256'] or sha(GAME/'original/gog/MajestyHD - Old.exe')!=guard.PIN:
        p.error('Pinned executable or symbols changed')
    terminal_path=Path(proof['terminalAttempt']['filename'])
    if sha(terminal_path)!=proof['terminalAttempt']['sha256']:p.error('Original producer evidence changed')
    terminal=guard.bounded_json(terminal_path)
    if not terminal.get('nativeSessionTerminal') or not terminal.get('ownedProducerAbsent') or terminal['nativeExitCode']!=0:
        p.error('Original save producer not terminal')
    try:os.kill(terminal['nativePid'],0)
    except ProcessLookupError:pass
    else:p.error('Original producer is live')
    receipt=proof['receipt'] if a.initial_owner else proof['continuation']['resumed'];binding=receipt['runtimeBinding'].split('|')
    if len(binding)!=12 or binding[0]!='majesty-hero-runtime-v1' or binding[1]!=receipt['region'] or binding[7]!='native' or binding[11]!=receipt['sha256']:
        p.error('Bound selected native-home receipt required')
    if [int(binding[2]),int(binding[3]),int(binding[4])]!=[receipt['clock'],receipt['owner']['unitId'],receipt['owner']['agentId']]:
        p.error('Selected actor or clock differs')
    fixture=Path(proof['fixture']).resolve()
    if not fixture.is_relative_to(ROOT/'output') or fixture.name!=startup_path.stem:p.error('Owned startup fixture required')
    profile_source=fixture/'majesty/profile'/('native-world-'+receipt['world'])/('frontier_'+receipt['region'])
    manifest=receipt['nativeManifest'].splitlines();slot=int(manifest[1])
    if slot not in [0,1]:p.error('Invalid native slot')
    save_name='Frontier_'+receipt['region']+('' if slot==0 else '_Recovery')
    source=profile_source/'Documents/My Games/MajestyHD/SaveGame'/(save_name+'.GMP')
    if source.stat().st_size!=receipt['size'] or sha(source)!=receipt['sha256']:p.error('Prepared native save changed')
    destination=None
    if a.page_destination:
        destination=guard.bounded_json(a.page_destination.resolve())
        if not destination.get('nativeHeroHomePrepared') or not destination.get('originalFilesUnchanged') or destination.get('ownerTransferred') or destination['region']!='1_0':
            p.error('Inert qualified original neighbor preparation required')
        for name,digest in destination['sourceSha256'].items():
            if sha(ROOT/name)!=digest:p.error('Neighbor preparation source changed')
        row=destination['sourceCheckpoint'];path=Path(row['filename']).resolve()
        if not path.is_relative_to(ROOT/'output') or path.stat().st_size!=row['bytes'] or sha(path)!=row['sha256']:
            p.error('Original neighbor changed')
    arrival=None
    if a.arrival_preparation:
        arrival=guard.bounded_json(a.arrival_preparation.resolve())
        if not arrival.get('nativeHeroArrivalPrepared') or not arrival.get('originalFilesUnchanged') or arrival.get('sourceRetired') or arrival.get('heroImported'):
            p.error('Inert complete original arrival preparation required')
        for name,digest in arrival['sourceSha256'].items():
            if sha(ROOT/name)!=digest:p.error('Arrival preparation source changed')
        for key in ['sourceWorld','destinationWorld','pack']:
            row=arrival[key];path=Path(row['filename']).resolve()
            if not (path.is_relative_to(ROOT/'output') or path.is_relative_to(GAME/'build')) or path.stat().st_size!=row['bytes'] or sha(path)!=row['sha256']:p.error('Bound original arrival bytes changed')
        checked_path=Path(arrival['homeRegistration']['filename']);archive_path=Path(arrival['registrationArchive']['filename'])
        if sha(checked_path)!=arrival['homeRegistration']['sha256'] or sha(archive_path)!=arrival['registrationArchive']['sha256']:p.error('Original registration qualification changed')
        checked=guard.bounded_json(checked_path);archive=guard.bounded_json(archive_path)
        if not checked.get('nativeHeroHomeRegistrationQualified') or not archive.get('originalNativeHeroHomeRegistrationQualified'):p.error('Original home registration must be qualified')
        frozen={str(Path(r['source']).relative_to(ROOT)):r for r in archive['sources']}
        for name,digest in checked['sourceSha256'].items():
            row=frozen.get(name)
            if not row or row['sha256']!=digest or sha(Path(row['preserved']))!=digest:p.error('Frozen original registration generation changed')
        old=guard.bounded_json(Path(checked['manifest']['filename']))
        if sha(Path(checked['manifest']['filename']))!=checked['manifest']['sha256'] or not old.get('nativeSessionTerminal') or not old.get('ownedProducerAbsent') or old.get('nativeExitCode')!=0:p.error('Registration producer must be stopped')
        try:os.kill(old['nativePid'],0)
        except ProcessLookupError:pass
        else:p.error('Registration producer remains live')
        options=arrival['options']
        if [options['unitId'],arrival['selectedOwner']['agentId']]!=[receipt['owner']['unitId'],receipt['owner']['agentId']] or options['destinationClockMs']!=destination['clock'] or options['attachedUnitBindings']:
            p.error('Arrival actor, clock or complete family differs')
        if arrival['destinationWorld']!=old['worlds'][1] or arrival['context']['homeAliases'][1]!={'kind':'proxy','unitId':0,'agentId':destination['proposedAgentId']}:
            p.error('Original registered destination differs')
        if any(old['sourceCheckpoint'][key]!=destination['sourceCheckpoint'][key] for key in ['bytes','sha256']) or options['haloRegions']!={'version':'halo-v1','sourceRegion':'0_0','destinationRegion':'1_0'}:
            p.error('Arrival does not use this source/destination region pair')
        for row in [destination['proposal']]:
            if Path(row['filename']).stat().st_size!=row['bytes'] or sha(Path(row['filename']))!=row['sha256']:p.error('Home proposal changed')
    preserved=guard.baseline();fixture_before=directory_hashes(fixture)
    runner_sha=sha(Path(__file__));guard.idle()
    run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-hero-binding-',dir=GAME/'build'))
    private=run/'native/recomp';(private/'mods').mkdir(parents=True)
    private_exe=private/'pop_smoke';guard.copy(exe,private_exe);private_exe.chmod(0o755)
    profile=run/('frontier_'+receipt['region']);profile.mkdir()
    copied=profile/'Documents/My Games/MajestyHD/SaveGame'/('Frontier_'+receipt['region']+'.GMP');guard.copy(source,copied)
    source_input=copied
    if a.page_home:
        source_input=profile/'Hero_Travel_Source_Input.GMP';guard.copy(copied,source_input)
    content=guard.PIN+':'+build['nativeExecutableSha256']
    (profile/('Frontier_'+receipt['region']+'.checkpoint')).write_text('\n'.join(['checkpoint-v1','0',str(receipt['size']),receipt['sha256'],content,'']))
    if destination:
        neighbor=run/'frontier_1_0';neighbor.mkdir();target_checkpoint=neighbor/'Documents/My Games/MajestyHD/SaveGame/Frontier_1_0.GMP'
        guard.copy(Path(destination['sourceCheckpoint']['filename']),target_checkpoint)
        (neighbor/'Frontier_1_0.checkpoint').write_text('\n'.join(['checkpoint-v1','0',str(destination['sourceCheckpoint']['bytes']),destination['sourceCheckpoint']['sha256'],content,'']))
        target_input=target_checkpoint
        if a.publish_arrival:
            target_input=neighbor/'Hero_Travel_Target_Input.GMP';guard.copy(target_checkpoint,target_input)
    if arrival:
        proposal=neighbor/'Frontier_Hero_Home.GPL';pack=neighbor/'Frontier_Hero_Arrival.pack'
        guard.copy(Path(destination['proposal']['filename']),proposal);guard.copy(Path(arrival['pack']['filename']),pack)
        pack_input=pack
        if a.import_repeat_neighbor:
            pack_input=neighbor/'Hero_Travel_First_Arrival.pack';guard.copy(pack,pack_input)
    # This test deliberately changes only the scalar runtime alias. The saved
    # graph, selected receipt and its source checkpoint stay unchanged.
    if a.wrong_hero:binding[3]=str(0xffffff00)
    bound='|'.join(binding);script=run/'hero-binding.script'
    halo=receipt.get('haloBinding') if a.halo_motion else None
    if a.halo_motion and (not receipt.get('haloLayout') or halo!='majesty-hero-halo-v1|'+receipt['region']+'|'+receipt['sha256']):
        p.error('Verified selected halo receipt required')
    if a.wrong_halo:halo='majesty-hero-halo-v1|'+receipt['region']+'|'+'f'*64
    result='failed' if a.publication_failed else 'saved'
    script.write_text(('wait 12000\nmove 400 300\nwait 2000\naction frontier-hero-save\nwait 2000\n'
      f'actions frontier-hero-save-finish frontier-hero-save-{result}-1\nwait 2000\nmove 400 300\n')
      if a.save_journey else 'wait 12000\nmove 400 300\nwait 2000\nmove 400 300\n')
    if a.crossing:script.write_text('wait 12000\nmove 400 300\nwait 18000\n'+
      f'actions frontier-hero-save-finish frontier-hero-save-{result}-1\nwait 2000\nmove 400 300\n')
    if a.retire_source:script.write_text('wait 12000\nmove 400 300\nwait 18000\nmove 400 300\n')
    if a.publish_arrival:script.write_text('wait 12000\nmove 400 300\nwait 26000\nmove 400 300\n')
    # The second native-home arrival adds capsule preparation, five receipt
    # controls and a six-tick resume. Keep the same 55-second supervisor limit
    # while avoiding script EOF during those required boundaries.
    if a.publish_repeat_home:script.write_text('wait 12000\nmove 400 300\nwait 32000\nmove 400 300\n')
    (run/'user-mods').mkdir();(run/'frames').mkdir()
    flags={'PROFILE_DIR':str(profile),'REGISTRY':str(run/'registry.json'),'RULE_FRONTIER_REGION':receipt['region'],
        'RULE_FRONTIER_RESTORE':'1','RULE_FRONTIER_HERO_RESTORE':'v1','FRONTIER_HERO_BINDING':bound,
        'RULE_INVENTORY_COMPAT':'1','CONTENT_IDENTITY':content,'GUEST_ARGS':'-nointro -dochecksums',
        'SMOKE_SECONDS':'40' if a.crossing else '22' if a.save_journey else '18','SMOKE_WINDOW_INPUT':'1','SMOKE_DRAWABLE':'800x600','CORE_MODS_DIR':str(GAME/'build/recomp/mods/core'),
        'MODS_DIR':str(run/'user-mods'),'HOST_DUMP_DIR':str(run/'frames'),'SCRIPT':str(script)}
    if halo:flags['FRONTIER_HERO_HALO_BINDING']=halo
    if a.crossing:flags['BROWSER_FRONTIER_SELECTED_HERO_MOVE']='v1'
    if a.retire_source:flags['BROWSER_FRONTIER_HERO_RETIRE_TEST']='1'
    if a.generate_neighbor:flags.update(RULE_FRONTIER_HERO_GENERATION='v1',RULE_FRONTIER_SEEDED_GENERATION='1',
        RULE_FRONTIER_CONNECTED_TERRAIN='v1',BROWSER_FRONTIER_HERO_GENERATION_TEST='v1',BROWSER_FRONTIER_HERO_PAGE_TEST='v1')
    if a.arrive_generated_neighbor:flags.update(BROWSER_FRONTIER_HERO_GENERATED_ARRIVAL_TEST='v1',BROWSER_FRONTIER_HERO_JOIN_TEST='v1',BROWSER_FRONTIER_HERO_PAGE_SNAPSHOT='1')
    if a.repeat_generated_neighbor:
        flags.update(BROWSER_FRONTIER_HERO_REPEAT_GENERATION_TEST='v1',SMOKE_SECONDS='50')
        script.write_text('wait 12000\nmove 400 300\nwait 32000\nmove 400 300\n')
        if a.generated_neighbor_journeys>=3:
            flags['BROWSER_FRONTIER_HERO_GENERATION_JOURNEYS']=str(a.generated_neighbor_journeys)
            # From the fourth arrival onward the original hero must walk
            # across a complete region, rather than start beside its exit.
            duration=50+100*(a.generated_neighbor_journeys-3)
            flags['SMOKE_SECONDS']=str(duration)
            script.write_text(f'wait 12000\nmove 400 300\nwait {(duration-12)*1000}\nmove 400 300\n')
    if destination:flags.update(BROWSER_FRONTIER_HERO_PAGE_TEST='v1',BROWSER_FRONTIER_HERO_PAGE_SNAPSHOT='1',BROWSER_FRONTIER_HERO_PAGE_DIGEST=destination['sourceCheckpoint']['sha256'],BROWSER_FRONTIER_HERO_PAGE_CLOCK=str(destination['clock']))
    if arrival:flags.update(BROWSER_FRONTIER_HERO_JOIN_TEST='v1',BROWSER_FRONTIER_HERO_JOIN_HOME_DIGEST=destination['proposal']['sha256'],
        BROWSER_FRONTIER_HERO_JOIN_HOME_BYTES=str(destination['proposal']['bytes']),BROWSER_FRONTIER_HERO_JOIN_HOME_ID=str(destination['proposedAgentId']),
        BROWSER_FRONTIER_HERO_JOIN_PACK_DIGEST=arrival['pack']['sha256'],BROWSER_FRONTIER_HERO_JOIN_PACK_BYTES=str(arrival['pack']['bytes']))
    if a.publish_arrival or a.generate_neighbor:
        journal=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-hero-route-',dir=GAME/'build'))
        seed=fixture/'majesty/profile'/('native-world-'+receipt['world'])/'hero-route'
        for name,digest in proof['routeHashes'].items():
            if '/' in name or not name.startswith('Frontier_Hero_Route') or sha(seed/name)!=digest:p.error('Enrolled seed journal changed')
            guard.copy(seed/name,journal/name)
        flags.update(BROWSER_FRONTIER_HERO_PUBLICATION_TEST='v1',BROWSER_FRONTIER_HERO_PUBLICATION_JOURNAL=str(journal),
            BROWSER_FRONTIER_HERO_INITIAL_OWNER_MANIFEST=receipt['ownerManifest'],FRONTIER_HERO_OWNER_MANIFEST=receipt['ownerManifest'])
        if a.publish_arrival:flags.update(BROWSER_FRONTIER_HERO_SOURCE_REQUEST_TEST='v1',SMOKE_SECONDS='50')
    if a.retire_remote_source:flags['BROWSER_FRONTIER_HERO_REMOTE_RETIRE_TEST']='v1'
    if a.page_home:flags['BROWSER_FRONTIER_HERO_HOME_PAGE_TEST']='v1'
    if a.import_home:flags['BROWSER_FRONTIER_HERO_HOME_IMPORT_TEST']='v1'
    if a.activate_home:flags['BROWSER_FRONTIER_HERO_HOME_ACTIVATE_TEST']='v1'
    if a.publish_home:flags['BROWSER_FRONTIER_HERO_HOME_PUBLISH_TEST']='v1'
    if a.save_home:flags['BROWSER_FRONTIER_HERO_HOME_SAVE_TEST']='v1'
    if a.repeat_departure:flags['BROWSER_FRONTIER_HERO_REPEAT_DEPARTURE_TEST']='v1'
    if a.page_repeat_neighbor:flags['BROWSER_FRONTIER_HERO_REPEAT_PAGE_TEST']='v1'
    if a.import_repeat_neighbor:flags['BROWSER_FRONTIER_HERO_REPEAT_IMPORT_TEST']='v1'
    if a.publish_repeat_neighbor:flags['BROWSER_FRONTIER_HERO_REPEAT_PUBLISH_TEST']='v1'
    if a.save_repeat_neighbor:flags['BROWSER_FRONTIER_HERO_REPEAT_SAVE_TEST']='v1'
    if a.repeat_return:flags['BROWSER_FRONTIER_HERO_REPEAT_RETURN_TEST']='v1'
    if a.page_repeat_home:flags['BROWSER_FRONTIER_HERO_REPEAT_HOME_PAGE_TEST']='v1'
    if a.import_repeat_home:flags['BROWSER_FRONTIER_HERO_REPEAT_HOME_IMPORT_TEST']='v1'
    if a.activate_repeat_home:flags['BROWSER_FRONTIER_HERO_REPEAT_HOME_ACTIVATE_TEST']='v1'
    if a.publish_repeat_home:flags['BROWSER_FRONTIER_HERO_REPEAT_HOME_PUBLISH_TEST']='v1'
    if a.save_repeat_home:flags['BROWSER_FRONTIER_HERO_REPEAT_HOME_SAVE_TEST']='v1'
    if a.public_travel:flags['BROWSER_FRONTIER_HERO_PUBLIC_REQUEST_TEST']='v1'
    env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')};env.update({'RECOMP_'+k:v for k,v in flags.items()})
    m=dict(version=1,fixture=str(run),build=record(build_path),startup=record(startup_path),sourceCheckpoint=record(source),
        compiledSourceSha256=compiled,nativeExecutableSha256=sha(private_exe),runtimeBinding=bound,wrongHero=a.wrong_hero,
        saveJourney=a.save_journey,publicationResult=result if a.save_journey else None,browserPublicationQualified=False,
        haloMotion=a.halo_motion,wrongHalo=a.wrong_halo,haloBinding=halo,initialOwner=a.initial_owner,crossingTrial=a.crossing,
        retireSource=a.retire_source,publishArrival=a.publish_arrival,publishSecondCapture=a.publish_second_capture,retireRemoteSource=a.retire_remote_source,pageHome=a.page_home,browserUsed=False,nativeProcessesStarted=1,nativeSessionTerminal=False,nativeExitCode=None,stopReason=None,
        importHome=a.import_home,
        activateHome=a.activate_home,publishHome=a.publish_home,saveHome=a.save_home,repeatDeparture=a.repeat_departure,
        pageRepeatNeighbor=a.page_repeat_neighbor,
        importRepeatNeighbor=a.import_repeat_neighbor,publishRepeatNeighbor=a.publish_repeat_neighbor,
        saveRepeatNeighbor=a.save_repeat_neighbor,repeatReturn=a.repeat_return,pageRepeatHome=a.page_repeat_home,
        importRepeatHome=a.import_repeat_home,activateRepeatHome=a.activate_repeat_home,publishRepeatHome=a.publish_repeat_home,
        saveRepeatHome=a.save_repeat_home,firstOutwardBrowserInput=a.publish_arrival,publicTravel=a.public_travel,generateNeighbor=a.generate_neighbor,arriveGeneratedNeighbor=a.arrive_generated_neighbor,repeatGeneratedNeighbor=a.repeat_generated_neighbor,generatedNeighborJourneys=a.generated_neighbor_journeys,
        runnerSha256=runner_sha,guardSha256=sha(ROOT/'scripts/lib/native_pair_guard.py'),
        supervisorSha256=sha(ROOT/'scripts/run-native-regional-home.py'),script=record(script),log=str(log),resourceSamples=[],
        deadlineSeconds=55+100*max(0,a.generated_neighbor_journeys-3) if a.publish_arrival or a.repeat_generated_neighbor else 45 if a.crossing else 25,rssCeilingBytes=512*1024*1024,logCeilingBytes=4*1024*1024,preservedBefore=preserved,
        liveHeroTravelQualified=False,goalComplete=False)
    if sha(Path(__file__))!=runner_sha or guard.baseline()!=preserved:p.error('Isolation changed before launch')
    if destination:m.update(destinationPreparation=record(a.page_destination.resolve()),destinationOriginal=destination['sourceCheckpoint'],destinationCopied=record(target_input),destinationClock=destination['clock'])
    if arrival:m.update(arrivalPreparation=record(a.arrival_preparation.resolve()),arrivalPackage=record(pack_input),proposal=record(proposal),heroImported=False,destinationActivated=False)
    publication_worker=ROOT/('scripts/stage-held-native-hero-generation.mjs' if a.generate_neighbor else 'scripts/publish-held-native-hero-arrival.mjs')
    if a.publish_arrival or a.generate_neighbor:m.update(publicationJournal=str(journal),publicationWorkerSha256=sha(publication_worker))
    if a.page_home:m['sourceInputBackup']=record(source_input)
    guard.idle()
    publisher=None;publisher_sink=None
    with log.open('x') as sink:
        process=await asyncio.create_subprocess_exec(str(private_exe),cwd=GAME/'kit',env=env,stdout=sink,stderr=asyncio.subprocess.STDOUT,start_new_session=True)
        m.update(nativePid=process.pid,startedAtMs=time.time_ns()//1000000);started=time.monotonic()
        print(json.dumps({'nativePid':process.pid,'phase':'selected-hero-refusal' if a.wrong_hero else 'selected-hero-admission'}),flush=True)
        try:
            while process.returncode is None:
                rows=guard.rows();owned=owned_rows(rows,[process.pid],[process.pid])
                if publisher:owned+=owned_rows(rows,[publisher.pid],[publisher.pid])
                m['resourceSamples'].append(dict(sampledAtMs=time.time_ns()//1000000,rssBytes=sum(r['rssBytes'] for r in owned)))
                m['stopReason']=stop_reason(rows,[process.pid],time.monotonic()-started,m['deadlineSeconds'],[log.stat().st_size],groups=[process.pid],expected_producers=1)
                if sum(r['rssBytes'] for r in owned)>m['rssCeilingBytes']:m['stopReason']='native and publication worker aggregate RSS ceiling'
                if publisher and publisher.returncode not in (None,0):m['stopReason']='owned publication worker failed'
                out.write_text(json.dumps(m,indent=2)+'\n')
                if m['stopReason']:break
                if (a.publish_arrival or a.generate_neighbor) and publisher is None:
                    lines=log.read_text();ready=re.findall(r'^\[frontier\] Hero save held serial=1 region=0_0 clock=\d+ slot=[01] bytes=\d+ sha256=[0-9a-f]{64} phase=7 pending=0$',lines,re.M)
                    if ready:
                        if len(ready)!=1:raise RuntimeError('Ambiguous held arrival')
                        worker_input=run/'publication-input.json';worker_input.write_text(json.dumps(m,indent=2)+'\n')
                        publisher_log=run/'publication.log';publisher_sink=publisher_log.open('x')
                        worker_arguments=[str(worker_input),str(run/'generation.json')] if a.generate_neighbor else [str(worker_input),'await-first-outward',str(run/'publication.json')]
                        publisher=await asyncio.create_subprocess_exec('node','--max-old-space-size=96',str(publication_worker),
                            *worker_arguments,cwd=ROOT,stdout=publisher_sink,stderr=asyncio.subprocess.STDOUT,start_new_session=True)
                        m.update(publicationInput=record(worker_input),publicationLog=str(publisher_log),publicationWorkerPid=publisher.pid)
                try:await asyncio.wait_for(asyncio.shield(process.wait()),timeout=2)
                except asyncio.TimeoutError:pass
        finally:
            if process.returncode is None:await stop_owned([process],[process.pid])
            if publisher and publisher.returncode is None:await stop_owned([publisher],[publisher.pid])
            if publisher:await publisher.wait()
            if publisher_sink:publisher_sink.close()
        code=await process.wait()
        if publisher:
            m.update(publicationWorkerTerminal=publisher.returncode is not None,publicationWorkerExitCode=publisher.returncode,
                publicationWorkerAbsent=not owned_rows(guard.rows(),[publisher.pid],[publisher.pid]))
    text=log.read_text() if log.stat().st_size<=4*1024*1024 else ''
    expected=f"[frontier] Selected hero bound region={receipt['region']} unit={receipt['owner']['unitId']} agent={receipt['owner']['agentId']} home={binding[8]}/{binding[9]} clock={receipt['clock']} original-registry=1 reciprocal-home=1"
    refusal='checkpoint' if a.wrong_halo else 'binding'
    # Generic readiness is emitted for the initial home and each resumed
    # native-home arrival. Explicit serial2/4 load boundaries are checked below.
    observed=(text.count(f"[frontier] Selected hero {refusal} refused region={receipt['region']}")==1 and '[frontier] Selected hero bound ' not in text and f"[frontier] Region {receipt['region']} ready" not in text) if a.wrong_hero or a.wrong_halo else text.count(expected)==1 and text.count(f"[frontier] Region {receipt['region']} ready")== (3 if a.publish_repeat_home else 2 if a.publish_home else 1)
    if a.halo_motion and not a.wrong_halo:
        samples=re.findall(r'\[frontier\] Hero halo motion region='+re.escape(receipt['region'])+r' unit=(\d+) agent=(\d+) previous-clock=(\d+) clock=(\d+) previous=(-?\d+,-?\d+,-?\d+) accepted=(-?\d+,-?\d+,-?\d+) native-cells=4 original-tick=1',text)
        samples=[row for row in samples if [int(row[0]),int(row[1])]==[receipt['owner']['unitId'],receipt['owner']['agentId']]]
        m['nativeHaloMotionSamples']=[dict(unitId=int(u),agentId=int(g),previousClock=int(before),clock=int(clock),previous=[int(n) for n in p.split(',')],accepted=[int(n) for n in q.split(',')]) for u,g,before,clock,p,q in samples]
        m['nativeSelectedHaloMotionQualified']=bool(samples) and all(int(u)==receipt['owner']['unitId'] and int(g)==receipt['owner']['agentId'] and int(clock)>int(before) and p!=q for u,g,before,clock,p,q in samples)
        observed=observed and m['nativeSelectedHaloMotionQualified']
    m.update(nativeSessionTerminal=True,nativeExitCode=code,finishedAtMs=time.time_ns()//1000000,logSha256=sha(log),
        ownedProducerAbsent=not owned_rows(guard.rows(),[process.pid],[process.pid]),sourceCheckpointUnchanged=sha(source)==receipt['sha256'],
        copiedCheckpointUnchanged=sha(source_input)==receipt['sha256'],startupFixtureUnchanged=directory_hashes(fixture)==fixture_before,
        preservedAfter=guard.baseline(),nativeExecutableUnchanged=sha(private_exe)==build['nativeExecutableSha256'],bindingBoundaryObserved=observed)
    out.write_text(json.dumps(m,indent=2)+'\n') # Preserve terminal evidence even if a later verifier refuses.
    if a.generate_neighbor:
        complete=code==0 and observed and m['stopReason'] is None and m['ownedProducerAbsent'] and m['sourceCheckpointUnchanged'] and m['copiedCheckpointUnchanged'] and m['startupFixtureUnchanged'] and m['preservedAfter']==preserved and m['nativeExecutableUnchanged'] and m.get('publicationWorkerTerminal') and m.get('publicationWorkerExitCode')==0 and m.get('publicationWorkerAbsent')
        generated=run/'generation.json'
        if complete:
            try:
                g=generation_report(generated)
                complete=g.get('nativeGenerationHoldObserved') is True and g.get('nativeGenerationInitializedObserved') is True and g.get('generatedClock')==100 and g.get('initializationTicks')==2 and g.get('heroImported') is a.arrive_generated_neighbor and g.get('ownerTransferred') is a.arrive_generated_neighbor and len(g.get('controls',[]))==6 and all(c.get('refusedByEngine') for c in g['controls'])
                if a.arrive_generated_neighbor:complete=complete and g.get('nativeGeneratedArrivalGameplayObserved') is True
                if a.repeat_generated_neighbor:
                    second=g.get('repeatedGeneration',{})
                    complete=complete and second.get('nativeGeneratedArrivalGameplayObserved') is True and second.get('crossing',{}).get('serial')==2 and second.get('crossing',{}).get('target')=='1_-1' and second.get('published',{}).get('ownerRevision')==4
                if a.generated_neighbor_journeys>=3:
                    extra=g.get('additionalGenerations',[])
                    regions=['0_0','1_0','1_-1','0_-1','-1_-1','-2_-1','-3_-1','-4_-1','-5_-1']
                    complete=complete and len(extra)==a.generated_neighbor_journeys-2 and all(leg.get('nativeGeneratedArrivalGameplayObserved') is True and leg.get('crossing',{}).get('serial')==serial and leg.get('crossing',{}).get('region')==regions[serial-1] and leg.get('crossing',{}).get('target')==regions[serial] and leg.get('published',{}).get('ownerRevision')==serial*2 for serial,leg in enumerate(extra,3))
                m['freshGeneration']=record(generated)
            except (AssertionError,KeyError,OSError,ValueError,RuntimeError) as error:
                complete=False;m['freshGenerationQualificationError']=str(error) or type(error).__name__
        m['nativeFreshNeighborTrialQualified']=bool(complete);m['nativeFreshNeighborInitializationQualified']=bool(complete);m['selectedHeroBindingTrialQualified']=bool(complete)
        if a.arrive_generated_neighbor:m['nativeGeneratedNeighborArrivalQualified']=bool(complete)
        if a.repeat_generated_neighbor:m['nativeRepeatedGeneratedNeighborArrivalQualified']=bool(complete)
        if a.generated_neighbor_journeys>=3:m['nativeThreeGeneratedNeighborArrivalsQualified']=bool(complete)
        m['qualifiedGeneratedNeighborJourneys']=a.generated_neighbor_journeys if complete else 0
        out.write_text(json.dumps(m,indent=2)+'\n')
        print(json.dumps(dict(nativeSessionTerminal=True,exitCode=code,qualified=bool(complete),ownedProducerAbsent=m['ownedProducerAbsent'],generatedRegions=a.generated_neighbor_journeys if complete else 0)),flush=True)
        raise SystemExit(code or (0 if complete else 1))
    if a.public_travel:
        complete=code==0 and observed and m['stopReason'] is None and m['ownedProducerAbsent'] and m['sourceCheckpointUnchanged'] and m['copiedCheckpointUnchanged'] and m['startupFixtureUnchanged'] and m['preservedAfter']==preserved and m['nativeExecutableUnchanged'] and m.get('publicationWorkerTerminal') and m.get('publicationWorkerExitCode')==0 and m.get('publicationWorkerAbsent')
        if complete:
            try:m['publicDepartureJourney']=public_departures(run,text)
            except (AssertionError,KeyError,OSError,ValueError) as error:
                complete=False;m['publicDepartureQualificationError']=str(error) or type(error).__name__
        m['publicSourceDepartureJourneyQualified']=bool(complete)
        m['selectedHeroBindingTrialQualified']=bool(complete);out.write_text(json.dumps(m,indent=2)+'\n')
        print(json.dumps({'nativeSessionTerminal':True,'exitCode':code,'qualified':bool(complete),'ownedProducerAbsent':m['ownedProducerAbsent'],'publicSourceActions':4 if complete else 0}),flush=True)
        raise SystemExit(code or (0 if complete else 1))
    save_observed=not a.save_journey
    if a.save_journey:
        held=re.findall(r'^\[frontier\] Hero save held serial=1 region='+re.escape(receipt['region'])+r' clock=(\d+) slot=([01]) bytes=(\d+) sha256=([a-f0-9]{64}) phase=7 pending=0$',text,re.M)
        if len(held)==1:
            clock,save_slot,size,digest=held[0];clock=int(clock);save_slot=int(save_slot);size=int(size)
            selected=profile/'Documents/My Games/MajestyHD/SaveGame'/('Frontier_'+receipt['region']+('' if save_slot==0 else '_Recovery')+'.GMP')
            backup=profile/'Documents/My Games/MajestyHD/SaveGame/Hero_Travel_Source_Capture.GMP'
            if a.publish_home and backup.is_file():selected=backup
            marker=profile/'Hero_Travel_Source_Capture.checkpoint'
            if not a.page_home or not marker.is_file():marker=profile/('Frontier_'+receipt['region']+'.checkpoint')
            manifest='\n'.join(['checkpoint-v1',str(save_slot),str(size),digest,content,''])
            released=f"[frontier] Hero save released serial=1 region={receipt['region']} clock={clock} result={result} phase=7 pending=3"
            resumed=f"[frontier] Hero save resumed serial=1 region={receipt['region']} clock={clock} phase=3 pending=0"
            save_observed=clock>receipt['clock'] and save_slot==1 and selected.is_file() and selected.stat().st_size==size and sha(selected)==digest and marker.read_text()==manifest and text.count(released)==1 and text.count(resumed)==1 and text.index(held[0][3])<text.index(released)<text.index(resumed) and '[frontier] Hero save abandoned ' not in text
            if a.retire_source:
                retired=f"[frontier] Hero source retirement completed serial=1 region=0_0 unit={receipt['owner']['unitId']} agent={receipt['owner']['agentId']} clock={clock} captured-save-preserved=1 retired-saved=1 wrong-clock-refused=1 wrong-alias-refused=1 duplicate-refused=1 binding-closed=1 phase=7 pending=0 owner-published=0 result=pass"
                saves={name:profile/'Documents/My Games/MajestyHD/SaveGame'/(name+'.GMP') for name in ['Hero_Source_Before','Hero_Source_Refused','Hero_Source_Retired']}
                save_observed=clock>receipt['clock'] and save_slot==1 and selected.is_file() and selected.stat().st_size==size and sha(selected)==digest and marker.read_text()==manifest and text.count(retired)==1 and all(path.is_file() for path in saves.values()) and released not in text and resumed not in text and '[frontier] Hero save abandoned ' not in text
                m['sourceRetirementSaves']={name:record(path) for name,path in saves.items() if path.is_file()}
                m['nativeSourceRetirementBoundaryObserved']=save_observed
            m['heldSave']=dict(serial=1,region=receipt['region'],clock=clock,slot=save_slot,size=size,sha256=digest,
                checkpoint=record(selected) if selected.is_file() else None,nativeManifest=manifest,marker=record(marker))
        m['nativeHeroSaveHandshakeQualified']=save_observed and not a.retire_source
        m['nativeHeroHeldCaptureQualified']=save_observed
    if a.crossing:
        crossed=re.findall(r'^\[frontier\] Hero crossing serial=1 region='+re.escape(receipt['region'])+r' target=(\S+) previous-clock=(\d+) clock=(\d+) unit=(\d+) agent=(\d+) previous=(-?\d+,-?\d+,-?\d+) accepted=(-?\d+,-?\d+,-?\d+) phase=3 pending=7 original-tick=1 native-cells=4$',text,re.M)
        move=re.findall(r'^\[streaming\] Selected hero original move unit=(\d+) agent=(\d+) clock=(\d+) point=4064,(\d+) original-command=005b4870 pose-written=0 task-preserved=1 ungated-ai=1 result=pass$',text,re.M)
        move=[row for row in move if [int(row[0]),int(row[1])]==[receipt['owner']['unitId'],receipt['owner']['agentId']]]
        good=len(crossed)==len(move)==1 and save_observed
        if good:
            target,before,clock,unit,agent,p,q=crossed[0]
            m['nativeCrossing']=dict(serial=1,region=receipt['region'],target=target,previousClock=int(before),clock=int(clock),unitId=int(unit),agentId=int(agent),
                previous=dict(zip(['x','y','z'],map(int,p.split(',')))),accepted=dict(zip(['x','y','z'],map(int,q.split(',')))))
            good=target=='1_0' and int(unit)==receipt['owner']['unitId'] and int(agent)==receipt['owner']['agentId'] and int(before)>=receipt['clock'] and int(clock)>int(before) and int(clock)==m['heldSave']['clock']
        m['nativeSelectedHeroCrossingQualified']=bool(good)
        observed=observed and good
    if destination:
        held_target=run/'frontier_1_0/Documents/My Games/MajestyHD/SaveGame/Hero_Travel_Target_Held.GMP'
        target_line=f"[frontier] Hero travel target held serial=1 region=1_0 clock={destination['clock']} original-load=1 ordinary-ticks=0 source-roots-cleared=1 phase=7 pending=0 owner-published=0 result=pass"
        release='[frontier] Session released serial=1 region=0_0 roots-freed=1,1,1,1,1,1,1,1'
        attached='[frontier] Session attached serial=1 region=1_0 mode=saved'
        page_good=text.count(target_line)==1 and text.count(release)==1 and text.count(attached)==1 and text.index(release)<text.index(attached)<text.index(target_line) and held_target.is_file() and sha(target_input)==destination['sourceCheckpoint']['sha256']
        m.update(nativeSelectedHeroPagingBoundaryObserved=page_good,destinationCopiedUnchanged=sha(target_input)==destination['sourceCheckpoint']['sha256'],sourceUnloaded=page_good,ownerTransferred=False)
        if held_target.is_file():m['heldDestination']=record(held_target)
        observed=observed and page_good
    if arrival:
        ready=re.findall(r'^\[frontier\] Hero travel arrival ready source=(\d+)/(\d+) source-clock=(\d+) region=1_0 hero=(\d+) agent=(\d+) home=(\d+) clock=(\d+) original-import=1 activated=1 paused=1 ordinary-ticks=0 owner-published=0 result=pass$',text,re.M)
        names=['Hero_Home_Before','Hero_Home_Registered','Hero_Home_Reused','Hero_Arrival_Refused','Hero_Arrival_Imported','Hero_Travel_Target_Active']
        worlds=[neighbor/'Documents/My Games/MajestyHD/SaveGame'/(name+'.GMP') for name in names]
        join_good=len(ready)==1 and all(w.is_file() for w in worlds) and sha(pack_input)==arrival['pack']['sha256'] and sha(proposal)==destination['proposal']['sha256']
        if join_good:
            src,src_agent,src_clock,unit,agent,home,clock=map(int,ready[0]);join_good=[src,src_agent,src_clock,home,clock]==[receipt['owner']['unitId'],receipt['owner']['agentId'],m['heldSave']['clock'],destination['proposedAgentId'],destination['clock']] and src_clock==arrival['options']['sourceClockMs']
            m.update(importedAliases=dict(unitId=unit,agentId=agent,homeAgentId=home),arrivalWorlds=[record(w) for w in worlds])
        m.update(nativeSelectedHeroArrivalBoundaryObserved=join_good,heroImported=join_good,destinationActivated=join_good,
            arrivalPackageUnchanged=sha(pack_input)==arrival['pack']['sha256'],proposalUnchanged=sha(proposal)==destination['proposal']['sha256'])
        observed=observed and join_good
    if a.publish_arrival:
        publication=run/'publication.json';good=publisher is not None and publisher.returncode==0 and publication.is_file()
        if good:
            published=guard.bounded_json(publication);receipt_p=published['publicationReceipt'];m['publication']=record(publication)
            accepted=f"[frontier] Hero travel publication accepted serial=1 region=1_0 clock={destination['clock']} manifest-sha256={receipt_p['ownerManifestSha256']} both-worlds-verified=1 phase=7 pending=3"
            resumed=f"[frontier] Hero travel resumed serial=1 region=1_0 unit={receipt_p['owner']['unitId']} agent={receipt_p['owner']['agentId']} home=proxy/0/{receipt_p['home']['agentId']} clock={destination['clock']} manifest-sha256={receipt_p['ownerManifestSha256']} original-resume=1 fresh-binding=1 phase=3 pending=0"
            good=text.count(accepted)==text.count(resumed)==1 and text.index(accepted)<text.index(resumed) and text.count('[frontier] Hero travel publication refused serial=1 ')==4
            names=['Hero_Travel_Target_Published','Hero_Travel_Target_Routed'];m['resumeWorlds']=[record(neighbor/'Documents/My Games/MajestyHD/SaveGame'/(n+'.GMP')) for n in names if (neighbor/'Documents/My Games/MajestyHD/SaveGame'/(n+'.GMP')).is_file()]
            m.update(publicationWorkerTerminal=True,publicationWorkerExitCode=publisher.returncode,publicationWorkerAbsent=not owned_rows(guard.rows(),[publisher.pid],[publisher.pid]))
        m.update(nativeSelectedHeroResumeBoundaryObserved=bool(good),ownerTransferred=bool(good))
        observed=observed and good
        if a.publish_second_capture:
            second=run/'second-publication.json'
            second_good=good and second.is_file()
            if second_good:
                second_result=guard.bounded_json(second)
                second_good=second_result.get('nativeHeldSecondHeroCapturePublished') is True and second_result.get('nativePid')==process.pid and second_result.get('fixture')==str(run)
                m['secondPublication']=record(second)
            m['nativeSelectedSecondHeroCapturePublicationObserved']=bool(second_good)
            observed=observed and second_good
            if a.retire_remote_source:
                names=['Hero_Remote_Source_Before','Hero_Remote_Source_Refused','Hero_Remote_Source_Retired']
                worlds=[neighbor/'Documents/My Games/MajestyHD/SaveGame'/(n+'.GMP') for n in names]
                report=run/'remote-retirement.json'
                retired=bool(second_good and report.is_file() and all(w.is_file() for w in worlds))
                if retired:
                    qualification=guard.bounded_json(report)
                    retired=qualification.get('nativeRemoteHeroRetirementAcknowledged') is True and qualification.get('nativePid')==process.pid
                    m.update(remoteSourceRetirementSaves={n:record(w) for n,w in zip(names,worlds)},remoteRetirementAcknowledgement=record(report))
                m['nativeSelectedRemoteHeroRetirementBoundaryObserved']=retired
                observed=observed and retired
                if a.page_home:
                    home_report=run/'home-page-input.json';held_home=profile/'Documents/My Games/MajestyHD/SaveGame/Hero_Travel_Home_Held.GMP'
                    home_good=bool(retired and home_report.is_file() and held_home.is_file())
                    if home_good:
                        prepared_home=guard.bounded_json(home_report)
                        clock=prepared_home['homeClock']
                        release='[frontier] Session released serial=2 region=1_0 roots-freed=1,1,1,1,1,1,1,1'
                        attached='[frontier] Session attached serial=2 region=0_0 mode=saved'
                        held_line=f'[frontier] Hero travel target held serial=2 region=0_0 clock={clock} original-load=1 ordinary-ticks=0 source-roots-cleared=1 phase=7 pending=0 owner-published=0 result=pass'
                        home_good=text.count(release)==text.count(attached)==text.count(held_line)==1 and text.index(release)<text.index(attached)<text.index(held_line)
                        m.update(homePageInput=record(home_report),homePageSnapshot=record(held_home),homeClock=clock,
                            homePagingRefusedSnapshot=record(neighbor/'Documents/My Games/MajestyHD/SaveGame/Hero_Remote_Source_Paging_Refused.GMP'))
                    m['nativeSelectedHeroHomePagingBoundaryObserved']=bool(home_good)
                    observed=observed and home_good
                    if a.import_home:
                        names=['Hero_Return_Home_Before','Hero_Return_Home_Refused','Hero_Return_Home_Imported']
                        worlds=[profile/'Documents/My Games/MajestyHD/SaveGame'/(n+'.GMP') for n in names]
                        imports=re.findall(r'\[frontier\] Hero return home import held serial=2 region=0_0 source=538/39 source-clock=4350 hero=(\d+) agent=(\d+) home=469/7 clock=103500 wrong-digest-refused=1 wrong-clock-refused=1 wrong-home-refused=1 ordinary-ticks=0 activated=0 owner-published=0 result=pass',text)
                        home_import=bool(home_good and len(imports)==1 and all(w.is_file() for w in worlds))
                        if home_import:m.update(homeArrivalWorlds={n:record(w) for n,w in zip(names,worlds)},homeImportedAliases=[int(n) for n in imports[0]])
                        m['nativeSelectedHeroHomeImportBoundaryObserved']=home_import
                        observed=observed and home_import
                        if a.activate_home:
                            names=['Hero_Return_Home_Activation_Refused','Hero_Return_Home_Active']
                            worlds=[profile/'Documents/My Games/MajestyHD/SaveGame'/(n+'.GMP') for n in names]
                            active=bool(home_import and all(w.is_file() for w in worlds) and text.count('[frontier] Hero return home activation held serial=2 region=0_0 ')==1)
                            if active:m['homeActivationWorlds']={n:record(w) for n,w in zip(names,worlds)}
                            m['nativeSelectedHeroHomeActivationBoundaryObserved']=active
                            observed=observed and active
                            if a.publish_home:
                                report=run/'home-publication.json'
                                names=['Hero_Return_Home_Published','Hero_Return_Home_Played']
                                worlds=[profile/'Documents/My Games/MajestyHD/SaveGame'/(n+'.GMP') for n in names]
                                home_resume=bool(active and report.is_file() and all(w.is_file() for w in worlds))
                                if home_resume:
                                    result_home=guard.bounded_json(report);r=result_home['publicationReceipt']
                                    accepted=f"[frontier] Hero travel publication accepted serial=2 region=0_0 clock={clock} manifest-sha256={r['ownerManifestSha256']} both-worlds-verified=1 phase=7 pending=3"
                                    resumed=f"[frontier] Hero travel resumed serial=2 region=0_0 unit={r['owner']['unitId']} agent={r['owner']['agentId']} home=native/{r['home']['unitId']}/{r['home']['agentId']} clock={clock} manifest-sha256={r['ownerManifestSha256']} original-resume=1 fresh-binding=1 phase=3 pending=0"
                                    home_resume=result_home.get('nativeHeldHeroHomePairPublished') is True and result_home['nativePid']==process.pid and text.count(accepted)==text.count(resumed)==1 and text.index(accepted)<text.index(resumed) and text.count('[frontier] Hero travel publication refused serial=2 region=0_0 ')==5 and text.count('[frontier] Hero return home gameplay held serial=2 region=0_0 ')==1
                                    m.update(homePublication=record(report),homeResumeWorlds={n:record(w) for n,w in zip(names,worlds)})
                                m['nativeSelectedHeroHomeResumeBoundaryObserved']=home_resume
                                observed=observed and home_resume
                                if a.save_home:
                                    report=run/'home-save-publication.json'
                                    saved_home=bool(home_resume and report.is_file())
                                    if saved_home:
                                        saved_result=guard.bounded_json(report);r=saved_result['publicationReceipt']
                                        line=f"[frontier] Hero home save accepted serial=3 region=0_0 unit={r['owner']['unitId']} agent={r['owner']['agentId']} home={r['home']['unitId']}/{r['home']['agentId']} clock={r['clock']} manifest-sha256={saved_result['acknowledgement'].strip().split('|')[-1]} selected-capture-verified=1 fresh-native-binding=1 phase=7 pending=0 result=pass"
                                        saved_home=saved_result.get('nativeContinuedHeroHomeSavePublished') is True and saved_result['nativePid']==process.pid and text.count(line)==1 and text.count('[frontier] Hero captured publication refused serial=3 region=0_0 ')==5
                                        m['homeSavePublication']=record(report)
                                    m['nativeSelectedHeroContinuedHomeSaveBoundaryObserved']=saved_home
                                    observed=observed and saved_home
                                    if a.repeat_departure:
                                        report=run/'repeat-departure-publication.json'
                                        names=['Hero_Repeat_Source_Before','Hero_Repeat_Source_Refused','Hero_Repeat_Source_Retired']
                                        worlds=[profile/'Documents/My Games/MajestyHD/SaveGame'/(n+'.GMP') for n in names]
                                        repeated=bool(saved_home and report.is_file() and all(w.is_file() for w in worlds))
                                        if repeated:
                                            repeat_result=guard.bounded_json(report)
                                            repeated=repeat_result.get('nativeRepeatedHeroDepartureCapturePublished') is True and repeat_result['nativePid']==process.pid and text.count('[frontier] Hero home departure resumed serial=3 region=0_0 ')==1 and text.count('[frontier] Hero repeated source retirement completed serial=4 region=0_0 ')==1 and text.count('[frontier] Hero captured publication refused serial=4 region=0_0 ')==5
                                            m.update(repeatDeparturePublication=record(report),repeatRetirementWorlds={n:record(w) for n,w in zip(names,worlds)})
                                        m['nativeSelectedHeroRepeatDepartureBoundaryObserved']=repeated
                                        observed=observed and repeated
                                        if a.page_repeat_neighbor:
                                            report=run/'repeat-neighbor-page-input.json'
                                            held=run/'frontier_1_0/Documents/My Games/MajestyHD/SaveGame/Hero_Repeat_Target_Held.GMP'
                                            refused=profile/'Documents/My Games/MajestyHD/SaveGame/Hero_Repeat_Source_Paging_Refused.GMP'
                                            paged=bool(repeated and report.is_file() and held.is_file() and refused.is_file())
                                            if paged:
                                                staged=guard.bounded_json(report);clock=staged['targetClock']
                                                line=f'[frontier] Hero travel target held serial=3 region=1_0 clock={clock} original-load=1 ordinary-ticks=0 source-roots-cleared=1 phase=7 pending=0 owner-published=0 result=pass'
                                                paged=staged.get('selectedHeroRepeatNeighborStaged') is True and staged['nativePid']==process.pid and text.count(line)==1 and text.count('[frontier] Session released serial=3 region=0_0 ')==1
                                                m.update(repeatNeighborPageInput=record(report),repeatNeighborHeld=record(held),repeatNeighborPagingRefused=record(refused))
                                            m['nativeSelectedHeroRepeatNeighborPagingBoundaryObserved']=paged
                                            observed=observed and paged
                                            if a.import_repeat_neighbor:
                                                names=['Hero_Repeat_Home_Before','Hero_Repeat_Home_Reused','Hero_Repeat_Arrival_Refused','Hero_Repeat_Arrival_Imported','Hero_Repeat_Activation_Refused','Hero_Repeat_Target_Active']
                                                worlds=[neighbor/'Documents/My Games/MajestyHD/SaveGame'/(n+'.GMP') for n in names]
                                                imported=bool(paged and all(w.is_file() for w in worlds) and text.count('[frontier] Hero repeated neighbor arrival held serial=4 region=1_0 ')==1)
                                                if imported:m['repeatNeighborArrivalWorlds']={n:record(w) for n,w in zip(names,worlds)}
                                                m['nativeSelectedHeroRepeatNeighborArrivalBoundaryObserved']=imported
                                                observed=observed and imported
                                                if a.publish_repeat_neighbor:
                                                    report=run/'repeat-neighbor-publication.json'
                                                    names=['Hero_Repeat_Target_Published','Hero_Repeat_Target_Routed','Hero_Repeat_Target_Played']
                                                    worlds=[neighbor/'Documents/My Games/MajestyHD/SaveGame'/(n+'.GMP') for n in names]
                                                    resumed=bool(imported and report.is_file() and all(w.is_file() for w in worlds))
                                                    if resumed:
                                                        publication=guard.bounded_json(report);r=publication['publicationReceipt'];clock=r['clock']
                                                        line=f"[frontier] Hero travel resumed serial=4 region=1_0 unit={r['owner']['unitId']} agent={r['owner']['agentId']} home=proxy/0/{r['home']['agentId']} clock={clock} manifest-sha256={r['ownerManifestSha256']} original-resume=1 fresh-binding=1 phase=3 pending=0"
                                                        resumed=publication.get('nativeHeldHeroRepeatNeighborPairPublished') is True and publication['nativePid']==process.pid and text.count(line)==1 and text.count('[frontier] Hero travel publication refused serial=4 region=1_0 ')==5 and text.count('[frontier] Hero repeated neighbor gameplay held serial=4 region=1_0 ')==1
                                                        m.update(repeatNeighborPublication=record(report),repeatNeighborResumeWorlds={n:record(w) for n,w in zip(names,worlds)})
                                                    m['nativeSelectedHeroRepeatNeighborResumeBoundaryObserved']=resumed
                                                    observed=observed and resumed
                                                    if a.save_repeat_neighbor:
                                                        report=run/'repeat-neighbor-save-publication.json'
                                                        saved=bool(resumed and report.is_file())
                                                        if saved:
                                                            publication=guard.bounded_json(report);r=publication['publicationReceipt']
                                                            prefix=f"[frontier] Hero repeated neighbor save accepted serial=5 region=1_0 unit={r['owner']['unitId']} agent={r['owner']['agentId']} home={r['home']['agentId']} clock={r['clock']} "
                                                            saved=publication.get('nativeContinuedHeroNeighborSavePublished') is True and publication['nativePid']==process.pid and text.count(prefix)==1 and text.count('[frontier] Hero captured publication refused serial=5 region=1_0 ')==5
                                                            m['repeatNeighborSavePublication']=record(report)
                                                        m['nativeSelectedHeroRepeatNeighborSaveBoundaryObserved']=saved
                                                        observed=observed and saved
                                                        if a.repeat_return:
                                                            report=run/'repeat-return-publication.json'
                                                            names=['Hero_Repeat_Remote_Source_Before','Hero_Repeat_Remote_Source_Refused','Hero_Repeat_Remote_Source_Retired']
                                                            worlds=[neighbor/'Documents/My Games/MajestyHD/SaveGame'/(n+'.GMP') for n in names]
                                                            returned=bool(saved and report.is_file() and all(w.is_file() for w in worlds))
                                                            if returned:
                                                                publication=guard.bounded_json(report)
                                                                returned=publication.get('nativeRepeatedHeroReturnCapturePublished') is True and publication['nativePid']==process.pid and text.count('[frontier] Hero repeated neighbor continued serial=5 region=1_0 ')==1 and text.count('[frontier] Hero remote source retirement completed serial=6 region=1_0 ')==1 and text.count('[frontier] Hero captured publication refused serial=6 region=1_0 ')==5
                                                                m.update(repeatReturnPublication=record(report),repeatRemoteRetirementWorlds={n:record(w) for n,w in zip(names,worlds)})
                                                            m['nativeSelectedHeroRepeatReturnBoundaryObserved']=returned
                                                            observed=observed and returned
                                                            if a.page_repeat_home:
                                                                report=run/'repeat-home-page-input.json'
                                                                held=profile/'Documents/My Games/MajestyHD/SaveGame/Hero_Repeat_Return_Home_Held.GMP'
                                                                refused=neighbor/'Documents/My Games/MajestyHD/SaveGame/Hero_Repeat_Remote_Source_Paging_Refused.GMP'
                                                                paged=bool(returned and report.is_file() and held.is_file() and refused.is_file())
                                                                if paged:
                                                                    staged=guard.bounded_json(report);clock=staged['targetClock']
                                                                    released='[frontier] Session released serial=4 region=1_0 roots-freed=1,1,1,1,1,1,1,1'
                                                                    attached='[frontier] Session attached serial=4 region=0_0 mode=saved'
                                                                    line=f'[frontier] Hero travel target held serial=4 region=0_0 clock={clock} original-load=1 ordinary-ticks=0 source-roots-cleared=1 phase=7 pending=0 owner-published=0 result=pass'
                                                                    paged=staged.get('selectedHeroRepeatHomeStaged') is True and staged['nativePid']==process.pid and text.count(released)==text.count(attached)==text.count(line)==1 and text.index(released)<text.index(attached)<text.index(line)
                                                                    m.update(repeatHomePageInput=record(report),repeatHomeHeld=record(held),repeatHomePagingRefused=record(refused))
                                                                m['nativeSelectedHeroRepeatHomePagingBoundaryObserved']=paged
                                                                observed=observed and paged
                                                                if a.import_repeat_home:
                                                                    names=['Hero_Repeat_Return_Home_Before','Hero_Repeat_Return_Home_Refused','Hero_Repeat_Return_Home_Imported']
                                                                    worlds=[profile/'Documents/My Games/MajestyHD/SaveGame'/(n+'.GMP') for n in names]
                                                                    matches=re.findall(r'\[frontier\] Hero return home import held serial=6 region=0_0 source=(\d+)/(\d+) source-clock=(\d+) hero=(\d+) agent=(\d+) home=469/7 clock=(\d+) wrong-digest-refused=1 wrong-clock-refused=1 wrong-home-refused=1 ordinary-ticks=0 activated=0 owner-published=0 result=pass',text)
                                                                    imported=bool(paged and len(matches)==1 and all(w.is_file() for w in worlds))
                                                                    if imported:
                                                                        values=list(map(int,matches[0]));owner=publication['publicationReceipt']['owner']
                                                                        imported=values[:3]==[owner['unitId'],owner['agentId'],publication['held']['clock']] and values[-1]==clock
                                                                        m.update(repeatHomeArrivalWorlds={n:record(w) for n,w in zip(names,worlds)},repeatHomeImportedAliases=values[3:5])
                                                                    m['nativeSelectedHeroRepeatHomeImportBoundaryObserved']=imported
                                                                    observed=observed and imported
                                                                    if a.activate_repeat_home:
                                                                        names=['Hero_Repeat_Return_Home_Activation_Refused','Hero_Repeat_Return_Home_Active']
                                                                        worlds=[profile/'Documents/My Games/MajestyHD/SaveGame'/(n+'.GMP') for n in names]
                                                                        active=bool(imported and all(w.is_file() for w in worlds) and text.count('[frontier] Hero return home activation held serial=6 region=0_0 ')==1)
                                                                        if active:m['repeatHomeActivationWorlds']={n:record(w) for n,w in zip(names,worlds)}
                                                                        m['nativeSelectedHeroRepeatHomeActivationBoundaryObserved']=active
                                                                        observed=observed and active
                                                                        if a.publish_repeat_home:
                                                                            report=run/'repeat-home-publication.json'
                                                                            names=['Hero_Repeat_Return_Home_Published','Hero_Repeat_Return_Home_Played']
                                                                            worlds=[profile/'Documents/My Games/MajestyHD/SaveGame'/(n+'.GMP') for n in names]
                                                                            resumed=bool(active and report.is_file() and all(w.is_file() for w in worlds))
                                                                            if resumed:
                                                                                selected=guard.bounded_json(report);r=selected['publicationReceipt']
                                                                                accepted=f"[frontier] Hero travel publication accepted serial=6 region=0_0 clock={clock} manifest-sha256={r['ownerManifestSha256']} both-worlds-verified=1 phase=7 pending=3"
                                                                                continued=f"[frontier] Hero travel resumed serial=6 region=0_0 unit={r['owner']['unitId']} agent={r['owner']['agentId']} home=native/{r['home']['unitId']}/{r['home']['agentId']} clock={clock} manifest-sha256={r['ownerManifestSha256']} original-resume=1 fresh-binding=1 phase=3 pending=0"
                                                                                resumed=selected.get('nativeHeldHeroRepeatHomePairPublished') is True and selected['nativePid']==process.pid and text.count(accepted)==text.count(continued)==1 and text.index(accepted)<text.index(continued) and text.count('[frontier] Hero travel publication refused serial=6 region=0_0 ')==5 and text.count('[frontier] Hero return home gameplay held serial=6 region=0_0 ')==1
                                                                                m.update(repeatHomePublication=record(report),repeatHomeResumeWorlds={n:record(w) for n,w in zip(names,worlds)})
                                                                            m['nativeSelectedHeroRepeatHomeResumeBoundaryObserved']=resumed
                                                                            observed=observed and resumed
                                                                            if a.save_repeat_home:
                                                                                report=run/'repeat-home-save-publication.json'
                                                                                saved=bool(resumed and report.is_file())
                                                                                if saved:
                                                                                    publication=guard.bounded_json(report);r=publication['publicationReceipt']
                                                                                    line=f"[frontier] Hero repeated home save accepted serial=7 region=0_0 unit={r['owner']['unitId']} agent={r['owner']['agentId']} home={r['home']['unitId']}/{r['home']['agentId']} clock={r['clock']} manifest-sha256={publication['acknowledgement'].strip().split('|')[-1]} selected-capture-verified=1 fresh-native-binding=1 phase=7 pending=0 result=pass"
                                                                                    saved=publication.get('nativeContinuedHeroRepeatHomeSavePublished') is True and publication['nativePid']==process.pid and text.count(line)==1 and text.count('[frontier] Hero captured publication refused serial=7 region=0_0 ')==5
                                                                                    m['repeatHomeSavePublication']=record(report)
                                                                                m['nativeSelectedHeroContinuedRepeatHomeSaveBoundaryObserved']=saved
                                                                                observed=observed and saved
    complete=code==0 and observed and save_observed and m['stopReason'] is None and m['ownedProducerAbsent'] and m['sourceCheckpointUnchanged'] and m['copiedCheckpointUnchanged'] and m['startupFixtureUnchanged'] and m['preservedAfter']==preserved and m['nativeExecutableUnchanged']
    m['selectedHeroBindingTrialQualified']=complete;out.write_text(json.dumps(m,indent=2)+'\n')
    print(json.dumps({'nativeSessionTerminal':True,'exitCode':code,'qualified':complete,'ownedProducerAbsent':m['ownedProducerAbsent']}),flush=True)
    raise SystemExit(code or (0 if complete else 1))
if __name__=='__main__':asyncio.run(main())

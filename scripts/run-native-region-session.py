#!/usr/bin/env python3
"""Exercise the real named-profile session path in one guarded native process."""
import argparse, hashlib, importlib.util, json, os, re, subprocess, tempfile, time
from lib.named_travel_script import named_travel_script, verify_named_travel_log
from lib.native_saved_source import saved_source
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];GAME=ROOT/'upstream/majesty-recomp'
RUNNER_SOURCE_AT_START=Path(__file__).read_bytes()
RUNNER_SHA_AT_START=hashlib.sha256(RUNNER_SOURCE_AT_START).hexdigest()
spec=importlib.util.spec_from_file_location('expansion',ROOT/'scripts/run-native-coordinate-expansion.py')
helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
sha,copy,idle,verify=helper.sha,helper.copy,helper.idle,helper.verify

def native_state_stamps():
    result={}
    for name in ('registry.json','mods/run.json'):
        path=GAME/'build/recomp'/name
        if path.is_symlink():raise ValueError('Canonical native state must not be a symlink')
        if not path.exists():result[name]=None;continue
        st=path.stat()
        if not path.is_file() or st.st_size>2*1024*1024:raise ValueError('Canonical native state exceeds bound')
        result[name]=dict(sha256=sha(path),bytes=st.st_size,inode=st.st_ino,mtimeNs=st.st_mtime_ns)
    return result

def travel_route(value):
    directions=value.split(',')
    steps={'west':(-1,0,0),'north':(0,-1,1),'south':(0,1,2),'east':(1,0,3)}
    if not 2 <= len(directions) <= 16 or any(d not in steps for d in directions):
        raise ValueError('Use 2..16 comma-separated cardinal directions')
    route=['0_0'];codes=[];x=y=0
    for direction in directions:
        dx,dy,code=steps[direction];x+=dx;y+=dy
        if (x,y) in ((0,1),(0,-1)):
            raise ValueError('Route must preserve the refused orphan and symlink neighbors')
        route.append(f'{x}_{y}');codes.append(code)
    if route[-1]!='0_0':raise ValueError('Finish at the original kingdom')
    return route,codes+[4]

def repeat_route(route, directions, laps):
    if type(laps) is not int or not 1 <= laps <= 4:
        raise ValueError('Use 1..4 complete route laps')
    return route[:-1] * laps + [route[-1]], directions[:-1] * laps + [4]

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('build_report',type=Path)
    for name in ('publication','receipt'):p.add_argument(name,type=Path,nargs='?')
    p.add_argument('--stopped-source-report',type=Path,help='For prepared-resume lifecycle testing only, use an independently checked immutable native ready snapshot')
    p.add_argument('--attempt',type=int,required=True)
    p.add_argument('--world',default='session')
    p.add_argument('--observe-camera',action='store_true',help='Enable the opt-in native boundary sensor; route requests remain explicit')
    p.add_argument('--pan-first',action='store_true',help='Hold the original mouse edge-scroll input and require a real west-edge gesture before the first request')
    p.add_argument('--pan-route',action='store_true',help='Require original mouse edge-scroll gestures before every trip; west-first, one lap, at most four trips')
    p.add_argument('--expect-camera-arrival',action='store_true',help='Require opposite-edge camera placement before the first destination tick')
    p.add_argument('--await-outdoor-hero',action='store_true',help='Wait for the selected returned Warrior to leave its actual guild through original AI before departure')
    p.add_argument('--capture-ready-state',action='store_true',help='Capture original full saves before the first gameplay tick of each region visit')
    p.add_argument('--capture-before-camera',action='store_true',help='Also capture the full restored world before applying the arrival view transform')
    p.add_argument('--named-checkpoint',action='store_true',help='Exercise ordinary named checkpoint requests from the native smoke input; solo owned profiles only')
    p.add_argument('--named-travel',action='store_true',help='Travel through ordinary UI names with the request-file fixture disabled; two to four trips')
    p.add_argument('--observe-queues',action='store_true',help='Read-only observation of the preceding registered message queue; requires owned Ready snapshots')
    p.add_argument('--observe-boundary-clamps',action='store_true',help='Read-only tracing of the original multi-vertex terrain clamp in the owned restoration world')
    p.add_argument('--check-loaded-kingdom-binding',action='store_true',help='Exercise original kingdom selection on each real saved graph with temporary fixture party metadata')
    p.add_argument('--check-rebuild-hold',action='store_true',help='Hold each actual saved-world rebuild through one original paused tick, then dispatch an owning original resume record locally')
    p.add_argument('--prepared-resume',action='store_true',help='With --check-rebuild-hold, queue resume from the original prepared input seam and let normal transmission/dispatch consume it')
    p.add_argument('--route',default='west,east,west,east',help='2..16 steps, returning home and preserving refusal probes')
    p.add_argument('--laps',type=int,default=1,help='Repeat the complete closed route 1..4 times, at most 65 visits')
    p.add_argument('--seconds-per-visit',type=int,choices=(4,6,8),default=4,
                   help='Bounded session budget per visit; use 8 for wider fresh-generation routes')
    p.add_argument('--received-home',type=Path,help='Use a qualified staged-receiver export as the initial home save')
    a=p.parse_args()
    try:
        base_route,base_directions=travel_route(a.route)
        route,directions=repeat_route(base_route,base_directions,a.laps)
    except ValueError as error:p.error(str(error))
    if a.pan_route:
        if a.seconds_per_visit!=4:p.error('--seconds-per-visit is for scripted travel, not --pan-route')
        if not a.observe_camera or directions[0]!=0 or a.laps!=1 or len(route)>5:
            p.error('--pan-route requires --observe-camera, a west-first route, one lap and at most four trips')
        a.pan_first=True
    if a.pan_first and (not a.observe_camera or directions[0]!=0):p.error('--pan-first requires --observe-camera and a west-first route')
    if a.expect_camera_arrival and not a.observe_camera:p.error('--expect-camera-arrival requires --observe-camera')
    if a.capture_ready_state and a.world!='restoration':p.error('--capture-ready-state requires the owned restoration world')
    if a.capture_before_camera and not (a.capture_ready_state and a.expect_camera_arrival):
        p.error('--capture-before-camera requires --capture-ready-state and --expect-camera-arrival')
    if a.observe_queues and not a.capture_ready_state:p.error('--observe-queues requires --capture-ready-state')
    if a.observe_boundary_clamps and not a.capture_ready_state:p.error('--observe-boundary-clamps requires --capture-ready-state')
    if a.check_loaded_kingdom_binding and not a.capture_ready_state:p.error('--check-loaded-kingdom-binding requires --capture-ready-state')
    if a.check_rebuild_hold and not a.capture_ready_state:p.error('--check-rebuild-hold requires --capture-ready-state')
    if a.prepared_resume and not a.check_rebuild_hold:p.error('--prepared-resume requires --check-rebuild-hold')
    if a.stopped_source_report:
        if not a.prepared_resume or a.publication or a.receipt or a.received_home:
            p.error('--stopped-source-report requires prepared resume and omits entity publication/receipt and receiver inputs')
    elif not a.publication or not a.receipt:p.error('Entity publication and receipt required without --stopped-source-report')
    if a.received_home and not a.capture_ready_state:p.error('--received-home requires before-first-tick saved-state comparison')
    if a.named_checkpoint and (a.pan_first or a.pan_route or a.capture_ready_state or a.received_home):
        p.error('--named-checkpoint uses the ordinary short solo route, without camera/capture/receiver fixtures')
    if a.named_travel and (a.named_checkpoint or a.observe_camera or a.pan_first or a.capture_ready_state or a.received_home or a.await_outdoor_hero or a.laps!=1 or len(route)>5):
        p.error('--named-travel uses two to four ordinary UI trips without extra camera/receiver/capture fixtures')
    duration=(25+40*(len(route)-1)) if a.pan_route else max(35,a.seconds_per_visit*len(route))+(45 if a.pan_first or a.await_outdoor_hero else 0)
    if not re.fullmatch(r'[a-z0-9-]{1,40}',a.world):p.error('Canonical world name required')
    out=ROOT/f'output/native-region-session-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
    if a.attempt<1 or out.exists() or log.exists():p.error('Use a fresh positive attempt')
    idle();build_path=a.build_report.resolve();build=json.loads(build_path.read_text());exe=GAME/'build/recomp/pop_smoke'
    if not build.get('nativeBuildQualified') or build.get('exitCode')!=0 or sha(exe)!=build['nativeExecutableSha256']:p.error('Current official build required')
    if any(sha(ROOT/name)!=digest for name,digest in build['nativeSourceSha256'].items()):p.error('Compiled source changed')
    stopped_source=None
    if a.stopped_source_report:
        stopped_source=saved_source(a.stopped_source_report,GAME)
        receipt=publication=Path(stopped_source['report'])
        selected=[dict(filename=stopped_source['source'],sha256=stopped_source['sha256'],bytes=stopped_source['bytes'])]
        original=Path(stopped_source['originalSettings']);inputs=stopped_source['inputHashes']
    else:
        receipt=a.receipt.resolve();publication=a.publication.resolve();pub=json.loads(publication.read_text());selected=verify(receipt)
        if len(selected)!=2 or any(row['revision']!=2 or row['owner']['region']!='0_0' for row in selected):p.error('Require committed return revision2')
        previous=json.loads(Path(pub['liveManifest']).read_text());original=Path(previous['profile']);inputs=previous['inputHashes']
    received_home=None;home_input=Path(selected[0]['filename'])
    if a.received_home:
        received_report=a.received_home.resolve();received=json.loads(received_report.read_text())
        received_file=Path(received['received']).resolve()
        if not received.get('realCheckpointPacketTransferQualified') or not received.get('testTerminal') or received.get('exitCode')!=0 or not received.get('originalSaveUnchanged') or not received.get('copiedSourceUnchanged'):
            p.error('Require a completed successful real-checkpoint packet transfer')
        if not received_file.is_relative_to(GAME/'build') or not received_file.parent.name.startswith('actor-arrival-fixture-received-checkpoint-') or received_file.name!='Received.GMP' or received['sourceSha256']!=selected[0]['sha256'] or received['receivedSha256']!=selected[0]['sha256'] or received['bytes']!=selected[0]['bytes'] or received_file.stat().st_size!=selected[0]['bytes'] or sha(received_file)!=selected[0]['sha256']:
            p.error('Received checkpoint must be the unchanged selected initial kingdom')
        home_input=received_file
        received_home=dict(report=str(received_report),reportSha256=sha(received_report),filename=str(received_file),sha256=sha(received_file),bytes=received_file.stat().st_size)
    canonical_state=native_state_stamps()
    run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-session-',dir=GAME/'build'))
    private_build=run/'native/recomp';(private_build/'mods').mkdir(parents=True)
    private_exe=private_build/'pop_smoke';copy(exe,private_exe);private_exe.chmod(0o755)
    if sha(private_exe)!=build['nativeExecutableSha256']:p.error('Private native executable differs')
    private_registry=run/'registry.json'
    world=run/('native-world-'+a.world);profile=world/'frontier_0_0';profile.mkdir(parents=True)
    for name,digest in inputs.items():
        if sha(original/name)!=digest:p.error('Original settings changed')
        copy(original/name,profile/name)
    source=profile/'Documents/My Games/MajestyHD/SaveGame/Frontier_0_0.GMP';copy(home_input,source)
    if sha(source)!=selected[0]['sha256']:p.error('Copied home changed')
    content='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+build['nativeExecutableSha256']
    initial='\n'.join(['checkpoint-v1','0',str(source.stat().st_size),sha(source),content,''])
    (profile/'Frontier_0_0.checkpoint').write_text(initial)
    orphan=world/'frontier_0_1/Documents/My Games/MajestyHD/SaveGame/Frontier_0_1_Recovery.GMP';orphan.parent.mkdir(parents=True);orphan.write_bytes(b'\0')
    vault=run/'symlink-vault';vault.mkdir();sentinel=vault/'preserve.txt';sentinel.write_text('Owned native test sentinel; no neighbor writes.\n')
    symlink=world/'frontier_0_-1';symlink.symlink_to(vault,target_is_directory=True)
    (run/'frames').mkdir();(run/'user-mods').mkdir()
    script=run/'session.script'
    # Majesty integrates relative counts. Pin both axes before positioning;
    # a stationary physical pointer normally keeps waking its input reader.
    if a.pan_route:
        pan='wait 4000\nfocus on\nmoveby -2000 -2000\nwait 100\nmoveby 400 300\nwait 100\n'
        # Reassert real relative input because the original loader recenters
        # the guest cursor. No camera/scroll field is written by this fixture.
        vectors={0:(-2000,0),1:(0,-2000),2:(0,2000),3:(2000,0)}
        for direction in directions[:-1]:
            dx,dy=vectors[direction]
            # Release the preceding edge on both axes before turning. Leaving
            # the pointer in a corner makes equal horizontal/vertical scroll
            # intent ambiguous to the original camera boundary sensor.
            pan+='moveby -2000 -2000\nmoveby 400 300\n'
            # Four turns must fit the host's 512 executable-step limit.
            # Waits advance its clock but do not consume executable steps.
            pan+=(f'moveby {dx} {dy}\nwait 400\n')*100
        pan+='moveby -2000 -2000\nmoveby 400 300\n'
        pan_ms=4200+40000*(len(route)-1)
    else:
        pan=('wait 4000\nfocus on\nwait 100\nmoveby -2000 -2000\nwait 100\nmoveby 0 300\n'+
             'moveby 0 0\nwait 200\n'*200+'moveby 400 0\n') if a.pan_first else ''
        pan_ms=44200 if a.pan_first else 0
    script_text=pan+f'wait {duration*1000-pan_ms}\ndump session_completed\n'
    if a.named_travel:
        script_text,duration,named_schedule=named_travel_script(directions)
    if a.named_checkpoint:
        # A request is allowed to expire while the original loader is busy.
        # Serial attempts cover the active route without extending the game
        # budget, holding a guest pointer or bypassing the production poll.
        request_count=min(16,(duration-4)//2)
        script_text='wait 1000\naction frontier-checkpoint\n'
        script_text+='wait 2000\naction frontier-checkpoint\n'*(request_count-1)
        script_text+=f'wait {duration*1000-(1+2*(request_count-1))*1000}\ndump session_completed\n'
    if sum(not line.startswith('wait ') for line in script_text.splitlines())>512:
        p.error('Generated input exceeds the native host executable-step bound')
    script.write_text(script_text)
    runner_source=run/'Session_Controller_Source.py';runner_source.write_bytes(RUNNER_SOURCE_AT_START)
    m=dict(version=1,phase='native-named-region-session',nativeOnly=True,browserUsed=False,
        buildReport=str(build_path),buildReportSha256=sha(build_path),nativeExecutableSha256=sha(exe),nativeSourceSha256=build['nativeSourceSha256'],
        nativeIsolationVersion='v1',nativeExecutable=str(private_exe),privateNativeDirectory=str(private_build),
        privateRegistry=str(private_registry),privateRegistryInitiallyAbsent=not private_registry.exists(),canonicalNativeStateBefore=canonical_state,
        runnerSha256=RUNNER_SHA_AT_START,runnerSourceCopy=str(runner_source),fixture=str(run),worldName=a.world,worldRoot=str(world),initialProfile=str(profile),initialManifest=initial,receivedHome=received_home,
        publicationManifest=str(publication),publicationManifestSha256=sha(publication),receipt=str(receipt),receiptSha256=sha(receipt),
        selectedRevisionExports=selected,originalSettings=str(original),inputHashes=inputs,content=content,
        stoppedSourceAdmission=stopped_source,
        orphan=str(orphan),orphanSha256=sha(orphan),symlink=str(symlink),symlinkSentinel=str(sentinel),symlinkSentinelSha256=sha(sentinel),route=route,directions=directions,
        baseRoute=base_route,routeLaps=a.laps,
        secondsPerVisit=a.seconds_per_visit,sessionBudgetSeconds=duration,deadlineSeconds=duration+65,
        namedCheckpointExpected=a.named_checkpoint,nativeNamedCheckpointQualified=False,
        namedTravelExpected=a.named_travel,nativeNamedTravelQualified=False,
        requestPublications=[],snapshotCaptures=[],readyCaptures=[],readyStateExpected=a.capture_ready_state,
        restorationBeforeCameraExpected=a.capture_before_camera,restoredCaptures=[],resourceSamples=[],log=str(log),script=str(script),
        observeCamera=a.observe_camera,panFirst=a.pan_first,cameraArrivalExpected=a.expect_camera_arrival,
        panRoute=a.pan_route,boundaryTriggers=[],
        queueObservationExpected=a.observe_queues,
        boundaryClampObservationExpected=a.observe_boundary_clamps,
        loadedKingdomBindingExpected=a.check_loaded_kingdom_binding,
        rebuildHoldExpected=a.check_rebuild_hold,
        preparedResumeExpected=a.prepared_resume,
        outdoorHeroExpected=a.await_outdoor_hero,outdoorHeroObservation=None,
        panInput='guest-mouse-edge' if a.pan_first else None,scriptSha256=sha(script),boundaryTrigger=None,
        nativeSessionTerminal=False,nativeExitCode=None,stopReason=None,rssCeilingBytes=512*1024*1024)
    flags={'PROFILE_DIR':str(profile),'REGISTRY':str(private_registry),'RULE_FRONTIER_REGION':'0_0','RULE_FRONTIER_RESTORE':'1','CONTENT_IDENTITY':content,
        'RULE_INVENTORY_COMPAT':'1','RULE_FRONTIER_SEEDED_GENERATION':'1','RULE_FRONTIER_CONNECTED_TERRAIN':'v1',
        'RULE_FRONTIER_SESSION':'v1','BROWSER_FRONTIER_SESSION_REQUEST_FIXTURE':'v1',
        'GUEST_ARGS':'-nointro -dochecksums','SMOKE_SECONDS':str(duration+10),'SMOKE_WINDOW_INPUT':'1','SMOKE_DRAWABLE':'800x600',
        'CORE_MODS_DIR':str(GAME/'build/recomp/mods/core'),'MODS_DIR':str(run/'user-mods'),'HOST_DUMP_DIR':str(run/'frames'),'SCRIPT':str(script)}
    if a.observe_camera:flags['RULE_FRONTIER_CROSSING']='v1'
    if a.named_travel:
        flags.pop('BROWSER_FRONTIER_SESSION_REQUEST_FIXTURE')
        named_helper=ROOT/'scripts/lib/named_travel_script.py'
        m.update(namedTravelSchedule=named_schedule,namedTravelHelperSha256=sha(named_helper),
                 requestFileFixtureEnabled=False)
    if a.capture_ready_state:flags['BROWSER_FRONTIER_SESSION_READY_SNAPSHOT_FIXTURE']='v1'
    if a.capture_before_camera:flags['BROWSER_FRONTIER_SESSION_CAMERA_SNAPSHOT_FIXTURE']='v1'
    if a.observe_queues:flags['BROWSER_FRONTIER_SESSION_QUEUE_OBSERVATION_FIXTURE']='v1'
    if a.observe_boundary_clamps:flags['BROWSER_FRONTIER_BOUNDARY_CLAMP_TRACE']='v1'
    if a.check_loaded_kingdom_binding:flags['BROWSER_COOP_LOADED_BINDING_FIXTURE']='v1'
    if a.check_rebuild_hold:flags['BROWSER_COOP_REBUILD_HOLD_FIXTURE']='v2' if a.prepared_resume else 'v1'
    # This headless producer publishes no physical-window layout. Exercise
    # its supported guest-coordinate host mouse path; window mapping and
    # browser pointer delivery remain separate, unqualified requirements.
    # The smoke flag is presence-based: even "0" selects physical mapping.
    if a.pan_first:flags.pop('SMOKE_WINDOW_INPUT')
    if a.pan_first:flags['BROWSER_FRONTIER_CAMERA_PROBE']='v1'
    if a.await_outdoor_hero:flags['BROWSER_FRONTIER_OUTDOOR_HERO_FIXTURE']='v1'
    env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')};env.update({'RECOMP_'+k:v for k,v in flags.items()});idle()
    request=world/'Session_Request.txt';sent=0;waiting=None;captured=set();ready_captured=set();restored_captured=set();probe=0;next_sample=0
    def publish(serial,key,direction,kind):
        text=f'session-request-v1\n{serial}\n{key}\n{direction}\n';temp=request.with_suffix('.tmp')
        with temp.open('x') as sink:sink.write(text);sink.flush();os.fsync(sink.fileno())
        temp.replace(request);m['requestPublications'].append(dict(serial=serial,source=key,direction=direction,kind=kind,sha256=hashlib.sha256(text.encode()).hexdigest(),publishedAtMs=time.time_ns()//1000000))
    if sha(Path(__file__))!=RUNNER_SHA_AT_START:raise RuntimeError('Runner changed during preflight; no native process launched')
    if stopped_source is not None and saved_source(a.stopped_source_report,GAME)!=stopped_source:
        raise RuntimeError('Stopped source admission changed before native launch')
    if native_state_stamps()!=canonical_state:raise RuntimeError('Canonical native state changed during preflight')
    if sha(private_exe)!=build['nativeExecutableSha256'] or private_registry.exists():raise RuntimeError('Private producer changed during preflight')
    producer_started=time.monotonic()
    with log.open('x') as output:
        proc=subprocess.Popen([str(private_exe)],cwd=GAME/'kit',env=env,stdout=output,stderr=subprocess.STDOUT,start_new_session=True)
        m.update(nativePid=proc.pid,startedAtMs=time.time_ns()//1000000);out.write_text(json.dumps(m,indent=2)+'\n')
        print(json.dumps({'nativePid':proc.pid,'fixture':run.name}),flush=True);deadline=time.monotonic()+duration+65;terminated_at=None
        try:
            while proc.poll() is None:
                now=time.monotonic();text=log.read_text()[-131072:]
                for serial,key,clock,x,y in re.findall(r'^\[frontier\] Session restored snapshot serial=(\d+) region=(-?\d+_-?\d+) clock=(\d+) before-arrival=1 ordinary-ticks=0 guards=0 world-same=1 hooks-same=1 camera-x=(\d+) camera-y=(\d+) saved=1$',text,re.M):
                    serial=int(serial)
                    if serial in restored_captured:continue
                    if not a.capture_before_camera or serial>=len(route) or route[serial]!=key:
                        raise RuntimeError('Unexpected before-camera snapshot')
                    selected_file=world/('frontier_'+key)/'Documents/My Games/MajestyHD/SaveGame'/f'Frontier_Restored_{serial}.GMP'
                    before_sha=sha(selected_file);capture=run/f'Session_Restored_{serial}.GMP';copy(selected_file,capture)
                    if sha(capture)!=before_sha or sha(selected_file)!=before_sha:raise RuntimeError('Restored snapshot changed during capture')
                    m['restoredCaptures'].append(dict(serial=serial,region=key,clock=int(clock),cameraX=int(x),cameraY=int(y),
                        sourceFile=str(selected_file),file=str(capture),sha256=before_sha,size=capture.stat().st_size));restored_captured.add(serial)
                for serial,key,clock in re.findall(r'^\[frontier\] Session ready snapshot serial=(\d+) region=(-?\d+_-?\d+) clock=(\d+) ordinary-ticks=0 guards=0 world-same=1 hooks-same=1 saved=1$',text,re.M):
                    serial=int(serial)
                    if serial in ready_captured:continue
                    marker=world/('frontier_'+key)/('Frontier_'+key+'.checkpoint');lines=marker.read_text().splitlines();slot=int(lines[1])
                    selected_file=world/('frontier_'+key)/'Documents/My Games/MajestyHD/SaveGame'/('Frontier_'+key+('_Recovery' if slot else '')+'.GMP')
                    capture=run/f'Session_Ready_{serial}.GMP';copy(selected_file,capture)
                    if sha(capture)!=lines[3] or sha(selected_file)!=lines[3]:raise RuntimeError('Ready snapshot changed during capture')
                    m['readyCaptures'].append(dict(serial=serial,region=key,clock=int(clock),slot=slot,manifest=marker.read_text(),file=str(capture),sha256=sha(capture),size=capture.stat().st_size));ready_captured.add(serial)
                for serial,key,clock,direction in re.findall(r'Session checkpoint serial=(\d+) region=(-?\d+_-?\d+) clock=(\d+) direction=(\d+)',text):
                    serial=int(serial)
                    if serial in captured:continue
                    marker=world/('frontier_'+key)/('Frontier_'+key+'.checkpoint');lines=marker.read_text().splitlines();slot=int(lines[1])
                    selected_file=world/('frontier_'+key)/'Documents/My Games/MajestyHD/SaveGame'/('Frontier_'+key+('_Recovery' if slot else '')+'.GMP')
                    capture=run/f'Session_Saved_{serial}.GMP';copy(selected_file,capture)
                    if sha(capture)!=lines[3] or sha(selected_file)!=lines[3]:raise RuntimeError('Snapshot changed during capture')
                    m['snapshotCaptures'].append(dict(serial=serial,region=key,clock=int(clock),direction=int(direction),slot=slot,manifest=marker.read_text(),file=str(capture),sha256=sha(capture),size=capture.stat().st_size));captured.add(serial)
                if a.named_travel:
                    while sent<len(route) and f'[frontier] Region {m["route"][sent]} ready' in text and (sent==0 or f'Session attached serial={sent} region={m["route"][sent]}' in text):
                        sent+=1
                if not a.named_travel and sent<len(route) and f'[frontier] Region {m["route"][sent]} ready' in text:
                    # A repeated kingdom must have the current attach event as well.
                    if sent==0 or f'Session attached serial={sent} region={m["route"][sent]}' in text:
                        if waiting is None:waiting=now
                if waiting is not None and sent==0:
                    if probe==0:publish(0,'0_0',0,'stale');probe=1
                    elif probe==1 and 'Session request refused region=0_0 serial=0' in text:publish(1,'0_0',2,'partial');probe=2
                    elif probe==2 and 'Session destination refused source=0_0 target=0_1' in text:publish(1,'1_0',0,'wrong-source');probe=3
                    elif probe==3 and text.count('Session request refused region=0_0 serial=0')>=2:publish(1,'0_0',1,'symlink');probe=4
                    elif probe==4 and 'Session destination refused source=0_0 target=0_-1' in text:probe=5
                if a.pan_first and sent==0 and m['boundaryTrigger'] is None:
                    match=re.search(r'^\[frontier\] Session boundary serial=0 region=0_0 direction=west gesture=([1-9][0-9]*) (.+)$',text,re.M)
                    if match:m['boundaryTrigger']=dict(line=match[0],observedAtMs=time.time_ns()//1000000)
                if a.pan_route and sent<len(route)-1 and len(m['boundaryTriggers'])==sent:
                    name=['west','north','south','east'][directions[sent]]
                    pattern=rf'^\[frontier\] Session boundary serial={sent} region={re.escape(m["route"][sent])} direction={name} gesture=([1-9][0-9]*) (.+)$'
                    match=re.search(pattern,text,re.M)
                    if match:m['boundaryTriggers'].append(dict(serial=sent,line=match[0],observedAtMs=time.time_ns()//1000000))
                if a.await_outdoor_hero and sent==0 and m['outdoorHeroObservation'] is None:
                    match=re.search(r'^\[streaming\] Session hero observed phase=outdoor serial=0 region=0_0 (.+)$',text,re.M)
                    if match:m['outdoorHeroObservation']=dict(line=match[0],observedAtMs=time.time_ns()//1000000)
                route_boundary=not a.pan_route or sent==len(route)-1 or len(m['boundaryTriggers'])==sent+1
                if waiting is not None and now-waiting>=1.5 and (sent>0 or probe==5) and route_boundary and (not a.pan_first or sent>0 or m['boundaryTrigger'] is not None) and (not a.await_outdoor_hero or sent>0 or m['outdoorHeroObservation'] is not None):
                    direction=directions[sent]
                    publish(sent+1,m['route'][sent],direction,'finish' if direction==4 else 'boundary' if a.pan_route or a.pan_first and sent==0 else 'travel');sent+=1;waiting=None
                if now>=next_sample:
                    next_sample=now+2
                    try:
                        fields=subprocess.check_output(['ps','-p',str(proc.pid),'-o','pid=,rss=,%cpu='],text=True,timeout=2).split()
                        if len(fields)!=3 or int(fields[0])!=proc.pid:raise RuntimeError('Missing native PID sample')
                        attached=re.findall(r'^\[frontier\] Session attached serial=(\d+) region=',text,re.M)
                        sample=dict(pid=proc.pid,rssBytes=int(fields[1])*1024,cpuPercent=float(fields[2]),
                            elapsedMs=int((now-producer_started)*1000),latestObservedAttachSerial=int(attached[-1]) if attached else 0)
                        m['resourceSamples'].append(sample)
                        if sample['rssBytes']>m['rssCeilingBytes'] and terminated_at is None:
                            m['stopReason']='rss-ceiling';proc.terminate();terminated_at=now
                    except (subprocess.SubprocessError,ValueError,RuntimeError):
                        if proc.poll() is None and terminated_at is None:
                            m['stopReason']='resource-observation-failed';proc.terminate();terminated_at=now
                if now>deadline and terminated_at is None:
                    m['stopReason']='time-ceiling';proc.terminate();terminated_at=now
                if terminated_at is not None and now-terminated_at>=5 and proc.poll() is None:proc.kill()
                try:proc.wait(timeout=.12)
                except subprocess.TimeoutExpired:pass
        except BaseException as error:
            m['stopReason']='controller-error';m['controllerError']=type(error).__name__
            if proc.poll() is None:
                proc.terminate()
                try:proc.wait(timeout=5)
                except subprocess.TimeoutExpired:proc.kill();proc.wait()
        code=proc.wait()
    completed=sent==len(route) and len(captured)==len(route)-(1 if a.named_travel else 0) and (not a.capture_ready_state or len(ready_captured)==len(route)) and (not a.capture_before_camera or len(restored_captured)==len(route)) and (not a.pan_first or m['boundaryTrigger'] is not None) and (not a.pan_route or len(m['boundaryTriggers'])==len(route)-1) and (not a.await_outdoor_hero or m['outdoorHeroObservation'] is not None)
    if a.named_travel:
        try:
            observation=verify_named_travel_log(log.read_text(errors='replace'),route,directions)
            if request.exists() or m['requestPublications'] or sha(named_helper)!=m['namedTravelHelperSha256']:
                raise RuntimeError('Named travel unexpectedly used request fixture or changed helper')
            marker=world/'frontier_0_0/Frontier_0_0.checkpoint';lines=marker.read_text().splitlines();slot=int(lines[1])
            selected_file=world/'frontier_0_0/Documents/My Games/MajestyHD/SaveGame'/('Frontier_0_0'+('_Recovery' if slot else '')+'.GMP')
            assert selected_file.stat().st_size==int(lines[2]) and sha(selected_file)==lines[3]
            final_copy=run/'Named_Travel_Final.GMP';copy(selected_file,final_copy)
            assert sha(final_copy)==lines[3]
            m['namedTravelFinalCheckpoint']=dict(file=str(final_copy),sha256=lines[3],bytes=final_copy.stat().st_size,slot=slot,manifest=marker.read_text())
            m['namedTravelObservation']=observation
            m['nativeNamedTravelQualified']=code==0 and completed and not m['stopReason']
            if not m['nativeNamedTravelQualified']:raise RuntimeError('Named travel did not finish cleanly')
        except (AssertionError,ValueError,IndexError,OSError,RuntimeError) as error:
            m['nativeNamedTravelQualified']=False;m['stopReason']=m['stopReason'] or 'named-travel-not-qualified'
            m['namedTravelError']=type(error).__name__+': '+str(error)
    if a.named_checkpoint:
        observed=log.read_text(errors='replace')
        queued=re.findall(r'^\[smoke\] named action frontier-checkpoint: queued$',observed,re.M)
        saved=re.findall(r'^\[frontier\] Region (-?\d+_-?\d+) checkpoint saved$',observed,re.M)
        refused=re.findall(r'^\[smoke\] named action frontier-checkpoint: refused$',observed,re.M)
        failed=re.findall(r'^\[frontier\] Region (-?\d+_-?\d+) checkpoint failed$',observed,re.M)
        m['namedCheckpointObservation']=dict(requestsQueued=len(queued),expectedRequests=request_count,
            checkpointsSaved=len(saved),savedRegions=saved,requestsRefused=len(refused),checkpointsFailed=len(failed))
        m['nativeNamedCheckpointQualified']=code==0 and completed and len(queued)==request_count and bool(saved) and not refused and not failed and not m['stopReason']
        if not m['nativeNamedCheckpointQualified']:m['stopReason']=m['stopReason'] or 'named-checkpoint-not-qualified'
    canonical_after=native_state_stamps()
    m.update(nativeSessionTerminal=True,nativeExitCode=code,nativeRouteCompleted=completed,finishedAtMs=time.time_ns()//1000000,logSha256=sha(log),
        canonicalNativeStateAfter=canonical_after,canonicalNativeStateUnchanged=canonical_after==canonical_state,
        privateNativeExecutableUnchanged=sha(private_exe)==build['nativeExecutableSha256'],
        publicationUnchanged=sha(publication)==m['publicationManifestSha256'],receiptUnchanged=sha(receipt)==m['receiptSha256'],
        originalWorldsUnchanged=all(sha(row['filename'])==row['sha256'] for row in selected),
        receivedHomeUnchanged=received_home is None or sha(Path(received_home['filename']))==received_home['sha256'],
        originalSettingsUnchanged=all(sha(original/name)==digest for name,digest in inputs.items()),orphanUnchanged=sha(orphan)==m['orphanSha256'],
        symlinkSentinelUnchanged=sha(sentinel)==m['symlinkSentinelSha256'])
    if not m['receivedHomeUnchanged']:m['stopReason']=m['stopReason'] or 'received-input-changed'
    if not m['canonicalNativeStateUnchanged'] or not m['privateNativeExecutableUnchanged']:m['stopReason']=m['stopReason'] or 'native-isolation-changed'
    if a.named_checkpoint or a.named_travel:
        preserved=all(m[name] for name in ('canonicalNativeStateUnchanged','privateNativeExecutableUnchanged',
            'publicationUnchanged','receiptUnchanged','originalWorldsUnchanged','originalSettingsUnchanged',
            'receivedHomeUnchanged','orphanUnchanged','symlinkSentinelUnchanged'))
        if not preserved:m['stopReason']=m['stopReason'] or 'named-checkpoint-input-changed'
        if a.named_checkpoint:m['nativeNamedCheckpointQualified']=m['nativeNamedCheckpointQualified'] and preserved and not m['stopReason']
        if a.named_travel:m['nativeNamedTravelQualified']=m['nativeNamedTravelQualified'] and preserved and not m['stopReason']
    out.write_text(json.dumps(m,indent=2)+'\n');print(json.dumps({'nativeSessionTerminal':True,'exitCode':code,'captured':len(captured),'sent':sent,'routeCompleted':completed}),flush=True);raise SystemExit(code or (1 if m['stopReason'] or not completed else 0))
if __name__=='__main__':main()

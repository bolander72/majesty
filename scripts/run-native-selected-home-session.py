#!/usr/bin/env python3
"""Retire the selected remote family, switch kingdoms, and resume home AI in one native process."""
import argparse,hashlib,importlib.util,json,os,re,struct,subprocess,tempfile,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];GAME=ROOT/'upstream/majesty-recomp'
spec=importlib.util.spec_from_file_location('selected_restore',ROOT/'scripts/run-native-selected-remote-home.py')
helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
sha,idle,copy=helper.sha,helper.idle,helper.copy
def read_json(path):
    if Path(path).stat().st_size>256*1024:raise RuntimeError('Oversized metadata')
    return json.loads(Path(path).read_text())
def check_archive(path,prefix):
    archive=read_json(path);directory=Path(archive['directory']).resolve()
    if not directory.is_relative_to(GAME/'build') or not directory.name.startswith(prefix) or not archive.get('artifactPreserved'):raise RuntimeError('Owned frozen producer required')
    if len(archive['sourceHashes'])!=20:raise RuntimeError('Frozen compiled sources missing')
    for n,h in archive['sourceHashes'].items():
        f=Path(archive['sources'][n]['filename'])
        if f!=directory/Path(n).name or sha(f)!=h:raise RuntimeError('Frozen compiled source changed')
    if Path(archive['nativeExecutable']['filename'])!=directory/'pop_smoke' or sha(directory/'pop_smoke')!=archive['nativeExecutable']['sha256']:raise RuntimeError('Frozen executable changed')
    return archive
def frozen(archive,path,expected=None):
    record=archive['evidence'][str(Path(path).resolve())]
    if (expected and record['sha256']!=expected) or sha(Path(path))!=record['sha256'] or sha(Path(record['filename']))!=record['sha256']:raise RuntimeError('Frozen input changed')
def main():
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['build_report','preparation','home_proof']:p.add_argument(n,type=Path)
    p.add_argument('--receiving-archive',type=Path,required=True);p.add_argument('--home-archive',type=Path,required=True)
    p.add_argument('--attempt',type=int,required=True);p.add_argument('--live-owner',action='store_true');p.add_argument('--fresh-home-import',action='store_true');p.add_argument('--interrupt-after-owner-commit',action='store_true');a=p.parse_args()
    if a.interrupt_after_owner_commit and not a.fresh_home_import:p.error('Interruption requires the fresh live import')
    if a.fresh_home_import and not a.live_owner:p.error('Fresh import requires the live owner gate')
    out=ROOT/f'output/native-selected-home-session-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
    if a.attempt<1 or out.exists() or log.exists():p.error('Use a fresh positive attempt')
    idle();build_path=a.build_report.resolve();build=read_json(build_path);exe=GAME/'build/recomp/pop_smoke'
    sources={n:h for g in ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256'] for n,h in build[g].items()}
    if not build.get('nativeBuildQualified') or build.get('exitCode')!=0 or len(sources)!=20 or any(sha(ROOT/n)!=h for n,h in sources.items()):p.error('Current official build required')
    if sha(exe)!=build['nativeExecutableSha256'] or sha(GAME/'build/recomp/gen/symbols.json')!=build['nativeSymbolsSha256']:p.error('Current executable/symbols required')
    prep_path=a.preparation.resolve();prep=read_json(prep_path);route=prep['route']
    if not prep.get('selectedRemoteHomePreparation') or prep['version']!=2 or route['ownerRevision']!=5 or [route['sourceRegion'],route['homeRegion']]!=['1_0','0_0']:p.error('Selected held owner required')
    if any(sha(ROOT/n)!=h for n,h in prep['sourceSha256'].items()) or sha(Path(prep['publication']))!=prep['publicationSha256']:p.error('Selected preparation changed')
    pub=read_json(prep['publication'])
    if pub['selectedManifest']!=prep['selectedManifest'] or pub['selectedState']!=prep['selectedState'] or pub['identity']!=prep['identity']:p.error('Selected owner changed')
    for record in prep['worlds']+prep['records']:
        if sha(Path(record['filename']))!=record['sha256'] or Path(record['filename']).stat().st_size!=record['bytes']:p.error('Prepared bytes changed')
    receiving_archive=check_archive(a.receiving_archive,'actor-arrival-fixture-outdoor-family-reload-generation-')
    if receiving_archive['sourceHashes']!=prep['compiledProducerSources'] or receiving_archive['nativeExecutable']['sha256']!=prep['compiledProducerExecutableSha256']:p.error('Wrong receiving producer')
    home_path=a.home_proof.resolve();home=read_json(home_path);home_archive=check_archive(a.home_archive,'actor-arrival-fixture-outdoor-family-return-generation-')
    frozen(home_archive,home_path)
    if not home.get('actualOutdoorFamilyHomeRestorationQualified') or not home.get('ordinaryGuildEntryQualified') or home_archive['nativeExecutable']['sha256']!=home['nativeExecutableSha256']:p.error('Original home restoration proof required')
    for n in [home['manifest'],home['reloadManifest']]:frozen(home_archive,n)
    for n,h in home['sourceSha256'].items():frozen(home_archive,ROOT/n,h)
    ready=home['worlds']['Ready'];frozen(home_archive,ready['filename'],ready['sha256'])
    if home['worlds']['Departed']['sha256']!=prep['worlds'][0]['sha256']:p.error('Restored home does not belong to selected dormant world')
    if [route['sourceClockMs'],prep['pauseAnchorClockMs']]!=[25300,24250]:p.error('Require actual selected saved/pause clocks')
    # Both existing native gates remain scoped to owned fixtures. Nest their
    # required paths; never enable them for an original player profile.
    run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-session-home-',dir=GAME/'build'))
    world=run/'actor-arrival-fixture-outdoor-family-snapshot-bridge'/'native-world-home';profiles={}
    content='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+build['nativeExecutableSha256']
    inputs=[]
    for region,record in [('1_0',prep['worlds'][1]),('0_0',prep['worlds'][0] if a.fresh_home_import else ready)]:
        profile=world/f'frontier_{region}';profile.mkdir(parents=True);profiles[region]=profile
        for n,h in prep['inputHashes'].items():
            original=Path(prep['settingsProfile'])/n
            if sha(original)!=h:p.error('Original settings changed')
            copy(original,profile/n)
        copied=profile/f'Documents/My Games/MajestyHD/SaveGame/Frontier_{region}.GMP';copy(Path(record['filename']),copied)
        marker=profile/f'Frontier_{region}.checkpoint'
        packet='\n'.join(['checkpoint-v1','0',str(copied.stat().st_size),sha(copied),content,'']);marker.write_text(packet)
        inputs.append(dict(region=region,source=record['filename'],sourceSha256=record['sha256'],copied=str(copied),initialManifest=packet))
    profile=profiles['1_0'];proposals=[]
    for record in prep['records']:
        target=profile/Path(record['filename']).name;copy(Path(record['filename']),target)
        proposals.append(dict(filename=str(target),sha256=sha(target),bytes=target.stat().st_size))
    hero,agent=route['owner']['unitId'],route['owner']['agentId'];identity=profile/'Family_Remote_Reload_Identity.bin'
    identity.write_bytes(struct.pack('<12I',0x314c4d46,2,25300,hero,hero+1,hero+2,hero+3,agent,45,24250,0,0))
    for n in ['frames','user-mods']:(run/n).mkdir()
    script=run/'home-session.script';script.write_text('wait 30000\ndump selected_home_session_completed\n')
    m=dict(version=1,phase='selected-home-native-session',nativeOnly=True,browserUsed=False,
        buildReport=str(build_path),buildReportSha256=sha(build_path),nativeExecutableSha256=sha(exe),nativeSymbolsSha256=build['nativeSymbolsSha256'],compiledSourceSha256=sources,
        preparation=str(prep_path),preparationSha256=sha(prep_path),homeProof=str(home_path),homeProofSha256=sha(home_path),
        receivingArchive=str(a.receiving_archive.resolve()),receivingArchiveSha256=sha(a.receiving_archive),homeArchive=str(a.home_archive.resolve()),homeArchiveSha256=sha(a.home_archive),
        fixture=str(run),worldRoot=str(world),profiles={k:str(v) for k,v in profiles.items()},inputs=inputs,proposals=proposals,
        reloadIdentity=dict(filename=str(identity),sha256=sha(identity),bytes=48),script=str(script),scriptSha256=sha(script),
        runnerSha256=sha(Path(__file__)),controllerDependencies={str(f.relative_to(ROOT)):sha(f) for f in [ROOT/'scripts/run-native-selected-remote-home.py',ROOT/'scripts/run-native-outdoor-round-trip-session.py',ROOT/'scripts/run-native-hero-return-pair-reload.py']},
        log=str(log),requestPublications=[],snapshotCaptures=[],resourceSamples=[],rssCeilingBytes=512*1024*1024,stopReason=None,nativeSessionTerminal=False,nativeExitCode=None)
    if a.live_owner:
        owner_dir=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-entity-revision-live-session-',dir=GAME/'build'))
        for source in Path(pub['fixture']).iterdir():
            if not source.is_file() or source.is_symlink():raise RuntimeError('Owned selected revision files required')
            copy(source,owner_dir/source.name)
        if len(list(owner_dir.iterdir()))!=8:raise RuntimeError('Unexpected selected revision layout')
        m['liveOwner']=dict(directory=str(owner_dir),nonce=hashlib.sha256(os.urandom(32)).hexdigest(),pausedCapture=None,negativeAcknowledgements=[],publication=None)
    if a.fresh_home_import:m['liveImport']=dict(preparation=None,records=[],saves=[])
    flags={'PROFILE_DIR':str(profile),'RULE_FRONTIER_REGION':'1_0','RULE_FRONTIER_RESTORE':'1','CONTENT_IDENTITY':content,
        'RULE_FRONTIER_SESSION':'v1','RULE_FRONTIER_SEEDED_GENERATION':'1','RULE_FRONTIER_CONNECTED_TERRAIN':'v1','RULE_INVENTORY_COMPAT':'1',
        'BROWSER_FRONTIER_SESSION_REQUEST_FIXTURE':'v1','BROWSER_STREAMING_OUTDOOR_FAMILY_SESSION_FIXTURE':'v1','BROWSER_STREAMING_OUTDOOR_FAMILY_FIXTURE':'v1','BROWSER_STREAMING_OUTDOOR_FAMILY_ROUTE_FIXTURE':'v1',
        'BROWSER_STREAMING_OUTDOOR_FAMILY_SNAPSHOT_FIXTURE':'1','BROWSER_STREAMING_OUTDOOR_FAMILY_SNAPSHOT_RELOAD':'1','GUEST_ARGS':'-nointro -dochecksums',
        'SMOKE_SECONDS':'40','SMOKE_DRAWABLE':'800x600','CORE_MODS_DIR':str(GAME/'build/recomp/mods/core'),'MODS_DIR':str(run/'user-mods'),
        'HOST_DUMP_DIR':str(run/'frames'),'SCRIPT':str(script)}
    if a.live_owner:flags.update(BROWSER_FRONTIER_OWNER_PAUSE_FIXTURE='v1',BROWSER_FRONTIER_OWNER_REVISION_FIXTURE_DIR=m['liveOwner']['directory'],BROWSER_FRONTIER_OWNER_PAUSE_NONCE=m['liveOwner']['nonce'])
    if a.fresh_home_import:flags.update(BROWSER_STREAMING_SESSION_HOME_IMPORT_FIXTURE='v1',BROWSER_STREAMING_OUTDOOR_FAMILY_RETURN_FIXTURE='1')
    env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')};env.update({'RECOMP_'+k:v for k,v in flags.items()});idle()
    request=world/'Session_Request.txt';sent=0;captured=set();home_ready=None;pause_since=None;ack_step=0
    def atomic_packet(path,packet):
        temporary=path.with_suffix('.tmp')
        with temporary.open('x') as writer:writer.write(packet);writer.flush();os.fsync(writer.fileno())
        temporary.replace(path)

    with log.open('x') as sink:
        proc=subprocess.Popen([str(exe)],cwd=GAME/'kit',env=env,stdout=sink,stderr=subprocess.STDOUT,start_new_session=True)
        m.update(nativePid=proc.pid,startedAtMs=time.time_ns()//1000000);out.write_text(json.dumps(m,indent=2)+'\n')
        print(json.dumps(dict(nativePid=proc.pid,phase=m['phase'])),flush=True);deadline=time.monotonic()+45;terminated=None;next_sample=0
        try:
            while proc.poll() is None:
                now=time.monotonic()
                with log.open('r') as reader:reader.seek(max(0,log.stat().st_size-131072));text=reader.read(131072)
                if sent==0 and '[streaming] Family route cleanup requests=0' in text:
                    if a.fresh_home_import and m['liveImport']['preparation'] is None:
                        out.write_text(json.dumps(m,indent=2)+'\n');fresh=run/'Fresh_Home_Import_Prepared.json'
                        result=subprocess.run(['node',str(ROOT/'scripts/prepare-native-session-home-import.mjs'),str(out),str(fresh)],cwd=ROOT,capture_output=True,text=True,timeout=12)
                        if result.returncode:raise RuntimeError('Fresh import preparation failed: '+result.stderr[-2000:])
                        if proc.poll() is not None:raise RuntimeError('Native exited during fresh preparation')
                        m['liveImport']['preparation']=dict(filename=str(fresh),sha256=sha(fresh),nativeAliveAfterPreparation=True)
                    action=(1,'1_0',0)
                elif sent==1 and ('[frontier] Owner resumed serial=1' if a.live_owner else '[frontier] Region 0_0 ready') in text:
                    if home_ready is None:home_ready=now
                    action=(2,'0_0',4) if now-home_ready>=1.5 else None
                elif sent==2 and 2 in captured:
                    if home_ready is None:home_ready=now
                    action=(3,'0_0',4) if now-home_ready>=1.5 else None
                else:action=None
                for serial,region,clock,direction in re.findall(r'Session checkpoint serial=(\d+) region=([01]_0) clock=(\d+) direction=([04])',text):
                    serial=int(serial)
                    if serial in captured:continue
                    marker=profiles[region]/f'Frontier_{region}.checkpoint';packet=marker.read_text();lines=packet.splitlines();slot=int(lines[1])
                    source=profiles[region]/'Documents/My Games/MajestyHD/SaveGame'/f'Frontier_{region}{"_Recovery" if slot else ""}.GMP'
                    dest=run/f'Session_Saved_{serial}_{region}.GMP';copy(source,dest)
                    if sha(dest)!=lines[3] or sha(source)!=lines[3]:raise RuntimeError('Checkpoint changed during capture')
                    m['snapshotCaptures'].append(dict(serial=serial,region=region,clock=int(clock),direction=int(direction),slot=slot,manifest=packet,filename=str(dest),sha256=sha(dest),bytes=dest.stat().st_size));captured.add(serial)
                    if serial==2:home_ready=now
                if a.live_owner and '[frontier] Owner paused serial=1' in text and 1 in captured:
                    live=m['liveOwner'];pause_file=world/'Owner_Pause.txt';pause_packet=pause_file.read_text();parts=pause_packet.splitlines()
                    if live['pausedCapture'] is None:
                        marker=profiles['0_0']/'Frontier_0_0.checkpoint';packet=marker.read_text();lines=packet.splitlines();slot=int(lines[1])
                        source=profiles['0_0']/'Documents/My Games/MajestyHD/SaveGame'/f'Frontier_0_0{"_Recovery" if slot else ""}.GMP'
                        dest=run/'Owner_Paused_0_0.GMP';copy(source,dest)
                        if sha(dest)!=parts[5] or sha(source)!=parts[5]:raise RuntimeError('Paused checkpoint changed')
                        live['pausedCapture']=dict(filename=str(dest),sha256=sha(dest),bytes=dest.stat().st_size,clock=int(parts[4]),manifest=packet,slot=slot)
                        live['pauseRequest']=dict(filename=str(pause_file),sha256=sha(pause_file),packet=pause_packet)
                        pause_since=now
                    if ack_step<2 and now-pause_since>=.4:
                        request_hash='0'*64 if ack_step==0 else sha(pause_file)
                        packet=f'native-owner-resume-v1\n{request_hash}\n'+('0'*64)+'\n6\n'+('0'*64)+'\n'
                        atomic_packet(world/'Owner_Resume.txt',packet);live['negativeAcknowledgements'].append(dict(kind=['wrong-request','unpublished-owner'][ack_step],packet=packet,publishedAtMs=time.time_ns()//1000000))
                        ack_step+=1;pause_since=now
                    elif ack_step==2 and now-pause_since>=.4:
                        out.write_text(json.dumps(m,indent=2)+'\n');receipt=run/'Paused_Owner_Publication.json'
                        # Native tick remains suspended; this supervised writer
                        # copies only immutable captured files into its owned store.
                        result=subprocess.run(['node',str(ROOT/'scripts/publish-native-paused-home-owner.mjs'),str(out),str(receipt)],cwd=ROOT,capture_output=True,text=True,timeout=12)
                        if result.returncode:raise RuntimeError('Paused publication failed: '+result.stderr[-2000:])
                        if proc.poll() is not None:raise RuntimeError('Native engine exited before acknowledgement')
                        publication=read_json(receipt)
                        if a.interrupt_after_owner_commit:
                            live['publication']=dict(filename=str(receipt),sha256=sha(receipt),nativeAliveAtDelivery=False,committedNativeAlive=True,interruptedAtMs=time.time_ns()//1000000)
                            live['acknowledgement']=None;m['intentionalOwnerInterruption']=True
                            m['stopReason']='intentional-interruption-after-owner-commit';proc.terminate();terminated=now;ack_step=3
                        else:
                            live['publication']=dict(filename=str(receipt),sha256=sha(receipt),nativeAliveAtDelivery=True,deliveredAtMs=time.time_ns()//1000000)
                            atomic_packet(world/'Owner_Resume.txt',publication['acknowledgement']);live['acknowledgement']=publication['acknowledgement'];ack_step=3
                if action:
                    serial,region,direction=action;packet=f'session-request-v1\n{serial}\n{region}\n{direction}\n';temporary=request.with_suffix('.tmp')
                    with temporary.open('x') as writer:writer.write(packet);writer.flush();os.fsync(writer.fileno())
                    temporary.replace(request);sent=serial
                    m['requestPublications'].append(dict(serial=serial,region=region,direction=direction,packet=packet,sha256=hashlib.sha256(packet.encode()).hexdigest()))
                if now>=next_sample:
                    next_sample=now+2
                    try:
                        row=subprocess.check_output(['ps','-p',str(proc.pid),'-o','pid=,rss=,%cpu='],text=True,timeout=2).split()
                        if len(row)!=3 or int(row[0])!=proc.pid:raise RuntimeError('Exact PID sample missing')
                        sample=dict(pid=proc.pid,sampledAtMs=time.time_ns()//1000000,rssBytes=int(row[1])*1024,cpuPercent=float(row[2]));m['resourceSamples'].append(sample)
                        if sample['rssBytes']>m['rssCeilingBytes']:m['stopReason']='rss-ceiling'
                    except (subprocess.SubprocessError,ValueError,RuntimeError):
                        if proc.poll() is None:m['stopReason']='resource-observation-failed'
                if now>deadline:m['stopReason']='time-ceiling'
                if m['stopReason'] and terminated is None:proc.terminate();terminated=now
                if terminated is not None and now-terminated>5:proc.kill()
                out.write_text(json.dumps(m,indent=2)+'\n')
                try:proc.wait(timeout=.12)
                except subprocess.TimeoutExpired:pass
        except BaseException as error:
            m['stopReason']='controller-error';m['controllerError']=type(error).__name__;m['controllerErrorDetail']=str(error)[-2500:]
            if proc.poll() is None:
                proc.terminate()
                try:proc.wait(timeout=5)
                except subprocess.TimeoutExpired:proc.kill();proc.wait()
        code=proc.wait()
    original_save=profile/'Documents/My Games/MajestyHD/SaveGame'
    m.update(nativeSessionTerminal=True,nativeExitCode=code,finishedAtMs=time.time_ns()//1000000,logSha256=sha(log),
        familySaves=[dict(filename=str(f),bytes=f.stat().st_size,sha256=sha(f)) for f in sorted(original_save.glob('Family_Remote_*.GMP'))],
        familyRecords=[dict(filename=str(f),bytes=f.stat().st_size,sha256=sha(f)) for f in sorted(profile.glob('Family_*'))],
        originalInputsUnchanged=all(sha(Path(r['source']))==r['sourceSha256'] for r in inputs),
        originalSettingsUnchanged=all(sha(Path(prep['settingsProfile'])/n)==h for n,h in prep['inputHashes'].items()),
        originalProposalsUnchanged=all(sha(Path(r['filename']))==r['sha256'] for r in prep['records']),selectedHomeSessionCompleted=captured=={1,2,3})
    if a.fresh_home_import:
        m['liveImport']['records']=[dict(filename=str(f),bytes=f.stat().st_size,sha256=sha(f)) for f in sorted(profiles['0_0'].glob('Family_*'))]
        m['liveImport']['saves']=[dict(filename=str(f),bytes=f.stat().st_size,sha256=sha(f)) for f in sorted((profiles['0_0']/'Documents/My Games/MajestyHD/SaveGame').glob('Family_Return_*.GMP'))]
    out.write_text(json.dumps(m,indent=2)+'\n');print(json.dumps(dict(nativeSessionTerminal=True,exitCode=code,captured=len(captured),stopReason=m['stopReason'])),flush=True)
    if a.interrupt_after_owner_commit and m.get('intentionalOwnerInterruption') and code==-15 and captured=={1}:raise SystemExit(0)
    raise SystemExit(code or (1 if m['stopReason'] or captured!={1,2,3} else 0))
if __name__=='__main__':main()

#!/usr/bin/env python3
"""Coordinate-driven travel through the committed pair and an authentically initialized third kingdom."""
import argparse, importlib.util, json, os, shutil, struct, subprocess, tempfile, time, re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'upstream/majesty-recomp'
spec = importlib.util.spec_from_file_location('hero_reload', ROOT / 'scripts/run-native-hero-return-pair-reload.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
sha, idle, verify = helper.sha, helper.idle, helper.verify

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('build_report', type=Path)
    p.add_argument('publication', type=Path)
    p.add_argument('receipt', type=Path)
    p.add_argument('third_initialization_proof', type=Path)
    p.add_argument('--attempt', type=int, required=True)
    p.add_argument('--fourth-initialization-proof', type=Path)
    p.add_argument('--coordinate-checkpoints', action='store_true', help='Use two digest-verified save slots per coordinate')
    p.add_argument('--checkpoint-fault-probe', action='store_true', help='Observe damaged destination refusal and ignore an empty inactive slot')
    p.add_argument('--release-idle-tiles', action='store_true', help='Trial original zero-reference TILE release and cache policy after original world disposal')
    p.add_argument('--capture-heap', action='store_true', help='Capture bounded allocator metadata at the existing original world boundaries')
    p.add_argument('--capture-page-context', action='store_true', help='Observe queue owners using the existing delegating allocation/free hooks')
    p.add_argument('--retire-orphan-queues', action='store_true', help='Native-only trial of original destruction for observed replaced recipient queues')
    a = p.parse_args()
    if a.checkpoint_fault_probe and (not a.coordinate_checkpoints or not a.fourth_initialization_proof):
        p.error('Checkpoint fault probe requires four kingdoms and coordinate checkpoints')
    if not a.capture_page_context or not a.retire_orphan_queues or a.release_idle_tiles: p.error('Auto trial requires heap/page context/queue retirement, excludes TILE release')
    if a.capture_page_context and not a.capture_heap: p.error('Page context requires bounded heap capture')
    if a.retire_orphan_queues and (not a.capture_page_context or a.release_idle_tiles): p.error('Queue retirement requires heap/page context and excludes TILE trials')
    out = ROOT / f'output/native-coordinate-multiway-attempt-{a.attempt:03}.json'
    log = out.with_suffix('.log')
    if a.attempt < 1 or out.exists() or log.exists(): p.error('Fresh positive attempt required')
    idle()
    publication, receipt, build_path = a.publication.resolve(), a.receipt.resolve(), a.build_report.resolve()
    pub, r, build = [json.loads(n.read_text()) for n in [publication, receipt, build_path]]
    if r['revisionReport'] != str(publication) or r['revisionReportSha256'] != sha(publication): p.error('Publication/export mismatch')
    selected = verify(receipt)
    third_proof_path=a.third_initialization_proof.resolve()
    third_proof=json.loads(third_proof_path.read_text())
    if not third_proof.get('qualified') or not third_proof.get('generatedNeighborInitializationQualified') or not third_proof.get('initializedRegionsReturnedWithoutStateChanges'):
        p.error('Require a qualified original third-kingdom initialization and warm return')
    for name,digest in third_proof['sourceSha256'].items():
        if sha(ROOT/name)!=digest:p.error('Third initialization inspector source changed')
    checked=json.loads(subprocess.check_output(['node','--input-type=module','-e',
        "import {verifyConnectedInitialization} from './scripts/check-native-connected-initialization.mjs'; console.log(JSON.stringify(await verifyConnectedInitialization(process.argv[1])))",third_proof['sourceManifest']],cwd=ROOT,text=True))
    if checked!=third_proof:p.error('Third initialization evidence changed')
    third=third_proof['visits'][2]['after']
    if third_proof['cycles'][2]['region']!='0_1' or third['clock']!=10000 or sha(third['filename'])!=third['sha256']:
        p.error('Require the actual initialized 0_1 warm publication')
    fourth = None
    fourth_proof_path = a.fourth_initialization_proof.resolve() if a.fourth_initialization_proof else None
    if fourth_proof_path:
        fourth_proof=json.loads(fourth_proof_path.read_text())
        if not fourth_proof.get('qualified') or not fourth_proof.get('initializedRegionsReturnedWithoutStateChanges'):
            p.error('Require qualified northern initialization and warm return')
        for name,digest in fourth_proof['sourceSha256'].items():
            if sha(ROOT/name)!=digest:p.error('Northern initialization inspector source changed')
        checked=json.loads(subprocess.check_output(['node','--input-type=module','-e',
            "import {verifyConnectedInitialization} from './scripts/check-native-connected-initialization.mjs'; console.log(JSON.stringify(await verifyConnectedInitialization(process.argv[1])))",fourth_proof['sourceManifest']],cwd=ROOT,text=True))
        if checked!=fourth_proof:p.error('Northern initialization evidence changed')
        fourth=fourth_proof['visits'][2]['after']
        if fourth_proof['cycles'][2]['region']!='0_-1' or fourth['clock']!=10000 or sha(fourth['filename'])!=fourth['sha256']:
            p.error('Require actual initialized 0_-1 warm publication')
    route=['0_0','0_-1','0_0','0_1','0_0','1_0','0_0','0_-1'] if fourth else ['0_0','0_1','0_0','1_0','0_0','0_1']
    sequence=[0,3,0,2,0,1,0,3] if fourth else [0,2,0,1,0,2]
    delays=[1600,2100,1600,2100,1600,2100,1600,2300] if fourth else [1600,2100,1600,2100,1600,2300]
    visit_count=len(route);smoke_seconds=55 if fourth else 45;script_wait=45000 if fourth else 35000
    if any(s['revision'] != 2 or s['owner']['region'] != '0_0' for s in selected): p.error('Require actual committed return revision2')
    exe = GAME / 'build/recomp/pop_smoke'
    if not build.get('nativeBuildQualified') or build['exitCode'] != 0 or sha(exe) != build['nativeExecutableSha256']: p.error('Current build differs')
    if any(sha(ROOT/n) != d for n,d in build['nativeSourceSha256'].items()): p.error('Build source differs')
    if sha(GAME/'build/recomp/gen/symbols.json') != build['nativeSymbolsSha256']: p.error('Build symbols differ')
    if a.capture_heap:
        expected = ['upstream/majesty-recomp/kit/runtime/memory.cpp', 'upstream/majesty-recomp/kit/runtime/memory.h',
                    'upstream/majesty-recomp/kit/runtime/tests/runtime_tests.cpp']
        runtime = build.get('nativeHeapRuntimeSourceSha256', {})
        if sorted(runtime) != expected or any(sha(ROOT/n) != d for n,d in runtime.items()): p.error('Heap runtime differs from the official build')
    audit_path = ROOT/'output/native-idle-tile-release-audit-002.json'
    if a.release_idle_tiles:
        audit = json.loads(audit_path.read_text())
        if not audit.get('qualified') or audit['originalExecutableSha256'] != '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542': p.error('Require pinned idle release audit')
        if audit['scriptSha256'] != sha(ROOT/'scripts/audit-native-idle-tile-array-release.py'): p.error('Idle release audit source changed')
    queue_audit_path = ROOT/'output/native-orphan-queue-retirement-layout-001-observed.json'
    if a.retire_orphan_queues:
        queue_audit = json.loads(queue_audit_path.read_text())
        if not queue_audit.get('qualified') or queue_audit['version'] != 4 or queue_audit['originalExecutableSha256'] != '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542': p.error('Require pinned original queue retirement audit')
        if queue_audit['scriptSha256'] != sha(ROOT/'scripts/audit-native-orphan-queue-retirement.py'): p.error('Queue retirement audit source changed')
    auto_audit_path = ROOT/'output/native-auto-region-load-layout-001-observed.json'
    auto_audit = json.loads(auto_audit_path.read_text())
    if not auto_audit.get('qualified') or auto_audit['originalExecutableSha256'] != '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542': p.error('Require pinned automatic-load audit')
    if auto_audit['scriptSha256'] != sha(ROOT/'scripts/audit-native-auto-region-load.py') or len(auto_audit['fragments']) != 6 or len(auto_audit['contradictoryInstructionControls']) != 9: p.error('Automatic-load audit changed')
    previous = [Path(pub['liveManifest']), Path(pub['departureManifest'])]
    producers = [json.loads(n.read_text()) for n in previous]
    if producers[0]['inputHashes'] != producers[1]['inputHashes']: p.error('Kingdom settings differ')
    original = Path(producers[0]['profile'])
    inputs = producers[0]['inputHashes']
    run = Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-connected-residency-', dir=GAME/'build'))
    profile = run/'frontier_0_0'; profile.mkdir()
    for n,d in inputs.items():
        target = profile/n
        if sha(original/n) != d: p.error('Settings source changed')
        target.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(original/n,target)
        if sha(target) != d: p.error('Copied settings differ')
    for side,s in enumerate(selected):
        for kind in ['Initial','Source']:
            target = profile/(f'Residency_Initial_{side}.GMP' if kind=='Initial' else f'Residency_Region_{side}_0.GMP'); shutil.copy2(s['filename'],target)
            if sha(target) != s['sha256']: p.error('Copied committed world differs')
    for name in ['Residency_Initial_0_1.GMP','Residency_Region_0_1.GMP']:
        shutil.copy2(third['filename'],profile/name)
        if sha(profile/name)!=third['sha256']:p.error('Copied third world differs')
    if fourth:
        for name in ['Residency_Initial_0_-1.GMP','Residency_Region_0_-1.GMP']:
            shutil.copy2(fourth['filename'],profile/name)
            if sha(profile/name)!=fourth['sha256']:p.error('Copied northern world differs')
    coordinate_checkpoints = []
    if a.coordinate_checkpoints:
        content = 'coordinate-v1:' + build['nativeExecutableSha256']
        for key in ['0_0','1_0','0_1'] + (['0_-1'] if fourth else []):
            source = profile/f'Residency_Region_{key}.GMP'
            marker = profile/f'Residency_Region_{key}.checkpoint'
            text = f'checkpoint-v1\n0\n{source.stat().st_size}\n{sha(source)}\n{content}\n'
            with marker.open('x') as f:f.write(text)
            coordinate_checkpoints.append(dict(region=key,manifest=text,manifestSha256=sha(marker)))
    fault = None
    if a.checkpoint_fault_probe:
        inactive=profile/'Residency_Region_0_-1_Recovery.GMP'
        with inactive.open('xb'):pass
        probe_original=profile/'Residency_Initial_0_1.GMP';damaged=profile/'Coordinate_Damaged_0_1.GMP'
        with probe_original.open('rb') as f,damaged.open('xb') as sink:
            at=0
            for chunk in iter(lambda:f.read(4096),b''):
                if at<=272<at+len(chunk):
                    modified=bytearray(chunk);modified[272-at]^=1;chunk=modified
                sink.write(chunk);at+=len(chunk)
            sink.flush();os.fsync(sink.fileno())
        if damaged.stat().st_size!=probe_original.stat().st_size or sha(damaged)==sha(probe_original):p.error('Invalid damaged-save probe')
        fault=dict(region='0_1',inactiveRegion='0_-1',inactiveFile=str(inactive),initialInactiveBytes=0,
                   original=str(probe_original),damaged=str(damaged),damagedSha256=sha(damaged),originalSha256=sha(probe_original),
                   changedOffset=272,changedXor=1,published=False,trailingRefusalObserved=False,observedRefusal=False,repaired=False)
    menu = profile/'Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP'
    menu.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(profile/'Residency_Region_0_0.GMP',menu)
    for n in ['frames','user-mods']: (run/n).mkdir()
    script = run/'coordinate-multiway.script'
    script.write_text(f'wait {script_wait}\ndump coordinate_multiway_completed\n')
    meta = dict(version=1,phase='coordinate-multiway',nativeOnly=True,browserUsed=False,nativeSessionTerminal=False,nativeExitCode=None,
        fixture=str(run),profile=str(profile),publicationManifest=str(publication),publicationManifestSha256=sha(publication),
        receipt=str(receipt),receiptSha256=sha(receipt),selectedRevisionExports=selected,previousManifests=list(map(str,previous)),previousManifestSha256=list(map(sha,previous)),
        settingsProfile=str(original),inputHashes=inputs,buildReport=str(build_path),buildReportSha256=sha(build_path),
        nativeExecutableSha256=sha(exe),nativeSourceSha256=build['nativeSourceSha256'],nativeSymbolsSha256=build['nativeSymbolsSha256'],
        script=str(script),scriptSha256=sha(script),log=str(log),resourceSamples=[],rssCeilingBytes=512*1024*1024,stopReason=None,
        loadSequence=sequence,completedTicksByVisit=[],regionRequestVersion='v2',coordinateRoute=route,requestDelaysMs=delays,requestPublications=[],readyPublications=[],smokeSeconds=smoke_seconds,thirdInitializationProof=str(third_proof_path),thirdInitializationProofSha256=sha(third_proof_path),thirdRegionInput=third,automaticRegionLoadVersion='v1',inputActions=0,automaticRegionLoadAudit=str(auto_audit_path),automaticRegionLoadAuditSha256=sha(auto_audit_path),runnerSha256=sha(Path(__file__)),
        idleTileReleaseVersion='v2' if a.release_idle_tiles else None)
    if fourth:
        meta.update(fourthInitializationProof=str(fourth_proof_path),fourthInitializationProofSha256=sha(fourth_proof_path),fourthRegionInput=fourth)
    if a.coordinate_checkpoints:
        meta.update(coordinateCheckpointVersion='v1',coordinateCheckpointContent=content,initialCoordinateCheckpoints=coordinate_checkpoints)
    if fault:meta['checkpointFaultProbe']=fault
    if a.release_idle_tiles:
        meta.update(idleTileReleaseAudit=str(audit_path),idleTileReleaseAuditSha256=sha(audit_path),idleTileGateVersion=1)
    if a.capture_heap:
        meta.update(worldHeapProbe=True,worldSurvivorProbe=True,worldAllocatorProbe=True,worldPageProbe=True,
                    nativeHeapRuntimeSourceSha256=runtime,heapMetadataMaximumBytes=40+8192*16)
    if a.capture_page_context: meta.update(worldPageContextProbe=True,worldPageOwnerVersion=1,worldPageRegistrationVersion=1)
    if a.retire_orphan_queues: meta.update(orphanQueueReleaseVersion='v1',orphanQueueReleaseAudit=str(queue_audit_path),orphanQueueReleaseAuditSha256=sha(queue_audit_path))
    if verify(receipt) != selected: p.error('Selected pair changed before launch')
    env = {k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')}
    env.update(RECOMP_PROFILE_DIR=str(profile),RECOMP_RULE_FRONTIER_REGION='0_0',RECOMP_RULE_INVENTORY_COMPAT='1',RECOMP_BROWSER_STREAMING_DEBUG='1',
        RECOMP_BROWSER_STREAMING_WORLD_RESIDENCY_FIXTURE='1',RECOMP_BROWSER_STREAMING_WORLD_PERSISTENCE_FIXTURE='1',
        RECOMP_BROWSER_STREAMING_CONNECTED_RESIDENCY_FIXTURE='v1',RECOMP_BROWSER_STREAMING_REGISTERED_HERO_RESIDENCY_FIXTURE='v1',
        RECOMP_BROWSER_STREAMING_WORLD_RESIDENCY_VISITS=str(visit_count),RECOMP_BROWSER_STREAMING_JOINT_DEPARTED_RELOAD_FIXTURE='1',RECOMP_BROWSER_STREAMING_JOINT_EVOLVED_CHECKPOINT_FIXTURE='1',
        RECOMP_BROWSER_STREAMING_AUTO_REGION_LOAD_FIXTURE='v1',RECOMP_BROWSER_STREAMING_REGION_REQUEST_FIXTURE='v2',
        RECOMP_GUEST_ARGS='-nointro -dochecksums',RECOMP_SMOKE_SECONDS=str(smoke_seconds),RECOMP_SMOKE_WINDOW_INPUT='1',RECOMP_SMOKE_DRAWABLE='800x600',
        RECOMP_CORE_MODS_DIR=str(GAME/'build/recomp/mods/core'),RECOMP_MODS_DIR=str(run/'user-mods'),RECOMP_HOST_DUMP_DIR=str(run/'frames'),RECOMP_SCRIPT=str(script))
    if a.release_idle_tiles:
        env.update(RECOMP_BROWSER_STREAMING_IDLE_TILE_RELEASE_FIXTURE='v2',
            RECOMP_BROWSER_STREAMING_WORLD_ALLOCATION_FIXTURE='1', RECOMP_BROWSER_STREAMING_WORLD_OWNER_FIXTURE='1')
    if a.capture_heap:
        env.update(RECOMP_BROWSER_STREAMING_WORLD_SURVIVOR_FIXTURE='1', RECOMP_BROWSER_STREAMING_WORLD_ALLOCATOR_FIXTURE='1',
            RECOMP_BROWSER_STREAMING_WORLD_HEAP_FIXTURE='1', RECOMP_BROWSER_STREAMING_WORLD_ALLOCATION_FIXTURE='1',
            RECOMP_BROWSER_STREAMING_WORLD_PAGE_FIXTURE='1')
    if a.capture_page_context: env['RECOMP_BROWSER_STREAMING_WORLD_PAGE_CONTEXT_FIXTURE'] = '1'
    if a.retire_orphan_queues: env['RECOMP_BROWSER_STREAMING_ORPHAN_QUEUE_RELEASE_FIXTURE'] = 'v1'
    if a.coordinate_checkpoints:
        env.update(RECOMP_BROWSER_STREAMING_COORDINATE_CHECKPOINT_FIXTURE='v1',
                   RECOMP_BROWSER_STREAMING_COORDINATE_CONTENT=build['nativeExecutableSha256'])
    idle()
    with log.open('x') as stream:
        proc = subprocess.Popen([str(exe)],cwd=GAME/'kit',env=env,stdout=stream,stderr=subprocess.STDOUT)
        meta.update(nativePid=proc.pid,startedAtMs=time.time_ns()//1000000);out.write_text(json.dumps(meta,indent=2)+'\n')
        print(json.dumps({'nativePid':proc.pid,'phase':'coordinate-multiway'}),flush=True);deadline=time.monotonic()+(60 if fourth else 50)
        ready_path=profile/'Region_Travel_Ready.bin';request_path=profile/'Region_Travel_Request.bin'
        waiting=None;sent=0;first_request=None;next_sample=0;malformed_sent=0
        fault_offset=0;fault_tail=''
        def replace_probe(source,target):
            temporary=target.with_suffix('.repair.tmp')
            with source.open('rb') as f,temporary.open('xb') as sink:
                for chunk in iter(lambda:f.read(4096),b''):sink.write(chunk)
                sink.flush();os.fsync(sink.fileno())
            os.replace(temporary,target)
        def publish(words,kind,extra=b''):
            raw=struct.pack('<9I',*words)+extra;temporary=request_path.with_suffix('.tmp')
            with temporary.open('wb') as f:f.write(raw);f.flush();os.fsync(f.fileno())
            os.replace(temporary,request_path)
            meta['requestPublications'].append(dict(kind=kind,words=list(words),extraBytes=len(extra),bytes=len(raw),sha256=helper.hashlib.sha256(raw).hexdigest(),publishedAtMs=time.time_ns()//1000000))
        while proc.poll() is None:
            now=time.monotonic()
            if waiting is None and sent<visit_count and ready_path.exists():
                raw=ready_path.read_bytes()
                if len(raw)==36:
                    words=struct.unpack('<9I',raw)
                    if words[0]==0x32565254 and words[1]==2 and words[2]==sent+1:
                        travel=list(words);target=meta['coordinateRoute'][sent if sent==visit_count-1 else sent+1]
                        travel[5],travel[6]=(int(v)&0xffffffff for v in target.split('_'));travel[8]=2 if sent==visit_count-1 else 1
                        waiting=(tuple(travel),now)
                        meta['readyPublications'].append(dict(words=list(words),sha256=helper.hashlib.sha256(raw).hexdigest(),observedAtMs=time.time_ns()//1000000))
                        if sent==0:
                            bad=list(travel);bad[2]=0;publish(bad,'stale-initial')
                        elif sent==1:publish(first_request,'duplicate-previous')
            if waiting is not None and sent==0 and malformed_sent<3 and now-waiting[1]>=.35*(malformed_sent+1):
                bad=list(waiting[0]);kind=['missing-neighbor','non-neighbor','trailing-byte'][malformed_sent]
                if malformed_sent==0:bad[5]=0xffffffff if fourth else 0;bad[6]=0 if fourth else 0xffffffff
                if malformed_sent==1:bad[5]=2;bad[6]=0
                publish(bad,kind,b'\0' if malformed_sent==2 else b'');malformed_sent+=1
            if fault:
                # Observe each failed request before replacing it. Bound every
                # log read and retained tail, without timing-only admission.
                with log.open('r') as reader:
                    reader.seek(fault_offset)
                    for _ in range(16):
                        chunk=reader.read(4096);fault_offset=reader.tell()
                        fault_tail=(fault_tail+chunk)[-8192:]
                        if re.search(r'World coordinate-request refused visit=0 serial=1 source=0_0 target=0_-1 .*exact=0 available=0 .*result=pass',fault_tail):
                            fault['trailingRefusalObserved']=True
                        if fault['published'] and re.search(r'World coordinate-request refused visit=0 serial=1 source=0_0 target=0_1 .*available=0 .*result=pass',fault_tail):
                            fault['observedRefusal']=True
                        if len(chunk)<4096:break
            if fault and waiting is not None and sent==0 and malformed_sent==3 and not fault['published'] and fault['trailingRefusalObserved'] and now-waiting[1]>=1.4:
                replace_probe(Path(fault['damaged']),profile/'Residency_Region_0_1.GMP')
                words=list(waiting[0]);words[5]=0;words[6]=1
                publish(words,'damaged-neighbor')
                fault.update(published=True,publishedAtMs=time.time_ns()//1000000)
            if fault and fault['observedRefusal'] and not fault['repaired']:
                request_path.unlink()
                replace_probe(Path(fault['original']),profile/'Residency_Region_0_1.GMP')
                if sha(profile/'Residency_Region_0_1.GMP')!=fault['originalSha256']:raise RuntimeError('Probe repair differs')
                fault.update(repaired=True,repairedAtMs=time.time_ns()//1000000)
            if waiting is not None and now-waiting[1]>=meta['requestDelaysMs'][sent]/1000 and (not fault or fault['repaired']):
                words=waiting[0];publish(words,'finish' if words[8]==2 else 'travel')
                if sent==0:first_request=words
                sent+=1;waiting=None
            if now<next_sample:
                try:proc.wait(timeout=.05)
                except subprocess.TimeoutExpired:pass
                continue
            next_sample=now+2
            try:
                row=subprocess.check_output(['ps','-p',str(proc.pid),'-o','pid=,rss=,%cpu='],text=True,timeout=2).split()
                if len(row)!=3 or int(row[0])!=proc.pid: raise RuntimeError('Exact PID sample missing')
                s=dict(pid=proc.pid,sampledAtMs=time.time_ns()//1000000,rssBytes=int(row[1])*1024,cpuPercent=float(row[2]));meta['resourceSamples'].append(s)
                if s['rssBytes']>meta['rssCeilingBytes']:meta['stopReason']='rss-ceiling'
                if time.monotonic()>deadline:meta['stopReason']='duration-ceiling'
            except (subprocess.SubprocessError,ValueError,RuntimeError) as e:
                if proc.poll() is None:meta['stopReason']=type(e).__name__
            if meta['stopReason']:proc.terminate()
            out.write_text(json.dumps(meta,indent=2)+'\n')
            try:proc.wait(timeout=.05)
            except subprocess.TimeoutExpired:
                if meta['stopReason']:proc.kill()
        code=proc.wait()
    meta['completedTicksByVisit']=[int(v) for v in re.findall(r'World coordinate-request accepted .*?completed-ticks=(\d+) ',log.read_text())]
    meta.update(nativeSessionTerminal=True,nativeExitCode=code,finishedAtMs=time.time_ns()//1000000,logSha256=sha(log),
        originalSettingsUnchanged=all(sha(original/n)==d for n,d in inputs.items()),
        originalSelectedWorldsUnchanged=all(sha(s['filename'])==s['sha256'] for s in selected),
        publicationUnchanged=sha(publication)==meta['publicationManifestSha256'],receiptUnchanged=sha(receipt)==meta['receiptSha256'],
        originalThirdKingdomUnchanged=sha(third['filename'])==third['sha256'],thirdInitializationProofUnchanged=sha(third_proof_path)==meta['thirdInitializationProofSha256'])
    if fourth:meta.update(originalFourthKingdomUnchanged=sha(fourth['filename'])==fourth['sha256'],fourthInitializationProofUnchanged=sha(fourth_proof_path)==meta['fourthInitializationProofSha256'])
    out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps({'nativeSessionTerminal':True,'nativeExitCode':code}),flush=True)
    raise SystemExit(code)
if __name__=='__main__':main()

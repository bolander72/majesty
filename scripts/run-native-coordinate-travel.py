#!/usr/bin/env python3
"""Coordinate-driven original region travel; refuse invalid destinations before original save/unload."""
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
    p.add_argument('--attempt', type=int, required=True)
    p.add_argument('--release-idle-tiles', action='store_true', help='Trial original zero-reference TILE release and cache policy after original world disposal')
    p.add_argument('--capture-heap', action='store_true', help='Capture bounded allocator metadata at the existing original world boundaries')
    p.add_argument('--capture-page-context', action='store_true', help='Observe queue owners using the existing delegating allocation/free hooks')
    p.add_argument('--retire-orphan-queues', action='store_true', help='Native-only trial of original destruction for observed replaced recipient queues')
    a = p.parse_args()
    if not a.capture_page_context or not a.retire_orphan_queues or a.release_idle_tiles: p.error('Auto trial requires heap/page context/queue retirement, excludes TILE release')
    if a.capture_page_context and not a.capture_heap: p.error('Page context requires bounded heap capture')
    if a.retire_orphan_queues and (not a.capture_page_context or a.release_idle_tiles): p.error('Queue retirement requires heap/page context and excludes TILE trials')
    out = ROOT / f'output/native-coordinate-travel-attempt-{a.attempt:03}.json'
    log = out.with_suffix('.log')
    if a.attempt < 1 or out.exists() or log.exists(): p.error('Fresh positive attempt required')
    idle()
    publication, receipt, build_path = a.publication.resolve(), a.receipt.resolve(), a.build_report.resolve()
    pub, r, build = [json.loads(n.read_text()) for n in [publication, receipt, build_path]]
    if r['revisionReport'] != str(publication) or r['revisionReportSha256'] != sha(publication): p.error('Publication/export mismatch')
    selected = verify(receipt)
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
    menu = profile/'Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP'
    menu.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(profile/'Residency_Region_0_0.GMP',menu)
    for n in ['frames','user-mods']: (run/n).mkdir()
    script = run/'coordinate-travel.script'
    script.write_text('wait 30000\ndump automatic_region_return_completed\n')
    meta = dict(version=1,phase='coordinate-travel',nativeOnly=True,browserUsed=False,nativeSessionTerminal=False,nativeExitCode=None,
        fixture=str(run),profile=str(profile),publicationManifest=str(publication),publicationManifestSha256=sha(publication),
        receipt=str(receipt),receiptSha256=sha(receipt),selectedRevisionExports=selected,previousManifests=list(map(str,previous)),previousManifestSha256=list(map(sha,previous)),
        settingsProfile=str(original),inputHashes=inputs,buildReport=str(build_path),buildReportSha256=sha(build_path),
        nativeExecutableSha256=sha(exe),nativeSourceSha256=build['nativeSourceSha256'],nativeSymbolsSha256=build['nativeSymbolsSha256'],
        script=str(script),scriptSha256=sha(script),log=str(log),resourceSamples=[],rssCeilingBytes=512*1024*1024,stopReason=None,
        loadSequence=[0,1,0,1],completedTicksByVisit=[],regionRequestVersion='v2',coordinateRoute=['0_0','1_0','0_0','1_0'],requestDelaysMs=[1600,2100,1600,2300],requestPublications=[],readyPublications=[],smokeSeconds=40,automaticRegionLoadVersion='v1',inputActions=0,automaticRegionLoadAudit=str(auto_audit_path),automaticRegionLoadAuditSha256=sha(auto_audit_path),runnerSha256=sha(Path(__file__)),
        idleTileReleaseVersion='v2' if a.release_idle_tiles else None)
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
        RECOMP_BROWSER_STREAMING_WORLD_RESIDENCY_VISITS='4',RECOMP_BROWSER_STREAMING_JOINT_DEPARTED_RELOAD_FIXTURE='1',RECOMP_BROWSER_STREAMING_JOINT_EVOLVED_CHECKPOINT_FIXTURE='1',
        RECOMP_BROWSER_STREAMING_AUTO_REGION_LOAD_FIXTURE='v1',RECOMP_BROWSER_STREAMING_REGION_REQUEST_FIXTURE='v2',
        RECOMP_GUEST_ARGS='-nointro -dochecksums',RECOMP_SMOKE_SECONDS='40',RECOMP_SMOKE_WINDOW_INPUT='1',RECOMP_SMOKE_DRAWABLE='800x600',
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
    idle()
    with log.open('x') as stream:
        proc = subprocess.Popen([str(exe)],cwd=GAME/'kit',env=env,stdout=stream,stderr=subprocess.STDOUT)
        meta.update(nativePid=proc.pid,startedAtMs=time.time_ns()//1000000);out.write_text(json.dumps(meta,indent=2)+'\n')
        print(json.dumps({'nativePid':proc.pid,'phase':'coordinate-travel'}),flush=True);deadline=time.monotonic()+45
        ready_path=profile/'Region_Travel_Ready.bin';request_path=profile/'Region_Travel_Request.bin'
        waiting=None;sent=0;first_request=None;next_sample=0;malformed_sent=0
        def publish(words,kind,extra=b''):
            raw=struct.pack('<9I',*words)+extra;temporary=request_path.with_suffix('.tmp')
            with temporary.open('wb') as f:f.write(raw);f.flush();os.fsync(f.fileno())
            os.replace(temporary,request_path)
            meta['requestPublications'].append(dict(kind=kind,words=list(words),extraBytes=len(extra),bytes=len(raw),sha256=helper.hashlib.sha256(raw).hexdigest(),publishedAtMs=time.time_ns()//1000000))
        while proc.poll() is None:
            now=time.monotonic()
            if waiting is None and sent<4 and ready_path.exists():
                raw=ready_path.read_bytes()
                if len(raw)==36:
                    words=struct.unpack('<9I',raw)
                    if words[0]==0x32565254 and words[1]==2 and words[2]==sent+1:
                        travel=list(words);travel[5]=1 if sent%2==0 else 0;travel[6]=0;travel[8]=2 if sent==3 else 1
                        if sent==3:travel[5]=words[3];travel[6]=words[4]
                        waiting=(tuple(travel),now)
                        meta['readyPublications'].append(dict(words=list(words),sha256=helper.hashlib.sha256(raw).hexdigest(),observedAtMs=time.time_ns()//1000000))
                        if sent==0:
                            bad=list(travel);bad[2]=0;publish(bad,'stale-initial')
                        elif sent==1:publish(first_request,'duplicate-previous')
            if waiting is not None and sent==0 and malformed_sent<3 and now-waiting[1]>=.35*(malformed_sent+1):
                bad=list(waiting[0]);kind=['missing-neighbor','non-neighbor','trailing-byte'][malformed_sent]
                if malformed_sent==0:bad[5]=0;bad[6]=1
                if malformed_sent==1:bad[5]=2;bad[6]=0
                publish(bad,kind,b'\0' if malformed_sent==2 else b'');malformed_sent+=1
            if waiting is not None and now-waiting[1]>=meta['requestDelaysMs'][sent]/1000:
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
        publicationUnchanged=sha(publication)==meta['publicationManifestSha256'],receiptUnchanged=sha(receipt)==meta['receiptSha256'])
    out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps({'nativeSessionTerminal':True,'nativeExitCode':code}),flush=True)
    raise SystemExit(code)
if __name__=='__main__':main()

#!/usr/bin/env python3
"""Recover a committed interrupted home in another process, without import/actor guards."""
import argparse,hashlib,importlib.util,json,os,re,subprocess,tempfile,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];GAME=ROOT/'upstream/majesty-recomp'
spec=importlib.util.spec_from_file_location('session_helper',ROOT/'scripts/run-native-hero-return-pair-reload.py')
helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
sha,idle,verify=helper.sha,helper.idle,helper.verify
def copy(source,target):
    target.parent.mkdir(parents=True,exist_ok=True)
    with source.open('rb') as reader,target.open('xb') as sink:
        for b in iter(lambda:reader.read(4096),b''):sink.write(b)
        sink.flush();os.fsync(sink.fileno())
def main():
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['build_report','publication','receipt']:p.add_argument(n,type=Path)
    p.add_argument('--attempt',type=int,required=True);a=p.parse_args()
    out=ROOT/f'output/native-interrupted-home-recovery-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
    if a.attempt<1 or out.exists() or log.exists():p.error('Use a fresh positive attempt')
    idle();build_path=a.build_report.resolve();build=json.loads(build_path.read_text());exe=GAME/'build/recomp/pop_smoke'
    groups=['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256']
    if not build.get('nativeBuildQualified') or build.get('exitCode')!=0 or sha(exe)!=build['nativeExecutableSha256']:p.error('Current official build required')
    sources={n:h for group in groups for n,h in build[group].items()}
    if len(sources)!=20 or any(sha(ROOT/n)!=h for n,h in sources.items()):p.error('Compiled source changed')
    if sha(GAME/'build/recomp/gen/symbols.json')!=build['nativeSymbolsSha256']:p.error('Compiled symbols changed')
    publication=a.publication.resolve();pub=json.loads(publication.read_text());receipt=a.receipt.resolve();r=json.loads(receipt.read_text())
    if pub.get('nativeInterruptedHomeCheckpointQualified') is not True or pub.get('originalEngineAcknowledgementDelivered') is not False:p.error('Require the committed interrupted home checkpoint')
    if r['revisionReport']!=str(publication) or r['revisionReportSha256']!=sha(publication):p.error('Publication/export mismatch')
    selected=verify(receipt)
    if any(s['revision']!=6 or s['owner']!=pub['selectedOwner'] for s in selected):p.error('Require actual selected revision6')
    preparation=Path(pub['sourcePreparation']);prep=json.loads(preparation.read_text())
    if sha(preparation)!=pub['sourcePreparationSha256']:p.error('Source preparation changed')
    producer=json.loads(Path(pub['nativeSessionManifest']).read_text())
    if producer['nativePid']<=0 or not producer['nativeSessionTerminal'] or producer['nativeExitCode']!=-15:p.error('Actual producer interruption required')
    original=Path(prep['settingsProfile']);inputs=prep['inputHashes']
    run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-session-recovery-',dir=GAME/'build'))
    world=run/'native-world-recovery';profile=world/'frontier_0_0';profile.mkdir(parents=True)
    for n,h in inputs.items():
        if sha(original/n)!=h:p.error('Original settings changed')
        copy(original/n,profile/n)
    source=profile/'Documents/My Games/MajestyHD/SaveGame/Frontier_0_0.GMP';copy(Path(selected[0]['filename']),source)
    if sha(source)!=selected[0]['sha256']:p.error('Copied selected home changed')
    content='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+build['nativeExecutableSha256']
    marker=profile/'Frontier_0_0.checkpoint';initial='\n'.join(['checkpoint-v1','0',str(source.stat().st_size),sha(source),content,'']);marker.write_text(initial)
    for n in ['frames','user-mods']:(run/n).mkdir()
    script=run/'session.script';script.write_text('wait 18000\ndump interrupted_home_recovery_completed\n')
    m=dict(version=1,phase='interrupted-home-ordinary-recovery',nativeOnly=True,browserUsed=False,
        buildReport=str(build_path),buildReportSha256=sha(build_path),nativeExecutableSha256=sha(exe),nativeSymbolsSha256=build['nativeSymbolsSha256'],
        compiledSourceSha256=sources,runnerSha256=sha(Path(__file__)),fixture=str(run),worldRoot=str(world),profile=str(profile),
        publication=str(publication),publicationSha256=sha(publication),receipt=str(receipt),receiptSha256=sha(receipt),selectedRevisionExports=selected,
        originalSettings=str(original),inputHashes=inputs,sourceCopy=str(source),sourceCopySha256=sha(source),initialManifest=initial,content=content,
        script=str(script),scriptSha256=sha(script),log=str(log),requestPublications=[],snapshotCaptures=[],resourceSamples=[],
        nativeSessionTerminal=False,nativeExitCode=None,stopReason=None,rssCeilingBytes=512*1024*1024,
        familyFixtureFlagsEnabled=False,nativeAgentOrCommandGuardsEnabled=False,producerNativePid=producer['nativePid'],readyCapture=None,
        verificationSourceSha256={str(f.relative_to(ROOT)):sha(f) for f in [ROOT/'scripts/export-native-entity-revision.mjs',ROOT/'scripts/lib/interrupted-home-checkpoint.mjs']})
    flags={'PROFILE_DIR':str(profile),'RULE_FRONTIER_REGION':'0_0','RULE_FRONTIER_RESTORE':'1','CONTENT_IDENTITY':content,
        'RULE_INVENTORY_COMPAT':'1','RULE_FRONTIER_SEEDED_GENERATION':'1','RULE_FRONTIER_CONNECTED_TERRAIN':'v1','RULE_FRONTIER_SESSION':'v1',
        'BROWSER_FRONTIER_SESSION_REQUEST_FIXTURE':'v1','BROWSER_FRONTIER_RECOVERY_SNAPSHOT_FIXTURE':'v1','GUEST_ARGS':'-nointro -dochecksums','SMOKE_SECONDS':'25',
        'SMOKE_WINDOW_INPUT':'1','SMOKE_DRAWABLE':'800x600','CORE_MODS_DIR':str(GAME/'build/recomp/mods/core'),
        'MODS_DIR':str(run/'user-mods'),'HOST_DUMP_DIR':str(run/'frames'),'SCRIPT':str(script)}
    env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')};env.update({'RECOMP_'+k:v for k,v in flags.items()});idle()
    request=world/'Session_Request.txt';sent=0;captured=set();waiting=None;next_sample=0
    with log.open('x') as output:
        proc=subprocess.Popen([str(exe)],cwd=GAME/'kit',env=env,stdout=output,stderr=subprocess.STDOUT,start_new_session=True)
        m.update(nativePid=proc.pid,startedAtMs=time.time_ns()//1000000);out.write_text(json.dumps(m,indent=2)+'\n')
        print(json.dumps({'nativePid':proc.pid,'fixture':run.name}),flush=True);deadline=time.monotonic()+30;terminated_at=None
        try:
            while proc.poll() is None:
                now=time.monotonic()
                with log.open('r') as reader:reader.seek(max(0,log.stat().st_size-131072));text=reader.read(131072)
                if m['readyCapture'] is None and '[frontier] Recovery ready snapshot region=0_0' in text:
                    line=re.search(r'Recovery ready snapshot region=0_0 clock=(\d+) ordinary-ticks=0 actor-guards=0 saved=1',text)
                    if not line:raise RuntimeError('Unqualified original readiness capture')
                    packet=marker.read_text();lines=packet.splitlines();slot=int(lines[1]);saved=profile/'Documents/My Games/MajestyHD/SaveGame'/('Frontier_0_0_Recovery.GMP' if slot else 'Frontier_0_0.GMP')
                    capture=run/'Recovered_Home_Ready.GMP';copy(saved,capture)
                    if sha(capture)!=lines[3] or sha(saved)!=lines[3]:raise RuntimeError('Original readiness checkpoint changed during copy')
                    m['readyCapture']=dict(clock=int(line[1]),slot=slot,manifest=packet,filename=str(capture),sha256=sha(capture),bytes=capture.stat().st_size)
                if waiting is None and sent==0 and '[frontier] Region 0_0 ready' in text:waiting=now
                for serial,clock in re.findall(r'Session checkpoint serial=(\d+) region=0_0 clock=(\d+) direction=4',text):
                    serial=int(serial)
                    if serial in captured:continue
                    lines=marker.read_text().splitlines();slot=int(lines[1]);saved=profile/'Documents/My Games/MajestyHD/SaveGame'/('Frontier_0_0_Recovery.GMP' if slot else 'Frontier_0_0.GMP')
                    capture=run/f'Session_Saved_{serial}.GMP';copy(saved,capture)
                    if sha(capture)!=lines[3] or sha(saved)!=lines[3]:raise RuntimeError('Checkpoint changed during capture')
                    m['snapshotCaptures'].append(dict(serial=serial,clock=int(clock),slot=slot,manifest=marker.read_text(),filename=str(capture),sha256=sha(capture),bytes=capture.stat().st_size));captured.add(serial);waiting=now
                if waiting is not None and now-waiting>=1.5 and sent<2 and sent==len(captured):
                    packet=f'session-request-v1\n{sent+1}\n0_0\n4\n';temporary=request.with_suffix('.tmp')
                    with temporary.open('x') as sink:sink.write(packet);sink.flush();os.fsync(sink.fileno())
                    temporary.replace(request);sent+=1;waiting=None
                    m['requestPublications'].append(dict(serial=sent,packet=packet,sha256=hashlib.sha256(packet.encode()).hexdigest()))
                if now>=next_sample:
                    next_sample=now+2
                    try:
                        row=subprocess.check_output(['ps','-p',str(proc.pid),'-o','pid=,rss=,%cpu='],text=True,timeout=2).split()
                        if len(row)!=3 or int(row[0])!=proc.pid:raise RuntimeError('Missing exact PID sample')
                        sample=dict(pid=proc.pid,rssBytes=int(row[1])*1024,cpuPercent=float(row[2]));m['resourceSamples'].append(sample)
                        if sample['rssBytes']>m['rssCeilingBytes']:m['stopReason']='rss-ceiling'
                    except (subprocess.SubprocessError,ValueError,RuntimeError):
                        if proc.poll() is None:m['stopReason']='resource-observation-failed'
                if now>deadline:m['stopReason']='time-ceiling'
                if m['stopReason'] and terminated_at is None:proc.terminate();terminated_at=now
                if terminated_at is not None and now-terminated_at>=5 and proc.poll() is None:proc.kill()
                try:proc.wait(timeout=.12)
                except subprocess.TimeoutExpired:pass
        except BaseException as error:
            m['stopReason']='controller-error';m['controllerError']=type(error).__name__;m['controllerErrorDetail']=str(error)[-2000:]
            if proc.poll() is None:
                proc.terminate()
                try:proc.wait(timeout=5)
                except subprocess.TimeoutExpired:proc.kill();proc.wait()
        code=proc.wait()
    m.update(nativeSessionTerminal=True,nativeExitCode=code,finishedAtMs=time.time_ns()//1000000,logSha256=sha(log),
        nativeInterruptedHomeRecoveryCompleted=len(captured)==2 and bool(m['readyCapture']),publicationUnchanged=sha(publication)==m['publicationSha256'],
        receiptUnchanged=sha(receipt)==m['receiptSha256'],originalWorldsUnchanged=all(sha(s['filename'])==s['sha256'] for s in selected),
        originalSettingsUnchanged=all(sha(original/n)==h for n,h in inputs.items()))
    out.write_text(json.dumps(m,indent=2)+'\n');print(json.dumps({'nativeSessionTerminal':True,'exitCode':code,'captured':len(captured),'stopReason':m['stopReason']}),flush=True)
    raise SystemExit(code or (1 if m['stopReason'] or len(captured)!=2 or not m['readyCapture'] else 0))
if __name__=='__main__':main()

#!/usr/bin/env python3
"""Original home -> unexplored neighbor -> saved home, one native process."""
import argparse, importlib.util, json, os, re, shutil, struct, subprocess, tempfile, time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];GAME=ROOT/'upstream/majesty-recomp'
spec=importlib.util.spec_from_file_location('hero_reload',ROOT/'scripts/run-native-hero-return-pair-reload.py')
helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
sha,idle,verify=helper.sha,helper.idle,helper.verify

def copy(source,target):
    target.parent.mkdir(parents=True,exist_ok=True)
    with source.open('rb') as reader,target.open('xb') as sink:
        for chunk in iter(lambda:reader.read(4096),b''):sink.write(chunk)
        sink.flush();os.fsync(sink.fileno())

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ['build_report','publication','receipt']:parser.add_argument(name,type=Path)
    parser.add_argument('--attempt',type=int,required=True)
    parser.add_argument('--visits',type=int,choices=[3,5],default=3);a=parser.parse_args()
    out=ROOT/f'output/native-coordinate-expansion-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
    if a.attempt<1 or out.exists() or log.exists():parser.error('Use a fresh positive attempt')
    idle();build_path=a.build_report.resolve();build=json.loads(build_path.read_text());exe=GAME/'build/recomp/pop_smoke'
    if not build.get('nativeBuildQualified') or build.get('exitCode')!=0 or sha(exe)!=build['nativeExecutableSha256']:parser.error('Current official build required')
    if any(sha(ROOT/name)!=digest for name,digest in build['nativeSourceSha256'].items()):parser.error('Compiled source changed')
    publication=a.publication.resolve();receipt=a.receipt.resolve();pub=json.loads(publication.read_text())
    selected=verify(receipt)
    if len(selected)!=2 or any(s['revision']!=2 or s['owner']['region']!='0_0' for s in selected):parser.error('Require committed return revision2')
    producer=Path(pub['liveManifest']);previous=json.loads(producer.read_text());original=Path(previous['profile'])
    run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-connected-residency-',dir=GAME/'build'))
    profile=run/'frontier_0_0';profile.mkdir();inputs=previous['inputHashes']
    for name,digest in inputs.items():
        if sha(original/name)!=digest:parser.error('Original settings changed')
        copy(original/name,profile/name)
    source=profile/'Residency_Region_0_0.GMP';copy(Path(selected[0]['filename']),source)
    if sha(source)!=selected[0]['sha256']:parser.error('Copied home changed')
    content='coordinate-v1:'+build['nativeExecutableSha256']
    initial_marker=f'checkpoint-v1\n0\n{source.stat().st_size}\n{sha(source)}\n{content}\n'
    (profile/'Residency_Region_0_0.checkpoint').write_text(initial_marker)
    copy(source,profile/'Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP')
    # A partial orphan is existing data, not unexplored territory.
    orphan=profile/'Residency_Region_0_1_Recovery.GMP';orphan.write_bytes(b'\0')
    absent=[profile/('Residency_Region_-1_0'+suffix) for suffix in ['.GMP','_Recovery.GMP','.checkpoint']]
    assert all(not p.exists() for p in absent)
    for directory in ['frames','user-mods']:(run/directory).mkdir()
    script=run/'coordinate-expansion.script';script.write_text('wait 35000\ndump coordinate_expansion_completed\n')
    m=dict(version=1,phase='coordinate-expansion',coordinateExpansionVersion='v1',nativeOnly=True,browserUsed=False,
        fixture=str(run),profile=str(profile),nativeSessionTerminal=False,nativeExitCode=None,stopReason=None,
        buildReport=str(build_path),buildReportSha256=sha(build_path),nativeExecutableSha256=sha(exe),
        nativeSourceSha256=build['nativeSourceSha256'],nativeSymbolsSha256=build['nativeSymbolsSha256'],
        publicationManifest=str(publication),publicationManifestSha256=sha(publication),receipt=str(receipt),receiptSha256=sha(receipt),
        selectedRevisionExports=selected,settingsProfile=str(original),inputHashes=inputs,
        initialHome=str(source),initialHomeSha256=sha(source),initialHomeMarker=initial_marker,coordinateCheckpointContent=content,
        unexploredRegion='-1_0',unexploredPaths=list(map(str,absent)),unexploredPathsAbsentBeforeLaunch=True,
        preservedOrphan=str(orphan),preservedOrphanSha256=sha(orphan),coordinateRoute=['0_0','-1_0','0_0'] if a.visits==3 else ['0_0','-1_0','0_0','-1_0','0_0'],
        requestPublications=[],readyPublications=[],resourceSamples=[],rssCeilingBytes=512*1024*1024,
        script=str(script),scriptSha256=sha(script),log=str(log),runnerSha256=sha(Path(__file__)),startedAtMs=None)
    env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')}
    flags={'PROFILE_DIR':str(profile),'RULE_FRONTIER_REGION':'0_0','RULE_INVENTORY_COMPAT':'1',
        'RULE_FRONTIER_SEEDED_GENERATION':'1','RULE_FRONTIER_CONNECTED_TERRAIN':'v1',
        'BROWSER_STREAMING_DEBUG':'1','BROWSER_STREAMING_WORLD_RESIDENCY_FIXTURE':'1',
        'BROWSER_STREAMING_WORLD_PERSISTENCE_FIXTURE':'1','BROWSER_STREAMING_CONNECTED_RESIDENCY_FIXTURE':'v1',
        'BROWSER_STREAMING_REGISTERED_HERO_RESIDENCY_FIXTURE':'v1','BROWSER_STREAMING_WORLD_RESIDENCY_VISITS':str(a.visits),
        'BROWSER_STREAMING_JOINT_DEPARTED_RELOAD_FIXTURE':'1','BROWSER_STREAMING_JOINT_EVOLVED_CHECKPOINT_FIXTURE':'1',
        'BROWSER_STREAMING_AUTO_REGION_LOAD_FIXTURE':'v1','BROWSER_STREAMING_REGION_REQUEST_FIXTURE':'v2',
        'BROWSER_STREAMING_COORDINATE_CHECKPOINT_FIXTURE':'v1','BROWSER_STREAMING_COORDINATE_CONTENT':build['nativeExecutableSha256'],
        'BROWSER_STREAMING_REGION_EXPANSION_FIXTURE':'v1','GUEST_ARGS':'-nointro -dochecksums','SMOKE_SECONDS':'45',
        'SMOKE_WINDOW_INPUT':'1','SMOKE_DRAWABLE':'800x600','CORE_MODS_DIR':str(GAME/'build/recomp/mods/core'),
        'MODS_DIR':str(run/'user-mods'),'HOST_DUMP_DIR':str(run/'frames'),'SCRIPT':str(script)}
    env.update({'RECOMP_'+k:v for k,v in flags.items()});idle()
    ready=profile/'Region_Travel_Ready.bin';request=profile/'Region_Travel_Request.bin'
    first=None;waiting=None;sent=0;probe=0;log_at=0;tail='';observed=set();next_sample=0
    def publish(words,kind):
        raw=struct.pack('<9I',*(v&0xffffffff for v in words));temporary=request.with_suffix('.tmp')
        with temporary.open('wb') as sink:sink.write(raw);sink.flush();os.fsync(sink.fileno())
        temporary.replace(request);m['requestPublications'].append(dict(kind=kind,words=list(words),sha256=helper.hashlib.sha256(raw).hexdigest(),publishedAtMs=time.time_ns()//1000000))
    with log.open('x') as output:
        proc=subprocess.Popen([str(exe)],cwd=GAME/'kit',env=env,stdout=output,stderr=subprocess.STDOUT)
        m.update(nativePid=proc.pid,startedAtMs=time.time_ns()//1000000);out.write_text(json.dumps(m,indent=2)+'\n')
        print(json.dumps({'nativePid':proc.pid,'fixture':run.name}),flush=True);deadline=time.monotonic()+100
        while proc.poll() is None:
            now=time.monotonic()
            if ready.is_file():
                raw=ready.read_bytes()
                if len(raw)==36:
                    words=struct.unpack('<9I',raw)
                    if words[0:2]==(0x32565254,2) and words[2]==sent+1 and waiting is None and sent<a.visits:
                        m['readyPublications'].append(dict(words=list(words),sha256=helper.hashlib.sha256(raw).hexdigest(),observedAtMs=time.time_ns()//1000000))
                        target=m['coordinateRoute'][sent+1] if sent<a.visits-1 else m['coordinateRoute'][sent]
                        travel=list(words);travel[5:7]=[int(v)&0xffffffff for v in target.split('_')];travel[8]=1 if sent<a.visits-1 else 2
                        waiting=(travel,now)
                        if sent==0:
                            first=travel;bad=list(travel);bad[2]=0;publish(bad,'stale')
            with log.open('r') as reader:
                reader.seek(log_at)
                for _ in range(16):
                    chunk=reader.read(4096);log_at=reader.tell();tail=(tail+chunk)[-8192:]
                    for label,pattern in [('stale',r'coordinate-request refused visit=0 serial=0 '),
                        ('partial',r'coordinate-request refused visit=0 serial=1 source=0_0 target=0_1 .*available=0 .*result=pass'),
                        ('non-neighbor',r'coordinate-request refused visit=0 serial=1 source=0_0 target=2_0 .*available=0 .*result=pass')]:
                        if re.search(pattern,tail):observed.add(label)
                    if len(chunk)<4096:break
            if waiting and sent==0:
                if probe==0 and 'stale' in observed:
                    bad=list(first);bad[5:7]=[0,1];publish(bad,'partial');probe=1
                elif probe==1 and 'partial' in observed:
                    bad=list(first);bad[5:7]=[2,0];publish(bad,'non-neighbor');probe=2
            if waiting and now-waiting[1]>=1.6 and (sent>0 or len(observed)==3):
                publish(waiting[0],'finish' if sent==a.visits-1 else 'travel');sent+=1;waiting=None
            if now>=next_sample:
                next_sample=now+2
                try:
                    fields=subprocess.check_output(['ps','-p',str(proc.pid),'-o','pid=,rss=,%cpu='],text=True,timeout=2).split()
                    if len(fields)!=3 or int(fields[0])!=proc.pid:raise RuntimeError('Missing native PID sample')
                    sample=dict(pid=proc.pid,rssBytes=int(fields[1])*1024,cpuPercent=float(fields[2]));m['resourceSamples'].append(sample)
                    if sample['rssBytes']>m['rssCeilingBytes']:m['stopReason']='native-rss-ceiling'
                except (subprocess.SubprocessError,ValueError,RuntimeError) as error:
                    if proc.poll() is None:m['stopReason']=type(error).__name__
                if now>deadline:m['stopReason']='native-duration-ceiling'
                out.write_text(json.dumps(m,indent=2)+'\n')
            if m['stopReason']:proc.terminate()
            try:proc.wait(timeout=.05)
            except subprocess.TimeoutExpired:pass
        code=proc.wait()
    text=log.read_text();m.update(nativeSessionTerminal=True,nativeExitCode=code,finishedAtMs=time.time_ns()//1000000,
        durationMs=time.time_ns()//1000000-m['startedAtMs'],logSha256=sha(log),actualProbeRefusals=sorted(observed),
        completedTicksByVisit=[int(n) for n in re.findall(r'World checkpoint completed visit=\d+ .*completed-ticks=(\d+) ',text)],
        publicationUnchanged=sha(publication)==m['publicationManifestSha256'],receiptUnchanged=sha(receipt)==m['receiptSha256'],
        originalSelectedWorldsUnchanged=all(sha(s['filename'])==s['sha256'] for s in selected),
        originalSettingsUnchanged=all(sha(original/name)==digest for name,digest in inputs.items()),
        orphanUnchanged=sha(orphan)==m['preservedOrphanSha256'])
    out.write_text(json.dumps(m,indent=2)+'\n');print(json.dumps({'nativeSessionTerminal':True,'nativeExitCode':code,'probes':sorted(observed)}),flush=True)
    raise SystemExit(code)

if __name__=='__main__':main()

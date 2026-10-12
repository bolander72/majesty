#!/usr/bin/env python3
"""Restore the actual selected held world with a distinct saved clock and pause anchor."""
import argparse,importlib.util,json,os,struct,subprocess,tempfile,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];GAME=ROOT/'upstream/majesty-recomp'
spec=importlib.util.spec_from_file_location('roundtrip',ROOT/'scripts/run-native-outdoor-round-trip-session.py')
helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
sha,idle,copy=helper.sha,helper.idle,helper.copy
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('build_report',type=Path);p.add_argument('preparation',type=Path)
    p.add_argument('--producer-archive',type=Path,required=True);p.add_argument('--attempt',type=int,required=True)
    a=p.parse_args();out=ROOT/f'output/native-selected-remote-home-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
    if a.attempt<1 or out.exists() or log.exists():p.error('Require a fresh positive attempt')
    idle();build_path=a.build_report.resolve();build=json.loads(build_path.read_text());exe=GAME/'build/recomp/pop_smoke'
    sources={n:h for g in ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256'] for n,h in build[g].items()}
    if not build.get('nativeBuildQualified') or build.get('exitCode')!=0 or len(sources)!=20 or any(sha(ROOT/n)!=h for n,h in sources.items()):p.error('Current official build required')
    if sha(exe)!=build['nativeExecutableSha256'] or sha(GAME/'build/recomp/gen/symbols.json')!=build['nativeSymbolsSha256']:p.error('Current executable/symbols required')
    prep_path=a.preparation.resolve();prep=json.loads(prep_path.read_text());route=prep['route']
    if prep.get('selectedRemoteHomePreparation') is not True or prep['version']!=2 or route['ownerRevision']!=5 or route['sourceRegion']!='1_0' or route['homeRegion']!='0_0':p.error('Require selected held owner preparation')
    if len(prep['worlds'])!=2 or len(prep['records'])!=2 or any(sha(ROOT/n)!=h for n,h in prep['sourceSha256'].items()):p.error('Preparation source changed')
    if sha(Path(prep['publication']))!=prep['publicationSha256']:p.error('Selected publication changed')
    publication=json.loads(Path(prep['publication']).read_text())
    if publication['selectedManifest']!=prep['selectedManifest'] or publication['selectedState']!=prep['selectedState'] or publication['identity']!=prep['identity']:p.error('Selected owner changed')
    archive_path=a.producer_archive.resolve();archive=json.loads(archive_path.read_text())
    archived=Path(archive['directory']).resolve()
    if not archived.is_relative_to(GAME/'build') or not archived.name.startswith('actor-arrival-fixture-outdoor-family-reload-generation-') or not archive.get('artifactPreserved'):p.error('Owned frozen producer required')
    if archive['sourceHashes']!=prep['compiledProducerSources'] or archive['nativeExecutable']['sha256']!=prep['compiledProducerExecutableSha256']:p.error('Wrong original producer generation')
    for n,h in archive['sourceHashes'].items():
        file=Path(archive['sources'][n]['filename'])
        if file.parent!=archived or sha(file)!=h:p.error('Frozen compiled producer source changed')
    if sha(Path(archive['nativeExecutable']['filename']))!=prep['compiledProducerExecutableSha256']:p.error('Frozen executable changed')
    for record in prep['worlds']+prep['records']:
        file=Path(record['filename'])
        if sha(file)!=record['sha256'] or file.stat().st_size!=record['bytes']:p.error('Prepared bytes changed')
    if prep['worlds'][1]['sha256']!=route['sourceWorld']['sha256'] or prep['worlds'][0]['sha256']!=route['homeWorld']['sha256']:p.error('Selected world copies differ')
    saved,pause=route['sourceClockMs'],prep['pauseAnchorClockMs']
    if [saved,pause]!=[25300,24250] or publication['homeRequest']['pauseAnchorClockMs']!=pause:p.error('Require exact selected saved/pause clocks')
    run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-outdoor-family-snapshot-',dir=GAME/'build'));profile=run/'frontier_1_0';profile.mkdir()
    for n,h in prep['inputHashes'].items():
        original=Path(prep['settingsProfile'])/n
        if sha(original)!=h:p.error('Original settings changed')
        copy(original,profile/n)
    source=Path(prep['worlds'][1]['filename']);copied=profile/'Documents/My Games/MajestyHD/SaveGame/Frontier_1_0.GMP';copy(source,copied)
    content='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+build['nativeExecutableSha256']
    marker=profile/'Frontier_1_0.checkpoint';marker.write_text('\n'.join(['checkpoint-v1','0',str(copied.stat().st_size),sha(copied),content,'']))
    proposals=[]
    for record in prep['records']:
        target=profile/Path(record['filename']).name;copy(Path(record['filename']),target)
        proposals.append(dict(filename=str(target),sha256=sha(target),bytes=target.stat().st_size))
    hero,agent=route['owner']['unitId'],route['owner']['agentId']
    identity=profile/'Family_Remote_Reload_Identity.bin'
    identity.write_bytes(struct.pack('<12I',0x314c4d46,2,saved,hero,hero+1,hero+2,hero+3,agent,45,pause,0,0))
    for n in ['frames','user-mods']:(run/n).mkdir()
    script=run/'selected-home.script';script.write_text('wait 20000\ndump selected_home_completed\n')
    m=dict(version=2,phase='selected-paused-remote-home-reload',nativeOnly=True,browserUsed=False,
        preparation=str(prep_path),preparationSha256=sha(prep_path),producerArchive=str(archive_path),producerArchiveSha256=sha(archive_path),
        buildReport=str(build_path),buildReportSha256=sha(build_path),nativeExecutableSha256=sha(exe),nativeSymbolsSha256=build['nativeSymbolsSha256'],
        compiledSourceSha256=sources,runnerSha256=sha(Path(__file__)),fixture=str(run),profile=str(profile),worldRoot=str(run),
        source=str(source),sourceCopy=str(copied),sourceCopySha256=sha(copied),proposals=proposals,
        reloadIdentity=dict(filename=str(identity),bytes=48,sha256=sha(identity)),savedClockMs=saved,pauseAnchorClockMs=pause,
        script=str(script),scriptSha256=sha(script),log=str(log),resourceSamples=[],rssCeilingBytes=512*1024*1024,
        stopReason=None,nativeSessionTerminal=False,nativeExitCode=None)
    flags={'PROFILE_DIR':str(profile),'RULE_FRONTIER_REGION':'1_0','RULE_FRONTIER_RESTORE':'1','CONTENT_IDENTITY':content,
        'RULE_FRONTIER_SESSION':'v1','RULE_INVENTORY_COMPAT':'1','BROWSER_STREAMING_OUTDOOR_FAMILY_FIXTURE':'v1',
        'BROWSER_STREAMING_OUTDOOR_FAMILY_ROUTE_FIXTURE':'v1','BROWSER_STREAMING_OUTDOOR_FAMILY_SNAPSHOT_FIXTURE':'1',
        'BROWSER_STREAMING_OUTDOOR_FAMILY_SNAPSHOT_RELOAD':'1','GUEST_ARGS':'-nointro -dochecksums','SMOKE_SECONDS':'30',
        'SMOKE_DRAWABLE':'800x600','CORE_MODS_DIR':str(GAME/'build/recomp/mods/core'),'MODS_DIR':str(run/'user-mods'),
        'HOST_DUMP_DIR':str(run/'frames'),'SCRIPT':str(script)}
    env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')};env.update({'RECOMP_'+k:v for k,v in flags.items()});idle()
    with log.open('x') as sink:
        proc=subprocess.Popen([str(exe)],cwd=GAME/'kit',env=env,stdout=sink,stderr=subprocess.STDOUT,start_new_session=True)
        m.update(nativePid=proc.pid,startedAtMs=time.time_ns()//1000000);out.write_text(json.dumps(m,indent=2)+'\n')
        print(json.dumps(dict(nativePid=proc.pid,phase=m['phase'])),flush=True);deadline=time.monotonic()+35;terminated=None
        try:
            while proc.poll() is None:
                try:
                    row=subprocess.check_output(['ps','-p',str(proc.pid),'-o','pid=,rss=,%cpu='],text=True,timeout=2).split()
                    if len(row)!=3 or int(row[0])!=proc.pid:raise RuntimeError('Exact PID sample missing')
                    sample=dict(pid=proc.pid,sampledAtMs=time.time_ns()//1000000,rssBytes=int(row[1])*1024,cpuPercent=float(row[2]));m['resourceSamples'].append(sample)
                    if sample['rssBytes']>m['rssCeilingBytes']:m['stopReason']='rss-ceiling'
                    if time.monotonic()>deadline:m['stopReason']='duration-ceiling'
                except (subprocess.SubprocessError,ValueError,RuntimeError) as e:
                    if proc.poll() is None:m['stopReason']=type(e).__name__
                if m['stopReason'] and terminated is None:proc.terminate();terminated=time.monotonic()
                if terminated is not None and time.monotonic()-terminated>5:proc.kill()
                out.write_text(json.dumps(m,indent=2)+'\n')
                try:proc.wait(timeout=2)
                except subprocess.TimeoutExpired:pass
        finally:
            if proc.poll() is None:
                proc.terminate()
                try:proc.wait(timeout=5)
                except subprocess.TimeoutExpired:proc.kill();proc.wait()
        code=proc.wait()
    saves=[dict(filename=str(f),bytes=f.stat().st_size,sha256=sha(f)) for f in sorted(copied.parent.glob('Family_Remote_*.GMP'))]
    m.update(nativeSessionTerminal=True,nativeExitCode=code,finishedAtMs=time.time_ns()//1000000,saves=saves,
        originalSourceUnchanged=sha(source)==prep['worlds'][1]['sha256'],sourceCopyUnchanged=sha(copied)==prep['worlds'][1]['sha256'],
        originalSettingsUnchanged=all(sha(Path(prep['settingsProfile'])/n)==h for n,h in prep['inputHashes'].items()),
        inputRecordsUnchanged=all(sha(Path(r['filename']))==r['sha256'] for r in prep['records']),logSha256=sha(log),
        records=[dict(filename=str(f),bytes=f.stat().st_size,sha256=sha(f)) for f in sorted(profile.glob('Family_*'))])
    out.write_text(json.dumps(m,indent=2)+'\n');print(json.dumps(dict(nativeSessionTerminal=True,exitCode=code,saves=len(saves),stopReason=m['stopReason'])),flush=True)
    raise SystemExit(code or (1 if m['stopReason'] or len(saves)!=3 else 0))
if __name__=='__main__':main()

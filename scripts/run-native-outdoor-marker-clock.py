#!/usr/bin/env python3
"""One guarded original ARH2 animation run on a copied outdoor kingdom."""
import argparse,hashlib,json,os,shutil,subprocess,tempfile,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];GAME=ROOT/'upstream/majesty-recomp'
def sha(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as f:
        for b in iter(lambda:f.read(4096),b''):h.update(b)
    return h.hexdigest()
def idle():
    rows=subprocess.check_output(['ps','-axo','pid=,comm='],text=True).splitlines()
    if any(Path(r.split(None,1)[1]).name in ['pop_smoke','clang','clang++','ninja'] for r in rows if len(r.split(None,1))==2):
        raise RuntimeError('Another native game/build is live')
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('build_report',type=Path);p.add_argument('preparation',type=Path)
    p.add_argument('--attempt',type=int,required=True);p.add_argument('--phase',choices=['baseline','rebased'],required=True);a=p.parse_args()
    out=ROOT/f'output/native-outdoor-marker-clock-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
    if a.attempt<1 or out.exists() or log.exists():p.error('Fresh positive attempt required')
    idle();prep_path=a.preparation.resolve();prep=json.loads(prep_path.read_text());build_path=a.build_report.resolve();build=json.loads(build_path.read_text())
    exe=GAME/'build/recomp/pop_smoke'
    if not build.get('nativeBuildQualified') or build['exitCode']!=0 or sha(exe)!=build['nativeExecutableSha256']:p.error('Current official native build required')
    for group in ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256']:
        if not build.get(group) or any(sha(ROOT/n)!=d for n,d in build[group].items()):p.error('Compiled source changed: '+group)
    if sha(GAME/'build/recomp/gen/symbols.json')!=build['nativeSymbolsSha256']:p.error('Build symbols changed')
    if not prep.get('outdoorMarkerClockPreparationQualified') or [prep['sourceClockMs'],prep['destinationClockMs']]!=[57650,24250]:p.error('Require actual effect preparation')
    if any(sha(ROOT/n)!=d for n,d in prep['sourceSha256'].items()) or sha(prep['sourceProof'])!=prep['sourceProofSha256']:p.error('Preparation changed')
    source=Path(prep['source']['filename'])
    if sha(source)!=prep['source']['sha256'] or source.stat().st_size!=prep['source']['bytes']:p.error('Original world changed')
    run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-outdoor-marker-clock-',dir=GAME/'build'))
    world=run/'native-world-outdoor-marker-clock';profile=world/'frontier_0_0';profile.mkdir(parents=True)
    for n,d in prep['inputHashes'].items():
        original=Path(prep['settingsProfile'])/n
        if sha(original)!=d:p.error('Original settings changed')
        dest=profile/n;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(original,dest)
        if sha(dest)!=d:p.error('Copied settings differ')
    copied=profile/'Documents/My Games/MajestyHD/SaveGame/Frontier_0_0.GMP';copied.parent.mkdir(parents=True);shutil.copy2(source,copied)
    content='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+build['nativeExecutableSha256']
    marker=profile/'Frontier_0_0.checkpoint';marker.write_text('\n'.join(['checkpoint-v1','0',str(copied.stat().st_size),sha(copied),content,'']))
    for effect in [prep]:
        original=Path(effect['orderPayload']['filename']);dest=profile/original.name
        if sha(original)!=effect['orderPayload']['sha256'] or original.stat().st_size!=208:p.error('Effect input changed')
        shutil.copy2(original,dest)
        if sha(dest)!=effect['orderPayload']['sha256']:p.error('Copied effect differs')
    for n in ['frames','user-mods']:(run/n).mkdir()
    script=run/'outdoor-marker.script';script.write_text('wait 12000\ndump outdoor_marker_clock_completed\n')
    meta=dict(version=1,nativeOnly=True,browserUsed=False,phase=a.phase,fixture=str(run),profile=str(profile),worldRoot=str(world),
        preparation=str(prep_path),preparationSha256=sha(prep_path),source=str(source),sourceSha256=sha(source),sourceCopy=str(copied),
        settingsProfile=prep['settingsProfile'],inputHashes=prep['inputHashes'],buildReport=str(build_path),buildReportSha256=sha(build_path),
        nativeExecutableSha256=sha(exe),nativeSourceSha256=build['nativeSourceSha256'],nativeHeapRuntimeSourceSha256=build['nativeHeapRuntimeSourceSha256'],
        nativeOrderRuntimeSourceSha256=build['nativeOrderRuntimeSourceSha256'],nativeSymbolsSha256=build['nativeSymbolsSha256'],
        runnerSha256=sha(Path(__file__)),script=str(script),scriptSha256=sha(script),log=str(log),resourceSamples=[],
        rssCeilingBytes=512*1024*1024,stopReason=None,nativeSessionTerminal=False,nativeExitCode=None)
    flags={'PROFILE_DIR':str(profile),'RULE_FRONTIER_REGION':'0_0','RULE_FRONTIER_RESTORE':'1','CONTENT_IDENTITY':content,
        'RULE_FRONTIER_SESSION':'v1','RULE_INVENTORY_COMPAT':'1','BROWSER_STREAMING_OUTDOOR_MARKER_CLOCK_FIXTURE':a.phase,
        'GUEST_ARGS':'-nointro -dochecksums','SMOKE_SECONDS':'25','SMOKE_DRAWABLE':'800x600',
        'CORE_MODS_DIR':str(GAME/'build/recomp/mods/core'),'MODS_DIR':str(run/'user-mods'),'HOST_DUMP_DIR':str(run/'frames'),'SCRIPT':str(script)}
    env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')};env.update({'RECOMP_'+k:v for k,v in flags.items()});idle()
    with log.open('x') as output:
        proc=subprocess.Popen([str(exe)],cwd=GAME/'kit',env=env,stdout=output,stderr=subprocess.STDOUT,start_new_session=True)
        meta.update(nativePid=proc.pid,startedAtMs=time.time_ns()//1000000);out.write_text(json.dumps(meta,indent=2)+'\n')
        print(json.dumps({'nativePid':proc.pid,'phase':a.phase}),flush=True);deadline=time.monotonic()+30;terminated_at=None
        try:
            while proc.poll() is None:
                try:
                    row=subprocess.check_output(['ps','-p',str(proc.pid),'-o','pid=,rss=,%cpu='],text=True,timeout=2).split()
                    if len(row)!=3 or int(row[0])!=proc.pid:raise RuntimeError('Exact PID sample missing')
                    sample=dict(pid=proc.pid,sampledAtMs=time.time_ns()//1000000,rssBytes=int(row[1])*1024,cpuPercent=float(row[2]));meta['resourceSamples'].append(sample)
                    if sample['rssBytes']>meta['rssCeilingBytes']:meta['stopReason']='rss-ceiling'
                    if time.monotonic()>deadline:meta['stopReason']='duration-ceiling'
                except (subprocess.SubprocessError,ValueError,RuntimeError) as e:
                    if proc.poll() is None:meta['stopReason']=type(e).__name__
                if meta['stopReason'] and terminated_at is None:proc.terminate();terminated_at=time.monotonic()
                if terminated_at is not None and time.monotonic()-terminated_at>5:proc.kill()
                out.write_text(json.dumps(meta,indent=2)+'\n')
                try:proc.wait(timeout=2)
                except subprocess.TimeoutExpired:pass
        finally:
            if proc.poll() is None:
                proc.terminate()
                try:proc.wait(timeout=5)
                except subprocess.TimeoutExpired:proc.kill();proc.wait()
        code=proc.wait()
    rows=[r for r in log.read_text().splitlines() if r.startswith('[streaming] Outdoor marker complete ')]
    completed=len(rows)==1 and all('result=pass' in r for r in rows)
    meta.update(nativeSessionTerminal=True,nativeExitCode=code,outdoorMarkerClockTrialCompleted=completed,finishedAtMs=time.time_ns()//1000000,
        originalSourceUnchanged=sha(source)==prep['source']['sha256'],sourceCopyUnchanged=sha(copied)==prep['source']['sha256'],
        originalSettingsUnchanged=all(sha(Path(prep['settingsProfile'])/n)==d for n,d in prep['inputHashes'].items()),
        proposalsUnchanged=all(sha(e['orderPayload']['filename'])==e['orderPayload']['sha256'] and sha(profile/Path(e['orderPayload']['filename']).name)==e['orderPayload']['sha256'] for e in [prep]),
        logSha256=sha(log),records=[dict(filename=str(f),bytes=f.stat().st_size,sha256=sha(f)) for f in sorted(profile.glob('Outdoor_Marker_*_*'))])
    out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps({'nativeSessionTerminal':True,'exitCode':code,'completed':completed}),flush=True)
    raise SystemExit(code or (1 if meta['stopReason'] or not completed else 0))
if __name__=='__main__':main()

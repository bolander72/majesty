#!/usr/bin/env python3
"""Restore the actual held outdoor family to its native home and observe ordinary guild entry."""
import argparse,hashlib,json,os,shutil,subprocess,tempfile,time,struct,re
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
    p.add_argument('--attempt',type=int,required=True);p.add_argument('--reload',type=Path);a=p.parse_args()
    out=ROOT/f'output/native-outdoor-family-return-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
    if a.attempt<1 or out.exists() or log.exists():p.error('Fresh positive attempt required')
    idle();prep_path=a.preparation.resolve();prep=json.loads(prep_path.read_text());build_path=a.build_report.resolve();build=json.loads(build_path.read_text())
    exe=GAME/'build/recomp/pop_smoke'
    if not build.get('nativeBuildQualified') or build['exitCode']!=0 or sha(exe)!=build['nativeExecutableSha256']:p.error('Current official native build required')
    for group in ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256']:
        if not build.get(group) or any(sha(ROOT/n)!=d for n,d in build[group].items()):p.error('Compiled source changed: '+group)
    if sha(GAME/'build/recomp/gen/symbols.json')!=build['nativeSymbolsSha256']:p.error('Build symbols changed')
    if not prep.get('outdoorFamilyPreparationQualified') or [prep['sourceClockMs'],prep['destinationClockMs']]!=[24250,57650]:p.error('Require actual effect preparation')
    if not prep.get('homeReturnPreparationQualified') or len(prep['records'])!=13:p.error('Require canonical remote-home preparation')
    if any(sha(ROOT/n)!=d for n,d in prep['sourceSha256'].items()) or sha(prep['sourceProof'])!=prep['sourceProofSha256']:p.error('Preparation changed')
    source=Path(prep['destination']['filename']);source_digest=prep['destination']['sha256'];parent=None;identity=None
    if sha(source)!=source_digest or source.stat().st_size!=prep['destination']['bytes']:p.error('Original world changed')
    if a.reload:
        parent_path=a.reload.resolve();parent=json.loads(parent_path.read_text())
        if not parent.get('nativeSessionTerminal') or parent['nativeExitCode']!=0 or not parent.get('outdoorFamilyTrialCompleted') or parent['phase']!='home-return-preparation':p.error('Require terminal native home preparation')
        if parent['preparationSha256']!=sha(prep_path) or parent['nativeExecutableSha256']!=sha(exe) or sha(parent['log'])!=parent['logSha256']:p.error('Native preparation changed')
        saved=[r for r in parent['saves'] if Path(r['filename']).name=='Family_Return_Ready.GMP']
        if len(saved)!=1:p.error('Require one native ready save')
        source=Path(saved[0]['filename']);source_digest=saved[0]['sha256']
        if sha(source)!=source_digest or source.stat().st_size!=saved[0]['bytes']:p.error('Ready world changed')
        rows=re.findall(r'^\[streaming\] Family return restored hero=(\d+) effects=(\d+),(\d+),(\d+) agent=(\d+) clock=57650 ',Path(parent['log']).read_text(),re.M)
        if len(rows)!=1:p.error('Missing actual native aliases')
        row=[int(n) for n in rows[0]];identity=struct.pack('<12I',0x314c5246,1,57650,*row[:4],row[4],469,7,0,0)
    run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-outdoor-family-return-',dir=GAME/'build'))
    world=run;profile=world/'frontier_0_0';profile.mkdir(parents=True)
    for n,d in prep['inputHashes'].items():
        original=Path(prep['settingsProfile'])/n
        if sha(original)!=d:p.error('Original settings changed')
        dest=profile/n;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(original,dest)
        if sha(dest)!=d:p.error('Copied settings differ')
    copied=profile/'Documents/My Games/MajestyHD/SaveGame/Frontier_0_0.GMP';copied.parent.mkdir(parents=True);shutil.copy2(source,copied)
    content='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+build['nativeExecutableSha256']
    marker=profile/'Frontier_0_0.checkpoint';marker.write_text('\n'.join(['checkpoint-v1','0',str(copied.stat().st_size),sha(copied),content,'']))
    proposals=[]
    for record in prep['records']:
        original=Path(record['filename']);dest=profile/original.name
        if sha(original)!=record['sha256'] or original.stat().st_size!=record['bytes']:p.error('Family input changed')
        shutil.copy2(original,dest)
        if sha(dest)!=record['sha256']:p.error('Copied family input differs')
        proposals.append(dict(source=str(original),copied=str(dest),sha256=record['sha256'],bytes=record['bytes']))
    for n in ['frames','user-mods']:(run/n).mkdir()
    script=run/'outdoor-family.script';script.write_text('wait 20000\ndump outdoor_family_completed\n')
    meta=dict(version=1,nativeOnly=True,browserUsed=False,phase="home-return-reload" if a.reload else "home-return-preparation",homeReturnFixture=True,proposals=proposals,fixture=str(run),profile=str(profile),worldRoot=str(world),
        preparation=str(prep_path),preparationSha256=sha(prep_path),source=str(source),sourceSha256=sha(source),sourceCopy=str(copied),
        settingsProfile=prep['settingsProfile'],inputHashes=prep['inputHashes'],buildReport=str(build_path),buildReportSha256=sha(build_path),
        nativeExecutableSha256=sha(exe),nativeSourceSha256=build['nativeSourceSha256'],nativeHeapRuntimeSourceSha256=build['nativeHeapRuntimeSourceSha256'],
        nativeOrderRuntimeSourceSha256=build['nativeOrderRuntimeSourceSha256'],nativeSymbolsSha256=build['nativeSymbolsSha256'],
        runnerSha256=sha(Path(__file__)),script=str(script),scriptSha256=sha(script),log=str(log),resourceSamples=[],
        rssCeilingBytes=512*1024*1024,stopReason=None,nativeSessionTerminal=False,nativeExitCode=None)
    if parent:
        meta.update(previousManifest=str(parent_path),previousManifestSha256=sha(parent_path))
        identity_path=profile/'Family_Return_Reload_Identity.bin';identity_path.write_bytes(identity)
        meta['reloadIdentity']=dict(filename=str(identity_path),bytes=48,sha256=sha(identity_path))
    flags={'PROFILE_DIR':str(profile),'RULE_FRONTIER_REGION':'0_0','RULE_FRONTIER_RESTORE':'1','CONTENT_IDENTITY':content,
        'RULE_FRONTIER_SESSION':'v1','RULE_INVENTORY_COMPAT':'1','BROWSER_STREAMING_OUTDOOR_FAMILY_FIXTURE':'v1','BROWSER_STREAMING_OUTDOOR_FAMILY_RETURN_FIXTURE':'1',
        'GUEST_ARGS':'-nointro -dochecksums','SMOKE_SECONDS':'30','SMOKE_DRAWABLE':'800x600',
        'CORE_MODS_DIR':str(GAME/'build/recomp/mods/core'),'MODS_DIR':str(run/'user-mods'),'HOST_DUMP_DIR':str(run/'frames'),'SCRIPT':str(script)}
    if parent:flags['BROWSER_STREAMING_OUTDOOR_FAMILY_RETURN_RELOAD']='1'
    env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')};env.update({'RECOMP_'+k:v for k,v in flags.items()});idle()
    with log.open('x') as output:
        proc=subprocess.Popen([str(exe)],cwd=GAME/'kit',env=env,stdout=output,stderr=subprocess.STDOUT,start_new_session=True)
        meta.update(nativePid=proc.pid,startedAtMs=time.time_ns()//1000000);out.write_text(json.dumps(meta,indent=2)+'\n')
        print(json.dumps({'nativePid':proc.pid,'phase':'home-return'}),flush=True);deadline=time.monotonic()+35;terminated_at=None
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
    rows=[r for r in log.read_text().splitlines() if r.startswith(('[streaming] Family return entered ' if a.reload else '[streaming] Family return prepared-cleanup '))]
    completed=len(rows)==1 and all('result=pass' in r for r in rows)
    meta.update(nativeSessionTerminal=True,nativeExitCode=code,outdoorFamilyTrialCompleted=completed,finishedAtMs=time.time_ns()//1000000,
        originalSourceUnchanged=sha(source)==source_digest,sourceCopyUnchanged=sha(copied)==source_digest,
        originalSettingsUnchanged=all(sha(Path(prep['settingsProfile'])/n)==d for n,d in prep['inputHashes'].items()),
        proposalsUnchanged=all(sha(e['source'])==e['sha256'] and sha(e['copied'])==e['sha256'] for e in proposals),donorUnchanged=sha(prep['source']['filename'])==prep['source']['sha256'],
        saves=[dict(filename=str(f),bytes=f.stat().st_size,sha256=sha(f)) for f in sorted((profile/'Documents/My Games/MajestyHD/SaveGame').glob('Family_Return_*.GMP'))],
        logSha256=sha(log),records=[dict(filename=str(f),bytes=f.stat().st_size,sha256=sha(f)) for f in sorted(profile.glob('Family_*'))])
    out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps({'nativeSessionTerminal':True,'exitCode':code,'completed':completed}),flush=True)
    raise SystemExit(code or (1 if meta['stopReason'] or not completed else 0))
if __name__=='__main__':main()

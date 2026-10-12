#!/usr/bin/env python3
"""Restore one registered guild projection in a generated region, in one isolated native engine."""
import argparse
import asyncio
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
from lib.native_pair_guard import owned_rows, stop_owned, stop_reason

ROOT=Path(__file__).resolve().parents[1]
GAME=ROOT/'upstream/majesty-recomp'
PIN='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
RUNNER_SHA=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()

def sha(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as stream:
        for b in iter(lambda:stream.read(4096),b''):h.update(b)
    return h.hexdigest()

def rows():
    raw=subprocess.check_output(['ps','-axo','pid=,ppid=,pgid=,rss=,comm='],text=True,timeout=3)
    result=[]
    for line in raw.splitlines():
        f=line.split(None,4)
        if len(f)==5:result.append(dict(pid=int(f[0]),parent=int(f[1]),group=int(f[2]),rssBytes=int(f[3])*1024,program=Path(f[4]).name))
    return result

def idle():
    if any(r['program'] in ['pop_smoke','clang','clang++','ninja','cmake','wasm-opt','wasm-ld'] for r in rows()):
        raise RuntimeError('Another native game/build is live')

def stamp(path):
    path=Path(path)
    if path.is_symlink():raise RuntimeError('Preserved native path is a symlink')
    if not path.exists():return None
    st=path.stat();return dict(sha256=sha(path),bytes=st.st_size,inode=st.st_ino,mtimeNs=st.st_mtime_ns)

def baseline():
    files=[GAME/'build/recomp'/n for n in ['registry.json','mods/run.json']]
    files.extend(GAME/'build/web-site/majesty'/n for n in ['MajestyRecomp.wasm','MajestyRecomp.js','MajestyRecomp.data','index.html'])
    return {str(p):stamp(p) for p in files}

def copy(source,destination):
    destination.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,destination)
    if sha(source)!=sha(destination):raise RuntimeError('Copied native input differs')

def bounded_json(path):
    if Path(path).stat().st_size>256*1024:raise RuntimeError('Manifest exceeds bound')
    return json.loads(Path(path).read_text())

async def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('build_report',type=Path);p.add_argument('preparation',type=Path)
    p.add_argument('--attempt',type=int,required=True);p.add_argument('--reload-from',type=Path)
    a=p.parse_args();out=ROOT/f'output/native-regional-home-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
    if a.attempt<1 or out.exists() or log.exists():p.error('Use a fresh positive attempt')
    idle();build_path=a.build_report.resolve();build=bounded_json(build_path);exe=GAME/'build/recomp/pop_smoke'
    sources={}
    for group in ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256']:
        for name,digest in build[group].items():
            if name in sources:p.error('Overlapping compiled provenance')
            sources[name]=digest
    if not build.get('nativeBuildQualified') or build['exitCode']!=0 or len(sources)!=53 or any(sha(ROOT/n)!=h for n,h in sources.items()):
        p.error('Current complete official native build required')
    if sha(exe)!=build['nativeExecutableSha256'] or sha(GAME/'build/recomp/gen/symbols.json')!=build['nativeSymbolsSha256']:
        p.error('Native executable or symbols changed')
    if sha(GAME/'original/gog/MajestyHD - Old.exe')!=PIN:p.error('Pinned original executable changed')
    prep_path=a.preparation.resolve();prep=bounded_json(prep_path)
    if not prep.get('realFileSeedAndSaveQualified') or prep.get('nativeProcessesStarted')!=0 or prep.get('browserUsed') or prep.get('goalComplete'):
        p.error('Require stopped original checkpoint/projection preparation')
    if any(sha(ROOT/n)!=h for n,h in prep['sourceSha256'].items()):p.error('Preparation source changed')
    if sha(prep['manifest'])!=prep['manifestSha256']:p.error('Original native manifest changed')
    original=bounded_json(prep['manifest']);region=prep['projection']['plan']['destinationRegion']
    if region=='0_0' or len(region)>24 or region!='_'.join(str(int(n)) for n in region.split('_')):p.error('Canonical remote region required')
    source_info=next(r for r in original['snapshotCaptures'] if r['region']==region)
    source=Path(source_info['file']);proposal=Path(prep['projection']['filename']);phase='create';previous=None
    if a.reload_from:
        previous=a.reload_from.resolve();verified=bounded_json(previous)
        if not verified.get('regionalHomeFullSaveQualified') or verified['phase']!='create' or verified['preparation']!=str(prep_path):
            p.error('Require the qualified first original-world save for this projection')
        if sha(verified['sourceManifest'])!=verified['sourceManifestSha256']:p.error('Prior native manifest changed')
        source=Path(verified['savedWorld']['filename']);proposal=Path(verified['observedRecord']['filename']);phase='reload'
        if sha(source)!=verified['savedWorld']['sha256'] or sha(proposal)!=verified['observedRecord']['sha256']:p.error('Qualified reload inputs changed')
    elif sha(source)!=source_info['sha256'] or sha(proposal)!=prep['projection']['plan']['recordSha256']:
        p.error('Original generated region or projection changed')
    source_hash,proposal_hash=sha(source),sha(proposal)
    if proposal.stat().st_size!=453:p.error('Require bounded original nine-attribute projection')
    settings=Path(original['originalSettings']);settings_hashes=original['inputHashes']
    if not isinstance(settings_hashes,dict) or any(sha(settings/n)!=h for n,h in settings_hashes.items()):p.error('Original settings changed')
    before=baseline();run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-hero-route-runtime-',dir=GAME/'build'))
    private=run/'native/recomp';(private/'mods').mkdir(parents=True);private_exe=private/'pop_smoke';copy(exe,private_exe);private_exe.chmod(0o755)
    world=run/'native-world-hero-route';profile=world/('frontier_'+region);profile.mkdir(parents=True)
    for name in settings_hashes:copy(settings/name,profile/name)
    copied=profile/f'Documents/My Games/MajestyHD/SaveGame/Frontier_{region}.GMP';copy(source,copied)
    content=PIN+':'+build['nativeExecutableSha256'];marker=profile/f'Frontier_{region}.checkpoint'
    marker.write_text('\n'.join(['checkpoint-v1','0',str(copied.stat().st_size),source_hash,content,'']))
    proposal_copy=profile/'Remote_Home_Proposal.GPL';copy(proposal,proposal_copy)
    for name in ['frames','user-mods']:(run/name).mkdir()
    script=run/'regional-home.script';script.write_text('wait 12000\naction frontier-checkpoint\nwait 4000\ndump regional_home_saved\nwait 2000\n')
    registry=run/'registry.json'
    flags={'PROFILE_DIR':str(profile),'REGISTRY':str(registry),'RULE_FRONTIER_REGION':region,'RULE_FRONTIER_RESTORE':'1',
        'CONTENT_IDENTITY':content,'RULE_INVENTORY_COMPAT':'1','RULE_FRONTIER_SEEDED_GENERATION':'1',
        'RULE_FRONTIER_CONNECTED_TERRAIN':'v1','RULE_FRONTIER_SESSION':'v1','BROWSER_STREAMING_DEBUG':'1',
        'BROWSER_STREAMING_REMOTE_HOME_FIXTURE':'region-'+phase,'GUEST_ARGS':'-nointro -dochecksums',
        'SMOKE_SECONDS':'25','SMOKE_WINDOW_INPUT':'1','SMOKE_DRAWABLE':'800x600',
        'CORE_MODS_DIR':str(GAME/'build/recomp/mods/core'),'MODS_DIR':str(run/'user-mods'),
        'HOST_DUMP_DIR':str(run/'frames'),'SCRIPT':str(script)}
    env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')};env.update({'RECOMP_'+k:v for k,v in flags.items()})
    if sha(Path(__file__))!=RUNNER_SHA or baseline()!=before or registry.exists():raise RuntimeError('Isolation preflight changed')
    m=dict(version=1,phase=phase,region=region,nativeOnly=True,browserUsed=False,fixture=str(run),profile=str(profile),
        privateNativeExecutable=str(private_exe),privateRegistry=str(registry),nativeExecutableSha256=sha(private_exe),
        buildReport=str(build_path),buildReportSha256=sha(build_path),nativeSourceSha256=build['nativeSourceSha256'],compiledSourceSha256=sources,
        nativeSymbolsSha256=build['nativeSymbolsSha256'],runnerSha256=RUNNER_SHA,guardSha256=sha(ROOT/'scripts/lib/native_pair_guard.py'),
        preparation=str(prep_path),preparationSha256=sha(prep_path),previousProof=str(previous) if previous else None,
        source=str(source),sourceSha256=source_hash,sourceCopy=str(copied),proposal=str(proposal),proposalSha256=proposal_hash,
        proposalCopy=str(proposal_copy),settingsProfile=str(settings),inputHashes=settings_hashes,preservedBefore=before,
        initialMarkerSha256=sha(marker),content=content,script=str(script),scriptSha256=sha(script),log=str(log),
        deadlineSeconds=35,rssCeilingBytes=512*1024*1024,logCeilingBytes=4*1024*1024,resourceSamples=[],
        nativeProcessesStarted=1,nativeSessionTerminal=False,nativeExitCode=None,stopReason=None,goalComplete=False)
    idle()
    with log.open('x') as sink:
        proc=await asyncio.create_subprocess_exec(str(private_exe),cwd=GAME/'kit',env=env,stdout=sink,stderr=asyncio.subprocess.STDOUT,start_new_session=True)
        m.update(nativePid=proc.pid,startedAtMs=time.time_ns()//1000000);started=time.monotonic()
        print(json.dumps({'nativePid':proc.pid,'phase':phase,'region':region}),flush=True)
        try:
            while proc.returncode is None:
                observed=rows();owned=owned_rows(observed,[proc.pid],[proc.pid]);elapsed=time.monotonic()-started
                m['resourceSamples'].append(dict(sampledAtMs=time.time_ns()//1000000,ownedPids=[r['pid'] for r in owned],rssBytes=sum(r['rssBytes'] for r in owned)))
                m['stopReason']=stop_reason(observed,[proc.pid],elapsed,35,[log.stat().st_size],groups=[proc.pid],expected_producers=1)
                out.write_text(json.dumps(m,indent=2)+'\n')
                if m['stopReason']:break
                try:await asyncio.wait_for(asyncio.shield(proc.wait()),timeout=2)
                except asyncio.TimeoutError:pass
        finally:
            if proc.returncode is None:await stop_owned([proc],[proc.pid])
        code=await proc.wait()
    current_rows=rows();absent=not owned_rows(current_rows,[proc.pid],[proc.pid])
    text=log.read_text();completed=len([r for r in text.splitlines() if r.startswith('[streaming] Regional home ') and 'result=pass' in r])==1
    observed=profile/'Remote_Home_Observed.GPL';patched=profile/'Remote_Home_Input.GPL'
    def record(f):return dict(filename=str(f),bytes=f.stat().st_size,sha256=sha(f))
    saves=copied.parent
    m.update(nativeSessionTerminal=True,nativeExitCode=code,ownedProducerAbsent=absent,regionalHomeTrialCompleted=completed,
        finishedAtMs=time.time_ns()//1000000,originalSourceUnchanged=sha(source)==source_hash,sourceCopyUnchanged=sha(copied)==source_hash,
        originalProposalUnchanged=sha(proposal)==proposal_hash,proposalCopyUnchanged=sha(proposal_copy)==proposal_hash,
        originalSettingsUnchanged=all(sha(settings/n)==h for n,h in settings_hashes.items()),preservedAfter=baseline(),
        privateNativeExecutableUnchanged=sha(private_exe)==build['nativeExecutableSha256'],logSha256=sha(log),
        saves=[record(f) for f in saves.glob('*.GMP')],finalMarker=record(marker),
        observedRecord=record(observed) if observed.is_file() else None,patchedRecord=record(patched) if patched.is_file() else None,
        frame=record(run/'frames/smoke_regional_home_saved_present.ppm') if (run/'frames/smoke_regional_home_saved_present.ppm').is_file() else None)
    m['canonicalAndServedUnchanged']=m['preservedAfter']==before
    out.write_text(json.dumps(m,indent=2)+'\n')
    print(json.dumps({'nativeSessionTerminal':True,'nativeExitCode':code,'trialCompleted':completed,'ownedProducerAbsent':absent}),flush=True)
    if code or m['stopReason'] or not completed or not absent or not m['canonicalAndServedUnchanged']:raise SystemExit(1)

if __name__=='__main__':asyncio.run(main())

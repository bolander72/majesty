#!/usr/bin/env python3
"""Replay a stopped fourth arrival's exact warm save and capsule in one paused engine."""
import argparse
import asyncio
import importlib.util
import json
import os
import re
import tempfile
import time
from pathlib import Path
from lib.native_pair_guard import owned_rows, stop_owned, stop_reason

ROOT=Path(__file__).resolve().parents[1]
GAME=ROOT/'upstream/majesty-recomp'
spec=importlib.util.spec_from_file_location('collision_guard',ROOT/'scripts/run-native-regional-home.py')
guard=importlib.util.module_from_spec(spec);spec.loader.exec_module(guard)
sha=guard.sha
def record(path):return dict(filename=str(path),bytes=path.stat().st_size,sha256=sha(path))

async def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('build',type=Path);p.add_argument('refusal',type=Path)
    p.add_argument('--attempt',type=int,required=True)
    a=p.parse_args();out=ROOT/f'output/native-hero-collision-replay-{a.attempt:03}.json';log=out.with_suffix('.log')
    if a.attempt<1 or out.exists() or log.exists():p.error('Preserve earlier trials')
    guard.idle();build_path=a.build.resolve();build=guard.bounded_json(build_path)
    refusal_path=a.refusal.resolve();proof=guard.bounded_json(refusal_path)
    if not proof.get('nativeOccupiedArrivalRefusedWithoutAbort') or proof['serial']!=4 or proof['targetRegion']!='-1_-1':
        p.error('Verified stopped fourth arrival refusal required')
    original_path=Path(proof['manifest']['filename']);original=guard.bounded_json(original_path)
    if sha(original_path)!=proof['manifest']['sha256'] or not original['nativeSessionTerminal'] or not original['ownedProducerAbsent'] or not original['publicationWorkerAbsent']:
        p.error('Original producer must be unchanged and stopped')
    for pid in [original['nativePid'],original['publicationWorkerPid']]:
        try:os.kill(pid,0)
        except ProcessLookupError:pass
        else:p.error('Original producer still exists')
    compiled={name:digest for group in ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256'] for name,digest in build[group].items()}
    exe=GAME/'build/recomp/pop_smoke'
    if not build.get('nativeBuildQualified') or build['exitCode']!=0 or len(compiled)!=54 or any(sha(ROOT/n)!=h for n,h in compiled.items()):p.error('Current official complete build required')
    if sha(exe)!=build['nativeExecutableSha256'] or sha(GAME/'build/recomp/gen/symbols.json')!=build['nativeSymbolsSha256'] or sha(GAME/'original/gog/MajestyHD - Old.exe')!=guard.PIN:p.error('Pinned build/executable differs')
    old_profile=Path(original['fixture'])/'frontier_-1_-1'
    input_path=old_profile/'Frontier_Hero_Travel_Input.json';packet=guard.bounded_json(input_path)
    if packet['serial']!=4 or packet['sourceRegion']!=proof['sourceRegion'] or packet['targetRegion']!=proof['targetRegion'] or packet['destinationClock']!=proof['clock']:p.error('Actual arrival input differs')
    slot,size,digest=packet['destinationNativeManifest'].splitlines()[1:4]
    warm=old_profile/'Documents/My Games/MajestyHD/SaveGame'/('Frontier_-1_-1'+('_Recovery' if slot=='1' else '')+'.GMP')
    if warm.stat().st_size!=int(size) or sha(warm)!=digest:p.error('Actual warm target changed')
    inputs=[warm,input_path]
    for key in ['home','package']:
        row=packet[key];path=old_profile/row['filename']
        if path.stat().st_size!=row['size'] or sha(path)!=row['sha256']:p.error('Original capsule changed')
        inputs.append(path)
    before=guard.baseline();original_inputs=[record(path) for path in inputs]
    run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-hero-home-',dir=GAME/'build'))
    private=run/'native/recomp';private.mkdir(parents=True);private_exe=private/'pop_smoke';guard.copy(exe,private_exe);private_exe.chmod(0o755)
    profile=run/'frontier_-1_-1';profile.mkdir()
    copied=profile/'Documents/My Games/MajestyHD/SaveGame/Frontier_-1_-1.GMP';guard.copy(warm,copied)
    for key in ['home','package']:guard.copy(old_profile/packet[key]['filename'],profile/packet[key]['filename'])
    content=guard.PIN+':'+build['nativeExecutableSha256']
    (profile/'Frontier_-1_-1.checkpoint').write_text('\n'.join(['checkpoint-v1','0',str(int(size)),digest,content,'']))
    script=run/'collision.script';script.write_text('wait 12000\nmove 400 300\nwait 2000\nmove 400 300\n')
    for name in ['frames','user-mods']:(run/name).mkdir()
    flags=dict(PROFILE_DIR=str(profile),REGISTRY=str(run/'registry.json'),RULE_FRONTIER_REGION='-1_-1',RULE_FRONTIER_RESTORE='1',
        RULE_INVENTORY_COMPAT='1',CONTENT_IDENTITY=content,GUEST_ARGS='-nointro -dochecksums',
        BROWSER_FRONTIER_HERO_COLLISION_REPLAY_TEST='v1',BROWSER_FRONTIER_HERO_HOME_TEST='v1',BROWSER_FRONTIER_HERO_HOME_TEST_MODE='register',
        BROWSER_FRONTIER_HERO_HOME_TEST_BINDING=packet['home']['sha256'],BROWSER_FRONTIER_HERO_HOME_TEST_SOURCE=digest,
        BROWSER_FRONTIER_HERO_HOME_TEST_CLOCK=str(proof['clock']),BROWSER_FRONTIER_HERO_HOME_TEST_BYTES=str(packet['home']['size']),
        BROWSER_FRONTIER_HERO_HOME_TEST_ID=str(packet['homeAlias']['agentId']),
        BROWSER_FRONTIER_HERO_ARRIVAL_TEST='v1',BROWSER_FRONTIER_HERO_ARRIVAL_TEST_BINDING=packet['package']['sha256'],
        BROWSER_FRONTIER_HERO_ARRIVAL_TEST_BYTES=str(packet['package']['size']),BROWSER_FRONTIER_HERO_ARRIVAL_TEST_UNIT=str(packet['sourceAlias']['unitId']),
        BROWSER_FRONTIER_HERO_ARRIVAL_TEST_AGENT=str(packet['sourceAlias']['agentId']),BROWSER_FRONTIER_HERO_ARRIVAL_TEST_CLOCK=str(packet['sourceClock']),
        SMOKE_SECONDS='18',SMOKE_WINDOW_INPUT='1',SMOKE_DRAWABLE='800x600',CORE_MODS_DIR=str(GAME/'build/recomp/mods/core'),
        MODS_DIR=str(run/'user-mods'),HOST_DUMP_DIR=str(run/'frames'),SCRIPT=str(script))
    env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')};env.update({'RECOMP_'+k:v for k,v in flags.items()})
    m=dict(version=1,fixture=str(run),build=record(build_path),refusalProof=record(refusal_path),originalProducer=record(original_path),
        originalInputs=original_inputs,compiledSourceSha256=compiled,nativeExecutableSha256=sha(private_exe),runnerSha256=sha(Path(__file__)),
        guardSha256=sha(ROOT/'scripts/lib/native_pair_guard.py'),supervisorSha256=sha(ROOT/'scripts/run-native-regional-home.py'),
        script=record(script),log=str(log),resourceSamples=[],deadlineSeconds=25,rssCeilingBytes=512*1024*1024,logCeilingBytes=4*1024*1024,
        preservedBefore=before,browserUsed=False,nativeProcessesStarted=1,nativeSessionTerminal=False,nativeExitCode=None,stopReason=None,
        nativeCollisionReplayQualified=False,ownerTransferred=False,goalComplete=False)
    guard.idle()
    with log.open('x') as sink:
        process=await asyncio.create_subprocess_exec(str(private_exe),cwd=GAME/'kit',env=env,stdout=sink,stderr=asyncio.subprocess.STDOUT,start_new_session=True)
        m.update(nativePid=process.pid,startedAtMs=time.time_ns()//1000000);started=time.monotonic();print(json.dumps(dict(nativePid=process.pid,phase='paused-collision-replay')),flush=True)
        try:
            while process.returncode is None:
                rows=guard.rows();owned=owned_rows(rows,[process.pid],[process.pid]);m['resourceSamples'].append(dict(sampledAtMs=time.time_ns()//1000000,rssBytes=sum(r['rssBytes'] for r in owned)))
                m['stopReason']=stop_reason(rows,[process.pid],time.monotonic()-started,25,[log.stat().st_size],groups=[process.pid],expected_producers=1)
                out.write_text(json.dumps(m,indent=2)+'\n')
                if m['stopReason']:break
                try:await asyncio.wait_for(asyncio.shield(process.wait()),timeout=2)
                except asyncio.TimeoutError:pass
        finally:
            if process.returncode is None:await stop_owned([process],[process.pid])
        code=await process.wait()
    text=log.read_text() if log.stat().st_size<=4*1024*1024 else ''
    matches=re.findall(r'Hero collision replay completed hero=(\d+) agent=(\d+) grid=(\d+),(\d+) clearance=(\d+) predicate-calls=(\d+) blockers=(\d+) clock=(\d+) original-query=1 ordinary-ticks=0 activated=0 scheduled=0 owner-published=0 hooks-removed=1 result=pass',text)
    m.update(nativeSessionTerminal=True,nativeExitCode=code,finishedAtMs=time.time_ns()//1000000,logSha256=sha(log),
        ownedProducerAbsent=not owned_rows(guard.rows(),[process.pid],[process.pid]),originalInputsUnchanged=all(record(Path(r['filename']))==r for r in original_inputs),
        copiedWarmUnchanged=sha(copied)==digest,preservedAfter=guard.baseline(),nativeExecutableUnchanged=sha(private_exe)==build['nativeExecutableSha256'])
    m['worlds']={name:record(profile/'Documents/My Games/MajestyHD/SaveGame'/(name+'.GMP')) for name in ['Hero_Home_Before','Hero_Arrival_Imported','Hero_Collision_Probe_After'] if (profile/'Documents/My Games/MajestyHD/SaveGame'/(name+'.GMP')).is_file()}
    qualified=code==0 and m['stopReason'] is None and m['ownedProducerAbsent'] and m['originalInputsUnchanged'] and m['copiedWarmUnchanged'] and m['preservedBefore']==m['preservedAfter'] and m['nativeExecutableUnchanged'] and len(matches)==1 and len(m['worlds'])==3
    if qualified:
        v=list(map(int,matches[0]));m['collision']=dict(zip(['unitId','agentId','x','y','clearance','predicateCalls','blockers','clock'],v));qualified=v[-1]==proof['clock']
    m['nativeCollisionReplayQualified']=bool(qualified);out.write_text(json.dumps(m,indent=2)+'\n')
    print(json.dumps(dict(nativeSessionTerminal=True,exitCode=code,qualified=bool(qualified),ownedProducerAbsent=m['ownedProducerAbsent'],collision=m.get('collision'))),flush=True)
    raise SystemExit(code or (0 if qualified else 1))
if __name__=='__main__':asyncio.run(main())

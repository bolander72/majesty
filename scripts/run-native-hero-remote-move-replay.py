#!/usr/bin/env python3
"""Import and resume native072's exact Move/Path/Queue capsule in one owned engine."""
import argparse
import asyncio
import importlib.util
import json
import os
from pathlib import Path
import re
import tempfile
import time
from lib.native_pair_guard import owned_rows, stop_owned, stop_reason

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'upstream/majesty-recomp'
spec = importlib.util.spec_from_file_location('move_replay_guard', ROOT / 'scripts/run-native-regional-home.py')
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)
sha = guard.sha

def record(path):
    path = Path(path).resolve()
    return dict(filename=str(path), bytes=path.stat().st_size, sha256=sha(path))

async def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('build', type=Path)
    p.add_argument('preparation', type=Path)
    p.add_argument('--attempt', type=int, required=True)
    a = p.parse_args()
    out = ROOT / f'output/native-hero-remote-move-replay-{a.attempt:03}.json'
    log = out.with_suffix('.log')
    if a.attempt < 1 or out.exists() or log.exists():
        p.error('Preserve prior trials')
    guard.idle()
    build_path, prep_path = a.build.resolve(), a.preparation.resolve()
    build, prep = guard.bounded_json(build_path), guard.bounded_json(prep_path)
    if not prep.get('exactStoppedThreeCommandCapsulePrepared') or prep.get('nativeProcessesStarted') != 0 or prep.get('browserUsed'):
        p.error('Require the stopped original three-command preparation')
    for name, digest in prep['sourceSha256'].items():
        if sha(ROOT / name) != digest:
            p.error('Preparation source changed')
    crossing = prep['crossing']
    if (crossing['serial'], crossing['region'], crossing['target'], crossing['clock'], prep['clock']) != (6, '-2_-1', '-3_-1', 81900, 100):
        p.error('Require the actual native072 sixth crossing')
    producer = guard.bounded_json(Path(prep['producer']['filename']))
    if not all(producer[k] for k in ['nativeSessionTerminal', 'ownedProducerAbsent', 'publicationWorkerAbsent']):
        p.error('Original producers must be terminal and absent')
    for pid in [producer['nativePid'], producer['publicationWorkerPid']]:
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            pass
        else:
            p.error('Original producer still exists')
    inputs = [prep[k] for k in ['archive', 'producer', 'log', 'input', 'sourceCheckpoint', 'warmCheckpoint', 'home', 'pack', 'sourceHead']]
    if any(record(row['filename']) != row for row in inputs):
        p.error('Stopped original evidence changed')
    compiled = {}
    for group in ['nativeSourceSha256', 'nativeHeapRuntimeSourceSha256', 'nativeOrderRuntimeSourceSha256', 'nativeCheckpointRuntimeSourceSha256']:
        for name, digest in build[group].items():
            if name in compiled:
                p.error('Duplicate compiled input')
            compiled[name] = digest
    exe = GAME / 'build/recomp/pop_smoke'
    if not build.get('nativeBuildQualified') or build['exitCode'] != 0 or len(compiled) != 54 or any(sha(ROOT / n) != h for n, h in compiled.items()):
        p.error('Current complete official native build required')
    if sha(exe) != build['nativeExecutableSha256'] or sha(GAME / 'build/recomp/gen/symbols.json') != build['nativeSymbolsSha256'] or sha(GAME / 'original/gog/MajestyHD - Old.exe') != guard.PIN:
        p.error('Pinned executable or symbols changed')
    before = guard.baseline()
    run = Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-hero-home-', dir=GAME / 'build'))
    private = run / 'native/recomp'
    (private / 'mods').mkdir(parents=True)
    private_exe = private / 'pop_smoke'
    guard.copy(exe, private_exe)
    private_exe.chmod(0o755)
    profile = run / 'frontier_-3_-1'
    profile.mkdir()
    copied = profile / 'Documents/My Games/MajestyHD/SaveGame/Frontier_-3_-1.GMP'
    guard.copy(Path(prep['warmCheckpoint']['filename']), copied)
    guard.copy(Path(prep['home']['filename']), profile / 'Frontier_Hero_Home.GPL')
    guard.copy(Path(prep['pack']['filename']), profile / 'Frontier_Hero_Arrival.pack')
    content = guard.PIN + ':' + build['nativeExecutableSha256']
    (profile / 'Frontier_-3_-1.checkpoint').write_text('\n'.join(['checkpoint-v1', '0', str(prep['warmCheckpoint']['bytes']), prep['warmCheckpoint']['sha256'], content, '']))
    script = run / 'remote-move.script'
    script.write_text('wait 12000\nmove 400 300\nwait 2000\nmove 400 300\n')
    for name in ['frames', 'user-mods']:
        (run / name).mkdir()
    flags = dict(PROFILE_DIR=str(profile), REGISTRY=str(run / 'registry.json'), RULE_FRONTIER_REGION='-3_-1', RULE_FRONTIER_RESTORE='1',
        RULE_INVENTORY_COMPAT='1', CONTENT_IDENTITY=content, GUEST_ARGS='-nointro -dochecksums',
        BROWSER_FRONTIER_HERO_REMOTE_MOVE_REPLAY_TEST='v1', BROWSER_FRONTIER_HERO_HOME_TEST='v1', BROWSER_FRONTIER_HERO_HOME_TEST_MODE='register',
        BROWSER_FRONTIER_HERO_HOME_TEST_BINDING=prep['home']['sha256'], BROWSER_FRONTIER_HERO_HOME_TEST_SOURCE=prep['warmCheckpoint']['sha256'],
        BROWSER_FRONTIER_HERO_HOME_TEST_CLOCK=str(prep['clock']), BROWSER_FRONTIER_HERO_HOME_TEST_BYTES=str(prep['home']['bytes']),
        BROWSER_FRONTIER_HERO_HOME_TEST_ID=str(prep['homeAgentId']), BROWSER_FRONTIER_HERO_ARRIVAL_TEST='v1',
        BROWSER_FRONTIER_HERO_ARRIVAL_TEST_BINDING=prep['pack']['sha256'], BROWSER_FRONTIER_HERO_ARRIVAL_TEST_BYTES=str(prep['pack']['bytes']),
        BROWSER_FRONTIER_HERO_ARRIVAL_TEST_UNIT=str(crossing['unitId']), BROWSER_FRONTIER_HERO_ARRIVAL_TEST_AGENT=str(crossing['agentId']),
        BROWSER_FRONTIER_HERO_ARRIVAL_TEST_CLOCK=str(crossing['clock']), BROWSER_FRONTIER_HERO_ACTIVATION_TEST='v1',
        SMOKE_SECONDS='18', SMOKE_WINDOW_INPUT='1', SMOKE_DRAWABLE='800x600', CORE_MODS_DIR=str(GAME / 'build/recomp/mods/core'),
        MODS_DIR=str(run / 'user-mods'), HOST_DUMP_DIR=str(run / 'frames'), SCRIPT=str(script))
    env = {k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')}
    env.update({'RECOMP_' + k:v for k,v in flags.items()})
    m = dict(version=1, fixture=str(run), profile=str(profile), build=record(build_path), preparation=record(prep_path),
        originalInputs=inputs, copiedWarm=record(copied), compiledSourceSha256=compiled, nativeExecutableSha256=sha(private_exe),
        runnerSha256=sha(Path(__file__)), guardSha256=sha(ROOT / 'scripts/lib/native_pair_guard.py'),
        supervisorSha256=sha(ROOT / 'scripts/run-native-regional-home.py'), script=record(script), log=str(log), resourceSamples=[],
        deadlineSeconds=25, rssCeilingBytes=512*1024*1024, logCeilingBytes=4*1024*1024, preservedBefore=before,
        browserUsed=False, nativeProcessesStarted=1, nativeSessionTerminal=False, nativeExitCode=None, stopReason=None,
        nativeRemoteMoveReplayQualified=False, ownerTransferred=False, goalComplete=False)
    guard.idle()
    with log.open('x') as sink:
        process = await asyncio.create_subprocess_exec(str(private_exe), cwd=GAME / 'kit', env=env, stdout=sink, stderr=asyncio.subprocess.STDOUT, start_new_session=True)
        m.update(nativePid=process.pid, startedAtMs=time.time_ns()//1000000)
        started = time.monotonic()
        print(json.dumps(dict(nativePid=process.pid, phase='three-command-import-and-original-resume')), flush=True)
        try:
            while process.returncode is None:
                rows = guard.rows()
                owned = owned_rows(rows, [process.pid], [process.pid])
                m['resourceSamples'].append(dict(sampledAtMs=time.time_ns()//1000000, rssBytes=sum(r['rssBytes'] for r in owned)))
                m['stopReason'] = stop_reason(rows, [process.pid], time.monotonic()-started, 25, [log.stat().st_size], groups=[process.pid], expected_producers=1)
                out.write_text(json.dumps(m, indent=2)+'\n')
                if m['stopReason']:
                    break
                try:
                    await asyncio.wait_for(asyncio.shield(process.wait()), timeout=2)
                except asyncio.TimeoutError:
                    pass
        finally:
            if process.returncode is None:
                await stop_owned([process], [process.pid])
        code = await process.wait()
    text = log.read_text() if log.stat().st_size <= m['logCeilingBytes'] else ''
    held = re.findall(r'Hero remote Move replay gameplay held hero=(\d+) agent=(\d+) from-clock=100 clock=(\d+) previous=(-?\d+,-?\d+,-?\d+) accepted=(-?\d+,-?\d+,-?\d+) ai=(\d+) other-ai=(\d+) contexts=(\d+) commands=(\d+) ticks=(\d+) original-movement=1 new-route=0 phase=3 pending=7 owner-published=0 result=pass', text)
    imported = re.findall(r'Hero destination arrival imported source=541/25 hero=(\d+) agent=(\d+) proxy=25 clock=100 records=4 commands=3 exact=1 registry-preserved=1 queues-preserved=1 drawing-preserved=1 original-readers=1 scheduled=0 activation=0 owner-published=0 result=pass', text)
    m.update(nativeSessionTerminal=True, nativeExitCode=code, finishedAtMs=time.time_ns()//1000000, logSha256=sha(log),
        ownedProducerAbsent=not owned_rows(guard.rows(), [process.pid], [process.pid]), originalInputsUnchanged=all(record(r['filename']) == r for r in inputs),
        copiedWarmUnchanged=record(copied) == m['copiedWarm'], preservedAfter=guard.baseline(), nativeExecutableUnchanged=sha(private_exe) == build['nativeExecutableSha256'])
    names = ['Hero_Home_Before', 'Hero_Home_Registered', 'Hero_Home_Reused', 'Hero_Arrival_Refused', 'Hero_Arrival_Imported',
             'Hero_Activation_Refused', 'Hero_Activation_Ready', 'Hero_Activation_Unrouted', 'Hero_Activation_Crossed', 'Hero_Activation_Closed']
    saves = profile / 'Documents/My Games/MajestyHD/SaveGame'
    m['worlds'] = {name:record(saves / (name+'.GMP')) for name in names if (saves / (name+'.GMP')).is_file()}
    qualified = code == 0 and m['stopReason'] is None and m['ownedProducerAbsent'] and m['originalInputsUnchanged'] and m['copiedWarmUnchanged'] and m['preservedBefore'] == m['preservedAfter'] and m['nativeExecutableUnchanged'] and len(imported) == len(held) == 1 and len(m['worlds']) == len(names)
    if qualified:
        qualified = imported[0] == held[0][:2] and '[streaming] Hero remote home leg ' not in text
        ticks = int(held[0][9])
        qualified = qualified and 2 <= ticks <= 40 and int(held[0][2]) == 100 + ticks*50 and int(held[0][7]) > 0
        m['arrival'] = dict(unitId=int(imported[0][0]), agentId=int(imported[0][1]), proxyAgentId=25, clock=100)
        m['continuation'] = dict(clock=int(held[0][2]), ticks=ticks, originalContextCallbacks=int(held[0][7]), newRouteIssued=False)
    m['nativeRemoteMoveReplayQualified'] = bool(qualified)
    out.write_text(json.dumps(m, indent=2)+'\n')
    print(json.dumps(dict(nativeSessionTerminal=True, exitCode=code, qualified=bool(qualified), ownedProducerAbsent=m['ownedProducerAbsent'])), flush=True)
    raise SystemExit(code or (0 if qualified else 1))

if __name__ == '__main__':
    asyncio.run(main())

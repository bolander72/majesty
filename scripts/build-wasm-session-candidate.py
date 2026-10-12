#!/usr/bin/env python3
"""Build one guarded, unstaged WASM candidate through the official game tool."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shlex
import signal
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'upstream/majesty-recomp'


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        while chunk := f.read(4096):
            h.update(chunk)
    return h.hexdigest()


def processes():
    rows = subprocess.check_output(['ps', '-axo', 'pid=,ppid=,pgid=,rss=,comm='], text=True, timeout=5)
    result = []
    for line in rows.splitlines():
        fields = line.split(None, 4)
        if len(fields) == 5:
            result.append(dict(pid=int(fields[0]), parent=int(fields[1]), group=int(fields[2]),
                               rssBytes=int(fields[3])*1024, program=Path(fields[4]).name))
    return result


def owned_processes(rows, root):
    # Ninja gives compiler jobs their own process groups. Counting only the
    # wrapper's group misses those jobs; follow parents as well as that group.
    owned = {root} | {row['pid'] for row in rows if row['group'] == root}
    while True:
        expanded = owned | {row['pid'] for row in rows if row['parent'] in owned}
        if expanded == owned:
            return [row for row in rows if row['pid'] in owned]
        owned = expanded


def stop_groups(groups, sig):
    for group in groups:
        try:
            os.killpg(group, sig)
        except ProcessLookupError:
            pass


def copy(source, target):
    with source.open('rb') as a, target.open('xb') as b:
        while chunk := a.read(4096):
            b.write(chunk)
        b.flush()
        os.fsync(b.fileno())
    assert sha(source) == sha(target)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--attempt', type=int, required=True)
    p.add_argument('--regenerate', action='store_true',
                   help='Regenerate through the official tool after curated entry changes')
    a = p.parse_args()
    report = ROOT / f'output/wasm-session-candidate-{a.attempt:03}-build.json'
    log = report.with_suffix('.log')
    if a.attempt < 1 or report.exists() or log.exists():
        p.error('Use a fresh positive attempt')
    if any(row['program'] in ['pop_smoke', 'clang', 'clang++', 'ninja', 'wasm-opt', 'wasm-ld'] for row in processes()):
        p.error('Another heavy native game/build is live')
    source_names = ['browser_frontier.cpp', 'browser_streaming.cpp', 'browser_campaign.cpp', 'campaign_objective.h', 'coop_pause.h', 'coop_checkpoint.h', 'coop_transition.h', 'coop_restore.h', 'coop_connected.h', 'coop_source_abort.h', 'game.toml', 'globals.toml',
                    'browser_network.cpp', 'browser_viewport.cpp', 'browser_overrides.h',
                    'native_received_checkpoint.cpp', 'native_received_checkpoint.h',
                    'native_received_transfer.cpp', 'native_received_transfer.h',
                    'kit/dx/directplay.cpp', 'kit/runtime/native_seam.h',
                    'kit/runtime/loader.h', 'kit/runtime/loader.cpp', 'kit/runtime/CMakeLists.txt',
                    'kit/runtime/mods_seam.cpp', 'kit/runtime/kernel32.cpp', 'kit/runtime/win32.h',
                    'kit/runtime/user32.cpp', 'kit/runtime/user32_internal.h', 'kit/runtime/imports.cpp', 'kit/runtime/imports.h',
                    'kit/tools/build.py', 'kit/host/CMakeLists.txt', 'kit/host/present_thread.cpp',
                    'kit/host/input_gate.cpp', 'kit/host/input_gate.h',
                    'kit/cmake/WebMemory.cmake',
                    'kit/platform/os.h', 'kit/platform/os_posix.cpp', 'kit/platform/CMakeLists.txt', 'kit/mods/overlay.cpp', 'kit/mods/hooks.cpp',
                    'kit/mods/mods_internal.h', 'kit/runtime/memory.cpp', 'kit/runtime/memory.h',
                    'kit/dx/com.cpp', 'kit/dx/com.h', 'kit/dx/ddraw.cpp', 'kit/dx/ddraw.h']
    source_names.extend(['native_order_storage.cpp', 'native_order_storage.h',
                         'native_order_allocation.cpp', 'native_order_allocation.h',
                         'native_order_hooks.cpp', 'native_order_hooks.h',
                         'native_actor_stage.cpp', 'native_actor_stage.h',
                         'native_actor_profile.h', 'native_order_payload.h'])
    inputs = {str((GAME/name).relative_to(ROOT)): sha(GAME/name) for name in source_names}
    site = GAME/'build/web-site'
    names = ['MajestyRecomp.wasm', 'MajestyRecomp.js', 'MajestyRecomp.data', 'index.html']
    served = {}
    for name in names:
        path = site/'majesty'/name
        s = path.stat()
        served[name] = dict(sha256=sha(path), size=s.st_size, inode=s.st_ino, mtimeNs=s.st_mtime_ns)
    sdk = ROOT/'.tools/emsdk/emsdk_env.sh'
    if not sdk.is_file():
        p.error('Installed Emscripten SDK required')
    command = ['.venv/bin/python', 'tools/build.py', '--target', 'web', '--jobs', '1',
               '--no-web-stage', '--web-memory-growth', 'conservative']
    if a.regenerate:
        command.append('--regenerate')
    shell = 'export EMSDK_QUIET=1\nsource '+shlex.quote(str(sdk))+'\nexec '+shlex.join(command)
    env = dict(os.environ, EMCC_CORES='1', BINARYEN_CORES='1')
    m = dict(version=1, buildQualified=False, browserQualified=False, browserUsed=False, gameProcessesStarted=0,
             builderSourceSha256=sha(Path(__file__)),
             command=shlex.join(command), sourceSha256=inputs, servedBefore=served, resourceSamples=[],
             aggregateRssCeilingBytes=2*1024*1024*1024,
             resourceSamplingScope='root-process-group-and-descendants',
             stopReason=None, startedAtMs=time.time_ns()//1000000,
             log=str(log), candidate=None, buildTerminal=False)
    with log.open('x') as output:
        proc = subprocess.Popen(['/bin/bash', '-c', shell], cwd=GAME, env=env, stdout=output,
                                stderr=subprocess.STDOUT, start_new_session=True)
        m['buildPid'] = proc.pid
        report.write_text(json.dumps(m, indent=2)+'\n')
        deadline = time.monotonic()+1800
        terminating = None
        owned_groups = {proc.pid}
        while proc.poll() is None:
            group = owned_processes(processes(), proc.pid)
            owned_groups = {proc.pid} | {row['group'] for row in group}
            rss = sum(row['rssBytes'] for row in group)
            m['resourceSamples'].append(dict(atMs=time.time_ns()//1000000, aggregateRssBytes=rss,
                                            processes=len(group)))
            if terminating is None and (rss > m['aggregateRssCeilingBytes'] or time.monotonic() > deadline):
                m['stopReason'] = 'rss-ceiling' if rss > m['aggregateRssCeilingBytes'] else 'time-ceiling'
                stop_groups(owned_groups, signal.SIGTERM)
                terminating = time.monotonic()
            elif terminating is not None and time.monotonic()-terminating > 5:
                stop_groups(owned_groups, signal.SIGKILL)
            try:
                proc.wait(timeout=2)
            except subprocess.TimeoutExpired:
                pass
        code = proc.wait()
    # Parent completion is not enough if a compiler child remains in its group.
    remaining = [row for row in processes() if row['group'] in owned_groups]
    if remaining:
        stop_groups({row['group'] for row in remaining}, signal.SIGTERM)
        m['stopReason'] = m['stopReason'] or 'compiler-child-remained'
    m.update(buildTerminal=not remaining, exitCode=code, finishedAtMs=time.time_ns()//1000000,
             logSha256=sha(log), maximumSampledAggregateRssBytes=max(row['aggregateRssBytes'] for row in m['resourceSamples']))
    m['sourcesUnchanged'] = all(sha(ROOT/name) == digest for name, digest in inputs.items())
    m['servedUnchanged'] = all(sha(site/'majesty'/name) == row['sha256'] and
                             (site/'majesty'/name).stat().st_ino == row['inode'] and
                             (site/'majesty'/name).stat().st_mtime_ns == row['mtimeNs']
                             for name, row in served.items())
    if code == 0 and not m['stopReason'] and m['sourcesUnchanged'] and m['servedUnchanged']:
        candidate = Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-wasm-session-candidate-', dir=GAME/'build'))
        artifacts = {}
        for name in names:
            source = GAME/'build/web/recomp'/name
            copy(source, candidate/name)
            artifacts[name] = dict(filename=str(candidate/name), sha256=sha(candidate/name), bytes=(candidate/name).stat().st_size)
        m.update(buildQualified=True, candidate=str(candidate), artifacts=artifacts)
    report.write_text(json.dumps(m, indent=2)+'\n')
    print(json.dumps({key:m[key] for key in ['buildQualified','buildTerminal','exitCode','stopReason','servedUnchanged']}))
    raise SystemExit(0 if m['buildQualified'] else code or 1)


if __name__ == '__main__':
    main()

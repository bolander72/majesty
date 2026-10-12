#!/usr/bin/env python3
"""Record one official one-job smoke build for world-residency work."""
import argparse,hashlib,json,os,subprocess,sys,time
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--attempt',type=int,required=True)
p.add_argument('--preset',help='Official CMake preset, including private SDK/resource presets')
p.add_argument('--regenerate',action='store_true',help='Regenerate through the official tool after changing declared native entries')
a=p.parse_args()
if a.attempt<=0:p.error('Attempt must be positive')
root=Path(__file__).resolve().parents[1];game=root/'upstream/majesty-recomp'
sources=[game/name for name in ['browser_frontier.cpp','browser_streaming.cpp','browser_campaign.cpp','campaign_objective.h','coop_pause.h', 'coop_checkpoint.h', 'coop_transition.h', 'coop_restore.h', 'coop_connected.h', 'coop_source_abort.h','game.toml','globals.toml',
    'kit/dx/com.cpp','kit/dx/com.h','kit/dx/ddraw.cpp','kit/dx/ddraw.h',
    'browser_network.cpp','browser_overrides.h','browser_viewport.cpp',
    'native_received_checkpoint.cpp','native_received_checkpoint.h',
    'native_received_transfer.cpp','native_received_transfer.h',
    'kit/dx/directplay.cpp','kit/runtime/native_seam.h','kit/runtime/mods_seam.cpp','kit/runtime/win32.h',
    'kit/runtime/kernel32.cpp','kit/runtime/user32.cpp','kit/runtime/user32_internal.h','kit/runtime/imports.cpp','kit/runtime/imports.h','kit/host/present_thread.cpp',
    'kit/platform/os.h','kit/platform/os_posix.cpp','kit/platform/CMakeLists.txt',
    'kit/platform/named_actions.h','kit/host/script.h','kit/host/script.cpp',
    'kit/host/smoke_main.cpp','kit/host/CMakeLists.txt','kit/host/input_gate.cpp','kit/host/input_gate.h',
    'coop_lobby_resume.h']]
runtime_sources=[game/'kit/runtime/memory.h',game/'kit/runtime/memory.cpp',game/'kit/runtime/tests/runtime_tests.cpp']
checkpoint_sources=[game/'kit/runtime/loader.h',game/'kit/runtime/loader.cpp',game/'kit/runtime/CMakeLists.txt']
order_sources=[game/name for name in ['native_order_storage.cpp','native_order_storage.h',
    'native_order_allocation.cpp','native_order_allocation.h','native_order_hooks.cpp','native_order_hooks.h',
    'native_actor_stage.cpp','native_actor_stage.h','native_actor_profile.h','native_order_payload.h']]
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(4096),b''):h.update(b)
    return h.hexdigest()
out=root/f'output/native-world-residency-build-{a.attempt:03}.json';log=out.with_suffix('.log')
if out.exists() or log.exists():p.error('Preserve prior builds')
rows=subprocess.check_output(['ps','-axo','pid=,comm='],text=True).splitlines()
if any(Path(r.split(None,1)[1]).name in ['pop_smoke','clang','clang++','ninja'] for r in rows if len(r.split(None,1))==2):p.error('Another native game/build is live')
command=[sys.executable,'tools/build.py','--target','smoke','--jobs','1']
if a.preset:command.extend(['--preset',a.preset])
if a.regenerate:command.append('--regenerate')
meta=dict(nativeBuildQualified=False,exitCode=None,command=' '.join(command),log=str(log),
    nativeSourceSha256={str(f.relative_to(root)):sha(f) for f in sources},nativeCompiledInputVersion='coop-lobby-resume-v2',browserUsed=False,nativeProcessesStarted=0,startedAtMs=time.time_ns()//1000000)
meta['developerDirectory']=os.environ.get('DEVELOPER_DIR')
meta['gitCeilingDirectories']=os.environ.get('GIT_CEILING_DIRECTORIES')
meta['configurePreset']=a.preset
meta['nativeHeapRuntimeSourceSha256']={str(f.relative_to(root)):sha(f) for f in runtime_sources}
meta['nativeCheckpointRuntimeSourceSha256']={str(f.relative_to(root)):sha(f) for f in checkpoint_sources}
meta['nativeOrderRuntimeSourceSha256']={str(f.relative_to(root)):sha(f) for f in order_sources}
with log.open('x') as f:
    process=subprocess.Popen(command,cwd=game,stdout=f,stderr=subprocess.STDOUT)
    meta['buildPid']=process.pid;out.write_text(json.dumps(meta,indent=2)+'\n');code=process.wait()
meta.update(exitCode=code,finishedAtMs=time.time_ns()//1000000,logSha256=sha(log))
if meta['nativeSourceSha256']!={str(f.relative_to(root)):sha(f) for f in sources}:raise RuntimeError('Source changed during build')
if meta['nativeHeapRuntimeSourceSha256']!={str(f.relative_to(root)):sha(f) for f in runtime_sources}:raise RuntimeError('Heap runtime source changed during build')
if meta['nativeCheckpointRuntimeSourceSha256']!={str(f.relative_to(root)):sha(f) for f in checkpoint_sources}:raise RuntimeError('Checkpoint runtime source changed during build')
if meta['nativeOrderRuntimeSourceSha256']!={str(f.relative_to(root)):sha(f) for f in order_sources}:raise RuntimeError('Order runtime source changed during build')
if code==0:
    exe=game/'build/recomp/pop_smoke';meta.update(nativeBuildQualified=True,nativeExecutableSha256=sha(exe),nativeExecutableBytes=exe.stat().st_size)
    meta['nativeSymbolsSha256']=sha(game/'build/recomp/gen/symbols.json')
out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps(dict(exitCode=code,nativeBuildQualified=code==0)));raise SystemExit(code)

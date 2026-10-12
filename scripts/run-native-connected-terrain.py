#!/usr/bin/env python3
"""Generate one opt-in connected-terrain kingdom in an isolated native profile."""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time
import importlib.util

ROOT=Path(__file__).resolve().parents[1]
GAME=ROOT/'upstream/majesty-recomp'
spec=importlib.util.spec_from_file_location('terrain_run',ROOT/'scripts/run-native-reconciled-terrain.py')
helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
sha=helper.sha

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('build_report',type=Path)
    parser.add_argument('--attempt',type=int,required=True)
    parser.add_argument('--region',required=True)
    args=parser.parse_args()
    if args.attempt<=0 or not re.fullmatch(r'-?\d+_-?\d+',args.region):parser.error('Invalid attempt or region')
    x,y=map(int,args.region.split('_'))
    if abs(x)>1000000 or abs(y)>1000000 or args.region!=f'{x}_{y}':parser.error('Noncanonical region')
    report=ROOT/f'output/native-connected-terrain-attempt-{args.attempt:03}.json';log=report.with_suffix('.log')
    if report.exists() or log.exists():parser.error('Preserve existing attempts')
    helper.ensure_idle()
    build_path=args.build_report.resolve();build=json.loads(build_path.read_text())
    executable=GAME/'build/recomp/pop_smoke'
    if not build.get('nativeBuildQualified') or build.get('exitCode')!=0 or sha(executable)!=build['nativeExecutableSha256']:
        parser.error('Require the current qualified native build')
    for name,digest in build['nativeSourceSha256'].items():
        if sha(ROOT/name)!=digest:parser.error('Native sources changed since build')
    settings_path=ROOT/'output/native-world-persistence-attempt-017.json';settings=json.loads(settings_path.read_text())
    original=Path(settings['profile']).resolve()
    if not settings.get('nativeSessionTerminal') or settings.get('nativeExitCode')!=0 or not original.is_relative_to(GAME/'build'):
        parser.error('Require an owned completed settings source')
    run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-connected-terrain-',dir=GAME/'build'))
    profile=run/f'frontier_{args.region}';profile.mkdir()
    inputs={}
    for name in ['mod-settings.json','Documents/My Games/MajestyHD/MajXPrefs','Documents/My Games/MajestyHD/questdata_majx.sav']:
        expected=settings['inputHashes'][name]
        if sha(original/name)!=expected:parser.error('Settings source changed')
        target=profile/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(original/name,target)
        if sha(target)!=expected:parser.error('Settings changed during copy')
        inputs[name]=expected
    for name in ['frames','user-mods']:(run/name).mkdir()
    base=GAME/'smoke/frontier-beginner.script'
    text=base.read_text();text=text[:text.index('dump beginner15')]
    text+='dump connected_playing\n'
    for mx,my,wait in [(750,585,1000),(350,265,1000),(150,565,2000)]:
        text+=f'move {mx} {my}\nwait 100\nbutton left down\nwait 100\nbutton left up\nwait {wait}\n'
    text+='dump connected_saved\nwait 5000\ndump connected_final\n'
    script=run/'generate-save.script';script.write_text(text)
    meta=dict(nativeOnly=True,browserUsed=False,region=args.region,connectedTerrainVersion='v1',fixture=str(run),profile=str(profile),
        buildReport=str(build_path),buildReportSha256=sha(build_path),nativeExecutableSha256=sha(executable),
        nativeSourceSha256=build['nativeSourceSha256'],settingsProducer=str(settings_path),settingsProducerSha256=sha(settings_path),
        inputHashes=inputs,baseScript=str(base),baseScriptSha256=sha(base),script=str(script),scriptSha256=sha(script),
        log=str(log),resourceSamples=[],rssCeilingBytes=512*1024*1024,stopReason=None,
        nativeSessionTerminal=False,nativeExitCode=None,startedAtMs=time.time_ns()//1000000)
    env={key:value for key,value in os.environ.items() if not key.startswith('RECOMP_')}
    env.update(RECOMP_PROFILE_DIR=str(profile),RECOMP_RULE_FRONTIER_REGION=args.region,RECOMP_RULE_INVENTORY_COMPAT='1',
        RECOMP_RULE_FRONTIER_SEEDED_GENERATION='1',RECOMP_RULE_FRONTIER_CONNECTED_TERRAIN='v1',
        RECOMP_GUEST_ARGS='-nointro -dochecksums',RECOMP_SMOKE_SECONDS='65',RECOMP_SMOKE_WINDOW_INPUT='1',
        RECOMP_SMOKE_DRAWABLE='800x600',RECOMP_CORE_MODS_DIR=str(GAME/'build/recomp/mods/core'),RECOMP_MODS_DIR=str(run/'user-mods'),
        RECOMP_HOST_DUMP_DIR=str(run/'frames'),RECOMP_SCRIPT=str(script))
    helper.ensure_idle()
    if sha(executable)!=meta['nativeExecutableSha256']:parser.error('Native executable changed before launch')
    with log.open('x') as output:
        process=subprocess.Popen([str(executable)],cwd=GAME/'kit',env=env,stdout=output,stderr=subprocess.STDOUT)
        meta['nativePid']=process.pid;report.write_text(json.dumps(meta,indent=2)+'\n')
        print(json.dumps(dict(nativePid=process.pid,region=args.region,fixture=run.name)),flush=True)
        deadline=time.monotonic()+120
        while process.poll() is None:
            try:
                fields=subprocess.check_output(['ps','-p',str(process.pid),'-o','pid=,rss=,%cpu='],text=True,timeout=2).split()
                if len(fields)!=3 or int(fields[0])!=process.pid:raise RuntimeError('Missing native PID sample')
                sample=dict(pid=process.pid,rssBytes=int(fields[1])*1024,cpuPercent=float(fields[2]));meta['resourceSamples'].append(sample)
                if sample['rssBytes']>meta['rssCeilingBytes']:meta['stopReason']='native-rss-ceiling'
                if time.monotonic()>deadline:meta['stopReason']='native-duration-ceiling'
            except (subprocess.SubprocessError,ValueError,RuntimeError) as error:
                if process.poll() is None:meta['stopReason']=type(error).__name__
            if meta['stopReason']:process.terminate()
            report.write_text(json.dumps(meta,indent=2)+'\n')
            try:process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                if meta['stopReason']:process.kill()
        code=process.wait()
    saves=profile/'Documents/My Games/MajestyHD/SaveGame'
    meta.update(nativeExitCode=code,nativeSessionTerminal=True,finishedAtMs=time.time_ns()//1000000,
        originalSettingsUnchanged=all(sha(original/name)==digest for name,digest in inputs.items()),
        saves=[dict(filename=str(path),bytes=path.stat().st_size,sha256=sha(path)) for path in sorted(saves.glob('*.GMP'))],
        frames=[str(path) for path in sorted((run/'frames').glob('*.ppm'))])
    report.write_text(json.dumps(meta,indent=2)+'\n')
    print(json.dumps(dict(nativeSessionTerminal=True,nativeExitCode=code,saves=len(meta['saves']))),flush=True)
    raise SystemExit(code)

if __name__=='__main__':main()

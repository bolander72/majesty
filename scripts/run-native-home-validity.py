#!/usr/bin/env python3
"""Query original game-piece validity in one isolated loaded native kingdom."""
import argparse, hashlib, json, os, shutil, subprocess, tempfile, time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
GAME=ROOT/'upstream/majesty-recomp'
def sha(p):
 h=hashlib.sha256()
 with Path(p).open('rb') as f:
  for b in iter(lambda:f.read(4096),b''):h.update(b)
 return h.hexdigest()
def idle():
 rows=subprocess.check_output(['ps','-axo','pid=,comm='],text=True).splitlines()
 if any(Path(r.split(None,1)[1]).name in ['pop_smoke','clang','clang++','ninja'] for r in rows if len(r.split(None,1))==2):raise RuntimeError('Another native game/build is live')
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('build_report',type=Path);p.add_argument('--attempt',type=int,required=True);p.add_argument('--home-task',action='store_true');p.add_argument('--home-motion',action='store_true');a=p.parse_args()
 if a.home_motion and not a.home_task:p.error('--home-motion requires --home-task')
 mode='home-task' if a.home_task else 'home-validity'
 out=ROOT/f'output/native-{mode}-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
 if a.attempt<1 or out.exists() or log.exists():p.error('Require a fresh positive attempt')
 idle()
 origin=ROOT/('output/native-generated-hero-attempt-002.json' if a.home_task else 'output/native-connected-residency-attempt-007.json');m=json.loads(origin.read_text())
 code="import {inspectConnectedLoadTransforms as f} from './scripts/inspect-native-connected-load-transforms.mjs';console.log(JSON.stringify({qualified:(await f(process.argv[1],process.argv[2])).generatedRegionInitializationQualified}));"
 if a.home_task:code="import {inspectGeneratedHero as f} from './scripts/inspect-native-generated-hero.mjs';const r=await f(process.argv[1]);console.log(JSON.stringify({qualified:r.independentlyPlacedOutsideHome,save:r.save.filename}));"
 r=json.loads(subprocess.check_output(['node','--input-type=module','-e',code,str(origin),str(ROOT/'output/native-connected-load-transforms-setter-audit.json')],cwd=ROOT,text=True))
 if r.get('qualified') is not True:p.error('Initialized source failed qualification')
 build_path=a.build_report.resolve();b=json.loads(build_path.read_text());exe=GAME/'build/recomp/pop_smoke'
 if not b.get('nativeBuildQualified') or b.get('exitCode')!=0 or sha(exe)!=b['nativeExecutableSha256']:p.error('Current build differs')
 if any(sha(ROOT/n)!=d for n,d in b['nativeSourceSha256'].items()):p.error('Build sources changed')
 run=Path(tempfile.mkdtemp(prefix=f'actor-arrival-fixture-{mode}-',dir=GAME/'build'));profile=run/'frontier_0_0';profile.mkdir()
 settings={}
 for n in ['mod-settings.json','Documents/My Games/MajestyHD/MajXPrefs','Documents/My Games/MajestyHD/questdata_majx.sav']:
  src=Path(m['profile'])/n;d=m['inputHashes'][n]
  if sha(src)!=d:p.error('Original settings changed')
  dst=profile/n;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
  if sha(dst)!=d:p.error('Copied settings differ')
  settings[n]=d
 src=Path(r['save']) if a.home_task else Path(m['profile'])/'Residency_Visit_1_After.GMP';source_sha=sha(src)
 saves=profile/'Documents/My Games/MajestyHD/SaveGame';saves.mkdir(parents=True);copied=saves/'Home_Starting_Realm.GMP';shutil.copy2(src,copied)
 if sha(copied)!=source_sha:p.error('Source copy differs')
 for n in ['user-mods','frames']:(run/n).mkdir()
 steps=['wait 10000','dump home_main_menu']
 for x,y,wait in [(92,578,1000),(150,565,10000)]:steps.extend([f'move {x} {y}','wait 100','button left down','wait 100','button left up',f'wait {wait}'])
 steps.extend(['dump home_loaded','wait 15000' if a.home_task else 'wait 3000'])
 if a.home_task:
  for x,y,wait in [(750,585,1000),(350,265,1000),(150,565,2000)]:steps.extend([f'move {x} {y}','wait 100','button left down','wait 100','button left up',f'wait {wait}'])
  steps.extend(['dump home_task_saved','wait 5000' if a.home_motion else 'wait 1000'])
  if a.home_motion:steps.append('dump home_motion_finished')
 script=run/'load-home.script';script.write_text('\n'.join(steps)+'\n')
 meta=dict(nativeOnly=True,browserUsed=False,nativeSessionTerminal=False,nativeExitCode=None,fixture=str(run),profile=str(profile),sourceManifest=str(origin),sourceManifestSha256=sha(origin),initializedSource=str(src),initializedSourceSha256=source_sha,sourceCopy=str(copied),inputHashes=settings,buildReport=str(build_path),buildReportSha256=sha(build_path),nativeExecutableSha256=sha(exe),nativeSourceSha256=b['nativeSourceSha256'],script=str(script),scriptSha256=sha(script),log=str(log),homeValidityFixture='v1',resourceSamples=[],rssCeilingBytes=512*1024*1024,stopReason=None)
 env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')}
 env.update(RECOMP_PROFILE_DIR=str(profile),RECOMP_RULE_FRONTIER_REGION='0_0',RECOMP_RULE_INVENTORY_COMPAT='1',RECOMP_BROWSER_STREAMING_DEBUG='1',RECOMP_BROWSER_STREAMING_HOME_VALIDITY_FIXTURE='v1',RECOMP_GUEST_ARGS='-nointro -dochecksums',RECOMP_SMOKE_SECONDS='65',RECOMP_SMOKE_WINDOW_INPUT='1',RECOMP_SMOKE_DRAWABLE='800x600',RECOMP_CORE_MODS_DIR=str(GAME/'build/recomp/mods/core'),RECOMP_MODS_DIR=str(run/'user-mods'),RECOMP_HOST_DUMP_DIR=str(run/'frames'),RECOMP_SCRIPT=str(script))
 if a.home_task:
  del env['RECOMP_BROWSER_STREAMING_HOME_VALIDITY_FIXTURE'];env['RECOMP_BROWSER_STREAMING_HOME_TASK_FIXTURE']='v1';meta['homeTaskFixture']='v1';del meta['homeValidityFixture']
 if a.home_motion:env['RECOMP_BROWSER_STREAMING_HOME_MOTION_FIXTURE']='1';meta['homeMotionFixture']='1'
 idle()
 with log.open('x') as f:
  proc=subprocess.Popen([str(exe)],cwd=GAME/'kit',env=env,stdout=f,stderr=subprocess.STDOUT);meta.update(nativePid=proc.pid,startedAtMs=time.time_ns()//1000000);print(json.dumps({'nativePid':proc.pid}),flush=True);deadline=time.monotonic()+60
  while proc.poll() is None:
   try:
    row=subprocess.check_output(['ps','-p',str(proc.pid),'-o','pid=,rss=,%cpu='],text=True,timeout=2).split()
    if len(row)!=3 or int(row[0])!=proc.pid:raise RuntimeError('Exact PID sample missing')
    sample=dict(pid=proc.pid,sampledAtMs=time.time_ns()//1000000,rssBytes=int(row[1])*1024,cpuPercent=float(row[2]));meta['resourceSamples'].append(sample)
    if sample['rssBytes']>meta['rssCeilingBytes']:meta['stopReason']='rss-ceiling'
    if time.monotonic()>deadline:meta['stopReason']='duration-ceiling'
   except (subprocess.SubprocessError,ValueError,RuntimeError) as e:
    if proc.poll() is None:meta['stopReason']=type(e).__name__
   if meta['stopReason']:proc.terminate()
   out.write_text(json.dumps(meta,indent=2)+'\n')
   try:proc.wait(timeout=2)
   except subprocess.TimeoutExpired:
    if meta['stopReason']:proc.kill()
  code=proc.wait()
 observed=log.read_text();completed=('hooks-removed=1 entry-qualified=0 travel-qualified=0 result=pass' if a.home_task else 'home-written=0 pure-agents-scheduled=0 state-preserved=1 result=pass') in observed
 meta.update(nativeSessionTerminal=True,nativeExitCode=code,finishedAtMs=time.time_ns()//1000000,initializedSourceUnchanged=sha(src)==source_sha,sourceCopyUnchanged=sha(copied)==source_sha,originalSettingsUnchanged=all(sha(Path(m['profile'])/n)==d for n,d in settings.items()),logSha256=sha(log),homeValidityTrialCompleted=completed)
 if a.home_task:
  meta['homeTaskTrialCompleted']=completed;del meta['homeValidityTrialCompleted'];meta['saves']=[dict(filename=str(f),bytes=f.stat().st_size,sha256=sha(f)) for f in sorted(saves.glob('*.GMP'))]
  meta['heldRecords']=[dict(filename=str(f),bytes=f.stat().st_size,sha256=sha(f)) for n in ['Hero_Home_Held_Before.GPL','Hero_Home_Held_After.GPL'] if (f:=profile/n).is_file()]
  if (f:=profile/'Hero_Home_Resumed.GPL').is_file():meta['resumedRecord']=dict(filename=str(f),bytes=f.stat().st_size,sha256=sha(f))
 out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps({'nativeSessionTerminal':True,'nativeExitCode':code,('homeTaskTrialCompleted' if a.home_task else 'homeValidityTrialCompleted'):completed}),flush=True);raise SystemExit(code or (0 if completed else 1))
if __name__=='__main__':main()

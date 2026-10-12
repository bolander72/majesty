#!/usr/bin/env python3
"""Fresh original whole-world reload of the actual registered-hero import save."""
import argparse,hashlib,json,os,shutil,subprocess,tempfile,time,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];GAME=ROOT/'upstream/majesty-recomp'
def sha(path):
 h=hashlib.sha256()
 with Path(path).open('rb') as f:
  for b in iter(lambda:f.read(4096),b''):h.update(b)
 return h.hexdigest()
def idle():
 rows=subprocess.check_output(['ps','-axo','pid=,comm='],text=True).splitlines()
 if any(Path(r.split(None,1)[1]).name in ['pop_smoke','clang','clang++','ninja'] for r in rows if len(r.split(None,1))==2):raise RuntimeError('Another native game/build is live')
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('build_report',type=Path);p.add_argument('previous_manifest',type=Path)
 p.add_argument('--attempt',type=int,required=True);a=p.parse_args()
 out=ROOT/f'output/native-hero-reload-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
 if a.attempt<1 or out.exists() or log.exists():p.error('Fresh positive attempt required')
 idle();previous=a.previous_manifest.resolve();prior=json.loads(previous.read_text());build_path=a.build_report.resolve();build=json.loads(build_path.read_text())
 exe=GAME/'build/recomp/pop_smoke'
 if not build.get('nativeBuildQualified') or build['exitCode']!=0 or sha(exe)!=build['nativeExecutableSha256']:p.error('Current native build differs')
 if any(sha(ROOT/n)!=d for n,d in build['nativeSourceSha256'].items()):p.error('Build source changed')
 if sha(GAME/'build/recomp/gen/symbols.json')!=build['nativeSymbolsSha256']:p.error('Build symbols changed')
 code="import {inspectNativeHeroImport as f} from './scripts/inspect-native-hero-import.mjs';console.log(JSON.stringify(await f(process.argv[1])));"
 verified=json.loads(subprocess.check_output(['node','--input-type=module','-e',code,str(previous)],cwd=ROOT,text=True))
 if not verified['originalRegisteredHeroUnscheduledImportQualified'] or not verified['originalRegisteredHeroWholeSaveQualified']:p.error('Import qualification missing')
 source=Path(verified['savedWorld']['filename']);expected_source=verified['savedWorld']['sha256']
 if sha(source)!=expected_source:p.error('Saved world changed')
 input_hashes=prior['inputHashes'];settings_profile=Path(prior['settingsProfile'])
 run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-hero-reload-',dir=GAME/'build'));profile=run/'frontier_1_0';profile.mkdir()
 for name,d in input_hashes.items():
  original=settings_profile/name
  if sha(original)!=d:p.error('Settings source changed')
  target=profile/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(original,target)
  if sha(target)!=d:p.error('Copied settings differ')
 saves=profile/'Documents/My Games/MajestyHD/SaveGame';saves.mkdir(parents=True)
 copied=saves/'Hero_Reload_Source.GMP';shutil.copy2(source,copied)
 names={'unit':'Hero_Reload_Hero_Input.UNIT','agent':'Hero_Reload_Agent_Input.GPL',
  'attached_503':'Hero_Reload_Effect_Input.UNIT','attached_order_503':'Hero_Reload_Orders_Input.bin'}
 inputs=[]
 with source.open('rb') as original:
  for key,name in names.items():
   r=verified['observations'][key];offset=r['offset'];size=r['bytes']
   if key=='attached_order_503':offset+=36;size-=36
   if size>4096:p.error('Reload input bound')
   original.seek(offset);data=original.read(size)
   if len(data)!=size:p.error('Saved range truncated')
   target=profile/name;target.write_bytes(data)
   inputs.append(dict(copied=str(target),sourceOffset=offset,bytes=size,sha256=sha(target)))
 identity=profile/'Hero_Reload_Identity.bin';identity.write_bytes(struct.pack('<4I',verified['heroId'],verified['effectId'],verified['agentId'],verified['clockMs']))
 inputs.append(dict(copied=str(identity),sourceOffset=None,bytes=16,sha256=sha(identity)))
 if sha(copied)!=expected_source:p.error('Copied destination changed')
 for name in ['frames','user-mods']:(run/name).mkdir()
 click=lambda x,y:f'move {x} {y}\nwait 100\nbutton left down\nwait 100\nbutton left up\n'
 script=run/'load-hero-reload.script';script.write_text('wait 10000\n'+click(92,578)+'wait 1000\n'+click(150,565)+'wait 6000\ndump hero_reload_completed\n')
 meta=dict(version=1,nativeOnly=True,browserUsed=False,nativeSessionTerminal=False,nativeExitCode=None,phase="reload",
  fixture=str(run),profile=str(profile),previousManifest=str(previous),previousManifestSha256=sha(previous),
  source=str(source),sourceSha256=expected_source,sourceCopy=str(copied),inputs=inputs,settingsProfile=str(settings_profile),
  inputHashes=input_hashes,buildReport=str(build_path),buildReportSha256=sha(build_path),nativeExecutableSha256=sha(exe),
  nativeSourceSha256=build['nativeSourceSha256'],nativeSymbolsSha256=build['nativeSymbolsSha256'],script=str(script),scriptSha256=sha(script),
  log=str(log),resourceSamples=[],rssCeilingBytes=512*1024*1024,stopReason=None)
 env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')};env.update(RECOMP_PROFILE_DIR=str(profile),RECOMP_RULE_FRONTIER_REGION='1_0',
  RECOMP_RULE_INVENTORY_COMPAT='1',RECOMP_BROWSER_STREAMING_DEBUG='1',RECOMP_BROWSER_STREAMING_HERO_RELOAD_FIXTURE="1",
  RECOMP_GUEST_ARGS='-nointro -dochecksums',RECOMP_SMOKE_SECONDS='35',RECOMP_SMOKE_WINDOW_INPUT='1',RECOMP_SMOKE_DRAWABLE='800x600',
  RECOMP_CORE_MODS_DIR=str(GAME/'build/recomp/mods/core'),RECOMP_MODS_DIR=str(run/'user-mods'),RECOMP_HOST_DUMP_DIR=str(run/'frames'),RECOMP_SCRIPT=str(script))
 idle()
 with log.open('x') as stream:
  proc=subprocess.Popen([str(exe)],cwd=GAME/'kit',env=env,stdout=stream,stderr=subprocess.STDOUT);meta.update(nativePid=proc.pid,startedAtMs=time.time_ns()//1000000)
  out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps({'nativePid':proc.pid,'phase':'reload'}),flush=True);deadline=time.monotonic()+33
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
 rows=[line for line in log.read_text().splitlines() if line.startswith('[streaming] Hero reload cleanup ')]
 completed=len(rows)==1 and 'result=pass' in rows[0]
 meta.update(nativeSessionTerminal=True,nativeExitCode=code,heroReloadTrialCompleted=completed,finishedAtMs=time.time_ns()//1000000,
  originalSourceUnchanged=sha(source)==expected_source,sourceCopyUnchanged=sha(copied)==expected_source,
  inputCopiesUnchanged=all(sha(r['copied'])==r['sha256'] for r in inputs),
  originalSettingsUnchanged=all(sha(settings_profile/n)==d for n,d in input_hashes.items()),logSha256=sha(log),
  records=[dict(filename=str(f),bytes=f.stat().st_size,sha256=sha(f)) for f in sorted(profile.glob('Hero_Reload_*')) if f.is_file()],
  saves=[dict(filename=str(f),bytes=f.stat().st_size,sha256=sha(f)) for f in sorted(saves.glob('*.GMP'))])
 out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps({'nativeSessionTerminal':True,'nativeExitCode':code,'heroReloadTrialCompleted':completed}),flush=True)
 raise SystemExit(code or (0 if completed else 1))
if __name__=='__main__':main()

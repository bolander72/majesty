#!/usr/bin/env python3
"""Register or reload one inert remote-guild record in the real neighboring world."""
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
 if any(Path(r.split(None,1)[1]).name in ['pop_smoke','clang','clang++','ninja'] for r in rows if len(r.split(None,1))==2):raise RuntimeError('Another native game/build is live')
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('build_report',type=Path);p.add_argument('preparation',type=Path)
 p.add_argument('--attempt',type=int,required=True);p.add_argument('--reload-from',type=Path);a=p.parse_args()
 out=ROOT/f'output/native-remote-home-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
 if a.attempt<1 or out.exists() or log.exists():p.error('Fresh positive attempt required')
 idle();prep_path=a.preparation.resolve();prep=json.loads(prep_path.read_text());build_path=a.build_report.resolve();build=json.loads(build_path.read_text())
 exe=GAME/'build/recomp/pop_smoke'
 if not build.get('nativeBuildQualified') or build['exitCode']!=0 or sha(exe)!=build['nativeExecutableSha256']:p.error('Current native build differs')
 if any(sha(ROOT/n)!=d for n,d in build['nativeSourceSha256'].items()):p.error('Build source changed')
 if sha(GAME/'build/recomp/gen/symbols.json')!=build['nativeSymbolsSha256']:p.error('Build symbols changed')
 if prep.get('remoteHomeProposalPrepared') is not True or prep['plan']['destinationRegion']!='1_0':p.error('Missing remote preparation')
 if sha(prep['record']['filename'])!=prep['record']['sha256'] or prep['record']['bytes']>1024:p.error('Proposal changed')
 if any(sha(ROOT/n)!=d for n,d in prep['sourceSha256'].items()):p.error('Preparation source changed')
 source=Path(prep['destination']['filename']);proposal=Path(prep['record']['filename']);phase='create';previous=None
 if a.reload_from:
  previous=a.reload_from.resolve()
  code="import {inspectNativeRemoteHome as f} from './scripts/inspect-native-remote-home.mjs';const r=await f(process.argv[1]);console.log(JSON.stringify({save:r.savedWorld.filename,record:r.observedRecord.filename,preparation:r.preparation}));"
  verified=json.loads(subprocess.check_output(['node','--input-type=module','-e',code,str(previous)],cwd=ROOT,text=True))
  if verified['preparation']!=str(prep_path):p.error('Different prior preparation')
  source=Path(verified['save']);proposal=Path(verified['record']);phase='reload'
 expected_source=sha(source);expected_proposal=sha(proposal)
 if phase=='create' and expected_source!=prep['destination']['sha256']:p.error('Destination changed')
 run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-remote-home-',dir=GAME/'build'));profile=run/'frontier_1_0';profile.mkdir()
 for name,d in prep['inputHashes'].items():
  original=Path(prep['settingsProfile'])/name
  if sha(original)!=d:p.error('Settings source changed')
  target=profile/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(original,target)
  if sha(target)!=d:p.error('Copied settings differ')
 saves=profile/'Documents/My Games/MajestyHD/SaveGame';saves.mkdir(parents=True)
 copied=saves/'Remote_Starting_Realm.GMP';shutil.copy2(source,copied);shutil.copy2(proposal,profile/'Remote_Home_Proposal.GPL')
 if sha(copied)!=expected_source or sha(profile/'Remote_Home_Proposal.GPL')!=expected_proposal:p.error('Copied input differs')
 for name in ['frames','user-mods']:(run/name).mkdir()
 click=lambda x,y:f'move {x} {y}\nwait 100\nbutton left down\nwait 100\nbutton left up\n'
 script=run/'load-remote.script';script.write_text('wait 10000\n'+click(92,578)+'wait 1000\n'+click(150,565)+'wait 8000\ndump remote_loaded\nwait 1000\n'+click(750,585)+'wait 1000\n'+click(350,265)+'wait 1000\n'+click(150,565)+'wait 2000\ndump remote_saved\n')
 meta=dict(version=1,nativeOnly=True,browserUsed=False,nativeSessionTerminal=False,nativeExitCode=None,phase=phase,
  fixture=str(run),profile=str(profile),preparation=str(prep_path),preparationSha256=sha(prep_path),previousManifest=str(previous) if previous else None,
  source=str(source),sourceSha256=expected_source,sourceCopy=str(copied),proposal=str(proposal),proposalSha256=expected_proposal,
  inputHashes=prep['inputHashes'],buildReport=str(build_path),buildReportSha256=sha(build_path),nativeExecutableSha256=sha(exe),
  nativeSourceSha256=build['nativeSourceSha256'],nativeSymbolsSha256=build['nativeSymbolsSha256'],script=str(script),scriptSha256=sha(script),
  log=str(log),resourceSamples=[],rssCeilingBytes=512*1024*1024,stopReason=None)
 env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')};env.update(RECOMP_PROFILE_DIR=str(profile),RECOMP_RULE_FRONTIER_REGION='1_0',
  RECOMP_RULE_INVENTORY_COMPAT='1',RECOMP_BROWSER_STREAMING_DEBUG='1',RECOMP_BROWSER_STREAMING_REMOTE_HOME_FIXTURE=phase,
  RECOMP_GUEST_ARGS='-nointro -dochecksums',RECOMP_SMOKE_SECONDS='45',RECOMP_SMOKE_WINDOW_INPUT='1',RECOMP_SMOKE_DRAWABLE='800x600',
  RECOMP_CORE_MODS_DIR=str(GAME/'build/recomp/mods/core'),RECOMP_MODS_DIR=str(run/'user-mods'),RECOMP_HOST_DUMP_DIR=str(run/'frames'),RECOMP_SCRIPT=str(script))
 idle()
 with log.open('x') as stream:
  proc=subprocess.Popen([str(exe)],cwd=GAME/'kit',env=env,stdout=stream,stderr=subprocess.STDOUT);meta.update(nativePid=proc.pid,startedAtMs=time.time_ns()//1000000)
  out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps({'nativePid':proc.pid,'phase':phase}),flush=True);deadline=time.monotonic()+43
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
 observed=log.read_text();rows=[line for line in observed.splitlines() if line.startswith('[streaming] Remote home phase=')]
 completed=len(rows)==1 and 'result=pass' in rows[0]
 meta.update(nativeSessionTerminal=True,nativeExitCode=code,remoteHomeTrialCompleted=completed,finishedAtMs=time.time_ns()//1000000,
  originalSourceUnchanged=sha(source)==expected_source,sourceCopyUnchanged=sha(copied)==expected_source,
  originalProposalUnchanged=sha(proposal)==expected_proposal,proposalCopyUnchanged=sha(profile/'Remote_Home_Proposal.GPL')==expected_proposal,
  originalSettingsUnchanged=all(sha(Path(prep['settingsProfile'])/n)==d for n,d in prep['inputHashes'].items()),logSha256=sha(log),
  saves=[dict(filename=str(f),bytes=f.stat().st_size,sha256=sha(f)) for f in sorted(saves.glob('*.GMP'))])
 for key,name in [('observedRecord','Remote_Home_Observed.GPL'),('patchedRecord','Remote_Home_Input.GPL')]:
  f=profile/name
  if f.is_file():meta[key]=dict(filename=str(f),bytes=f.stat().st_size,sha256=sha(f))
 out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps({'nativeSessionTerminal':True,'nativeExitCode':code,'remoteHomeTrialCompleted':completed}),flush=True)
 raise SystemExit(code or (0 if completed else 1))
if __name__=='__main__':main()

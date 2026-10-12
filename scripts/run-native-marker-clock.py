#!/usr/bin/env python3
"""Bounded original marker leaf/callback run; no browser and no hero transfer."""
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
 p.add_argument('--attempt',type=int,required=True);p.add_argument('--phase',choices=['baseline','rebased'],required=True);a=p.parse_args()
 out=ROOT/f'output/native-marker-clock-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
 if a.attempt<1 or out.exists() or log.exists():p.error('Fresh positive attempt required')
 idle();prep_path=a.preparation.resolve();prep=json.loads(prep_path.read_text());build_path=a.build_report.resolve();build=json.loads(build_path.read_text())
 exe=GAME/'build/recomp/pop_smoke'
 if not build.get('nativeBuildQualified') or build['exitCode']!=0 or sha(exe)!=build['nativeExecutableSha256']:p.error('Current native build differs')
 if any(sha(ROOT/n)!=d for n,d in build['nativeSourceSha256'].items()):p.error('Build source changed')
 if sha(GAME/'build/recomp/gen/symbols.json')!=build['nativeSymbolsSha256']:p.error('Build symbols changed')
 if not prep.get('markerClockPreparationQualified') or [prep['sourceClockMs'],prep['destinationClockMs']]!=[25800,18250]:p.error('Missing real clock preparation')
 if any(sha(ROOT/n)!=d for n,d in prep['sourceSha256'].items()):p.error('Preparation source changed')
 source=Path(prep['source']['filename']);proposal=Path(prep['orderPayload']['filename'])
 if sha(source)!=prep['source']['sha256'] or sha(proposal)!=prep['orderPayload']['sha256'] or proposal.stat().st_size!=208:p.error('Original input changed')
 run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-marker-clock-',dir=GAME/'build'));profile=run/'frontier_0_0';profile.mkdir()
 for name,d in prep['inputHashes'].items():
  original=Path(prep['settingsProfile'])/name
  if sha(original)!=d:p.error('Settings source changed')
  target=profile/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(original,target)
  if sha(target)!=d:p.error('Copied settings differ')
 saves=profile/'Documents/My Games/MajestyHD/SaveGame';saves.mkdir(parents=True)
 copied=saves/'Marker_Starting_Realm.GMP';shutil.copy2(source,copied);shutil.copy2(proposal,profile/'Marker_Input_Orders.bin')
 if sha(copied)!=prep['source']['sha256'] or sha(profile/'Marker_Input_Orders.bin')!=prep['orderPayload']['sha256']:p.error('Copied inputs differ')
 for name in ['frames','user-mods']:(run/name).mkdir()
 click=lambda x,y:f'move {x} {y}\nwait 100\nbutton left down\nwait 100\nbutton left up\n'
 script=run/'load-marker.script';script.write_text('wait 10000\n'+click(92,578)+'wait 1000\n'+click(150,565)+'wait 6000\ndump marker_completed\n')
 meta=dict(version=1,nativeOnly=True,browserUsed=False,nativeSessionTerminal=False,nativeExitCode=None,phase=a.phase,
  fixture=str(run),profile=str(profile),preparation=str(prep_path),preparationSha256=sha(prep_path),
  source=str(source),sourceSha256=sha(source),sourceCopy=str(copied),proposal=str(proposal),proposalSha256=sha(proposal),
  inputHashes=prep['inputHashes'],buildReport=str(build_path),buildReportSha256=sha(build_path),nativeExecutableSha256=sha(exe),
  nativeSourceSha256=build['nativeSourceSha256'],nativeSymbolsSha256=build['nativeSymbolsSha256'],script=str(script),scriptSha256=sha(script),
  log=str(log),resourceSamples=[],rssCeilingBytes=512*1024*1024,stopReason=None)
 env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')};env.update(RECOMP_PROFILE_DIR=str(profile),RECOMP_RULE_FRONTIER_REGION='0_0',
  RECOMP_RULE_INVENTORY_COMPAT='1',RECOMP_BROWSER_STREAMING_DEBUG='1',RECOMP_BROWSER_STREAMING_MARKER_CLOCK_FIXTURE=a.phase,
  RECOMP_GUEST_ARGS='-nointro -dochecksums',RECOMP_SMOKE_SECONDS='35',RECOMP_SMOKE_WINDOW_INPUT='1',RECOMP_SMOKE_DRAWABLE='800x600',
  RECOMP_CORE_MODS_DIR=str(GAME/'build/recomp/mods/core'),RECOMP_MODS_DIR=str(run/'user-mods'),RECOMP_HOST_DUMP_DIR=str(run/'frames'),RECOMP_SCRIPT=str(script))
 idle()
 with log.open('x') as stream:
  proc=subprocess.Popen([str(exe)],cwd=GAME/'kit',env=env,stdout=stream,stderr=subprocess.STDOUT);meta.update(nativePid=proc.pid,startedAtMs=time.time_ns()//1000000)
  out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps({'nativePid':proc.pid,'phase':a.phase}),flush=True);deadline=time.monotonic()+33
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
 rows=[line for line in log.read_text().splitlines() if line.startswith('[streaming] Marker clock complete ')]
 completed=len(rows)==1 and 'result=pass' in rows[0]
 meta.update(nativeSessionTerminal=True,nativeExitCode=code,markerClockTrialCompleted=completed,finishedAtMs=time.time_ns()//1000000,
  originalSourceUnchanged=sha(source)==prep['source']['sha256'],sourceCopyUnchanged=sha(copied)==prep['source']['sha256'],
  originalProposalUnchanged=sha(proposal)==prep['orderPayload']['sha256'],proposalCopyUnchanged=sha(profile/'Marker_Input_Orders.bin')==prep['orderPayload']['sha256'],
  originalSettingsUnchanged=all(sha(Path(prep['settingsProfile'])/n)==d for n,d in prep['inputHashes'].items()),logSha256=sha(log),
  records=[dict(filename=str(f),bytes=f.stat().st_size,sha256=sha(f)) for f in sorted(profile.glob('Marker_[0-9][0-9][0-9]_*'))])
 out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps({'nativeSessionTerminal':True,'nativeExitCode':code,'markerClockTrialCompleted':completed}),flush=True)
 raise SystemExit(code or (0 if completed else 1))
if __name__=='__main__':main()

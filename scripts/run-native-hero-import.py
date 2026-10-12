#!/usr/bin/env python3
"""Bounded original registered-hero/effect import and whole save in an owned native profile."""
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
 p.add_argument('--attempt',type=int,required=True);a=p.parse_args()
 out=ROOT/f'output/native-hero-import-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
 if a.attempt<1 or out.exists() or log.exists():p.error('Fresh positive attempt required')
 idle();prep_path=a.preparation.resolve();prep=json.loads(prep_path.read_text());build_path=a.build_report.resolve();build=json.loads(build_path.read_text())
 exe=GAME/'build/recomp/pop_smoke'
 if not build.get('nativeBuildQualified') or build['exitCode']!=0 or sha(exe)!=build['nativeExecutableSha256']:p.error('Current native build differs')
 if any(sha(ROOT/n)!=d for n,d in build['nativeSourceSha256'].items()):p.error('Build source changed')
 if sha(GAME/'build/recomp/gen/symbols.json')!=build['nativeSymbolsSha256']:p.error('Build symbols changed')
 if not prep.get('preparedRealRegisteredHeroCapsuleQualified') or prep['sourceClocksMs']!=[25800,18250]:p.error('Missing real capsule qualification')
 if any(sha(ROOT/n)!=d for n,d in prep['sourceSha256'].items()):p.error('Capsule source changed')
 seed=json.loads(Path(prep['seedProof']).read_text())
 if sha(prep['seedProof'])!=prep['seedProofSha256']:p.error('Seed proof changed')
 source=Path(seed['inputs'][1]['filename']);expected_source=seed['inputs'][1]['sha256']
 remote=json.loads(Path(prep['remoteManifest']).read_text());settings=json.loads(Path(remote['preparation']).read_text())
 input_hashes=remote['inputHashes'];settings_profile=Path(settings['settingsProfile'])
 if sha(source)!=expected_source:p.error('Destination changed')
 code="import {compareNativeMarkerClocks as f} from './scripts/compare-native-marker-clocks.mjs';const r=await f(process.argv[1],process.argv[2]);console.log(JSON.stringify({qualified:r.crossClockNewRecruitMarkerQualified}));"
 verified=json.loads(subprocess.check_output(['node','--input-type=module','-e',code,prep['markerClockPair']['sourceManifest'],prep['markerClockPair']['rebasedManifest']],cwd=ROOT,text=True))
 if not verified['qualified']:p.error('Original marker qualification missing')
 run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-hero-import-',dir=GAME/'build'));profile=run/'frontier_1_0';profile.mkdir()
 for name,d in input_hashes.items():
  original=settings_profile/name
  if sha(original)!=d:p.error('Settings source changed')
  target=profile/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(original,target)
  if sha(target)!=d:p.error('Copied settings differ')
 saves=profile/'Documents/My Games/MajestyHD/SaveGame';saves.mkdir(parents=True)
 copied=saves/'Hero_Starting_Realm.GMP';shutil.copy2(source,copied)
 names={'unit':'Hero_Import_Hero_Proposal.UNIT','agent':'Hero_Import_Agent_Proposal.GPL','container':'Hero_Import_Container_Proposal.bin',
  'attached_503':'Hero_Import_Effect_Proposal.UNIT','attached_order_503':'Hero_Import_Orders_Proposal.bin'}
 proposals=[]
 for key,name in names.items():
  r=prep['records'][key];original=Path(r['filename'])
  if sha(original)!=r['sha256'] or original.stat().st_size!=r['bytes']:p.error('Capsule record changed')
  target=profile/name;shutil.copy2(original,target)
  if sha(target)!=r['sha256']:p.error('Copied capsule differs')
  proposals.append(dict(source=str(original),copied=str(target),sha256=r['sha256'],bytes=r['bytes']))
 if sha(copied)!=expected_source:p.error('Copied destination changed')
 for name in ['frames','user-mods']:(run/name).mkdir()
 click=lambda x,y:f'move {x} {y}\nwait 100\nbutton left down\nwait 100\nbutton left up\n'
 script=run/'load-hero-import.script';script.write_text('wait 10000\n'+click(92,578)+'wait 1000\n'+click(150,565)+'wait 6000\ndump hero_import_completed\n')
 meta=dict(version=1,nativeOnly=True,browserUsed=False,nativeSessionTerminal=False,nativeExitCode=None,phase="create",
  fixture=str(run),profile=str(profile),preparation=str(prep_path),preparationSha256=sha(prep_path),
  source=str(source),sourceSha256=expected_source,sourceCopy=str(copied),proposals=proposals,settingsProfile=str(settings_profile),
  inputHashes=input_hashes,buildReport=str(build_path),buildReportSha256=sha(build_path),nativeExecutableSha256=sha(exe),
  nativeSourceSha256=build['nativeSourceSha256'],nativeSymbolsSha256=build['nativeSymbolsSha256'],script=str(script),scriptSha256=sha(script),
  log=str(log),resourceSamples=[],rssCeilingBytes=512*1024*1024,stopReason=None)
 env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')};env.update(RECOMP_PROFILE_DIR=str(profile),RECOMP_RULE_FRONTIER_REGION='1_0',
  RECOMP_RULE_INVENTORY_COMPAT='1',RECOMP_BROWSER_STREAMING_DEBUG='1',RECOMP_BROWSER_STREAMING_HERO_IMPORT_FIXTURE="1",
  RECOMP_GUEST_ARGS='-nointro -dochecksums',RECOMP_SMOKE_SECONDS='35',RECOMP_SMOKE_WINDOW_INPUT='1',RECOMP_SMOKE_DRAWABLE='800x600',
  RECOMP_CORE_MODS_DIR=str(GAME/'build/recomp/mods/core'),RECOMP_MODS_DIR=str(run/'user-mods'),RECOMP_HOST_DUMP_DIR=str(run/'frames'),RECOMP_SCRIPT=str(script))
 idle()
 with log.open('x') as stream:
  proc=subprocess.Popen([str(exe)],cwd=GAME/'kit',env=env,stdout=stream,stderr=subprocess.STDOUT);meta.update(nativePid=proc.pid,startedAtMs=time.time_ns()//1000000)
  out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps({'nativePid':proc.pid,'phase':'create'}),flush=True);deadline=time.monotonic()+33
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
 rows=[line for line in log.read_text().splitlines() if line.startswith('[streaming] Hero import cleanup ')]
 completed=len(rows)==1 and 'result=pass' in rows[0]
 meta.update(nativeSessionTerminal=True,nativeExitCode=code,heroImportTrialCompleted=completed,finishedAtMs=time.time_ns()//1000000,
  originalSourceUnchanged=sha(source)==expected_source,sourceCopyUnchanged=sha(copied)==expected_source,
  originalProposalsUnchanged=all(sha(r['source'])==r['sha256'] for r in proposals),
  proposalCopiesUnchanged=all(sha(r['copied'])==r['sha256'] for r in proposals),
  originalSettingsUnchanged=all(sha(settings_profile/n)==d for n,d in input_hashes.items()),logSha256=sha(log),
  records=[dict(filename=str(f),bytes=f.stat().st_size,sha256=sha(f)) for f in sorted(profile.glob('Hero_Import_*')) if f.is_file()],
  saves=[dict(filename=str(f),bytes=f.stat().st_size,sha256=sha(f)) for f in sorted(saves.glob('*.GMP'))])
 out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps({'nativeSessionTerminal':True,'nativeExitCode':code,'heroImportTrialCompleted':completed}),flush=True)
 raise SystemExit(code or (0 if completed else 1))
if __name__=='__main__':main()

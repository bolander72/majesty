#!/usr/bin/env python3
"""Reload an independently qualified ordinary UI construction save for the production predicate."""
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
def verify(receipt):
 code="import {readFile} from 'node:fs/promises';import {verifyRevisionExport as v} from './scripts/export-native-entity-revision.mjs';const r=JSON.parse(await readFile(process.argv[1],'utf8')),out=[];for(let i=0;i<2;i++)out.push(await v(process.argv[1],i,r.worlds[i].sha256));console.log(JSON.stringify(out));"
 return json.loads(subprocess.check_output(['node','--input-type=module','-e',code,str(receipt)],cwd=ROOT,text=True))
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('build_report',type=Path);p.add_argument('ui_trial',type=Path);p.add_argument('ui_proof',type=Path)
 p.add_argument('--attempt',type=int,required=True);p.add_argument('--batch',action='store_true');a=p.parse_args()
 out=ROOT/f'output/native-constructed-predicate-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
 if a.attempt<1 or out.exists() or log.exists():p.error('Fresh positive attempt required')
 idle();ui_path=a.ui_trial.resolve();proof_path=a.ui_proof.resolve();ui=json.loads(ui_path.read_text());proof=json.loads(proof_path.read_text())
 if ui['phase']!='construction-ui' or ui['uiStep'] not in ['guild','temple'] or not ui['nativeSessionTerminal'] or ui['nativeExitCode']!=0 or ui['stopReason']:p.error('Require a terminal original UI construction trial')
 if proof['inputSha256']!=sha(ui_path) or proof['cooperativeChapterQualified'] or proof['browserUsed']:p.error('Construction proof mismatch')
 kind=ui['uiStep'];key='originalGuildCompletionQualified' if kind=='guild' else 'originalTempleCompletionQualified'
 if not proof[key] or proof['observed']['id']!=521 or proof['observed']['owner']!=0 or proof['observed']['completed']!=1:p.error('Require an actually completed original UI building')
 source=Path(proof['saved']['filename']);expected_source=proof['saved']['sha256']
 if not any(s['filename']==str(source) and s['sha256']==expected_source for s in ui['saves']) or sha(source)!=expected_source:p.error('Produced save mismatch')
 if not str(source.resolve()).startswith(str(Path(ui['profile']).resolve())+'/Documents/My Games/MajestyHD/SaveGame/'):p.error('Require owned UI save')
 settings_profile=Path(ui['settingsProfile']);input_hashes=ui['inputHashes']
 code="import {readFile} from 'node:fs/promises';import {verifyConnectedNativeArtifact as v} from './scripts/lib/connected-native-artifact.mjs';const u=JSON.parse(await readFile(process.argv[1],'utf8'));await v(u,JSON.parse(await readFile(u.buildReport,'utf8')));"
 subprocess.check_call(['node','--input-type=module','-e',code,str(ui_path)],cwd=ROOT)
 build_path=a.build_report.resolve();build=json.loads(build_path.read_text());exe=GAME/'build/recomp/pop_smoke'
 if not build.get('nativeBuildQualified') or build['exitCode']!=0 or sha(exe)!=build['nativeExecutableSha256']:p.error('Current native build differs')
 if any(sha(ROOT/n)!=d for n,d in build['nativeSourceSha256'].items()):p.error('Build source changed')
 if sha(GAME/'build/recomp/gen/symbols.json')!=build['nativeSymbolsSha256']:p.error('Build symbols changed')
 run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-building-constructed-',dir=GAME/'build'));profile=run/'frontier_0_0';profile.mkdir()
 for name,d in input_hashes.items():
  original=settings_profile/name
  if sha(original)!=d:p.error('Settings source changed')
  target=profile/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(original,target)
  if sha(target)!=d:p.error('Copied settings differ')
 saves=profile/'Documents/My Games/MajestyHD/SaveGame';saves.mkdir(parents=True)
 copied=saves/'Building_Objective_Input.GMP';shutil.copy2(source,copied)
 if sha(copied)!=expected_source:p.error('Copied world changed')
 for name in ['frames','user-mods']:(run/name).mkdir()
 click=lambda x,y:f'move {x} {y}\nwait 100\nbutton left down\nwait 100\nbutton left up\n'
 script=run/'load-building-objective.script';script.write_text('wait 10000\n'+click(92,578)+'wait 1000\n'+click(150,565)+'wait 12000\ndump building_objective_result\n')
 meta=dict(version=1,nativeOnly=True,browserUsed=False,nativeSessionTerminal=False,nativeExitCode=None,phase='constructed-predicate',kind=kind,batchScan=a.batch,
  fixture=str(run),profile=str(profile),uiTrial=str(ui_path),uiTrialSha256=sha(ui_path),uiProof=str(proof_path),uiProofSha256=sha(proof_path),
  source=str(source),sourceSha256=expected_source,sourceCopy=str(copied),settingsProfile=str(settings_profile),inputHashes=input_hashes,
  buildReport=str(build_path),buildReportSha256=sha(build_path),nativeExecutableSha256=sha(exe),
  nativeSourceSha256=build['nativeSourceSha256'],nativeSymbolsSha256=build['nativeSymbolsSha256'],script=str(script),scriptSha256=sha(script),
  runnerSha256=sha(Path(__file__)),nativeCampaignSourceSha256=sha(GAME/'browser_campaign.cpp'),log=str(log),resourceSamples=[],rssCeilingBytes=512*1024*1024,stopReason=None)
 if sha(source)!=expected_source or sha(ui_path)!=meta['uiTrialSha256'] or sha(proof_path)!=meta['uiProofSha256']:p.error('Construction evidence changed before launch')
 env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')};env.update(RECOMP_PROFILE_DIR=str(profile),RECOMP_RULE_FRONTIER_REGION='0_0',
  RECOMP_RULE_INVENTORY_COMPAT='1',RECOMP_BROWSER_STREAMING_DEBUG='1',RECOMP_BROWSER_CAMPAIGN_BUILDING_FIXTURE='batch-v1' if a.batch else 'constructed-v1',
  RECOMP_GUEST_ARGS='-nointro -dochecksums',RECOMP_SMOKE_SECONDS='35',RECOMP_SMOKE_WINDOW_INPUT='1',RECOMP_SMOKE_DRAWABLE='800x600',
  RECOMP_CORE_MODS_DIR=str(GAME/'build/recomp/mods/core'),RECOMP_MODS_DIR=str(run/'user-mods'),RECOMP_HOST_DUMP_DIR=str(run/'frames'),RECOMP_SCRIPT=str(script))
 idle()
 with log.open('x') as stream:
  proc=subprocess.Popen([str(exe)],cwd=GAME/'kit',env=env,stdout=stream,stderr=subprocess.STDOUT);meta.update(nativePid=proc.pid,startedAtMs=time.time_ns()//1000000)
  out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps({'nativePid':proc.pid,'phase':'constructed-predicate','kind':kind}),flush=True);deadline=time.monotonic()+45
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
 rows=[line for line in log.read_text().splitlines() if line.startswith('[campaign-fixture] Constructed predicate completed ')]
 completed=len(rows)==1 and 'result=pass' in rows[0]
 meta.update(nativeSessionTerminal=True,nativeExitCode=code,constructedPredicateCompleted=completed,finishedAtMs=time.time_ns()//1000000,
  originalSourceUnchanged=sha(source)==expected_source,sourceCopyUnchanged=sha(copied)==expected_source,
  originalSettingsUnchanged=all(sha(settings_profile/n)==d for n,d in input_hashes.items()),
  uiEvidenceUnchanged=sha(ui_path)==meta['uiTrialSha256'] and sha(proof_path)==meta['uiProofSha256'],logSha256=sha(log),
  records=[dict(filename=str(f),bytes=f.stat().st_size,sha256=sha(f)) for f in sorted(profile.glob('Hero_Return_Pair_*.GPL'))],
  saves=[dict(filename=str(f),bytes=f.stat().st_size,sha256=sha(f)) for f in sorted(saves.glob('*.GMP'))])
 out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps({'nativeSessionTerminal':True,'nativeExitCode':code,'constructedPredicateCompleted':completed,'kind':kind}),flush=True)
 raise SystemExit(code or (0 if completed else 1))
if __name__=='__main__':main()

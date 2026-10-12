#!/usr/bin/env python3
"""Offline refusal checks for actual source/destination script namespace evidence."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('source_manifest',type=Path);p.add_argument('destination_manifest',type=Path);p.add_argument('--output',type=Path,required=True);args=p.parse_args()
 if args.output.exists():raise ValueError('Preserve previous script controls')
 spec=importlib.util.spec_from_file_location('script_controls',ROOT/'scripts/check-native-actor-script-witness.py')
 verifier=importlib.util.module_from_spec(spec);spec.loader.exec_module(verifier)
 positive=verifier.verify(args.source_manifest,args.destination_manifest)
 evidence=Path(tempfile.mkdtemp(prefix='native-script-witness-controls-',dir=ROOT/'output'))
 metas=[positive['source']['fixture'],positive['destination']['fixture']]
 logs=[Path(meta['log']).read_text()for meta in metas]
 controls=[
  (0,'missing-source-leader',re.sub(r'^\[streaming\] Script witness side=0 unit=2073 .*\n','',logs[0],count=1,flags=re.M)),
  (0,'missing-source-follower',re.sub(r'^\[streaming\] Script witness side=0 unit=2101 .*\n','',logs[0],count=1,flags=re.M)),
  (1,'missing-destination-leader',re.sub(r'^\[streaming\] Script witness .*\n','',logs[1],count=1,flags=re.M)),
  (0,'wrong-source-agent',logs[0].replace('unit=2101 agent=37','unit=2101 agent=38',1)),
  (1,'source-id-used-as-destination-agent',logs[1].replace('unit=497 agent=2','unit=497 agent=12',1)),
  (0,'unresolved-original-reference',logs[0].replace('refs=4 resolved=4','refs=4 resolved=3',1)),
  (0,'missing-backlink-warm',logs[0].replace('backlinks=5','backlinks=4',1)),
  (0,'wrong-source-clock',re.sub(r'(Script witness .*?clock=)4000',r'\g<1>4001',logs[0],count=1)),
  (1,'wrong-destination-clock',re.sub(r'(Script witness .*?clock=)8650',r'\g<1>8651',logs[1],count=1)),
  (0,'wrong-typed-value-count',re.sub(r'(Script witness .*?values=)52',r'\g<1>51',logs[0],count=1)),
  (0,'writer-mismatch',re.sub(r'(Script witness .*?)equal=1',r'\1equal=0',logs[0],count=1)),
  (0,'changed-header',re.sub(r'(Script witness .*?)preserved=1',r'\1preserved=0',logs[0],count=1)),
  (0,'retained-heap',re.sub(r'(Script witness .*?)heap-same=1',r'\1heap-same=0',logs[0],count=1)),
  (0,'changed-pool',re.sub(r'(Script witness .*?)pool-same=1',r'\1pool-same=0',logs[0],count=1)),
  (0,'changed-queue',re.sub(r'(Script witness .*?)queues-same=1',r'\1queues-same=0',logs[0],count=1)),
 ]
 results=[]
 for side,name,changed in controls:
  if changed==logs[side]:raise ValueError('Control did not change evidence')
  log=evidence/f'{name}.log';log.write_text(changed)
  manifest=evidence/f'{name}.json';manifest.write_text(json.dumps(dict(metas[side],log=str(log))))
  paths=[args.source_manifest,args.destination_manifest];paths[side]=manifest
  try:verifier.verify(*paths)
  except ValueError as error:results.append(dict(control=name,rejected=True,reason=str(error)))
  else:raise ValueError('Invalid original script evidence accepted: '+name)
 original_read=Path.read_bytes
 source_row=positive['source']['observations'][1];destination_row=positive['destination']['observations'][0]
 checks=[(0,'changed-source-self-reference',source_row['references'][0]['offset'],2101),
         (0,'changed-source-context-clock',source_row['contexts'][0]['offset']+4,2101),
         (0,'changed-source-script-destination',source_row['coordinatePairs'][1]['offset'],2101),
         (1,'changed-destination-script-native-link',destination_row['nativeOffset'],497)]
 for side,name,offset,unit_id in checks:
  writer=Path(metas[side]['profile'])/f'Script_Witness_{side}_{unit_id}.bin';raw=writer.read_bytes();changed=bytearray(raw);changed[offset]^=1
  def altered(path):return bytes(changed)if path==writer else original_read(path)
  with patch.object(Path,'read_bytes',altered):
   try:verifier.verify(args.source_manifest,args.destination_manifest)
   except ValueError as error:results.append(dict(control=name,rejected=True,reason=str(error)))
   else:raise ValueError('Changed actual native script writer accepted')
  if writer.read_bytes()!=raw:raise ValueError('Offline control changed actual writer artifact')
 # Recompute a forged descriptor's hash so independent typed decoding must
 # catch semantic metadata corruption rather than only a digest mismatch.
 for name,field in [('forged-context-descriptor','contexts'),('forged-pair-descriptor','coordinatePairs')]:
  descriptor=metas[0]['scriptPack'];metadata=json.loads(Path(descriptor['metadata']).read_text());row=metadata['cases'][1]
  if field=='contexts':row[field][0]['state'][1]+=1
  else:row[field][1]['words'][0]+=1
  fake_metadata=evidence/f'{name}-metadata.json';fake_metadata.write_text(json.dumps(metadata))
  fake_descriptor=dict(descriptor,metadata=str(fake_metadata),metadataSha256=hashlib.sha256(fake_metadata.read_bytes()).hexdigest())
  manifest=evidence/f'{name}.json';manifest.write_text(json.dumps(dict(metas[0],scriptPack=fake_descriptor)))
  try:verifier.verify(manifest,args.destination_manifest)
  except ValueError as error:results.append(dict(control=name,rejected=True,reason=str(error)))
  else:raise ValueError('Forged typed script metadata accepted')
 for attempt in [2,3]:
  try:verifier.verify(ROOT/f'output/native-actor-cross-source-attempt-{attempt:03}.json',args.destination_manifest)
  except ValueError as error:results.append(dict(control=f'actual-cold-cache-failed-attempt-{attempt:03}',rejected=True,reason=str(error)))
  else:raise ValueError('Failed cold-cache witness accepted')
 for side,name,manifest in [(0,'actual-source-without-script-witness',ROOT/'output/native-actor-cross-source-attempt-001.json'),
                            (1,'actual-destination-without-script-witness',ROOT/'output/native-actor-cross-destination-attempt-017.json')]:
  paths=[args.source_manifest,args.destination_manifest];paths[side]=manifest
  try:verifier.verify(*paths)
  except ValueError as error:results.append(dict(control=name,rejected=True,reason=str(error)))
  else:raise ValueError('Actual predecessor without scripts accepted')
 before=set((ROOT/'upstream/majesty-recomp/build').glob('actor-arrival-fixture-stage-populated-*'))
 rejected=subprocess.run([sys.executable,str(ROOT/'scripts/run-native-actor-populated-stage-fixture.py'),str(args.source_manifest),
                          '--attempt','995','--script-witness'],capture_output=True,text=True)
 if rejected.returncode==0 or 'nativePid' in rejected.stdout or 'Script witness requires'not in rejected.stderr or before!=set((ROOT/'upstream/majesty-recomp/build').glob('actor-arrival-fixture-stage-populated-*')):
  raise ValueError('Invalid script mode created or launched a fixture')
 results.append(dict(control='script-witness-without-cross-world-fixture',rejected=True,launched=False))
 with args.output.open('x')as f:json.dump(dict(qualified=True,controls=results,nativeProcessesStarted=0,browserUsed=False,
   originalEvidenceModified=False,evidence=str(evidence)),f,indent=2);f.write('\n')
 print(json.dumps(dict(rejected=len(results),nativeProcessesStarted=0)))

if __name__=='__main__':main()

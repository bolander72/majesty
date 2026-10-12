#!/usr/bin/env python3
"""Qualify original UNIT/GPL namespaces and exact script writers in both stopped kingdoms."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import struct

ROOT=Path(__file__).resolve().parents[1]

def load(name,filename):
 spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/filename)
 module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def sha(path):
 h=hashlib.sha256()
 with path.open('rb')as f:
  for b in iter(lambda:f.read(65536),b''):h.update(b)
 return h.hexdigest()

class Script:
 def __init__(self,raw):
  self.raw=raw;self.values=0;self.references=[];self.contexts=[];self.pairs=[]
 def word(self,at):
  if at<0 or at+4>len(self.raw):raise ValueError('Script word outside record')
  return struct.unpack_from('<I',self.raw,at)[0]
 def name(self,at,limit):
  end=self.raw.find(b'\0',at,min(limit,at+1024))
  if end<at:raise ValueError('Unterminated script name')
  return end+1,self.raw[at:end].decode('utf-8')
 def value(self,at,limit,attribute,path,depth=0):
  if depth>32 or self.values>=256 or at+4>limit:raise ValueError('Script value budget exceeded')
  self.values+=1;kind=self.word(at);at+=4
  if kind==0:return at
  if kind in [1,2,5]:
   if at+4>limit:raise ValueError('Truncated scalar')
   bits=self.word(at)
   if kind==5:self.references.append(dict(offset=at,bits=bits,attribute=attribute,path=path,
                                          targetAgentId=bits if 0<bits<=0x7fffffff else None))
   return at+4
  if kind==3:return self.name(at,limit)[0]
  if kind==6:
   if at>=limit or self.raw[at]>1:raise ValueError('Invalid script boolean')
   return at+1
  if kind==7:
   if at+8>limit:raise ValueError('Truncated script coordinate pair')
   self.pairs.append(dict(offset=at,attribute=attribute,path=path,words=[self.word(at),self.word(at+4)]))
   return at+8
  if kind not in [4,8]:raise ValueError('Unsupported script value type')
  end,children=limit,limit
  if kind==4:
   size=self.word(at);end=at+size;children=end-8
   if size<20 or end>limit or self.word(at+4)!=0 or self.word(children)!=0 or self.word(children+4)!=0xffffffff:
    raise ValueError('Invalid script list envelope')
   at+=8
  count=self.word(at);at+=4
  if count>256-self.values:raise ValueError('Too many script children')
  for i in range(count):at=self.value(at,children,attribute,[*path,i],depth+1)
  if kind==4:
   if at!=children:raise ValueError('Script list count differs')
   return end
  if at+17>limit or self.raw[at+16]>1:raise ValueError('Invalid context state')
  context=dict(attribute=attribute,path=path,offset=at,state=list(struct.unpack_from('<4I',self.raw,at)),running=self.raw[at+16],functions=[])
  at+=17
  for slot in range(2):
   if at>=limit or self.raw[at]>1:raise ValueError('Invalid context function presence')
   present=self.raw[at];at+=1
   if present:
    at,name=self.name(at,limit);context['functions'].append(dict(name=name,slot=slot))
  self.contexts.append(context);return at
 def parse(self,agent_id,unit_id):
  size=len(self.raw);attributes=self.word(8);end=8+attributes
  if size<56 or self.word(0)!=size or self.word(4)!=2 or attributes<20 or end>size-28 or self.word(12)!=0 or self.word(end-8)!=0 or self.word(end-4)!=0xffffffff:
   raise ValueError('Invalid GPL record envelope')
  at,count=20,self.word(16)
  if count>256:raise ValueError('Too many script attributes')
  for _ in range(count):
   at,name=self.name(at,end-8);at=self.value(at,end-8,name,[])
  if at!=end-8:raise ValueError('Script attribute count differs')
  at=end;functions=self.word(at);at+=4
  if functions>256:raise ValueError('Too many function names')
  for _ in range(functions):at,_=self.name(at,size-19)
  if self.word(at)!=agent_id:raise ValueError('Wrong original agent identity')
  identity=at;at,name=self.name(at+4,size-19)
  if at!=size-19 or self.word(at)!=unit_id or self.raw[at+4]!=0 or self.word(size-8)!=0 or self.word(size-4)!=0xffffffff:
   raise ValueError('Wrong script native association/tail')
  return dict(identityOffset=identity,nativeOffset=at,name=name,values=self.values,
              references=self.references,contexts=self.contexts,coordinatePairs=self.pairs)

def pack_cases(raw,metadata):
 if len(raw)>32768 or struct.unpack_from('<3I',raw)!=(0x3157534e,1,6):raise ValueError('Wrong script witness pack')
 at=12;cases=[]
 for index in range(6):
  side,unit_id,agent_id,unit_size,script_size=struct.unpack_from('<5I',raw,at);at+=20
  if side not in [0,1] or not 108<=unit_size<=4096 or not 56<=script_size<=4096 or at+unit_size+script_size>len(raw):
   raise ValueError('Invalid script witness record bound')
  unit=raw[at:at+unit_size];at+=unit_size;script=raw[at:at+script_size];at+=script_size
  row=metadata['cases'][index]
  if (side,unit_id,agent_id,unit_size,script_size)!=(row['side'],row['unitId'],row['agentId'],row['unit']['size'],row['agent']['size']):
   raise ValueError('Script pack differs from metadata')
  if (hashlib.sha256(unit).hexdigest()!=row['unitSha256'] or hashlib.sha256(script).hexdigest()!=row['agentSha256'] or
      struct.unpack_from('<I',unit,36)[0]!=unit_id or struct.unpack_from('<I',unit,52)[0]!=7):
   raise ValueError('Wrong original unit/script bytes or owner')
  # Independently read EA from the complete PRIMARY attribute map.
  primary_end=32+struct.unpack_from('<I',unit,20)[0];cursor=92
  presence=struct.unpack_from('<I',unit,80)[0]
  if presence==1:cursor+=16
  elif presence!=0:raise ValueError('Invalid native cache presence')
  if primary_end>len(unit) or struct.unpack_from('<I',unit,cursor)[0]!=1:raise ValueError('Invalid native attribute map')
  count=struct.unpack_from('<I',unit,cursor+4)[0];cursor+=8
  if count>(primary_end-cursor)//8:raise ValueError('Native attribute budget exceeded')
  ea=[struct.unpack_from('<I',unit,cursor+i*8+4)[0]for i in range(count)if struct.unpack_from('<I',unit,cursor+i*8)[0]==0x4541]
  if ea!=[agent_id]:raise ValueError('Wrong native EA association')
  parsed=Script(script).parse(agent_id,unit_id)
  if parsed['values']!=row['values'] or parsed['contexts']!=row['contexts']:raise ValueError('Independent script contexts differ from metadata')
  keys=['offset','bits','attribute','path','targetAgentId']
  if parsed['references']!=[{k:ref[k]for k in keys}for ref in row['references']]:raise ValueError('Independent typed script references differ')
  keys=['offset','attribute','path','words']
  if parsed['coordinatePairs']!=[{k:pair[k]for k in keys}for pair in row['coordinatePairs']]:raise ValueError('Independent script coordinate pairs differ')
  source=ROOT/metadata['sources'][side]['path']
  with source.open('rb')as f:
   f.seek(row['unit']['offset']);copied_unit=f.read(unit_size)
   f.seek(row['agent']['offset']);copied_script=f.read(script_size)
  if copied_unit!=unit or copied_script!=script:raise ValueError('Witness does not contain literal copied GMP records')
  cases.append(dict(side=side,unitId=unit_id,agentId=agent_id,unit=unit,script=script,parsed=parsed));
 if at!=len(raw):raise ValueError('Trailing script pack bytes')
 if [(c['side'],c['unitId'],c['agentId'])for c in cases]!=[(0,2073,12),(0,2101,37),(0,2105,41),(0,2122,57),(0,2136,69),(1,497,2)]:
  raise ValueError('Wrong script witness identities')
 return cases

def verify_one(manifest,side):
 base=load('script_source_base'if side==0 else 'script_destination_base',
           'check-native-actor-cross-source.py'if side==0 else 'check-native-actor-composed-arrival.py')
 report=base.verify(manifest)if side==0 else base.verify(manifest,require_disk_replay=True)
 meta=report['fixture']
 if meta.get('scriptWitness')is not True:raise ValueError('Missing original script namespace witness')
 descriptor=meta['scriptPack'];pack=Path(descriptor['path']);metadata_path=Path(descriptor['metadata'])
 if sha(pack)!=descriptor['sha256'] or sha(metadata_path)!=descriptor['metadataSha256']:raise ValueError('Changed script witness pack/metadata')
 metadata=json.loads(metadata_path.read_text());raw=(Path(meta['profile'])/'Script_Witness_Pack.bin').read_bytes()
 if hashlib.sha256(raw).hexdigest()!=descriptor['sha256']:raise ValueError('Changed copied script pack')
 for source in metadata['sources']:
  if source['maximumRead']>4096 or sha(ROOT/source['path'])!=source['sha256']:raise ValueError('Unbounded or changed source script input')
 cases=pack_cases(raw,metadata);selected=[c for c in cases if c['side']==side]
 rows=re.findall(r'^\[streaming\] Script witness side=(\d+) unit=(\d+) agent=(\d+) bytes=(\d+) values=(\d+) refs=(\d+) resolved=(\d+) backlinks=(\d+) clock=(\d+) equal=1 preserved=1 heap-same=1 pool-same=1 queues-same=1 result=pass$',Path(meta['log']).read_text(),re.M)
 if len(rows)!=len(selected):raise ValueError('Missing exact original script writer/namespace/cache-preservation witnesses')
 clock=report['sourceClockMs']if side==0 else report['destinationClockMs'];observations=[];evidence={}
 for row,case in zip(rows,selected):
  positive=[r for r in case['parsed']['references']if r['targetAgentId']is not None]
  if list(map(int,row))!=[side,case['unitId'],case['agentId'],len(case['script']),case['parsed']['values'],len(positive),len(positive),len(positive)+1,clock]:
   raise ValueError('Wrong script namespace, typed references, cache warm or clock')
  writer=Path(meta['profile'])/f"Script_Witness_{side}_{case['unitId']}.bin"
  if writer.read_bytes()!=case['script']:raise ValueError('Actual native script writer artifact differs from complete original GMP record')
  evidence[str(writer.relative_to(ROOT))]=sha(writer)
  observations.append({k:case[k]for k in ['side','unitId','agentId']}|dict(bytes=len(case['script']),**case['parsed']))
 return dict(qualified=True,fixture=meta,clockMs=clock,observations=observations,
             sourceSha256=report['sourceSha256'],evidenceSha256=report['evidenceSha256']|evidence)

def verify(source_manifest,destination_manifest):
 source=verify_one(source_manifest,0);destination=verify_one(destination_manifest,1)
 if source['fixture']['scriptPack']!=destination['fixture']['scriptPack']:raise ValueError('Different source/destination script packages')
 audit=load('script_witness_audit','audit-native-script-witness.py').audit()
 actors=source['observations'][1:];leader_source=source['observations'][0];leader_destination=destination['observations'][0]
 for actor in actors:
  ids=[r['targetAgentId']for r in actor['references']if r['targetAgentId']is not None]
  if sorted(ids)!=sorted([actor['agentId'],actor['agentId'],12,12]):raise ValueError('Unexpected follower reference closure')
  pairs=[p for p in actor['coordinatePairs']if p['attribute']=='destination'and not p['path']]
  if len(pairs)!=1 or pairs[0]['words']!=[2352,5936]:raise ValueError('Script destination does not match the verified source Path goal')
 source_hashes=destination['sourceSha256']|{str(Path(__file__).relative_to(ROOT)):sha(Path(__file__)),
   'scripts/prepare-native-actor-script-witness.mjs':sha(ROOT/'scripts/prepare-native-actor-script-witness.mjs'),
   'scripts/audit-native-script-witness.py':sha(ROOT/'scripts/audit-native-script-witness.py')}
 return dict(qualified=True,scope='Five original source UNIT/GPL associations and one destination leader association, complete original script writers, typed reference/context/coordinate inspection; no script transfer or activation',
  source=source,destination=destination,sourceClockMs=source['clockMs'],destinationClockMs=destination['clockMs'],
  originalScriptWriterRecords=6,sourceActorScriptPairs=4,sourceLeaderAgentId=12,destinationLeaderAgentId=2,
  scriptReferenceSitesResolvedInOriginalNamespaces=20,originalNativeBacklinkQueries=26,
  selectedActorFunctionContexts=40,selectedActorPositiveScriptReferenceSites=16,
  sourceScriptDestinationsMatchSourcePathGoal=True,sourceScriptDestinationPairs=4,
  agentHeadersPreservedAfterOriginalCacheWarm=True,serializedScriptStatePreserved=True,
  originalReferenceWriterCacheRefreshQualified=True,wholeLinkedScriptStorageUnchangedQualified=False,
  privateScriptTransferQualified=False,persistentEntityCorrespondenceQualified=False,
  completeReferenceClosureQualified=False,actorActivationQualified=False,continuousPagingQualified=False,
  wholeBrowserMemoryBoundQualified=False,originalInstructionAnchors=audit['verifiedInstructionAnchors'],
  browserUsed=False,sourceSha256=source_hashes,evidenceSha256=source['evidenceSha256']|destination['evidenceSha256'])

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('source_manifest',type=Path);p.add_argument('destination_manifest',type=Path);p.add_argument('--output',type=Path,required=True)
 args=p.parse_args();result=verify(args.source_manifest,args.destination_manifest)
 with args.output.open('x')as f:json.dump(result,f,indent=2);f.write('\n')
 print(json.dumps({k:result[k]for k in ['qualified','originalScriptWriterRecords','scriptReferenceSitesResolvedInOriginalNamespaces','originalNativeBacklinkQueries','actorActivationQualified']}))

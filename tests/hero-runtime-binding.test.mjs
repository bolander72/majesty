import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {selectedHeroRuntimeBinding,parseHeroRuntimeBinding,selectedHeroHaloBinding,parseHeroHaloBinding} from '../web/world/hero-runtime-binding.mjs';
import {haloRegionLayout} from '../web/world/halo-region-layout.mjs';

const identity={version:2,actor:{family:'VHCL',description:827086401,playerNumber:0},
  registeredHome:{home:{description:827736641}}};
const entry={region:'0_0',alias:{unitId:513,agentId:29},homeAlias:{kind:'native',unitId:469,agentId:7},world:{sha256:'a'.repeat(64)}};
const text=selectedHeroRuntimeBinding(identity,entry,113500);
test('runtime binding uses current aliases and saved clock, including a selected remote proxy',()=>{
  assert.equal(text,'majesty-hero-runtime-v1|0_0|113500|513|29|827086401|0|native|469|7|827736641|'+'a'.repeat(64));
  const remote=selectedHeroRuntimeBinding(identity,{...entry,region:'1_0',alias:{unitId:537,agentId:37},
    homeAlias:{kind:'proxy',unitId:0,agentId:34}},4050);
  assert.deepEqual([parseHeroRuntimeBinding(remote).unitId,parseHeroRuntimeBinding(remote).homeKind],[537,'proxy']);
  assert.ok(text.length<=256);assert.ok(Object.isFrozen(parseHeroRuntimeBinding(text)));
});
test('malformed binding input rejects ambiguous regions, numbers, aliases and snapshot identities',()=>{
  const changes={0:['','majesty-hero-runtime-v2'],1:['00_0','1000001_0','0_0_0'],2:['-1','1.5','01','4294967296'],
    3:['0','469'],4:['0','2147483648','7'],5:['0'],6:['8','-1'],7:['other'],8:['0','513'],9:['0','29'],10:['0'],11:['A'.repeat(64),'a'.repeat(65)]};
  for(const [index,values] of Object.entries(changes))for(const value of values){const f=text.split('|');f[index]=value;
    assert.throws(()=>parseHeroRuntimeBinding(f.join('|')),undefined,`${index}/${value}`);}
  for(const value of [null,{},text+'|extra',text+'\n','a'.repeat(257)])assert.throws(()=>parseHeroRuntimeBinding(value));
  assert.throws(()=>selectedHeroRuntimeBinding({...identity,version:1},entry,0));
});
test('staged engine environment excludes URL binding overrides and carries only the prepared binding',async()=>{
  const raw=await readFile('upstream/majesty-recomp/kit/web/player/index.html','utf8');
  const stage=input=>spawnSync('python3',['-c',"import runpy,sys;sys.stdout.write(runpy.run_path('scripts/stage-world.py')['stage_player'](sys.stdin.read()))"],{input,encoding:'utf8'});
  const result=stage(raw);assert.equal(result.status,0,result.stderr);assert.equal(stage(result.stdout).stdout,result.stdout);
  const code=result.stdout.match(/preRun: \[\(\) => \{([\s\S]*?)\n    \}\],/)[1];
  for(const binding of [null,text]){
    const env={RECOMP_FRONTIER_HERO_BINDING:'old',RECOMP_FRONTIER_HERO_HALO_BINDING:'old',RECOMP_FRONTIER_HERO_OWNER_MANIFEST:'old'};
    const halo=binding?'majesty-hero-halo-v1|0_0|'+'a'.repeat(64):null;
    runInNewContext(code,{Module:{ENV:env},URLSearchParams,location:{search:'?RECOMP_FRONTIER_HERO_BINDING=forged&RECOMP_FRONTIER_HERO_HALO_BINDING=forged&RECOMP_FRONTIER_HERO_OWNER_MANIFEST=forged',protocol:'http:',hostname:'localhost'},
      id:'majesty',game:{},contentIdentity:{session:'session',checkpoint:'content'},multiplayerProfile:null,frontierProfilePath:'native-world-test/frontier_0_0',heroRuntimeBinding:binding,heroHaloBinding:halo,
      heroRestoreReceipt:binding?{ownerManifest:'verified-owner-head'}:null});
    if(binding)assert.equal(env.RECOMP_FRONTIER_HERO_BINDING,binding);else assert.equal(Object.hasOwn(env,'RECOMP_FRONTIER_HERO_BINDING'),false);
    if(halo)assert.equal(env.RECOMP_FRONTIER_HERO_HALO_BINDING,halo);else assert.equal(Object.hasOwn(env,'RECOMP_FRONTIER_HERO_HALO_BINDING'),false);
    if(binding)assert.equal(env.RECOMP_FRONTIER_HERO_OWNER_MANIFEST,'verified-owner-head');else assert.equal(Object.hasOwn(env,'RECOMP_FRONTIER_HERO_OWNER_MANIFEST'),false);
  }
  const prior=result.stdout.replace(' && k !== "RECOMP_FRONTIER_HERO_OWNER_MANIFEST"','')
    .replace('\n      if (heroRestoreReceipt?.ownerManifest) m.ENV.RECOMP_FRONTIER_HERO_OWNER_MANIFEST = heroRestoreReceipt.ownerManifest;\n      else delete m.ENV.RECOMP_FRONTIER_HERO_OWNER_MANIFEST;','')
    .replace('const heroRestoreReceipt = prepareHeroRestore ? await prepareHeroRestore(contentIdentity.checkpoint, {signal}) : null;\n  const heroRuntimeBinding = heroRestoreReceipt?.runtimeBinding ?? null;\n  const heroHaloBinding = heroRestoreReceipt?.haloBinding ?? null;',
    'const heroRuntimeBinding = prepareHeroRestore ? (await prepareHeroRestore(contentIdentity.checkpoint, {signal})).runtimeBinding : null;')
    .replace(' && k !== "RECOMP_FRONTIER_HERO_HALO_BINDING"','')
    .replace('\n      if (heroHaloBinding) m.ENV.RECOMP_FRONTIER_HERO_HALO_BINDING = heroHaloBinding;\n      else delete m.ENV.RECOMP_FRONTIER_HERO_HALO_BINDING;','');
  assert.equal(stage(prior).stdout,result.stdout,'previous binding bridge upgrades with the halo capability');
  const legacy=prior.replace('const heroRuntimeBinding = prepareHeroRestore ? (await prepareHeroRestore(contentIdentity.checkpoint, {signal})).runtimeBinding : null;',
    'if (prepareHeroRestore) await prepareHeroRestore(contentIdentity.checkpoint, {signal});').replace(
      ' && k !== "RECOMP_FRONTIER_HERO_BINDING"','').replace('\n      if (heroRuntimeBinding) m.ENV.RECOMP_FRONTIER_HERO_BINDING = heroRuntimeBinding;\n      else delete m.ENV.RECOMP_FRONTIER_HERO_BINDING;','');
  assert.equal(stage(legacy).stdout,result.stdout,'previous hero startup upgrades to the same binding bridge');
});
test('halo capsules bind the checked geometry to the exact selected snapshot',()=>{
  const layout={...haloRegionLayout('0_0'),verifiedVertices:16641,sharedVertices:2480};
  const capsule=selectedHeroHaloBinding(text,layout);
  assert.equal(capsule,'majesty-hero-halo-v1|0_0|'+'a'.repeat(64));
  assert.equal(parseHeroHaloBinding(capsule,text).version,'halo-v1');
  for(const change of [{key:'1_0'},{version:'legacy'},{sharedVertices:0},{verifiedVertices:0},
    {native:{...layout.native,originX:0}}])assert.throws(()=>selectedHeroHaloBinding(text,{...layout,...change}));
  for(const value of [null,capsule+'\n',capsule.replace('0_0','1_0'),capsule.replace('a'.repeat(64),'b'.repeat(64))])
    assert.throws(()=>parseHeroHaloBinding(value,text));
});

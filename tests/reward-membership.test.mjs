import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,world,source} from './fixtures/registered-hero-world.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
async function verify(options){const f=await fixture();return verifyRegisteredHeroSnapshot(f.identity,f.aliases[0],f.homeAliases[0],source(world(0,true,{reward:options})),true,'0_0');}
test('hero keeps its one registered guild while pursuing a reciprocally registered Explore reward',async()=>{await verify({});});
for(const [name,reward,pattern]of [
 ['another model',{description:77},/another native home/],
 ['another kingdom',{player:1},/another native home/],
 ['dead flag',{state:549},/another native home/],
 ['flag with physical parent',{parent:469},/another native home/],
 ['missing script membership',{scriptMembers:[]},/script membership differs/],
 ['wrong script hero',{scriptMembers:[17]},/script membership differs/],
 ['duplicate script hero',{scriptMembers:[27,27]},/script member/],
 ['missing native membership',{nativeMembers:[]},/native membership differs/],
 ['wrong native hero',{nativeMembers:[999]},/native membership differs/],
 ['duplicate native hero',{nativeMembers:[502,502]},/native member/],
 ['invalid member flags',{nativeMembers:[{id:502,flags:3}]},/native member/],
 ['duplicate hero association',{duplicate:true},/reward association/],
])test(`Explore association rejects ${name}`,async()=>{await assert.rejects(verify(reward),pattern);});

test('remote hero keeps the registered pure home proxy while associated with an Explore flag',async()=>{
  const f=await fixture();
  await verifyRegisteredHeroSnapshot(f.identity,f.aliases[1],f.homeAliases[1],
    source(world(1,true,{registration:f.registration,reward:{}})),true,'1_0');
});
for(const[name,reward]of [
  ['foreign flag',{player:1}],['broken script roster',{scriptMembers:[]}],['local guild model',{description:77}],
  ['missing native roster',{nativeMembers:[]}],
])test(`remote hero rejects ${name} in place of its registered home`,async()=>{
  const f=await fixture();
  await assert.rejects(verifyRegisteredHeroSnapshot(f.identity,f.aliases[1],f.homeAliases[1],
    source(world(1,true,{registration:f.registration,reward})),true,'1_0'),/cannot borrow/);
});

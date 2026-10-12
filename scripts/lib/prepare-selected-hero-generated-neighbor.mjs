// Prepare a real generated checkpoint for the existing original actor importer.
// Pure home projection is a bounded reader view; no game save is rewritten and
// no actor/home is registered until the separate native admission consumes it.
import assert from 'node:assert/strict';
import {stoppedFileSource} from './stopped-entity-io.mjs';
import {parseHeroRuntimeBinding} from '../../web/world/hero-runtime-binding.mjs';
import {registeredHeroHome} from '../../web/world/entity-home-ownership.mjs';
import {prepareOrReuseRemoteHomeAgent} from '../../web/world/remote-home-cache.mjs';
import {withProposedRemoteHome} from '../../web/world/remote-home-projection.mjs';
import {prepareSelectedHeroNeighborArrival} from '../../web/world/hero-home-arrival-package.mjs';
import {checkpointNextAgentId} from '../../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../../web/world/saved-clock.mjs';
import {Sha256} from '../../web/world/sha256.mjs';

export async function prepareSelectedHeroGeneratedNeighbor(store,bindingText,crossing,generated){
 const binding=parseHeroRuntimeBinding(bindingText),identity=store.identity,home=registeredHeroHome(identity);
 assert.equal(crossing.region,binding.region);assert.equal(crossing.unitId,binding.unitId);assert.equal(crossing.agentId,binding.agentId);
 assert.notEqual(crossing.target,identity.registeredHome.home.region);
 const source=await stoppedFileSource(generated.filename);assert.equal(source.size,generated.bytes);
 const clock=await checkpointSavedClock(source);assert.ok(clock>0,'Generated destination must be initialized through original ticks');
 const nextAgentId=await checkpointNextAgentId(source);
 assert.ok(nextAgentId>0&&nextAgentId<0x7ffffffe);
 const prepared=await prepareOrReuseRemoteHomeAgent(source,home,{worldId:identity.registeredHome.worldId,
  contentDigest:identity.contentDigest,destinationRegion:crossing.target,freshAgentId:nextAgentId});
 assert.equal(prepared.plan.admission,'reserve-new');
 let projection;
 const arrival=await store.withOwner(async selected=>{
  assert.equal(selected.owner.region,crossing.region);assert.equal(selected.owner.unitId,binding.unitId);assert.equal(selected.owner.agentId,binding.agentId);
  assert.equal(await checkpointSavedClock(selected.source),crossing.clock);
  return withProposedRemoteHome(source,home,prepared,async projected=>{
   projection=projected.plan;
   return prepareSelectedHeroNeighborArrival(identity,{regions:[crossing.region,crossing.target],
    entries:[selected.entry,{region:crossing.target,alias:{unitId:100000,agentId:1000},
      homeAlias:{kind:'proxy',unitId:0,agentId:prepared.plan.proposedAgentId}}],
    sources:[selected.source,projected.source]},crossing);
  });
 });
 const packSha256=new Sha256().update(arrival.pack).hex();
 return {home:prepared,arrival,projection,packSha256,destinationClock:clock};
}

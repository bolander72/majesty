// Prepare the original importer's bounded four-record native-guild capsule.
// Inputs belong to a selected destination lease; this neither writes a world
// nor reserves the actual native IDs. The importer assigns those after load.
import {prepareCheckpointRegisteredHeroArrival,MAX_ARRIVAL_TOTAL_RECORD_BYTES} from './arrival.mjs';
import {checkpointSavedClock} from './saved-clock.mjs';
import {checkpointUnitAgentLinks} from './checkpoint.mjs';
import {requireCheckpointHaloLayout} from './halo-checkpoint-layout.mjs';
import {copyNativeHeroCrossing} from './hero-travel-boundary.mjs';
import {planHaloActorHandoff} from './halo-region-layout.mjs';
import {checkpointTerrain} from './terrain.mjs';
import {sampleNativeGroundHeight} from './terrain-ground.mjs';
import {checkCheckpointReadSignal} from './checkpoint-lease.mjs';

export function prepareSelectedHeroHomeArrival(identity,selected,boundary,options={}){
 return prepareSelectedHeroArrival(identity,selected,boundary,options,true);
}
export function prepareSelectedHeroNeighborArrival(identity,selected,boundary,options={}){
 return prepareSelectedHeroArrival(identity,selected,boundary,options,false);
}
async function prepareSelectedHeroArrival(identity,selected,boundary,{signal}={},atHome){
 const crossing=copyNativeHeroCrossing(boundary),captured=JSON.parse(JSON.stringify({identity,
  entries:selected?.entries,regions:selected?.regions}));
 identity=captured.identity;
 const [from,to]=captured.entries??[],[source,destination]=selected?.sources??[],home=identity?.registeredHome?.home;
 const check=()=>checkCheckpointReadSignal(signal);check();
 if(!from||!to||!source||!destination||from.region!==crossing.region||to.region!==crossing.target||
  from.alias?.unitId!==crossing.unitId||from.alias?.agentId!==crossing.agentId||
  (atHome?(to.region!==home?.region||from.homeAlias?.kind!=='proxy'||to.homeAlias?.kind!=='native'||
    to.homeAlias.unitId!==home.unitId||to.homeAlias.agentId!==home.agentId):
    (to.region===home?.region||to.homeAlias?.kind!=='proxy'||to.homeAlias.unitId!==0)))
  throw Error('Native home capsule differs from its selected return');
 // Never omit a linked effect/companion from this four-record importer.
 for await(const unit of checkpointUnitAgentLinks(source)){
  check();if(unit.parentUnitId===from.alias.unitId)throw Error('Return family needs its complete original importer');
 }
 const options={unitId:from.alias.unitId,freshUnitId:100000,freshAgentId:1000,
  unitBindings:[],attachedUnitBindings:[],sourceClockMs:await checkpointSavedClock(source),
  destinationClockMs:await checkpointSavedClock(destination),
  haloRegions:{version:'halo-v1',sourceRegion:from.region,destinationRegion:to.region}};check();
 if(options.sourceClockMs!==crossing.clock)throw Error('Native home capsule clock differs from its crossing');
 const context={identity,regions:captured.regions,ownerSide:0,
  aliases:[from.alias,{unitId:options.freshUnitId,agentId:options.freshAgentId}],
  homeAliases:[from.homeAlias,to.homeAlias],referenceBindings:[]};
 const prepared=await prepareCheckpointRegisteredHeroArrival(source,destination,options,context);check();
 const layouts=[];for(const [s,key]of [[source,from.region],[destination,to.region]]){
  layouts.push(await requireCheckpointHaloLayout(s,key,'halo-v1',{signal}));check();
 }
 const travel=planHaloActorHandoff(crossing.previous,crossing.accepted,from.region),placement=prepared.plan.haloPlacement;
 if(travel?.destinationRegion!==to.region||!placement||
  ['x','y','z'].some(k=>placement.destinationFixed[k]!==travel.destinationPose[k]))
  throw Error('Native home capsule pose differs from its crossing');
 const sourceGround=await sampleNativeGroundHeight(await checkpointTerrain(source),placement.sourceFixed);check();
 const destinationGround=await sampleNativeGroundHeight(await checkpointTerrain(destination),placement.destinationFixed);check();
 if(sourceGround!==destinationGround)throw Error('Native home capsule ground differs across the saved border');
 const ordered=[['unit',0],['agent',1],['container',2],['order',3]];
 if(Object.keys(prepared.records).sort().join(',')!==ordered.map(([name])=>name).sort().join(','))
  throw Error('Native home capsule requires all four original records');
 const totalRecordBytes=Object.values(prepared.records).reduce((n,b)=>n+b.length,0),size=96+totalRecordBytes;
 if(size>MAX_ARRIVAL_TOTAL_RECORD_BYTES)throw Error('Native home capsule exceeds the importer byte budget');
 const pack=new Uint8Array(size),view=new DataView(pack.buffer);let at=0;
 const words=values=>{for(const n of values){view.setUint32(at,n,true);at+=4;}};
 words([0x3141484d,1,4,options.sourceClockMs,options.destinationClockMs,
  from.alias.unitId,from.alias.agentId,to.homeAlias.agentId,100000,1000,0,totalRecordBytes]);
 for(const [name,kind]of ordered){const bytes=prepared.records[name];words([kind,from.alias.unitId,bytes.length]);pack.set(bytes,at);at+=bytes.length;}
 check();
 return {pack,options,context,plan:prepared.plan,layouts,ground:{sourceGround,destinationGround},travel,
  totalRecordBytes,packDescriptors:ordered.map(([name,kind])=>({name,kind,id:from.alias.unitId,bytes:prepared.records[name].length}))};
}

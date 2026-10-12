import {regionKey} from './region.mjs';
import {haloRegionLayout} from './halo-region-layout.mjs';

// A bounded engine input derived from an already verified selected snapshot.
// Historical origin IDs cannot select the current actor after a round trip.
const tag='majesty-hero-runtime-v1';
const uint=(n,max=0xffffffff)=>Number.isInteger(n)&&n>=0&&n<=max;
export function parseHeroRuntimeBinding(text){
  if(typeof text!=='string'||text.length>256)throw Error('Invalid native hero binding');
  const f=text.split('|');
  if(f.length!==12||f[0]!==tag||!['native','proxy'].includes(f[7])||!/^[a-f0-9]{64}$/.test(f[11]))
    throw Error('Invalid native hero binding');
  const xy=f[1].split('_').map(Number);
  if(xy.length!==2||regionKey(...xy)!==f[1])throw Error('Invalid native hero binding region');
  const n=[2,3,4,5,6,8,9,10].map(i=>{
    const value=Number(f[i]);
    if(!uint(value)||String(value)!==f[i])throw Error('Invalid native hero binding number');
    return value;
  });
  const [clock,unitId,agentId,description,playerNumber,homeUnitId,homeAgentId,homeDescription]=n;
  if(!unitId||!agentId||agentId>0x7fffffff||!description||playerNumber>7||!homeAgentId||
      homeAgentId>0x7fffffff||homeAgentId===agentId||!homeDescription||
      (f[7]==='native'?(!homeUnitId||homeUnitId===unitId):homeUnitId!==0))
    throw Error('Invalid native hero binding aliases');
  return Object.freeze({region:f[1],clock,unitId,agentId,description,playerNumber,
    homeKind:f[7],homeUnitId,homeAgentId,homeDescription,sha256:f[11]});
}
export function selectedHeroRuntimeBinding(identity,entry,clock){
  if(identity?.version!==2||identity.actor?.family!=='VHCL'||!entry?.alias||!entry.homeAlias)
    throw Error('Native hero binding requires a registered selected owner');
  const text=[tag,entry.region,clock,entry.alias.unitId,entry.alias.agentId,
    identity.actor.description,identity.actor.playerNumber,entry.homeAlias.kind,
    entry.homeAlias.unitId,entry.homeAlias.agentId,identity.registeredHome?.home?.description,
    entry.world?.sha256].join('|');
  parseHeroRuntimeBinding(text);return text;
}
export function selectedHeroHaloBinding(runtimeBinding,layout){
  const b=parseHeroRuntimeBinding(runtimeBinding),expected=haloRegionLayout(b.region);
  if(!layout||layout.version!=='halo-v1'||layout.key!==b.region||layout.verifiedVertices!==16641||layout.sharedVertices!==2480||
      ['core','native'].some(k=>JSON.stringify(layout[k])!==JSON.stringify(expected[k])))
    throw Error('Native hero movement requires its verified saved halo layout');
  return `majesty-hero-halo-v1|${b.region}|${b.sha256}`;
}
export function parseHeroHaloBinding(text,runtimeBinding){
  const b=parseHeroRuntimeBinding(runtimeBinding);
  if(typeof text!=='string'||text.length>256||text!==`majesty-hero-halo-v1|${b.region}|${b.sha256}`)
    throw Error('Native hero halo binding differs from the prepared saved kingdom');
  return Object.freeze({version:'halo-v1',region:b.region,sha256:b.sha256});
}

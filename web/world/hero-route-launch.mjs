import {selectedWorld} from './world-name.mjs';
import {selectedRegion} from './region.mjs';
import {Sha256} from './sha256.mjs';
import {prepareNativeHeroCurrentOwnerRestore} from './hero-route-restore.mjs';

const flag='RECOMP_RULE_FRONTIER_HERO_RESTORE',worldKey='hero-world',entityKey='hero-entity',layoutKey='hero-layout';
export function nativeHeroContentDigest(content){
  if(typeof content!=='string'||!/^[a-f0-9]{64}:[a-f0-9]{64}$/.test(content))throw Error('Invalid native hero content identity');
  return new Sha256().update(new TextEncoder().encode(JSON.stringify(['majesty-browser-hero-content-v1',content]))).hex();
}
export function nativeHeroRestoreConfig(search){
  const q=new URLSearchParams(search),flags=q.getAll(flag);
  if(['RECOMP_FRONTIER_HERO_BINDING','RECOMP_FRONTIER_HERO_HALO_BINDING','RECOMP_FRONTIER_HERO_OWNER_MANIFEST'].some(k=>q.has(k)))
    throw Error('Native hero binding must come from the verified saved owner');
  if(!flags.length){
    if(q.has(worldKey)||q.has(entityKey)||q.has(layoutKey))throw Error('Hero identity requires selected-owner restoration');
    return null;
  }
  const world=selectedWorld(search),region=selectedRegion(search);
  const layout=q.getAll(layoutKey);
  if(layout.length&&(layout.length!==1||layout[0]!=='halo-v1'))throw Error('Hero travel layout requires one explicit supported version');
  if(flags.length!==1||flags[0]!=='v1'||!world||!region||q.get('RECOMP_RULE_FRONTIER_RESTORE')!=='1'||
      ['room','mode','relay','role','RECOMP_PROFILE_DIR','RECOMP_RULE_FRONTIER_SESSION',
        'RECOMP_RULE_FRONTIER_CHAPTER','RECOMP_BROWSER_FRONTIER_TRANSFER_CASE','RECOMP_BROWSER_FRONTIER_TRANSFER_ACTION'].some(k=>q.has(k))||
      q.getAll('RECOMP_RULE_FRONTIER_TRANSFER').some(v=>v!=='0')||
      [worldKey,entityKey].some(k=>q.getAll(k).length!==1||!/^[a-f0-9]{64}$/.test(q.get(k))))
    throw Error('Hero restoration requires one saved solo kingdom and its exact world/hero identity');
  return Object.freeze({world,region:region.key,worldId:q.get(worldKey),entityId:q.get(entityKey),...(layout.length?{haloLayout:layout[0]}:{})});
}
export async function prepareNativeHeroStartup(profiles,config,content,{locks,signal}={}){
  const contentDigest=nativeHeroContentDigest(content);
  return prepareNativeHeroCurrentOwnerRestore(profiles,config.world,{worldId:config.worldId,entityId:config.entityId,
    contentDigest,content,region:config.region},{locks,signal,haloLayout:config.haloLayout});
}
// Consume the bootstrap link only after the native kingdom actually reaches
// ready. Ordinary saves/reloads then use the region's evolving native slots.
export function completedHeroRestoreURL(base){
  const url=new URL(base);if(!url.searchParams.has(flag))return null;
  nativeHeroRestoreConfig(url.search);
  for(const key of [flag,worldKey,entityKey,layoutKey])url.searchParams.delete(key);
  return url;
}

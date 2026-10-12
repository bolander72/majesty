import {selectedWorld} from './world-name.mjs';
export function regionKey(x, y) {
  if (![x,y].every(n=>Number.isInteger(n)&&Math.abs(n)<=1000000)) throw new RangeError('Region coordinates are out of range.');
  return `${x}_${y}`;
}
function sessionSetting(base,world){
  const session=new URL(base).searchParams.getAll('RECOMP_RULE_FRONTIER_SESSION');
  if(session.length&&(!world||session.length!==1||session[0]!=='v1'))throw new Error('Invalid region session setting.');
  return session.length>0;
}
export function nativeRegionURL(x,y,base) {
  const key=regionKey(x,y),url=new URL('../majesty/',base);
  const world=selectedWorld(new URL(base).search);
  if(world)url.searchParams.set('world',world);
  url.searchParams.set('profile',`frontier_${key}`);
  url.searchParams.set('RECOMP_RULE_FRONTIER_REGION',key);
  url.searchParams.set('RECOMP_RULE_FRONTIER_RESTORE','1');
  // Frontier is experimental: select the bridge and regional seed exercised
  // in fresh-region startup tests; ordinary game startup stays opt-in.
  url.searchParams.set('RECOMP_RULE_INVENTORY_COMPAT','1');
  url.searchParams.set('RECOMP_RULE_FRONTIER_SEEDED_GENERATION','1');
  if(sessionSetting(base,world)){
    url.searchParams.set('RECOMP_RULE_FRONTIER_SESSION','v1');
    url.searchParams.set('RECOMP_RULE_FRONTIER_CONNECTED_TERRAIN','v1');
  }
  if (new URL(base).searchParams.get('RECOMP_MEMORY_DEBUG') === '1') url.searchParams.set('RECOMP_MEMORY_DEBUG','1');
  return url;
}
export function neighboringRegionURL(direction,base) {
  const offsets={west:[-1,0],north:[0,-1],south:[0,1],east:[1,0]};
  if(!Object.hasOwn(offsets,direction))throw new Error('Choose a neighboring region direction.');
  const region=selectedRegion(new URL(base).search);
  if(!region)throw new Error('Open a native region before traveling.');
  const [dx,dy]=offsets[direction];
  return nativeRegionURL(region.x+dx,region.y+dy,base);
}
export function atlasURL(base) {
  const url=new URL('../world/',base);
  const world=selectedWorld(new URL(base).search);
  if(world)url.searchParams.set('world',world);
  if(sessionSetting(base,world))url.searchParams.set('RECOMP_RULE_FRONTIER_SESSION','v1');
  if(new URL(base).searchParams.get('RECOMP_MEMORY_DEBUG')==='1')url.searchParams.set('RECOMP_MEMORY_DEBUG','1');
  const region=selectedRegion(new URL(base).search);
  if(region)url.searchParams.set('at',region.key);
  return url;
}
export function selectedAtlasRegion(search) {
  const values=new URLSearchParams(search).getAll('at');
  if(!values.length)return null;
  if(values.length!==1)throw new Error('Use one atlas destination.');
  const key=values[0],parts=key.split('_').map(Number);
  if(parts.length!==2||regionKey(...parts)!==key)throw new Error('Invalid atlas destination.');
  return {x:parts[0],y:parts[1]};
}
export function selectedRegion(search) {
  selectedWorld(search);
  const query=new URLSearchParams(search),key=query.get('RECOMP_RULE_FRONTIER_REGION');
  if(!key)return null;
  if(query.getAll('RECOMP_RULE_FRONTIER_REGION').length!==1 || query.getAll('profile').length!==1)throw new Error('Use one region and one save profile.');
  if(query.getAll('RECOMP_RULE_FRONTIER_RESTORE').length>1 ||
     (query.has('RECOMP_RULE_FRONTIER_RESTORE')&&!/^[01]$/.test(query.get('RECOMP_RULE_FRONTIER_RESTORE'))))throw new Error('Use one automatic restore setting.');
  const parts=key.split('_').map(Number);
  if(parts.length!==2 || regionKey(...parts)!==key || query.get('profile')!==`frontier_${key}` || query.has('RECOMP_RULE_FRONTIER_CHAPTER'))throw new Error('Open a region from the Frontier map to use its dedicated save profile.');
  return {key,x:parts[0],y:parts[1],checkpoint:`Frontier_${key}`};
}

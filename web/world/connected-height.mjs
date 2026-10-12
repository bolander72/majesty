// Frontier connected terrain v1. Integer reference for original-engine
// generated geometry; reading this recipe never modifies a saved kingdom.
export const CONNECTED_TERRAIN_VERSION='v1',CONNECTED_REGION_CELLS=128;
function corner(x,y){
  let hash=(Math.imul(71201^x,0x045d9f3b)^Math.imul(y,0x27d4eb2d))>>>0;
  hash=(hash^(hash>>>16))>>>0;
  hash=Math.imul(hash,0x045d9f3b)>>>0;
  hash=(hash^(hash>>>16))>>>0;
  return hash%9-4;
}
export function connectedHeightQ16(x,y){
  if(![x,y].every(n=>Number.isSafeInteger(n)&&Math.abs(n)<=0x7fffffff))
    throw new Error('Connected terrain coordinate out of bounds');
  const ax=Math.floor(x/16),ay=Math.floor(y/16),rx=x-ax*16,ry=y-ay*16;
  return (corner(ax,ay)*(16-rx)*(16-ry)+corner(ax+1,ay)*rx*(16-ry)+
    corner(ax,ay+1)*(16-rx)*ry+corner(ax+1,ay+1)*rx*ry)*256;
}

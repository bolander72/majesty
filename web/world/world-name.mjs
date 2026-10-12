export function worldName(value){
  if(typeof value!=='string'||!/^[a-z0-9-]{1,40}$/.test(value))throw new Error('Invalid native world name');
  return value;
}
export function selectedWorld(search){
  const names=new URLSearchParams(search).getAll('world');
  if(!names.length)return null;
  if(names.length!==1)throw new Error('Use one native world name');
  return worldName(names[0]);
}

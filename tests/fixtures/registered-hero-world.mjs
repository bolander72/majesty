import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {EntityRevisionStore} from '../../web/world/entity-revisions.mjs';
import {registerCheckpointGuildHome} from '../../web/world/hero-home.mjs';
import {encodeRemoteHomeAgent} from '../../web/world/remote-home.mjs';
export const hash=b=>createHash('sha256').update(b).digest('hex');
const w=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n>>>0);return b;};
const string=s=>Buffer.from(s+'\0');
const chunk=(tag,b=Buffer.alloc(0),v=0,count=0)=>Buffer.concat([Buffer.from(tag),w(b.length),w(v),w(count),b]);
const env=(v,b)=>Buffer.concat([w(b.length+16),w(v),b,w(0),w(-1)]);
const val=(type,...parts)=>Buffer.concat([w(type),...parts]);
const ref=id=>val(5,w(id));
const list=ids=>val(4,env(0,Buffer.concat([w(ids.length),...ids.map(ref)])));
function agent(id,uid,attrs){return Buffer.concat([w(id),env(2,Buffer.concat([
  env(0,Buffer.concat([w(attrs.length),...attrs.flatMap(([k,v])=>[string(k),v])])),w(0),w(id),string(''),w(uid),Buffer.from([0]),w(0),Buffer.from([0,0])]))]);}
function unit(id,gid,description=42,parent=0,player=0,state=512,position){const header=Buffer.alloc(60);for(const [i,n] of [[0,1],[1,id],[2,state],[4,description],[5,player],[6,parent]])header.writeUInt32LE(n,i*4);
  if(position)for(const [i,key] of ['x','y','z'].entries())header.writeInt32LE(position[key],28+i*4);
  return chunk('UNIT',chunk('PRIM',Buffer.concat([header,w(1),w(1),w(0x4541),w(gid),Buffer.alloc(8)]),9),0,1);}
function container(id,kind,members,physical=[]){const groups=[{kind,owner:id,members},...physical];
  return Buffer.concat([w(id),chunk('CONT',chunk('PRIM',Buffer.concat([w(1),w(groups.length),
    ...groups.flatMap(g=>[w(1),w(g.members.length),w(g.kind),w(g.owner),
      ...g.members.flatMap(m=>[w(typeof m==='number'?m:m.id),w(typeof m==='number'?1:m.flags)])])]),1),0,1)]);}
export function world(side,present,{registration,uid=side?602:502,gid=side?37:27,variant=0,homeRef=side?45:7,
  staleScript=false,staleNative=false,borrowLocal=false,queuedProxy=false,wrongProxy=false,proxyBacklink=false,badGuildAgent=false,
  parent=0,position=null,heroState=512,physicalGroups=[],extraRef=0,inventory=false,savedClock=side?9000:3200,
  localHomeUnitId=778,taskName='go_home',continuation='use_building',targetRef=homeRef,orders=Buffer.alloc(0),reward=null,destination=null,nextAgentId=100}={}) {
  const home=side?localHomeUnitId:469,homeAgent=side?17:7;
  const members=side?[]:present?[gid]:staleScript?[27]:[];
  const agents=[agent(homeAgent,home,[['members',list(members)]])],units=present?[unit(uid,gid,42,parent,0,heroState,position)]:[];
  if(present)agents.push(agent(gid,uid,[['home',ref(homeRef)],['target',ref(targetRef)],['taskname',val(3,string(taskName))],
    ['activescript',val(8,w(0),Buffer.alloc(16),Buffer.from([0,1]),string(continuation),Buffer.from([0]))],
    ...(extraRef?[['extra',ref(extraRef)]]:[]),...(destination?[['destination',val(7,w(destination.x),w(destination.y))]]:[])]));
  if(side){const b=Buffer.from(encodeRemoteHomeAgent(registration,45));if(wrongProxy)b[b.indexOf(Buffer.from(registration.worldId))]^=1;
    agents.push(Buffer.concat([w(45),b]));}
  if(reward)agents.push(agent(80,900,[['heroes',list(reward.scriptMembers??[gid])]]));
  agents.sort((a,b)=>a.readUInt32LE(0)-b.readUInt32LE(0));
  const queue=[...(present?[gid]:[]),...(queuedProxy?[45]:[])];
  const manager=env(2,Buffer.concat([w(0),w(agents.length),...agents,w(queue.length),...queue.map(w),w(0),Buffer.from([0])]));
  const groups=[container(home,100,side?[]:present?[uid]:staleNative?[502]:[],physicalGroups)];
  if(present)groups.push(container(uid,101,[...(!side||borrowLocal?[home]:[]),...(reward?[900,...(reward.duplicate?[900]:[])]:[])]));
  if(reward)groups.push(container(900,100,reward.nativeMembers??[uid]));
  if(proxyBacklink)units.push(unit(900,45));
  return Buffer.concat([chunk('VERS',Buffer.alloc(256,variant),1),
    chunk('SVGD',Buffer.concat([string('Fixture'),string('Freestyle'),w(savedClock),Buffer.alloc(28)]),10),
    chunk('GPL ',env(3,Buffer.concat([w(0),manager,w(nextAgentId)])),1),
    chunk('BLDG',unit(home,badGuildAgent?99:homeAgent,77),0,1),chunk('VHCL',Buffer.concat(units),0,units.length),
    ...['GRND','RWRD','MSGF','OFMP'].map(t=>t==='RWRD'&&reward?chunk(t,unit(900,80,reward.description??0x34415241,reward.parent??0,reward.player??0,reward.state??545),0,1):chunk(t)),chunk('ORDR',orders,1,orders.length?1:0),chunk('CONT',Buffer.concat(groups),1,groups.length),
    chunk('GSGL',Buffer.concat([Buffer.alloc(76),w(0),w(Number(inventory)),...(inventory?[w(123),w(uid)]:[])]),6)]);
}
export const source=b=>({size:b.length,async readAt(at,n){assert.ok(n<=4096&&at>=0&&at+n<=b.length);return Uint8Array.from(b.subarray(at,at+n));}});
export async function fixture(){
  const original=world(0,true),registration=await registerCheckpointGuildHome(source(original),
    {worldId:'a'.repeat(64),contentDigest:'c'.repeat(64),region:'0_0',guildUnitId:469});
  const identity={version:2,entityId:registration.members[0].entityId,contentDigest:registration.contentDigest,regions:['0_0','1_0'],
    actor:{family:'VHCL',description:42,playerNumber:0},registeredHome:registration};
  const homeAliases=[{kind:'native',unitId:469,agentId:7},{kind:'proxy',unitId:0,agentId:45}],aliases=[{unitId:502,agentId:27},{unitId:602,agentId:37}];
  const files=new Map(),writes=[];let busy=false;
  const io={async withLock(mode,fn){if(busy)throw Error('busy');busy=true;try{return await fn();}finally{busy=false;}},
    async open(name){assert.ok(busy);return files.has(name)?source(files.get(name)):null;},
    async atomicWrite(name,produce){assert.ok(busy);const parts=[];await produce({async write(b){assert.ok(b.length<=4096);parts.push(Buffer.from(b));}});
      files.set(name,Buffer.concat(parts));writes.push(name);}};
  const worlds=[original,world(1,false,{registration})];
  const request=(states=worlds,extra={})=>({worlds:states.map(b=>({source:source(b),sha256:hash(b)})),aliases,referenceBindings:[],homeAliases,
    kind:'seed',ownerSide:0,visitedSides:1,expectedManifest:null,operationId:'d'.repeat(64),...extra});
  const store=()=>new EntityRevisionStore(io,identity,identity.contentDigest);
  return {identity,registration,homeAliases,aliases,files,writes,io,worlds,request,store};
}

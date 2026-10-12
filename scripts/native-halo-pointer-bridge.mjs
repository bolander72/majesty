#!/usr/bin/env node
// Replay actual native events through the browser's production session controls.
// Translate only the owned fixture root to its equivalent virtual OPFS root;
// no browser or browser storage is accessed. Admit the two saved test neighbors.
import assert from 'node:assert/strict';
import {readFile,lstat} from 'node:fs/promises';
import {NativeRegionSession} from '../web/world/native-session-controls.mjs';
import {nativeRegionURL} from '../web/world/region.mjs';
const [logName,root]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(root,/\/actor-arrival-fixture-halo-world-session-[^/]+\/native-world-halo$/);
assert.ok((await lstat(logName)).size<=4*1024*1024);
const virtual='/opfs/majesty/profile/native-world-halo';
const controls=new NativeRegionSession({x:0,y:0,key:'0_0'},virtual),actions=[];
for(const raw of (await readFile(logName,'utf8')).split('\n')){
 const line=raw.replaceAll(root,virtual),transition=controls.message(line);
 if(transition?.kind!=='boundary')continue;
 const fields=Object.fromEntries(line.slice('[frontier] Session boundary '.length).split(' ').map(v=>v.split('=')));
 const serial=Number(fields.serial);
 if(serial>1)continue;
 assert.equal(transition.direction,serial===0?'east':'west');assert.equal(fields.region,serial===0?'0_0':'1_0');
 const [x,y]=fields.region.split('_').map(Number),targetX=x+(serial===0?1:-1);
 const base=`http://localhost/majesty/?world=halo&profile=frontier_${x}_${y}&RECOMP_RULE_FRONTIER_REGION=${x}_${y}&RECOMP_RULE_FRONTIER_SESSION=v1`;
 const destination=nativeRegionURL(targetX,y,base);
 controls.queue(transition.direction,destination,'saved');
 assert.equal(controls.poll('frontier-travel'),true);assert.equal(controls.poll(`frontier-travel-${transition.direction}`),true);
 actions.push({serial,region:fields.region,direction:serial===0?3:0,gesture:Number(fields.gesture)});
}
console.log(JSON.stringify({actions,enabled:controls.enabled,busy:controls.busy}));

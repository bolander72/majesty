#!/usr/bin/env python3
"""Stage the stopped two-kingdom OPFS publication diagnostic; no game assets."""
from pathlib import Path
import json
from runpy import run_path

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'upstream/majesty-recomp'
TARGET = GAME / 'build/web-site/browser-transfer-fixture'
PLAYER = (GAME / 'kit/web/player/index.html').read_text()
PLAYER = run_path(str(ROOT / 'scripts/stage-world.py'))['bounded_hashing'](PLAYER)
start = PLAYER.index('async function networkManifest(')
end = PLAYER.index('\nconst networkDebug', start)
identity = PLAYER[start:end]
TARGET.mkdir(exist_ok=True)
html = '''<!doctype html><meta charset="utf-8"><title>Majesty browser paired-save diagnostic</title>
<style>body{font:16px system-ui;background:#152122;color:#eee;margin:24px;max-width:1000px}button,select,a{padding:8px;margin:6px}a{color:#afe}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style>
<h1>Stopped browser paired-save diagnostic</h1>
<p>Uses the two owned kingdoms from the qualified browser actor departure and arrival. Close every owned game tab before preparing, inspecting or changing a test case. Prepare refuses existing case folders. Personal profiles are preserved.</p>
<label><input id="stopped" type="checkbox"> All owned game tabs are closed</label>
<p><button id="prepare">Prepare all isolated cases</button>
<select id="trial" aria-label="Test case"></select>
<button id="inspect">Inspect selected pair</button>
<button id="inputs">Inspect preserved inputs</button>
<button id="corrupt">Damage this test case</button></p>
<p><select id="publication" aria-label="Snapshot pair"><option value="baseline">Baseline pair</option><option value="transfer">Transferred pair</option></select>
<select id="boundary" aria-label="Publication fault"><option value="none">No fault</option><option value="after-source">After source staging</option><option value="before-publish">Before publication</option><option value="after-publish">After publication</option></select>
<button id="publish">Publish stopped pair with browser coordinator</button></p>
<p><select id="terrainSide" aria-label="Saved terrain kingdom"><option value="0">Source kingdom</option><option value="1">Destination kingdom</option></select>
<button id="terrain">Stream saved terrain windows (read only)</button></p>
<p id="links"></p><pre id="result" role="status">Ready.</pre>
<script type="module">
import {checkpointFile,checkpointUnits,checkpointAgents,checkpointAgentValues,checkpointAgentReferencePlan,checkpointContainerEntries} from '../world/checkpoint.mjs';
import {PairedCheckpointStore,opfsPairedStorage,pairedLockName} from '../world/transfer-store.mjs';
import {PAIRED_CASES} from '../world/paired-session.mjs';
import {NativeTerrainScene,pairedTerrainProvider} from '../world/terrain-scene.mjs';
'''+identity+'''
const cases=PAIRED_CASES;
const keys=['999913_999914','999912_999914'],sides=['Source','Destination'];
const hashes=[['6e6a2ee125b68ce00ec25a46f205904e7cdd8f83ca009c10cf29e8e9ab76e2d1','83222090215e19ed3d1e3d2ea92df87d68cad77c3496ac3d3e4d8083112ba4b9'],['1da38fa924717370468c178af5790a12d72887648c169bbc111125fce161430e','93938c504ab0312f7d61b4ca5b38e139ea48982c1b406165f883989bcfbf3e64']];
const sizes=[[317365,324488],[315024,333480]];
const select=document.querySelector('#trial'),result=document.querySelector('#result');
for(const name of cases){const option=document.createElement('option');option.value=option.textContent=name;select.append(option);}
function stopped(){if(!document.querySelector('#stopped').checked)throw Error('Close all owned game tabs first.');}
async function profiles(){const root=await navigator.storage.getDirectory();return (await root.getDirectoryHandle('majesty')).getDirectoryHandle('profile');}
async function file(folder,path){const parts=path.split('/');for(const name of parts.slice(0,-1))folder=await folder.getDirectoryHandle(name);return (await folder.getFileHandle(parts.at(-1))).getFile();}
async function write(folder,name,data){const handle=await folder.getFileHandle(name,{create:true}),stream=await handle.createWritable();try{await stream.write(data);await stream.close();}catch(e){await stream.abort();throw e;}}
async function hash(file){if(file.size>1024*1024)throw Error('Diagnostic input exceeds its fixture bound');return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join('');}
async function marker(folder,name){const value=await file(folder,name);if(!value.size||value.size>=512)throw Error('Invalid manifest size');return value.text();}
const rootName=()=>{if(!cases.includes(select.value))throw Error('Unknown case');return 'actor-wasm-transfer-'+select.value;};
async function stoppedLocks(trials,mode,fn){stopped();if(!navigator.locks)throw Error('Paired storage locking unavailable');
 async function next(i){if(i===trials.length)return fn();const trial=trials[i];if(!cases.includes(trial))throw Error('Unknown case');return navigator.locks.request(pairedLockName('actor-wasm-transfer-'+trial),{mode,ifAvailable:true},lock=>{if(!lock)throw Error('Shared checkpoint busy; close the paired game or wait for publication');return next(i+1);});}return next(0);}
async function prepare(){stopped();const parent=await profiles();for(const trial of cases){try{await parent.getDirectoryHandle('actor-wasm-transfer-'+trial);throw Error('Case already exists; it is preserved: '+trial);}catch(e){if(e.name!=='NotFoundError')throw e;}}
 const inputs=[],identities=[];for(let side=0;side<2;++side){const folder=await parent.getDirectoryHandle('frontier_'+keys[side]),lines=(await marker(folder,'Frontier_'+keys[side]+'.checkpoint')).split('\\n');if(lines.length!==6||lines[0]!=='checkpoint-v1'||lines[1]!=='1'||Number(lines[2])!==sizes[1][side]||lines[3]!==hashes[1][side])throw Error('Qualified region checkpoint required');identities.push(lines[4]);
  for(let moved=0;moved<2;++moved){const value=await file(folder,'Documents/My Games/MajestyHD/SaveGame/Frontier_'+keys[side]+(moved?'_Recovery':'')+'.GMP');if(value.size!==sizes[moved][side]||await hash(value)!==hashes[moved][side])throw Error('Qualified browser snapshot mismatch');inputs.push({name:sides[side]+'_'+(moved?'After':'Before')+'.GMP',value,moved,side});}}
 const root=await navigator.storage.getDirectory(),game=await root.getDirectoryHandle('majesty'),manifest=(await fetch('../games.json').then(r=>r.json())).find(g=>g.id==='majesty'),identity=await networkManifest(await game.getDirectoryHandle('game'),manifest);if(identities.some(v=>v!==identity.checkpoint))throw Error('Imported content changed');
 for(const trial of cases){const folder=await parent.getDirectoryHandle('actor-wasm-transfer-'+trial,{create:true});for(const input of inputs)await write(folder,input.name,input.value);await write(folder,'Owned_Browser_Inputs.json',JSON.stringify({content:identity.checkpoint,inputs:inputs.map(v=>({name:v.name,size:v.value.size,sha256:hashes[v.moved][v.side]}))}));}
 return {prepared:true,cases,content:identity.checkpoint,inputs:inputs.map(v=>({name:v.name,size:v.value.size,sha256:hashes[v.moved][v.side]})),source:'Actual browser original-serializer before/after worlds; no native after-world substitution'};}
async function inspectInputs(){stopped();const folder=await(await profiles()).getDirectoryHandle(rootName()),values=[];for(let side=0;side<2;++side)for(let moved=0;moved<2;++moved){const name=sides[side]+'_'+(moved?'After':'Before')+'.GMP',value=await file(folder,name);values.push({name,size:value.size,sha256:await hash(value),matches:value.size===sizes[moved][side]&&await hash(value)===hashes[moved][side]});}return {case:select.value,inputs:values};}
async function inspect(){stopped();const folder=await(await profiles()).getDirectoryHandle(rootName()),text=await marker(folder,'Frontier_Transfer.checkpoint'),lines=text.split('\\n');if(lines.length!==11||lines[0]!=='majesty-transfer-v1'||!/^[01]$/.test(lines[1])||!/^[01]$/.test(lines[2])||lines[3]!==keys[0]||lines[4]!==keys[1]||lines[10]!==''||!lines[9]||lines[9].length>192||/[^\\x20-\\x7e]/.test(text.replaceAll('\\n','')))throw Error('Invalid paired manifest');
 const identity=JSON.parse(await(await file(folder,'Owned_Browser_Inputs.json')).text()).content;if(lines[9]!==identity)throw Error('Content mismatch');const moved=Number(lines[2]),worlds=[];
 for(let side=0;side<2;++side){const value=await file(folder,'Frontier_Transfer_'+sides[side]+'_'+lines[1]+'.GMP'),expected=hashes[moved][side];if(lines[5+side*2]!==String(sizes[moved][side])||lines[6+side*2]!==expected||value.size!==sizes[moved][side]||await hash(value)!==expected)throw Error('Selected paired snapshot mismatch');
  const native=checkpointFile(value),unitId=side?609:506,agentId=side?77:9,homeId=side?531:502,homeAgentId=side?6:7,present=Boolean(side?moved:!moved);let unit=null,agent=null,home=null,homeAgent=null,existing=null,units=0,agents=0;const incoming=[],rosters=[],memberships=[];
  for await(const u of checkpointUnits(native)){++units;if(u.primary.words[1]===unitId){if(unit)throw Error('Duplicate transferred unit');unit=u;}if(u.primary.words[1]===homeId)home=u;if(side&&u.primary.words[1]===536)existing=u;}
  for await(const a of checkpointAgents(native)){++agents;if(a.agentId===agentId){if(agent)throw Error('Duplicate transferred agent');agent=a;}if(a.agentId===homeAgentId)homeAgent=a;for(const ref of await checkpointAgentReferencePlan(native,a.agentId,id=>id))if(ref.before===agentId){if(incoming.length>=8192)throw Error('Too many fixture references');incoming.push({agentId:a.agentId,attribute:ref.attribute,path:ref.path});}}
  for await(const v of checkpointAgentValues(native,homeAgentId))if(['Guards','Waiting_Guards'].includes(v.attribute)&&v.type===5)rosters.push(v);
  for await(const e of checkpointContainerEntries(native))if(e.type==='member'&&((e.unitId===homeId&&e.targetUnitId===unitId)||(e.unitId===unitId&&e.targetUnitId===homeId)))memberships.push(e);
  if(!home||!homeAgent||homeAgent.deleted||homeAgent.unitId!==homeId||Boolean(unit)!==present||Boolean(agent)!==present||(side&&!existing))throw Error('Transfer actor/home occupancy mismatch');
  if(present&&(unit.family!=='VHCL'||unit.primary.words[6]!==homeId||agent.unitId!==unitId||agent.deleted))throw Error('Actor links mismatch');
  for(const key of ['Guards','Waiting_Guards'])if(rosters.filter(v=>v.attribute===key&&v.bits===agentId).length!==Number(present))throw Error('Roster mismatch');
  for(const[owner,kind,target]of[[homeId,100,unitId],[homeId,2,unitId],[unitId,101,homeId]])if(memberships.filter(v=>v.unitId===owner&&v.groupKind===kind&&v.targetUnitId===target).length!==Number(present))throw Error('Membership mismatch');
  if(!present&&incoming.length||present&&(incoming.length!==3||!incoming.some(v=>v.agentId===homeAgentId&&v.attribute==='Guards')||!incoming.some(v=>v.agentId===homeAgentId&&v.attribute==='Waiting_Guards')||!incoming.some(v=>v.agentId===agentId&&v.attribute==='activescript')))throw Error('Incoming reference mismatch');
  worlds.push({side:side?'destination':'source',size:value.size,sha256:expected,units,agents,unitId,agentId,transferredActorPresent:present,incoming,rosters,memberships});}
 if(await marker(folder,'Frontier_Transfer.checkpoint')!==text)throw Error('Selection changed during inspection');if(worlds.filter(w=>w.transferredActorPresent).length!==1)throw Error('Incorrect paired occupancy');return {passed:true,case:select.value,slot:Number(lines[1]),moved:Boolean(moved),content:lines[9],manifest:text,worlds,exactlyOneTransferredActor:true};}
async function damage(){stopped();const trial=select.value,folder=await(await profiles()).getDirectoryHandle(rootName());if(trial==='corrupt-input'){const name='Source_After.GMP',value=await file(folder,name),bytes=new Uint8Array(await value.arrayBuffer());bytes[0]^=1;await write(folder,name,bytes);return {case:trial,damaged:name};}const text=await marker(folder,'Frontier_Transfer.checkpoint'),lines=text.split('\\n');if(trial==='corrupt-active'){const name='Frontier_Transfer_Destination_'+lines[1]+'.GMP',value=await file(folder,name),bytes=new Uint8Array(await value.arrayBuffer());bytes[0]^=1;await write(folder,name,bytes);return {case:trial,damaged:name};}if(trial==='bad-moved'){lines[2]=lines[2]==='1'?'0':'1';await write(folder,'Frontier_Transfer.checkpoint',lines.join('\\n'));return {case:trial,damaged:'moved-state'};}throw Error('Damage is restricted to the three dedicated corruption cases');}
async function publishStopped(){stopped();const folder=await(await profiles()).getDirectoryHandle(rootName()),metadata=await file(folder,'Owned_Browser_Inputs.json');if(metadata.size>4096)throw Error('Unbounded fixture metadata');const content=JSON.parse(await metadata.text()).content,store=new PairedCheckpointStore(opfsPairedStorage(folder,rootName()),{regions:keys,content}),old=await store.read(),moved=document.querySelector('#publication').value==='transfer',worlds=[];
 for(let side=0;side<2;++side){const value=await file(folder,sides[side]+'_'+(moved?'After':'Before')+'.GMP');worlds.push({source:checkpointFile(value),sha256:hashes[Number(moved)][side]});}
 const fault=document.querySelector('#boundary').value;if(!['none','after-source','before-publish','after-publish'].includes(fault))throw Error('Unknown publication boundary');const committed=await store.commit({worlds,moved,expectedManifest:old?.manifest??null},async at=>{if(at===fault)throw Error('Injected stopped-publication fault: '+at);});return {case:select.value,committed,qualification:'Storage publication only; a fresh original-engine reload is required. Keep legacy C++ writers stopped.'};}
let terrainScene=null,terrainCase=null;
async function terrain(){stopped();const name=rootName(),folder=await(await profiles()).getDirectoryHandle(name),metadata=await file(folder,'Owned_Browser_Inputs.json');if(metadata.size>4096)throw Error('Unbounded fixture metadata');const content=JSON.parse(await metadata.text()).content;
 const identity=name+'\\n'+content;if(terrainCase!==identity){const store=new PairedCheckpointStore(opfsPairedStorage(folder,name),{regions:keys,content});terrainScene=new NativeTerrainScene(pairedTerrainProvider(store));terrainCase=identity;}
 const side=document.querySelector('#terrainSide').value;if(!/^[01]$/.test(side))throw Error('Unknown terrain kingdom');const [x,y]=keys[Number(side)].split('_').map(Number);await terrainScene.move(x*128+16,y*128+16,128,128);
 let loaded=0;for(const value of terrainScene.active.values())if(value)++loaded;return {case:select.value,realm:keys[Number(side)],activeWindows:terrainScene.active.size,loadedWindows:loaded,activeBytes:terrainScene.activeBytes,residentWindowsHighWater:terrainScene.residentHighWater,residentBytesHighWater:terrainScene.residentBytesHighWater,windowReads:terrainScene.windowReads,qualification:'Read-only saved terrain projection. No running game, native renderer/navigation replacement or hero travel.'};}
function links(){const group=document.querySelector('#links');group.replaceChildren();for(const side of [0,1])for(const action of ['initialize','commit','fail-after-source','fail-before-publish','interrupt-after-source','interrupt-before-publish','interrupt-after-publish','']){const url=new URL('../majesty/',location);for(const[k,v]of Object.entries({profile:'frontier_'+keys[side],RECOMP_RULE_FRONTIER_REGION:keys[side],RECOMP_RULE_FRONTIER_RESTORE:'1',RECOMP_RULE_FRONTIER_TRANSFER:'1',RECOMP_RULE_INVENTORY_COMPAT:'1',RECOMP_BROWSER_STREAMING_DEBUG:'1',RECOMP_BROWSER_STREAMING_TRANSFER_RELOAD_FIXTURE:'1',RECOMP_BROWSER_FRONTIER_TRANSFER_CASE:select.value,RECOMP_BROWSER_FRONTIER_CHECKPOINT_DEBUG:'1',RECOMP_LOG:'2'}))url.searchParams.set(k,v);if(action)url.searchParams.set('RECOMP_BROWSER_FRONTIER_TRANSFER_ACTION',action);const a=document.createElement('a');a.href=url;a.textContent=(side?'destination':'source')+' '+(action||'reload');group.append(a);}}
select.onchange=links;links();
for(const[id,fn]of[['prepare',prepare],['inspect',inspect],['inputs',inspectInputs],['corrupt',damage],['publish',publishStopped],['terrain',terrain]])document.querySelector('#'+id).onclick=async()=>{const controls=[...document.querySelectorAll('button,select')];for(const control of controls)control.disabled=true;result.textContent='Working…';try{const report=id==='publish'||id==='terrain'?await fn():await stoppedLocks(id==='prepare'?cases:[select.value],id==='inspect'||id==='inputs'?'shared':'exclusive',fn);result.textContent=JSON.stringify(report,null,2);}catch(e){result.textContent='Error: '+e.message;}finally{for(const control of controls)control.disabled=false;}};
</script>'''
(TARGET / 'index.html').write_text(html)
(ROOT / 'output/actor-browser-pair-fixture-observed.json').write_text(json.dumps({
    'url': 'http://localhost:8000/browser-transfer-fixture/',
    'stagedDirectory': str(TARGET),
    'identityFunctionCopiedFrom': 'kit/web/player/index.html',
}, indent=2)+'\n')
print(TARGET)

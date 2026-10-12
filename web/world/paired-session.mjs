import {selectedRegion} from './region.mjs';
import {pairedLockName} from './transfer-store.mjs';

// Match the native adapter's deliberately restricted, copied test kingdoms.
export const PAIRED_CASES=Object.freeze(['committed','retry','fail-source','fail-publish',
  'interrupt-source','interrupt-publish','interrupt-after','corrupt-input','corrupt-active','bad-moved']);
const regions=['999913_999914','999912_999914'];
const actions=['','initialize','commit','fail-after-source','fail-before-publish',
  'interrupt-after-source','interrupt-before-publish','interrupt-after-publish'];
export function pairedSessionConfig(search) {
  const query=new URLSearchParams(search),flag=query.getAll('RECOMP_RULE_FRONTIER_TRANSFER');
  if(flag.length>1||flag.length===1&&!/^[01]$/.test(flag[0]))throw new Error('Invalid paired-region setting');
  if(flag[0]!=='1')return null;
  const region=selectedRegion(search),trial=query.getAll('RECOMP_BROWSER_FRONTIER_TRANSFER_CASE');
  const action=query.getAll('RECOMP_BROWSER_FRONTIER_TRANSFER_ACTION');
  if(!region||!regions.includes(region.key)||trial.length!==1||!PAIRED_CASES.includes(trial[0])||
      query.get('RECOMP_RULE_FRONTIER_RESTORE')!=='1'||query.has('RECOMP_PROFILE_DIR')||query.has('world')||
      action.length>1||!actions.includes(action[0]??''))
    throw new Error('Paired-region startup requires an owned stopped test pair');
  return {root:'actor-wasm-transfer-'+trial[0],profile:'frontier_'+region.key};
}

// Called before the player hashes content, requests a GPU or injects WASM.
// Retain an exclusive lease for the whole document, including runtime failure:
// a failed-game message alone does not prove all native I/O has stopped.
export async function startPairedPlayer(start,{search=location.search,storage=navigator.storage,
    locks=navigator.locks,events=window}={}) {
  if(typeof start!=='function')throw new Error('Invalid player startup');
  const config=pairedSessionConfig(search);
  if(!config)return start();
  if(!storage||typeof storage.getDirectory!=='function'||!locks||typeof locks.request!=='function')
    throw new Error('Paired-region storage locking unavailable');
  let closing=false;
  const hide=()=>{closing=true;};
  events.addEventListener('pagehide',hide);
  try {
    return await locks.request(pairedLockName(config.root),{mode:'exclusive',ifAvailable:true},async lock=>{
      if(!lock)throw new Error('Shared checkpoint busy; close the other paired game or wait for publication');
      if(closing)return;
      const root=await storage.getDirectory(),game=await root.getDirectoryHandle('majesty');
      const profiles=await game.getDirectoryHandle('profile');
      await profiles.getDirectoryHandle(config.profile);
      const folder=await profiles.getDirectoryHandle(config.root);
      // Preparation writes this last. Never start in a half-created fixture.
      // Original native validation still checks full GMP hashes/content.
      const metadata=await(await folder.getFileHandle('Owned_Browser_Inputs.json')).getFile();
      if(!Number.isSafeInteger(metadata.size)||metadata.size<1||metadata.size>4096)
        throw new Error('Incomplete owned paired-region fixture');
      if(closing)return;
      events.removeEventListener('pagehide',hide);
      await start();
      // Neither pagehide nor a runtime-failure event proves native I/O ended.
      // Do not release manually: Web Locks releases on context destruction.
      // One pending promise per guarded page, with no poll, timer or queue.
      await new Promise(()=>{});
    });
  } finally {events.removeEventListener('pagehide',hide);}
}

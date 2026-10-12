const worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
const $=id=>document.getElementById(id), stopped=$('stopped'), status=$('status');
let busy=false, selected=null, checked=false, sequence=0, pending=new Map();
function state(){
  for(const id of ['export','choose','clear'])$(id).disabled=busy||!stopped.checked;
  $('restore').disabled=busy||!stopped.checked||!checked;
  $('recovery').disabled=busy||!stopped.checked;
}
function request(action,file){return new Promise((resolve,reject)=>{
  const id=++sequence;pending.set(id,{resolve,reject});worker.postMessage({id,action,file});
});}
worker.onmessage=({data})=>{const p=pending.get(data.id);if(!p)return;pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.result);};
worker.onerror=()=>{for(const p of pending.values())p.reject(Error('Backup worker stopped. Keep your original file and try again.'));pending.clear();};
async function operation(message,run){
  if(busy||!stopped.checked)return;busy=true;state();status.textContent=message;
  try{await run();}catch(error){status.textContent=error.message;if(/interrupted restore|Recover the interrupted/i.test(error.message))$('recovery').hidden=false;}
  finally{busy=false;state();}
}
stopped.onchange=state;
$('export').onclick=()=>operation('Reading saved kingdoms and progress…',async()=>{
  const result=await request('export'),url=URL.createObjectURL(result.blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download=`Majesty player backup ${new Date().toISOString().slice(0,10)}.zip`;anchor.click();
  // Release the archive reference when the browser has accepted the download.
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  status.textContent=`Player backup ready: ${result.nativeCount} native files and ${result.databaseCount} campaign/Atlas databases.`;
});
$('choose').onclick=()=>{if(!busy&&stopped.checked)$('file').click();};
$('clear').onclick=()=>operation('Clearing the temporary archive after your download…',async()=>{
  const result=await request('clear');status.textContent=result.cleared?'Temporary browser copy cleared. Your downloaded backup file is unchanged.':'No temporary backup copy was found.';
});
$('file').onchange=()=>{
  selected=$('file').files[0]??null;checked=false;$('preview').hidden=true;state();
  if(selected)operation('Checking backup contents and file hashes…',async()=>{
    const result=await request('inspect',selected);checked=true;$('summary').textContent=`${result.nativeCount} native save files · ${result.databaseCount} campaign and Atlas databases`;
    $('preview').hidden=false;status.textContent='Backup verified. Restore preserves any existing save collection by refusing conflicts.';
  });
};
$('restore').onclick=()=>operation('Restoring the checked player backup…',async()=>{
  const result=await request('restore',selected);checked=false;
  status.textContent=`Restored ${result.nativeCount} native files and ${result.databaseCount} progress databases. Import your game files separately, then choose your restored profile in the campaign or multiplayer launcher.`;
});
$('recovery').onclick=()=>operation('Discarding only the interrupted restore…',async()=>{
  const result=await request('discard');$('recovery').hidden=true;
  status.textContent=result.discarded?'Incomplete restore discarded. Your original backup file is unchanged.':'No interrupted restore was found.';
});
state();

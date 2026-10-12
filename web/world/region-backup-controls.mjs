import {exportNativeRegion,regionBackupFile,restoreNativeRegionBackup,REGION_BACKUP_PAGE} from './region-backup.mjs';
import {savedAtlasStore} from './native-atlas.mjs';
import {opfsNativeRealmStorage} from './realm-profile.mjs';
import {worldName} from './world-name.mjs';
import {nativeRegionURL,regionKey} from './region.mjs';

export const MAX_REGION_DOWNLOAD_BYTES=4*1024*1024;
// Local-file export where supported; other browsers have a deliberately small
// download fallback. No region is activated and no native game is auto-opened.
export function initializeRegionBackups({document,base,getCurrent,
  storage=globalThis.navigator?.storage,locks=globalThis.navigator?.locks,
  pickSave=globalThis.showSaveFilePicker?.bind(globalThis),urls=globalThis.URL,
  later=globalThis.setTimeout,cancel=globalThis.clearTimeout}={}){
  const node=id=>document.querySelector('#'+id);
  let save=node('kingdom-export'),restore=node('kingdom-restore'),file=node('kingdom-file'),
    name=node('kingdom-name'),status=node('kingdom-status'),resume=node('kingdom-resume');
  let busy=false,downloadURL=null,timer=null,closed=false,closing=null,work=null;
  const cancellation=new AbortController();
  function requireOpen(){if(closed)throw new Error('Saved kingdom backups closed');}
  function releaseDownload(){
    if(timer!==null){cancel(timer);timer=null;}
    if(downloadURL!==null){urls.revokeObjectURL(downloadURL);downloadURL=null;}
  }
  function update(){
    if(!save)return;
    save.disabled=closed||busy||!getCurrent().world;restore.disabled=closed||busy;file.disabled=closed||busy;name.disabled=closed||busy;
  }
  function start(){
    busy=true;let settle;work=new Promise(resolve=>{settle=resolve;});
    update();resume.hidden=true;resume.removeAttribute('href');
    return ()=>{busy=false;work=null;settle();update();};
  }
  async function profiles(create=false){
    requireOpen();
    if(typeof storage?.getDirectory!=='function')throw new Error('Local game storage unavailable');
    const root=await storage.getDirectory();requireOpen();
    const game=await root.getDirectoryHandle('majesty',create?{create:true}:undefined);requireOpen();
    const directory=await game.getDirectoryHandle('profile',create?{create:true}:undefined);requireOpen();
    return directory;
  }
  save.onclick=async()=>{
    if(closed||busy)return;
    const current=getCurrent();if(!current.world)return;
    let sink=null;
    const finish=start();status.textContent='Exporting the last saved kingdom…';
    try{
      const world=worldName(current.world),key=regionKey(current.x,current.y),filename=`${world}-${key}.majesty-region`;
      // Invoke before the first await so the browser retains click activation.
      const chosen=pickSave?await pickSave({suggestedName:filename,
        types:[{description:'Majesty saved kingdom',accept:{'application/octet-stream':['.majesty-region']}}]}):null;
      requireOpen();
      let parts=[],total=0;
      sink=chosen?await chosen.createWritable():{
        async write(bytes){
          requireOpen();
          if(!(bytes instanceof Uint8Array)||bytes.length>REGION_BACKUP_PAGE||total+bytes.length>MAX_REGION_DOWNLOAD_BYTES)
            throw new Error('This backup needs direct file saving; use a browser with a file save picker');
          parts.push(Uint8Array.from(bytes));total+=bytes.length;
        },
        async close(){
          requireOpen();
          releaseDownload();
          const blob=new Blob(parts,{type:'application/octet-stream'});parts=[];
          downloadURL=urls.createObjectURL(blob);
          const link=document.createElement('a');link.href=downloadURL;link.download=filename;
          try{document.body.appendChild(link);link.click();}finally{link.remove();}
          timer=later(releaseDownload,5000);
        },
        async abort(){parts=[];total=0;releaseDownload();},
      };
      requireOpen();
      const directory=await profiles();
      const result=await exportNativeRegion(savedAtlasStore(opfsNativeRealmStorage(directory,world,locks)),key,sink,{world,signal:cancellation.signal});
      requireOpen();
      await sink.close();sink=null;
      if(!closed)status.textContent=`Saved kingdom ${key.replace('_',', ')} exported (${result.bytes.toLocaleString()} bytes).`;
    }catch(error){
      try{await sink?.abort();}catch{/* Report the original failure; do not publish a download. */}
      if(!closed)status.textContent=error.name==='AbortError'?'Export cancelled.':`Export stopped: ${error.message}`;
    }finally{finish();}
  };
  restore.onclick=async()=>{
    if(closed||busy)return;
    const finish=start();status.textContent='Checking saved kingdom…';
    try{
      const world=worldName(name.value),source=regionBackupFile(file.files?.[0]);
      // Only the game/profile container may be created before validation;
      // restoreNativeRegionBackup never claims a target world until validation.
      const result=await restoreNativeRegionBackup(await profiles(true),world,source,{locks});
      // Once admitted, restore finishes its atomic publication even if this
      // view departs. Never publish a late link or abandon its owned writer.
      if(closed)return;
      const [x,y]=result.region.split('_').map(Number),destination=new URL(base);
      destination.search='';destination.searchParams.set('world',world);
      resume.href=String(nativeRegionURL(x,y,destination));resume.hidden=false;
      status.textContent=`Restored saved kingdom into ${world}, region ${x}, ${y}. The game checks its required assets when you resume.`;
    }catch(error){if(!closed)status.textContent=`Restore stopped: ${error.message}`;}
    finally{finish();}
  };
  update();
  return {refresh:update,dispose:releaseDownload,close(){
    if(closing)return closing;
    closed=true;cancellation.abort();releaseDownload();update();
    save.onclick=restore.onclick=null;resume.hidden=true;resume.removeAttribute('href');file.value='';
    closing=(async()=>{
      await work;
      save=restore=file=name=status=resume=null;
      document=getCurrent=storage=locks=pickSave=urls=later=cancel=base=null;
    })();
    return closing;
  }};
}

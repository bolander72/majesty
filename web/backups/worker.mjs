import {exportPlayer,restorePlayer,discardInterruptedRestore,clearBackupDownload} from './storage.mjs';
import {inspectBundle} from './bundle.mjs';
let busy=false;
self.onmessage=async({data})=>{
  const {id,action,file}=data;
  if(busy){self.postMessage({id,error:'A player backup operation is already running.'});return;}
  busy=true;
  try{
    let result;
    if(action==='export'){
      const {blob,manifest}=await exportPlayer();result={blob,nativeCount:manifest.native.length,databaseCount:manifest.databases.length};
    }else if(action==='inspect'){
      const {nativeCount,databaseCount}=await inspectBundle(file,{retainDatabases:false});result={nativeCount,databaseCount};
    }else if(action==='restore')result=await restorePlayer(file);
    else if(action==='discard')result={discarded:await discardInterruptedRestore()};
    else if(action==='clear')result={cleared:await clearBackupDownload()};
    else throw Error('Unknown backup operation.');
    self.postMessage({id,result});
  }catch(error){self.postMessage({id,error:error.message});}
  finally{busy=false;}
};

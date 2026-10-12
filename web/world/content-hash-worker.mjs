import {hashBlob} from './content-hash.mjs';

let busy=false;
self.onmessage=async event=>{
  const data=event.data;
  if(busy||!data||!Number.isSafeInteger(data.id)||data.id<1){
    self.postMessage({id:data?.id,error:true});return;
  }
  busy=true;
  try{self.postMessage({id:data.id,sha256:await hashBlob(data.file)});}
  catch{self.postMessage({id:data.id,error:true});}
  finally{busy=false;}
};

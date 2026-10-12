// Inject a fault after an atomic close has already made its bytes visible.
export function afterFileClose(profiles,filename,consume){
 let called=false;
 function decorate(folder){return {
  async getDirectoryHandle(name,options){return decorate(await folder.getDirectoryHandle(name,options));},
  removeEntry:name=>folder.removeEntry(name),
  async getFileHandle(name,options){const handle=await folder.getFileHandle(name,options);return {
   getFile:()=>handle.getFile(),async createWritable(){const stream=await handle.createWritable();return {
    write:bytes=>stream.write(bytes),abort:()=>stream.abort(),async close(){await stream.close();
     if(!called&&name===filename){called=true;await consume();}
    },
   };},
  };},
 };}
 return decorate(profiles);
}

// Small synthetic guest images for original-code checks. No game/heap is read.
import {writeFileSync} from 'node:fs';
import {planNativeCacheRetirement,revalidateNativeCacheRetirement} from '../web/world/native-cache-retirement.mjs';
const cases=[];
for(const retiringKeys of [[],[1],[1,2,3]]){
  const keys=[1,2,1,3,2,1],memory=new Uint8Array(512).fill(0xa5),view=new DataView(memory.buffer);
  const base=0x100000,collectionAddress=base+32,head=base+80,addresses=keys.map((_,i)=>base+128+i*48);
  const word=(address,value)=>view.setUint32(address-base,value>>>0,true);
  word(collectionAddress,0x68a8e8);word(collectionAddress+4,0x12345678);
  word(collectionAddress+8,head);word(collectionAddress+12,keys.length);
  word(head,addresses[0]);word(head+4,addresses.at(-1));
  keys.forEach((key,i)=>{
    const at=addresses[i];word(at,addresses[i+1]??head);word(at+4,addresses[i-1]??head);word(at+8,0x68a8e0);
    for(let j=3;j<7;++j)word(at+4*j,0xf0000000+i*100+j);
    word(at+28,key);word(at+32,0x80ffffff-i);
  });
  const readBytes=async(address,length)=>memory.subarray(address-base,address-base+length);
  const plan=await planNativeCacheRetirement(readBytes,{collectionAddress,retiringKeys});
  await revalidateNativeCacheRetirement(readBytes,plan);
  cases.push({base,keys,addresses,retiringKeys,plan,memoryWords:Array.from({length:128},(_,i)=>view.getUint32(i*4,true))});
}
writeFileSync(new URL('../output/native-cache-retirement-fixtures.json',import.meta.url),JSON.stringify({synthetic:true,cases},null,2)+'\n');
console.log(JSON.stringify({prepared:true,cases:cases.length,syntheticBytesPerCase:512,gameLaunched:false}));

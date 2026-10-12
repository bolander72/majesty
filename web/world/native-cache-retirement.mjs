// Read-only retirement plans for the pinned native cached-rectangle collection.
// No live engine writer is installed. A future consumer must hold the stopped
// world's exclusive lease through preflight, original value destruction and free.
export const MAX_NATIVE_CACHE_NODES=512;
export const NATIVE_CACHE_NODE_BYTES=36;
export const MAX_NATIVE_CACHE_CAPTURE_BYTES=24+MAX_NATIVE_CACHE_NODES*NATIVE_CACHE_NODE_BYTES;
const VALUE_TABLE=0x0068a8e0;
const COLLECTION_TABLE=0x0068a8e8;
const plans=new WeakSet();
function pointer(value,length=4){
  if(!Number.isInteger(value)||value<=0||value%4||value+length>0x100000000)
    throw new Error('Invalid native cache address');
  return value;
}
async function words(readBytes,address,length){
  pointer(address,length);
  const bytes=await readBytes(address,length);
  if(!(bytes instanceof Uint8Array)||bytes.byteLength!==length)
    throw new Error('Incomplete native cache read');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),out=[];
  for(let at=0;at<length;at+=4)out.push(view.getUint32(at,true));
  // Plans own only numeric copies, never the source view or its backing heap.
  return Object.freeze(out);
}
const frozen=value=>Object.freeze(value);

export async function planNativeCacheRetirement(readBytes,{collectionAddress,retiringKeys}={}){
  if(typeof readBytes!=='function')throw new Error('Invalid native cache reader');
  pointer(collectionAddress,16);
  if(!Array.isArray(retiringKeys)||retiringKeys.length>MAX_NATIVE_CACHE_NODES||
      retiringKeys.some(n=>!Number.isInteger(n)||n<0||n>0xffffffff)||
      new Set(retiringKeys).size!==retiringKeys.length)
    throw new Error('Invalid native cache retiring keys');
  const keys=new Set(retiringKeys),capture=[];
  async function take(address,length){
    const value=await words(readBytes,address,length);
    capture.push(frozen({address,words:value}));return value;
  }
  const collection=await take(collectionAddress,16),head=pointer(collection[2],36),count=collection[3];
  if(collection[0]!==COLLECTION_TABLE)throw new Error('Invalid native cache collection type');
  if(count>MAX_NATIVE_CACHE_NODES)throw new Error('Native cache node budget exceeded');
  const sentinel=await take(head,8),nodes=[],seen=new Set();
  let next=sentinel[0],previous=head;
  for(let index=0;index<count;++index){
    pointer(next,NATIVE_CACHE_NODE_BYTES);
    if(next===head||seen.has(next))throw new Error('Invalid native cache cycle or count');
    seen.add(next);
    const value=await take(next,NATIVE_CACHE_NODE_BYTES);
    if(value[1]!==previous||value[2]!==VALUE_TABLE)throw new Error('Invalid native cache backlink or value type');
    nodes.push(frozen({address:next,words:value}));previous=next;next=value[0];
  }
  if(next!==head||sentinel[1]!==previous)throw new Error('Invalid native cache sentinel or count');
  // The original constructor allocates a full 36-byte sentinel even though
  // only its two link words are initialized/read. Reserve that entire extent.
  const ranges=[[collectionAddress,collectionAddress+16],[head,head+36],
    ...nodes.map(node=>[node.address,node.address+36])].sort((a,b)=>a[0]-b[0]);
  for(let i=1;i<ranges.length;++i)
    if(ranges[i][0]<ranges[i-1][1])throw new Error('Overlapping native cache storage');
  const retiring=nodes.filter(node=>keys.has(node.words[7])),surviving=nodes.filter(node=>!keys.has(node.words[7]));
  const writes=[];
  function patch(address,expected,value){if(expected!==value)writes.push(frozen({address,expected,value}));}
  patch(head,sentinel[0],surviving[0]?.address??head);
  patch(head+4,sentinel[1],surviving.at(-1)?.address??head);
  for(let i=0;i<surviving.length;++i){
    const node=surviving[i];
    patch(node.address,node.words[0],surviving[i+1]?.address??head);
    patch(node.address+4,node.words[1],surviving[i-1]?.address??head);
  }
  patch(collectionAddress+12,count,surviving.length);
  const plan=frozen({collectionAddress,head,beforeCount:count,afterCount:surviving.length,
    capturedBytes:24+count*NATIVE_CACHE_NODE_BYTES,capture:frozen(capture),writes:frozen(writes),
    retiring:frozen(retiring.map(node=>frozen({address:node.address,valueAddress:node.address+8,
      rectangleWords:frozen(node.words.slice(3,7)),key:node.words[7],metadata:node.words[8]}))),
    survivingAddresses:frozen(surviving.map(node=>node.address))});
  plans.add(plan);return plan;
}

// Detect any changed captured word, including an unrelated surviving payload.
// This is a preflight check, not a lock or an atomic engine mutation operation.
export async function revalidateNativeCacheRetirement(readBytes,plan){
  if(typeof readBytes!=='function'||!plans.has(plan))throw new Error('Invalid native cache retirement plan');
  for(const item of plan.capture){
    const current=await words(readBytes,item.address,item.words.length*4);
    if(current.some((value,index)=>value!==item.words[index]))throw new Error('Native cache changed since retirement capture');
  }
  return true;
}

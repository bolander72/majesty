// Preserve only the original three-bank empty order representation. Nonempty
// command state still needs reference/clock/navigation migration in the engine.
import {checkpointAttachments} from './checkpoint.mjs';

export async function checkpointEmptyActorOrders(source,unitId){
  if(!Number.isInteger(unitId)||unitId<=0||unitId>0xffffffff)
    throw new Error('Invalid native orders unit ID');
  let selected=null;
  // Exhaust attachment metadata even after the selected actor was found.
  for await(const attachment of checkpointAttachments(source)){
    if(attachment.kind!=='ORDR'||attachment.unitId!==unitId)continue;
    if(selected)throw new Error('Duplicate native orders for arriving actor');
    if(attachment.components.length!==1||attachment.primary.size!==24)
      throw new Error('Arrival orders require the original three empty banks');
    const offset=attachment.primary.offset+16,bytes=await source.readAt(offset,24);
    if(!(bytes instanceof Uint8Array)||bytes.byteLength!==24)throw new Error('Truncated native orders');
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),banks=[];
    for(let bank=0;bank<3;++bank){
      const version=view.getUint32(bank*8,true),count=view.getUint32(bank*8+4,true);
      if(version!==1||count!==0)throw new Error('Arrival with nonempty or unsupported native orders is not supported');
      banks.push({bank,version,count});
    }
    selected={attachment,banks};
  }
  return selected;
}

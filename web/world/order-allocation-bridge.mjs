// Scoped cdecl claim decisions only. No hook registration or native execution.
const factoryKinds=[[1,0x5da543,88],[2,0x5da579,92],[4,0x5da5e5,100],
  [5,0x5da61b,92],[6,0x5da651,92],[7,0x5da687,72],[10,0x5da6f3,76],[11,0x5da729,112]];
export const NATIVE_ORDER_ALLOCATION_SITES=Object.freeze([
  Object.freeze({callerPc:0x5e4c71,role:'head',kind:null,bytes:12}),
  ...factoryKinds.map(([kind,callerPc,bytes])=>Object.freeze({callerPc,role:'order',kind,bytes})),
  Object.freeze({callerPc:0x5e0e39,role:'path',kind:4,bytes:null}),
  Object.freeze({callerPc:0x5e2b61,role:'path',kind:7,bytes:80}),
  Object.freeze({callerPc:0x5e4dc9,role:'node',kind:null,bytes:12})]);
// Original copier's malloc return PC. EBX preserves its destination field.
export const NATIVE_ORDER_NAME_ALLOCATION_SITE=Object.freeze({callerPc:0x523485,bytes:1});
const sites=new Map(NATIVE_ORDER_ALLOCATION_SITES.map(s=>[s.callerPc,s]));
const delegate=Object.freeze({action:'delegate'}),uint32=n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff;

// A native adapter must tag only the originating stopped invocation with the
// returned token. Foreign threads/callbacks and inactive calls delegate. Errors
// inside an owned invocation must stop it before another guest instruction;
// never translate a claim error into a null pointer for unchecked native code.
export function createUnpublishedOrderAllocationBridge(journal){
  if(journal?.phase!=='reserved'||typeof journal.claim!=='function'||typeof journal.assertFullyClaimed!=='function')
    throw new Error('Reserved native order storage journal required');
  const requests=journal.requests,blocks=journal.reservations,
    find=(role,bank,index=null)=>requests.find(r=>r.role===role&&r.bank===bank&&r.index===index),
    address=(role,bank,index=null)=>blocks.find(r=>r.role===role&&r.bank===bank&&r.index===index)?.address;
  let constructed=0,read=0,active=null,failed=false,closed=false;
  function ready(){if(closed||failed||active||journal.phase!=='reserved')throw new Error('Native allocation bridge cannot begin a scope');}
  function poison(message){failed=true;throw new Error(message);}
  function claim(request){try{return journal.claim(request);}catch(error){failed=true;throw error;}}
  return Object.freeze({scope:'unpublished-initial-bank-cdecl-allocation-claims',completeOrderMigration:false,
    beginConstruction(bank){
      ready();if(!Number.isInteger(bank)||bank!==constructed||bank>=journal.plan.banks)
        throw new Error('Unexpected native bank construction sequence');
      const request=find('bank',bank),bankAddress=claim(request),token=Symbol('native order construction');
      active={phase:'construct',bank,token,head:false,bankAddress};return Object.freeze({token,bank,address:bankAddress});
    },
    endConstruction(returnedAddress){
      if(failed||active?.phase!=='construct'||!active.head||returnedAddress!==active.bankAddress)
        poison('Incomplete native bank constructor allocation claims or return');
      ++constructed;active=null;
    },
    beginRead(bank){
      ready();if(constructed!==journal.plan.banks||!Number.isInteger(bank)||bank!==read||bank>=constructed)
        throw new Error('Unexpected native bank read sequence');
      const token=Symbol('native order read');active={phase:'read',bank,token,next:0,entry:null,observedFailure:false};
      return Object.freeze({token,bank,address:address('bank',bank)});
    },
    intercept({token,callerPc,bytes,esi,streamStatus=0}={}){
      if(!active||token!==active.token)return delegate;
      if(failed||journal.phase!=='reserved')poison('Native allocation claim scope is invalid');
      if(!uint32(callerPc)||!uint32(bytes)||!uint32(esi)||!uint32(streamStatus))poison('Invalid native allocation frame');
      const site=sites.get(callerPc);if(!site)poison('Unexpected native allocation caller');
      if(site.bytes!==null&&site.bytes!==bytes)poison('Unexpected native allocation size');
      let request;
      if(site.role==='head'){
        if(active.phase!=='construct'||active.head||esi!==active.bankAddress)poison('Unexpected native sentinel allocation context');
        request=find('head',active.bank);active.head=true;
      }else{
        if(active.phase!=='read')poison('Order allocation outside native read scope');
        if(streamStatus)active.observedFailure=true;
        if(site.role==='order'){
          if(active.entry&&!active.entry.node)poison('Native order factory advanced before node allocation');
          request=find('order',active.bank,active.next);
          if(!request||request.kind!==site.kind)poison('Unexpected native order factory kind or entry');
          active.entry={index:active.next++,kind:site.kind,node:false,path:false,baseName:false,leafName:false,
            address:address('order',active.bank,request.index)};
        }else{
          const entry=active.entry;if(!entry||entry.node)poison('Native allocation has no pending order');
          if(site.role==='path'){
            if(entry.path||entry.kind!==site.kind||esi!==entry.address)poison('Unexpected native path allocation owner');
            request=find('path',active.bank,entry.index);entry.path=true;
            // Failed kind-4 loading before capacity consumption requests zero.
            // Its unused reserved path remains owned for whole-journal rollback.
            if(site.kind===4&&bytes===0&&request.bytes>0&&streamStatus)
              return Object.freeze({action:'return',eax:0,argBytes:0,failedReadZeroRequest:true});
          }else{
            if([4,7].includes(entry.kind)&&!entry.path)poison('Native node allocated before path readiness');
            if(!streamStatus&&(!entry.baseName||(find('leafName',active.bank,entry.index)&&!entry.leafName)))
              poison('Native node allocated before name readiness');
            if(esi!==address('head',active.bank))poison('Unexpected native node list owner');
            request=find('node',active.bank,entry.index);entry.node=true;
          }
        }
      }
      if(!request||request.bytes!==bytes)poison('Native request differs from reserved storage');
      return Object.freeze({action:'return',eax:claim(request),argBytes:0});
    },
    interceptName({token,callerPc,bytes,ebx}={}){
      if(!active||token!==active.token)return delegate;
      if(failed||journal.phase!=='reserved')poison('Native allocation claim scope is invalid');
      if(!uint32(callerPc)||!uint32(bytes)||!uint32(ebx))poison('Invalid native name allocation frame');
      const entry=active.entry;
      if(active.phase!=='read'||!entry||entry.node)poison('Name allocation outside pending native order');
      if(callerPc!==NATIVE_ORDER_NAME_ALLOCATION_SITE.callerPc)poison('Unexpected native name allocation caller');
      if(bytes!==1)poison('Unexpected native name allocation size');
      let role;
      if(ebx===entry.address+36)role='baseName';
      else if([2,5,6,11].includes(entry.kind)&&ebx===entry.address+([2,6].includes(entry.kind)?76:72))role='leafName';
      else poison('Unexpected native name allocation field');
      const request=find(role,active.bank,entry.index),eax=claim(request);entry[role]=true;
      return Object.freeze({action:'return',eax,argBytes:0});
    },
    endRead(status){
      if(failed||active?.phase!=='read'||!uint32(status))poison('Invalid native bank read completion');
      if(active.entry&&!active.entry.node)poison('Native bank read left an unlinked order');
      if(status){failed=true;active=null;return false;}
      if(active.observedFailure||active.next!==requests.filter(r=>r.role==='order'&&r.bank===active.bank).length)
        poison('Incomplete native bank read reported success');
      ++read;active=null;return true;
    },
    assertComplete(){
      if(closed||failed||active||constructed!==journal.plan.banks||read!==constructed)
        throw new Error('Native allocation bridge is incomplete');
      return journal.assertFullyClaimed();
    },
    // Call only after the native invocation has stopped and its hook is removed.
    // This closes claim decisions; the journal still owns and releases storage.
    close(){closed=true;active=null;},
    get failed(){return failed;},get closed(){return closed;}
  });
}

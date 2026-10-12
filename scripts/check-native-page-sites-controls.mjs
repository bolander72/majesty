#!/usr/bin/env node
// Refuse contradictions of actual observations without mutating files or launching a game.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {verifyPageSites,parsePageEvents} from './check-native-page-sites.mjs';
import {assertMallocCallInstruction} from './check-native-malloc-sites.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);
const proof=await verifyPageSites(name),m=JSON.parse(await readFile(name)),actual=(await readFile(m.log)).toString('utf8');
const golden=parsePageEvents(actual,proof.visits.length),checks=[];
function refuses(label,bad){assert.notEqual(bad,actual);assert.deepEqual(parsePageEvents(actual,proof.visits.length),golden);assert.throws(()=>parsePageEvents(bad,proof.visits.length));checks.push({name:label,actualPositivePassed:true,refused:true});}
const alloc=actual.match(/^\[streaming\] World page event=\d+ op=alloc .*direct-caller=(?!00000000)[0-9a-f]{8} .*$/m)?.[0],free=actual.match(/^\[streaming\] World page event=\d+ op=free .*$/m)?.[0];assert.ok(alloc&&free,'Require an actually identified caller and actual original free');
const change=(label,line,pattern,replacement)=>refuses(label,actual.replace(line,line.replace(pattern,replacement)));
change('wrong event ordinal',alloc,/event=\d+/,'event=0');
change('unaligned address',alloc,/address=[0-9a-f]{8}/,'address=01000001');
change('out of arena address',alloc,/address=[0-9a-f]{8}/,'address=fffffff0');
change('wrong rounded size',alloc,'heap-requested=4096','heap-requested=4112');
change('out of observed request class',alloc,'input=4096','input=4080');
change('impossible load count',alloc,/loads=\d+/,'loads=33');
change('impossible exit count',alloc,/exits=\d+/,'exits=33');
change('wrong wrapper return',alloc,'return-pc=0064d5c1','return-pc=0064d5c0');
change('unqualified direct callee',alloc,/direct-callee=[0-9a-f]{8}/,'direct-callee=0064d5dd');
change('callee without caller',alloc,/direct-caller=[0-9a-f]{8}/,'direct-caller=00000000');
change('caller without callee',alloc,/direct-callee=[0-9a-f]{8}/,'direct-callee=00000000');
change('outside image caller',alloc,/direct-caller=[0-9a-f]{8}/,'direct-caller=ffffffff');
change('failed allocation event',alloc,'result=pass','result=fail');
change('free did not retire block',free,'freed=1','freed=0');
refuses('missing event',actual.replace(free+'\n',''));
refuses('duplicated event',actual.replace(alloc,alloc+'\n'+alloc));
refuses('malformed extra event',actual+'\n[streaming] World page event=invalid\n');
refuses('malformed extra observer',actual+'\n[streaming] World page observer invalid\n');
for(const site of proof.callers) {
 const valid=Buffer.alloc(5);valid[0]=0xe8;valid.writeInt32LE((site.callee-site.returnPc)|0,1);assert.equal(sha(valid),site.instructionSha256);assertMallocCallInstruction(site.returnPc,site.callee,valid);
 const wrongOpcode=Buffer.from(valid);wrongOpcode[0]=0xe9;assert.throws(()=>assertMallocCallInstruction(site.returnPc,site.callee,wrongOpcode));
 const wrongTarget=Buffer.from(valid);wrongTarget[1]^=1;assert.throws(()=>assertMallocCallInstruction(site.returnPc,site.callee,wrongTarget));
 checks.push({name:`changed CALL opcode at ${site.callInstruction.toString(16)}`,actualPositivePassed:true,refused:true},{name:`changed CALL target at ${site.callInstruction.toString(16)}`,actualPositivePassed:true,refused:true});
}
const report={qualified:true,scope:'Actual original persistence, completed boundary, allocation events and pinned caller instructions independently requalified; contradictory trace and CALL bytes refuse in memory. Does not qualify all page origins, allocation ownership or safe cleanup.',sourceManifest:proof.sourceManifest,sourceManifestSha256:proof.sourceManifestSha256,controlsRefused:checks.length,checks,
 pageAllocationOriginsQualified:false,allocationOwnershipQualified:false,wholeBrowserMemoryBoundQualified:false,browserUsed:false,nativeProcessesStarted:0,
 sourceSha256:{...proof.sourceSha256,'scripts/check-native-page-sites-controls.mjs':sha(await readFile(new URL(import.meta.url)))},evidenceSha256:proof.evidenceSha256};
await writeFile(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({qualified:true,controlsRefused:checks.length}));

#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {inspectHostLoaded} from './inspect-native-coop-host-loaded.mjs';
const[name,output]=process.argv.slice(2);assert.equal(process.argv.length,4);
const raw=await readFile(resolve(name)),m=JSON.parse(raw),scratch=resolve('output/native-multiplayer-lobby-975-observed.json'),results=[];
const positive=await inspectHostLoaded(name,{requireGameplayEquality:false});
assert.equal(positive.hostCommittedGenerationRebuildLoadedQualified,true);assert.equal(positive.hostOriginalResumeExecuted,true);
const equal=positive.sourceImportedLiveGameplayMatches&&positive.recordedRoleTargetGameplayEqualityQualified;
if(equal){const checked=await inspectHostLoaded(name);assert.equal(checked.recordedRoleTargetGameplayEqualityQualified,true);results.push({name:'strict-matching-worlds-accepted',passed:true});}
else{await assert.rejects(()=>inspectHostLoaded(name),/Saved (?:entities|world sections) differ/);results.push({name:'strict-divergent-worlds-refused',passed:true});}
const cases=[
 ['missing-recipient-replay',r=>{r.replayRecipientVotesRequested=false;}],
 ['missing-original-host-begin',r=>{r.nativeBeginFreshNeighborRequested=false;}],
 ['missing-target-save',r=>{r.originalLoadedTargetSaved=false;}],
 ['missing-actual-captured-ready',r=>{r.referenceReplayedRecipientReadyVotes=0;}],
 ['missing-actual-captured-loaded',r=>{r.referenceReplayedRecipientLoadedVotes=0;}],
 ['missing-captured-proof',r=>{r.recipientVoteReplayInputs.shift();}],
 ['corrupt-captured-wire',r=>{r.recipientVoteReplayInputs[1].sha256='0'.repeat(64);}],
 ['helper-custody-different',r=>{r.proposalReplayHelperSha256='0'.repeat(64);}],
 ['source-custody-different',r=>{r.importedAgreedSource[0].sha256='0'.repeat(64);}],
 ['source-borrowed',r=>{r.importedAgreedSource[0].source=r.importedAgreedSource[1].source;}],
 ['loaded-body-modified',r=>{r.replayedOriginalRecipientVoteBodies[1].sha256='0'.repeat(64);}],
 ['actual-host-loaded-missing',r=>{r.proposalProtocolRequests.splice(7,1);}],
 ['recorded-guest-loaded-labeled-host',r=>{r.proposalProtocolRequests[8].sender=1;r.proposalProtocolRequests[8].host=true;}],
 ['complete-event-missing',r=>{r.observedProposalEvents.pop();}],
 ['complete-event-wrong-descriptor',r=>{r.observedProposalEvents[2].descriptorSha256='0'.repeat(64);}],
 ['target-custody-different',r=>{r.loadedTargetSnapshot.sha256='0'.repeat(64);}]
];
let created=false;
try{for(const[n,mutate]of cases){const copy=structuredClone(m);mutate(copy);await writeFile(scratch,JSON.stringify(copy),{flag:'wx'});created=true;await assert.rejects(()=>inspectHostLoaded(scratch,{requireGameplayEquality:equal}),undefined,n);await unlink(scratch);created=false;results.push({name:n,passed:true});}}
finally{if(created)await unlink(scratch);}
await writeFile(resolve(output),JSON.stringify({controls:results.length,results,nativeProcessesStarted:0,browserUsed:false,worldEqualityQualified:equal},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({controls:results.length,passed:true}));

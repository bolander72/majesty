#!/usr/bin/env node
// Reject contradictory completion evidence; never launch a game or browser.
import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {inspectRecipientResume} from './inspect-native-coop-recipient-resume.mjs';
const [name,output]=process.argv.slice(2);assert.equal(process.argv.length,4);
const m=JSON.parse(await readFile(resolve(name))),scratch=resolve('output/native-multiplayer-lobby-978-observed.json');
const positive=await inspectRecipientResume(name);assert.equal(positive.actualOriginalHostResumeCaptureBound,true);
const cases=[
 ['missing-completion-replay',r=>{r.replayHostCompletionRequested=false;}],
 ['missing-host-loaded-delivery',r=>{r.capturedOriginalHostLoadedDelivered=false;}],
 ['missing-original-resume-delivery',r=>{r.capturedOriginalHostResumeDelivered=false;}],
 ['duplicate-host-loaded',r=>{r.referenceHostLoadedVotesSent=2;}],
 ['missing-complete',r=>{r.observedProposalEvents.pop();}],
 ['wrong-complete-stage',r=>{r.observedProposalEvents[2].stage=2;}],
 ['missing-actual-host-loaded',r=>{r.proposalProtocolRequests.pop();}],
 ['wrong-host-loaded-owner',r=>{r.proposalProtocolRequests.at(-1).sender=2;}],
 ['changed-host-loaded-body',r=>{r.replayedOriginalHostLoadedBody.sha256='0'.repeat(64);}],
 ['changed-original-resume-custody',r=>{r.hostCompletionReplayInputs[3].sha256='0'.repeat(64);}],
 ['borrowed-original-resume-source',r=>{r.hostCompletionReplayInputs[3].source=r.hostCompletionReplayInputs[4].source;}],
 ['missing-captured-input',r=>{r.hostCompletionReplayInputs.pop();}],
 ['changed-delivered-input',r=>{r.capturedOriginalHostResumeInputs.at(-1).sha256='0'.repeat(64);}],
 ['changed-completion-helper',r=>{r.completionReplayHelperSha256='0'.repeat(64);}],
 ['borrowed-target-world',r=>{r.loadedTargetSnapshot.path=r.worldSnapshots[1].path;}],
];
const results=[];let created=false;
try {for(const [name,mutate]of cases){
 const copy=structuredClone(m);mutate(copy);await writeFile(scratch,JSON.stringify(copy),{flag:'wx'});created=true;
 await assert.rejects(()=>inspectRecipientResume(scratch),undefined,name);await unlink(scratch);created=false;results.push({name,passed:true});
}}
finally {if(created)await unlink(scratch);}
await writeFile(resolve(output),JSON.stringify({controls:results.length,results,positiveOriginalRecipientResume:true,
 actualOriginalHostCaptureBound:true,nativeProcessesStarted:0,browserUsed:false,livePairedQualified:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({controls:results.length,passed:true}));

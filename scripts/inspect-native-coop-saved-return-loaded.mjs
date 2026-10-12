#!/usr/bin/env node
// Recorded host Ready admits the actual original recipient saved reader.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {inspectSavedReturnRecipient} from './inspect-native-coop-saved-return-recipient.mjs';
if (process.argv[1] === new URL(import.meta.url).pathname) {
  try {
    assert.equal(process.argv.length,4);
    const proof=await inspectSavedReturnRecipient(process.argv[2],{committed:true});
    await writeFile(resolve(process.argv[3]),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({recipientSavedReaderLoaded:true,sourceClock:proof.sourceClock,
      homeClock:550,secondHostLoadedSupplied:false,returnCompleted:false}));
  } catch(e) {
    console.error(JSON.stringify({error:e.name,message:String(e.message).split('\n')[0],
      at:e.stack?.split('\n').filter(l=>l.trim().startsWith('at ')).slice(0,2)}));process.exitCode=1;
  }
}

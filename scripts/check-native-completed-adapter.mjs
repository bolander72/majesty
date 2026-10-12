#!/usr/bin/env node
import assert from 'node:assert/strict';
import {assertCompletedTickAdapter} from './lib/completed-tick-adapter.mjs';
const [current,prior]=process.argv.slice(2);assert.equal(process.argv.length,4);
await assertCompletedTickAdapter(current,prior);console.log(JSON.stringify({qualified:true}));

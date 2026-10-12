#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {NATIVE_ORDER_ALLOCATION_SITES} from '../web/world/order-allocation-bridge.mjs';
const sourceSha256={};for(const name of ['web/world/order-allocation-bridge.mjs','scripts/export-native-order-allocation-sites.mjs'])
  sourceSha256[name]=createHash('sha256').update(await readFile(new URL('../'+name,import.meta.url))).digest('hex');
await writeFile(new URL('../output/native-order-allocation-sites.json',import.meta.url),JSON.stringify({sites:NATIVE_ORDER_ALLOCATION_SITES,sourceSha256},null,2)+'\n');
console.log(JSON.stringify({sites:NATIVE_ORDER_ALLOCATION_SITES.length,nativeHookRegistered:false}));

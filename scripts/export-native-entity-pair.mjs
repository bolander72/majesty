#!/usr/bin/env node
// Export/revalidate one stopped published NPC pair. No native/browser launch.
import {open, readFile, writeFile, mkdtemp, lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join, resolve} from 'node:path';
import assert from 'node:assert/strict';
import {openEntityPairStore, encodeEntityLedger} from '../web/world/entity-pair.mjs';
import {exportSelectedEntityPair} from '../web/world/entity-export.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
import {workspace, stoppedFileSource, stoppedPairReader, ownedDirectory} from './lib/stopped-entity-io.mjs';
const sha = b => createHash('sha256').update(b).digest('hex');
const keys = (o,k) => o && Object.keys(o).sort().join(',') === [...k].sort().join(',');
async function boundedJson(filename, limit) {
  const source = await stoppedFileSource(filename);
  if (source.size > limit) throw Error('Export metadata exceeds bound');
  const bytes = await source.readAt(0,source.size);
  return {bytes,value:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))};
}
async function pair(reportName, directory) {
  const bytes = await readFile(reportName), report = JSON.parse(bytes);
  if (!report.qualified || report.fileBackedPairedOwnershipPublicationQualified !== true || report.selectedCompletePairAndSingleEntityOwnerQualified !== true)
    throw Error('Require qualified published pair');
  const fixture = await ownedDirectory(report.fixture,'actor-arrival-fixture-entity-pair-');
  if (directory !== join(fixture,'after-publish')) throw Error('Require the published supervised case');
  const store = await openEntityPairStore(await stoppedPairReader(directory),report.ledger.contentDigest);
  assert.deepEqual(store.ledger,report.ledger);
  if (sha(encodeEntityLedger(store.ledger)) !== report.ledgerSha256) throw Error('Published ledger binding changed');
  return {store,report,reportSha256:sha(bytes)};
}
export async function verifyExport(receiptName, side, expectedDigest) {
  const directory = await ownedDirectory(resolve(receiptName,'..'),'actor-arrival-fixture-entity-export-');
  if (resolve(receiptName) !== join(directory,'Selected_Entity_Pair.json') || ![0,1].includes(side) || !/^[a-f0-9]{64}$/.test(expectedDigest)) throw Error('Invalid selected export request');
  const {bytes,value:r} = await boundedJson(receiptName,4096);
  if (!keys(r,['version','manifest','owner','worlds','pairReport','pairReportSha256','pairDirectory','ledgerSha256']) || r.version !== 1 || !Array.isArray(r.worlds) || r.worlds.length !== 2)
    throw Error('Invalid selected export receipt');
  const {store,report,reportSha256} = await pair(r.pairReport,r.pairDirectory);
  if (r.pairReportSha256 !== reportSha256 || r.ledgerSha256 !== report.ledgerSha256) throw Error('Changed selected export provenance');
  await store.withSelected(async selected => {
    if (!selected || !selected.record.moved || r.manifest !== selected.record.manifest) throw Error('Selected pair changed or transfer not published');
    assert.deepEqual(r.owner,selected.owner);
    for (let i=0;i<2;++i) {
      if (!keys(r.worlds[i],['filename','size','sha256']) || r.worlds[i].filename !== join(directory,i?'Destination.GMP':'Source.GMP')) throw Error('Invalid exported world path');
      const {size,sha256} = r.worlds[i];
      assert.deepEqual({size,sha256},selected.record.worlds[i]);
      const source = await stoppedFileSource(r.worlds[i].filename);
      if (source.size !== size || await hashCheckpointSource(source) !== sha256) throw Error('Exported selected world changed');
    }
  });
  if (r.worlds[side].sha256 !== expectedDigest) throw Error('Selected world differs from native proof');
  return {filename:r.worlds[side].filename,sha256:r.worlds[side].sha256,bytes:r.worlds[side].size,
    receipt:resolve(receiptName),receiptSha256:sha(bytes),side,manifest:r.manifest,owner:r.owner,pairReportSha256:r.pairReportSha256};
}
async function main() {
  if (process.argv[2] === '--verify') {
    if (process.argv.length !== 6 || !/^[01]$/.test(process.argv[4])) throw Error('Usage: --verify <receipt> <side 0|1> <expected digest>');
    console.log(JSON.stringify(await verifyExport(process.argv[3],Number(process.argv[4]),process.argv[5])));return;
  }
  const [name,basename] = process.argv.slice(2);
  if (!name || !basename || process.argv.length !== 4 || !/^[a-z][a-z0-9-]*$/.test(basename)) throw Error('Usage: <qualified pair report> <fresh output basename>');
  const output = join(workspace,'output',basename+'.json');
  try {await lstat(output);throw Error('Preserve prior export evidence');} catch(e) {if(e.code !== 'ENOENT')throw e;}
  const reportName = resolve(name), report = JSON.parse(await readFile(reportName,'utf8'));
  const pairDirectory = join(report.fixture,'after-publish'), p = await pair(reportName,pairDirectory);
  const directory = await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-entity-export-'));
  const receiptName = join(directory,'Selected_Entity_Pair.json');let largestWrite=0;
  const exported = await exportSelectedEntityPair(p.store,async(side,descriptor,produce)=>{
    const f=await open(join(directory,side?'Destination.GMP':'Source.GMP'),'wx');let at=0;
    try {
      await produce({async write(bytes) {
        if (!(bytes instanceof Uint8Array) || bytes.length > 4096) throw Error('Unbounded selected export write');
        largestWrite=Math.max(largestWrite,bytes.length);
        for(let n=0;n<bytes.length;) {
          const {bytesWritten}=await f.write(bytes,n,bytes.length-n,at);
          if(!bytesWritten)throw Error('Short selected export write');n+=bytesWritten;at+=bytesWritten;
        }
      }});
      if(at!==descriptor.size)throw Error('Exported world size differs');await f.sync();
    } finally {await f.close();}
  },async receipt=>{
    const value={...receipt,worlds:receipt.worlds.map((w,i)=>({...w,filename:join(directory,i?'Destination.GMP':'Source.GMP')})),
      pairReport:reportName,pairReportSha256:p.reportSha256,pairDirectory,ledgerSha256:p.report.ledgerSha256};
    const bytes=Buffer.from(JSON.stringify(value)+'\n');if(bytes.length>4096)throw Error('Export receipt exceeds bound');
    await writeFile(receiptName,bytes,{flag:'wx'});
  });
  const verified=[];
  for(let i=0;i<2;++i)verified.push(await verifyExport(receiptName,i,exported.worlds[i].sha256));
  const result={qualified:true,scope:'Stopped published pair copied under selected read leases and independently hash-verified; engine reload, browser use and repeated crossings unqualified.',
    receipt:receiptName,receiptSha256:verified[0].receiptSha256,pairReport:reportName,pairReportSha256:p.reportSha256,
    worlds:verified,largestWrite,nativeProcessesStarted:0,browserUsed:false,selectedPairNativeReloadQualified:false};
  await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({qualified:true,receipt:receiptName,largestWrite,browserUsed:false}));
}
if (resolve(process.argv[1] || '') === resolve(new URL(import.meta.url).pathname)) await main();

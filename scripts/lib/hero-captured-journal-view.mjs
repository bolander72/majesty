// Earlier boundaries use an authenticated revision3 copy when this same
// journey has subsequently selected its returned owner. This never authorizes
// a native receipt or substitutes the copy for the live revision4 journal.
import assert from 'node:assert/strict';
import {readFile,lstat,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {hashNativeFile} from './native-generation.mjs';
import {ownedDirectory} from './stopped-entity-io.mjs';
export async function heroCapturedJournalView(m,second){
 let directory=second.journal;
 if(m.publishHome){
  const row=m.homePublication;assert.ok(row);assert.equal((await lstat(row.filename)).size,row.bytes);
  assert.equal((await hashNativeFile(row.filename)).sha256,row.sha256);assert.ok(row.bytes<256*1024);
  const home=JSON.parse(await readFile(row.filename,'utf8'));
  assert.equal(home.nativeHeldHeroHomePairPublished,true);assert.equal(home.nativePid,m.nativePid);assert.equal(home.fixture,m.fixture);
  assert.equal(home.secondPublication.filename,m.secondPublication.filename);assert.equal(home.secondPublication.sha256,m.secondPublication.sha256);
  assert.equal(home.journal,second.journal);assert.equal(home.expectedManifest,second.ownerManifest);
  assert.deepEqual(home.beforeJournalSha256,second.journalSha256);
  directory=await ownedDirectory(home.beforeJournal,'actor-arrival-fixture-hero-route-before-home-');
 }
 assert.deepEqual((await readdir(directory)).sort(),Object.keys(second.journalSha256).sort());
 for(const[n,h]of Object.entries(second.journalSha256))assert.equal((await hashNativeFile(join(directory,n))).sha256,h);
 assert.equal(await readFile(join(directory,'Frontier_Hero_Route.checkpoint'),'utf8'),second.ownerManifest);
 return directory;
}

export async function heroHomePublishedJournalView(m,home){
 let directory=home.journal;
 if(m.saveHome){
  const row=m.homeSavePublication;assert.ok(row);assert.equal((await lstat(row.filename)).size,row.bytes);
  assert.equal((await hashNativeFile(row.filename)).sha256,row.sha256);assert.ok(row.bytes<256*1024);
  const saved=JSON.parse(await readFile(row.filename,'utf8'));
  assert.equal(saved.nativeContinuedHeroHomeSavePublished,true);assert.equal(saved.nativePid,m.nativePid);assert.equal(saved.fixture,m.fixture);
  assert.equal(saved.homePublication.filename,m.homePublication.filename);assert.equal(saved.homePublication.sha256,m.homePublication.sha256);
  assert.equal(saved.journal,home.journal);assert.equal(saved.expectedManifest,home.publicationReceipt.ownerManifest);
  assert.deepEqual(saved.beforeJournalSha256,home.journalSha256);
  directory=await ownedDirectory(saved.beforeJournal,'actor-arrival-fixture-hero-route-before-home-save-');
 }
 assert.deepEqual((await readdir(directory)).sort(),Object.keys(home.journalSha256).sort());
 for(const[n,h]of Object.entries(home.journalSha256))assert.equal((await hashNativeFile(join(directory,n))).sha256,h);
 assert.equal(await readFile(join(directory,'Frontier_Hero_Route.checkpoint'),'utf8'),home.publicationReceipt.ownerManifest);
 return directory;
}

export async function heroContinuedHomeJournalView(m,saved){
 let directory=saved.journal;
 if(m.repeatDeparture){
  const row=m.repeatDeparturePublication;assert.ok(row);assert.equal((await lstat(row.filename)).size,row.bytes);
  assert.equal((await hashNativeFile(row.filename)).sha256,row.sha256);assert.ok(row.bytes<256*1024);
  const next=JSON.parse(await readFile(row.filename,'utf8'));
  assert.equal(next.nativeRepeatedHeroDepartureCapturePublished,true);assert.equal(next.nativePid,m.nativePid);assert.equal(next.fixture,m.fixture);
  assert.equal(next.homeSavePublication.filename,m.homeSavePublication.filename);assert.equal(next.homeSavePublication.sha256,m.homeSavePublication.sha256);
  assert.equal(next.journal,saved.journal);assert.equal(next.expectedManifest,saved.publicationReceipt.ownerManifest);
  assert.deepEqual(next.beforeJournalSha256,saved.journalSha256);
  directory=await ownedDirectory(next.beforeJournal,'actor-arrival-fixture-hero-route-before-repeat-');
 }
 assert.deepEqual((await readdir(directory)).sort(),Object.keys(saved.journalSha256).sort());
 for(const[n,h]of Object.entries(saved.journalSha256))assert.equal((await hashNativeFile(join(directory,n))).sha256,h);
 assert.equal(await readFile(join(directory,'Frontier_Hero_Route.checkpoint'),'utf8'),saved.publicationReceipt.ownerManifest);
 return directory;
}

// Authenticate the sixth revision for earlier second-departure/load checks
// after this same journey selects its second neighboring arrival. This copy
// never authorizes the live engine's publication receipt.
export async function heroRepeatedCaptureJournalView(m,capture){
 let directory=capture.journal;
 if(m.publishRepeatNeighbor){
  const row=m.repeatNeighborPublication;assert.ok(row);assert.equal((await lstat(row.filename)).size,row.bytes);
  assert.equal((await hashNativeFile(row.filename)).sha256,row.sha256);assert.ok(row.bytes<256*1024);
  const next=JSON.parse(await readFile(row.filename,'utf8'));
  assert.equal(next.nativeHeldHeroRepeatNeighborPairPublished,true);assert.equal(next.nativePid,m.nativePid);assert.equal(next.fixture,m.fixture);
  assert.equal(next.departurePublication.filename,m.repeatDeparturePublication.filename);assert.equal(next.departurePublication.sha256,m.repeatDeparturePublication.sha256);
  assert.equal(next.journal,capture.journal);assert.equal(next.expectedManifest,capture.publicationReceipt.ownerManifest);
  assert.deepEqual(next.beforeJournalSha256,capture.journalSha256);
  directory=await ownedDirectory(next.beforeJournal,'actor-arrival-fixture-hero-route-before-repeat-arrival-');
 }
 assert.deepEqual((await readdir(directory)).sort(),Object.keys(capture.journalSha256).sort());
 for(const[n,h]of Object.entries(capture.journalSha256))assert.equal((await hashNativeFile(join(directory,n))).sha256,h);
 assert.equal(await readFile(join(directory,'Frontier_Hero_Route.checkpoint'),'utf8'),capture.publicationReceipt.ownerManifest);
 return directory;
}

export async function heroRepeatNeighborPublishedJournalView(m,arrival){
 let directory=arrival.journal;
 if(m.saveRepeatNeighbor){
  const row=m.repeatNeighborSavePublication;assert.ok(row);assert.equal((await lstat(row.filename)).size,row.bytes);
  assert.equal((await hashNativeFile(row.filename)).sha256,row.sha256);assert.ok(row.bytes<256*1024);
  const saved=JSON.parse(await readFile(row.filename,'utf8'));
  assert.equal(saved.nativeContinuedHeroNeighborSavePublished,true);assert.equal(saved.nativePid,m.nativePid);assert.equal(saved.fixture,m.fixture);
  assert.equal(saved.neighborPublication.filename,m.repeatNeighborPublication.filename);assert.equal(saved.neighborPublication.sha256,m.repeatNeighborPublication.sha256);
  assert.equal(saved.journal,arrival.journal);assert.equal(saved.expectedManifest,arrival.publicationReceipt.ownerManifest);
  assert.deepEqual(saved.beforeJournalSha256,arrival.journalSha256);
  directory=await ownedDirectory(saved.beforeJournal,'actor-arrival-fixture-hero-route-before-repeat-save-');
 }
 assert.deepEqual((await readdir(directory)).sort(),Object.keys(arrival.journalSha256).sort());
 for(const[n,h]of Object.entries(arrival.journalSha256))assert.equal((await hashNativeFile(join(directory,n))).sha256,h);
 assert.equal(await readFile(join(directory,'Frontier_Hero_Route.checkpoint'),'utf8'),arrival.publicationReceipt.ownerManifest);
 return directory;
}

export async function heroContinuedNeighborJournalView(m,saved){
 let directory=saved.journal;
 if(m.repeatReturn){
  const row=m.repeatReturnPublication;assert.ok(row);assert.equal((await lstat(row.filename)).size,row.bytes);
  assert.equal((await hashNativeFile(row.filename)).sha256,row.sha256);assert.ok(row.bytes<256*1024);
  const capture=JSON.parse(await readFile(row.filename,'utf8'));
  assert.equal(capture.nativeRepeatedHeroReturnCapturePublished,true);assert.equal(capture.nativePid,m.nativePid);assert.equal(capture.fixture,m.fixture);
  assert.equal(capture.neighborSavePublication.filename,m.repeatNeighborSavePublication.filename);assert.equal(capture.neighborSavePublication.sha256,m.repeatNeighborSavePublication.sha256);
  assert.equal(capture.journal,saved.journal);assert.equal(capture.expectedManifest,saved.publicationReceipt.ownerManifest);assert.deepEqual(capture.beforeJournalSha256,saved.journalSha256);
  directory=await ownedDirectory(capture.beforeJournal,'actor-arrival-fixture-hero-route-before-repeat-return-');
 }
 assert.deepEqual((await readdir(directory)).sort(),Object.keys(saved.journalSha256).sort());
 for(const[n,h]of Object.entries(saved.journalSha256))assert.equal((await hashNativeFile(join(directory,n))).sha256,h);
 assert.equal(await readFile(join(directory,'Frontier_Hero_Route.checkpoint'),'utf8'),saved.publicationReceipt.ownerManifest);
 return directory;
}

// Paging the second return cannot change selected recovery9. Authenticate the
// actual current directory for the stopped source and dormant home inspectors.
export async function heroRepeatedReturnJournalView(m,capture){
 assert.equal(capture.nativeRepeatedHeroReturnCapturePublished,true);
 assert.equal(capture.nativePid,m.nativePid);assert.equal(capture.fixture,m.fixture);
 assert.equal(capture.publicationReceipt.ownerRevision,9);
 let directory=await ownedDirectory(capture.journal,'actor-arrival-fixture-hero-route-');
 if(m.publishRepeatHome){
  const row=m.repeatHomePublication;assert.ok(row);assert.equal((await lstat(row.filename)).size,row.bytes);
  assert.equal((await hashNativeFile(row.filename)).sha256,row.sha256);assert.ok(row.bytes<256*1024);
  const home=JSON.parse(await readFile(row.filename,'utf8'));
  assert.equal(home.nativeHeldHeroRepeatHomePairPublished,true);assert.equal(home.nativePid,m.nativePid);assert.equal(home.fixture,m.fixture);
  assert.equal(home.returnPublication.filename,m.repeatReturnPublication.filename);assert.equal(home.returnPublication.sha256,m.repeatReturnPublication.sha256);
  assert.equal(home.journal,capture.journal);assert.equal(home.expectedManifest,capture.publicationReceipt.ownerManifest);
  assert.deepEqual(home.beforeJournalSha256,capture.journalSha256);
  directory=await ownedDirectory(home.beforeJournal,'actor-arrival-fixture-hero-route-before-repeat-home-');
 }
 assert.deepEqual((await readdir(directory)).sort(),Object.keys(capture.journalSha256).sort());
 for(const[n,h]of Object.entries(capture.journalSha256))assert.equal((await hashNativeFile(join(directory,n))).sha256,h);
 assert.equal(await readFile(join(directory,'Frontier_Hero_Route.checkpoint'),'utf8'),capture.publicationReceipt.ownerManifest);
 return directory;
}

// Pair10 remains independently verifiable after the continued home save11.
// Its authenticated copy is never used to authorize the live native receipt.
export async function heroRepeatHomePublishedJournalView(m,home){
 let directory=home.journal;
 if(m.saveRepeatHome){
  const row=m.repeatHomeSavePublication;assert.ok(row);assert.equal((await lstat(row.filename)).size,row.bytes);
  assert.equal((await hashNativeFile(row.filename)).sha256,row.sha256);assert.ok(row.bytes<256*1024);
  const saved=JSON.parse(await readFile(row.filename,'utf8'));
  assert.equal(saved.nativeContinuedHeroRepeatHomeSavePublished,true);assert.equal(saved.nativePid,m.nativePid);assert.equal(saved.fixture,m.fixture);
  assert.equal(saved.homePublication.filename,m.repeatHomePublication.filename);assert.equal(saved.homePublication.sha256,m.repeatHomePublication.sha256);
  assert.equal(saved.journal,home.journal);assert.equal(saved.expectedManifest,home.publicationReceipt.ownerManifest);
  assert.deepEqual(saved.beforeJournalSha256,home.journalSha256);
  directory=await ownedDirectory(saved.beforeJournal,'actor-arrival-fixture-hero-route-before-repeat-home-save-');
 }
 assert.deepEqual((await readdir(directory)).sort(),Object.keys(home.journalSha256).sort());
 for(const[n,h]of Object.entries(home.journalSha256))assert.equal((await hashNativeFile(join(directory,n))).sha256,h);
 assert.equal(await readFile(join(directory,'Frontier_Hero_Route.checkpoint'),'utf8'),home.publicationReceipt.ownerManifest);
 return directory;
}

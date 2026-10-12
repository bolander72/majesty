#!/usr/bin/env node
// Initial original full Brashnard load, backlinks and exact UNIT/GPL/order writers.
import {readFile, writeFile, open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run = promisify(execFile), root = resolve(new URL('../', import.meta.url).pathname);
const [manifestName, output] = process.argv.slice(2);
if (!manifestName || !output || process.argv.length !== 4) throw Error('Usage: check-native-original-source-reload.mjs <terminal source manifest> <fresh output|--stdout>');
const bytes = await readFile(manifestName), m = JSON.parse(bytes), sha = b => createHash('sha256').update(b).digest('hex');
async function fileSha(name) {
  const h = await open(name, 'r'), stat = await h.stat(), hash = createHash('sha256');
  try {
    const buffer = Buffer.alloc(4096);
    for (let at = 0; at < stat.size; at += 4096) {
      const count = Math.min(4096, stat.size - at), {bytesRead} = await h.read(buffer, 0, count, at);
      if (bytesRead !== count) throw Error('Truncated source evidence'); hash.update(buffer.subarray(0, count));
    }
    return hash.digest('hex');
  } finally {await h.close();}
}
if (m.nativeOnly !== true || m.browserUsed !== false || m.nativeSessionTerminal !== true || m.nativeExitCode !== 0 ||
    m.originalSourceDeparture !== true || m.clockMode !== 'pinned' || m.observeMotion || !m.departNpc || m.scheduleNpc || m.reloadScheduledNpc ||
    [m.unitId,m.agentId,m.physicalGridExtent].join(',') !== '2101,37,512') throw Error('Require terminal isolated original-source removal run');
const profile = resolve(m.profile);
if (!profile.startsWith(join(root, 'upstream/majesty-recomp/build/actor-arrival-fixture-original-source-')) || !profile.endsWith('/frontier_0_0'))
  throw Error('Require owned original-source profile');
const preBytes = await readFile(m.preflight), pre = JSON.parse(preBytes);
if (sha(preBytes) !== m.preflightSha256 || !pre.qualified || !pre.originalSource || pre.incoming.length || pre.unsupportedOrders.length ||
    pre.unitId !== m.unitId || pre.agentId !== m.agentId || pre.queuedActor !== 1 || pre.largestRead > 4096)
  throw Error('Changed or invalid original-source preflight');
const {stdout} = await run(process.execPath, [join(root, 'scripts/inspect-native-npc-departure.mjs'), m.sourceProof, '--stdout', '--original-source']);
if (JSON.stringify(JSON.parse(stdout)) !== JSON.stringify(pre) || sha(await readFile(m.sourceProof)) !== m.sourceProofSha256)
  throw Error('Independent original-source preflight differs');
const old = JSON.parse(await readFile(m.sourceProof, 'utf8')).fixture;
if (old.nativePid === m.nativePid || resolve(old.profile) === profile) throw Error('Original-source process/profile reused');
for (const [name,digest] of Object.entries(m.inputHashes))
  if (await fileSha(join(profile,name)) !== digest) throw Error('Original-source input changed');
const saved = join(profile,'Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP');
if (await fileSha(saved) !== pre.checkpointSha256) throw Error('Loaded another original source world');
const log = await readFile(m.log,'utf8');
if (!log.includes('all expectations met') || /result=fail|SIGSEGV|exception e06d7363|undeliverable call(?!s: none)/i.test(log)) throw Error('Original source load/removal or continuing game failed');
const loads = [...log.matchAll(/^\[streaming\] Original load end result=00000000 visits=(\d+) retained=\d+ sample-bytes=\d+$/gm)];
if (loads.length !== 1 || Number(loads[0][1]) !== 1960) throw Error('Missing complete original source load');
const expected = '[streaming] Joint reload unit=2101 agent=37 links=1 unit-written=1 script-written=1 commands-equal=1 scratch-released=1 result=pass';
if (log.split('\n').filter(line => line === expected).length !== 1) throw Error('Missing original source backlinks and exact writers');
for (const kind of ['Unit','GPL','Orders']) {
  const before = await readFile(join(profile,`Script_Composed_${kind}_2101_0.bin`));
  const after = await readFile(join(profile,`Joint_Reload_${kind}.bin`));
  if (before.length > 2048 || !before.equals(after) || before.length !== m.expectedWriters[kind].bytes || sha(before) !== m.expectedWriters[kind].sha256)
    throw Error('Original source '+kind+' writer differs');
}
const result = {qualified:true,scope:'One initial original 1960-unit Brashnard reload and three exact source actor writer records; removal/save and subsequent source reload require independent qualification',
  fixture:m,sourceManifest:resolve(manifestName),sourceManifestSha256:sha(bytes),actualOriginalFullReloadQualified:true,
  exactJointWriterRecords:3,originalLoadedUnits:1960,unitId:2101,agentId:37,browserUsed:false,nativeProcessesStarted:0};
if (output === '--stdout') console.log(JSON.stringify(result));
else {
  await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({qualified:true,originalLoadedUnits:1960,exactJointWriterRecords:3}));
}

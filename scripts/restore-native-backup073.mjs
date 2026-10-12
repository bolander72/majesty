// Materialize only the isolated, browser-exported test collection for a later
// native gameplay trial. Never imports game assets or writes player profiles.
import {readFile,writeFile,mkdir,mkdtemp,open} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectBundle,hashBlob,safePath,PAGE} from '../upstream/majesty-recomp/build/frontend-resume-candidate073/site/backups/bundle.mjs';
import {parseCheckpoint} from '../web/multiplayer/resume-checkpoint.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'output/player-backup-native073-restored.zip');
const receipt=path.join(root,'output/player-backup-native073-restored-native-collection.json');
const profiles=['resume073-host','resume073-guest'];
function check(condition,message){if(!condition)throw Error(message);}
const upload=JSON.parse(await readFile(path.join(root,'output/player-backup-native073-restored-upload.json'),'utf8'));
const archive=new Blob([await readFile(source)]);
check(archive.size===upload.bytes&&archive.size<8*1024*1024&&await hashBlob(archive)===upload.sha256,'Isolated backup upload changed.');
const inspected=await inspectBundle(archive,{retainDatabases:false});
check(inspected.nativeCount===19&&inspected.databaseCount===3,'Unexpected test collection.');
for(const record of inspected.manifest.native){
  safePath(record.path);
  check(profiles.includes(record.path.split('/')[0]),'Unexpected profile in test backup.');
  check(record.bytes<=64*1024*1024,'Native file exceeds fixture budget.');
}
// Reserve the immutable receipt before making a new collection. Existing
// receipts are preserved and a failed attempt never authorizes launching.
const recordFile=await open(receipt,'wx');
let fixture;
try{
  fixture=await mkdtemp(path.join(root,'upstream/majesty-recomp/build/actor-arrival-fixture-backup073-'));
  const collection=path.join(fixture,'native-collection'),native=path.join(collection,'profile');
  const entries=[];
  for(const record of inspected.manifest.native){
    const destination=path.join(native,record.path);
    await mkdir(path.dirname(destination),{recursive:true});
    const output=await open(destination,'wx');
    try{
      await inspected.copyNative(record,{async write(bytes){
        for(let at=0;at<bytes.byteLength;at+=PAGE){
          const chunk=bytes.subarray(at,Math.min(bytes.byteLength,at+PAGE));
          let offset=0;
          while(offset<chunk.byteLength){
            const result=await output.write(chunk,offset,chunk.byteLength-offset);
            check(result.bytesWritten>0,'Truncated native restore write.');offset+=result.bytesWritten;
          }
        }
      }});
    }finally{await output.close();}
    const file=new Blob([await readFile(destination)]);
    check(file.size===record.bytes&&await hashBlob(file)===record.sha256,'Native restore hash differs.');
    entries.push({...record,filename:destination});
  }
  const metadata=[];
  for(const record of inspected.manifest.databases){
    const database=await inspected.readDatabase(record);
    const destination=path.join(collection,record.path);
    await mkdir(path.dirname(destination),{recursive:true});
    await writeFile(destination,JSON.stringify(database)+'\n',{flag:'wx'});
    metadata.push({name:database.name,store:database.store,rows:database.rows.length,filename:destination});
  }
  const checkpoints=[];
  for(const entry of entries.filter(r=>r.path.endsWith('.checkpoint'))){
    const marker=parseCheckpoint(await readFile(entry.filename,'utf8'));
    const selected=path.join(path.dirname(entry.filename),`CoopTransitions_${marker.world}_${marker.x}_${marker.y}_${marker.slot}.GMP`);
    const sourceEntry=entries.find(r=>r.filename===selected);
    check(sourceEntry?.bytes===marker.bytes&&sourceEntry.sha256===marker.sha256,'Restored native checkpoint is not committed to its selected file.');
    checkpoints.push({profile:entry.path.split('/')[0],world:marker.world,region:`${marker.x}_${marker.y}`,clock:marker.clock,frame:marker.frame,revision:marker.revision,snapshot:selected,sha256:marker.sha256});
  }
  check(checkpoints.some(r=>r.profile==='resume073-host'&&r.region==='3_-1'),'Traveled checkpoint absent.');
  const result={format:'majesty-native-backup073-materialized',archive:source,archiveSha256:upload.sha256,archiveBytes:archive.size,fixture,collection,
    nativeFiles:entries,metadata,checkpoints,nativeFileHashesEqual:true,AtlasMetadataSynthetic:true,
    nativeGameplayQualified:false,gameProcessesStarted:0,sourceProfilesTouched:false};
  await recordFile.writeFile(JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({files:entries.length,metadataDatabases:metadata.length,checkpoints:checkpoints.length,hashesEqual:true,nativeGameplayQualified:false,receipt}));
}catch(error){
  await recordFile.writeFile(JSON.stringify({fixture,error:error.message,nativeGameplayQualified:false})+'\n');
  throw error;
}finally{await recordFile.close();}

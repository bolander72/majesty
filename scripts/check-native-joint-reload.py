#!/usr/bin/env python3
"""Require fresh original full-world load and complete joint UNIT/GPL/order writer equality."""
import argparse, hashlib, json, re, subprocess, importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
_export_spec=importlib.util.spec_from_file_location('selected_native_export',ROOT/'scripts/native_entity_pair.py')
_export=importlib.util.module_from_spec(_export_spec)
_export_spec.loader.exec_module(_export)
selected_revision_input=_export.selected_revision_input
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def verify(manifest):
    m=json.loads(manifest.read_text())
    if m.get('nativeOnly') is not True or m.get('browserUsed') is not False or m.get('nativeSessionTerminal') is not True or m.get('nativeExitCode')!=0:raise ValueError('Fresh native reload must terminate successfully')
    profile=Path(m['profile']).resolve()
    if not profile.is_relative_to((ROOT/'upstream/majesty-recomp/build').resolve()) or profile.name!='frontier_0_0' or not profile.parent.name.startswith('actor-arrival-fixture-joint-reload-'):raise ValueError('Fresh reload requires owned copied profile')
    producer=json.loads(Path(m['sourceManifest']).read_text())
    if Path(producer['profile']).resolve()==profile or producer.get('nativePid')==m.get('nativePid'):raise ValueError('Producer and reload must be separate profiles/processes')
    for key in ['sourceManifest','sourceCheckpointReport','sourceIdentityReport']:
        if sha(Path(m[key]))!=m[key+'Sha256']:raise ValueError('Original producer evidence changed')
    checkpoint=json.loads(Path(m['sourceCheckpointReport']).read_text());identity=json.loads(Path(m['sourceIdentityReport']).read_text())
    if checkpoint.get('qualified') is not True or identity.get('qualified') is not True or identity.get('naturalNativeRegistryResolutionQualified') is not True:raise ValueError('Missing qualified producer world and identity')
    if [m['unitId'],m['agentId']]!=[checkpoint['unitId'],checkpoint['agentId']]:raise ValueError('Reload identities differ from full-world checkpoint')
    if producer.get('nativeSessionTerminal') is not True or producer.get('nativeExitCode')!=0:raise ValueError('Producer did not terminate successfully')
    log=Path(m['log']).read_text()
    if ('all expectations met' not in log or re.search(r'SIGSEGV|exception e06d7363|undeliverable call(?!s: none)|result=fail',log,re.I)):raise ValueError('Fresh original loader or continuing native game failed')
    evolved=None
    evolved_departure=m.get('departEvolvedNpc') is True
    if evolved_departure and (m.get('reloadEvolvedNpc') is not True or m.get('departNpc') is not True or m.get('observeMotion') is not False or
            m.get('clockMode')!='pinned' or not m.get('selectedRevisionExport')):
        raise ValueError('Evolved departure requires the selected current world and separate pinned removal mode')
    if m.get('reloadEvolvedNpc') is True:
        report=Path(m['evolvedCheckpointReport'])
        if sha(report)!=m['evolvedCheckpointReportSha256']:raise ValueError('Evolved checkpoint proof changed')
        evolved=json.loads(report.read_text())
        checked=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/check-native-npc-evolved.mjs'),evolved['sourceManifest'],'--stdout']))
        if (checked!=evolved or evolved.get('originalEvolvedFullSaveQualified') is not True or
            m.get('scheduleNpc') or m.get('reloadScheduledNpc') or m.get('reloadDepartedNpc') or m.get('selectedPairExport') or
            (m.get('departNpc') if not evolved_departure else m.get('observeMotion')) or (not m.get('observeMotion') and not evolved_departure) or
            [evolved['unitId'],evolved['agentId']]!=[m['unitId'],m['agentId']] or
            evolved['fixture']['sourceCheckpointReportSha256']!=m['sourceCheckpointReportSha256'] or
            evolved['fixture']['sourceIdentityReportSha256']!=m['sourceIdentityReportSha256'] or
            evolved['fixture']['nativePid']==m['nativePid'] or Path(evolved['fixture']['profile']).resolve()==profile):
            raise ValueError('Evolved reload must use original current state in a separate process/profile')
        if evolved_departure:
            preflight=Path(m['departurePreflight'])
            checked_preflight=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/inspect-native-npc-departure.mjs'),str(report),'--stdout','--evolved']))
            if sha(preflight)!=m['departurePreflightSha256'] or json.loads(preflight.read_text())!=checked_preflight or checked_preflight.get('qualified') is not True or checked_preflight.get('queuedActor')!=1:
                raise ValueError('Evolved departure typed reference admission differs')
    original=re.findall(r'^\[streaming\] Original load end result=00000000 visits=(\d+) retained=\d+ sample-bytes=\d+$',log,re.M)
    loaded_count=evolved['after']['counts']['units'] if evolved else checkpoint['differences']['units']['after']
    if len(original)!=1 or int(original[0])!=loaded_count:raise ValueError('Missing complete original full-world load')
    expected=f"[streaming] Joint reload unit={m['unitId']} agent={m['agentId']} links=1 unit-written=1 script-written=1 commands-equal=1 scratch-released=1 result=pass"
    if log.splitlines().count(expected)!=1:raise ValueError('Missing exact fresh native/script backlinks and joint writers')
    evidence={}
    for name,digest in m['inputHashes'].items():
        file=profile/name
        if sha(file)!=digest:raise ValueError('Reload input changed')
        evidence[str(file.relative_to(ROOT))]=digest
    saved=profile/'Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP'
    expected_saved=checkpoint['after']['sha256']
    if m.get('reloadScheduledNpc') is True:
        schedule_report=Path(m['scheduledCheckpointReport'])
        if sha(schedule_report)!=m['scheduledCheckpointReportSha256']:raise ValueError('Scheduled checkpoint proof changed')
        schedule=json.loads(schedule_report.read_text())
        checked=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/check-native-npc-schedule.mjs'),schedule['sourceReloadReport'],'--stdout']))
        if (checked!=schedule or m.get('scheduleNpc') is True or (m.get('observeMotion') is not True and m.get('departNpc') is not True) or
            [schedule['unitId'],schedule['agentId']]!=[m['unitId'],m['agentId']] or
            schedule['fixture']['sourceCheckpointReportSha256']!=m['sourceCheckpointReportSha256'] or
            schedule['fixture']['sourceIdentityReportSha256']!=m['sourceIdentityReportSha256'] or
            schedule['fixture']['nativePid']==m.get('nativePid') or Path(schedule['fixture']['profile']).resolve()==profile):
            raise ValueError('Scheduled reload must use the qualified queue in a separate process/profile')
        expected_saved=schedule['after']['sha256']
        expected=f"[streaming] Joint scheduled reload unit={m['unitId']} agent={m['agentId']} queued=1 queue-mutated=0 result=pass"
        if log.splitlines().count(expected)!=1 or re.search(r'^\[streaming\] Joint schedule unit=',log,re.M):
            raise ValueError('Scheduled reload is absent or queue was reinserted')
    if evolved:
        expected_saved=evolved['after']['sha256']
        expected=f"[streaming] Joint scheduled reload unit={m['unitId']} agent={m['agentId']} queued=1 queue-mutated=0 result=pass"
        if log.splitlines().count(expected)!=1 or re.search(r'^\[streaming\] Joint schedule unit=',log,re.M):raise ValueError('Evolved saved scheduling missing or reinserted')
    if sha(saved)!=expected_saved:raise ValueError('Reload did not use the exact original full checkpoint')
    if m.get('selectedRevisionExport') is not None:
        selected=m['selectedRevisionExport']
        if not evolved or m.get('selectedPairExport'):raise ValueError('Selected revision requires separate evolved reload')
        checked=selected_revision_input(Path(selected['receipt']),1,expected_saved,require_current=False)
        if checked!=selected or [selected['owner']['unitId'],selected['owner']['agentId']]!=[m['unitId'],m['agentId']]:raise ValueError('Selected revision reload provenance differs')
    for kind in ['Unit','GPL','Orders']:
        before=profile/f'Script_Composed_{kind}_2101_0.bin';after=profile/f'Joint_Reload_{kind}.bin'
        if before.stat().st_size>4096 or after.stat().st_size>4096 or before.read_bytes()!=after.read_bytes():raise ValueError('Fresh original '+kind+' writer differs from durable joint state')
        expected_digest=evolved['after']['records'][kind]['sha256'] if evolved else identity['evidenceSha256'][str((Path(producer['profile'])/before.name).relative_to(ROOT))]
        if sha(before)!=expected_digest:raise ValueError('Joint writer differs from qualified producer bytes')
        if evolved and m.get('expectedEvolvedWriters',{}).get(kind)!={'bytes':evolved['after']['records'][kind]['size'],'sha256':expected_digest}:raise ValueError('Evolved expected-writer provenance differs')
        evidence[str(after.relative_to(ROOT))]=sha(after)
    return dict(qualified=True,scope='One fresh original full-world reload of jointly linked grounded NPC/populated command data; exact original UNIT/GPL/order writers; live movement and browser bounds unqualified',fixture=m,unitId=m['unitId'],agentId=m['agentId'],actualOriginalFullReloadQualified=True,durableJointNativeScriptCommandReloadQualified=True,naturalNativeRegistryBacklinkAfterFullReloadQualified=True,exactJointWriterRecords=3,originalLoadedUnits=int(original[0]),sourceCheckpointReportSha256=m['sourceCheckpointReportSha256'],producerNativePid=producer['nativePid'],reloadNativePid=m['nativePid'],actorMovementQualified=False,continuousPagingQualified=False,wholeBrowserMemoryBoundQualified=False,browserUsed=False,sourceSha256=m['nativeSourceSha256']|{'scripts/check-native-joint-reload.py':sha(Path(__file__)),'scripts/run-native-joint-reload.py':sha(ROOT/'scripts/run-native-joint-reload.py')},evidenceSha256=evidence|{str(manifest.relative_to(ROOT)):sha(manifest),str(Path(m['log']).relative_to(ROOT)):sha(Path(m['log']))})
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('manifest',type=Path);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
    result=verify(a.manifest.resolve())
    with a.output.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps({k:result[k] for k in ['qualified','unitId','agentId','exactJointWriterRecords','actualOriginalFullReloadQualified','actorMovementQualified']}))
if __name__=='__main__':main()

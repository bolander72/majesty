#!/usr/bin/env python3
"""Publish a qualified frontend package while preserving engine URLs and profiles."""
import argparse
import hashlib
import json
import os
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
LIVE=ROOT/'upstream/majesty-recomp/build/web-site'


def sha(path):
    assert not path.stat().st_flags & 0x40000000, f'Cloud-evicted input: {path.name}'
    with path.open('rb') as stream:
        return hashlib.file_digest(stream,'sha256').hexdigest()


def stamp(path):
    s=path.stat()
    return {'bytes':s.st_size,'inode':s.st_ino,'mtimeNs':s.st_mtime_ns}


def campaign_progress_qualification(proof, site_report):
    """Qualify the tested frontend fixes without asserting final campaign victory."""
    required = [
        'publicChapterTwoVictoryBothRoles', 'persistedChapterTwoCompletionBothProfiles',
        'personalProgressLinkBothProfiles', 'nativeTreasuryObservationsBothRoles',
        'ninthResumeCopyPrepared', 'originalChapterThreeResumeReadersBothRoles',
        'invitationExcludesProfileAndStaleResume', 'focusedChecksPassed',
        'testEnginesReleased', 'ownedServicesReleased',
    ]
    assert all(proof.get(key) is True for key in required), 'Incomplete campaign progress evidence'
    assert proof.get('siteReportSha256') == sha(site_report), 'Qualification belongs to another package'


def content_qualification(proof, site_report, package):
    """Release the observed fourth mission and its narrowly scoped resume fix."""
    required = [
        'sharedVictoryBothRoles', 'persistedChapterFourBothProfiles',
        'nativeChapterFourResumeBothRoles', 'backupIntegrityAndSchemasPassed',
        'earlierSavesAndOtherDatabasesPreserved', 'focusedChecksPassed',
        'testEnginesReleased', 'ownedBrowserReleased',
    ]
    assert all(proof.get(key) is True for key in required), 'Incomplete content evidence'
    assert proof.get('siteReportSha256') == sha(site_report), 'Qualification belongs to another package'
    build_path = ROOT / package['buildEvidence']
    assert proof.get('buildReportSha256') == sha(build_path), 'Changed build evidence'
    build = json.loads(build_path.read_text())
    assert build.get('wasmBuildQualified') is True and build.get('exitCode') == 0
    assert build.get('officialToolsUnchanged') is True
    assert build.get('sourceInputsUnchanged') is True
    assert build.get('generatedTranslationsEdited') is False
    assert build.get('changedSource') == ['upstream/majesty-recomp/coop_lobby_resume.h']
    for name, expected in build['sourceInputs'].items():
        assert sha(ROOT / name) == expected, f'Changed compiled source: {name}'
    artifacts = {Path(name).name: item for name, item in build['artifacts'].items()}
    for name in ['MajestyRecomp.wasm', 'MajestyRecomp.js', 'MajestyRecomp.data']:
        assert package['files']['majesty/' + name] == artifacts[name], 'Engine differs from qualified build'
    assert package['engineSha256'] == artifacts['MajestyRecomp.wasm']['sha256']
    baseline = json.loads((ROOT / package['sourcePackage']).read_text())
    engine_files = {'games.json', *('majesty/' + name for name in artifacts)}
    assert package['files'].keys() == baseline['files'].keys(), 'Unexpected package files'
    for name, item in package['files'].items():
        if name not in engine_files:
            assert item == baseline['files'][name], f'Untested frontend change: {name}'


def coop_pause_qualification(proof, site_report, package):
    """Publish only the observed guest pause/release and its tested engine."""
    required = [
        'nativeRestoredMatchBothRoles', 'nativeGuestPauseObserved',
        'hostCheckpointCommitted', 'hostResumePrepared',
        'guestReleaseLinkClicked', 'guestReconnectGuidanceVerified',
        'backupIntegrityAndSchemasPassed', 'earlierSavesAndOtherDatabasesPreserved',
        'focusedChecksPassed', 'nativePauseChecksPassed', 'ownedTrialsMuted',
        'testEnginesReleased', 'ownedBrowserReleased', 'resourceBoundsPassed',
    ]
    assert all(proof.get(k) is True for k in required), 'Incomplete co-op pause evidence'
    assert proof.get('siteReportSha256') == sha(site_report), 'Qualification belongs to another package'
    assert proof.get('guardStopped') is False, 'Stopped trial cannot qualify publication'
    host, guest = proof.get('hostPause', {}), proof.get('guestPause', {})
    assert set(host) == set(guest) == {'epoch', 'frame', 'clock'}, 'Missing native pause boundary'
    assert all(type(v) is int and v >= 0 for p in [host, guest] for v in p.values())
    assert host['epoch'] > 0 and guest['epoch'] > 0
    # directplay.cpp assigns session epochs locally; peers can have different
    # incarnation counters. The original synchronized frame/clock must agree.
    assert (host['frame'], host['clock']) == (guest['frame'], guest['clock']), 'Players did not observe the same native pause'
    build_path = ROOT / package['buildEvidence']
    assert proof.get('buildReportSha256') == sha(build_path), 'Changed build evidence'
    build = json.loads(build_path.read_text())
    assert build.get('wasmBuildQualified') is True and build.get('exitCode') == 0
    assert build.get('officialToolsUsed', build.get('officialToolsUnchanged')) is True
    assert build.get('sourceInputsUnchanged') is True
    assert build.get('generatedTranslationsEdited') is False
    baseline = json.loads((ROOT / package['sourcePackage']).read_text())
    baseline_build = json.loads((ROOT / baseline['buildEvidence']).read_text())
    assert set(build['sourceInputs']) >= set(baseline_build['sourceInputs']), 'Missing compiled source evidence'
    extra = set(build['sourceInputs']) - set(baseline_build['sourceInputs'])
    assert extra <= {'upstream/majesty-recomp/kit/cmake/WebMemory.cmake',
                     'upstream/majesty-recomp/kit/tools/build.py',
                     'upstream/majesty-recomp/kit/tests/test_build_py.py',
                     'upstream/majesty-recomp/kit/tests/test_web_memory_policy.py'}, 'Unexpected compiled source input'
    changed = {n for n, h in baseline_build['sourceInputs'].items() if build['sourceInputs'][n] != h}
    allowed = {'upstream/majesty-recomp/browser_campaign.cpp',
               'upstream/majesty-recomp/coop_pause.h',
               'upstream/majesty-recomp/kit/host/CMakeLists.txt'}
    assert {'upstream/majesty-recomp/browser_campaign.cpp',
            'upstream/majesty-recomp/coop_pause.h'} <= changed <= allowed, 'Untested native source change'
    for name, expected in build['sourceInputs'].items():
        assert sha(ROOT / name) == expected, f'Changed compiled source: {name}'
    artifacts = {Path(n).name: m for n, m in build['artifacts'].items()}
    for name in ['MajestyRecomp.wasm', 'MajestyRecomp.js', 'MajestyRecomp.data']:
        assert package['files']['majesty/' + name] == artifacts[name], 'Wrong compiled engine'
    assert package['engineSha256'] == artifacts['MajestyRecomp.wasm']['sha256']
    assert set(package['files']) == set(baseline['files']), 'Unexpected package files'
    allowed_files = {'games.json', 'majesty/MajestyRecomp.js', 'majesty/MajestyRecomp.wasm',
                     'majesty/MajestyRecomp.data', 'multiplayer/cooperative-world.mjs'}
    for name, item in package['files'].items():
        if name not in allowed_files:
            assert item == baseline['files'][name], f'Untested frontend change: {name}'


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('site_report',type=Path)
    parser.add_argument('qualification',type=Path)
    parser.add_argument('release')
    parser.add_argument('output',type=Path)
    parser.add_argument('--qualification-kind',choices=['world','backups','internet','campaign','campaign-progress','content','co-op-pause'],default='world')
    parser.add_argument('--keep-current-entrypoints',action='store_true',
                        help='Offer a separate release without changing the default launcher')
    args=parser.parse_args()
    assert re.fullmatch(r'[a-z][a-z0-9-]{1,39}',args.release)
    assert not args.output.exists(),'Preserve previous publication'
    package=json.loads(args.site_report.read_text())
    proof=json.loads(args.qualification.read_text())
    assert package['privateSitePrepared']
    if args.qualification_kind not in {'content', 'co-op-pause'}:
        assert package['engineUnchanged']
    assert proof['qualified'] and proof['testEnginesReleased']
    requirements={
        'world':['normalWorldFormLaunchQualified','freshAndSavedResumesBothRolesQualified','campaignNavigationQualified'],
        'backups':['realStorageRoundtrip','chapterCompletionAndAtlasCameraPreserved','assetsExcluded',
                   'conflictPreservesExisting','busyProfileRefused','databaseFailureRollback',
                   'interruptedRestoreRecovery','fixtureCleaned','shippedControllerAndWorkerPreview',
                   'completedArchiveIndependentOfSource','oneArchiveCacheBound','concurrentDatabasePreserved'],
        'internet':['httpsWssProxyQualified','publicBrowserPairQualified','hostCheckpointRecoveryQualified',
                    'guestReconnectGuidanceQualified','remoteInvitationDefaultQualified','focusedChecksPassed',
                    'hostingAssetsAndProfilesExcluded','ownedServicesReleased'],
        'campaign':['publicChapterOneVictoryBothRoles','persistedProfileCompletionBothRoles',
                    'actualContinuationClickQualified','newWorldBeforeNextChapter',
                    'nextChapterPartyStarted','invitationExcludesProfileAndStaleResume',
                    'focusedChecksPassed','ownedServicesReleased'],
        'campaign-progress':[],
        'content':[],
        'co-op-pause':[],
    }[args.qualification_kind]
    assert all(proof[key] for key in requirements)
    if args.qualification_kind == 'campaign-progress':
        campaign_progress_qualification(proof, args.site_report)
    if args.qualification_kind == 'content':
        content_qualification(proof, args.site_report, package)
    if args.qualification_kind == 'co-op-pause':
        coop_pause_qualification(proof, args.site_report, package)
    site=Path(package['site']).resolve()
    assert site.is_relative_to(ROOT/'upstream/majesty-recomp/build')
    for name,expected in package['files'].items():
        assert not Path(name).is_absolute() and '..' not in Path(name).parts
        assert sha(site/name)==expected['sha256'],f'Changed package: {name}'
    baseline=json.loads((ROOT/package['sourcePackage']).read_text())
    if args.qualification_kind not in {'content', 'co-op-pause'}:
        for name in ['MajestyRecomp.wasm','MajestyRecomp.js','MajestyRecomp.data']:
            assert sha(site/'majesty'/name)==baseline['files']['majesty/'+name]['sha256']
    release=LIVE/'releases'/args.release
    assert not release.exists() and not release.is_symlink()
    routes=[] if args.keep_current_entrypoints else [name for name in package['files'] if name=='index.html' or name.endswith('/index.html')]
    originals={name:(LIVE/name).read_bytes() if (LIVE/name).exists() else None for name in routes}
    protected=[LIVE/'games.json',*[LIVE/'majesty'/name for name in
               ['MajestyRecomp.js','MajestyRecomp.wasm','MajestyRecomp.data']]]
    before={str(path.relative_to(LIVE)):stamp(path) for path in protected}
    args.output.mkdir(parents=True)
    for name,data in originals.items():
        if data is None:
            continue
        backup=args.output/'previous-entrypoints'/name
        backup.parent.mkdir(parents=True,exist_ok=True);backup.write_bytes(data)
    release.parent.mkdir(exist_ok=True);release.symlink_to(site,target_is_directory=True)
    changed=[]
    try:
        for name in routes:
            target=LIVE/name;destination=f'/releases/{args.release}/'+name.removesuffix('index.html')
            target.parent.mkdir(parents=True,exist_ok=True)
            html='<!doctype html><meta charset="utf-8"><title>Majesty</title>'
            html+=f'<p>Opening Majesty… <a href="{destination}">Continue</a></p>'
            html+='<script>const next=new URL('+json.dumps(destination)+',location.href);'
            html+='next.search=location.search;next.hash=location.hash;location.replace(next.href);</script>\n'
            temporary=target.with_name(target.name+'.'+args.release+'-next')
            temporary.write_text(html);os.replace(temporary,target);changed.append(name)
        assert before=={str(path.relative_to(LIVE)):stamp(path) for path in protected}
    except BaseException:
        for name in changed:
            target=LIVE/name;temporary=target.with_name(target.name+'.'+args.release+'-rollback')
            if originals[name] is None:
                target.unlink()
            else:
                temporary.write_bytes(originals[name]);os.replace(temporary,target)
        release.unlink();raise
    report={'version':1,'published':True,'release':args.release,'releasePath':str(release),
            'releaseUrl':f'http://localhost:8000/releases/{args.release}/',
            'siteReport':str(args.site_report.resolve()),'siteReportSha256':sha(args.site_report),
            'qualification':str(args.qualification.resolve()),'qualificationSha256':sha(args.qualification),
            'engineSha256':package['engineSha256'],'engineUnchanged':args.qualification_kind not in {'content', 'co-op-pause'},
            'packageFilesVerified':len(package['files']),'legacyEngineFilesAndMetadataUnchanged':True,
            'legacyProtectedFiles':before,'routes':routes,'publishedEntryBrowserVerified':False,
            'qualificationKind':args.qualification_kind,'defaultEntrypointsChanged':not args.keep_current_entrypoints,
            'scope':'Immutable qualified frontend package and reversible entrypoint redirects; '
                    'old engine files, releases and all user profiles remain untouched.'}
    (args.output/'publication.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ['published','releaseUrl','engineUnchanged','packageFilesVerified']}))


if __name__=='__main__':
    main()

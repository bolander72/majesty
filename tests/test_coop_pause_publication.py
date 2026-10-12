"""Guard pause publication against mismatched players, artifacts and source."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SPEC=importlib.util.spec_from_file_location('pause_publisher',Path(__file__).resolve().parents[1]/'scripts/publish-qualified-world-frontend.py')
PUB=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(PUB)

class CoopPausePublication(unittest.TestCase):
    def setUp(self):
        tmp=tempfile.TemporaryDirectory();self.addCleanup(tmp.cleanup)
        self.root=Path(tmp.name)
        self.addCleanup(patch.stopall);patch.object(PUB,'ROOT',self.root).start()
        names=['upstream/majesty-recomp/browser_campaign.cpp','upstream/majesty-recomp/coop_pause.h','upstream/majesty-recomp/other.cpp']
        inputs={}
        for name in names:
            p=self.root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(name);inputs[name]=PUB.sha(p)
        old={**inputs,names[0]:'old-campaign',names[1]:'old-pause'}
        self.write('baseline-build.json',{'sourceInputs':old})
        artifacts={n:{'bytes':10,'sha256':n+'-qualified'} for n in ['MajestyRecomp.wasm','MajestyRecomp.js','MajestyRecomp.data']}
        self.build=dict(wasmBuildQualified=True,exitCode=0,officialToolsUsed=True,sourceInputsUnchanged=True,generatedTranslationsEdited=False,sourceInputs=inputs,artifacts=artifacts)
        files={'majesty/'+n:m for n,m in artifacts.items()}
        files.update({'games.json':{'bytes':1,'sha256':'new-games'},'multiplayer/cooperative-world.mjs':{'bytes':1,'sha256':'new-ui'},'campaign/session.mjs':{'bytes':1,'sha256':'unchanged'}})
        baseline=copy.deepcopy(files);baseline['multiplayer/cooperative-world.mjs']['sha256']='old-ui'
        self.write('baseline.json',{'files':baseline,'buildEvidence':'baseline-build.json'})
        self.package=dict(buildEvidence='build.json',sourcePackage='baseline.json',files=files,engineSha256=artifacts['MajestyRecomp.wasm']['sha256'])
        self.report=self.write('site.json',self.package)
        keys=['nativeRestoredMatchBothRoles','nativeGuestPauseObserved','hostCheckpointCommitted','hostResumePrepared','guestReleaseLinkClicked','guestReconnectGuidanceVerified','backupIntegrityAndSchemasPassed','earlierSavesAndOtherDatabasesPreserved','focusedChecksPassed','nativePauseChecksPassed','ownedTrialsMuted','testEnginesReleased','ownedBrowserReleased','resourceBoundsPassed']
        self.proof={k:True for k in keys};self.proof.update(guardStopped=False,hostPause={'epoch':7,'frame':12,'clock':250},guestPause={'epoch':7,'frame':12,'clock':250},siteReportSha256=PUB.sha(self.report))
        self.sync_build()
    def write(self,name,data):
        p=self.root/name;p.write_text(json.dumps(data));return p
    def sync_build(self):
        self.proof['buildReportSha256']=PUB.sha(self.write('build.json',self.build))
    def qualify(self):PUB.coop_pause_qualification(self.proof,self.report,self.package)
    def test_matching_native_pause_with_preserved_sources_qualifies(self):self.qualify()
    def test_every_missing_or_failed_live_gate_refuses(self):
        good=copy.deepcopy(self.proof)
        for key,value in good.items():
            if value is not True:continue
            for bad in [None,False,1,'true']:
                self.proof={**good,key:bad}
                with self.subTest(key=key,bad=bad),self.assertRaisesRegex(AssertionError,'Incomplete'):self.qualify()
        self.proof=good
    def test_guard_stop_never_qualifies(self):
        self.proof['guardStopped']=True
        with self.assertRaisesRegex(AssertionError,'Stopped trial'):self.qualify()
    def test_local_session_epoch_can_differ_between_peers(self):
        self.proof['guestPause']['epoch']=9
        self.qualify()
    def test_wrong_guest_frame_clock_and_missing_boundary_refuse(self):
        good=self.proof['guestPause'].copy()
        for key in ['frame','clock']:
            self.proof['guestPause']={**good,key:good[key]+1}
            with self.subTest(key=key),self.assertRaisesRegex(AssertionError,'same native pause'):self.qualify()
        self.proof['guestPause']={}
        with self.assertRaisesRegex(AssertionError,'Missing native'):self.qualify()
    def test_stale_site_or_build_receipts_refuse(self):
        for name in ['site.json','build.json']:
            p=self.root/name;original=p.read_bytes();p.write_bytes(original+b'\n')
            with self.subTest(name=name),self.assertRaises(AssertionError):self.qualify()
            p.write_bytes(original)
    def test_unqualified_engine_and_unbuilt_source_refuse(self):
        p=self.root/'upstream/majesty-recomp/coop_pause.h';p.write_text('later edit')
        with self.assertRaisesRegex(AssertionError,'Changed compiled source'):self.qualify()
    def test_changed_unrelated_native_source_refuses_even_when_bound(self):
        name='upstream/majesty-recomp/other.cpp';p=self.root/name;p.write_text('unrelated change');self.build['sourceInputs'][name]=PUB.sha(p);self.sync_build()
        with self.assertRaisesRegex(AssertionError,'Untested native'):self.qualify()
    def test_missing_source_inputs_refuse(self):
        self.build['sourceInputs'].pop('upstream/majesty-recomp/other.cpp');self.sync_build()
        with self.assertRaisesRegex(AssertionError,'Missing compiled'):self.qualify()
    def test_extra_source_input_refuses_even_when_bound_to_real_bytes(self):
        p=self.root/'unexpected.cpp';p.write_text('unqualified source');self.build['sourceInputs']['unexpected.cpp']=PUB.sha(p);self.sync_build()
        with self.assertRaisesRegex(AssertionError,'Unexpected compiled'):self.qualify()
    def test_failed_compilation_or_generated_translation_edit_refuses(self):
        original=copy.deepcopy(self.build)
        for key,bad in [('wasmBuildQualified',False),('exitCode',1),('officialToolsUsed',False),('sourceInputsUnchanged',False),('generatedTranslationsEdited',True)]:
            self.build={**original,key:bad};self.sync_build()
            with self.subTest(key=key),self.assertRaises(AssertionError):self.qualify()
    def test_wrong_engine_or_unrelated_frontend_refuse(self):
        for name in ['majesty/MajestyRecomp.wasm','campaign/session.mjs','unexpected.mjs']:
            original=copy.deepcopy(self.package['files']);self.package['files'][name]={'bytes':11,'sha256':'unqualified'}
            with self.subTest(name=name),self.assertRaises(AssertionError):self.qualify()
            self.package['files']=original

if __name__=='__main__':unittest.main()

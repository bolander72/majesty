"""Refuse fourth-mission publication with stale or incomplete qualification."""
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    'publisher', Path(__file__).resolve().parents[1] / 'scripts/publish-qualified-world-frontend.py')
PUBLISHER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PUBLISHER)


class ContentPublication(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.source = self.root / 'resume.h'
        self.source.write_text('qualified source')
        self.artifacts = {name: {'bytes': 10, 'sha256': name + '-qualified'}
                          for name in ['MajestyRecomp.wasm', 'MajestyRecomp.js', 'MajestyRecomp.data']}
        self.build = dict(wasmBuildQualified=True, exitCode=0, officialToolsUnchanged=True,
                          sourceInputsUnchanged=True, generatedTranslationsEdited=False,
                          changedSource=['upstream/majesty-recomp/coop_lobby_resume.h'],
                          sourceInputs={str(self.source): PUBLISHER.sha(self.source)},
                          artifacts=self.artifacts)
        self.build_path = self.root / 'build.json'
        self.build_path.write_text(json.dumps(self.build))
        files = {'majesty/' + name: item for name, item in self.artifacts.items()}
        files['campaign/progress.mjs'] = {'bytes': 12, 'sha256': 'frontend-qualified'}
        self.baseline = self.root / 'baseline.json'
        self.baseline.write_text(json.dumps({'files': files}))
        self.package = dict(buildEvidence=str(self.build_path), sourcePackage=str(self.baseline),
                            files=files, engineSha256=self.artifacts['MajestyRecomp.wasm']['sha256'])
        self.report = self.root / 'site.json'
        self.report.write_text(json.dumps(self.package))
        self.proof = dict(sharedVictoryBothRoles=True, persistedChapterFourBothProfiles=True,
                          nativeChapterFourResumeBothRoles=True, backupIntegrityAndSchemasPassed=True,
                          earlierSavesAndOtherDatabasesPreserved=True, focusedChecksPassed=True,
                          testEnginesReleased=True, ownedBrowserReleased=True,
                          siteReportSha256=PUBLISHER.sha(self.report),
                          buildReportSha256=PUBLISHER.sha(self.build_path),
                          chapterThreeCompletionQualified=False)

    def qualify(self):
        PUBLISHER.content_qualification(self.proof, self.report, self.package)

    def test_fourth_mission_does_not_require_unrelated_original_save_victory(self):
        self.qualify()
        self.assertFalse(self.proof['chapterThreeCompletionQualified'])

    def test_each_missing_or_failed_evidence_gate_refuses(self):
        original = self.proof.copy()
        for key, value in original.items():
            if value is not True:
                continue
            for bad in [None, False, 1, 'true']:
                with self.subTest(key=key, bad=bad):
                    self.proof = {**original, key: bad}
                    with self.assertRaisesRegex(AssertionError, 'Incomplete content'):
                        self.qualify()

    def test_stale_package_and_build_evidence_refuse(self):
        for path in [self.report, self.build_path]:
            original = path.read_bytes()
            path.write_bytes(original + b'\n')
            with self.assertRaises(AssertionError):
                self.qualify()
            path.write_bytes(original)

    def test_source_changes_after_build_refuse(self):
        self.source.write_text('unbuilt edit')
        with self.assertRaisesRegex(AssertionError, 'Changed compiled source'):
            self.qualify()

    def test_engine_or_frontend_not_matching_tested_inputs_refuses(self):
        for name in ['majesty/MajestyRecomp.wasm', 'campaign/progress.mjs']:
            with self.subTest(name=name):
                old = self.package['files'][name]
                self.package['files'][name] = {'bytes': 11, 'sha256': 'changed'}
                with self.assertRaises(AssertionError):
                    self.qualify()
                self.package['files'][name] = old

    def test_extra_package_file_refuses(self):
        self.package['files']['unqualified.mjs'] = {'bytes': 1, 'sha256': 'extra'}
        with self.assertRaisesRegex(AssertionError, 'Unexpected package files'):
            self.qualify()


if __name__ == '__main__':
    unittest.main()

"""Publication refuses partial or package-mismatched campaign evidence."""
import hashlib
import importlib.util
import tempfile
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    'publisher', Path(__file__).resolve().parents[1] / 'scripts/publish-qualified-world-frontend.py')
PUBLISHER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PUBLISHER)


class CampaignProgressPublication(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.report = Path(self.directory.name) / 'site.json'
        self.report.write_text('{"engineUnchanged":true}\n')
        self.proof = dict(
            publicChapterTwoVictoryBothRoles=True,
            persistedChapterTwoCompletionBothProfiles=True,
            personalProgressLinkBothProfiles=True,
            nativeTreasuryObservationsBothRoles=True,
            ninthResumeCopyPrepared=True,
            originalChapterThreeResumeReadersBothRoles=True,
            invitationExcludesProfileAndStaleResume=True,
            focusedChecksPassed=True, testEnginesReleased=True,
            ownedServicesReleased=True,
            siteReportSha256=hashlib.sha256(self.report.read_bytes()).hexdigest(),
            chapterThreeCompletionQualified=False)

    def test_frontend_fixes_do_not_assert_final_victory(self):
        PUBLISHER.campaign_progress_qualification(self.proof, self.report)
        self.assertFalse(self.proof['chapterThreeCompletionQualified'])

    def test_each_missing_or_failed_gate_refuses_publication(self):
        for key in list(self.proof):
            if key in ('siteReportSha256', 'chapterThreeCompletionQualified'):
                continue
            for value in (None, False, 'true', 1):
                with self.subTest(key=key, value=value):
                    proof = {**self.proof, key: value}
                    with self.assertRaises(AssertionError):
                        PUBLISHER.campaign_progress_qualification(proof, self.report)

    def test_package_changed_after_qualification_is_refused(self):
        self.report.write_text('{"engineUnchanged":false}\n')
        with self.assertRaisesRegex(AssertionError, 'another package'):
            PUBLISHER.campaign_progress_qualification(self.proof, self.report)

    def test_missing_package_identity_is_refused(self):
        self.proof.pop('siteReportSha256')
        with self.assertRaisesRegex(AssertionError, 'another package'):
            PUBLISHER.campaign_progress_qualification(self.proof, self.report)


if __name__ == '__main__':
    unittest.main()

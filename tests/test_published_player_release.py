"""Keep Git builds from silently replacing the player already used by saves."""
import copy
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('published_player', ROOT / 'scripts/lib/published_player_release.py')
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)


class PublishedPlayerTests(unittest.TestCase):
    def fixture(self, root):
        (root / 'deploy').mkdir()
        output = root / 'output'
        (output / 'static').mkdir(parents=True)
        (output / 'static/index.html').write_bytes(b'older player')
        (output / 'static/unchanged').write_bytes(b'preserve')
        before = policy.inventory(output)
        after = copy.deepcopy(before)
        after['static/index.html'] = policy.digest(b'published player')
        qualification = json.loads((ROOT / 'deploy/guild-usability-verification.json').read_bytes())
        qualification_raw = json.dumps(qualification).encode()
        (root / 'deploy/guild-usability-verification.json').write_bytes(qualification_raw)
        release = dict(format='majesty-guild-usability-release-v1', qualification=policy.digest(qualification_raw),
                       productionFiles=after, payloads={'static/index.html': dict(**after['static/index.html'],
                       url='https://raw.githubusercontent.com/bolander72/majesty/' + 'a' * 40 + '/assets/player.html')})
        release_raw = json.dumps(release).encode()
        (root / 'deploy/release.json').write_bytes(release_raw)
        production = json.loads((ROOT / 'deploy/guild-usability-production-verification.json').read_bytes())
        production.update(releaseDescriptor=policy.digest(release_raw), sourceQualification=policy.digest(qualification_raw))
        production_raw = json.dumps(production).encode()
        (root / 'deploy/verified.json').write_bytes(production_raw)
        published = dict(format='majesty-published-player-release-v1', baselineFiles=before,
                         sourceRelease=dict(path='deploy/release.json', **policy.digest(release_raw)),
                         productionVerification=dict(path='deploy/verified.json', **policy.digest(production_raw)))
        (root / 'deploy/published-player-release.json').write_text(json.dumps(published))
        return output, after

    def test_git_build_advances_to_the_published_player_and_preserves_other_files(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            output, expected = self.fixture(root)
            with patch.object(policy.urllib.request, 'urlopen', return_value=io.BytesIO(b'published player')):
                policy.install(root, output)
            self.assertEqual(policy.inventory(output), expected)

    def test_changed_baseline_fails_before_any_download_or_replacement(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            output, _ = self.fixture(root)
            (output / 'static/unchanged').write_bytes(b'changed')
            before = policy.inventory(output)
            with patch.object(policy.urllib.request, 'urlopen') as fetch:
                with self.assertRaisesRegex(ValueError, 'baseline'):
                    policy.install(root, output)
                fetch.assert_not_called()
            self.assertEqual(policy.inventory(output), before)

    def test_unverified_download_never_replaces_the_baseline(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            output, _ = self.fixture(root)
            before = policy.inventory(output)
            with patch.object(policy.urllib.request, 'urlopen', return_value=io.BytesIO(b'corrupted')):
                with self.assertRaisesRegex(ValueError, 'integrity'):
                    policy.install(root, output)
            self.assertEqual(policy.inventory(output), before)

    def test_missing_release_cannot_silently_publish_the_older_player(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaises(FileNotFoundError):
                policy.install(Path(temp), Path(temp) / 'output')

    def test_changed_qualification_is_refused(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            output, _ = self.fixture(root)
            (root / 'deploy/guild-usability-verification.json').write_text('{}')
            with patch.object(policy.urllib.request, 'urlopen') as fetch:
                with self.assertRaisesRegex(ValueError, 'qualification'):
                    policy.install(root, output)
                fetch.assert_not_called()



if __name__ == '__main__':
    unittest.main()

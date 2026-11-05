import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('demo_release_build', ROOT / 'scripts/build-vercel.py')
BUILD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILD)


class DemoReleaseTests(unittest.TestCase):
    def fixture(self, path):
        root = Path(path)
        names = ['deploy/vampiric-revenge-release.json', 'deploy/vampiric-revenge-verification.json',
                 'deploy/hosted-release.json', 'web/content/vampiric-revenge-files.mjs',
                 'content/vampiric-revenge/VampiricRevengeBridge.gpl',
                 'content/vampiric-revenge/VampiricRevengeBridge.gplproj']
        for name in names:
            target = root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, target)
        (root / 'static/hosting').mkdir(parents=True)
        (root / 'static/games.json').write_text('[{"id":"majesty"},{"id":"majesty-alchemist-v1-campaign3"}]')
        (root / 'static/hosting/automatic-assets.json').write_text(
            '{"games":{"majesty":{"original":true},"majesty-alchemist-v1-campaign3":{"preserved":true}}}')
        return root

    def test_preserves_prior_collections_and_original_profile_identity(self):
        with tempfile.TemporaryDirectory() as temp:
            root = self.fixture(temp)
            with patch.object(BUILD, 'ROOT', root):
                BUILD.install_vampiric_revenge_release(root / 'static')
            games = json.loads((root / 'static/games.json').read_text())
            self.assertEqual(games[0], {'id': 'majesty', 'defaultContentStorageId': 'majesty-alchemist-demo-v1'})
            self.assertEqual(games[1], {'id': 'majesty-alchemist-v1-campaign3'})
            assets = json.loads((root / 'static/hosting/automatic-assets.json').read_text())['games']
            self.assertEqual(assets['majesty'], {'original': True})
            self.assertEqual(assets['majesty-alchemist-v1-campaign3'], {'preserved': True})
            self.assertEqual(len(assets['majesty-alchemist-demo-v1']['patches']), 36)

    def test_unqualified_or_changed_inputs_cannot_enable_demo(self):
        for bad in ['qualification', 'source', 'patch']:
            with self.subTest(bad=bad), tempfile.TemporaryDirectory() as temp:
                root = self.fixture(temp)
                if bad == 'qualification':
                    p = root / 'deploy/vampiric-revenge-verification.json'
                    value = json.loads(p.read_text())
                    value['browserWorldSaveReloadQualified'] = False
                    p.write_text(json.dumps(value))
                elif bad == 'source':
                    (root / 'content/vampiric-revenge/VampiricRevengeBridge.gpl').write_text('changed')
                else:
                    p = root / 'deploy/vampiric-revenge-release.json'
                    value = json.loads(p.read_text())
                    value['patches'][0]['sha256'] = '0' * 64
                    p.write_text(json.dumps(value))
                with patch.object(BUILD, 'ROOT', root), self.assertRaises(ValueError):
                    BUILD.install_vampiric_revenge_release(root / 'static')
                self.assertEqual(len(json.loads((root / 'static/games.json').read_text())), 2)


if __name__ == '__main__':
    unittest.main()

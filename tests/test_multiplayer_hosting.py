import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('hosting', ROOT / 'scripts/prepare-multiplayer-hosting.py')
hosting = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hosting)


class HostingPackage(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.addCleanup(setattr, hosting, 'ROOT', hosting.ROOT)
        hosting.ROOT = self.root
        for directory, names in [('deploy/multiplayer', ['Caddyfile', 'compose.yaml', 'Dockerfile.relay', '.env.example', '.dockerignore']),
                                 ('scripts', ['room_relay.py', 'requirements-multiplayer.txt']),
                                 ('docs', ['internet-multiplayer.md', 'co-op-campaign-continuation.md'])]:
            target = self.root / directory
            target.mkdir(parents=True)
            for name in names:
                (target / name).write_bytes((ROOT / directory / name).read_bytes())
        self.site = self.root / 'upstream/majesty-recomp/build/site'
        self.files = {}
        for name in ['index.html', 'games.json', 'majesty/index.html', 'multiplayer/index.html',
                     'majesty/MajestyRecomp.wasm', 'majesty/MajestyRecomp.js', 'majesty/MajestyRecomp.data']:
            p = self.site / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(name.encode())
            self.files[name] = dict(bytes=p.stat().st_size, sha256=hashlib.sha256(p.read_bytes()).hexdigest())
        self.report = self.root / 'package.json'
        self.output = self.root / 'bundle'
        self.write_report()

    def write_report(self):
        self.report.write_text(json.dumps(dict(site=str(self.site), files=self.files,
            engineSha256=self.files['majesty/MajestyRecomp.wasm']['sha256'])))

    def test_copies_only_manifest_files_and_retains_source(self):
        (self.site / 'private.GMP').write_text('not a hosting input')
        proof = hosting.prepare(self.report, self.output)
        self.assertFalse(proof['deploymentStarted'])
        self.assertFalse((self.output / 'site/private.GMP').exists())
        self.assertEqual((self.site / 'private.GMP').read_text(), 'not a hosting input')
        self.assertEqual((self.output / 'site/games.json').read_bytes(), b'games.json')
        with self.assertRaises(FileExistsError):
            hosting.prepare(self.report, self.output)

    def test_changed_engine_is_refused_before_creating_destination(self):
        (self.site / 'majesty/MajestyRecomp.wasm').write_text('changed')
        with self.assertRaisesRegex(ValueError, 'Package changed'):
            hosting.prepare(self.report, self.output)
        self.assertFalse(self.output.exists())

    def test_private_save_in_manifest_is_refused(self):
        self.files['private.GMP'] = dict(bytes=1, sha256='0'*64)
        self.write_report()
        with self.assertRaisesRegex(ValueError, 'Private game assets'):
            hosting.prepare(self.report, self.output)
        self.assertFalse(self.output.exists())

    def test_symlink_cannot_import_files_from_outside_staged_site(self):
        outside = self.root / 'secret.js'; outside.write_text('secret')
        (self.site / 'extra.js').symlink_to(outside)
        self.files['extra.js'] = dict(bytes=6, sha256=hashlib.sha256(b'secret').hexdigest())
        self.write_report()
        with self.assertRaisesRegex(ValueError, 'escaped'):
            hosting.prepare(self.report, self.output)
        self.assertFalse(self.output.exists())

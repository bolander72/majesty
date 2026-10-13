import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('build', Path(__file__).resolve().parents[1] / 'scripts/build-vercel.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


class ReleaseIntegrity(unittest.TestCase):
    def archive(self, name='static/index.html', symlink=False):
        content = b'<html>game</html>'
        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode='w:gz') as archive:
            info = tarfile.TarInfo(name)
            info.size = len(content)
            if symlink:
                info.type = tarfile.SYMTYPE
                info.linkname = '/private/data'
            archive.addfile(info, io.BytesIO(content))
        data = stream.getvalue()
        return data, {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
            'files': {name: {'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()}}}

    def test_corrupt_download_and_changed_file_are_rejected(self):
        data, release = self.archive()
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaisesRegex(ValueError, 'download'):
                build.unpack_release(data[:-1], release, Path(temp))
            release['files']['static/index.html']['sha256'] = '0' * 64
            with self.assertRaisesRegex(ValueError, 'file failed'):
                build.unpack_release(data, release, Path(temp))

    def test_traversal_and_symlink_are_rejected(self):
        for name, symlink in [('../escape', False), ('static/index.html', True)]:
            with self.subTest(name=name, symlink=symlink), tempfile.TemporaryDirectory() as temp:
                data, release = self.archive(name, symlink)
                with self.assertRaisesRegex(ValueError, 'Unsafe'):
                    build.unpack_release(data, release, Path(temp))


class ContentReleaseIntegrity(unittest.TestCase):
    def fixture(self, directory):
        root = Path(directory)
        for folder in ['deploy', 'content/the-lost-trail', 'web/content', 'static/hosting']:
            (root / folder).mkdir(parents=True)
        pins = (build.ROOT / 'web/content/lost-trail-files.mjs').read_text()
        (root / 'web/content/lost-trail-files.mjs').write_text(pins)
        bindings = dict(build.re.findall(r"'([^']+)': '([a-f0-9]{64})'", pins.split('export const LOST_TRAIL_REPLACEMENTS')[0]))
        source = {}
        for name in ['TheLostTrail.gpl', 'TheLostTrail.gplproj']:
            (root / 'content/the-lost-trail' / name).write_bytes(name.encode())
            source[name] = hashlib.sha256(name.encode()).hexdigest()
        content = dict(format='majesty-lost-trail-content-release-v1', engineSha256='0' * 64,
            storageId='majesty-lost-trail', baseId='majesty',
            canonicalGuid='{8BC7C549-E5A2-4D0F-A726-83B16BF19E42}',
            requiredRuntimeEnvironment={'RECOMP_RULE_INVENTORY_COMPAT': '1'}, sourceSha256=source,
            browserSelectionWorldSaveReloadQualified=True, rootDefaultIntegrationQualified=True,
            nativeOrdinaryVictoryQualified=True, patches=[dict(path=name, sha256=digest, bytes=10,
                url='https://gzyxvhfrxfzxgeae.public.blob.vercel-storage.com/majesty/content/lost-trail-v1/test/' + name)
                for name, digest in bindings.items()])
        (root / 'deploy/hosted-release.json').write_text(json.dumps({'engineSha256': '0' * 64}))
        (root / 'deploy/content-release.json').write_text(json.dumps(content))
        (root / 'static/games.json').write_text('[{"id":"majesty","title":"Majesty"}]')
        (root / 'static/hosting/automatic-assets.json').write_text('{"games":{"majesty":{"original":true}}}')
        return root, content

    def test_content_adds_root_data_without_replacing_original_collection(self):
        with tempfile.TemporaryDirectory() as temp:
            root, _ = self.fixture(temp)
            with patch.object(build, 'ROOT', root):
                build.install_content_release(root / 'static')
            games = json.loads((root / 'static/games.json').read_text())
            assets = json.loads((root / 'static/hosting/automatic-assets.json').read_text())
            self.assertEqual(games[0]['id'], 'majesty')
            self.assertEqual(games[0]['defaultContentStorageId'], 'majesty-lost-trail')
            self.assertEqual(assets['games']['majesty'], {'original': True})
            self.assertEqual(len(assets['games']['majesty-lost-trail']['patches']), 12)

    def test_stale_compiler_source_or_unqualified_release_cannot_enable_content(self):
        for bad in ['source', 'qualification', 'missing', 'duplicate', 'hash', 'origin']:
            with self.subTest(bad=bad), tempfile.TemporaryDirectory() as temp:
                root, content = self.fixture(temp)
                if bad == 'source':
                    (root / 'content/the-lost-trail/TheLostTrail.gpl').write_text('changed')
                elif bad == 'qualification': content['browserSelectionWorldSaveReloadQualified'] = False
                elif bad == 'missing': content['patches'].pop()
                elif bad == 'duplicate': content['patches'][0] = content['patches'][1]
                elif bad == 'hash': content['patches'][0]['sha256'] = '0' * 64
                else: content['patches'][0]['url'] = 'https://unrelated.example/resource'
                (root / 'deploy/content-release.json').write_text(json.dumps(content))
                with patch.object(build, 'ROOT', root), self.assertRaises(ValueError):
                    build.install_content_release(root / 'static')
                self.assertEqual(json.loads((root / 'static/games.json').read_text()),
                    [{'id': 'majesty', 'title': 'Majesty'}])


if __name__ == '__main__':
    unittest.main()

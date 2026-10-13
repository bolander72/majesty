import importlib.util
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('v2_build', SOURCE / 'scripts/build-vercel.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


class VersionedContentRelease(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.previous = build.ROOT
        build.ROOT = self.root
        self.addCleanup(setattr, build, 'ROOT', self.previous)
        self.static = self.root / 'static'
        (self.static / 'hosting').mkdir(parents=True)
        (self.root / 'deploy').mkdir()
        (self.root / 'web/content').mkdir(parents=True)
        source = self.root / 'content/wayfinder-trail-lodge/v2'
        source.mkdir(parents=True)
        hashes = {}
        for name in ['Wayfinder.gpl', 'Wayfinder_Support.dat', 'spec.json']:
            (source / name).write_text('bound ' + name)
            hashes[name] = hashlib.sha256((source / name).read_bytes()).hexdigest()
        bindings = {}
        patches = []
        for i in range(13):
            name = f'DataMX/qualified{i}.cam'
            digest = hashlib.sha256(name.encode()).hexdigest()
            bindings[name] = digest
            patches.append(dict(path=name, sha256=digest, bytes=100,
                url='https://raw.githubusercontent.com/bolander72/majesty/' + 'a' * 40 + '/assets/' + name))
        (self.root / 'web/content/lost-trail-v2-files.mjs').write_text(json.dumps(bindings))
        (self.root / 'deploy/hosted-release.json').write_text(json.dumps({'engineSha256': 'e' * 64}))
        self.descriptor = dict(format='majesty-lost-trail-content-release-v2',
            storageId='majesty-lost-trail-v2', baseId='majesty', engineSha256='e' * 64,
            canonicalGuid='{8BC7C549-E5A2-4D0F-A726-83B16BF19E42}',
            requiredRuntimeEnvironment={'RECOMP_RULE_INVENTORY_COMPAT': '1'},
            nativeAbilitiesQualified=True, browserSaveReloadQualified=True,
            browserPaidRecruitmentQualified=True, rootDefaultIntegrationQualified=True,
            sourceSha256=hashes, patches=patches)
        self.assets = {'games': {'majesty': {'original': True},
            'majesty-lost-trail': {'legacy': True}}}
        self.games = [{'id': 'majesty', 'defaultContentStorageId': 'majesty-lost-trail'},
            {'id': 'majesty-lost-trail', 'legacy': True}]
        (self.static / 'hosting/automatic-assets.json').write_text(json.dumps(self.assets))
        (self.static / 'games.json').write_text(json.dumps(self.games))

    def install(self):
        (self.root / 'deploy/content-v2-release.json').write_text(json.dumps(self.descriptor))
        build.install_content_v2_release(self.static)

    def test_qualified_upgrade_keeps_legacy_data_and_the_normal_profile_identity(self):
        self.install()
        assets = json.loads((self.static / 'hosting/automatic-assets.json').read_text())
        self.assertEqual(assets['games']['majesty-lost-trail'], self.assets['games']['majesty-lost-trail'])
        self.assertEqual(assets['games']['majesty'], self.assets['games']['majesty'])
        games = json.loads((self.static / 'games.json').read_text())
        self.assertEqual(games[0]['id'], 'majesty')
        self.assertEqual(games[0]['defaultContentStorageId'], 'majesty-lost-trail-v2')
        self.assertEqual(games[1], self.games[1])
        self.assertEqual(games[2]['id'], 'majesty-lost-trail-v2')

    def test_failed_qualification_or_changed_source_cannot_modify_the_catalog(self):
        before = (self.static / 'games.json').read_bytes()
        self.descriptor['nativeAbilitiesQualified'] = False
        with self.assertRaisesRegex(ValueError, 'gameplay-qualified'):
            self.install()
        self.assertEqual((self.static / 'games.json').read_bytes(), before)
        self.descriptor['nativeAbilitiesQualified'] = True
        (self.root / 'content/wayfinder-trail-lodge/v2/Wayfinder.gpl').write_text('uncompiled edit')
        with self.assertRaisesRegex(ValueError, 'source differs'):
            self.install()
        self.assertEqual((self.static / 'games.json').read_bytes(), before)

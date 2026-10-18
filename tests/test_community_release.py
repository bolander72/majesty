import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('community_release_build', ROOT / 'scripts/build-vercel.py')
BUILD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILD)


class CommunityReleaseTests(unittest.TestCase):
    def fixture(self, path):
        root = Path(path)
        (root / 'deploy').mkdir()
        (root / 'web/content').mkdir(parents=True)
        shutil.copyfile(ROOT / 'web/content/community-files.mjs', root / 'web/content/community-files.mjs')
        module = (root / 'web/content/community-files.mjs').read_text()
        def binding(name):
            return json.loads(module.split('export const COMMUNITY_' + name + ' = Object.freeze(', 1)[1].split(');', 1)[0])
        files, sizes = binding('FILES'), binding('SIZES')
        engine = 'b' * 64
        (root / 'deploy/hosted-release.json').write_text(json.dumps({'engineSha256': engine}))
        environment = {name: '1' for name in [
            'RECOMP_COMMUNITY_INTEGER_HELPERS', 'RECOMP_COMMUNITY_BASE_TIMING_HELPERS',
            'RECOMP_COMMUNITY_PROCESS_GUILDS', 'RECOMP_COMMUNITY_MOVEMENT_SCALE',
            'RECOMP_COMMUNITY_SPELL_ORIGIN', 'RECOMP_COMMUNITY_RESEARCH_QUERY_HELPERS',
            'RECOMP_COMMUNITY_SPELL_TIMING_HELPERS', 'RECOMP_COMMUNITY_HERO_UI',
            'RECOMP_COMMUNITY_PHANTOM_UI']}
        content = {'format': 'majesty-community-guilds-release-v1', 'engineSha256': engine,
                   'storageId': 'majesty-community-guilds-v1', 'baseId': 'majesty',
                   'additionalRuntimeEnvironment': environment,
                   'patches': [{'path': p, 'sha256': h, 'bytes': sizes[p],
                                'url': 'https://raw.githubusercontent.com/bolander72/majesty/' +
                                       'a' * 40 + '/assets/content/community/' + p} for p, h in files.items()]}
        (root / 'deploy/community-guilds-release.json').write_text(json.dumps(content))
        proof = {name: True for name in ['nativePaidGuildsQualified', 'nativeAdvancedAbilitiesQualified',
                 'browserNativeUiQualified', 'browserWorldSaveReloadQualified',
                 'originalSaveProfilePreserved', 'rootDefaultIntegrationQualified']}
        proof['engineSha256'] = engine
        (root / 'deploy/community-guilds-verification.json').write_text(json.dumps(proof))
        static = root / 'static'
        (static / 'hosting').mkdir(parents=True)
        (static / 'majesty').mkdir()
        (static / 'games.json').write_text(json.dumps([
            {'id': 'majesty', 'defaultContentStorageId': 'majesty-alchemist-demo-v1'},
            {'id': 'majesty-alchemist-demo-v1', 'title': 'preserved'}]))
        (static / 'hosting/automatic-assets.json').write_text(json.dumps({'games': {
            'majesty': {'original': True}, 'majesty-alchemist-demo-v1': {'preserved': True}}}))
        (static / 'majesty/index.html').write_text('<canvas></canvas>\n      m.ENV.RECOMP_GUEST_ARGS = "-nointro";\n')
        return root, static

    def test_default_mount_preserves_original_identity_prior_collections_and_native_player(self):
        with tempfile.TemporaryDirectory() as temp:
            root, static = self.fixture(temp)
            with patch.object(BUILD, 'ROOT', root):
                BUILD.install_community_guilds_release(static)
            games = json.loads((static / 'games.json').read_text())
            self.assertEqual(games[0], {'id': 'majesty', 'defaultContentStorageId': 'majesty-community-guilds-v1'})
            self.assertEqual(games[1], {'id': 'majesty-alchemist-demo-v1', 'title': 'preserved'})
            self.assertEqual(games[2]['id'], 'majesty-community-guilds-v1')
            self.assertNotIn('defaultContentStorageId', games[2])
            assets = json.loads((static / 'hosting/automatic-assets.json').read_text())['games']
            self.assertEqual(assets['majesty'], {'original': True})
            self.assertEqual(assets['majesty-alchemist-demo-v1'], {'preserved': True})
            self.assertEqual(len(assets['majesty-community-guilds-v1']['patches']), 54)
            player = (static / 'majesty/index.html').read_text()
            self.assertTrue(player.startswith('<canvas></canvas>\n'))
            self.assertEqual(player.count('m.ENV.RECOMP_COMMUNITY_PROCESS_GUILDS = "1";'), 1)
            self.assertNotIn('TEST_', player)

    def test_unqualified_changed_or_fixture_enabled_releases_cannot_mutate_static_state(self):
        for bad in ['proof', 'engine', 'patch', 'environment', 'duplicate']:
            with self.subTest(bad=bad), tempfile.TemporaryDirectory() as temp:
                root, static = self.fixture(temp)
                before = {p.relative_to(static).as_posix(): p.read_bytes() for p in static.rglob('*') if p.is_file()}
                name = 'community-guilds-verification.json' if bad == 'proof' else 'community-guilds-release.json'
                p = root / 'deploy' / name
                value = json.loads(p.read_text())
                if bad == 'proof': value['browserWorldSaveReloadQualified'] = False
                elif bad == 'engine': value['engineSha256'] = '0' * 64
                elif bad == 'patch': value['patches'][0]['bytes'] += 1
                elif bad == 'environment': value['additionalRuntimeEnvironment']['RECOMP_COMMUNITY_TEST_MECHANICS'] = '2314'
                else: value['patches'][1] = value['patches'][0]
                p.write_text(json.dumps(value))
                with patch.object(BUILD, 'ROOT', root), self.assertRaises(ValueError):
                    BUILD.install_community_guilds_release(static)
                self.assertEqual(before, {p.relative_to(static).as_posix(): p.read_bytes() for p in static.rglob('*') if p.is_file()})


if __name__ == '__main__':
    unittest.main()

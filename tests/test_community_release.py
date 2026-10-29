import importlib.util
import hashlib
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
    def test_expansions_require_matching_sources_and_every_gameplay_gate(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'deploy').mkdir()
            identities = ['adventurers-guild', 'more-heroes', 'royal-menagerie']
            contracts = {}
            for name in identities:
                path = root / 'content/community-expansions' / name / 'source-contract.json'
                path.parent.mkdir(parents=True)
                path.write_text(json.dumps({'id': name}))
                contracts[name] = hashlib.sha256(path.read_bytes()).hexdigest()
            proof = dict(format='majesty-community-expansions-release-qualification-v1',
                engineSha256='b' * 64, sourceContracts=contracts)
            gates = ['followerMarkerLifecycleQualified', 'adventurerQuestLifecycleQualified',
                'menagerieCaptureTameRentalQualified', 'moreHeroesGameplayQualified',
                'browserSavedWorldRegressionQualified', 'singlePlayerOnlyQualified',
                'originalProfileAndPhantomPreserved']
            proof.update({key: True for key in gates})
            path = root / 'deploy/community-expansions-verification.json'
            content = {'communityExpansions': identities}
            with patch.object(BUILD, 'ROOT', root):
                self.assertFalse(BUILD.qualify_community_expansions({}, 'b' * 64))
                for gate in gates:
                    path.write_text(json.dumps({**proof, gate: False}))
                    with self.assertRaises(ValueError):
                        BUILD.qualify_community_expansions(content, 'b' * 64)
                path.write_text(json.dumps(proof))
                self.assertTrue(BUILD.qualify_community_expansions(content, 'b' * 64))
                with self.assertRaises(ValueError):
                    BUILD.qualify_community_expansions(content, 'c' * 64)
                changed = root / 'content/community-expansions/royal-menagerie/source-contract.json'
                changed.write_text('{}')
                with self.assertRaises(ValueError):
                    BUILD.qualify_community_expansions(content, 'b' * 64)

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
        identities = ['adventurers-guild', 'more-heroes', 'royal-menagerie']
        contracts = {}
        for name in identities:
            contract = root / 'content/community-expansions' / name / 'source-contract.json'
            contract.parent.mkdir(parents=True)
            contract.write_text(json.dumps({'id': name}))
            contracts[name] = hashlib.sha256(contract.read_bytes()).hexdigest()
        content['communityExpansions'] = identities
        environment.update({name: '1' for name in [
            'RECOMP_COMMUNITY_PRIVATE_INTENTS', 'RECOMP_COMMUNITY_WORLD_QUERY_HELPERS',
            'RECOMP_COMMUNITY_EXPANSION_PANELS']})
        expansion_proof = dict(format='majesty-community-expansions-release-qualification-v1',
            engineSha256=engine, sourceContracts=contracts)
        expansion_proof.update({key: True for key in [
            'followerMarkerLifecycleQualified', 'adventurerQuestLifecycleQualified',
            'menagerieCaptureTameRentalQualified', 'moreHeroesGameplayQualified',
            'browserSavedWorldRegressionQualified', 'singlePlayerOnlyQualified',
            'originalProfileAndPhantomPreserved']})
        (root / 'deploy/community-expansions-verification.json').write_text(json.dumps(expansion_proof))
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

    def test_retirement_requires_exact_selection_resources_and_every_save_gate(self):
        with tempfile.TemporaryDirectory() as temp:
            root, static = self.fixture(temp)
            p = root / 'deploy/community-guilds-release.json'
            content = json.loads(p.read_text())
            content['communityExpansions'] = ['adventurers-guild', 'royal-menagerie']
            content['retiredCommunityExpansions'] = ['more-heroes']
            policies = ['scripts/lib/community_more_heroes_retirement.py',
                        'scripts/prepare-more-heroes-retirement.py']
            bindings = {}
            for name in policies:
                policy = root / name
                policy.parent.mkdir(parents=True, exist_ok=True)
                policy.write_bytes(b'qualified retirement policy')
                bindings[name] = hashlib.sha256(policy.read_bytes()).hexdigest()
            gates = ['moreHeroesBuildAndRecruitmentDisabled', 'randomAdmissionPoolRestored',
                     'saveDefinitionsRetained', 'existingWorldReloadQualified',
                     'adventurersAndMenageriePreserved', 'playerSaveHashesPreserved']
            paths = {'DataMX/mx_Unittype.cam', 'Data/Community_Expansion.bcd',
                     'DataMX/Community_Expansion.bcd'}
            proof = dict(format='majesty-more-heroes-retirement-qualification-v1',
                engineSha256='b' * 64, sourcePolicies=bindings,
                files={r['path']:{k:r[k] for k in ('bytes','sha256')}
                       for r in content['patches'] if r['path'] in paths})
            proof.update({key:True for key in gates})
            audit = root / 'deploy/more-heroes-retirement-verification.json'
            with patch.object(BUILD, 'ROOT', root):
                audit.write_text(json.dumps(proof))
                self.assertTrue(BUILD.qualify_community_expansions(content, 'b' * 64))
                for key in gates:
                    audit.write_text(json.dumps({**proof, key:False}))
                    with self.assertRaises(ValueError):
                        BUILD.qualify_community_expansions(content, 'b' * 64)
                audit.write_text(json.dumps(proof))
                content['patches'][next(i for i,r in enumerate(content['patches'])
                    if r['path']=='DataMX/mx_Unittype.cam')]['bytes'] += 1
                with self.assertRaises(ValueError):
                    BUILD.qualify_community_expansions(content, 'b' * 64)

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
            self.assertEqual(len(assets['majesty-community-guilds-v1']['patches']), 56)
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

    def campaign_fixture(self, root):
        descriptor = root / 'deploy/community-guilds-release.json'
        content = json.loads(descriptor.read_text())
        content['campaignResourceVerification'] = 'deploy/community-campaign-resource-verification.json'
        descriptor.write_text(json.dumps(content))
        checks = ['nativeStringAttributesQualified', 'sharedHelpersInCommonQualified',
                  'nativeFireBalmLifecycleQualified', 'browserOriginalAndNorthernQualified',
                  'browserFiveCommunityClassesSaveReloadQualified', 'originalSaveProfilePreserved']
        audit = {key: True for key in checks}
        audit.update(format='majesty-community-campaign-resource-qualification-v1',
                     engineSha256=content['engineSha256'], sourcePolicies={},
                     files={p['path']: {k: p[k] for k in ('bytes', 'sha256')}
                            for p in content['patches'] if p['path'] in BUILD.CAMPAIGN_RESOURCE_PATHS})
        for name in BUILD.CAMPAIGN_RESOURCE_POLICIES:
            p = root / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(b'qualified policy fixture')
            audit['sourcePolicies'][name] = hashlib.sha256(p.read_bytes()).hexdigest()
        path = root / content['campaignResourceVerification']
        path.write_text(json.dumps(audit))
        return path, audit

    def test_qualified_campaign_resources_mount_with_the_matching_runtime(self):
        with tempfile.TemporaryDirectory() as temp:
            root, static = self.fixture(temp)
            self.campaign_fixture(root)
            with patch.object(BUILD, 'ROOT', root):
                BUILD.install_community_guilds_release(static)
            self.assertIn('majesty-community-guilds-v1', (static / 'games.json').read_text())

    def test_wrong_runtime_scope_payload_or_changed_source_cannot_ship_campaign_resources(self):
        for bad in ['runtime', 'scope', 'payload', 'source']:
            with self.subTest(bad=bad), tempfile.TemporaryDirectory() as temp:
                root, static = self.fixture(temp)
                path, audit = self.campaign_fixture(root)
                before = {p.relative_to(static).as_posix(): p.read_bytes()
                          for p in static.rglob('*') if p.is_file()}
                if bad == 'runtime': audit['engineSha256'] = '0' * 64
                elif bad == 'scope': audit['sharedHelpersInCommonQualified'] = False
                elif bad == 'payload': audit['files']['Data/unittype.cam']['sha256'] = '0' * 64
                else: (root / 'native/community/gpl_attribute_bridge.h').write_bytes(b'changed')
                path.write_text(json.dumps(audit))
                with patch.object(BUILD, 'ROOT', root), self.assertRaises(ValueError):
                    BUILD.install_community_guilds_release(static)
                self.assertEqual(before, {p.relative_to(static).as_posix(): p.read_bytes()
                                         for p in static.rglob('*') if p.is_file()})


    def test_phantom_upgrade_requires_bound_sources_and_live_save_checks(self):
        for bad in [None, 'reload', 'recruit', 'spell', 'engine', 'source', 'prior', 'extra']:
            with self.subTest(bad=bad), tempfile.TemporaryDirectory() as temp:
                root, _ = self.fixture(temp)
                _, audit = self.campaign_fixture(root)
                content = json.loads((root / 'deploy/community-guilds-release.json').read_text())
                content['phantomResilienceVerification'] = 'deploy/phantom-resilience-verification.json'
                names = ['Data/Community_Common.bcd', 'DataMX/Community_Common.bcd']
                update = {'bytes': 15000000, 'sha256': 'c' * 64}
                proof = dict(format='majesty-phantom-resilience-qualification-v1',
                    engineSha256=content['engineSha256'], existingHeroMigrationQualified=True,
                    freshReloadIdempotent=True, newRecruitQualified=True,
                    otherHeroesUnchanged=True, ownedBrowsersClosed=True, nativeEternalSoulRoundTripQualified=True,
                    files={n: update for n in names},
                    priorFiles={n: audit['files'][n] for n in names}, sourcePolicies={})
                for name in ['scripts/prepare-phantom-resilience.py',
                             'content/community-mods/phantoms-haunt/resilience.gpl']:
                    path = root / name
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_bytes(b'qualified Phantom balance')
                    proof['sourcePolicies'][name] = hashlib.sha256(path.read_bytes()).hexdigest()
                for rec in content['patches']:
                    if rec['path'] in names:
                        rec.update(update)
                if bad == 'reload': proof['freshReloadIdempotent'] = False
                elif bad == 'recruit': proof['newRecruitQualified'] = False
                elif bad == 'spell': proof['nativeEternalSoulRoundTripQualified'] = False
                elif bad == 'engine': proof['engineSha256'] = '0' * 64
                elif bad == 'source': (root / 'scripts/prepare-phantom-resilience.py').write_bytes(b'changed')
                elif bad == 'prior': proof['priorFiles'][names[0]] = update
                elif bad == 'extra': proof['files']['Data/unittype.cam'] = update
                (root / content['phantomResilienceVerification']).write_text(json.dumps(proof))
                with patch.object(BUILD, 'ROOT', root):
                    if bad is None:
                        BUILD.qualify_campaign_resource_release(content, content['engineSha256'])
                    else:
                        with self.assertRaises(ValueError):
                            BUILD.qualify_campaign_resource_release(content, content['engineSha256'])


if __name__ == '__main__':
    unittest.main()

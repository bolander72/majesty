import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from lib.bards_world_scale_release import BINDINGS, CAM_PATHS, digest, install, object_literal, prepare_bindings


class BardsReleaseTests(unittest.TestCase):
    def fixture(self):
        old, new = '1' * 64, '2' * 64
        files = {p: old for p in CAM_PATHS}
        files['Data/Community_Common.bcd'] = '3' * 64
        sizes = {p: 100 for p in CAM_PATHS}
        sizes['Data/Community_Common.bcd'] = 456
        catalog = ('export const COMMUNITY_FILES = Object.freeze(' + json.dumps(files) + ');\n'
                   'export const COMMUNITY_SIZES = Object.freeze(' + json.dumps(sizes) + ');\n')
        recipe = {'games': {'majesty-community-guilds-v1': {'patches': [
            dict(path=p, sha256=h, bytes=sizes[p], url='https://old.invalid/' + p)
            for p, h in files.items()]}, 'majesty': {'sha256': 'original game'}}}
        updater = 'const PREVIOUS = Object.freeze(' + json.dumps({p: ['4' * 64] for p in CAM_PATHS}) + ');\n'
        inputs = dict(zip(BINDINGS, [catalog.encode(), json.dumps(recipe).encode(), updater.encode()]))
        release = dict(percent=70, sourceCam=dict(bytes=100, sha256=old), cam=dict(bytes=80, sha256=new),
                       assetCommit='a' * 40, previousCamHashes=[old],
                       priorBindings={n: digest(b) for n, b in inputs.items()})
        return inputs, release

    def test_updates_both_editions_and_preserves_bytecode_and_other_collections(self):
        inputs, release = self.fixture()
        before = inputs.copy()
        result = prepare_bindings(inputs, release)
        self.assertEqual(inputs, before)
        files = object_literal(result[BINDINGS[0]].decode(), 'COMMUNITY_FILES')[1]
        self.assertEqual(files['Data/Community_Common.bcd'], '3' * 64)
        for p in CAM_PATHS:
            self.assertEqual(files[p], release['cam']['sha256'])
        old_recipe, new_recipe = (json.loads(raw) for raw in (inputs[BINDINGS[1]], result[BINDINGS[1]]))
        self.assertEqual(new_recipe['games']['majesty'], old_recipe['games']['majesty'])
        patches = new_recipe['games']['majesty-community-guilds-v1']['patches']
        self.assertEqual(patches[-1], old_recipe['games']['majesty-community-guilds-v1']['patches'][-1])
        for patch in patches[:2]:
            self.assertEqual(patch['bytes'], 80)
            self.assertIn('/' + release['assetCommit'] + '/', patch['url'])

    def test_keeps_older_updater_history_and_accepts_the_current_live_art(self):
        inputs, release = self.fixture()
        result = prepare_bindings(inputs, release)
        prior = object_literal(result[BINDINGS[2]].decode(), 'PREVIOUS')[1]
        for p in CAM_PATHS:
            self.assertEqual(prior[p], ['4' * 64, release['sourceCam']['sha256']])

    def test_unknown_binding_is_refused_before_output(self):
        inputs, release = self.fixture()
        inputs[BINDINGS[0]] += b'// customized'
        with self.assertRaisesRegex(ValueError, 'binding changed'):
            prepare_bindings(inputs, release)

    def test_missing_previous_live_version_and_wrong_scale_are_refused(self):
        for key, value in [('previousCamHashes', []), ('percent', 78)]:
            inputs, release = self.fixture()
            release[key] = value
            with self.assertRaisesRegex(ValueError, 'Invalid source-bound'):
                prepare_bindings(inputs, release)

    def test_install_requires_native_qualification_and_preserves_startup(self):
        inputs, release = self.fixture()
        result = prepare_bindings(inputs, release)
        release.update(format='majesty-bards-world-scale-release-v1',
                       bindings={n: digest(b) for n, b in result.items()})
        proof = dict(format='majesty-bards-world-scale-qualification-v1', percent=70,
                     sourceCam=release['sourceCam'], cam=release['cam'], sourcePolicies={})
        flags = ('onlyBardsWorldArtChanged', 'originalTileSlotsPreserved', 'sidebarArtPreserved',
                 'nativePlacementQualified', 'nativeUpgradeChainQualified', 'existingSaveQualified',
                 'freshReloadQualified', 'ownedBrowsersClosed')
        proof.update({k: True for k in flags})
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'deploy').mkdir()
            static = root / 'output/static'
            for name, raw in inputs.items():
                p = static / name
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_bytes(raw)
            (static / 'index.html').write_bytes(b'centered native player')
            for qualified in (False, True):
                proof['freshReloadQualified'] = qualified
                proof_raw = json.dumps(proof).encode()
                (root / 'deploy/bards-world-scale-verification.json').write_bytes(proof_raw)
                release['qualification'] = digest(proof_raw)
                (root / 'deploy/bards-world-scale-release.json').write_text(json.dumps(release))
                if not qualified:
                    with self.assertRaisesRegex(ValueError, 'completed Bards'):
                        install(root, root / 'output')
                    self.assertEqual({n: (static / n).read_bytes() for n in BINDINGS}, inputs)
                else:
                    install(root, root / 'output')
                    self.assertEqual({n: (static / n).read_bytes() for n in BINDINGS}, result)
            self.assertEqual((static / 'index.html').read_bytes(), b'centered native player')


if __name__ == '__main__':
    unittest.main()

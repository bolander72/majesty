import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('wayfinder_site', ROOT / 'scripts/prepare-wayfinder-browser-site.py')
SITE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SITE)


class BrowserSiteTests(unittest.TestCase):
    def test_changed_template_refused_instead_of_partial_integration(self):
        with self.assertRaisesRegex(ValueError, 'template changed'):
            SITE.edition_player('unrecognized player')
        with self.assertRaisesRegex(ValueError, 'template changed'):
            SITE.replace_once('same same', 'same', 'new')

    def test_edition_changes_data_path_but_keeps_profile_root(self):
        template = '\n'.join(['const id = await gameId();',
            'for (const p of [id, "game"])',
            'const exe = `/opfs/${id}/game/${game.executable}`;',
            'm.ENV.RECOMP_PROFILE_DIR = `/opfs/${id}/profile/${profile}`;',
            ': start()).catch(handler);'])
        result = SITE.edition_player(template)
        self.assertIn('for (const p of [dataId, "game"])', result)
        self.assertIn('`/opfs/${dataId}/game/${game.executable}`', result)
        self.assertIn('m.ENV.RECOMP_PROFILE_DIR = `/opfs/${id}/profile/${profile}`;', result)
        self.assertIn('startEditionPlayer(start)', result)

    def test_original_launcher_route_remains_the_fallback(self):
        result = SITE.edition_launcher('const url = new URL(`${game.id}/`, location.href);')
        self.assertIn('game.playURL || `${game.id}/`', result)


if __name__ == '__main__':
    unittest.main()

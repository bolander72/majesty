from pathlib import Path
import runpy
import tempfile
import unittest

POLICY = runpy.run_path(str(Path(__file__).resolve().parents[1] /
                           'scripts/lib/single_player_release.py'))


def legacy_player():
    return '''<script>
"use strict";
const networkDebug = false;
function reportNetwork(t) { network(); }
async function start() {
  if (multiplayerProfile !== null && id !== "majesty") throw Error("Multiplayer");
  const fresh = multiplayerProfile !== null || frontierProfilePath !== null;
      const profile = multiplayerProfile !== null ? multiplayerProfile : (new URLSearchParams(location.search).get("profile") || "");
      m.ENV.RECOMP_NETWORK_URL = new URLSearchParams(location.search).get("relay") ||
        "wss://example.test/rooms";
      m.ENV.RECOMP_NETWORK_MANIFEST = contentIdentity.session;
      const extra = new URLSearchParams(location.search);
      if (multiplayerProfile !== null)
        m.ENV.RECOMP_PROFILE_DIR = "shared";
      reportNetwork(t);
}
let multiplayerProfile = null;
([...new URLSearchParams(location.search)].some(([key]) => ["room"].includes(key))
  ? import("../multiplayer/profile-session.mjs").then(() => start())
  : new URLSearchParams(location.search).has("world")
    ? import("../world/realm-session.mjs") : import("../content/edition-session.mjs"));
</script>
<script type="module" src="../multiplayer/session.mjs"></script>
<script type="module" src="../campaign/session.mjs"></script>
<script type="module" src="../world/native.mjs"></script>
'''


class SinglePlayerReleaseTests(unittest.TestCase):
    def test_player_has_solo_startup_without_network_assignment_or_shared_import(self):
        html = POLICY['player_html'](legacy_player())
        for removed in ['multiplayerProfile', '../multiplayer/', '../campaign/',
                        'm.ENV.RECOMP_NETWORK_URL =', 'm.ENV.RECOMP_NETWORK_MANIFEST =',
                        'reportNetwork(']:
            self.assertNotIn(removed, html)
        for retained in ['../world/realm-session.mjs', '../world/native.mjs',
                         '../content/edition-session.mjs', 'get("profile")',
                         'majestySinglePlayerSearch(location.search)',
                         'm.ENV.RECOMP_SINGLE_PLAYER_ONLY = "1"']:
            self.assertIn(retained, html)

    def test_unknown_template_refuses_instead_of_leaving_shared_startup(self):
        with self.assertRaises(ValueError):
            POLICY['player_html']('<script>different startup()</script>')

    def test_packaging_removes_only_shared_launchers_and_their_setup_links(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for name in ['majesty', 'multiplayer', 'campaign', 'world', 'backups']:
                (root / name).mkdir()
                (root / name / 'preserved.txt').write_text(name)
            for name in ['index.html', 'majesty/index.html']:
                (root / name).write_text(legacy_player())
            (root / 'setup.html').write_text('<p><a href="campaign/">Campaign</a></p>\n'
                '<p><a href="multiplayer/">Multiplayer</a></p>\n'
                '<p><a href="backups/">Backups</a></p>')
            POLICY['install'](root)
            self.assertFalse((root / 'multiplayer').exists())
            self.assertFalse((root / 'campaign').exists())
            self.assertEqual((root / 'world/preserved.txt').read_text(), 'world')
            self.assertEqual((root / 'backups/preserved.txt').read_text(), 'backups')
            self.assertEqual((root / 'setup.html').read_text(), '<p><a href="backups/">Backups</a></p>')

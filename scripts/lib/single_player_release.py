"""Remove shared-session entry points from the served single-player collection."""
import re
import shutil


def player_html(html):
    """Transform the qualified legacy player without changing solo world startup."""
    begin = '([...new URLSearchParams(location.search)].some(([key]) =>'
    end = ': new URLSearchParams(location.search).has("world")'
    if html.count(begin) != 1 or html.count(end) != 1:
        raise ValueError('Review the legacy shared-session startup boundary')
    start = html.index(begin)
    finish = html.index(end, start) + len(end)
    html = html[:start] + '(new URLSearchParams(location.search).has("world")' + html[finish:]
    html = re.sub(r'multiplayerProfile !== null \? multiplayerProfile :\s*', '', html)
    html = html.replace('multiplayerProfile !== null || ', '')
    html = html.replace('let multiplayerProfile = null;\n', '')
    html = re.sub(r'^  if \(multiplayerProfile !== null && id !== "majesty"\).*\n', '', html, flags=re.M)
    html = re.sub(r'^      if \(multiplayerProfile !== null\)\n        m\.ENV\.RECOMP_PROFILE_DIR = .*\n', '', html, flags=re.M)
    html = re.sub(r'^      m\.ENV\.RECOMP_NETWORK_URL = .*\n        .*\n', '', html, flags=re.M)
    html = re.sub(r'^      m\.ENV\.RECOMP_NETWORK_MANIFEST = .*\n', '', html, flags=re.M)
    html = re.sub(r'const networkDebug = .*?\nasync function start\(\)',
                  'async function start()', html, flags=re.S)
    html = html.replace('      reportNetwork(t);\n', '')
    html = re.sub(r'  if \(networkDiagnosticsDirty\) \{.*?'
                  r'details\.querySelector\("pre"\)\.textContent = log\.filter[^\n]*\n  \}\n',
                  '', html, flags=re.S)
    html = html.replace(', networkDiagnosticsDirty = false', '')
    html = re.sub(r'<script type="module" src="\.\./(?:campaign|multiplayer)/[^"\n]+"></script>\n?', '', html)
    html = html.replace("this engine's multiplayer identity", "this engine's identity")
    html = html.replace('networkManifest', 'contentManifest')
    html = html.replace(' && k !== "RECOMP_NETWORK_MANIFEST"', '')
    if 'multiplayerProfile' in html or 'import("../multiplayer/' in html:
        raise ValueError('Shared-session startup still reachable')
    html = html.replace('location.search', 'playerSearch')
    anchor = '<script>\n"use strict";'
    if html.count(anchor) != 1:
        raise ValueError('Review the original player script boundary')
    html = html.replace(anchor, '''<script src="../hosting/single-player.js"></script>
<script>
"use strict";
const playerSearch = majestySinglePlayerSearch(location.search);
if (playerSearch !== location.search) {
  const soloURL = new URL(location.href);
  soloURL.search = playerSearch;
  history.replaceState(history.state, "", soloURL);
}''', 1)
    anchor = '      const extra = new URLSearchParams(playerSearch);'
    if html.count(anchor) != 1:
        raise ValueError('Review the original runtime environment boundary')
    html = html.replace(anchor, '      m.ENV.RECOMP_SINGLE_PLAYER_ONLY = "1";\n' + anchor, 1)
    return html


def install(static):
    """Retain archived sources and saved data; publish only solo entry points."""
    for name in ('index.html', 'majesty/index.html'):
        path = static / name
        path.write_text(player_html(path.read_text()))
    setup = static / 'setup.html'
    html = setup.read_text()
    html = re.sub(r'<p><a href="(?:campaign|multiplayer)/">[^<]*</a></p>\n?', '', html)
    setup.write_text(html)
    for name in ('campaign', 'multiplayer'):
        path = static / name
        if path.exists():
            shutil.rmtree(path)

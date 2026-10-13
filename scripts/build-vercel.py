#!/usr/bin/env python3
"""Materialize a qualified hosted engine for Git builds, then mount its player at /."""
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def trusted_asset_url(value, legacy_prefix):
    return (value.startswith(legacy_prefix) or re.fullmatch(
        r'https://raw\.githubusercontent\.com/bolander72/majesty/[a-f0-9]{40}/assets/[A-Za-z0-9_./-]+', value)) and not any(
        c in value for c in ['?', '#', '@'])


def install_automatic_assets(static):
    descriptor = ROOT / 'deploy/automatic-assets.json'
    if not descriptor.exists():
        return
    assets = json.loads(descriptor.read_text())
    target = static / 'hosting/automatic-assets.json'
    existing = json.loads(target.read_text())
    if (assets.get('format') != existing.get('format') or
            set(assets.get('games', {})) != {'majesty', 'majesty-wayfinder'}):
        raise ValueError('Invalid automatic asset manifest')
    base = assets['games']['majesty']
    original = existing['games']['majesty']
    parts = base.get('parts', [])
    if (base.get('bytes') != original['bytes'] or base.get('sha256') != original['sha256']
            or 'url' in base or not isinstance(parts, list) or not 1 <= len(parts) <= 64):
        raise ValueError('Require the unchanged original game archive')
    seen, total = set(), 0
    for part in parts:
        if (type(part.get('bytes')) is not int or not 0 < part['bytes'] <= 50 * 1024 * 1024
                or not isinstance(part.get('sha256'), str) or not re.fullmatch('[a-f0-9]{64}', part['sha256'])
                or not trusted_asset_url(part.get('url', ''), 'https://unused.invalid/')
                or part['url'] in seen):
            raise ValueError('Invalid GitHub game archive part')
        seen.add(part['url']); total += part['bytes']
    if total != base['bytes']:
        raise ValueError('Incomplete GitHub game archive')
    wayfinder = assets['games']['majesty-wayfinder']
    expected = {p['path']: (p['sha256'], p['bytes']) for p in existing['games']['majesty-wayfinder']['patches']}
    patches = wayfinder.get('patches', [])
    if (wayfinder.get('baseId') != 'majesty' or len(patches) != len(expected)
            or len({p['path'] for p in patches}) != len(expected)):
        raise ValueError('Missing Wayfinder resources')
    for patch in patches:
        if (expected.get(patch['path']) != (patch.get('sha256'), patch.get('bytes'))
                or not trusted_asset_url(patch.get('url', ''), 'https://unused.invalid/')):
            raise ValueError('Changed Wayfinder resources')
    existing['games'].update(assets['games'])
    target.write_text(json.dumps(existing, indent=2) + '\n')


def install_content_release(static):
    descriptor = ROOT / 'deploy/content-release.json'
    if not descriptor.exists():
        return
    content = json.loads(descriptor.read_text())
    if content.get('retired') is True:
        return
    engine = json.loads((ROOT / 'deploy/hosted-release.json').read_text())['engineSha256']
    if (content.get('format') != 'majesty-lost-trail-content-release-v1'
            or content.get('engineSha256') != engine
            or content.get('storageId') != 'majesty-lost-trail'
            or content.get('baseId') != 'majesty'
            or content.get('canonicalGuid') != '{8BC7C549-E5A2-4D0F-A726-83B16BF19E42}'
            or content.get('requiredRuntimeEnvironment') != {'RECOMP_RULE_INVENTORY_COMPAT': '1'}
            or any(content.get(key) is not True for key in [
                'browserSelectionWorldSaveReloadQualified', 'rootDefaultIntegrationQualified',
                'nativeOrdinaryVictoryQualified'])):
        raise ValueError('Require the browser-qualified Lost Trail content release')
    if set(content.get('sourceSha256', {})) != {'TheLostTrail.gpl', 'TheLostTrail.gplproj'}:
        raise ValueError('Require the original compiler source bindings')
    for name, expected in content['sourceSha256'].items():
        if hashlib.sha256((ROOT / 'content/the-lost-trail' / name).read_bytes()).hexdigest() != expected:
            raise ValueError('Published content differs from the authored mission source')
    bindings = dict(re.findall(r"'([^']+)': '([a-f0-9]{64})'",
        (ROOT / 'web/content/lost-trail-files.mjs').read_text().split('export const LOST_TRAIL_REPLACEMENTS')[0]))
    patches = content.get('patches', [])
    if len(patches) != len(bindings) or len({p['path'] for p in patches}) != len(bindings):
        raise ValueError('Missing or duplicate published content resources')
    for patch in patches:
        if (patch['path'] not in bindings or patch.get('sha256') != bindings[patch['path']]
                or not isinstance(patch.get('bytes'), int) or not 0 < patch['bytes'] <= 1024 * 1024
                or not trusted_asset_url(patch.get('url', ''),
                    'https://gzyxvhfrxfzxgeae.public.blob.vercel-storage.com/majesty/content/lost-trail-v1/')):
            raise ValueError('Published resource differs from the qualified browser bindings')
    assets_file = static / 'hosting/automatic-assets.json'
    assets = json.loads(assets_file.read_text())
    assets['games']['majesty-lost-trail'] = {'baseId': 'majesty', 'patches': patches}
    assets_file.write_text(json.dumps(assets, indent=2) + '\n')
    games_file = static / 'games.json'
    games = json.loads(games_file.read_text())
    original = next(game for game in games if game['id'] == 'majesty')
    if any(game['id'] == 'majesty-lost-trail' for game in games):
        raise ValueError('Review the existing content collection before replacing it')
    games.append({**original, 'id': 'majesty-lost-trail', 'title': 'Majesty: The Lost Trail',
        'playURL': '?edition=lost-trail-v1&profile=lost-trail&RECOMP_RULE_INVENTORY_COMPAT=1'})
    original['defaultContentStorageId'] = 'majesty-lost-trail'
    games_file.write_text(json.dumps(games, indent=2) + '\n')


def install_content_v2_release(static):
    """Add qualified v2 data without replacing the original or v1 collections."""
    descriptor = ROOT / 'deploy/content-v2-release.json'
    if not descriptor.exists():
        return
    content = json.loads(descriptor.read_text())
    if content.get('retired') is True:
        return
    engine = json.loads((ROOT / 'deploy/hosted-release.json').read_text())['engineSha256']
    required = ['nativeAbilitiesQualified', 'browserSaveReloadQualified',
                'browserPaidRecruitmentQualified', 'rootDefaultIntegrationQualified']
    if (content.get('format') != 'majesty-lost-trail-content-release-v2'
            or content.get('engineSha256') != engine
            or content.get('storageId') != 'majesty-lost-trail-v2'
            or content.get('baseId') != 'majesty'
            or content.get('canonicalGuid') != '{8BC7C549-E5A2-4D0F-A726-83B16BF19E42}'
            or content.get('requiredRuntimeEnvironment') != {'RECOMP_RULE_INVENTORY_COMPAT': '1'}
            or any(content.get(key) is not True for key in required)):
        raise ValueError('Require the gameplay-qualified v2 release')
    source = ROOT / 'content/wayfinder-trail-lodge/v2'
    if set(content.get('sourceSha256', {})) != {'Wayfinder.gpl', 'Wayfinder_Support.dat', 'spec.json'}:
        raise ValueError('Require complete v2 compiler source bindings')
    for name, expected in content['sourceSha256'].items():
        if hashlib.sha256((source / name).read_bytes()).hexdigest() != expected:
            raise ValueError('Published v2 source differs from qualified inputs')
    bindings = dict(re.findall(r'''["']([^"']+)["']\s*:\s*["']([a-f0-9]{64})["']''',
        (ROOT / 'web/content/lost-trail-v2-files.mjs').read_text()))
    patches = content.get('patches', [])
    if (len(bindings) != 13 or len(patches) != len(bindings)
            or {p.get('path') for p in patches} != set(bindings)):
        raise ValueError('Require the complete v2 resource set')
    for patch in patches:
        if (patch.get('sha256') != bindings[patch['path']]
                or type(patch.get('bytes')) is not int or not 0 < patch['bytes'] <= 1024 * 1024
                or not trusted_asset_url(patch.get('url', ''), 'https://unused.invalid/')):
            raise ValueError('Changed or unpinned v2 resource')
    assets_file = static / 'hosting/automatic-assets.json'
    assets = json.loads(assets_file.read_text())
    assets['games']['majesty-lost-trail-v2'] = {'baseId': 'majesty', 'patches': patches}
    assets_file.write_text(json.dumps(assets, indent=2) + '\n')
    games_file = static / 'games.json'
    games = json.loads(games_file.read_text())
    original = next(game for game in games if game['id'] == 'majesty')
    if any(game['id'] == 'majesty-lost-trail-v2' for game in games):
        raise ValueError('Review existing v2 collection before replacement')
    games.append({**original, 'id': 'majesty-lost-trail-v2', 'title': 'Majesty: The Lost Trail',
        'playURL': '?edition=lost-trail-v2&profile=lost-trail-v2&RECOMP_RULE_INVENTORY_COMPAT=1'})
    original['defaultContentStorageId'] = 'majesty-lost-trail-v2'
    games_file.write_text(json.dumps(games, indent=2) + '\n')


def retire_custom_content(static):
    """Remove retired content from live catalogs, preserving archived sources."""
    retired = {'majesty-wayfinder', 'majesty-lost-trail', 'majesty-lost-trail-v2'}
    games_file = static / 'games.json'
    games = json.loads(games_file.read_text())
    active = []
    for game in games:
        if game['id'] in retired: continue
        if game['id'] == 'majesty':
            game.pop('defaultContentStorageId', None)
            game.pop('contentStorageId', None)
        active.append(game)
    games_file.write_text(json.dumps(active, indent=2) + '\n')
    assets_file = static / 'hosting/automatic-assets.json'
    assets = json.loads(assets_file.read_text())
    for key in retired: assets['games'].pop(key, None)
    assets_file.write_text(json.dumps(assets, indent=2) + '\n')


def unpack_release(data, release, destination):
    if len(data) != release['bytes'] or hashlib.sha256(data).hexdigest() != release['sha256']:
        raise ValueError('Hosted release download failed integrity verification')
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
        members = archive.getmembers()
        if len(members) != len(release['files']):
            raise ValueError('Unexpected release file count')
        seen = set()
        for member in members:
            path = PurePosixPath(member.name)
            record = release['files'].get(member.name)
            if (not member.isfile() or path.is_absolute() or '..' in path.parts or
                    member.name in seen or record is None or member.size != record['bytes'] or
                    member.size > 24 * 1024 * 1024):
                raise ValueError('Unsafe or unexpected release entry')
            seen.add(member.name)
            content = archive.extractfile(member).read()
            if hashlib.sha256(content).hexdigest() != record['sha256']:
                raise ValueError('Release file failed integrity verification')
            target = destination / member.name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)


def root_player(html, versions=None, artwork=None):
    # Deep links also receive the favicon during packaging; emit it once at root.
    html = html.replace('<link rel="icon" href="/hosting/favicon.svg" type="image/svg+xml">', '')
    replacements = {
        '<head>': ('<head>\n<base href="/majesty/">\n'
                  '<link rel="icon" href="/hosting/favicon.svg" type="image/svg+xml">\n'
                  '<link rel="preload" href="/majesty/MajestyRecomp.wasm" as="fetch" crossorigin>\n'
                  '<link rel="preload" href="/majesty/MajestyRecomp.data" as="fetch" crossorigin>\n'
                  '<link rel="preload" href="/majesty/MajestyRecomp.js" as="script">\n'
                  + '\n'.join(f'<link rel="modulepreload" href="/{name}">' for name in [
                      'hosting/root-player.mjs', 'hosting/launcher-client.mjs',
                      'hosting/automatic-assets.mjs', 'hosting/derived-assets.mjs', 'hosting/asset-url.mjs',
                      'hosting/content-cache.mjs', 'hosting/audio-start.mjs',
                      'hosting/menu-text.mjs',
                      'world/sha256.mjs', 'world/content-hash.mjs',
                      'content/edition-session.mjs', 'content/lost-trail-files.mjs', 'backups/storage.mjs',
                  ]) + '\n<link rel="preload" href="/games.json" as="fetch" crossorigin>'),
        'parts[parts.length - 1] || ""': 'parts[parts.length - 1] || "majesty"',
        '([...new URLSearchParams(location.search)].some(([key]) =>':
            '''const rootController = new AbortController();
addEventListener("pagehide", () => rootController.abort(), {once: true});
const rootPreparation = location.pathname === "/"
  ? import("../hosting/root-player.mjs").then(({prepareRootPlayer}) =>
      prepareRootPlayer({signal: rootController.signal}))
  : Promise.resolve();
let preparedRootGames;
rootPreparation.then(games => { preparedRootGames = games; return ([...new URLSearchParams(location.search)].some(([key]) =>''',
        'startEditionPlayer(start))).catch((e)': 'startEditionPlayer(start))); }).catch((e)',
        'const games = await fetch("../games.json", {signal}).then((r) => r.json());':
            'const games = preparedRootGames || await fetch("../games.json", {signal}).then((r) => r.json());',
        'const dataId = edition ? edition.storageId : id;':
            'const dataId = edition ? edition.storageId : (preparedRootGames?.find(g => g.id === id)?.contentStorageId || id);',
        '  window.Module = Module;':
            '  const {installGameAudio} = await import("../hosting/audio-start.mjs");\n'
            '  installGameAudio(Module);\n  window.Module = Module;',
        '  const heroRestoreReceipt = prepareHeroRestore ?':
            '''  const displayProfile = multiplayerProfile !== null ? multiplayerProfile :
    (new URLSearchParams(location.search).get("profile") || "");
  if (displayProfile && !/^[a-zA-Z0-9_-]{1,40}$/.test(displayProfile)) throw Error("Invalid player profile name");
  const displayProfilePath = `${id}/profile` + (frontierProfilePath ? `/${frontierProfilePath}` :
    (displayProfile ? `/${displayProfile}` : ""));
  const {removeMenuTextShadows} = await import("../hosting/menu-text.mjs");
  await removeMenuTextShadows({profilePath: displayProfilePath, signal});
  const heroRestoreReceipt = prepareHeroRestore ?''',
    }
    for old, new in replacements.items():
        if html.count(old) != 1:
            raise ValueError('Qualified player template changed; review the root mount')
        html = html.replace(old, new, 1)
    if versions:
        for filename, version in versions.items():
            html = html.replace(f'href="/majesty/{filename}"', f'href="/majesty/{filename}?v={version}"')
        html = html.replace('script.src = "MajestyRecomp.js";',
                            f'script.src = "MajestyRecomp.js?v={versions["MajestyRecomp.js"]}";')
        html = html.replace('    canvas,', '    canvas,\n    locateFile: filename => {\n'
            f'      const versions = {json.dumps(versions)};\n'
            '      return "/majesty/" + filename + (versions[filename] ? "?v=" + versions[filename] : "");\n'
            '    },', 1)
    if artwork:
        url = '/hosting/original-loading.jpg?v=' + artwork['sha256']
        html = html.replace('</head>',
            f'<link rel="preload" href="{url}" as="image" fetchpriority="high">\n</head>', 1)
        html = html.replace('<body>', '<body>\n'
            '<div id="startup-art" role="status" aria-label="Loading Majesty">'
            f'<img src="{url}" width="800" height="600" alt="Majesty original loading artwork" fetchpriority="high">'
            '</div>', 1)
        html = html.replace('</style>', '''  #startup-art { position: fixed; inset: 0; z-index: 1;
    display: grid; place-items: center; background: #000; pointer-events: none; }
  #startup-art img { display: block; width: min(800px, 100vw);
    height: min(600px, 100dvh); object-fit: contain; }
  body[data-game-ready] #startup-art,
  body:has(#status:not([hidden])) #startup-art { display: none; }
</style>''', 1)
        html = html.replace('document.body.dataset.gameReady = "true";',
            'document.body.dataset.gameReady = "true";\n'
            '      document.getElementById("startup-art")?.remove();\n'
            '      canvas.focus({preventScroll: true});\n'
            '      performance.mark("majesty-menu-ready");', 1)
    return html


def build(destination=None):
    release = json.loads((ROOT / 'deploy/hosted-release.json').read_text())
    url = release['url']
    if not trusted_asset_url(url, 'https://gzyxvhfrxfzxgeae.public.blob.vercel-storage.com/majesty/releases/'):
        raise ValueError('Unrecognized release origin')
    if not 0 < release['bytes'] <= 32 * 1024 * 1024:
        raise ValueError('Oversized hosted release')
    destination = destination or ROOT / '.vercel/output'
    if destination.exists():
        shutil.rmtree(destination)
    with urllib.request.urlopen(url, timeout=60) as response:
        data = response.read(release['bytes'] + 1)
    unpack_release(data, release, destination)
    static = destination / 'static'
    # Authored frontend changes are built from Git. The qualified engine remains pinned.
    for source in (ROOT / 'web').rglob('*'):
        if source.is_file():
            target = static / source.relative_to(ROOT / 'web')
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
    install_content_release(static)
    # Keep the engine archive unchanged; override its old download locations
    # with the authored, integrity-pinned GitHub distribution manifest.
    install_automatic_assets(static)
    install_content_v2_release(static)
    retire_custom_content(static)
    for page in static.rglob('index.html'):
        text = page.read_text()
        if '<head>' in text and 'rel="icon"' not in text:
            page.write_text(text.replace('<head>', '<head>\n<link rel="icon" href="/hosting/favicon.svg" type="image/svg+xml">', 1))
    shutil.copyfile(static / 'index.html', static / 'setup.html')
    versions = {name: release['files']['static/majesty/' + name]['sha256']
                for name in ['MajestyRecomp.js', 'MajestyRecomp.data']}
    versions['MajestyRecomp.wasm'] = release['engineSha256']
    artwork = json.loads((ROOT / 'deploy/loading-art.json').read_text())
    if (not trusted_asset_url(artwork['url'], 'https://gzyxvhfrxfzxgeae.public.blob.vercel-storage.com/majesty/presentation/')
            or not 0 < artwork['bytes'] <= 1024 * 1024):
        raise ValueError('Invalid original loading artwork')
    with urllib.request.urlopen(artwork['url'], timeout=30) as response:
        data = response.read(artwork['bytes'] + 1)
    if len(data) != artwork['bytes'] or hashlib.sha256(data).hexdigest() != artwork['sha256']:
        raise ValueError('Original loading artwork failed integrity verification')
    (static / 'hosting/original-loading.jpg').write_bytes(data)
    (static / 'index.html').write_text(root_player((static / 'majesty/index.html').read_text(), versions, artwork))
    worker = static / 'worker.js'
    worker_html = worker.read_text()
    old = 'async status({ game }) {'
    if worker_html.count(old) != 1:
        raise ValueError('Review the launcher worker status template')
    worker_html = worker_html.replace(old, 'async status({ game, brief = false }) {', 1)
    old = 'const status = await gameStatus(game, opfsStore(root));'
    if worker_html.count(old) != 1:
        raise ValueError('Review the launcher worker status result')
    worker.write_text(worker_html.replace(old, old + '\n    if (brief) return { status };', 1))
    config_file = destination / 'config.json'
    config = json.loads(config_file.read_text())
    root_index = next(i for i, route in enumerate(config['routes']) if route.get('src') == '/')
    config['routes'].insert(root_index, {'src': '/',
        'has': [{'type': 'query', 'key': 'setup', 'value': '1'}], 'dest': '/setup.html'})
    for name, version in versions.items():
        route = {'src': '/majesty/' + name.replace('.', r'\.'),
            'has': [{'type': 'query', 'key': 'v', 'value': version}],
            'headers': {'Cache-Control': 'public, max-age=31536000, immutable'}}
        if name.endswith('.wasm'):
            route['dest'] = '/majesty/' + name + '.br'
            route['headers'].update({'Content-Type': 'application/wasm', 'Content-Encoding': 'br'})
        else:
            route['continue'] = True
        config['routes'].insert(1, route)
    config['routes'].insert(1, {'src': '/hosting/original-loading\\.jpg',
        'has': [{'type': 'query', 'key': 'v', 'value': artwork['sha256']}],
        'headers': {'Cache-Control': 'public, max-age=31536000, immutable'}, 'continue': True})
    config_file.write_text(json.dumps(config, indent=2) + '\n')
    print(f"Built {release['release']} for / with the pinned native engine")


if __name__ == '__main__':
    build()

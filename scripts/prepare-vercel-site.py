#!/usr/bin/env python3
"""Prepare an asset-free Vercel Build Output from a pinned local frontend."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
WASM = 'majesty/MajestyRecomp.wasm'
ISOLATION = {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Cache-Control': 'no-cache',
}


def sha(path):
    if getattr(path.stat(), 'st_flags', 0) & 0x40000000:
        raise ValueError(f'Cloud-evicted source: {path.name}')
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def fast_content_hashing(html):
    start = html.index('  // Stream compatibility hashing off the UI thread; preserve the exact digest.')
    end = html.index('  const digest = async values =>', start)
    if html[start:end].count('await contentHasher.hash(file)') != 1:
        raise ValueError('Review the compatibility hashing template')
    replacement = '''  const {cachedFileHashes} = await import("../hosting/content-cache.mjs");
  const fresh = multiplayerProfile !== null || frontierProfilePath !== null ||
    prepareHeroRestore !== null || rules.some(([key]) => key !== "RECOMP_RULE_INVENTORY_COMPAT");
  const hashes = await cachedFileHashes(files, cacheKey, {signal, fresh});
  for (const value of hashes) entries.push(value);
  signal?.throwIfAborted();
'''
    html = html[:start] + replacement + html[end:]
    old = 'async function networkManifest(dir, game, signal) {'
    if html.count(old) != 1:
        raise ValueError('Review the content identity signature')
    html = html.replace(old, 'async function networkManifest(dir, game, signal, cacheKey) {', 1)
    old = 'const contentIdentity = await networkManifest(dir, game, signal);'
    if html.count(old) != 1:
        raise ValueError('Review content edition startup')
    return html.replace(old, 'const contentIdentity = await networkManifest(dir, game, signal, dataId);', 1)


def prepare(receipt, output, automatic_assets=None):
    if output.exists():
        raise ValueError('Preserve existing deployments; choose a new output directory')
    package = json.loads(receipt.read_text())
    source = Path(package['site'])
    if not package.get('privateSitePrepared') or sha(source / WASM) != package['engineSha256']:
        raise ValueError('Require a pinned prepared browser engine')
    for name, record in package['files'].items():
        path = Path(name)
        if path.is_absolute() or '..' in path.parts:
            raise ValueError('Unsafe source package path')
        if sha(source / name) != record['sha256'] or (source / name).stat().st_size != record['bytes']:
            raise ValueError(f'Changed package file: {name}')
        if path.suffix.lower() in {'.exe', '.zip', '.gmp', '.bcd', '.cam'}:
            raise ValueError('Purchased game data or personal saves must not be deployed')
    static = output / '.vercel/output/static'
    static.mkdir(parents=True)
    for name in package['files']:
        if name == WASM or any(part.startswith('trace327-') for part in Path(name).parts):
            continue
        target = static / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source / name, target)
    root = static / 'index.html'
    html = root.read_text().replace('<h1>Recomp games</h1>', '<h1>Majesty</h1>')
    html = html.replace('<script type="module" src="app.js"></script>',
                        '<script type="module" src="hosting/boot.mjs"></script>')
    html = html.replace('<body>', '<body>\n' + (ROOT / 'web/hosting/boot.html').read_text(), 1)
    preloads = ('<link rel="preload" href="/majesty/MajestyRecomp.wasm" as="fetch" crossorigin>\n'
                '<link rel="preload" href="/majesty/MajestyRecomp.data" as="fetch" crossorigin>\n'
                '<link rel="preload" href="/majesty/MajestyRecomp.js" as="script">\n')
    html = html.replace('</head>', preloads + '</head>', 1)
    html = html.replace('</head>', '<script>if(new URLSearchParams(location.search).get("setup")==="1")'
                        'document.documentElement.dataset.setup="true";</script>\n</head>', 1)
    root.write_text(html)
    (static / 'hosting').mkdir(exist_ok=True)
    shutil.copyfile(ROOT / 'web/hosting/autoload.mjs', static / 'hosting/autoload.mjs')
    shutil.copyfile(ROOT / 'web/hosting/boot.mjs', static / 'hosting/boot.mjs')
    shutil.copyfile(ROOT / 'web/hosting/automatic-assets.mjs', static / 'hosting/automatic-assets.mjs')
    shutil.copyfile(ROOT / 'web/hosting/derived-assets.mjs', static / 'hosting/derived-assets.mjs')
    shutil.copyfile(ROOT / 'web/hosting/content-cache.mjs', static / 'hosting/content-cache.mjs')
    shutil.copyfile(ROOT / 'web/hosting/launcher-client.mjs', static / 'hosting/launcher-client.mjs')
    for obsolete in ['home-menu.mjs', 'home-menu.webp']:
        (static / 'hosting' / obsolete).unlink(missing_ok=True)
    if automatic_assets:
        assets = json.loads(automatic_assets.read_text())
        if assets.get('format') != 'majesty-automatic-assets-v1':
            raise ValueError('Invalid automatic asset manifest')
        (static / 'hosting/automatic-assets.json').write_text(json.dumps(assets, indent=2) + '\n')
    player = static / 'majesty/index.html'
    html = player.read_text()
    if html.count('a.href = "../";') != 1:
        raise ValueError('Review the player recovery link before deployment')
    html = html.replace('a.href = "../";', 'a.href = "../?setup=1";')
    old_exit = 'if (exit && Number(exit[1]) !== 0) showFailure(`guest exited with code ${exit[1]}`);'
    if html.count(old_exit) != 1:
        raise ValueError('Review native Exit Game handling before deployment')
    html = html.replace(old_exit,
        'if (exit) {\n'
        '        if (Number(exit[1]) === 0) location.replace("https://boland.co");\n'
        '        else showFailure(`guest exited with code ${exit[1]}`);\n'
        '      }', 1)
    # Keep startup progress quiet; retain fatal and multiplayer error recovery.
    expected = {'<div id="status">Loading…</div>': '<div id="status" hidden></div>',
                'status("Checking game files for multiplayer compatibility…");': 'status("");',
                'setStatus: (t) => status(t ? t : ""),': 'setStatus: () => {},'}
    for old, new in expected.items():
        if html.count(old) != 1:
            raise ValueError('Review the player startup template before deployment')
        html = html.replace(old, new, 1)
    html = html.replace('  #status {', '  #canvas { visibility: hidden; }\n'
                        '  body[data-game-ready] #canvas { visibility: visible; }\n'
                        '  [hidden] { display: none !important; }\n  #status {', 1)
    html = html.replace('function rememberLog(t) {', 'function rememberLog(t) {\n'
                        '  if (t === "[player] menu ready") requestAnimationFrame(() =>\n'
                        '    requestAnimationFrame(() => { document.body.dataset.gameReady = "true"; }));', 1)
    player.write_text(fast_content_hashing(html))
    compressed = static / (WASM + '.br')
    script = '''const fs=require('fs'),z=require('zlib'),c=require('crypto');
const input=fs.readFileSync(process.argv[1]);
const compressed=z.brotliCompressSync(input,{params:{[z.constants.BROTLI_PARAM_QUALITY]:5}});
if(!z.brotliDecompressSync(compressed).equals(input))throw Error('Compressed engine differs');
fs.writeFileSync(process.argv[2],compressed);
console.log(JSON.stringify({wasmBytes:input.length,compressedBytes:compressed.length,sha256:c.createHash('sha256').update(input).digest('hex')}));'''
    result = subprocess.run(['node', '-e', script, str(source / WASM), str(compressed)],
                            capture_output=True, text=True, check=True)
    compression = json.loads(result.stdout)
    if compression['sha256'] != package['engineSha256']:
        raise ValueError('Compressed engine identity differs')
    routes = [dict(src='/(.*)', headers=ISOLATION, continue_=True)]
    routes[0]['continue'] = routes[0].pop('continue_')
    routes.append(dict(src='/majesty/MajestyRecomp\\.wasm', dest='/' + WASM + '.br',
                       headers={'Content-Type': 'application/wasm', 'Content-Encoding': 'br'}))
    for index in sorted(static.rglob('index.html')):
        directory = index.parent.relative_to(static).as_posix()
        routes.append(dict(src='/' if directory == '.' else '/' + directory + '/?',
                           dest='/' + index.relative_to(static).as_posix()))
    routes.append({'handle': 'filesystem'})
    (output / '.vercel/output/config.json').write_text(json.dumps(dict(version=3, routes=routes), indent=2) + '\n')
    (output / 'vercel.json').write_text('{"framework":null}\n')
    files = {file.relative_to(static).as_posix(): dict(bytes=file.stat().st_size, sha256=sha(file))
             for file in static.rglob('*') if file.is_file()}
    report = dict(version=1, sourcePackage=str(receipt.resolve()), site=str(static.resolve()),
                  sourcePackageSha256=sha(receipt), engineSha256=package['engineSha256'],
                  compression=compression, files=files, filesCount=len(files),
                  uploadBytes=sum(record['bytes'] for record in files.values()),
                  autoload=True, gameAssetsIncluded=False, playerSavesIncluded=False,
                  remoteGameAssetsConfigured=bool(automatic_assets),
                  isolationHeaders=ISOLATION, deployed=False,
                  scope='Static engine/frontend and automatic CDN asset loading. No relay backend, personal saves or original '
                        'installation archives are in the static package.')
    (output / 'hosting-package.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-package', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--automatic-assets', type=Path)
    args = parser.parse_args()
    report = prepare(args.source_package, args.output, args.automatic_assets)
    print(json.dumps({key: report[key] for key in ['filesCount', 'uploadBytes', 'compression', 'autoload']}))


if __name__ == '__main__':
    main()

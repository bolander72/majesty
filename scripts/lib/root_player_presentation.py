"""Apply root-page layout and canonical entry routing after release verification."""
import hashlib
import json


CENTERING = '''<style id="majesty-player-placement">
  body { display: grid; grid-template: minmax(0, 1fr) / minmax(0, 1fr);
         place-items: center; }
</style>
'''

PAINT_LOADING = '''rootPreparation.then(async games => {
  preparedRootGames = games;
  const loadingImage = document.querySelector("#startup-art img");
  if (loadingImage) {
    await loadingImage.decode().catch(() => {});
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }
  rootController.signal.throwIfAborted();
  return ('''

LEGACY_ENTRY = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Majesty Gold HD</title>
<style>html,body{margin:0;background:#000}</style>
<script>
const target = new URL("/", location.href);
target.search = location.search;
target.hash = location.hash;
location.replace(target.href);
</script></head><body></body></html>
'''


def install(root, output):
    published = json.loads((root / 'deploy/guild-usability-release.json').read_text())
    pages = ['static/index.html', 'static/majesty/index.html']
    inputs = {}
    for name in pages:
        raw = (output / name).read_bytes()
        if dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest()) != published['productionFiles'][name]:
            raise ValueError('Review the qualified player page before changing presentation: ' + name)
        inputs[name] = raw.decode('utf-8')
    html = inputs['static/index.html']
    start = 'rootPreparation.then(games => { preparedRootGames = games; return ('
    if (html.count('</head>') != 1 or html.count('id="startup-art"') != 1
            or html.count(start) != 1):
        raise ValueError('Review the centered root loading template')
    html = html.replace(start, PAINT_LOADING, 1)
    (output / pages[0]).write_text(html.replace('</head>', CENTERING + '</head>', 1))
    # Legacy links keep their selected save profile and fragment, but never
    # initialize a second player or bypass the root loading/preparation flow.
    (output / pages[1]).write_text(LEGACY_ENTRY)

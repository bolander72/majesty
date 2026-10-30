"""Install a qualified textured building and hero follow-up after the original release."""
import hashlib
import json
from pathlib import Path
import re
import urllib.request


def digest(raw):return {'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}


def inventory(root):return {p.relative_to(root).as_posix():digest(p.read_bytes())for p in root.rglob('*')if p.is_file()}


def install(root,output):
    path=root/'deploy/dark-paladin-life-release.json'
    if not path.exists():return
    release=json.loads(path.read_text());proof_raw=(root/'deploy/dark-paladin-life-verification.json').read_bytes();proof=json.loads(proof_raw)
    if (release.get('format')!='majesty-dark-paladin-life-release-v1'
        or digest(proof_raw)!=release['qualification']
        or any(proof.get(k)is not True for k in ['refinedHeroQualified','originalGuildAnimationsQualified','openLevelThreeQualified','nativeAnimationQualified','saveReloadQualified','ownedBrowserClosed','engineUnchanged','gameplayUnchanged'])):
        raise ValueError('Require the completed native Guild presentation qualification')
    if digest(Path(__file__).read_bytes())!=release['installer']:raise ValueError('Textured release installer changed')
    for name,sha in proof['sourcePolicies'].items():
        p=Path(name)
        if p.is_absolute()or '..'in p.parts or digest((root/p).read_bytes())['sha256']!=sha:
            raise ValueError('Qualified Guild presentation source changed')
    if inventory(output)!=release['baselineFiles']:raise ValueError('Review the current production baseline')
    if set(release['payloads'])!={'static/content/community-files.mjs','static/hosting/automatic-assets.json','static/hosting/community-updates.mjs'}:
        raise ValueError('Only the three native resource binding files may change')
    for name,expected in release['payloads'].items():
        if not re.fullmatch(r'https://raw\.githubusercontent\.com/bolander72/majesty/[a-f0-9]{40}/assets/[A-Za-z0-9_./-]+',expected['url']):
            raise ValueError('Require immutable project assets')
        if not 0<expected['bytes']<=1024*1024:raise ValueError('Oversized presentation binding')
        with urllib.request.urlopen(expected['url'],timeout=45)as response:raw=response.read(expected['bytes']+1)
        if digest(raw)!={k:expected[k]for k in ['bytes','sha256']}:raise ValueError('Textured binding download failed integrity verification')
        (output/name).write_bytes(raw)
    if inventory(output)!=release['productionFiles']:raise ValueError('Presentation release differs from qualified files')
    print('Applied original guild animations, open level-three architecture and refined Dark Paladins.')

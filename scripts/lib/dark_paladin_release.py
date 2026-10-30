"""Apply the qualified Dark Paladin delta after the unchanged baseline release gates."""
import hashlib
import json
from pathlib import Path
import re
import urllib.request


def digest(raw):
    return {'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}


def inventory(root):
    return {p.relative_to(root).as_posix():digest(p.read_bytes())
            for p in root.rglob('*')if p.is_file()}


def advance_engine_cache(output, before, after):
    """Change only engine identities in the launcher and immutable routes."""
    page=output/'static/index.html';text=page.read_text()
    pattern=r'const versions = (\{[^\n]+\});'
    matches=list(re.finditer(pattern,text))
    if len(matches)!=1 or json.loads(matches[0][1])!=before:
        raise ValueError('Review the baseline launcher engine cache identities')
    text=text[:matches[0].start(1)]+json.dumps(after)+text[matches[0].end(1):]
    page.write_text(text)
    path=output/'config.json';config=json.loads(path.read_text());changed=set()
    for route in config['routes']:
        for name in before:
            if before[name]==after[name]:continue
            if route.get('src')!='/majesty/'+name.replace('.',r'\.'):continue
            for condition in route.get('has',[]):
                if condition=={'type':'query','key':'v','value':before[name]}:
                    condition['value']=after[name];changed.add(name)
    if changed!={n for n in before if before[n]!=after[n]}:
        raise ValueError('Review immutable engine cache routes')
    path.write_text(json.dumps(config,indent=2)+'\n')


def install(root,output):
    path=root/'deploy/dark-paladin-release.json'
    if not path.exists():return
    release=json.loads(path.read_text())
    proof_path=root/'deploy/dark-paladin-preview-verification.json'
    raw=proof_path.read_bytes();proof=json.loads(raw)
    required=['nativeConstructRecruitCombatQualified','freshLevel1000SaveReloadQualified',
        'nativeUiQualified','nativeUpgradeChainQualified','otherRetiredAdmissionsDisabled',
        'stockResourcesPreserved','existingSaveHashesPreserved','ownedBrowsersClosed']
    baseline=json.loads((root/'deploy/hosted-release.json').read_text())
    if (release.get('format')!='majesty-dark-paladin-production-delta-v1'
            or digest(raw)!=release['previewQualification']
            or release['baselineEngineSha256']!=baseline['engineSha256']
            or proof['baselineEngineSha256']!=baseline['engineSha256']
            or any(proof.get(k)is not True for k in required)):
        raise ValueError('Require the qualified, save-compatible single-guild release')
    for name,sha in proof['sourcePolicies'].items():
        p=Path(name)
        if p.is_absolute()or '..'in p.parts or digest((root/p).read_bytes())['sha256']!=sha:
            raise ValueError('Qualified Dark Paladin source changed: '+name)
    if digest(Path(__file__).read_bytes())!=release['installer']:
        raise ValueError('Production delta installer changed')
    if inventory(output)!=release['baselineFiles']:
        raise ValueError('Baseline build differs from the reviewed production starting point')
    for name,record in release['payloads'].items():
        p=Path(name)
        if p.is_absolute()or '..'in p.parts or not name.startswith('static/'):
            raise ValueError('Invalid production payload target')
        if not re.fullmatch(r'https://raw\.githubusercontent\.com/bolander72/majesty/[a-f0-9]{40}/assets/[A-Za-z0-9_./-]+',record['url']):
            raise ValueError('Production payload must use immutable project assets')
        if not 0<record['bytes']<=8*1024*1024:raise ValueError('Oversized production overlay')
        with urllib.request.urlopen(record['url'],timeout=45)as response:
            data=response.read(record['bytes']+1)
        if digest(data)!={k:record[k]for k in ['bytes','sha256']}:
            raise ValueError('Production payload integrity failure: '+name)
        (output/p).write_bytes(data)
    if inventory(output)!=release['testedPreviewFiles']:
        raise ValueError('Production resources differ from the played and deployed preview')
    advance_engine_cache(output,release['beforeVersions'],release['afterVersions'])
    if inventory(output)!=release['productionFiles']:
        raise ValueError('Production cache update differs from its reviewed artifact')
    print('Applied qualified Dark Paladin release; original baseline gates retained.')

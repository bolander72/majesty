"""Advance only source-bound native art resources, retaining prior update paths."""
import json

def bind(baseline,previous,resources,prefix,known_versions=()):
    if set(resources)!=set(previous):raise ValueError('Require the complete eight-resource presentation set')
    manifest=json.loads((baseline/'hosting/automatic-assets.json').read_text())
    found=set()
    for p in manifest['games']['majesty-community-guilds-v1']['patches']:
        n=p['path']
        if n in resources:
            if {k:p[k]for k in ['bytes','sha256']}!=previous[n]:raise ValueError('Unreviewed resource baseline: '+n)
            p.update(resources[n],url=prefix+n);found.add(n)
    if found!=set(resources):raise ValueError('Missing automatic resource bindings')
    module=(baseline/'content/community-files.mjs').read_text()
    for n,d in resources.items():
        old='"'+n+'": "'+previous[n]['sha256']+'"'
        if module.count(old)!=1:raise ValueError('Missing prior content hash: '+n)
        module=module.replace(old,'"'+n+'": "'+d['sha256']+'"')
        old='"'+n+'": '+str(previous[n]['bytes'])
        if module.count(old)!=1:raise ValueError('Missing prior content size: '+n)
        module=module.replace(old,'"'+n+'": '+str(d['bytes']))
    updater=(baseline/'hosting/community-updates.mjs').read_text()
    a=updater.index('const PREVIOUS = Object.freeze(')+len('const PREVIOUS = Object.freeze(')
    b=updater.index('\n});',a);prior=json.loads(updater[a:b+2])
    for n,d in previous.items():
        if d['sha256']!=resources[n]['sha256']and d['sha256']not in prior.setdefault(n,[]):prior[n].append(d['sha256'])
    for version in known_versions:
        for n,d in version.items():
            if n not in resources:raise ValueError('Unknown prior resource')
            if d['sha256']!=resources[n]['sha256']and d['sha256']not in prior.setdefault(n,[]):prior[n].append(d['sha256'])
    updater=updater[:a]+json.dumps(prior,indent=2)+updater[b+2:]
    return {'hosting/automatic-assets.json':json.dumps(manifest,indent=2)+'\n','content/community-files.mjs':module,'hosting/community-updates.mjs':updater}

#!/usr/bin/env python3
"""Audit composed GPL effect checks against official and creator descriptors."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]


def audit(source, stock, descriptions):
    inputs = {}
    def read(path):
        raw = path.read_bytes()
        inputs[str(path)] = dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())
        return raw
    checks = set()
    for p in sorted((source / 'sources').rglob('*.gpl')):
        text = re.sub(r'//[^\n]*', '', read(p).decode('cp1252'))
        checks.update(re.findall(r'\$CheckEffector\s*\([^;]*?"([^"\n]+)"', text, re.I))
    def names(paths):
        return {d.get('Name', '').lower() for p in paths
                for d in ET.fromstring(read(p)).iter('Description')}
    base = names(sorted((stock / 'SDK/OriginalQuests/Data').glob('*.xml')))
    northern = names(sorted((stock / 'SDK/OriginalQuests/DataMX').glob('*.xml')))
    community = names([descriptions])
    rows = [dict(name=n, base=n.lower() in base, expansion=n.lower() in northern,
                 community=n.lower() in community) for n in sorted(checks)]
    optional = [r['name'] for r in rows if not r['base'] and not r['community'] and r['expansion']]
    if any(not r['base'] and not r['community'] and not r['expansion'] for r in rows):
        raise ValueError('Unresolved literal effector name')
    header = ROOT / 'native/community/optional_expansion_effectors.h'
    policy = set(re.findall(r'\{"([A-Za-z_]+)"\}', read(header).decode()))
    if set(optional) != policy:
        raise ValueError('Native optional policy differs from the audited Northern-only names')
    return dict(format='majesty-community-campaign-effector-audit-v1', inputs=inputs,
                literalChecks=rows, optionalExpansionNames=optional,
                caseInsensitiveNativeNames=True, runtimeQualified=False)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('source', 'stock', 'descriptions', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    if args.out.exists():
        raise ValueError('Preserve prior audit evidence')
    report = audit(args.source, args.stock, args.descriptions)
    args.out.write_text(json.dumps(report, indent=2) + '\n')
    print('Audited', len(report['literalChecks']), 'literal effect checks;',
          len(report['optionalExpansionNames']), 'Northern-only definitions')

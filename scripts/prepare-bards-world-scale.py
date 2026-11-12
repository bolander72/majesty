#!/usr/bin/env python3
"""Stage smaller community guild world art privately, preserving inputs and UI."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'third_party/majesty-mod-manager/src'))
from lib.community_building_scale import scale_building_cam

FAMILIES = {
    'bards': [(b'BDG1', b'BDG2', b'BDG3'), (b'ABt1', b'ABt2', b'ABt3')],
    'alchemist': [(b'ALB1', b'ALB2', b'ALB3'), (b'ABx1', b'ABx2', b'ABx3')],
    'dark-paladin': [(b'NDG1', b'NDG2', b'NDG3')],
}


def prepare(source, out, percent=78, stock=None, guild='bards'):
    if source.is_symlink() or not source.is_file() or source.stat().st_size > 128 * 1024 * 1024:
        raise ValueError('Require a bounded resident CAM input')
    if out.exists() or out.is_symlink():
        raise ValueError('Preserve previous candidates; choose a fresh output directory')
    raw = source.read_bytes()
    stock_raw = stock.read_bytes() if stock is not None else None
    result, proof = scale_building_cam(raw, percent, stock_raw, FAMILIES[guild])
    if stock_raw is not None:
        proof['stockCamSha256'] = hashlib.sha256(stock_raw).hexdigest()
    proof.update(guild=guild, source=str(source.resolve()), sourceSha256=hashlib.sha256(raw).hexdigest(),
                 outputSha256=hashlib.sha256(result).hexdigest(),
                 scope='Private world art and matching geometry candidate; no deployment or save edits',
                 published=False)
    out.mkdir(parents=True)
    (out / (guild + '_maindata.cam')).write_bytes(result)
    (out / 'scale-receipt.json').write_text(json.dumps(proof, indent=2) + '\n')
    assert source.read_bytes() == raw
    return proof


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    p.add_argument('--percent', type=int, default=78)
    p.add_argument('--stock-cam', type=Path, help='Original stock lineage for inherited effect TILEs')
    p.add_argument('--guild', choices=tuple(FAMILIES), default='bards')
    a = p.parse_args()
    print(json.dumps(prepare(a.source, a.out, a.percent, a.stock_cam, a.guild)))

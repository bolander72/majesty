#!/usr/bin/env python3
"""Prepare verified campaign compatibility without altering creator inputs."""
import argparse
import hashlib
import json
from pathlib import Path
from lib.community_legacy_guild_capacity import restore_legacy_capacity
from lib.community_campaign_contract import audit_stage

ROOT = Path(__file__).resolve().parents[1]


def record(raw):
    return dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())


def prepare(source, output):
    if output.exists() or output.is_symlink():
        raise ValueError('Preserve prior sources; choose a fresh output')
    proof_raw = (source / 'source-stage.json').read_bytes()
    proof = json.loads(proof_raw)
    if (proof.get('format') != 'majesty-community-combined-creator-gpl-stage-v1'
            or proof.get('legacyFunctionAliases') or proof.get('legacyGuildCapacityCompatibility')):
        raise ValueError('Require a verified unaliased stage without capacity compatibility')
    payloads = {}
    for name, expected in proof['files'].items():
        parts = Path(name).parts
        if len(parts) != 2 or parts[0] not in ('Any', 'Majesty', 'MajestyExpansion'):
            raise ValueError('Unexpected source path')
        path = source / 'sources' / name
        if path.is_symlink() or path.stat().st_size > 2 * 1024 * 1024:
            raise ValueError('Unavailable source')
        raw = path.read_bytes()
        if record(raw) != expected:
            raise ValueError('Source differs from its proof: ' + name)
        payloads[name] = raw
    name = 'Any/Merged.gpl'
    original = payloads[name]
    payloads[name] = restore_legacy_capacity(original.decode('cp1252')).encode('cp1252')
    output.mkdir()
    for name, raw in payloads.items():
        path = output / 'sources' / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)
    # Private, immutable dependencies remain in the preserved earlier stage.
    for name in ('stock-fixture', 'resources', 'phantom-source-package'):
        (output / name).symlink_to((source / name).resolve(), target_is_directory=True)
    policy = ROOT / 'scripts/lib/community_legacy_guild_capacity.py'
    campaign_contract = audit_stage(output, output / 'stock-fixture',
        (output / 'resources/merged_descriptions.xml').read_bytes())
    proof.update(legacyCapacityPriorStage=record(proof_raw),
        originalCampaignContract=campaign_contract,
        campaignContractPolicy=record((ROOT / 'scripts/lib/community_campaign_contract.py').read_bytes()),
        legacyGuildCapacityCompatibility=[dict(file='Any/Merged.gpl', before=record(original),
            after=record(payloads['Any/Merged.gpl']), policy=record(policy.read_bytes()),
            stockGuildsAndNativeCapacityUnchanged=True)],
        files={name: record(raw) for name, raw in payloads.items()},
        compiled=False, targetNativeABIQualified=False, browserPlayable=False, published=False)
    (output / 'source-stage.json').write_text(json.dumps(proof, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    prepare(args.source, args.out)
    print('Private source compatibility staged; original SDK compilation and gameplay required')

"""Validate a stopped selected-pair export before copying it into a native profile."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def selected_pair_input(receipt, side, expected_digest):
    verified = json.loads(subprocess.check_output([
        'node', str(ROOT / 'scripts/export-native-entity-pair.mjs'), '--verify',
        str(receipt.resolve()), str(side), expected_digest,
    ]))
    if verified['side'] != side or verified['sha256'] != expected_digest:
        raise ValueError('Selected-pair export differs from native proof')
    return verified


def selected_revision_input(receipt, side, expected_digest, require_current=True):
    verified = json.loads(subprocess.check_output([
        'node', str(ROOT / 'scripts/export-native-entity-revision.mjs'),
        '--verify' if require_current else '--verify-historical',
        str(receipt.resolve()), str(side), expected_digest,
    ]))
    if verified['side'] != side or verified['sha256'] != expected_digest:
        raise ValueError('Selected revision export differs from native proof')
    return verified

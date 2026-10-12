"""Replay inspected original host Begin/Ready bodies, never Loaded or resume.

The reference has no game world. Its host requests come from a stopped original
host; the recipient must execute its own production source capture and votes.
"""
import json
from pathlib import Path
import struct
import subprocess

from .native_original_host_replay import ROOT, bounded_read, digest


def proposal_requests(rows, read, descriptor_sha, *, sender=1, host=True, actions=(1, 2)):
    """Bind both recorded authenticated host RPCs to one exact descriptor."""
    if not isinstance(rows, list) or len(rows) != 2 or len(actions) != 2:
        raise ValueError('Require exactly the captured original host Begin/Ready')
    bodies = []
    descriptor = None
    for action, row in zip(actions, rows):
        if (row.get('sender'), row.get('host'), row.get('op'), row.get('action')) != (sender, host, 12, action):
            raise ValueError('Captured proposal request is not the original host action')
        wire = read(row['copy'], 2048)
        if len(wire) != row['bytes'] or digest(wire) != row['sha256'] or len(wire) < 33:
            raise ValueError('Captured proposal request custody differs')
        words = struct.unpack_from('<8I', wire)
        if (words[:3] != (0x31525044, 1, 12) or words[3] != row['request'] or
                not words[3] or words[4:7] != (0, action, 1) or
                not 1 <= words[7] <= 1024 or len(wire) != words[7] + 32):
            raise ValueError('Captured proposal request framing differs')
        current = wire[32:]
        if digest(current) != descriptor_sha or (descriptor is not None and current != descriptor):
            raise ValueError('Captured proposal descriptors differ')
        descriptor = current
        bodies.append(wire[20:])
    return tuple(bodies)


class CapturedHostProposal:
    def __init__(self, proof_name, transcript):
        self.path = Path(proof_name).resolve()
        if not self.path.is_relative_to(ROOT / 'output'):
            raise ValueError('Require an owned stopped proposal proof')
        raw = bounded_read(self.path, 2 * 1024 * 1024)
        proof = json.loads(raw)
        if (proof.get('report') != str(transcript.report_path) or
                not transcript.paused_host_inspection or
                proof.get('sourcePublicationFrozenQualified') is not True or
                proof.get('originalSdkProposalRequestsPreservedQualified') is not True or
                proof.get('peerReadyVotes') != 0 or proof.get('peerLoadedVotes') != 0 or
                proof.get('browserUsed') is not False or proof.get('targetGenerated') is not False):
            raise ValueError('Require the inspected paused original host proposal without peer votes')
        # Re-run the stopped original-world and protocol inspector. Never trust
        # self-declared JSON qualifications or start a native/browser process.
        code = """import {inspectCoopProposal} from './scripts/inspect-native-coop-proposal.mjs';
const p=await inspectCoopProposal(process.argv[1]);
console.log(JSON.stringify({reportSha256:p.reportSha256,
 descriptorSha256:p.descriptorSha256,capturedRequests:p.capturedRequests,
 verifierInputs:p.verifierInputs}));"""
        result = subprocess.run(['node', '--max-old-space-size=96', '--input-type=module', '-e',
                                 code, str(transcript.report_path)], cwd=ROOT,
                                capture_output=True, text=True, timeout=20)
        if result.returncode or len(result.stdout) > 16384:
            raise ValueError('Independent original host proposal inspection refused')
        checked = json.loads(result.stdout)
        for key in ('reportSha256', 'descriptorSha256', 'capturedRequests', 'verifierInputs'):
            if checked[key] != proof[key]:
                raise ValueError('Recorded proposal proof differs from independent inspection')
        self.rows = proof['capturedRequests']
        self.bodies = proposal_requests(self.rows, bounded_read, proof['descriptorSha256'])
        self.source_inputs = [(self.path, raw)]
        for row in self.rows:
            self.source_inputs.append((Path(row['copy']), bounded_read(row['copy'], 2048)))
        self.descriptor_sha = proof['descriptorSha256']
        self.sent = False
        self.frozen_inputs = []

    def preserve(self, directory):
        for i, (source, data) in enumerate(self.source_inputs):
            target = directory / f'proposal-source-{i:03}-{source.name}'
            with target.open('xb') as stream:
                stream.write(data)
            self.frozen_inputs.append(dict(source=str(source), copy=str(target),
                                           bytes=len(data), sha256=digest(data)))
        self.verify_preserved()

    def verify_preserved(self):
        for row in self.frozen_inputs:
            data = bounded_read(row['copy'], 2 * 1024 * 1024)
            if len(data) != row['bytes'] or digest(data) != row['sha256']:
                raise ValueError('Owned original proposal replay input changed')

    def can_send(self, report):
        if self.sent or report.get('capturedHostPauseInputWindowDelivered') is not True:
            return False
        enabled = {(r.get('op'), r.get('action')) for r in report.get('proposalProtocolRequests', [])
                   if r.get('sender') == 2 and r.get('host') is False}
        return {(12, 0), (13, 6)}.issubset(enabled)

    async def send(self, relay, rpc, report):
        if not self.can_send(report):
            raise ValueError('Proposal replay requires delivered original pause and actual guest lane enables')
        self.sent = True  # Never retry an unknown RPC outcome or duplicate Begin.
        report['replayedOriginalHostProposalBodies'] = []
        for row, body in zip(self.rows, self.bodies):
            if await rpc(relay.BARRIER, body) != b'':
                raise ValueError('Captured original host Begin/Ready refused')
            report['replayedOriginalHostProposalBodies'].append(dict(action=row['action'],
                source=row['copy'], bytes=len(body), sha256=digest(body)))
        report.update(capturedOriginalHostProposalDelivered=True,
                      referenceReplayedHostReadyVotes=1, referenceHostLoadedVotesSent=0)


async def enable_replay_host(relay, rpc, report):
    if report.get('replayHostProposalRequested') is not True:
        raise ValueError('Require explicit original host proposal replay')
    for op, body in [(relay.BARRIER, relay.put(relay.BARRIER_ENABLE) + relay.string(relay.BARRIER_CONTRACT)),
                     (relay.CHECKPOINT, relay.put(relay.CHECKPOINT_ENABLE, 0) + relay.string(relay.CHECKPOINT_CONTRACT))]:
        if await rpc(op, body) != relay.put(1):
            raise ValueError('Recorded host protocol enable refused')
    report.update(referenceProposalObserverEnabled=True, observedProposalEvents=[],
                  referenceReplayedHostReadyVotes=0, referenceHostLoadedVotesSent=0)


def preserve_replay_event(relay, body, packets, report, proposal, completion=None):
    reader = relay.Reader(body)
    serial, stage = reader.u32(), reader.u32()
    descriptor = reader.string(relay.BARRIER_DESCRIPTOR_BYTES)
    count = reader.u32()
    players = [reader.u32() for _ in range(count)] if count <= 4 else []
    reader.done()
    rows = report['observedProposalEvents']
    if (len(body) > 2048 or serial != 1 or players != [1, 2] or
            digest(descriptor) != proposal.descriptor_sha or
            len(rows) >= (3 if completion else 2) or
            stage != (relay.BARRIER_PREPARED, relay.BARRIER_COMMITTED, relay.BARRIER_COMPLETE)[len(rows)]):
        raise ValueError('Unexpected original guest proposal event')
    if stage == relay.BARRIER_COMPLETE and not (completion and completion.sent_loaded):
        raise ValueError('Complete lacks captured actual host Loaded')
    if stage == relay.BARRIER_COMMITTED and not any(
            r.get('sender') == 2 and r.get('host') is False and r.get('op') == 12 and r.get('action') == 2
            for r in report.get('proposalProtocolRequests', [])):
        raise ValueError('Commit lacks actual recipient Ready evidence')
    path = packets / f'proposal-{len(rows):03}.bin'
    with path.open('xb') as stream:
        stream.write(body)
    rows.append(dict(copy=str(path), bytes=len(body), sha256=digest(body), serial=serial,
                     stage=stage, players=players, descriptorSha256=digest(descriptor)))


class CapturedGuestVotes:
    """Replay actual inspected recipient Ready/Loaded to one original host.

    This is a stopped recorded peer. Loaded waits for the host's full original
    target snapshot; no gameplay commands or original resume controls are sent.
    """
    def __init__(self, proof_name):
        self.path = Path(proof_name).resolve()
        if not self.path.is_relative_to(ROOT / 'output'):
            raise ValueError('Require an owned stopped recipient proof')
        raw = bounded_read(self.path, 2 * 1024 * 1024)
        proof = json.loads(raw)
        if (proof.get('actualRecipientSdkLoadedExecutedQualified') is not True or
                proof.get('targetFullSaveInspected') is not True or
                proof.get('browserUsed') is not False or proof.get('hostLoadedVotes') != 0):
            raise ValueError('Require independently inspected actual recipient target/Loaded')
        code = """import {inspectRecipientProposal} from './scripts/inspect-native-coop-recipient-proposal.mjs';
import {inspectCoopProposal} from './scripts/inspect-native-coop-proposal.mjs';
const p=await inspectRecipientProposal(process.argv[1]);
const h=await inspectCoopProposal(p.hostProposalReport);
console.log(JSON.stringify({recipient:{reportSha256:p.reportSha256,
 descriptorSha256:p.descriptorSha256,capturedRecipientRequests:p.capturedRecipientRequests,
 verifierInputs:p.verifierInputs},host:{sourceCheckpoint:h.sourceCheckpoint,marker:h.marker}}));"""
        result = subprocess.run(['node', '--max-old-space-size=96', '--input-type=module', '-e',
                                 code, proof['report']], cwd=ROOT, capture_output=True, text=True, timeout=20)
        if result.returncode or len(result.stdout) > 32768:
            raise ValueError('Independent recipient/source inspection refused')
        checked = json.loads(result.stdout)
        if any(checked['recipient'][key] != proof[key] for key in checked['recipient']):
            raise ValueError('Recipient proof differs from independent inspection')
        self.rows = proof['capturedRecipientRequests']
        self.descriptor_sha = proof['descriptorSha256']
        self.bodies = proposal_requests(self.rows, bounded_read, self.descriptor_sha,
                                       sender=2, host=False, actions=(2, 3))
        self.source = checked['host']
        self.source_inputs = [(self.path, raw)]
        for row in self.rows:
            self.source_inputs.append((Path(row['copy']), bounded_read(row['copy'], 2048)))
        self.sent_ready = self.sent_loaded = False
        self.frozen_inputs = []

    preserve = CapturedHostProposal.preserve
    verify_preserved = CapturedHostProposal.verify_preserved

    def preserve_source(self, profile):
        folder = profile / 'captured-coop-source'
        folder.mkdir()
        rows = []
        for key, name, maximum in [('sourceCheckpoint', 'source_0.GMP', 2 * 1024 * 1024),
                                   ('marker', 'source.checkpoint', 768)]:
            row = self.source[key]
            data = bounded_read(row['path'], maximum)
            if len(data) != row['bytes'] or digest(data) != row['sha256']:
                raise ValueError('Inspected original host source changed')
            path = folder / name
            with path.open('xb') as sink: sink.write(data)
            rows.append(dict(source=row['path'], copy=str(path), bytes=len(data), sha256=digest(data)))
        return rows

    def matches_prepared(self, report):
        rows = report.get('observedProposalEvents', [])
        return bool(rows and rows[0]['stage'] == 1 and
                    rows[0]['descriptorSha256'] == self.descriptor_sha)

    async def send_pending(self, relay, rpc, report, target):
        if not self.sent_ready and self.matches_prepared(report):
            self.sent_ready = True
            if await rpc(relay.BARRIER, self.bodies[0]) != b'':
                raise ValueError('Captured actual recipient Ready refused')
            report['referenceReplayedRecipientReadyVotes'] = 1
        if self.sent_ready and not self.sent_loaded and target.is_file() and not target.is_symlink() and target_snapshot_completed(report, 1, 0):
            enabled = report.get('proposalProtocolRequests', [])
            host_loaded = any((r.get('sender'), r.get('host'), r.get('op'), r.get('action')) ==
                              (1, True, 12, 3) for r in enabled)
            if not host_loaded or not 0 < target.stat().st_size <= 2 * 1024 * 1024:
                raise ValueError('Recipient Loaded replay lacks actual host Loaded/full target')
            self.sent_loaded = True
            if await rpc(relay.BARRIER, self.bodies[1]) != b'':
                raise ValueError('Captured actual recipient Loaded refused')
            report['referenceReplayedRecipientLoadedVotes'] = 1
        report['replayedOriginalRecipientVoteBodies'] = [dict(action=r['action'], source=r['copy'],
            bytes=len(b), sha256=digest(b)) for r,b in zip(self.rows,self.bodies)
            if (r['action'] == 2 and self.sent_ready) or (r['action'] == 3 and self.sent_loaded)]


def preserve_host_load_event(relay, body, packets, report, votes):
    reader = relay.Reader(body)
    serial, stage = reader.u32(), reader.u32()
    descriptor = reader.string(relay.BARRIER_DESCRIPTOR_BYTES)
    count = reader.u32()
    players = [reader.u32() for _ in range(count)] if count <= 4 else []
    reader.done()
    if serial == 2 and report.get('observeSavedReturnProposalRequested') is True:
        preserve_saved_return_prepared(relay, body, packets, report,
                                       serial, stage, descriptor, players, votes)
        return
    rows = report['observedProposalEvents']
    if (len(body) > 2048 or serial != 1 or players != [1, 2] or
            digest(descriptor) != votes.descriptor_sha or len(rows) >= 3 or
            stage != (relay.BARRIER_PREPARED, relay.BARRIER_COMMITTED, relay.BARRIER_COMPLETE)[len(rows)]):
        raise ValueError('Host target proposal event differs from actual recipient descriptor/order')
    if stage >= relay.BARRIER_COMMITTED and not votes.sent_ready:
        raise ValueError('Host commit lacks replayed actual recipient Ready')
    if stage == relay.BARRIER_COMPLETE and not votes.sent_loaded:
        raise ValueError('Host complete lacks replayed actual recipient Loaded')
    path = packets / f'proposal-{len(rows):03}.bin'
    with path.open('xb') as sink:sink.write(body)
    rows.append(dict(copy=str(path), bytes=len(body), sha256=digest(body), serial=serial,
                     stage=stage, players=players, descriptorSha256=digest(descriptor)))


def preserve_saved_return_prepared(relay, body, packets, report,
                                  serial, stage, descriptor, players, votes):
    """Observe the next real Begin only; never replay votes for a new serial."""
    previous = report.get('observedProposalEvents', [])
    rows = report.setdefault('observedSavedReturnEvents', [])
    if (len(body) > 2048 or serial != 2 or stage != relay.BARRIER_PREPARED or
            players != [1, 2] or rows or len(previous) != 3 or
            [r.get('stage') for r in previous] != [1, 2, 3] or
            any(r.get('serial') != 1 or r.get('descriptorSha256') != votes.descriptor_sha
                for r in previous) or not (votes.sent_ready and votes.sent_loaded)):
        raise ValueError('Saved return requires completed first travel and one actual Prepared event')
    try:
        text = descriptor.decode('ascii')
    except UnicodeDecodeError as error:
        raise ValueError('Saved return descriptor is not ASCII') from error
    fields = text[:-1].split('\n') if text.endswith('\n') else []
    if (len(descriptor) > 1024 or len(fields) != 22 or
            any(not field or any(ord(c) < 32 or ord(c) > 126 for c in field) for field in fields) or
            fields[:8] != ['majesty-coop-region-v1', 'native-terrain-fixture',
                           '1', '0', '0', '0', '71201', '1'] or fields[15] != '1'):
        raise ValueError('Require actual saved west return from1_0 to0_0')
    path = packets / 'saved-return-prepared-000.bin'
    with path.open('xb') as sink:
        sink.write(body)
    rows.append(dict(copy=str(path), bytes=len(body), sha256=digest(body), serial=serial,
                     stage=stage, players=players, descriptorSha256=digest(descriptor)))


def target_snapshot_completed(report, player, slot):
    """Wait for the original writer's checked return, not a file's creation."""
    profile = Path(report['profile'])
    log = profile.parent / 'native.log'
    if not log.is_file() or log.is_symlink():
        return False
    if log.stat().st_size > 4 * 1024 * 1024:
        raise ValueError('Target snapshot trace exceeds its bound')
    with log.open('rb') as stream:
        stream.seek(max(0, log.stat().st_size - 16384))
        tail = stream.read(16384)
    marker = (f'[coop-target-fixture] Snapshot epoch=1 serial=1 local={player} slot={slot} region=1_0 '
              'frame=0 clock=0 original-writer=1 source-retained=1 coordinator-loaded=1 '
              'peer-loaded=0 resume-controls=0 live-second-engine=0\n').encode()
    return marker in tail

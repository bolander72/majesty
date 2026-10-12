#!/usr/bin/env python3
"""Qualify commands and complete original routes on the same grounded private actor."""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import struct
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


def cases_from_pack(raw):
    if struct.unpack_from('<2I', raw) != (0x3353414e, 4):
        raise ValueError('Wrong composed source pack')
    cursor, cases = 8, []
    for _ in range(4):
        identity, size, requests, payload_size, *counts = struct.unpack_from('<7I', raw, cursor); cursor += 28
        if (size, requests, payload_size, counts) != (375, 18, 620, [2, 1, 0]):
            raise ValueError('Unsupported composed actor/graph shape')
        unit = raw[cursor:cursor + size]; cursor += size
        descriptors = [list(struct.unpack_from('<5I', raw, cursor + i * 20)) for i in range(requests)]; cursor += requests * 20
        paths = [r for r in descriptors if r[0] == 3]
        if paths != [[3, 0, 1, 4, 80]]:
            raise ValueError('Unsupported original Path allocation')
        payload = raw[cursor:cursor + payload_size]; cursor += payload_size
        clock_count = struct.unpack_from('<I', raw, cursor)[0]; cursor += 4
        if clock_count != 3:
            raise ValueError('Incomplete typed clock descriptors')
        clocks = [list(struct.unpack_from('<8I', raw, cursor + i * 32)) for i in range(3)]; cursor += 96
        target_count = struct.unpack_from('<I', raw, cursor)[0]; cursor += 4
        if target_count != 2:
            raise ValueError('Incomplete typed target descriptors')
        targets = [list(struct.unpack_from('<5I', raw, cursor + i * 20)) for i in range(2)]; cursor += 40
        body = clocks[1][0] - 20
        if body < 0 or body + 220 > payload_size:
            raise ValueError('Path body outside original graph')
        if [struct.unpack_from('<I', payload, body + at)[0] for at in [0, 120, 128, 136]] != [5, 8, 10, 10]:
            raise ValueError('Wrong original cached Path shape')
        cases.append(dict(id=identity, unit=unit, payload=payload, clocks=clocks, targets=targets, body=body))
    binding = list(struct.unpack_from('<5I', raw, cursor)); cursor += 20
    if binding != [2073, 497, 1, 827610690, 7]:
        raise ValueError('Changed supplied target binding')
    units = []
    for identity in binding[:2]:
        size = struct.unpack_from('<I', raw, cursor)[0]; cursor += 4
        if not 72 <= size <= 4096 or cursor + size > len(raw):
            raise ValueError('Target record outside source pack')
        unit = raw[cursor:cursor + size]; cursor += size
        if struct.unpack_from('<I', unit, 36)[0] != identity:
            raise ValueError('Wrong captured target identity')
        units.append(unit)
    if cursor != len(raw):
        raise ValueError('Trailing composed pack bytes')
    return cases, units


def one(block, pattern, label):
    rows = re.findall(pattern, block, re.M)
    if len(rows) != 1:
        raise ValueError(f'Missing or duplicate composed {label}')
    return rows[0]


def verify(manifest, *, require_replay=False, require_disk_replay=False):
    grounded = load('grounded_composition', 'check-native-actor-grounded-placement.py')
    hashes = load('composed_hashes', 'check-native-actor-populated-stage.py')
    report = grounded.verify(manifest)
    meta = report['fixture']
    if meta.get('composedArrival') is not True:
        raise ValueError('Missing same-actor grounded command composition')
    replay = meta.get('composedReplay') is True
    disk_replay = meta.get('composedDiskReplay') is True
    if (disk_replay and not replay) or (require_disk_replay and not disk_replay):
        raise ValueError('Missing actual saved-file composed graph replay')
    if require_replay and not replay:
        raise ValueError('Missing persisted composed graph original replay')
    audit = load('composed_audit', 'audit-native-composed-arrival.py').audit()
    raw = (Path(meta['profile']) / 'Populated_Order_Stage.bin').read_bytes()
    cases, targets = cases_from_pack(raw)
    moves = {}
    if meta.get('rebaseInflightMove') is True:
        move_audit = load('inflight_move_audit', 'audit-native-inflight-move.py').audit()
        inspection = subprocess.run(['node', str(ROOT / 'scripts/inspect-native-inflight-move.mjs'), '--stdout'],
                                    check=True, capture_output=True, text=True, timeout=30)
        if len(inspection.stdout) > 16384:
            raise ValueError('Unbounded Move point evidence')
        move_evidence = json.loads(inspection.stdout)
        if (move_evidence['sourceSha256'] != '31059d44ebf165c25bf1fd91f8ef00d5c5e3733d2d6177ca8e05956026650e13' or
                move_evidence['destinationSha256'] != '6e6a2ee125b68ce00ec25a46f205904e7cdd8f83ca009c10cf29e8e9ab76e2d1' or
                move_evidence['largestRead'] > 4096 or len(move_evidence['cases']) != 4):
            raise ValueError('Wrong pinned Move terrain evidence')
        for case, point in zip(cases, move_evidence['cases']):
            move_body = case['clocks'][0][0] - 20
            old = list(struct.unpack_from('<3i', case['payload'], move_body + 104))
            fixed = list(struct.unpack_from('<2i', case['unit'], 60))
            cells = list(struct.unpack_from('<2i', case['unit'], 72))
            if (case['id'] != point['id'] or old != [point['sourcePoint'][a] for a in ['x', 'y', 'z']] or
                    old[:2] != [n * 32768 for n in cells] or point['sourceHeightOffset'] != 0 or
                    point['sourceGround'] != old[2] or point['targetId'] != 0 or point['flags'] not in [0, 0x4000]):
                raise ValueError('Move point is not the supported original grounded navigation step')
            projected = report['projectedActorCases'][len(moves)]['fixed']
            delta = [projected[a] - fixed[a] for a in range(2)]
            goal = [point['projectedPoint'][a] for a in ['x', 'y', 'z']]
            if goal[:2] != [old[a] + delta[a] for a in range(2)] or goal[2] != point['destinationGround']:
                raise ValueError('Move point changed remaining displacement or destination height')
            moves[case['id']] = dict(body=move_body, old=old, delta=delta, goal=goal)
    source_xy, destination_xy = [list(struct.unpack_from('<2i', unit, 60)) for unit in targets]
    log = Path(meta['log']).read_text()
    blocks = re.findall(r'^\[streaming\] Composed graph read .*?^\[streaming\] Composed arrival .*?$', log, re.M | re.S)
    if len(blocks) != 64:
        raise ValueError('Missing all same-actor command/route/cleanup cycles')
    observations, validated, maximum_nodes = [], 0, 0
    final_expected = None
    for i, block in enumerate(blocks):
        case, trial = cases[i // 16], i % 16
        for row in ['Composed graph read complete=1 status=0 eax=00000000 claimed=1 failure=0',
                    'Composed graph structure-and-actor=1',
                    'Composed graph writer equal=1 status=0 eax=00000000',
                    'Composed graph cleanup frees=18 expected=18 retained=0']:
            if len(re.findall(r'^\[streaming\] ' + re.escape(row) + '$', block, re.M)) != 1:
                raise ValueError('Missing composed original graph read/write/storage cleanup')
        if replay:
            for row in ['Replayed graph read complete=1 status=0 eax=00000000 claimed=1 failure=0',
                        'Replayed graph structure-and-actor=1',
                        'Replayed graph writer equal=1 status=0 eax=00000000',
                        'Replayed graph cleanup frees=18 expected=18 retained=0']:
                if len(re.findall(r'^\[streaming\] ' + re.escape(row) + '$', block, re.M)) != 1:
                    raise ValueError('Missing persisted composed graph original read/write/cleanup')
        arrival = one(block, r'^\[streaming\] Composed arrival actor=(\d+) trial=(\d+) identity=0 world=0 grounded=1 commands=1 equal=1 destroyed=1 preserved=1 balanced=1 result=pass$', 'arrival')
        if list(map(int, arrival)) != [case['id'], trial]:
            raise ValueError('Wrong composed actor or trial order')
        binding = one(block, r'^\[streaming\] Composed binding trial=(\d+) before=2073 after=497 source-clock=(\d+) destination-clock=(\d+) refused=4 targets=2 clocks=3 when=(\d+),(\d+),(\d+) result=pass$', 'binding')
        expected_stamps = [(report['destinationClockMs'] - ((report['sourceClockMs'] - h[4]) & 0xffffffff)) & 0xffffffff for h in case['clocks']]
        if list(map(int, binding)) != [trial, report['sourceClockMs'], report['destinationClockMs'], *expected_stamps]:
            raise ValueError('Composed command times differ from original captured clocks')
        invalidation = one(block, r'^\[streaming\] Composed path invalidate trial=(\d+) old-count=10 count=0 cursor=0 capacity=64 retained-bytes=512 serialized-bytes=540 replan-selected=1 result=pass$', 'invalidation')
        if int(invalidation) != trial:
            raise ValueError('Composed capacity/invalidation order differs')
        body = case['body']
        old = list(struct.unpack_from('<2i', case['payload'], body + 104))
        offset = [old[axis] - (source_xy[axis] >> 11) for axis in range(2)]
        goal = [(destination_xy[axis] >> 11) + offset[axis] for axis in range(2)]
        fixed = report['projectedActorCases'][i // 16]['fixed']
        start, end = [n // 2048 // 16 for n in fixed[:2]], [n // 16 for n in goal]
        if not all(0 <= n < 4096 for n in goal):
            raise ValueError('Rebound command goal outside actual destination')
        observed_goal = one(block, r'^\[streaming\] Composed goal trial=(\d+) old=(-?\d+),(-?\d+) offset=(-?\d+),(-?\d+) goal=(-?\d+),(-?\d+) start=(\d+),(\d+) end=(\d+),(\d+) preserved=1 result=pass$', 'goal')
        if list(map(int, observed_goal)) != [trial, *old, *offset, *goal, *start, *end]:
            raise ValueError('Command goal or start differs from original target-relative approach and actual actor position')
        route_row = one(block, r'^\[streaming\] Composed route warm=0 trial=(\d+) count=(\d+) validated=(\d+) capacity=64 expansion-limit=512 used-nodes=(\d+) node-capacity=8192 redzones=1 scratch-clear=1 lists-empty=1 caches-retired=1 pool-same=1 preserved=1 retained-bytes=0 retained-blocks=0 result=pass$', 'route')
        observed_trial, count, checked, used = map(int, route_row)
        point_row = one(block, r'^\[streaming\] Composed route points warm=0 trial=(\d+) count=(\d+) values=([0-9,;]+)$', 'route points')
        if (observed_trial != trial or checked != count or not 1 < count < 64 or not 0 < used <= 4097 or
                list(map(int, point_row[:2])) != [trial, count]):
            raise ValueError('Incomplete composed route or wrong storage/search budget')
        points = [list(map(int, p.split(','))) for p in point_row[2].split(';')]
        if len(points) != count or any(len(p) != 2 or not all(0 <= n < 256 for n in p) for p in points):
            raise ValueError('Invalid composed route coordinates/count')
        if points[0] != start or points[-1] != end:
            raise ValueError('Composed route does not connect actual actor to rebound command goal')
        for first, second in zip(points, points[1:]):
            dx, dy = second[0] - first[0], second[1] - first[1]
            if not (-1 <= dx <= 1 and -1 <= dy <= 1 and (dx or dy)):
                raise ValueError('Discontinuous composed original route')
        size = 540 + count * 8
        attachment = one(block, r'^\[streaming\] Composed attachment trial=(\d+) count=(\d+) cursor=0 capacity=64 owned-bytes=512 serialized-bytes=(\d+) result=pass$', 'attachment')
        recovery = one(block, r'^\[streaming\] Composed graph recovery trial=(\d+) bytes=(\d+) actor-same=1 heap-same=1 result=pass$', 'recovery')
        if list(map(int, attachment)) != [trial, count, size] or list(map(int, recovery)) != [trial, size]:
            raise ValueError('Route attachment/storage or actor/heap recovery differs')
        if replay:
            recovered = one(block, r'^\[streaming\] Replayed graph recovery trial=(\d+) bytes=(\d+) actor-same=1 heap-same=1 result=pass$', 'persisted replay recovery')
            if list(map(int, recovered)) != [trial, size]:
                raise ValueError('Persisted graph replay does not recover same actor and heap')
        if disk_replay:
            disk = one(block, r'^\[streaming\] Composed disk replay trial=(\d+) bytes=(\d+) exact-file=1 result=pass$', 'actual saved-file replay')
            if list(map(int, disk)) != [trial, size]:
                raise ValueError('Actual saved-file replay size or actor order differs')
        # Independent full transformation of original literal bytes. Bank-one
        # references/times are edited BEFORE variable-length route replacement.
        expected = bytearray(case['payload'])
        if moves:
            move = moves[case['id']]
            observed = one(block, r'^\[streaming\] Composed move actor=(\d+) trial=(\d+) old=(-?\d+),(-?\d+),(-?\d+) delta=(-?\d+),(-?\d+) goal=(-?\d+),(-?\d+),(-?\d+) remaining-preserved=1 point-only=1 actor-same=1 scratch-released=1 result=pass$', 'in-flight Move')
            if list(map(int, observed)) != [case['id'], trial, *move['old'], *move['delta'], *move['goal']]:
                raise ValueError('Original Move setter/height evidence differs from independent saved point and terrain')
            struct.pack_into('<3i', expected, move['body'] + 104, *move['goal'])
        for descriptor, stamp in zip(case['clocks'], expected_stamps):
            struct.pack_into('<I', expected, descriptor[0], stamp)
        for descriptor in case['targets']:
            struct.pack_into('<I', expected, descriptor[0], 497)
        struct.pack_into('<2i', expected, body + 104, *goal)
        struct.pack_into('<I', expected, body + 120, 0)
        struct.pack_into('<I', expected, body + 128, 64)
        struct.pack_into('<I', expected, body + 136, count)
        expected[body + 140:body + 220] = b''.join(struct.pack('<2I', *p) for p in points)
        if len(expected) != size:
            raise ValueError('Independent writer size differs')
        final_expected = bytes(expected)
        validated += count; maximum_nodes = max(maximum_nodes, used)
        observations.append(dict(id=case['id'], trial=trial, start=start, end=end, oldGoal=old,
                                 relativeApproachOffset=offset, goal=goal, count=count,
                                 usedNodes=used, serializedBytes=size, points=points,
                                 **({'inflightMove': moves[case['id']]} if moves else {})))
    writer = Path(meta['profile']) / 'Composed_Orders.bin'
    if writer.read_bytes() != final_expected:
        raise ValueError('Actual original command writer artifact differs from independently rebound graph and route')
    replay_writer = Path(meta['profile']) / 'Replayed_Orders.bin'
    if replay and replay_writer.read_bytes() != final_expected:
        raise ValueError('Original persisted graph replay writer differs from independently composed data')
    report.update(persistedComposedGraphLoadedFromActualFile=disk_replay,
                  actualSavedFileComposedGraphReplays=64 if disk_replay else 0,
                  persistedComposedGraphOriginalReplays=64 if replay else 0,
                  persistedComposedGraphOriginalReplayQualified=replay,
                  persistedComposedGraphReplayJournalFrees=1152 if replay else 0,
                  persistedComposedGraphReplayWriterIndependentlyMatched=replay,
                  scope='64 same-actor private grounded UNIT/command compositions, supplied fixture target-relative approach rebinding, complete original routes in owned capacity, exact original writers and cleanup; no live activation or continuous regions',
                  sameActorGroundedCommandCompositionQualified=True, privateComposedActorCycles=64,
                  privateComposedOriginalRoutes=64, composedOriginalRoutePointsValidated=validated,
                  composedCollisionCalls=validated + 4 * 64, maximumComposedSearchNodes=maximum_nodes,
                  composedFixtureExpansionLimit=512, composedMaximumNodeAllocations=4097,
                  composedOwnedRouteCapacityPoints=64, composedOwnedRouteBytes=512,
                  composedNativeOrderBytes=100, composedSerializedPathBodyBytes=140,
                  composedOriginalWriterArtifactIndependentlyMatched=True,
                  composedPreflightRefusals=256, composedClockEdits=192, composedTargetEdits=128,
                  composedGoalSetterCalls=64, composedRouteAttachments=64,
                  composedJournalExtentFrees=1152, totalBaselineAndComposedJournalExtentFrees=2304 + (1152 if replay else 0),
                  composedPerCycleRetainedHeapBytes=0, composedPerCycleCrtPoolOccupancyPreserved=True,
                  composedPrivateActorRestoredAfterCommandDrain=True,
                  suppliedFixtureApproachOffsetPolicyQualified=True, persistentEntityCorrespondenceQualified=False,
                  privateCommandCompositionObservations=observations,
                  commandIntentTransferred=False, actorActivationQualified=False,
                  continuousPagingQualified=False, wholeBrowserMemoryBoundQualified=False,
                  composedPathInstructionAnchors=audit['verifiedInstructionAnchors'])
    for rel in ['scripts/check-native-actor-composed-arrival.py', 'scripts/audit-native-composed-arrival.py']:
        report['sourceSha256'][rel] = hashes.sha(ROOT / rel)
    if moves:
        report.update(inflightMovePointSetterCalls=64, inflightMoveDestinationHeightQueries=64,
                      inflightMoveRemainingDisplacementPreserved=True, inflightMoveOriginalFlagsAndRatesPreserved=True,
                      inflightMovePointObservations=list(moves.values()),
                      inflightMoveInstructionAnchors=move_audit['verifiedInstructionAnchors'])
        for rel in ['scripts/inspect-native-inflight-move.mjs', 'scripts/audit-native-inflight-move.py',
                    'web/world/terrain-ground.mjs', 'web/world/actor-coordinates.mjs']:
            report['sourceSha256'][rel] = hashes.sha(ROOT / rel)
        report['scope'] += '; includes 64 original in-flight Move point setters with independent pinned terrain heights'
    report['evidenceSha256'][str(writer.relative_to(ROOT))] = hashes.sha(writer)
    if replay:
        report['evidenceSha256'][str(replay_writer.relative_to(ROOT))] = hashes.sha(replay_writer)
        report['scope'] += '; includes 64 persisted original graph read/write/cleanup replays'
    return report


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__); p.add_argument('manifest', type=Path); p.add_argument('--output', type=Path, required=True)
    p.add_argument('--require-replay', action='store_true')
    p.add_argument('--require-disk-replay', action='store_true')
    args = p.parse_args(); result = verify(args.manifest, require_replay=args.require_replay, require_disk_replay=args.require_disk_replay)
    with args.output.open('x') as f:
        json.dump(result, f, indent=2); f.write('\n')
    print(json.dumps({k: result[k] for k in ['qualified', 'privateComposedActorCycles', 'composedOriginalRoutePointsValidated', 'maximumComposedSearchNodes', 'persistedComposedGraphOriginalReplays', 'actualSavedFileComposedGraphReplays', 'actorActivationQualified']}))

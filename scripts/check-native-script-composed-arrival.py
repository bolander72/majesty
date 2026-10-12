#!/usr/bin/env python3
"""Verify simultaneous private UNIT/EA/GPL/populated-command composition and exact files."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import struct
from importlib.util import spec_from_file_location, module_from_spec

ROOT = Path(__file__).resolve().parents[1]


def module(name):
    spec = spec_from_file_location(name, ROOT / 'scripts' / f'{name}.py')
    value = module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def verify(manifest, publication=False):
    meta = json.loads(manifest.read_text())
    if meta.get('scriptComposedArrival') is not True:
        raise ValueError('Missing same-actor script composition')
    if bool(meta.get('nativeIdentity')) != publication:
        raise ValueError('Native identity mode differs from requested qualification')
    stage = module('check-native-script-stage').verify(manifest)
    composed_module = module('check-native-actor-composed-arrival')
    composed = composed_module.verify(manifest, require_disk_replay=True)
    witness = module('check-native-actor-script-witness')
    prepared, info = module('prepare-native-script-stage').prepare()
    log = Path(meta['log']).read_text()
    warms = re.findall(r'^\[streaming\] Script compose tree warm agent=(\d+) inserted=1 erased=1 result=pass$', log, re.M)
    if list(map(int, warms)) != list(range(stage['counterBefore'], stage['counterBefore'] + 4)):
        raise ValueError('Missing original ID-tree warm/erase before steady allocation baselines')
    if re.search(r'^\[streaming\] Script composed .*result=fail$', log, re.M):
        raise ValueError('Original same-actor script composition failed')
    pattern = (r'^\[streaming\] Script composed actor=(\d+) trial=(\d+) old-agent=(\d+) new-agent=(\d+) '
               r'unit-id=0 world=0 backlink=1 self=2 leader=2 commands=(\d+) unit-equal=1 '
               r'script-equal=1 orders-equal=1 unscheduled=1 detached=1 erased=1 preserved=1 balanced=1 result=pass$')
    rows = re.findall(pattern, log, re.M)
    native_warms = []
    if publication:
        native_warms = re.findall(r'^\[streaming\] Native identity warm actor=(\d+) before=(\d+) id=(\d+) groups=(\d+) lookup=1 retired=1 result=pass$', log, re.M)
        if len(native_warms) != 4:
            raise ValueError('Missing all original native registry warm/retire witnesses')
        pattern = (r'^\[streaming\] Script published actor=(\d+) trial=(\d+) old-agent=(\d+) new-agent=(\d+) '
                   r'unit-id=(\d+) world=1 native-before=(\d+) groups=(\d+) lookup=1 backlink=1 '
                   r'self=2 leader=2 commands=(\d+) unit-equal=1 script-equal=1 orders-equal=1 '
                   r'unscheduled=1 detached=1 retired=1 erased=1 preserved=1 balanced=1 result=pass$')
        rows = re.findall(pattern, log, re.M)
        markers = re.findall(r'^\[streaming\] Native command marker actor=(\d+) trial=(\d+) before=0 after=1 orders-group=1 nonempty=1 retired=1 result=pass$', log, re.M)
        if [(a, t) for a, t in markers] != [(row[0], row[1]) for row in rows] or len(markers) != 64:
            raise ValueError('Missing exact original orders-registry marker transitions')
        if re.search(r'^\[streaming\] (Script published|Native identity warm) .*result=fail$', log, re.M):
            raise ValueError('Original native identity publication/retirement failed')
    if len(rows) != 64:
        raise ValueError('Missing all simultaneous UNIT/GPL/commands/writer/unlink/cleanup witnesses')
    raw = (Path(meta['profile']) / 'Populated_Order_Stage.bin').read_bytes()
    cases, targets = composed_module.cases_from_pack(raw)
    cursor, scripts = 40, {}
    for case in info['cases']:
        words = struct.unpack_from('<9I', prepared, cursor)
        cursor += 68
        scripts[case['unitId']] = prepared[cursor:cursor + words[2]]
        cursor += words[2]
    profile = Path(meta['profile'])
    evidence, observations = {}, []
    previous_native = None
    native_groups = None
    for index, row in enumerate(rows):
        native_id = 0
        if publication:
            actor, trial, old_id, reserved, native_id, native_before, groups, command_size = map(int, row)
            if index % 16 == 0:
                warm_actor, warm_before, warm_id, warm_groups = map(int, native_warms[index // 16])
                if (warm_actor != actor or warm_id != warm_before + 1 or groups != warm_groups or
                        not 0 < groups <= 128 or (previous_native is not None and warm_before != previous_native)):
                    raise ValueError('Native warmup actor, membership or monotonic reservation differs')
                previous_native = warm_id
                if native_groups is None:
                    native_groups = groups
            if (native_before != previous_native or native_id != native_before + 1 or
                    not 0 < native_id < 0x7fffffff or groups != native_groups):
                raise ValueError('Native world identity was reused, counter rewound or registry groups changed')
            previous_native = native_id
        else:
            actor, trial, old_id, reserved, command_size = map(int, row)
        case = cases[index // 16]
        script_case = info['cases'][index // 16]
        command = composed['privateCommandCompositionObservations'][index]
        if ([actor, trial, old_id, reserved, command_size] !=
                [case['id'], index % 16, script_case['sourceAgentId'], stage['counterAfter'] + index, command['serializedBytes']]):
            raise ValueError('Wrong same-actor cycle, fresh script identity or command size')
        # The complete original UNIT bytes independently derive from selected
        # literal source record and qualified ground/coordinate/cell transforms.
        expected_unit = bytearray(case['unit'])
        projected = composed['projectedActorCases'][index // 16]
        struct.pack_into('<I', expected_unit, 36, 0)
        struct.pack_into('<3i', expected_unit, 60, *projected['fixed'])
        struct.pack_into('<2i', expected_unit, 72, *projected['cells'])
        before_file = profile / f'Script_Composed_Before_{actor}_{trial}.bin'
        if before_file.read_bytes() != expected_unit:
            raise ValueError('Original composed UNIT baseline differs from literal grounded actor')
        struct.pack_into('<I', expected_unit, 36, native_id)
        # Independently find exactly one EA entry in the original native attribute map.
        at = 108
        if struct.unpack_from('<I', expected_unit, at)[0] != 1:
            raise ValueError('Unsupported native attributes')
        count = struct.unpack_from('<I', expected_unit, at + 4)[0]
        end = 32 + struct.unpack_from('<I', expected_unit, 20)[0]
        at += 8
        if count > (end - at) // 8:
            raise ValueError('Native attribute count exceeds PRIMARY')
        ea = [at + i * 8 + 4 for i in range(count)
              if struct.unpack_from('<I', expected_unit, at + i * 8)[0] == 0x4541]
        if len(ea) != 1 or struct.unpack_from('<I', expected_unit, ea[0])[0] != old_id:
            raise ValueError('Wrong original UNIT EA')
        struct.pack_into('<I', expected_unit, ea[0], reserved)
        expected_script = bytearray(scripts[actor])
        struct.pack_into('<I', expected_script, script_case['identityOffset'], reserved)
        struct.pack_into('<I', expected_script, script_case['nativeOffset'], native_id)
        for ref in script_case['references']:
            if ref['targetAgentId'] == old_id:
                struct.pack_into('<I', expected_script, ref['offset'], reserved)
        expected_orders = bytearray(case['payload'])
        if meta.get('rebaseInflightMove') is True:
            move = command['inflightMove']
            struct.pack_into('<3i', expected_orders, move['body'] + 104, *move['goal'])
        for clock in case['clocks']:
            stamp = (composed['destinationClockMs'] - ((composed['sourceClockMs'] - clock[4]) & 0xffffffff)) & 0xffffffff
            struct.pack_into('<I', expected_orders, clock[0], stamp)
        for ref in case['targets']:
            struct.pack_into('<I', expected_orders, ref[0], 497)
        body = case['body']
        struct.pack_into('<2i', expected_orders, body + 104, *command['goal'])
        for offset, value in [(120, 0), (128, 64), (136, command['count'])]:
            struct.pack_into('<I', expected_orders, body + offset, value)
        expected_orders[body + 140:body + 220] = b''.join(struct.pack('<2I', *point) for point in command['points'])
        if len(expected_orders) != command_size:
            raise ValueError('Independent composed graph size differs')
        for kind, expected in [('Unit', expected_unit), ('GPL', expected_script), ('Orders', expected_orders)]:
            file = profile / f'Script_Composed_{kind}_{actor}_{trial}.bin'
            actual = file.read_bytes()
            if actual != expected:
                raise ValueError('Actual simultaneous original ' + kind + ' writer artifact differs')
            evidence[str(file.relative_to(ROOT))] = hashlib.sha256(actual).hexdigest()
        parsed = witness.Script(expected_script).parse(reserved, native_id)
        destinations = [pair['words'] for pair in parsed['coordinatePairs'] if pair['attribute'] == 'destination' and not pair['path']]
        if destinations != [command['goal']]:
            raise ValueError('Same-actor script and Path destinations differ')
        observations.append(dict(actor=actor, trial=trial, reservedAgentId=reserved, unitId=native_id,
                                 commandBytes=command_size, nativeEAScriptId=reserved,
                                 scriptNativeId=native_id, nativeBacklinkObserved=True,
                                 pathAndScriptDestination=command['goal']))
    audit = module('audit-native-script-composed-arrival').audit()
    result = dict(qualified=True, scope='64 simultaneous private grounded UNIT/EA/GPL/populated-command associations, scoped script ID-tree visibility and original cached backlinks; no native world identity or activation',
                fixture=meta, privateScriptStage=stage, cycles=64, actualJointWriterRecords=192,
                sameActorScriptCommandCompositionQualified=True, actorNativeIdentityReserved=False,
                actorNativeRegistryPublished=False, scriptIdentityTreeEntriesRetired=64,
                scriptSchedulingPerformed=False, cachedNativeAssociationQualified=True,
                naturalNativeRegistryResolutionQualified=False, durablePairedReloadQualified=False,
                preservedPathAndScriptDestination=True, preservedScriptAndCommandAges=True,
                inflightMovePointSetterCalls=composed.get('inflightMovePointSetterCalls', 0),
                inflightMoveRemainingDisplacementPreserved=composed.get('inflightMoveRemainingDisplacementPreserved', False),
                counterBefore=stage['counterAfter'], counterAfter=stage['counterAfter'] + 64,
                steadyHeapGPLAndCRTPoolRecovery=True, originalsRestoredBeforeCommandCleanup=True,
                actorActivationQualified=False, continuousPagingQualified=False, wholeBrowserMemoryBoundQualified=False,
                completeReferenceClosureQualified=False, browserUsed=False, observations=observations,
                originalCachedSetterAnchors=audit['verifiedSetterInstructionAnchors'],
                sourceSha256=stage['sourceSha256'] | composed['sourceSha256'] | {str(Path(__file__).relative_to(ROOT)): witness.sha(Path(__file__)),
                  'scripts/audit-native-script-composed-arrival.py': witness.sha(ROOT / 'scripts/audit-native-script-composed-arrival.py')},
                evidenceSha256=stage['evidenceSha256'] | evidence)
    if publication:
        identity_audit = module('audit-native-world-identity').audit()
        result.update(scope='64 original world identity publications and natural script/native registry backlinks with exact UNIT/GPL/order writers and original registry retirement; no spatial publication, rendering or activation',
                      actorNativeIdentityReserved=True, actorNativeRegistryPublished=True,
                      naturalNativeRegistryResolutionQualified=True, nativeRegistryRetirements=64,
                      nativeWarmupRegistryRetirements=4, monotonicNativeReservations=68,
                      nativeCounterBefore=int(native_warms[0][1]), nativeCounterAfter=previous_native,
                      registryGroups=native_groups, nativeRegistryLogicalMembershipRestored=True,
                      originalNativeIdentityInstructionAnchors=identity_audit['verifiedInstructionAnchors'],
                      ownedDestructorDeferrals=68, spatialPublicationPerformed=False,
                      nativePublicationTagsResetAfterOriginalRegistryRetirement=True,
                      nativeCounterRewindPerformed=False)
        result.update(originalOrdersMarkerTransitionsQualified=64,
                      nativeUnitHeaderPreservedExceptOriginalOrdersMarker=True,
                      originalOrdersMarkerRetainedUntilOwnedDestruction=True)
        result['sourceSha256']['scripts/audit-native-world-identity.py'] = witness.sha(ROOT / 'scripts/audit-native-world-identity.py')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = verify(args.manifest)
    with args.output.open('x') as file:
        json.dump(result, file, indent=2)
        file.write('\n')
    print(json.dumps({key: result[key] for key in ['qualified', 'cycles', 'actualJointWriterRecords',
                                                 'sameActorScriptCommandCompositionQualified', 'actorActivationQualified']}))

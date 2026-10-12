#!/usr/bin/env python3
"""Run one isolated native populated-actor fixture; never starts a browser/build."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'upstream/majesty-recomp'


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as file:
        for block in iter(lambda: file.read(65536), b''):
            digest.update(block)
    return digest.hexdigest()


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('source_manifest', type=Path)
    p.add_argument('--attempt', required=True, type=int)
    p.add_argument('--clock-probe', action='store_true')
    p.add_argument('--target-cases', action='store_true')
    p.add_argument('--cross-source', action='store_true')
    p.add_argument('--cross-destination', type=Path, metavar='QUALIFIED_SOURCE_REPORT')
    p.add_argument('--navigation-probe', action='store_true')
    p.add_argument('--invalidate-path', action='store_true')
    p.add_argument('--landing-probe', action='store_true')
    p.add_argument('--fresh-route-probe', action='store_true')
    p.add_argument('--placement-probe', action='store_true')
    p.add_argument('--ground-probe', action='store_true')
    p.add_argument('--grounded-placement', action='store_true')
    p.add_argument('--composed-arrival', action='store_true')
    p.add_argument('--script-witness', action='store_true')
    p.add_argument('--private-script-stage', action='store_true')
    p.add_argument('--script-composed-arrival', action='store_true')
    p.add_argument('--native-identity', action='store_true')
    p.add_argument('--joint-checkpoint', action='store_true')
    p.add_argument('--rebase-inflight-move', action='store_true')
    args = p.parse_args()
    if sum([args.clock_probe, args.target_cases, args.cross_source, bool(args.cross_destination)]) > 1:
        p.error('Select one fixture mode')
    if args.navigation_probe and not args.cross_destination:
        p.error('Navigation probe requires the qualified cross-destination fixture')
    if args.invalidate_path and not args.navigation_probe:
        p.error('Path invalidation requires actual destination navigation probing')
    if args.landing_probe and not args.invalidate_path:
        p.error('Landing probe requires private path invalidation')
    if args.fresh_route_probe and not args.landing_probe:
        p.error('Fresh route probe requires original class collision probing')
    if args.placement_probe and not args.fresh_route_probe:
        p.error('Placement probe requires qualified original fresh-route probing')
    if args.ground_probe and not args.placement_probe:
        p.error('Ground probe requires original private coordinate restoration')
    if args.grounded_placement and not args.ground_probe:
        p.error('Grounded placement requires qualified original terrain queries')
    if args.composed_arrival and not args.grounded_placement:
        p.error('Composed arrival requires grounded private actor restoration')
    if args.script_witness and not (args.cross_source or args.cross_destination):
        p.error('Script witness requires an original cross-source or cross-destination fixture')
    if args.private_script_stage and not (args.cross_destination and args.script_witness and args.composed_arrival):
        p.error('Private script stage requires destination script witness and composed arrival')
    if args.script_composed_arrival and not args.private_script_stage:
        p.error('Script composed arrival requires private script stage')
    if args.native_identity and not args.script_composed_arrival:
        p.error('Native identity requires script composed arrival')
    if args.joint_checkpoint and not args.native_identity:
        p.error('Joint checkpoint requires native identity')
    if args.rebase_inflight_move and not args.script_composed_arrival:
        p.error('In-flight Move rebasing requires grounded script/command composition')
    previous = json.loads(args.source_manifest.read_text())
    source = Path(previous['source']).resolve()
    allowed = {'mod-settings.json', 'Documents/My Games/MajestyHD/MajXPrefs',
               'Documents/My Games/MajestyHD/questdata_majx.sav',
               'Documents/My Games/MajestyHD/SaveGame/(Scions of Chaos) 0 Days.GMP'}
    assert set(previous['sourceHashes']) == allowed
    assert source.is_relative_to((GAME / 'build').resolve()) and source.name == 'frontier_0_0'
    assert args.attempt > 0
    pack = ROOT / ('output/native-actor-cross-binding-fixtures.bin' if args.cross_source or args.cross_destination else
                   'output/native-actor-clock-stage-fixtures.bin' if args.clock_probe else
                   'output/native-actor-target-stage-fixtures.bin' if args.target_cases else
                   'output/native-actor-populated-stage-fixtures.bin')
    pack_meta = json.loads(pack.with_suffix('.json').read_text())
    assert pack.stat().st_size <= 32768 and sha(pack) == pack_meta['sha256']
    gmp_name = 'Documents/My Games/MajestyHD/SaveGame/(Scions of Chaos) 0 Days.GMP'
    world_pin = pack_meta['destinationSha256'] if args.cross_destination else pack_meta['sourceSha256']
    assert previous['sourceHashes'][gmp_name] == world_pin, 'World does not match actor pack'
    capture = None
    if args.cross_destination:
        proof_path = args.cross_destination.resolve()
        assert proof_path.parent == ROOT / 'output' and proof_path.stat().st_size < 2 * 1024 * 1024
        proof = json.loads(proof_path.read_text())
        spec = importlib.util.spec_from_file_location('cross_source', ROOT / 'scripts/check-native-actor-cross-source.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        checked = module.verify(Path(proof['fixture']['log']).with_suffix('.json'))
        assert proof['qualified'] is True and proof['sourceCapture'] == checked['sourceCapture']
        assert proof['fixture']['copiedCaseFileSha256'] == pack_meta['sha256']
        capture = Path(checked['sourceCapture']['path']).resolve()
        assert capture.parent == Path(checked['fixture']['profile']).resolve()
        assert capture.stat().st_size == 36 and sha(capture) == checked['sourceCapture']['sha256']
    label = ('native-actor-cross-destination' if args.cross_destination else
             'native-actor-cross-source' if args.cross_source else
             'native-actor-clock-stage' if args.clock_probe else
             'native-actor-target-stage' if args.target_cases else 'native-actor-populated-stage')
    manifest_path = ROOT / f'output/{label}-attempt-{args.attempt:03d}.json'
    log = manifest_path.with_suffix('.log')
    assert not manifest_path.exists() and not log.exists(), 'Preserve previous attempts'
    for name, digest in previous['sourceHashes'].items():
        assert sha(source / name) == digest, name
    run = Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-stage-populated-', dir=GAME / 'build'))
    profile = run / 'frontier_0_0'
    profile.mkdir()
    for name, digest in previous['sourceHashes'].items():
        target = profile / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source / name, target)
        assert sha(target) == digest, name
    for name in ['user-mods', 'frames']:
        (run / name).mkdir()
    shutil.copy2(GAME / 'smoke/frontier-fixed-load.script', run / 'load.script')
    shutil.copy2(pack, profile / 'Populated_Order_Stage.bin')
    meta = dict(source=str(source), fixture=str(run), profile=str(profile),
                sourceHashes=previous['sourceHashes'], beforeHashes=previous['sourceHashes'],
                copiedCaseFileSha256=pack_meta['sha256'], log=str(log),
                nativeOnly=True, browserUsed=False, nativeSessionTerminal=False,
                clockProbe=args.clock_probe, targetCases=args.target_cases, crossSource=args.cross_source,
                packMetadata=str(pack.with_suffix('.json')))
    meta['crossDestination'] = bool(args.cross_destination)
    meta['navigationProbe'] = args.navigation_probe
    meta['invalidatePath'] = args.invalidate_path
    meta['landingProbe'] = args.landing_probe
    meta['freshRouteProbe'] = args.fresh_route_probe
    meta['placementProbe'] = args.placement_probe
    meta['groundProbe'] = args.ground_probe
    meta['groundedPlacement'] = args.grounded_placement
    meta['rebaseInflightMove'] = args.rebase_inflight_move
    meta['composedArrival'] = args.composed_arrival
    meta['composedReplay'] = args.composed_arrival
    meta['composedDiskReplay'] = args.composed_arrival
    meta['scriptWitness'] = args.script_witness
    meta['privateScriptStage'] = args.private_script_stage
    meta['scriptComposedArrival'] = args.script_composed_arrival
    meta['nativeIdentity'] = args.native_identity
    meta['jointCheckpoint'] = args.joint_checkpoint
    if args.private_script_stage:
        stage_pack = ROOT / 'output/native-script-stage-fixtures.bin'
        stage_metadata = stage_pack.with_suffix('.json')
        stage_info = json.loads(stage_metadata.read_text())
        assert stage_pack.stat().st_size <= 8192 and sha(stage_pack) == stage_info['sha256']
        assert stage_info['format'] == 'NGS1' and stage_info['version'] == 1
        shutil.copy2(stage_pack, profile / 'Script_Stage_Pack.bin')
        meta['privateScriptPack'] = dict(path=str(stage_pack), sha256=sha(stage_pack),
                                       metadata=str(stage_metadata), metadataSha256=sha(stage_metadata))
    if args.script_witness:
        scripts = ROOT / 'output/native-actor-script-fixtures.bin'
        scripts_meta = scripts.with_suffix('.json')
        scripts_data = json.loads(scripts_meta.read_text())
        assert scripts_data['format'] == 'NSW1' and scripts_data['version'] == 1
        assert scripts.stat().st_size <= 32768 and sha(scripts) == scripts_data['sha256']
        assert scripts_data['sources'][int(bool(args.cross_destination))]['sha256'] == world_pin
        shutil.copy2(scripts, profile / 'Script_Witness_Pack.bin')
        meta['scriptPack'] = dict(path=str(scripts), sha256=sha(scripts),
                                  metadata=str(scripts_meta), metadataSha256=sha(scripts_meta))
    if args.placement_probe:
        placement = ROOT / 'output/native-actor-cross-placement-v2.bin'
        placement_meta = placement.with_suffix('.json')
        placement_data = json.loads(placement_meta.read_text())
        assert placement.stat().st_size == 252 and sha(placement) == placement_data['sha256']
        assert placement_data['sourcePackSha256'] == pack_meta['sha256']
        shutil.copy2(placement, profile / 'Cross_Placement.bin')
        meta['placementPack'] = dict(path=str(placement), sha256=sha(placement),
                                     metadata=str(placement_meta), metadataSha256=sha(placement_meta))
    if args.ground_probe:
        ground = ROOT / 'output/native-actor-ground-fixtures.bin'
        ground_meta = ground.with_suffix('.json')
        ground_data = json.loads(ground_meta.read_text())
        cpu = ROOT / 'output/native-ground-emulated-observed.json'
        cpu_data = json.loads(cpu.read_text())
        assert ground.stat().st_size == 108 and sha(ground) == ground_data['sha256']
        assert ground_data['placementMetadataSha256'] == meta['placementPack']['metadataSha256']
        assert cpu_data['qualified'] and cpu_data['fixtureMetadataSha256'] == sha(ground_meta)
        assert ground_data['source']['sha256'] == pack_meta['sourceSha256']
        assert ground_data['destination']['sha256'] == world_pin
        shutil.copy2(ground, profile / 'Ground_Samples.bin')
        meta['groundPack'] = dict(path=str(ground), sha256=sha(ground), metadata=str(ground_meta),
                                 metadataSha256=sha(ground_meta), cpuEvidence=str(cpu), cpuEvidenceSha256=sha(cpu))
    if capture:
        shutil.copy2(capture, profile / 'Cross_Source_Capture.bin')
        assert sha(profile / 'Cross_Source_Capture.bin') == sha(capture)
        meta['sourceCapture'] = dict(path=str(capture), sha256=sha(capture),
                                     qualification=str(proof_path), qualificationSha256=sha(proof_path))
    meta['nativeSourceSha256'] = {name: sha(ROOT / name) for name in
                                 ['upstream/majesty-recomp/browser_streaming.cpp',
                                  'upstream/majesty-recomp/game.toml']}
    meta['nativeSourceRecording'] = 'source files observed at process launch'
    if args.joint_checkpoint:
        meta['nativeSourceSha256']['upstream/majesty-recomp/browser_frontier.cpp'] = sha(GAME / 'browser_frontier.cpp')
    meta['nativeExecutableSha256AtLaunch'] = sha(GAME / 'build/recomp/pop_smoke')
    manifest_path.write_text(json.dumps(meta, indent=2) + '\n')
    env = {k: v for k, v in os.environ.items() if not k.startswith('RECOMP_')}
    env.update(RECOMP_PROFILE_DIR=str(profile), RECOMP_RULE_FRONTIER_REGION='0_0',
               RECOMP_RULE_INVENTORY_COMPAT='1', RECOMP_BROWSER_STREAMING_DEBUG='1',
               RECOMP_BROWSER_STREAMING_UNIT_FIXTURE='1', RECOMP_BROWSER_STREAMING_STAGE_FIXTURE='1',
               RECOMP_BROWSER_STREAMING_POPULATED_STAGE_FIXTURE='1', RECOMP_PIN_CLOCK='1',
               RECOMP_GUEST_ARGS='-nointro -dochecksums', RECOMP_SMOKE_SECONDS='45',
               RECOMP_SMOKE_WINDOW_INPUT='1', RECOMP_SMOKE_DRAWABLE='800x600',
               RECOMP_CORE_MODS_DIR=str(GAME / 'build/recomp/mods/core'),
               RECOMP_MODS_DIR=str(run / 'user-mods'), RECOMP_HOST_DUMP_DIR=str(run / 'frames'),
               RECOMP_SCRIPT=str(run / 'load.script'))
    if args.clock_probe:
        env['RECOMP_BROWSER_STREAMING_ORDER_CLOCK_FIXTURE'] = '1'
    if args.cross_source:
        env['RECOMP_BROWSER_STREAMING_CROSS_SOURCE_FIXTURE'] = '1'
    if args.cross_destination:
        env['RECOMP_BROWSER_STREAMING_CROSS_DESTINATION_FIXTURE'] = '1'
    if args.navigation_probe:
        env['RECOMP_BROWSER_STREAMING_CROSS_NAVIGATION_FIXTURE'] = '1'
    if args.invalidate_path:
        env['RECOMP_BROWSER_STREAMING_CROSS_REPLAN_FIXTURE'] = '1'
    if args.landing_probe:
        env['RECOMP_BROWSER_STREAMING_CROSS_LANDING_FIXTURE'] = '1'
    if args.fresh_route_probe:
        env['RECOMP_BROWSER_STREAMING_CROSS_ROUTE_FIXTURE'] = '1'
    if args.placement_probe:
        env['RECOMP_BROWSER_STREAMING_CROSS_PLACEMENT_FIXTURE'] = '1'
    if args.ground_probe:
        env['RECOMP_BROWSER_STREAMING_CROSS_GROUND_FIXTURE'] = '1'
    if args.grounded_placement:
        env['RECOMP_BROWSER_STREAMING_GROUNDED_PLACEMENT_FIXTURE'] = '1'
    if args.composed_arrival:
        env['RECOMP_BROWSER_STREAMING_COMPOSED_ARRIVAL_FIXTURE'] = '1'
    if args.script_witness:
        env['RECOMP_BROWSER_STREAMING_SCRIPT_WITNESS_FIXTURE'] = '1'
    if args.private_script_stage:
        env['RECOMP_BROWSER_STREAMING_PRIVATE_SCRIPT_STAGE_FIXTURE'] = '1'
    if args.script_composed_arrival:
        env['RECOMP_BROWSER_STREAMING_SCRIPT_COMPOSE_FIXTURE'] = '1'
    if args.native_identity:
        env['RECOMP_BROWSER_STREAMING_NATIVE_IDENTITY_FIXTURE'] = '1'
    if args.joint_checkpoint:
        env['RECOMP_BROWSER_STREAMING_JOINT_CHECKPOINT_FIXTURE'] = '1'
    if args.rebase_inflight_move:
        env['RECOMP_BROWSER_STREAMING_REBASE_MOVE_FIXTURE'] = '1'
    with log.open('x') as output:
        process = subprocess.Popen([str(GAME / 'build/recomp/pop_smoke')], cwd=GAME / 'kit',
                                   stdout=output, stderr=subprocess.STDOUT, env=env)
        meta['nativePid'] = process.pid
        manifest_path.write_text(json.dumps(meta, indent=2) + '\n')
        print(json.dumps(dict(nativePid=process.pid, fixture=run.name)), flush=True)
        code = process.wait()
    meta.update(nativeExitCode=code, nativeSessionTerminal=True)
    manifest_path.write_text(json.dumps(meta, indent=2) + '\n')
    print(json.dumps(dict(nativeExitCode=code, nativeSessionTerminal=True)), flush=True)
    raise SystemExit(code)


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Inspect a stopped candidate's linked protocol and memory metadata, without running WASM."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('memory_contract', ROOT/'scripts/audit-wasm-memory-contract.py')
contract = importlib.util.module_from_spec(spec)
spec.loader.exec_module(contract)


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        while chunk := f.read(4096):
            h.update(chunk)
    return h.hexdigest()


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('build_report', type=Path)
    p.add_argument('output', type=Path)
    p.add_argument('--require-coop-load-coordinator', action='store_true',
                   help='Require the frozen shared-load coordinator sources and linked stage strings; no runtime qualification.')
    p.add_argument('--require-coop-dispatch-return', action='store_true',
                   help='Require compiled original tick/rebuild return guards and production handoff wiring; static only.')
    p.add_argument('--require-coop-bound-graph', action='store_true',
                   help='Require the coordinator proxy/registry/manager all bound to its typed context; static only.')
    p.add_argument('--require-coop-checkpoint-ready', action='store_true',
                   help='Also require the linked checkpoint Ready stage; requires the coordinator check.')
    p.add_argument('--require-coop-checkpoint-begin', action='store_true',
                   help='Also require the linked host Begin stage and travel actions; requires the Ready check.')
    p.add_argument('--require-coop-checkpoint-delivery', action='store_true',
                   help='Require linked delivery contract/game inbox strings and frozen provider/file sources; static only.')
    p.add_argument('--require-coop-network-retirement', action='store_true',
                   help='Require the frozen travel buffer-retirement sources and linked completion string; static only.')
    p.add_argument('--require-coop-rebuild-loading', action='store_true',
                   help='Require the scoped committed travel loading gate and linked refusal paths; static only.')
    p.add_argument('--require-coop-saved-ui-restore', action='store_true',
                   help='Require the committed saved-world UI scope and linked completion string; static only.')
    p.add_argument('--require-saved-configuration', action='store_true',
                   help='Require original owning scenario restoration in solo/shared readers and its linked guards; static only.')
    p.add_argument('--require-gpl-agent-initialization', action='store_true',
                   help='Require the linked deterministic new GPL agent scalar override; saved readers remain original, static only.')
    p.add_argument('--require-coop-generation-defaults', action='store_true',
                   help='Require admitted co-op terrain RNG seeding and new view defaults; static only.')
    p.add_argument('--require-network-start-timing', action='store_true',
                   help='Require the original network constructor timing override and linked completion string; static only.')
    p.add_argument('--require-hero-generation', action='store_true',
                   help='Require linked hero retirement/generation/initialization/import/publication stages and complete actor/order source hashes; static only.')
    p.add_argument('--require-hero-remote-restore', action='store_true',
                   help='Require shared original-reader remote-owner admission and linked restore strings; static only.')
    a = p.parse_args()
    if a.require_coop_dispatch_return and not a.require_coop_load_coordinator:
        p.error('The dispatch return check requires --require-coop-load-coordinator')
    if a.require_coop_bound_graph and not a.require_coop_load_coordinator:
        p.error('The bound graph check requires --require-coop-load-coordinator')
    if a.require_coop_checkpoint_ready and not a.require_coop_load_coordinator:
        p.error('The Ready check requires --require-coop-load-coordinator')
    if a.require_coop_checkpoint_begin and not a.require_coop_checkpoint_ready:
        p.error('The Begin check requires --require-coop-checkpoint-ready')
    if a.require_coop_checkpoint_delivery and not a.require_coop_checkpoint_begin:
        p.error('The delivery check requires --require-coop-checkpoint-begin')
    if a.require_coop_network_retirement and not a.require_coop_load_coordinator:
        p.error('The retirement check requires --require-coop-load-coordinator')
    if a.require_coop_rebuild_loading and not a.require_coop_load_coordinator:
        p.error('The rebuild loading check requires --require-coop-load-coordinator')
    if a.require_coop_saved_ui_restore and not a.require_coop_rebuild_loading:
        p.error('The saved UI check requires --require-coop-rebuild-loading')
    if a.output.exists():
        p.error('Preserve earlier candidate inspections')
    assert a.build_report.stat().st_size <= 512*1024
    m = json.loads(a.build_report.read_text())
    assert m['buildQualified'] and m['buildTerminal'] and m['exitCode'] == 0 and m['stopReason'] is None
    assert m['servedUnchanged'] and m['sourcesUnchanged'] and not m['browserUsed'] and m['gameProcessesStarted'] == 0
    directory = Path(m['candidate'])
    assert directory.resolve() == directory and directory.parent == ROOT/'upstream/majesty-recomp/build'
    assert directory.name.startswith('actor-arrival-fixture-wasm-session-candidate-')
    for name, artifact in m['artifacts'].items():
        path = directory/name
        assert str(path) == artifact['filename'] and path.stat().st_size == artifact['bytes'] <= 256*1024*1024
        assert sha(path) == artifact['sha256']
    for name, digest in m['sourceSha256'].items():
        assert sha(ROOT/name) == digest
    path = directory/'MajestyRecomp.wasm'
    with path.open('rb', buffering=0) as file:
        memory = contract.inspect(file, path.stat().st_size)
    assert memory['memories'] == [dict(importModule='env', importName='memory', minimumPages=8192, maximumPages=65536, shared=True)]
    needles = [b'[frontier] Session enabled version=v1', b'[frontier] Session quit serial=',
               b'[frontier] Session unloaded serial=', b'[frontier] Session attached serial=', b'frontier-travel-west',
               b'[frontier] Session released serial=', b'[frontier] Session release observer removed serial=',
               b'roots-freed=1,1,1,1,1,1,1,1 terrain-bytes=530456 spatial-bytes=524288',
               b'root=%s release=v2']
    if a.require_coop_load_coordinator:
        for name in ['browser_frontier.cpp', 'browser_campaign.cpp',
                     'coop_restore.h', 'coop_pause.h', 'coop_checkpoint.h']:
            assert 'upstream/majesty-recomp/'+name in m['sourceSha256']
        needles.extend([b'[coop-load] Attached epoch=', b'[coop-load] Held epoch=',
                        b'[coop-load] Loaded epoch=', b'[coop-load] Resume queued epoch=',
                        b'[coop-load] Resumed epoch=', b'[coop-load] Rejected epoch='])
        if a.require_coop_checkpoint_ready:
            frontier = (ROOT/'upstream/majesty-recomp/browser_frontier.cpp').read_text()
            checkpoint = (ROOT/'upstream/majesty-recomp/coop_checkpoint.h').read_text()
            assert 'coop_source_checkpoint_writable(party, barrier, retained)' in frontier
            assert 'recomp_network_barrier_snapshot(epoch, &barrier);' in frontier
            assert 'if (!recomp_network_session_info(epoch, &party)) return false;' in frontier
            assert 'return barrier.stage == 1 && !party.host && !retained_this_proposal;' in checkpoint
            needles.extend([b'[coop-load] Ready epoch=',
                            b'[coop-load] Source publication frozen epoch='])
        if a.require_coop_checkpoint_begin:
            needles.extend([b'[coop-load] Begin epoch=', b'coop-travel-west',
                            b'coop-travel-east', b'coop-travel-north', b'coop-travel-south'])
    if a.require_coop_checkpoint_delivery:
        for name in ['browser_frontier.cpp', 'coop_checkpoint.h',
                     'kit/dx/directplay.cpp', 'kit/runtime/native_seam.h']:
            assert 'upstream/majesty-recomp/'+name in m['sourceSha256']
        needles.extend([b'checkpoint-delivery-v1', b'.CoopReceived-',
                        b'[coop-transfer] Rejected epoch='])
    if a.require_coop_dispatch_return:
        for name in ['coop_restore.h', 'browser_frontier.cpp']:
            assert 'upstream/majesty-recomp/'+name in m['sourceSha256']
        restore = (ROOT/'upstream/majesty-recomp/coop_restore.h').read_text()
        frontier = (ROOT/'upstream/majesty-recomp/browser_frontier.cpp').read_text()
        for token in ['coop_outer_tick_boundary', 'coop_complete_outer_tick',
                      '0x00415e88u', 'coop_outer_rebuild_boundary',
                      'coop_complete_outer_rebuild', '0x00415e7fu']:
            assert token in restore
        for token in ['!majesty::coop_outer_tick_boundary(c)',
                      'if (!majesty::coop_complete_outer_tick(c)) std::abort();',
                      'if (!majesty::coop_outer_rebuild_boundary(c) ||',
                      'if (!majesty::coop_complete_outer_rebuild(c)) std::abort();']:
            assert token in frontier
    if a.require_coop_bound_graph:
        assert 'upstream/majesty-recomp/browser_frontier.cpp' in m['sourceSha256']
        frontier = (ROOT/'upstream/majesty-recomp/browser_frontier.cpp').read_text()
        coordinator = frontier[frontier.index('struct CoopLoadCoordinator {'):]
        roots = coordinator[coordinator.index('  bool roots() const {'):
                            coordinator.index('  bool clocks() const {')]
        for token in ['rd32(world) == 0x0067f85cu', 'registry == context',
                      'rd32(manager + 0xc0) == context',
                      'context == rd32(world + 4)', 'registry == rd32(world + 0x10)',
                      'rd32(context) == 0x00682950']:
            assert token in roots
    if a.require_coop_network_retirement:
        for name in ['browser_frontier.cpp', 'coop_restore.h', 'coop_pause.h']:
            assert 'upstream/majesty-recomp/'+name in m['sourceSha256']
        needles.append(b'[coop-load] Source network buffers retired serial=')
    if a.require_coop_rebuild_loading:
        assert 'upstream/majesty-recomp/browser_frontier.cpp' in m['sourceSha256']
        frontier = (ROOT/'upstream/majesty-recomp/browser_frontier.cpp').read_text()
        for token in ['class CoopRebuildLoadingScope', 'caller != 0x00416cdcu',
                      'caller == 0x00416edau', 'wr32(p.manager_ + 0xc8, 0u)',
                      'wr32(p.manager_ + 0xc8, p.connection_)',
                      'if (coop_load.stage == CoopLoadCoordinator::Stage::attaching)',
                      'coop_load.agreement(barrier) && barrier.stage == 2']:
            assert token in frontier
        needles.extend([b'rebuild-loading-admission', b'rebuild-loading-restoration'])
    if a.require_coop_saved_ui_restore:
        frontier = (ROOT/'upstream/majesty-recomp/browser_frontier.cpp').read_text()
        for token in ['bool (*boundary_check)(const void *)',
                      '(!boundary_check || boundary_check(boundary_user))',
                      'preserve = p.preserve_selection && (flags & 1) != 0',
                      '}, coop_load.party.host != 0);',
                      'session_ui_restore.begin(coop_load.context, &boundary',
                      'if (coop_load.target.target_saved) session_ui_restore.end()']:
            assert token in frontier
        needles.append(b'[frontier] Session UI restored region=')
    if a.require_saved_configuration:
        name = 'upstream/majesty-recomp/browser_frontier.cpp'
        assert name in m['sourceSha256']
        frontier = (ROOT/name).read_text()
        assert 'bool restore_saved_configuration(X86 *c, uint32_t context)' in frontier
        assert 'restore_saved_configuration(c, context)' in frontier
        assert 'restore_saved_configuration(c, rd32(output))' in frontier
        assert 'guest_call(&extra, 0x004ad0f0, configuration)' in frontier
        assert 'restored_kind != kind' in frontier
        needles.extend([b'[frontier] Saved configuration restored kind=',
                        b'original-copy=004ad0f0 world-preserved=1 result=pass',
                        b'[frontier] Saved configuration refused owned-context-released=1 result=refused'])
    if a.require_network_start_timing:
        network_name = 'upstream/majesty-recomp/browser_network.cpp'
        overrides_name = 'upstream/majesty-recomp/browser_overrides.h'
        assert network_name in m['sourceSha256'] and overrides_name in m['sourceSha256']
        network = (ROOT/network_name).read_text()
        overrides = (ROOT/overrides_name).read_text()
        assert 'extern "C" void majesty_browser_network_construct(X86 *c)' in network
        assert 'fn_00497a00(c);' in network
        assert 'rd32(0x006c0ea0u)' in network
        assert 'wr32(manager + 0x88, timing);' in network
        assert '#define FN_00497a00 majesty_browser_network_construct' in overrides
        needles.extend([b'[network] Original manager timing initialized interval-ms=',
                        b'source=006c0ea0 original-constructor=00497a00 result=pass'])
    if a.require_gpl_agent_initialization:
        network_name = 'upstream/majesty-recomp/browser_network.cpp'
        overrides_name = 'upstream/majesty-recomp/browser_overrides.h'
        for name in [network_name, overrides_name]:
            assert m['sourceSha256'][name] == sha(ROOT/name)
        network = (ROOT/network_name).read_text()
        overrides = (ROOT/overrides_name).read_text()
        assert '#define FN_00625e70 majesty_browser_gpl_agent_construct' in overrides
        body = network.split('extern "C" void majesty_browser_gpl_agent_construct(X86 *c) {', 1)[1].split('\n}', 1)[0]
        assert body.index('fn_00625e70(c);') < body.index('wr32(agent + 0x2c, 0);')
        assert body.count('wr32(') == 1 and 'agent != self' in body and 'gm_valid(agent, 0x34)' in body
        needles.extend([b'[network] Original GPL agent saved scalar initialized ',
                        b'offset=2c value=0 original-constructor=00625e70 saved-reader-preserved=1 result=pass'])
    if a.require_coop_generation_defaults:
        for name in ['browser_frontier.cpp', 'browser_network.cpp', 'browser_overrides.h']:
            key = 'upstream/majesty-recomp/'+name
            assert m['sourceSha256'][key] == sha(ROOT/key)
        frontier = (ROOT/'upstream/majesty-recomp/browser_frontier.cpp').read_text()
        network = (ROOT/'upstream/majesty-recomp/browser_network.cpp').read_text()
        overrides = (ROOT/'upstream/majesty-recomp/browser_overrides.h').read_text()
        assert '#define FN_004384b0 majesty_browser_view_construct' in overrides
        view = network.split('extern "C" void majesty_browser_view_construct(X86 *c) {',1)[1].split('\n}',1)[0]
        assert view.index('wr32(view + offset, 0);') < view.index('fn_004384b0(c);')
        assert '{0x18u, 0x38u, 0x3cu, 0x40u, 0x44u}' in view
        assert 'gm_valid(view, 0x58)' in view and 'sp + 28' in view
        seeded = frontier.split('extern "C" void majesty_browser_frontier_generate(X86 *c) {',1)[1].split('fn_004b23d0(c);',1)[0]
        assert 'if (shared) {' in seeded
        assert 'guest_call(&extra, 0x004f6730u)' in seeded
        assert 'guest_call(&extra, 0x004f6710u, r.seed);' in seeded
        assert 'terrain_rng != 0x006d8e80u' in seeded
        needles.extend([b'[network] Original view saved defaults initialized ',
                        b'offsets=18,38,3c,40,44 original-constructor=004384b0 ',
                        b'[coop-generation] Original terrain RNG seeded ',
                        b'original-setter=004f6710 gameplay-rng-separate=1 result=pass'])
    renderer_sources = ['upstream/majesty-recomp/kit/dx/'+name
                        for name in ['com.cpp', 'com.h', 'ddraw.cpp', 'ddraw.h']]
    renderer_recorded = any(name in m['sourceSha256'] for name in renderer_sources)
    if renderer_recorded:
        assert all(name in m['sourceSha256'] for name in renderer_sources)
        needles.append(b'COM object identities exhausted')
    receiver_sources = ['upstream/majesty-recomp/'+name for name in [
        'browser_network.cpp', 'browser_overrides.h', 'browser_viewport.cpp',
        'native_received_checkpoint.cpp', 'native_received_checkpoint.h',
        'native_received_transfer.cpp', 'native_received_transfer.h',
        'kit/dx/directplay.cpp', 'kit/runtime/native_seam.h',
        'kit/runtime/mods_seam.cpp', 'kit/runtime/kernel32.cpp']]
    receiver_recorded = any(name in m['sourceSha256'] for name in receiver_sources)
    if receiver_recorded:
        assert all(name in m['sourceSha256'] for name in receiver_sources)
        needles.extend([b'BROWSER_RECEIVED_CHECKPOINT', b'staged-v1',
                        b'[resume] Received checkpoint BEGIN staged',
                        b'[resume] Received checkpoint END committed bytes=',
                        b'[resume] Received checkpoint rejected:'])
    lobby_global_recorded = 'upstream/majesty-recomp/globals.toml' in m['sourceSha256']
    if lobby_global_recorded:
        assert receiver_recorded
        # These linked reason strings bind the new loss-after-END path. Source
        # hashes include its curated address; native runtime tests separately
        # qualify the write/notification/reset behavior. No WASM is executed.
        needles.extend([b'session connection lost',
                        b'session ended before checkpoint publication'])
    if a.require_hero_generation:
        for name in ['browser_frontier.cpp', 'browser_streaming.cpp',
                     'native_order_storage.cpp', 'native_order_storage.h',
                     'native_order_allocation.cpp', 'native_order_allocation.h',
                     'native_order_hooks.cpp', 'native_order_hooks.h',
                     'native_actor_stage.cpp', 'native_actor_stage.h',
                     'native_actor_profile.h', 'native_order_payload.h']:
            assert 'upstream/majesty-recomp/'+name in m['sourceSha256']
        needles.extend([b'[frontier] Hero generation request refused serial=',
                        b'[frontier] Hero generation request consumed serial=',
                        b'[frontier] Hero generation held serial=',
                        b'[frontier] Hero generation initialized serial=',
                        b'[streaming] Selected hero retired unit=',
                        b'[frontier] Hero proxy home input consumed serial=',
                        b'[frontier] Hero travel publication held receipt=',
                        b'[frontier] Hero travel publication accepted serial=',
                        b'[frontier] Hero travel resumed serial='])
    if a.require_hero_remote_restore:
        for name in ['browser_frontier.cpp', 'browser_streaming.cpp']:
            assert 'upstream/majesty-recomp/'+name in m['sourceSha256']
        frontier = (ROOT/'upstream/majesty-recomp/browser_frontier.cpp').read_text()
        streaming = (ROOT/'upstream/majesty-recomp/browser_streaming.cpp').read_text()
        assert 'b.proxy_home=fields[7]=="proxy"' in frontier
        assert 'b.proxy_home&&b.enabled&&b.source_checked&&!b.failed&&b.halo_layout' in frontier
        assert 'majesty_browser_streaming_restore_remote_hero_binding' in streaming
        needles.extend([b'[streaming] Selected remote hero restored unit=',
                        b'original-loader=1 remote-guard=1 imported=0 reactivated=0'])
    found, carry = set(), b''
    with path.open('rb') as file:
        while chunk := file.read(4096):
            view = carry+chunk
            for index, needle in enumerate(needles):
                if needle in view:
                    found.add(index)
            carry = view[-max(map(len, needles)):]
    assert len(found) == len(needles), 'Linked session protocol strings missing'
    glue_path = directory/'MajestyRecomp.js'
    assert glue_path.stat().st_size <= 2*1024*1024
    glue = glue_path.read_text()
    marker = 'function _emscripten_resize_heap(requestedSize) {'
    start = glue.find(marker)
    end = glue.find('\n}\n', start)+2
    assert start >= 0 and end > start and glue.find(marker, start+1) == -1
    body = glue[start:end]
    assert len(body) < 8192
    assert re.search(r'oldSize\s*\*\s*\(1\s*\+\s*(?:\.05|0\.05)\s*/\s*cutDown\)', body)
    assert re.search(r'Math\.min\(overGrownHeapSize,\s*requestedSize\s*\+\s*16777216\)', body)
    assert 'var INITIAL_MEMORY = 536870912;' in glue and 'var pthreadPoolSize = 8;' in glue
    assert 'wasmMemory = msgData.wasmMemory;' in glue and '4294901760;' in glue
    for name, before in m['servedBefore'].items():
        served = ROOT/'upstream/majesty-recomp/build/web-site/majesty'/name
        s = served.stat()
        assert sha(served) == before['sha256'] and (s.st_ino, s.st_mtime_ns) == (before['inode'], before['mtimeNs'])
    result = dict(version=1, staticQualified=True, browserQualified=False, browserUsed=False, gameProcessesStarted=0,
                  buildReport=str(a.build_report.resolve()), buildReportSha256=sha(a.build_report), candidate=str(directory),
                  wasmSha256=m['artifacts']['MajestyRecomp.wasm']['sha256'], memoryMetadata=memory,
                  linkedProtocolStrings=[needle.decode() for needle in needles], compiledConservativePolicyPresent=True,
                  linkedRootReleaseProtocolPresent=True,
                  linkedTerrainBufferReleaseProtocolPresent=True, releaseContract='v2',
                  compiledRendererSourceHashesRecorded=renderer_recorded,
                  linkedComIdentityGuardPresent=renderer_recorded,
                  compiledReceivedCheckpointSourceHashesRecorded=receiver_recorded,
                  linkedStagedReceiverProtocolPresent=receiver_recorded,
                  compiledLobbyExitGlobalSourceHashRecorded=lobby_global_recorded,
                  linkedReceiverLossReasonStringsPresent=lobby_global_recorded,
                  compiledCompleteActorOrderSourceHashesRecorded=a.require_hero_generation,
                  linkedHeroFreshGenerationStagesPresent=a.require_hero_generation,
                  linkedSelectedRemoteOwnerRestorePresent=a.require_hero_remote_restore,
                  productionSelectedRemoteOwnerRestoreExecuted=False,
                  heroFreshGenerationRuntimeQualified=False,
                  linkedCoopLoadCoordinatorStagesPresent=a.require_coop_load_coordinator,
                  compiledCoopDispatchReturnGuardsPresent=a.require_coop_dispatch_return,
                  browserCoopDispatchReturnExecuted=False,
                  compiledCoopBoundGraphGuardsPresent=a.require_coop_bound_graph,
                  browserCoopBoundGraphExecuted=False,
                  linkedCoopCheckpointReadyStagePresent=a.require_coop_checkpoint_ready,
                  linkedCoopCheckpointBeginStagePresent=a.require_coop_checkpoint_begin,
                  linkedCoopCheckpointDeliveryProtocolPresent=a.require_coop_checkpoint_delivery,
                  linkedCoopNetworkRetirementStagePresent=a.require_coop_network_retirement,
                  linkedCoopRebuildLoadingGuardPresent=a.require_coop_rebuild_loading,
                  committedCoopRebuildLoadingRuntimeQualified=False,
                  linkedCoopSavedUiRestorationScopePresent=a.require_coop_saved_ui_restore,
                  linkedRoleAwareSharedSelectionPolicyPresent=a.require_coop_saved_ui_restore,
                  linkedCoopSourcePublicationFreezePresent=a.require_coop_checkpoint_ready,
                  committedCoopSavedUiRuntimeQualified=False,
                  linkedNewGplAgentScalarInitializationPresent=a.require_gpl_agent_initialization,
                  linkedCoopGenerationDefaultsPresent=a.require_coop_generation_defaults,
                  browserNewGplAgentInitializationQualified=False,
                  linkedSavedConfigurationRestorationPresent=a.require_saved_configuration,
                  browserSavedConfigurationRestorationExecuted=False,
                  linkedOriginalNetworkStartTimingPresent=a.require_network_start_timing,
                  browserOriginalNetworkStartTimingExecuted=False,
                  productionCoopNetworkRetirementExecuted=False,
                  productionGameCheckpointDeliveryExecuted=False,
                  productionHostBeginExecuted=False,
                  productionReadyAdapterExecuted=False,
                  productionCoopCoordinatorExecuted=False,
                  geometricGrowthStepPercent=5, excessCapBytes=16777216, initialMemoryBytes=536870912, preloadedWorkers=8,
                  resizeFunctionSha256=hashlib.sha256(body.encode()).hexdigest(), servedArtifactsUnchanged=True,
                  realWasmMemoryAllocated=False, sustainedMemoryBoundQualified=False, crashResolved=False,
                  scope='Official completed build, bounded metadata parsing and linked strings/glue settings only; no module instantiation or gameplay.',
                  sourceSha256={str(Path(__file__).relative_to(ROOT)):sha(Path(__file__)),
                                'scripts/audit-wasm-memory-contract.py':sha(ROOT/'scripts/audit-wasm-memory-contract.py')})
    with a.output.open('x') as file:
        json.dump(result, file, indent=2)
        file.write('\n')
    print(json.dumps(dict(staticQualified=True, wasmMetadataBytesRead=memory['logicalBytesRead'], browserQualified=False)))


if __name__ == '__main__':
    main()

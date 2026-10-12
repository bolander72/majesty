#!/usr/bin/env python3
"""Qualify one bounded natural command continuation after an original full reload."""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import struct

ROOT = Path(__file__).resolve().parents[1]


def verify(manifest):
    spec = importlib.util.spec_from_file_location('joint_reload', ROOT / 'scripts/check-native-joint-reload.py')
    reload = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(reload)
    result = reload.verify(manifest)
    m = result['fixture']
    if m.get('observeMotion') is not True or m.get('clockMode') != 'monotonic':
        raise ValueError('Natural motion requires opt-in bounded observation and advancing clock')
    producer = json.loads(Path(m['sourceManifest']).read_text())
    identity = json.loads(Path(m['sourceIdentityReport']).read_text())
    if (producer.get('rebaseInflightMove') is not True or identity.get('inflightMovePointSetterCalls') != 64 or
            identity.get('inflightMoveRemainingDisplacementPreserved') is not True):
        raise ValueError('Missing qualified producer in-flight Move transform')
    log = Path(m['log']).read_text()
    begin = re.findall(r'^\[streaming\] Joint motion begin unit=(\d+) agent=(\d+) frame=(\d+) clock=(\d+) fixed=(-?\d+),(-?\d+) hooks=(4|6) bounded=1$', log, re.M)
    if len(begin) != 1:
        raise ValueError('Missing exactly one owned bounded motion observer')
    unit, agent, frame, clock, x, y, hook_count = map(int, begin[0])
    scripted = m.get('scheduleNpc') is True or m.get('reloadScheduledNpc') is True or m.get('reloadEvolvedNpc') is True
    if hook_count != (6 if scripted else 4):
        raise ValueError('Wrong delegating observer hook count for scheduling mode')
    expected_unit = (Path(m['profile']) / 'Script_Composed_Unit_2101_0.bin').read_bytes()
    if [unit, agent] != [m['unitId'], m['agentId']] or [x, y] != list(struct.unpack_from('<2i', expected_unit, 60)):
        raise ValueError('Motion observer does not own the exact restored actor')
    rows = re.findall(r'^\[streaming\] Joint motion sample elapsed=(\d+) clock=(\d+) fixed=(-?\d+),(-?\d+) cells=(-?\d+),(-?\d+) physical=(\d+) footprint=(\d+) drawing=(\d+) marker=(\d+) calls=(\d+) leaves=(\d+) path=(\d+) links=(\d+)$', log, re.M)
    samples = [list(map(int, row)) for row in rows]
    if [s[0] for s in samples] != list(range(0, 241, 16)):
        raise ValueError('Missing complete 240-tick bounded samples')
    for sample in samples:
        elapsed, now, px, py, cx, cy, physical, footprint, drawing, marker, calls, leaves, path, links = sample
        if (now != clock + elapsed * 50 or not 0 <= px < 8388608 or not 0 <= py < 8388608 or
                not 0 <= cx < 256 or not 0 <= cy < 256 or physical != 1 or not 0 < footprint <= 1024 or
                drawing < 1 or marker & 1 != 1 or links != 1 or leaves > calls or path > leaves):
            raise ValueError('Broken clock, bounds, declared footprint, drawing registration, command marker or backlinks')
    if samples[0][2:4] != [x, y] or samples[0][10:13] != [0, 0, 0]:
        raise ValueError('Observation did not begin before natural command dispatch')
    if len({tuple(s[2:4]) for s in samples}) < 3 or samples[-1][4:6] == samples[0][4:6]:
        raise ValueError('No sampled movement and original navigation-cell transition')
    completed = re.findall(r'^\[streaming\] Joint motion completed ticks=(\d+) calls=(\d+) returns=(\d+) leaves=(\d+) leaf-returns=(\d+) path=(\d+) changed=(\d+) physical=(\d+) drawing=(\d+) clock-advanced=(\d+) hooks-removed=(\d+) valid=(\d+) samples=(\d+) result=pass$', log, re.M)
    if len(completed) != 1:
        raise ValueError('Missing successful observer termination and hook removal')
    ticks, calls, returns, leaves, leaf_returns, path, changed, physical, drawing, advanced, removed, valid, count = map(int, completed[0])
    if (ticks != 240 or calls == 0 or calls != returns or leaves == 0 or leaves != leaf_returns or path == 0 or
            not 0 < changed <= 241 or [physical, drawing, advanced, removed, valid] != [1] * 5 or count != len(samples) or
            [calls, leaves, path] != samples[-1][10:13]):
        raise ValueError('Unbalanced delegation, missing original Path dispatch or incomplete cleanup')
    result.update(scope='One restored grounded NPC naturally dispatches original commands including Path for 240 ticks; bounded declared-footprint membership and drawing registration observations; no general transfer, rendered-pixel, continuous-region or browser-resource qualification',
                  actorMovementQualified=True, naturalCommandMovementQualified=True, observedTicks=ticks,
                  originalDispatchCalls=calls, originalLeafCalls=leaves, originalPathCalls=path,
                  originalNavigationCellTransitionQualified=True, physicalMembershipOfDeclaredFootprintQualified=True,
                  drawingRegistrationQualified=True, observerHooksRemoved=True, motionSamples=samples,
                  renderedPixelsQualified=False, generalActorTransferQualified=False)
    result['sourceSha256'][str(Path(__file__).relative_to(ROOT))] = reload.sha(Path(__file__))
    if scripted:
        ai = re.findall(r'^\[streaming\] Joint script motion completed ticks=(\d+) agent-calls=(\d+) agent-returns=(\d+) contexts=(\d+) context-returns=(\d+) executed=(\d+) hooks-removed=1 result=pass$', log, re.M)
        if len(ai) != 1:
            raise ValueError('Missing bounded original AI execution and hook cleanup')
        ticks, agents, returns, contexts, context_returns, executed = map(int, ai[0])
        if ticks != 240 or not agents or agents != returns or not contexts or contexts != context_returns or not 0 < executed <= contexts:
            raise ValueError('Missing AI actions or unbalanced agent/context delegation')
        result.update(originalAiExecutionQualified=True, originalAgentCalls=agents,
                      originalContextCalls=contexts, originalContextActions=executed,
                      freshScheduledWorldReloadQualified=m.get('reloadScheduledNpc') is True)
        if m.get('reloadEvolvedNpc') is True:
            result['freshEvolvedWorldReloadQualified'] = True
            result['scope'] += '; fresh evolved-state original world and scheduling reload'
        result['scope'] += '; original AI/context execution qualified for this NPC' + (' after a fresh saved-queue reload without reinsertion' if m.get('reloadScheduledNpc') is True else ' after original queue insertion')
    return result


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('manifest', type=Path)
    p.add_argument('--output', type=Path, required=True)
    a = p.parse_args()
    result = verify(a.manifest.resolve())
    with a.output.open('x') as f:
        json.dump(result, f, indent=2)
        f.write('\n')
    print(json.dumps({k: result[k] for k in ['qualified', 'observedTicks', 'originalPathCalls', 'actorMovementQualified', 'observerHooksRemoved']}))

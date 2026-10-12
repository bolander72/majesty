#!/usr/bin/env python3
"""Compare owned original-spin and scheduler-delay native initialization waits.

Run after both sequential native producers and their packet audits terminate.
This measures one host waiting for a worldless reference, never gameplay or
browser performance, and never counts a reference as a second loaded engine.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(4096), b''):
            digest.update(block)
    return digest.hexdigest()


def observation(path, packet_audit, spin):
    report = json.loads(path.read_text())
    audit = json.loads(packet_audit.read_text())
    assert audit['observationSha256'] == sha(path)
    assert report['originalLoadingSpinFixture'] == spin
    assert report['nativeExitCode'] == 0 and report['nativeSessionTerminal']
    assert report['producerAbsent'] and report['fixtureStopped']
    assert not report.get('stopReason') and not report.get('referenceError')
    assert report['servedUnchanged'] and report['originalSettingsUnchanged']
    assert report['referenceReadyConfirmed'] and report['referenceSawSessionLoss']
    assert not report['browserUsed'] and not report['gameplayQualified']
    assert audit['originalGameStartPacketVerified'] and audit['originalGoStatusPacketVerified']
    assert audit['originalInitializationWaitObserved'] and not audit['mapLoaded']
    assert audit['originalInitializationPollIntervalMs'] == (0 if spin else 8)
    try:
        os.kill(report['nativePid'], 0)
    except ProcessLookupError:
        pass
    else:
        raise RuntimeError('Native producer remains live')
    log = Path(report['script']).parent / 'native.log'
    runner = Path(report['script']).parent / 'runner.py'
    assert sha(log) == report['logSha256']
    assert sha(runner) == report['runnerSha256']
    assert sha(Path(report['script'])) == report['scriptSha256']
    samples = audit['originalGoWaitSamples']
    assert len(samples) == 4
    # The native marker observes clock0 at actual Go-wait entry, and the final
    # read confirms the same wait with clock0. Earlier timed samples may still
    # be generating a map; repeated root stability is not a CPU requirement.
    assert samples[-1]['originalGoWaitActive'] == 1 and samples[-1]['gameClock'] == 0
    assert samples[-1]['worldRoot'] != 0
    resources = report['resourceSamples']
    assert all(s['rssBytes'] <= report['rssCeilingBytes'] for s in resources)
    waiting = [s for s in resources if s['originalInitializationWaitReported']]
    assert waiting
    window = [s for s in waiting if s['elapsedSeconds'] >= waiting[-1]['elapsedSeconds'] - 12]
    assert len(window) >= 16
    elapsed = window[-1]['elapsedSeconds'] - window[0]['elapsedSeconds']
    cpu = window[-1]['nativeCpuSeconds'] - window[0]['nativeCpuSeconds']
    assert elapsed >= 8 and cpu >= 0
    measurement = dict(wallSeconds=elapsed, cpuSeconds=cpu,
                       oneCoreCpuPercent=100 * cpu / elapsed,
                       sampleCount=len(window), peakRssBytes=max(s['rssBytes'] for s in resources))
    return report, audit, measurement


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--control', type=Path, required=True)
    parser.add_argument('--control-audit', type=Path, required=True)
    parser.add_argument('--candidate', type=Path, required=True)
    parser.add_argument('--candidate-audit', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Preserve prior evidence; use a fresh output')
    control, before_audit, before = observation(args.control, args.control_audit, True)
    candidate, after_audit, after = observation(args.candidate, args.candidate_audit, False)
    assert control['nativePid'] != candidate['nativePid']
    assert control['finishedAtMs'] <= candidate['startedAtMs']
    for field in ['nativeExecutableSha256', 'sources', 'settingsSource',
                  'settingsBefore', 'ownedSettingsBefore', 'scriptSha256',
                  'runnerSha256', 'servedBefore', 'rssCeilingBytes', 'configuredCoopChapter']:
        assert control[field] == candidate[field], field
    for field in ['dynamicPeerIds', 'originalPacketTypes', 'originalPacketCount', 'originalPacketBytes']:
        assert before_audit[field] == after_audit[field], field
    root = Path(__file__).resolve().parents[1]
    assert all(sha(root / name) == expected for name, expected in candidate['sources'].items())
    passed = before['oneCoreCpuPercent'] >= 70 and after['oneCoreCpuPercent'] <= 30 and after['oneCoreCpuPercent'] <= before['oneCoreCpuPercent'] / 2
    result = dict(version=1, control=before, candidate=after,
                  observations={str(p.resolve()): sha(p) for p in [args.control, args.control_audit, args.candidate, args.candidate_audit]},
                  nativeExecutableSha256=candidate['nativeExecutableSha256'],
                  configuredCoopChapter=candidate['configuredCoopChapter'],
                  sequentialOriginalHosts=True, originalPacketSchemasPreserved=True,
                  originalGameClockRemainsZero=True, producerAbsent=True,
                  nativeInitializationWaitCpuReductionQualified=passed,
                  browserUsed=False, browserPerformanceQualified=False,
                  secondOriginalEngineExecuted=False, fullMatchQualified=False,
                  sharedSaveLoadResumeQualified=False, independentInternetQualified=False,
                  sustainedBrowserMemoryBoundQualified=False, goalComplete=False)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({key: result[key] for key in ['control', 'candidate', 'nativeInitializationWaitCpuReductionQualified', 'browserPerformanceQualified']}))
    return 0 if passed else 1


if __name__ == '__main__':
    raise SystemExit(main())

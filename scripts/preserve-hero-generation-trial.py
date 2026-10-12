#!/usr/bin/env python3
"""Freeze a stopped fresh-region trial's exact sources and evidence with bounded I/O."""
import argparse
import hashlib
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('manifest', type=Path)
p.add_argument('directory', type=Path)
p.add_argument('--observed', type=Path)
a = p.parse_args()
m = json.loads(a.manifest.read_text())
assert m['nativeSessionTerminal'] and m['ownedProducerAbsent'] and m['publicationWorkerAbsent']
for pid in [m['nativePid'], m['publicationWorkerPid']]:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        pass
    else:
        raise AssertionError('Owned trial process still exists')
directory = a.directory.resolve()
assert directory.parent == ROOT / 'output'
directory.mkdir()  # Never replace earlier evidence.

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(4096), b''):
            h.update(block)
    return h.hexdigest()

def preserve(source, relative, expected=None):
    source = source.resolve()
    before = digest(source)
    if expected is not None:
        assert before == expected, str(source)
    target = directory / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    with source.open('rb') as stream, target.open('xb') as saved:
        for block in iter(lambda: stream.read(4096), b''):
            saved.write(block)
    assert digest(target) == before == digest(source)
    return dict(source=str(source), preserved=str(target), bytes=source.stat().st_size, sha256=before)

sources = []
paths = {ROOT / name for name in m['compiledSourceSha256']}
paths.update((ROOT / 'web/world').glob('*.mjs'))
paths.update(ROOT / name for name in [
    'AGENTS.md', 'upstream/majesty-recomp/AGENTS.md',
    'scripts/run-native-hero-binding.py', 'scripts/build-native-world-residency.py',
    'scripts/stage-held-native-hero-generation.mjs', 'scripts/inspect-native-hero-generation.mjs',
    'scripts/inspect-native-hero-arrival-refusal.mjs',
    'scripts/run-native-regional-home.py', 'scripts/preserve-hero-generation-trial.py',
    'tests/hero-repeated-generated-browser-original.test.mjs',
    'tests/hero-native-controls.test.mjs', 'tests/hero-save-session.test.mjs',
    'tests/hero-generation-clock.test.mjs',
    'CHANGELOG.md', 'docs/hero-fresh-region-generation.md', 'docs/frontier-world.md',
    'upstream/majesty-recomp/docs/analysis.md',
    'tests/fixtures/file-profile-storage.mjs',
])
paths.update((ROOT / 'scripts/lib').glob('*.mjs'))
paths.add(ROOT / 'scripts/lib/native_pair_guard.py')
expected = {ROOT / name: sha for name, sha in m['compiledSourceSha256'].items()}
expected[ROOT / 'scripts/run-native-hero-binding.py'] = m['runnerSha256']
expected[ROOT / 'scripts/stage-held-native-hero-generation.mjs'] = m['publicationWorkerSha256']
for path in sorted(paths):
    sources.append(preserve(path, Path('sources') / path.relative_to(ROOT), expected.get(path)))

evidence = []
inputs = [Path(m['build']['filename']), Path(m['build']['filename']).with_suffix('.log'),
          a.manifest, Path(m['log']), Path(m['startup']['filename']),
          Path(m['publicationLog']), Path(m['publicationInput']['filename'])]
if m.get('freshGeneration'):
    inputs.append(Path(m['freshGeneration']['filename']))
observed = json.loads(a.observed.read_text()) if a.observed else None
if observed:
    assert observed.get('nativeFreshRegionGenerationQualified') or observed.get('nativeOccupiedArrivalRefusedWithoutAbort')
    assert observed['manifest']['sha256'] == digest(a.manifest)
    inputs.append(a.observed)
for index, path in enumerate(inputs):
    evidence.append(preserve(path, Path('evidence') / f'{index}-{path.name}'))

references = []
fixture = Path(m['fixture'])
for path in sorted(fixture.rglob('*')):
    if path.is_file() and path.suffix in ['.GMP', '.GPL', '.pack']:
        references.append(dict(filename=str(path), bytes=path.stat().st_size, sha256=digest(path)))
qualified = bool(observed and observed.get('nativeFreshRegionGenerationQualified'))
result = dict(version=1, sources=sources, evidence=evidence, references=references,
              nativeOccupiedArrivalRefusedWithoutAbort=bool(observed and observed.get('nativeOccupiedArrivalRefusedWithoutAbort')),
              nativeTrialCompleted=m['nativeExitCode'] == 0,
              nativeFreshRegionInitializationQualified=qualified,
              nativeGeneratedNeighborArrivalQualified=qualified and bool(observed.get('nativeGeneratedNeighborArrivalQualified')),
              nativeRepeatedGeneratedNeighborArrivalQualified=qualified and bool(observed.get('nativeRepeatedGeneratedNeighborArrivalQualified')),
              nativeThreeGeneratedNeighborArrivalsQualified=qualified and bool(observed.get('nativeThreeGeneratedNeighborArrivalsQualified')),
              generatedRegions=m['generatedNeighborJourneys'] if qualified and observed.get('nativeGeneratedNeighborArrivalQualified') else 0,
              generatedHeldRegions=m['generatedNeighborJourneys'] if qualified else 0,
              requestedGeneratedRegions=m['generatedNeighborJourneys'],
              peakAggregateRssBytes=max(r['rssBytes'] for r in m['resourceSamples']),
              nativePid=m['nativePid'], publicationWorkerPid=m['publicationWorkerPid'],
              largestHashRead=4096, largestCopyBuffer=4096, browserUsed=False,
              sustainedMemoryQualified=False, goalComplete=False)
(directory / 'manifest.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(dict(preserved=True, qualified=qualified, sources=len(sources), evidence=len(evidence), references=len(references))))

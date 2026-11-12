import importlib.util
import json
from pathlib import Path
import re
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('root_presentation', ROOT / 'scripts/lib/root_player_presentation.py')
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)


class RootPlayerPresentationTests(unittest.TestCase):
    def node(self, script):
        subprocess.run(['node', '-e', script], check=True, capture_output=True, text=True, timeout=10)

    def test_native_start_waits_for_decoded_art_and_a_painted_frame(self):
        code = policy.PAINT_LOADING + 'start()); });'
        self.node('''const vm = require('node:vm');
const assert = require('node:assert/strict');
(async () => {
  let decoded, starts = 0;
  const frames = [];
  const context = {rootPreparation: Promise.resolve([]), preparedRootGames: null,
    document: {querySelector: () => ({decode: () => new Promise(resolve => {decoded = resolve;})})},
    requestAnimationFrame: callback => frames.push(callback),
    rootController: {signal: {throwIfAborted() {}}}, start: () => ++starts};
  const work = vm.runInNewContext(''' + json.dumps(code) + ''', context);
  await new Promise(setImmediate);
  assert.equal(starts, 0);
  assert.equal(frames.length, 0);
  decoded();
  await new Promise(setImmediate);
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(starts, 0);
  frames.shift()();
  await work;
  assert.equal(starts, 1);
})().catch(error => {console.error(error); process.exitCode = 1;});''')

    def test_legacy_links_keep_profile_and_fragment_at_the_root(self):
        code = re.search(r'<script>(.*?)</script>', policy.LEGACY_ENTRY, re.S)[1]
        self.node('''const vm = require('node:vm');
const assert = require('node:assert/strict');
for (const path of ['/majesty/', '/majesty/index.html']) {
  const url = new URL(path + '?profile=existing-player#camera', 'https://majesty.boland.co');
  let visited;
  vm.runInNewContext(''' + json.dumps(code) + ''', {URL, location: {
    href: url.href, search: url.search, hash: url.hash, replace: value => {visited = value;}}});
  assert.equal(visited, 'https://majesty.boland.co/?profile=existing-player#camera');
}''')


if __name__ == '__main__':
    unittest.main()

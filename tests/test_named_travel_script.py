"""Synthetic schedule/trace checks only; never launch or qualify an original game."""
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('named_travel_script', ROOT / 'scripts/lib/named_travel_script.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class NamedTravelTests(unittest.TestCase):
    def test_schedule_has_bounded_spacing_and_no_request_file(self):
        for directions in ([0, 3, 4], [0, 1, 2, 3, 4]):
            text, seconds, schedule = module.named_travel_script(directions)
            self.assertEqual(seconds, 25 + 10 * (len(directions)-1))
            self.assertEqual(len(schedule), len(directions)+1)
            self.assertEqual(sum(line.startswith('actions ') for line in text.splitlines()), len(schedule))
            self.assertEqual(text.count('action frontier-checkpoint\n'), 1)
            self.assertEqual(sum(int(line.split()[1]) for line in text.splitlines() if line.startswith('wait ')), seconds*1000)
            self.assertTrue(all(b['atMs']-a['atMs'] >= 3000 for a,b in zip(schedule,schedule[1:])))
            self.assertNotIn('Session_Request', text)
        for bad in ([], [0, 4], [0, 3, 5], [0, -1, 4], [False, 3, 4], [0]*5+[4]):
            with self.subTest(bad=bad), self.assertRaises(ValueError):module.named_travel_script(bad)

    def trace(self):
        lines = [
            '[smoke] named actions frontier-travel frontier-travel-south: queued',
            '[frontier] Session destination refused source=0_0 target=0_1',
            '[smoke] named actions frontier-travel frontier-travel-north: queued',
            '[frontier] Session destination refused source=0_0 target=0_-1']
        for serial, source, target, direction, mode in ((1,'0_0','-1_0',0,'new'),(2,'-1_0','0_0',3,'saved')):
            lines += [
                f'[smoke] named actions frontier-travel frontier-travel-{module.NAMES[direction]}: queued',
                f'[frontier] Session checkpoint serial={serial} region={source} clock=500 direction={direction}',
                f'[frontier] Session released serial={serial} region={source} roots-freed=1,1,1,1,1,1,1,1 clock=0',
                f'[frontier] Session unloaded serial={serial} source={source} target={target} world-null=1 profile=/owned/frontier_{target}',
                f'[frontier] Session release observer removed serial={serial} hooks=3 retained-roots=0',
                f'[frontier] Session attached serial={serial} region={target} mode={mode} phase=1 pending=2']
        return '\n'.join(lines + ['[smoke] named action frontier-checkpoint: queued',
                                 '[frontier] Region 0_0 checkpoint saved'])+'\n'

    def test_synthetic_complete_ui_trace_contract(self):
        value = module.verify_named_travel_log(self.trace(), ['0_0','-1_0','0_0'], [0,3,4])
        self.assertEqual(value['trips'], 2)
        self.assertEqual(value['trackedOriginalRootsFreed'], 16)

    def test_contradictory_or_fixture_traces_refuse(self):
        original = self.trace()
        replacements = [
            ('frontier-travel-west: queued', 'frontier-travel-west: refused'),
            ('target=0_1', 'target=1_0'), ('direction=0', 'direction=3'),
            ('serial=1 region=-1_0 mode=new', 'serial=1 region=1_0 mode=new'),
            ('serial=2 region=0_0 mode=saved', 'serial=2 region=0_0 mode=new'),
            ('roots-freed=1,1,1,1,1,1,1,1', 'roots-freed=1,1,1,1,1,1,1,0'),
            ('world-null=1', 'world-null=0'), ('retained-roots=0', 'retained-roots=1'),
            ('Region 0_0 checkpoint saved', 'Region 0_0 checkpoint failed')]
        mutations = [original.replace(a,b,1) for a,b in replacements]
        mutations += [original+'[frontier] Session request refused region=0_0 serial=0\n',
                      original+'GplException\n', original+'[frontier] Region 0_0 checkpoint saved\n',
                      original.replace('observer removed serial=1', 'observer removed serial=2',1)]
        release = next(line for line in original.splitlines() if 'Session released serial=1' in line)
        misplaced = original.replace(release+'\n','')+release+'\n'
        mutations.append(misplaced)
        for i, text in enumerate(mutations):
            with self.subTest(mutation=i), self.assertRaises(AssertionError):
                module.verify_named_travel_log(text, ['0_0','-1_0','0_0'], [0,3,4])


if __name__ == '__main__':
    unittest.main()

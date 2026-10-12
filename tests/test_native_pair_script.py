"""Check prepared surrender inputs; these checks do not run a native match."""
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('native_pair_script', ROOT / 'scripts/lib/native_pair_script.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def timeline(text):
    elapsed = 0
    events = []
    for line in text.splitlines():
        if line.startswith('wait '):
            elapsed += int(line.split()[1])
        elif line.strip() and not line.startswith('#'):
            events.append((elapsed, line))
    return elapsed, events


class NativePairScriptTests(unittest.TestCase):
    def test_actual_scripts_delay_surrender_and_acknowledge_both_original_dialogs(self):
        for role in ('host', 'guest'):
            for sender in (False, True):
                with self.subTest(role=role, sender=sender):
                    original = (ROOT / f'upstream/majesty-recomp/smoke/native-live-pair-{role}.script').read_text()
                    prepared = module.defeat_script(original, role, sender)
                    self.assertEqual(prepared.count('action frontier-surrender\n'), int(sender))
                    total, events = timeline(prepared)
                    original_total, original_events = timeline(original)
                    self.assertEqual(total, original_total)
                    self.assertLess(total, 120000)
                    original_marker = 'wait 30000\ndump live_host65\n' if role == 'host' else 'wait 60000\ndump live_guest_final\n'
                    self.assertEqual(prepared.split(original_marker.split('\n')[1])[1],
                                     original.split(original_marker.split('\n')[1])[1])
                    before_marker = original.split(original_marker)[0]
                    self.assertTrue(prepared.startswith(before_marker))
                    self.assertEqual(len(events) - len(original_events), 4 + int(sender))
                    ack = next(t for t, line in events if line == 'move 398 403')
                    self.assertGreaterEqual(ack, 91800)
                    self.assertLessEqual(ack, 92500)
                    if sender:
                        surrender = next(t for t, line in events if line == 'action frontier-surrender')
                        self.assertGreaterEqual(surrender, 86000)
                        self.assertEqual(ack - surrender, 5000)
                    self.assertFalse(any(line.startswith(('poke ', 'write ', 'action '))
                                         and line != 'action frontier-surrender' for _, line in events))
                    self.assertLessEqual(sum(bool(line.strip()) and not line.startswith(('wait ', '#'))
                                             for line in prepared.splitlines()), 512)

    def test_victory_preserves_deadline_and_waits_for_original_guest_ready(self):
        originals = {role: (ROOT / f'upstream/majesty-recomp/smoke/native-live-pair-{role}.script').read_text()
                     for role in ('host', 'guest')}
        for role, original in originals.items():
            with self.subTest(role=role):
                prepared = module.victory_script(original, role)
                total, events = timeline(prepared)
                self.assertEqual(total, timeline(original)[0])
                self.assertLess(total, 120000)
                self.assertNotIn('action ', prepared)
                self.assertEqual(next(t for t, line in events if line == 'move 398 403'), 113300)
                self.assertEqual(len(events) - len(timeline(original)[1]), 4)
                if role == 'host':
                    start = next(t for t, line in events if line == 'move 180 570')
                    guest_ready = next(t for t, line in timeline(originals['guest'])[1]
                                       if line == 'move 180 570') + 200
                    self.assertGreaterEqual(start - guest_ready, 4000)

    def test_victory_refuses_changed_final_or_ready_markers(self):
        for text, role in (('', 'host'), ('wait 10000\ndump live_host75\n', 'host'),
                           ('wait 60000\ndump live_guest_final\n' * 2, 'guest'),
                           ('wait 60000\ndump live_guest_final\naction frontier-surrender\n', 'guest'),
                           ('wait 60000\ndump live_guest_final\n', 'spectator')):
            with self.subTest(role=role, text=text), self.assertRaises(ValueError):
                module.victory_script(text, role)

    def test_unknown_role_missing_duplicate_and_preexisting_request_refuse(self):
        host = 'wait 30000\ndump live_host65\n'
        for text, role in ((host, 'spectator'), ('', 'host'), (host * 2, 'host'),
                           ('wait 30001\ndump live_host65\n', 'host'),
                           (host + 'action frontier-surrender\n', 'host'), (host, 'guest')):
            with self.subTest(text=text, role=role), self.assertRaises(ValueError):
                module.defeat_script(text, role, True)

    def test_synthetic_outcome_log_contract(self):
        # Synthetic text checks only; never produce a qualification report.
        result = '[campaign] Chapter 2 shared defeat for 2 kingdoms\n'
        queued = '[smoke] named action frontier-surrender: queued\n'
        request = '[campaign] Surrender requested by kingdom 2\n'
        script = 'action frontier-surrender\n'
        module.verify_peer_outcome(queued + request + result, script, 2, 'defeat', True)
        module.verify_peer_outcome(result, '', 2, 'defeat', False)
        module.verify_peer_outcome(result.replace('defeat', 'victory'), '', 2, 'victory', False)
        for text, source, outcome, sender in (
                (queued + result, script, 'defeat', True),
                (request + result, script, 'defeat', True),
                (result + queued + request, script, 'defeat', True),
                (queued + request + result, '', 'defeat', True),
                (queued + request + result, script, 'defeat', False),
                (result, '', 'victory', False),
                (queued + request + result + result, script, 'defeat', True),
                (queued + request + result.replace('2 kingdoms', '1 kingdoms'), script, 'defeat', True),
                (queued + request + result.replace('Chapter 2', 'Chapter 3'), script, 'defeat', True),
                (queued + request + result + '[smoke] named action frontier-surrender: refused\n', script, 'defeat', True)):
            with self.subTest(text=text, outcome=outcome, sender=sender), self.assertRaises(AssertionError):
                module.verify_peer_outcome(text, source, 2, outcome, sender)


if __name__ == '__main__':
    unittest.main()

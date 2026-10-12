"""No game launches: exercise native pair supervision with bounded child fixtures."""
import asyncio
import os
from pathlib import Path
import signal
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from lib.native_pair_guard import owned_rows, stop_owned, stop_reason


def row(pid, parent, group, rss=100, program='child-fixture'):
    return dict(pid=pid, parent=parent, group=group, rssBytes=rss, program=program)


class NativePairAccounting(unittest.TestCase):
    def test_previously_owned_orphan_group_stays_counted(self):
        rows = [row(10, 1, 10), row(20, 1, 20), row(13, 1, 13)]
        self.assertEqual([item['pid'] for item in owned_rows(rows, [10, 20], [13])], [10, 20, 13])
        self.assertEqual(stop_reason(rows, [10, 20], 1, 120, [0, 0], limit=299, groups=[13]), 'paired native aggregate RSS ceiling')

    def test_both_root_groups_and_detached_descendants_count(self):
        rows = [row(10, 1, 10), row(20, 1, 20), row(11, 10, 10),
                row(12, 11, 12), row(13, 12, 13), row(30, 1, 30, 999999)]
        self.assertEqual([item['pid'] for item in owned_rows(rows, [10, 20])], [10, 20, 11, 12, 13])
        self.assertIsNone(stop_reason(rows, [10, 20], 1, 120, [0, 0], limit=500))
        self.assertEqual(stop_reason(rows, [10, 20], 1, 120, [0, 0], limit=499), 'paired native aggregate RSS ceiling')

    def test_deadline_logs_distinct_producers_and_unowned_work(self):
        rows = [row(10, 1, 10), row(20, 1, 20)]
        self.assertEqual(stop_reason(rows, [10, 10], 1, 120, [0, 0]), 'expected exactly two distinct owned producers')
        self.assertEqual(stop_reason(rows, [10, 20], 121, 120, [0, 0]), 'paired native deadline')
        self.assertEqual(stop_reason(rows, [10, 20], 1, 120, [0, 4*1024*1024+1]), 'paired native log ceiling')
        rows.append(row(30, 1, 30, program='ninja'))
        self.assertEqual(stop_reason(rows, [10, 20], 1, 120, [0, 0]), 'other heavy work appeared during native pair')

    def test_explicit_one_producer_probe_keeps_default_pair_requirement(self):
        rows = [row(10, 1, 10)]
        self.assertIsNone(stop_reason(rows, [10], 1, 35, [0], expected_producers=1))
        self.assertEqual(stop_reason(rows, [10], 1, 35, [0]), 'expected exactly two distinct owned producers')


class NativePairCleanup(unittest.IsolatedAsyncioTestCase):
    async def test_term_resistant_child_is_killed_and_reaped_without_touching_other_group(self):
        # These are tiny Python sleepers, not native games/builds. Independent
        # groups verify that cleanup cannot signal an unrelated user process.
        owned = await asyncio.create_subprocess_exec(sys.executable, '-c',
            'import signal,time;signal.signal(signal.SIGTERM,signal.SIG_IGN);print("ready",flush=True);time.sleep(5)',
            stdout=asyncio.subprocess.PIPE, start_new_session=True)
        unrelated = await asyncio.create_subprocess_exec(sys.executable, '-c',
            'import time;time.sleep(5)', start_new_session=True)
        try:
            self.assertEqual(await asyncio.wait_for(owned.stdout.readline(), 1), b'ready\n')
            await asyncio.wait_for(stop_owned([owned], {owned.pid}, grace=.05), 1)
            self.assertEqual(owned.returncode, -signal.SIGKILL)
            self.assertIsNone(unrelated.returncode)
            with self.assertRaises(ProcessLookupError): os.kill(owned.pid, 0)
        finally:
            for process in [owned, unrelated]:
                if process.returncode is None:process.kill()
                await process.wait()


if __name__ == '__main__':
    unittest.main()

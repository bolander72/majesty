"""The owned pause timer must save from the host even after tab switches."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location(
    'coop_pause_timer', Path(__file__).resolve().parents[1]
    / 'scripts/pause-owned-coop-after-delay.py')
timer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(timer)


class PauseTimerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.trial = Path(self.temp.name) / 'owned-trial.json'
        self.trial.write_text(json.dumps({'saveByUnix': time.time() + 300}))
        self.role = 'host'
        self.calls = []
        self.saved_roles = []

    def browser(self, command, **kwargs):
        args = command[3:]
        self.calls.append(args)
        if args == ['tab', 't3']:
            self.role = 'host'
        if args == ['get', 'url']:
            output = 'http://localhost/game?role=' + self.role
        elif args == ['get', 'text', 'body']:
            output = 'Kingdom 1: 100. Checkpoint saved.'
        else:
            output = ''
        if 'Save and pause' in args:
            self.saved_roles.append(self.role)
        return subprocess.CompletedProcess(command, 0, output, '')

    def run_timer(self, host_tab=None):
        argv = ['timer', str(self.trial), '1']
        if host_tab is not None:
            argv.append(host_tab)
        with patch.object(sys, 'argv', argv), \
                patch.object(timer.subprocess, 'run', side_effect=self.browser), \
                patch.object(timer.time, 'sleep', side_effect=self.switch_to_guest):
            timer.main()

    def switch_to_guest(self, seconds):
        self.role = 'guest'

    def test_tab_switch_during_delay_saves_from_host(self):
        self.run_timer('t3')
        self.assertEqual(self.saved_roles, ['host'])
        self.assertEqual(self.calls.count(['tab', 't3']), 2)

    def test_guest_at_start_is_rejected(self):
        self.role = 'guest'
        with self.assertRaisesRegex(SystemExit, 'host tab'):
            self.run_timer()
        self.assertEqual(self.saved_roles, [])

    def test_guest_at_save_time_without_host_id_is_rejected(self):
        with self.assertRaisesRegex(SystemExit, 'host tab'):
            self.run_timer()
        self.assertEqual(self.saved_roles, [])

    def test_invalid_host_tab_is_rejected_before_commands(self):
        with self.assertRaisesRegex(SystemExit, 'owned tab ID'):
            self.run_timer('--session')
        self.assertEqual(self.calls, [])


if __name__ == '__main__':
    unittest.main()

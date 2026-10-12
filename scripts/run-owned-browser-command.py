#!/usr/bin/env python3
"""Run one command against a live owned Chrome, with a common input deadline."""
import json
import os
from pathlib import Path
import subprocess
import shutil
import sys
import time
from lib.browser_trial_policy import command_rejection, trial_paths


def main():
    if len(sys.argv) < 3:
        raise SystemExit('Usage: run-owned-browser-command.py TRIAL_JSON COMMAND ...')
    filename, args = sys.argv[1], sys.argv[2:]
    session, config, markers = trial_paths(filename)
    trial = json.loads(Path(filename).read_text())
    launch = json.loads(config.read_text())
    if '--mute-audio' not in launch.get('args', '').replace('\n', ',').split(','):
        raise SystemExit('Owned trials require the exact --mute-audio argument')
    daemon = trial['ownedDaemonPid']
    try:
        os.kill(daemon, 0)
    except ProcessLookupError:
        raise SystemExit('Owned daemon stopped; refusing automatic relaunch')
    rows = subprocess.check_output(['ps', '-axo', 'pid=,ppid=,comm='], text=True).splitlines()
    live = any(len((v := row.strip().split(None, 2))) == 3
               and int(v[1]) == daemon and v[2].endswith('/Google Chrome') for row in rows)
    reason = command_rejection(trial, args, time.time(), any(p.exists() for p in markers), live)
    if reason:
        raise SystemExit(reason)
    cli = trial.get('browserCli') or shutil.which('agent-browser')
    if not cli:
        raise SystemExit('Record the launch CLI path in the trial browserCli field')
    return subprocess.run([cli, '--config', str(config), '--session', session] + args).returncode


if __name__ == '__main__':
    raise SystemExit(main())

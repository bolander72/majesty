#!/usr/bin/env python3
"""Pause a live owned co-op trial after a short, fixed gameplay interval.

Start only after the native match has loaded. All browser commands go through
the existing owned-session policy; this helper cannot create a browser.
"""
import json
from pathlib import Path
import subprocess
import sys
import time


def main():
    if len(sys.argv) != 3:
        raise SystemExit('Usage: pause-owned-coop-after-delay.py TRIAL_JSON SECONDS')
    filename = sys.argv[1]
    seconds = int(sys.argv[2])
    if not 1 <= seconds <= 180:
        raise SystemExit('Gameplay interval must be between 1 and 180 seconds')
    trial = json.loads(Path(filename).read_text())
    if time.time() + seconds + 30 >= trial['saveByUnix']:
        raise SystemExit('Insufficient save margin; refusing to start timer')
    command = [sys.executable, 'scripts/run-owned-browser-command.py', filename]

    def browser(*args):
        result = subprocess.run(command + list(args), capture_output=True, text=True)
        if result.returncode:
            raise SystemExit(result.stderr.strip() or 'Owned browser command rejected')
        return result.stdout

    if 'Kingdom 1:' not in browser('get', 'text', 'body'):
        raise SystemExit('Native match is not live; refusing to start timer')
    print('Live match confirmed; fixed pause timer started', flush=True)
    time.sleep(seconds)
    browser('eval', "document.querySelector('details[aria-label=\"Co-op world\"]').open=true")
    browser('find', 'role', 'button', 'click', '--name', 'Save and pause', '--exact')
    for _ in range(12):
        if 'Checkpoint saved.' in browser('get', 'text', 'body'):
            print('Shared checkpoint save confirmed', flush=True)
            return
        time.sleep(1)
    raise SystemExit('Save confirmation pending; inspect the existing owned session')


if __name__ == '__main__':
    main()

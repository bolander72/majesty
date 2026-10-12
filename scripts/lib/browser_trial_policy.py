"""Fail closed before an owned browser command can relaunch or extend a trial."""
from pathlib import Path


SAVE_BUTTONS = {
    'Save and pause', 'Close game and prepare resume', 'Prepare resume file',
    'Clear temporary backup copy',
}
SAVE_LINKS = {
    'Close game and prepare resume', 'Close game and recover checkpoint',
    'Close game and request resume invitation',
}
CLOSED_GAMES_LABEL = 'I have closed all Majesty game, campaign and Frontier Atlas tabs before backing up or restoring.'
DETAILS_UI = {
    "document.querySelectorAll('details').forEach(p=>p.open=false)",
    "document.querySelector('details[aria-label=\"Co-op world\"]').open=true",
}


def cleanup_command(args):
    if not args:
        return False
    if args[0] in {'close', 'snapshot', 'screenshot', 'get', 'console', 'errors'}:
        return True
    if args[0] == 'tab':
        return (len(args) == 2 and args[1].startswith('t') and args[1][1:].isdigit()) or (
            len(args) in (2, 3) and args[1] == 'close')
    if args[0] == 'find':
        if args == ['find', 'label', CLOSED_GAMES_LABEL, 'check']:
            return True
        return (len(args) == 7 and args[:2] == ['find', 'role']
                and args[2] in {'button', 'link'} and args[3] == 'click'
                and args[4] == '--name'
                and args[5] in (SAVE_BUTTONS if args[2] == 'button' else SAVE_LINKS)
                and args[6] == '--exact')
    if args[0] == 'eval':
        return len(args) == 2 and args[1] in DETAILS_UI
    if args[0] == 'download':
        return len(args) == 3 and args[1] == '#export'
    return False


def command_rejection(trial, args, now, stopped, chrome_live):
    if not args or args[0].startswith('-'):
        return 'Browser command required; launch options belong in the stable config'
    if stopped and args != ['close']:
        return 'Trial stopped; close only'
    if not chrome_live:
        return 'Owned Chrome stopped; refusing automatic relaunch'
    if args == ['open', trial.get('backupUrl')]:
        return None
    if now >= trial['saveByUnix'] and not cleanup_command(args):
        return 'Save deadline reached; gameplay and setup input refused'
    return None


def trial_paths(filename):
    path = Path(filename)
    if not path.name.endswith('-trial.json'):
        raise ValueError('Expected an owned *-trial.json receipt')
    stem = path.name.removesuffix('-trial.json')
    return stem, path.with_name(stem + '-browser.json'), [
        path.with_name(stem + '-watch.stop'),
        path.with_name(stem + '-guard-stop.json'),
    ]

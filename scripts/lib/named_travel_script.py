"""Bounded native UI travel schedule and trace contract; no guest writes."""
import re

NAMES = ('west', 'north', 'south', 'east')


def named_travel_script(directions):
    if not 3 <= len(directions) <= 5 or directions[-1] != 4 or any(type(d) is not int or d not in range(4) for d in directions[:-1]):
        raise ValueError('Use two to four cardinal trips and a terminal checkpoint')
    events = [(12000, 'south', 'refusal'), (15000, 'north', 'refusal')]
    events += [(20000 + i * 10000, NAMES[d], 'travel') for i, d in enumerate(directions[:-1])]
    final_ms = 20000 + 10000 * (len(directions) - 1)
    text, previous, schedule = '', 0, []
    for at, direction, kind in events:
        text += f'wait {at-previous}\nactions frontier-travel frontier-travel-{direction}\n'
        schedule.append(dict(atMs=at, direction=direction, kind=kind))
        previous = at
    text += f'wait {final_ms-previous}\naction frontier-checkpoint\nwait 5000\ndump named_travel_completed\n'
    return text, (final_ms + 5000) // 1000, schedule


def verify_named_travel_log(text, route, directions):
    """Validate production transitions in a stopped producer's bounded log.

    File hashes, process termination and isolation are verified by the caller.
    This function alone does not establish browser bounds or hero continuity.
    """
    named_travel_script(directions)
    assert len(route) == len(directions) and route[0] == route[-1] == '0_0'
    pairs = re.findall(r'^\[smoke\] named actions frontier-travel frontier-travel-(west|north|south|east): queued$', text, re.M)
    assert pairs == ['south', 'north'] + [NAMES[d] for d in directions[:-1]]
    assert ': refused' not in '\n'.join(s for s in text.splitlines() if s.startswith('[smoke] named action'))
    refused = re.findall(r'^\[frontier\] Session destination refused source=(\S+) target=(\S+)$', text, re.M)
    assert refused == [('0_0', '0_1'), ('0_0', '0_-1')]
    expected = [(str(i+1), key, str(d)) for i, (key, d) in enumerate(zip(route, directions[:-1]))]
    checkpoints = re.findall(r'^\[frontier\] Session checkpoint serial=(\d+) region=(\S+) clock=\d+ direction=(\d+)$', text, re.M)
    assert checkpoints == expected
    attached = re.findall(r'^\[frontier\] Session attached serial=(\d+) region=(\S+) mode=(new|saved) phase=1 pending=2$', text, re.M)
    assert [(serial, key) for serial, key, _ in attached] == [(str(i+1), key) for i, key in enumerate(route[1:])]
    assert attached[-1][2] == 'saved'
    released = re.findall(r'^\[frontier\] Session released serial=(\d+) region=(\S+) roots-freed=([^ ]+) .*$', text, re.M)
    assert released == [(str(i+1), key, '1,1,1,1,1,1,1,1') for i, key in enumerate(route[:-1])]
    unloaded = re.findall(r'^\[frontier\] Session unloaded serial=(\d+) source=(\S+) target=(\S+) world-null=1 profile=(\S+)$', text, re.M)
    assert [(serial, source, target) for serial, source, target, _ in unloaded] == [
        (str(i+1), source, target) for i, (source, target) in enumerate(zip(route, route[1:]))]
    removed = re.findall(r'^\[frontier\] Session release observer removed serial=(\d+) hooks=\d+ retained-roots=0$', text, re.M)
    assert removed == [str(i+1) for i in range(len(route)-1)]
    for serial, source, target, _ in unloaded:
        checkpoint = text.index(f'[frontier] Session checkpoint serial={serial} region={source} ')
        release = text.index(f'[frontier] Session released serial={serial} region={source} ')
        unload = text.index(f'[frontier] Session unloaded serial={serial} ')
        remove = text.index(f'[frontier] Session release observer removed serial={serial} ')
        attach = text.index(f'[frontier] Session attached serial={serial} region={target} ')
        assert checkpoint < release < unload < remove < attach
    queued_final = '[smoke] named action frontier-checkpoint: queued'
    saved_final = '[frontier] Region 0_0 checkpoint saved'
    assert text.count(queued_final) == text.count(saved_final) == 1
    assert text.index(f'[frontier] Session attached serial={len(route)-1} region=0_0 ') < text.index(queued_final) < text.index(saved_final)
    assert 'Session request refused' not in text and 'checkpoint failed' not in text
    assert 'GplException' not in text and 'CHECKSUM FAILURE' not in text
    return dict(ordinaryNamedTravelQualified=True, trips=len(route)-1,
                trackedOriginalRootsFreed=8*(len(route)-1), finalRegion='0_0',
                finalOriginalCheckpointSaved=True)

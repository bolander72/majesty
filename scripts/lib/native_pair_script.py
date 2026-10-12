"""Prepare ordinary native inputs for a bounded cooperative defeat test."""
import re


def defeat_script(text, role, requests_surrender):
    """Allow gameplay, then dismiss the original loss modal using its OK button.

    Only the selected peer requests surrender. Both peers acknowledge their
    own dialogs through ordinary mouse input; no outcome or network state is
    written. Split existing waits so the original deadline stays unchanged.
    """
    markers = {
        'host': 'wait 30000\ndump live_host65\n',
        'guest': 'wait 60000\ndump live_guest_final\n',
    }
    if role not in markers:
        raise ValueError('Surrender must come from the host or guest')
    marker = markers[role]
    if text.count(marker) != 1 or 'action frontier-surrender' in text:
        raise ValueError('Original native script must have one unchanged post-start marker')
    # Guest requests at 86.8s; host may request at 87.5s. Both dialogs
    # are acknowledged after 91.8s, leaving time to observe the result.
    before = 10000 if role == 'host' else 30000
    after = 14800 if role == 'host' else 24800
    dump = marker.split('\n', 1)[1]
    action = 'action frontier-surrender\n' if requests_surrender else ''
    replacement = (
        f'wait {before}\n' + action + 'wait 5000\n'
        'dump loss_before_ack\nmove 398 403\nwait 100\n'
        'button left down\nwait 100\nbutton left up\n'
        f'wait {after}\n' + dump
    )
    return text.replace(marker, replacement, 1)


def victory_script(text, role):
    """Start after genuine Ready, allow the original day timer, then click OK.

    Reuse the same total duration. The host spends 5.5s less in the ready
    lobby and that time at the end, so both peers can finish the unmodified
    one-day cooperative objective before their final captures.
    """
    markers = {
        'host': 'wait 10000\ndump live_host75\n',
        'guest': 'wait 60000\ndump live_guest_final\n',
    }
    if role not in markers:
        raise ValueError('Victory must use the host or guest')
    marker = markers[role]
    if text.count(marker) != 1 or 'action frontier-surrender' in text:
        raise ValueError('Original native script must have one unchanged final marker')
    if role == 'host':
        lobby = 'wait 20500\ndump joined_lobby\n'
        if text.count(lobby) != 1:
            raise ValueError('Original ready lobby wait must be unchanged')
        text = text.replace(lobby, 'wait 15000\ndump joined_lobby\n', 1)
    before, after = (11300, 4000) if role == 'host' else (56500, 3300)
    replacement = (
        f'wait {before}\ndump victory_before_ack\n'
        'move 398 403\nwait 100\nbutton left down\nwait 100\nbutton left up\n'
        f'wait {after}\n' + marker.split('\n', 1)[1]
    )
    return text.replace(marker, replacement, 1)


def verify_peer_outcome(text, script, chapter, outcome, requests_surrender):
    """Check one already-bounded peer log; this alone does not qualify a match."""
    assert outcome in ('victory', 'defeat') and chapter in (1, 2, 3, 4)
    assert not requests_surrender or (outcome == 'defeat' and chapter != 1)
    results = re.findall(r'\[campaign\] Chapter (\d+) shared (victory|defeat) for (\d+) kingdoms', text)
    assert results == [(str(chapter), outcome, '2')]
    requests = re.findall(r'^\[campaign\] Surrender requested by kingdom ([1-4])$', text, re.M)
    queued = re.findall(r'^\[smoke\] named action frontier-surrender: queued$', text, re.M)
    if requests_surrender:
        assert len(requests) == len(queued) == 1
        assert script.count('action frontier-surrender\n') == 1
        assert text.index('[smoke] named action frontier-surrender: queued') < text.index('[campaign] Surrender requested by kingdom ') < text.index(f'[campaign] Chapter {chapter} shared defeat')
    else:
        assert not requests and not queued and 'action frontier-surrender' not in script
    assert '[smoke] named action frontier-surrender: refused' not in text

#!/usr/bin/env python3
"""Observe the pinned game's original multiplayer lobby in one bounded native run.

Owned profile/relay only. A passive reference peer can join and record bounded
original lobby packets; it cannot stand in for a second game world or start a
qualified match. Browser game launches remain suspended.
"""
import argparse
import asyncio
import hashlib
import importlib.util
import json
import logging
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
from lib.native_original_host_replay import HostTranscript, lobby_manifest, replay_host
from lib.native_original_guest_replay import GuestTranscript, replay_guest
from lib.native_coop_proposal_observer import ProposalObservedSocket
from lib.native_coop_proposal_replay import CapturedHostProposal, CapturedGuestVotes
from lib.native_coop_completion_replay import CapturedHostCompletion
from lib.native_coop_target_inputs import CapturedTargetGuestInputs
from lib.native_coop_saved_return_replay import CapturedSavedReturnHostCompletion
from lib.native_coop_saved_return_votes import CapturedSavedReturnRecipientVotes
from lib.native_coop_saved_revisit_votes import CapturedSavedRevisitRecipientVotes
from lib.native_coop_saved_home_inputs import CapturedSavedHomeGuestInputs
from websockets.asyncio.client import connect
from websockets.asyncio.server import serve

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'upstream/majesty-recomp'
spec = importlib.util.spec_from_file_location('native_lobby_relay', ROOT / 'scripts/room_relay.py')
relay = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = relay
spec.loader.exec_module(relay)


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for b in iter(lambda: f.read(4096), b''):
            h.update(b)
    return h.hexdigest()


def native_state_stamps():
    result = {}
    for name in ('registry.json', 'mods/run.json'):
        path = GAME / 'build/recomp' / name
        if path.is_symlink():
            raise ValueError('Canonical native state must not be a symlink')
        if not path.exists():
            result[name] = None
            continue
        st = path.stat()
        if not path.is_file() or st.st_size > 2 * 1024 * 1024:
            raise ValueError('Canonical native state exceeds its bound')
        result[name] = dict(sha256=sha(path), bytes=st.st_size, inode=st.st_ino, mtimeNs=st.st_mtime_ns)
    return result


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--attempt', type=int, required=True)
    parser.add_argument('--build-report', type=Path, required=True)
    parser.add_argument('--settings-profile', type=Path, required=True)
    parser.add_argument('--script', type=Path, required=True)
    parser.add_argument('--seconds', type=int, default=20)
    parser.add_argument('--greet-peer', action='store_true', help='Send the pinned original Not Ready/version request')
    parser.add_argument('--ready-peer', action='store_true', help='Send the pinned Ready request for host initialization observation; peer has no game world')
    parser.add_argument('--original-loading-spin', action='store_true', help='Owned native control fixture: retain the original initialization polling loop')
    parser.add_argument('--coop-chapter', type=int, choices=[1, 2, 3, 4], help='Enable an existing cooperative chapter in the owned host; reference has no world')
    parser.add_argument('--coop-region', help='Owned initial connected-region generation fixture; requires --coop-chapter')
    parser.add_argument('--replay-host-report', type=Path, help='Join as the original guest against a captured original host; this is not live two-engine gameplay')
    parser.add_argument('--replay-paused-host', action='store_true', help='Replay one independently inspected original host pause/input window after original guest initialization; no continuing peer world')
    parser.add_argument('--replay-host-proposal', type=Path, help='Replay independently inspected actual host Begin/Ready bodies to an original guest; never host Loaded/resume')
    parser.add_argument('--replay-host-completion', type=Path, help='Replay inspected actual host Loaded and original resume to an actual recipient; requires captured Begin/Ready and full target snapshot')
    parser.add_argument('--replay-saved-return-host', type=Path, help='Replay inspected host first completion/second pause/second Begin, serve its retained home only on real recipient checkpoint requests; no second-trip host votes')
    parser.add_argument('--commit-saved-return', action='store_true', help='After the real recipient second Ready, replay the captured actual host Ready; no second Loaded or resume')
    parser.add_argument('--replay-saved-return-completion', type=Path, help='Replay independently qualified actual second host Loaded/resume after real recipient saved load and full held-home writer')
    parser.add_argument('--replay-saved-revisit-host', type=Path, help='Replay inspected actual third pause/Begin/Ready and serve the saved neighbor only on actual recipient checkpoint requests')
    parser.add_argument('--replay-saved-revisit-recipient', type=Path, help='Replay unchanged qualified third recipient Ready/Loaded only after the actual host full held target writer')
    parser.add_argument('--replay-saved-revisit-completion', type=Path, help='Replay actual third host Loaded/resume only after recipient original full held writer and real Complete')
    parser.add_argument('--replay-saved-home-guest-inputs', type=Path, help='Replay a bounded unchanged actual recipient home-input prefix after qualified saved-home resume and observe the third saved revisit proposal')
    parser.add_argument('--replay-saved-home-host-inputs', action='store_true', help='Extend actual recipient home progression with the five unchanged original host packets following its second resume')
    parser.add_argument('--replay-extended-host-completion', action='store_true', help='Preserve9..16 actual host target frames and up to two original Ping packets; requires accepted actual guest input proof')
    parser.add_argument('--replay-recipient-votes', type=Path, help='Replay inspected actual recipient Ready/Loaded to an original host using its imported agreed source; no continuing peer world')
    parser.add_argument('--replay-saved-return-recipient', type=Path, help='Replay inspected actual recipient second Ready/Loaded after identical actual host proposal and saved reader; no authored votes')
    parser.add_argument('--request-saved-return-at-progress', action='store_true', help='Owned native fixture queues ordinary west travel at the actual clock1000 writer boundary')
    parser.add_argument('--snapshot-later-travel', action='store_true', help='Serialize original held worlds at serial3..16 before peer Loaded for full saved/fresh target comparison')
    parser.add_argument('--snapshot-saved-return', action='store_true', help='Save the actually loaded held home through its original writer before peer Loaded')
    parser.add_argument('--snapshot-loaded-target', action='store_true', help='Save the actually rebuilt paused target through its original writer; requires captured host proposal replay')
    parser.add_argument('--snapshot-target-progress', action='store_true', help='Observe a full original target at actual running clock500 after real Complete/resume; never alter simulation clocks or inputs')
    parser.add_argument('--snapshot-later-target-progress', action='store_true', help='Save the original target at actual clock1000 as well as500; no clock/input/phase writes')
    parser.add_argument('--extended-target-guest-inputs', action='store_true', help='Use10..16 actual input frames from an inspected original extended recipient; requires pacing')
    parser.add_argument('--target-guest-input-prefix', type=int, choices=[14], default=0, help='Use exactly the first14 unchanged target inputs from a longer actual recipient capture; requires extended timed replay')
    parser.add_argument('--timed-target-guest-inputs', action='store_true', help='Stream unchanged captured peer inputs independently at their50ms two-frame cadence')
    parser.add_argument('--observe-saved-return-proposal', action='store_true', help='Observe actual serial2 saved west return without sending any second-travel peer votes')
    parser.add_argument('--saved-return-reference-pair', type=Path, help='Owned qualified clock1000 pair from this native build; independently checked by the saved-return inspector')
    parser.add_argument('--pace-target-guest-inputs', action='store_true', help='Send each unchanged actual guest target input only after its matching original host request')
    parser.add_argument('--replay-target-guest-inputs', type=Path, help='Extend original host using actual recipient target frames from an inspected matching post-resume pair; no continuing peer world')
    parser.add_argument('--observe-host-pause', action='store_true', help='Save the guest only at its actual settled incoming host pause; requires paused-host replay and snapshots')
    parser.add_argument('--replay-guest-world', type=Path, help='Initialize one original host using a vote from an inspected original guest world; exact GameStart required, no live second world')
    parser.add_argument('--snapshot-world', action='store_true', help='Capture two full original cooperative worlds at real tick boundaries; requires original initialization replay and a co-op chapter')
    parser.add_argument('--initial-seed', type=int, help='Owned native host scenario seed before original GameStart; no authored world or votes')
    parser.add_argument('--replay-original-inputs', action='store_true', help='Explicit native recorded-guest fixture: replay one unchanged inspected empty input window, never live gameplay or load votes')
    parser.add_argument('--pause-world', action='store_true', help='Owned native host: queue the original pause control before ticks and save the actual settled party boundary')
    parser.add_argument('--readback-world', action='store_true', help='After the actual owned pause, dispose the source and exercise the original full reader on its saved file; no shared barrier or resume')
    parser.add_argument('--read-host-checkpoint', action='store_true', help='Guest readback uses the exact inspected host checkpoint; requires incoming pause and phase2 readback, not shared transport qualification')
    parser.add_argument('--rebuild-readback-world', action='store_true', help='Readback component additionally invokes the original rebuild method while holding its terminal request3; no phase2 dispatch or shared resume')
    parser.add_argument('--dispatch-readback-world', action='store_true', help='Owned native component schedules pending2, executes the original phase2 dispatcher and production hold, then writes/disposes; no committed barrier or shared resume')
    parser.add_argument('--begin-fresh-neighbor', action='store_true', help='At the original host pause, capture its source and begin a production fresh-neighbor proposal; observer enables transport but sends no Ready/Loaded')
    args = parser.parse_args()
    if args.request_saved_return_at_progress and not (args.observe_saved_return_proposal and args.snapshot_later_target_progress):
        parser.error('Simulation-boundary west action requires actual later target progress and saved-return observation')
    if args.snapshot_later_travel and not (args.replay_saved_revisit_host or args.replay_saved_revisit_recipient):
        parser.error('Later held-world snapshots require an explicit saved-revisit host or recipient fixture')
    if args.replay_saved_revisit_recipient and not (args.replay_saved_home_guest_inputs and args.replay_saved_return_recipient and args.snapshot_later_travel):
        parser.error('Third recipient votes require actual second votes, recorded home inputs and a full held third target snapshot')
    if args.snapshot_saved_return and not (args.observe_saved_return_proposal or args.replay_saved_return_host):
        parser.error('Held saved return snapshot requires actual saved-return host or recipient fixture')
    if args.replay_saved_return_recipient and not (args.observe_saved_return_proposal and args.replay_guest_world and args.replay_recipient_votes and args.snapshot_saved_return):
        parser.error('Second recipient votes require actual host saved-return observation, held return snapshot and first-trip votes')
    if args.commit_saved_return and not args.replay_saved_return_host:
        parser.error('Committed saved return requires an inspected actual host return proposal')
    if args.replay_saved_return_completion and not (args.commit_saved_return and args.snapshot_saved_return):
        parser.error('Second host completion requires committed saved return and full held-home snapshot')
    if args.replay_saved_revisit_completion and not (args.replay_saved_revisit_host and args.snapshot_later_travel):
        parser.error('Third host completion requires third proposal replay and full held third target writer')
    if args.replay_saved_revisit_host and (not args.replay_saved_return_completion or args.replay_saved_home_host_inputs):
        parser.error('Third replay requires second completion and excludes the five-packet home stream')
    if args.replay_saved_home_guest_inputs and not (args.replay_saved_return_recipient and args.snapshot_saved_return):
        parser.error('Saved-home recipient inputs require actual host second votes and full held-home writer')
    if args.replay_saved_home_host_inputs and not args.replay_saved_return_completion:
        parser.error('Host home inputs require independently inspected actual second host completion')
    if args.target_guest_input_prefix and not (args.extended_target_guest_inputs and args.timed_target_guest_inputs):
        parser.error('Actual packet prefix requires extended timed replay')
    if args.replay_saved_return_host and (args.replay_host_completion or args.replay_extended_host_completion or
            not args.replay_host_proposal or not args.snapshot_loaded_target or not args.snapshot_later_target_progress):
        parser.error('Saved return replay requires first proposal/full target/later progress and excludes other completion modes')
    if args.observe_saved_return_proposal and not (args.snapshot_later_target_progress and args.replay_recipient_votes and args.replay_target_guest_inputs):
        parser.error('Saved return observation requires actual first travel votes/inputs and later full progress')
    if bool(args.saved_return_reference_pair) != args.observe_saved_return_proposal:
        parser.error('Saved return observation requires an explicit qualified clock1000 reference pair')
    if args.extended_target_guest_inputs and not ((args.pace_target_guest_inputs or args.timed_target_guest_inputs) and args.replay_target_guest_inputs):
        parser.error('Extended captured guest inputs require actual replay and bounded pacing')
    if args.timed_target_guest_inputs and (not args.replay_target_guest_inputs or args.pace_target_guest_inputs):
        parser.error('Timed actual input replay requires actual source and excludes broadcast pacing')
    if args.pace_target_guest_inputs and not args.replay_target_guest_inputs:
        parser.error('Pacing requires the actual recorded target guest inputs')
    if args.snapshot_later_target_progress and not (args.snapshot_target_progress and (args.replay_host_completion or args.replay_saved_return_host or args.replay_target_guest_inputs)):
        parser.error('Later full target observation requires actual peer inputs/completion and500 observation')
    if args.replay_extended_host_completion and not (args.replay_host_completion and args.snapshot_target_progress):
        parser.error('Extended host completion requires actual completion and target progress observation')
    if args.replay_target_guest_inputs and not (args.replay_recipient_votes and args.snapshot_target_progress):
        parser.error('Target guest inputs require actual recipient votes and full target progress observation')
    if args.snapshot_target_progress and not (args.snapshot_loaded_target and (args.replay_recipient_votes or args.replay_host_completion or args.replay_saved_return_host)):
        parser.error('Target progress requires full held target plus actual captured completion/votes')
    if args.begin_fresh_neighbor and (not args.pause_world or args.coop_region != '0_0' or args.readback_world):
        parser.error('Fresh proposal requires the original paused 0_0 host and excludes readback')
    if args.replay_host_proposal and (not args.observe_host_pause or args.readback_world or
            args.begin_fresh_neighbor or args.coop_chapter != 1 or args.coop_region != '0_0'):
        parser.error('Host proposal replay requires original incoming paused guest1/0_0 with no reader component')
    if args.replay_host_completion and not (args.replay_host_proposal and args.snapshot_loaded_target):
        parser.error('Host completion requires actual recipient proposal replay and target snapshot')
    if args.replay_recipient_votes and (not args.begin_fresh_neighbor or not args.snapshot_loaded_target or not args.replay_guest_world):
        parser.error('Recipient vote replay requires original paused host Begin, target snapshot and inspected guest startup')
    if args.snapshot_loaded_target and not (args.replay_host_proposal or args.replay_recipient_votes):
        parser.error('Loaded target snapshot requires actual recipient proposal replay')
    if args.replay_paused_host and not args.replay_host_report:
        parser.error('Paused host replay requires --replay-host-report')
    if args.observe_host_pause and not (args.replay_paused_host and args.snapshot_world):
        parser.error('Incoming pause observation requires paused-host replay and original snapshots')
    if args.read_host_checkpoint and not (args.observe_host_pause and args.dispatch_readback_world):
        parser.error('Host checkpoint read requires incoming pause and --dispatch-readback-world')
    if args.dispatch_readback_world and (not args.readback_world or args.rebuild_readback_world):
        parser.error('Dispatch readback requires --readback-world and excludes --rebuild-readback-world')
    out = ROOT / f'output/native-multiplayer-lobby-{args.attempt:03}'
    if args.attempt < 1 or out.exists():
        parser.error('Use a fresh positive attempt')
    if not 10 <= args.seconds <= 90:
        parser.error('Use a bounded 10..90 second observation')
    if args.replay_host_report and (args.greet_peer or args.ready_peer or args.original_loading_spin):
        parser.error('Host replay cannot use guest readiness or original-spin fixture options')
    if args.replay_guest_world and (args.replay_host_report or args.greet_peer or args.ready_peer):
        parser.error('Guest-world replay is exclusive with host replay and authored lobby requests')
    if args.replay_original_inputs and not args.replay_guest_world:
        parser.error('Original input window requires an independently inspected original guest world')
    if args.pause_world and not (args.snapshot_world and args.replay_guest_world and args.replay_original_inputs):
        parser.error('Original pause fixture requires inspected guest inputs and original world snapshots')
    if args.readback_world and not (args.pause_world or args.observe_host_pause):
        parser.error('Readback requires the actual local or observed incoming original pause')
    if args.rebuild_readback_world and not args.readback_world:
        parser.error('Rebuild method component requires --readback-world')
    if args.snapshot_world and (not (args.replay_host_report or args.replay_guest_world) or not args.coop_chapter):
        parser.error('World snapshots require original initialization replay and --coop-chapter')
    if args.initial_seed is not None and (not 1 <= args.initial_seed <= 0x7fffffff or
            args.replay_host_report or not args.coop_chapter or not args.coop_region):
        parser.error('Initial seed requires an owned cooperative region host and a positive 31-bit seed')
    region = None
    if args.coop_region:
        parts = args.coop_region.split('_')
        try:
            region = [int(part) for part in parts]
        except ValueError:
            parser.error('Use a canonical x_y co-op region')
        if (not args.coop_chapter or len(region) != 2 or
                any(abs(n) > 1000000 for n in region) or
                args.coop_region != '_'.join(map(str, region))):
            parser.error('Use --coop-chapter and a canonical bounded x_y region')
    profile_source = args.settings_profile.resolve()
    if not profile_source.is_relative_to((GAME / 'build').resolve()) or not any(part.startswith('actor-arrival-fixture-') for part in profile_source.parts):
        parser.error('Settings must come from an owned actor-arrival fixture, not a personal profile')
    rows = subprocess.check_output(['ps', '-axo', 'pid=,comm='], text=True).splitlines()
    if any(Path(row.split(None, 1)[1]).name in ['pop_smoke', 'clang', 'clang++', 'ninja', 'cmake', 'dx_tests'] for row in rows if len(row.split(None, 1)) == 2):
        parser.error('Another heavy native game/build/test is live')
    build_path = args.build_report.resolve()
    build = json.loads(build_path.read_text())
    exe = GAME / 'build/recomp/pop_smoke'
    if not build['nativeBuildQualified'] or sha(exe) != build['nativeExecutableSha256']:
        parser.error('Native binary differs from the successful official build')
    sources = {}
    for key in ['nativeSourceSha256', 'nativeHeapRuntimeSourceSha256', 'nativeCheckpointRuntimeSourceSha256', 'nativeOrderRuntimeSourceSha256']:
        sources.update(build[key])
    if any(sha(ROOT / path) != expected for path, expected in sources.items()):
        parser.error('Compiled game inputs changed; use a new official build')
    original_exe = GAME / 'original/gog/MajestyHD - Old.exe'
    pinned = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
    assert sha(original_exe) == pinned
    script_source = args.script.resolve()
    if args.request_saved_return_at_progress and 'action coop-travel-west' in script_source.read_text():
        parser.error('Use a script without another west action when the native progress fixture queues it')
    canonical_state = native_state_stamps()
    out.mkdir()
    # The native resource locator walks the checkout's build ancestors to find
    # symbols. An executable under output/ loses those required hook inputs.
    native_fixture = Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-coop-world-', dir=GAME / 'build'))
    private_build = native_fixture / 'native/recomp'
    (private_build / 'mods').mkdir(parents=True)
    private_exe = private_build / 'pop_smoke'
    shutil.copy2(exe, private_exe)
    private_exe.chmod(0o755)
    assert sha(private_exe) == build['nativeExecutableSha256']
    private_registry = out / 'registry.json'
    profile = out / 'owned-profile'
    frames = out / 'frames'
    usermods = out / 'user-mods'
    packets = out / 'owned-lobby-packets'
    profile.mkdir();frames.mkdir();usermods.mkdir();packets.mkdir()
    inputs = {}
    for name in ['mod-settings.json', 'Documents/My Games/MajestyHD/MajXPrefs', 'Documents/My Games/MajestyHD/questdata_majx.sav']:
        source = profile_source / name
        dest = profile / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, dest)
        inputs[name] = sha(source)
        assert sha(dest) == inputs[name]
    settings = profile / 'mod-settings.json'
    owned_settings = json.loads(settings.read_text())
    owned_settings['host.display/frame_limit'] = 2  # registered 60 FPS choice
    settings.write_text(json.dumps(owned_settings, indent=2) + '\n')
    script = out / 'lobby.script';script.write_bytes(script_source.read_bytes())
    runner = out / 'runner.py';runner.write_bytes(Path(__file__).read_bytes())
    replay_helper = out / 'native_original_host_replay.py'
    replay_helper.write_bytes((ROOT / 'scripts/lib/native_original_host_replay.py').read_bytes())
    guest_helper = out / 'native_original_guest_replay.py'
    guest_helper.write_bytes((ROOT / 'scripts/lib/native_original_guest_replay.py').read_bytes())
    proposal_helper = out / 'native_coop_proposal_observer.py'
    proposal_helper.write_bytes((ROOT / 'scripts/lib/native_coop_proposal_observer.py').read_bytes())
    completion_helper = out / 'native_coop_completion_replay.py'
    completion_helper.write_bytes((ROOT / 'scripts/lib/native_coop_completion_replay.py').read_bytes())
    target_inputs_helper = out / 'native_coop_target_inputs.py'
    target_inputs_helper.write_bytes((ROOT / 'scripts/lib/native_coop_target_inputs.py').read_bytes())
    extended_stream_helper = out / 'native_coop_extended_stream.py'
    extended_stream_helper.write_bytes((ROOT / 'scripts/lib/native_coop_extended_stream.py').read_bytes())
    proposal_replay_helper = out / 'native_coop_proposal_replay.py'
    proposal_replay_helper.write_bytes((ROOT / 'scripts/lib/native_coop_proposal_replay.py').read_bytes())
    saved_return_helper = out / 'native_coop_saved_return_replay.py'
    saved_return_helper.write_bytes((ROOT / 'scripts/lib/native_coop_saved_return_replay.py').read_bytes())
    saved_return_inputs_helper = out / 'native_coop_saved_return_inputs.py'
    saved_return_inputs_helper.write_bytes((ROOT / 'scripts/lib/native_coop_saved_return_inputs.py').read_bytes())
    saved_return_votes_helper = out / 'native_coop_saved_return_votes.py'
    saved_return_votes_helper.write_bytes((ROOT / 'scripts/lib/native_coop_saved_return_votes.py').read_bytes())
    saved_revisit_votes_helper = out / 'native_coop_saved_revisit_votes.py'
    saved_revisit_votes_helper.write_bytes((ROOT / 'scripts/lib/native_coop_saved_revisit_votes.py').read_bytes())
    saved_return_resume_helper = out / 'native_coop_saved_return_resume.py'
    saved_return_resume_helper.write_bytes((ROOT / 'scripts/lib/native_coop_saved_return_resume.py').read_bytes())
    saved_revisit_helper = out / 'native_coop_saved_revisit_replay.py'
    saved_revisit_helper.write_bytes((ROOT / 'scripts/lib/native_coop_saved_revisit_replay.py').read_bytes())
    saved_revisit_resume_helper = out / 'native_coop_saved_revisit_resume.py'
    saved_revisit_resume_helper.write_bytes((ROOT / 'scripts/lib/native_coop_saved_revisit_resume.py').read_bytes())
    saved_home_inputs_helper = out / 'native_coop_saved_home_inputs.py'
    saved_home_inputs_helper.write_bytes((ROOT / 'scripts/lib/native_coop_saved_home_inputs.py').read_bytes())
    input_helper = out / 'native_original_inputs.py'
    input_helper.write_bytes((ROOT / 'scripts/lib/native_original_inputs.py').read_bytes())
    saved_build = out / 'build.json';saved_build.write_bytes(build_path.read_bytes())
    served = {}
    for name in ['MajestyRecomp.wasm', 'MajestyRecomp.js', 'MajestyRecomp.data', 'index.html']:
        p = GAME / 'build/web-site/majesty' / name;st = p.stat()
        served[name] = dict(sha256=sha(p), bytes=st.st_size, inode=st.st_ino, mtimeNs=st.st_mtime_ns)
    fixture_content = None
    if region is not None:
        # Actual native input files, streamed one at a time. This fixture
        # fingerprint is intentionally not a browser import identity.
        files = [original_exe]
        for name in ['Data', 'DataMX', 'Quests', 'QuestsMX', 'Music']:
            files.extend(path for path in (GAME/'original/gog'/name).rglob('*') if path.is_file())
        entries = [str(path.relative_to(GAME/'original/gog')) + '\0' + sha(path)
                   for path in sorted(files, key=lambda path: str(path.relative_to(GAME/'original/gog')))]
        asset_digest = hashlib.sha256(('native-coop-terrain-inputs-v1\n' + '\n'.join(entries)).encode()).hexdigest()
        fixture_content = pinned + ':' + asset_digest
    manifest = lobby_manifest(build['nativeExecutableSha256'], args.coop_chapter, args.coop_region, fixture_content)

    transcript = HostTranscript(args.replay_host_report, manifest, build['nativeExecutableSha256'], args.coop_chapter, args.coop_region, fixture_content,
                                paused_host=args.replay_paused_host) if args.replay_host_report else None
    if args.replay_guest_world:
        transcript = GuestTranscript(args.replay_guest_world, manifest, build['nativeExecutableSha256'], args.coop_chapter, args.coop_region, fixture_content)
    proposal_replay = CapturedHostProposal(args.replay_host_proposal, transcript) if args.replay_host_proposal else None
    host_completion = CapturedHostCompletion(args.replay_host_completion, proposal_replay,extended=args.replay_extended_host_completion) if args.replay_host_completion else None
    if args.replay_saved_return_host:
        host_completion = CapturedSavedReturnHostCompletion(args.replay_saved_return_host, proposal_replay,
            commit_return=args.commit_saved_return, return_completion=args.replay_saved_return_completion,
            return_home_inputs=args.replay_saved_home_host_inputs, revisit=args.replay_saved_revisit_host, revisit_completion=args.replay_saved_revisit_completion)
    if host_completion:
        transcript.host_completion = host_completion
    guest_votes = CapturedGuestVotes(args.replay_recipient_votes) if args.replay_recipient_votes else None
    saved_return_votes = CapturedSavedReturnRecipientVotes(args.replay_saved_return_recipient, build['nativeExecutableSha256']) if args.replay_saved_return_recipient else None
    if saved_return_votes:
        transcript.saved_return_votes = saved_return_votes
    revisit_votes = CapturedSavedRevisitRecipientVotes(args.replay_saved_revisit_recipient, build['nativeExecutableSha256']) if args.replay_saved_revisit_recipient else None
    if revisit_votes:
        transcript.revisit_votes = revisit_votes
    target_guest_inputs = CapturedTargetGuestInputs(args.replay_target_guest_inputs,guest_votes,build['nativeExecutableSha256'],paced=args.pace_target_guest_inputs,extended=args.extended_target_guest_inputs,timed=args.timed_target_guest_inputs,prefix=args.target_guest_input_prefix) if args.replay_target_guest_inputs else None
    if guest_votes:
        transcript.guest_votes = guest_votes
    if target_guest_inputs:
        transcript.target_guest_inputs = target_guest_inputs
    saved_home_inputs = CapturedSavedHomeGuestInputs(args.replay_saved_home_guest_inputs,build['nativeExecutableSha256']) if args.replay_saved_home_guest_inputs else None
    if saved_home_inputs:
        transcript.saved_home_inputs = saved_home_inputs
    if proposal_replay:
        transcript.proposal_replay = proposal_replay
    replay_inputs = out / 'captured-host-inputs'
    if transcript:
        replay_inputs.mkdir()
        transcript.preserve(replay_inputs)
        if proposal_replay:
            proposal_replay.preserve(replay_inputs)
    if host_completion:
        host_completion.preserve(replay_inputs)
    if guest_votes:
        guest_votes.preserve(replay_inputs)
    if saved_return_votes:
        saved_return_votes.preserve(replay_inputs)
    if revisit_votes:
        revisit_votes.preserve(replay_inputs)
    if target_guest_inputs:
        target_guest_inputs.preserve(replay_inputs)
    if saved_home_inputs:
        saved_home_inputs.preserve(replay_inputs)
    imported_source = guest_votes.preserve_source(profile) if guest_votes else []
    imported_return_source = saved_return_votes.preserve_source(profile) if saved_return_votes else []
    imported_revisit_source = revisit_votes.preserve_source(profile) if revisit_votes else []
    saved_return_reference = None
    if args.saved_return_reference_pair:
        source = args.saved_return_reference_pair.resolve()
        if not source.is_relative_to(ROOT / 'output') or source.is_symlink() or not source.is_file() or source.stat().st_size > 2 * 1024 * 1024:
            parser.error('Require an owned bounded stopped clock1000 pair proof')
        reference = json.loads(source.read_bytes())
        if reference.get('recordedRoleLaterFullGameplayEqualityQualified') is not True or reference.get('browserUsed') is not False:
            parser.error('Require a qualified recorded clock1000 pair')
        copy = out / 'saved-return-reference-pair.json'
        with copy.open('xb') as sink: sink.write(source.read_bytes())
        saved_return_reference = dict(source=str(source), copy=str(copy), bytes=copy.stat().st_size, sha256=sha(copy))
    host_checkpoint = transcript.preserve_host_checkpoint(profile) if args.read_host_checkpoint else None
    service = relay.Relay()
    connections = 0
    async def handler(ws):
        nonlocal connections
        connections += 1
        socket = ProposalObservedSocket(ws, relay, service, packets, report, save) if args.begin_fresh_neighbor or args.replay_host_proposal else ws
        await service.handle(socket)
    logger = logging.getLogger('native_lobby');logger.addHandler(logging.NullHandler());logger.propagate=False
    report = dict(version=1, attempt=args.attempt, pinnedExecutableSha256=pinned,
                  buildReport=str(build_path), buildReportSha256=sha(build_path),
                  nativeExecutableSha256=sha(exe), sources=sources,
                  nativeIsolationVersion='v1', nativeExecutable=str(private_exe), privateRegistry=str(private_registry),
                  privateNativeDirectory=str(private_build), nativeFixture=str(native_fixture),
                  privateRegistryInitiallyAbsent=not private_registry.exists(), canonicalNativeStateBefore=canonical_state,
                  profile=str(profile), settingsSource=str(profile_source), settingsBefore=inputs,
                  ownedProfileFrameLimit=60, ownedSettingsBefore={name: sha(profile / name) for name in inputs},
                  script=str(script), scriptSha256=sha(script), runnerSha256=sha(runner),
                  replayHelperSha256=sha(replay_helper),
                  proposalObserverSha256=sha(proposal_helper),
                  servedBefore=served, resourceSamples=[], rssCeilingBytes=512 * 1024 * 1024,
                  lobbyPacketMetadata=[], referenceJoined=False, browserUsed=False,
                  originalLoadingSpinFixture=args.original_loading_spin,
                  recordedHostReplay=bool(args.replay_host_report),
                  recordedHostPauseReplayRequested=args.replay_paused_host,
                  recordedGuestReplay=bool(args.replay_guest_world), liveSecondOriginalEngine=False,
                  configuredCoopChapter=args.coop_chapter,
                  configuredCoopRegion=args.coop_region, nativeFixtureContentIdentity=fixture_content,
                  networkManifestSha256=hashlib.sha256(manifest).hexdigest(), worldSnapshotRequested=args.snapshot_world,
                  nativeConfiguredInitialSeed=args.initial_seed,
                  replayOriginalInputsRequested=args.replay_original_inputs,
                  nativePauseWorldRequested=args.pause_world,
                  nativeProductionPauseActionRequested=args.pause_world,
                  nativeIncomingHostPauseObservationRequested=args.observe_host_pause,
                  nativeReadbackWorldRequested=args.readback_world,
                  nativeHostCheckpointReadRequested=args.read_host_checkpoint,
                  nativeBeginFreshNeighborRequested=args.begin_fresh_neighbor,
                  replayHostProposalRequested=bool(args.replay_host_proposal),
                  replayRecipientVotesRequested=bool(args.replay_recipient_votes),
                  replaySavedReturnRecipientRequested=bool(args.replay_saved_return_recipient),
                  requestSavedReturnAtProgress=args.request_saved_return_at_progress,
                  nativeSavedReturnSnapshotRequested=args.snapshot_saved_return,
                  nativeLaterTravelSnapshotRequested=args.snapshot_later_travel,
                  replaySavedRevisitRecipientRequested=bool(args.replay_saved_revisit_recipient),
                  savedRevisitRecipientReplayInputs=revisit_votes.frozen_inputs if revisit_votes else [],
                  savedRevisitRecipientReplayHelperSha256=sha(saved_revisit_votes_helper),
                  savedReturnRecipientReplayInputs=saved_return_votes.frozen_inputs if saved_return_votes else [],
                  savedReturnRecipientReplayHelperSha256=sha(saved_return_votes_helper),
                  replayHostCompletionRequested=bool(args.replay_host_completion or args.replay_saved_return_host),
                  replaySavedReturnHostRequested=bool(args.replay_saved_return_host),
                  commitSavedReturnRequested=args.commit_saved_return,
                  replaySavedReturnCompletionRequested=bool(args.replay_saved_return_completion),
                  replaySavedRevisitHostRequested=bool(args.replay_saved_revisit_host),
                  savedRevisitReplayHelperSha256=sha(saved_revisit_helper),
                  replaySavedRevisitCompletionRequested=bool(args.replay_saved_revisit_completion),
                  savedRevisitResumeHelperSha256=sha(saved_revisit_resume_helper),
                  replaySavedHomeGuestInputsRequested=bool(args.replay_saved_home_guest_inputs),
                  replaySavedHomeHostInputsRequested=args.replay_saved_home_host_inputs,
                  savedHomeInputReplaySources=saved_home_inputs.frozen_inputs if saved_home_inputs else [],
                  savedHomeInputReplayHelperSha256=sha(saved_home_inputs_helper),
                  savedReturnResumeHelperSha256=sha(saved_return_resume_helper),
                  savedReturnReplayHelperSha256=sha(saved_return_helper),
                  savedReturnInputHelperSha256=sha(saved_return_inputs_helper),
                  replayExtendedHostCompletionRequested=args.replay_extended_host_completion,
                  hostCompletionReplayInputs=host_completion.frozen_inputs if host_completion else [],
                  recipientVoteReplayInputs=guest_votes.frozen_inputs if guest_votes else [],
                  importedAgreedSource=imported_source,
                  importedSavedReturnSource=imported_return_source,
                  importedSavedRevisitSource=imported_revisit_source,
                  nativeLoadedTargetSnapshotRequested=args.snapshot_loaded_target,
                  nativeTargetProgressSnapshotRequested=args.snapshot_target_progress,
                  nativeLaterTargetProgressSnapshotRequested=args.snapshot_later_target_progress,
                  pacedTargetGuestInputsRequested=args.pace_target_guest_inputs,
                  extendedTargetGuestInputsRequested=args.extended_target_guest_inputs,
                  timedTargetGuestInputsRequested=args.timed_target_guest_inputs,
                  observeSavedReturnProposalRequested=args.observe_saved_return_proposal,
                  savedReturnReferencePair=saved_return_reference,
                  replayTargetGuestInputsRequested=bool(args.replay_target_guest_inputs),
                  targetGuestInputReplaySources=target_guest_inputs.frozen_inputs if target_guest_inputs else [],
                  targetGuestInputPrefix=args.target_guest_input_prefix,
                  targetGuestInputSourceFrameCount=target_guest_inputs.source_frame_count if target_guest_inputs else 0,
                  targetGuestInputReplayHelperSha256=sha(target_inputs_helper),
                  hostExtendedStreamHelperSha256=sha(extended_stream_helper),
                  proposalReplayHelperSha256=sha(proposal_replay_helper),
                  completionReplayHelperSha256=sha(completion_helper),
                  proposalReplayInputs=proposal_replay.frozen_inputs if proposal_replay else [],
                  importedHostCheckpoint=host_checkpoint,
                  nativeReadbackRebuildMethodRequested=args.rebuild_readback_world or args.dispatch_readback_world,
                  nativeReadbackPhase2Requested=args.dispatch_readback_world,
                  nativeReadbackPausedTicksRequested=args.dispatch_readback_world,
                  nativeReadbackRngRestoreRequested=args.rebuild_readback_world or args.dispatch_readback_world,
                  nativeReadbackUiRestoreRequested=args.rebuild_readback_world or args.dispatch_readback_world,
                  referenceGreetRequested=args.greet_peer, referenceReadyRequested=args.ready_peer, referenceReadyConfirmed=False, referenceOriginalRequestSent=False, referenceOriginalStatusConfirmed=False,
                  gameplayQualified=False, sharedSaveLoadResumeQualified=False,
                  independentInternetQualified=False, sustainedBrowserMemoryBoundQualified=False,
                  goalComplete=False)
    log = out / 'native.log'
    def save():
        (out / 'run.json').write_text(json.dumps(report, indent=2) + '\n')
    async with serve(handler, '127.0.0.1', 0, subprotocols=['recomp-directplay-v1'],
                     origins=[None], compression=None, max_size=relay.LIMIT,
                     max_queue=1, close_timeout=1, logger=logger) as server:
        url = f'ws://127.0.0.1:{server.sockets[0].getsockname()[1]}/rooms'
        env = {k: v for k, v in os.environ.items() if not k.startswith('RECOMP_')}
        switches = dict(PROFILE_DIR=str(profile), REGISTRY=str(private_registry), NETWORK_URL=url, NETWORK_MANIFEST=manifest.decode(),
                        GUEST_ARGS='-nointro -dochecksums', SMOKE_SECONDS=str(args.seconds),
                        SMOKE_WINDOW_INPUT='1', SMOKE_DRAWABLE='800x600',
                        CORE_MODS_DIR=str(GAME / 'build/recomp/mods/core'),
                        MODS_DIR=str(usermods), HOST_DUMP_DIR=str(frames), SCRIPT=str(script))
        switches['NATIVE_MULTIPLAYER_WAIT_OBSERVE'] = 'v1'
        if args.coop_chapter:
            switches['RULE_FRONTIER_CHAPTER'] = str(args.coop_chapter)
        if args.snapshot_world:
            switches['NATIVE_COOP_WORLD_SNAPSHOT'] = 'v1'
        if args.pause_world:
            switches['NATIVE_COOP_WORLD_PAUSE'] = 'v1'
            switches['RULE_COOP_TRANSITION_PAUSE'] = 'v1'
        if args.observe_host_pause:
            switches['NATIVE_COOP_WORLD_INCOMING_PAUSE'] = 'v1'
        if args.readback_world:
            switches['NATIVE_COOP_WORLD_READBACK'] = 'v3' if args.dispatch_readback_world else 'v2' if args.rebuild_readback_world else 'v1'
        if args.read_host_checkpoint:
            switches['NATIVE_COOP_WORLD_HOST_READBACK'] = 'v1'
        if args.begin_fresh_neighbor:
            switches.update(NATIVE_COOP_WORLD_BEGIN_FRESH='v1', RULE_COOP_CHECKPOINT='v1',
                            RULE_COOP_SHARED_READ='v1', RULE_COOP_FRESH_GENERATION='v1')
        if args.replay_host_proposal:
            switches.update(RULE_COOP_CHECKPOINT='v1', RULE_COOP_SHARED_READ='v1',
                            RULE_COOP_FRESH_GENERATION='v1')
        if guest_votes:
            switches['NATIVE_COOP_WORLD_SOURCE_IMPORT'] = 'v1'
        if saved_return_votes:
            switches['NATIVE_COOP_WORLD_RETURN_SOURCE_IMPORT'] = 'v1'
        if revisit_votes:
            switches['NATIVE_COOP_WORLD_TRAVEL_SOURCE_IMPORT'] = 'v1'
        if args.snapshot_loaded_target:
            switches['NATIVE_COOP_WORLD_TARGET_SNAPSHOT'] = 'v1'
        if args.snapshot_target_progress:
            switches['NATIVE_COOP_WORLD_TARGET_PROGRESS'] = 'v1'
        if args.snapshot_later_target_progress:
            switches['NATIVE_COOP_WORLD_TARGET_LATER_PROGRESS'] = 'v1'
        if args.request_saved_return_at_progress:
            switches['NATIVE_COOP_WORLD_RETURN_AT_PROGRESS'] = 'v1'
        if args.snapshot_saved_return:
            switches['NATIVE_COOP_WORLD_RETURN_SNAPSHOT'] = 'v1'
        if args.snapshot_later_travel:
            switches['NATIVE_COOP_WORLD_LATER_TARGET_SNAPSHOT'] = 'v1'
        if args.initial_seed is not None:
            switches['NATIVE_COOP_INITIAL_SEED'] = str(args.initial_seed)
        if region is not None:
            switches.update(RULE_COOP_REGION_GENERATION='v1', RULE_COOP_WORLD='native-terrain-fixture',
                            RULE_COOP_REGION=args.coop_region, CONTENT_IDENTITY=fixture_content,
                            RULE_GAME_INVENTORY_ADAPTER='1')
        if args.original_loading_spin:
            switches['NATIVE_MULTIPLAYER_SPIN_FIXTURE'] = 'v1'
        env.update({'RECOMP_' + k: v for k, v in switches.items()})
        assert sha(private_exe) == build['nativeExecutableSha256'] and not private_registry.exists()
        assert native_state_stamps() == canonical_state
        with log.open('x') as sink:
            process = await asyncio.create_subprocess_exec(str(private_exe), cwd=GAME / 'kit', env=env, stdout=sink, stderr=asyncio.subprocess.STDOUT)
            report.update(nativePid=process.pid, startedAtMs=time.time_ns() // 1000000)
            save();print(json.dumps(dict(nativePid=process.pid, log=str(log))), flush=True)
            async def reference():
                if transcript:
                    replay = replay_guest if args.replay_guest_world else replay_host
                    await replay(relay, connect, url, manifest, transcript, process, packets, report, save)
                    return
                async with connect(url, subprotocols=['recomp-directplay-v1'], compression=None, max_size=relay.LIMIT, max_queue=1, close_timeout=1) as ws:
                    request = 0
                    pending_status = False
                    async def rpc(op, body):
                        nonlocal request
                        request += 1
                        await ws.send(relay.HEADER.pack(relay.MAGIC, 1, op, request, 0) + body)
                        while True:
                            message = await asyncio.wait_for(ws.recv(), 3)
                            magic, version, actual, rid, status = relay.HEADER.unpack_from(message)
                            assert (magic, version) == (relay.MAGIC, 1)
                            if rid:
                                assert (actual, rid, status) == (op | relay.REPLY, request, 0)
                                return message[20:]
                            record(actual, message[20:])
                    def record(op, body):
                        nonlocal pending_status
                        if op == relay.PACKET_EVENT:
                            payload = body[12:]
                            previous_bytes = sum(p['bytes'] for p in report['lobbyPacketMetadata'])
                            if len(body) < 12 or len(payload) > 65536 or len(report['lobbyPacketMetadata']) >= 128 or previous_bytes + len(payload) > 2 * 1024 * 1024:
                                raise RuntimeError('Reference lobby packet observation cap reached')
                            sequence = relay.word(body)
                            assert sequence == len(report['lobbyPacketMetadata']) + 1
                            packet = packets / f'{sequence:03}.bin'
                            with packet.open('xb') as sink:
                                sink.write(payload)
                            report['lobbyPacketMetadata'].append(dict(sequence=sequence, sender=relay.word(body, 4), recipient=relay.word(body, 8), bytes=len(payload), sha256=hashlib.sha256(payload).hexdigest(), copy=str(packet), headerWord=relay.word(payload) if len(payload) >= 4 else None))
                            if len(payload) == 52 and relay.word(payload) == 0x100 and relay.word(payload, 4) == 2:
                                status = bytes(byte ^ 0x31 for byte in payload[8:])
                                if relay.word(status) == report.get('referencePlayerId'):
                                    pending_status = (args.greet_peer or args.ready_peer) and not report['referenceOriginalRequestSent']
                                    if report['referenceOriginalRequestSent'] and status[12:44].split(b'\0', 1)[0] == b'1.5.1.2' and status[8] == int(args.ready_peer) and int.from_bytes(status[10:12], 'little') == 0x106:
                                        report['referenceOriginalStatusConfirmed'] = True
                                        report['referenceReadyConfirmed'] = args.ready_peer

                        elif op == relay.LOST_EVENT:
                            report['referenceSawSessionLoss'] = True
                    await rpc(relay.HELLO, relay.string(manifest))
                    while process.returncode is None:
                        r = relay.Reader(await rpc(relay.LIST, bytes(16) + relay.put(1)))
                        count = r.u32();assert count in (0, 1)
                        if count:
                            room = relay.Session.read(r);r.done()
                            report['originalRoomListed'] = True
                            report['originalRoomPlayerCount'] = relay.word(room.desc, 44)
                            if relay.word(room.desc, 44):
                                room_copy = packets / 'original-room.bin'
                                room_copy.write_bytes(room.encode())
                                report['originalRoomSnapshot'] = dict(copy=str(room_copy), sha256=sha(room_copy), bytes=room_copy.stat().st_size)
                                r = relay.Reader(await rpc(relay.JOIN, room.encode()))
                                relay.Session.read(r)
                                count = r.u32();players = [relay.Player.read(r) for _ in range(count)];r.done()
                                report['originalHostPlayerSnapshots'] = []
                                for player in players:
                                    player_copy = packets / f'original-host-player-{player.id}.bin'
                                    player_copy.write_bytes(player.encode())
                                    report['originalHostPlayerSnapshots'].append(dict(copy=str(player_copy), sha256=sha(player_copy), bytes=player_copy.stat().st_size))
                                report['originalHostPlayerIds'] = [p.id for p in players]
                                r = relay.Reader(await rpc(relay.PLAYER, relay.Player(0xffffffff, 0, b'Transport reference', b'Transport reference', b'').encode()))
                                report['referenceRosterCount'] = r.u32()
                                reference_player = relay.Player.read(r);r.done()
                                report['referencePlayerId'] = reference_player.id
                                reference_copy = packets / 'reference-player.bin'
                                reference_copy.write_bytes(reference_player.encode())
                                report['referencePlayerSnapshot'] = dict(copy=str(reference_copy),
                                    sha256=sha(reference_copy), bytes=reference_copy.stat().st_size)
                                report['referenceJoined'] = True;save()
                                while process.returncode is None:
                                    try:
                                        message = await asyncio.wait_for(ws.recv(), .5)
                                    except asyncio.TimeoutError:
                                        continue
                                    magic, version, op, rid, status = relay.HEADER.unpack_from(message)
                                    assert (magic, version, rid, status) == (relay.MAGIC, 1, 0, 0)
                                    record(op, message[20:])
                                    if pending_status:
                                        # The pinned sender004536d0 builds type0x20 with a44-byte
                                        # status (its32-byte tail is the version label).00588370 XORs only its body with the manager's
                                        # key0x31 (set at004bae00). Not Ready never starts a map.
                                        import struct
                                        version_label = b'1.5.1.2'
                                        status = struct.pack('<IIBxH32s', report['referencePlayerId'], 0xffffffff, int(args.ready_peer), 0x106, version_label)
                                        payload = relay.put(0x100, 0x20) + bytes(byte ^ 0x31 for byte in status)
                                        host_id = report['originalHostPlayerIds'][0]
                                        await ws.send(relay.HEADER.pack(relay.MAGIC, 1, relay.SEND, 0, 0) + relay.put(1, report['referencePlayerId'], host_id, 1) + payload)
                                        report['referenceOriginalRequestSent'] = True
                                        pending_status = False
                                        request_copy = packets / ('reference-ready.bin' if args.ready_peer else 'reference-not-ready.bin')
                                        request_copy.write_bytes(payload)
                                        report['referenceOriginalRequest'] = dict(copy=str(request_copy), sha256=sha(request_copy), bytes=len(payload), sender=report['referencePlayerId'], recipient=host_id, type=0x20, ready=args.ready_peer)
                                        save()
                                return
                        else:
                            r.done()
                        await asyncio.sleep(.25)
            ref = asyncio.create_task(reference())
            start = time.monotonic()
            log_cursor = 0
            log_tail = b''
            wait_reported = False
            while process.returncode is None:
                if args.begin_fresh_neighbor or args.replay_host_proposal:
                    for room in service.rooms.values():
                        barrier = room.barrier
                        if barrier:
                            snapshot = dict(serial=barrier.serial, committed=barrier.committed,
                                            players=list(barrier.players), ready=sorted(barrier.ready),
                                            loaded=sorted(barrier.loaded),
                                            descriptorSha256=hashlib.sha256(barrier.descriptor).hexdigest())
                            samples = report.setdefault('proposalRelaySnapshots', [])
                            if not samples or samples[-1]['state'] != snapshot:
                                if len(samples) >= (12 if args.replay_saved_revisit_host or args.replay_saved_revisit_recipient else 8):
                                    raise RuntimeError('Owned proposal state observation cap exceeded')
                                samples.append(dict(sampledAtMs=time.time_ns() // 1000000, state=snapshot))
                if time.monotonic() - start > args.seconds + 15:
                    report['stopReason'] = 'owned native producer deadline';process.terminate();break
                try:
                    rows = await asyncio.create_subprocess_exec('ps', '-p', str(process.pid), '-o', 'rss=,time=', stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL)
                    raw, _ = await rows.communicate()
                    if raw.strip():
                        rss_text, cpu_text = raw.decode().split()
                        rss = int(rss_text) * 1024
                        cpu_seconds = sum(float(part) * 60 ** index for index, part in enumerate(reversed(cpu_text.split(':'))))
                        # Incremental bounded reads correlate CPU samples with
                        # the actual original Go wait, rather than startup.
                        with log.open('rb') as trace:
                            trace.seek(log_cursor)
                            part = trace.read(65536)
                            log_cursor = trace.tell()
                        text = log_tail + part
                        wait_reported |= b'[network] Original initialization wait interval-ms=' in text
                        log_tail = text[-256:]
                        report['resourceSamples'].append(dict(elapsedSeconds=round(time.monotonic() - start, 2), rssBytes=rss, nativeCpuSeconds=cpu_seconds, originalInitializationWaitReported=wait_reported))
                        if rss > report['rssCeilingBytes']:
                            report['stopReason'] = 'native RSS ceiling';process.terminate();break
                except (ValueError, ProcessLookupError):
                    pass
                await asyncio.sleep(.5)
            try:
                code = await asyncio.wait_for(process.wait(), 5)
            except asyncio.TimeoutError:
                report['stopReason'] = report.get('stopReason') or 'owned native producer failed to exit'
                process.kill()
                code = await process.wait()
            ref.cancel()
            result = await asyncio.gather(ref, return_exceptions=True)
            if result and isinstance(result[0], Exception):
                report['referenceError'] = type(result[0]).__name__ + ': ' + str(result[0])
            report.update(nativeExitCode=code, nativeSessionTerminal=True, finishedAtMs=time.time_ns() // 1000000)
    assert not service.peers and not service.rooms
    try:
        os.kill(process.pid, 0)
    except ProcessLookupError:
        report['producerAbsent'] = True
    else:
        raise RuntimeError('Native producer remains live')
    assert all(sha(ROOT / path) == expected for path, expected in sources.items())
    assert all(sha(profile_source / name) == expected for name, expected in inputs.items())
    assert native_state_stamps() == canonical_state
    assert sha(private_exe) == build['nativeExecutableSha256']
    for name, stamp in served.items():
        p = GAME / 'build/web-site/majesty' / name;st = p.stat()
        assert stamp == dict(sha256=sha(p), bytes=st.st_size, inode=st.st_ino, mtimeNs=st.st_mtime_ns)
    assert all(sha(Path(packet['copy'])) == packet['sha256'] for packet in report['lobbyPacketMetadata'])
    if host_checkpoint:
        assert sha(Path(host_checkpoint['path'])) == host_checkpoint['sha256']
        report['importedHostCheckpointUnchanged'] = True
    report.update(fixtureStopped=True, fixtureConnections=connections, originalSettingsUnchanged=True,
                  canonicalNativeStateUnchanged=True, privateNativeExecutableUnchanged=True,
                  servedUnchanged=True, logSha256=sha(log),
                  originalNativeLobbyConnectionQualified=code == 0 and report['referenceJoined'] and bool(report['lobbyPacketMetadata']),
                  originalLobbyRequestResponseQualified=code == 0 and report['referenceOriginalRequestSent'] and report['referenceOriginalStatusConfirmed'],
                  scope='One original native game with owned settings/profile and real loopback relay/reference peer. Reference records original packets and optionally sends lobby readiness only; it has no world and sends no world-initialization acknowledgement. Original loading may be observed; playable gameplay, a second engine, shared save/resume and internet play remain unqualified.')
    if transcript:
        report.update(replaySourceReport=str(transcript.report_path),
                      replayInputs=transcript.frozen_inputs,
                      scope='One original native guest against a byte-preserved transcript from a terminal original host. Captured host GoStatus is sent only after this guest emits its own original GoStatus. This is sequential recorded-host loading evidence, not live two-engine synchronization, shared campaign completion, internet or browser qualification.')
        transcript.verify_preserved()
        if args.replay_paused_host:
            report['scope'] = 'One original native guest receives the exact inspected host pause command and bounded original input window after its own original initialization vote. The reference has no continuing world. Incoming settled pause requires separate original state/save inspection; shared restoration, resume and paired gameplay remain unqualified.'
        if args.replay_guest_world:
            report.update(recordedGuestReplay=True, recordedHostReplay=False,
                          guestReplayHelperSha256=sha(guest_helper),
                          scope='One original native host with a worldless reference replaying original guest readiness/vote. Admission binds an independently inspected guest world and identical original GameStart. No gameplay/Loaded responses or continuing second world are supplied; paired synchronization, shared resume and campaign outcomes remain unqualified.')
    if args.snapshot_world:
        snapshots = []
        for label in ('Coop_World_Ready', 'Coop_World_Progress'):
            path = profile / 'Documents/My Games/MajestyHD/SaveGame' / (label + '.GMP')
            if path.is_file() and not path.is_symlink() and 0 < path.stat().st_size <= 2 * 1024 * 1024:
                snapshots.append(dict(label=label, path=str(path), bytes=path.stat().st_size, sha256=sha(path)))
        report['worldSnapshots'] = snapshots
        report['twoOriginalWorldSnapshotsCaptured'] = len(snapshots) == 2
    if args.begin_fresh_neighbor or args.replay_host_proposal:
        save_root = profile / 'Documents/My Games/MajestyHD/SaveGame'
        report['proposalSourceFiles'] = [dict(path=str(path), bytes=path.stat().st_size, sha256=sha(path))
            for path in sorted(save_root.glob('CoopTransitions_native-terrain-fixture_0_0*'))
            if path.is_file() and not path.is_symlink() and path.stat().st_size <= 2 * 1024 * 1024]
    if args.replay_original_inputs:
        report.update(originalInputHelperSha256=sha(input_helper),
            scope='One original native host with independently inspected original guest initialization and one unchanged bounded empty-input window. Reference has no world; no live paired simulation or shared load/resume votes.')
    if args.readback_world:
        path = profile / 'Documents/My Games/MajestyHD/SaveGame/Coop_World_Readback.GMP'
        report['originalAttachedWorldReadbackSaved'] = path.is_file() and not path.is_symlink() and 0 < path.stat().st_size <= 2 * 1024 * 1024
        if report['originalAttachedWorldReadbackSaved']:
            report['worldReadback'] = dict(path=str(path), bytes=path.stat().st_size, sha256=sha(path))
        report['scope'] = 'One actual original paused host disposes its source and executes the production full-reader leaf, preserves its actual SDK party and local kingdom, attaches the target with original00415f30 for serialization, then disposes it and requests original exit. No committed shared barrier, phase rebuild, peer Loaded vote, shared resume or paired gameplay qualification.'
        if args.rebuild_readback_world:
            report['scope'] = 'One actual original paused host exercises the full reader, attachment and original rebuild method while a native-only hook holds its terminal request3 at00417077. No phase2 dispatcher, committed barrier, Loaded vote, shared resume or live paired gameplay qualification.'
        if args.dispatch_readback_world:
            report['scope'] = 'One actual original paused host reads/attaches its saved world. Native-only scheduling queues pending2; the original dispatcher rebuilds phase2 and the production hold queues7. After actual settled pause, original writer/disposal/exit complete. No committed web proposal, peer Ready/Loaded vote, shared resume or paired gameplay qualification.'
        if args.observe_host_pause:
            report['scope'] = 'One actual original guest at the inspected incoming host pause reads/attaches its own full saved world while retaining its original player2/kingdom1 party binding. Optional native-only pending2 scheduling exercises the original phase2 rebuild and production pause hold, then two paused bodies and original serialization/disposal/exit. No host-save transfer, committed web barrier, Ready/Loaded vote, shared resume or live paired gameplay qualification.'
        if args.read_host_checkpoint:
            report['scope'] = 'One actual original guest at the captured host pause reads/rebuilds an unchanged offline copy of that inspected host full checkpoint, retaining its actual player2/kingdom1 party binding. Native-only scheduling/production hold/two paused bodies and serialization follow. No checkpoint transport, committed web barrier, Ready/Loaded votes, shared resume or live paired gameplay qualification.'
    if args.begin_fresh_neighbor:
        report['scope'] = 'One actual original paused host captures its source through the production serializer/store and proposes a fresh east neighbor through the negotiated SDK. Its own Ready may execute. The passive observer sends no Ready/Loaded; no committed load, generation, resume, continuing second engine, or paired gameplay is qualified.'
    if args.replay_host_proposal:
        proposal_replay.verify_preserved()
        report['scope'] = 'One original guest receives inspected original host pause plus unchanged captured SDK Begin/Ready bodies. Its own source capture, Ready/generation/Loaded must be independently inspected. Reference has no world and sends no host Loaded/resume; live paired gameplay remains unqualified.'
    if host_completion:
        host_completion.verify_preserved()
        report['scope'] = 'One original recipient receives unchanged inspected original host Begin/Ready/Loaded and immediate resume plus the admitted bounded actually captured target stream (including unchanged original Ping traffic in extended mode). Its original target/resume must be independently inspected; the reference has no continuing world, and live paired simulation remains unqualified.'
    if guest_votes:
        guest_votes.verify_preserved()
    if saved_return_votes:
        saved_return_votes.verify_preserved()
        report['scope'] = 'One original host imports the inspected original agreed source without altering its live world, begins the production fresh load and receives unchanged actual captured recipient Ready/Loaded. Original host target/load/resume require independent inspection. Reference has no continuing world; live paired gameplay remains unqualified.'
    if target_guest_inputs:
        target_guest_inputs.verify_preserved()
    if args.snapshot_loaded_target:
        target = profile / 'Documents/My Games/MajestyHD/SaveGame/Coop_World_Target.GMP'
        report['originalLoadedTargetSaved'] = target.is_file() and not target.is_symlink() and 0 < target.stat().st_size <= 2 * 1024 * 1024
        if report['originalLoadedTargetSaved']:
            report['loadedTargetSnapshot'] = dict(path=str(target), bytes=target.stat().st_size, sha256=sha(target))
    if args.snapshot_target_progress:
        progress = profile / 'Documents/My Games/MajestyHD/SaveGame/Coop_Target_Progress.GMP'
        report['originalTargetProgressSaved'] = progress.is_file() and not progress.is_symlink() and 0 < progress.stat().st_size <= 2 * 1024 * 1024
        if report['originalTargetProgressSaved']:
            report['targetProgressSnapshot'] = dict(path=str(progress), bytes=progress.stat().st_size, sha256=sha(progress))
    if args.snapshot_later_target_progress:
        later = profile / 'Documents/My Games/MajestyHD/SaveGame/Coop_Target_Later_Progress.GMP'
        report['originalLaterTargetProgressSaved'] = later.is_file() and not later.is_symlink() and 0 < later.stat().st_size <= 2 * 1024 * 1024
        if report['originalLaterTargetProgressSaved']:
            report['laterTargetProgressSnapshot'] = dict(path=str(later), bytes=later.stat().st_size, sha256=sha(later))
    if args.observe_saved_return_proposal or args.replay_saved_return_host:
        save_root = profile / 'Documents/My Games/MajestyHD/SaveGame'
        report['savedReturnSourceFiles'] = [dict(path=str(path), bytes=path.stat().st_size, sha256=sha(path))
            for path in sorted(save_root.glob('CoopTransitions_native-terrain-fixture_1_0*'))
            if path.is_file() and not path.is_symlink() and path.stat().st_size <= 2 * 1024 * 1024]
        report['scope'] = 'One original host requests production west travel after actual fresh travel and recorded peer input progression. Serial2 Prepared and both retained source checkpoints require independent inspection. No second-travel Ready/Loaded votes are replayed; saved return completion and live paired gameplay remain unqualified.'
        if args.replay_saved_return_host:
            report['scope'] = 'One original guest receives the unchanged stopped host first completion, second pause and second Begin. A worldless reference serves the exact retained home only on actual recipient checkpoint requests/ACKs and casts no second-trip Ready/Loaded. Recipient checkpoint import/source capture/Ready require independent inspection; committed return and live paired gameplay remain unqualified.'
            if args.commit_saved_return:
                report['scope'] = 'One original guest receives recorded actual host completion/pause/Begin and owned checkpoint bytes. Only after its own actual second Ready, the reference replays the captured actual host second Ready. No second host Loaded, resume or live paired gameplay is supplied. Committed saved read and recipient Loaded require independent inspection.'
            if args.replay_saved_return_completion:
                report['scope'] = 'One original guest loads the actual recorded host home checkpoint. Only after its real second Ready/Loaded and full original held-home writer, a worldless reference replays inspected actual host second Loaded and original immediate resume after the real Complete barrier. Full preservation and executed recipient resume require independent inspection; no live paired/browser qualification.'
        if saved_return_votes:
            report['scope'] = 'One original host completes fresh travel and requests saved west return. A worldless reference replays inspected actual recipient second Ready only for the identical real proposal, and second Loaded only after the host original saved reader/rebuild/Loaded boundary. Actual host shared resume and retained saves require independent inspection. No live paired or browser qualification.'
    if args.snapshot_saved_return:
        target = profile / 'Documents/My Games/MajestyHD/SaveGame/Coop_World_Return_Target.GMP'
        report['originalSavedReturnTargetSaved'] = target.is_file() and not target.is_symlink() and 0 < target.stat().st_size <= 2 * 1024 * 1024
        if report['originalSavedReturnTargetSaved']:
            report['savedReturnTargetSnapshot'] = dict(path=str(target),bytes=target.stat().st_size,sha256=sha(target))
    if args.snapshot_later_travel:
        save_root = profile / 'Documents/My Games/MajestyHD/SaveGame'
        report['laterTravelTargetSnapshots'] = [dict(path=str(path),bytes=path.stat().st_size,sha256=sha(path))
            for path in sorted(save_root.glob('Coop_World_Travel_Target_*.GMP'))
            if path.is_file() and not path.is_symlink() and 0 < path.stat().st_size <= 2 * 1024 * 1024]
    if args.replay_saved_revisit_host:
        report['scope'] = 'One original guest receives an inspected recorded host third pause and saved-neighbor Begin. A worldless reference serves the exact neighbor only on actual checkpoint requests/ACKs and sends the recorded host Ready only after the recipient actual Ready. Original third saved reader/rebuild/Loaded require independent inspection. No third host Loaded/resume or live paired/browser qualification.'
        assert not log.is_symlink() and log.stat().st_size <= 4 * 1024 * 1024
        revisit_trace = log.read_text()
        report['originalSavedRevisitReaderLoadedObserved'] = all(marker in revisit_trace for marker in [
            '[coop-load] Saved source teardown epoch=1 serial=3 pause-held=1 loaded=1',
            '[coop-load] Held epoch=1 serial=3 slot=1 clock=1550',
            '[coop-load] Loaded epoch=1 serial=3 slot=1'])
    if args.replay_saved_revisit_completion:
        report['scope']='One original recipient receives actual third host Loaded/resume only after its own original third held-world writer and actual Complete barrier. Full source/target preservation and executed resume require independent inspection; no live paired/browser qualification.'
    if saved_return_votes:
        current = profile / 'Documents/My Games/MajestyHD/SaveGame/Coop_World_Return_Source.GMP'
        report['originalCurrentReturnSourceSaved'] = current.is_file() and not current.is_symlink() and 0 < current.stat().st_size <= 2 * 1024 * 1024
        if report['originalCurrentReturnSourceSaved']:
            report['currentReturnSourceSnapshot'] = dict(path=str(current),bytes=current.stat().st_size,sha256=sha(current))
    if revisit_votes:
        revisit_votes.verify_preserved()
        current = profile / 'Documents/My Games/MajestyHD/SaveGame/Coop_World_Travel_Source_3.GMP'
        report['originalCurrentRevisitSourceSaved'] = current.is_file() and not current.is_symlink() and 0 < current.stat().st_size <= 2 * 1024 * 1024
        if report['originalCurrentRevisitSourceSaved']:
            report['currentRevisitSourceSnapshot'] = dict(path=str(current),bytes=current.stat().st_size,sha256=sha(current))
        report['scope'] = 'One original host receives unchanged third recipient Ready/Loaded for the exact recorded saved revisit, with actual live source capture and full original held target writer. Both source/target gameplay, original Complete and executed resume require independent inspection. No live paired or browser qualification.'
    save();(ROOT / f'output/native-multiplayer-lobby-{args.attempt:03}-observed.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: report.get(k) for k in ['nativeExitCode', 'referenceJoined', 'originalNativeLobbyConnectionQualified', 'originalLobbyRequestResponseQualified', 'referenceReadyConfirmed', 'stopReason', 'producerAbsent', 'fixtureStopped']}), flush=True)
    print(json.dumps(dict(lobbyPackets=len(report['lobbyPacketMetadata']), peakRssBytes=max((x['rssBytes'] for x in report['resourceSamples']), default=0))), flush=True)
    replay_completed = not transcript or (report.get('originalGuestGoStatusObserved') and report.get('capturedHostGoStatusDelivered'))
    if args.replay_paused_host:
        replay_completed = replay_completed and report.get('capturedHostPauseInputWindowDelivered')
    if args.replay_guest_world:
        replay_completed = report.get('originalHostGameStartMatched') and report.get('originalHostGoStatusObserved') and report.get('capturedGuestGoStatusDelivered')
    if args.replay_original_inputs:
        replay_completed = replay_completed and report.get('originalGuestInputWindowDelivered')
    if args.replay_host_proposal:
        recipient_actions = [r['action'] for r in report.get('proposalProtocolRequests', [])
                             if r['sender'] == 2 and r['host'] is False and r['op'] == 12 and r['action'] > 0 and
                             (not args.replay_saved_return_host or relay.word(Path(r['copy']).read_bytes(), 24) == 1)]
        replay_completed = replay_completed and report.get('capturedOriginalHostProposalDelivered') is True and recipient_actions == [2, 3]
    if guest_votes:
        replay_completed = replay_completed and guest_votes.sent_ready and guest_votes.sent_loaded
    if target_guest_inputs:
        replay_completed = replay_completed and target_guest_inputs.window.delivered and len(report.get('replayedGuestTargetInputPackets',[]))==len(target_guest_inputs.window.payloads) and report.get('originalGuestTargetInputsDelivered')is True
    if host_completion:
        replay_completed = replay_completed and host_completion.sent_loaded and host_completion.resume.delivered
    if args.snapshot_loaded_target:
        replay_completed = replay_completed and report.get('originalLoadedTargetSaved') is True
    if args.snapshot_target_progress:
        replay_completed = replay_completed and report.get('originalTargetProgressSaved') is True
    if args.snapshot_later_target_progress:
        replay_completed = replay_completed and report.get('originalLaterTargetProgressSaved') is True
    if args.observe_saved_return_proposal:
        replay_completed = replay_completed and len(report.get('observedSavedReturnEvents', [])) == (3 if saved_return_votes else 1) and len(report.get('savedReturnSourceFiles', [])) == 2
    if saved_return_votes:
        replay_completed = replay_completed and saved_return_votes.sent_ready and saved_return_votes.sent_loaded and report.get('originalCurrentReturnSourceSaved') is True
    if args.replay_saved_return_host:
        replay_completed = replay_completed and host_completion.sent_return_begin and host_completion.transfer.completed and len(report.get('savedReturnSourceFiles', [])) == (3 if args.replay_saved_revisit_host else 2)
    if args.replay_saved_revisit_host:
        replay_completed = replay_completed and host_completion.revisit.sent_ready and host_completion.revisit.transfer.completed and len(report.get('observedSavedRevisitEvents', [])) == (3 if args.replay_saved_revisit_completion else 2) and report.get('originalSavedRevisitReaderLoadedObserved') is True
    if args.replay_saved_revisit_completion:
        replay_completed = replay_completed and host_completion.revisit_completion.sent_loaded and host_completion.revisit_completion.sent_resume and report.get('capturedOriginalThirdHostResumeDelivered')is True
    if args.commit_saved_return:
        replay_completed = replay_completed and host_completion.sent_return_ready
    if args.replay_saved_return_completion:
        replay_completed = replay_completed and host_completion.return_completion.sent_loaded and host_completion.return_completion.sent_resume and report.get('capturedOriginalSecondHostResumeDelivered') is True
    if saved_home_inputs:
        saved_home_inputs.verify_preserved()
        replay_completed = replay_completed and saved_home_inputs.window.delivered and len(report.get('savedHomeInputServerAcks',[]))==len(saved_home_inputs.window.payloads) and len(report.get('observedRevisitEvents',[]))==(3 if revisit_votes else 1)
    if revisit_votes:
        replay_completed = replay_completed and revisit_votes.sent_ready and revisit_votes.sent_loaded and report.get('originalCurrentRevisitSourceSaved') is True and len(report.get('laterTravelTargetSnapshots',[]))==1
    if args.snapshot_saved_return:
        replay_completed = replay_completed and report.get('originalSavedReturnTargetSaved') is True
    return 0 if code == 0 and not report.get('stopReason') and not report.get('referenceError') and replay_completed and (not args.snapshot_world or report.get('twoOriginalWorldSnapshotsCaptured')) and (not args.readback_world or report.get('originalAttachedWorldReadbackSaved')) else 1


if __name__ == '__main__':
    raise SystemExit(asyncio.run(main()))
